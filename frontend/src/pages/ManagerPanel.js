/**
 * Manager Panel
 * Dashboard and management interface for team managers
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { toast } from 'react-toastify';

// Manager-specific components
import ManagerDashboard from '../components/manager/ManagerDashboard';
import ManagerTeamView from '../components/manager/ManagerTeamView';
import ManagerTaskManagement from '../components/manager/ManagerTaskManagement';

const ManagerPanel = () => {
  const { user, isAdmin, isManager } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [managerTeams, setManagerTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load manager's teams
  useEffect(() => {
    loadManagerTeams();
  }, []);

  const loadManagerTeams = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/teams');
      
      // Filter teams based on user's actual team permissions
      const teams = response.data.teams || [];
      let managedTeams = [];
      
      if (isAdmin() || isManager()) {
        // Admins and Global Managers can see all teams
        managedTeams = teams;
      } else {
        // Filter teams where user is a team leader
        managedTeams = teams.filter(team => {
          // Check if user is in this team with leader role
          const userMembership = team.members?.find(member => member.user_id === user.id);
          return userMembership && userMembership.team_role === 'leader';
        });
      }
      
      setManagerTeams(managedTeams);
    } catch (error) {
      console.error('Failed to load manager teams:', error);
      toast.error('Failed to load your teams');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    {
      id: 'dashboard',
      label: '📊 Dashboard',
      icon: '📊'
    },
    {
      id: 'teams',
      label: '👥 My Teams',
      icon: '👥'
    },
    {
      id: 'tasks',
      label: '📋 Task Management',
      icon: '📋'
    }
  ];

  if (loading) {
    return (
      <div className="loading-layout">
        <div className="loading-text">
          Loading manager panel...
        </div>
        <div className="loading"></div>
      </div>
    );
  }

  return (
    <div className="manager-panel-container">
      {/* Header */}
      <div className="manager-panel-header">
        <h2 className="manager-panel-title">
          👔 Manager Panel
          {isAdmin() && (
            <span className="manager-admin-badge">
              Admin View
            </span>
          )}
        </h2>
        <p className="manager-panel-subtitle">
          {isAdmin() 
            ? 'Manage all teams, tasks, and team members (Admin View)'
            : 'Manage teams where you have team leader permissions'
          }
          {managerTeams.length > 0 && (
            <span> • Managing {managerTeams.length} team{managerTeams.length !== 1 ? 's' : ''}</span>
          )}
        </p>
      </div>

      {/* No Teams Message */}
      {managerTeams.length === 0 && (
        <div className="manager-empty-state">
          <div className="manager-empty-icon">👥</div>
          <h3 className="manager-empty-title">No Teams to Manage</h3>
          <p className="manager-empty-description">
            {isAdmin() 
              ? 'No teams exist in the system yet.'
              : 'You are not assigned as a team leader yet. Contact your administrator to be assigned as a team leader.'
            }
          </p>
          {isAdmin() && (
            <p className="manager-empty-admin-note">
              Create teams from the Admin Panel to get started.
            </p>
          )}
        </div>
      )}

      {/* Manager Interface */}
      {managerTeams.length > 0 && (
        <>
          {/* Tab Navigation */}
          <div className="tab-navigation-manager">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-button-manager ${activeTab === tab.id ? 'active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div>
            {activeTab === 'dashboard' && (
              <ManagerDashboard 
                teams={managerTeams}
                onRefresh={loadManagerTeams}
              />
            )}
            
            {activeTab === 'teams' && (
              <ManagerTeamView 
                teams={managerTeams}
                onRefresh={loadManagerTeams}
              />
            )}
            
            {activeTab === 'tasks' && (
              <ManagerTaskManagement 
                teams={managerTeams}
                onRefresh={loadManagerTeams}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ManagerPanel;