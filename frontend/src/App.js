import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Context Providers
import { AuthProvider } from './contexts/AuthContext';

// Utilities
import { initializeAccessibleNotifications } from './utils/accessibleNotifications';

// Layout Components
import AppLayout from './components/layout/AppLayout';

// Components
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './components/LoginPage';
import ProfilePage from './components/ProfilePage';

// Pages
import Dashboard from './Dashboard';
import TasksPage from './pages/TasksPage';
import AdminPanel from './pages/AdminPanel';
import ManagerPanel from './pages/ManagerPanel';
import NotificationsPage from './pages/NotificationsPage';
import AuditLogViewer from './components/admin/AuditLogViewer';
import TeamManagement from './components/admin/TeamManagement';

// Import global styles
import './styles/globals.css';

const App = () => {
  // Initialize accessible notifications system
  useEffect(() => {
    initializeAccessibleNotifications();
  }, []);

  return (
    <AuthProvider>
      <Router>
        <AppLayout>
          <ToastContainer
            position="top-right"
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop={true}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="dark"
            limit={3}
            toastClassName="toast-dark"
          />
          
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            
            {/* Protected Routes */}
            <Route path="/" element={
              <ProtectedRoute>
                <Navigate to="/dashboard" replace />
              </ProtectedRoute>
            } />
            
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/tasks" element={
              <ProtectedRoute>
                <TasksPage />
              </ProtectedRoute>
            } />
            
            <Route path="/profile" element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            } />
            
            <Route path="/notifications" element={
              <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>
            } />
            
            {/* Role-based Routes */}
            <Route path="/teams" element={
              <ProtectedRoute>
                <div className="page-container">
                  <header className="page-header">
                    <h2 className="page-title">👥 Teams</h2>
                  </header>
                  <TeamManagement />
                </div>
              </ProtectedRoute>
            } />
            
            <Route path="/admin" element={
              <ProtectedRoute requiredGlobalRole="admin">
                <AdminPanel />
              </ProtectedRoute>
            } />
            
            <Route path="/manager" element={
              <ProtectedRoute requiredGlobalRole="manager">
                <ManagerPanel />
              </ProtectedRoute>
            } />
            
            <Route path="/audit" element={
              <ProtectedRoute requiredGlobalRole="manager">
                <div className="page-container">
                  <h2 className="page-title">📜 Audit Logs</h2>
                  <AuditLogViewer />
                </div>
              </ProtectedRoute>
            } />
            
            {/* Catch all route */}
            <Route path="*" element={
              <ProtectedRoute>
                <div className="page-container text-center">
                  <h2>404 - Page Not Found</h2>
                  <p>The page you're looking for doesn't exist.</p>
                </div>
              </ProtectedRoute>
            } />
          </Routes>
        </AppLayout>
      </Router>
    </AuthProvider>
  );
};

export default App;