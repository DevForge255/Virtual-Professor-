import os
from dotenv import load_dotenv
load_dotenv()

from Agent.chat_bot_summarizer import AgentState
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

class MappedQuestion(BaseModel):
    q_text: str = Field(description="The exact text of the question")
    years_appeared: list[int] = Field(description="List of years this question or similar pattern appeared")
    frequency: int = Field(description="How many times this question/pattern appeared")

class TopicAnalysis(BaseModel):
    topic_name: str = Field(description="Name of the topic from the provided syllabus index")
    importance_score: int = Field(description="Score out of 10 indicating how frequently questions appear from this topic")
    questions: list[MappedQuestion] = Field(description="List of repeated questions mapped to this topic")

class ChapterAnalysis(BaseModel):
    chapter_name: str = Field(description="Name of the chapter being analyzed")
    topics: list[TopicAnalysis] = Field(description="Topics with their mapped questions")

class PYQAnalysisOutput(BaseModel):
    chapters: list[ChapterAnalysis]

def question_paper_analyzer(state: AgentState):
    """
    Node to analyze uploaded Previous Year Question papers.
    Uses Vision LLM to read images, then maps them against the syllabus index.
    """
    llm = ChatOpenAI(model="gpt-5.6-luna", temperature=0.2)
    
    subject_name = state.get("subject_name", "Unknown Subject")
    chapter_indices = state.get("chapter_indices", {})
    pyq_images = state.get("pyq_images", [])
    
    if not pyq_images:
        print("❌ No PYQ images found in state. Skipping PYQ analysis.")
        return {"analyzed_questions": state.get("analyzed_questions", {})}

    print(f"⏳ Analyzing {len(pyq_images)} pages of Question Papers for {subject_name}...")
    
    # We pass the syllabus index as context to prevent hallucinations
    index_context = ""
    for chap, data in chapter_indices.items():
        index_context += f"\nChapter: {chap}\n"
        topics = data.get("topics", [])
        if isinstance(topics, list):
            for t in topics:
                # Handle both dict (if parsed raw) and pydantic models
                t_name = t.get('topic_name') if isinstance(t, dict) else getattr(t, 'topic_name', str(t))
                t_exp = t.get('brief_explanation') if isinstance(t, dict) else getattr(t, 'brief_explanation', '')
                index_context += f"  - Topic: {t_name} (Desc: {t_exp})\n"
                
    system_prompt = (
        "You are an expert Exam Pattern Analyzer and Teacher. "
        "Read the provided document images which are Previous Year Question Papers (PYQs). "
        "Extract the most repeated or important questions and identify the underlying concepts.\n\n"
        "IMPORTANT: You MUST map the extracted questions strictly to the topics provided in the Syllabus Index below. "
        "Do NOT invent new chapters or topics. Only use the ones provided.\n\n"
        f"--- SYLLABUS INDEX ---\n{index_context}\n--- END SYLLABUS ---"
    )
    
    message_content = [{"type": "text", "text": "Analyze these question papers and extract the repeated patterns mapped to the provided topics:"}]
    for img_base64 in pyq_images:
        message_content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{img_base64}"}
        })
        
    structured_llm = llm.with_structured_output(PYQAnalysisOutput)
    
    current_analysis = state.get("analyzed_questions", {})
    
    for attempt in range(3):
        try:
            print(f"Attempt {attempt+1} to analyze PYQs...")
            response = structured_llm.invoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=message_content)
            ])
            
            # Merge with existing analysis
            for chap_analysis in response.chapters:
                # We store it by chapter name for easy access later
                current_analysis[chap_analysis.chapter_name] = chap_analysis.dict()
                
            print(f"✅ PYQ Analysis successfully completed on attempt {attempt+1}.")
            
            # Save to DB
            from database.database import SessionLocal
            from database import crud
            db = SessionLocal()
            try:
                user_id = state.get("user_id")
                if user_id and subject_name:
                    for chap_name, chap_data in current_analysis.items():
                        chapter_id = crud.get_chapter_id_by_name(db, user_id, subject_name, chap_name)
                        if chapter_id:
                            crud.update_pyq_analysis(db, chapter_id, chap_data)
                            print(f"💾 Saved PYQ Analysis to DB for '{chap_name}'")
            except Exception as e:
                print(f"⚠️ DB Error saving pyq analysis: {e}")
            finally:
                db.close()
                
            break
        except Exception as e:
            print(f"⚠️ Error analyzing PYQs on attempt {attempt+1}: {repr(e)}")
            
    # Clear pyq_images so it doesn't re-process if the node is called again mistakenly
    return {"analyzed_questions": current_analysis, "pyq_images": []}
