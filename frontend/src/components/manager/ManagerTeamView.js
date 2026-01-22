/**
 * Manager Team View Component
 * Detailed view of teams managed by the current user (team leaders)
 */

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { toast } from 'react-toastify';

const ManagerTeamView = ({ teams, onRefresh }) => {
  const { user, isAdmin } = useAuth();
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [newMember, setNewMember] = useState({ userId: '', role: 'member' });
  const [loading, setLoading] = useState(false);

  const handleTeamSelect = (team) => {
    setSelectedTeam(selectedTeam?.id === team.id ? null : team);
  };

  const loadAvailableUsers = async () => {
    try {
      const response = await axios.get('/api/users');
      setAvailableUsers(response.data.users || []);
    } catch (error) {
      console.error('Failed to load users:', error);
      toast.error('Failed to load available users');
    }
  };

  const handleAddMember = async () => {
    if (!newMember.userId || !selectedTeam) return;

    try {
      setLoading(true);
      await axios.post(`/api/teams/${selectedTeam.id}/members`, {
        user_id: parseInt(newMember.userId),
        team_role: newMember.role
      });

      toast.success('Team member added successfully');
      setShowAddMemberModal(false);
      setNewMember({ userId: '', role: 'member' });
      onRefresh();
    } catch (error) {
      console.error('Failed to add team member:', error);
      toast.error(error.response?.data?.error || 'Failed to add team member');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (teamId, userId, userName) => {
    if (!window.confirm(`Remove ${userName} from the team?`)) return;

    try {
      await axios.delete(`/api/teams/${teamId}/members/${userId}`);
      toast.success('Team member removed successfully');
      onRefresh();
    } catch (error) {
      console.error('Failed to remove team member:', error);
      toast.error(error.response?.data?.error || 'Failed to remove team member');
    }
  };

  const handleUpdateMemberRole = async (teamId, userId, newRole, userName) => {
    try {
      await axios.put(`/api/teams/${teamId}/members/${userId}`, {
        team_role: newRole
      });
      toast.success(`${userName}'s role updated to ${newRole}`);
      onRefresh();
    } catch (error) {
      console.error('Failed to update member role:', error);
      toast.error(error.response?.data?.error || 'Failed to update member role');
    }
  };

  const getTeamRoleColor = (role) => {
    switch (role) {
      case 'leader': return '#ff9800';
      case 'member': return '#4caf50';
      case 'viewer': return '#2196f3';
      default: return '#666';
    }
  };

  const canManageTeam = (team) => {
    if (isAdmin()) return true;
    
    // Check if current user is specifically a leader of this team
    const userMembership = team.members?.find(member => member.user_id === user.id);
    return userMembership && userMembership.team_role === 'leader';
  };

  const canModifyMember = (team, member) => {
    if (isAdmin()) return true;
    
    // Leaders can modify team members, but not remove themselves
    const userMembership = team.members?.find(m => m.user_id === user.id);
    const isTeamLeader = userMembership && userMembership.team_role === 'leader';
    const isModifyingSelf = member.user_id === user.id;
    
    return isTeamLeader && !isModifyingSelf;
  };

  return (
    <div>
      <div className="manager-header">
        <h3 className="manager-title">
          My Teams ({teams.length})
        </h3>
      </div>

      {/* Teams Grid */}
      <div className="manager-teams-grid">
        {teams.map(team => (
          <div key={team.id} className={`manager-team-card ${selectedTeam?.id === team.id ? 'selected' : ''}`}>
            {/* Team Header */}
            <div 
              className="manager-team-header"
              style={{ backgroundColor: team.color || '#2196F3' }}
              onClick={() => handleTeamSelect(team)}
            >
              <div className="manager-team-header-content">
                <h4 className="manager-team-name">{team.name}</h4>
                <span className="manager-team-member-count">
                  {team.members?.length || 0} members
                </span>
              </div>
              {team.description && (
                <p className="manager-team-description">
                  {team.description}
                </p>
              )}
            </div>

            {/* Team Members (shown when selected) */}
            {selectedTeam?.id === team.id && (
              <div className="manager-team-body">
                <div className="manager-team-members-header">
                  <h5 className="manager-team-members-title">Team Members</h5>
                  {(isAdmin() || user?.globalRole === 'manager') && (
                    <button
                      onClick={() => {
                        setShowAddMemberModal(true);
                        loadAvailableUsers();
                      }}
                      className="btn btn-success btn-small"
                    >
                      + Add Member
                    </button>
                  )}
                </div>

                {team.members && team.members.length > 0 ? (
                  <div className="manager-team-members-list">
                    {team.members.map(member => (
                      <div key={member.user_id} className="manager-team-member-item">
                        <div className="manager-team-member-info">
                          <div className="manager-team-member-name">
                            {member.full_name || member.username}
                          </div>
                          <div className="manager-team-member-email">
                            {member.email}
                          </div>
                        </div>
                        
                        <div className="manager-team-member-actions">
                          {canManageTeam(team) && member.user_id !== user.id ? (
                            <select
                              value={member.team_role}
                              onChange={(e) => handleUpdateMemberRole(
                                team.id, 
                                member.user_id, 
                                e.target.value,
                                member.full_name || member.username
                              )}
                              className="manager-team-role-select"
                              style={{ backgroundColor: getTeamRoleColor(member.team_role), color: 'white' }}
                            >
                              <option value="leader">Team Leader</option>
                              <option value="member">Member</option>
                              <option value="viewer">Viewer</option>
                            </select>
                          ) : (
                            <span 
                              className={`manager-team-role-badge ${member.team_role}`}
                              style={{ backgroundColor: getTeamRoleColor(member.team_role) }}
                            >
                              {member.team_role}
                              {member.user_id === user.id && ' (You)'}
                            </span>
                          )}
                          
                          {canModifyMember(team, member) && (
                            <button
                              onClick={() => handleRemoveMember(
                                team.id, 
                                member.user_id,
                                member.full_name || member.username
                              )}
                              className="btn btn-error btn-small"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="manager-team-members-empty">
                    No team members
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="manager-modal-overlay">
          <div className="manager-modal-content">
            <h3 className="manager-modal-title">
              Add Team Member to {selectedTeam?.name}
            </h3>

            <div className="manager-modal-form-group">
              <label className="manager-modal-label">
                Select User:
              </label>
              <select
                value={newMember.userId}
                onChange={(e) => setNewMember({ ...newMember, userId: e.target.value })}
                className="manager-modal-select"
              >
                <option value="">Choose a user...</option>
                {availableUsers
                  .filter(user => !selectedTeam?.members?.some(member => member.user_id === user.id))
                  .map(user => (
                    <option key={user.id} value={user.id}>
                      {user.full_name || user.username} ({user.email})
                    </option>
                  ))
                }
              </select>
            </div>

            <div className="manager-modal-form-group">
              <label className="manager-modal-label">
                Role:
              </label>
              <select
                value={newMember.role}
                onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                className="manager-modal-select"
              >
                <option value="member">Member</option>
                <option value="leader">Team Leader</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>

            <div className="manager-modal-actions">
              <button
                onClick={() => {
                  setShowAddMemberModal(false);
                  setNewMember({ userId: '', role: 'member' });
                }}
                className="btn btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleAddMember}
                disabled={!newMember.userId || loading}
                className="btn btn-success"
              >
                {loading ? 'Adding...' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerTeamView;