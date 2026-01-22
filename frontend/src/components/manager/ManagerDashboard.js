/**
 * Manager Dashboard Component
 * Overview dashboard for team leaders showing key metrics and recent activity
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useRealtime } from '../../hooks/useRealtime';

const ManagerDashboard = ({ teams, onRefresh }) => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    overdueTasks: 0,
    totalTeamMembers: 0,
    recentTasks: [],
    teamStats: []
  });
  const [loading, setLoading] = useState(true);

  // Real-time dashboard refresh
  const refreshDashboard = useCallback(() => {
    loadDashboardData();
  }, [teams]);

  // Listen for real-time events
  const { subscribe } = useRealtime();
  
  useEffect(() => {
    const unsubscribeTask = subscribe('taskCreated', refreshDashboard);
    const unsubscribeUpdate = subscribe('taskUpdated', refreshDashboard);
    const unsubscribeDelete = subscribe('taskDeleted', refreshDashboard);

    return () => {
      unsubscribeTask();
      unsubscribeUpdate();
      unsubscribeDelete();
    };
  }, [subscribe, refreshDashboard]);

  useEffect(() => {
    loadDashboardData();
  }, [teams]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Use centralized stats endpoint that provides role-filtered data
      const statsResponse = await axios.get('/api/stats');
      const stats = statsResponse.data;
      
      // Get recent tasks for managed teams only
      const teamIds = teams.map(team => team.id);
      const taskPromises = teamIds.map(teamId => 
        axios.get(`/api/tasks/team/${teamId}`)
      );
      
      const taskResponses = await Promise.all(taskPromises);
      const allTasks = taskResponses.flatMap(response => response.data.tasks || []);
      
      // Get recent tasks (last 10)
      const recentTasks = allTasks
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 10);
      
      // Calculate total team members from managed teams
      const totalTeamMembers = teams.reduce((total, team) => 
        total + (team.members?.length || 0), 0
      );
      
      // Calculate per-team statistics
      const teamStats = teams.map(team => {
        const teamTasks = allTasks.filter(task => task.team_id === team.id);
        return {
          ...team,
          taskCount: teamTasks.length,
          completedCount: teamTasks.filter(task => task.status === 'done').length,
          pendingCount: teamTasks.filter(task => task.status === 'todo' || task.status === 'in-progress').length,
          memberCount: team.members?.length || 0
        };
      });
      
      // Use role-filtered stats from backend
      setDashboardData({
        totalTasks: stats.total_tasks,
        completedTasks: stats.completed_tasks,
        pendingTasks: stats.in_progress_tasks + stats.todo_tasks,
        overdueTasks: stats.overdue_tasks,
        totalTeamMembers,
        recentTasks,
        teamStats
      });
      
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getTaskStatusColor = (status) => {
    switch (status) {
      case 'done': return '#4CAF50';
      case 'in-progress': return '#ff9800';
      case 'todo': return '#2196F3';
      default: return '#666';
    }
  };

  const getTaskPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#f44336';
      case 'medium': return '#ff9800';
      case 'low': return '#4CAF50';
      default: return '#666';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusDisplayText = (status) => {
    switch (status) {
      case 'todo': return 'Pending';
      case 'in-progress': return 'In Progress';
      case 'done': return 'Completed';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="loading-layout">
        <div className="loading-text">Loading dashboard...</div>
        <div className="auth-loading-spinner"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Overview Cards */}
      <div className="profile-stats-grid manager-stats-grid">
        <div className="profile-stat-card">
          <div className="profile-stat-value stat-value-primary">
            {dashboardData.totalTasks}
          </div>
          <div className="profile-stat-label">Total Tasks</div>
        </div>

        <div className="profile-stat-card">
          <div className="profile-stat-value stat-value-success">
            {dashboardData.completedTasks}
          </div>
          <div className="profile-stat-label">Completed</div>
        </div>

        <div className="profile-stat-card">
          <div className="profile-stat-value stat-value-warning">
            {dashboardData.pendingTasks}
          </div>
          <div className="profile-stat-label">In Progress</div>
        </div>

        <div className="profile-stat-card">
          <div className="profile-stat-value stat-value-error">
            {dashboardData.overdueTasks}
          </div>
          <div className="profile-stat-label">Overdue</div>
        </div>

        <div className="profile-stat-card">
          <div className="profile-stat-value stat-value-purple">
            {dashboardData.totalTeamMembers}
          </div>
          <div className="profile-stat-label">Team Members</div>
        </div>
      </div>

      <div className="manager-dashboard-grid">
        {/* Team Statistics */}
        <div className="manager-dashboard-section">
          <h3 className="manager-dashboard-section-title">
            Team Performance
          </h3>
          
          {dashboardData.teamStats.map(team => (
            <div 
              key={team.id} 
              className="manager-team-stat-card"
              style={{ borderLeftColor: team.color || '#2196F3' }}
            >
              <div className="manager-team-stat-header">
                <h4 className="manager-team-stat-name">{team.name}</h4>
                <span className="manager-team-stat-members">
                  {team.memberCount} members
                </span>
              </div>
              
              <div className="manager-team-stat-metrics">
                <span className="manager-team-stat-metric stat-metric-primary">
                  Tasks: {team.taskCount}
                </span>
                <span className="manager-team-stat-metric stat-metric-success">
                  Done: {team.completedCount}
                </span>
                <span className="manager-team-stat-metric stat-metric-warning">
                  ⏳ {team.pendingCount} pending
                </span>
              </div>
              
              {/* Progress bar */}
              <div className="manager-team-progress-container">
                <div 
                  className="manager-team-progress-bar"
                  style={{ '--progress-width': `${team.taskCount > 0 ? (team.completedCount / team.taskCount) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Tasks */}
        <div className="manager-dashboard-section">
          <h3 className="manager-dashboard-section-title">
            🕒 Recent Tasks
          </h3>
          
          {dashboardData.recentTasks.length === 0 ? (
            <div className="manager-recent-tasks-empty">
              No recent tasks
            </div>
          ) : (
            <div className="manager-recent-tasks-list">
              {dashboardData.recentTasks.map(task => (
                <div 
                  key={task.id} 
                  className="manager-recent-task-item"
                  style={{ borderLeftColor: getTaskStatusColor(task.status) }}
                >
                  <div className="manager-recent-task-header">
                    <h4 className="manager-recent-task-title">
                      {task.title}
                    </h4>
                    <span className="manager-recent-task-date">
                      {formatDate(task.created_at)}
                    </span>
                  </div>
                  
                  <div className="manager-recent-task-meta">
                    <span 
                      className="manager-recent-task-status"
                      style={{ color: getTaskStatusColor(task.status) }}
                    >
                      {getStatusDisplayText(task.status)}
                    </span>
                    <span 
                      className="manager-recent-task-priority"
                      style={{ color: getTaskPriorityColor(task.priority) }}
                    >
                      {task.priority} priority
                    </span>
                    {task.assigned_to_name && (
                      <span className="manager-recent-task-assignee">
                        👤 {task.assigned_to_name}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;