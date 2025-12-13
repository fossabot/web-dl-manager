import os
import secrets
import hashlib
from fastapi import Request, HTTPException

from .database import User

# --- Password Hashing ---
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plain password against a stored hash.
    The format of the hash is "salt:hash".
    """
    if not hashed_password or ':' not in hashed_password:
        return False
    
    salt, stored_hash = hashed_password.split(':', 1)
    
    # Compute hash of the provided password with the same salt
    computed_hash = hashlib.sha256((salt + plain_password).encode('utf-8')).hexdigest()
    
    # Use constant-time comparison to prevent timing attacks
    return secrets.compare_digest(computed_hash, stored_hash)

def get_password_hash(password: str) -> str:
    """
    Hashes a password with a random salt.
    Returns the hash in the format "salt:hash".
    """
    # Generate a random salt
    salt = secrets.token_hex(16)
    
    # Compute hash: salt + password
    password_hash = hashlib.sha256((salt + password).encode('utf-8')).hexdigest()
    
    # Return format: salt:hash
    return f"{salt}:{password_hash}"


# --- User Dependency ---
async def get_current_user(request: Request) -> User:
    """
    FastAPI dependency to get the current authenticated user from the session.
    Raises HTTPException if the user is not authenticated or does not exist.
    """
    # Check if DEBUG_MODE is enabled
    debug_enabled = os.getenv("DEBUG_MODE", "false").lower() == "true"
    
    if debug_enabled:
        # In DEBUG mode, bypass authentication or use a default user
        # First, try to get user from session
        username = None
        if hasattr(request, 'session') and request.session:
            username = request.session.get("user")
        
        if not username:
            # No user in session, use default debug user
            username = "debug_user"
            # Set debug user in session if session exists
            if hasattr(request, 'session') and request.session:
                request.session["user"] = username
        
        # Get or create debug user in database
        user = User.get_user_by_username(username)
        if not user:
            # Create debug user if it doesn't exist
            # Use a simple password hash for debug mode
            debug_password_hash = get_password_hash("debug_password")
            User.create_user(username=username, hashed_password=debug_password_hash, is_admin=True)
            user = User.get_user_by_username(username)
        
        if user:
            return user
        # If still no user, fall through to normal authentication (which will fail)
    
    # Normal authentication logic
    if not hasattr(request, 'session') or not request.session:
        raise HTTPException(status_code=403, detail="Not authenticated")
    
    username = request.session.get("user")
    if not username:
        raise HTTPException(status_code=403, detail="Not authenticated")
    
    # Validate user exists in the database
    user = User.get_user_by_username(username)
    if not user:
        # If user does not exist, clear the invalid session
        request.session.clear()
        raise HTTPException(status_code=403, detail="Not authenticated, user not found")
    
    return user
