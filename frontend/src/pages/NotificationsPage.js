/**
 * Notifications Page
 * Full view of all user notifications with filtering and management
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';

const NotificationsPage = () => {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll, formatTimeAgo } = useNotifications();
  const [filter, setFilter] = useState('all'); // all, unread, read
  const [typeFilter, setTypeFilter] = useState('all'); // all, task_assigned, comment_added, etc.

  const filteredNotifications = notifications.filter(notification => {
    // Filter by read status
    if (filter === 'unread' && notification.read) return false;
    if (filter === 'read' && !notification.read) return false;
    
    // Filter by type
    if (typeFilter !== 'all' && notification.type !== typeFilter) return false;
    
    return true;
  });

  const handleNotificationClick = (notification) => {
    markAsRead(notification.id);
    
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
  };

  const getNotificationTypeLabel = (type) => {
    const typeLabels = {
      task_assigned: 'Task Assigned',
      task_created: 'Task Created',
      task_status_changed: 'Task Updated',
      task_deleted: 'Task Deleted',
      comment_added: 'New Comment',
      team_updated: 'Team Updated',
      profile_updated: 'Profile Updated',
      system: 'System'
    };
    return typeLabels[type] || type;
  };

  const getUniqueTypes = () => {
    const types = [...new Set(notifications.map(n => n.type))];
    return types.map(type => ({
      value: type,
      label: getNotificationTypeLabel(type)
    }));
  };

  return (
    <div className="page-container">
      {/* Header */}
      <header className="page-header">
        <div>
          <h2 className="page-title">Notifications</h2>
          <p className="page-subtitle">
            {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up!'}
          </p>
        </div>
        
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button className="btn btn-secondary" onClick={markAllAsRead}>
              Mark All Read
            </button>
          )}
          {notifications.length > 0 && (
            <button className="btn btn-danger" onClick={clearAll}>
              Clear All
            </button>
          )}
        </div>
      </header>

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="flex gap-4 items-center">
            <div className="form-group mb-0">
              <label className="form-label" htmlFor="status-filter">Status</label>
              <select
                id="status-filter"
                className="form-input"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All Notifications</option>
                <option value="unread">Unread Only</option>
                <option value="read">Read Only</option>
              </select>
            </div>

            <div className="form-group mb-0">
              <label className="form-label" htmlFor="type-filter">Type</label>
              <select
                id="type-filter"
                className="form-input"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="all">All Types</option>
                {getUniqueTypes().map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-sm text-secondary">
              Showing {filteredNotifications.length} of {notifications.length} notifications
            </div>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="card">
        <div className="card-body p-0">
          {filteredNotifications.length === 0 ? (
            <div className="text-center p-4">
              <div className="no-notifications-large">
                <span className="no-notifications-icon">Bell</span>
                <h3>No notifications found</h3>
                <p className="text-secondary">
                  {notifications.length === 0 
                    ? "You don't have any notifications yet." 
                    : "No notifications match your current filters."
                  }
                </p>
              </div>
            </div>
          ) : (
            <div className="notifications-list">
              {filteredNotifications.map((notification, index) => (
                <article
                  key={notification.id}
                  className={`notification-item-full ${!notification.read ? 'unread' : ''} ${
                    index < filteredNotifications.length - 1 ? 'border-bottom' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-icon-wrapper">
                    <span className="notification-type-icon">
                      {notification.icon}
                    </span>
                    {!notification.read && <div className="unread-dot" />}
                  </div>

                  <div className="notification-content-full">
                    <div className="notification-header">
                      <h3 className="notification-title">{notification.title}</h3>
                      <div className="notification-meta">
                        <span className="notification-type-badge">
                          {getNotificationTypeLabel(notification.type)}
                        </span>
                        <time className="notification-time">
                          {formatTimeAgo(notification.timestamp)}
                        </time>
                      </div>
                    </div>

                    <p className="notification-message">{notification.message}</p>

                    {notification.actionUrl && (
                      <div className="notification-action">
                        <span className="action-hint">Click to view details →</span>
                      </div>
                    )}
                  </div>

                  <div className="notification-priority">
                    {notification.priority === 'high' && (
                      <span className="priority-indicator high" title="High Priority">!</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .notifications-list {
          display: flex;
          flex-direction: column;
        }

        .notification-item-full {
          display: flex;
          gap: var(--spacing-lg);
          padding: var(--spacing-lg);
          cursor: pointer;
          transition: background-color var(--animation-duration) ease-in-out;
          position: relative;
        }

        .notification-item-full:hover {
          background-color: var(--bg-tertiary);
        }

        .notification-item-full.unread {
          background-color: rgba(31, 111, 235, 0.05);
          border-left: 4px solid var(--color-primary);
        }

        .notification-item-full.border-bottom {
          border-bottom: 1px solid var(--border-secondary);
        }

        .notification-icon-wrapper {
          position: relative;
          flex-shrink: 0;
          margin-top: var(--spacing-xs);
        }

        .notification-type-icon {
          font-size: 1.5rem;
          display: block;
        }

        .unread-dot {
          position: absolute;
          top: -4px;
          right: -4px;
          width: 10px;
          height: 10px;
          background-color: var(--color-primary);
          border-radius: 50%;
          border: 2px solid var(--bg-secondary);
        }

        .notification-content-full {
          flex: 1;
          min-width: 0;
        }

        .notification-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: var(--spacing-sm);
          gap: var(--spacing-md);
        }

        .notification-title {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
          line-height: 1.4;
        }

        .notification-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: var(--spacing-xs);
          flex-shrink: 0;
        }

        .notification-type-badge {
          font-size: 0.625rem;
          padding: var(--spacing-xs) var(--spacing-sm);
          background-color: var(--bg-quaternary);
          color: var(--text-secondary);
          border-radius: var(--radius-xl);
          text-transform: uppercase;
          font-weight: 600;
          letter-spacing: 0.025em;
        }

        .notification-time {
          font-size: 0.75rem;
          color: var(--text-tertiary);
        }

        .notification-message {
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin: 0 0 var(--spacing-sm) 0;
          line-height: 1.5;
        }

        .notification-action {
          margin-top: var(--spacing-sm);
        }

        .action-hint {
          font-size: 0.75rem;
          color: var(--color-primary);
          font-weight: 500;
        }

        .notification-priority {
          flex-shrink: 0;
          display: flex;
          align-items: flex-start;
          margin-top: var(--spacing-xs);
        }

        .priority-indicator {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 0.75rem;
        }

        .priority-indicator.high {
          background-color: var(--color-error);
          color: white;
        }

        .no-notifications-large {
          padding: var(--spacing-xl);
        }

        .no-notifications-large .no-notifications-icon {
          font-size: 4rem;
          display: block;
          margin-bottom: var(--spacing-lg);
          opacity: 0.3;
        }

        .no-notifications-large h3 {
          margin-bottom: var(--spacing-sm);
          color: var(--text-primary);
        }

        /* Mobile Responsive */
        @media (max-width: 768px) {
          .notification-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .notification-meta {
            align-items: flex-start;
            flex-direction: row;
            gap: var(--spacing-sm);
          }

          .notification-item-full {
            gap: var(--spacing-md);
          }
        }
      `}</style>
    </div>
  );
};

export default NotificationsPage;