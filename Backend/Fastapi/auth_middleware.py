import os
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv

load_dotenv()

# JWT signature verify karne ke liye hume JWT Secret chahiye.
# Supabase mein JWT secret by default project dashboard -> API -> JWT Secret mein milta hai.
# Lekin hum "supabase" client ko bhi use kar sakte hain agar chahein. 
# Sabse best aur fast tareeka JWT verify karne ka PyJWT library use karna hai.

SUPABASE_URL = os.getenv("SUPABASE_URL")
# IMPORTANT: Supabase Dashboard -> Settings -> API -> JWT Secret se apna secret yahan daalna padega ya env mein.
# Abhi ke liye hum Authorization header extract karenge.
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET") 

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Yeh function Frontend se aane wale Token ko verify karega.
    """
    token = credentials.credentials
    
    if not SUPABASE_JWT_SECRET:
        # Development mode bypass (agar secret nahi dala hai toh sirf decode karo bina verify kiye)
        # Warning: Production me aisa KABHI nahi karna chahiye!
        try:
            payload = jwt.decode(token, options={"verify_signature": False})
            user_id = payload.get("sub")
            if not user_id:
                raise HTTPException(status_code=401, detail="Invalid token payload")
            return user_id
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

    # Agar Secret available hai toh strict verification hogi
    try:
        payload = jwt.decode(
            token, 
            SUPABASE_JWT_SECRET, 
            algorithms=["HS256"],
            audience="authenticated"
        )
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        return user_id
    
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid authentication token")
