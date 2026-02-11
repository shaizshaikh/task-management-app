/**
 * Tasks Page Component
 * Main task management interface with RBAC
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import TaskCard from '../TaskCard';
import { showError, showValidationWarning, announceSuccess } from '../utils/accessibleNotifications';
import { useTaskRealtime, useRealtime } from '../hooks/useRealtime';

const TasksPage = () => {
  const { user, isAdmin, isManager } = useAuth();
  
  // Ensure real-time connection is established
  const { isConnected, connectionError } = useRealtime();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    team_id: '',
    assigned_to: '',
    due_date: ''
  });

  // Debug connection status
  useEffect(() => {
    console.log(`[DEBUG] TasksPage - Connection status:`, {
      isConnected,
      connectionError,
      user: user?.username,
      role: user?.globalRole
    });
  }, [isConnected, connectionError, user]);

  // Enhanced real-time task updates with RBAC awareness
  useTaskRealtime((eventType, notification) => {
    console.log(`[${user?.username}] Processing ${eventType} event:`, notification);
    
    switch (eventType) {
      case 'created':
        setTasks(prevTasks => {
          // Prevent duplicates by checking if task already exists
          const taskExists = prevTasks.some(task => 
            parseInt(task.id) === parseInt(notification.task.id)
          );
          
          if (taskExists) {
            console.log('Task already exists, skipping creation');
            return prevTasks;
          }
          
          console.log('Adding new task to list');
          return [notification.task, ...prevTasks];
        });
        break;
      
      case 'updated':
        setTasks(prevTasks => {
          const updatedTasks = prevTasks.map(task => 
            parseInt(task.id) === parseInt(notification.task.id) ? notification.task : task
          );
          console.log('Task updated in list');
          return updatedTasks;
        });
        break;
      
      case 'deleted':
        setTasks(prevTasks => {
          const filteredTasks = prevTasks.filter(task => 
            parseInt(task.id) !== parseInt(notification.task.id)
          );
          console.log('Task removed from list');
          return filteredTasks;
        });
        break;
      
      case 'comment':
        console.log('💬 Comment added to task:', notification.comment?.task_title);
        break;
      
      default:
        console.log('❓ Unknown task event:', eventType, notification);
    }
  });

  // Initial data load
  useEffect(() => {
    fetchTasks();
    loadUsers();
    loadTeams();
  }, []);

  // Fetch tasks function
  const fetchTasks = async () => {
    try {
      const response = await axios.get('/api/tasks');
      setTasks(response.data.tasks || response.data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      showError('Failed to fetch tasks', user?.globalRole);
    } finally {
      setLoading(false);
    }
  };

  // Load users for assignee dropdown
  const loadUsers = async () => {
    try {
      const response = await axios.get('/api/users');
      setUsers(response.data.users || response.data);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  // Load teams for team selection
  const loadTeams = async () => {
    try {
      const response = await axios.get('/api/teams');
      setTeams(response.data.teams || response.data);
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  };

  // Handle form submission
  const handleCreateTask = async (e) => {
    e.preventDefault();
    
    if (!newTask.title.trim()) {
      showValidationWarning('Please enter a task title!');
      return;
    }

    if (!newTask.team_id) {
      showValidationWarning('Please select a team!');
      return;
    }

    try {
      const taskData = {
        ...newTask,
        assigned_to: newTask.assigned_to || null
      };

      await axios.post('/api/tasks', taskData);
      
      // Reset form
      setNewTask({
        title: '',
        description: '',
        status: 'todo',
        priority: 'medium',
        team_id: '',
        assigned_to: '',
        due_date: ''
      });
      
      setShowForm(false);
      // Success will be announced via real-time notification system
      
    } catch (error) {
      console.error('Error creating task:', error);
      showError(error.response?.data?.error?.message || 'Failed to create task', user?.globalRole);
    }
  };

  // Handle task update
  const handleUpdateTask = async (updatedTask) => {
    try {
      await axios.put(`/api/tasks/${updatedTask.id}`, updatedTask);
      console.log('Task updated! WebSocket will update all clients.');
    } catch (error) {
      console.error('Error updating task:', error);
      showError(error.response?.data?.error?.message || 'Failed to update task', user?.globalRole);
    }
  };

  // Handle task deletion
  const handleDeleteTask = async (taskId) => {
    try {
      await axios.delete(`/api/tasks/${taskId}`);
      console.log('Task deleted! WebSocket will update all clients.');
    } catch (error) {
      console.error('Error deleting task:', error);
      showError(error.response?.data?.error?.message || 'Failed to delete task', user?.globalRole);
    }
  };

  // Check if user can create tasks - Admins, global managers, and team managers can create tasks
  const canCreateTasks = () => {
    if (isAdmin() || isManager()) {
      return true;
    }
    
    // Check if user is a team leader (has leader role in any team)
    return user?.teams?.some(team => team.team_role === 'leader');
  };

  // Get available teams for task creation
  const getAvailableTeams = () => {
    if (isAdmin() || isManager()) {
      // Admin and global managers see all teams
      return teams;
    }
    
    // Team leaders can only create tasks in teams they lead
    const managedTeams = teams.filter(team => 
      user?.teams?.some(userTeam => userTeam.id === team.id && userTeam.team_role === 'leader')
    );
    
    if (managedTeams.length > 0) {
      return managedTeams;
    }
    
    // Regular members can only create tasks in teams they belong to (fallback)
    return teams.filter(team => 
      user?.teams?.some(userTeam => userTeam.id === team.id)
    );
  };

  // Get available users for assignment
  const getAvailableUsers = () => {
    if (!newTask.team_id) return [];
    
    // Filter users who are members of the selected team
    return users.filter(u => 
      u.teams?.some(team => team.id === parseInt(newTask.team_id))
    );
  };

  // Load team members when team is selected
  const loadTeamMembers = async (teamId) => {
    if (!teamId) return;
    
    try {
      const response = await axios.get(`/api/teams/${teamId}/members`);
      const members = response.data.members || [];
      
      // Transform team members to user format
      const teamUsers = members.map(member => ({
        id: member.user_id,
        username: member.username,
        full_name: member.full_name,
        email: member.email,
        teams: [{ id: parseInt(teamId) }] // Add team info for filtering
      }));
      
      // Update users list with team members
      setUsers(prevUsers => {
        // Remove existing users from this team and add new ones
        const otherUsers = prevUsers.filter(u => 
          !u.teams?.some(team => team.id === parseInt(teamId))
        );
        return [...otherUsers, ...teamUsers];
      });
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="card">
          <div className="card-body text-center">
            <div className="loading"></div>
            <p className="mt-2">Loading tasks...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">
          Tasks ({tasks.length})
        </h2>
        
        {canCreateTasks() && (
          <button 
            className="btn btn-primary"
            onClick={() => setShowForm(!showForm)}
            aria-expanded={showForm}
            aria-controls="task-form"
          >
            {showForm ? 'Cancel' : '+ Add New Task'}
          </button>
        )}
      </div>

      {/* Task Creation Form */}
      {showForm && canCreateTasks() && (
        <div className="card mb-4" id="task-form">
          <div className="card-header">
            <h3 className="mb-0">Create New Task</h3>
          </div>
          <div className="card-body">
            {/* Permission explanation */}
            {!isAdmin() && !isManager() && (
              <div className="alert alert-info mb-3">
                <span className="alert-icon" aria-hidden="true">Note</span>
                You can create tasks only for teams where you are a manager.
              </div>
            )}
            
            <form onSubmit={handleCreateTask}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label required" htmlFor="task-title">
                    Task Title
                  </label>
                  <input
                    id="task-title"
                    type="text"
                    className="form-input"
                    placeholder="Enter task title"
                    value={newTask.title}
                    onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                    required
                  />
                </div>
                
                <div className="form-group form-group-full">
                  <label className="form-label" htmlFor="task-description">
                    Description
                  </label>
                  <textarea
                    id="task-description"
                    className="form-input"
                    placeholder="Enter task description"
                    value={newTask.description}
                    onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                    rows="3"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label required" htmlFor="task-team">
                    Team
                  </label>
                  <select
                    id="task-team"
                    className="form-input"
                    value={newTask.team_id}
                    onChange={(e) => {
                      const teamId = e.target.value;
                      setNewTask({...newTask, team_id: teamId, assigned_to: ''});
                      if (teamId) {
                        loadTeamMembers(teamId);
                      }
                    }}
                    required
                  >
                    <option value="">Select Team</option>
                    {getAvailableTeams().map(team => {
                      // Find user's role in this team
                      const userTeam = user?.teams?.find(ut => ut.id === team.id);
                      const roleIndicator = userTeam?.team_role === 'leader' ? ' (Team Leader)' : '';
                      
                      return (
                        <option key={team.id} value={team.id}>
                          {team.name}{roleIndicator}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="task-assignee">
                    Assignee
                  </label>
                  <select
                    id="task-assignee"
                    className="form-input"
                    value={newTask.assigned_to}
                    onChange={(e) => setNewTask({...newTask, assigned_to: e.target.value})}
                    disabled={!newTask.team_id}
                  >
                    <option value="">Unassigned</option>
                    {getAvailableUsers().map(user => (
                      <option key={user.id} value={user.id}>
                        {user.full_name} ({user.username})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label" htmlFor="task-status">
                    Status
                  </label>
                  <select
                    id="task-status"
                    className="form-input"
                    value={newTask.status}
                    onChange={(e) => setNewTask({...newTask, status: e.target.value})}
                  >
                    <option value="todo">To Do</option>
                    <option value="in-progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label" htmlFor="task-priority">
                    Priority
                  </label>
                  <select
                    id="task-priority"
                    className="form-input"
                    value={newTask.priority}
                    onChange={(e) => setNewTask({...newTask, priority: e.target.value})}
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="task-due-date">
                    Due Date
                  </label>
                  <input
                    id="task-due-date"
                    type="date"
                    className="form-input"
                    value={newTask.due_date}
                    onChange={(e) => setNewTask({...newTask, due_date: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tasks List */}
      <div className="tasks-grid">
        {tasks.map(task => (
          <TaskCard 
            key={task.id} 
            task={task} 
            onUpdate={handleUpdateTask}
            onDelete={handleDeleteTask}
            currentUser={user}
          />
        ))}
        
        {tasks.length === 0 && (
          <div className="card">
            <div className="card-body text-center">
              <h3 className="mb-3">No tasks yet!</h3>
              <p className="text-secondary">
                {canCreateTasks() 
                  ? 'Create your first task to get started.' 
                  : 'No tasks are visible to you yet.'
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TasksPage;