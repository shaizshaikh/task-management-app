/**
 * User Profile Page Component
 * Displays and allows editing of user profile information
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { toast } from 'react-toastify';

const ProfilePage = () => {
  const { user, userProfile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    avatar_url: ''
  });

  useEffect(() => {
    if (userProfile) {
      setFormData({
        full_name: userProfile.full_name || '',
        avatar_url: userProfile.avatar_url || ''
      });
    }
  }, [userProfile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.put('/api/users/me/profile', formData);
      await refreshProfile();
      setEditing(false);
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      full_name: userProfile?.full_name || '',
      avatar_url: userProfile?.avatar_url || ''
    });
    setEditing(false);
  };

  if (!user || !userProfile) {
    return (
      <div className="page-container">
        <div className="card">
          <div className="card-body text-center">
            <div className="loading"></div>
            <p className="mt-2">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-card">
        <div className="profile-card-header">
          <h2 className="page-title">👤 User Profile</h2>
          <p className="page-subtitle">
            Manage your personal information and account settings
          </p>
        </div>
        <div className="profile-card-body">

      {/* Profile Header */}
      <div className="profile-header">
        <div 
          className="profile-avatar"
          style={{
            backgroundImage: userProfile.avatar_url ? `url(${userProfile.avatar_url})` : 'none'
          }}
        >
          {!userProfile.avatar_url && (user.name?.[0] || user.username?.[0] || '?').toUpperCase()}
        </div>
        <div className="profile-info">
          <h3 className="profile-name">
            {userProfile.full_name || user.username}
          </h3>
          <p className="profile-email">
            {user.email}
          </p>
          <div className="profile-role">
            {user.globalRole}
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <form onSubmit={handleSubmit}>
        <div className="profile-section">
          <h3 className="profile-section-title">Personal Information</h3>
          
          <div className="profile-form-group">
            <label className="profile-form-label">
              Username
            </label>
            <input
              type="text"
              value={user.username}
              disabled
              className="profile-form-input"
            />
            <small className="profile-form-help">Username cannot be changed</small>
          </div>

          <div className="profile-form-group">
            <label className="profile-form-label">
              Email
            </label>
            <input
              type="email"
              value={user.email}
              disabled
              className="profile-form-input"
            />
            <small className="profile-form-help">Email is managed by Keycloak</small>
          </div>

          <div className="profile-form-group">
            <label className="profile-form-label">
              Full Name
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              disabled={!editing}
              className="profile-form-input"
            />
          </div>

          <div className="profile-form-group">
            <label className="profile-form-label">
              Avatar URL
            </label>
            <input
              type="url"
              value={formData.avatar_url}
              onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
              disabled={!editing}
              placeholder="https://example.com/avatar.jpg"
              className="profile-form-input"
            />
          </div>
        </div>

        {/* Team Memberships */}
        <div className="profile-section">
          <h3 className="profile-section-title">Team Memberships</h3>
          {user.teams && user.teams.length > 0 ? (
            <div className="profile-teams-grid">
              {user.teams.map(team => (
                <div key={team.id} className="profile-team-item">
                  <div className="profile-team-info">
                    <div className="profile-team-name" style={{ color: team.color || 'var(--text-primary)' }}>
                      {team.name}
                    </div>
                    {team.description && (
                      <div className="profile-team-description">
                        {team.description}
                      </div>
                    )}
                  </div>
                  <div className={`profile-team-role ${team.team_role}`}>
                    {team.team_role}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="profile-teams-empty">
              You are not a member of any teams yet.
            </p>
          )}
        </div>

        {/* Task Statistics */}
        {userProfile.task_statistics && (
          <div className="profile-stats-section">
            <h3 className="profile-section-title">Task Statistics</h3>
            <div className="profile-stats-grid">
              <div className="profile-stat-card">
                <div className="profile-stat-value">
                  {userProfile.task_statistics.total_assigned}
                </div>
                <div className="profile-stat-label">Total Assigned</div>
              </div>
              <div className="profile-stat-card">
                <div className="profile-stat-value">
                  {userProfile.task_statistics.in_progress_count}
                </div>
                <div className="profile-stat-label">In Progress</div>
              </div>
              <div className="profile-stat-card">
                <div className="profile-stat-value">
                  {userProfile.task_statistics.completed_count}
                </div>
                <div className="profile-stat-label">Completed</div>
              </div>
              <div className="profile-stat-card">
                <div className="profile-stat-value">
                  {userProfile.task_statistics.overdue_count}
                </div>
                <div className="profile-stat-label">Overdue</div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="form-actions form-actions-end">
          {editing ? (
            <>
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="btn btn-primary"
            >
              Edit Profile
            </button>
          )}
        </div>
      </form>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;