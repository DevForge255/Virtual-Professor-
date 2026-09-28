import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const SubjectCard = ({ id, title, chapters, image, icon }) => {
    const navigate = useNavigate();

    return (
        <div className="relative w-full h-[500px] rounded-3xl overflow-hidden group cursor-pointer transition-all duration-300 hover:-translate-y-3 hover:shadow-2xl">
            {/* Background Image */}
            <img
                src={image}
                alt={title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />

            {/* Gradient Overlay for text readability (darker at bottom) */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-90 group-hover:opacity-100 transition-opacity duration-300"></div>

            {/* Content */}
            <div className="absolute bottom-0 left-0 right-0 p-5 flex flex-col gap-3 transform transition-transform duration-300">
                <div className="flex items-center gap-2">
                    <h3 className="text-white text-2xl font-bold m-0">{title}</h3>
                    <span className="text-xl">{icon}</span>
                </div>

                {/* Chapters List */}
                <ul className="m-0 p-0 list-none flex flex-wrap gap-2">
                    {chapters?.map((chapter, idx) => (
                        <li key={idx} className="bg-indigo-50/90 backdrop-blur-sm text-indigo-700 text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                            {chapter}
                        </li>
                    ))}
                </ul>

                {/* Explore Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation(); // Card pe kahin aur click hone se rokte hain
                        navigate(`/explore/${title.toLowerCase().replace(/\s+/g, '-')}`, {
                            state: {
                                subject_id: id,
                                subject_title: title,
                                subject_chapters: chapters
                            }
                        });
                    }}
                    className="mt-1 flex items-center justify-between w-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white py-3 px-4 rounded-xl transition-all duration-300 shadow-lg shadow-indigo-600/30 group/btn"
                >
                    <span className="font-semibold text-sm">Explore Now</span>
                    <svg className="w-5 h-5 transition-transform duration-300 group-hover/btn:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

const Cards = ({ data }) => {
    const scrollContainerRef = useRef(null);

    const scrollLeft = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollBy({ left: -340, behavior: 'smooth' });
        }
    };

    const scrollRight = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollBy({ left: 340, behavior: 'smooth' });
        }
    };

    return (
        <div className="relative group/slider w-full">
            <style>{`
                .hide-scrollbar::-webkit-scrollbar {
                    display: none;
                }
            `}</style>

            {/* Left Arrow */}
            <button
                onClick={scrollLeft}
                className="absolute left-0 top-1/2 -translate-y-1/2 -ml-3 z-10 bg-white/95 backdrop-blur-md p-3 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.15)] text-[#b39586] hover:bg-[#F5EBE1] opacity-0 group-hover/slider:opacity-100 transition-all hover:scale-110 focus:outline-none border border-[#E3D5CA]"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                </svg>
            </button>

            {/* Scrollable Container */}
            <div
                ref={scrollContainerRef}
                className="flex gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-8 pt-4 px-2 hide-scrollbar"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {data.map((item, index) => (
                    // Asli ID ko key bana diya (agar ID na ho toh backup mein index)
                    <div key={item.id || index} className="flex-shrink-0 w-[300px] snap-center">
                        <SubjectCard {...item} />
                    </div>
                ))}
            </div>

            {/* Right Arrow */}
            <button
                onClick={scrollRight}
                className="absolute right-0 top-1/2 -translate-y-1/2 -mr-3 z-10 bg-white/95 backdrop-blur-md p-3 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.15)] text-[#b39586] hover:bg-[#F5EBE1] opacity-0 group-hover/slider:opacity-100 transition-all hover:scale-110 focus:outline-none border border-[#E3D5CA]"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                </svg>
            </button>
        </div>
    );
};

export default Cards;
