import React from 'react';
import { useNavigate } from 'react-router-dom';

const ProgressRing = ({ value, max, color, label, size = 72 }) => {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const offset = circumference - (percentage / 100) * circumference;
  const colors = {
    blue: { stroke: '#3b82f6', text: '#1d4ed8' },
    amber: { stroke: '#f59e0b', text: '#b45309' },
    indigo: { stroke: '#6366f1', text: '#4338ca' },
  };
  const c = colors[color] || colors.blue;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={c.stroke} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
        />
        <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
          fontSize="14" fontWeight="700" fill={c.text}
          style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}>
          {typeof value === 'number' && max === 100 ? `${value}%` : value}
        </text>
      </svg>
      <span className="text-[11px] font-medium text-gray-500 text-center leading-tight">{label}</span>
    </div>
  );
};

const SubjectPerformanceCard = ({ subject }) => {
  const navigate = useNavigate();

  return (
    <div className="bg-white/60 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-white/40 flex flex-col hover:shadow-md transition-all">
      <div className="flex items-center gap-3 mb-5">
        <div className="bg-orange-100 p-3 rounded-xl">
          <span className="text-2xl">📚</span>
        </div>
        <h4 className="text-xl font-bold">{subject.name}</h4>
      </div>
      
      {/* Progress Rings Row */}
      <div className="flex items-center justify-around mb-6 py-2">
        <ProgressRing value={subject.health_score} max={100} color="blue" label="Health Score" />
        <ProgressRing value={subject.total_confused_topics} max={Math.max(subject.total_confused_topics, 5)} color="amber" label="Confused Topics" />
        <ProgressRing value={subject.total_weaknesses} max={Math.max(subject.total_weaknesses, 5)} color="indigo" label="Weaknesses" />
      </div>
      
      <button 
        onClick={() => navigate(`/explore/${subject.name.replace(/\s+/g, '-').toLowerCase()}`, { state: { subject_id: subject.id, subject_title: subject.name } })}
        className="mt-auto w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
      >
        Detailed Analysis of Subject
      </button>
    </div>
  );
};

export default SubjectPerformanceCard;
