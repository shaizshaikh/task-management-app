import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

const LoginPage = () => {
  const { isAuthenticated, login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  if (loading) {
    return (
      <div className="login-loading">
        <div className="loading-content">
          <div className="loading-text">Initializing authentication...</div>
          <div className="loading"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Header Section */}
        <div className="login-header">
          <img src="/logo.svg" alt="Prismex Logo" className="app-logo-img" />
          <h2 className="app-title">Prismex</h2>
          <p className="app-description">
            Team & Workforce Management Platform
          </p>
        </div>

        {/* Authentication Card */}
        <div className="auth-card">
          <div className="auth-header">
            <h2 className="auth-title">
              <span className="auth-icon" aria-hidden="true">Auth</span>
              Welcome Back
            </h2>
            <p className="auth-description">
              Please log in to access your workspace.
              Your role will determine what features you can access.
            </p>
          </div>

          <button
            onClick={login}
            className="btn btn-primary login-button"
            aria-label="Login to your account"
          >
            <span className="login-icon" aria-hidden="true">Login</span>
            Login
          </button>

          {/* Role Information */}
          <div className="role-info">
            <h3 className="role-title">Role-Based Access:</h3>
            <ul className="role-list">
              <li className="role-item">
                <span className="role-badge badge-admin">Admin</span>
                <span className="role-description">Full system access</span>
              </li>
              <li className="role-item">
                <span className="role-badge badge-manager">Manager</span>
                <span className="role-description">Team and task management</span>
              </li>
              <li className="role-item">
                <span className="role-badge badge-member">Member</span>
                <span className="role-description">Task creation and updates</span>
              </li>
              <li className="role-item">
                <span className="role-badge badge-viewer">Viewer</span>
                <span className="role-description">Read-only access</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="login-footer">
          <p className="footer-text">
            Prismex © 2025
          </p>
        </div>
      </div>

      <style jsx>{`
        .login-page {
          min-height: 100vh;
          background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--spacing-lg);
          position: relative;
          overflow: hidden;
        }

        .login-page::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(circle at 30% 20%, rgba(56, 139, 253, 0.1) 0%, transparent 50%),
                      radial-gradient(circle at 70% 80%, rgba(63, 185, 80, 0.1) 0%, transparent 50%);
          pointer-events: none;
        }

        .login-container {
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-primary);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-xl);
          padding: var(--spacing-3xl);
          text-align: center;
          max-width: 480px;
          width: 100%;
          position: relative;
          z-index: 1;
        }

        .login-loading {
          min-height: 100vh;
          background-color: var(--bg-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-primary);
        }

        .loading-content {
          text-align: center;
        }

        .loading-text {
          font-size: 1.125rem;
          margin-bottom: var(--spacing-lg);
          color: var(--text-primary);
        }

        .login-header {
          margin-bottom: var(--spacing-2xl);
        }

        .app-logo-img {
          width: 120px;
          height: 120px;
          margin: 0 auto var(--spacing-lg);
          display: block;
          filter: drop-shadow(0 4px 12px rgba(102, 126, 234, 0.3));
          animation: logoFloat 3s ease-in-out infinite;
        }

        @keyframes logoFloat {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        .app-logo {
          font-size: 4rem;
          margin-bottom: var(--spacing-lg);
          background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          display: inline-block;
        }

        .app-title {
          font-size: 2.5rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 var(--spacing-md) 0;
          background: linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .app-description {
          font-size: 1.125rem;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.5;
        }

        .auth-card {
          background-color: var(--bg-tertiary);
          border: 1px solid var(--border-secondary);
          border-radius: var(--radius-lg);
          padding: var(--spacing-2xl);
          margin-bottom: var(--spacing-2xl);
        }

        .auth-header {
          margin-bottom: var(--spacing-2xl);
        }

        .auth-title {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--spacing-md);
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0 0 var(--spacing-lg) 0;
        }

        .auth-icon {
          font-size: 1.75rem;
        }

        .auth-description {
          font-size: 1rem;
          color: var(--text-secondary);
          line-height: 1.6;
          margin: 0;
        }

        .login-button {
          width: 100%;
          font-size: 1.125rem;
          font-weight: 600;
          padding: var(--spacing-lg) var(--spacing-xl);
          margin-bottom: var(--spacing-2xl);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--spacing-md);
          box-shadow: var(--shadow-glow-success);
        }

        .login-icon {
          font-size: 1.25rem;
        }

        .role-info {
          background-color: var(--bg-quaternary);
          border: 1px solid var(--border-primary);
          border-radius: var(--radius-md);
          padding: var(--spacing-lg);
          text-align: left;
        }

        .role-title {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0 0 var(--spacing-md) 0;
          text-align: center;
        }

        .role-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
        }

        .role-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-sm);
          border-radius: var(--radius-sm);
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-secondary);
        }

        .role-badge {
          font-size: 0.75rem;
          font-weight: 600;
          padding: var(--spacing-xs) var(--spacing-sm);
          border-radius: var(--radius-md);
          text-transform: uppercase;
          letter-spacing: 0.025em;
          flex-shrink: 0;
          min-width: 70px;
          text-align: center;
        }

        .role-description {
          font-size: 0.875rem;
          color: var(--text-secondary);
          flex: 1;
        }

        .login-footer {
          border-top: 1px solid var(--border-secondary);
          padding-top: var(--spacing-lg);
        }

        .footer-text {
          font-size: 0.875rem;
          color: var(--text-tertiary);
          margin: 0;
        }

        /* Mobile Responsive */
        @media (max-width: 768px) {
          .login-page {
            padding: var(--spacing-md);
          }

          .login-container {
            padding: var(--spacing-xl);
          }

          .app-logo-img {
            width: 90px;
            height: 90px;
          }

          .app-logo {
            font-size: 3rem;
          }

          .app-title {
            font-size: 2rem;
          }

          .auth-card {
            padding: var(--spacing-lg);
          }

          .role-item {
            flex-direction: column;
            align-items: flex-start;
            gap: var(--spacing-xs);
          }

          .role-badge {
            min-width: auto;
          }
        }

        /* High Contrast Mode */
        @media (prefers-contrast: high) {
          .login-container {
            border: 2px solid var(--text-primary);
          }

          .auth-card {
            border: 2px solid var(--border-primary);
          }
        }

        /* Reduced Motion */
        @media (prefers-reduced-motion: reduce) {
          .login-button {
            transition: none;
          }

          .app-logo-img {
            animation: none;
          }
        }

        /* Focus Management */
        .login-button:focus-visible {
          outline: var(--focus-ring);
          outline-offset: var(--focus-ring-offset);
        }
      `}</style>
    </div>
  );
};

export default LoginPage;