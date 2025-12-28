/**
 * Member Dashboard Component
 * Simple dashboard for members and viewers showing team-scoped statistics
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useRealtime } from '../hooks/useRealtime';

const MemberDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    total_tasks: 0,
    completed_tasks: 0,
    in_progress_tasks: 0,
    todo_tasks: 0,
    overdue_tasks: 0,
    high_priority_tasks: 0,
    total_teams: 0,
    total_users: 0
  });
  const [loading, setLoading] = useState(true);

  // Real-time stats refresh
  const refreshStats = useCallback(() => {
    loadStats();
  }, []);

  // Listen for real-time events
  const { subscribe } = useRealtime();
  
  useEffect(() => {
    const unsubscribeTask = subscribe('taskCreated', refreshStats);
    const unsubscribeUpdate = subscribe('taskUpdated', refreshStats);
    const unsubscribeDelete = subscribe('taskDeleted', refreshStats);

    return () => {
      unsubscribeTask();
      unsubscribeUpdate();
      unsubscribeDelete();
    };
  }, [subscribe, refreshStats]);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      
      // Use centralized stats endpoint that provides role-filtered data
      const response = await axios.get('/api/stats');
      setStats(response.data);
      
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
      toast.error('Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="card mb-4">
        <div className="card-body text-center">
          <div className="loading"></div>
          <p className="mt-2">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card mb-4">
      <div className="card-header">
        <h3 className="mb-0">My Team Dashboard</h3>
        <p className="text-sm text-secondary mt-1 mb-0">
          Overview of your team activities and progress
        </p>
      </div>
      <div className="card-body">
        <div className="dashboard-grid">
          {/* Total Tasks */}
          <div className="stat-card info">
            <div className="stat-value">
              {stats.total_tasks}
            </div>
            <div className="stat-label">Total Tasks</div>
          </div>

          {/* Completed Tasks */}
          <div className="stat-card success">
            <div className="stat-value">
              {stats.completed_tasks}
            </div>
            <div className="stat-label">Completed</div>
          </div>

          {/* In Progress Tasks */}
          <div className="stat-card warning">
            <div className="stat-value">
              {stats.in_progress_tasks}
            </div>
            <div className="stat-label">In Progress</div>
          </div>

          {/* Todo Tasks */}
          <div className="stat-card">
            <div className="stat-value stat-value-secondary">
              {stats.todo_tasks}
            </div>
            <div className="stat-label">To Do</div>
          </div>

          {/* Overdue Tasks */}
          {stats.overdue_tasks > 0 && (
            <div className="stat-card error">
              <div className="stat-value">
                {stats.overdue_tasks}
              </div>
              <div className="stat-label">Overdue</div>
            </div>
          )}

          {/* High Priority Tasks */}
          {stats.high_priority_tasks > 0 && (
            <div className="stat-card stat-card-error">
              <div className="stat-value stat-value-error">
                {stats.high_priority_tasks}
              </div>
              <div className="stat-label">High Priority</div>
            </div>
          )}

          {/* Team Info */}
          <div className="stat-card primary">
            <div className="stat-value">
              {stats.total_teams}
            </div>
            <div className="stat-label">My Teams</div>
          </div>

          {/* Team Members */}
          <div className="stat-card">
            <div className="stat-value">
              {stats.total_users}
            </div>
            <div className="stat-label">Team Members</div>
          </div>
        </div>

        <>
          {/* Progress Bar */}
          {stats.total_tasks > 0 && (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-secondary">
                  Progress: {Math.round((stats.completed_tasks / stats.total_tasks) * 100)}% Complete
                </span>
                <span className="text-sm text-secondary">
                  {stats.completed_tasks} of {stats.total_tasks} tasks
                </span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ '--progress-width': `${(stats.completed_tasks / stats.total_tasks) * 100}%` }}
                  role="progressbar"
                  aria-valuenow={Math.round((stats.completed_tasks / stats.total_tasks) * 100)}
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-label={`${Math.round((stats.completed_tasks / stats.total_tasks) * 100)}% of tasks completed`}
                />
              </div>
            </div>
          )}

          <div className="mt-4 text-center">
            <p className="text-sm text-tertiary">
              Showing data for your teams only • Role: <span className={`badge badge-${user?.global_role || 'viewer'}`}>{user?.global_role}</span>
            </p>
          </div>
        </>
      </div>
    </div>
  );
};

export default MemberDashboard;