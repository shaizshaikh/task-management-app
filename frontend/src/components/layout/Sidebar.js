/**
 * Azure Portal Inspired Sidebar Navigation
 * WCAG 2.2 Compliant with Full Keyboard Navigation
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Sidebar = ({ collapsed, isMobile, onCollapse }) => {
  const { user, isAdmin, isManager } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const sidebarRef = useRef(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Navigation items based on user role
  const getNavigationItems = () => {
    const items = [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: '📊',
        path: '/dashboard',
        description: 'View system overview and statistics',
        roles: ['admin', 'manager', 'member', 'viewer']
      },
      {
        id: 'tasks',
        label: 'Tasks',
        icon: '📋',
        path: '/tasks',
        description: 'Manage and view tasks',
        roles: ['admin', 'manager', 'member', 'viewer']
      },
      {
        id: 'teams',
        label: 'Teams',
        icon: '👥',
        path: '/teams',
        description: 'Manage team memberships and settings',
        roles: ['admin', 'manager', 'member', 'viewer']
      }
    ];

    // Add admin-only items
    if (isAdmin()) {
      items.push({
        id: 'admin',
        label: 'Admin Panel',
        icon: '⚙️',
        path: '/admin',
        description: 'System administration and user management',
        roles: ['admin']
      });
    }

    // Add manager-only items
    if (isManager() || isAdmin()) {
      items.push({
        id: 'manager',
        label: 'Manager Panel',
        icon: '👑',
        path: '/manager',
        description: 'Team management and oversight tools',
        roles: ['admin', 'manager']
      });
    }

    return items.filter(item => 
      item.roles.includes(user?.globalRole || 'viewer')
    );
  };

  const navigationItems = getNavigationItems();

  // Keyboard navigation
  const handleKeyDown = (event) => {
    const { key } = event;
    const itemCount = navigationItems.length;

    switch (key) {
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex(prev => (prev + 1) % itemCount);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex(prev => (prev - 1 + itemCount) % itemCount);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (focusedIndex >= 0) {
          navigate(navigationItems[focusedIndex].path);
        }
        break;
      case 'Escape':
        if (isMobile) {
          onCollapse(true);
        }
        break;
      default:
        break;
    }
  };

  // Focus management
  useEffect(() => {
    if (focusedIndex >= 0 && sidebarRef.current) {
      const focusedElement = sidebarRef.current.querySelector(
        `[data-nav-index="${focusedIndex}"]`
      );
      if (focusedElement) {
        focusedElement.focus();
      }
    }
  }, [focusedIndex]);

  const isActive = (path) => {
    if (path === '/dashboard') {
      return location.pathname === '/' || location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  const handleNavigation = (path, index) => {
    setFocusedIndex(index);
    navigate(path);
    
    // Close sidebar on mobile after navigation
    if (isMobile) {
      onCollapse(true);
    }
  };

  return (
    <nav
      ref={sidebarRef}
      className={`sidebar ${collapsed ? 'collapsed' : ''} ${isMobile ? 'mobile' : ''} ${isMobile && !collapsed ? 'show' : ''}`}
      role="navigation"
      aria-label="Main navigation"
      aria-hidden={collapsed}
      inert={collapsed ? '' : undefined}
      onKeyDown={handleKeyDown}
    >
      {/* Sidebar Header */}
      <div className="sidebar-header">
        <div className="logo-container">
          <div className="logo" aria-hidden="true">
            📋
          </div>
          {!collapsed && (
            <div className="logo-text">
              <h1 className="app-title">Task Management</h1>
              <p className="app-subtitle">Enterprise Edition</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Items */}
      <div className="nav-section">
        <ul className="nav-list" role="menubar" aria-hidden={collapsed}>
          {navigationItems.map((item, index) => (
            <li key={item.id} role="none">
              <button
                data-nav-index={index}
                className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                onClick={() => handleNavigation(item.path, index)}
                role="menuitem"
                aria-current={isActive(item.path) ? 'page' : undefined}
                aria-label={`${item.label} - ${item.description}`}
                tabIndex={collapsed ? -1 : (index === 0 ? 0 : -1)}
              >
                <span className="nav-icon" aria-hidden="true">
                  {item.icon}
                </span>
                {!collapsed && (
                  <span className="nav-label">{item.label}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* User Info Section */}
      {!collapsed && (
        <div className="sidebar-footer" aria-hidden={collapsed}>
          <div className="user-info">
            <div className="user-avatar" aria-hidden="true">
              {user?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="user-details">
              <p className="user-name">{user?.name || 'Unknown User'}</p>
              <p className="user-role">
                <span className={`badge badge-${user?.globalRole || 'viewer'}`}>
                  {user?.globalRole || 'viewer'}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .sidebar {
          position: fixed;
          top: 60px;
          left: 0;
          bottom: 0;
          width: 280px;
          background-color: var(--nav-bg);
          border-right: 1px solid var(--nav-border);
          display: flex;
          flex-direction: column;
          transition: width var(--animation-duration) ease-in-out;
          z-index: 1000;
          overflow: hidden;
        }

        .sidebar.collapsed {
          width: 60px;
          pointer-events: none;
        }

        /* Hide collapsed sidebar content from screen readers and keyboard */
        .sidebar.collapsed .nav-list,
        .sidebar.collapsed .nav-item {
          visibility: hidden;
        }

        .sidebar.collapsed .nav-label {
          display: none;
        }

        .sidebar.mobile {
          transform: translateX(-100%);
          transition: transform var(--animation-duration) ease-in-out;
          width: 280px;
          box-shadow: var(--shadow-xl);
        }

        .sidebar.mobile.show {
          transform: translateX(0);
        }

        .sidebar-header {
          padding: var(--spacing-lg);
          border-bottom: 1px solid var(--nav-border);
          min-height: 80px;
          display: flex;
          align-items: center;
        }

        .logo-container {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          width: 100%;
        }

        .logo {
          font-size: 2rem;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: var(--color-primary);
          border-radius: var(--radius-lg);
          flex-shrink: 0;
        }

        .logo-text {
          overflow: hidden;
        }

        .app-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
          white-space: nowrap;
        }

        .app-subtitle {
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin: 0;
          white-space: nowrap;
        }

        .nav-section {
          flex: 1;
          padding: var(--spacing-md) 0;
          overflow-y: auto;
        }

        .nav-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .nav-item {
          display: flex;
          align-items: center;
          width: 100%;
          min-height: var(--min-touch-target);
          padding: var(--spacing-md) var(--spacing-lg);
          background: var(--nav-item);
          border: none;
          color: var(--nav-text);
          text-decoration: none;
          cursor: pointer;
          transition: all var(--animation-duration) ease-in-out;
          position: relative;
          gap: var(--spacing-md);
          font-size: 0.875rem;
          font-weight: 500;
        }

        .nav-item:hover {
          background-color: var(--nav-item-hover);
          color: var(--nav-text-active);
        }

        .nav-item:focus-visible {
          outline: var(--focus-ring);
          outline-offset: -2px;
        }

        .nav-item.active {
          background-color: var(--nav-item-active);
          color: var(--nav-text-active);
          border-right: 3px solid var(--color-primary);
        }

        .nav-item.active::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background-color: var(--color-primary);
        }

        .nav-icon {
          font-size: 1.25rem;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .nav-label {
          flex: 1;
          text-align: left;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sidebar-footer {
          padding: var(--spacing-lg);
          border-top: 1px solid var(--nav-border);
          background-color: var(--bg-tertiary);
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
        }

        .user-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background-color: var(--color-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          color: white;
          flex-shrink: 0;
        }

        .user-details {
          flex: 1;
          overflow: hidden;
        }

        .user-name {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-primary);
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .user-role {
          margin: var(--spacing-xs) 0 0 0;
        }

        /* Mobile Styles */
        @media (max-width: 768px) {
          .sidebar {
            width: 280px;
            box-shadow: var(--shadow-lg);
          }

          .sidebar.collapsed {
            width: 280px;
          }
        }

        /* High Contrast Mode */
        @media (prefers-contrast: high) {
          .sidebar {
            border-right: 2px solid var(--text-primary);
          }

          .nav-item.active {
            border-right: 4px solid var(--text-primary);
          }
        }

        /* Reduced Motion */
        @media (prefers-reduced-motion: reduce) {
          .sidebar {
            transition: none;
          }

          .nav-item {
            transition: none;
          }
        }
      `}</style>
    </nav>
  );
};

export default Sidebar;