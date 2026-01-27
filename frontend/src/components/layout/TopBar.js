/**
 * Azure Portal Inspired Top Bar
 * WCAG 2.2 Compliant with User Profile Menu
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useRealtime } from '../../hooks/useRealtime';
import { useNotifications } from '../../hooks/useNotifications';
import { toast } from 'react-toastify';

const TopBar = ({ user, onToggleSidebar, sidebarCollapsed }) => {
  const { logout } = useAuth();
  const { isConnected, connectionError } = useRealtime();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll, formatTimeAgo, clearOnLogout } = useNotifications();
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const notificationsRef = useRef(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation for menus
  const handleMenuKeyDown = (event, menuType) => {
    const { key } = event;

    if (key === 'Escape') {
      if (menuType === 'profile') {
        setProfileMenuOpen(false);
      } else if (menuType === 'notifications') {
        setNotificationsOpen(false);
      }
    }
  };

  const handleLogout = () => {
    setProfileMenuOpen(false);
    clearOnLogout(); // Clear notifications cache on logout
    logout();
  };

  const handleNotificationClick = (notification) => {
    markAsRead(notification.id);
    setNotificationsOpen(false);

    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
  };

  const handleViewAllNotifications = () => {
    setNotificationsOpen(false);
    navigate('/notifications');
  };

  const getConnectionStatus = () => {
    if (connectionError) {
      return { status: 'error', label: 'Connection Error', color: 'var(--color-error)' };
    }
    if (isConnected) {
      return { status: 'connected', label: 'Connected', color: 'var(--color-success)' };
    }
    return { status: 'connecting', label: 'Connecting...', color: 'var(--color-warning)' };
  };

  const connectionStatus = getConnectionStatus();

  return (
    <header className="top-bar" role="banner">
      <div className="top-bar-content">
        {/* Left Section */}
        <div className="top-bar-left">
          {/* Sidebar Toggle */}
          <button
            className="sidebar-toggle"
            onClick={onToggleSidebar}
            aria-label={sidebarCollapsed ? 'Open navigation menu' : 'Close navigation menu'}
            aria-expanded={!sidebarCollapsed}
            aria-controls="sidebar"
          >
            <span className="hamburger-icon" aria-hidden="true">
              ☰
            </span>
          </button>

          {/* Breadcrumb / Page Title */}
          <div className="page-info">
            <div className="page-title">Task Management System</div>
            <p className="page-subtitle">Enterprise Edition</p>
          </div>
        </div>

        {/* Right Section */}
        <div className="top-bar-right">
          {/* Connection Status */}
          <div className="connection-status" title={connectionStatus.label}>
            <div
              className="status-indicator"
              style={{ backgroundColor: connectionStatus.color }}
              aria-hidden="true"
            />
            <span className="sr-only">{connectionStatus.label}</span>
          </div>

          {/* Notifications */}
          <div className="notifications-container" ref={notificationsRef}>
            <button
              className={`notifications-button ${!isConnected ? 'disconnected' : ''}`}
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              onKeyDown={(e) => handleMenuKeyDown(e, 'notifications')}
              aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
              aria-expanded={notificationsOpen}
              aria-haspopup="true"
              title={unreadCount > 0 ? `${unreadCount} unread notifications` : 'No unread notifications'}
            >
              <span className="notification-icon" aria-hidden="true">Bell</span>
              {unreadCount > 0 && (
                <span 
                  className="notification-badge" 
                  aria-hidden="true"
                  key={unreadCount} // Force re-render for animation
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div
                className="notifications-menu"
                role="menu"
                aria-label="Notifications menu"
              >
                <div className="menu-header">
                  <div className="notifications-header-content">
                    <h3>Notifications</h3>
                    {unreadCount > 0 && (
                      <button
                        className="mark-all-read-btn"
                        onClick={markAllAsRead}
                        title="Mark all as read"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                </div>
                <div className="menu-content">
                  {notifications.length === 0 ? (
                    <div className="no-notifications">
                      <span className="no-notifications-icon">Bell</span>
                      <p>No notifications yet</p>
                    </div>
                  ) : (
                    notifications.slice(0, 5).map((notification) => (
                      <div
                        key={notification.id}
                        className={`notification-item ${!notification.read ? 'unread' : ''}`}
                        role="menuitem"
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="notification-icon-wrapper">
                          <span className="notification-type-icon">
                            {notification.icon}
                          </span>
                          {!notification.read && <div className="unread-dot" />}
                        </div>
                        <div className="notification-content">
                          <p className="notification-title">{notification.title}</p>
                          <p className="notification-message">{notification.message}</p>
                          <p className="notification-time">{formatTimeAgo(notification.timestamp)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="menu-footer">
                  <button
                    className="btn btn-secondary"
                    onClick={handleViewAllNotifications}
                  >
                    View All
                  </button>
                  {notifications.length > 0 && (
                    <button
                      className="btn btn-danger"
                      onClick={clearAll}
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Menu */}
          <div className="profile-container" ref={profileMenuRef}>
            <button
              className="profile-button"
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              onKeyDown={(e) => handleMenuKeyDown(e, 'profile')}
              aria-label={`User menu for ${user?.name || 'Unknown User'}`}
              aria-expanded={profileMenuOpen}
              aria-haspopup="true"
            >
              <div className="profile-avatar" aria-hidden="true">
                {user?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="profile-info">
                <span className="profile-name">{user?.name || 'Unknown User'}</span>
                <span className={`profile-role badge badge-${user?.globalRole || 'viewer'}`}>
                  {user?.globalRole || 'viewer'}
                </span>
              </div>
              <span className="dropdown-arrow" aria-hidden="true">▼</span>
            </button>

            {profileMenuOpen && (
              <div
                className="profile-menu"
                role="menu"
                aria-label="User profile menu"
              >
                <div className="menu-header">
                  <div className="user-details">
                    <p className="user-name">{user?.name || 'Unknown User'}</p>
                    <p className="user-email">{user?.email || 'No email'}</p>
                    <span className={`user-role badge badge-${user?.globalRole || 'viewer'}`}>
                      {user?.globalRole || 'viewer'}
                    </span>
                  </div>
                </div>

                <div className="menu-divider" />

                <div className="menu-content">
                  <button
                    className="menu-item"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      navigate('/profile');
                    }}
                  >
                    <span className="menu-icon" aria-hidden="true">👤</span>
                    Profile Settings
                  </button>
                  <button
                    className="menu-item"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      toast.info('Help documentation is being prepared. Contact your admin for support.');
                    }}
                  >
                    <span className="menu-icon" aria-hidden="true">❓</span>
                    Help & Support
                  </button>
                </div>

                <div className="menu-divider" />

                <div className="menu-footer">
                  <button
                    className="menu-item logout-item"
                    onClick={handleLogout}
                    role="menuitem"
                  >
                    <span className="menu-icon" aria-hidden="true">🚪</span>
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .top-bar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 60px;
          background-color: var(--bg-secondary);
          border-bottom: 1px solid var(--border-primary);
          z-index: 1001;
          display: flex;
          align-items: center;
        }

        .top-bar-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 0 var(--spacing-lg);
        }

        .top-bar-left {
          display: flex;
          align-items: center;
          gap: var(--spacing-lg);
        }

        .top-bar-right {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
        }

        .sidebar-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: var(--min-touch-target);
          min-height: var(--min-touch-target);
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          border-radius: var(--radius-md);
          transition: all var(--animation-duration) ease-in-out;
        }

        .sidebar-toggle:hover {
          background-color: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .sidebar-toggle:focus-visible {
          outline: var(--focus-ring);
          outline-offset: var(--focus-ring-offset);
        }

        .hamburger-icon {
          font-size: 1.25rem;
        }

        .page-info {
          display: flex;
          flex-direction: column;
        }

        .page-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
          line-height: 1.2;
        }

        .page-subtitle {
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.2;
        }

        .connection-status {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          padding: var(--spacing-xs) var(--spacing-sm);
          border-radius: var(--radius-md);
          background-color: var(--bg-tertiary);
        }

        .status-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .notifications-container,
        .profile-container {
          position: relative;
        }

        .notifications-button,
        .profile-button {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          min-height: var(--min-touch-target);
          min-width: var(--min-touch-target);
          padding: var(--spacing-sm);
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          border-radius: var(--radius-md);
          transition: all var(--animation-duration) ease-in-out;
        }

        .notifications-button:hover,
        .profile-button:hover {
          background-color: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .notifications-button:focus-visible,
        .profile-button:focus-visible {
          outline: var(--focus-ring);
          outline-offset: var(--focus-ring-offset);
        }

        .notification-icon {
          font-size: 1.25rem;
          position: relative;
        }

        .notification-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          background-color: var(--color-error);
          color: white;
          font-size: 0.625rem;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: var(--radius-xl);
          min-width: 18px;
          text-align: center;
        }

        .profile-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background-color: var(--color-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          color: white;
          font-size: 0.875rem;
        }

        .profile-info {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
        }

        .profile-name {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-primary);
          white-space: nowrap;
        }

        .profile-role {
          font-size: 0.625rem;
        }

        .dropdown-arrow {
          font-size: 0.75rem;
          transition: transform var(--animation-duration) ease-in-out;
        }

        .profile-button[aria-expanded="true"] .dropdown-arrow {
          transform: rotate(180deg);
        }

        .notifications-menu,
        .profile-menu {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          min-width: 280px;
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-primary);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          z-index: 1002;
          overflow: hidden;
        }

        .menu-header {
          padding: var(--spacing-lg);
          border-bottom: 1px solid var(--border-primary);
          background-color: var(--bg-tertiary);
        }

        .menu-header h3 {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
        }

        .user-details {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
        }

        .user-name {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
        }

        .user-email {
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin: 0;
        }

        .user-role {
          align-self: flex-start;
        }

        .menu-content {
          padding: var(--spacing-sm) 0;
        }

        .menu-footer {
          padding: var(--spacing-lg);
          border-top: 1px solid var(--border-primary);
          background-color: var(--bg-tertiary);
        }

        .menu-divider {
          height: 1px;
          background-color: var(--border-primary);
          margin: var(--spacing-sm) 0;
        }

        .menu-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          width: 100%;
          min-height: var(--min-touch-target);
          padding: var(--spacing-sm) var(--spacing-lg);
          background: transparent;
          border: none;
          color: var(--text-primary);
          font-size: 0.875rem;
          text-align: left;
          cursor: pointer;
          transition: all var(--animation-duration) ease-in-out;
        }

        .menu-item:hover {
          background-color: var(--bg-quaternary);
        }

        .menu-item:focus-visible {
          outline: var(--focus-ring);
          outline-offset: -2px;
        }

        .menu-icon {
          font-size: 1rem;
          width: 20px;
          text-align: center;
        }

        .logout-item {
          color: var(--color-error-light);
        }

        .logout-item:hover {
          background-color: var(--color-error);
          color: white;
        }

        /* Enhanced Notifications Styles */
        .notifications-header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .mark-all-read-btn {
          background: none;
          border: none;
          color: var(--color-primary);
          font-size: 0.75rem;
          cursor: pointer;
          padding: var(--spacing-xs);
          border-radius: var(--radius-sm);
          transition: all var(--animation-duration) ease-in-out;
        }

        .mark-all-read-btn:hover {
          background-color: var(--bg-quaternary);
        }

        .no-notifications {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: var(--spacing-xl);
          color: var(--text-secondary);
        }

        .no-notifications-icon {
          font-size: 2rem;
          margin-bottom: var(--spacing-sm);
          opacity: 0.5;
        }

        .no-notifications p {
          margin: 0;
          font-size: 0.875rem;
        }

        .notification-item {
          display: flex;
          gap: var(--spacing-md);
          padding: var(--spacing-md) var(--spacing-lg);
          border-bottom: 1px solid var(--border-secondary);
          cursor: pointer;
          transition: background-color var(--animation-duration) ease-in-out;
        }

        .notification-item:hover {
          background-color: var(--bg-quaternary);
        }

        .notification-item.unread {
          background-color: rgba(31, 111, 235, 0.05);
          border-left: 3px solid var(--color-primary);
        }

        .notification-icon-wrapper {
          position: relative;
          flex-shrink: 0;
        }

        .notification-type-icon {
          font-size: 1.25rem;
          display: block;
        }

        .unread-dot {
          position: absolute;
          top: -2px;
          right: -2px;
          width: 8px;
          height: 8px;
          background-color: var(--color-primary);
          border-radius: 50%;
          border: 2px solid var(--bg-secondary);
        }

        .notification-content {
          flex: 1;
          min-width: 0;
        }

        .notification-title {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-primary);
          margin: 0 0 var(--spacing-xs) 0;
          line-height: 1.3;
        }

        .notification-message {
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin: 0 0 var(--spacing-xs) 0;
          line-height: 1.4;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .menu-footer {
          display: flex;
          gap: var(--spacing-sm);
          padding: var(--spacing-lg);
          border-top: 1px solid var(--border-primary);
          background-color: var(--bg-tertiary);
        }

        .menu-footer .btn {
          flex: 1;
          font-size: 0.75rem;
          padding: var(--spacing-xs) var(--spacing-sm);
        }

        /* Enhanced Notifications Styles */
        .notifications-header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .mark-all-read-btn {
          background: none;
          border: none;
          color: var(--color-primary);
          font-size: 0.75rem;
          cursor: pointer;
          padding: var(--spacing-xs);
          border-radius: var(--radius-sm);
          transition: all var(--animation-duration) ease-in-out;
        }

        .mark-all-read-btn:hover {
          background-color: var(--bg-quaternary);
        }

        .no-notifications {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: var(--spacing-xl);
          color: var(--text-secondary);
        }

        .no-notifications-icon {
          font-size: 2rem;
          margin-bottom: var(--spacing-sm);
          opacity: 0.5;
        }

        .no-notifications p {
          margin: 0;
          font-size: 0.875rem;
        }

        .notification-item {
          display: flex;
          gap: var(--spacing-md);
          padding: var(--spacing-md) var(--spacing-lg);
          border-bottom: 1px solid var(--border-secondary);
          cursor: pointer;
          transition: background-color var(--animation-duration) ease-in-out;
        }

        .notification-item:hover {
          background-color: var(--bg-quaternary);
        }

        .notification-item.unread {
          background-color: rgba(31, 111, 235, 0.05);
          border-left: 3px solid var(--color-primary);
        }

        .notification-icon-wrapper {
          position: relative;
          flex-shrink: 0;
        }

        .notification-type-icon {
          font-size: 1.25rem;
          display: block;
        }

        .unread-dot {
          position: absolute;
          top: -2px;
          right: -2px;
          width: 8px;
          height: 8px;
          background-color: var(--color-primary);
          border-radius: 50%;
          border: 2px solid var(--bg-secondary);
        }

        .notification-content {
          flex: 1;
          min-width: 0;
        }

        .notification-title {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-primary);
          margin: 0 0 var(--spacing-xs) 0;
          line-height: 1.3;
        }

        .notification-message {
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin: 0 0 var(--spacing-xs) 0;
          line-height: 1.4;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .menu-footer {
          display: flex;
          gap: var(--spacing-sm);
          padding: var(--spacing-lg);
          border-top: 1px solid var(--border-primary);
          background-color: var(--bg-tertiary);
        }

        .menu-footer .btn {
          flex: 1;
          font-size: 0.75rem;
          padding: var(--spacing-xs) var(--spacing-sm);
        }

        /* Mobile Responsive */
        @media (max-width: 768px) {
          .top-bar-content {
            padding: 0 var(--spacing-md);
          }

          .page-info {
            display: none;
          }

          .profile-info {
            display: none;
          }

          .notifications-menu,
          .profile-menu {
            position: fixed;
            top: 60px;
            left: var(--spacing-sm);
            right: var(--spacing-sm);
            min-width: auto;
            max-width: calc(100vw - 2 * var(--spacing-sm));
          }

          .connection-status {
            display: none;
          }

          .top-bar-right {
            gap: var(--spacing-xs);
          }

          .notifications-button,
          .profile-button {
            min-width: var(--min-touch-target);
            padding: var(--spacing-sm);
          }
        }

        @media (max-width: 480px) {
          .top-bar-content {
            padding: 0 var(--spacing-sm);
          }

          .notifications-menu,
          .profile-menu {
            left: var(--spacing-xs);
            right: var(--spacing-xs);
            max-width: calc(100vw - 2 * var(--spacing-xs));
          }

          .profile-avatar {
            width: 28px;
            height: 28px;
            font-size: 0.75rem;
          }

          .notification-icon {
            font-size: 1.125rem;
          }
        }

        /* High Contrast Mode */
        @media (prefers-contrast: high) {
          .top-bar {
            border-bottom: 2px solid var(--text-primary);
          }

          .menu-item:focus-visible {
            outline: 2px solid var(--text-primary);
          }
        }

        /* Reduced Motion */
        @media (prefers-reduced-motion: reduce) {
          .dropdown-arrow {
            transition: none;
          }

          .status-indicator {
            animation: none;
          }
        }
      `}</style>
    </header>
  );
};

export default TopBar;