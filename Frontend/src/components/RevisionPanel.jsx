import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const RevisionPanel = ({ chapterName, chapterId, onBack }) => {
  const [activeTab, setActiveTab] = useState('mistakes');
  const [revisionData, setRevisionData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedCard, setExpandedCard] = useState(null);
  const { session } = useAuth();

  useEffect(() => {
    if (chapterId) {
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
  }, [chapterId]);

  const tabs = [
    { key: 'mistakes', label: 'Mistakes', icon: '🔴', color: 'rose' },
    { key: 'confusions', label: 'Confusions', icon: '⚠️', color: 'amber' },
    { key: 'weaknesses', label: 'Weaknesses', icon: '📉', color: 'indigo' },
  ];

  const summary = revisionData?.summary || { total_mistakes: 0, total_confusions: 0, total_weaknesses: 0, needs_revision_count: 0 };
  const totalIssues = summary.total_mistakes + summary.total_confusions + summary.total_weaknesses;

  // Progress ring SVG
  const ProgressRing = ({ value, max, color, label, size = 90 }) => {
    const radius = (size - 10) / 2;
    const circumference = 2 * Math.PI * radius;
    const percentage = max > 0 ? (value / max) * 100 : 0;
    const offset = circumference - (percentage / 100) * circumference;
    const colors = {
      rose: { stroke: '#f43f5e', text: '#be123c' },
      amber: { stroke: '#f59e0b', text: '#b45309' },
      indigo: { stroke: '#6366f1', text: '#4338ca' },
    };
    const c = colors[color] || colors.indigo;
    return (
      <div className="flex flex-col items-center gap-1.5">
        <svg width={size} height={size} className="transform -rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth="7" />
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={c.stroke} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
          />
          <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
            className="text-lg font-bold" fill={c.text}
            style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}>
            {value}
          </text>
        </svg>
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
    );
  };

  // Get data for active tab
  const getActiveData = () => {
    if (!revisionData) return [];
    switch (activeTab) {
      case 'mistakes': return revisionData.mistakes || [];
      case 'confusions': return revisionData.confused_topics || [];
      case 'weaknesses': return revisionData.core_weaknesses || [];
      default: return [];
    }
  };

  // Extract topic and description based on tab
  const getFields = (item) => {
    switch (activeTab) {
      case 'mistakes':
        return { topic: item.specific_topic, description: item.mistake };
      case 'confusions':
        return { topic: item.weakness_topic, description: item.confusion };
      case 'weaknesses':
        return { topic: item.topic, description: item.needs_revision ? '🚨 Needs Revision' : '✅ Concept OK' };
      default:
        return { topic: '', description: '' };
    }
  };

  // Get expanded "Why?" content based on tab
  const getWhyContent = (item) => {
    switch (activeTab) {
      case 'mistakes':
        return (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">💬 From Conversation</span>
            <p className="text-sm text-gray-700 italic leading-relaxed">"{item.actual_example_of_conversation}"</p>
          </div>
        );
      case 'confusions':
        return (
          <div className="space-y-3">
            <div className="bg-amber-50/60 rounded-lg p-4 border border-amber-100">
              <span className="text-xs font-semibold text-amber-500 uppercase tracking-wider block mb-2">📝 Justification</span>
              <p className="text-sm text-gray-700 leading-relaxed">{item.justification}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">💬 From Conversation</span>
              <p className="text-sm text-gray-700 italic leading-relaxed">"{item.actual_part_of_conversation}"</p>
            </div>
          </div>
        );
      case 'weaknesses':
        return (
          <div className="space-y-3">
            <div className="bg-indigo-50/60 rounded-lg p-4 border border-indigo-100">
              <span className="text-xs font-semibold text-indigo-500 uppercase tracking-wider block mb-2">🧠 Conceptual Gap</span>
              <p className="text-sm text-gray-700 leading-relaxed">{item.reason_for_weakness}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">🔗 Related Mistakes</span>
              <p className="text-sm text-gray-700 leading-relaxed">{item.related_mistakes}</p>
            </div>
          </div>
        );
      default: return null;
    }
  };

  const activeData = getActiveData();
  const activeColor = tabs.find(t => t.key === activeTab)?.color || 'indigo';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">📝 Revision Analytics</h2>
            <p className="text-sm text-gray-500 mt-0.5">{chapterName}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map(tab => {
          const isActive = activeTab === tab.key;
          const count = tab.key === 'mistakes' ? summary.total_mistakes
            : tab.key === 'confusions' ? summary.total_confusions
            : summary.total_weaknesses;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setExpandedCard(null); }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive
                ? 'bg-white shadow-md border border-gray-200 text-gray-800 scale-105'
                : 'bg-white/40 text-gray-500 hover:bg-white/70 hover:text-gray-700 border border-transparent'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${isActive ? 'bg-gray-100 text-gray-700' : 'bg-gray-200/50 text-gray-400'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-60 gap-3">
          <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-indigo-600 font-medium text-sm animate-pulse">Loading revision data...</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto flex flex-col gap-6">

          {/* Table-like Cards */}
          {activeData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center bg-white rounded-2xl border border-gray-100 shadow-sm">
              <span className="text-5xl mb-3">✨</span>
              <p className="text-gray-400 font-semibold text-lg">No {activeTab} found!</p>
              <p className="text-gray-300 text-sm mt-1">You're doing great in this chapter</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-[1fr_1.5fr_auto] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Topic</span>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {activeTab === 'mistakes' ? 'Mistake' : activeTab === 'confusions' ? 'Confusion' : 'Status'}
                </span>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-center w-16">Details</span>
              </div>

              {/* Table Rows */}
              {activeData.map((item, idx) => {
                const { topic, description } = getFields(item);
                const isExpanded = expandedCard === `${activeTab}-${idx}`;
                const colorMap = { mistakes: 'rose', confusions: 'amber', weaknesses: 'indigo' };
                const c = colorMap[activeTab];

                return (
                  <div key={idx} className="border-b border-gray-50 last:border-b-0">
                    <div className="grid grid-cols-[1fr_1.5fr_auto] gap-4 px-6 py-4 items-center hover:bg-gray-50/50 transition-colors">
                      <div>
                        <h4 className="text-sm font-bold text-gray-800 leading-snug">{topic}</h4>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
                      </div>
                      <div className="flex justify-center w-16">
                        <button
                          onClick={() => setExpandedCard(isExpanded ? null : `${activeTab}-${idx}`)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${isExpanded
                            ? `bg-${c}-100 text-${c}-700 border-${c}-300`
                            : `bg-${c}-50 hover:bg-${c}-100 text-${c}-600 border-${c}-200`
                          }`}
                          style={{
                            backgroundColor: isExpanded
                              ? (c === 'rose' ? '#ffe4e6' : c === 'amber' ? '#fef3c7' : '#e0e7ff')
                              : (c === 'rose' ? '#fff1f2' : c === 'amber' ? '#fffbeb' : '#eef2ff'),
                            color: c === 'rose' ? '#be123c' : c === 'amber' ? '#b45309' : '#4338ca',
                            borderColor: c === 'rose' ? '#fecdd3' : c === 'amber' ? '#fde68a' : '#c7d2fe',
                          }}
                        >
                          {isExpanded ? 'Hide' : 'Why?'}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Why Content */}
                    {isExpanded && (
                      <div className="px-6 pb-4 animate-fade-in">
                        {getWhyContent(item)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Progress Rings Section */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-5">Overview</h3>
            <div className="flex items-center justify-around">
              <ProgressRing value={summary.total_mistakes} max={totalIssues || 1} color="rose" label="Mistakes" />
              <ProgressRing value={summary.total_confusions} max={totalIssues || 1} color="amber" label="Confusions" />
              <ProgressRing value={summary.total_weaknesses} max={totalIssues || 1} color="indigo" label="Weaknesses" />
              {summary.needs_revision_count > 0 && (
                <div className="flex flex-col items-center gap-1.5">
                  <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 text-center">
                    <span className="text-2xl font-bold text-red-600">{summary.needs_revision_count}</span>
                  </div>
                  <span className="text-xs font-medium text-red-400">Needs Revision</span>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};

export default RevisionPanel;
