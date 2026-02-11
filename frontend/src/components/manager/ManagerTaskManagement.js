/**
 * Manager Task Management Component
 * Task management interface for team leaders
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { toast } from 'react-toastify';
import FocusTrapModal from '../FocusTrapModal';

const ManagerTaskManagement = ({ teams, onRefresh }) => {
  const { user, isAdmin } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Status mapping between frontend display and backend values
  const statusMapping = {
    // Frontend -> Backend
    'pending': 'todo',
    'in_progress': 'in-progress', 
    'completed': 'done'
  };

  const reverseStatusMapping = {
    // Backend -> Frontend
    'todo': 'pending',
    'in-progress': 'in_progress',
    'done': 'completed'
  };
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium',
    team_id: '',
    assigned_to: '',
    due_date: ''
  });

  useEffect(() => {
    loadTasks();
  }, [teams]);

  useEffect(() => {
    applyFilters();
  }, [tasks, selectedTeam, statusFilter, priorityFilter]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      
      // Get tasks for all managed teams
      const teamIds = teams.map(team => team.id);
      const taskPromises = teamIds.map(teamId => 
        axios.get(`/api/tasks/team/${teamId}`)
      );
      
      const taskResponses = await Promise.all(taskPromises);
      const allTasks = taskResponses.flatMap(response => response.data.tasks || [])
        .map(task => ({
          ...task,
          // Convert backend status to frontend status for display
          status: reverseStatusMapping[task.status] || task.status
        }));
      
      setTasks(allTasks);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...tasks];

    // Team filter
    if (selectedTeam !== 'all') {
      filtered = filtered.filter(task => task.team_id === parseInt(selectedTeam));
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(task => task.status === statusFilter);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(task => task.priority === priorityFilter);
    }

    setFilteredTasks(filtered);
  };

  const handleCreateTask = async () => {
    if (!newTask.title || !newTask.team_id) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      const taskData = {
        ...newTask,
        assigned_to: newTask.assigned_to || null,
        due_date: newTask.due_date || null
      };

      await axios.post('/api/tasks', taskData);
      toast.success('Task created successfully');
      setShowCreateModal(false);
      setNewTask({
        title: '',
        description: '',
        priority: 'medium',
        team_id: '',
        assigned_to: '',
        due_date: ''
      });
      loadTasks();
    } catch (error) {
      console.error('Failed to create task:', error);
      toast.error(error.response?.data?.error || 'Failed to create task');
    }
  };

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    try {
      // Convert frontend status to backend status
      const backendStatus = statusMapping[newStatus] || newStatus;
      await axios.put(`/api/tasks/${taskId}/status`, { status: backendStatus });
      toast.success('Task status updated');
      loadTasks();
    } catch (error) {
      console.error('Failed to update task status:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to update task status');
    }
  };

  const handleDeleteTask = async (taskId, taskTitle) => {
    if (!window.confirm(`Delete task "${taskTitle}"?`)) return;

    try {
      await axios.delete(`/api/tasks/${taskId}`);
      toast.success('Task deleted successfully');
      loadTasks();
    } catch (error) {
      console.error('Failed to delete task:', error);
      toast.error('Failed to delete task');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': 
      case 'done': return '#4CAF50';
      case 'in_progress': 
      case 'in-progress': return '#ff9800';
      case 'pending': 
      case 'todo': return '#2196F3';
      default: return '#666';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#f44336';
      case 'medium': return '#ff9800';
      case 'low': return '#4CAF50';
      default: return '#666';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No due date';
    return new Date(dateString).toLocaleDateString();
  };

  const isOverdue = (dueDateString, status) => {
    if (!dueDateString) return false;
    return new Date(dueDateString) < new Date() && status !== 'completed' && status !== 'done';
  };

  const getStatusDisplayText = (status) => {
    switch (status) {
      case 'pending':
      case 'todo': return 'Pending';
      case 'in_progress':
      case 'in-progress': return 'In Progress';
      case 'completed':
      case 'done': return 'Completed';
      default: return status;
    }
  };

  const getTeamName = (teamId) => {
    const team = teams.find(t => t.id === teamId);
    return team ? team.name : 'Unknown Team';
  };

  const getTeamMembers = (teamId) => {
    const team = teams.find(t => t.id === teamId);
    return team ? team.members || [] : [];
  };

  const canManageTasksInTeam = (teamId) => {
    if (isAdmin()) return true;
    
    const team = teams.find(t => t.id === teamId);
    if (!team) return false;
    
    const userMembership = team.members?.find(member => member.user_id === user.id);
    return userMembership && userMembership.team_role === 'leader';
  };

  const canModifyTask = (task) => {
    if (isAdmin()) return true;
    
    // Check if user is leader of the task's team
    return canManageTasksInTeam(task.team_id);
  };

  if (loading) {
    return (
      <div className="loading-layout">
        <div className="loading-text">Loading tasks...</div>
        <div className="auth-loading-spinner"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header and Controls */}
      <div className="manager-header">
        <h3 className="manager-title">
          Task Management ({filteredTasks.length} tasks)
        </h3>
        
        <div className="manager-controls">
          {!isAdmin() && (
            <span className="manager-note">
              Team Leader permissions only
            </span>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-success"
          >
            + Create Task
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="manager-task-filters">
        <div className="manager-filter-group">
          <label className="manager-filter-label">
            Team:
          </label>
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="manager-filter-select"
          >
            <option value="all">All Teams</option>
            {teams.map(team => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
        </div>

        <div className="manager-filter-group">
          <label className="manager-filter-label">
            Status:
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="manager-filter-select"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div className="manager-filter-group">
          <label className="manager-filter-label">
            Priority:
          </label>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="manager-filter-select"
          >
            <option value="all">All Priority</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
        <div className="manager-tasks-empty">
          <div className="manager-tasks-empty-icon">No Tasks</div>
          <h3 className="manager-tasks-empty-title">No Tasks Found</h3>
          <p className="manager-tasks-empty-description">
            {tasks.length === 0 
              ? 'No tasks have been created yet.'
              : 'No tasks match the current filters.'
            }
          </p>
        </div>
      ) : (
        <div className="manager-tasks-grid">
          {filteredTasks.map(task => (
            <div key={task.id} className="manager-task-card" style={{ borderLeft: `4px solid ${getStatusColor(task.status)}` }}>
              {/* Task Header */}
              <div className="manager-task-header">
                <h4 className="manager-task-title">
                  {task.title}
                </h4>
                <div className="manager-task-priority-badges">
                  <span 
                    className="manager-task-priority-badge"
                    style={{ backgroundColor: getPriorityColor(task.priority) }}
                    aria-label={`Priority: ${task.priority}`}
                  >
                    {task.priority}
                  </span>
                </div>
              </div>

              {/* Task Description */}
              {task.description && (
                <p className="manager-task-description">
                  {task.description.length > 100 
                    ? `${task.description.substring(0, 100)}...`
                    : task.description
                  }
                </p>
              )}

              {/* Task Details */}
              <div className="manager-task-details">
                <div className="manager-task-detail-item">
                  <strong>Team:</strong> {getTeamName(task.team_id)}
                </div>
                {task.assigned_to_name && (
                  <div className="manager-task-detail-item">
                    <strong>Assigned to:</strong> {task.assigned_to_name}
                  </div>
                )}
                <div className="manager-task-detail-item">
                  <strong>Due:</strong> 
                  <span className={`manager-task-due-date ${isOverdue(task.due_date, task.status) ? 'overdue' : ''}`}>
                    {formatDate(task.due_date)}
                    {isOverdue(task.due_date, task.status) && ' (Overdue)'}
                  </span>
                </div>
                <div>
                  <strong>Created:</strong> {formatDate(task.created_at)}
                </div>
              </div>

              {/* Task Actions */}
              <div className="manager-task-actions">
                {canModifyTask(task) ? (
                  <select
                    value={task.status}
                    onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value)}
                    className="manager-task-status-select"
                    style={{ backgroundColor: getStatusColor(task.status) }}
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                ) : (
                  <span 
                    className="manager-task-status-badge"
                    style={{ backgroundColor: getStatusColor(task.status) }}
                  >
                    {getStatusDisplayText(task.status)}
                  </span>
                )}

                <div className="manager-task-action-buttons">
                  {canModifyTask(task) && (
                    <button
                      onClick={() => handleDeleteTask(task.id, task.title)}
                      className="manager-task-delete-btn"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateModal && (
        <FocusTrapModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setNewTask({
              title: '',
              description: '',
              priority: 'medium',
              team_id: '',
              assigned_to: '',
              due_date: ''
            });
          }}
          className="manager-modal-overlay"
          ariaLabelledby="create-task-title"
        >
          <div className="manager-modal-content manager-modal-wide">
            <h3 id="create-task-title" className="manager-modal-title">
              Create New Task
            </h3>

            <div className="manager-modal-form-group">
              <label className="manager-modal-label">
                Title *
              </label>
              <input
                type="text"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                className="form-input"
                placeholder="Enter task title"
              />
            </div>

            <div className="manager-modal-form-group">
              <label className="manager-modal-label">
                Description
              </label>
              <textarea
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                className="form-textarea"
                placeholder="Enter task description"
              />
            </div>

            <div className="form-grid-2">
              <div className="manager-modal-form-group">
                <label className="manager-modal-label">
                  Team *
                </label>
                <select
                  value={newTask.team_id}
                  onChange={(e) => setNewTask({ ...newTask, team_id: e.target.value, assigned_to: '' })}
                  className="manager-modal-select"
                >
                  <option value="">Select team...</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>

              <div className="manager-modal-form-group">
                <label className="manager-modal-label">
                  Priority
                </label>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                  className="manager-modal-select"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div className="form-grid-2">
              <div className="manager-modal-form-group">
                <label className="manager-modal-label">
                  Assign to
                </label>
                <select
                  value={newTask.assigned_to}
                  onChange={(e) => setNewTask({ ...newTask, assigned_to: e.target.value })}
                  className="manager-modal-select"
                  disabled={!newTask.team_id}
                >
                  <option value="">Unassigned</option>
                  {newTask.team_id && getTeamMembers(parseInt(newTask.team_id)).map(member => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.full_name || member.username}
                    </option>
                  ))}
                </select>
              </div>

              <div className="manager-modal-form-group">
                <label className="manager-modal-label">
                  Due Date
                </label>
                <input
                  type="date"
                  value={newTask.due_date}
                  onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                  className="form-input"
                />
              </div>
            </div>

            <div className="manager-modal-buttons">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewTask({
                    title: '',
                    description: '',
                    priority: 'medium',
                    team_id: '',
                    assigned_to: '',
                    due_date: ''
                  });
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTask}
                disabled={!newTask.title || !newTask.team_id}
                className="btn btn-primary"
              >
                Create Task
              </button>
            </div>
          </div>
        </FocusTrapModal>
      )}
    </div>
  );
};

export default ManagerTaskManagement;