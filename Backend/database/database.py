import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

# 1. Yeh PostgreSQL ka address hai (Isse Database ka Rasta milta hai)
# (abhi ek default string dali hai, isse hum baad mein apne credentials se update karenge)
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://yashpal@localhost/virtual_professor")

# 2. ENGINE (Database ki Engine/Motor)
# Yeh actual motor hai jo us raste (URL) par gaadi chalayegi.
# Iska ek hi kaam hai: PostgreSQL se raw connection establish karna (TCP connection).
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# 3. SESSIONLOCAL (Driver)
# Engine hamesha on rehti hai, par har API call ke liye ek naya driver chahiye jo query kare.
# SessionLocal ek factory (machine) hai jo humein har baar ek naya 'Session' (Connection) banakar degi.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
