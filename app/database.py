import mysql.connector
from mysql.connector import pooling
from mysql.connector import errorcode
import sqlite3
import os
import logging
import datetime
from contextlib import contextmanager
from urllib.parse import urlparse, parse_qs

from .config import DATABASE_URL

# Configure basic logging for this module
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)
logger.addHandler(handler)

# Database connection pool
db_pool = None
db_type = None  # 'mysql' or 'sqlite'

def init_db_pool():
    global db_pool, db_type
    if db_pool is None:
        try:
            url = urlparse(DATABASE_URL)
            db_type = url.scheme
            
            if db_type == 'mysql':
                # Extract connection details from URL
                db_user = url.username
                db_password = url.password
                db_host = url.hostname
                db_port = url.port or 3306
                db_name = url.path.lstrip('/')
                
                # Parse query string for extra options like ssl_mode
                query_params = parse_qs(url.query)
                ssl_mode = query_params.get('ssl-mode', [None])[0]
                ssl_ca = query_params.get('ssl-ca', [None])[0]

                pool_cnx_args = {
                    "host": db_host,
                    "user": db_user,
                    "password": db_password,
                    "database": db_name,
                    "port": db_port,
                    "autocommit": True,
                    "auth_plugin": "mysql_native_password",  # Use native password plugin to avoid SSL requirement
                }

                if ssl_mode:
                    logger.info(f"SSL mode specified: {ssl_mode}")
                    if ssl_mode in ['VERIFY_CA', 'VERIFY_IDENTITY']:
                        if not ssl_ca:
                            raise ValueError("ssl-ca parameter is required for ssl-mode=VERIFY_CA or VERIFY_IDENTITY")
                        pool_cnx_args['ssl_ca'] = ssl_ca
                        pool_cnx_args['ssl_verify_cert'] = True
                        logger.info(f"SSL verification enabled using CA file: {ssl_ca}")
                    elif ssl_mode == 'REQUIRED':
                        pool_cnx_args['ssl_verify_cert'] = False
                        logger.info("SSL enabled but certificate verification is disabled (ssl-mode=REQUIRED).")
                    elif ssl_mode == 'DISABLED':
                        pool_cnx_args['ssl_disabled'] = True
                        logger.info("SSL is explicitly disabled (ssl-mode=DISABLED).")
                else:
                    # Default behavior if ssl-mode is not specified: no SSL.
                    pool_cnx_args['ssl_disabled'] = True
                    logger.info("SSL mode not specified, connection will not be encrypted.")

                db_pool = pooling.MySQLConnectionPool(
                    pool_name="webdl_pool",
                    pool_size=5,
                    **pool_cnx_args
                )
                logger.info("Successfully initialized MySQL connection pool.")
            elif db_type == 'sqlite':
                # For SQLite, store the database path as the pool
                db_path = url.path.lstrip('/')
                if not db_path:
                    # Handle in-memory SQLite
                    db_path = ":memory:"
                db_pool = db_path
                logger.info(f"Using SQLite database: {db_path}")
            else:
                raise ValueError(f"Unsupported database type: {db_type}. Only 'mysql' and 'sqlite' are supported.")
                
        except mysql.connector.Error as err:
            logger.error(f"Error initializing MySQL connection pool: {err}")
            raise
        except ValueError as e:
            logger.error(f"Invalid DATABASE_URL: {e}")
            raise

@contextmanager
def get_db_connection():
    if db_pool is None:
        raise Exception("Database pool not initialized. Call init_db_pool() first.")
    conn = None
    try:
        if db_type == 'mysql':
            conn = db_pool.get_connection()
        elif db_type == 'sqlite':
            conn = sqlite3.connect(db_pool)
            conn.row_factory = sqlite3.Row  # Enable dictionary-like access
        yield conn
    except (mysql.connector.Error, sqlite3.Error) as err:
        logger.error(f"Error getting database connection: {err}")
        raise
    finally:
        if conn:
            conn.close()

def init_db():
    init_db_pool() # Ensure pool is initialized
    with get_db_connection() as conn:
        cursor = conn.cursor()
        try:
            if db_type == 'mysql':
                # MySQL table creation
                # Create users table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        username VARCHAR(255) NOT NULL UNIQUE,
                        hashed_password VARCHAR(255) NOT NULL,
                        is_admin BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """)
                logger.info("Table 'users' checked/created.")

                # Create config table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS config (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        key_name VARCHAR(255) NOT NULL UNIQUE,
                        key_value TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    );
                """)
                logger.info("Table 'config' checked/created.")

                # Create logs table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS logs (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                        level VARCHAR(50),
                        logger_name VARCHAR(255),
                        message TEXT,
                        pathname VARCHAR(255),
                        lineno INT
                    );
                """)
                logger.info("Table 'logs' checked/created.")
                
            elif db_type == 'sqlite':
                # SQLite table creation
                # Create users table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT NOT NULL UNIQUE,
                        hashed_password TEXT NOT NULL,
                        is_admin BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """)
                logger.info("Table 'users' checked/created.")

                # Create config table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS config (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        key_name TEXT NOT NULL UNIQUE,
                        key_value TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """)
                logger.info("Table 'config' checked/created.")

                # Create logs table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                        level TEXT,
                        logger_name TEXT,
                        message TEXT,
                        pathname TEXT,
                        lineno INTEGER
                    );
                """)
                logger.info("Table 'logs' checked/created.")

            conn.commit()
        except (mysql.connector.Error, sqlite3.Error) as err:
            if hasattr(err, 'errno') and err.errno == errorcode.ER_TABLE_EXISTS_ERROR:
                msg = getattr(err, 'msg', str(err))
                logger.warning(f"Table already exists: {msg}")
            else:
                logger.error(f"Error creating tables: {err}")
                raise
        finally:
            cursor.close()

class MySQLConfigManager:
    """Manages application configuration stored in database."""
    def get_config(self, key: str, default=None):
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                if db_type == 'mysql':
                    cursor.execute("SELECT key_value FROM config WHERE key_name = %s", (key,))
                    result = cursor.fetchone()
                elif db_type == 'sqlite':
                    cursor.execute("SELECT key_value FROM config WHERE key_name = ?", (key,))
                    result = cursor.fetchone()
                cursor.close()
                if result:
                    return result[0]
                return default
        except Exception as e:
            logger.error(f"Error getting config for key '{key}': {e}")
            return default

    def set_config(self, key: str, value: str):
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                if db_type == 'mysql':
                    cursor.execute(
                        "INSERT INTO config (key_name, key_value) VALUES (%s, %s) "
                        "ON DUPLICATE KEY UPDATE key_value = %s",
                        (key, value, value)
                    )
                elif db_type == 'sqlite':
                    cursor.execute(
                        "INSERT OR REPLACE INTO config (key_name, key_value) VALUES (?, ?)",
                        (key, value)
                    )
                conn.commit()
                cursor.close()
                logger.info(f"Config '{key}' set to '{value}'.")
        except Exception as e:
            logger.error(f"Error setting config for key '{key}': {e}")

mysql_config = MySQLConfigManager()

class MySQLUser:
    def __init__(self, id: int, username: str, hashed_password: str, is_admin: bool, **kwargs):
        self.id = id
        self.username = username
        self.hashed_password = hashed_password
        self.is_admin = is_admin

    @staticmethod
    def get_user_by_username(username: str):
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                if db_type == 'mysql':
                    cursor = conn.cursor(dictionary=True)
                    cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
                    user_data = cursor.fetchone()
                elif db_type == 'sqlite':
                    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
                    user_data = cursor.fetchone()
                    if user_data:
                        user_data = dict(user_data)
                cursor.close()
                if user_data:
                    return MySQLUser(**user_data)
                return None
        except Exception as e:
            logger.error(f"Error getting user by username '{username}': {e}")
            return None

    @staticmethod
    def create_user(username: str, hashed_password: str, is_admin: bool = False):
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                if db_type == 'mysql':
                    cursor.execute(
                        "INSERT INTO users (username, hashed_password, is_admin) VALUES (%s, %s, %s)",
                        (username, hashed_password, is_admin)
                    )
                elif db_type == 'sqlite':
                    cursor.execute(
                        "INSERT INTO users (username, hashed_password, is_admin) VALUES (?, ?, ?)",
                        (username, hashed_password, is_admin)
                    )
                conn.commit()
                cursor.close()
                logger.info(f"User '{username}' created successfully.")
                return True
        except (mysql.connector.IntegrityError, sqlite3.IntegrityError):
            logger.warning(f"Attempted to create duplicate user: '{username}'.")
            return False
        except Exception as e:
            logger.error(f"Error creating user '{username}': {e}")
            return False

    @staticmethod
    def get_first_admin_user():
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                if db_type == 'mysql':
                    cursor = conn.cursor(dictionary=True)
                    cursor.execute("SELECT * FROM users WHERE is_admin = TRUE LIMIT 1")
                    user_data = cursor.fetchone()
                elif db_type == 'sqlite':
                    cursor.execute("SELECT * FROM users WHERE is_admin = 1 LIMIT 1")
                    user_data = cursor.fetchone()
                    if user_data:
                        user_data = dict(user_data)
                cursor.close()
                if user_data:
                    return MySQLUser(**user_data)
                return None
        except Exception as e:
            logger.error(f"Error getting first admin user: {e}")
            return None

    @staticmethod
    def count_users():
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM users")
                count = cursor.fetchone()[0]
                cursor.close()
                return count
        except Exception as e:
            logger.error(f"Error counting users: {e}")
            return 0

    @staticmethod
    def update_password(username: str, new_hashed_password: str):
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                if db_type == 'mysql':
                    cursor.execute(
                        "UPDATE users SET hashed_password = %s WHERE username = %s",
                        (new_hashed_password, username)
                    )
                elif db_type == 'sqlite':
                    cursor.execute(
                        "UPDATE users SET hashed_password = ? WHERE username = ?",
                        (new_hashed_password, username)
                    )
                conn.commit()
                cursor.close()
                logger.info(f"Password updated for user '{username}'.")
                return True
        except Exception as e:
            logger.error(f"Error updating password for user '{username}': {e}")
            return False
