import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/stats');
      setStats(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="card">
          <div className="card-body text-center">
            <div className="loading"></div>
            <p className="mt-2">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="page-container">
        <div className="alert alert-error">
          <span className="alert-icon" aria-hidden="true">⚠️</span>
          Failed to load dashboard data. Please try refreshing the page.
        </div>
      </div>
    );
  }

  const completionRate = stats.total_tasks > 0 ? Math.round((stats.done_count / stats.total_tasks) * 100) : 0;

  return (
    <div className="page-container">
      {/* Page Header */}
      <header className="page-header">
        <div>
          <h2 className="page-title">📊 Project Dashboard</h2>
          <p className="page-subtitle">
            Overview of tasks, progress, and team performance
          </p>
        </div>
      </header>

      {/* Statistics Grid */}
      <div className="dashboard-grid mb-4">
        {/* Total Tasks */}
        <div className="stat-card info">
          <div className="stat-value">{stats.total_tasks}</div>
          <div className="stat-label">Total Tasks</div>
          <div className="stat-icon" aria-hidden="true">📋</div>
        </div>

        {/* Completion Rate */}
        <div className="stat-card success">
          <div className="stat-value">{completionRate}%</div>
          <div className="stat-label">Completion Rate</div>
          <div className="stat-icon" aria-hidden="true">✅</div>
        </div>

        {/* In Progress */}
        <div className="stat-card warning">
          <div className="stat-value">{stats.in_progress_count}</div>
          <div className="stat-label">In Progress</div>
          <div className="stat-icon" aria-hidden="true">⚡</div>
        </div>

        {/* Overdue Tasks */}
        <div className={`stat-card ${stats.overdue_count > 0 ? 'error' : 'success'}`}>
          <div className="stat-value">{stats.overdue_count}</div>
          <div className="stat-label">Overdue Tasks</div>
          <div className="stat-icon" aria-hidden="true">
            {stats.overdue_count > 0 ? '⚠️' : '✨'}
          </div>
        </div>
      </div>

      {/* Progress Breakdown Card */}
      <div className="card mb-4">
        <div className="card-header">
          <h3 className="mb-0">Task Status Breakdown</h3>
        </div>
        <div className="card-body">
          {/* Status Legend */}
          <div className="status-legend">
            <div className="legend-item">
              <div className="legend-color legend-color-info"></div>
              <span className="legend-label">To Do: {stats.todo_count}</span>
            </div>
            <div className="legend-item">
              <div className="legend-color legend-color-warning"></div>
              <span className="legend-label">In Progress: {stats.in_progress_count}</span>
            </div>
            <div className="legend-item">
              <div className="legend-color legend-color-success"></div>
              <span className="legend-label">Done: {stats.done_count}</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="progress-container">
            <div className="progress-bar">
              <div 
                className="progress-segment progress-todo"
                style={{ '--progress-width': `${stats.total_tasks > 0 ? (stats.todo_count / stats.total_tasks) * 100 : 0}%` }}
                aria-label={`To Do: ${stats.todo_count} tasks`}
              ></div>
              <div 
                className="progress-segment progress-in-progress"
                style={{ '--progress-width': `${stats.total_tasks > 0 ? (stats.in_progress_count / stats.total_tasks) * 100 : 0}%` }}
                aria-label={`In Progress: ${stats.in_progress_count} tasks`}
              ></div>
              <div 
                className="progress-segment progress-done"
                style={{ '--progress-width': `${stats.total_tasks > 0 ? (stats.done_count / stats.total_tasks) * 100 : 0}%` }}
                aria-label={`Done: ${stats.done_count} tasks`}
              ></div>
            </div>
          </div>

          {/* Progress Summary */}
          <div className="progress-summary">
            <p className="text-sm text-secondary">
              {stats.total_tasks > 0 ? (
                <>
                  <strong>{completionRate}%</strong> of tasks completed • 
                  <strong> {stats.in_progress_count}</strong> in progress • 
                  <strong> {stats.todo_count}</strong> remaining
                </>
              ) : (
                'No tasks created yet'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Priority Distribution Card */}
      <div className="card">
        <div className="card-header">
          <h3 className="mb-0">Priority Distribution</h3>
        </div>
        <div className="card-body">
          <div className="priority-grid">
            <div className="priority-item">
              <div className="priority-indicator high-priority"></div>
              <div className="priority-content">
                <div className="priority-count">{stats.high_priority_count}</div>
                <div className="priority-label">High Priority</div>
              </div>
            </div>
            <div className="priority-item">
              <div className="priority-indicator medium-priority"></div>
              <div className="priority-content">
                <div className="priority-count">{stats.total_tasks - stats.high_priority_count}</div>
                <div className="priority-label">Medium/Low Priority</div>
              </div>
            </div>
          </div>

          {stats.high_priority_count > 0 && (
            <div className="alert alert-warning mt-3">
              <span className="alert-icon" aria-hidden="true">⚡</span>
              You have <strong>{stats.high_priority_count}</strong> high-priority task{stats.high_priority_count !== 1 ? 's' : ''} that need attention.
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .status-legend {
          display: flex;
          gap: var(--spacing-lg);
          margin-bottom: var(--spacing-lg);
          flex-wrap: wrap;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
        }

        .legend-color {
          width: 16px;
          height: 16px;
          border-radius: var(--radius-sm);
          flex-shrink: 0;
        }

        .legend-label {
          font-size: 0.875rem;
          color: var(--text-primary);
          font-weight: 500;
        }

        .progress-container {
          margin-bottom: var(--spacing-lg);
        }

        .progress-bar {
          width: 100%;
          height: 24px;
          background-color: var(--bg-quaternary);
          border-radius: var(--radius-xl);
          overflow: hidden;
          display: flex;
          border: 1px solid var(--border-secondary);
          position: relative;
        }

        .progress-segment {
          height: 100%;
          transition: width 0.3s ease-in-out;
          position: relative;
        }

        .progress-todo {
          background: linear-gradient(90deg, var(--color-info) 0%, var(--color-info-light) 100%);
        }

        .progress-in-progress {
          background: linear-gradient(90deg, var(--color-warning) 0%, var(--color-warning-light) 100%);
        }

        .progress-done {
          background: linear-gradient(90deg, var(--color-success) 0%, var(--color-success-light) 100%);
        }

        .progress-summary {
          text-align: center;
        }

        .priority-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--spacing-lg);
        }

        .priority-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-lg);
          background-color: var(--bg-tertiary);
          border: 1px solid var(--border-secondary);
          border-radius: var(--radius-lg);
          transition: all var(--animation-duration) ease-in-out;
        }

        .priority-item:hover {
          background-color: var(--bg-quaternary);
          border-color: var(--border-hover);
          transform: translateY(-2px);
        }

        .priority-indicator {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .high-priority {
          background-color: var(--color-error);
          box-shadow: 0 0 8px rgba(248, 81, 73, 0.4);
        }

        .medium-priority {
          background-color: var(--color-warning);
          box-shadow: 0 0 8px rgba(210, 153, 34, 0.4);
        }

        .priority-content {
          flex: 1;
        }

        .priority-count {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1;
        }

        .priority-label {
          font-size: 0.875rem;
          color: var(--text-secondary);
          font-weight: 500;
        }

        .stat-icon {
          position: absolute;
          top: var(--spacing-md);
          right: var(--spacing-md);
          font-size: 1.5rem;
          opacity: 0.7;
        }

        /* Mobile Responsive */
        @media (max-width: 768px) {
          .status-legend {
            flex-direction: column;
            gap: var(--spacing-sm);
          }

          .priority-grid {
            grid-template-columns: 1fr;
          }
        }

        /* High Contrast Mode */
        @media (prefers-contrast: high) {
          .progress-bar {
            border: 2px solid var(--text-primary);
          }

          .priority-item {
            border: 2px solid var(--border-primary);
          }
        }

        /* Reduced Motion */
        @media (prefers-reduced-motion: reduce) {
          .progress-segment {
            transition: none;
          }

          .priority-item {
            transition: none;
          }

          .priority-item:hover {
            transform: none;
          }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;