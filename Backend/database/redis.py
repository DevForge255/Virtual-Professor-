import json
import redis
from typing import Optional

# Redis se connect karna (localhost par port 6379 by default hota hai)
# decode_responses=True ka matlab hai ki data String format mein aayega, bytes mein nahi.
redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

def get_cached_subjects(user_id: str) -> Optional[list]:
    """
    Redis mein check karega ki is user_id ke subjects pehle se maujood hain ya nahi.
    """
    # Key dekhiye: "user_subjects:{user_id}". Har user ki key alag hogi!
    cache_key = f"user_subjects:{user_id}"
    
    cached_data = redis_client.get(cache_key)
    
    if cached_data:
        # JSON string ko wapas Python list/dictionary mein convert karna
        return json.loads(cached_data)
    
    return None # Agar cache khali hai (Cache Miss)

def set_cached_subjects(user_id: str, subjects_data: list):
    """
    Postgres se data aane ke baad, usko Redis mein save karega (1 hour expiry ke sath).
    """
    cache_key = f"user_subjects:{user_id}"
    
    # Data ko JSON text mein convert karna padega kyunki Redis sirf text/string samajhta hai
    data_string = json.dumps(subjects_data)
    
    # Data save karo, aur ex=3600 (3600 seconds = 1 hour) ke baad apne aap delete ho jayega
    redis_client.set(name=cache_key, value=data_string, ex=6200)

def clear_user_cache(user_id: str):
    """
    Jab user naya subject add karega, toh purana cache uda (delete) dena hai.
    """
    cache_key = f"user_subjects:{user_id}"
    redis_client.delete(cache_key)
