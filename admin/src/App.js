import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout, ConfigProvider } from 'antd';
import thTH from 'antd/locale/th_TH';
import axios from 'axios';
import './App.css';

// Components
import Login from './components/Auth/Login';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import Dashboard from './components/Dashboard/Dashboard';
import PaymentManager from './components/Payment/PaymentManager';
import ChargerManager from './components/Charger/ChargerManager';
import EnergyManager from './components/Energy/EnergyManager';
import UserManager from './components/User/UserManager';
import OverviewManager from './components/Overview/OverviewManager';
import LoadingSpinner from './components/Common/LoadingSpinner';

// Context
import { AuthProvider, useAuth } from './contexts/AuthContext';

const { Content } = Layout;

function App() {
  return (
    <ConfigProvider locale={thTH}>
      <AuthProvider>
        <Router>
          <div className="App">
            <AppContent />
          </div>
        </Router>
      </AuthProvider>
    </ConfigProvider>
  );
}

function AppContent() {
  const { user, loading, login, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Login onLogin={login} />;
  }

  // Check if user has admin or service role
  if (!['admin', 'service'].includes(user.role)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-bold text-red-600 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
          <p className="text-gray-600">คุณไม่มีสิทธิ์เข้าถึงระบบจัดการ</p>
          <button 
            onClick={logout}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            ออกจากระบบ
          </button>
        </div>
      </div>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar 
        collapsed={collapsed} 
        user={user}
        onLogout={logout}
      />
      
      <Layout>
        <Header 
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          user={user}
          onLogout={logout}
        />
        
        <Content style={{ margin: '16px' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard user={user} />} />
            <Route path="/payment" element={<PaymentManager user={user} />} />
            <Route path="/charger" element={<ChargerManager user={user} />} />
            <Route path="/energy" element={<EnergyManager user={user} />} />
            <Route path="/user" element={<UserManager user={user} />} />
            <Route path="/overview" element={<OverviewManager user={user} />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
