/**
 * Team Management Component - PERFORMANCE OPTIMIZED
 * Reduced re-renders and improved modal performance
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import { useRealtime } from '../../hooks/useRealtime';
import FocusTrapModal from '../FocusTrapModal';

const TeamManagement = () => {
  const { user, isAdmin, isManager } = useAuth();
  const { subscribe } = useRealtime();
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [newTeam, setNewTeam] = useState({
    name: '',
    description: '',
    color: '#2196F3'
  });

  // Memoized permission check
  const canCreateTeams = useMemo(() => {
    // Ensure functions are available before calling
    if (typeof isAdmin !== 'function' || typeof isManager !== 'function') {
      return false;
    }
    return isAdmin() || isManager();
  }, [isAdmin, isManager]);

  // Memoized visible teams
  const visibleTeams = useMemo(() => {
    // Ensure functions are available before calling
    if (typeof isAdmin !== 'function' || !user) {
      return [];
    }
    if (isAdmin() || user?.globalRole === 'manager') {
      return teams;
    }
    return teams.filter(team => 
      user?.teams?.some(userTeam => userTeam.id === team.id)
    );
  }, [teams, isAdmin, user]);

  // Memoized callbacks
  const loadTeams = useCallback(async () => {
    try {
      const response = await axios.get('/api/teams');
      setTeams(response.data.teams || response.data);
    } catch (error) {
      console.error('Error loading teams:', error);
      toast.error('Failed to load teams');
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const response = await axios.get('/api/users');
      setUsers(response.data.users || response.data);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTeamMembers = useCallback(async (teamId) => {
    try {
      const response = await axios.get(`/api/teams/${teamId}/members`);
      setTeamMembers(response.data.members || response.data);
    } catch (error) {
      console.error('Error loading team members:', error);
      toast.error('Failed to load team members');
    }
  }, []);

  useEffect(() => {
    loadTeams();
    loadUsers();

    // Listen for real-time team updates
    const handleTeamUpdate = (notification) => {
      console.log('Team update received:', notification);
      if (notification.updateType === 'deleted') {
        // Remove deleted team from list
        setTeams(prev => prev.filter(t => t.id !== notification.team_id));
      } else {
        // Reload teams for create/update
        loadTeams();
      }
    };

    const unsubscribe = subscribe('teamUpdated', handleTeamUpdate);

    return () => {
      unsubscribe();
    };
  }, [subscribe]);

  const handleCreateTeam = useCallback(async (e) => {
    e.preventDefault();
    
    if (!newTeam.name.trim()) {
      toast.warning('Please enter a team name');
      return;
    }

    try {
      await axios.post('/api/teams', newTeam);
      toast.success('Team created successfully');
      setShowCreateModal(false);
      setNewTeam({ name: '', description: '', color: '#2196F3' });
      loadTeams();
    } catch (error) {
      console.error('Error creating team:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to create team');
    }
  }, [newTeam, loadTeams]);

  const handleDeleteTeam = useCallback(async (teamId, teamName) => {
    if (!window.confirm(`Are you sure you want to delete team "${teamName}"? This will also delete all associated tasks.`)) {
      return;
    }

    try {
      await axios.delete(`/api/teams/${teamId}`);
      toast.success('Team deleted successfully');
      loadTeams();
    } catch (error) {
      console.error('Error deleting team:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to delete team');
    }
  }, [loadTeams]);

  const handleAddMember = useCallback(async (userId, teamRole = 'member') => {
    try {
      await axios.post(`/api/teams/${selectedTeam.id}/members`, {
        user_id: userId,
        team_role: teamRole
      });
      toast.success('Member added successfully');
      loadTeamMembers(selectedTeam.id);
      loadTeams(); // Refresh team stats
    } catch (error) {
      console.error('Error adding member:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to add member');
    }
  }, [selectedTeam, loadTeamMembers, loadTeams]);

  const handleRemoveMember = useCallback(async (userId, userName) => {
    if (!window.confirm(`Remove ${userName} from ${selectedTeam.name}?`)) {
      return;
    }

    try {
      await axios.delete(`/api/teams/${selectedTeam.id}/members/${userId}`);
      toast.success('Member removed successfully');
      loadTeamMembers(selectedTeam.id);
      loadTeams(); // Refresh team stats
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to remove member');
    }
  }, [selectedTeam, loadTeamMembers, loadTeams]);

  const handleUpdateMemberRole = useCallback(async (userId, newRole) => {
    try {
      await axios.put(`/api/teams/${selectedTeam.id}/members/${userId}`, {
        team_role: newRole
      });
      toast.success('Member role updated successfully');
      loadTeamMembers(selectedTeam.id);
    } catch (error) {
      console.error('Error updating member role:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to update member role');
    }
  }, [selectedTeam, loadTeamMembers]);

  const getAvailableUsers = useCallback(() => {
    const memberIds = teamMembers.map(member => member.user_id);
    return users.filter(user => !memberIds.includes(user.id));
  }, [teamMembers, users]);

  const getTeamRoleColor = useCallback((role) => {
    switch (role) {
      case 'leader': return '#ff9800';
      case 'member': return '#4caf50';
      case 'viewer': return '#2196f3';
      default: return '#666';
    }
  }, []);

  if (loading) {
    return <div className="team-management-loading">Loading teams...</div>;
  }

  return (
    <div>
      <div className="team-management-header">
        <h2 className="team-management-title">Team Management</h2>
        {canCreateTeams && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="team-create-button"
          >
            + Create Team
          </button>
        )}
      </div>

      {/* Teams Grid */}
      <div className="teams-grid">
        {visibleTeams.map(team => (
          <div key={team.id} className="team-card performance-optimized">
            {/* Team Header */}
            <div 
              className="team-card-header"
              style={{ backgroundColor: team.color || '#2196F3' }}
            >
              <h3 className="team-card-name">{team.name}</h3>
              <p className="team-card-description">
                {team.description || 'No description'}
              </p>
            </div>

            {/* Team Stats */}
            <div className="team-card-stats">
              <div className="team-stats-grid">
                <div className="team-stat-item">
                  <div className="team-stat-number members">
                    {team.member_count || 0}
                  </div>
                  <div className="team-stat-label">Members</div>
                </div>
                <div className="team-stat-item">
                  <div className="team-stat-number tasks">
                    {team.task_count || 0}
                  </div>
                  <div className="team-stat-label">Tasks</div>
                </div>
                <div className="team-stat-item">
                  <div className="team-stat-number active">
                    {team.active_tasks || 0}
                  </div>
                  <div className="team-stat-label">Active</div>
                </div>
              </div>

              {/* Team Actions */}
              <div className="team-card-actions">
                <button
                  onClick={() => {
                    setSelectedTeam(team);
                    setShowMembersModal(true);
                    loadTeamMembers(team.id);
                  }}
                  className="team-action-button"
                >
                  Members
                </button>
                <button
                  onClick={() => handleDeleteTeam(team.id, team.name)}
                  className="team-action-button danger"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {visibleTeams.length === 0 && !loading && (
        <div className="teams-empty-state">
          <div className="teams-empty-icon">No Teams</div>
          <div className="teams-empty-title">No teams available</div>
          <div className="teams-empty-text">
            {canCreateTeams 
              ? 'Create your first team to get started with team management.'
              : 'You are not a member of any teams yet.'
            }
          </div>
        </div>
      )}

      {/* Create Team Modal */}
      {showCreateModal && (
        <FocusTrapModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          className="modal-overlay performance-optimized"
          ariaLabelledBy="create-team-title"
        >
          <div className="modal-content modal-medium performance-optimized">
            <h3 id="create-team-title" className="team-create-modal-title">Create New Team</h3>
            
            <form onSubmit={handleCreateTeam}>
              <div className="team-form-group">
                <label className="team-form-label" htmlFor="team-name-input">
                  Team Name *
                </label>
                <input
                  id="team-name-input"
                  type="text"
                  value={newTeam.name}
                  onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                  className="team-form-input"
                  required
                  aria-required="true"
                />
              </div>

              <div className="team-form-group">
                <label className="team-form-label" htmlFor="team-description-input">
                  Description
                </label>
                <textarea
                  id="team-description-input"
                  value={newTeam.description}
                  onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                  rows="3"
                  className="team-form-textarea"
                />
              </div>

              <div className="team-form-group">
                <label className="team-form-label" htmlFor="team-color-input">
                  Team Color
                  <span className="sr-only">
                    Current color: {newTeam.color}. Use arrow keys or click to select a color.
                  </span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    id="team-color-input"
                    type="color"
                    value={newTeam.color}
                    onChange={(e) => setNewTeam({ ...newTeam, color: e.target.value })}
                    className="team-form-input"
                    style={{ width: '60px', height: '40px' }}
                    aria-label={`Team color picker, current color ${newTeam.color}`}
                  />
                  <span 
                    className="color-preview-text"
                    aria-live="polite"
                    style={{ 
                      fontSize: '0.875rem', 
                      color: 'var(--text-secondary)',
                      fontWeight: 500
                    }}
                  >
                    {newTeam.color}
                  </span>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-success"
                >
                  Create Team
                </button>
              </div>
            </form>
          </div>
        </FocusTrapModal>
      )}

      {/* Team Members Modal */}
      {showMembersModal && selectedTeam && (
        <FocusTrapModal
          isOpen={showMembersModal}
          onClose={() => setShowMembersModal(false)}
          className="modal-overlay performance-optimized"
          ariaLabelledBy="team-members-title"
        >
          <div className="modal-content team-members-modal performance-optimized">
            <div className="team-members-header">
              <h3 id="team-members-title" className="team-members-title">
                {selectedTeam.name} Members ({teamMembers.length})
              </h3>
              <button
                onClick={() => setShowMembersModal(false)}
                className="team-members-close-button"
                aria-label={`Close ${selectedTeam.name} members dialog`}
                title="Close dialog"
              >
                ✕
              </button>
            </div>

            {/* Add Member Section */}
            {getAvailableUsers().length > 0 && (
              <div className="team-add-member-section">
                <h4 className="team-add-member-title">Add New Member</h4>
                <div className="team-add-member-buttons">
                  {getAvailableUsers().map(user => (
                    <button
                      key={user.id}
                      onClick={() => handleAddMember(user.id)}
                      className="team-add-member-button"
                      aria-label={`Add ${user.full_name || user.username} to team`}
                    >
                      + {user.full_name || user.username}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Members List */}
            <div className="team-members-list">
              {teamMembers.map(member => (
                <div key={member.user_id} className="team-member-item">
                  <div className="team-member-info">
                    <div className="team-member-name">
                      {member.full_name || member.username}
                    </div>
                    <div className="team-member-details">
                      @{member.username} • {member.email}
                    </div>
                  </div>

                  <div className="team-member-actions">
                    <select
                      value={member.team_role}
                      onChange={(e) => handleUpdateMemberRole(member.user_id, e.target.value)}
                      className="team-member-role-select"
                      style={{
                        backgroundColor: getTeamRoleColor(member.team_role),
                        color: 'white'
                      }}
                    >
                      <option value="leader">Team Leader</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>

                    <button
                      onClick={() => handleRemoveMember(member.user_id, member.full_name || member.username)}
                      className="team-member-remove-button"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              {teamMembers.length === 0 && (
                <div className="team-members-empty">
                  <div className="team-members-empty-icon">No Members</div>
                  <div className="team-members-empty-text">No members in this team yet.</div>
                </div>
              )}
            </div>
          </div>
        </FocusTrapModal>
      )}
    </div>
  );
};

export default React.memo(TeamManagement);