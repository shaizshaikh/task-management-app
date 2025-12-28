/**
 * Authentication Context
 * Provides authentication state and methods throughout the app
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import keycloak, { keycloakInitOptions } from '../config/keycloak';
import axios from 'axios';
import { toast } from 'react-toastify';
import realtimeClient from '../services/realtimeClient';

// Configure axios - no baseURL needed since nginx handles /api routing
axios.defaults.timeout = 10000;
axios.defaults.headers.common['Content-Type'] = 'application/json';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [keycloakInstance, setKeycloakInstance] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  // Initialize Keycloak
  useEffect(() => {
    const initKeycloak = async () => {
      try {
        console.log('Initializing Keycloak...');
        const authenticated = await keycloak.init(keycloakInitOptions);
        
        setKeycloakInstance(keycloak);
        setIsAuthenticated(authenticated);

        if (authenticated) {
          console.log('User is authenticated');
          setupAxiosInterceptors();
          await loadUserProfile();
          
          // Set up token refresh
          setupTokenRefresh();
        } else {
          console.log('User is not authenticated');
        }
      } catch (error) {
        console.error('Keycloak initialization failed:', error);
        toast.error('Authentication system initialization failed');
      } finally {
        setLoading(false);
      }
    };

    initKeycloak();
  }, []);

  // Load user profile from backend
  const loadUserProfile = async () => {
    try {
      const response = await axios.get('/api/users/me');
      setUserProfile(response.data.user);
      
      // Set basic user info from Keycloak token
      if (keycloak.tokenParsed) {
        const userData = {
          id: response.data.user.id,
          username: keycloak.tokenParsed.preferred_username,
          email: keycloak.tokenParsed.email,
          name: keycloak.tokenParsed.name || response.data.user.full_name,
          roles: keycloak.tokenParsed.realm_access?.roles || [],
          globalRole: response.data.user.global_role,
          teams: response.data.user.teams || []
        };
        
        setUser(userData);
        
        // Real-time connection will be handled by useRealtime hook
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
      // Don't show error toast here as it might be a permission issue
    }
  };

  // Setup Axios interceptors for authentication
  const setupAxiosInterceptors = () => {
    // Request interceptor to add auth token
    axios.interceptors.request.use(
      (config) => {
        if (keycloak.token) {
          config.headers.Authorization = `Bearer ${keycloak.token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle auth errors
    axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          console.log('Token expired, attempting refresh...');
          try {
            await keycloak.updateToken(30);
            // Retry the original request
            const originalRequest = error.config;
            originalRequest.headers.Authorization = `Bearer ${keycloak.token}`;
            return axios.request(originalRequest);
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
            logout();
            toast.error('Session expired. Please log in again.');
          }
        }
        return Promise.reject(error);
      }
    );
  };

  // Setup automatic token refresh
  const setupTokenRefresh = () => {
    // Refresh token every 5 minutes if it expires in less than 30 seconds
    setInterval(() => {
      keycloak.updateToken(30).then((refreshed) => {
        if (refreshed) {
          console.log('Token refreshed');
        }
      }).catch((error) => {
        console.error('Token refresh failed:', error);
        logout();
      });
    }, 5 * 60 * 1000); // 5 minutes
  };

  // Login function
  const login = () => {
    keycloak.login({
      redirectUri: window.location.origin
    });
  };

  // Logout function
  const logout = () => {
    // Disconnect from real-time notifications
    realtimeClient.disconnect();
    
    setIsAuthenticated(false);
    setUser(null);
    setUserProfile(null);
    keycloak.logout({
      redirectUri: window.location.origin
    });
  };

  // Check if user has specific role
  const hasRole = (role) => {
    return user?.roles?.includes(role) || false;
  };

  // Check if user has global role
  const hasGlobalRole = (globalRole) => {
    return user?.globalRole === globalRole;
  };

  // Check if user is admin
  const isAdmin = () => {
    return hasGlobalRole('admin');
  };

  // Check if user is manager
  const isManager = () => {
    return hasGlobalRole('manager') || hasGlobalRole('admin');
  };

  // Check if user can access team
  const canAccessTeam = (teamId) => {
    if (isAdmin()) return true;
    return user?.teams?.some(team => team.id === teamId) || false;
  };

  // Check if user can manage team
  const canManageTeam = (teamId) => {
    if (isAdmin()) return true;
    return user?.teams?.some(team => 
      team.id === teamId && team.team_role === 'leader'
    ) || false;
  };

  // Get user's team role for specific team
  const getTeamRole = (teamId) => {
    const team = user?.teams?.find(team => team.id === teamId);
    return team?.team_role || null;
  };

  // Refresh user profile
  const refreshProfile = async () => {
    if (isAuthenticated) {
      await loadUserProfile();
    }
  };

  const value = {
    // State
    isAuthenticated,
    user,
    userProfile,
    loading,
    keycloak: keycloakInstance,

    // Methods
    login,
    logout,
    refreshProfile,

    // Permission checks
    hasRole,
    hasGlobalRole,
    isAdmin,
    isManager,
    canAccessTeam,
    canManageTeam,
    getTeamRole
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;