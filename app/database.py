import os
import logging
from contextlib import contextmanager
from urllib.parse import urlparse
from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean, TIMESTAMP, func
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from sqlalchemy.exc import SQLAlchemyError
from pathlib import Path

from .config import DATABASE_URL, BASE_DIR

# Configure basic logging for this module
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)
logger.addHandler(handler)

# Determine DB URL
# If config provided a specific URL, use it. Otherwise default to local SQLite.
# Note: DATABASE_URL is loaded from app.config which gets it from os.getenv.
FINAL_DATABASE_URL = DATABASE_URL
if not FINAL_DATABASE_URL:
    FINAL_DATABASE_URL = f"sqlite:///{BASE_DIR.parent / 'webdl-manager.db'}"
elif FINAL_DATABASE_URL.startswith("mysql://"):
    # Automatically use pymysql driver if not specified
    FINAL_DATABASE_URL = FINAL_DATABASE_URL.replace("mysql://", "mysql+pymysql://")

db_type = 'mysql' if 'mysql' in FINAL_DATABASE_URL else 'sqlite'

# SQLAlchemy Setup
def create_db_engine(url):
    """Creates a database engine with a fallback strategy for MySQL SSL."""
    pool_settings = {
        "pool_size": 10,
        "max_overflow": 20,
        "pool_recycle": 3600,
        "pool_pre_ping": True,
    }
    
    if "mysql" in url:
        # 1. Attempt plain connection first
        try:
            logger.info("Attempting plain MySQL connection...")
            temp_engine = create_engine(url, **pool_settings)
            # Test connection immediately
            with temp_engine.connect() as conn:
                logger.info("Plain MySQL connection successful.")
                return temp_engine
        except Exception as e:
            logger.info(f"Plain MySQL connection failed ({e}). Attempting SSL with trusted certificates...")
            # 2. Attempt SSL connection, trusting all certificates (no verification)
            try:
                # For pymysql, passing a dict to 'ssl' enables SSL.
                # Disabling 'check_hostname' and not providing 'ca' effectively trusts remote certs.
                ssl_engine = create_engine(
                    url, 
                    **pool_settings,
                    connect_args={"ssl": {"check_hostname": False}}
                )
                # Test connection
                with ssl_engine.connect() as conn:
                    logger.info("SSL MySQL connection successful (certificates trusted).")
                    return ssl_engine
            except Exception as e2:
                logger.error(f"MySQL SSL connection failed: {e2}")
                raise e2
    else:
        # SQLite or other schemes
        sqlite_args = {"check_same_thread": False} if "sqlite" in url else {}
        return create_engine(
            url, 
            pool_pre_ping=True,
            connect_args=sqlite_args
        )

try:
    engine = create_db_engine(FINAL_DATABASE_URL)
except Exception as e:
    logger.error(f"Failed to initialize database engine: {e}")
    logger.warning("Falling back to in-memory SQLite database.")
    # Fallback to in-memory sqlite to prevent crash
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- Models ---
class UserModel(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    is_admin = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

class ConfigModel(Base):
    __tablename__ = "config"
    id = Column(Integer, primary_key=True, index=True)
    key_name = Column(String(100), unique=True, nullable=False, index=True)
    key_value = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

class LogModel(Base):
    __tablename__ = "logs"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(TIMESTAMP, server_default=func.now())
    level = Column(String(50))
    logger_name = Column(String(100))
    message = Column(Text)
    pathname = Column(Text)
    lineno = Column(Integer)

# --- Database Initialization ---
def init_db():
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables checked/created.")
    except Exception as e:
        logger.error(f"Error initializing database: {e}")

@contextmanager
def get_db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

# --- Configuration Manager ---
class ConfigManager:
    """Manages application configuration stored in database with memory caching."""
    
    _cache = {}

    def get_config(self, key: str, default=None):
        """
        Retrieves a configuration value.
        Strategy:
        1. Try memory cache.
        2. Try to fetch from Database.
        3. If 'DATABASE_URL' env var is set (MySQL mode), strictly return DB value or default.
        4. If using default SQLite, fallback to os.getenv for backward compatibility.
        """
        # 1. Try Cache
        if key in self._cache:
            return self._cache[key]

        # 2. Try DB
        db_val = self._get_from_db(key)
        if db_val is not None:
            self._cache[key] = db_val # Update cache
            return db_val
            
        # 3. Strict Mode Check
        if os.getenv("DATABASE_URL"):
            return default
            
        # 4. Fallback to Env (SQLite/Default mode)
        env_val = os.getenv(key, default)
        if env_val is not None:
             self._cache[key] = env_val # Cache env fallback too
        return env_val

    def _get_from_db(self, key: str):
        try:
            with get_db_session() as session:
                item = session.query(ConfigModel).filter(ConfigModel.key_name == key).first()
                if item:
                    return item.key_value
        except Exception as e:
            logger.error(f"Error getting config '{key}' from DB: {e}")
        return None

    def set_config(self, key: str, value: str):
        try:
            with get_db_session() as session:
                existing = session.query(ConfigModel).filter(ConfigModel.key_name == key).first()
                if existing:
                    existing.key_value = value
                else:
                    new_config = ConfigModel(key_name=key, key_value=value)
                    session.add(new_config)
                session.commit()
                self._cache[key] = value # Update cache
                logger.info(f"Config '{key}' set.")
        except Exception as e:
            logger.error(f"Error setting config '{key}': {e}")

    def clear_cache(self):
        self._cache.clear()
        logger.info("Configuration cache cleared.")

db_config = ConfigManager()

# --- User Helper Wrapper (Adapting to existing code interface) ---
class User:
    _user_cache = {}

    def __init__(self, id: int, username: str, hashed_password: str, is_admin: bool, **kwargs):
        self.id = id
        self.username = username
        self.hashed_password = hashed_password
        self.is_admin = is_admin

    @staticmethod
    def get_user_by_username(username: str):
        if username in User._user_cache:
            return User._user_cache[username]

        try:
            with get_db_session() as session:
                user_db = session.query(UserModel).filter(UserModel.username == username).first()
                if user_db:
                    user = User(user_db.id, user_db.username, user_db.hashed_password, user_db.is_admin)
                    User._user_cache[username] = user
                    return user
                return None
        except Exception as e:
            logger.error(f"Error getting user by username '{username}': {e}")
            return None

    @staticmethod
    def create_user(username: str, hashed_password: str, is_admin: bool = False):
        try:
            with get_db_session() as session:
                new_user = UserModel(username=username, hashed_password=hashed_password, is_admin=is_admin)
                session.add(new_user)
                session.commit()
                # Clear user cache on new user creation
                User._user_cache.pop(username, None)
                logger.info(f"User '{username}' created successfully.")
                return True
        except Exception as e:
            logger.error(f"Error creating user '{username}': {e}")
            return False

    @staticmethod
    def count_users():
        try:
            with get_db_session() as session:
                return session.query(UserModel).count()
        except Exception as e:
            logger.error(f"Error counting users: {e}")
            return 0

    @staticmethod
    def update_password(username: str, new_hashed_password: str):
        try:
            with get_db_session() as session:
                user_db = session.query(UserModel).filter(UserModel.username == username).first()
                if user_db:
                    user_db.hashed_password = new_hashed_password
                    session.commit()
                    # Update cache
                    if username in User._user_cache:
                        User._user_cache[username].hashed_password = new_hashed_password
                    logger.info(f"Password updated for user '{username}'.")
                    return True
                return False
        except Exception as e:
            logger.error(f"Error updating password for user '{username}': {e}")
            return False

def clear_all_caches():
    """Clears all in-memory caches (config and user)."""
    db_config.clear_cache()
    User._user_cache.clear()
    from . import status
    status.clear_status_cache()
    logger.info("All application caches cleared.")

# Check if we are using SQLite (memory or file) and initialize DB immediately
# This prevents errors when other modules (like redis_client) try to access config on import
logger.info(f"Checking database URL for initialization: {engine.url}")
if "sqlite" in str(engine.url):
    logger.info("SQLite database detected. Initializing tables immediately.")
    init_db()
