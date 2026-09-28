import os
import re
from Agent.chat_bot_summarizer import AgentState
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

def tutor(state: AgentState):
    """
    Yeh node professor ki tarah behave karega.
    Pehli baar intro aur story dega, uske baad user ke questions ka jawab dega.
    """
    # 1. LLM ko initialize karna (temperature thoda high rakha hai taaki creative/friendly ho)
    llm = ChatOpenAI(model="gpt-5.6-terra", temperature=0.7)
    
    # 2. State se messages aur notes nikalna
    messages = state.get("messages", [])
    
    has_ai_replied = any(isinstance(m, AIMessage) for m in messages)
    
    notes_data = state.get("notes", {})
    subject = notes_data.get("subject", "Unknown Subject")
    chapters_notes = notes_data.get("chapters", {})
    
    decider_action = state.get("decider_action", "teach_new_topic")
    current_topic = state.get("current_topic", "")
    analyzed_questions = state.get("analyzed_questions", {})
    chapter_name = state.get("chapter_name", "")
    
    # Check if we have PYQs for the current topic
    pyq_context = ""
    if decider_action == "teach_new_topic" and current_topic and chapter_name:
        chap_pyq = analyzed_questions.get(chapter_name, {})
        topics = chap_pyq.get("topics", [])
        for t in topics:
            t_name = t.get('topic_name') if isinstance(t, dict) else getattr(t, 'topic_name', str(t))
            if t_name.strip().lower() == current_topic.strip().lower():
                qs = t.get('questions', []) if isinstance(t, dict) else getattr(t, 'questions', [])
                if qs:
                    pyq_context = f"\n\n🚨 CRITICAL TUTORING INSTRUCTION: The student is now learning '{current_topic}'. " \
                                  f"Here are the highly repeated Previous Year Questions for this topic:\n"
                    for q in qs:
                        q_text = q.get('q_text') if isinstance(q, dict) else getattr(q, 'q_text', '')
                        freq = q.get('frequency') if isinstance(q, dict) else getattr(q, 'frequency', 1)
                        pyq_context += f"- {q_text} (Appeared {freq} times)\n"
                    pyq_context += "\nYou MUST weave these exam patterns into your teaching. Ask Socratic questions based on these exact patterns to test the student."
                break
                
    teaching_instructions = state.get("teaching_instructions", "")
    instruction_prompt = f"\n\n🚨 IMPORTANT LONG-TERM MEMORY INSTRUCTION: {teaching_instructions}\n(You MUST follow this strictly while answering)" if teaching_instructions else ""
    
    # ----- EVALUATOR ACTION CONTEXT -----
    evaluator_context = ""
    if decider_action == "give_hint":
        failed_attempts = state.get("failed_attempts", 0)
        current_question = state.get("current_question", "")
        logged_mistakes = state.get("logged_mistakes", [])
        last_mistake = logged_mistakes[-1] if logged_mistakes else {}
        evaluator_context = (
            f"\n\n🚨 HINT MODE (Attempt {failed_attempts}/3): The student got the answer WRONG.\n"
            f"The question was: \"{current_question}\"\n"
            f"Their latest mistake: {last_mistake.get('mistake', 'Unknown')}\n"
            f"Give a gentle, encouraging HINT that guides them towards the correct answer WITHOUT giving the answer directly.\n"
            f"End with the SAME question again, prefixed with [QUESTION], so they can retry."
        )
    elif decider_action == "provide_solution":
        current_question = state.get("current_question", "")
        evaluator_context = (
            f"\n\n🚨 SOLUTION MODE: The student failed to answer 3 times.\n"
            f"The question was: \"{current_question}\"\n"
            f"Say something encouraging like 'Koi baat nahi, yeh thoda tricky tha!'\n"
            f"Then provide the COMPLETE step-by-step solution.\n"
            f"After the solution, ask a NEW (different but related) question prefixed with [QUESTION]."
        )
    elif decider_action == "praise_and_move_on":
        evaluator_context = (
            "\n\n🎉 The student answered correctly! Praise them warmly and enthusiastically.\n"
            "Then ask a NEW question on the next concept, prefixed with [QUESTION]."
        )
    
    # Notes ko string me convert karte hain taaki LLM padh sake
    notes_str = f"Subject: {subject}\n\n"
    for chap, note in chapters_notes.items():
        notes_str += f"--- {chap} ---\n{note}\n\n"
        
    # 3. Prompt Logic (Pehli baar intro vs baad me question/answer)
    if not has_ai_replied:
        print("⏳ Professor is preparing the introductory story...")
        system_prompt = (
            "You are a friendly, wise, and enthusiastic Virtual Professor. "
            "You MUST speak ONLY in Hinglish (a conversational mix of Hindi and English written in the English alphabet). "
            "Your student has just arrived for the first time. "
            "Using the provided notes below, give them a warm, story-like introduction and overview of the topic. "
            "Act like a professor building excitement for a new topic. Don't dump everything at once. "
            "Keep it engaging, use real-life relatable examples, and end by asking if they are ready to dive deeper or if they have any doubts. "
            "IMPORTANT MATH FORMATTING: If you write multiple equations, use `$$ \\begin{aligned} ... \\end{aligned} $$` and align them with `&=` so the equals signs match vertically."
            f"\n\nHere are the chapter notes:\n{notes_str}"
        )
        # Pehli baar me koi chat history nahi bhejte, sirf system prompt bhejenge
        response = llm.invoke([SystemMessage(content=system_prompt)])
        
    else:
        system_prompt = (
            "You are a friendly and wise Virtual Professor. "
            "You MUST speak ONLY in Hinglish (a conversational mix of Hindi and English written in the English alphabet). "
            "Answer the student's questions accurately, playfully, and simply, based on the chapter notes below. "
            "Use real-life examples and keep the tone encouraging. "
            "IMPORTANT: Whenever you ask the student a question, you MUST prefix that question with [QUESTION] on its own line.\n"
            "Example: [QUESTION] Newton ka third law kya kehta hai?\n"
            "IMPORTANT MATH FORMATTING: If you write multiple equations, use `$$ \\begin{aligned} ... \\end{aligned} $$` and align them with `&=` so the equals signs match vertically. "
            f"{instruction_prompt}"
            f"{pyq_context}"
            f"{evaluator_context}"
            f"\n\nHere are the chapter notes for your reference:\n{notes_str}"
        )
        
        # User ne question poocha hai, toh hum system prompt aur poori purani messages list bhejenge
        full_messages = [SystemMessage(content=system_prompt)] + messages
        response = llm.invoke(full_messages)
    
    # ----- EXTRACT [QUESTION] TAG FROM AI RESPONSE -----
    ai_text = response.content
    question_match = re.search(r'\[QUESTION\]\s*(.+)', ai_text)
    new_current_question = question_match.group(1).strip() if question_match else ""
    
    if new_current_question:
        print(f"❓ New Question Tracked: {new_current_question[:80]}...")
    
    # 4. Response ko return karna
    return {
        "messages": [response],
        "current_question": new_current_question
    }
