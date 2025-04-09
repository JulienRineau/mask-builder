import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import MaskEditor from './components/MaskEditor';
import './App.css';

function ProtectedRoute({ children }) {
  const isAuthenticated = localStorage.getItem('googleToken');
  return isAuthenticated ? children : <Navigate to="/login" />;
}

function App() {
  const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || ''; // Set in .env file

  return (
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <Router>
        <div className="min-h-screen bg-gray-100">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/editor/:puppetId" element={
              <ProtectedRoute>
                <MaskEditor />
              </ProtectedRoute>
            } />
            <Route path="/" element={<Navigate to="/login" />} />
          </Routes>
        </div>
      </Router>
    </GoogleOAuthProvider>
  );
}

export default App;
