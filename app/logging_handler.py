import logging
import datetime
from .database import engine, db_type
from sqlalchemy import text
import sys
import json
import time

class RedisLogHandler(logging.Handler):
    def __init__(self, key="webdl:logs"):
        super().__init__()
        self.key = key
        from .redis_client import get_redis_client
        self.redis = get_redis_client()

    def emit(self, record):
        if not self.redis:
            # Try to get client again in case it was initialized later
            from .redis_client import get_redis_client
            self.redis = get_redis_client()
            if not self.redis:
                return

        try:
            log_entry = {
                "timestamp": datetime.datetime.fromtimestamp(record.created).isoformat(),
                "level": record.levelname,
                "logger": record.name,
                "message": self.format(record),
                "pathname": record.pathname,
                "lineno": record.lineno
            }
            # Use RPUSH to append to the list
            self.redis.rpush(self.key, json.dumps(log_entry))
        except Exception:
            # Fallback or ignore to prevent loop
            pass

class MySQLLogHandler(logging.Handler):
    def emit(self, record):
        # Safeguard against infinite recursion if DB logging fails
        try:
            with engine.connect() as conn:
                # SQLAlchemy text() allows named parameters.
                # Note: We rely on SQLAlchemy to handle parameter binding safely.
                
                stmt = text("""
                    INSERT INTO logs (level, logger_name, message, pathname, lineno)
                    VALUES (:level, :logger_name, :message, :pathname, :lineno)
                """)
                
                conn.execute(stmt, {
                    "level": record.levelname,
                    "logger_name": record.name,
                    "message": self.format(record),
                    "pathname": record.pathname,
                    "lineno": record.lineno
                })
                conn.commit()
        except Exception as e:
            # If we can't log to DB, print to stderr to ensure visibility
            db_type_str = "MySQL" if db_type == 'mysql' else "SQLite" if db_type == 'sqlite' else "Unknown"
            sys.stderr.write(f"Failed to log to {db_type_str}: {e}\n")
            sys.stderr.write(f"Original log record: {self.format(record)}\n")

# Maximum log table size in MB
MAX_LOG_TABLE_SIZE_MB = 500
MAX_LOG_TABLE_SIZE_BYTES = MAX_LOG_TABLE_SIZE_MB * 1024 * 1024

def cleanup_old_logs():
    """Deletes the oldest 20% of logs from the database."""
    try:
        with engine.connect() as conn:
            
            result = conn.execute(text("SELECT COUNT(*) FROM logs"))
            # fetchone() is universal.
            total_rows = result.fetchone()[0]
            
            if total_rows == 0:
                logging.info("No logs to clean up.")
                return

            rows_to_delete = int(total_rows * 0.2)
            
            if rows_to_delete > 0:
                if db_type == 'mysql':
                    conn.execute(
                        text("DELETE FROM logs ORDER BY timestamp ASC LIMIT :limit"),
                        {"limit": rows_to_delete}
                    )
                elif db_type == 'sqlite':
                    conn.execute(
                        text("DELETE FROM logs WHERE id IN (SELECT id FROM logs ORDER BY timestamp ASC LIMIT :limit)"),
                        {"limit": rows_to_delete}
                    )
                
                conn.commit()
                logging.info(f"Successfully cleaned up {rows_to_delete} oldest log entries.")
            else:
                logging.info("Not enough log entries to perform a cleanup.")
                
    except Exception as e:
        sys.stderr.write(f"Error during log cleanup: {e}\n")
        logging.error(f"Error during log cleanup: {e}")

def update_log_handlers():
    """Updates the root logger to include/exclude RedisLogHandler based on configuration."""
    root_logger = logging.getLogger()
    
    # Remove existing RedisLogHandler if any
    for h in root_logger.handlers[:]:
        if isinstance(h, RedisLogHandler):
            root_logger.removeHandler(h)
            
    # Check if Redis is available
    from .redis_client import get_redis_client
    if get_redis_client():
        redis_handler = RedisLogHandler()
        # Set level based on env or default
        redis_handler.setLevel(root_logger.level)
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        redis_handler.setFormatter(formatter)
        root_logger.addHandler(redis_handler)
        logging.info("Redis logging enabled.")