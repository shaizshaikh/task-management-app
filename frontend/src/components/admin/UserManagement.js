/**
 * User Management Component
 * Admin interface for managing users and roles
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { extractErrorMessage } from '../../utils/errorUtils';
import UserDeleteConfirmation from './UserDeleteConfirmation';
import DeletedUsersView from './DeletedUsersView';
import UserImportDialog from './UserImportDialog';
import ImportHistoryView from './ImportHistoryView';
import UserExportDialog from './UserExportDialog';
import FocusTrapModal from '../FocusTrapModal';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false); // Separate loading state for table only
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
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [pageSize, setPageSize] = useState(50); // Default 50 users per page
  const [loadingMore, setLoadingMore] = useState(false);
  
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    full_name: '',
    global_role: 'member',
    password: '',
    temporary_password: true
  });

  useEffect(() => {
    loadUsers(1, false, false); // Initial load - full page loading
  }, []); // Initial load only

  useEffect(() => {
    if (currentPage === 1) {
      loadUsers(1, false, true); // Table refresh for filters and pagination
    } else {
      loadUsers(currentPage, false, true); // Table refresh for pagination
    }
  }, [currentPage, pageSize, roleFilter]); // Removed searchTerm from dependencies

  // Debounced search effect - only refreshes table
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm !== '') {
        setCurrentPage(1); // Reset to first page when searching
        loadUsers(1, false, true); // Table refresh only
      } else if (searchTerm === '') {
        // If search is cleared, reload without search
        setCurrentPage(1);
        loadUsers(1, false, true); // Table refresh only
      }
    }, 500); // 500ms delay for debounced search

    return () => clearTimeout(timeoutId);
  }, [searchTerm]); // Separate effect for search with debounce

  const loadUsers = async (page = currentPage, resetPage = false, isTableRefresh = false) => {
    try {
      if (resetPage) {
        setCurrentPage(1);
        page = 1;
      }
      
      // Use different loading states based on the type of refresh
      if (isTableRefresh) {
        setTableLoading(true); // Only show table loading for searches/filters
      } else {
        setLoading(true); // Full page loading for initial load
      }
      
      const offset = (page - 1) * pageSize;
      
      const response = await axios.get('/api/users', {
        params: {
          search: searchTerm || undefined,
          global_role: roleFilter || undefined,
          limit: pageSize,
          offset: offset
        },
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      const userData = response.data.users || response.data;
      const total = response.data.total || userData.length;
      
      setUsers(userData);
      setTotalUsers(total);
      setTotalPages(Math.ceil(total / pageSize));
      
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
    } finally {
      if (isTableRefresh) {
        setTableLoading(false);
      } else {
        setLoading(false);
      }
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
      
      // Auto-close modal after successful role change
      setShowRoleModal(false);
      setEditingUser(null);
      loadUsers(currentPage, false, true); // Table refresh only
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
      
      // Auto-close modal after successful creation
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
      const errorMessage = extractErrorMessage(error, 'Failed to create user');
      
      if (errorMessage === null) {
        // Query parameter logged as error, likely successful
        toast.success('User created successfully');
        
        // Auto-close modal after successful creation
        setShowCreateModal(false);
        setNewUser({
          username: '',
          email: '',
          full_name: '',
          global_role: 'member',
          password: '',
          temporary_password: true
        });
        loadUsers(1, true, true); // Table refresh only
      } else {
        toast.error(errorMessage);
      }
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
      
      loadUsers(1, true, true); // Table refresh only
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
    
    // Close the modal first
    setShowDeleteModal(false);
    setDeletingUser(null);
    
    // Immediately remove the user from the local state
    setUsers(prevUsers => prevUsers.filter(user => user.id !== deletionResult.deleted_user?.id));
    
    // Refresh from server after a short delay to ensure consistency
    setTimeout(() => {
      loadUsers(currentPage, false, true); // Table refresh only
    }, 500);
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setDeletingUser(null);
  };

  const handleImportComplete = (importResults) => {
    console.log('Import completed:', importResults);
    
    // Handle timeout scenario
    if (importResults.timeout) {
      toast.info('Import completed despite timeout. Refreshing user list...');
    }
    
    loadUsers(currentPage, false, true); // Table refresh only
    
    // Only close dialog if not showing results
    if (!importResults.timeout) {
      setShowImportDialog(false);
    }
  };

  // Server-side filtering is now handled in loadUsers function
  const displayUsers = users;

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
          <h2 className="page-title">User Management</h2>
          <p className="page-subtitle">
            {totalUsers > 0 ? (
              <>
                Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalUsers)} of {totalUsers} users
                {(searchTerm || roleFilter) && ' (filtered)'}
              </>
            ) : (
              'No users found'
            )}
          </p>
        </div>
        <div className="header-actions">
          <button
            onClick={() => setShowImportDialog(true)}
            className="btn btn-primary"
          >
            Import Users
          </button>
          
          <button
            onClick={() => setShowExportDialog(true)}
            className="btn btn-success"
          >
            Export Users
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
      <div className="filters-section" aria-label="User search and filter options">
        <div className="filter-group">
          <label htmlFor="user-search" className="sr-only">
            Search users by name, username, or email
          </label>
          <input
            id="user-search"
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              // Page reset will happen in the debounced useEffect
            }}
            className="legacy-input flex-1"
            aria-describedby="user-search-help"
          />
          <div id="user-search-help" className="sr-only">
            Type to search users by name, username, or email address
          </div>
        </div>
        
        <div className="filter-group">
          <label htmlFor="role-filter" className="sr-only">
            Filter users by role
          </label>
          <select
            id="role-filter"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setCurrentPage(1); // Reset to first page when filtering
              // This will trigger the useEffect for roleFilter, which uses table refresh
            }}
            className="legacy-select select-min-width"
            aria-describedby="role-filter-help"
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
          </select>
          <div id="role-filter-help" className="sr-only">
            Select a role to filter the user list, or choose All Roles to see everyone
          </div>
        </div>

        <button
          onClick={() => loadUsers(currentPage, false, true)} // Table refresh only
          className="btn-refresh"
          aria-label="Refresh user list"
        >
          Refresh
        </button>
      </div>

      <div className="action-buttons">
        <button
          onClick={handleSyncUsers}
          className="btn-sync"
        >
          Sync from Keycloak
        </button>

        <button
          onClick={() => setShowDeletedUsers(true)}
          className="btn btn-danger"
        >
          View Deleted Users
        </button>

        <button
          onClick={() => setShowImportHistory(true)}
          className="btn btn-purple"
        >
          Import History
        </button>
      </div>

      {/* Users Table */}
      <div className="card">
        <div className={`table-container ${tableLoading ? 'table-loading' : ''}`}>
          {tableLoading && (
            <div className="table-loading-overlay">
              <div className="table-loading-spinner"></div>
              <span className="table-loading-text">Loading users...</span>
            </div>
          )}
          <table className="table table-striped table-responsive-stack" role="table" aria-label="Users management table">
            <caption className="sr-only">
              List of {displayUsers.length} users with their roles, teams, and management actions
            </caption>
            <thead>
              <tr>
                <th scope="col" className="col-lg">User</th>
                <th scope="col" className="col-lg">Email</th>
                <th scope="col" className="col-sm">Role</th>
                <th scope="col" className="col-sm">Teams</th>
                <th scope="col" className="col-md">Last Active</th>
                <th scope="col" className="col-md cell-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="table-empty">
                    <div className="table-empty-icon">👥</div>
                    <div className="table-empty-title">No users found</div>
                    <div className="table-empty-description">
                      {searchTerm || roleFilter 
                        ? 'No users match your filters' 
                        : 'No users found'
                      }
                    </div>
                  </td>
                </tr>
              ) : (
                displayUsers.map(user => (
                  <tr key={user.id}>
                    {/* User Info */}
                    <td data-label="User">
                      <div className="admin-user-info">
                        {user.full_name || user.username}
                      </div>
                      <div className="admin-user-username">
                        @{user.username}
                      </div>
                    </td>

                    {/* Email */}
                    <td data-label="Email" className="admin-user-email">
                      {user.email}
                    </td>

                    {/* Role */}
                    <td data-label="Role" className="cell-center">
                      {getRoleBadge(user.global_role)}
                    </td>

                    {/* Teams */}
                    <td data-label="Teams" className="admin-user-teams cell-center">
                      {user.team_count || 0} teams
                    </td>

                    {/* Last Active */}
                    <td data-label="Last Active" className="admin-user-last-active">
                      {user.updated_at ? new Date(user.updated_at).toLocaleDateString() : 'Never'}
                    </td>

                    {/* Actions */}
                    <td data-label="Actions" className="admin-user-actions cell-actions">
                      <button
                        onClick={() => {
                          setEditingUser(user);
                          setShowRoleModal(true);
                        }}
                        className="btn btn-table btn-primary"
                        aria-label={`Edit role for ${user.full_name || user.username}`}
                      >
                        Edit Role
                      </button>
                      
                      <button
                        onClick={() => handleDeleteUser(user)}
                        className="btn btn-table btn-danger"
                        title="Delete User"
                        aria-label={`Delete user ${user.full_name || user.username}`}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className={`pagination-container ${tableLoading ? 'loading' : ''}`}>
          <div className="pagination-info">
            <span>
              Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalUsers)} of {totalUsers} users
            </span>
            
            <div className="page-size-selector">
              <label htmlFor="page-size-select" className="sr-only">
                Users per page
              </label>
              <select
                id="page-size-select"
                value={pageSize}
                onChange={(e) => {
                  const newPageSize = parseInt(e.target.value);
                  setPageSize(newPageSize);
                  setCurrentPage(1); // Reset to first page when changing page size
                }}
                className="page-size-select"
                aria-describedby="page-size-help"
              >
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
              <div id="page-size-help" className="sr-only">
                Select how many users to display per page
              </div>
            </div>
          </div>

          <nav className="pagination-nav" aria-label="User list pagination">
            <div className="pagination-controls">
              {/* First Page */}
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="pagination-btn pagination-btn-first"
                aria-label="Go to first page"
                title="First page"
              >
                ⟪
              </button>

              {/* Previous Page */}
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="pagination-btn pagination-btn-prev"
                aria-label="Go to previous page"
                title="Previous page"
              >
                ⟨
              </button>

              {/* Page Numbers */}
              <div className="pagination-pages">
                {(() => {
                  const pages = [];
                  const startPage = Math.max(1, currentPage - 2);
                  const endPage = Math.min(totalPages, currentPage + 2);

                  // Show first page if we're not near the beginning
                  if (startPage > 1) {
                    pages.push(
                      <button
                        key={1}
                        onClick={() => setCurrentPage(1)}
                        className="pagination-btn pagination-btn-page"
                        aria-label="Go to page 1"
                      >
                        1
                      </button>
                    );
                    if (startPage > 2) {
                      pages.push(
                        <span key="start-ellipsis" className="pagination-ellipsis" aria-hidden="true">
                          ...
                        </span>
                      );
                    }
                  }

                  // Show page numbers around current page
                  for (let i = startPage; i <= endPage; i++) {
                    pages.push(
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i)}
                        className={`pagination-btn pagination-btn-page ${
                          i === currentPage ? 'pagination-btn-current' : ''
                        }`}
                        aria-label={i === currentPage ? `Current page ${i}` : `Go to page ${i}`}
                        aria-current={i === currentPage ? 'page' : undefined}
                      >
                        {i}
                      </button>
                    );
                  }

                  // Show last page if we're not near the end
                  if (endPage < totalPages) {
                    if (endPage < totalPages - 1) {
                      pages.push(
                        <span key="end-ellipsis" className="pagination-ellipsis" aria-hidden="true">
                          ...
                        </span>
                      );
                    }
                    pages.push(
                      <button
                        key={totalPages}
                        onClick={() => setCurrentPage(totalPages)}
                        className="pagination-btn pagination-btn-page"
                        aria-label={`Go to page ${totalPages}`}
                      >
                        {totalPages}
                      </button>
                    );
                  }

                  return pages;
                })()}
              </div>

              {/* Next Page */}
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="pagination-btn pagination-btn-next"
                aria-label="Go to next page"
                title="Next page"
              >
                ⟩
              </button>

              {/* Last Page */}
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="pagination-btn pagination-btn-last"
                aria-label="Go to last page"
                title="Last page"
              >
                ⟫
              </button>
            </div>

            <div className="pagination-summary" aria-live="polite" aria-atomic="true">
              Page {currentPage} of {totalPages}
            </div>
          </nav>
        </div>
      )}

      {/* Role Change Modal */}
      {showRoleModal && editingUser && (
        <FocusTrapModal
          isOpen={showRoleModal}
          onClose={() => {
            setShowRoleModal(false);
            setEditingUser(null);
          }}
          className="modal-overlay"
          ariaLabelledBy="role-change-title"
        >
          <div className="modal-content">
            <h3 id="role-change-title" className="modal-title">
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
        </FocusTrapModal>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <FocusTrapModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          className="modal-overlay"
          ariaLabelledBy="create-user-title"
        >
          <div className="modal-content">
            <h3 id="create-user-title" className="modal-title">Create New User</h3>
            
            <form onSubmit={handleCreateUser}>
              <div className="form-group-modal">
                <label className="form-label-modal" htmlFor="create-user-username">
                  Username *
                </label>
                <input
                  id="create-user-username"
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="form-input-modal"
                  required
                  aria-describedby="create-user-username-help"
                />
                <small id="create-user-username-help" className="form-help-text">
                  Unique username for login
                </small>
              </div>

              <div className="form-group-modal">
                <label className="form-label-modal" htmlFor="create-user-email">
                  Email *
                </label>
                <input
                  id="create-user-email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="form-input-modal"
                  required
                  aria-describedby="create-user-email-help"
                />
                <small id="create-user-email-help" className="form-help-text">
                  Email address for notifications and login
                </small>
              </div>

              <div className="form-group-modal">
                <label className="form-label-modal" htmlFor="create-user-fullname">
                  Full Name
                </label>
                <input
                  id="create-user-fullname"
                  type="text"
                  value={newUser.full_name}
                  onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                  className="form-input-modal"
                  aria-describedby="create-user-fullname-help"
                />
                <small id="create-user-fullname-help" className="form-help-text">
                  Display name for the user (optional)
                </small>
              </div>

              <div className="form-group-modal">
                <label className="form-label-modal" htmlFor="create-user-role">
                  Role
                </label>
                <select
                  id="create-user-role"
                  value={newUser.global_role}
                  onChange={(e) => setNewUser({ ...newUser, global_role: e.target.value })}
                  className="form-select-modal"
                  aria-describedby="create-user-role-help"
                >
                  <option value="viewer">Viewer</option>
                  <option value="member">Member</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
                <small id="create-user-role-help" className="form-help-text">
                  User's permission level in the system
                </small>
              </div>

              <div className="form-group-modal">
                <label className="form-label-modal" htmlFor="create-user-password">
                  Temporary Password
                </label>
                <input
                  id="create-user-password"
                  type="text"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Leave empty for auto-generated"
                  className="form-input-modal"
                  aria-describedby="create-user-password-help"
                />
                <small id="create-user-password-help" className="form-help-text">
                  User will be required to change password on first login. Leave empty for auto-generated password.
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
        </FocusTrapModal>
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