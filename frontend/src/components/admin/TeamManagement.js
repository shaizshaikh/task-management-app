/**
 * Team Management Component
 * Admin interface for managing teams and memberships
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import { useRealtime } from '../../hooks/useRealtime';

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

  // Check if user can create teams (only admins and managers)
  const canCreateTeams = () => {
    return isAdmin() || isManager();
  };

  // Filter teams based on user role
  const getVisibleTeams = () => {
    if (isAdmin() || user?.globalRole === 'manager') {
      return teams; // Admins and Global Managers see all teams
    }
    
    // Members and Viewers only see teams they belong to
    return teams.filter(team => 
      user?.teams?.some(userTeam => userTeam.id === team.id)
    );
  };

  useEffect(() => {
    loadTeams();
    loadUsers();

    // Listen for real-time team updates
    const handleTeamUpdate = (notification) => {
      console.log('🔄 Team update received:', notification);
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

  const loadTeams = async () => {
    try {
      const response = await axios.get('/api/teams');
      setTeams(response.data.teams || response.data);
    } catch (error) {
      console.error('Error loading teams:', error);
      toast.error('Failed to load teams');
    }
  };

  const loadUsers = async () => {
    try {
      const response = await axios.get('/api/users');
      setUsers(response.data.users || response.data);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTeamMembers = async (teamId) => {
    try {
      const response = await axios.get(`/api/teams/${teamId}/members`);
      setTeamMembers(response.data.members || response.data);
    } catch (error) {
      console.error('Error loading team members:', error);
      toast.error('Failed to load team members');
    }
  };

  const handleCreateTeam = async (e) => {
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
  };

  const handleDeleteTeam = async (teamId, teamName) => {
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
  };

  const handleAddMember = async (userId, teamRole = 'member') => {
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
  };

  const handleRemoveMember = async (userId, userName) => {
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
  };

  const handleUpdateMemberRole = async (userId, newRole) => {
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
  };

  const getAvailableUsers = () => {
    const memberIds = teamMembers.map(member => member.user_id);
    return users.filter(user => !memberIds.includes(user.id));
  };

  const getTeamRoleColor = (role) => {
    switch (role) {
      case 'leader': return '#ff9800';
      case 'member': return '#4caf50';
      case 'viewer': return '#2196f3';
      default: return '#666';
    }
  };

  if (loading) {
    return <div className="team-management-loading">Loading teams...</div>;
  }

  return (
    <div>
      <div className="team-management-header">
        <h2 className="team-management-title">🏢 Team Management</h2>
        {canCreateTeams() && (
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
        {getVisibleTeams().map(team => (
          <div key={team.id} className="team-card">
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
                  👥 Members
                </button>
                <button
                  onClick={() => handleDeleteTeam(team.id, team.name)}
                  className="team-action-button danger"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {getVisibleTeams().length === 0 && !loading && (
        <div className="teams-empty-state">
          <div className="teams-empty-icon">🏢</div>
          <div className="teams-empty-title">No teams available</div>
          <div className="teams-empty-text">
            {canCreateTeams() 
              ? 'Create your first team to get started with team management.'
              : 'You are not a member of any teams yet.'
            }
          </div>
        </div>
      )}

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content modal-medium">
            <h3 className="team-create-modal-title">Create New Team</h3>
            
            <form onSubmit={handleCreateTeam}>
              <div className="team-form-group">
                <label className="team-form-label">
                  Team Name *
                </label>
                <input
                  type="text"
                  value={newTeam.name}
                  onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                  className="team-form-input"
                  required
                />
              </div>

              <div className="team-form-group">
                <label className="team-form-label">
                  Description
                </label>
                <textarea
                  value={newTeam.description}
                  onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                  rows="3"
                  className="team-form-textarea"
                />
              </div>

              <div className="team-form-group">
                <label className="team-form-label">
                  Team Color
                </label>
                <input
                  type="color"
                  value={newTeam.color}
                  onChange={(e) => setNewTeam({ ...newTeam, color: e.target.value })}
                  className="team-form-input"
                  style={{ width: '60px', height: '40px' }}
                />
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
        </div>
      )}

      {/* Team Members Modal */}
      {showMembersModal && selectedTeam && (
        <div className="modal-overlay">
          <div className="modal-content team-members-modal">
            <div className="team-members-header">
              <h3 className="team-members-title">
                {selectedTeam.name} Members ({teamMembers.length})
              </h3>
              <button
                onClick={() => setShowMembersModal(false)}
                className="team-members-close-button"
              >
                ✕
              </button>
            </div>

            {/* Add Member Section */}
            {getAvailableUsers().length > 0 && (
              <div className="team-add-member-section">
                <h4 className="team-add-member-title">Add New Member</h4>
                <div className="team-add-member-buttons">
                  {getAvailableUsers().slice(0, 5).map(user => (
                    <button
                      key={user.id}
                      onClick={() => handleAddMember(user.id)}
                      className="team-add-member-button"
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
                  <div className="team-members-empty-icon">👥</div>
                  <div className="team-members-empty-text">No members in this team yet.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagement;