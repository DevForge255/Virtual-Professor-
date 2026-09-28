import React from 'react';
import { useAuth } from '../context/AuthContext';

const Topbar = () => {
    const { user, logout } = useAuth();
    
    // Safely get user's name or fallback
    const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Student';

    return (
        <header className="flex justify-between items-center px-6 py-2.5 bg-[#F5EBE1] shadow-[0_2px_10px_rgba(0,0,0,0.05)] sticky top-0 z-50 border-b border-[#E3D5CA]">
            <div className="flex items-center">
                <h2 className="m-0 text-xl font-bold bg-gradient-to-r from-[#b39586] to-[#8c7468] bg-clip-text text-transparent">Virtual Professor</h2>
            </div>
            
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 py-1 px-2 rounded-full transition-colors duration-200 hover:bg-[#E3D5CA]">
                    <span className="text-[15px] font-medium text-[#444] capitalize">{userName}</span>
                    <img
                        src={`https://ui-avatars.com/api/?name=${userName}&background=0D8ABC&color=fff&rounded=true`}
                        alt="Profile"
                        className="w-9 h-9 rounded-full object-cover border-2 border-[#e0e0e0]"
                    />
                </div>
                
                <button 
                    onClick={logout}
                    className="text-sm font-medium text-gray-500 hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50"
                >
                    Logout
                </button>
            </div>
        </header>
    );
};

export default Topbar;
