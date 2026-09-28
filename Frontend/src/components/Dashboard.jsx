import React from 'react';

const DashboardButton = ({ onClick, isActive }) => {
    return (
        <button
            className={`flex items-center gap-3 py-3 px-5 text-base font-semibold border-none rounded-xl cursor-pointer transition-all duration-300 w-full ${
                isActive 
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                    : 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800'
            }`}
            onClick={onClick}
        >
            <span className="text-xl">📊</span>
            Dashboard
        </button>
    );
};

export default DashboardButton;
