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
        
        # Prepare kwargs
        kwargs = {"decode_responses": True}
        
        # Fix for redis-py not converting ssl_cert_reqs from string to constant in URL
        # We must remove it from the URL string because URL params seem to take precedence over kwargs in redis-py
        if "ssl_cert_reqs=none" in redis_url.lower():
            import ssl
            from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
            
            try:
                u = urlparse(redis_url)
                qs = parse_qs(u.query, keep_blank_values=True)
                
                # Check if ssl_cert_reqs is 'none'
                if 'ssl_cert_reqs' in qs and any(v.lower() == 'none' for v in qs['ssl_cert_reqs']):
                    # Remove it from query
                    qs.pop('ssl_cert_reqs')
                    
                    # Set in kwargs
                    kwargs["ssl_cert_reqs"] = ssl.CERT_NONE
                    
                    # Rebuild URL
                    new_query = urlencode(qs, doseq=True)
                    redis_url = urlunparse((u.scheme, u.netloc, u.path, u.params, new_query, u.fragment))
                    logger.debug("Applied fix for ssl_cert_reqs=none in Redis URL")
            except Exception as e:
                logger.warning(f"Failed to parse Redis URL for ssl_cert_reqs fix: {e}")

        # Create a Redis client. 
        # redis-py automatically handles rediss:// (SSL) schemes.
        redis_client = redis.from_url(redis_url, **kwargs)
        
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
