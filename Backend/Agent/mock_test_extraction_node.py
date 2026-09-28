import os
from dotenv import load_dotenv
load_dotenv()

from Agent.mock_test_agent import MockTestState
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

class ExtractedQuestion(BaseModel):
    question_text: str = Field(description="The exact question text")
    options: list[str] = Field(description="Options if it's an MCQ, else empty list")
    correct_answer: str = Field(description="The correct option or final answer")
    solution: str = Field(description="The step-by-step solution or explanation for the answer, if available")
    topic: str = Field(description="The topic this question belongs to from the chapter index")
    question_type: str = Field(description="Must be 'MCQ', 'Numerical', or 'Theory'")

class MockTestOutput(BaseModel):
    questions: list[ExtractedQuestion]

def mock_test_extractor(state: MockTestState):
    """
    Extracts 30-40 structured questions from the uploaded Question Bank PDF.
    It takes the syllabus index and PYQ analysis as context if available.
    """
    print("⏳ Mock Test Extractor running...")
    llm = ChatOpenAI(model="gpt-5.6-luna", temperature=0.2)
    
    subject_name = state.get("subject_name", "Unknown Subject")
    chapter_name = state.get("chapter_name", "Unknown Chapter")
    pdf_images = state.get("pdf_images", [])
    
    if not pdf_images:
        print("❌ No pdf_images in state for Mock Test.")
        return {"extracted_questions": []}
        
    # Fetch Chapter Indices & PYQ from DB
    import sys
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
    from database.database import SessionLocal
    from database import crud
    
    db = SessionLocal()
    chapter_indices = {}
    pyq_analysis = {}
    try:
        user_id = state.get("user_id")
        if user_id:
            chapter_id = crud.get_chapter_id_by_name(db, user_id, subject_name, chapter_name)
            if chapter_id:
                response = crud.get_agent_response_by_chapter(db, chapter_id)
                if response:
                    chapter_indices = response.chapter_indices or {}
                    pyq_analysis = response.pyq_analysis or {}
    except Exception as e:
        print(f"⚠️ Error fetching indices/pyqs from DB: {e}")
    finally:
        db.close()
        
    # Build context
    context = f"--- CHAPTER INDEX ---\n{chapter_indices}\n\n--- PYQ ANALYSIS ---\n{pyq_analysis}\n"
    
    system_prompt = (
        "You are an expert Test Generator. "
        "Read the provided Question Bank document images. "
        "Extract 30-40 high-value questions from it, prioritizing those that align with the PYQ analysis and Chapter Index provided below. "
        "Format the output strictly as a JSON list of ExtractedQuestions. "
        "Use markdown/LaTeX for math if present.\n\n"
        f"{context}"
    )
    
    message_content = [{"type": "text", "text": "Extract structured questions from these question bank images:"}]
    for img_base64 in pdf_images:
        message_content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{img_base64}"}
        })
        
    structured_llm = llm.with_structured_output(MockTestOutput)
    
    print("⏳ Running Vision LLM for Mock Test Extraction...")
    try:
        response = structured_llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=message_content)
        ])
        extracted = [q.dict() for q in response.questions]
        print(f"✅ Extracted {len(extracted)} questions!")
        return {"extracted_questions": extracted, "pdf_images": []}
    except Exception as e:
        print(f"❌ Extraction failed: {e}")
        return {"extracted_questions": []}
