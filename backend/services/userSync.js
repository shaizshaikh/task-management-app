/**
 * User Synchronization Service
 * Handles syncing users from Keycloak to local database
 */

const { pool } = require('../database');
const keycloakConfig = require('../config/keycloak');
const { extractUserInfo } = require('../utils/userUtils');

class UserSyncService {
  constructor() {
    this.syncInProgress = false;
    this.lastSyncTime = null;
  }

  /**
   * Sync or create user from JWT token
   */
  async syncUserFromToken(decodedToken) {
    try {
      const userInfo = extractUserInfo(decodedToken);
      return await this.syncUser(userInfo);
    } catch (error) {
      console.error('Error syncing user from token:', error);
      throw error;
    }
  }

  /**
   * Sync or create user in database
   */
  async syncUser(userInfo) {
    try {
      // Check if user exists by keycloak_user_id first
      let [existingUsers] = await pool.execute(
        'SELECT * FROM users WHERE keycloak_user_id = ?',
        [userInfo.keycloak_user_id]
      );

      if (existingUsers.length > 0) {
        // Update existing user
        return await this.updateUser(existingUsers[0].id, userInfo);
      }

      // If not found by keycloak_user_id, check by username or email (fallback for changed IDs)
      [existingUsers] = await pool.execute(
        'SELECT * FROM users WHERE username = ? OR email = ?',
        [userInfo.username, userInfo.email]
      );

      if (existingUsers.length > 0) {
        // Update existing user with new keycloak_user_id
        console.log(`Updating user ${userInfo.username} with new Keycloak ID: ${userInfo.keycloak_user_id}`);
        return await this.updateUser(existingUsers[0].id, userInfo);
      } else {
        // Create new user
        return await this.createUser(userInfo);
      }
    } catch (error) {
      console.error('Error syncing user:', error);
      throw error;
    }
  }

  /**
   * Create new user in database
   */
  async createUser(userInfo) {
    try {
      const [result] = await pool.execute(`
        INSERT INTO users (keycloak_user_id, username, email, full_name, global_role, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, TRUE, NOW(), NOW())
      `, [
        userInfo.keycloak_user_id,
        userInfo.username,
        userInfo.email,
        userInfo.full_name,
        userInfo.global_role
      ]);

      console.log(`Created new user: ${userInfo.username} (ID: ${result.insertId})`);
      
      // Return the created user
      const [newUser] = await pool.execute('SELECT * FROM users WHERE id = ?', [result.insertId]);
      return newUser[0];
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Update existing user in database
   */
  async updateUser(userId, userInfo) {
    try {
      // Check for role changes before updating
      const roleChange = await this.checkRoleChange(userId, userInfo.global_role);
      
      await pool.execute(`
        UPDATE users 
        SET keycloak_user_id = ?, username = ?, email = ?, full_name = ?, global_role = ?, is_active = TRUE, updated_at = NOW()
        WHERE id = ?
      `, [
        userInfo.keycloak_user_id,
        userInfo.username,
        userInfo.email,
        userInfo.full_name,
        userInfo.global_role,
        userId
      ]);

      if (roleChange.changed) {
        console.log(`Updated user: ${userInfo.username} (ID: ${userId}) - Role changed: ${roleChange.oldRole} -> ${roleChange.newRole}`);
      } else {
        console.log(`Updated user: ${userInfo.username} (ID: ${userId})`);
      }
      
      // Return the updated user
      const [updatedUser] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
      return updatedUser[0];
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  /**
   * Deactivate user (when removed from Keycloak)
   */
  async deactivateUser(keycloakUserId) {
    try {
      const [result] = await pool.execute(`
        UPDATE users 
        SET is_active = FALSE, updated_at = NOW()
        WHERE keycloak_user_id = ?
      `, [keycloakUserId]);

      if (result.affectedRows > 0) {
        console.log(`Deactivated user: ${keycloakUserId}`);
        return true;
      } else {
        console.log(`User not found for deactivation: ${keycloakUserId}`);
        return false;
      }
    } catch (error) {
      console.error('Error deactivating user:', error);
      throw error;
    }
  }

  /**
   * Reactivate user (when re-added to Keycloak)
   */
  async reactivateUser(keycloakUserId) {
    try {
      const [result] = await pool.execute(`
        UPDATE users 
        SET is_active = TRUE, updated_at = NOW()
        WHERE keycloak_user_id = ?
      `, [keycloakUserId]);

      if (result.affectedRows > 0) {
        console.log(`Reactivated user: ${keycloakUserId}`);
        return true;
      } else {
        console.log(`User not found for reactivation: ${keycloakUserId}`);
        return false;
      }
    } catch (error) {
      console.error('Error reactivating user:', error);
      throw error;
    }
  }

  /**
   * Get user by Keycloak ID
   */
  async getUserByKeycloakId(keycloakUserId) {
    try {
      const [users] = await pool.execute(
        'SELECT * FROM users WHERE keycloak_user_id = ? AND is_active = TRUE',
        [keycloakUserId]
      );
      return users[0] || null;
    } catch (error) {
      console.error('Error getting user by Keycloak ID:', error);
      throw error;
    }
  }

  /**
   * Get or create user from token (used in middleware)
   */
  async getOrCreateUserFromToken(decodedToken) {
    try {
      const userInfo = extractUserInfo(decodedToken);
      
      // Use the improved syncUser method that handles username/email fallback
      return await this.syncUser(userInfo);
    } catch (error) {
      console.error('Error getting or creating user from token:', error);
      throw error;
    }
  }

  /**
   * Get all active users
   */
  async getAllActiveUsers() {
    try {
      const [users] = await pool.execute(
        'SELECT * FROM users WHERE is_active = TRUE ORDER BY username'
      );
      return users;
    } catch (error) {
      console.error('Error getting all active users:', error);
      throw error;
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats() {
    try {
      const [stats] = await pool.execute(`
        SELECT 
          COUNT(*) as total_users,
          SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) as active_users,
          SUM(CASE WHEN is_active = FALSE THEN 1 ELSE 0 END) as inactive_users,
          SUM(CASE WHEN global_role = 'admin' THEN 1 ELSE 0 END) as admin_count,
          SUM(CASE WHEN global_role = 'manager' THEN 1 ELSE 0 END) as manager_count,
          SUM(CASE WHEN global_role = 'member' THEN 1 ELSE 0 END) as member_count,
          SUM(CASE WHEN global_role = 'viewer' THEN 1 ELSE 0 END) as viewer_count
        FROM users
      `);
      return stats[0];
    } catch (error) {
      console.error('Error getting user statistics:', error);
      throw error;
    }
  }

  /**
   * Check if user role has changed and log it
   */
  async checkRoleChange(userId, newRole) {
    try {
      const [currentUser] = await pool.execute(
        'SELECT global_role FROM users WHERE id = ?',
        [userId]
      );
      
      if (currentUser.length > 0 && currentUser[0].global_role !== newRole) {
        console.log(`Role change detected for user ${userId}: ${currentUser[0].global_role} -> ${newRole}`);
        return {
          changed: true,
          oldRole: currentUser[0].global_role,
          newRole: newRole
        };
      }
      
      return { changed: false };
    } catch (error) {
      console.error('Error checking role change:', error);
      return { changed: false };
    }
  }
  /**
   * Clean up orphaned users that exist in database but not in Keycloak
   * This handles the case where Keycloak data is lost but database persists
   */
  async cleanupOrphanedUsers() {
    try {
      console.log('🧹 Starting orphaned user cleanup...');
      
      // Get all active users from database
      const [dbUsers] = await pool.execute(
        'SELECT id, keycloak_user_id, username, email FROM users WHERE is_active = true'
      );

      if (dbUsers.length === 0) {
        console.log('No users found in database');
        return { cleaned: 0, errors: [] };
      }

      const keycloakAdmin = await keycloakConfig.getKeycloakAdminClient();
      const errors = [];
      let cleanedCount = 0;

      for (const dbUser of dbUsers) {
        try {
          // Check if user exists in Keycloak
          const keycloakUser = await keycloakAdmin.users.findOne({
            id: dbUser.keycloak_user_id
          });

          if (!keycloakUser) {
            // User doesn't exist in Keycloak, mark as inactive
            await pool.execute(
              'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = ?',
              [dbUser.id]
            );
            
            console.log(`🗑️ Deactivated orphaned user: ${dbUser.username} (${dbUser.email})`);
            cleanedCount++;
          }
        } catch (error) {
          console.error(`Error checking user ${dbUser.username}:`, error.message);
          errors.push({ user: dbUser.username, error: error.message });
        }
      }

      console.log(`✅ Cleanup complete: ${cleanedCount} orphaned users deactivated`);
      return { cleaned: cleanedCount, errors };

    } catch (error) {
      console.error('Error during orphaned user cleanup:', error);
      throw error;
    }
  }

  /**
   * Perform full sync between Keycloak and database
   * This should be run periodically or after system restarts
   */
  async performFullSync() {
    if (this.syncInProgress) {
      console.log('Sync already in progress, skipping...');
      return;
    }

    try {
      this.syncInProgress = true;
      console.log('🔄 Starting full user synchronization...');

      // First, clean up orphaned users
      await this.cleanupOrphanedUsers();

      // Then sync all Keycloak users to database
      const keycloakAdmin = await keycloakConfig.getKeycloakAdminClient();
      const keycloakUsers = await keycloakAdmin.users.find();

      let syncedCount = 0;
      const errors = [];

      for (const kcUser of keycloakUsers) {
        try {
          const userInfo = {
            keycloak_user_id: kcUser.id,
            username: kcUser.username,
            email: kcUser.email,
            full_name: `${kcUser.firstName || ''} ${kcUser.lastName || ''}`.trim(),
            global_role: this.extractGlobalRole(kcUser),
            is_active: kcUser.enabled
          };

          await this.syncUser(userInfo);
          syncedCount++;
        } catch (error) {
          console.error(`Error syncing user ${kcUser.username}:`, error.message);
          errors.push({ user: kcUser.username, error: error.message });
        }
      }

      this.lastSyncTime = new Date();
      console.log(`✅ Full sync complete: ${syncedCount} users synchronized`);
      
      return { synced: syncedCount, errors };

    } catch (error) {
      console.error('Error during full sync:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Extract global role from Keycloak user
   */
  extractGlobalRole(keycloakUser) {
    // This should match your role extraction logic
    const roles = keycloakUser.realmRoles || [];
    
    if (roles.includes('admin')) return 'admin';
    if (roles.includes('manager')) return 'manager';
    if (roles.includes('member')) return 'member';
    return 'viewer';
  }
}

// Export singleton instance
module.exports = new UserSyncService();