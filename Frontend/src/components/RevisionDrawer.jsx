import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const RevisionDrawer = ({ isOpen, onClose, chapterName, chapterId }) => {
  const [activeTab, setActiveTab] = useState('mistakes');
  const [revisionData, setRevisionData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedCard, setExpandedCard] = useState(null);
  const { session } = useAuth();

  useEffect(() => {
    if (isOpen && chapterId) {
      const fetchRevision = async () => {
        setLoading(true);
        try {
          const res = await fetch(`http://localhost:8000/api/chapter/${chapterId}/revision`, {
            headers: {
              'Authorization': `Bearer ${session?.access_token}`
            }
          });
          if (res.ok) {
            const data = await res.json();
            setRevisionData(data);
          }
        } catch (err) {
          console.error("Error fetching revision data:", err);
        } finally {
          setLoading(false);
        }
      };
      fetchRevision();
    }
  }, [isOpen, chapterId]);

  if (!isOpen) return null;

  const tabs = [
    { key: 'mistakes', label: 'Mistakes', icon: '🔴', color: 'rose' },
    { key: 'confusions', label: 'Confusions', icon: '⚠️', color: 'amber' },
    { key: 'weaknesses', label: 'Weaknesses', icon: '📉', color: 'indigo' },
  ];

  const summary = revisionData?.summary || { total_mistakes: 0, total_confusions: 0, total_weaknesses: 0, needs_revision_count: 0 };
  const totalIssues = summary.total_mistakes + summary.total_confusions + summary.total_weaknesses;

  // Progress ring SVG helper
  const ProgressRing = ({ value, max, color, label, size = 100 }) => {
    const radius = (size - 12) / 2;
    const circumference = 2 * Math.PI * radius;
    const percentage = max > 0 ? (value / max) * 100 : 0;
    const offset = circumference - (percentage / 100) * circumference;
    const colors = {
      rose: { stroke: '#f43f5e', bg: '#fff1f2', text: '#be123c' },
      amber: { stroke: '#f59e0b', bg: '#fffbeb', text: '#b45309' },
      indigo: { stroke: '#6366f1', bg: '#eef2ff', text: '#4338ca' },
      emerald: { stroke: '#10b981', bg: '#ecfdf5', text: '#065f46' },
    };
    const c = colors[color] || colors.indigo;

    return (
      <div className="flex flex-col items-center gap-2">
        <svg width={size} height={size} className="transform -rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth="8" />
          <circle
            cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={c.stroke} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
          />
          <text
            x={size / 2} y={size / 2}
            textAnchor="middle" dominantBaseline="central"
            className="text-xl font-bold" fill={c.text}
            style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}
          >
            {value}
          </text>
        </svg>
        <span className="text-xs font-medium text-gray-500 text-center">{label}</span>
      </div>
    );
  };

  const renderMistakeCard = (item, idx) => {
    const isExpanded = expandedCard === `mistake-${idx}`;
    return (
      <div key={idx} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-all">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <span className="text-xs font-semibold text-rose-500 uppercase tracking-wider">Topic</span>
            <h4 className="text-base font-bold text-gray-800 mt-1">{item.specific_topic}</h4>
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">{item.mistake}</p>
          </div>
          <button
            onClick={() => setExpandedCard(isExpanded ? null : `mistake-${idx}`)}
            className="ml-3 shrink-0 px-3 py-1.5 text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200 transition-colors"
          >
            {isExpanded ? 'Hide' : 'Why?'}
          </button>
        </div>
        {isExpanded && (
          <div className="mt-4 pt-3 border-t border-gray-100 animate-fade-in">
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <span className="text-xs font-medium text-gray-400 block mb-1">💬 From conversation</span>
              <p className="text-sm text-gray-700 italic leading-relaxed">"{item.actual_example_of_conversation}"</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderConfusionCard = (item, idx) => {
    const isExpanded = expandedCard === `confusion-${idx}`;
    return (
      <div key={idx} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-all">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <span className="text-xs font-semibold text-amber-500 uppercase tracking-wider">Topic</span>
            <h4 className="text-base font-bold text-gray-800 mt-1">{item.weakness_topic}</h4>
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">{item.confusion}</p>
          </div>
          <button
            onClick={() => setExpandedCard(isExpanded ? null : `confusion-${idx}`)}
            className="ml-3 shrink-0 px-3 py-1.5 text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg border border-amber-200 transition-colors"
          >
            {isExpanded ? 'Hide' : 'Why?'}
          </button>
        </div>
        {isExpanded && (
          <div className="mt-4 pt-3 border-t border-gray-100 space-y-3 animate-fade-in">
            <div className="bg-amber-50/50 rounded-lg p-3 border border-amber-100">
              <span className="text-xs font-medium text-amber-500 block mb-1">📝 Justification</span>
              <p className="text-sm text-gray-700 leading-relaxed">{item.justification}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <span className="text-xs font-medium text-gray-400 block mb-1">💬 From conversation</span>
              <p className="text-sm text-gray-700 italic leading-relaxed">"{item.actual_part_of_conversation}"</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderWeaknessCard = (item, idx) => {
    const isExpanded = expandedCard === `weakness-${idx}`;
    return (
      <div key={idx} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-all">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-indigo-500 uppercase tracking-wider">Topic</span>
              {item.needs_revision ? (
                <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full border border-red-200 animate-pulse">
                  🚨 Needs Revision
                </span>
              ) : (
                <span className="text-[10px] font-bold bg-green-100 text-green-600 px-2 py-0.5 rounded-full border border-green-200">
                  ✅ OK
                </span>
              )}
            </div>
            <h4 className="text-base font-bold text-gray-800 mt-1">{item.topic}</h4>
          </div>
          <button
            onClick={() => setExpandedCard(isExpanded ? null : `weakness-${idx}`)}
            className="ml-3 shrink-0 px-3 py-1.5 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg border border-indigo-200 transition-colors"
          >
            {isExpanded ? 'Hide' : 'Why?'}
          </button>
        </div>
        {isExpanded && (
          <div className="mt-4 pt-3 border-t border-gray-100 space-y-3 animate-fade-in">
            <div className="bg-indigo-50/50 rounded-lg p-3 border border-indigo-100">
              <span className="text-xs font-medium text-indigo-500 block mb-1">🧠 Conceptual Gap</span>
              <p className="text-sm text-gray-700 leading-relaxed">{item.reason_for_weakness}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <span className="text-xs font-medium text-gray-400 block mb-1">🔗 Related Mistakes</span>
              <p className="text-sm text-gray-700 leading-relaxed">{item.related_mistakes}</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const getActiveData = () => {
    if (!revisionData) return [];
    switch (activeTab) {
      case 'mistakes': return revisionData.mistakes || [];
      case 'confusions': return revisionData.confused_topics || [];
      case 'weaknesses': return revisionData.core_weaknesses || [];
      default: return [];
    }
  };

  const renderCard = (item, idx) => {
    switch (activeTab) {
      case 'mistakes': return renderMistakeCard(item, idx);
      case 'confusions': return renderConfusionCard(item, idx);
      case 'weaknesses': return renderWeaknessCard(item, idx);
      default: return null;
    }
  };

  const activeData = getActiveData();

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-3xl bg-white z-50 shadow-2xl flex flex-col overflow-hidden animate-slide-in-right">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-white to-gray-50/80">
          <div>
            <h2 className="text-xl font-bold text-gray-800">📝 Revision Analytics</h2>
            <p className="text-sm text-gray-500 mt-0.5">{chapterName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 pb-2 bg-gray-50/50">
          {tabs.map(tab => {
            const isActive = activeTab === tab.key;
            const count = tab.key === 'mistakes' ? summary.total_mistakes
              : tab.key === 'confusions' ? summary.total_confusions
                : summary.total_weaknesses;
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setExpandedCard(null); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive
                  ? `bg-white shadow-sm border border-gray-200 text-gray-800`
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
                  }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-gray-100 text-gray-700' : 'bg-gray-200/50 text-gray-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-60 gap-3">
              <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-indigo-600 font-medium text-sm animate-pulse">Loading revision data...</p>
            </div>
          ) : (
            <div className="flex gap-6 p-6 h-full">
              {/* Left: Cards List */}
              <div className="flex-[3] flex flex-col gap-3 overflow-y-auto pr-2">
                {activeData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-center">
                    <span className="text-4xl mb-3">✨</span>
                    <p className="text-gray-400 font-medium">No {activeTab} found for this chapter!</p>
                    <p className="text-gray-300 text-sm mt-1">Keep up the great work</p>
                  </div>
                ) : (
                  activeData.map((item, idx) => renderCard(item, idx))
                )}
              </div>

              {/* Right: Progress Rings */}
              <div className="flex-[1] flex flex-col gap-6 items-center pt-2">
                <ProgressRing value={summary.total_mistakes} max={totalIssues || 1} color="rose" label="Mistakes" />
                <ProgressRing value={summary.total_confusions} max={totalIssues || 1} color="amber" label="Confusions" />
                <ProgressRing value={summary.total_weaknesses} max={totalIssues || 1} color="indigo" label="Weaknesses" />
                {summary.needs_revision_count > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center w-full mt-2">
                    <span className="text-2xl font-bold text-red-600">{summary.needs_revision_count}</span>
                    <p className="text-xs text-red-500 font-medium mt-1">Topics Need Revision</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.25s ease-out;
        }
      `}</style>
    </>
  );
};

export default RevisionDrawer;
