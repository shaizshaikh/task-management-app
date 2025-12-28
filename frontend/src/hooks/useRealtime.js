/**
 * React Hook for RBAC-Aware Real-Time Notifications
 * Easy integration with React components
 */

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import realtimeClient from '../services/realtimeClient';

export const useRealtime = (options = {}) => {
  const { user, keycloak } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState({
    connected: false,
    connecting: false,
    error: null
  });
  const [notificationScope, setNotificationScope] = useState(null);
  const [connectionStats, setConnectionStats] = useState(null);

  // Connect to real-time service when user is authenticated
  useEffect(() => {
    if (user && keycloak?.token) {
      setConnectionStatus(prev => ({ ...prev, connecting: true }));
      
      try {
        realtimeClient.connect(user, keycloak.token);
        
        // Setup connection event handlers
        const handleConnected = (data) => {
          setConnectionStatus({
            connected: true,
            connecting: false,
            error: null
          });
          setNotificationScope(data.scope);
        };

        const handleDisconnected = () => {
          setConnectionStatus({
            connected: false,
            connecting: false,
            error: 'Connection lost'
          });
          setNotificationScope(null);
        };

        const handleConnectionStats = (stats) => {
          setConnectionStats(stats);
        };

        realtimeClient.on('connected', handleConnected);
        realtimeClient.on('disconnected', handleDisconnected);
        realtimeClient.on('connectionStats', handleConnectionStats);

        return () => {
          realtimeClient.off('connected', handleConnected);
          realtimeClient.off('disconnected', handleDisconnected);
          realtimeClient.off('connectionStats', handleConnectionStats);
        };
      } catch (error) {
        setConnectionStatus({
          connected: false,
          connecting: false,
          error: error.message
        });
      }
    }

    return () => {
      if (!user) {
        realtimeClient.disconnect();
        setConnectionStatus({
          connected: false,
          connecting: false,
          error: null
        });
        setNotificationScope(null);
      }
    };
  }, [user, keycloak?.token]);

  // Subscribe to specific events
  const subscribe = useCallback((eventName, handler) => {
    realtimeClient.on(eventName, handler);
    
    return () => {
      realtimeClient.off(eventName, handler);
    };
  }, []);

  // Request connection stats (admin only)
  const requestStats = useCallback(() => {
    realtimeClient.requestConnectionStats();
  }, []);

  return {
    // Connection status
    isConnected: connectionStatus.connected,
    isConnecting: connectionStatus.connecting,
    connectionError: connectionStatus.error,
    
    // Notification scope
    notificationScope,
    
    // Connection statistics (admin only)
    connectionStats,
    
    // Methods
    subscribe,
    requestStats,
    
    // Direct access to client
    client: realtimeClient
  };
};

// Specialized hooks for common use cases

/**
 * Hook for task-related real-time updates
 */
export const useTaskRealtime = (onTaskUpdate) => {
  const { subscribe } = useRealtime();

  useEffect(() => {
    const unsubscribeCreated = subscribe('taskCreated', (notification) => {
      onTaskUpdate?.('created', notification);
    });

    const unsubscribeUpdated = subscribe('taskUpdated', (notification) => {
      onTaskUpdate?.('updated', notification);
    });

    const unsubscribeDeleted = subscribe('taskDeleted', (notification) => {
      onTaskUpdate?.('deleted', notification);
    });

    const unsubscribeComment = subscribe('commentAdded', (notification) => {
      onTaskUpdate?.('comment', notification);
    });

    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
      unsubscribeDeleted();
      unsubscribeComment();
    };
  }, [subscribe, onTaskUpdate]);
};

/**
 * Hook for team-related real-time updates
 */
export const useTeamRealtime = (onTeamUpdate) => {
  const { subscribe } = useRealtime();

  useEffect(() => {
    const unsubscribeTeam = subscribe('teamUpdated', (notification) => {
      onTeamUpdate?.('updated', notification);
    });

    const unsubscribeMembership = subscribe('teamMembershipUpdated', (notification) => {
      onTeamUpdate?.('membership', notification);
    });

    return () => {
      unsubscribeTeam();
      unsubscribeMembership();
    };
  }, [subscribe, onTeamUpdate]);
};

/**
 * Hook for admin real-time monitoring
 */
export const useAdminRealtime = () => {
  const { subscribe, requestStats, connectionStats } = useRealtime();
  const [systemNotifications, setSystemNotifications] = useState([]);

  useEffect(() => {
    const unsubscribeSystem = subscribe('systemNotification', (notification) => {
      setSystemNotifications(prev => [notification, ...prev.slice(0, 49)]); // Keep last 50
    });

    const unsubscribeUser = subscribe('userUpdated', (notification) => {
      // Handle user updates for admin monitoring
    });

    return () => {
      unsubscribeSystem();
      unsubscribeUser();
    };
  }, [subscribe]);

  // Auto-request stats periodically for admins
  useEffect(() => {
    const interval = setInterval(() => {
      requestStats();
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [requestStats]);

  return {
    systemNotifications,
    connectionStats,
    requestStats
  };
};