import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const New_chapter_button = ({ onAddSubject }) => {
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form States for New Subject
    const [newSubjectTitle, setNewSubjectTitle] = useState("");
    const [numChapters, setNumChapters] = useState(1);
    const [newChapterNames, setNewChapterNames] = useState([""]);
    const { session } = useAuth();

    const handleNumChaptersChange = (e) => {
        let num = parseInt(e.target.value);
        if (isNaN(num) || num < 1) num = 1;
        if (num > 15) num = 15; // Limit to 15 chapters at once
        setNumChapters(num);

        // Update chapterNames array length to match the number
        setNewChapterNames(prev => {
            const newArr = [...prev];
            if (num > prev.length) {
                while (newArr.length < num) newArr.push("");
            } else {
                newArr.length = num;
            }
            return newArr;
        });
    };

    const handleChapterNameChange = (index, value) => {
        setNewChapterNames(prev => {
            const newArr = [...prev];
            newArr[index] = value;
            return newArr;
        });
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();

        if (newSubjectTitle.trim() === "") return;

        const chaptersList = newChapterNames.filter(name => name.trim() !== "");

        try {
            // 1. API Call: Backend ko data bhejna
            const response = await fetch("http://localhost:8000/api/subjects/add", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    user_id: session?.user?.id || "",
                    subject_name: newSubjectTitle,
                    chapters: chaptersList
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to save subject in database");
            }

            const data = await response.json();
            console.log("Success:", data); // Check in browser console

            // 2. React UI ko update karna
            const newSubject = {
                id: data.subject_id, // Database se aayi hui real ID assign kar rahe hain!
                title: newSubjectTitle,
                chapters: chaptersList,
                image: "https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&q=80&w=600",
                icon: "📚"
            };

            // Pass the new subject to the parent component (TutorModePage)
            onAddSubject(newSubject);

            // Reset form
            setNewSubjectTitle("");
            setNumChapters(1);
            setNewChapterNames([""]);
            setIsModalOpen(false);

        } catch (error) {
            console.error("Error adding subject:", error);
            alert("Subject save karne mein problem aayi. Backend check karein!");
        }
    };

    return (
        <>
            <button
                onClick={() => setIsModalOpen(true)}
                className="bg-[#D7BDB0] hover:bg-[#c9aba0] text-white px-5 py-2.5 rounded-lg font-semibold transition-colors shadow-md"
            >
                + Add Subject
            </button>

            {/* Modal / Popup Logic */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-[#F5EBE1] p-7 rounded-2xl shadow-2xl w-[450px] max-w-[90vw] animate-fade-in-up max-h-[90vh] overflow-y-auto">
                        <h2 className="text-2xl font-bold text-slate-800 mb-5">Add New Subject</h2>

                        <form onSubmit={handleFormSubmit} className="flex flex-col gap-5">
                            {/* Subject Title Input */}
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-semibold text-slate-700">Subject Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Biology"
                                    value={newSubjectTitle}
                                    onChange={(e) => setNewSubjectTitle(e.target.value)}
                                    className="w-full p-2.5 rounded-lg border border-[#D6CCC2] bg-white outline-none focus:border-[#D7BDB0]"
                                    required
                                    autoFocus
                                />
                            </div>

                            {/* Number of Chapters Input */}
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-semibold text-slate-700">Number of Chapters</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="15"
                                    value={numChapters}
                                    onChange={handleNumChaptersChange}
                                    className="w-full p-2.5 rounded-lg border border-[#D6CCC2] bg-white outline-none focus:border-[#D7BDB0]"
                                />
                            </div>

                            {/* Dynamic Chapter Name Inputs */}
                            <div className="flex flex-col gap-3 mt-2 border-t border-[#D6CCC2] pt-4">
                                <label className="text-sm font-semibold text-slate-700">Chapter Names</label>
                                {newChapterNames.map((chap, idx) => (
                                    <input
                                        key={idx}
                                        type="text"
                                        placeholder={`Chapter ${idx + 1} Name`}
                                        value={chap}
                                        onChange={(e) => handleChapterNameChange(idx, e.target.value)}
                                        className="w-full p-2 rounded-lg border border-[#D6CCC2] bg-white/70 outline-none focus:border-[#D7BDB0] focus:bg-white text-sm"
                                        required
                                    />
                                ))}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex justify-end gap-3 mt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200/50 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-[#D7BDB0] hover:bg-[#c9aba0] text-white font-medium rounded-lg transition-colors shadow-sm"
                                >
                                    Save Subject
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

export default New_chapter_button;
