from typing import TypedDict, Annotated, Dict, List
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.postgres import PostgresSaver
import os
from dotenv import load_dotenv

load_dotenv()

DB_URI = os.getenv("DATABASE_URL", "postgresql://yashpal@localhost/virtual_professor")

class MockTestState(TypedDict):
    messages: Annotated[List[BaseMessage], add_messages]
    extracted_questions: List[dict]
    current_question_index: int
    cross_question_count: int
    mistakes_log: List[dict]
    user_id: str
    subject_name: str
    chapter_name: str
    pdf_images: List[str]
    current_action: str

def route_start(state: MockTestState):
    """
    Routes the Mock Test agent based on the current action.
    """
    action = state.get("current_action", "start_test")
    if action == "extract_questions":
        return "mock_test_extraction_node"
    elif action == "evaluate_answer":
        return "mock_test_evaluator_node"
    elif action == "route_to_weakness":
        return "mock_test_weakness_node"
    
    return END

def build_mock_test_graph():
    from Agent.mock_test_extraction_node import mock_test_extractor
    from Agent.mock_test_evaluator_node import mock_test_evaluator
    from Agent.mock_test_weakness_node import mock_test_weakness_analyzer
    
    workflow = StateGraph(MockTestState)
    
    workflow.add_node("mock_test_extraction_node", mock_test_extractor)
    workflow.add_node("mock_test_evaluator_node", mock_test_evaluator)
    workflow.add_node("mock_test_weakness_node", mock_test_weakness_analyzer)
    
    workflow.add_conditional_edges(START, route_start)
    workflow.add_edge("mock_test_extraction_node", END)
    
    # We add edge from evaluator to END, because if it evaluates and wants to route to weakness, 
    # it needs to go back through the checkpointer and next API call will route it via START.
    # Alternatively, we can use conditional edge from evaluator.
    workflow.add_conditional_edges(
        "mock_test_evaluator_node",
        lambda s: "mock_test_weakness_node" if s.get("current_action") == "route_to_weakness" else END
    )
    workflow.add_edge("mock_test_weakness_node", END)
    
    import psycopg
    with psycopg.connect(DB_URI, autocommit=True) as setup_conn:
        PostgresSaver(setup_conn).setup()
    
    from psycopg_pool import AsyncConnectionPool
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
    
    pool = AsyncConnectionPool(conninfo=DB_URI)
    checkpointer = AsyncPostgresSaver(pool)
    
    app = workflow.compile(checkpointer=checkpointer)
    return app
