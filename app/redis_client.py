import redis
import logging
import os
from .database import db_config

logger = logging.getLogger(__name__)

redis_client = None

def init_redis():
    """Initializes the Redis client. Priorities: DB config > Environment variable."""
    global redis_client
    
    # Try DB config first, then env var
    redis_url = db_config.get_config("REDIS_URL")
    if not redis_url:
        redis_url = os.getenv("REDIS_URL")

    if not redis_url:
        if redis_client:
            logger.info("REDIS_URL cleared. Disabling Redis support.")
            try:
                redis_client.close()
            except:
                pass
            redis_client = None
        else:
            logger.debug("REDIS_URL not set. Redis support disabled.")
        return

    try:
        # If we already have a client, check if the URL changed. 
        # For simplicity, we just close and recreate.
        if redis_client:
            try:
                current_pool_opts = redis_client.connection_pool.connection_kwargs
                # Reconstructing URL to compare might be tricky, so we just reconnect.
                redis_client.close()
            except:
                pass

        logger.info(f"Connecting to Redis at {redis_url.split('@')[-1] if '@' in redis_url else '...'}")
        # Create a Redis client. 
        # redis-py automatically handles rediss:// (SSL) schemes.
        # decode_responses=True ensures we get strings instead of bytes.
        redis_client = redis.from_url(redis_url, decode_responses=True)
        
        # Test the connection
        redis_client.ping()
        logger.info("Successfully connected to Redis.")
    except redis.AuthenticationError:
        logger.error("Redis authentication failed. Check your password.")
        redis_client = None
    except redis.ConnectionError as e:
        logger.error(f"Failed to connect to Redis: {e}")
        redis_client = None
    except Exception as e:
        logger.error(f"Unexpected error initializing Redis: {e}")
        redis_client = None

def get_redis_client():
    """Returns the initialized Redis client instance or None."""
    return redis_client

# Initialize on module load
init_redis()
