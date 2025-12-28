/**
 * Import History View Component
 * Shows history of user import operations
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const ImportHistoryView = ({ onClose }) => {
  const [importHistory, setImportHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0,
    has_more: false
  });

  useEffect(() => {
    loadImportHistory();
  }, []);

  const loadImportHistory = async (offset = 0) => {
    try {
      setLoading(true);
      const response = await axios.get('/api/users/import/history', {
        params: {
          limit: pagination.limit,
          offset: offset
        }
      });
      
      setImportHistory(response.data.import_history || []);
      setPagination(response.data.pagination || {});
    } catch (error) {
      console.error('Error loading import history:', error);
      toast.error('Failed to load import history');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newOffset) => {
    loadImportHistory(newOffset);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'Unknown';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#4caf50';
      case 'partial': return '#ff9800';
      case 'failed': return '#f44336';
      case 'in_progress': return '#2196f3';
      default: return '#666';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return '✅';
      case 'partial': return '⚠️';
      case 'failed': return '❌';
      case 'in_progress': return '🔄';
      default: return '❓';
    }
  };

  const getStatusBadge = (status) => {
    const color = getStatusColor(status);
    const icon = getStatusIcon(status);
    return (
      <span 
        className="import-history-status-badge"
        style={{ backgroundColor: color }}
      >
        {icon} {status}
      </span>
    );
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content import-history-modal">
        {/* Header */}
        <div className="import-history-header">
          <h2 className="import-history-title">
            📥 Import History ({pagination.total})
          </h2>
          <button
            onClick={onClose}
            className="import-history-close-button"
          >
            ✕ Close
          </button>
        </div>

        {/* Content */}
        <div className="import-history-content">
          {loading ? (
            <div className="import-history-loading">
              <div className="import-history-loading-icon">🔄</div>
              <div>Loading import history...</div>
            </div>
          ) : importHistory.length === 0 ? (
            <div className="import-history-empty">
              <div className="import-history-empty-icon">📥</div>
              <h3 className="import-history-empty-title">No import history found</h3>
              <p>No user imports have been performed yet.</p>
            </div>
          ) : (
            <>
              {/* History Table */}
              <div className="import-history-table">
                {/* Table Header */}
                <div className="import-history-table-header">
                  <div>Date</div>
                  <div>File</div>
                  <div>Status</div>
                  <div>Total</div>
                  <div>Success</div>
                  <div>Failed</div>
                  <div>Duration</div>
                  <div>Admin</div>
                  <div>Size</div>
                </div>

                {/* Table Rows */}
                {importHistory.map(operation => (
                  <div key={operation.id} className="import-history-table-row">
                    {/* Date */}
                    <div className="import-history-date">
                      <div className="import-history-date-day">
                        {formatDate(operation.started_at).split(' ')[0]}
                      </div>
                      <div className="import-history-date-time">
                        {formatDate(operation.started_at).split(' ')[1]}
                      </div>
                    </div>

                    {/* File */}
                    <div className="import-history-file">
                      <div className="import-history-filename" title={operation.file_name}>
                        {operation.file_name || 'Unknown'}
                      </div>
                    </div>

                    {/* Status */}
                    <div>
                      {getStatusBadge(operation.status)}
                    </div>

                    {/* Total */}
                    <div className="import-history-stat total">
                      {operation.affected_users_count || 0}
                    </div>

                    {/* Success */}
                    <div className="import-history-stat success">
                      {operation.successful_count || 0}
                    </div>

                    {/* Failed */}
                    <div className={`import-history-stat ${operation.failed_count > 0 ? 'failed' : ''}`}>
                      {operation.failed_count || 0}
                    </div>

                    {/* Duration */}
                    <div className="import-history-duration">
                      {formatDuration(operation.duration_seconds)}
                    </div>

                    {/* Admin */}
                    <div className="import-history-admin">
                      <div className="import-history-admin-name">
                        {operation.admin_full_name || 'Unknown'}
                      </div>
                      <div className="import-history-admin-username">
                        @{operation.admin_username || 'unknown'}
                      </div>
                    </div>

                    {/* Size */}
                    <div className="import-history-filesize">
                      {formatFileSize(operation.file_size)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pagination.total > pagination.limit && (
                <div className="import-history-pagination">
                  <button
                    onClick={() => handlePageChange(Math.max(0, pagination.offset - pagination.limit))}
                    disabled={pagination.offset === 0}
                    className="import-history-pagination-button"
                  >
                    ← Previous
                  </button>
                  
                  <span className="import-history-pagination-info">
                    Showing {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total}
                  </span>
                  
                  <button
                    onClick={() => handlePageChange(pagination.offset + pagination.limit)}
                    disabled={!pagination.has_more}
                    className="import-history-pagination-button"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportHistoryView;