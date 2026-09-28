import os
from dotenv import load_dotenv
load_dotenv()

from Agent.mock_test_agent import MockTestState
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

class AnswerEvaluation(BaseModel):
    is_correct: bool = Field(description="True if the student's answer is correct, False otherwise")
    feedback: str = Field(description="Short, encouraging feedback explaining why it is correct or incorrect")

def mock_test_evaluator(state: MockTestState):
    """
    Evaluates the student's submitted answer against the stored correct answer.
    """
    print("⏳ Mock Test Evaluator running...")
    
    extracted_questions = state.get("extracted_questions", [])
    current_index = state.get("current_question_index", 0)
    messages = state.get("messages", [])
    
    if current_index >= len(extracted_questions):
        return {"current_action": "test_completed"}
        
    current_q = extracted_questions[current_index]
    student_answer_msg = messages[-1] if messages else None
    
    if not student_answer_msg or student_answer_msg.type != "human":
        print("❌ No student answer found in messages.")
        return {}

    student_answer = student_answer_msg.content
    
    # Fast lightweight evaluation
    llm = ChatOpenAI(model="gpt-5.6-luna", temperature=0.1)
    eval_llm = llm.with_structured_output(AnswerEvaluation)
    
    system_prompt = (
        "You are a strict but encouraging Exam Grader.\n"
        f"Question: {current_q.get('question_text')}\n"
        f"Correct Answer: {current_q.get('correct_answer')}\n\n"
        "Evaluate the student's answer. Does it match the correct answer conceptually or exactly?\n"
        "If it's an MCQ, check if the chosen option is correct.\n"
        "Provide a short 1-sentence feedback."
    )
    
    response = eval_llm.invoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"Student Answer: {student_answer}")
    ])
    
    failed_attempts = state.get("cross_question_count", 0)
    
    if response.is_correct:
        print("✅ Correct Answer!")
        # Correct answer! Move to next question and reset fail counter.
        return {
            "current_question_index": current_index + 1,
            "cross_question_count": 0,
            "current_action": "evaluation_complete",
            "messages": [SystemMessage(content=f"Correct! {response.feedback}")]
        }
    else:
        print("❌ Incorrect Answer.")
        failed_attempts += 1
        
        if failed_attempts >= 3:
            # Failed 3 times, route to weakness node
            return {
                "cross_question_count": failed_attempts,
                "current_action": "route_to_weakness",
                "messages": [SystemMessage(content=f"Incorrect. {response.feedback}")]
            }
        else:
            # Give another try
            return {
                "cross_question_count": failed_attempts,
                "current_action": "evaluation_complete",
                "messages": [SystemMessage(content=f"Incorrect. {response.feedback} Try again!")]
            }
