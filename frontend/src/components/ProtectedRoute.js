/**
 * Protected Route Component
 * Handles route protection based on authentication and roles
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ 
  children, 
  requireAuth = true, 
  requiredRole = null, 
  requiredGlobalRole = null,
  fallback = null 
}) => {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  // Show loading while authentication is being checked
  if (loading) {
    return (
      <div className="auth-loading auth-loading-fullscreen">
        <div className="auth-loading-text">Checking authentication...</div>
        <div className="auth-loading-spinner"></div>
      </div>
    );
  };

  // Check authentication requirement
  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role requirements
  if (isAuthenticated && user) {
    // Check Keycloak roles
    if (requiredRole && !user.roles?.includes(requiredRole)) {
      return fallback || (
        <div className="auth-error auth-error-fullscreen">
          <h2 className="auth-error-title">Access Denied</h2>
          <p className="auth-error-message">You don't have the required role: {requiredRole}</p>
          <p className="auth-error-message">Your roles: {user.roles?.join(', ') || 'None'}</p>
        </div>
      );
    }

    // Check global roles (from our application)
    if (requiredGlobalRole && user.globalRole !== requiredGlobalRole) {
      // Allow admin to access everything
      if (user.globalRole !== 'admin') {
        return fallback || (
          <div className="auth-error auth-error-fullscreen">
            <h2 className="auth-error-title">Access Denied</h2>
            <p className="auth-error-message">You don't have the required global role: {requiredGlobalRole}</p>
            <p className="auth-error-message">Your global role: {user.globalRole}</p>
          </div>
        );
      }
    }
  }

  return children;
};

export default ProtectedRoute;