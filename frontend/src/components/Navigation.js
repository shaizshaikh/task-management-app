/**
 * Navigation Component - DEPRECATED
 * This component is replaced by the modern Sidebar + TopBar layout
 * Kept for backward compatibility but should not be used
 */

import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

const Navigation = () => {
  const { user, logout, isAdmin, isManager } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // This component is deprecated - the app now uses AppLayout with Sidebar + TopBar
  console.warn('Navigation component is deprecated. Use AppLayout with Sidebar + TopBar instead.');

  const navItems = [
    {
      path: '/dashboard',
      label: '📊 Dashboard',
      icon: '📊',
      roles: ['admin', 'manager', 'member', 'viewer']
    },
    {
      path: '/tasks',
      label: '📋 Tasks',
      icon: '📋',
      roles: ['admin', 'manager', 'member', 'viewer']
    },
    {
      path: '/teams',
      label: '👥 Teams',
      icon: '👥',
      roles: ['admin', 'manager', 'member']
    },
    {
      path: '/admin',
      label: '⚙️ Admin Panel',
      icon: '⚙️',
      roles: ['admin']
    },
    {
      path: '/manager',
      label: '👔 Manager Panel',
      icon: '👔',
      roles: ['admin', 'manager']
    },
    {
      path: '/audit',
      label: '📜 Audit Logs',
      icon: '📜',
      roles: ['admin', 'manager']
    }
  ];

  const canAccessRoute = (requiredRoles) => {
    if (!user?.globalRole) return false;
    return requiredRoles.includes(user.globalRole);
  };

  const isActiveRoute = (path) => {
    return location.pathname === path;
  };

  return (
    <nav className="deprecated-navigation">
      <div className="nav-container">
        {/* Logo/Brand */}
        <div 
          onClick={() => navigate('/dashboard')}
          className="nav-brand"
        >
          📋 Task Management
        </div>

        {/* Navigation Links */}
        <div className="nav-links">
          {navItems
            .filter(item => canAccessRoute(item.roles))
            .map(item => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`nav-link ${isActiveRoute(item.path) ? 'active' : ''}`}
              >
                {item.label}
              </button>
            ))
          }
        </div>

        {/* User Menu */}
        <div className="nav-user">
          {/* User Info */}
          <div className="user-info">
            <div className="user-name">
              {user?.name || user?.username}
            </div>
            <div className="user-role">
              {user?.globalRole}
              {user?.teams?.length > 0 && (
                <span> • {user.teams.length} team{user.teams.length !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>

          {/* Profile Button */}
          <button
            onClick={() => navigate('/profile')}
            className="btn btn-secondary btn-sm"
          >
            👤 Profile
          </button>

          {/* Logout Button */}
          <button
            onClick={logout}
            className="btn btn-danger btn-sm"
          >
            🚪 Logout
          </button>
        </div>
      </div>

      <style jsx>{`
        .deprecated-navigation {
          background-color: var(--nav-bg);
          border-bottom: 1px solid var(--nav-border);
          padding: 0 var(--spacing-lg);
          box-shadow: var(--shadow-sm);
        }

        .nav-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          max-width: 1200px;
          margin: 0 auto;
          min-height: 60px;
        }

        .nav-brand {
          color: var(--text-primary);
          font-size: 1.25rem;
          font-weight: 700;
          cursor: pointer;
          padding: var(--spacing-md) 0;
          transition: color var(--animation-duration) ease-in-out;
        }

        .nav-brand:hover {
          color: var(--color-primary);
        }

        .nav-links {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
        }

        .nav-link {
          background-color: transparent;
          color: var(--nav-text);
          border: none;
          padding: var(--spacing-sm) var(--spacing-md);
          border-radius: var(--radius-md);
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
          transition: all var(--animation-duration) ease-in-out;
          white-space: nowrap;
        }

        .nav-link:hover {
          background-color: var(--nav-item-hover);
          color: var(--nav-text-active);
        }

        .nav-link.active {
          background-color: var(--color-primary);
          color: white;
        }

        .nav-user {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
        }

        .user-info {
          color: var(--text-primary);
          font-size: 0.875rem;
          text-align: right;
        }

        .user-name {
          font-weight: 600;
          margin-bottom: 2px;
        }

        .user-role {
          font-size: 0.75rem;
          color: var(--text-secondary);
          text-transform: capitalize;
        }

        /* Mobile Responsive */
        @media (max-width: 768px) {
          .nav-container {
            flex-wrap: wrap;
            gap: var(--spacing-sm);
          }

          .nav-links {
            order: 3;
            width: 100%;
            justify-content: center;
            flex-wrap: wrap;
            padding: var(--spacing-sm) 0;
            border-top: 1px solid var(--nav-border);
          }

          .user-info {
            display: none;
          }
        }

        /* High Contrast Mode */
        @media (prefers-contrast: high) {
          .deprecated-navigation {
            border-bottom: 2px solid var(--text-primary);
          }

          .nav-link.active {
            border: 2px solid var(--text-primary);
          }
        }
      `}</style>
    </nav>
  );
};

export default Navigation;