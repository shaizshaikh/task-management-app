/**
 * Audit Log Viewer Component
 * Admin interface for viewing system audit logs
 * WCAG 2.2 Compliant with Consistent Design System
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const AuditLogViewer = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    log_type: '',
    user_id: '',
    username: '',
    action: '',
    resource_type: '',
    start_date: '',
    end_date: '',
    limit: 50,
    offset: 0
  });
  const [pagination, setPagination] = useState({
    total: 0,
    has_more: false
  });

  useEffect(() => {
    loadAuditLogs();
  }, [filters]);

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      const params = Object.fromEntries(
        Object.entries(filters).filter(([_, value]) => value !== '')
      );
      
      console.log('🔍 Loading audit logs with params:', params);
      const response = await axios.get('/api/audit', { params });
      console.log('✅ Audit logs response:', response.data);
      
      setLogs(response.data.logs || []);
      setPagination({
        total: response.data.pagination?.total || 0,
        has_more: response.data.pagination?.has_more || false
      });
    } catch (error) {
      console.error('❌ Error loading audit logs:', error);
      console.error('Error details:', error.response?.data);
      
      // Provide more specific error messages
      if (error.response?.status === 403) {
        toast.error('Access denied: Admin or manager role required');
      } else if (error.response?.status === 500) {
        toast.error('Server error: Please check database connection');
      } else {
        toast.error('Failed to load audit logs');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      offset: 0 // Reset pagination when filters change
    }));
  };

  const handleExport = async () => {
    try {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([_, value]) => value !== '' && value !== 0)
      );
      
      const response = await axios.get('/api/audit/export', { 
        params,
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Audit logs exported successfully');
    } catch (error) {
      console.error('Error exporting audit logs:', error);
      toast.error('Failed to export audit logs');
    }
  };

  const getLogTypeColor = (logType) => {
    switch (logType) {
      case 'operation': return '#2196F3';
      case 'authentication': return '#4CAF50';
      case 'system': return '#FF9800';
      default: return '#666';
    }
  };

  const getActionColor = (action) => {
    if (action.includes('CREATE')) return '#4CAF50';
    if (action.includes('UPDATE')) return '#FF9800';
    if (action.includes('DELETE')) return '#F44336';
    if (action.includes('login')) return '#2196F3';
    if (action.includes('failed') || action.includes('unauthorized')) return '#F44336';
    return '#666';
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatJsonData = (data) => {
    if (!data) return 'N/A';
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  return (
    <div>
      {/* Header */}
      <header className="page-header">
        <div>
          <h2 className="mb-0">📜 Audit Logs</h2>
          <p className="text-sm text-secondary mt-1">
            System activity and security audit trail
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-secondary"
            onClick={loadAuditLogs}
            aria-label="Refresh audit logs"
          >
            🔄 Refresh
          </button>
          <button
            className="btn btn-primary"
            onClick={handleExport}
            aria-label="Export audit logs as CSV"
          >
            📥 Export CSV
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-header">
          <h3 className="mb-0">Filters</h3>
        </div>
        <div className="card-body">
          <div className="dashboard-grid mb-3">
            <select
              className="form-input"
              value={filters.log_type}
              onChange={(e) => handleFilterChange('log_type', e.target.value)}
              aria-label="Filter by log type"
            >
              <option value="">All Log Types</option>
              <option value="operation">Operations</option>
              <option value="authentication">Authentication</option>
              <option value="system">System Events</option>
            </select>

            <input
              type="text"
              className="form-input"
              placeholder="Username"
              value={filters.username}
              onChange={(e) => handleFilterChange('username', e.target.value)}
              aria-label="Filter by username"
            />

            <input
              type="text"
              className="form-input"
              placeholder="Action"
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              aria-label="Filter by action"
            />

            <select
              className="form-input"
              value={filters.resource_type}
              onChange={(e) => handleFilterChange('resource_type', e.target.value)}
              aria-label="Filter by resource type"
            >
              <option value="">All Resources</option>
              <option value="task">Tasks</option>
              <option value="team">Teams</option>
              <option value="user">Users</option>
              <option value="comment">Comments</option>
              <option value="attachment">Attachments</option>
            </select>
          </div>

          <div className="dashboard-grid">
            <input
              type="date"
              className="form-input"
              value={filters.start_date}
              onChange={(e) => handleFilterChange('start_date', e.target.value)}
              aria-label="Start date filter"
            />

            <input
              type="date"
              className="form-input"
              value={filters.end_date}
              onChange={(e) => handleFilterChange('end_date', e.target.value)}
              aria-label="End date filter"
            />

            <select
              className="form-input"
              value={filters.limit}
              onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
              aria-label="Results per page"
            >
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Info */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-secondary">
          Showing {logs.length} of {pagination.total} logs
        </span>
        
        {/* Pagination */}
        <div className="flex gap-2">
          <button
            className="btn btn-secondary"
            onClick={() => handleFilterChange('offset', Math.max(0, filters.offset - filters.limit))}
            disabled={filters.offset === 0}
            aria-label="Previous page"
          >
            ← Previous
          </button>
          
          <button
            className="btn btn-secondary"
            onClick={() => handleFilterChange('offset', filters.offset + filters.limit)}
            disabled={!pagination.has_more}
            aria-label="Next page"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Audit Logs */}
      {loading ? (
        <div className="card">
          <div className="card-body text-center">
            <div className="loading"></div>
            <p className="mt-2">Loading audit logs...</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body p-0">
            {logs.map((log, index) => (
              <article 
                key={index} 
                className={`audit-log-item ${index < logs.length - 1 ? 'border-bottom' : ''}`}
              >
                <header className="audit-log-header">
                  <div className="audit-badges">
                    <span 
                      className="badge"
                      style={{ backgroundColor: getLogTypeColor(log.log_type) }}
                    >
                      {log.log_type}
                    </span>
                    
                    <span 
                      className="badge"
                      style={{ backgroundColor: getActionColor(log.action) }}
                    >
                      {log.action}
                    </span>

                    {log.resource_type && (
                      <span className="badge badge-secondary">
                        {log.resource_type}:{log.resource_id}
                      </span>
                    )}
                  </div>

                  <time className="audit-timestamp text-sm text-secondary">
                    {formatTimestamp(log.timestamp)}
                  </time>
                </header>

                <div className="audit-user mb-2">
                  <strong>{log.full_name || log.username || 'System'}</strong>
                  {log.ip_address && (
                    <span className="text-sm text-secondary ml-2">
                      from {log.ip_address}
                    </span>
                  )}
                </div>

                {(log.old_values || log.new_values || log.error_message) && (
                  <details className="audit-details">
                    <summary className="audit-summary">
                      View Details
                    </summary>
                    <div className="audit-details-content">
                      {log.old_values && (
                        <div className="mb-3">
                          <h4 className="text-sm font-semibold mb-1">Old Values:</h4>
                          <pre className="audit-json">
                            {formatJsonData(log.old_values)}
                          </pre>
                        </div>
                      )}
                      
                      {log.new_values && (
                        <div className="mb-3">
                          <h4 className="text-sm font-semibold mb-1">New Values:</h4>
                          <pre className="audit-json">
                            {formatJsonData(log.new_values)}
                          </pre>
                        </div>
                      )}

                      {log.error_message && (
                        <div>
                          <h4 className="text-sm font-semibold mb-1">Error:</h4>
                          <div className="audit-error">
                            {log.error_message}
                          </div>
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </article>
            ))}

            {logs.length === 0 && (
              <div className="text-center p-4">
                <p className="text-secondary">
                  No audit logs found matching your filters.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogViewer;