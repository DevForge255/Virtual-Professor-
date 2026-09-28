from typing import List
import sys
import os
import json

# Adjust sys path so we can import from database
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from database.database import SessionLocal
from database import crud

from pydantic import BaseModel, Field
from Agent.chat_bot_summarizer import AgentState
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

# =====================================================
# PRIMARY CALL SCHEMA (Lightweight — runs every message)
# =====================================================
class PrimaryDecision(BaseModel):
    action: str = Field(description="Must be exactly 'teach_new_topic' if the user wants to learn a new topic or move forward, OR 'clear_doubt' if they are asking a question, confused, or discussing the current topic.")
    topic_name: str = Field(description="If action is 'teach_new_topic', provide the EXACT topic name from the provided syllabus index. If 'clear_doubt', leave empty string.")
    evaluation: str = Field(description="Must be exactly 'correct' if the student answered a question correctly, 'incorrect' if they answered wrongly, or 'not_applicable' if no question was being asked.")
    tutor_instruction: str = Field(description="Short instruction for the tutor to adapt their teaching style based on the student's message.")

# =====================================================
# SECONDARY CALL SCHEMA (Deep Dive — triggered at 3 fails)
# =====================================================
class MistakeDetail(BaseModel):
    mistake: str = Field(description="The actual specific mistake made by the student.")
    specific_topic: str = Field(description="The exact topic where the mistake happened.")
    actual_example_of_conversation: str = Field(description="Exact quote/example from the conversation showing the mistake.")
    repeat_count: int = Field(description="If this mistake matches a previously logged mistake, increment its count. Otherwise set to 1.")

class ConfusionDetail(BaseModel):
    confusion: str = Field(description="What exactly was the confusion.")
    weakness_topic: str = Field(description="Which specific topic is their weakness.")
    actual_part_of_conversation: str = Field(description="Exact part of the conversation where the confusion was expressed.")
    justification: str = Field(description="Justification of why they are struggling with this.")

class WeaknessDetail(BaseModel):
    topic: str = Field(description="The specific topic where the student is weak.")
    needs_revision: bool = Field(description="Does this topic need more revision? (True or False)")
    reason_for_weakness: str = Field(description="Why is the student weak in this topic? What is the conceptual gap?")
    related_mistakes: str = Field(description="What mistakes did they make related to this weakness?")

class DeepDiveOutput(BaseModel):
    mistake: MistakeDetail = Field(description="The core mistake the student made after 3 failed attempts.")
    confused_topics: List[ConfusionDetail] = Field(description="List of specific confusions identified from the 3 failed attempts.")

# =====================================================
# THE ANALYZER NODE (Decider + Evaluator)
# =====================================================
def analyzer(state: AgentState):
    """
    Dual-Purpose Node:
    1. PRIMARY CALL (Every message): Routes the user + evaluates answer correctness.
    2. SECONDARY CALL (Only on 3rd fail): Deep dive mistake & confusion analysis.
    """
    print("🔍 Analyzer (Decider + Evaluator) running...")
    
    messages = state.get("messages", [])
    if not messages:
        return {
            "teaching_instructions": "", "decider_action": "teach_new_topic", 
            "current_topic": "", "failed_attempts": 0
        }
    
    chapter_name = state.get("chapter_name", "Unknown Chapter")
    chapter_indices = state.get("chapter_indices", {})
    failed_attempts = state.get("failed_attempts", 0)
    logged_mistakes = state.get("logged_mistakes", [])
    confused_topics_state = state.get("confused_topics", [])
    core_weaknesses_state = state.get("core_weaknesses", [])
    
    # ----- Build Syllabus Context -----
    syllabus_context = ""
    chap_data = chapter_indices.get(chapter_name, {})
    topics = chap_data.get("topics", [])
    if topics:
        syllabus_context += "--- SYLLABUS TOPICS ---\n"
        for t in topics:
            t_name = t.get('topic_name') if isinstance(t, dict) else getattr(t, 'topic_name', str(t))
            syllabus_context += f"- {t_name}\n"
        syllabus_context += "-----------------------\n"
    
    # =====================================================
    # 1. PRIMARY LLM CALL (Fast — every message)
    # =====================================================
    print("🤖 [PRIMARY] Running Decider + Evaluator LLM...")
    
    llm = ChatOpenAI(model="gpt-5.6-luna", temperature=0.1)
    primary_llm = llm.with_structured_output(PrimaryDecision)
    
    current_question = state.get("current_question", "")
    question_context = f"\n\nThe tutor's current question to the student is: \"{current_question}\"" if current_question else ""
    
    primary_prompt = (
        "You are an expert teaching analyzer, decider, and evaluator.\n"
        "Read the previous AI messages and the student's latest message carefully.\n\n"
        "TASK 1 (Routing):\n"
        "Determine if the user wants to learn a NEW topic or if they are asking a question/clearing a doubt.\n"
        "If they want to learn a new topic, set 'action' to 'teach_new_topic' and set 'topic_name' STRICTLY to one of the topics listed in the syllabus below.\n"
        "If they are asking a question, confused, or discussing the current topic, set 'action' to 'clear_doubt' and leave 'topic_name' as empty string.\n\n"
        "TASK 2 (Evaluation):\n"
        "If the tutor asked a question (see CURRENT QUESTION below), evaluate if the student's latest message is a correct or incorrect answer.\n"
        "Set 'evaluation' to 'correct' if correct, 'incorrect' if wrong, or 'not_applicable' if no question was pending.\n\n"
        "TASK 3 (Tutor Instruction):\n"
        "Output a short instruction for the tutor to adapt their teaching style.\n\n"
        f"{syllabus_context}"
        f"{question_context}"
    )
    
    chat_context = messages[-4:] if len(messages) >= 4 else messages
    
    primary_response = primary_llm.invoke([
        SystemMessage(content=primary_prompt),
        *chat_context
    ])
    
    primary_data = primary_response.model_dump()
    print(f"🛣️ Action: {primary_data['action']} | Topic: {primary_data['topic_name']} | Eval: {primary_data['evaluation']}")
    
    # =====================================================
    # 2. COUNTER LOGIC (Python — no LLM needed)
    # =====================================================
    evaluation = primary_data["evaluation"]
    decider_action = primary_data["action"]
    
    if evaluation == "incorrect":
        failed_attempts += 1
        print(f"❌ Wrong answer! Failed attempts: {failed_attempts}/3")
        
        if failed_attempts >= 3:
            decider_action = "provide_solution"
        else:
            decider_action = "give_hint"
            
    elif evaluation == "correct":
        print("✅ Correct answer!")
        failed_attempts = 0
        decider_action = "praise_and_move_on"
    # else: not_applicable — keep the original action from primary call
    
    # =====================================================
    # 3. SECONDARY LLM CALL (Deep Dive — only on 3rd fail)
    # =====================================================
    new_mistakes = logged_mistakes.copy()
    new_confused = confused_topics_state.copy()
    new_weaknesses = core_weaknesses_state.copy()
    
    if failed_attempts >= 3 and evaluation == "incorrect":
        print("🔬 [SECONDARY] Triggering Deep Dive Mistake Analysis...")
        
        deep_llm = llm.with_structured_output(DeepDiveOutput)
        
        # Build past mistakes context for duplicate prevention
        past_mistakes_str = ""
        if logged_mistakes:
            past_mistakes_str = "\n--- PAST LOGGED MISTAKES (DO NOT DUPLICATE) ---\n"
            for i, m in enumerate(logged_mistakes):
                past_mistakes_str += f"{i+1}. Topic: {m.get('specific_topic', 'N/A')} | Mistake: {m.get('mistake', 'N/A')} | repeat_count: {m.get('repeat_count', 1)}\n"
            past_mistakes_str += "-----------------------------------------------\n"
        
        deep_context = messages[-6:] if len(messages) >= 6 else messages
        
        deep_prompt = (
            "The student has FAILED to answer the current question 3 times.\n"
            "Read the last 6 messages carefully. Identify the EXACT core mistake.\n\n"
            "CRITICAL DUPLICATE PREVENTION RULE:\n"
            "I am providing you with the student's PAST LOGGED MISTAKES below.\n"
            "If the current mistake is semantically the SAME as any past mistake "
            "(e.g., 'formula galat lagaya' and 'wrong equation used' are the SAME), "
            "then output the SAME mistake text and INCREMENT its repeat_count by 1.\n"
            "If it is a genuinely NEW mistake, set repeat_count to 1.\n\n"
            "Also identify any confusions the student expressed during these 3 attempts.\n\n"
            f"{past_mistakes_str}"
            f"\nThe question was: \"{current_question}\""
        )
        
        deep_response = deep_llm.invoke([
            SystemMessage(content=deep_prompt),
            *deep_context
        ])
        
        deep_data = deep_response.model_dump()
        new_mistake = deep_data["mistake"]
        
        print(f"📝 Mistake Logged: {new_mistake['mistake']} (repeat: {new_mistake['repeat_count']})")
        
        # ----- UPDATE MISTAKES LIST (Merge or Append) -----
        matched = False
        for i, existing in enumerate(new_mistakes):
            if existing.get("specific_topic", "").strip().lower() == new_mistake["specific_topic"].strip().lower():
                # Same topic — update the existing entry
                new_mistakes[i]["repeat_count"] = new_mistake["repeat_count"]
                new_mistakes[i]["mistake"] = new_mistake["mistake"]
                
                # Append the new example instead of overwriting
                old_example = existing.get("actual_example_of_conversation", "")
                new_example = new_mistake.get("actual_example_of_conversation", "")
                new_mistakes[i]["actual_example_of_conversation"] = f"{old_example}\n\n[Attempt {new_mistake['repeat_count']}]: {new_example}"
                
                matched = True
                print(f"🔄 Updated existing mistake (repeat_count: {new_mistake['repeat_count']})")
                break
        
        if not matched:
            new_mistakes.append(new_mistake)
            print(f"🆕 New mistake added to log.")
        
        # ----- ADD CONFUSIONS -----
        for conf in deep_data.get("confused_topics", []):
            new_confused.append(conf)
        
        # ----- WEAKNESS PROMOTION (repeat_count >= 3) -----
        if new_mistake["repeat_count"] >= 3:
            weakness_entry = {
                "topic": new_mistake["specific_topic"],
                "needs_revision": True,
                "reason_for_weakness": f"Student failed the same concept ({new_mistake['mistake']}) {new_mistake['repeat_count']} times across different questions.",
                "related_mistakes": new_mistake["mistake"]
            }
            # Check if weakness already exists for this topic
            already_weak = any(
                w.get("topic", "").strip().lower() == new_mistake["specific_topic"].strip().lower()
                for w in new_weaknesses
            )
            if not already_weak:
                new_weaknesses.append(weakness_entry)
                print(f"⚠️ PROMOTED to Core Weakness: {new_mistake['specific_topic']}")
        
        # ----- SAVE TO DATABASE -----
        db = SessionLocal()
        try:
            user_id = state.get("user_id")
            subject_name = state.get("subject_name")
            
            if user_id and subject_name and chapter_name:
                chapter_id = crud.get_chapter_id_by_name(
                    db=db, user_id=user_id, subject_name=subject_name, chapter_name=chapter_name
                )
                if chapter_id:
                    crud.save_agent_response(
                        db=db,
                        chapter_id=chapter_id,
                        tutor_instruct=primary_data["tutor_instruction"],
                        mistakes=[new_mistake],
                        confused_topics=deep_data.get("confused_topics", []),
                        core_weaknesses=new_weaknesses
                    )
                    print("✅ Deep Dive Analysis saved to Database!")
                else:
                    print("❌ Chapter not found in DB.")
            else:
                print("❌ Missing user_id, subject_name, or chapter_name.")
        finally:
            db.close()
        
        # Reset counter after full cycle
        failed_attempts = 0
    
    # =====================================================
    # 4. RETURN UPDATED STATE
    # =====================================================
    return {
        "teaching_instructions": primary_data["tutor_instruction"],
        "decider_action": decider_action,
        "current_topic": primary_data["topic_name"],
        "failed_attempts": failed_attempts,
        "logged_mistakes": new_mistakes,
        "confused_topics": new_confused,
        "core_weaknesses": new_weaknesses,
    }
