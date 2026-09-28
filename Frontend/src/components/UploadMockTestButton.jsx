import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

const UploadMockTestButton = ({
    onStatusUpdate,
    onChunkReceived,
    onStreamDone,
    onError,
    subjectName,
    chapterName
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const fileInputRef = useRef(null);
    const { session } = useAuth();

    // --- Drag and Drop Logic ---
    const handleDragOver = (e) => {
        // Yeh browser ko default behavior (jaise file ko naye tab mein kholna) se rokti hai
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false); // Jaise hi mouse bahar nikle, highlight hata do
    };

    const handleDrop = (e) => {
        e.preventDefault(); // Default behavior roko
        setIsDragging(false);

        // DataTransfer object se dropped file nikalna
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setSelectedFile(e.dataTransfer.files[0]);
            e.dataTransfer.clearData();
        }
    };

    // --- Manual File Select Logic (Click) ---
    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleUploadClick = async () => {
        if (selectedFile) {
            console.log("File ready to upload to API:", selectedFile.name);

            // FormData banayenge jisme hum file attach karenge
            const formData = new FormData();
            formData.append("file", selectedFile);
            formData.append("subject_name", subjectName || "Unknown");
            formData.append("chapter_name", chapterName || "Unknown");

            // UI turant close karne ke liye (No latency UX)
            setIsModalOpen(false);
            setSelectedFile(null);

            try {
                // Backend API ko call karna (POST request)
                const response = await fetch("http://localhost:8000/api/upload-question-bank", {
                    method: "POST",
                    headers: {
                        'Authorization': `Bearer ${session?.access_token}`
                    },
                    body: formData,
                });

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    console.error("❌ API Error:", errData);
                    if (onError) onError(errData.detail || "Upload failed");
                    return;
                }

                // Streaming response ko read karne ke liye
                const reader = response.body.getReader();
                const decoder = new TextDecoder("utf-8");

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    // Uint8Array ko string mein convert karein
                    const chunk = decoder.decode(value, { stream: true });

                    // Ek chunk mein multiple SSE events ho sakte hain separated by \n\n
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
                                else if (parsed.type === 'chunk') {
                                    if (onChunkReceived) onChunkReceived(parsed.text);
                                }
                                else if (parsed.type === 'done') {
                                    if (onStreamDone) onStreamDone();
                                }
                                else if (parsed.type === 'error') {
                                    if (onError) onError(parsed.message);
                                }
                            } catch (e) {
                                console.error("Error parsing stream JSON:", e, dataStr);
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
                className="bg-[#D7BDB0] hover:bg-[#c9aba0] text-white px-5 py-2.5 rounded-lg font-semibold transition-colors shadow-md w-full mt-4"
            >
                + Upload Question Bank
            </button>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-[#F5EBE1] p-9 rounded-[2rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)] w-[550px] max-w-[95vw] animate-fade-in-up">
                        {/* Heading - same as sketch */}
                        <div className="mb-6 text-center">
                            <h2 className="text-3xl font-bold text-slate-800">
                                Upload Question Bank PDF
                            </h2>
                        </div>

                        {/* Drag and Drop Zone */}
                        <div
                            className={`mt-4 border-[2px] border-dashed rounded-2xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${isDragging ? 'border-blue-500 bg-blue-100/50 scale-[1.02] shadow-lg' : 'border-blue-800/80 bg-transparent hover:bg-blue-50/40 hover:shadow-md'
                                }`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current.click()}
                        >
                            {/* Hidden file input */}
                            <input
                                type="file"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                accept=".pdf,.ppt,.pptx,.doc,.docx"
                            />

                            {selectedFile ? (
                                <p className="text-green-700 font-semibold text-lg">File Selected: {selectedFile.name}</p>
                            ) : (
                                <>
                                    <p className="text-[#1e3a8a] font-bold text-[28px] mb-3 tracking-wide">PDF, PPT, ...etc</p>
                                    <p className="text-blue-700 text-[15px] font-semibold tracking-wide">Fully supports Scanned PDFs & Handwriting</p>
                                </>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setIsModalOpen(false);
                                    setSelectedFile(null);
                                }}
                                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200/50 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUploadClick}
                                disabled={!selectedFile}
                                className={`px-4 py-2 text-white font-medium rounded-lg transition-colors shadow-sm ${selectedFile ? 'bg-[#D7BDB0] hover:bg-[#c9aba0]' : 'bg-slate-300 cursor-not-allowed'
                                    }`}
                            >
                                Upload
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default UploadMockTestButton;
