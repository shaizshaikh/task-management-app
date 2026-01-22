/**
 * Deleted Users View Component
 * Shows soft-deleted users with restoration options
 */

import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const DeletedUsersView = ({ onClose }) => {
  const [deletedUsers, setDeletedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(null);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    has_more: false
  });

  useEffect(() => {
    loadDeletedUsers();
  }, []);

  const loadDeletedUsers = async (offset = 0) => {
    try {
      setLoading(true);
      const response = await axios.get('/api/users/deleted', {
        params: {
          limit: pagination.limit,
          offset: offset
        }
      });
      
      setDeletedUsers(response.data.deleted_users || []);
      setPagination(response.data.pagination || {});
    } catch (error) {
      console.error('Error loading deleted users:', error);
      toast.error('Failed to load deleted users');
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreUser = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to restore user "${username}"?`)) {
      return;
    }

    try {
      setRestoring(userId);
      await axios.post(`/api/users/${userId}/restore`);
      
      toast.success(`User "${username}" restored successfully`);
      loadDeletedUsers(pagination.offset); // Reload current page
      
    } catch (error) {
      console.error('Error restoring user:', error);
      const errorMessage = error.response?.data?.error?.message || 'Failed to restore user';
      toast.error(errorMessage);
    } finally {
      setRestoring(null);
    }
  };

  const handlePageChange = (newOffset) => {
    loadDeletedUsers(newOffset);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleString();
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return '#f44336';
      case 'manager': return '#ff9800';
      case 'member': return '#4caf50';
      case 'viewer': return '#2196f3';
      default: return '#666';
    }
  };

  const getRoleBadge = (role) => {
    const color = getRoleColor(role);
    return (
      <span 
        className="role-badge"
        style={{ backgroundColor: color }}
      >
        {role}
      </span>
    );
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content deleted-users-modal">
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">
            Deleted Users ({pagination.total})
          </h2>
          <button
            onClick={onClose}
            className="modal-close-button"
            aria-label="Close deleted users view"
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div className="modal-body">
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner" aria-hidden="true"></div>
              <div>Loading deleted users...</div>
            </div>
          ) : deletedUsers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon" aria-hidden="true">No Users</div>
              <h3 className="empty-state-title">No deleted users found</h3>
              <p>All users are currently active.</p>
            </div>
          ) : (
            <>
              {/* Accessible HTML Table */}
              <div className="table-container">
                <table className="data-table" role="table" aria-label="Deleted users">
                  <thead>
                    <tr>
                      <th scope="col">User</th>
                      <th scope="col">Email</th>
                      <th scope="col">Role</th>
                      <th scope="col">Deleted By</th>
                      <th scope="col">Deleted At</th>
                      <th scope="col">Reason</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deletedUsers.map(user => (
                      <tr 
                        key={user.id} 
                        className={restoring === user.id ? 'row-processing' : ''}
                      >
                        {/* User Info */}
                        <td data-label="User">
                          <div className="user-info">
                            <div className="user-name">
                              {user.full_name || user.username}
                            </div>
                            <div className="user-username">
                              @{user.username}
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td data-label="Email">
                          <span className="user-email">
                            {user.email}
                          </span>
                        </td>

                        {/* Role */}
                        <td data-label="Role">
                          {getRoleBadge(user.global_role)}
                        </td>

                        {/* Deleted By */}
                        <td data-label="Deleted By">
                          <div className="user-info">
                            <div className="user-name">
                              {user.deleted_by_name || 'Unknown'}
                            </div>
                            <div className="user-username">
                              @{user.deleted_by_username || 'unknown'}
                            </div>
                          </div>
                        </td>

                        {/* Deleted At */}
                        <td data-label="Deleted At">
                          <span className="date-display">
                            {formatDate(user.deleted_at)}
                          </span>
                        </td>

                        {/* Reason */}
                        <td data-label="Reason">
                          <div className="deletion-details">
                            <div className="deletion-reason" title={user.deletion_reason || 'No reason provided'}>
                              {user.deletion_reason || 'No reason provided'}
                            </div>
                            {user.tasks_reassigned_count > 0 && (
                              <div className="deletion-stat reassigned">
                                {user.tasks_reassigned_count} tasks reassigned
                              </div>
                            )}
                            {user.tasks_unassigned_count > 0 && (
                              <div className="deletion-stat unassigned">
                                {user.tasks_unassigned_count} tasks unassigned
                              </div>
                            )}
                            {user.team_memberships_removed > 0 && (
                              <div className="deletion-stat teams">
                                {user.team_memberships_removed} teams left
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td data-label="Actions">
                          <button
                            onClick={() => handleRestoreUser(user.id, user.username)}
                            disabled={restoring === user.id}
                            className={`btn btn-sm ${restoring === user.id ? 'btn-disabled' : 'btn-primary'}`}
                            title="Restore User"
                            aria-label={`Restore user ${user.username}`}
                          >
                            {restoring === user.id ? 'Restoring...' : 'Restore'}
                          </button>
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

export default DeletedUsersView;