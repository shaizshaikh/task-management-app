/**
 * RBAC-Aware Real-Time Client
 * Enhanced WebSocket client with role-based notification handling
 */

import io from 'socket.io-client';
import { toast } from 'react-toastify';

class RealtimeClient {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.user = null;
    this.notificationScope = null;
    this.eventHandlers = new Map();
    this.connectionStats = null;
    this.isConnecting = false;
    this.eventListenersSetup = false;
    this.processedEvents = new Set(); // For event deduplication
    this.eventCleanupInterval = null;
  }

  /**
   * Connect to WebSocket server with authentication
   */
  connect(user, token) {
    // Prevent multiple connections
    if (this.isConnecting) {
      console.log('🔌 Connection already in progress, skipping...');
      return this.socket;
    }

    if (this.socket && this.isConnected && this.user?.id === user?.id) {
      console.log('🔌 Already connected for this user, skipping...');
      return this.socket;
    }

    this.isConnecting = true;

    if (this.socket) {
      this.disconnect();
    }

    this.user = user;
    
    try {
      // Create socket connection - use nginx proxy path
      const socketUrl = process.env.REACT_APP_WS_URL || `${window.location.protocol}//${window.location.host}`;
      
      this.socket = io(socketUrl, {
        path: '/socket.io/',
        transports: ['polling', 'websocket'], // Try polling first, then websocket
        timeout: 5000,
        forceNew: true,
        auth: {
          token: token
        }
      });
    } catch (error) {
      console.error('🔌 Failed to create WebSocket connection:', error);
      this.isConnecting = false;
      return null;
    }

    // Only setup event handlers once
    if (!this.eventListenersSetup && this.socket) {
      try {
        this.setupEventHandlers();
        this.eventListenersSetup = true;
      } catch (error) {
        console.error('🔌 Failed to setup event handlers:', error);
      }
    }
    
    // Authenticate after connection
    if (this.socket) {
      this.socket.on('connect', () => {
        console.log('🔌 Connected to WebSocket server');
        this.socket.emit('authenticate', { token });
        this.isConnecting = false;
      });

      this.socket.on('connect_error', (error) => {
        console.warn('🔌 WebSocket connection failed (non-critical):', error.message);
        this.isConnecting = false;
      });
    }

    return this.socket;
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    if (this.socket) {
      // Clean up event listeners
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.isConnecting = false;
      this.notificationScope = null;
      this.eventListenersSetup = false;
      
      // Clear processed events
      this.processedEvents.clear();
      
      console.log('🔌 Disconnected from WebSocket server');
    }
  }

  /**
   * Setup core event handlers
   */
  setupEventHandlers() {
    // Connection established with scope info
    this.socket.on('connectionEstablished', (data) => {
      this.isConnected = true;
      this.notificationScope = data.scope;
      console.log('✅ Real-time notifications active:', data.scope);
      
      // Use accessible notification instead of toast
      const { announceConnectionStatus } = require('../utils/accessibleNotifications');
      announceConnectionStatus('connected', this.user.global_role);

      // Trigger connection callback
      this.triggerEvent('connected', data);
    });

    // Connection lost
    this.socket.on('disconnect', () => {
      this.isConnected = false;
      console.log('❌ Real-time connection lost');
      
      // Use accessible notification instead of toast
      const { announceConnectionStatus } = require('../utils/accessibleNotifications');
      announceConnectionStatus('disconnected', this.user.global_role);

      this.triggerEvent('disconnected');
    });

    // Health updates
    this.socket.on('healthUpdate', (data) => {
      console.log('🏥 System health update:', data);
      this.triggerEvent('healthUpdate', data);
    });

    // Task-related events
    this.setupTaskEventHandlers();
    
    // Team-related events
    this.setupTeamEventHandlers();
    
    // User-related events
    this.setupUserEventHandlers();
    
    // System events (admin only)
    this.setupSystemEventHandlers();
    
    // Debug: Test message listener
    this.socket.on('testMessage', (data) => {
      console.log('🧪 [DEBUG] Test message received:', data);
    });
  }

  /**
   * Setup task-related event handlers
   */
  setupTaskEventHandlers() {
    // Task created
    this.socket.on('taskCreated', (notification) => {
      console.log('📝 [REALTIME] Task created event received:', {
        taskId: notification.task?.id,
        taskTitle: notification.task?.title,
        eventId: notification.event_id,
        user: this.user?.username
      });
      
      const message = this.formatTaskNotification(notification, 'created');
      this.showNotification(message, 'success', notification);
      
      this.triggerEvent('taskCreated', notification);
    });

    // Task updated
    this.socket.on('taskUpdated', (notification) => {
      console.log('📝 [REALTIME] Task updated event received:', {
        taskId: notification.task?.id,
        taskTitle: notification.task?.title,
        eventId: notification.event_id,
        user: this.user?.username
      });
      
      const message = this.formatTaskNotification(notification, 'updated');
      this.showNotification(message, 'info', notification);
      
      this.triggerEvent('taskUpdated', notification);
    });

    // Task deleted
    this.socket.on('taskDeleted', (notification) => {
      console.log('📝 [REALTIME] Task deleted event received:', {
        taskId: notification.task?.id,
        taskTitle: notification.task?.title,
        eventId: notification.event_id,
        user: this.user?.username
      });
      
      const message = this.formatTaskNotification(notification, 'deleted');
      this.showNotification(message, 'warning', notification);
      
      this.triggerEvent('taskDeleted', notification);
    });

    // Comment added
    this.socket.on('comment_added', (notification) => {
      console.log('💬 Comment added:', notification);
      
      const message = `💬 ${notification.commenter.username} commented on "${notification.comment?.task_title || 'a task'}"`;
      this.showNotification(message, 'info', notification);
      
      this.triggerEvent('commentAdded', notification);
    });
  }

  /**
   * Setup team-related event handlers
   */
  setupTeamEventHandlers() {
    this.socket.on('teamUpdated', (notification) => {
      console.log('👥 Team updated:', notification);
      
      let message = `👥 Team update: ${notification.updateType}`;
      if (notification.data?.team_name) {
        message += ` in ${notification.data.team_name}`;
      }
      
      this.showNotification(message, 'info', notification);
      this.triggerEvent('teamUpdated', notification);
    });

    this.socket.on('team_membership_updated', (notification) => {
      console.log('👥 Team membership updated:', notification);
      
      const message = `👥 Team membership changed in your team`;
      this.showNotification(message, 'info', notification);
      
      this.triggerEvent('teamMembershipUpdated', notification);
    });
  }

  /**
   * Setup user-related event handlers
   */
  setupUserEventHandlers() {
    this.socket.on('userUpdated', (notification) => {
      console.log('👤 User updated:', notification);
      
      // Only show notifications for significant user changes
      if (['created', 'deleted', 'role_changed'].includes(notification.updateType)) {
        const message = `👤 User ${notification.updateType}: ${notification.user.username || 'Unknown'}`;
        this.showNotification(message, 'info', notification);
      }
      
      this.triggerEvent('userUpdated', notification);
    });
  }

  /**
   * Setup system event handlers (admin only)
   */
  setupSystemEventHandlers() {
    this.socket.on('system_notification', (notification) => {
      console.log('🔔 System notification:', notification);
      
      const level = notification.level === 'error' ? 'error' : 
                   notification.level === 'warning' ? 'warning' : 'info';
      
      toast[level](`🔔 System: ${notification.message}`, {
        position: 'top-center',
        autoClose: notification.level === 'error' ? false : 8000
      });
      
      this.triggerEvent('systemNotification', notification);
    });

    // Connection statistics (admin only)
    this.socket.on('connectionStats', (stats) => {
      this.connectionStats = stats;
      this.triggerEvent('connectionStats', stats);
    });
  }

  /**
   * Format task notification message based on user's relationship to the task
   */
  formatTaskNotification(notification, action) {
    const task = notification.task;
    const isPersonal = notification.personal;
    const relevance = notification.relevance;
    
    let prefix = '';
    let suffix = '';
    
    // Customize message based on relevance
    switch (relevance) {
      case 'personal_assignment':
        prefix = '🎯 ';
        suffix = ' (assigned to you)';
        break;
      case 'team_management':
        prefix = '👑 ';
        suffix = ' (in your managed team)';
        break;
      case 'team_collaboration':
        prefix = '👥 ';
        suffix = ' (in your team)';
        break;
      case 'system_oversight':
        prefix = '🔍 ';
        suffix = ' (system-wide)';
        break;
      default:
        prefix = '📝 ';
    }
    
    const actor = notification.creator || notification.updater || notification.deleter;
    const actorName = actor?.username || 'Someone';
    
    return `${prefix}${actorName} ${action} task "${task.title}"${suffix}`;
  }

  /**
   * Show notification with appropriate styling
   */
  showNotification(message, type = 'info', data = null) {
    const options = {
      position: 'bottom-right',
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true
    };

    // Customize based on personal relevance
    if (data?.personal) {
      options.position = 'top-right';
      options.autoClose = 8000;
      options.className = 'personal-notification';
    }

    toast[type](message, options);
  }

  /**
   * Register event handler
   */
  on(eventName, handler) {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, new Set());
    }
    this.eventHandlers.get(eventName).add(handler);
  }

  /**
   * Unregister event handler
   */
  off(eventName, handler) {
    const handlers = this.eventHandlers.get(eventName);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Generate event ID for deduplication
   */
  generateEventId(eventName, data) {
    const timestamp = data?.timestamp || new Date().toISOString();
    // Handle different event data structures
    const taskId = data?.task?.id || data?.comment?.task_id || data?.id || 'unknown';
    const userId = data?.creator?.id || data?.updater?.id || data?.deleter?.id || 
                   data?.commenter?.id || data?.comment?.user_id || 'unknown';
    const commentId = data?.comment?.id || '';
    
    // Include comment ID for comment events to make them unique
    return `${eventName}-${taskId}-${userId}-${commentId}-${timestamp}`;
  }

  /**
   * Check if event was already processed (deduplication)
   */
  isEventProcessed(eventId) {
    if (this.processedEvents.has(eventId)) {
      return true;
    }
    
    // Add to processed events
    this.processedEvents.add(eventId);
    
    // Clean up old events (keep only last 100)
    if (this.processedEvents.size > 100) {
      const eventsArray = Array.from(this.processedEvents);
      this.processedEvents.clear();
      eventsArray.slice(-50).forEach(id => this.processedEvents.add(id));
    }
    
    return false;
  }

  /**
   * Trigger custom event handlers with deduplication
   */
  triggerEvent(eventName, data = null) {
    // Skip deduplication for connection events
    if (!['connected', 'disconnected', 'healthUpdate'].includes(eventName)) {
      const eventId = this.generateEventId(eventName, data);
      console.log(`📨 [${this.user?.username}] Received ${eventName}:`, {
        eventId,
        taskId: data?.task?.id,
        updater: data?.updater?.username,
        deleter: data?.deleter?.username
      });
      
      if (this.isEventProcessed(eventId)) {
        console.log(`🔄 Duplicate event ignored: ${eventName} (${eventId})`);
        return;
      }
      
      console.log(`✅ [${this.user?.username}] Processing ${eventName}`);
    }

    const handlers = this.eventHandlers.get(eventName);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${eventName}:`, error);
        }
      });
    }
  }

  /**
   * Request connection statistics (admin only)
   */
  requestConnectionStats() {
    if (this.socket && this.user?.global_role === 'admin') {
      this.socket.emit('getConnectionStats');
    }
  }

  /**
   * Get current notification scope
   */
  getNotificationScope() {
    return this.notificationScope;
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      user: this.user,
      scope: this.notificationScope,
      stats: this.connectionStats
    };
  }

  /**
   * Test broadcast (for debugging)
   */
  testBroadcast() {
    if (this.socket && this.isConnected) {
      console.log('🧪 [DEBUG] Sending test broadcast...');
      this.socket.emit('testBroadcast');
    } else {
      console.log('❌ [DEBUG] Not connected, cannot send test broadcast');
    }
  }
}

// Create singleton instance
const realtimeClient = new RealtimeClient();

export default realtimeClient;