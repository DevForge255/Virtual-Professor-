# 🎓 Virtual Professor - Multi-Agent AI Tutoring System

Virtual Professor is an advanced, intelligent AI tutoring application designed to provide a highly personalized learning experience. By leveraging a sophisticated **Multi-Agent System** powered by LangGraph, it adapts to student behaviors, analyzes study materials (Notes, PDFs, PYQs), conducts mock tests, and tracks core weaknesses over time.

## 🌟 Features

- **🧠 Multi-Agent Tutoring System**: A state-based workflow where different specialized AI agents handle notes extraction, question paper analysis, student evaluation, and active tutoring.
- **📄 Vision-Powered PDF Extraction**: Upload PDF notes or Previous Year Questions (PYQs). The backend converts pages to high-quality images in-memory and extracts rich context using Vision LLMs.
- **📝 Mock Test & Evaluation Engine**: A dedicated sub-graph that extracts questions, evaluates student answers in real-time, and pinpoints exact weaknesses.
- **📊 Performance & Weakness Tracking**: Continuously monitors failed attempts, logged mistakes, and confused topics to adapt the teaching strategy.
- **⚡ High-Performance Caching**: Implements the Cache-Aside pattern using **Redis** to ensure lightning-fast dashboard and subject data retrieval.
- **💾 Persistent Agent Memory**: Uses PostgreSQL with LangGraph Checkpointer to retain the conversational context and state across sessions.
- **📐 Math & Markdown Support**: Renders complex mathematical equations and formatting seamlessly on the frontend using KaTeX and React Markdown.

---

## 🛠️ Tech Stack

### **Frontend**
- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS v4
- **Routing**: React Router v7
- **Markdown/Math**: `react-markdown`, `remark-math`, `rehype-katex`

### **Backend**
- **Framework**: FastAPI (Python)
- **Database**: PostgreSQL (via SQLAlchemy and `psycopg` pool)
- **Caching**: Redis
- **PDF Processing**: PyMuPDF (`fitz`), Unstructured

### **AI & Agentic Framework**
- **Orchestration**: LangGraph & LangChain
- **Vector Store**: FAISS
- **State Management**: LangGraph Postgres Saver

---

## 🤖 The Multi-Agent Architecture

The core of Virtual Professor is built on **LangGraph**, which orchestrates multiple LLM agents using a centralized `StateGraph`. The system is divided into two primary graph architectures:

### 1. Main Tutor Graph (`chat_bot_summarizer.py`)
This graph manages the primary interaction and learning flow:
- **`note_taker_node`**: Activated when a user uploads study notes. It parses the PDF images, extracts the core concepts, and updates the agent's knowledge state.
- **`question_paper_analysis_node`**: Activated for Previous Year Questions (PYQs). It analyzes the difficulty and structure of the uploaded exams.
- **`analyzer_node`**: The "brain" of the operation. It reviews the extracted notes, PYQs, and past mistakes to formulate a teaching strategy and decide the next topic or question.
- **`tutor_node`**: The student-facing agent. It interacts with the user, asks questions, provides hints, and assesses understanding based on the analyzer's instructions.

### 2. Mock Test Graph (`mock_test_agent.py`)
A specialized sub-graph dedicated to testing and evaluation:
- **`mock_test_extraction_node`**: Parses mock test documents and extracts a structured list of questions.
- **`mock_test_evaluator_node`**: Evaluates the student's submitted answers against the extracted questions and determines accuracy.
- **`mock_test_weakness_node`**: Triggered when a student struggles. It logs the mistakes, updates the "confused topics" state, and feeds this back into the main tutor graph to ensure the student revises their weak areas.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Python 3.10+
- PostgreSQL
- Redis Server
- API Keys for your preferred LLM provider (OpenAI, Google Gemini, etc.)

### 1. Backend Setup
```bash
# Navigate to Backend directory
cd Backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Setup Environment Variables
# Create a .env file in the Backend directory and add:
# DATABASE_URL=postgresql://user:password@localhost/virtual_professor
# REDIS_URL=redis://localhost:6379/0
# OPENAI_API_KEY=your_api_key

# Run the FastAPI server
uvicorn Fastapi.main:app --reload
```

### 2. Frontend Setup
```bash
# Navigate to Frontend directory
cd Frontend

# Install dependencies
npm install

# Run the development server
npm run dev
```
The frontend will be available at `http://localhost:5173` and the backend API at `http://localhost:8000`.

---

## 📂 Project Structure

```
Virtual professor/
├── Backend/
│   ├── Agent/               # LangGraph Multi-Agent Nodes & Graphs
│   ├── database/            # SQLAlchemy Models, CRUD, and Redis Logic
│   ├── Fastapi/             # API Endpoints & Auth Middleware
│   ├── requirements.txt     # Python Dependencies
│   └── .env                 # Environment Variables
├── Frontend/
│   ├── public/
│   ├── src/                 # React Components, Pages, and Assets
│   ├── package.json         # Node Dependencies
│   ├── vite.config.js       # Vite Configuration
│   └── tailwind.config.js   # Tailwind Configuration
└── README.md                # Project Documentation
```

---
*Built with ❤️ for intelligent and personalized education.*
