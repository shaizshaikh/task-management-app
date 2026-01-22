/**
 * User Management Routes
 * Handles user operations with RBAC
 */

const express = require('express');
const { pool } = require('../database');
const { authenticateJWT } = require('../middleware/auth');
const { requireGlobalPermission, filterByPermissions } = require('../middleware/rbac');
const { auditCRUD } = require('../middleware/audit');
const { 
  filterUsersByPermissions,
  canModifyUser,
  hasManagementRole 
} = require('../utils/permissions');
const userSyncService = require('../services/userSync');
const router = express.Router();

/**
 * GET /api/users
 * Get all users (filtered by permissions)
 */
router.get('/', authenticateJWT, async (req, res) => {
  try {
    console.log('GET /api/users - Query params:', req.query);
    
    const filters = {
      team_id: req.query.team_id,
      global_role: req.query.global_role,
      is_active: req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined,
      search: req.query.search,
      sort_by: req.query.sort_by || 'full_name',
      sort_order: req.query.sort_order || 'asc',
      limit: req.query.limit,
      offset: req.query.offset
    };
    
    console.log('Parsed filters:', filters);

    // Build query with permission-based filtering at database level
    let query = `
      SELECT u.id, u.keycloak_user_id, u.username, u.email, u.full_name, 
             u.global_role, u.avatar_url, u.is_active, u.created_at, u.updated_at, u.deleted_at
      FROM users u
      WHERE u.is_active = TRUE AND u.deleted_at IS NULL
    `;
    const params = [];
    
    console.log('=== USERS QUERY DEBUG ===');
    console.log('Query:', query);
    console.log('Params:', params);

    // For now, admins can see all users, others see limited users
    // TODO: Implement proper team-based filtering when teams are set up
    if (req.user.global_role !== 'admin') {
      query += ' AND u.id = ?'; // Non-admins can only see themselves for now
      params.push(req.user.id);
    }

    // Apply additional filters
    if (filters.global_role) {
      query += ' AND u.global_role = ?';
      params.push(filters.global_role);
    }

    if (filters.search) {
      query += ' AND (u.username LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Sorting
    const validSortFields = ['username', 'full_name', 'email', 'global_role', 'created_at'];
    const sortField = validSortFields.includes(filters.sort_by) ? filters.sort_by : 'full_name';
    const sortOrder = filters.sort_order === 'desc' ? 'DESC' : 'ASC';
    query += ` ORDER BY u.${sortField} ${sortOrder}`;

    // Pagination
    if (filters.limit) {
      const limit = Math.min(parseInt(filters.limit) || 50, 100);
      const offset = Math.max(parseInt(filters.offset) || 0, 0);
      query += ` LIMIT ${limit} OFFSET ${offset}`;
    }

    // Test if we can reach this point
    console.log('=== USERS ENDPOINT REACHED ===');
    
    // Execute the properly filtered query
    const [filteredUsers] = await pool.execute(query, params);
    
    console.log('=== QUERY RESULTS ===');
    console.log('Found users:', filteredUsers.length);
    console.log('Users:', filteredUsers.map(u => ({ id: u.id, username: u.username, deleted_at: u.deleted_at, is_active: u.is_active })));

    // For now, return users without team information to avoid complexity
    const usersWithTeams = filteredUsers.map(user => ({
      ...user,
      team_count: 0 // Will be implemented when teams are working
    }));

    res.json({
      users: usersWithTeams,
      total: usersWithTeams.length,
      user_role: req.user.global_role,
      filters_applied: Object.keys(filters).filter(key => filters[key] !== undefined),
      filtered: req.user.global_role !== 'admin'
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      error: {
        code: 'USERS_FETCH_ERROR',
        message: 'Failed to fetch users',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/users/me
 * Get current user profile
 */
router.get('/me', authenticateJWT, async (req, res) => {
  try {
    // Get detailed user information
    const [users] = await pool.execute(`
      SELECT u.id, u.keycloak_user_id, u.username, u.email, u.full_name,
             u.global_role, u.avatar_url, u.is_active, u.created_at, u.updated_at
      FROM users u
      WHERE u.id = ?
    `, [req.user.id]);

    if (users.length === 0) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User profile not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    const user = users[0];

    // Get user's team memberships
    const [teams] = await pool.execute(`
      SELECT t.id, t.name, t.description, t.color, tm.team_role, tm.added_at,
             (SELECT COUNT(*) FROM tasks WHERE team_id = t.id) as task_count,
             (SELECT COUNT(*) FROM tasks WHERE team_id = t.id AND assigned_to = ?) as assigned_task_count
      FROM teams t
      JOIN team_members tm ON t.id = tm.team_id
      WHERE tm.user_id = ? AND t.is_active = TRUE
      ORDER BY t.name
    `, [req.user.id, req.user.id]);

    // Get user's task statistics
    const [taskStats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_assigned,
        SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo_count,
        SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as in_progress_count,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed_count,
        SUM(CASE WHEN due_date < CURDATE() AND status != 'done' THEN 1 ELSE 0 END) as overdue_count
      FROM tasks t
      JOIN teams team ON t.team_id = team.id
      WHERE t.assigned_to = ? AND team.is_active = TRUE
    `, [req.user.id]);

    // Get recent activity (tasks created or updated by user)
    const [recentActivity] = await pool.execute(`
      SELECT t.id, t.title, t.status, t.updated_at, team.name as team_name,
             CASE 
               WHEN t.created_by = ? THEN 'created'
               ELSE 'updated'
             END as action_type
      FROM tasks t
      JOIN teams team ON t.team_id = team.id
      WHERE (t.created_by = ? OR t.assigned_to = ?) AND team.is_active = TRUE
      ORDER BY t.updated_at DESC
      LIMIT 10
    `, [req.user.id, req.user.id, req.user.id]);

    res.json({
      user: {
        ...user,
        teams,
        team_count: teams.length,
        task_statistics: taskStats[0],
        recent_activity: recentActivity,
        has_management_role: await hasManagementRole(req.user.id, req.user.global_role)
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      error: {
        code: 'PROFILE_ERROR',
        message: 'Failed to fetch user profile',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/users/stats
 * Get user statistics (admin and managers)
 * NOTE: This route must be before /:id to avoid conflicts
 */
router.get('/stats', authenticateJWT, async (req, res) => {
  try {
    // Check if user has management role
    const hasManagement = await hasManagementRole(req.user.id, req.user.global_role);
    
    if (!hasManagement) {
      return res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Management role required to view user statistics',
          timestamp: new Date().toISOString()
        }
      });
    }

    let stats;
    
    if (req.user.global_role === 'admin') {
      // Admin sees all user stats
      stats = await userSyncService.getUserStats();
    } else {
      // Managers see stats for their teams only
      const [teamStats] = await pool.execute(`
        SELECT 
          COUNT(DISTINCT tm.user_id) as total_users,
          SUM(CASE WHEN u.is_active = TRUE THEN 1 ELSE 0 END) as active_users,
          SUM(CASE WHEN u.global_role = 'admin' THEN 1 ELSE 0 END) as admin_count,
          SUM(CASE WHEN u.global_role = 'manager' THEN 1 ELSE 0 END) as manager_count,
          SUM(CASE WHEN u.global_role = 'member' THEN 1 ELSE 0 END) as member_count,
          SUM(CASE WHEN u.global_role = 'viewer' THEN 1 ELSE 0 END) as viewer_count
        FROM team_members tm
        JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id IN (
          SELECT team_id FROM team_members WHERE user_id = ? AND team_role = 'manager'
        )
      `, [req.user.id]);

      stats = teamStats[0];
    }

    res.json({
      statistics: stats,
      scope: req.user.global_role === 'admin' ? 'global' : 'managed_teams',
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching user statistics:', error);
    res.status(500).json({
      error: {
        code: 'STATS_ERROR',
        message: 'Failed to fetch user statistics',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/users/deleted
 * Get soft-deleted users (admin only)
 */
router.get('/deleted', authenticateJWT, requireGlobalPermission('MANAGE_GLOBAL_USERS'), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    const UserSoftDeleteService = require('../utils/userSoftDelete');
    const deletedUsers = await UserSoftDeleteService.getDeletedUsers(limit, offset);

    res.json({
      deleted_users: deletedUsers.users,
      pagination: {
        total: deletedUsers.total,
        limit: deletedUsers.limit,
        offset: deletedUsers.offset,
        has_more: deletedUsers.offset + deletedUsers.limit < deletedUsers.total
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching deleted users:', error);
    res.status(500).json({
      error: {
        code: 'DELETED_USERS_ERROR',
        message: 'Failed to fetch deleted users',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/users/export
 * Export users to CSV/Excel file (admin only)
 * NOTE: This route must be before /:id to avoid conflicts
 */
router.get('/export', authenticateJWT, requireGlobalPermission('MANAGE_GLOBAL_USERS'), auditCRUD('user'), async (req, res) => {
  try {
    console.log(`=== USER EXPORT INITIATED ===`);
    console.log(`Admin User: ${req.user.username} (ID: ${req.user.id})`);
    
    const format = req.query.format || 'csv';
    const includeDeleted = req.query.include_deleted === 'true';
    
    console.log(`Export format: ${format}`);
    console.log(`Include deleted users: ${includeDeleted}`);

    // Validate format
    if (!['csv', 'excel', 'xlsx'].includes(format.toLowerCase())) {
      return res.status(400).json({
        error: {
          code: 'INVALID_FORMAT',
          message: 'Format must be csv, excel, or xlsx',
          timestamp: new Date().toISOString()
        }
      });
    }

    // For now, return a simple CSV response to test the route
    const csvContent = `Username,Email,Full Name,Role,Status
shaiz,shaiz@example.com,Shaiz Admin,admin,active
avinash,avinash@example.com,Avinash User,member,active
jane1.smith,jane@example.com,Jane Smith,member,active
vinod,vinod@example.com,Vinod User,member,active`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="users-export-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Error during user export:', error);
    res.status(500).json({
      error: {
        code: 'USER_EXPORT_ERROR',
        message: 'Failed to export users: ' + error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/users/:id
 * Get specific user details
 */
router.get('/:id', authenticateJWT, async (req, res) => {
  try {
    const userId = req.params.id;

    // Check if user can view this profile
    const canView = await canModifyUser(req.user.id, req.user.global_role, parseInt(userId));
    
    if (!canView && req.user.global_role !== 'admin') {
      return res.status(403).json({
        error: {
          code: 'ACCESS_DENIED',
          message: 'Access denied to view this user profile',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Get user information
    const [users] = await pool.execute(`
      SELECT u.id, u.keycloak_user_id, u.username, u.email, u.full_name,
             u.global_role, u.avatar_url, u.is_active, u.created_at, u.updated_at
      FROM users u
      WHERE u.id = ? AND u.is_active = TRUE
    `, [userId]);

    if (users.length === 0) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    const user = users[0];

    // Get user's team memberships (filtered by requester's access)
    let teamQuery = `
      SELECT t.id, t.name, t.description, t.color, tm.team_role, tm.added_at,
             (SELECT COUNT(*) FROM tasks WHERE team_id = t.id) as task_count,
             (SELECT COUNT(*) FROM tasks WHERE team_id = t.id AND assigned_to = ?) as assigned_task_count
      FROM teams t
      JOIN team_members tm ON t.id = tm.team_id
      WHERE tm.user_id = ? AND t.is_active = TRUE
    `;
    const teamParams = [userId, userId];

    // Non-admin users can only see shared teams
    if (req.user.global_role !== 'admin') {
      teamQuery += ` AND t.id IN (
        SELECT tm2.team_id FROM team_members tm2 WHERE tm2.user_id = ?
      )`;
      teamParams.push(req.user.id);
    }

    teamQuery += ' ORDER BY t.name';
    const [teams] = await pool.execute(teamQuery, teamParams);

    // Get user's task statistics (only for accessible teams)
    let taskStatsQuery = `
      SELECT 
        COUNT(*) as total_assigned,
        SUM(CASE WHEN t.status = 'todo' THEN 1 ELSE 0 END) as todo_count,
        SUM(CASE WHEN t.status = 'in-progress' THEN 1 ELSE 0 END) as in_progress_count,
        SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as completed_count,
        SUM(CASE WHEN t.due_date < CURDATE() AND t.status != 'done' THEN 1 ELSE 0 END) as overdue_count
      FROM tasks t
      JOIN teams team ON t.team_id = team.id
      WHERE t.assigned_to = ? AND team.is_active = TRUE
    `;
    const taskStatsParams = [userId];

    if (req.user.global_role !== 'admin') {
      taskStatsQuery += ` AND team.id IN (
        SELECT tm.team_id FROM team_members tm WHERE tm.user_id = ?
      )`;
      taskStatsParams.push(req.user.id);
    }

    const [taskStats] = await pool.execute(taskStatsQuery, taskStatsParams);

    // Check if requester can modify this user
    const canModify = await canModifyUser(req.user.id, req.user.global_role, parseInt(userId));

    res.json({
      user: {
        ...user,
        teams,
        team_count: teams.length,
        task_statistics: taskStats[0],
        user_can_modify: canModify,
        has_management_role: await hasManagementRole(parseInt(userId), user.global_role)
      }
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({
      error: {
        code: 'USER_DETAILS_ERROR',
        message: 'Failed to fetch user details',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * PUT /api/users/:id/role
 * Update user's global role (admin only) - syncs with Keycloak
 */
router.put('/:id/role', authenticateJWT, requireGlobalPermission('MANAGE_GLOBAL_USERS'), auditCRUD('user'), async (req, res) => {
  try {
    const userId = req.params.id;
    const { global_role } = req.body;

    // Validation
    const validRoles = ['admin', 'manager', 'member', 'viewer'];
    if (!global_role || !validRoles.includes(global_role)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ROLE',
          message: 'Global role must be one of: admin, manager, member, viewer',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if user exists
    const [users] = await pool.execute(
      'SELECT username, full_name, global_role, keycloak_user_id FROM users WHERE id = ? AND is_active = TRUE',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    const user = users[0];

    // Prevent self-role change
    if (parseInt(userId) === req.user.id) {
      return res.status(403).json({
        error: {
          code: 'SELF_ROLE_CHANGE',
          message: 'Users cannot change their own global role',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Update role in Keycloak first
    let keycloakSuccess = false;
    if (user.keycloak_user_id) {
      try {
        const keycloakAdmin = require('../services/keycloakAdmin');
        await keycloakAdmin.assignUserRole(user.keycloak_user_id, global_role);
        keycloakSuccess = true;
        console.log(`Keycloak role updated: ${user.username} -> ${global_role}`);
      } catch (keycloakError) {
        console.error('Failed to update role in Keycloak:', keycloakError.message);
        // Continue with local update but warn user
      }
    }

    // Update role in local database
    await pool.execute(
      'UPDATE users SET global_role = ?, updated_at = NOW() WHERE id = ?',
      [global_role, userId]
    );

    console.log(`User role updated: ${user.username} from ${user.global_role} to ${global_role} by ${req.user.username}`);

    // Get updated user info
    const [updatedUser] = await pool.execute(
      'SELECT id, username, full_name, email, global_role, updated_at FROM users WHERE id = ?',
      [userId]
    );

    res.json({
      message: 'User role updated successfully',
      user: updatedUser[0],
      previous_role: user.global_role,
      keycloak_synced: keycloakSuccess,
      warning: !keycloakSuccess ? 'Role updated locally but failed to sync with Keycloak' : null
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({
      error: {
        code: 'ROLE_UPDATE_ERROR',
        message: 'Failed to update user role',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * PUT /api/users/me/profile
 * Update current user's profile
 */
router.put('/me/profile', authenticateJWT, async (req, res) => {
  try {
    const { full_name, avatar_url } = req.body;

    // Validation
    const updates = [];
    const values = [];

    if (full_name !== undefined) {
      if (full_name.trim().length === 0) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Full name cannot be empty',
            timestamp: new Date().toISOString()
          }
        });
      }
      if (full_name.length > 255) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Full name must be 255 characters or less',
            timestamp: new Date().toISOString()
          }
        });
      }
      updates.push('full_name = ?');
      values.push(full_name.trim());
    }

    if (avatar_url !== undefined) {
      if (avatar_url && avatar_url.length > 500) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Avatar URL must be 500 characters or less',
            timestamp: new Date().toISOString()
          }
        });
      }
      updates.push('avatar_url = ?');
      values.push(avatar_url?.trim() || null);
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
    values.push(req.user.id);

    // Update profile
    await pool.execute(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Get updated user info
    const [updatedUser] = await pool.execute(
      'SELECT id, username, full_name, email, avatar_url, updated_at FROM users WHERE id = ?',
      [req.user.id]
    );

    console.log(`Profile updated by user: ${req.user.username}`);

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser[0]
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      error: {
        code: 'PROFILE_UPDATE_ERROR',
        message: 'Failed to update profile',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /api/users
 * Create new user in Keycloak and local database (admin only)
 */
router.post('/', authenticateJWT, requireGlobalPermission('MANAGE_GLOBAL_USERS'), auditCRUD('user'), async (req, res) => {
  try {
    const { username, email, full_name, global_role = 'member', password, temporary_password = true } = req.body;

    // Validation
    if (!username || !email) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Username and email are required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const validRoles = ['admin', 'manager', 'member', 'viewer'];
    if (!validRoles.includes(global_role)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ROLE',
          message: 'Global role must be one of: admin, manager, member, viewer',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if user already exists locally
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        error: {
          code: 'USER_EXISTS',
          message: 'User with this username or email already exists',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Create user in Keycloak
    let keycloakUser = null;
    try {
      const keycloakAdmin = require('../services/keycloakAdmin');
      keycloakUser = await keycloakAdmin.createUser({
        username,
        email,
        full_name,
        global_role,
        password,
        temporaryPassword: temporary_password
      });
      console.log(`User created in Keycloak: ${username} (ID: ${keycloakUser.id})`);
    } catch (keycloakError) {
      console.error('Failed to create user in Keycloak:', keycloakError.message);
      return res.status(500).json({
        error: {
          code: 'KEYCLOAK_CREATE_ERROR',
          message: 'Failed to create user in Keycloak: ' + keycloakError.message,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Create user in local database
    try {
      const localUser = await userSyncService.createUser({
        keycloak_user_id: keycloakUser.id,
        username,
        email,
        full_name: full_name || username,
        global_role
      });

      // Broadcast user creation via real-time service
      const realtimeService = req.app.get('realtimeService');
      if (realtimeService) {
        await realtimeService.broadcastUserUpdate('created', {
          username: localUser.username,
          global_role: localUser.global_role,
          id: localUser.id
        }, {
          id: req.user.id,
          username: req.user.username
        });
      }

      // Send welcome email with credentials
      try {
        const emailService = require('../services/emailService');
        await emailService.sendWelcomeEmail({
          email,
          username,
          full_name: full_name || username,
          password,
          temporaryPassword: temporary_password
        });
        console.log(`Welcome email sent to ${email}`);
      } catch (emailError) {
        console.warn(`Failed to send welcome email to ${email}:`, emailError.message);
        // Don't fail user creation if email sending fails
      }

      console.log(`User created: ${username} (Local ID: ${localUser.id}, Keycloak ID: ${keycloakUser.id}) by ${req.user.username}`);

      res.status(201).json({
        message: 'User created successfully',
        user: {
          id: localUser.id,
          username: localUser.username,
          email: localUser.email,
          full_name: localUser.full_name,
          global_role: localUser.global_role,
          keycloak_user_id: localUser.keycloak_user_id,
          created_at: localUser.created_at
        },
        keycloak_synced: true,
        temporary_password: temporary_password
      });
    } catch (dbError) {
      // If local creation fails, try to clean up Keycloak user
      try {
        const keycloakAdmin = require('../services/keycloakAdmin');
        await keycloakAdmin.deleteUser(keycloakUser.id);
        console.log(`Cleaned up Keycloak user after database error: ${keycloakUser.id}`);
      } catch (cleanupError) {
        console.error('Failed to cleanup Keycloak user:', cleanupError.message);
      }

      throw dbError;
    }
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      error: {
        code: 'USER_CREATE_ERROR',
        message: 'Failed to create user',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /api/users/sync
 * Force sync all users from Keycloak (admin only)
 */
router.post('/sync', authenticateJWT, requireGlobalPermission('MANAGE_GLOBAL_USERS'), async (req, res) => {
  try {
    console.log(`User sync initiated by: ${req.user.username}`);
    
    // Sync users from Keycloak
    const keycloakAdmin = require('../services/keycloakAdmin');
    const syncResults = await keycloakAdmin.syncUsersFromKeycloak();
    
    console.log('User sync completed:', syncResults);
    
    res.json({
      message: 'User synchronization completed successfully',
      results: syncResults,
      timestamp: new Date().toISOString(),
      initiated_by: req.user.username
    });
  } catch (error) {
    console.error('Error syncing users:', error);
    res.status(500).json({
      error: {
        code: 'USER_SYNC_ERROR',
        message: 'Failed to sync users: ' + error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * DELETE /api/users/:id
 * Delete user from both Keycloak and local database (admin only)
 */
router.delete('/:id', authenticateJWT, requireGlobalPermission('MANAGE_GLOBAL_USERS'), auditCRUD('user'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { reason, reassign_to } = req.body;

    console.log(`=== USER DELETION INITIATED ===`);
    console.log(`Target User ID: ${userId}`);
    console.log(`Admin User: ${req.user.username} (ID: ${req.user.id})`);
    console.log(`Reason: ${reason || 'Not specified'}`);
    console.log(`Reassign tasks to: ${reassign_to || 'Unassign'}`);

    // Validation
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({
        error: {
          code: 'INVALID_USER_ID',
          message: 'Invalid user ID provided',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Prevent self-deletion
    if (userId === req.user.id) {
      return res.status(403).json({
        error: {
          code: 'SELF_DELETION_FORBIDDEN',
          message: 'Users cannot delete their own account',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if user exists and get user info
    const [users] = await pool.execute(
      'SELECT id, username, email, full_name, global_role, keycloak_user_id FROM users WHERE id = ? AND deleted_at IS NULL',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found or already deleted',
          timestamp: new Date().toISOString()
        }
      });
    }

    const targetUser = users[0];

    // Validate reassign_to user if provided
    let reassignToUser = null;
    if (reassign_to) {
      const reassignToId = parseInt(reassign_to);
      if (isNaN(reassignToId) || reassignToId <= 0) {
        return res.status(400).json({
          error: {
            code: 'INVALID_REASSIGN_USER',
            message: 'Invalid reassign user ID provided',
            timestamp: new Date().toISOString()
          }
        });
      }

      const [reassignUsers] = await pool.execute(
        'SELECT id, username, full_name FROM users WHERE id = ? AND is_active = TRUE AND deleted_at IS NULL',
        [reassignToId]
      );

      if (reassignUsers.length === 0) {
        return res.status(400).json({
          error: {
            code: 'REASSIGN_USER_NOT_FOUND',
            message: 'User to reassign tasks to not found or inactive',
            timestamp: new Date().toISOString()
          }
        });
      }

      reassignToUser = reassignUsers[0];
    }

    // Start deletion process
    const UserSoftDeleteService = require('../utils/userSoftDelete');
    const keycloakAdmin = require('../services/keycloakAdmin');

    // Create operation log entry
    const [operationResult] = await pool.execute(
      `INSERT INTO user_operations_log 
       (operation_type, admin_user_id, affected_users_count, status, operation_details, started_at) 
       VALUES ('delete', ?, 1, 'in_progress', ?, NOW())`,
      [req.user.id, JSON.stringify({
        target_user_id: userId,
        target_username: targetUser.username,
        reason: reason,
        reassign_to: reassign_to
      })]
    );

    const operationLogId = operationResult.insertId;

    try {
      // Step 1: Reassign or unassign user's tasks
      console.log('Step 1: Handling task reassignment...');
      const taskReassignResult = await UserSoftDeleteService.reassignUserTasks(
        userId, 
        reassignToUser ? reassignToUser.id : null
      );
      console.log(`Tasks handled: ${taskReassignResult.tasksReassigned} tasks ${reassignToUser ? 'reassigned to ' + reassignToUser.username : 'unassigned'}`);

      // Step 2: Remove user from all teams
      console.log('Step 2: Removing from teams...');
      const teamRemovalResult = await UserSoftDeleteService.removeUserFromTeams(userId);
      console.log(`Team memberships removed: ${teamRemovalResult.membershipsRemoved}`);

      // Step 3: Delete user from Keycloak (includes session revocation)
      console.log('Step 3: Deleting from Keycloak...');
      let keycloakDeletionResult = { success: false, sessionsRevoked: 0 };
      
      if (targetUser.keycloak_user_id) {
        try {
          keycloakDeletionResult = await keycloakAdmin.deleteUser(targetUser.keycloak_user_id);
          console.log('Keycloak deletion successful:', keycloakDeletionResult);
        } catch (keycloakError) {
          console.error('Keycloak deletion failed:', keycloakError.message);
          // Continue with local deletion but record the error
        }
      } else {
        console.log('No Keycloak user ID found, skipping Keycloak deletion');
      }

      // Step 4: Soft delete user in local database
      console.log('Step 4: Soft deleting in local database...');
      const softDeleteResult = await UserSoftDeleteService.softDeleteUser(
        userId, 
        req.user.id, 
        reason
      );

      // Step 5: Update deletion log with detailed results
      await pool.execute(
        `UPDATE user_deletion_log SET 
         operation_log_id = ?,
         tasks_reassigned_count = ?,
         tasks_unassigned_count = ?,
         team_memberships_removed = ?,
         keycloak_deletion_success = ?,
         sessions_revoked_count = ?,
         deletion_status = 'completed'
         WHERE deleted_user_id = ? AND admin_user_id = ?
         ORDER BY deleted_at DESC LIMIT 1`,
        [
          operationLogId,
          reassignToUser ? taskReassignResult.tasksReassigned : 0,
          reassignToUser ? 0 : taskReassignResult.tasksReassigned,
          teamRemovalResult.membershipsRemoved,
          keycloakDeletionResult.success,
          keycloakDeletionResult.sessionsRevoked || 0,
          userId,
          req.user.id
        ]
      );

      // Step 6: Send deletion notification email
      console.log('Step 6: Sending deletion notification email...');
      try {
        const emailService = require('../services/emailService');
        const emailResult = await emailService.sendUserDeletionEmail({
          email: targetUser.email,
          username: targetUser.username,
          full_name: targetUser.full_name
        });

        if (emailResult.success) {
          console.log(`Deletion notification sent to: ${targetUser.email}`);
        } else {
          console.warn(`Failed to send deletion notification to: ${targetUser.email} - ${emailResult.error}`);
        }
      } catch (emailError) {
        console.error(`Email error for deletion notification:`, emailError.message);
      }

      // Step 7: Update operation log as completed
      await pool.execute(
        `UPDATE user_operations_log SET 
         status = 'completed',
         successful_count = 1,
         failed_count = 0,
         completed_at = NOW(),
         duration_seconds = TIMESTAMPDIFF(SECOND, started_at, NOW())
         WHERE id = ?`,
        [operationLogId]
      );

      // Broadcast user deletion via real-time service
      const realtimeService = req.app.get('realtimeService');
      if (realtimeService) {
        await realtimeService.broadcastUserUpdate('deleted', {
          username: targetUser.username,
          global_role: targetUser.global_role,
          id: targetUser.id
        }, {
          id: req.user.id,
          username: req.user.username
        });
      }

      console.log(`=== USER DELETION COMPLETED ===`);
      console.log(`User ${targetUser.username} successfully deleted by ${req.user.username}`);

      // Return success response
      res.json({
        message: 'User deleted successfully',
        deleted_user: {
          id: targetUser.id,
          username: targetUser.username,
          email: targetUser.email,
          full_name: targetUser.full_name,
          global_role: targetUser.global_role
        },
        deletion_details: {
          tasks_reassigned: reassignToUser ? taskReassignResult.tasksReassigned : 0,
          tasks_unassigned: reassignToUser ? 0 : taskReassignResult.tasksReassigned,
          reassigned_to: reassignToUser ? {
            id: reassignToUser.id,
            username: reassignToUser.username,
            full_name: reassignToUser.full_name
          } : null,
          team_memberships_removed: teamRemovalResult.membershipsRemoved,
          keycloak_deleted: keycloakDeletionResult.success,
          sessions_revoked: keycloakDeletionResult.sessionsRevoked || 0,
          reason: reason || null
        },
        operation_log_id: operationLogId,
        deleted_by: {
          id: req.user.id,
          username: req.user.username,
          full_name: req.user.full_name
        },
        deleted_at: new Date().toISOString()
      });

    } catch (deletionError) {
      console.error('User deletion failed:', deletionError.message);

      // Update operation log as failed
      await pool.execute(
        `UPDATE user_operations_log SET 
         status = 'failed',
         successful_count = 0,
         failed_count = 1,
         error_details = ?,
         completed_at = NOW(),
         duration_seconds = TIMESTAMPDIFF(SECOND, started_at, NOW())
         WHERE id = ?`,
        [JSON.stringify({ error: deletionError.message }), operationLogId]
      );

      // Also update deletion log if it exists
      await pool.execute(
        `UPDATE user_deletion_log SET 
         deletion_status = 'failed',
         error_message = ?
         WHERE deleted_user_id = ? AND admin_user_id = ?
         ORDER BY deleted_at DESC LIMIT 1`,
        [deletionError.message, userId, req.user.id]
      );

      throw deletionError;
    }

  } catch (error) {
    console.error('Error deleting user:', error);
    
    // Determine appropriate error response
    if (error.message.includes('User not found in Keycloak')) {
      return res.status(404).json({
        error: {
          code: 'KEYCLOAK_USER_NOT_FOUND',
          message: 'User not found in Keycloak authentication system',
          timestamp: new Date().toISOString()
        }
      });
    } else if (error.message.includes('Insufficient permissions')) {
      return res.status(403).json({
        error: {
          code: 'KEYCLOAK_PERMISSION_DENIED',
          message: 'Insufficient permissions to delete user in Keycloak',
          timestamp: new Date().toISOString()
        }
      });
    } else {
      return res.status(500).json({
        error: {
          code: 'USER_DELETION_ERROR',
          message: 'Failed to delete user: ' + error.message,
          timestamp: new Date().toISOString()
        }
      });
    }
  }
});



/**
 * POST /api/users/:id/restore
 * Restore a soft-deleted user (admin only)
 */
router.post('/:id/restore', authenticateJWT, requireGlobalPermission('MANAGE_GLOBAL_USERS'), auditCRUD('user'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({
        error: {
          code: 'INVALID_USER_ID',
          message: 'Invalid user ID provided',
          timestamp: new Date().toISOString()
        }
      });
    }

    const UserSoftDeleteService = require('../utils/userSoftDelete');
    const restoreResult = await UserSoftDeleteService.restoreUser(userId, req.user.id);

    console.log(`User restored: ${restoreResult.restoredUser.username} by ${req.user.username}`);

    // Send restoration notification email with new credentials
    try {
      const emailService = require('../services/emailService');
      const emailResult = await emailService.sendUserRestorationEmail({
        email: restoreResult.restoredUser.email,
        username: restoreResult.restoredUser.username,
        full_name: restoreResult.restoredUser.full_name,
        password: restoreResult.restoredUser.newPassword,
        temporaryPassword: restoreResult.restoredUser.temporaryPassword
      });

      if (emailResult.success) {
        console.log(`Restoration notification with credentials sent to: ${restoreResult.restoredUser.email}`);
      } else {
        console.warn(`Failed to send restoration notification to: ${restoreResult.restoredUser.email} - ${emailResult.error}`);
      }
    } catch (emailError) {
      console.error(`Email error for restoration notification:`, emailError.message);
    }

    res.json({
      message: 'User restored successfully',
      restored_user: restoreResult.restoredUser,
      restored_by: {
        id: req.user.id,
        username: req.user.username,
        full_name: req.user.full_name
      },
      restored_at: new Date().toISOString(),
      keycloak_status: 'User recreated/re-enabled in Keycloak'
    });
  } catch (error) {
    console.error('Error restoring user:', error);
    
    if (error.message.includes('not found or not deleted')) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_DELETED',
          message: 'User not found or not deleted',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(500).json({
      error: {
        code: 'USER_RESTORE_ERROR',
        message: 'Failed to restore user: ' + error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/users/operations/stats
 * Get user operation statistics (admin only)
 */
router.get('/operations/stats', authenticateJWT, requireGlobalPermission('MANAGE_GLOBAL_USERS'), async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 365);
    
    const UserSoftDeleteService = require('../utils/userSoftDelete');
    const stats = await UserSoftDeleteService.getDeletionStats(days);

    // Get operation statistics from user_operations_log
    const [operationStats] = await pool.execute(
      `SELECT 
         operation_type,
         COUNT(*) as total_operations,
         SUM(successful_count) as total_successful,
         SUM(failed_count) as total_failed,
         AVG(duration_seconds) as avg_duration_seconds
       FROM user_operations_log
       WHERE started_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY operation_type
       ORDER BY operation_type`,
      [days]
    );

    res.json({
      deletion_statistics: stats,
      operation_statistics: operationStats,
      period_days: days,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching operation statistics:', error);
    res.status(500).json({
      error: {
        code: 'OPERATION_STATS_ERROR',
        message: 'Failed to fetch operation statistics',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /api/users/import
 * Bulk import users from CSV/Excel file (admin only)
 */
router.post('/import', authenticateJWT, requireGlobalPermission('MANAGE_GLOBAL_USERS'), auditCRUD('user'), async (req, res) => {
  const { uploadUserImportFile, cleanupMiddleware, validateUploadedFile } = require('../middleware/fileUpload');
  const FileProcessingService = require('../services/fileProcessingService');
  const keycloakAdmin = require('../services/keycloakAdmin');
  
  // Apply file upload middleware
  uploadUserImportFile(req, res, async (uploadError) => {
    if (uploadError) {
      return; // Error already handled by middleware
    }

    // Apply file validation middleware
    validateUploadedFile(req, res, async (validationError) => {
      if (validationError) {
        return; // Error already handled by middleware
      }

      try {
        console.log(`=== BULK USER IMPORT INITIATED ===`);
        console.log(`Admin User: ${req.user.username} (ID: ${req.user.id})`);
        console.log(`File: ${req.uploadedFile.originalName} (${req.uploadedFile.size} bytes)`);

        // Create operation log entry
        const [operationResult] = await pool.execute(
          `INSERT INTO user_operations_log 
           (operation_type, admin_user_id, file_name, file_size, status, operation_details, started_at) 
           VALUES ('import', ?, ?, ?, 'in_progress', ?, NOW())`,
          [
            req.user.id,
            req.uploadedFile.originalName,
            req.uploadedFile.size,
            JSON.stringify({
              original_filename: req.uploadedFile.originalName,
              file_type: req.uploadedFile.mimetype
            })
          ]
        );

        const operationLogId = operationResult.insertId;

        try {
          // Step 1: Parse the uploaded file
          console.log('Step 1: Parsing uploaded file...');
          const fileService = new FileProcessingService();
          const parseResult = await fileService.parseImportFile(req.uploadedFile.path);
          
          console.log(`File parsed: ${parseResult.users.length} valid users, ${parseResult.errors.length} errors`);

          if (parseResult.users.length === 0) {
            throw new Error('No valid users found in the uploaded file');
          }

          // Step 2: Check for existing users
          console.log('Step 2: Checking for existing users...');
          const existingUsers = [];
          const newUsers = [];

          for (const user of parseResult.users) {
            const [existing] = await pool.execute(
              'SELECT id, username, email FROM users WHERE username = ? OR email = ?',
              [user.username, user.email]
            );

            if (existing.length > 0) {
              existingUsers.push({
                ...user,
                existingUser: existing[0]
              });
            } else {
              newUsers.push(user);
            }
          }

          console.log(`Found ${existingUsers.length} existing users, ${newUsers.length} new users to create`);

          // Step 3: Create users in Keycloak and local database
          console.log('Step 3: Creating users...');
          const creationResults = {
            successful: [],
            failed: [],
            skipped: existingUsers
          };

          if (newUsers.length > 0) {
            // Use Keycloak bulk creation
            const keycloakResults = await keycloakAdmin.createUsers(newUsers);
            
            // Sync successful Keycloak users to local database
            const userSyncService = require('../services/userSync');
            
            for (const successfulUser of keycloakResults.successful) {
              try {
                const localUser = await userSyncService.createUser({
                  keycloak_user_id: successfulUser.keycloakUserId,
                  username: successfulUser.username,
                  email: successfulUser.email,
                  full_name: newUsers.find(u => u.username === successfulUser.username)?.firstName + ' ' + 
                           newUsers.find(u => u.username === successfulUser.username)?.lastName || successfulUser.username,
                  global_role: newUsers.find(u => u.username === successfulUser.username)?.role || 'member'
                });

                creationResults.successful.push({
                  ...successfulUser,
                  localUserId: localUser.id,
                  fullName: localUser.full_name,
                  role: localUser.global_role
                });

                console.log(`User created: ${successfulUser.username} (Local ID: ${localUser.id})`);
              } catch (syncError) {
                console.error(`Failed to sync user ${successfulUser.username} to local DB:`, syncError.message);
                
                // Try to cleanup Keycloak user
                try {
                  await keycloakAdmin.deleteUser(successfulUser.keycloakUserId);
                  console.log(`Cleaned up Keycloak user: ${successfulUser.username}`);
                } catch (cleanupError) {
                  console.error(`Failed to cleanup Keycloak user:`, cleanupError.message);
                }

                creationResults.failed.push({
                  username: successfulUser.username,
                  email: successfulUser.email,
                  error: `Database sync failed: ${syncError.message}`
                });
              }
            }

            // Add Keycloak failures to failed results
            creationResults.failed.push(...keycloakResults.failed);
          }

          // Step 4: Update operation log with results
          const totalProcessed = parseResult.users.length;
          const successfulCount = creationResults.successful.length;
          const failedCount = creationResults.failed.length + parseResult.errors.length;
          const skippedCount = creationResults.skipped.length;

          await pool.execute(
            `UPDATE user_operations_log SET 
             status = ?,
             affected_users_count = ?,
             successful_count = ?,
             failed_count = ?,
             error_details = ?,
             completed_at = NOW(),
             duration_seconds = TIMESTAMPDIFF(SECOND, started_at, NOW())
             WHERE id = ?`,
            [
              failedCount > 0 ? (successfulCount > 0 ? 'partial' : 'failed') : 'completed',
              totalProcessed,
              successfulCount,
              failedCount,
              JSON.stringify({
                parse_errors: parseResult.errors,
                creation_failures: creationResults.failed,
                existing_users: creationResults.skipped.map(u => ({ username: u.username, email: u.email }))
              }),
              operationLogId
            ]
          );

          // Step 5: Send welcome emails to successfully created users
          console.log('Step 5: Sending welcome emails...');
          const emailService = require('../services/emailService');
          let emailsSent = 0;
          let emailsFailed = 0;

          for (const successfulUser of creationResults.successful) {
            try {
              const emailResult = await emailService.sendWelcomeEmail({
                email: successfulUser.email,
                username: successfulUser.username,
                full_name: successfulUser.fullName,
                password: successfulUser.password,
                temporaryPassword: successfulUser.temporaryPassword
              });

              if (emailResult.success) {
                emailsSent++;
                console.log(`Welcome email sent to: ${successfulUser.email}`);
              } else {
                emailsFailed++;
                console.warn(`Failed to send welcome email to: ${successfulUser.email} - ${emailResult.error}`);
              }
            } catch (emailError) {
              emailsFailed++;
              console.error(`Email error for ${successfulUser.email}:`, emailError.message);
            }
          }

          console.log(`Email summary: ${emailsSent} sent, ${emailsFailed} failed`);

          // Step 6: Send import completion notification to admin
          try {
            await emailService.sendImportCompletionEmail(req.user.email, {
              successful: creationResults.successful,
              failed: creationResults.failed,
              total: totalProcessed
            });
            console.log(`Import completion email sent to admin: ${req.user.email}`);
          } catch (adminEmailError) {
            console.warn(`Failed to send completion email to admin:`, adminEmailError.message);
          }

          console.log(`=== BULK USER IMPORT COMPLETED ===`);
          console.log(`Total processed: ${totalProcessed}`);
          console.log(`Successful: ${successfulCount}`);
          console.log(`Failed: ${failedCount}`);
          console.log(`Skipped (existing): ${skippedCount}`);

          // Return comprehensive results
          res.json({
            message: 'User import completed',
            results: {
              total_processed: totalProcessed,
              successful: successfulCount,
              failed: failedCount,
              skipped: skippedCount,
              operation_log_id: operationLogId,
              emails_sent: emailsSent,
              emails_failed: emailsFailed
            },
            details: {
              successful_users: creationResults.successful.map(u => ({
                username: u.username,
                email: u.email,
                full_name: u.fullName,
                role: u.role,
                temporary_password: u.temporaryPassword,
                password: u.password // Include generated password for admin
              })),
              failed_users: creationResults.failed.map(u => ({
                username: u.username,
                email: u.email,
                error: u.error
              })),
              skipped_users: creationResults.skipped.map(u => ({
                username: u.username,
                email: u.email,
                reason: 'User already exists',
                existing_id: u.existingUser.id
              })),
              parse_errors: parseResult.errors
            },
            file_info: {
              original_name: req.uploadedFile.originalName,
              size: req.uploadedFile.size,
              processed_at: new Date().toISOString()
            },
            imported_by: {
              id: req.user.id,
              username: req.user.username,
              full_name: req.user.full_name
            }
          });

        } catch (importError) {
          console.error('Bulk import failed:', importError.message);

          // Update operation log as failed
          await pool.execute(
            `UPDATE user_operations_log SET 
             status = 'failed',
             successful_count = 0,
             failed_count = 1,
             error_details = ?,
             completed_at = NOW(),
             duration_seconds = TIMESTAMPDIFF(SECOND, started_at, NOW())
             WHERE id = ?`,
            [JSON.stringify({ error: importError.message }), operationLogId]
          );

          throw importError;
        }

      } catch (error) {
        console.error('Error during bulk user import:', error);
        
        // Determine appropriate error response
        if (error.message.includes('No valid users found')) {
          return res.status(400).json({
            error: {
              code: 'NO_VALID_USERS',
              message: 'No valid users found in the uploaded file',
              timestamp: new Date().toISOString()
            }
          });
        } else if (error.message.includes('File parsing failed')) {
          return res.status(400).json({
            error: {
              code: 'FILE_PARSING_ERROR',
              message: 'Failed to parse the uploaded file: ' + error.message,
              timestamp: new Date().toISOString()
            }
          });
        } else {
          return res.status(500).json({
            error: {
              code: 'BULK_IMPORT_ERROR',
              message: 'Failed to import users: ' + error.message,
              timestamp: new Date().toISOString()
            }
          });
        }
      } finally {
        // Cleanup middleware will handle file cleanup
        cleanupMiddleware(req, res, () => {});
      }
    });
  });
});

/**
 * GET /api/users/import/template
 * Download CSV template for user import (admin only)
 */
router.get('/import/template', authenticateJWT, requireGlobalPermission('MANAGE_GLOBAL_USERS'), (req, res) => {
  try {
    const format = req.query.format || 'csv';
    
    // CSV template content
    const csvTemplate = `username,email,firstName,lastName,role,groups,temporaryPassword,enabled
john.doe,john@example.com,John,Doe,member,"team1,team2",true,true
jane.smith,jane@example.com,Jane,Smith,manager,team1,true,true
bob.wilson,bob@example.com,Bob,Wilson,viewer,,true,true`;

    if (format.toLowerCase() === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="user-import-template.csv"');
      res.send(csvTemplate);
    } else {
      // For Excel format, we'd need to generate an actual Excel file
      // For now, return CSV with Excel extension
      res.setHeader('Content-Type', 'application/vnd.ms-excel');
      res.setHeader('Content-Disposition', 'attachment; filename="user-import-template.xls"');
      res.send(csvTemplate);
    }
  } catch (error) {
    console.error('Error generating import template:', error);
    res.status(500).json({
      error: {
        code: 'TEMPLATE_ERROR',
        message: 'Failed to generate import template',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/users/import/history
 * Get import operation history (admin only)
 */
router.get('/import/history', authenticateJWT, requireGlobalPermission('MANAGE_GLOBAL_USERS'), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    const [operations] = await pool.execute(
      `SELECT 
         uol.id,
         uol.operation_type,
         uol.affected_users_count,
         uol.successful_count,
         uol.failed_count,
         uol.file_name,
         uol.file_size,
         uol.status,
         uol.started_at,
         uol.completed_at,
         uol.duration_seconds,
         admin.username as admin_username,
         admin.full_name as admin_full_name
       FROM user_operations_log uol
       JOIN users admin ON uol.admin_user_id = admin.id
       WHERE uol.operation_type = 'import'
       ORDER BY uol.started_at DESC
       LIMIT ${limit} OFFSET ${offset}`
    );

    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total 
       FROM user_operations_log 
       WHERE operation_type = 'import'`
    );

    res.json({
      import_history: operations,
      pagination: {
        total: countResult[0].total,
        limit: limit,
        offset: offset,
        has_more: offset + limit < countResult[0].total
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching import history:', error);
    res.status(500).json({
      error: {
        code: 'IMPORT_HISTORY_ERROR',
        message: 'Failed to fetch import history',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/users/import/template
 * Download CSV template for user import (admin only)
 */
router.get('/import/template', authenticateJWT, requireGlobalPermission('MANAGE_GLOBAL_USERS'), (req, res) => {
  try {
    const format = req.query.format || 'csv';
    
    // CSV template content
    const csvTemplate = `username,email,firstName,lastName,role,groups,temporaryPassword,enabled
john.doe,john@example.com,John,Doe,member,"team1,team2",true,true
jane.smith,jane@example.com,Jane,Smith,manager,team1,true,true
bob.wilson,bob@example.com,Bob,Wilson,viewer,,true,true`;

    if (format.toLowerCase() === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="user-import-template.csv"');
      res.send(csvTemplate);
    } else {
      // For Excel format, we'd need to generate an actual Excel file
      // For now, return CSV with Excel extension
      res.setHeader('Content-Type', 'application/vnd.ms-excel');
      res.setHeader('Content-Disposition', 'attachment; filename="user-import-template.xls"');
      res.send(csvTemplate);
    }
  } catch (error) {
    console.error('Error generating import template:', error);
    res.status(500).json({
      error: {
        code: 'TEMPLATE_ERROR',
        message: 'Failed to generate import template',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/users/export-test
 * Test route to check if routing is working
 */
router.get('/export-test', (req, res) => {
  res.json({ message: 'Export route is accessible', timestamp: new Date().toISOString() });
});



/**
 * GET /api/users/export/history
 * Get export operation history (admin only)
 */
router.get('/export/history', authenticateJWT, requireGlobalPermission('MANAGE_GLOBAL_USERS'), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    const [operations] = await pool.execute(
      `SELECT 
         uol.id,
         uol.operation_type,
         uol.affected_users_count,
         uol.successful_count,
         uol.failed_count,
         uol.status,
         uol.operation_details,
         uol.started_at,
         uol.completed_at,
         uol.duration_seconds,
         admin.username as admin_username,
         admin.full_name as admin_full_name
       FROM user_operations_log uol
       JOIN users admin ON uol.admin_user_id = admin.id
       WHERE uol.operation_type = 'export'
       ORDER BY uol.started_at DESC
       LIMIT ${limit} OFFSET ${offset}`
    );

    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total 
       FROM user_operations_log 
       WHERE operation_type = 'export'`
    );

    // Parse operation details
    const enrichedOperations = operations.map(op => ({
      ...op,
      operation_details: op.operation_details ? JSON.parse(op.operation_details) : {}
    }));

    res.json({
      export_history: enrichedOperations,
      pagination: {
        total: countResult[0].total,
        limit: limit,
        offset: offset,
        has_more: offset + limit < countResult[0].total
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching export history:', error);
    res.status(500).json({
      error: {
        code: 'EXPORT_HISTORY_ERROR',
        message: 'Failed to fetch export history',
        timestamp: new Date().toISOString()
      }
    });
  }
});

module.exports = router;/**
 * 
POST /api/users/sync
 * Manually trigger user synchronization (Admin only)
 */
router.post('/sync', authenticateJWT, requireGlobalPermission('admin'), async (req, res) => {
  try {
    console.log('Manual user sync triggered by:', req.user.username);
    
    const result = await userSyncService.performFullSync();
    
    res.json({
      success: true,
      message: 'User synchronization completed',
      result: {
        synced: result.synced,
        cleaned: result.cleaned || 0,
        errors: result.errors || []
      }
    });
  } catch (error) {
    console.error('Error during manual sync:', error);
    res.status(500).json({
      error: {
        message: 'Failed to synchronize users',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/users/cleanup-orphaned
 * Clean up orphaned users (Admin only)
 */
router.post('/cleanup-orphaned', authenticateJWT, requireGlobalPermission('admin'), async (req, res) => {
  try {
    console.log('Manual orphaned user cleanup triggered by:', req.user.username);
    
    const result = await userSyncService.cleanupOrphanedUsers();
    
    res.json({
      success: true,
      message: 'Orphaned user cleanup completed',
      result: {
        cleaned: result.cleaned,
        errors: result.errors
      }
    });
  } catch (error) {
    console.error('Error during orphaned user cleanup:', error);
    res.status(500).json({
      error: {
        message: 'Failed to cleanup orphaned users',
        details: error.message
      }
    });
  }
});