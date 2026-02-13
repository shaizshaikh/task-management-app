/**
 * Import History View Component
 * Shows history of user import operations
 */

import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import useFocusTrap from '../../hooks/useFocusTrap';

const ImportHistoryView = ({ onClose }) => {
  const [importHistory, setImportHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0,
    has_more: false
  });

  // Use focus trap hook with escape handler
  const modalRef = useFocusTrap(true, onClose);

  useEffect(() => {
    loadImportHistory();
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = '';
    };
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
      case 'completed': return 'Success';
      case 'partial': return 'Warning';
      case 'failed': return 'Error';
      case 'in_progress': return 'Loading';
      default: return 'Unknown';
    }
  };

  const getStatusBadge = (status) => {
    const color = getStatusColor(status);
    const icon = getStatusIcon(status);
    return (
      <span 
        className="status-badge"
        style={{ backgroundColor: color }}
      >
        {icon} {status}
      </span>
    );
  };

  return (
    <div className="modal-overlay">
      <div ref={modalRef} className="modal-content import-history-modal" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="import-history-title">
        {/* Header */}
        <div className="modal-header">
          <h2 id="import-history-title" className="modal-title">
            Import History ({pagination.total})
          </h2>
          <button
            onClick={onClose}
            className="modal-close-button"
            aria-label="Close import history view"
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div className="modal-body">
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner" aria-hidden="true"></div>
              <div>Loading import history...</div>
            </div>
          ) : importHistory.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon" aria-hidden="true">No Imports</div>
              <h3 className="empty-state-title">No import history found</h3>
              <p>No user imports have been performed yet.</p>
            </div>
          ) : (
            <>
              {/* Accessible HTML Table */}
              <div className="table-container">
                <table className="data-table" role="table" aria-label="Import history">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">File</th>
                      <th scope="col">Status</th>
                      <th scope="col">Total</th>
                      <th scope="col">Success</th>
                      <th scope="col">Failed</th>
                      <th scope="col">Duration</th>
                      <th scope="col">Admin</th>
                      <th scope="col">Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importHistory.map(operation => (
                      <tr key={operation.id}>
                        {/* Date */}
                        <td data-label="Date">
                          <div className="date-display">
                            <div className="date-day">
                              {formatDate(operation.started_at).split(' ')[0]}
                            </div>
                            <div className="date-time">
                              {formatDate(operation.started_at).split(' ')[1]}
                            </div>
                          </div>
                        </td>

                        {/* File */}
                        <td data-label="File">
                          <span className="filename" title={operation.file_name}>
                            {operation.file_name || 'Unknown'}
                          </span>
                        </td>

                        {/* Status */}
                        <td data-label="Status">
                          {getStatusBadge(operation.status)}
                        </td>

                        {/* Total */}
                        <td data-label="Total">
                          <span className="stat-number total">
                            {operation.affected_users_count || 0}
                          </span>
                        </td>

                        {/* Success */}
                        <td data-label="Success">
                          <span className="stat-number success">
                            {operation.successful_count || 0}
                          </span>
                        </td>

                        {/* Failed */}
                        <td data-label="Failed">
                          <span className={`stat-number ${operation.failed_count > 0 ? 'failed' : ''}`}>
                            {operation.failed_count || 0}
                          </span>
                        </td>

                        {/* Duration */}
                        <td data-label="Duration">
                          <span className="duration">
                            {formatDuration(operation.duration_seconds)}
                          </span>
                        </td>

                        {/* Admin */}
                        <td data-label="Admin">
                          <div className="user-info">
                            <div className="user-name">
                              {operation.admin_full_name || 'Unknown'}
                            </div>
                            <div className="user-username">
                              @{operation.admin_username || 'unknown'}
                            </div>
                          </div>
                        </td>

                        {/* Size */}
                        <td data-label="Size">
                          <span className="file-size">
                            {formatFileSize(operation.file_size)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.total > pagination.limit && (
                <div className="table-pagination">
                  <button
                    onClick={() => handlePageChange(Math.max(0, pagination.offset - pagination.limit))}
                    disabled={pagination.offset === 0}
                    className="btn btn-secondary"
                    aria-label="Go to previous page"
                  >
                    Previous
                  </button>
                  
                  <span className="pagination-info">
                    Showing {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total}
                  </span>
                  
                  <button
                    onClick={() => handlePageChange(pagination.offset + pagination.limit)}
                    disabled={!pagination.has_more}
                    className="btn btn-secondary"
                    aria-label="Go to next page"
                  >
                    Next
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