import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import UploadButton from '../components/UploadButton';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../context/AuthContext';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';

const Study_page = () => {
  const { subjectname, chaptername } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();

  const decodedChapter = decodeURIComponent(chaptername);

  // UI mein accordion effect ke liye state
  const [isOpen, setIsOpen] = useState(true);

  // Chat input ko manage karne ke liye state
  const [chatInput, setChatInput] = useState("");

  // Confusion Mode states
  const [confusionMode, setConfusionMode] = useState(false); // Kya user AI message select karna chahta hai?
  const [selectedContext, setSelectedContext] = useState([]); // Selected AI message snippets (Max 5)

  // Naye Streaming flow ke liye states
  const [loadingStatus, setLoadingStatus] = useState(""); // Jaise "Generating Notes..."
  const [messages, setMessages] = useState([]); // Chat history store karne ke liye array

  // Ref for auto-scrolling to bottom
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom whenever messages array changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loadingStatus]);

  // Jab page load ho toh purani history manga lo
  React.useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoadingStatus("Retrieving chat history...");
        const subName = subjectname.replace('-', ' ');
        const url = `http://localhost:8000/api/chat/history?subject_name=${encodeURIComponent(subName)}&chapter_name=${encodeURIComponent(decodedChapter)}`;
        const res = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.messages && data.messages.length > 0) {
            setMessages(data.messages);
          }
        }
      } catch (err) {
        console.error("Error fetching chat history:", err);
      } finally {
        setLoadingStatus("");
      }
    };
    fetchHistory();
  }, [subjectname, decodedChapter]);

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    const userText = chatInput.trim();
    const contextTexts = selectedContext;
    const isTutorSync = confusionMode; // Save the state before resetting
    setChatInput("");
    setSelectedContext([]);
    setConfusionMode(false);

    // Screen display text (UI only)
    const displayText = contextTexts.length > 0
      ? `📌 Contexts:\n${contextTexts.map(c => `- "${c.substring(0, 100)}${c.length > 100 ? '...' : ''}"`).join('\n')}\n\n${userText}`
      : userText;
    setMessages(prev => [...prev, { role: "user", text: displayText }]);
    setLoadingStatus("Professor is thinking...");

    // Final API Payload text
    let apiMessage = userText;
    if (contextTexts.length > 0) {
      apiMessage = `[CONTEXTS FROM AI RESPONSE]:\n${contextTexts.map(c => `"${c}"`).join('\n')}\n\n[USER QUESTION]: ${userText}`;
    }
    if (isTutorSync) {
      apiMessage = `[CONFUSION]\n${apiMessage}`;
    }

    try {
      const response = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          user_id: session?.user?.id || "",
          subject_name: subjectname.replace('-', ' '),
          chapter_name: decodedChapter,
          message: apiMessage
        })
      });

      if (!response.ok) {
        alert("Error sending message");
        setLoadingStatus("");
        return;
      }

      // Streaming Reader
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
                setLoadingStatus(parsed.message);
              }
              else if (parsed.type === 'chunk') {
                setLoadingStatus("");
                setMessages(prev => {
                  const lastMsg = prev[prev.length - 1];
                  if (lastMsg && lastMsg.role === "ai") {
                    const updated = [...prev];
                    updated[updated.length - 1] = { ...lastMsg, text: lastMsg.text + parsed.text };
                    return updated;
                  } else {
                    return [...prev, { role: "ai", text: parsed.text }];
                  }
                });
              }
              else if (parsed.type === 'done') {
                setLoadingStatus("");
              }
            } catch (e) {
              console.error("Error parsing chat stream JSON", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat API error:", error);
      alert("Network error.");
      setLoadingStatus("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-1 p-5 gap-5 bg-gradient-to-br from-[#EDEEE9] to-[#D6CCC2] overflow-hidden h-full">

      {/* LEFT SECTION - Chapter Info & Mode */}
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
            {subjectname.replace('-', ' ')}
          </h2>
        </div>

        <div className="flex flex-col gap-3">
          <div className="border border-blue-300 rounded-xl overflow-hidden shadow-sm ring-2 ring-blue-100">
            {/* Chapter Name with accordion effect */}
            <div
              onClick={() => setIsOpen(!isOpen)}
              className="bg-blue-50 hover:bg-blue-100 p-4 cursor-pointer flex justify-between items-center transition-colors duration-200"
            >
              <h4 className="text-md font-medium text-blue-900 m-0">{decodedChapter}</h4>
              <svg
                className={`w-5 h-5 text-blue-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Dropdown details - Study Mode */}
            <div
              className={`bg-white overflow-hidden transition-all duration-300 ease-in-out flex flex-col gap-1 ${isOpen ? 'max-h-72 opacity-100 p-2' : 'max-h-0 opacity-0 p-0'
                }`}
            >
              <div className="w-full text-left px-4 py-2.5 rounded-lg bg-blue-100 text-blue-800 font-bold text-sm flex items-center gap-2">
                <span className="text-base">📘</span> Study Mode Active
              </div>

              {/* Upload Button */}
              <div className="mt-4">
                <UploadButton
                  subjectName={subjectname.replace('-', ' ')}
                  chapterName={decodedChapter}
                  onStatusUpdate={(status) => {
                    setLoadingStatus(status);
                    if (status === "Generating Notes...") {
                      setMessages([]); // Purani chat clear karo naye notes pe
                    }
                  }}
                  onChunkReceived={(chunk) => {
                    setLoadingStatus(""); // Chunk aane laga toh loader hatao
                    setMessages(prev => {
                      const lastMsg = prev[prev.length - 1];
                      if (lastMsg && lastMsg.role === "ai") {
                        const updated = [...prev];
                        updated[updated.length - 1] = { ...lastMsg, text: lastMsg.text + chunk };
                        return updated;
                      } else {
                        return [...prev, { role: "ai", text: chunk }];
                      }
                    });
                  }}
                  onStreamDone={() => setLoadingStatus("")}
                  onError={(err) => {
                    alert(err);
                    setLoadingStatus("");
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SECTION - Main Content */}
      <div className="flex-[4] bg-[#F5EBE1] p-8 rounded-xl shadow-xl shadow-[#D7BDB0]/20 flex flex-col gap-4">

        {/* Right Section Header */}
        <div className="flex justify-end w-full">
          {/* Start Lecture button removed based on new automated flow */}
        </div>

        {/* Content Area (Chat History, Loader, etc.) */}
        <div className="flex-1 border-2 border-gray-200 rounded-xl p-6 bg-white/50 overflow-y-auto flex flex-col gap-4">

          {/* Default State */}
          {!loadingStatus && messages.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center opacity-50">
              <span className="text-4xl mb-2">📄</span>
              <p className="text-gray-500 text-lg font-medium">Upload Notes to start your lecture!</p>
            </div>
          )}

          {/* Chat History */}
          {messages.length > 0 && (
            <div className="flex flex-col gap-4 w-full">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col gap-2 p-4 rounded-2xl max-w-[85%] animate-fade-in-up transition-all relative ${msg.role === 'user'
                    ? 'bg-blue-100 self-end shadow-sm border border-blue-200'
                    : 'bg-white self-start shadow-sm border border-indigo-100 group'
                    }`}
                >
                  <div className={`font-bold text-sm flex items-center justify-between ${msg.role === 'user' ? 'text-blue-700 justify-end' : 'text-indigo-700'
                    }`}>
                    <div className="flex items-center gap-2">
                      {msg.role === 'user' ? 'You 👤' : '👨‍🏫 Virtual Professor'}
                    </div>
                    {msg.role === 'ai' && (
                      <button
                        onClick={() => {
                          setSelectedContext(prev => {
                            if (prev.length >= 5) {
                              alert("You can select maximum 5 contexts at a time.");
                              return prev;
                            }
                            return [...prev, msg.text];
                          });
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-2 py-1 rounded-md border border-indigo-200 flex items-center gap-1"
                        title="Use as context for your next question"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        Quote Context
                      </button>
                    )}
                  </div>
                  <div className="text-[15px] whitespace-pre-wrap leading-relaxed text-gray-800 markdown-body">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath, remarkGfm]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {msg.text ? msg.text.replace(/\\\[/g, '$$$$').replace(/\\\]/g, '$$$$').replace(/\\\(/g, '$').replace(/\\\)/g, '$') : ""}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Loader State */}
          {loadingStatus && (
            <div className="flex flex-col items-center justify-center my-4 gap-3 self-start p-4 bg-gray-50 rounded-2xl w-full max-w-[85%]">
              <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-indigo-600 font-semibold animate-pulse text-sm">{loadingStatus}</p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Chat Input Bar */}
        <div className="flex flex-col gap-2">
          {/* Context Chips - Jab AI ka message select kiya ho */}
          {selectedContext.length > 0 && (
            <div className="flex flex-col gap-2">
              {selectedContext.map((ctx, index) => (
                <div key={index} className="flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-xl p-3 text-sm">
                  <span className="text-amber-600 shrink-0 mt-0.5">📌</span>
                  <p className="text-amber-800 flex-1 line-clamp-2 m-0 leading-snug">
                    {ctx.substring(0, 200)}{ctx.length > 200 ? '...' : ''}
                  </p>
                  <button
                    onClick={() => setSelectedContext(prev => prev.filter((_, i) => i !== index))}
                    className="text-amber-500 hover:text-amber-700 shrink-0 font-bold text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}



          <div className="flex items-end gap-2 bg-white p-3 rounded-2xl shadow-sm border border-gray-200 focus-within:ring-2 focus-within:ring-blue-200 transition-all">
            <textarea
              value={chatInput}
              onChange={(e) => {
                setChatInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                  e.target.style.height = "auto";
                }
              }}
              placeholder={selectedContext.length > 0 ? "Type your question about the selected context..." : "✨ Tutor Sync! Padhane ka style change karna ho ya doubt ho toh ❔ dabayein..."}
              rows={1}
              className="flex-1 bg-transparent outline-none px-4 text-gray-700 placeholder-gray-400 resize-none overflow-hidden leading-relaxed"
              style={{ maxHeight: "150px" }}
            />

            {/* Confusion Button - Lower opacity than Send */}
            <button
              onClick={() => setConfusionMode(!confusionMode)}
              className={`p-3 rounded-xl transition-colors flex items-center justify-center shrink-0 border ${confusionMode
                ? 'bg-amber-500 border-amber-600 text-white shadow-md'
                : 'bg-amber-100 hover:bg-amber-200 border-amber-300 text-amber-700 shadow-sm'
                }`}
              title="Tutor Sync: Select AI response to ask doubts or change style"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01" />
                <circle cx="12" cy="12" r="10" strokeWidth="2" />
              </svg>
            </button>

            {/* Send Button */}
            <button
              onClick={() => {
                handleSendMessage();
                const textarea = document.querySelector('textarea');
                if (textarea) textarea.style.height = "auto";
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl transition-colors shadow-md flex items-center justify-center shrink-0"
            >
              <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Study_page;
