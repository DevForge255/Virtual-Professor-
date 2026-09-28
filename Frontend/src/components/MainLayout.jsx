import React from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import DashboardButton from './Dashboard';
import TutorModeButton from './Tutor_mode';
import TutorModePage from '../pages/TutorModePage';
import DashboardPage from '../pages/DashboardPage';

const MainLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <div className="flex flex-1 p-5 gap-5 bg-gradient-to-br from-[#EDEEE9] to-[#D6CCC2] overflow-hidden">
            {/* Left Section - takes 1 part */}
            <div className="flex-1 bg-[#F5EBE1] p-5 rounded-xl shadow-xl shadow-[#D7BDB0]/20 overflow-y-auto">
                <div className="flex flex-col gap-2">
                    <DashboardButton onClick={() => navigate('/')} isActive={location.pathname === '/'} />
                    <TutorModeButton onClick={() => navigate('/tutormode')} isActive={location.pathname === '/tutormode'} />
                </div>
            </div>

            {/* Right Section - takes 4 parts */}
            <div className="flex-[4] bg-[#F5EBE1] p-6 rounded-xl shadow-xl shadow-[#D7BDB0]/20 overflow-y-auto">
                <Routes>
                    {/* Pehla route (Default ya Dashboard ke liye) */}
                    <Route path="/" element={<DashboardPage />} />

                    {/* Doosra route (Tutor Mode jahan cards dikhenge) */}
                    <Route path="/tutormode" element={<TutorModePage />} />
                </Routes>
            </div>
        </div>
    );
};

export default MainLayout;
