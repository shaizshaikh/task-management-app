const express = require('express');
const { pool } = require('./database');
const authRoutes = require('./routes/auth');
const teamRoutes = require('./routes/teams');
const taskRoutes = require('./routes/tasks');
const commentRoutes = require('./routes/comments');
const attachmentRoutes = require('./routes/attachments');
const userRoutes = require('./routes/users');
const auditRoutes = require('./routes/audit');
const { authenticateJWT } = require('./middleware/auth');
const { requireGlobalPermission, filterByPermissions } = require('./middleware/rbac');
const { auditUnauthorized } = require('./middleware/audit');
const router = express.Router();

// Apply audit middleware for unauthorized access tracking
router.use(auditUnauthorized);

// Authentication routes
router.use('/auth', authRoutes);

// User management routes
router.use('/users', userRoutes);

// Team management routes
router.use('/teams', teamRoutes);

// Task management routes
router.use('/tasks', taskRoutes);

// Comment management routes
router.use('/comments', commentRoutes);

// Attachment management routes
router.use('/attachments', attachmentRoutes);

// Audit trail routes
router.use('/audit', auditRoutes);

// RBAC test endpoint
router.get('/rbac/test', authenticateJWT, (req, res) => {
  res.json({
    message: 'RBAC is working!',
    user: {
      id: req.user.id,
      username: req.user.username,
      global_role: req.user.global_role
    },
    timestamp: new Date().toISOString()
  });
});

// Admin-only test endpoint
router.get('/rbac/admin-test', authenticateJWT, requireGlobalPermission('CREATE_TEAM'), (req, res) => {
  res.json({
    message: 'Admin access confirmed!',
    user: {
      username: req.user.username,
      global_role: req.user.global_role
    },
    timestamp: new Date().toISOString()
  });
});

// Root API endpoint - for nginx compatibility
router.get('/', (req, res) => {
  res.json({ 
    message: 'Task Management API is running through nginx proxy!',
    timestamp: new Date().toISOString(),
    status: 'healthy',
    features: ['RBAC', 'Keycloak Authentication', 'JWT Validation']
  });
});

// Health check endpoint - consistent with main server.js
router.get('/health', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT 1 as test');
    const dbConnected = rows.length > 0;
    
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      database: dbConnected ? 'Connected' : 'Disconnected',
      environment: {
        db_host: process.env.DB_HOST || 'localhost',
        db_name: process.env.DB_NAME || 'task_management',
        port: process.env.PORT || 5000,
        node_env: process.env.NODE_ENV || 'development'
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({ 
      status: 'ERROR', 
      timestamp: new Date().toISOString(),
      database: 'Disconnected',
      error: error.message
    });
  }
});

// Old task routes removed - now handled by /routes/tasks.js

// GET - System statistics for admin dashboard
router.get('/stats', authenticateJWT, async (req, res) => {
  try {
    console.log('=== STATS ENDPOINT REACHED ===');
    console.log('User:', req.user.username, 'Role:', req.user.global_role);

    let taskStats, teamStats, userStats;

    // Role-based access control:
    // - Admin: Full system access
    // - Global Manager (global_role='manager'): Full system access like admin
    // - Team Manager (team_role='manager'): Only teams they manage
    // - Member/Viewer: Only teams they belong to

    if (req.user.global_role === 'admin' || req.user.global_role === 'manager') {
      // Admin and Global Manager see all system statistics
      [taskStats] = await pool.execute(`
        SELECT 
          COUNT(*) as total_tasks,
          SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed_tasks,
          SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as in_progress_tasks,
          SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo_tasks,
          SUM(CASE WHEN due_date < CURDATE() AND status != 'done' THEN 1 ELSE 0 END) as overdue_tasks,
          SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) as high_priority_tasks
        FROM tasks
      `);

      [teamStats] = await pool.execute(`
        SELECT 
          COUNT(*) as total_teams,
          COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_teams
        FROM teams
      `);

      [userStats] = await pool.execute(`
        SELECT 
          COUNT(*) as total_users,
          SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) as active_users,
          SUM(CASE WHEN global_role = 'admin' THEN 1 ELSE 0 END) as admin_count,
          SUM(CASE WHEN global_role = 'manager' THEN 1 ELSE 0 END) as manager_count,
          SUM(CASE WHEN global_role = 'member' THEN 1 ELSE 0 END) as member_count,
          SUM(CASE WHEN global_role = 'viewer' THEN 1 ELSE 0 END) as viewer_count
        FROM users
      `);
    } else {
      // Check if user is a team manager (has manager role in any team)
      const [teamManagerCheck] = await pool.execute(`
        SELECT COUNT(*) as manager_teams 
        FROM team_members 
        WHERE user_id = ? AND team_role = 'manager'
      `, [req.user.id]);

      if (teamManagerCheck[0].manager_teams > 0) {
        // Team Manager sees statistics for teams they manage
        [taskStats] = await pool.execute(`
          SELECT 
            COUNT(*) as total_tasks,
            SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed_tasks,
            SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as in_progress_tasks,
            SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo_tasks,
            SUM(CASE WHEN due_date < CURDATE() AND status != 'done' THEN 1 ELSE 0 END) as overdue_tasks,
            SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) as high_priority_tasks
          FROM tasks t
          WHERE t.team_id IN (
            SELECT tm.team_id FROM team_members tm 
            WHERE tm.user_id = ? AND tm.team_role = 'manager'
          )
        `, [req.user.id]);

        [teamStats] = await pool.execute(`
          SELECT 
            COUNT(*) as total_teams,
            COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_teams
          FROM teams t
          WHERE t.id IN (
            SELECT tm.team_id FROM team_members tm 
            WHERE tm.user_id = ? AND tm.team_role = 'manager'
          )
        `, [req.user.id]);

        [userStats] = await pool.execute(`
          SELECT 
            COUNT(DISTINCT u.id) as total_users,
            SUM(CASE WHEN u.is_active = TRUE THEN 1 ELSE 0 END) as active_users,
            SUM(CASE WHEN u.global_role = 'admin' THEN 1 ELSE 0 END) as admin_count,
            SUM(CASE WHEN u.global_role = 'manager' THEN 1 ELSE 0 END) as manager_count,
            SUM(CASE WHEN u.global_role = 'member' THEN 1 ELSE 0 END) as member_count,
            SUM(CASE WHEN u.global_role = 'viewer' THEN 1 ELSE 0 END) as viewer_count
          FROM users u
          JOIN team_members tm ON u.id = tm.user_id
          WHERE tm.team_id IN (
            SELECT tm2.team_id FROM team_members tm2 
            WHERE tm2.user_id = ? AND tm2.team_role = 'manager'
          )
        `, [req.user.id]);
      } else {
      // Members and viewers see statistics for their teams only
      [taskStats] = await pool.execute(`
        SELECT 
          COUNT(*) as total_tasks,
          SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed_tasks,
          SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as in_progress_tasks,
          SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo_tasks,
          SUM(CASE WHEN due_date < CURDATE() AND status != 'done' THEN 1 ELSE 0 END) as overdue_tasks,
          SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) as high_priority_tasks
        FROM tasks t
        WHERE t.team_id IN (
          SELECT tm.team_id FROM team_members tm WHERE tm.user_id = ?
        )
      `, [req.user.id]);

      [teamStats] = await pool.execute(`
        SELECT 
          COUNT(*) as total_teams,
          COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_teams
        FROM teams t
        WHERE t.id IN (
          SELECT tm.team_id FROM team_members tm WHERE tm.user_id = ?
        )
      `, [req.user.id]);

      [userStats] = await pool.execute(`
        SELECT 
          COUNT(DISTINCT u.id) as total_users,
          SUM(CASE WHEN u.is_active = TRUE THEN 1 ELSE 0 END) as active_users,
          SUM(CASE WHEN u.global_role = 'admin' THEN 1 ELSE 0 END) as admin_count,
          SUM(CASE WHEN u.global_role = 'manager' THEN 1 ELSE 0 END) as manager_count,
          SUM(CASE WHEN u.global_role = 'member' THEN 1 ELSE 0 END) as member_count,
          SUM(CASE WHEN u.global_role = 'viewer' THEN 1 ELSE 0 END) as viewer_count
        FROM users u
        JOIN team_members tm ON u.id = tm.user_id
        WHERE tm.team_id IN (
          SELECT tm2.team_id FROM team_members tm2 WHERE tm2.user_id = ?
        )
      `, [req.user.id]);
      }
    }

    // Get recent activity from audit logs (if available)
    let auditStats = { recent_activity: 0 };
    try {
      const [recentAudit] = await pool.execute(`
        SELECT COUNT(*) as recent_activity
        FROM audit_logs 
        WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `);
      auditStats = recentAudit[0];
    } catch (auditError) {
      console.log('Audit table not available, skipping audit stats');
    }

    const stats = {
      // Task statistics
      total_tasks: taskStats[0].total_tasks,
      completed_tasks: taskStats[0].completed_tasks,
      in_progress_tasks: taskStats[0].in_progress_tasks,
      todo_tasks: taskStats[0].todo_tasks,
      overdue_tasks: taskStats[0].overdue_tasks,
      high_priority_tasks: taskStats[0].high_priority_tasks,
      
      // Team statistics
      total_teams: teamStats[0].total_teams,
      active_teams: teamStats[0].active_teams,
      
      // User statistics
      total_users: userStats[0].total_users,
      active_users: userStats[0].active_users,
      admin_count: userStats[0].admin_count,
      manager_count: userStats[0].manager_count,
      member_count: userStats[0].member_count,
      viewer_count: userStats[0].viewer_count,
      
      // Activity statistics
      recent_activity: auditStats.recent_activity,
      
      // Metadata
      generated_at: new Date().toISOString(),
      user_role: req.user.global_role
    };

    console.log('System stats generated:', {
      tasks: stats.total_tasks,
      teams: stats.total_teams,
      users: stats.total_users
    });

    res.json(stats);
  } catch (error) {
    console.error('Error fetching system statistics:', error);
    res.status(500).json({
      error: {
        code: 'STATS_ERROR',
        message: 'Failed to fetch system statistics',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// GET - All users (with RBAC filtering)
router.get('/users', authenticateJWT, filterByPermissions, async (req, res) => {
  try {
    // Get all users first
    const [allUsers] = await pool.execute(`
      SELECT id, username, full_name, email, global_role, is_active, created_at, updated_at 
      FROM users 
      WHERE is_active = TRUE 
      ORDER BY full_name
    `);
    
    // Filter based on permissions
    const { filterUsersByPermissions } = require('./utils/permissions');
    const filteredUsers = await filterUsersByPermissions(
      req.user.id, 
      req.user.global_role, 
      allUsers
    );
    
    res.json({
      users: filteredUsers,
      total: filteredUsers.length,
      filtered: req.user.global_role !== 'admin'
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ 
      error: {
        code: 'USERS_ERROR',
        message: 'Failed to fetch users',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Old projects route removed - now using teams

module.exports = router;
