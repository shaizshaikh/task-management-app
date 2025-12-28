/**
 * Real-Time System Monitor Component
 * Admin-only component for monitoring WebSocket connections and system activity
 */

import React, { useEffect } from 'react';
import { useAdminRealtime } from '../../hooks/useRealtime';

const RealtimeMonitor = () => {
  const { connectionStats, requestStats } = useAdminRealtime();

  // Request stats on component mount and periodically
  useEffect(() => {
    requestStats();
  }, [requestStats]);



  return (
    <div className="card">
      <div className="card-header">
        <h3 className="mb-0">🔄 Real-Time System Monitor</h3>
        <p className="text-sm text-secondary mt-1 mb-0">
          Live connection statistics and system status
        </p>
      </div>
      <div className="card-body">

        {/* Connection Statistics */}
        {connectionStats && (
          <div className="dashboard-grid mb-4">
            <div className="stat-card info">
              <div className="stat-value">
                {connectionStats.total_connections}
              </div>
              <div className="stat-label">Total Connections</div>
            </div>

            <div className="stat-card success">
              <div className="stat-value">
                {connectionStats.unique_users}
              </div>
              <div className="stat-label">Unique Users</div>
            </div>

            <div className="stat-card warning">
              <div className="stat-value">
                {connectionStats.teams_with_active_users}
              </div>
              <div className="stat-label">Active Teams</div>
            </div>
          </div>
        )}

        {/* Role Distribution */}
        {connectionStats?.roles && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-secondary mb-2">
              Connected Users by Role
            </h4>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(connectionStats.roles).map(([role, count]) => (
                <span
                  key={role}
                  className={`badge badge-${role}`}
                >
                  {role}: {count}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Status Info */}
        <div className="flex justify-between items-center text-sm text-secondary">
          <span>Auto-refreshes every 30 seconds</span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={requestStats}
          >
            🔄 Refresh
          </button>
        </div>

        {/* No Data State */}
        {!connectionStats && (
          <div className="text-center p-4">
            <div className="loading"></div>
            <p className="mt-2 text-secondary">Loading connection statistics...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RealtimeMonitor;