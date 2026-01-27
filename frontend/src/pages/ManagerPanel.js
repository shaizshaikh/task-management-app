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

  // Handle tab change with minimal announcements
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    // No live region announcements - let ARIA handle it naturally
  };

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
      label: 'Dashboard',
      icon: 'Dashboard'
    },
    {
      id: 'teams',
      label: 'My Teams',
      icon: 'Teams'
    },
    {
      id: 'tasks',
      label: 'Task Management',
      icon: 'Tasks'
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
    <div className="page-container">
      {/* Header */}
      <header className="page-header">
        <div>
          <h2 className="page-title">
            Manager Panel
            {isAdmin() && (
              <span className="manager-admin-badge">
                Admin View
              </span>
            )}
          </h2>
          <p className="page-subtitle">
            {isAdmin() 
              ? 'Manage all teams, tasks, and team members (Admin View)'
              : 'Manage teams where you have team leader permissions'
            }
            {managerTeams.length > 0 && (
              <span> • Managing {managerTeams.length} team{managerTeams.length !== 1 ? 's' : ''}</span>
            )}
          </p>
        </div>
      </header>

      {/* No Teams Message */}
      {managerTeams.length === 0 && (
        <div className="manager-empty-state">
          <div className="manager-empty-icon">No Teams</div>
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
          {/* Navigation Tabs */}
          <nav className="tab-navigation" role="tablist" aria-label="Manager panel sections">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => handleTabChange(tab.id)}
                onKeyDown={(e) => {
                  // Arrow key navigation for tabs
                  const tabIds = tabs.map(t => t.id);
                  const currentIndex = tabIds.indexOf(activeTab);
                  
                  if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    const nextIndex = (currentIndex + 1) % tabIds.length;
                    handleTabChange(tabIds[nextIndex]);
                    document.getElementById(`${tabIds[nextIndex]}-tab`)?.focus();
                  } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const prevIndex = (currentIndex - 1 + tabIds.length) % tabIds.length;
                    handleTabChange(tabIds[prevIndex]);
                    document.getElementById(`${tabIds[prevIndex]}-tab`)?.focus();
                  } else if (e.key === 'Home') {
                    e.preventDefault();
                    handleTabChange(tabIds[0]);
                    document.getElementById(`${tabIds[0]}-tab`)?.focus();
                  } else if (e.key === 'End') {
                    e.preventDefault();
                    handleTabChange(tabIds[tabIds.length - 1]);
                    document.getElementById(`${tabIds[tabIds.length - 1]}-tab`)?.focus();
                  }
                }}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`${tab.id}-panel`}
                id={`${tab.id}-tab`}
                tabIndex={activeTab === tab.id ? 0 : -1}
              >
                <span className="tab-icon" aria-hidden="true">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* Tab Content */}
          <main className="tab-content">
            <section 
              id="dashboard-panel" 
              role="tabpanel" 
              aria-labelledby="dashboard-tab"
              className="tab-panel"
              hidden={activeTab !== 'dashboard'}
              aria-hidden={activeTab !== 'dashboard'}
            >
              <ManagerDashboard 
                teams={managerTeams}
                onRefresh={loadManagerTeams}
              />
            </section>
            
            <section 
              id="teams-panel" 
              role="tabpanel" 
              aria-labelledby="teams-tab"
              className="tab-panel"
              hidden={activeTab !== 'teams'}
              aria-hidden={activeTab !== 'teams'}
            >
              <ManagerTeamView 
                teams={managerTeams}
                onRefresh={loadManagerTeams}
              />
            </section>
            
            <section 
              id="tasks-panel" 
              role="tabpanel" 
              aria-labelledby="tasks-tab"
              className="tab-panel"
              hidden={activeTab !== 'tasks'}
              aria-hidden={activeTab !== 'tasks'}
            >
              <ManagerTaskManagement 
                teams={managerTeams}
                onRefresh={loadManagerTeams}
              />
            </section>
          </main>

        </>
      )}
    </div>
  );
};

export default ManagerPanel;