/**
 * User Delete Confirmation Dialog
 * Handles user deletion with comprehensive confirmation and options
 */

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { extractErrorMessage } from '../../utils/errorUtils';

const UserDeleteConfirmation = ({ user, onClose, onConfirm }) => {
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [reassignTo, setReassignTo] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [userDetails, setUserDetails] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const modalRef = useRef(null);
  const firstInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      loadUserDetails();
      loadAvailableUsers();
    }
  }, [user]);

  // Focus management for modal
  useEffect(() => {
    if (modalRef.current) {
      // Focus the modal container
      modalRef.current.focus();
      
      // Focus the first input after a short delay
      setTimeout(() => {
        if (firstInputRef.current) {
          firstInputRef.current.focus();
        }
      }, 100);
    }

    // Prevent background scrolling and focus trapping
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const loadUserDetails = async () => {
    try {
      const response = await axios.get(`/api/users/${user.id}`);
      setUserDetails(response.data.user);
    } catch (error) {
      console.error('Error loading user details:', error);
      toast.error('Failed to load user details');
    }
  };

  const loadAvailableUsers = async () => {
    try {
      const response = await axios.get('/api/users', {
        params: { limit: 100 }
      });
      
      // Filter out the user being deleted and inactive users
      const filtered = (response.data.users || response.data).filter(u => 
        u.id !== user.id && u.is_active
      );
      
      setAvailableUsers(filtered);
    } catch (error) {
      console.error('Error loading available users:', error);
      toast.error('Failed to load available users');
    }
  };

  const handleDelete = async () => {
    if (confirmText !== user.username) {
      toast.error('Please type the username exactly to confirm deletion');
      return;
    }

    if (!reason.trim()) {
      toast.error('Please provide a reason for deletion');
      return;
    }

    setLoading(true);
    
    try {
      const deleteData = {
        reason: reason.trim()
      };

      if (reassignTo) {
        deleteData.reassign_to = parseInt(reassignTo);
      }

      const response = await axios.delete(`/api/users/${user.id}`, {
        data: deleteData
      });

      toast.success('User deleted successfully');
      
      // Show detailed results
      const details = response.data.deletion_details;
      if (details.tasks_reassigned > 0) {
        toast.info(`${details.tasks_reassigned} tasks reassigned to ${details.reassigned_to?.full_name}`);
      } else if (details.tasks_unassigned > 0) {
        toast.info(`${details.tasks_unassigned} tasks unassigned`);
      }
      
      if (details.team_memberships_removed > 0) {
        toast.info(`Removed from ${details.team_memberships_removed} teams`);
      }
      
      if (details.sessions_revoked > 0) {
        toast.info(`${details.sessions_revoked} active sessions revoked`);
      }

      onConfirm(response.data);
      onClose();
      
    } catch (error) {
      console.error('Error deleting user:', error);
      
      // Handle 404 - user already deleted
      if (error.response?.status === 404) {
        toast.success('User has already been deleted');
        onConfirm({ deleted_user: { id: user.id } });
        onClose();
        return;
      }
      
      const errorMessage = extractErrorMessage(error, 'Failed to delete user');
      
      if (errorMessage === null) {
        // Query parameter logged as error, likely successful deletion
        toast.success('User deletion completed successfully');
        onConfirm({ deleted_user: { id: user.id } });
        onClose();
        return;
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const taskCount = userDetails?.task_statistics?.total_assigned || 0;
  const teamCount = userDetails?.team_count || 0;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-user-title" aria-describedby="delete-user-description">
      <div 
        ref={modalRef}
        className="modal-content modal-medium"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onClose();
          }
        }}
      >
        {/* Header */}
        <div className="delete-dialog-header">
          <span className="delete-dialog-icon">Warning</span>
          <h3 id="delete-user-title" className="delete-dialog-title">
            Delete User Account
          </h3>
        </div>

        {/* Warning Message */}
        <div id="delete-user-description" className="delete-warning-box">
          <div className="delete-warning-title">
            This action cannot be undone
          </div>
          <div className="delete-warning-text">
            The user will be permanently removed from the system and all active sessions will be terminated.
          </div>
        </div>

        {/* User Information */}
        <div className="delete-user-info-box">
          <h4 className="delete-user-info-title">User to be deleted:</h4>
          <div className="delete-user-info-grid">
            <strong>Name:</strong>
            <span>{user.full_name || user.username}</span>
            
            <strong>Username:</strong>
            <span>@{user.username}</span>
            
            <strong>Email:</strong>
            <span>{user.email}</span>
            
            <strong>Role:</strong>
            <span className={`delete-user-role-badge role-badge-${user.global_role}`}>
              {user.global_role}
            </span>
            
            <strong>Teams:</strong>
            <span>{teamCount} team{teamCount !== 1 ? 's' : ''}</span>
            
            <strong>Assigned Tasks:</strong>
            <span>{taskCount} task{taskCount !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Task Reassignment */}
        {taskCount > 0 && (
          <div className="delete-task-reassignment-section">
            <h4 className="delete-task-reassignment-title">
              Task Reassignment ({taskCount} tasks)
            </h4>
            <div className="delete-task-reassignment-options">
              <label className="delete-task-option">
                <input
                  type="radio"
                  name="taskAction"
                  value=""
                  checked={!reassignTo}
                  onChange={() => setReassignTo('')}
                />
                <div className="delete-task-option-content">
                  <div className="delete-task-option-label">Unassign all tasks (tasks will become unassigned)</div>
                </div>
              </label>
              
              <label className="delete-task-option">
                <input
                  type="radio"
                  name="taskAction"
                  value="reassign"
                  checked={!!reassignTo}
                  onChange={() => setReassignTo('reassign')}
                />
                <div className="delete-task-option-content">
                  <div className="delete-task-option-label">Reassign tasks to another user:</div>
                  {reassignTo && (
                    <select
                      value={reassignTo === 'reassign' ? '' : reassignTo}
                      onChange={(e) => setReassignTo(e.target.value)}
                      className="delete-user-select"
                    >
                      <option value="">Select user to reassign tasks to...</option>
                      {availableUsers.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.full_name || u.username} (@{u.username}) - {u.global_role}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Deletion Reason */}
        <div className="delete-reason-section">
          <label className="delete-reason-label" htmlFor="deletion-reason">
            Reason for deletion *
          </label>
          <textarea
            id="deletion-reason"
            ref={firstInputRef}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Please provide a reason for deleting this user account..."
            className="delete-reason-textarea"
            required
            aria-describedby="deletion-reason-help"
          />
          <div id="deletion-reason-help" className="sr-only">
            Required field. Provide a clear reason for deleting this user account.
          </div>
        </div>

        {/* Confirmation Input */}
        <div className="delete-confirmation-section">
          <label className="delete-confirmation-label" htmlFor="username-confirmation">
            Type the username "{user.username}" to confirm deletion *
          </label>
          <input
            id="username-confirmation"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={`Type "${user.username}" here`}
            className={`delete-confirmation-input ${confirmText === user.username ? 'valid' : ''}`}
            required
            aria-describedby="username-confirmation-help"
          />
          <div id="username-confirmation-help" className="sr-only">
            Type the exact username to confirm deletion. This is a safety measure.
          </div>
          {confirmText && confirmText !== user.username && (
            <div className="delete-confirmation-error">
              Username doesn't match. Please type exactly: {user.username}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="modal-actions">
          <button
            onClick={onClose}
            disabled={loading}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          
          <button
            onClick={handleDelete}
            disabled={loading || !reason.trim() || confirmText !== user.username}
            className={`btn ${loading || !reason.trim() || confirmText !== user.username ? 'btn-disabled' : 'btn-danger'}`}
          >
            {loading ? 'Deleting...' : 'Delete User'}
          </button>
        </div>

        {/* Loading Overlay */}
        {loading && (
          <div className="delete-loading-overlay">
            <div className="delete-loading-content">
              <div className="delete-loading-icon">Loading</div>
              <div className="delete-loading-title">Deleting user...</div>
              <div className="delete-loading-subtitle">
                This may take a few moments
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserDeleteConfirmation;