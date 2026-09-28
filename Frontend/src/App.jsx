import React from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Topbar from './components/Topbar'
import MainLayout from './components/MainLayout'
import Maths from './pages/Maths'
import Study_page from './pages/Study_page'
import MockTestPage from './pages/MockTestPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'

const AppContent = () => {
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';

  return (
    <div className="flex flex-col h-screen font-sans m-0 overflow-hidden">
      {!isAuthPage && <Topbar />}

      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* Protected Routes */}
        <Route path="/study/:subjectname/:chaptername" element={
          <ProtectedRoute>
            <Study_page />
          </ProtectedRoute>
        } />
        
        <Route path="/explore/:subject" element={
          <ProtectedRoute>
            <Maths />
          </ProtectedRoute>
        } />

        <Route path="/mock-test/:subject/:chapter" element={
          <ProtectedRoute>
            <MockTestPage />
          </ProtectedRoute>
        } />

        <Route path="*" element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        } />
      </Routes>
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
