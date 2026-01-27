import React, { useState, useEffect } from 'react';
import axios from 'axios';
import TaskComments from './components/TaskComments';
import TaskAttachments from './components/TaskAttachments';
import { useAuth } from './contexts/AuthContext';
import { showError, showValidationWarning, announceSuccess } from './utils/accessibleNotifications';

// Simple component to show attachment count
const AttachmentCountBadge = ({ taskId }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const loadAttachmentCount = async () => {
      try {
        const response = await axios.get(`/api/attachments/task/${taskId}`);
        setCount(response.data.attachments?.length || 0);
      } catch (error) {
        // Silently fail - not critical
        setCount(0);
      }
    };

    if (taskId) {
      loadAttachmentCount();
    }
  }, [taskId]);

  if (count === 0) return null;

  return (
    <span 
      className="attachment-badge"
      aria-label={`${count} attachment${count !== 1 ? 's' : ''}`}
    >
      <span aria-hidden="true">Files</span>
      <span className="sr-only">{count} attachment{count !== 1 ? 's' : ''}</span>
      {count} file{count !== 1 ? 's' : ''}
    </span>
  );
};

const TaskCard = ({ task, onUpdate, onDelete }) => {
  const { user, isAdmin, isManager, getTeamRole } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState({});
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(false);

  // Determine user's permissions for this task
  const userTeamRole = getTeamRole(task.team_id);
  const canFullEdit = isAdmin() || isManager() || userTeamRole === 'leader';
  
  // Members can only edit tasks assigned to them
  const isAssignedToUser = task.assigned_to_id === user?.id || task.assigned_to === user?.id;
  const canEditTask = canFullEdit || (userTeamRole === 'member' && isAssignedToUser);
  
  // Only admin and team leaders can delete tasks
  const canDeleteTask = isAdmin() || userTeamRole === 'leader';
  
  // Members can only edit status, not title/description
  const canEditContent = canFullEdit;

  // Pre-fill form when editing starts
  const startEditing = () => {
    setEditedTask({
      ...task,
      due_date: task.due_date ? task.due_date.split('T')[0] : '', // Format date for input
      assigned_to: task.assigned_to_id || '', // Use assigned_to_id from backend
      team_id: task.team_id || '' // Include team_id for editing
    });
    setIsEditing(true);
  };

  // Load teams when editing starts
  useEffect(() => {
    if (isEditing && teams.length === 0) {
      loadTeams();
    }
  }, [isEditing]);

  // Load users when team changes
  useEffect(() => {
    if (isEditing && editedTask.team_id) {
      loadUsersForTeam(editedTask.team_id);
    } else if (isEditing && !editedTask.team_id) {
      setUsers([]);
    }
  }, [isEditing, editedTask.team_id]);

  // Ensure currently assigned user is in the dropdown
  useEffect(() => {
    if (isEditing && editedTask.assigned_to && users.length > 0) {
      const assignedUserExists = users.some(u => u.id === editedTask.assigned_to);
      if (!assignedUserExists && task.assigned_to_name) {
        // Add the currently assigned user to the list
        setUsers(prev => [{
          id: editedTask.assigned_to,
          username: task.assigned_to_username || task.assigned_to_name,
          full_name: task.assigned_to_name
        }, ...prev]);
      }
    }
  }, [isEditing, editedTask.assigned_to, users, task.assigned_to_name, task.assigned_to_username]);

  // Get available teams for task editing (same logic as task creation)
  const getAvailableTeams = (allTeams) => {
    if (isAdmin() || isManager()) {
      // Admin and global managers see all teams
      return allTeams;
    }
    
    // Team leaders can only edit tasks in teams they lead
    const managedTeams = allTeams.filter(team => 
      user?.teams?.some(userTeam => userTeam.id === team.id && userTeam.team_role === 'leader')
    );
    
    if (managedTeams.length > 0) {
      return managedTeams;
    }
    
    // Regular members can only edit tasks in teams they belong to (fallback)
    return allTeams.filter(team => 
      user?.teams?.some(userTeam => userTeam.id === team.id)
    );
  };

  const loadTeams = async () => {
    setLoadingTeams(true);
    try {
      const response = await axios.get('/api/teams');
      const allTeams = response.data.teams || response.data;
      
      // Filter teams based on user permissions (same as task creation)
      const availableTeams = getAvailableTeams(allTeams);
      setTeams(availableTeams);
    } catch (error) {
      console.error('Error loading teams:', error);
      showError('Failed to load teams', user?.globalRole);
    } finally {
      setLoadingTeams(false);
    }
  };

  const loadUsersForTeam = async (teamId) => {
    if (!teamId) {
      setUsers([]);
      return;
    }
    
    setLoadingUsers(true);
    try {
      // Load team members for the selected team
      const response = await axios.get(`/api/teams/${teamId}/members`);
      const members = response.data.members || [];
      
      // Transform team members to user format for the dropdown
      const userList = members.map(member => ({
        id: member.user_id,
        username: member.username,
        full_name: member.full_name,
        email: member.email
      }));
      
      setUsers(userList);
    } catch (error) {
      console.error('Error loading team members:', error);
      // Fallback to all users if team members endpoint fails
      try {
        const fallbackResponse = await axios.get('/api/users');
        setUsers(fallbackResponse.data.users || fallbackResponse.data);
      } catch (fallbackError) {
        console.error('Error loading users:', fallbackError);
        showError('Failed to load users', user?.globalRole);
      }
    } finally {
      setLoadingUsers(false);
    }
  };

  // Handle team change
  const handleTeamChange = (teamId) => {
    // Only reset assignment if the current assignee is not in the new team
    const currentAssignee = editedTask.assigned_to;
    setEditedTask({
      ...editedTask, 
      team_id: teamId,
      // Keep current assignment if valid, otherwise reset
      assigned_to: currentAssignee
    });
    loadUsersForTeam(teamId);
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'done': return '#4CAF50';
      case 'in-progress': return '#FF9800';
      case 'todo': return '#2196F3';
      default: return '#666';
    }
  };

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'high': return '#F44336';
      case 'medium': return '#FF9800';
      case 'low': return '#4CAF50';
      default: return '#666';
    }
  };

  const handleSave = () => {
    // Validate required fields
    if (!editedTask.title?.trim()) {
      showValidationWarning('Please enter a task title!');
      return;
    }

    // Prepare update payload based on user permissions
    let updatePayload = {
      id: task.id,
      title: editedTask.title,
      description: editedTask.description,
      status: editedTask.status
    };

    // Only include admin/manager fields if user has permission
    if (canFullEdit) {
      if (!editedTask.team_id) {
        showValidationWarning('Please select a team!');
        return;
      }
      
      // Validate team permission - ensure user can edit tasks in this team
      const canEditInTeam = teams.some(team => team.id === parseInt(editedTask.team_id));
      
      if (!canEditInTeam) {
        showValidationWarning('You do not have permission to assign tasks to this team!');
        return;
      }
      
      updatePayload = {
        ...updatePayload,
        team_id: editedTask.team_id,
        assigned_to: editedTask.assigned_to ? parseInt(editedTask.assigned_to) : null,
        priority: editedTask.priority,
        due_date: editedTask.due_date || null
      };
    }

    console.log('Updating task with payload:', updatePayload);
    onUpdate(updatePayload);
    setIsEditing(false);
    // Success will be announced via real-time notification system
  };

  // Remove the handleStatusChange function - no more status dropdown in display mode

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      onDelete(task.id);
      // Success will be announced via real-time notification system
    }
  };

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';

  if (isEditing) {
    return (
      <div className="task-card editing" 
           role="form"
           aria-label={`Editing task: ${task.title}`}>
        <div className="card-header">
          <div className="alert alert-info mb-0">
            <span className="alert-icon" aria-hidden="true">
              {canFullEdit ? 'Admin' : 'Edit'}
            </span>
            {canFullEdit ? 'Full Edit Mode (Admin/Manager)' : 'Limited Edit Mode (Member)'}
          </div>
        </div>
        <div className="card-body">

          {/* Title - Read-only for members */}
          <div className="mb-3">
            <label className="form-label required" htmlFor={`task-title-${task.id}`}>
              Task Title
            </label>
            <input
              id={`task-title-${task.id}`}
              type="text"
              className={`form-input ${!canEditContent ? 'form-input-readonly' : ''}`}
              value={editedTask.title}
              onChange={canEditContent ? (e) => setEditedTask({...editedTask, title: e.target.value}) : undefined}
              readOnly={!canEditContent}
              placeholder="Task title"
              aria-describedby={!canEditContent ? `task-title-help-${task.id}` : undefined}
            />
            {!canEditContent && (
              <small id={`task-title-help-${task.id}`} className="form-help">
                Note: Title can only be edited by managers and admins
              </small>
            )}
          </div>
        
        {/* Description - Read-only for members */}
        <div className="mb-3">
          <label className="form-label" htmlFor={`task-description-${task.id}`}>
            Task Description
          </label>
          <textarea
            id={`task-description-${task.id}`}
            value={editedTask.description}
            onChange={canEditContent ? (e) => setEditedTask({...editedTask, description: e.target.value}) : undefined}
            readOnly={!canEditContent}
            rows="3"
            className={`form-textarea ${!canEditContent ? 'form-textarea-readonly' : ''}`}
            placeholder="Task description"
            aria-describedby={!canEditContent ? `task-description-help-${task.id}` : undefined}
          />
          {!canEditContent && (
            <small id={`task-description-help-${task.id}`} className="form-help">
              Note: Description can only be edited by managers and admins
            </small>
          )}
        </div>

        {/* Status - Editable by all roles */}
        <div className="mb-3">
          <label className="form-label" htmlFor={`task-status-${task.id}`}>
            Task Status
          </label>
          <select
            id={`task-status-${task.id}`}
            value={editedTask.status}
            onChange={(e) => setEditedTask({...editedTask, status: e.target.value})}
            className="form-select"
            aria-describedby={`task-status-help-${task.id}`}
          >
            <option value="todo">To Do</option>
            <option value="in-progress">In Progress</option>
            <option value="done">Done</option>
          </select>
          <small id={`task-status-help-${task.id}`} className="form-help">
            You can update the task status
          </small>
        </div>

        {/* Admin/Manager only fields */}
        {canFullEdit && (
          <div className="task-edit-section-admin">
            <h4 className="task-edit-title">Manager/Admin Only</h4>
            
            {/* Permission explanation for team managers */}
            {!isAdmin() && !isManager() && (
              <div className="alert alert-info mb-md">
                Note: You can only move tasks between teams where you are a manager.
              </div>
            )}
            
            <div className="task-edit-grid">
              {/* Team Selection */}
              <div className="mb-3">
                <label className="form-label required" htmlFor={`task-team-${task.id}`}>
                  Team
                </label>
                <select
                  id={`task-team-${task.id}`}
                  value={editedTask.team_id || ''}
                  onChange={(e) => handleTeamChange(e.target.value)}
                  className="form-select"
                  disabled={loadingTeams}
                  aria-describedby={`task-team-help-${task.id}`}
                  required
                >
                  <option value="">Select Team *</option>
                  {teams.map(team => {
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
                <small id={`task-team-help-${task.id}`} className="form-help">
                  Select which team this task belongs to
                </small>
              </div>

              {/* Assignment - Only show if team is selected */}
              <div className="mb-3">
                <label className="form-label" htmlFor={`task-assignee-${task.id}`}>
                  Assign to
                </label>
                <select
                  id={`task-assignee-${task.id}`}
                  value={editedTask.assigned_to || ''}
                  onChange={(e) => setEditedTask({...editedTask, assigned_to: e.target.value ? parseInt(e.target.value) : null})}
                  className="form-select"
                  disabled={!editedTask.team_id || loadingUsers}
                  aria-describedby={`task-assignee-help-${task.id}`}
                >
                  <option value="">Unassigned</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.full_name} ({user.username})
                    </option>
                  ))}
                </select>
                <small id={`task-assignee-help-${task.id}`} className="form-help">
                  {!editedTask.team_id ? 'Select a team first to see available members' : 'Choose a team member to assign this task to'}
                </small>
                {editedTask.assigned_to && !users.find(u => u.id === editedTask.assigned_to) && (
                  <div className="form-warning" role="alert">
                    Warning: Currently assigned user is not in this team
                  </div>
                )}
              </div>
              
              <div className="mb-3">
                <label className="form-label" htmlFor={`task-priority-${task.id}`}>
                  Priority Level
                </label>
                <select
                  id={`task-priority-${task.id}`}
                  value={editedTask.priority}
                  onChange={(e) => setEditedTask({...editedTask, priority: e.target.value})}
                  className="form-select"
                  aria-describedby={`task-priority-help-${task.id}`}
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
                <small id={`task-priority-help-${task.id}`} className="form-help">
                  Set the importance level of this task
                </small>
              </div>

              <div className="mb-3">
                <label className="form-label" htmlFor={`task-due-date-${task.id}`}>
                  Due Date
                </label>
                <input
                  id={`task-due-date-${task.id}`}
                  type="date"
                  value={editedTask.due_date || ''}
                  onChange={(e) => setEditedTask({...editedTask, due_date: e.target.value})}
                  className="form-input"
                  aria-describedby={`task-due-date-help-${task.id}`}
                />
                <small id={`task-due-date-help-${task.id}`} className="form-help">
                  Optional: Set when this task should be completed
                </small>
              </div>
            </div>
          </div>
        )}

        {/* Member view of restricted fields */}
        {!canFullEdit && (
          <div className="task-readonly-section">
            <h4 className="task-readonly-title">Task Details (Read-only)</h4>
            <div className="task-readonly-grid">
              <div className="task-readonly-item">
                <span className="task-readonly-label">Team:</span>
                <span className="task-readonly-value">{task.team_name}</span>
              </div>
              <div className="task-readonly-item">
                <span className="task-readonly-label">Assigned to:</span>
                <span className="task-readonly-value">{task.assigned_to_name || task.assigned_to_username || 'Unassigned'}</span>
              </div>
              <div className="task-readonly-item">
                <span className="task-readonly-label">Priority:</span>
                <span className="task-readonly-value">{task.priority?.toUpperCase()}</span>
              </div>
              <div className="task-readonly-item">
                <span className="task-readonly-label">Due Date:</span>
                <span className="task-readonly-value">{task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Not set'}</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Attachments Section - Available to all roles */}
        <TaskAttachments taskId={task.id} isEditing={true} />
        
        <div className="task-actions">
          <button
            onClick={handleSave}
            className="task-btn-save"
          >
            Save Changes
          </button>
          <button
            onClick={() => {
              setIsEditing(false);
              setEditedTask({}); // Clear the form
            }}
            className="task-btn-cancel"
          >
            Cancel
          </button>
        </div>
        </div>
      </div>
    );
  }

  return (
    <article 
      className={`task-card ${isOverdue ? 'overdue' : ''}`}
      role="article"
      aria-labelledby={`task-title-${task.id}`}
      aria-describedby={`task-description-${task.id} task-meta-${task.id}`}
    >
      {isOverdue && (
        <div className="overdue-badge" role="alert" aria-live="polite">
          <span className="sr-only">Alert: This task is </span>
          OVERDUE
        </div>
      )}

      <header className="task-card-header">
        <h3 id={`task-title-${task.id}`} className="task-card-title">
          {task.title}
        </h3>
        <div className="task-card-actions" role="group" aria-label="Task actions">
          {canEditTask && (
            <button
              onClick={startEditing}
              className="btn btn-accent btn-sm"
              title={canFullEdit ? 'Edit task (full access)' : 'Edit task (limited access)'}
              aria-label={`Edit task: ${task.title}`}
            >
              {canFullEdit ? 'Edit' : 'Update'}
            </button>
          )}
          {canDeleteTask && (
            <button
              onClick={handleDelete}
              className="btn btn-danger btn-sm"
              aria-label={`Delete task: ${task.title}`}
            >
              Delete
            </button>
          )}
        </div>
      </header>

      <div id={`task-description-${task.id}`} className="task-card-description">
        {task.description}
      </div>
      
      <div className="task-card-badges" role="group" aria-label="Task information">
        {/* Team Badge */}
        {task.team_name && (
          <span 
            className="team-badge team-badge-dynamic"
            style={{ '--team-color': task.team_color }}
            aria-label={`Team: ${task.team_name}`}
          >
            <span className="team-badge-icon" aria-hidden="true">Team</span>
            <span className="sr-only">Team: </span>
            {task.team_name}
          </span>
        )}

        {/* Status Badge */}
        <span 
          className={`status-badge ${task.status}`}
          aria-label={`Status: ${task.status.replace('-', ' ')}`}
        >
          <span className="sr-only">Status: </span>
          {task.status.toUpperCase().replace('-', ' ')}
        </span>
        
        {/* Priority Badge */}
        <span 
          className={`priority-badge ${task.priority}`}
          aria-label={`Priority: ${task.priority}`}
        >
          <span className="sr-only">Priority: </span>
          {task.priority.toUpperCase()} PRIORITY
        </span>

        {/* Assignee Badge */}
        {(task.assigned_to_username || task.assigned_to_name) && (
          <span 
            className="assignee-badge"
            aria-label={`Assigned to: ${task.assigned_to_name || task.assigned_to_username}`}
          >
            <span aria-hidden="true">👤</span>
            <span className="sr-only">Assigned to: </span>
            {task.assigned_to_name || task.assigned_to_username}
          </span>
        )}

        {/* Due Date Badge */}
        {task.due_date && (
          <span 
            className={`due-date-badge ${isOverdue ? 'overdue' : 'normal'}`}
            aria-label={`Due date: ${new Date(task.due_date).toLocaleDateString()}${isOverdue ? ' (overdue)' : ''}`}
          >
            <span aria-hidden="true">Due</span>
            <span className="sr-only">Due date: </span>
            {new Date(task.due_date).toLocaleDateString()}
          </span>
        )}

        {/* Attachment Count Badge */}
        <AttachmentCountBadge taskId={task.id} />
      </div>
      
      <footer id={`task-meta-${task.id}`} className="task-card-meta">
        <span className="sr-only">Task metadata: </span>
        Created: {new Date(task.created_at).toLocaleDateString()}
        {task.updated_at !== task.created_at && (
          <span> • Updated: {new Date(task.updated_at).toLocaleDateString()}</span>
        )}
      </footer>

      {/* Attachments Section */}
      <section aria-label={`Attachments for task: ${task.title}`}>
        <TaskAttachments taskId={task.id} isEditing={false} />
      </section>

      {/* Comments Section */}
      <section aria-label={`Comments for task: ${task.title}`}>
        <TaskComments taskId={task.id} />
      </section>
    </article>
  );
};

export default TaskCard;