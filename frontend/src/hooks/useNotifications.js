/**
 * Real Notifications Hook with Caching
 * Manages user notifications with localStorage caching and real-time updates
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRealtime } from './useRealtime';
import { announceNotification } from '../utils/accessibleNotifications';

const CACHE_KEY = 'task_management_notifications';
const MAX_NOTIFICATIONS = 50;

export const useNotifications = () => {
  const { user } = useAuth();
  const { subscribe } = useRealtime();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Load notifications from cache on mount
  useEffect(() => {
    if (user?.id) {
      loadNotificationsFromCache();
    }
  }, [user?.id]);

  // Save notifications to cache whenever they change
  useEffect(() => {
    if (user?.id && notifications.length > 0) {
      saveNotificationsToCache();
    }
  }, [notifications, user?.id]);

  // Calculate unread count
  useEffect(() => {
    const unread = notifications.filter(n => !n.read).length;
    setUnreadCount(unread);
  }, [notifications]);

  // Load from localStorage
  const loadNotificationsFromCache = () => {
    try {
      const cached = localStorage.getItem(`${CACHE_KEY}_${user.id}`);
      if (cached) {
        const parsedNotifications = JSON.parse(cached);
        setNotifications(parsedNotifications);
      }
    } catch (error) {
      console.error('Error loading notifications from cache:', error);
    }
  };

  // Save to localStorage
  const saveNotificationsToCache = () => {
    try {
      localStorage.setItem(`${CACHE_KEY}_${user.id}`, JSON.stringify(notifications));
    } catch (error) {
      console.error('Error saving notifications to cache:', error);
    }
  };

  // Add new notification
  const addNotification = useCallback((notification) => {
    const newNotification = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      read: false,
      ...notification
    };

    setNotifications(prev => {
      const updated = [newNotification, ...prev];
      // Keep only the latest MAX_NOTIFICATIONS
      return updated.slice(0, MAX_NOTIFICATIONS);
    });

    // Announce notification to screen readers
    announceNotification(newNotification);
  }, []);

  // Mark notification as read
  const markAsRead = useCallback((notificationId) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => 
      prev.map(n => ({ ...n, read: true }))
    );
  }, []);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
    if (user?.id) {
      localStorage.removeItem(`${CACHE_KEY}_${user.id}`);
    }
  }, [user?.id]);

  // Clear notifications on logout
  const clearOnLogout = useCallback(() => {
    if (user?.id) {
      localStorage.removeItem(`${CACHE_KEY}_${user.id}`);
    }
    setNotifications([]);
    setUnreadCount(0);
  }, [user?.id]);

  // Real-time notification listeners
  useEffect(() => {
    if (!user?.id) return;

    // Task-related notifications
    const unsubscribeTaskCreated = subscribe('taskCreated', (data) => {
      console.log('Task created event received:', {
        taskId: data.task.id,
        taskTitle: data.task.title,
        creatorId: data.creator?.id,
        assignedTo: data.task.assigned_to,
        teamId: data.task.team_id,
        userId: user.id,
        userTeams: user.teams
      });

      // Don't notify the creator themselves
      if (data.creator?.id === user.id) {
        console.log('Skipping notification - user is the creator');
        return;
      }

      if (data.task.assigned_to === user.id) {
        console.log('Adding task assigned notification');
        addNotification({
          type: 'task_assigned',
          title: 'New task assigned to you',
          message: `Task "${data.task.title}" has been assigned to you`,
          icon: 'Task',
          priority: 'normal',
          actionUrl: `/tasks`,
          metadata: { taskId: data.task.id }
        });
      } else if (data.task.team_id && user.teams?.some(t => t.id === data.task.team_id)) {
        console.log('Adding team task notification');
        addNotification({
          type: 'task_created',
          title: 'New task in your team',
          message: `Task "${data.task.title}" was created in ${data.task.team_name}`,
          icon: '📝',
          priority: 'low',
          actionUrl: `/tasks`,
          metadata: { taskId: data.task.id }
        });
      } else {
        console.log('🔔 Task created but no notification criteria met');
      }
    });

    const unsubscribeTaskUpdated = subscribe('taskUpdated', (data) => {
      console.log('🔔 Task updated event:', {
        taskId: data.task.id,
        currentUserId: user.id,
        taskCreatedBy: data.task.created_by,
        updaterId: data.updater?.id,
        newAssignedTo: data.task.assigned_to,
        oldAssignedTo: data.previousData?.assigned_to,
        newStatus: data.task.status,
        oldStatus: data.previousData?.status
      });

      // Notify if task was just assigned to this user
      if (data.task.assigned_to === user.id && data.previousData?.assigned_to !== user.id) {
        console.log('🔔 Adding notification - task assigned to user');
        addNotification({
          type: 'task_assigned',
          title: 'Task assigned to you',
          message: `Task "${data.task.title}" has been assigned to you`,
          icon: '📋',
          priority: 'normal',
          actionUrl: `/tasks`,
          metadata: { taskId: data.task.id }
        });
        return;
      }

      // Notify task creator when assigned user updates the task
      if (data.task.created_by === user.id && data.updater?.id === data.task.assigned_to && data.updater?.id !== user.id) {
        console.log('🔔 Adding notification - assigned user updated task creator\'s task');
        addNotification({
          type: 'task_updated',
          title: 'Your task was updated',
          message: `${data.updater.name} updated task "${data.task.title}"`,
          icon: '🔄',
          priority: 'normal',
          actionUrl: `/tasks`,
          metadata: { taskId: data.task.id }
        });
        return;
      }

      console.log('🔔 No notification criteria met for task update');
    });

    const unsubscribeTaskDeleted = subscribe('taskDeleted', (data) => {
      if (data.task.assigned_to === user.id) {
        addNotification({
          type: 'task_deleted',
          title: 'Task removed',
          message: `Task "${data.task.title}" has been deleted`,
          icon: '🗑️',
          priority: 'normal',
          metadata: { taskId: data.task.id }
        });
      }
    });

    // Comment notifications - ALL team members get notified
    const unsubscribeComment = subscribe('commentAdded', (data) => {
      console.log('🔔 Comment notification check:', {
        commenterId: data.comment.user_id,
        currentUserId: user.id,
        taskTeamId: data.comment.task_team_id,
        userTeams: user.teams?.map(t => t.id),
        fullUserTeams: user.teams,
        commentData: data.comment
      });

      // Don't notify the commenter themselves
      if (data.comment.user_id === user.id) {
        console.log('🔔 Skipping notification - user is the commenter');
        return;
      }

      // Notify if user is a member of the task's team
      const isTeamMember = user.teams?.some(t => t.id === data.comment.task_team_id);
      console.log('🔔 Team membership check:', {
        isTeamMember,
        taskTeamId: data.comment.task_team_id,
        taskTeamIdType: typeof data.comment.task_team_id,
        userTeamIds: user.teams?.map(t => ({ id: t.id, type: typeof t.id }))
      });
      
      if (isTeamMember) {
        console.log('🔔 Adding notification - user is team member');
        addNotification({
          type: 'comment_added',
          title: 'New comment on team task',
          message: `${data.comment.author_name} commented on "${data.comment.task_title}"`,
          icon: '💬',
          priority: 'normal',
          actionUrl: `/tasks`,
          metadata: { taskId: data.comment.task_id, commentId: data.comment.id }
        });
        return;
      }

      console.log('🔔 No notification criteria met for comment - user not in task team');
    });

    // Team notifications
    const unsubscribeTeamUpdated = subscribe('teamUpdated', (data) => {
      if (user.teams?.some(t => t.id === data.team.id)) {
        addNotification({
          type: 'team_updated',
          title: 'Team information updated',
          message: `Team "${data.team.name}" has been updated`,
          icon: '👥',
          priority: 'low',
          actionUrl: `/teams`,
          metadata: { teamId: data.team.id }
        });
      }
    });

    // User notifications (role changes, etc.)
    const unsubscribeUserUpdated = subscribe('userUpdated', (data) => {
      if (data.user.id === user.id) {
        addNotification({
          type: 'profile_updated',
          title: 'Your profile was updated',
          message: 'Your account information has been modified',
          icon: '👤',
          priority: 'normal',
          actionUrl: `/profile`,
          metadata: { userId: data.user.id }
        });
      }
    });

    // System notifications
    const unsubscribeSystemNotification = subscribe('systemNotification', (data) => {
      addNotification({
        type: 'system',
        title: data.title || 'System Notification',
        message: data.message,
        icon: data.icon || '🔔',
        priority: data.priority || 'normal',
        actionUrl: data.actionUrl,
        metadata: data.metadata
      });
    });

    return () => {
      unsubscribeTaskCreated();
      unsubscribeTaskUpdated();
      unsubscribeTaskDeleted();
      unsubscribeComment();
      unsubscribeTeamUpdated();
      unsubscribeUserUpdated();
      unsubscribeSystemNotification();
    };
  }, [user, subscribe, addNotification]);

  // Format time ago
  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now - time) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return time.toLocaleDateString();
  };

  return {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    clearOnLogout,
    formatTimeAgo
  };
};