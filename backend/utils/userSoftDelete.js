/**
 * User Soft Delete Utilities
 * Helper functions for managing soft-deleted users
 */

const { pool } = require('../database');

class UserSoftDeleteService {
  /**
   * Soft delete a user (mark as deleted without removing from database)
   */
  async softDeleteUser(userId, deletedByUserId, reason = null) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Check if user exists and is not already deleted
      const [userCheck] = await connection.execute(
        'SELECT id, username, email, full_name, global_role, keycloak_user_id FROM users WHERE id = ? AND deleted_at IS NULL',
        [userId]
      );
      
      if (userCheck.length === 0) {
        throw new Error('User not found or already deleted');
      }
      
      const user = userCheck[0];
      
      // Mark user as deleted
      await connection.execute(
        'UPDATE users SET deleted_at = NOW(), deleted_by = ?, is_active = FALSE WHERE id = ?',
        [deletedByUserId, userId]
      );
      
      // Create deletion log entry (check for existing entry first)
      const [existingLog] = await connection.execute(
        'SELECT id FROM user_deletion_log WHERE deleted_user_id = ? AND admin_user_id = ?',
        [userId, deletedByUserId]
      );
      
      if (existingLog.length === 0) {
        // Only insert if no existing log entry
        await connection.execute(
          `INSERT INTO user_deletion_log 
           (deleted_user_id, deleted_username, deleted_email, deleted_full_name, deleted_global_role, keycloak_user_id, admin_user_id, deletion_reason, tasks_reassigned_count, tasks_unassigned_count, team_memberships_removed, keycloak_deletion_success, sessions_revoked_count, deletion_status, deleted_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, FALSE, 0, 'completed', NOW())`,
          [userId, user.username, user.email, user.full_name, user.global_role, user.keycloak_user_id, deletedByUserId, reason]
        );
      } else {
        console.log(`Deletion log entry already exists for user ${userId}, skipping insertion`);
      }
      
      await connection.commit();
      
      return {
        success: true,
        deletedUser: user
      };
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Restore a soft-deleted user
   */
  async restoreUser(userId, restoredByUserId) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Check if user exists and is deleted - get full user data
      const [userCheck] = await connection.execute(
        'SELECT id, username, email, full_name, global_role, keycloak_user_id FROM users WHERE id = ? AND deleted_at IS NOT NULL',
        [userId]
      );
      
      if (userCheck.length === 0) {
        throw new Error('User not found or not deleted');
      }
      
      const user = userCheck[0];
      
      // Restore user in local database
      await connection.execute(
        'UPDATE users SET deleted_at = NULL, deleted_by = NULL, is_active = TRUE WHERE id = ?',
        [userId]
      );
      
      // Recreate user in Keycloak
      const keycloakAdmin = require('../services/keycloakAdmin');
      
      try {
        // Check if user still exists in Keycloak (might have been deleted)
        let keycloakUser = null;
        try {
          keycloakUser = await keycloakAdmin.getUserById(user.keycloak_user_id);
        } catch (kcError) {
          // User doesn't exist in Keycloak, need to recreate
          console.log(`User ${user.username} not found in Keycloak, recreating...`);
        }
        
        // Generate new password for restored user
        const newPassword = keycloakAdmin.generateSecurePassword(12);
        
        if (!keycloakUser) {
          // Recreate user in Keycloak with new password
          const newKeycloakUser = await keycloakAdmin.createUser({
            username: user.username,
            email: user.email,
            firstName: user.full_name ? user.full_name.split(' ')[0] : user.username,
            lastName: user.full_name ? user.full_name.split(' ').slice(1).join(' ') : '',
            enabled: true,
            emailVerified: false,
            credentials: [{
              type: 'password',
              value: newPassword,
              temporary: true // Force password change on first login
            }]
          });
          
          // Update keycloak_user_id if it changed
          if (newKeycloakUser.id !== user.keycloak_user_id) {
            await connection.execute(
              'UPDATE users SET keycloak_user_id = ? WHERE id = ?',
              [newKeycloakUser.id, userId]
            );
            user.keycloak_user_id = newKeycloakUser.id;
          }
          
          console.log(`User ${user.username} recreated in Keycloak with ID: ${newKeycloakUser.id}`);
        } else {
          // User exists in Keycloak, enable them and set new password
          await keycloakAdmin.updateUser(user.keycloak_user_id, {
            enabled: true
          });
          
          // Set new password
          await keycloakAdmin.setUserPassword(user.keycloak_user_id, newPassword, true);
          console.log(`User ${user.username} re-enabled in Keycloak with new password`);
        }
        
        // Add password to user object for email notification
        user.newPassword = newPassword;
        user.temporaryPassword = true;
        
      } catch (keycloakError) {
        console.error('Error restoring user in Keycloak:', keycloakError);
        // Don't fail the entire operation, but log the error
        // The user will be restored in the local database but may need manual Keycloak setup
      }
      
      await connection.commit();
      
      return {
        success: true,
        restoredUser: user
      };
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get all soft-deleted users
   */
  async getDeletedUsers(limit = 50, offset = 0) {
    try {
      // Ensure parameters are integers
      const limitInt = parseInt(limit) || 50;
      const offsetInt = parseInt(offset) || 0;
      
      // Get unique deleted users with their latest deletion log entry
      const [users] = await pool.execute(
        `SELECT DISTINCT
           u.id,
           u.username,
           u.email,
           u.full_name,
           u.global_role,
           u.deleted_at,
           deleter.username as deleted_by_username,
           deleter.full_name as deleted_by_name,
           latest_log.deletion_reason,
           latest_log.tasks_reassigned_count,
           latest_log.tasks_unassigned_count,
           latest_log.team_memberships_removed
         FROM users u
         LEFT JOIN users deleter ON u.deleted_by = deleter.id
         LEFT JOIN (
           SELECT udl.*,
                  ROW_NUMBER() OVER (PARTITION BY deleted_user_id ORDER BY deleted_at DESC) as rn
           FROM user_deletion_log udl
         ) latest_log ON u.id = latest_log.deleted_user_id AND latest_log.rn = 1
         WHERE u.deleted_at IS NOT NULL
         ORDER BY u.deleted_at DESC
         LIMIT ${limitInt} OFFSET ${offsetInt}`
      );
      
      const [countResult] = await pool.execute(
        'SELECT COUNT(DISTINCT id) as total FROM users WHERE deleted_at IS NOT NULL'
      );
      
      return {
        users,
        total: countResult[0].total,
        limit: limitInt,
        offset: offsetInt
      };
      
    } catch (error) {
      throw new Error(`Failed to get deleted users: ${error.message}`);
    }
  }

  /**
   * Get active users (not soft-deleted)
   */
  async getActiveUsers(limit = 50, offset = 0) {
    try {
      const [users] = await pool.execute(
        `SELECT 
           id,
           keycloak_user_id,
           username,
           email,
           full_name,
           global_role,
           avatar_url,
           is_active,
           created_at,
           updated_at
         FROM users 
         WHERE is_active = TRUE AND deleted_at IS NULL
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );
      
      const [countResult] = await pool.execute(
        'SELECT COUNT(*) as total FROM users WHERE is_active = TRUE AND deleted_at IS NULL'
      );
      
      return {
        users,
        total: countResult[0].total,
        limit,
        offset
      };
      
    } catch (error) {
      throw new Error(`Failed to get active users: ${error.message}`);
    }
  }

  /**
   * Check if user is soft-deleted
   */
  async isUserDeleted(userId) {
    try {
      const [result] = await pool.execute(
        'SELECT deleted_at FROM users WHERE id = ?',
        [userId]
      );
      
      if (result.length === 0) {
        throw new Error('User not found');
      }
      
      return result[0].deleted_at !== null;
      
    } catch (error) {
      throw new Error(`Failed to check user deletion status: ${error.message}`);
    }
  }

  /**
   * Reassign tasks from deleted user to another user or unassign them
   */
  async reassignUserTasks(deletedUserId, newAssigneeId = null) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Get count of tasks to reassign
      const [taskCount] = await connection.execute(
        'SELECT COUNT(*) as count FROM tasks WHERE assigned_to = ?',
        [deletedUserId]
      );
      
      const tasksToReassign = taskCount[0].count;
      
      if (tasksToReassign > 0) {
        if (newAssigneeId) {
          // Reassign to specific user
          await connection.execute(
            'UPDATE tasks SET assigned_to = ? WHERE assigned_to = ?',
            [newAssigneeId, deletedUserId]
          );
        } else {
          // Unassign tasks
          await connection.execute(
            'UPDATE tasks SET assigned_to = NULL WHERE assigned_to = ?',
            [deletedUserId]
          );
        }
      }
      
      await connection.commit();
      
      return {
        tasksReassigned: tasksToReassign,
        newAssigneeId: newAssigneeId
      };
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Remove user from all teams
   */
  async removeUserFromTeams(userId) {
    try {
      // Get count of team memberships
      const [membershipCount] = await pool.execute(
        'SELECT COUNT(*) as count FROM team_members WHERE user_id = ?',
        [userId]
      );
      
      const membershipsToRemove = membershipCount[0].count;
      
      if (membershipsToRemove > 0) {
        // Remove from all teams
        await pool.execute(
          'DELETE FROM team_members WHERE user_id = ?',
          [userId]
        );
      }
      
      return {
        membershipsRemoved: membershipsToRemove
      };
      
    } catch (error) {
      throw new Error(`Failed to remove user from teams: ${error.message}`);
    }
  }

  /**
   * Get user deletion statistics
   */
  async getDeletionStats(days = 30) {
    try {
      const [stats] = await pool.execute(
        `SELECT 
           COUNT(*) as total_deletions,
           COUNT(CASE WHEN deleted_at >= DATE_SUB(NOW(), INTERVAL ? DAY) THEN 1 END) as recent_deletions
         FROM users
         WHERE deleted_at IS NOT NULL`,
        [days]
      );
      
      const [recentByDay] = await pool.execute(
        `SELECT 
           DATE(deleted_at) as deletion_date,
           COUNT(*) as deletions_count
         FROM users
         WHERE deleted_at IS NOT NULL AND deleted_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         GROUP BY DATE(deleted_at)
         ORDER BY deletion_date DESC`,
        [days]
      );
      
      return {
        summary: stats[0],
        dailyBreakdown: recentByDay
      };
      
    } catch (error) {
      throw new Error(`Failed to get deletion statistics: ${error.message}`);
    }
  }
}

// Export singleton instance
module.exports = new UserSoftDeleteService();