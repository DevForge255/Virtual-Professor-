import os
import json
from dotenv import load_dotenv
load_dotenv()

from Agent.mock_test_agent import MockTestState
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

class MistakeLog(BaseModel):
    mistake: str = Field(description="The core conceptual mistake made by the student across these 3 failed attempts.")
    specific_topic: str = Field(description="The exact topic the student struggled with.")
    repeat_count: int = Field(description="If this matches a past mistake, increment. Otherwise 1.")

def mock_test_weakness_analyzer(state: MockTestState):
    """
    Called when a student fails a mock test question 3 times.
    Logs the mistake to DB and reveals the solution.
    """
    print("🔬 Mock Test Weakness Analyzer running...")
    
    extracted_questions = state.get("extracted_questions", [])
    current_index = state.get("current_question_index", 0)
    messages = state.get("messages", [])
    mistakes_log = state.get("mistakes_log", [])
    
    if current_index >= len(extracted_questions):
        return {}
        
    current_q = extracted_questions[current_index]
    
    # Run a quick LLM call to identify the exact conceptual mistake
    llm = ChatOpenAI(model="gpt-5.6-luna", temperature=0.1)
    mistake_llm = llm.with_structured_output(MistakeLog)
    
    chat_context = messages[-6:] if len(messages) >= 6 else messages
    
    past_mistakes_str = ""
    if mistakes_log:
        past_mistakes_str = "\n--- PAST LOGGED MISTAKES ---\n"
        for i, m in enumerate(mistakes_log):
            past_mistakes_str += f"{i+1}. Topic: {m.get('specific_topic', 'N/A')} | Mistake: {m.get('mistake', 'N/A')} | repeat_count: {m.get('repeat_count', 1)}\n"
            
    system_prompt = (
        "The student failed to answer this mock test question 3 times.\n"
        f"Question: {current_q.get('question_text')}\n"
        f"Correct Answer: {current_q.get('correct_answer')}\n\n"
        "Identify the core conceptual mistake. Check past mistakes below. If it's semantically the SAME mistake, increment its repeat_count. If new, set repeat_count to 1.\n"
        f"{past_mistakes_str}"
    )
    
    try:
        response = mistake_llm.invoke([
            SystemMessage(content=system_prompt),
            *chat_context
        ])
        new_mistake = response.dict()
        
        # Merge logic
        matched = False
        for i, existing in enumerate(mistakes_log):
            if existing.get("specific_topic", "").strip().lower() == new_mistake["specific_topic"].strip().lower():
                mistakes_log[i]["repeat_count"] = new_mistake["repeat_count"]
                mistakes_log[i]["mistake"] = new_mistake["mistake"]
                matched = True
                break
                
        if not matched:
            mistakes_log.append(new_mistake)
            
        print(f"📝 Logged Mistake: {new_mistake['mistake']} (Topic: {new_mistake['specific_topic']})")
        
    except Exception as e:
        print(f"⚠️ Error logging mistake: {e}")

    # Reveal the solution and move to next question
    solution_text = current_q.get('solution') or current_q.get('correct_answer')
    feedback = f"Since you've struggled with this, let's look at the solution:\n\n{solution_text}"
    
    return {
        "mistakes_log": mistakes_log,
        "current_question_index": current_index + 1,
        "cross_question_count": 0,
        "current_action": "solution_revealed",
        "messages": [SystemMessage(content=feedback)]
    }
