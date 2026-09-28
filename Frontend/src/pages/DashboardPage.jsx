import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SubjectPerformanceCard from '../components/SubjectPerformanceCard';
import { useAuth } from '../context/AuthContext';

const DashboardPage = () => {
  const [dashboardData, setDashboardData] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { session } = useAuth();

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await fetch("http://localhost:8000/api/dashboard", {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`
          }
        });
        const json = await response.json();
        setDashboardData(json.subjects || []);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  return (
    <div className="flex flex-col h-full text-slate-800 p-2">
      <h2 className="text-3xl font-bold text-gray-800 mb-2">Dashboard Section</h2>
      <p className="text-gray-500 mb-8">Welcome back! Start your learning journey.</p>
      
      <h3 className="text-xl font-semibold mb-4">Subject Performance Cards</h3>
      
      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dashboardData.map((subject) => (
            <SubjectPerformanceCard key={subject.id} subject={subject} />
          ))}
          {dashboardData.length === 0 && (
            <div className="text-gray-500 col-span-full">No subjects found. Add a subject in Tutor Mode.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
