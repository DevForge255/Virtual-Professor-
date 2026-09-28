from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json
from typing import List
from sqlalchemy.orm import Session
import sys
import os
import io
from unstructured.partition.pdf import partition_pdf

# Humare helper functions se import
from database.crud import create_subject, create_chapter, get_all_subjects_for_user_formatted, get_dashboard_analytics, get_subject_chapter_analytics, get_chapter_revision_data
from database.redis import get_cached_subjects, set_cached_subjects, clear_user_cache

# Database connection file se SessionLocal import karna
from database.database import SessionLocal

from fastapi.middleware.cors import CORSMiddleware
from database.models import Base, Subject
from database.database import engine

from Fastapi.auth_middleware import get_current_user

import sys
import os

# Ensure Backend folder is in sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Import Agent graph
from Agent.chat_bot_summarizer import build_graph
from langchain_core.messages import HumanMessage

# ----------------- CREATE TABLES -----------------
# FastAPI start hote hi database mein tables banayega!
Base.metadata.create_all(bind=engine)

app = FastAPI()

# Frontend (React) ko Backend se baat karne ki permission dene ke liye CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # React ka address
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- PYDANTIC MODEL -----------------
# Frontend se aane wale data ka format (Validation ke liye)
class SubjectCreateRequest(BaseModel):
    user_id: str
    subject_name: str
    chapters: List[str]

def get_db():
    # 1. Database ka darwaza kholo (SessionLocal ek helper hai jo hum database.py mein banayenge)
    db = SessionLocal() 
    try:
        # 2. Ye khula hua darwaza API ko de do (Yield ka matlab temporarily de dena)
        yield db
    finally:
        # 3. API ka kaam chahe Pura ho ya Error aaye, aakhiri mein darwaza Band (Close) zaroor karo!
        db.close()


# ----------------- API ENDPOINT -----------------
@app.post("/api/subjects/add")
def add_new_subject(request: SubjectCreateRequest, db: Session = Depends(get_db), current_user_id: str = Depends(get_current_user)):
    """
    Yeh API Endpoint Frontend se data lega aur database helpers ko call karega.
    """
    try:
        # Override user_id from token
        request.user_id = current_user_id
        # Step 1: Pata lagao ki kya subject pehle se DB mein hai
        subject = db.query(Subject).filter(
            Subject.user_id == request.user_id, 
            Subject.name == request.subject_name
        ).first()
        
        if not subject:
            # Agar subject nahi mila, toh naya create karo
            subject = create_subject(db=db, user_id=request.user_id, name=request.subject_name)
            
        # Ab check karo ki is subject mein kaun kaun se chapters pehle se hain
        existing_chapter_names = [chap.name for chap in subject.chapters]
        
        # Step 2: Chapters ki list par Loop chalana
        added_any = False
        for chapter_name in request.chapters:
            chapter_name = chapter_name.strip()
            
            # Khali chapter names ko ignore karne ke liye check
            if chapter_name != "":
                
                # Agar chapter pehle se nahi hai toh add karo
                if chapter_name not in existing_chapter_names:
                    create_chapter(db=db, subject_id=subject.id, name=chapter_name)
                    added_any = True
                
        # Step 3: Cache Invalidation (Data change hua, toh purana Redis cache uda do)
        clear_user_cache(request.user_id)
        
        return {
            "status": "success", 
            "message": "Subject and non-duplicate chapters processed successfully!",
            "subject_id": subject.id
        }
    
    except Exception as e:
        # Agar loop ke dauran koi error aata hai, toh frontend ko 500 error dikhao
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/subjects")
def get_user_subjects(user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Cache-Aside Pattern Logic:
    1. Check Redis Cache
    2. If found, return
    3. If not found, fetch from Postgres
    4. Save in Redis and return
    """
    try:
        # 1. Redis mein check karo
        cached_data = get_cached_subjects(user_id)
        if cached_data:
            print("CACHE HIT: Data Redis se laya gaya hai! 🚀")
            return {"status": "success", "source": "redis", "data": cached_data}
        
        # 2. Agar Redis mein nahi mila (Cache Miss), toh Postgres se lao
        print("CACHE MISS: Data Postgres DB se laya gaya hai! 🐢")
        db_data = get_all_subjects_for_user_formatted(db, user_id)
        
        # 3. Jo data mila, usko agali baar ke liye Redis mein save kar do
        set_cached_subjects(user_id, db_data)
        
        # 4. Data return kar do
        return {"status": "success", "source": "postgres", "data": db_data}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

import fitz
import base64

async def extract_images_from_memory(file: UploadFile) -> list:
    """
    FastAPI ke inbuilt memory-safe 'file.file' ka use karke 
    PyMuPDF (fitz) ke through har page ki image nikalna.
    """
    # SpooledTemporaryFile ki current position ko 0 par reset karein
    file.file.seek(0)
    pdf_bytes = file.file.read()
    
    # PyMuPDF se memory me document open karna
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    
    base64_images = []
    # Har page ko image (jpeg) mein convert karna
    for page in doc:
        # DPI ko balance rakha hai (150) taaki quality acchi rahe par size zyada bada na ho
        pix = page.get_pixmap(dpi=150)
        img_bytes = pix.tobytes("jpeg")
        base64_str = base64.b64encode(img_bytes).decode('utf-8')
        base64_images.append(base64_str)
        
    return base64_images


@app.post("/api/upload-pdf")
async def upload_pdf(
    file: UploadFile = File(...),
    subject_name: str = Form(...),
    chapter_name: str = Form(...),
    user_id: str = Depends(get_current_user)
):
    """
    Frontend se aayi hui PDF file ko receive karega, 
    in-memory extract karega, aur turant LLM Agent ko invoke karega,
    sath hi sath response stream (SSE) karega.
    """
    async def event_generator():
        try:
            # 1. Status: Extracting text
            yield f"data: {json.dumps({'type': 'status', 'message': 'Generating Notes...'})}\n\n"
            
            # In-memory extraction function call karna (Images)
            base64_images = await extract_images_from_memory(file)
            
            if not base64_images:
                yield f"data: {json.dumps({'type': 'error', 'message': 'PDF se images nahi nikal paayi.'})}\n\n"
                return
                
            # 2. Status: Text extracted, now invoking agent
            yield f"data: {json.dumps({'type': 'status', 'message': 'Extracting Notes using Vision...'})}\n\n"
            
            # Agent ko initial state bhejte hain
            initial_state = {
                "messages": [], # Pehli baar khali hai
                "notes": {"subject": "Pending", "chapters": {}}, # Fake notes object taaki NoteTaker chal jaye
                "pdf_images": base64_images,
                "user_id": user_id,
                "subject_name": subject_name,
                "chapter_name": chapter_name,
                "teaching_instructions": "",
                "current_chapter": chapter_name
            }
            
            # Graph compile karo
            app_graph = build_graph()
            config = {"configurable": {"thread_id": f"{user_id}_{subject_name}_{chapter_name}"}}
            
            # 3. Stream events from LangGraph
            async for event in app_graph.astream_events(initial_state, config=config, version="v2"):
                kind = event["event"]
                
                # Agar event chat model ka stream event hai
                if kind == "on_chat_model_stream":
                    # Check if the node is tutor_node
                    node = event["metadata"].get("langgraph_node", "")
                    if node == "tutor_node":
                        chunk_text = event["data"]["chunk"].content
                        if chunk_text:
                            yield f"data: {json.dumps({'type': 'chunk', 'text': chunk_text})}\n\n"
                            
            # 4. Final done message
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"Error in upload_pdf stream: {repr(e)}")
            yield f"data: {json.dumps({'type': 'error', 'message': repr(e)})}\n\n"

    # Return as Server-Sent Events stream
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/api/upload-pyq")
async def upload_pyq(
    files: List[UploadFile] = File(...),
    subject_name: str = Form(...),
    chapter_name: str = Form(...),
    user_id: str = Depends(get_current_user)
):
    """
    Endpoint to upload up to 3 PYQ papers.
    """
    async def event_generator():
        try:
            yield f"data: {json.dumps({'type': 'status', 'message': 'Processing PYQ files...'})}\n\n"
            
            all_base64_images = []
            for file in files:
                base64_images = await extract_images_from_memory(file)
                if base64_images:
                    all_base64_images.extend(base64_images)
                    
            if not all_base64_images:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Could not extract images from PYQs.'})}\n\n"
                return
                
            yield f"data: {json.dumps({'type': 'status', 'message': 'Analyzing Exam Patterns...'})}\n\n"
            
            initial_state = {
                "pyq_images": all_base64_images,
                "current_action": "upload_pyq",
                "user_id": user_id,
                "subject_name": subject_name,
                "chapter_name": chapter_name
            }
            
            app_graph = build_graph()
            config = {"configurable": {"thread_id": f"{user_id}_{subject_name}_{chapter_name}"}}
            
            async for event in app_graph.astream_events(initial_state, config=config, version="v2"):
                pass # We can stream chunks if the analyzer outputs stream, but structured output doesn't stream well.
                
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            yield f"data: {json.dumps({'type': 'error', 'message': repr(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/api/upload-question-bank")
async def upload_question_bank(
    file: UploadFile = File(...),
    subject_name: str = Form(...),
    chapter_name: str = Form(...),
    user_id: str = Depends(get_current_user)
):
    """
    Phase 1: Endpoint to upload a Question Bank PDF for the Mock Test Agent.
    """
    async def event_generator():
        try:
            yield f"data: {json.dumps({'type': 'status', 'message': 'Processing Question Bank...'})}\n\n"
            
            base64_images = await extract_images_from_memory(file)
            
            if not base64_images:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Could not extract images from Question Bank.'})}\n\n"
                return
                
            yield f"data: {json.dumps({'type': 'status', 'message': 'Preparing Mock Test Agent (Phase 1 Complete)'})}\n\n"
            
            # Phase 2: Invoke MockTestAgent for extraction
            from Agent.mock_test_agent import build_mock_test_graph
            
            initial_state = {
                "pdf_images": base64_images,
                "current_action": "extract_questions",
                "user_id": user_id,
                "subject_name": subject_name,
                "chapter_name": chapter_name,
                "extracted_questions": [],
                "messages": []
            }
            
            mock_test_graph = build_mock_test_graph()
            config = {"configurable": {"thread_id": f"mocktest_{user_id}_{subject_name}_{chapter_name}"}}
            
            async for event in mock_test_graph.astream_events(initial_state, config=config, version="v2"):
                # Extraction doesn't stream chat tokens, it just processes.
                # We could stream progress here if needed.
                pass
                
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            yield f"data: {json.dumps({'type': 'error', 'message': repr(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

class MockTestStateRequest(BaseModel):
    subject_name: str
    chapter_name: str

@app.post("/api/get-mock-test-question")
async def get_mock_test_question(
    request: MockTestStateRequest,
    user_id: str = Depends(get_current_user)
):
    """
    Phase 3: Gets the current question directly from the MockTestAgent's state 
    without invoking the LLM.
    """
    try:
        from Agent.mock_test_agent import build_mock_test_graph
        app_graph = build_mock_test_graph()
        config = {"configurable": {"thread_id": f"mocktest_{user_id}_{request.subject_name}_{request.chapter_name}"}}
        
        state = await app_graph.aget_state(config)
        
        if not state or not hasattr(state, 'values') or not state.values:
            return {"status": "error", "message": "No mock test state found. Did you upload a question bank?"}
            
        extracted_questions = state.values.get("extracted_questions", [])
        current_index = state.values.get("current_question_index", 0)
        
        if not extracted_questions:
            return {"status": "error", "message": "No questions were extracted. Try uploading again."}
            
        if current_index >= len(extracted_questions):
            return {"status": "completed", "message": "Mock Test Finished!"}
            
        # Return the current question
        current_q = extracted_questions[current_index]
        return {
            "status": "success",
            "current_index": current_index,
            "total_questions": len(extracted_questions),
            "question": current_q
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

class MockTestAnswerRequest(BaseModel):
    subject_name: str
    chapter_name: str
    answer: str

@app.post("/api/submit-mock-test-answer")
async def submit_mock_test_answer(
    request: MockTestAnswerRequest,
    user_id: str = Depends(get_current_user)
):
    """
    Phase 4: Submit a mock test answer.
    Appends the answer to messages, sets action to evaluate_answer,
    and runs the graph. Returns the AI's feedback.
    """
    from Agent.mock_test_agent import build_mock_test_graph
    from langchain_core.messages import HumanMessage
    
    app_graph = build_mock_test_graph()
    config = {"configurable": {"thread_id": f"mocktest_{user_id}_{request.subject_name}_{request.chapter_name}"}}
    
    # 1. Update state with the new answer
    initial_state = {
        "messages": [HumanMessage(content=request.answer)],
        "current_action": "evaluate_answer",
        "user_id": user_id,
        "subject_name": request.subject_name,
        "chapter_name": request.chapter_name
    }
    
    async def event_generator():
        try:
            yield f"data: {json.dumps({'type': 'status', 'message': 'Evaluating answer...'})}\n\n"
            
            # 2. Run the graph
            final_feedback = ""
            async for event in app_graph.astream_events(initial_state, config=config, version="v2"):
                # We can stream tokens if the LLM was streaming, but for structured output we just wait for node end.
                if event["event"] == "on_chain_end" and event["name"] in ["mock_test_evaluator_node", "mock_test_weakness_node"]:
                    output = event["data"].get("output", {})
                    if "messages" in output and output["messages"]:
                        final_feedback = output["messages"][-1].content
                        yield f"data: {json.dumps({'type': 'feedback', 'message': final_feedback})}\n\n"
                        
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as e:
            import traceback
            traceback.print_exc()
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")

# --- Naya Chat History Endpoint ---
@app.get("/api/chat/history")
async def get_chat_history(subject_name: str, chapter_name: str, user_id: str = Depends(get_current_user)):
    """
    LangGraph checkpointer se pichli chat history laane ke liye endpoint.
    """
    try:
        app_graph = build_graph()
        config = {"configurable": {"thread_id": f"{user_id}_{subject_name}_{chapter_name}"}}
        
        # Async checkpointer use kar rahe hain isliye aget_state() use karna padega
        state = await app_graph.aget_state(config)
        
        if not state or not hasattr(state, 'values') or not state.values or "messages" not in state.values:
            return {"messages": []}
            
        history = []
        for msg in state.values["messages"]:
            # Agar message system message hai (jaise lecture intro), usko skip kar sakte hain ya include kar sakte hain.
            # Yahan hume sirf HumanMessage aur AIMessage chahiye jo UI pe dikhana hai.
            if msg.type == "system":
                continue
                
            role = "user" if msg.type == "human" else "ai"
            text = ""
            if isinstance(msg.content, str):
                text = msg.content
            elif isinstance(msg.content, list):
                text = " ".join([c.get("text", "") for c in msg.content if isinstance(c, dict) and "text" in c])
                
            if text:
                history.append({"role": role, "text": text})
                
        return {"messages": history}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"messages": [], "error": str(e)}

# --- Naya Chat Endpoint ---
class ChatRequest(BaseModel):
    user_id: str
    subject_name: str
    chapter_name: str
    message: str

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest, user_id: str = Depends(get_current_user)):
    """
    Yeh endpoint user se chat message lega aur LLM response stream karega.
    """
    request.user_id = user_id # Override dummy ID
    async def event_generator():
        try:
            # 1. Status batao (Optional, par acha UI deta hai)
            yield f"data: {json.dumps({'type': 'status', 'message': 'Professor is thinking...'})}\n\n"
            
            # Agent ko initial state bhejte hain
            initial_state = {
                "messages": [HumanMessage(content=request.message)], 
                "user_id": request.user_id,
                "subject_name": request.subject_name,
                "chapter_name": request.chapter_name,
                "current_chapter": request.chapter_name
            }
            
            # Graph compile karo
            app_graph = build_graph()
            config = {"configurable": {"thread_id": f"{request.user_id}_{request.subject_name}_{request.chapter_name}"}}
            
            # 2. Stream events from LangGraph
            async for event in app_graph.astream_events(initial_state, config=config, version="v2"):
                kind = event["event"]
                
                # Agar event chat model ka stream event hai
                if kind == "on_chat_model_stream":
                    node = event["metadata"].get("langgraph_node", "")
                    if node == "tutor_node":
                        chunk_text = event["data"]["chunk"].content
                        if chunk_text:
                            yield f"data: {json.dumps({'type': 'chunk', 'text': chunk_text})}\n\n"
                            
            # 3. Final done message
            print("✅ API Streaming (Chat) Completed Successfully!")
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            
        except Exception as e:
            print(f"Error in chat stream: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

# ----------------- DASHBOARD ANALYTICS ENDPOINTS -----------------

@app.get("/api/dashboard")
def get_dashboard_data(user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Returns global dashboard analytics for all subjects of a user.
    """
    try:
        data = get_dashboard_analytics(db, user_id)
        return {"subjects": data}
    except Exception as e:
        print(f"Error in dashboard analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch dashboard data")

@app.get("/api/subject/{subject_id}/analytics")
def get_subject_analytics(subject_id: int, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Returns chapter-level analytics for a specific subject.
    """
    try:
        data = get_subject_chapter_analytics(db, subject_id)
        if not data:
            raise HTTPException(status_code=404, detail="Subject not found")
        return data
    except Exception as e:
        print(f"Error in subject analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch subject analytics")

@app.get("/api/chapter/{chapter_id}/revision")
def get_chapter_revision(chapter_id: int, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Returns revision data (mistakes, confusions, weaknesses) for a specific chapter.
    """
    try:
        data = get_chapter_revision_data(db, chapter_id)
        if not data:
            raise HTTPException(status_code=404, detail="Chapter not found")
        return data
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in chapter revision: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch revision data")
