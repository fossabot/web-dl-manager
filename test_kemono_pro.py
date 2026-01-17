import asyncio
import os
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.tasks import process_kemono_pro_job
from app.database import init_db

async def test_pro():
    init_db()
    task_id = "test-pro-auth-task"
    service = "patreon"
    creator_id = "28444363"
    upload_service = "gofile" 
    upload_path = ""
    
    # Provided credentials
    kemono_user = "eyjafjalla-0214"
    kemono_pass = "qw24561415"
    
    params = {
        "upload_service": "gofile",
        "gofile_token": "", 
    }
    
    print(f"[*] Starting local AUTH test for Kemono Pro...")
    print(f"[*] User: {kemono_user}")
    print(f"[*] Target: {service}/{creator_id}")
    
    try:
        await process_kemono_pro_job(
            task_id=task_id,
            service=service,
            creator_id=creator_id,
            upload_service=upload_service,
            upload_path=upload_path,
            params=params,
            kemono_username=kemono_user,
            kemono_password=kemono_pass
        )
        print("[*] Job finished execution.")
    except Exception as e:
        print(f"[!] Test failed with error: {e}")

if __name__ == "__main__":
    asyncio.run(test_pro())