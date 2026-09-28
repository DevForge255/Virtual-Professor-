import os 
from dotenv import load_dotenv
load_dotenv()  

from Agent.chat_bot_summarizer import AgentState
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

class TopicExplanation(BaseModel):
    topic_name: str = Field(description="Name of the topic or subtopic")
    brief_explanation: str = Field(description="A brief 1-2 sentence explanation of what this topic covers, useful for mapping exam questions later")

class ChapterIndex(BaseModel):
    topics: list[TopicExplanation]

def note_taker(state: AgentState):
    """
    Ab yeh node OS se files dhoondhne ke bajaye seedha Frontend API se aayi hui state read karega.
    """
    llm = ChatOpenAI(model="gpt-5.6-luna", temperature=0.2)
    
    # State se values nikalna
    subject_name = state.get("subject_name", "Unknown Subject")
    chapter_name = state.get("chapter_name", state.get("current_chapter", "Unknown Chapter"))
    pdf_images = state.get("pdf_images", [])
    
    # Agar pdf_images empty hai toh purane notes return kardo
    if not pdf_images:
        print("❌ Koi pdf_images state me nahi mila. Notes generate nahi hue.")
        return {"notes": state.get("notes", {"subject": subject_name, "chapters": {}})}
        
    print(f"⏳ Generating notes (Vision) for '{chapter_name}' from subject '{subject_name}'...")
    
    system_prompt = (
        "You are an expert AI Math and Physics tutor and note-taker. "
        "Read the provided document images and extract all the text, non-obvious points, "
        "and especially ALL mathematical equations, formulas, and derivations PRECISELY as they appear. "
        "You must output everything in Markdown and LaTeX format. "
        "Use `$$` for block equations and `$` for inline equations. "
        "IMPORTANT FOR MATH FORMATTING: When rendering multiple related equations (like a system of equations, list of formulas, or derivation steps), you MUST use the `\\begin{aligned} ... \\end{aligned}` environment inside the `$$` block. "
        "Use `&=` so they are perfectly aligned vertically at the equals sign. Do NOT output them as separate, unaligned block equations. "
        "Example: `$$ \\begin{aligned} A &= B \\\\ C &= D \\end{aligned} $$`"
    )
    
    # Image content ko OpenAI format me prepare karna
    message_content = [{"type": "text", "text": "Please extract notes and math derivations exactly from these document images:"}]
    for img_base64 in pdf_images:
        message_content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{img_base64}"}
        })
    
    response = llm.invoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=message_content)
    ])
    
    # State se current notes nikal kar usme naye chapter ko append (add) karna hai
    current_notes = state.get("notes", {})
    if not current_notes or "chapters" not in current_notes:
        current_notes = {"subject": subject_name, "chapters": {}}
    else:
        # Subject update kar dete hain incase change hua ho
        current_notes["subject"] = subject_name
        
    # Naye chapter ki notes add kardi
    current_notes["chapters"][chapter_name] = response.content
    
    print(f"✅ Notes successfully generated for '{chapter_name}'.")
    print(f"⏳ Extracting structured Chapter Index for '{chapter_name}'...")
    
    # Doosra LLM call (Structured Output) sirf index nikalne ke liye
    current_indices = state.get("chapter_indices", {})
    
    structured_llm = llm.with_structured_output(ChapterIndex)
    index_prompt = (
        f"Extract a structured table of contents / list of topics from these notes.\n\n"
        f"Notes:\n{response.content}"
    )
    
    index_result = None
    for attempt in range(3):
        try:
            index_result = structured_llm.invoke(index_prompt)
            current_indices[chapter_name] = index_result.dict()
            print(f"✅ Chapter Index successfully extracted for '{chapter_name}' on attempt {attempt + 1}.\n")
            break
        except Exception as e:
            print(f"⚠️ Error extracting Chapter Index on attempt {attempt + 1}: {repr(e)}")
            
    if not index_result:
        print(f"❌ Failed to extract Chapter Index after 3 attempts. Saving empty topics.")
        current_indices[chapter_name] = {"topics": []}
    else:
        # Save to DB
        from database.database import SessionLocal
        from database import crud
        db = SessionLocal()
        try:
            user_id = state.get("user_id")
            if user_id and subject_name and chapter_name:
                chapter_id = crud.get_chapter_id_by_name(db, user_id, subject_name, chapter_name)
                if chapter_id:
                    crud.update_chapter_indices(db, chapter_id, index_result.dict())
                    print(f"💾 Saved Chapter Index to DB for '{chapter_name}'")
        except Exception as e:
            print(f"⚠️ DB Error saving indices: {e}")
        finally:
            db.close()
            
    return {"notes": current_notes, "chapter_indices": current_indices}