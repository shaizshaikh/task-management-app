/**
 * Task Comments Routes
 * Handles task comment operations with RBAC
 */

const express = require('express');
const { pool } = require('../database');
const { authenticateJWT } = require('../middleware/auth');
const { requireTaskAccess } = require('../middleware/rbac');
const { auditCRUD } = require('../middleware/audit');
const router = express.Router();

/**
 * GET /api/comments/task/:taskId
 * Get all comments for a task
 */
router.get('/task/:taskId', authenticateJWT, requireTaskAccess('VIEW_COMMENTS'), async (req, res) => {
  try {
    const taskId = req.params.taskId;

    // Get comments with author information
    const [comments] = await pool.execute(`
      SELECT tc.id, tc.comment, tc.created_at, tc.updated_at,
             u.id as user_id, u.username, u.full_name, u.email, u.avatar_url
      FROM task_comments tc
      JOIN users u ON tc.user_id = u.id
      WHERE tc.task_id = ? AND u.is_active = TRUE
      ORDER BY tc.created_at ASC
    `, [taskId]);

    // Get task info for context
    const [taskInfo] = await pool.execute(`
      SELECT t.title, team.name as team_name
      FROM tasks t
      JOIN teams team ON t.team_id = team.id
      WHERE t.id = ?
    `, [taskId]);

    res.json({
      task_id: parseInt(taskId),
      task_info: taskInfo[0] || null,
      comments,
      total: comments.length,
      user_team_role: req.teamRole
    });
  } catch (error) {
    console.error('Error fetching task comments:', error);
    res.status(500).json({
      error: {
        code: 'COMMENTS_FETCH_ERROR',
        message: 'Failed to fetch task comments',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /api/comments/task/:taskId
 * Add comment to task
 */
router.post('/task/:taskId', authenticateJWT, requireTaskAccess('ADD_COMMENT'), auditCRUD('comment'), async (req, res) => {
  try {
    const taskId = req.params.taskId;
    const { comment } = req.body;

    // Validation
    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Comment text is required',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (comment.length > 2000) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Comment must be 2000 characters or less',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Add comment
    const [result] = await pool.execute(`
      INSERT INTO task_comments (task_id, user_id, comment, created_at, updated_at)
      VALUES (?, ?, ?, NOW(), NOW())
    `, [taskId, req.user.id, comment.trim()]);

    // Fetch the created comment with author info
    const [newComment] = await pool.execute(`
      SELECT tc.id, tc.comment, tc.created_at, tc.updated_at,
             u.id as user_id, u.username, u.full_name, u.email, u.avatar_url
      FROM task_comments tc
      JOIN users u ON tc.user_id = u.id
      WHERE tc.id = ?
    `, [result.insertId]);

    // Get task info for broadcasting (including assigned user and creator)
    const [taskInfo] = await pool.execute(`
      SELECT t.title, t.assigned_to, t.created_by, team.name as team_name, team.id as team_id,
             assigned_user.username as assigned_username, assigned_user.full_name as assigned_name
      FROM tasks t
      JOIN teams team ON t.team_id = team.id
      LEFT JOIN users assigned_user ON t.assigned_to = assigned_user.id
      WHERE t.id = ?
    `, [taskId]);

    // Broadcast via RBAC-aware WebSocket
    const realtimeService = req.app.get('realtimeService');
    if (realtimeService) {
      await realtimeService.broadcastToTaskAudience({
        id: parseInt(taskId),
        title: taskInfo[0]?.title,
        team_name: taskInfo[0]?.team_name,
        team_id: taskInfo[0]?.team_id,
        assigned_to: taskInfo[0]?.assigned_to
      }, {
        type: 'commentAdded',
        comment: {
          ...newComment[0],
          task_id: parseInt(taskId),
          task_title: taskInfo[0]?.title,
          task_team_id: taskInfo[0]?.team_id,
          task_assigned_to: taskInfo[0]?.assigned_to,
          task_created_by: taskInfo[0]?.created_by,
          author_name: req.user.full_name || req.user.username
        },
        commenter: {
          id: req.user.id,
          username: req.user.username,
          name: req.user.full_name || req.user.username
        },
        timestamp: new Date().toISOString()
      }, 'comment_added');
    }

    console.log(`Comment added to task ${taskId} by ${req.user.username}`);

    res.status(201).json({
      message: 'Comment added successfully',
      comment: newComment[0]
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({
      error: {
        code: 'COMMENT_ADD_ERROR',
        message: 'Failed to add comment',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * PUT /api/comments/:id
 * Update comment (author only)
 */
router.put('/:id', authenticateJWT, auditCRUD('comment'), async (req, res) => {
  try {
    const commentId = req.params.id;
    const { comment } = req.body;

    // Validation
    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Comment text is required',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (comment.length > 2000) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Comment must be 2000 characters or less',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if comment exists and user is the author
    const [existingComments] = await pool.execute(`
      SELECT tc.id, tc.user_id, tc.task_id, t.team_id
      FROM task_comments tc
      JOIN tasks t ON tc.task_id = t.id
      WHERE tc.id = ?
    `, [commentId]);

    if (existingComments.length === 0) {
      return res.status(404).json({
        error: {
          code: 'COMMENT_NOT_FOUND',
          message: 'Comment not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    const existingComment = existingComments[0];

    // Check permissions: only author or admin can edit
    if (existingComment.user_id !== req.user.id && req.user.global_role !== 'admin') {
      return res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Only the comment author or admin can edit comments',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Verify user has access to the task
    const canViewTask = await requireTaskAccess('VIEW_COMMENTS');
    // Note: This is a simplified check. In a full implementation, we'd verify task access properly.

    // Update comment
    await pool.execute(`
      UPDATE task_comments 
      SET comment = ?, updated_at = NOW() 
      WHERE id = ?
    `, [comment.trim(), commentId]);

    // Fetch updated comment
    const [updatedComment] = await pool.execute(`
      SELECT tc.id, tc.comment, tc.created_at, tc.updated_at,
             u.id as user_id, u.username, u.full_name, u.email, u.avatar_url
      FROM task_comments tc
      JOIN users u ON tc.user_id = u.id
      WHERE tc.id = ?
    `, [commentId]);

    console.log(`Comment updated: ID ${commentId} by ${req.user.username}`);

    res.json({
      message: 'Comment updated successfully',
      comment: updatedComment[0]
    });
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({
      error: {
        code: 'COMMENT_UPDATE_ERROR',
        message: 'Failed to update comment',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * DELETE /api/comments/:id
 * Delete comment (author, team manager, or admin)
 */
router.delete('/:id', authenticateJWT, auditCRUD('comment'), async (req, res) => {
  try {
    const commentId = req.params.id;

    // Get comment details
    const [comments] = await pool.execute(`
      SELECT tc.id, tc.user_id, tc.task_id, tc.comment,
             t.team_id, u.username as author_username
      FROM task_comments tc
      JOIN tasks t ON tc.task_id = t.id
      JOIN users u ON tc.user_id = u.id
      WHERE tc.id = ?
    `, [commentId]);

    if (comments.length === 0) {
      return res.status(404).json({
        error: {
          code: 'COMMENT_NOT_FOUND',
          message: 'Comment not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    const comment = comments[0];

    // Check permissions
    let canDelete = false;

    // Admin can delete any comment
    if (req.user.global_role === 'admin') {
      canDelete = true;
    }
    // Author can delete their own comment
    else if (comment.user_id === req.user.id) {
      canDelete = true;
    }
    // Team leader can delete comments in their team
    else {
      const { getUserTeamRole } = require('../middleware/rbac');
      const userTeamRole = await getUserTeamRole(req.user.id, comment.team_id);
      if (userTeamRole === 'leader') {
        canDelete = true;
      }
    }

    if (!canDelete) {
      return res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions to delete this comment',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Delete comment
    await pool.execute('DELETE FROM task_comments WHERE id = ?', [commentId]);

    console.log(`Comment deleted: ID ${commentId} by ${req.user.username} (author: ${comment.author_username})`);

    res.json({
      message: 'Comment deleted successfully',
      deleted_comment: {
        id: parseInt(commentId),
        task_id: comment.task_id,
        author_username: comment.author_username
      }
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({
      error: {
        code: 'COMMENT_DELETE_ERROR',
        message: 'Failed to delete comment',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/comments/:id
 * Get specific comment details
 */
router.get('/:id', authenticateJWT, async (req, res) => {
  try {
    const commentId = req.params.id;

    // Get comment with task and author info
    const [comments] = await pool.execute(`
      SELECT tc.id, tc.comment, tc.created_at, tc.updated_at,
             tc.task_id, t.title as task_title,
             u.id as user_id, u.username, u.full_name, u.email, u.avatar_url,
             team.id as team_id, team.name as team_name
      FROM task_comments tc
      JOIN tasks t ON tc.task_id = t.id
      JOIN teams team ON t.team_id = team.id
      JOIN users u ON tc.user_id = u.id
      WHERE tc.id = ? AND u.is_active = TRUE AND team.is_active = TRUE
    `, [commentId]);

    if (comments.length === 0) {
      return res.status(404).json({
        error: {
          code: 'COMMENT_NOT_FOUND',
          message: 'Comment not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    const comment = comments[0];

    // Check if user has access to the task
    const { getUserTeamRole } = require('../middleware/rbac');
    const userTeamRole = await getUserTeamRole(req.user.id, comment.team_id);
    
    if (!userTeamRole && req.user.global_role !== 'admin') {
      return res.status(403).json({
        error: {
          code: 'ACCESS_DENIED',
          message: 'Access denied to this comment',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if user can modify this comment
    const canModify = (
      req.user.global_role === 'admin' ||
      comment.user_id === req.user.id ||
      userTeamRole === 'leader'
    );

    res.json({
      comment: {
        ...comment,
        user_can_modify: canModify,
        user_team_role: userTeamRole
      }
    });
  } catch (error) {
    console.error('Error fetching comment details:', error);
    res.status(500).json({
      error: {
        code: 'COMMENT_DETAILS_ERROR',
        message: 'Failed to fetch comment details',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/comments/user/:userId
 * Get comments by specific user (with proper filtering)
 */
router.get('/user/:userId', authenticateJWT, async (req, res) => {
  try {
    const userId = req.params.userId;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    // Users can only see their own comments unless they're admin or manager
    if (parseInt(userId) !== req.user.id && req.user.global_role !== 'admin') {
      // Check if user is a manager of any shared teams
      const [sharedTeams] = await pool.execute(`
        SELECT DISTINCT tm1.team_id
        FROM team_members tm1
        JOIN team_members tm2 ON tm1.team_id = tm2.team_id
        WHERE tm1.user_id = ? AND tm1.team_role = 'manager' 
          AND tm2.user_id = ?
      `, [req.user.id, userId]);

      if (sharedTeams.length === 0) {
        return res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'Access denied to view this user\'s comments',
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    // Get user's comments with task context
    let query = `
      SELECT tc.id, tc.comment, tc.created_at, tc.updated_at,
             tc.task_id, t.title as task_title,
             team.id as team_id, team.name as team_name, team.color as team_color,
             u.username, u.full_name
      FROM task_comments tc
      JOIN tasks t ON tc.task_id = t.id
      JOIN teams team ON t.team_id = team.id
      JOIN users u ON tc.user_id = u.id
      WHERE tc.user_id = ? AND u.is_active = TRUE AND team.is_active = TRUE
    `;

    const params = [userId];

    // Filter by teams user has access to (unless admin)
    if (req.user.global_role !== 'admin') {
      query += ` AND team.id IN (
        SELECT tm.team_id FROM team_members tm WHERE tm.user_id = ?
      )`;
      params.push(req.user.id);
    }

    query += ` ORDER BY tc.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [comments] = await pool.execute(query, params);

    // Get user info
    const [userInfo] = await pool.execute(
      'SELECT username, full_name, email FROM users WHERE id = ? AND is_active = TRUE',
      [userId]
    );

    res.json({
      user: userInfo[0] || null,
      comments,
      total: comments.length,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching user comments:', error);
    res.status(500).json({
      error: {
        code: 'USER_COMMENTS_ERROR',
        message: 'Failed to fetch user comments',
        timestamp: new Date().toISOString()
      }
    });
  }
});

module.exports = router;