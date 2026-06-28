/**
 * Team Management Routes
 * Handles team CRUD operations with RBAC
 */

const express = require('express');
const { pool } = require('../database');
const { authenticateJWT } = require('../middleware/auth');
const { 
  requireGlobalPermission, 
  requireTeamPermission,
  filterByPermissions 
} = require('../middleware/rbac');
const { auditCRUD } = require('../middleware/audit');
const { 
  filterTeamsByPermissions,
  getManagedTeams 
} = require('../utils/permissions');

const router = express.Router();

/**
 * GET /api/teams
 * Get all teams (filtered by user permissions)
 */
router.get('/', authenticateJWT, async (req, res) => {
  try {
    console.log('=== TEAMS ENDPOINT REACHED ===');
    console.log('User:', req.user.username, 'Role:', req.user.global_role);
    console.log('Role type:', typeof req.user.global_role);
    console.log('Is admin?', req.user.global_role === 'admin');
    console.log('Is manager?', req.user.global_role === 'manager');
    
    // Get teams based on user role
    let query;
    let params = [];
    
    if (req.user.global_role === 'admin' || req.user.global_role === 'manager') {
      // Admins and Global Managers see all teams
      query = `
        SELECT t.id, t.name, t.description, t.color,
               (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) as member_count,
               (SELECT COUNT(*) FROM tasks ta WHERE ta.team_id = t.id) as task_count,
               (SELECT COUNT(*) FROM tasks ta WHERE ta.team_id = t.id AND ta.status != 'done') as active_tasks
        FROM teams t 
        WHERE t.is_active = TRUE 
        ORDER BY t.name
      `;
    } else {
      // Members and Viewers only see teams they belong to
      query = `
        SELECT t.id, t.name, t.description, t.color,
               (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) as member_count,
               (SELECT COUNT(*) FROM tasks ta WHERE ta.team_id = t.id) as task_count,
               (SELECT COUNT(*) FROM tasks ta WHERE ta.team_id = t.id AND ta.status != 'done') as active_tasks
        FROM teams t 
        INNER JOIN team_members tm ON t.id = tm.team_id
        WHERE t.is_active = TRUE AND tm.user_id = ?
        ORDER BY t.name
      `;
      params.push(req.user.id);
    }
    
    const [filteredTeams] = await pool.execute(query, params);
    console.log('Found teams:', filteredTeams.length);

    // Add user's role in each team
    const teamsWithRoles = await Promise.all(
      filteredTeams.map(async (team) => {
        if (req.user.global_role === 'admin') {
          return { ...team, user_team_role: 'admin' };
        }

        const [userRole] = await pool.execute(`
          SELECT team_role FROM team_members WHERE team_id = ? AND user_id = ?
        `, [team.id, req.user.id]);

        return {
          ...team,
          user_team_role: userRole.length > 0 ? userRole[0].team_role : null
        };
      })
    );

    res.json({
      teams: teamsWithRoles,
      total: teamsWithRoles.length,
      user_role: req.user.global_role,
      filtered: req.user.global_role !== 'admin'
    });
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({
      error: {
        code: 'TEAMS_FETCH_ERROR',
        message: 'Failed to fetch teams',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/teams/:id
 * Get specific team details
 */
router.get('/:id', authenticateJWT, requireTeamPermission('VIEW_TEAM', 'id'), async (req, res) => {
  try {
    const teamId = req.params.id;

    // Get team details
    const [teams] = await pool.execute(`
      SELECT t.id, t.name, t.description, t.color, t.created_by, t.is_active,
             t.created_at, t.updated_at,
             creator.username as created_by_username,
             creator.full_name as created_by_name
      FROM teams t
      JOIN users creator ON t.created_by = creator.id
      WHERE t.id = ? AND t.is_active = TRUE
    `, [teamId]);

    if (teams.length === 0) {
      return res.status(404).json({
        error: {
          code: 'TEAM_NOT_FOUND',
          message: 'Team not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    const team = teams[0];

    // Get team members
    const [members] = await pool.execute(`
      SELECT tm.id, tm.team_role, tm.added_at,
             u.id as user_id, u.username, u.full_name, u.email, u.global_role,
             adder.username as added_by_username,
             adder.full_name as added_by_name
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      JOIN users adder ON tm.added_by = adder.id
      WHERE tm.team_id = ? AND u.is_active = TRUE
      ORDER BY tm.team_role DESC, u.full_name
    `, [teamId]);

    // Get team statistics
    const [stats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_tasks,
        SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo_count,
        SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as in_progress_count,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done_count,
        SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) as high_priority_count,
        SUM(CASE WHEN due_date < CURDATE() AND status != 'done' THEN 1 ELSE 0 END) as overdue_count
      FROM tasks
      WHERE team_id = ?
    `, [teamId]);

    res.json({
      team: {
        ...team,
        members,
        member_count: members.length,
        statistics: stats[0],
        user_team_role: req.teamRole
      }
    });
  } catch (error) {
    console.error('Error fetching team details:', error);
    res.status(500).json({
      error: {
        code: 'TEAM_DETAILS_ERROR',
        message: 'Failed to fetch team details',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /api/teams
 * Create new team (admin only)
 */
router.post('/', authenticateJWT, requireGlobalPermission('CREATE_TEAM'), auditCRUD('team'), async (req, res) => {
  try {
    const { name, description, color = '#2196F3' } = req.body;

    // Validation
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Team name is required',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (name.length > 255) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Team name must be 255 characters or less',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if team name already exists
    const [existingTeams] = await pool.execute(
      'SELECT id FROM teams WHERE name = ? AND is_active = TRUE',
      [name.trim()]
    );

    if (existingTeams.length > 0) {
      return res.status(409).json({
        error: {
          code: 'TEAM_NAME_EXISTS',
          message: 'A team with this name already exists',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Create team
    const [result] = await pool.execute(`
      INSERT INTO teams (name, description, color, created_by, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, TRUE, NOW(), NOW())
    `, [name.trim(), description?.trim() || null, color, req.user.id]);

    const teamId = result.insertId;

    // Add creator as team leader
    await pool.execute(`
      INSERT INTO team_members (team_id, user_id, team_role, added_by, added_at)
      VALUES (?, ?, 'leader', ?, NOW())
    `, [teamId, req.user.id, req.user.id]);

    // Fetch the created team
    const [newTeam] = await pool.execute(`
      SELECT t.id, t.name, t.description, t.color, t.created_by, t.is_active,
             t.created_at, t.updated_at,
             creator.username as created_by_username,
             creator.full_name as created_by_name
      FROM teams t
      JOIN users creator ON t.created_by = creator.id
      WHERE t.id = ?
    `, [teamId]);

    // Broadcast team creation via real-time service
    const realtimeService = req.app.get('realtimeService');
    if (realtimeService) {
      await realtimeService.broadcastTeamUpdate(teamId, 'created', {
        team_name: name,
        team: newTeam[0]
      }, {
        id: req.user.id,
        username: req.user.username
      });
    }

    console.log(`Team created: ${name} (ID: ${teamId}) by ${req.user.username}`);

    res.status(201).json({
      message: 'Team created successfully',
      team: {
        ...newTeam[0],
        member_count: 1,
        user_team_role: 'leader'
      }
    });
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({
      error: {
        code: 'TEAM_CREATE_ERROR',
        message: 'Failed to create team',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * PUT /api/teams/:id
 * Update team (admin or team manager)
 */
router.put('/:id', authenticateJWT, requireTeamPermission('MANAGE_TEAM', 'id'), auditCRUD('team'), async (req, res) => {
  try {
    const teamId = req.params.id;
    const { name, description, color } = req.body;

    // Validation
    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Team name cannot be empty',
            timestamp: new Date().toISOString()
          }
        });
      }

      if (name.length > 255) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Team name must be 255 characters or less',
            timestamp: new Date().toISOString()
          }
        });
      }

      // Check if name is taken by another team
      const [existingTeams] = await pool.execute(
        'SELECT id FROM teams WHERE name = ? AND id != ? AND is_active = TRUE',
        [name.trim(), teamId]
      );

      if (existingTeams.length > 0) {
        return res.status(409).json({
          error: {
            code: 'TEAM_NAME_EXISTS',
            message: 'A team with this name already exists',
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description?.trim() || null);
    }
    if (color !== undefined) {
      updates.push('color = ?');
      values.push(color);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: {
          code: 'NO_UPDATES',
          message: 'No valid fields to update',
          timestamp: new Date().toISOString()
        }
      });
    }

    updates.push('updated_at = NOW()');
    values.push(teamId);

    // Update team
    await pool.execute(
      `UPDATE teams SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Fetch updated team
    const [updatedTeam] = await pool.execute(`
      SELECT t.id, t.name, t.description, t.color, t.created_by, t.is_active,
             t.created_at, t.updated_at,
             creator.username as created_by_username,
             creator.full_name as created_by_name,
             (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) as member_count
      FROM teams t
      JOIN users creator ON t.created_by = creator.id
      WHERE t.id = ?
    `, [teamId]);

    console.log(`Team updated: ${updatedTeam[0].name} (ID: ${teamId}) by ${req.user.username}`);

    res.json({
      message: 'Team updated successfully',
      team: {
        ...updatedTeam[0],
        user_team_role: req.teamRole
      }
    });
  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({
      error: {
        code: 'TEAM_UPDATE_ERROR',
        message: 'Failed to update team',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * DELETE /api/teams/:id
 * Delete team (admin only)
 */
router.delete('/:id', authenticateJWT, requireGlobalPermission('DELETE_TEAM'), auditCRUD('team'), async (req, res) => {
  try {
    const teamId = req.params.id;

    // Check if team exists
    const [teams] = await pool.execute(
      'SELECT name FROM teams WHERE id = ? AND is_active = TRUE',
      [teamId]
    );

    if (teams.length === 0) {
      return res.status(404).json({
        error: {
          code: 'TEAM_NOT_FOUND',
          message: 'Team not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    const teamName = teams[0].name;

    // Soft delete team (set is_active = FALSE)
    await pool.execute(
      'UPDATE teams SET is_active = FALSE, updated_at = NOW() WHERE id = ?',
      [teamId]
    );

    console.log(`Team deleted: ${teamName} (ID: ${teamId}) by ${req.user.username}`);

    // Broadcast team deletion
    const realtimeService = req.app.get('realtimeService');
    if (realtimeService) {
      await realtimeService.broadcastTeamUpdate(parseInt(teamId), 'deleted', {
        team_id: parseInt(teamId),
        team_name: teamName
      }, {
        id: req.user.id,
        username: req.user.username,
        name: req.user.full_name || req.user.username
      });
    }

    res.json({
      message: 'Team deleted successfully',
      team: {
        id: parseInt(teamId),
        name: teamName
      }
    });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({
      error: {
        code: 'TEAM_DELETE_ERROR',
        message: 'Failed to delete team',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/teams/:id/members
 * Get team members
 */
router.get('/:id/members', authenticateJWT, async (req, res) => {
  try {
    const teamId = req.params.id;

    const [members] = await pool.execute(`
      SELECT tm.id, tm.team_role, tm.added_at,
             u.id as user_id, u.username, u.full_name, u.email, u.global_role, u.is_active,
             adder.username as added_by_username,
             adder.full_name as added_by_name
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      JOIN users adder ON tm.added_by = adder.id
      WHERE tm.team_id = ? AND u.is_active = TRUE
      ORDER BY 
        CASE tm.team_role 
          WHEN 'leader' THEN 1 
          WHEN 'member' THEN 2 
          WHEN 'viewer' THEN 3 
        END,
        u.full_name
    `, [teamId]);

    res.json({
      team_id: parseInt(teamId),
      members,
      total: members.length,
      user_team_role: req.teamRole
    });
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({
      error: {
        code: 'TEAM_MEMBERS_ERROR',
        message: 'Failed to fetch team members',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /api/teams/:id/members
 * Add member to team (admin or team manager)
 */
router.post('/:id/members', authenticateJWT, requireTeamPermission('ADD_TEAM_MEMBERS', 'id'), auditCRUD('team'), async (req, res) => {
  try {
    const teamId = req.params.id;
    const { user_id, team_role = 'member' } = req.body;

    // Validation
    if (!user_id) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'User ID is required',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (!['leader', 'member', 'viewer'].includes(team_role)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid team role. Must be: manager, member, or viewer',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if user exists and is active
    const [users] = await pool.execute(
      'SELECT id, username, full_name, email FROM users WHERE id = ? AND is_active = TRUE',
      [user_id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found or inactive',
          timestamp: new Date().toISOString()
        }
      });
    }

    const user = users[0];

    // Check if user is already a team member
    const [existingMembers] = await pool.execute(
      'SELECT id, team_role FROM team_members WHERE team_id = ? AND user_id = ?',
      [teamId, user_id]
    );

    if (existingMembers.length > 0) {
      return res.status(409).json({
        error: {
          code: 'USER_ALREADY_MEMBER',
          message: `User is already a team member with role: ${existingMembers[0].team_role}`,
          current_role: existingMembers[0].team_role,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Non-admin users cannot add other leaders
    if (req.user.global_role !== 'admin' && team_role === 'leader') {
      return res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Only admins can add team managers',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Add user to team
    const [result] = await pool.execute(`
      INSERT INTO team_members (team_id, user_id, team_role, added_by, added_at)
      VALUES (?, ?, ?, ?, NOW())
    `, [teamId, user_id, team_role, req.user.id]);

    // Fetch the added member details
    const [newMember] = await pool.execute(`
      SELECT tm.id, tm.team_role, tm.added_at,
             u.id as user_id, u.username, u.full_name, u.email, u.global_role,
             adder.username as added_by_username,
             adder.full_name as added_by_name
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      JOIN users adder ON tm.added_by = adder.id
      WHERE tm.id = ?
    `, [result.insertId]);

    console.log(`User added to team: ${user.username} as ${team_role} to team ${teamId} by ${req.user.username}`);

    // Send team change notification email
    try {
      const emailService = require('../services/emailService');
      
      // Get team info
      const [teamInfo] = await pool.execute(
        'SELECT name FROM teams WHERE id = ?',
        [teamId]
      );

      if (teamInfo.length > 0) {
        const emailResult = await emailService.sendTeamChangeEmail(
          user,
          { name: teamInfo[0].name, role: team_role },
          'added',
          req.user
        );

        if (emailResult.success) {
          console.log(`Team assignment notification sent to: ${user.email}`);
        } else {
          console.warn(`Failed to send team assignment notification to: ${user.email} - ${emailResult.error}`);
        }
      }
    } catch (emailError) {
      console.error(`Email error for team assignment notification:`, emailError.message);
    }

    res.status(201).json({
      message: 'User added to team successfully',
      member: newMember[0]
    });
  } catch (error) {
    console.error('Error adding team member:', error);
    res.status(500).json({
      error: {
        code: 'ADD_MEMBER_ERROR',
        message: 'Failed to add team member',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * PUT /api/teams/:id/members/:userId
 * Update team member role (admin or team manager)
 */
router.put('/:id/members/:userId', authenticateJWT, requireTeamPermission('ADD_TEAM_MEMBERS', 'id'), auditCRUD('team'), async (req, res) => {
  try {
    const teamId = req.params.id;
    const userId = req.params.userId;
    const { team_role } = req.body;

    // Validation
    if (!team_role || !['leader', 'member', 'viewer'].includes(team_role)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid team role. Must be: manager, member, or viewer',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if user is team member
    const [existingMembers] = await pool.execute(`
      SELECT tm.id, tm.team_role, u.username, u.full_name
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = ? AND tm.user_id = ?
    `, [teamId, userId]);

    if (existingMembers.length === 0) {
      return res.status(404).json({
        error: {
          code: 'MEMBER_NOT_FOUND',
          message: 'User is not a member of this team',
          timestamp: new Date().toISOString()
        }
      });
    }

    const currentMember = existingMembers[0];

    // Non-admin users cannot promote to leader or demote leaders
    if (req.user.global_role !== 'admin') {
      if (team_role === 'leader' || currentMember.team_role === 'leader') {
        return res.status(403).json({
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Only admins can manage team manager roles',
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    // Users cannot change their own role
    if (parseInt(userId) === req.user.id) {
      return res.status(403).json({
        error: {
          code: 'SELF_ROLE_CHANGE',
          message: 'Users cannot change their own team role',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Update role
    await pool.execute(
      'UPDATE team_members SET team_role = ? WHERE team_id = ? AND user_id = ?',
      [team_role, teamId, userId]
    );

    // Fetch updated member
    const [updatedMember] = await pool.execute(`
      SELECT tm.id, tm.team_role, tm.added_at,
             u.id as user_id, u.username, u.full_name, u.email, u.global_role,
             adder.username as added_by_username,
             adder.full_name as added_by_name
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      JOIN users adder ON tm.added_by = adder.id
      WHERE tm.team_id = ? AND tm.user_id = ?
    `, [teamId, userId]);

    console.log(`Team member role updated: ${currentMember.username} from ${currentMember.team_role} to ${team_role} in team ${teamId} by ${req.user.username}`);

    // Send team role change notification email
    try {
      const emailService = require('../services/emailService');
      
      // Get team info
      const [teamInfo] = await pool.execute(
        'SELECT name FROM teams WHERE id = ?',
        [teamId]
      );

      // Get user info
      const [userInfo] = await pool.execute(
        'SELECT id, username, full_name, email FROM users WHERE id = ?',
        [userId]
      );

      if (teamInfo.length > 0 && userInfo.length > 0) {
        const emailResult = await emailService.sendTeamChangeEmail(
          userInfo[0],
          { name: teamInfo[0].name, role: team_role },
          'updated',
          req.user
        );

        if (emailResult.success) {
          console.log(`Team role update notification sent to: ${userInfo[0].email}`);
        } else {
          console.warn(`Failed to send team role update notification to: ${userInfo[0].email} - ${emailResult.error}`);
        }
      }
    } catch (emailError) {
      console.error(`Email error for team role update notification:`, emailError.message);
    }

    res.json({
      message: 'Team member role updated successfully',
      member: updatedMember[0],
      previous_role: currentMember.team_role
    });
  } catch (error) {
    console.error('Error updating team member role:', error);
    res.status(500).json({
      error: {
        code: 'UPDATE_MEMBER_ERROR',
        message: 'Failed to update team member role',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * DELETE /api/teams/:id/members/:userId
 * Remove member from team (admin or team manager)
 */
router.delete('/:id/members/:userId', authenticateJWT, requireTeamPermission('REMOVE_TEAM_MEMBERS', 'id'), auditCRUD('team'), async (req, res) => {
  try {
    const teamId = req.params.id;
    const userId = req.params.userId;

    // Check if user is team member
    const [existingMembers] = await pool.execute(`
      SELECT tm.id, tm.team_role, u.username, u.full_name
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = ? AND tm.user_id = ?
    `, [teamId, userId]);

    if (existingMembers.length === 0) {
      return res.status(404).json({
        error: {
          code: 'MEMBER_NOT_FOUND',
          message: 'User is not a member of this team',
          timestamp: new Date().toISOString()
        }
      });
    }

    const member = existingMembers[0];

    // Non-admin users cannot remove other leaders
    if (req.user.global_role !== 'admin' && member.team_role === 'leader') {
      return res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Only admins can remove team managers',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Users cannot remove themselves
    if (parseInt(userId) === req.user.id) {
      return res.status(403).json({
        error: {
          code: 'SELF_REMOVAL',
          message: 'Users cannot remove themselves from teams',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if this is the last leader (prevent removing all leaders)
    if (member.team_role === 'leader') {
      const [leaderCount] = await pool.execute(
        'SELECT COUNT(*) as count FROM team_members WHERE team_id = ? AND team_role = "leader"',
        [teamId]
      );

      if (leaderCount[0].count <= 1) {
        return res.status(400).json({
          error: {
            code: 'LAST_MANAGER',
            message: 'Cannot remove the last manager from the team',
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    // Remove user from team
    await pool.execute(
      'DELETE FROM team_members WHERE team_id = ? AND user_id = ?',
      [teamId, userId]
    );

    // Unassign user from all tasks in this team
    await pool.execute(
      'UPDATE tasks SET assigned_to = NULL WHERE team_id = ? AND assigned_to = ?',
      [teamId, userId]
    );

    console.log(`User removed from team: ${member.username} (${member.team_role}) from team ${teamId} by ${req.user.username}`);

    res.json({
      message: 'User removed from team successfully',
      removed_member: {
        user_id: parseInt(userId),
        username: member.username,
        full_name: member.full_name,
        team_role: member.team_role
      }
    });
  } catch (error) {
    console.error('Error removing team member:', error);
    res.status(500).json({
      error: {
        code: 'REMOVE_MEMBER_ERROR',
        message: 'Failed to remove team member',
        timestamp: new Date().toISOString()
      }
    });
  }
});

module.exports = router;