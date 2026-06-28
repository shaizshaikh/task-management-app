/**
 * RBAC-Aware Real-Time Notification Service
 * Intelligent WebSocket broadcasting based on user roles and team memberships
 */

const { pool } = require('../database');

class RealtimeService {
  constructor(io) {
    this.io = io;
    this.connectedUsers = new Map(); // socketId -> userInfo
    this.userSockets = new Map(); // userId -> Set of socketIds
    this.teamRooms = new Map(); // teamId -> Set of socketIds
    this.roleRooms = new Map(); // role -> Set of socketIds
  }

  /**
   * Handle user connection with authentication
   */
  async handleConnection(socket, userToken) {
    try {
      // Extract user info from token (you'll need to implement token verification)
      const userInfo = await this.verifyUserToken(userToken);
      if (!userInfo) {
        socket.disconnect();
        return;
      }

      // Store user connection info
      this.connectedUsers.set(socket.id, userInfo);
      
      // Add to user sockets map
      if (!this.userSockets.has(userInfo.id)) {
        this.userSockets.set(userInfo.id, new Set());
      }
      this.userSockets.get(userInfo.id).add(socket.id);

      // Join role-based rooms
      await this.joinRoleRooms(socket, userInfo);
      
      // Join team-based rooms
      await this.joinTeamRooms(socket, userInfo);

      console.log(`User ${userInfo.username} (${userInfo.global_role}) connected: ${socket.id}`);
      console.log(`[DEBUG] User ${userInfo.username} joined rooms:`, Array.from(socket.rooms));
      
      // Send welcome message with user's notification scope
      socket.emit('connectionEstablished', {
        message: 'Connected to real-time notifications',
        scope: await this.getUserNotificationScope(userInfo),
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Connection handling error:', error);
      socket.disconnect();
    }
  }

  /**
   * Handle user disconnection
   */
  handleDisconnection(socket) {
    const userInfo = this.connectedUsers.get(socket.id);
    if (userInfo) {
      // Remove from user sockets
      const userSocketSet = this.userSockets.get(userInfo.id);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);
        if (userSocketSet.size === 0) {
          this.userSockets.delete(userInfo.id);
        }
      }

      // Remove from team rooms
      this.teamRooms.forEach((sockets, teamId) => {
        sockets.delete(socket.id);
      });

      // Remove from role rooms
      this.roleRooms.forEach((sockets, role) => {
        sockets.delete(socket.id);
      });

      this.connectedUsers.delete(socket.id);
      console.log(`User ${userInfo.username} disconnected: ${socket.id}`);
    }
  }

  /**
   * Join user to appropriate role-based rooms
   */
  async joinRoleRooms(socket, userInfo) {
    const role = userInfo.global_role;
    
    // Join global role room
    socket.join(`role:${role}`);
    if (!this.roleRooms.has(role)) {
      this.roleRooms.set(role, new Set());
    }
    this.roleRooms.get(role).add(socket.id);

    // Admins and global managers join special rooms
    if (role === 'admin') {
      socket.join('role:system-admin');
    }
    if (role === 'manager') {
      socket.join('role:global-manager');
    }
  }

  /**
   * Join user to team-based rooms based on their team memberships
   */
  async joinTeamRooms(socket, userInfo) {
    try {
      // Get user's team memberships
      const [teams] = await pool.execute(`
        SELECT tm.team_id, tm.team_role, t.name as team_name
        FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        WHERE tm.user_id = ? AND t.is_active = TRUE
      `, [userInfo.id]);

      for (const team of teams) {
        // Join team room
        const teamRoom = `team:${team.team_id}`;
        socket.join(teamRoom);
        
        if (!this.teamRooms.has(team.team_id)) {
          this.teamRooms.set(team.team_id, new Set());
        }
        this.teamRooms.get(team.team_id).add(socket.id);

        // Join team role room (for team-specific role notifications)
        const teamRoleRoom = `team:${team.team_id}:${team.team_role}`;
        socket.join(teamRoleRoom);

        console.log(`User ${userInfo.username} joined team ${team.team_name} as ${team.team_role}`);
      }
    } catch (error) {
      console.error('Error joining team rooms:', error);
    }
  }

  /**
   * Get user's notification scope for debugging
   */
  async getUserNotificationScope(userInfo) {
    const scope = {
      global_role: userInfo.global_role,
      teams: [],
      notification_types: []
    };

    // Get team memberships
    try {
      const [teams] = await pool.execute(`
        SELECT tm.team_id, tm.team_role, t.name as team_name
        FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        WHERE tm.user_id = ? AND t.is_active = TRUE
      `, [userInfo.id]);

      scope.teams = teams.map(t => ({
        id: t.team_id,
        name: t.team_name,
        role: t.team_role
      }));
    } catch (error) {
      console.error('Error getting user scope:', error);
    }

    // Define notification types based on role
    if (userInfo.global_role === 'admin') {
      scope.notification_types = ['system', 'all_tasks', 'all_teams', 'all_users', 'audit'];
    } else if (userInfo.global_role === 'manager') {
      scope.notification_types = ['system', 'all_tasks', 'all_teams', 'all_users'];
    } else {
      scope.notification_types = ['team_tasks', 'team_updates', 'personal_assignments'];
    }

    return scope;
  }

  /**
   * Broadcast task creation with RBAC filtering
   */
  async broadcastTaskCreated(task, creatorInfo) {
    const notification = {
      type: 'taskCreated',
      task,
      creator: {
        id: creatorInfo.id,
        username: creatorInfo.username,
        name: creatorInfo.name
      },
      timestamp: new Date().toISOString()
    };

    // Broadcast to different audiences
    await this.broadcastToTaskAudience(task, notification, 'taskCreated');
  }

  /**
   * Broadcast task update with RBAC filtering
   */
  async broadcastTaskUpdated(task, updaterInfo, changes = {}, previousData = null) {
    const notification = {
      type: 'taskUpdated',
      task,
      updater: {
        id: updaterInfo.id,
        username: updaterInfo.username,
        name: updaterInfo.name
      },
      changes,
      previousData,
      timestamp: new Date().toISOString()
    };

    await this.broadcastToTaskAudience(task, notification, 'taskUpdated');
  }

  /**
   * Broadcast task deletion with RBAC filtering
   */
  async broadcastTaskDeleted(taskInfo, deleterInfo) {
    const notification = {
      type: 'taskDeleted',
      task: taskInfo,
      deleter: {
        id: deleterInfo.id,
        username: deleterInfo.username,
        name: deleterInfo.name
      },
      timestamp: new Date().toISOString()
    };

    await this.broadcastToTaskAudience(taskInfo, notification, 'taskDeleted');
  }

  /**
   * Broadcast to appropriate audience based on task and user roles
   */
  async broadcastToTaskAudience(task, notification, eventType) {
    // Create a single notification with unique ID for deduplication
    const baseNotification = {
      ...notification,
      event_id: `${eventType}-${task.id}-${Date.now()}`,
      task_id: task.id,
      team_id: task.team_id
    };

    // Broadcast to all relevant rooms at once to prevent duplicates
    const rooms = new Set();
    
    // Add admin room
    rooms.add('role:admin');
    
    // Add global manager room
    rooms.add('role:manager');
    
    // Add team room
    if (task.team_id) {
      rooms.add(`team:${task.team_id}`);
    }

    // Debug: Log current connections
    console.log(`[DEBUG] Broadcasting ${eventType} for task "${task.title}"`);
    console.log(`[DEBUG] Connected users: ${this.connectedUsers.size}`);
    console.log(`[DEBUG] Target rooms: ${Array.from(rooms).join(', ')}`);
    
    // Log users in each room
    rooms.forEach(room => {
      const socketsInRoom = this.io.sockets.adapter.rooms.get(room);
      console.log(`[DEBUG] Room ${room}: ${socketsInRoom ? socketsInRoom.size : 0} users`);
    });

    // Broadcast to all rooms
    rooms.forEach(room => {
      this.io.to(room).emit(eventType, baseNotification);
      console.log(`[DEBUG] Sent ${eventType} to room: ${room}`);
    });

    // Send personal notification to assigned user
    if (task.assigned_to) {
      this.broadcastToUser(task.assigned_to, eventType, {
        ...baseNotification,
        personal: true,
        relevance: 'personal_assignment'
      });
    }

    console.log(`Broadcasted ${eventType} for task "${task.title}" to ${rooms.size} rooms`);
  }

  /**
   * Determine who should receive notifications about a task
   */
  async determineTaskAudience(task) {
    const audiences = [];

    // Admins see everything
    audiences.push({
      type: 'admin',
      relevance: 'system_oversight'
    });

    // Global managers see everything
    audiences.push({
      type: 'global_manager',
      relevance: 'management_oversight'
    });

    // Team members see tasks in their teams
    audiences.push({
      type: 'team_members',
      relevance: 'team_collaboration'
    });

    // Team managers get special notifications
    audiences.push({
      type: 'team_managers',
      relevance: 'team_management'
    });

    // Assigned user gets personal notification
    if (task.assigned_to) {
      audiences.push({
        type: 'assigned_user',
        relevance: 'personal_assignment'
      });
    }

    return audiences;
  }

  /**
   * Broadcast to specific user (all their connected sessions)
   */
  broadcastToUser(userId, eventType, notification) {
    const userSocketSet = this.userSockets.get(userId);
    if (userSocketSet) {
      userSocketSet.forEach(socketId => {
        this.io.to(socketId).emit(eventType, notification);
      });
    }
  }

  /**
   * Broadcast team-related notifications
   */
  async broadcastTeamUpdate(teamId, updateType, data, updaterInfo) {
    const notification = {
      type: 'teamUpdated',
      updateType,
      team_id: teamId,
      data,
      updater: {
        id: updaterInfo.id,
        username: updaterInfo.username
      },
      timestamp: new Date().toISOString()
    };

    // Broadcast to team members
    this.io.to(`team:${teamId}`).emit('teamUpdated', notification);
    
    // Broadcast to admins and global managers
    this.io.to('role:admin').emit('teamUpdated', notification);
    this.io.to('role:manager').emit('teamUpdated', notification);

    console.log(`Broadcasted team update (${updateType}) for team ${teamId}`);
  }

  /**
   * Broadcast user-related notifications
   */
  async broadcastUserUpdate(updateType, userData, updaterInfo) {
    const notification = {
      type: 'userUpdated',
      updateType,
      user: userData,
      updater: {
        id: updaterInfo.id,
        username: updaterInfo.username
      },
      timestamp: new Date().toISOString()
    };

    // Broadcast to admins and global managers
    this.io.to('role:admin').emit('userUpdated', notification);
    this.io.to('role:manager').emit('userUpdated', notification);

    // If user is being added/removed from teams, notify those teams
    if (updateType === 'team_membership_changed' && userData.affected_teams) {
      userData.affected_teams.forEach(teamId => {
        this.io.to(`team:${teamId}`).emit('teamMembershipUpdated', notification);
      });
    }

    console.log(`Broadcasted user update (${updateType}) for user ${userData.username || userData.id}`);
  }

  /**
   * Broadcast system-wide notifications (admin only)
   */
  broadcastSystemNotification(message, level = 'info', data = {}) {
    const notification = {
      type: 'systemNotification',
      message,
      level,
      data,
      timestamp: new Date().toISOString()
    };

    // Only admins receive system notifications
    this.io.to('role:admin').emit('system_notification', notification);
    
    console.log(`System notification (${level}): ${message}`);
  }

  /**
   * Get real-time statistics about connected users
   */
  getConnectionStats() {
    const stats = {
      total_connections: this.connectedUsers.size,
      unique_users: this.userSockets.size,
      teams_with_active_users: this.teamRooms.size,
      roles: {}
    };

    // Count users by role
    this.connectedUsers.forEach(userInfo => {
      const role = userInfo.global_role;
      stats.roles[role] = (stats.roles[role] || 0) + 1;
    });

    return stats;
  }

  /**
   * Verify user token - simplified for testing
   * In production, implement proper JWT verification with Keycloak
   */
  async verifyUserToken(token) {
    try {
      if (!token) {
        return null;
      }

      // For testing purposes, we'll decode the token payload (without verification)
      // In production, use proper JWT verification with Keycloak public key
      
      try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        const username = payload.preferred_username || payload.sub;
        
        console.log(`[DEBUG] Token decoded for user: ${username}`);
        
        if (username) {
          // Get user info from database
          const [users] = await pool.execute(`
            SELECT u.id, u.username, u.full_name, u.global_role, u.email
            FROM users u 
            WHERE u.username = ? AND u.is_active = TRUE
          `, [username]);

          if (users.length > 0) {
            const user = users[0];
            console.log(`[DEBUG] User authenticated: ${user.username} (${user.global_role})`);
            return {
              id: user.id,
              username: user.username,
              name: user.full_name || user.username,
              global_role: user.global_role,
              email: user.email
            };
          } else {
            console.log(`[DEBUG] User not found in database: ${username}`);
          }
        }
      } catch (decodeError) {
        console.log('[DEBUG] Token decode failed:', decodeError.message);
      }

      // No fallback - require proper authentication
      console.log('Token verification failed - no valid user found');
      return null;
    } catch (error) {
      console.error('Token verification failed:', error);
      return null;
    }
  }
}

module.exports = RealtimeService;