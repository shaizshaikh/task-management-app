/**
 * User Management Component
 * Admin interface for managing users and roles
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import UserDeleteConfirmation from './UserDeleteConfirmation';
import DeletedUsersView from './DeletedUsersView';
import UserImportDialog from './UserImportDialog';
import ImportHistoryView from './ImportHistoryView';
import UserExportDialog from './UserExportDialog';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingUser, setDeletingUser] = useState(null);
  const [showDeletedUsers, setShowDeletedUsers] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showImportHistory, setShowImportHistory] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    full_name: '',
    global_role: 'member',
    password: '',
    temporary_password: true
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/users', {
        params: {
          search: searchTerm || undefined,
          global_role: roleFilter || undefined,
          limit: 100,
          _t: Date.now(), // Cache busting
          _refresh: Math.random() // Additional cache busting
        },
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      setUsers(response.data.users || response.data);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const response = await axios.put(`/api/users/${userId}/role`, {
        global_role: newRole
      });
      
      if (response.data.warning) {
        toast.warning(response.data.warning);
      } else {
        toast.success('User role updated successfully');
      }
      
      setShowRoleModal(false);
      setEditingUser(null);
      loadUsers();
    } catch (error) {
      console.error('Error updating user role:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to update user role');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    
    if (!newUser.username.trim() || !newUser.email.trim()) {
      toast.warning('Please enter username and email');
      return;
    }

    try {
      const response = await axios.post('/api/users', newUser);
      
      if (response.data.temporary_password) {
        toast.success(`User created successfully! Temporary password: ${newUser.password}`);
      } else {
        toast.success('User created successfully');
      }
      
      setShowCreateModal(false);
      setNewUser({
        username: '',
        email: '',
        full_name: '',
        global_role: 'member',
        password: '',
        temporary_password: true
      });
      loadUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to create user');
    }
  };

  const handleSyncUsers = async () => {
    try {
      const response = await axios.post('/api/users/sync');
      
      if (response.data.results) {
        const { total, created, updated, errors } = response.data.results;
        toast.success(`Sync completed: ${updated} users updated, ${errors.length} errors`);
        
        if (errors.length > 0) {
          console.warn('Sync errors:', errors);
        }
      } else {
        toast.success('User synchronization completed successfully');
      }
      
      loadUsers();
    } catch (error) {
      console.error('Error syncing users:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to sync users');
    }
  };

  const handleDeleteUser = (user) => {
    setDeletingUser(user);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = (deletionResult) => {
    console.log('User deleted:', deletionResult);
    // Immediately remove the user from the local state
    setUsers(prevUsers => prevUsers.filter(user => user.id !== deletionResult.deleted_user?.id));
    
    // Also refresh from server with longer delay to ensure DB transaction is committed
    setTimeout(() => {
      loadUsers(); // Refresh the user list from server
    }, 1000);
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setDeletingUser(null);
  };

  const handleImportComplete = (importResults) => {
    console.log('Import completed:', importResults);
    loadUsers(); // Refresh the user list
    setShowImportDialog(false);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm || 
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = !roleFilter || user.global_role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

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
    return (
      <span className={`role-badge role-badge-${role}`}>
        {role}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="loading-layout">
        <div className="loading-text">Loading users...</div>
        <div className="loading"></div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <div className="header">
        <div className="header-content">
          <h2 className="page-title">👥 User Management</h2>
          <p className="page-subtitle">
            {filteredUsers.length} of {users.length} users
          </p>
        </div>
        <div className="header-actions">
          <button
            onClick={() => setShowImportDialog(true)}
            className="btn btn-primary"
          >
            📥 Import Users
          </button>
          
          <button
            onClick={() => setShowExportDialog(true)}
            className="btn btn-success"
          >
            📤 Export Users
          </button>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="admin-btn admin-btn-success"
          >
            + Create User
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="legacy-filters">
        <input
          type="text"
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="legacy-input flex-1"
        />
        
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="legacy-select select-min-width"
        >
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="member">Member</option>
          <option value="viewer">Viewer</option>
        </select>

        <button
          onClick={loadUsers}
          className="btn-refresh"
        >
          🔄 Refresh
        </button>

        <button
          onClick={handleSyncUsers}
          className="btn-sync"
        >
          🔄 Sync from Keycloak
        </button>

        <button
          onClick={() => setShowDeletedUsers(true)}
          className="btn btn-danger"
        >
          🗑️ View Deleted Users
        </button>

        <button
          onClick={() => setShowImportHistory(true)}
          className="btn btn-purple"
        >
          📋 Import History
        </button>
      </div>

      {/* Users Table */}
      <div className="card">
        <div className="admin-table-header">
          <div>User</div>
          <div>Email</div>
          <div>Role</div>
          <div>Teams</div>
          <div>Last Active</div>
          <div>Actions</div>
        </div>

        {filteredUsers.map(user => (
          <div key={user.id} className="admin-table-row">
            {/* User Info */}
            <div>
              <div className="admin-user-info">
                {user.full_name || user.username}
              </div>
              <div className="admin-user-username">
                @{user.username}
              </div>
            </div>

            {/* Email */}
            <div className="admin-user-email">
              {user.email}
            </div>

            {/* Role */}
            <div>
              {getRoleBadge(user.global_role)}
            </div>

            {/* Teams */}
            <div className="admin-user-teams">
              {user.team_count || 0} teams
            </div>

            {/* Last Active */}
            <div className="admin-user-last-active">
              {user.updated_at ? new Date(user.updated_at).toLocaleDateString() : 'Never'}
            </div>

            {/* Actions */}
            <div className="admin-user-actions">
              <button
                onClick={() => {
                  setEditingUser(user);
                  setShowRoleModal(true);
                }}
                className="btn btn-sm btn-primary"
              >
                Edit Role
              </button>
              
              <button
                onClick={() => handleDeleteUser(user)}
                className="btn btn-sm btn-danger"
                title="Delete User"
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        ))}

        {filteredUsers.length === 0 && (
          <div className="admin-empty-state">
            {searchTerm || roleFilter ? 'No users match your filters' : 'No users found'}
          </div>
        )}
      </div>

      {/* Role Change Modal */}
      {showRoleModal && editingUser && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">
              Change Role for {editingUser.full_name || editingUser.username}
            </h3>
            
            <div className="modal-body">
              <p className="modal-description">
                Current role: {getRoleBadge(editingUser.global_role)}
              </p>
              
              <div className="role-selection-grid">
                {['admin', 'manager', 'member', 'viewer'].map(role => (
                  <button
                    key={role}
                    onClick={() => handleRoleChange(editingUser.id, role)}
                    disabled={role === editingUser.global_role}
                    className={`role-button ${role === editingUser.global_role ? 'role-button-current' : `role-button-${role}`}`}
                  >
                    <span>{role}</span>
                    {role === editingUser.global_role && <span>✓ Current</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="modal-buttons">
              <button
                onClick={() => {
                  setShowRoleModal(false);
                  setEditingUser(null);
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">Create New User</h3>
            
            <form onSubmit={handleCreateUser}>
              <div className="form-group-modal">
                <label className="form-label-modal">
                  Username *
                </label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="form-input-modal"
                  required
                />
              </div>

              <div className="form-group-modal">
                <label className="form-label-modal">
                  Email *
                </label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="form-input-modal"
                  required
                />
              </div>

              <div className="form-group-modal">
                <label className="form-label-modal">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newUser.full_name}
                  onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                  className="form-input-modal"
                />
              </div>

              <div className="form-group-modal">
                <label className="form-label-modal">
                  Role
                </label>
                <select
                  value={newUser.global_role}
                  onChange={(e) => setNewUser({ ...newUser, global_role: e.target.value })}
                  className="form-select-modal"
                >
                  <option value="viewer">Viewer</option>
                  <option value="member">Member</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="form-group-modal">
                <label className="form-label-modal">
                  Temporary Password
                </label>
                <input
                  type="text"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Leave empty for auto-generated"
                  className="form-input-modal"
                />
                <small className="form-help-text">
                  User will be required to change password on first login
                </small>
              </div>

              <div className="modal-buttons">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Delete Confirmation Modal */}
      {showDeleteModal && deletingUser && (
        <UserDeleteConfirmation
          user={deletingUser}
          onClose={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
        />
      )}

      {/* Deleted Users View Modal */}
      {showDeletedUsers && (
        <DeletedUsersView
          onClose={() => setShowDeletedUsers(false)}
        />
      )}

      {/* User Import Dialog */}
      {showImportDialog && (
        <UserImportDialog
          onClose={() => setShowImportDialog(false)}
          onImportComplete={handleImportComplete}
        />
      )}

      {/* Import History View Modal */}
      {showImportHistory && (
        <ImportHistoryView
          onClose={() => setShowImportHistory(false)}
        />
      )}

      {/* User Export Dialog */}
      {showExportDialog && (
        <UserExportDialog
          onClose={() => setShowExportDialog(false)}
        />
      )}
    </div>
  );
};

export default UserManagement;