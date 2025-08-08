import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import './App.css';

// Components
import Login from './components/Auth/Login';
import Dashboard from './components/Dashboard/Dashboard';
import StationMap from './components/Stations/StationMap';
import ChargingSession from './components/Charging/ChargingSession';
import Wallet from './components/Wallet/Wallet';
import Profile from './components/Profile/Profile';
import Vehicles from './components/Vehicles/Vehicles';
import Navigation from './components/Navigation/Navigation';
import LoadingSpinner from './components/Common/LoadingSpinner';

// Context
import { AuthProvider, useAuth } from './contexts/AuthContext';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <AppContent />
        </div>
      </Router>
    </AuthProvider>
  );
}

function AppContent() {
  const { user, loading, login, logout } = useAuth();
  const [currentSession, setCurrentSession] = useState(null);

  useEffect(() => {
    if (user) {
      fetchCurrentSession();
    }
  }, [user]);

  const fetchCurrentSession = async () => {
    try {
      const response = await axios.get('/api/charging/current', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setCurrentSession(response.data.session);
    } catch (error) {
      console.error('Error fetching current session:', error);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Login onLogin={login} />;
  }

  return (
    <div className="app-container">
      <Navigation user={user} onLogout={logout} currentSession={currentSession} />
      
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard user={user} />} />
          <Route path="/stations" element={<StationMap user={user} />} />
          <Route 
            path="/charging" 
            element={
              <ChargingSession 
                user={user} 
                currentSession={currentSession}
                onSessionUpdate={fetchCurrentSession}
              />
            } 
          />
          <Route path="/wallet" element={<Wallet user={user} />} />
          <Route path="/vehicles" element={<Vehicles user={user} />} />
          <Route path="/profile" element={<Profile user={user} />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
