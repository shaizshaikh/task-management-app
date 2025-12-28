/**
 * Permission Utility Functions
 * Helper functions for role-based filtering and permission checks
 */

const { pool } = require('../database');
const { 
  GLOBAL_ROLE_HIERARCHY, 
  TEAM_ROLE_HIERARCHY,
  hasGlobalPermission,
  hasTeamPermission,
  getUserTeamRole 
} = require('../middleware/rbac');

/**
 * Filter tasks based on user permissions
 */
async function filterTasksByPermissions(userId, globalRole, tasks) {
  try {
    // Admin can see all tasks
    if (globalRole === 'admin') {
      return tasks;
    }
    
    // Get user's team memberships
    const [userTeams] = await pool.execute(`
      SELECT team_id, team_role 
      FROM team_members 
      WHERE user_id = ?
    `, [userId]);
    
    const userTeamMap = new Map();
    userTeams.forEach(tm => {
      userTeamMap.set(tm.team_id, tm.team_role);
    });
    
    // Filter tasks based on team membership
    return tasks.filter(task => {
      const userTeamRole = userTeamMap.get(task.team_id);
      return userTeamRole !== undefined; // User must be team member
    });
  } catch (error) {
    console.error('Error filtering tasks by permissions:', error);
    return [];
  }
}

/**
 * Filter teams based on user permissions
 */
async function filterTeamsByPermissions(userId, globalRole, teams) {
  try {
    // Admin can see all teams
    if (globalRole === 'admin') {
      return teams;
    }
    
    // Get user's team memberships
    const [userTeams] = await pool.execute(`
      SELECT team_id 
      FROM team_members 
      WHERE user_id = ?
    `, [userId]);
    
    const userTeamIds = new Set(userTeams.map(tm => tm.team_id));
    
    // Filter teams based on membership
    return teams.filter(team => userTeamIds.has(team.id));
  } catch (error) {
    console.error('Error filtering teams by permissions:', error);
    return [];
  }
}

/**
 * Filter users based on viewing permissions
 */
async function filterUsersByPermissions(userId, globalRole, users, teamId = null) {
  try {
    // Admin can see all users
    if (globalRole === 'admin') {
      return users;
    }
    
    // Manager can see users in their teams
    if (globalRole === 'manager') {
      if (teamId) {
        // Check if user is manager of this specific team
        const userTeamRole = await getUserTeamRole(userId, teamId);
        if (userTeamRole === 'manager') {
          // Get team members
          const [teamMembers] = await pool.execute(`
            SELECT user_id 
            FROM team_members 
            WHERE team_id = ?
          `, [teamId]);
          
          const teamMemberIds = new Set(teamMembers.map(tm => tm.user_id));
          return users.filter(user => teamMemberIds.has(user.id));
        }
      } else {
        // Get all teams where user is manager
        const [managedTeams] = await pool.execute(`
          SELECT DISTINCT tm2.user_id
          FROM team_members tm1
          JOIN team_members tm2 ON tm1.team_id = tm2.team_id
          WHERE tm1.user_id = ? AND tm1.team_role = 'manager'
        `, [userId]);
        
        const visibleUserIds = new Set(managedTeams.map(tm => tm.user_id));
        visibleUserIds.add(userId); // User can always see themselves
        
        return users.filter(user => visibleUserIds.has(user.id));
      }
    }
    
    // Members and viewers can only see themselves and team members
    const [userTeams] = await pool.execute(`
      SELECT DISTINCT tm2.user_id
      FROM team_members tm1
      JOIN team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = ?
    `, [userId]);
    
    const visibleUserIds = new Set(userTeams.map(tm => tm.user_id));
    visibleUserIds.add(userId); // User can always see themselves
    
    return users.filter(user => visibleUserIds.has(user.id));
  } catch (error) {
    console.error('Error filtering users by permissions:', error);
    return []; // Return empty array on error for security
  }
}

/**
 * Check if user can modify another user's data
 */
async function canModifyUser(modifierUserId, modifierGlobalRole, targetUserId) {
  try {
    // Admin can modify anyone
    if (modifierGlobalRole === 'admin') {
      return true;
    }
    
    // Users can modify themselves (limited fields)
    if (modifierUserId === targetUserId) {
      return true;
    }
    
    // Managers can modify users in their teams (limited fields)
    if (modifierGlobalRole === 'manager') {
      const [sharedTeams] = await pool.execute(`
        SELECT tm1.team_id, tm1.team_role as modifier_role, tm2.team_role as target_role
        FROM team_members tm1
        JOIN team_members tm2 ON tm1.team_id = tm2.team_id
        WHERE tm1.user_id = ? AND tm2.user_id = ? AND tm1.team_role = 'manager'
      `, [modifierUserId, targetUserId]);
      
      return sharedTeams.length > 0;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking user modification permissions:', error);
    return false;
  }
}

/**
 * Get user's assignable users for tasks (users they can assign tasks to)
 */
async function getAssignableUsers(userId, globalRole, teamId) {
  try {
    // Admin can assign to anyone in the team
    if (globalRole === 'admin') {
      const [teamMembers] = await pool.execute(`
        SELECT u.id, u.username, u.full_name, u.email, tm.team_role
        FROM users u
        JOIN team_members tm ON u.id = tm.user_id
        WHERE tm.team_id = ? AND u.is_active = TRUE
        ORDER BY u.full_name
      `, [teamId]);
      
      return teamMembers;
    }
    
    // Check if user is team manager
    const userTeamRole = await getUserTeamRole(userId, teamId);
    
    if (userTeamRole === 'manager') {
      // Managers can assign to any team member
      const [teamMembers] = await pool.execute(`
        SELECT u.id, u.username, u.full_name, u.email, tm.team_role
        FROM users u
        JOIN team_members tm ON u.id = tm.user_id
        WHERE tm.team_id = ? AND u.is_active = TRUE
        ORDER BY u.full_name
      `, [teamId]);
      
      return teamMembers;
    }
    
    // Members can only assign to themselves
    if (userTeamRole === 'member') {
      const [user] = await pool.execute(`
        SELECT u.id, u.username, u.full_name, u.email, ? as team_role
        FROM users u
        WHERE u.id = ? AND u.is_active = TRUE
      `, [userTeamRole, userId]);
      
      return user;
    }
    
    // Viewers cannot assign tasks
    return [];
  } catch (error) {
    console.error('Error getting assignable users:', error);
    return [];
  }
}

/**
 * Check if user can assign task to specific user
 */
async function canAssignTaskTo(assignerUserId, assignerGlobalRole, targetUserId, teamId) {
  try {
    // Admin can assign to anyone in the team
    if (assignerGlobalRole === 'admin') {
      const [targetInTeam] = await pool.execute(`
        SELECT 1 FROM team_members WHERE user_id = ? AND team_id = ?
      `, [targetUserId, teamId]);
      
      return targetInTeam.length > 0;
    }
    
    // Check assigner's team role
    const assignerTeamRole = await getUserTeamRole(assignerUserId, teamId);
    
    if (assignerTeamRole === 'manager') {
      // Managers can assign to any team member
      const [targetInTeam] = await pool.execute(`
        SELECT 1 FROM team_members WHERE user_id = ? AND team_id = ?
      `, [targetUserId, teamId]);
      
      return targetInTeam.length > 0;
    }
    
    if (assignerTeamRole === 'member') {
      // Members can only assign to themselves
      return assignerUserId === targetUserId;
    }
    
    // Viewers cannot assign
    return false;
  } catch (error) {
    console.error('Error checking task assignment permissions:', error);
    return false;
  }
}

/**
 * Get filtered task statistics based on user permissions
 */
async function getFilteredTaskStats(userId, globalRole) {
  try {
    let query;
    let params;
    
    if (globalRole === 'admin') {
      // Admin sees all tasks
      query = `
        SELECT 
          COUNT(*) as total_tasks,
          SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo_count,
          SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as in_progress_count,
          SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done_count,
          SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) as high_priority_count,
          SUM(CASE WHEN due_date < CURDATE() AND status != 'done' THEN 1 ELSE 0 END) as overdue_count
        FROM tasks t
        JOIN teams team ON t.team_id = team.id
        WHERE team.is_active = TRUE
      `;
      params = [];
    } else {
      // Other users see only tasks from their teams
      query = `
        SELECT 
          COUNT(*) as total_tasks,
          SUM(CASE WHEN t.status = 'todo' THEN 1 ELSE 0 END) as todo_count,
          SUM(CASE WHEN t.status = 'in-progress' THEN 1 ELSE 0 END) as in_progress_count,
          SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done_count,
          SUM(CASE WHEN t.priority = 'high' THEN 1 ELSE 0 END) as high_priority_count,
          SUM(CASE WHEN t.due_date < CURDATE() AND t.status != 'done' THEN 1 ELSE 0 END) as overdue_count
        FROM tasks t
        JOIN teams team ON t.team_id = team.id
        JOIN team_members tm ON team.id = tm.team_id
        WHERE team.is_active = TRUE AND tm.user_id = ?
      `;
      params = [userId];
    }
    
    const [stats] = await pool.execute(query, params);
    return stats[0];
  } catch (error) {
    console.error('Error getting filtered task stats:', error);
    return {
      total_tasks: 0,
      todo_count: 0,
      in_progress_count: 0,
      done_count: 0,
      high_priority_count: 0,
      overdue_count: 0
    };
  }
}

/**
 * Check if user has any management role (global manager or team manager)
 */
async function hasManagementRole(userId, globalRole) {
  try {
    if (globalRole === 'admin' || globalRole === 'manager') {
      return true;
    }
    
    // Check if user is manager of any team
    const [managerTeams] = await pool.execute(`
      SELECT 1 FROM team_members WHERE user_id = ? AND team_role = 'manager' LIMIT 1
    `, [userId]);
    
    return managerTeams.length > 0;
  } catch (error) {
    console.error('Error checking management role:', error);
    return false;
  }
}

/**
 * Get user's managed teams
 */
async function getManagedTeams(userId, globalRole) {
  try {
    if (globalRole === 'admin') {
      // Admin manages all teams
      const [allTeams] = await pool.execute(`
        SELECT id, name, description, color, created_by, is_active, created_at, updated_at
        FROM teams
        WHERE is_active = TRUE
        ORDER BY name
      `);
      return allTeams;
    }
    
    // Get teams where user is manager
    const [managedTeams] = await pool.execute(`
      SELECT t.id, t.name, t.description, t.color, t.created_by, t.is_active, t.created_at, t.updated_at
      FROM teams t
      JOIN team_members tm ON t.id = tm.team_id
      WHERE tm.user_id = ? AND tm.team_role = 'manager' AND t.is_active = TRUE
      ORDER BY t.name
    `, [userId]);
    
    return managedTeams;
  } catch (error) {
    console.error('Error getting managed teams:', error);
    return [];
  }
}

module.exports = {
  filterTasksByPermissions,
  filterTeamsByPermissions,
  filterUsersByPermissions,
  canModifyUser,
  getAssignableUsers,
  canAssignTaskTo,
  getFilteredTaskStats,
  hasManagementRole,
  getManagedTeams
};