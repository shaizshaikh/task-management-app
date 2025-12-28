/**
 * Role-Based Access Control (RBAC) Middleware
 * Handles global and team-specific permission checking
 */

const { pool } = require('../database');

/**
 * Global Role Hierarchy (higher number = more permissions)
 */
const GLOBAL_ROLE_HIERARCHY = {
  'viewer': 1,
  'member': 2,
  'manager': 3,
  'admin': 4
};

/**
 * Team Role Hierarchy (higher number = more permissions within team)
 */
const TEAM_ROLE_HIERARCHY = {
  'viewer': 1,
  'member': 2,
  'leader': 3
};

/**
 * Permission Definitions
 */
const PERMISSIONS = {
  // Global permissions (require global role)
  GLOBAL: {
    CREATE_TEAM: ['admin', 'manager'],
    DELETE_TEAM: ['admin', 'manager'],
    MANAGE_GLOBAL_USERS: ['admin'],
    VIEW_ALL_TEAMS: ['admin'],
    VIEW_SYSTEM_STATS: ['admin', 'manager']
  },
  
  // Team permissions (require team membership + role)
  TEAM: {
    VIEW_TEAM: ['leader', 'member', 'viewer'],
    MANAGE_TEAM: ['leader'],
    ADD_TEAM_MEMBERS: ['leader'],
    REMOVE_TEAM_MEMBERS: ['leader'],
    CREATE_TASK: ['leader', 'member'],
    ASSIGN_TASK: ['leader'],
    UPDATE_TASK_STATUS: ['leader', 'member'],
    DELETE_TASK: ['leader'],
    VIEW_TASK: ['leader', 'member', 'viewer'],
    ADD_COMMENT: ['leader', 'member'],
    UPLOAD_ATTACHMENT: ['leader', 'member'],
    VIEW_COMMENTS: ['leader', 'member', 'viewer']
  }
};

/**
 * Check if user has required global role
 */
function hasGlobalPermission(userRole, requiredRoles) {
  if (!requiredRoles || requiredRoles.length === 0) return true;
  
  const userLevel = GLOBAL_ROLE_HIERARCHY[userRole] || 0;
  return requiredRoles.some(role => {
    const requiredLevel = GLOBAL_ROLE_HIERARCHY[role] || 0;
    return userLevel >= requiredLevel;
  });
}

/**
 * Check if user has required team role
 */
function hasTeamPermission(userTeamRole, requiredRoles) {
  if (!requiredRoles || requiredRoles.length === 0) return true;
  
  const userLevel = TEAM_ROLE_HIERARCHY[userTeamRole] || 0;
  return requiredRoles.some(role => {
    const requiredLevel = TEAM_ROLE_HIERARCHY[role] || 0;
    return userLevel >= requiredLevel;
  });
}

/**
 * Get user's team membership and role
 */
async function getUserTeamRole(userId, teamId) {
  try {
    const [teamMembers] = await pool.execute(`
      SELECT team_role 
      FROM team_members 
      WHERE user_id = ? AND team_id = ?
    `, [userId, teamId]);
    
    return teamMembers.length > 0 ? teamMembers[0].team_role : null;
  } catch (error) {
    console.error('Error getting user team role:', error);
    return null;
  }
}

/**
 * Get all teams where user has specified role or higher
 */
async function getUserTeams(userId, minRole = 'viewer') {
  try {
    const minLevel = TEAM_ROLE_HIERARCHY[minRole] || 1;
    
    const [teams] = await pool.execute(`
      SELECT t.id, t.name, tm.team_role
      FROM teams t
      JOIN team_members tm ON t.id = tm.team_id
      WHERE tm.user_id = ? AND t.is_active = TRUE
    `, [userId]);
    
    return teams.filter(team => {
      const userLevel = TEAM_ROLE_HIERARCHY[team.team_role] || 0;
      return userLevel >= minLevel;
    });
  } catch (error) {
    console.error('Error getting user teams:', error);
    return [];
  }
}

/**
 * Middleware: Require global permission
 */
function requireGlobalPermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    const requiredRoles = PERMISSIONS.GLOBAL[permission];
    if (!requiredRoles) {
      return res.status(500).json({
        error: {
          code: 'INVALID_PERMISSION',
          message: `Invalid permission: ${permission}`,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    if (!hasGlobalPermission(req.user.global_role, requiredRoles)) {
      return res.status(403).json({
        error: {
          code: 'INSUFFICIENT_GLOBAL_PERMISSIONS',
          message: `Requires one of: ${requiredRoles.join(', ')}. Current role: ${req.user.global_role}`,
          required_roles: requiredRoles,
          user_role: req.user.global_role,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    next();
  };
}

/**
 * Middleware: Require team permission
 */
function requireTeamPermission(permission, teamIdParam = 'teamId') {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    const teamId = req.params[teamIdParam] || req.body.team_id;
    if (!teamId) {
      return res.status(400).json({
        error: {
          code: 'TEAM_ID_REQUIRED',
          message: `Team ID required in parameter '${teamIdParam}' or body 'team_id'`,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    const requiredRoles = PERMISSIONS.TEAM[permission];
    if (!requiredRoles) {
      return res.status(500).json({
        error: {
          code: 'INVALID_PERMISSION',
          message: `Invalid team permission: ${permission}`,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    try {
      // Admin and Global Manager users bypass team permissions
      if (req.user.global_role === 'admin' || req.user.global_role === 'manager') {
        req.teamRole = 'leader'; // Treat admin/global manager as team leader
        return next();
      }
      
      // Get user's role in this team
      const userTeamRole = await getUserTeamRole(req.user.id, teamId);
      
      if (!userTeamRole) {
        return res.status(403).json({
          error: {
            code: 'NOT_TEAM_MEMBER',
            message: `User is not a member of team ${teamId}`,
            team_id: teamId,
            timestamp: new Date().toISOString()
          }
        });
      }
      
      if (!hasTeamPermission(userTeamRole, requiredRoles)) {
        return res.status(403).json({
          error: {
            code: 'INSUFFICIENT_TEAM_PERMISSIONS',
            message: `Requires one of: ${requiredRoles.join(', ')}. Current team role: ${userTeamRole}`,
            required_roles: requiredRoles,
            user_team_role: userTeamRole,
            team_id: teamId,
            timestamp: new Date().toISOString()
          }
        });
      }
      
      // Add team role to request for use in handlers
      req.teamRole = userTeamRole;
      next();
    } catch (error) {
      console.error('Error checking team permission:', error);
      res.status(500).json({
        error: {
          code: 'PERMISSION_CHECK_ERROR',
          message: 'Failed to check team permissions',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
}

/**
 * Middleware: Require task access (checks if user can access specific task)
 */
function requireTaskAccess(permission = 'VIEW_TASK') {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    const taskId = req.params.id || req.params.taskId;
    if (!taskId) {
      return res.status(400).json({
        error: {
          code: 'TASK_ID_REQUIRED',
          message: 'Task ID required',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    try {
      // Get task and its team
      const [tasks] = await pool.execute(`
        SELECT t.id, t.team_id, t.assigned_to, t.created_by,
               team.name as team_name
        FROM tasks t
        JOIN teams team ON t.team_id = team.id
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
      
      // Admin and Global Manager users have access to all tasks
      if (req.user.global_role === 'admin' || req.user.global_role === 'manager') {
        req.task = task;
        req.teamRole = 'leader';
        return next();
      }
      
      // Check team membership and permissions
      const userTeamRole = await getUserTeamRole(req.user.id, task.team_id);
      
      if (!userTeamRole) {
        return res.status(403).json({
          error: {
            code: 'TASK_ACCESS_DENIED',
            message: `Access denied. User is not a member of team: ${task.team_name}`,
            team_id: task.team_id,
            timestamp: new Date().toISOString()
          }
        });
      }
      
      const requiredRoles = PERMISSIONS.TEAM[permission];
      if (!hasTeamPermission(userTeamRole, requiredRoles)) {
        return res.status(403).json({
          error: {
            code: 'INSUFFICIENT_TASK_PERMISSIONS',
            message: `Insufficient permissions for task access. Requires: ${requiredRoles.join(', ')}`,
            required_roles: requiredRoles,
            user_team_role: userTeamRole,
            timestamp: new Date().toISOString()
          }
        });
      }
      
      // Add task and team role to request
      req.task = task;
      req.teamRole = userTeamRole;
      next();
    } catch (error) {
      console.error('Error checking task access:', error);
      res.status(500).json({
        error: {
          code: 'TASK_ACCESS_CHECK_ERROR',
          message: 'Failed to check task access',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
}

/**
 * Middleware: Filter data based on user permissions
 */
function filterByPermissions() {
  return async (req, res, next) => {
    if (!req.user) {
      return next();
    }
    
    try {
      // Add user's accessible teams to request
      req.userTeams = await getUserTeams(req.user.id);
      next();
    } catch (error) {
      console.error('Error getting user teams for filtering:', error);
      req.userTeams = [];
      next();
    }
  };
}

/**
 * Utility: Check if user can access team
 */
async function canAccessTeam(userId, teamId, minRole = 'viewer') {
  try {
    const userTeamRole = await getUserTeamRole(userId, teamId);
    if (!userTeamRole) return false;
    
    const userLevel = TEAM_ROLE_HIERARCHY[userTeamRole] || 0;
    const minLevel = TEAM_ROLE_HIERARCHY[minRole] || 1;
    
    return userLevel >= minLevel;
  } catch (error) {
    console.error('Error checking team access:', error);
    return false;
  }
}

/**
 * Utility: Get user's effective permissions for a team
 */
async function getUserEffectivePermissions(userId, teamId) {
  try {
    const [users] = await pool.execute('SELECT global_role FROM users WHERE id = ?', [userId]);
    if (users.length === 0) return { global: null, team: null };
    
    const globalRole = users[0].global_role;
    
    // Admin has all permissions
    if (globalRole === 'admin') {
      return {
        global: globalRole,
        team: 'leader',
        permissions: [...Object.keys(PERMISSIONS.GLOBAL), ...Object.keys(PERMISSIONS.TEAM)]
      };
    }
    
    const teamRole = await getUserTeamRole(userId, teamId);
    const permissions = [];
    
    // Add global permissions
    Object.entries(PERMISSIONS.GLOBAL).forEach(([perm, roles]) => {
      if (hasGlobalPermission(globalRole, roles)) {
        permissions.push(perm);
      }
    });
    
    // Add team permissions
    if (teamRole) {
      Object.entries(PERMISSIONS.TEAM).forEach(([perm, roles]) => {
        if (hasTeamPermission(teamRole, roles)) {
          permissions.push(perm);
        }
      });
    }
    
    return {
      global: globalRole,
      team: teamRole,
      permissions
    };
  } catch (error) {
    console.error('Error getting effective permissions:', error);
    return { global: null, team: null, permissions: [] };
  }
}

module.exports = {
  requireGlobalPermission,
  requireTeamPermission,
  requireTaskAccess,
  filterByPermissions,
  hasGlobalPermission,
  hasTeamPermission,
  getUserTeamRole,
  getUserTeams,
  canAccessTeam,
  getUserEffectivePermissions,
  PERMISSIONS,
  GLOBAL_ROLE_HIERARCHY,
  TEAM_ROLE_HIERARCHY
};