/**
 * Azure Portal Inspired App Layout
 * WCAG 2.2 Compliant Layout with Left Sidebar Navigation
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import '../../styles/globals.css';

const AppLayout = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      // Auto-collapse sidebar on mobile initially
      if (mobile && !sidebarCollapsed) {
        setSidebarCollapsed(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Skip layout for login page
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-primary">
        {children}
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Skip Link for Accessibility */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Top Bar */}
      <TopBar 
        user={user}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        sidebarCollapsed={sidebarCollapsed}
      />

      <div className="app-body">
        {/* Sidebar Navigation */}
        <Sidebar 
          collapsed={sidebarCollapsed}
          isMobile={isMobile}
          onCollapse={setSidebarCollapsed}
        />

        {/* Main Content Area */}
        <main 
          id="main-content"
          className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
          role="main"
          aria-label="Main content"
        >
          <div className="content-wrapper">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Overlay */}
      {isMobile && !sidebarCollapsed && (
        <div 
          className="mobile-overlay"
          onClick={() => setSidebarCollapsed(true)}
          aria-hidden="true"
        />
      )}

      <style jsx>{`
        .app-layout {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          background-color: var(--bg-primary);
          color: var(--text-primary);
        }

        .app-body {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          margin-left: 280px;
          transition: margin-left var(--animation-duration) ease-in-out;
          min-height: calc(100vh - 60px);
          background-color: var(--bg-primary);
        }

        .main-content.sidebar-collapsed {
          margin-left: 60px;
        }

        .content-wrapper {
          flex: 1;
          padding: var(--spacing-lg);
          overflow-y: auto;
          max-width: 100%;
          min-height: 0; /* Fix for flexbox overflow */
        }

        .mobile-overlay {
          position: fixed;
          top: 60px;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: var(--bg-overlay);
          z-index: 999;
          backdrop-filter: blur(4px);
        }

        /* Mobile Responsive */
        @media (max-width: 768px) {
          .main-content {
            margin-left: 0;
          }

          .main-content.sidebar-collapsed {
            margin-left: 0;
          }

          .content-wrapper {
            padding: var(--spacing-md);
          }
        }

        /* High Contrast Mode */
        @media (prefers-contrast: high) {
          .app-layout {
            border: 2px solid var(--text-primary);
          }
        }

        /* Reduced Motion */
        @media (prefers-reduced-motion: reduce) {
          .main-content {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
};

export default AppLayout;