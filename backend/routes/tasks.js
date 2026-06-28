/**
 * Enhanced Task Management Routes
 * Team-scoped task operations with RBAC
 */

const express = require('express');
const { pool } = require('../database');
const { authenticateJWT } = require('../middleware/auth');
const { 
  requireTeamPermission,
  requireTaskAccess,
  filterByPermissions 
} = require('../middleware/rbac');
const { auditCRUD } = require('../middleware/audit');
const taskService = require('../services/taskService');
const router = express.Router();

/**
 * GET /api/tasks
 * Get all tasks (filtered by user permissions)
 */
router.get('/', authenticateJWT, async (req, res) => {
  try {
    console.log('=== TASKS ENDPOINT REACHED ===');
    console.log('User:', req.user.username, 'Role:', req.user.global_role);
    
    const filters = {
      team_id: req.query.team_id,
      status: req.query.status,
      priority: req.query.priority,
      assigned_to: req.query.assigned_to,
      created_by: req.query.created_by,
      due_before: req.query.due_before,
      due_after: req.query.due_after,
      search: req.query.search,
      sort_by: req.query.sort_by,
      sort_order: req.query.sort_order,
      limit: req.query.limit,
      offset: req.query.offset
    };

    // Use taskService to get filtered tasks based on user permissions
    const tasks = await taskService.getFilteredTasks(
      req.user.id,
      req.user.global_role,
      filters
    );
    
    console.log('Found tasks:', tasks.length);

    res.json({
      tasks,
      total: tasks.length,
      user_role: req.user.global_role,
      filters_applied: Object.keys(filters).filter(key => filters[key] !== undefined),
      filtered: req.user.global_role !== 'admin'
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({
      error: {
        code: 'TASKS_FETCH_ERROR',
        message: 'Failed to fetch tasks',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/tasks/:id
 * Get specific task details
 */
router.get('/:id', authenticateJWT, requireTaskAccess('VIEW_TASK'), async (req, res) => {
  try {
    const taskId = req.params.id;

    // Get detailed task information
    const [tasks] = await pool.execute(`
      SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date,
             t.estimated_hours, t.actual_hours, t.created_at, t.updated_at, t.completed_at,
             team.id as team_id, team.name as team_name, team.color as team_color,
             assigned.id as assigned_to_id, assigned.username as assigned_to_username,
             assigned.full_name as assigned_to_name, assigned.email as assigned_to_email,
             creator.id as created_by_id, creator.username as created_by_username,
             creator.full_name as created_by_name, creator.email as created_by_email
      FROM tasks t
      JOIN teams team ON t.team_id = team.id
      LEFT JOIN users assigned ON t.assigned_to = assigned.id
      JOIN users creator ON t.created_by = creator.id
      WHERE t.id = ? AND team.is_active = TRUE
    `, [taskId]);

    if (tasks.length === 0) {
      return res.status(404).json({
        error: {
          code: 'TASK_NOT_FOUND',
          message: 'Task not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    const task = tasks[0];

    // Get task comments count
    const [commentCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM task_comments WHERE task_id = ?',
      [taskId]
    );

    // Get task attachments count
    const [attachmentCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM task_attachments WHERE task_id = ?',
      [taskId]
    );

    // Check if user can modify this task
    const canModify = await taskService.canModifyTask(req.user.id, req.user.global_role, taskId);

    res.json({
      task: {
        ...task,
        comment_count: commentCount[0].count,
        attachment_count: attachmentCount[0].count,
        user_can_modify: canModify,
        user_team_role: req.teamRole
      }
    });
  } catch (error) {
    console.error('Error fetching task details:', error);
    res.status(500).json({
      error: {
        code: 'TASK_DETAILS_ERROR',
        message: 'Failed to fetch task details',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /api/tasks
 * Create new task
 */
router.post('/', authenticateJWT, auditCRUD('task'), async (req, res) => {
  try {
    const taskData = req.body;

    // Validate team_id is provided
    if (!taskData.team_id) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Team ID is required',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check team permissions
    const teamId = taskData.team_id;
    const canCreate = await taskService.canCreateTask(req.user.id, req.user.global_role, teamId);
    
    if (!canCreate) {
      return res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions to create task in this team',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Create task using service
    const result = await taskService.createTask(taskData, req.user.id, req.user.global_role);

    if (!result.success) {
      return res.status(400).json({
        error: {
          code: 'TASK_CREATION_ERROR',
          message: 'Failed to create task',
          details: result.errors,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Fetch the created task
    const [newTask] = await pool.execute(`
      SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date,
             t.estimated_hours, t.actual_hours, t.created_at, t.updated_at,
             team.id as team_id, team.name as team_name, team.color as team_color,
             assigned.username as assigned_to_username,
             assigned.full_name as assigned_to_name,
             creator.username as created_by_username,
             creator.full_name as created_by_name
      FROM tasks t
      JOIN teams team ON t.team_id = team.id
      LEFT JOIN users assigned ON t.assigned_to = assigned.id
      JOIN users creator ON t.created_by = creator.id
      WHERE t.id = ?
    `, [result.taskId]);

    // Broadcast via RBAC-aware WebSocket
    const realtimeService = req.app.get('realtimeService');
    if (realtimeService) {
      await realtimeService.broadcastTaskCreated(newTask[0], {
        id: req.user.id,
        username: req.user.username,
        name: req.user.full_name || req.user.username
      });
    }

    console.log(`Task created: ${taskData.title} (ID: ${result.taskId}) by ${req.user.username} in team ${teamId}`);

    res.status(201).json({
      message: 'Task created successfully',
      task: newTask[0]
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({
      error: {
        code: 'TASK_CREATE_ERROR',
        message: 'Failed to create task',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * PUT /api/tasks/:id
 * Update task
 */
router.put('/:id', authenticateJWT, auditCRUD('task'), async (req, res) => {
  try {
    const taskId = req.params.id;
    const updateData = req.body;

    // Fetch task before update to track changes
    const [previousTask] = await pool.execute(`
      SELECT t.id, t.assigned_to, t.status, t.created_by
      FROM tasks t
      WHERE t.id = ?
    `, [taskId]);

    // Update task using service
    const result = await taskService.updateTask(taskId, updateData, req.user.id, req.user.global_role);

    if (!result.success) {
      return res.status(400).json({
        error: {
          code: 'TASK_UPDATE_ERROR',
          message: 'Failed to update task',
          details: result.errors,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Fetch updated task
    const [updatedTask] = await pool.execute(`
      SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date,
             t.estimated_hours, t.actual_hours, t.created_at, t.updated_at, t.completed_at,
             t.assigned_to, t.created_by,
             team.id as team_id, team.name as team_name, team.color as team_color,
             assigned.username as assigned_to_username,
             assigned.full_name as assigned_to_name,
             creator.username as created_by_username,
             creator.full_name as created_by_name
      FROM tasks t
      JOIN teams team ON t.team_id = team.id
      LEFT JOIN users assigned ON t.assigned_to = assigned.id
      JOIN users creator ON t.created_by = creator.id
      WHERE t.id = ?
    `, [taskId]);

    // Broadcast via RBAC-aware WebSocket with previous data
    const realtimeService = req.app.get('realtimeService');
    if (realtimeService) {
      await realtimeService.broadcastTaskUpdated(
        updatedTask[0], 
        {
          id: req.user.id,
          username: req.user.username,
          name: req.user.full_name || req.user.username
        }, 
        updateData,
        previousTask[0] // Pass previous task data
      );
    }

    console.log(`Task updated: ${updatedTask[0].title} (ID: ${taskId}) by ${req.user.username}`);

    res.json({
      message: 'Task updated successfully',
      task: updatedTask[0]
    });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({
      error: {
        code: 'TASK_UPDATE_ERROR',
        message: 'Failed to update task',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * DELETE /api/tasks/:id
 * Delete task (managers only)
 */
router.delete('/:id', authenticateJWT, requireTaskAccess('DELETE_TASK'), auditCRUD('task'), async (req, res) => {
  try {
    const taskId = req.params.id;

    // Get task details before deletion
    const [taskDetails] = await pool.execute(`
      SELECT t.title, team.name as team_name
      FROM tasks t
      JOIN teams team ON t.team_id = team.id
      WHERE t.id = ?
    `, [taskId]);

    if (taskDetails.length === 0) {
      return res.status(404).json({
        error: {
          code: 'TASK_NOT_FOUND',
          message: 'Task not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    const taskDetail = taskDetails[0];

    // Delete task (cascade will handle comments and attachments)
    await pool.execute('DELETE FROM tasks WHERE id = ?', [taskId]);

    // Broadcast via RBAC-aware WebSocket
    const realtimeService = req.app.get('realtimeService');
    if (realtimeService) {
      await realtimeService.broadcastTaskDeleted({
        id: parseInt(taskId),
        title: taskDetail.title,
        team_name: taskDetail.team_name,
        team_id: taskDetail.team_id
      }, {
        id: req.user.id,
        username: req.user.username,
        name: req.user.full_name || req.user.username
      });
    }

    console.log(`Task deleted: ${taskDetail.title} (ID: ${taskId}) by ${req.user.username}`);

    res.json({
      message: 'Task deleted successfully',
      task: {
        id: parseInt(taskId),
        title: taskDetail.title,
        team_name: taskDetail.team_name
      }
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({
      error: {
        code: 'TASK_DELETE_ERROR',
        message: 'Failed to delete task',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/tasks/team/:teamId
 * Get tasks for specific team
 */
router.get('/team/:teamId', authenticateJWT, requireTeamPermission('VIEW_TEAM', 'teamId'), async (req, res) => {
  try {
    const teamId = req.params.teamId;
    const filters = {
      team_id: teamId,
      status: req.query.status,
      priority: req.query.priority,
      assigned_to: req.query.assigned_to,
      search: req.query.search,
      sort_by: req.query.sort_by || 'created_at',
      sort_order: req.query.sort_order || 'desc',
      limit: req.query.limit,
      offset: req.query.offset
    };

    const tasks = await taskService.getFilteredTasks(
      req.user.id,
      req.user.global_role,
      filters
    );

    // Get team info
    const [teams] = await pool.execute(
      'SELECT name, color FROM teams WHERE id = ? AND is_active = TRUE',
      [teamId]
    );

    res.json({
      team: teams[0] || null,
      tasks,
      total: tasks.length,
      user_team_role: req.teamRole,
      filters_applied: Object.keys(filters).filter(key => filters[key] !== undefined)
    });
  } catch (error) {
    console.error('Error fetching team tasks:', error);
    res.status(500).json({
      error: {
        code: 'TEAM_TASKS_ERROR',
        message: 'Failed to fetch team tasks',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/tasks/assigned-to-me
 * Get tasks assigned to current user
 */
router.get('/assigned-to-me', authenticateJWT, async (req, res) => {
  try {
    const filters = {
      assigned_to: req.user.id,
      status: req.query.status,
      priority: req.query.priority,
      team_id: req.query.team_id,
      sort_by: req.query.sort_by || 'due_date',
      sort_order: req.query.sort_order || 'asc',
      limit: req.query.limit,
      offset: req.query.offset
    };

    const tasks = await taskService.getFilteredTasks(
      req.user.id,
      req.user.global_role,
      filters
    );

    res.json({
      tasks,
      total: tasks.length,
      user: {
        id: req.user.id,
        username: req.user.username,
        full_name: req.user.full_name
      }
    });
  } catch (error) {
    console.error('Error fetching assigned tasks:', error);
    res.status(500).json({
      error: {
        code: 'ASSIGNED_TASKS_ERROR',
        message: 'Failed to fetch assigned tasks',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * PUT /api/tasks/:id/status
 * Quick status update
 */
router.put('/:id/status', authenticateJWT, auditCRUD('task'), async (req, res) => {
  try {
    const taskId = req.params.id;
    const { status } = req.body;

    if (!status || !['todo', 'in-progress', 'done'].includes(status)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_STATUS',
          message: 'Status must be one of: todo, in-progress, done',
          timestamp: new Date().toISOString()
        }
      });
    }

    const result = await taskService.updateTask(
      taskId, 
      { status }, 
      req.user.id, 
      req.user.global_role
    );

    if (!result.success) {
      return res.status(400).json({
        error: {
          code: 'STATUS_UPDATE_ERROR',
          message: 'Failed to update task status',
          details: result.errors,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Get updated task for response
    const [updatedTask] = await pool.execute(
      'SELECT id, title, status, completed_at FROM tasks WHERE id = ?',
      [taskId]
    );

    console.log(`Task status updated: ${updatedTask[0].title} -> ${status} by ${req.user.username}`);

    res.json({
      message: 'Task status updated successfully',
      task: updatedTask[0]
    });
  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({
      error: {
        code: 'STATUS_UPDATE_ERROR',
        message: 'Failed to update task status',
        timestamp: new Date().toISOString()
      }
    });
  }
});

module.exports = router;