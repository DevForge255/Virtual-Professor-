import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import ChapterPerformanceCard from '../components/ChapterPerformanceCard';
import RevisionPanel from '../components/RevisionPanel';
import UploadPYQButton from '../components/UploadPYQButton';
import { useAuth } from '../context/AuthContext';

const Maths = () => {
    // URL se subject ka param nikal rahe hain (e.g. 'computer-sci')
    const { subject } = useParams();
    const navigate = useNavigate();
    const { session } = useAuth();
    
    // Cards.jsx se bheja gaya parcel (state) yahan receive karte hain
    const location = useLocation();
    const passedData = location.state || {};
    
    // Kaunsa chapter khula hai usko yaad rakhne ke liye state
    const [openChapterName, setOpenChapterName] = useState(null);
    const [subjectData, setSubjectData] = useState(null);
    const [loading, setLoading] = useState(true);

    // Revision Panel states (right section mein dikhane ke liye)
    const [revisionOpen, setRevisionOpen] = useState(false);
    const [revisionChapterName, setRevisionChapterName] = useState('');
    const [revisionChapterId, setRevisionChapterId] = useState(null);
    
    // PYQ Upload status state
    const [pyqStatus, setPyqStatus] = useState('');

    // Agar parcel mein data aaya hai toh wo use karo, nahi toh URL wale naam par default set kar do
    const displayTitle = passedData.subject_title || (subject ? subject.replace('-', ' ') : 'Subject');
    let displayChapters = passedData.subject_chapters || [];

    useEffect(() => {
        const fetchAnalysis = async () => {
            if (!passedData.subject_id) {
                setLoading(false);
                return;
            }
            try {
                const response = await fetch(`http://localhost:8000/api/subject/${passedData.subject_id}/analytics`, {
                    headers: {
                        'Authorization': `Bearer ${session?.access_token}`
                    }
                });
                const json = await response.json();
                setSubjectData(json);
            } catch (error) {
                console.error("Error fetching subject analytics:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchAnalysis();
    }, [passedData.subject_id]);

    // Update display chapters if we fetched them from API and state was empty
    if (displayChapters.length === 0 && subjectData?.chapters) {
        displayChapters = subjectData.chapters.map(c => c.name);
    }

    const handleChapterClick = (chapterName) => {
        if (openChapterName === chapterName) {
            setOpenChapterName(null);
        } else {
            setOpenChapterName(chapterName);
        }
    };

    // Chapter name se chapter ID find karne ka helper
    const getChapterIdByName = (name) => {
        if (!subjectData?.chapters) return null;
        const found = subjectData.chapters.find(c => c.name === name);
        return found ? found.id : null;
    };

    const handleRevisionClick = (chapterName) => {
        const chapId = getChapterIdByName(chapterName);
        setRevisionChapterName(chapterName);
        setRevisionChapterId(chapId);
        setRevisionOpen(true);
    };

    return (
        <div className="flex flex-1 p-5 gap-5 bg-gradient-to-br from-[#EDEEE9] to-[#D6CCC2] overflow-hidden h-full">

            {/* LEFT SECTION - Chapters List Accordion */}
            <div className="flex-[1] bg-[#F5EBE1] p-5 rounded-xl shadow-xl shadow-[#D7BDB0]/20 overflow-y-auto">

                <div className="flex items-center gap-4 border-b border-[#E3D5CA] pb-4 mb-6">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <h2 className="text-2xl font-bold text-gray-800 capitalize">
                        {displayTitle}
                    </h2>
                </div>

                <div className="flex flex-col gap-3">
                    {displayChapters.map((chapter, idx) => (
                        <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                            <div
                                onClick={() => handleChapterClick(chapter)}
                                className="bg-gray-50 hover:bg-gray-100 p-4 cursor-pointer flex justify-between items-center transition-colors duration-200"
                            >
                                <h4 className="text-md font-medium text-gray-800 m-0">{chapter}</h4>
                                <svg
                                    className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${openChapterName === chapter ? 'rotate-180' : ''}`}
                                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>

                            <div
                                className={`bg-white overflow-hidden transition-all duration-300 ease-in-out flex flex-col gap-1 ${openChapterName === chapter ? 'max-h-72 opacity-100 p-2' : 'max-h-0 opacity-0 p-0'
                                    }`}
                            >
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const subjectName = subject || displayTitle.replace(/\s+/g, '-').toLowerCase();
                                        navigate(`/study/${subjectName}/${encodeURIComponent(chapter)}`);
                                    }}
                                    className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-blue-50 text-slate-600 hover:text-blue-700 font-medium transition-all text-sm flex items-center gap-2"
                                >
                                    <span className="text-base">📘</span> Study
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRevisionClick(chapter);
                                    }}
                                    className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-purple-50 text-slate-600 hover:text-purple-700 font-medium transition-all text-sm flex items-center gap-2"
                                >
                                    <span className="text-base">📝</span> Revision
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const subjectName = subject || displayTitle.replace(/\s+/g, '-').toLowerCase();
                                        navigate(`/mock-test/${subjectName}/${encodeURIComponent(chapter)}`);
                                    }}
                                    className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-orange-50 text-slate-600 hover:text-orange-700 font-medium transition-all text-sm flex items-center gap-2"
                                >
                                    <span className="text-base">📝</span> Mock Test
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* RIGHT SECTION - Conditionally show Analytics or Revision */}
            <div className="flex-[4] bg-[#F5EBE1] p-8 rounded-xl shadow-xl shadow-[#D7BDB0]/20 overflow-y-auto">
                {revisionOpen ? (
                    <RevisionPanel
                        chapterName={revisionChapterName}
                        chapterId={revisionChapterId}
                        onBack={() => setRevisionOpen(false)}
                    />
                ) : (
                    <>
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h2 className="text-3xl font-bold text-gray-800 mb-2">Subject Performance: {displayTitle}</h2>
                                <p className="text-gray-600 text-lg">Chapter Performance Cards</p>
                            </div>
                            
                            {/* Naya PYQ Upload Module */}
                            <div className="flex flex-col items-end">
                                <UploadPYQButton 
                                    subjectName={displayTitle}
                                    onStatusUpdate={(msg) => setPyqStatus(msg)}
                                    onStreamDone={() => setPyqStatus('Analysis Complete! ✨')}
                                    onError={(err) => setPyqStatus(`Error: ${err}`)}
                                />
                                {pyqStatus && (
                                    <span className="text-sm font-medium mt-2 text-purple-700 animate-pulse">
                                        {pyqStatus}
                                    </span>
                                )}
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex justify-center items-center h-40">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            </div>
                        ) : !subjectData ? (
                            <div className="flex justify-center items-center h-40">
                                <p className="text-gray-500">No analytics data available for this subject.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                                {subjectData.chapters.map((chap, idx) => (
                                    <ChapterPerformanceCard key={idx} chap={chap} />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

        </div>
    );
};

export default Maths;
