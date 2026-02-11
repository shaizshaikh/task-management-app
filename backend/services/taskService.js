/**
 * Task Service
 * Handles task operations with RBAC validation
 */

const { pool } = require('../database');
const { getUserTeamRole, canAccessTeam } = require('../middleware/rbac');
const { canAssignTaskTo } = require('../utils/permissions');

class TaskService {
  /**
   * Validate task data
   */
  validateTaskData(taskData, isUpdate = false) {
    const errors = [];

    // Title validation
    if (!isUpdate || taskData.title !== undefined) {
      if (!taskData.title || taskData.title.trim().length === 0) {
        errors.push('Title is required');
      } else if (taskData.title.length > 255) {
        errors.push('Title must be 255 characters or less');
      }
    }

    // Description validation
    if (taskData.description !== undefined && taskData.description !== null) {
      if (taskData.description.length > 2000) {
        errors.push('Description must be 2000 characters or less');
      }
    }

    // Status validation
    if (taskData.status !== undefined) {
      const validStatuses = ['todo', 'in-progress', 'done'];
      if (!validStatuses.includes(taskData.status)) {
        errors.push('Status must be one of: todo, in-progress, done');
      }
    }

    // Priority validation
    if (taskData.priority !== undefined) {
      const validPriorities = ['low', 'medium', 'high'];
      if (!validPriorities.includes(taskData.priority)) {
        errors.push('Priority must be one of: low, medium, high');
      }
    }

    // Team ID validation
    if (!isUpdate || taskData.team_id !== undefined) {
      if (!taskData.team_id) {
        errors.push('Team ID is required');
      } else if (!Number.isInteger(parseInt(taskData.team_id))) {
        errors.push('Team ID must be a valid integer');
      }
    }

    // Assigned to validation
    if (taskData.assigned_to !== undefined && taskData.assigned_to !== null && taskData.assigned_to !== '') {
      const assignedToId = parseInt(taskData.assigned_to);
      if (!Number.isInteger(assignedToId) || assignedToId <= 0) {
        errors.push('Assigned to must be a valid user ID');
      }
    }

    // Due date validation
    if (taskData.due_date !== undefined && taskData.due_date !== null) {
      const dueDate = new Date(taskData.due_date);
      if (isNaN(dueDate.getTime())) {
        errors.push('Due date must be a valid date');
      }
    }

    // Hours validation
    if (taskData.estimated_hours !== undefined && taskData.estimated_hours !== null) {
      const hours = parseFloat(taskData.estimated_hours);
      if (isNaN(hours) || hours < 0 || hours > 999.99) {
        errors.push('Estimated hours must be a number between 0 and 999.99');
      }
    }

    if (taskData.actual_hours !== undefined && taskData.actual_hours !== null) {
      const hours = parseFloat(taskData.actual_hours);
      if (isNaN(hours) || hours < 0 || hours > 999.99) {
        errors.push('Actual hours must be a number between 0 and 999.99');
      }
    }

    return errors;
  }

  /**
   * Check if user can create task in team
   */
  async canCreateTask(userId, globalRole, teamId) {
    try {
      // Admin and Manager can create tasks in any team
      if (globalRole === 'admin' || globalRole === 'manager') {
        // Verify team exists
        const [teams] = await pool.execute(
          'SELECT id FROM teams WHERE id = ? AND is_active = TRUE',
          [teamId]
        );
        return teams.length > 0;
      }

      // Check team membership and role
      const userTeamRole = await getUserTeamRole(userId, teamId);
      return userTeamRole === 'leader' || userTeamRole === 'member';
    } catch (error) {
      console.error('Error checking task creation permission:', error);
      return false;
    }
  }

  /**
   * Check if user can modify task
   */
  async canModifyTask(userId, globalRole, taskId) {
    try {
      // Admin can modify any task
      if (globalRole === 'admin') {
        return true;
      }

      // Get task details
      const [tasks] = await pool.execute(`
        SELECT team_id, assigned_to, created_by 
        FROM tasks 
        WHERE id = ?
      `, [taskId]);

      if (tasks.length === 0) {
        return false;
      }

      const task = tasks[0];

      // Check team membership
      const userTeamRole = await getUserTeamRole(userId, task.team_id);
      
      if (!userTeamRole) {
        return false;
      }

      // Team leaders can modify any task in their team
      if (userTeamRole === 'leader') {
        return true;
      }

      // Team members can modify tasks assigned to them or created by them
      if (userTeamRole === 'member') {
        return task.assigned_to === userId || task.created_by === userId;
      }

      // Viewers cannot modify tasks
      return false;
    } catch (error) {
      console.error('Error checking task modification permission:', error);
      return false;
    }
  }

  /**
   * Check if user can view task
   */
  async canViewTask(userId, globalRole, taskId) {
    try {
      // Admin can view any task
      if (globalRole === 'admin') {
        return true;
      }

      // Get task team
      const [tasks] = await pool.execute(
        'SELECT team_id FROM tasks WHERE id = ?',
        [taskId]
      );

      if (tasks.length === 0) {
        return false;
      }

      // Check if user is team member (any role can view)
      const userTeamRole = await getUserTeamRole(userId, tasks[0].team_id);
      return userTeamRole !== null;
    } catch (error) {
      console.error('Error checking task view permission:', error);
      return false;
    }
  }

  /**
   * Validate task assignment
   */
  async validateTaskAssignment(assignerUserId, assignerGlobalRole, assigneeUserId, teamId) {
    try {
      if (!assigneeUserId) {
        return { valid: true }; // Unassigning is always valid
      }

      // Check if assignee exists and is active
      const [users] = await pool.execute(
        'SELECT id, username, full_name FROM users WHERE id = ? AND is_active = TRUE',
        [assigneeUserId]
      );

      if (users.length === 0) {
        return { valid: false, error: 'Assigned user not found or inactive' };
      }

      // Check if assignee is team member
      const [teamMembers] = await pool.execute(
        'SELECT team_role FROM team_members WHERE team_id = ? AND user_id = ?',
        [teamId, assigneeUserId]
      );

      if (teamMembers.length === 0) {
        return { valid: false, error: 'Assigned user is not a member of the task team' };
      }

      // Check if assigner can assign to this user
      const canAssign = await canAssignTaskTo(assignerUserId, assignerGlobalRole, assigneeUserId, teamId);
      if (!canAssign) {
        return { valid: false, error: 'Insufficient permissions to assign task to this user' };
      }

      return { valid: true, assignee: users[0] };
    } catch (error) {
      console.error('Error validating task assignment:', error);
      return { valid: false, error: 'Failed to validate task assignment' };
    }
  }

  /**
   * Get filtered tasks for user
   */
  async getFilteredTasks(userId, globalRole, filters = {}) {
    try {
      let query = `
        SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date,
               t.estimated_hours, t.actual_hours, t.created_at, t.updated_at, t.completed_at,
               team.id as team_id, team.name as team_name, team.color as team_color,
               assigned.id as assigned_to_id, assigned.username as assigned_to_username,
               assigned.full_name as assigned_to_name,
               creator.id as created_by_id, creator.username as created_by_username,
               creator.full_name as created_by_name
        FROM tasks t
        JOIN teams team ON t.team_id = team.id
        LEFT JOIN users assigned ON t.assigned_to = assigned.id
        JOIN users creator ON t.created_by = creator.id
        WHERE team.is_active = TRUE
      `;

      const params = [];

      // Filter by user permissions
      if (globalRole !== 'admin') {
        query += ` AND team.id IN (
          SELECT tm.team_id FROM team_members tm WHERE tm.user_id = ?
        )`;
        params.push(userId);
      }

      // Apply additional filters
      if (filters.team_id) {
        query += ' AND t.team_id = ?';
        params.push(filters.team_id);
      }

      if (filters.status) {
        query += ' AND t.status = ?';
        params.push(filters.status);
      }

      if (filters.priority) {
        query += ' AND t.priority = ?';
        params.push(filters.priority);
      }

      if (filters.assigned_to) {
        query += ' AND t.assigned_to = ?';
        params.push(filters.assigned_to);
      }

      if (filters.created_by) {
        query += ' AND t.created_by = ?';
        params.push(filters.created_by);
      }

      if (filters.due_before) {
        query += ' AND t.due_date <= ?';
        params.push(filters.due_before);
      }

      if (filters.due_after) {
        query += ' AND t.due_date >= ?';
        params.push(filters.due_after);
      }

      // Search in title and description
      if (filters.search) {
        query += ' AND (t.title LIKE ? OR t.description LIKE ?)';
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm);
      }

      // Sorting
      const validSortFields = ['title', 'status', 'priority', 'due_date', 'created_at', 'updated_at'];
      const sortField = validSortFields.includes(filters.sort_by) ? filters.sort_by : 'created_at';
      const sortOrder = filters.sort_order === 'asc' ? 'ASC' : 'DESC';
      
      query += ` ORDER BY t.${sortField} ${sortOrder}`;

      // Pagination
      if (filters.limit) {
        const limit = Math.min(parseInt(filters.limit) || 50, 100); // Max 100 items
        const offset = Math.max(parseInt(filters.offset) || 0, 0);
        query += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);
      }

      const [tasks] = await pool.execute(query, params);
      return tasks;
    } catch (error) {
      console.error('Error getting filtered tasks:', error);
      throw error;
    }
  }

  /**
   * Create task with validation
   */
  async createTask(taskData, creatorId, creatorGlobalRole) {
    try {
      // Validate task data
      const validationErrors = this.validateTaskData(taskData);
      if (validationErrors.length > 0) {
        return { success: false, errors: validationErrors };
      }

      // Check creation permissions
      const canCreate = await this.canCreateTask(creatorId, creatorGlobalRole, taskData.team_id);
      if (!canCreate) {
        return { success: false, errors: ['Insufficient permissions to create task in this team'] };
      }

      // Validate assignment if provided
      if (taskData.assigned_to) {
        const assignmentValidation = await this.validateTaskAssignment(
          creatorId, 
          creatorGlobalRole, 
          taskData.assigned_to, 
          taskData.team_id
        );
        if (!assignmentValidation.valid) {
          return { success: false, errors: [assignmentValidation.error] };
        }
      }

      // Create task
      const [result] = await pool.execute(`
        INSERT INTO tasks (
          title, description, status, priority, team_id, assigned_to, created_by,
          due_date, estimated_hours, actual_hours, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [
        taskData.title.trim(),
        taskData.description?.trim() || null,
        taskData.status || 'todo',
        taskData.priority || 'medium',
        taskData.team_id,
        taskData.assigned_to || null,
        creatorId,
        taskData.due_date || null,
        taskData.estimated_hours || 0,
        taskData.actual_hours || 0
      ]);

      return { success: true, taskId: result.insertId };
    } catch (error) {
      console.error('Error creating task:', error);
      return { success: false, errors: ['Failed to create task'] };
    }
  }

  /**
   * Update task with validation
   */
  async updateTask(taskId, updateData, updaterUserId, updaterGlobalRole) {
    try {
      // Check modification permissions
      const canModify = await this.canModifyTask(updaterUserId, updaterGlobalRole, taskId);
      if (!canModify) {
        return { success: false, errors: ['Insufficient permissions to modify this task'] };
      }

      // Get current task data
      const [currentTasks] = await pool.execute(
        'SELECT * FROM tasks WHERE id = ?',
        [taskId]
      );

      if (currentTasks.length === 0) {
        return { success: false, errors: ['Task not found'] };
      }

      const currentTask = currentTasks[0];

      // Validate update data
      const validationErrors = this.validateTaskData(updateData, true);
      if (validationErrors.length > 0) {
        return { success: false, errors: validationErrors };
      }

      // Validate assignment if being changed
      if (updateData.assigned_to !== undefined) {
        // Convert empty string to null for validation
        const assigneeId = updateData.assigned_to === '' ? null : updateData.assigned_to;
        const assignmentValidation = await this.validateTaskAssignment(
          updaterUserId,
          updaterGlobalRole,
          assigneeId,
          currentTask.team_id
        );
        if (!assignmentValidation.valid) {
          return { success: false, errors: [assignmentValidation.error] };
        }
      }

      // Build update query
      const updates = [];
      const values = [];

      if (updateData.title !== undefined) {
        updates.push('title = ?');
        values.push(updateData.title.trim());
      }
      if (updateData.description !== undefined) {
        updates.push('description = ?');
        values.push(updateData.description?.trim() || null);
      }
      if (updateData.status !== undefined) {
        updates.push('status = ?');
        values.push(updateData.status);
        
        // Set completed_at when marking as done
        if (updateData.status === 'done' && currentTask.status !== 'done') {
          updates.push('completed_at = NOW()');
        } else if (updateData.status !== 'done' && currentTask.status === 'done') {
          updates.push('completed_at = NULL');
        }
      }
      if (updateData.priority !== undefined) {
        updates.push('priority = ?');
        values.push(updateData.priority);
      }
      if (updateData.assigned_to !== undefined) {
        updates.push('assigned_to = ?');
        // Convert empty string to null for database
        values.push(updateData.assigned_to === '' ? null : updateData.assigned_to);
      }
      if (updateData.due_date !== undefined) {
        updates.push('due_date = ?');
        values.push(updateData.due_date);
      }
      if (updateData.estimated_hours !== undefined) {
        updates.push('estimated_hours = ?');
        values.push(updateData.estimated_hours || 0);
      }
      if (updateData.actual_hours !== undefined) {
        updates.push('actual_hours = ?');
        values.push(updateData.actual_hours || 0);
      }

      if (updates.length === 0) {
        return { success: false, errors: ['No valid fields to update'] };
      }

      updates.push('updated_at = NOW()');
      values.push(taskId);

      // Update task
      await pool.execute(
        `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
        values
      );

      // Send email notifications for specific changes
      await this.sendTaskUpdateNotifications(taskId, currentTask, updateData, updaterUserId);

      return { success: true };
    } catch (error) {
      console.error('Error updating task:', error);
      return { success: false, errors: ['Failed to update task'] };
    }
  }

  /**
   * Send email notifications for task updates
   */
  async sendTaskUpdateNotifications(taskId, currentTask, updateData, updaterUserId) {
    try {
      const emailService = require('./emailService');

      // Get updater info
      const [updaterInfo] = await pool.execute(
        'SELECT id, username, full_name, email FROM users WHERE id = ?',
        [updaterUserId]
      );

      if (updaterInfo.length === 0) return;
      const updater = updaterInfo[0];

      // 1. Task Assignment Notification
      if (updateData.assigned_to !== undefined && updateData.assigned_to !== currentTask.assigned_to) {
        const newAssigneeId = updateData.assigned_to === '' ? null : updateData.assigned_to;
        
        if (newAssigneeId && newAssigneeId !== currentTask.assigned_to) {
          // Get assignee info
          const [assigneeInfo] = await pool.execute(
            'SELECT id, username, full_name, email FROM users WHERE id = ?',
            [newAssigneeId]
          );

          if (assigneeInfo.length > 0) {
            // Get task and team info
            const [taskInfo] = await pool.execute(`
              SELECT t.title, t.description, t.priority, t.due_date,
                     team.name as team_name
              FROM tasks t
              JOIN teams team ON t.team_id = team.id
              WHERE t.id = ?
            `, [taskId]);

            if (taskInfo.length > 0) {
              await emailService.sendTaskAssignmentEmail(
                assigneeInfo[0],
                taskInfo[0],
                updater
              );
              console.log(`Task assignment notification sent to: ${assigneeInfo[0].email}`);
            }
          }
        }
      }

      // 2. Task Status Update Notification to Team Leaders
      if (updateData.status !== undefined && updateData.status !== currentTask.status) {
        // Get team leaders for this task
        const [teamLeaders] = await pool.execute(`
          SELECT DISTINCT u.id, u.username, u.full_name, u.email
          FROM users u
          JOIN team_members tm ON u.id = tm.user_id
          WHERE tm.team_id = ? AND tm.team_role = 'leader' AND u.is_active = TRUE
        `, [currentTask.team_id]);

        if (teamLeaders.length > 0) {
          // Get task and team info
          const [taskInfo] = await pool.execute(`
            SELECT t.title, team.name as team_name
            FROM tasks t
            JOIN teams team ON t.team_id = team.id
            WHERE t.id = ?
          `, [taskId]);

          if (taskInfo.length > 0) {
            // Get recent attachments (uploaded in last 24 hours)
            const [recentAttachments] = await pool.execute(`
              SELECT filename as original_name, file_size
              FROM task_attachments
              WHERE task_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
              ORDER BY created_at DESC
            `, [taskId]);

            const taskUpdateInfo = {
              ...taskInfo[0],
              status: updateData.status,
              old_status: currentTask.status
            };

            // Send notification to each team leader
            for (const leader of teamLeaders) {
              // Don't send notification to the person who made the update
              if (leader.id !== updaterUserId) {
                await emailService.sendTaskStatusUpdateEmail(
                  leader,
                  taskUpdateInfo,
                  updater,
                  recentAttachments
                );
                console.log(`Task status update notification sent to team leader: ${leader.email}`);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending task update notifications:', error);
      // Don't throw error - notifications are not critical
    }
  }
}

module.exports = new TaskService();