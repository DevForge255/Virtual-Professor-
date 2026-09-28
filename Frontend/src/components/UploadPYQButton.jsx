import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

const UploadPYQButton = ({
    onStatusUpdate,
    onStreamDone,
    onError,
    subjectName
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [examYear, setExamYear] = useState('');
    const fileInputRef = useRef(null);
    const { session } = useAuth();

    // --- Drag and Drop Logic ---
    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files).slice(0, 3); // Max 3
            setSelectedFiles(files);
            e.dataTransfer.clearData();
        }
    };

    // --- Manual File Select Logic ---
    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files).slice(0, 3); // Max 3
            setSelectedFiles(files);
        }
    };

    const handleUploadClick = async () => {
        if (selectedFiles.length > 0) {
            const formData = new FormData();
            selectedFiles.forEach(file => {
                formData.append("files", file);
            });
            formData.append("subject_name", subjectName || "Unknown");
            // Since it's global for the subject, we can pass "Global" or "All" as chapter_name
            formData.append("chapter_name", "Global_Subject");
            formData.append("exam_year", examYear); // Even if backend doesn't use it yet, we can send it

            setIsModalOpen(false);
            setSelectedFiles([]);
            setExamYear('');
            
            if (onStatusUpdate) onStatusUpdate("Starting PYQ Analysis...");

            try {
                const response = await fetch("http://localhost:8000/api/upload-pyq", {
                    method: "POST",
                    headers: {
                        'Authorization': `Bearer ${session?.access_token}`
                    },
                    body: formData,
                });

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    if (onError) onError(errData.detail || "Upload failed");
                    return;
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder("utf-8");

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n\n');
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const dataStr = line.replace('data: ', '').trim();
                            if (!dataStr) continue;

                            try {
                                const parsed = JSON.parse(dataStr);
                                if (parsed.type === 'status') {
                                    if (onStatusUpdate) onStatusUpdate(parsed.message);
                                }
                                else if (parsed.type === 'done') {
                                    if (onStreamDone) onStreamDone();
                                }
                                else if (parsed.type === 'error') {
                                    if (onError) onError(parsed.message);
                                }
                            } catch (e) {
                                console.error("Error parsing stream JSON:", e);
                            }
                        }
                    }
                }

            } catch (error) {
                console.error("❌ Network Error:", error);
                if (onError) onError("Network error. Backend chal raha hai ya nahi check karein.");
            }
        }
    };

    return (
        <>
            <button
                onClick={() => setIsModalOpen(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-lg font-semibold transition-colors shadow-md flex items-center gap-2"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                Upload PYQs
            </button>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-[#F5EBE1] p-9 rounded-[2rem] shadow-2xl w-[550px] max-w-[95vw] animate-fade-in-up">
                        <div className="mb-6 text-center">
                            <h2 className="text-3xl font-bold text-slate-800">
                                Analyze Exam Patterns
                            </h2>
                            <p className="text-slate-600 mt-2">Upload up to 3 Previous Year Question Papers</p>
                        </div>

                        {/* Drag and Drop Zone */}
                        <div
                            className={`border-[2px] border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${isDragging ? 'border-purple-500 bg-purple-100/50 scale-[1.02] shadow-lg' : 'border-purple-800/80 bg-transparent hover:bg-purple-50/40 hover:shadow-md'
                                }`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current.click()}
                        >
                            <input
                                type="file"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                accept=".pdf,.png,.jpg,.jpeg"
                                multiple
                            />

                            {selectedFiles.length > 0 ? (
                                <div className="text-purple-700 font-semibold text-lg text-left w-full pl-10">
                                    <p className="mb-2 text-slate-800">Selected Files:</p>
                                    <ul className="list-disc text-sm">
                                        {selectedFiles.map((f, i) => <li key={i}>{f.name}</li>)}
                                    </ul>
                                </div>
                            ) : (
                                <>
                                    <p className="text-[#1e3a8a] font-bold text-[24px] mb-2 tracking-wide">Select up to 3 PDFs</p>
                                    <p className="text-purple-700 text-[14px] font-semibold tracking-wide">We extract questions and map them to syllabus topics</p>
                                </>
                            )}
                        </div>

                        {/* Year Input */}
                        <div className="mt-6">
                            <label className="block text-slate-700 font-medium mb-2">Exam Years (Optional)</label>
                            <input 
                                type="text"
                                placeholder="e.g. 2021, 2022, 2023"
                                value={examYear}
                                onChange={(e) => setExamYear(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setIsModalOpen(false);
                                    setSelectedFiles([]);
                                    setExamYear('');
                                }}
                                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200/50 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUploadClick}
                                disabled={selectedFiles.length === 0}
                                className={`px-6 py-2 text-white font-medium rounded-lg transition-colors shadow-sm ${selectedFiles.length > 0 ? 'bg-purple-600 hover:bg-purple-700' : 'bg-slate-300 cursor-not-allowed'
                                    }`}
                            >
                                Analyze PYQs
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default UploadPYQButton;
