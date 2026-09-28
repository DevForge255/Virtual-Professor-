from sqlalchemy.orm import Session
from sqlalchemy import text, func
from .models import Subject, Chapter, AgentResponse

# ----------------- HELPER FUNCTIONS (CRUD) -----------------

def get_all_subjects_for_user(db: Session, user_id: str):
    """
    User ID ke hisaab se saare Subjects aur unke Chapters nikalne ka helper.
    """
    # SQLAlchemy aapke liye 'LEFT JOIN' automatically handle kar lega
    # kyunki humne models.py mein relationship banayi hui hai.
    return db.query(Subject).filter(Subject.user_id == user_id).all()

def create_subject(db: Session, user_id: str, name: str):
    """
    Naya Subject database mein add karne ka helper.
    """
    new_subject = Subject(user_id=user_id, name=name)
    db.add(new_subject)
    db.commit()
    db.refresh(new_subject) # id generate hone ke baad wapas object return karna
    return new_subject

def create_chapter(db: Session, subject_id: int, name: str):
    """
    Naya Chapter kisi specific Subject ke andar add karne ka helper.
    """
    new_chapter = Chapter(subject_id=subject_id, name=name)
    db.add(new_chapter)
    db.commit()
    db.refresh(new_chapter)
    return new_chapter

def get_agent_response_by_chapter(db: Session, chapter_id: int):
    """
    Chapter ID dekar us chapter ka poora Agent ka response (conversation, notes etc.) nikalne ka helper.
    """
    return db.query(AgentResponse).filter(AgentResponse.chapter_id == chapter_id).first()

def save_agent_response(db: Session, chapter_id: int, tutor_instruct: str, mistakes: list, confused_topics: list, core_weaknesses: list):
    """
    Agent ka generated naya analytics data database mein save karne ka helper.
    """
    new_response = AgentResponse(
        chapter_id=chapter_id,
        tutor_instruct=tutor_instruct,
        mistakes=mistakes,
        confused_topics=confused_topics,
        core_weaknesses=core_weaknesses
    )
    db.add(new_response)
    db.commit()
    db.refresh(new_response)
    return new_response

def update_chapter_indices(db: Session, chapter_id: int, indices_data: dict):
    """
    Saves or updates the extracted Chapter Indices (notes analysis) in the database.
    """
    response = db.query(AgentResponse).filter(AgentResponse.chapter_id == chapter_id).first()
    if not response:
        response = AgentResponse(chapter_id=chapter_id, chapter_indices=indices_data)
        db.add(response)
    else:
        response.chapter_indices = indices_data
    db.commit()
    db.refresh(response)
    return response

def update_pyq_analysis(db: Session, chapter_id: int, pyq_data: dict):
    """
    Saves or updates the extracted PYQ Analysis in the database.
    """
    response = db.query(AgentResponse).filter(AgentResponse.chapter_id == chapter_id).first()
    if not response:
        response = AgentResponse(chapter_id=chapter_id, pyq_analysis=pyq_data)
        db.add(response)
    else:
        response.pyq_analysis = pyq_data
    db.commit()
    db.refresh(response)
    return response

def get_chapters_by_subject_name(db: Session, user_id: str, subject_name: str):
    """
    User ID aur Subject Name se directly uske saare chapters nikalne ka helper.
    """
    # 1. Database se wo Subject dhundo jiska naam match kare (ignore case and spaces) aur wo isi User ka ho
    subject = db.query(Subject).filter(
        func.lower(func.trim(Subject.name)) == subject_name.strip().lower(),
        Subject.user_id == user_id
    ).first()
    
    # 2. Agar subject mil gaya, toh directly uski Magic List bhej do!
    if subject:
        return subject.chapters # Yeh ek Array (List) hoga jisme saare chapters honge
    
    return [] # Agar subject nahi mila toh khali array bhej do

from sqlalchemy import func

def get_chapter_id_by_name(db: Session, user_id: str, subject_name: str, chapter_name: str):
    """
    User ID, Subject Name aur Chapter Name dekar exact Chapter (aur uski ID) nikalne ka helper.
    """
    # 1. Pehle Subject dhundo (ignore case and spaces)
    subject = db.query(Subject).filter(
        func.lower(func.trim(Subject.name)) == subject_name.strip().lower(),
        Subject.user_id == user_id
    ).first()
    
    if not subject:
        return None
        
    # 2. Phir us Subject ke andar exact Chapter dhundo (ignore case and spaces)
    chapter = db.query(Chapter).filter(
        Chapter.subject_id == subject.id,
        func.lower(func.trim(Chapter.name)) == chapter_name.strip().lower()
    ).first()
    
    if chapter:
        return chapter.id
    return None

def get_all_subjects_for_user_formatted(db: Session, user_id: str):
    """
    User ke saare subjects aur unke chapters nikal kar, 
    unko Redis/JSON ke liye perfect dictionary format mein convert karta hai.
    (Subject ID aur Chapter ID ke sath)
    """
    subjects = db.query(Subject).filter(Subject.user_id == user_id).all()
    
    formatted_data = []
    for sub in subjects:
        sub_dict = {
            "subject_id": sub.id,
            "subject_name": sub.name,
            "chapters": [
                {"chapter_id": chap.id, "name": chap.name} 
                for chap in sub.chapters
            ]
        }
        formatted_data.append(sub_dict)
        
    return formatted_data

def get_dashboard_analytics(db: Session, user_id: str):
    """
    Returns dashboard analytics for all subjects of a user.
    """
    subjects = db.query(Subject).filter(Subject.user_id == user_id).all()
    dashboard_data = []
    
    for subject in subjects:
        total_chapters = len(subject.chapters)
        if total_chapters == 0:
            continue
            
        strong_chapters = 0
        moderate_chapters = 0
        weak_chapters = 0
        total_confused_topics = 0
        total_weaknesses = 0
        
        for chapter in subject.chapters:
            thread_id = f"{user_id}_{subject.name}_{chapter.name}"
            # Check if chapter has been started (using ILIKE to ignore case differences in subject name like Physics vs physics)
            checkpoint_exists = db.execute(text("SELECT 1 FROM checkpoints WHERE thread_id ILIKE :thread_id LIMIT 1"), {"thread_id": thread_id}).scalar()
            
            if not checkpoint_exists:
                continue # Skip unstarted chapters from health score calculation
                
            # Assuming one response per chapter for now
            agent_response = db.query(AgentResponse).filter(AgentResponse.chapter_id == chapter.id).first()
            if agent_response:
                mistakes = agent_response.mistakes or []
                confused_topics = agent_response.confused_topics or []
                weaknesses = agent_response.core_weaknesses or []
                
                issues_count = len(mistakes) + len(confused_topics)
                total_confused_topics += len(confused_topics)
                total_weaknesses += len(weaknesses)
                
                if issues_count <= 2:
                    strong_chapters += 1
                elif 3 <= issues_count <= 6:
                    moderate_chapters += 1
                else:
                    weak_chapters += 1
            else:
                # Data generated but no mistakes -> Strong
                strong_chapters += 1
                
        # Calculate health score based ONLY on started chapters
        started_chapters = strong_chapters + moderate_chapters + weak_chapters
        if started_chapters == 0:
            health_score = 0
        else:
            health_score = int((strong_chapters * 100 + moderate_chapters * 50) / started_chapters)
        
        dashboard_data.append({
            "id": subject.id,
            "name": subject.name,
            "health_score": health_score,
            "total_confused_topics": total_confused_topics,
            "total_weaknesses": total_weaknesses
        })
        
    return dashboard_data

def get_subject_chapter_analytics(db: Session, subject_id: int):
    """
    Returns chapter-level analytics for a specific subject.
    """
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        return None
        
    user_id = subject.user_id
    chapters_data = []
    
    for chapter in subject.chapters:
        thread_id = f"{user_id}_{subject.name}_{chapter.name}"
        # Using ILIKE for case-insensitive match
        checkpoint_exists = db.execute(text("SELECT 1 FROM checkpoints WHERE thread_id ILIKE :thread_id LIMIT 1"), {"thread_id": thread_id}).scalar()
        
        total_mistakes = 0
        weak_topics = []
        level = "Not Started"
        
        if not checkpoint_exists:
            level = "Not Started"
            weak_topics = ["N/A"]
        else:
            agent_response = db.query(AgentResponse).filter(AgentResponse.chapter_id == chapter.id).first()
            if agent_response:
                mistakes = agent_response.mistakes or []
                confused_topics = agent_response.confused_topics or []
                core_weaknesses = agent_response.core_weaknesses or []
                
                total_mistakes = len(mistakes)
                weak_topics = core_weaknesses if core_weaknesses else ["None"]
                
                issues_count = len(mistakes) + len(confused_topics)
                if issues_count <= 2:
                    level = "Strong"
                elif 3 <= issues_count <= 6:
                    level = "Moderate"
                else:
                    level = "Weak"
            else:
                level = "Strong"
                weak_topics = ["None"]
            
        chapters_data.append({
            "id": chapter.id,
            "name": chapter.name,
            "level": level,
            "total_mistakes": total_mistakes,
            "weak_topics": weak_topics
        })
        
    return {
        "subject_name": subject.name,
        "chapters": chapters_data
    }

def get_chapter_revision_data(db: Session, chapter_id: int):
    """
    Chapter ID dekar uska revision data (mistakes, confusions, weaknesses) nikalne ka helper.
    """
    chapter = db.query(Chapter).filter(Chapter.id == chapter_id).first()
    if not chapter:
        return None
    
    agent_response = db.query(AgentResponse).filter(AgentResponse.chapter_id == chapter_id).first()
    
    mistakes = []
    confused_topics = []
    core_weaknesses = []
    
    if agent_response:
        mistakes = agent_response.mistakes or []
        confused_topics = agent_response.confused_topics or []
        core_weaknesses = agent_response.core_weaknesses or []
    
    return {
        "chapter_id": chapter.id,
        "chapter_name": chapter.name,
        "mistakes": mistakes,
        "confused_topics": confused_topics,
        "core_weaknesses": core_weaknesses,
        "summary": {
            "total_mistakes": len(mistakes),
            "total_confusions": len(confused_topics),
            "total_weaknesses": len(core_weaknesses),
            "needs_revision_count": sum(1 for w in core_weaknesses if isinstance(w, dict) and w.get("needs_revision", False))
        }
    }
