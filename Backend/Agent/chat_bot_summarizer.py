from typing import TypedDict, Annotated, Dict, List
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.postgres import PostgresSaver
import os
from dotenv import load_dotenv

load_dotenv()

# PostgreSQL connection string (same database as our app)
DB_URI = os.getenv("DATABASE_URL", "postgresql://yashpal@localhost/virtual_professor")

# 1. Notes schema aur main AgentState
class NotesSchema(TypedDict):
    subject: str                  
    chapters: Dict[str, str]      

class AgentState(TypedDict):
    messages: Annotated[List[BaseMessage], add_messages]
    notes: NotesSchema
    teaching_instructions: str
    current_chapter: str
    subject_name: str 
    chapter_name: str 
    pdf_images: List[str]
    user_id: str
    chapter_indices: Dict[str, dict]
    pyq_images: List[str]
    analyzed_questions: Dict
    current_action: str
    decider_action: str
    current_topic: str
    current_question: str
    failed_attempts: int
    logged_mistakes: List[dict]
    confused_topics: List[dict]
    core_weaknesses: List[dict]

# 2. TRAFFIC POLICE (Conditional Edge function)
def route_start(state: AgentState):
    """
    Checkpointer ki wajah se graph ko yaad rahega ki State me kya hai.
    Hum yahan check karenge ki API ne kaunsa action bheja hai.
    """
    action = state.get("current_action", "chat")
    
    if action == "upload_pyq":
        return "question_paper_analysis_node"
        
    notes = state.get("notes", {})
    if action == "upload_notes" or notes.get("subject") == "Pending" or not notes.get("chapters"):
        return "note_taker_node"
    
    return "analyzer_node"

# 3. Graph banane ka function
def build_graph():
    from Agent.note_taking_node import note_taker
    from Agent.tutor_node import tutor
    from Agent.analyzer_node import analyzer
    from Agent.question_paper_analysis_node import question_paper_analyzer
    
    workflow = StateGraph(AgentState)
    
    # Nodes add kiye
    workflow.add_node("note_taker_node", note_taker)
    workflow.add_node("question_paper_analysis_node", question_paper_analyzer)
    workflow.add_node("tutor_node", tutor)
    workflow.add_node("analyzer_node", analyzer)
    
    # Edges banaye
    workflow.add_conditional_edges(START, route_start)
    workflow.add_edge("note_taker_node", "analyzer_node")
    workflow.add_edge("question_paper_analysis_node", "analyzer_node")
    workflow.add_edge("analyzer_node", "tutor_node")
    workflow.add_edge("tutor_node", END)
    
    # Pehle ek autocommit connection se tables banao (sirf ek baar)
    import psycopg
    with psycopg.connect(DB_URI, autocommit=True) as setup_conn:
        PostgresSaver(setup_conn).setup()
    
    # Ab ASYNC pool bana ke checkpointer mein daal do (kyunki FastAPI async generator use kar raha hai)
    from psycopg_pool import AsyncConnectionPool
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
    
    pool = AsyncConnectionPool(conninfo=DB_URI)
    checkpointer = AsyncPostgresSaver(pool)
    
    app = workflow.compile(checkpointer=checkpointer)
    return app

