import React from 'react';

const ChapterPerformanceCard = ({ chap }) => {
  let badgeColor = "bg-green-100 text-green-700";
  let ringColor = "border-green-400";
  
  if (chap.level === "Not Started") {
      badgeColor = "bg-gray-100 text-gray-700";
      ringColor = "border-gray-300";
  } else if (chap.level === "Moderate") {
      badgeColor = "bg-yellow-100 text-yellow-700";
      ringColor = "border-yellow-400";
  } else if (chap.level === "Weak") {
      badgeColor = "bg-red-100 text-red-700";
      ringColor = "border-red-400";
  }

  return (
    <div className="bg-[#FAF6F0] p-6 rounded-2xl shadow-sm border border-[#E8DCCB] hover:shadow-md transition-all flex flex-col">
        <div className="flex justify-between items-start mb-6">
            <div>
                <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">Chapter Title</p>
                <h4 className="text-lg font-bold text-gray-800 line-clamp-2 pr-2">{chap.name}</h4>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${badgeColor}`}>
                {chap.level}
            </span>
        </div>

        <div className="flex items-center justify-between mb-8">
            <div className={`w-16 h-16 rounded-full border-8 ${ringColor} opacity-80 flex items-center justify-center`}>
            </div>
            <div className="text-right">
                <p className="text-2xl font-bold text-gray-800">
                    {chap.level === "Not Started" ? "N/A" : chap.level === "Strong" ? "90%+" : chap.level === "Moderate" ? "50-80%" : "<50%"}
                </p>
                <p className="text-sm text-gray-500">mastery</p>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-auto border-t border-[#E8DCCB] pt-4">
            <div>
                <p className="text-xs text-gray-500 mb-1">Total Mistakes</p>
                <p className="font-semibold text-gray-800 flex items-center gap-2">
                    <span className="text-red-400">×</span> {chap.total_mistakes}
                </p>
            </div>
            <div>
                <p className="text-xs text-gray-500 mb-1">Weak Topics</p>
                <div className="font-semibold text-gray-800 text-sm flex items-start gap-2 max-h-16 overflow-y-auto">
                    <span className="text-gray-400 mt-1">☷</span> 
                    <span className="line-clamp-2">
                        {chap.weak_topics.join(', ')}
                    </span>
                </div>
            </div>
        </div>
    </div>
  );
};

export default ChapterPerformanceCard;
