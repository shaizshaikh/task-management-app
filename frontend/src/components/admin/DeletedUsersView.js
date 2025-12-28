/**
 * Deleted Users View Component
 * Shows soft-deleted users with restoration options
 */

import React, { useState, useEffect } from 'react';
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
      const response = await axios.post(`/api/users/${userId}/restore`);
      
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
        className="deleted-user-role-badge"
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
        <div className="deleted-users-header">
          <h2 className="deleted-users-title">
            🗑️ Deleted Users ({pagination.total})
          </h2>
          <button
            onClick={onClose}
            className="deleted-users-close-button"
          >
            ✕ Close
          </button>
        </div>

        {/* Content */}
        <div className="deleted-users-content">
          {loading ? (
            <div className="deleted-users-loading">
              <div className="deleted-users-loading-icon">🔄</div>
              <div>Loading deleted users...</div>
            </div>
          ) : deletedUsers.length === 0 ? (
            <div className="deleted-users-empty">
              <div className="deleted-users-empty-icon">👥</div>
              <h3 className="deleted-users-empty-title">No deleted users found</h3>
              <p>All users are currently active.</p>
            </div>
          ) : (
            <>
              {/* Users Table */}
              <div className="deleted-users-table">
                {/* Table Header */}
                <div className="deleted-users-table-header">
                  <div>User</div>
                  <div>Email</div>
                  <div>Role</div>
                  <div>Deleted By</div>
                  <div>Deleted At</div>
                  <div>Reason</div>
                  <div>Actions</div>
                </div>

                {/* Table Rows */}
                {deletedUsers.map(user => (
                  <div 
                    key={user.id} 
                    className={`deleted-users-table-row ${restoring === user.id ? 'restoring' : ''}`}
                  >
                    {/* User Info */}
                    <div className="deleted-user-info">
                      <div className="deleted-user-name">
                        {user.full_name || user.username}
                      </div>
                      <div className="deleted-user-username">
                        @{user.username}
                      </div>
                    </div>

                    {/* Email */}
                    <div className="deleted-user-email">
                      {user.email}
                    </div>

                    {/* Role */}
                    <div>
                      {getRoleBadge(user.global_role)}
                    </div>

                    {/* Deleted By */}
                    <div className="deleted-user-admin">
                      <div className="deleted-user-admin-name">
                        {user.deleted_by_name || 'Unknown'}
                      </div>
                      <div className="deleted-user-admin-username">
                        @{user.deleted_by_username || 'unknown'}
                      </div>
                    </div>

                    {/* Deleted At */}
                    <div className="deleted-user-date">
                      {formatDate(user.deleted_at)}
                    </div>

                    {/* Reason */}
                    <div>
                      <div className="deleted-user-reason" title={user.deletion_reason || 'No reason provided'}>
                        {user.deletion_reason || 'No reason provided'}
                      </div>
                      {user.tasks_reassigned_count > 0 && (
                        <div className="deleted-user-reason-details reassigned">
                          {user.tasks_reassigned_count} tasks reassigned
                        </div>
                      )}
                      {user.tasks_unassigned_count > 0 && (
                        <div className="deleted-user-reason-details unassigned">
                          {user.tasks_unassigned_count} tasks unassigned
                        </div>
                      )}
                      {user.team_memberships_removed > 0 && (
                        <div className="deleted-user-reason-details teams">
                          {user.team_memberships_removed} teams left
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="deleted-user-actions">
                      <button
                        onClick={() => handleRestoreUser(user.id, user.username)}
                        disabled={restoring === user.id}
                        className={`deleted-user-restore-button ${restoring === user.id ? 'disabled' : ''}`}
                        title="Restore User"
                      >
                        {restoring === user.id ? '🔄' : '🔄 Restore'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pagination.total > pagination.limit && (
                <div className="deleted-users-pagination">
                  <button
                    onClick={() => handlePageChange(Math.max(0, pagination.offset - pagination.limit))}
                    disabled={pagination.offset === 0}
                    className="deleted-users-pagination-button"
                  >
                    ← Previous
                  </button>
                  
                  <span className="deleted-users-pagination-info">
                    Showing {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total}
                  </span>
                  
                  <button
                    onClick={() => handlePageChange(pagination.offset + pagination.limit)}
                    disabled={!pagination.has_more}
                    className="deleted-users-pagination-button"
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

export default DeletedUsersView;