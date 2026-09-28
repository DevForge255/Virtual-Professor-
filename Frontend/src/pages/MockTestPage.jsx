import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import UploadMockTestButton from '../components/UploadMockTestButton';
import { useAuth } from '../context/AuthContext';

const MockTestPage = () => {
    const { subject, chapter } = useParams();
    const navigate = useNavigate();
    const { session } = useAuth();

    const [uploadStatus, setUploadStatus] = useState('');
    const [testStarted, setTestStarted] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [questionIndex, setQuestionIndex] = useState(0);
    const [totalQuestions, setTotalQuestions] = useState(0);
    const [answerInput, setAnswerInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [isEvaluating, setIsEvaluating] = useState(false);

    const fetchQuestion = async () => {
        setLoading(true);
        try {
            const res = await fetch("http://localhost:8000/api/get-mock-test-question", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    subject_name: subject,
                    chapter_name: chapter
                })
            });
            const data = await res.json();
            if (data.status === 'success') {
                setCurrentQuestion(data.question);
                setQuestionIndex(data.current_index);
                setTotalQuestions(data.total_questions);
                setTestStarted(true);
            } else if (data.status === 'completed') {
                alert("Mock Test Finished!");
            } else {
                alert(data.message || "Failed to load question");
            }
        } catch (error) {
            console.error(error);
        }
        setLoading(false);
    };

    const handleStartTest = () => {
        fetchQuestion();
    };

    const handleSubmitAnswer = async (e) => {
        e.preventDefault();
        if (!answerInput.trim() || isEvaluating) return;

        setIsEvaluating(true);
        setFeedback('Evaluating...');

        try {
            const res = await fetch("http://localhost:8000/api/submit-mock-test-answer", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    subject_name: subject,
                    chapter_name: chapter,
                    answer: answerInput
                })
            });

            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.replace('data: ', ''));
                        if (data.type === 'status') {
                            setFeedback(data.message);
                        } else if (data.type === 'feedback') {
                            setFeedback(data.message);
                            // Wait a moment so user can read feedback, then fetch next question state
                            setTimeout(() => {
                                fetchQuestion();
                                setFeedback('');
                                setAnswerInput('');
                            }, 3500);
                        } else if (data.type === 'error') {
                            setFeedback(`Error: ${data.message}`);
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Submit error:", error);
            setFeedback("Error submitting answer.");
        } finally {
            setIsEvaluating(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gradient-to-br from-[#EDEEE9] to-[#D6CCC2] p-8">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E3D5CA] pb-4 mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 bg-white/50 hover:bg-white rounded-lg transition-colors shadow-sm"
                    >
                        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <h1 className="text-3xl font-bold text-gray-800 capitalize">
                        Mock Test: {chapter}
                    </h1>
                </div>
                {testStarted && totalQuestions > 0 && (
                    <div className="text-lg font-bold text-slate-700 bg-white/50 px-4 py-2 rounded-xl shadow-sm">
                        Question {questionIndex + 1} of {totalQuestions}
                    </div>
                )}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 bg-[#F5EBE1] rounded-2xl shadow-xl shadow-[#D7BDB0]/20 p-8 flex flex-col items-center justify-center relative overflow-hidden">

                {!testStarted ? (
                    <div className="text-center flex flex-col items-center">
                        <h2 className="text-2xl font-bold text-slate-700 mb-4">Prepare for the Mock Test</h2>
                        <p className="text-slate-500 mb-8 max-w-lg">
                            Upload a Question Bank PDF to automatically generate a curated mock test of 30-40 high-value questions based on PYQ analysis and chapter index.
                        </p>

                        <div className="w-64 mb-4">
                            <UploadMockTestButton
                                subjectName={subject}
                                chapterName={chapter}
                                onStatusUpdate={(msg) => setUploadStatus(msg)}
                                onStreamDone={() => setUploadStatus('Extraction Complete! ✨ (Ready to start test)')}
                                onError={(err) => setUploadStatus(`Error: ${err}`)}
                            />
                        </div>

                        {uploadStatus && (
                            <div className="mt-4 px-4 py-2 bg-white/60 rounded-lg text-purple-700 font-medium animate-pulse mb-6">
                                {uploadStatus}
                            </div>
                        )}

                        <button
                            onClick={handleStartTest}
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-md mt-4 disabled:opacity-50"
                        >
                            {loading ? "Loading..." : "Start Test Now"}
                        </button>
                    </div>
                ) : (
                    <div className="w-full h-full flex flex-col max-w-4xl mx-auto">
                        {/* Question Area */}
                        <div className="flex-1 bg-white rounded-xl p-8 shadow-sm overflow-y-auto mb-6">
                            <div className="inline-block px-3 py-1 bg-blue-100 text-blue-800 font-semibold text-xs rounded-full mb-4 uppercase tracking-wide">
                                {currentQuestion?.question_type || "Question"} • {currentQuestion?.topic || "Topic"}
                            </div>
                            <h2 className="text-2xl font-semibold text-slate-800 leading-relaxed">
                                {currentQuestion?.question_text}
                            </h2>

                            {/* Options if MCQ */}
                            {currentQuestion?.options && currentQuestion.options.length > 0 && (
                                <div className="mt-8 space-y-3">
                                    {currentQuestion.options.map((opt, idx) => (
                                        <div key={idx} className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setAnswerInput(opt)}>
                                            <span className="font-bold text-slate-400 mr-3">{String.fromCharCode(65 + idx)}.</span>
                                            <span className="text-slate-700 text-lg">{opt}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Feedback Overlay */}
                        {feedback && (
                            <div className="mb-6 p-4 bg-purple-100 border border-purple-200 text-purple-800 rounded-xl shadow-sm font-medium animate-pulse text-center">
                                {feedback}
                            </div>
                        )}

                        {/* Input Area */}
                        <form onSubmit={handleSubmitAnswer} className="flex gap-4">
                            <input
                                type="text"
                                value={answerInput}
                                onChange={(e) => setAnswerInput(e.target.value)}
                                placeholder="Type your answer here..."
                                disabled={isEvaluating}
                                className="flex-1 bg-white border-2 border-transparent focus:border-blue-400 p-4 rounded-xl shadow-sm outline-none text-lg text-slate-800 transition-all disabled:opacity-50"
                            />
                            <button
                                type="submit"
                                disabled={!answerInput.trim() || isEvaluating}
                                className="bg-[#D7BDB0] hover:bg-[#c9aba0] text-white px-8 py-4 rounded-xl font-bold transition-all shadow-md disabled:opacity-50"
                            >
                                {isEvaluating ? 'Checking...' : 'Submit'}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MockTestPage;
