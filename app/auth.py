import os
import secrets
import hashlib
import time
import httpx
from typing import Optional
from fastapi import Request, HTTPException

from .database import User

# Clerk Configuration
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")
CLERK_JWT_PUBLIC_KEY = os.getenv("CLERK_JWT_PUBLIC_KEY") # Optional: pre-fetched public key
CLERK_API_BASE = "https://api.clerk.com/v1"

# Session timeout in seconds (e.g., 30 minutes)
SESSION_TIMEOUT = 1800

# --- Clerk Integration Helpers ---
async def verify_clerk_session(request: Request) -> Optional[dict]:
    """
    Verifies the Clerk session from the request.
    Clerk tokens are usually in the Authorization header or cookies.
    """
    if not CLERK_SECRET_KEY:
        return None

    # Try to get token from Authorization header or cookie
    auth_header = request.headers.get("Authorization")
    token = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    else:
        # Clerk stores session token in __session cookie
        token = request.cookies.get("__session")

    if not token:
        return None

    try:
        # In a real-world scenario, you'd fetch the JWKS from Clerk
        # and verify the JWT. For simplicity and to avoid network calls on every request,
        # we can also use Clerk's backend API to verify the session if needed,
        # but JWT verification is preferred.
        # Here we'll implement a basic verification or rely on Clerk API.
        
        # If you have the public key/pem, you can use:
        # payload = jwt.decode(token, CLERK_JWT_PUBLIC_KEY, algorithms=["RS256"])
        
        # Alternative: Call Clerk API to get user info (acts as verification)
        async with httpx.AsyncClient() as client:
            # Clerk API to get user details for a given session/token
            # Note: This is a bit slow for every request. JWT verification is better.
            # But Clerk's JWTs are short-lived.
            response = await client.get(f"{CLERK_API_BASE}/me", headers={"Authorization": f"Bearer {token}"})
            if response.status_code == 200:
                return response.json()
    except Exception:
        # Log error in a real app
        pass
    
    return None

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
    FastAPI dependency to get the current authenticated user.
    Supports both legacy session-based auth and Clerk authentication.
    """
    # 1. Try Clerk Authentication first
    clerk_user_data = await verify_clerk_session(request)
    if clerk_user_data:
        # Extract username/email from Clerk data
        # Clerk users might have multiple email addresses
        username = clerk_user_data.get("username")
        if not username:
            emails = clerk_user_data.get("email_addresses", [])
            if emails:
                username = emails[0].get("email_address")
        
        if username:
            # Sync Clerk user to local database
            user = User.get_user_by_username(username)
            if not user:
                # Create local user for Clerk user
                # We use a random password since authentication is handled by Clerk
                User.create_user(username=username, hashed_password=get_password_hash(secrets.token_hex(32)), is_admin=True)
                user = User.get_user_by_username(username)
            
            if user:
                return user

    # 2. Check if DEBUG_MODE is enabled
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
                request.session["last_activity"] = time.time()
        
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
    
    # 3. Normal session-based authentication logic
    if not hasattr(request, 'session') or not request.session:
        raise HTTPException(status_code=403, detail="Not authenticated")
    
    username = request.session.get("user")
    last_activity = request.session.get("last_activity")
    
    if not username:
        raise HTTPException(status_code=403, detail="Not authenticated")

    # Check for session timeout
    current_time = time.time()
    if last_activity is None:
        request.session.clear()
        raise HTTPException(status_code=403, detail="Session expired or invalid")
    
    if current_time - last_activity > SESSION_TIMEOUT:
        request.session.clear()
        raise HTTPException(status_code=403, detail="Session expired")

    # Update last activity
    request.session["last_activity"] = current_time
    
    # Validate user exists in the database
    user = User.get_user_by_username(username)
    if not user:
        # If user does not exist, clear the invalid session
        request.session.clear()
        raise HTTPException(status_code=403, detail="Not authenticated, user not found")
    
    return user
