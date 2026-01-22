/**
 * Admin Panel - Main Dashboard
 * System administration interface for admins
 * WCAG 2.2 Compliant with Consistent Design System
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import UserManagement from '../components/admin/UserManagement';
import TeamManagement from '../components/admin/TeamManagement';
import AuditLogViewer from '../components/admin/AuditLogViewer';


import { useRealtime } from '../hooks/useRealtime';

const AdminPanel = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [auditStats, setAuditStats] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Real-time stats refresh function
  const refreshStats = useCallback(async () => {
    try {
      // Refresh both system stats and user stats
      const [systemStatsResponse, userStatsResponse] = await Promise.all([
        axios.get('/api/stats'),
        axios.get('/api/users/stats')
      ]);
      
      setStats(systemStatsResponse.data);
      setUserStats(userStatsResponse.data.statistics || userStatsResponse.data);
      console.log('All stats refreshed in real-time');
    } catch (error) {
      console.error('Failed to refresh stats:', error);
    }
  }, []);

  // Listen for real-time events that should trigger stats refresh
  const { subscribe } = useRealtime();
  
  useEffect(() => {
    const unsubscribeTask = subscribe('taskCreated', refreshStats);
    const unsubscribeUpdate = subscribe('taskUpdated', refreshStats);
    const unsubscribeDelete = subscribe('taskDeleted', refreshStats);
    const unsubscribeUser = subscribe('userUpdated', refreshStats);
    const unsubscribeTeam = subscribe('teamUpdated', refreshStats);

    return () => {
      unsubscribeTask();
      unsubscribeUpdate();
      unsubscribeDelete();
      unsubscribeUser();
      unsubscribeTeam();
    };
  }, [subscribe, refreshStats]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load system statistics - try each endpoint individually to see which ones fail
      let systemStats = null;
      let usersStats = null;
      let auditData = null;

      try {
        systemStats = await axios.get('/api/stats');
        setStats(systemStats.data);
        console.log('System stats loaded successfully');
      } catch (error) {
        console.error('Failed to load system stats:', error.response?.status, error.response?.data);
      }

      try {
        usersStats = await axios.get('/api/users/stats');
        setUserStats(usersStats.data.statistics || usersStats.data);
        console.log('User stats loaded successfully');
      } catch (error) {
        console.error('Failed to load user stats:', error.response?.status, error.response?.data);
        // Set default user stats if endpoint fails
        setUserStats({
          total_users: 0,
          active_users: 0,
          admin_count: 0,
          manager_count: 0,
          member_count: 0,
          viewer_count: 0
        });
      }

      try {
        auditData = await axios.get('/api/audit/stats?range=7d');
        setAuditStats(auditData.data.statistics || auditData.data);
        console.log('Audit stats loaded successfully');
      } catch (error) {
        console.error('Failed to load audit stats:', error.response?.status, error.response?.data);
        // Set default audit stats if endpoint fails
        setAuditStats({
          daily_activity: [],
          total_events: 0
        });
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };



  if (loading) {
    return (
      <div className="page-container">
        <div className="card">
          <div className="card-body text-center">
            <div className="loading"></div>
            <p className="mt-2">Loading admin dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <header className="page-header">
        <div>
          <h2 className="page-title">Admin Panel</h2>
          <p className="page-subtitle">
            Welcome back, {user?.name}! System administration dashboard.
          </p>
        </div>
        

      </header>

      {/* Navigation Tabs */}
      <nav className="tab-navigation" role="tablist" aria-label="Admin panel sections">
        {[
          { id: 'overview', label: 'Overview', icon: 'Overview' },
          { id: 'users', label: 'Users', icon: 'Users' },
          { id: 'teams', label: 'Teams', icon: 'Teams' },
          { id: 'audit', label: 'Audit', icon: 'Audit' },
          { id: 'notifications', label: 'Notifications', icon: 'Notifications' }
        ].map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(e) => {
              // Arrow key navigation for tabs
              const tabs = ['overview', 'users', 'teams', 'audit', 'notifications'];
              const currentIndex = tabs.indexOf(activeTab);
              
              if (e.key === 'ArrowRight') {
                e.preventDefault();
                const nextIndex = (currentIndex + 1) % tabs.length;
                setActiveTab(tabs[nextIndex]);
                document.getElementById(`${tabs[nextIndex]}-tab`)?.focus();
              } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                setActiveTab(tabs[prevIndex]);
                document.getElementById(`${tabs[prevIndex]}-tab`)?.focus();
              } else if (e.key === 'Home') {
                e.preventDefault();
                setActiveTab(tabs[0]);
                document.getElementById(`${tabs[0]}-tab`)?.focus();
              } else if (e.key === 'End') {
                e.preventDefault();
                setActiveTab(tabs[tabs.length - 1]);
                document.getElementById(`${tabs[tabs.length - 1]}-tab`)?.focus();
              }
            }}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`${tab.id}-panel`}
            id={`${tab.id}-tab`}
            tabIndex={activeTab === tab.id ? 0 : -1}
          >
            <span className="tab-icon" aria-hidden="true">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      <main className="tab-content">
        {activeTab === 'overview' && (
          <section 
            id="overview-panel" 
            role="tabpanel" 
            aria-labelledby="overview-tab"
            className="tab-panel"
          >
            <OverviewTab 
              stats={stats} 
              userStats={userStats} 
              auditStats={auditStats}
            />
          </section>
        )}
        
        {activeTab === 'users' && (
          <section 
            id="users-panel" 
            role="tabpanel" 
            aria-labelledby="users-tab"
            className="tab-panel"
          >
            <UsersTab />
          </section>
        )}
        
        {activeTab === 'teams' && (
          <section 
            id="teams-panel" 
            role="tabpanel" 
            aria-labelledby="teams-tab"
            className="tab-panel"
          >
            <TeamsTab />
          </section>
        )}
        
        {activeTab === 'audit' && (
          <section 
            id="audit-panel" 
            role="tabpanel" 
            aria-labelledby="audit-tab"
            className="tab-panel"
          >
            <AuditTab />
          </section>
        )}
        
        {activeTab === 'notifications' && (
          <section 
            id="notifications-panel" 
            role="tabpanel" 
            aria-labelledby="notifications-tab"
            className="tab-panel"
          >
            <NotificationsTab />
          </section>
        )}
      </main>
    </div>
  );
};

// Overview Tab Component
const OverviewTab = ({ stats, userStats, auditStats }) => {
  return (
    <div>
      <h3 className="mb-4">System Overview</h3>
      

      
      {/* System Statistics */}
      <div className="dashboard-grid mb-4">
        {/* Task Statistics */}
        <div className="stat-card info">
          <h4 className="mb-3">Tasks</h4>
          <div className="stat-value">
            {stats?.total_tasks || 0}
          </div>
          <div className="stat-label">
            {stats?.completed_tasks || 0} completed • {stats?.overdue_tasks || 0} overdue
          </div>
        </div>

        {/* User Statistics */}
        <div className="stat-card success">
          <h4 className="mb-3">Users</h4>
          <div className="stat-value">
            {userStats?.total_users || 0}
          </div>
          <div className="stat-label">
            {userStats?.active_users || 0} active • {userStats?.admin_count || 0} admins
          </div>
        </div>

        {/* Team Statistics */}
        <div className="stat-card warning">
          <h4 className="mb-3">Teams</h4>
          <div className="stat-value">
            {stats?.total_teams || 0}
          </div>
          <div className="stat-label">
            Active teams with members
          </div>
        </div>

        {/* Audit Activity */}
        <div className="stat-card primary">
          <h4 className="mb-3">Activity</h4>
          <div className="stat-value">
            {auditStats?.daily_activity?.reduce((sum, day) => sum + day.total_events, 0) || 0}
          </div>
          <div className="stat-label">
            Events in last 7 days
          </div>
        </div>
      </div>

      {/* Role Distribution */}
      {userStats && (
        <div className="card mb-4">
          <div className="card-header">
            <h4 className="mb-0">User Role Distribution</h4>
          </div>
          <div className="card-body">
            <div className="dashboard-grid">
              <div className="text-center">
                <div className="stat-value stat-value-admin">
                  {userStats.admin_count || 0}
                </div>
                <div className="stat-label">Admins</div>
              </div>
              <div className="text-center">
                <div className="stat-value stat-value-manager">
                  {userStats.manager_count || 0}
                </div>
                <div className="stat-label">Managers</div>
              </div>
              <div className="text-center">
                <div className="stat-value stat-value-member">
                  {userStats.member_count || 0}
                </div>
                <div className="stat-label">Members</div>
              </div>
              <div className="text-center">
                <div className="stat-value stat-value-viewer">
                  {userStats.viewer_count || 0}
                </div>
                <div className="stat-label">Viewers</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {auditStats?.daily_activity && (
        <div className="card">
          <div className="card-header">
            <h4 className="mb-0">Recent Activity (Last 7 Days)</h4>
          </div>
          <div className="card-body">
            <div className="activity-list">
              {auditStats.daily_activity.slice(0, 5).map((day, index) => (
                <div key={index} className="activity-item">
                  <span className="activity-date font-semibold">{day.date}</span>
                  <div className="activity-stats">
                    <span className="activity-stat">Tasks: {day.operations}</span>
                    <span className="activity-stat">Auth: {day.auth_events}</span>
                    <span className="activity-stat">System: {day.system_events}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Users Tab Component
const UsersTab = () => {
  return <UserManagement />;
};

// Teams Tab Component
const TeamsTab = () => {
  return <TeamManagement />;
};

// Audit Tab Component
const AuditTab = () => {
  return <AuditLogViewer />;
};

// Notifications Tab Component
const NotificationsTab = () => {
  return (
    <div>
      <h3 className="mb-4">Notification System</h3>
      <div className="card">
        <div className="card-body">
          <div className="text-center py-4">
            <div className="mb-3">
              <span className="text-success" style={{ fontSize: '3rem' }}>Active</span>
            </div>
            <h4 className="mb-2">Notification System Active</h4>
            <p className="text-muted mb-4">
              The notification system is fully operational and integrated throughout the application.
            </p>
            <div className="notification-features">
              <div className="feature-list">
                <div className="feature-item">
                  <span className="feature-icon">Bell</span>
                  <span>Real-time notifications for task updates</span>
                </div>
                <div className="feature-item">
                  <span className="feature-icon">Email</span>
                  <span>Email notifications for assignments</span>
                </div>
                <div className="feature-item">
                  <span className="feature-icon">♿</span>
                  <span>Accessible notifications with screen reader support</span>
                </div>
                <div className="feature-item">
                  <span className="feature-icon">Theme</span>
                  <span>Consistent styling with dark theme</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;