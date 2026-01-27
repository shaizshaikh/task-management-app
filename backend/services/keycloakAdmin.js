/**
 * Keycloak Admin API Service
 * Handles administrative operations with Keycloak
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const keycloakConfig = require('../config/keycloak');

class KeycloakAdminService {
  constructor() {
    this.adminToken = null;
    this.tokenExpiry = null;
    this.baseUrl = keycloakConfig.keycloak['auth-server-url'];
    this.realm = keycloakConfig.keycloak.realm;
    
    // Admin credentials from environment
    this.adminUsername = process.env.KEYCLOAK_ADMIN_USERNAME || 'admin';
    this.adminPassword = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';
    this.adminClientId = process.env.KEYCLOAK_ADMIN_CLIENT_ID || 'admin-cli';
  }

  /**
   * Make HTTP request using Node.js built-in modules with timeout handling
   */
  async makeHttpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const client = isHttps ? https : http;
      
      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: options.timeout || 120000 // 2 minutes default timeout
      };

      const req = client.request(requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const result = {
              status: res.statusCode,
              statusText: res.statusMessage,
              ok: res.statusCode >= 200 && res.statusCode < 300,
              headers: res.headers,
              data: data
            };
            
            // Try to parse JSON if content-type suggests it
            const contentType = res.headers['content-type'] || '';
            if (contentType.includes('application/json') && data) {
              try {
                result.json = JSON.parse(data);
              } catch (e) {
                // Not valid JSON, keep as string
              }
            }
            
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    });
  }

  /**
   * Get admin access token
   */
  async getAdminToken() {
    try {
      // Check if current token is still valid
      if (this.adminToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.adminToken;
      }

      console.log('Getting new Keycloak admin token...');
      
      const body = new URLSearchParams({
        grant_type: 'password',
        client_id: this.adminClientId,
        username: this.adminUsername,
        password: this.adminPassword
      }).toString();

      const response = await this.makeHttpRequest(
        `${this.baseUrl}/auth/realms/master/protocol/openid-connect/token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: body
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = response.json;
      this.adminToken = data.access_token;
      // Set expiry to 90% of actual expiry to refresh before it expires
      this.tokenExpiry = Date.now() + (data.expires_in * 900);
      
      console.log('Keycloak admin token obtained successfully');
      return this.adminToken;
    } catch (error) {
      console.error('Error getting Keycloak admin token:', error.message);
      throw new Error('Failed to authenticate with Keycloak admin API');
    }
  }

  /**
   * Make authenticated request to Keycloak Admin API with configurable timeout
   */
  async makeAdminRequest(method, endpoint, data = null, options = {}) {
    try {
      const token = await this.getAdminToken();
      
      const config = {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: options.timeout || 60000 // Default 1 minute, configurable
      };

      if (data) {
        config.body = JSON.stringify(data);
      }

      const response = await this.makeHttpRequest(`${this.baseUrl}/auth/admin/realms/${this.realm}${endpoint}`, config);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.data}`);
      }

      // Some endpoints return empty responses (like DELETE)
      if (response.json) {
        return response.json;
      }
      return null;
    } catch (error) {
      console.error(`Keycloak Admin API error (${method} ${endpoint}):`, error.message);
      throw error;
    }
  }

  /**
   * Create user in Keycloak with configurable timeout
   */
  async createUser(userInfo, options = {}) {
    try {
      const userData = {
        username: userInfo.username,
        email: userInfo.email,
        firstName: userInfo.firstName || userInfo.full_name?.split(' ')[0] || '',
        lastName: userInfo.lastName || userInfo.full_name?.split(' ').slice(1).join(' ') || '',
        enabled: true,
        emailVerified: true, // Set to true since we handle email verification separately
        credentials: userInfo.password ? [{
          type: 'password',
          value: userInfo.password,
          temporary: userInfo.temporaryPassword || false
        }] : []
      };

      console.log(`Creating user in Keycloak: ${userInfo.username}`);
      
      // Create user with extended timeout if specified
      await this.makeAdminRequest('POST', '/users', userData, options);
      
      // Get the created user to get their ID
      const users = await this.makeAdminRequest('GET', `/users?username=${userInfo.username}`, null, options);
      if (users.length === 0) {
        throw new Error('User created but not found');
      }
      
      const keycloakUser = users[0];
      
      // Assign role if specified
      if (userInfo.global_role) {
        await this.assignUserRole(keycloakUser.id, userInfo.global_role);
      }
      
      console.log(`User created in Keycloak: ${userInfo.username} (ID: ${keycloakUser.id})`);
      return keycloakUser;
    } catch (error) {
      console.error('Error creating user in Keycloak:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Update user in Keycloak
   */
  async updateUser(keycloakUserId, userInfo) {
    try {
      const userData = {
        email: userInfo.email,
        firstName: userInfo.firstName || userInfo.full_name?.split(' ')[0] || '',
        lastName: userInfo.lastName || userInfo.full_name?.split(' ').slice(1).join(' ') || '',
        enabled: userInfo.enabled !== undefined ? userInfo.enabled : true
      };

      console.log(`Updating user in Keycloak: ${keycloakUserId}`);
      await this.makeAdminRequest('PUT', `/users/${keycloakUserId}`, userData);
      
      console.log(`User updated in Keycloak: ${keycloakUserId}`);
      return true;
    } catch (error) {
      console.error('Error updating user in Keycloak:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get user from Keycloak
   */
  async getUser(keycloakUserId) {
    try {
      return await this.makeAdminRequest('GET', `/users/${keycloakUserId}`);
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get all users from Keycloak
   */
  async getAllUsers() {
    try {
      return await this.makeAdminRequest('GET', '/users');
    } catch (error) {
      console.error('Error getting all users from Keycloak:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Assign role to user in Keycloak
   */
  async assignUserRole(keycloakUserId, roleName) {
    try {
      // Get available realm roles
      const realmRoles = await this.makeAdminRequest('GET', '/roles');
      const role = realmRoles.find(r => r.name === roleName);
      
      if (!role) {
        console.warn(`Role '${roleName}' not found in Keycloak, skipping role assignment`);
        return false;
      }

      // Remove existing roles first
      const currentRoles = await this.makeAdminRequest('GET', `/users/${keycloakUserId}/role-mappings/realm`);
      if (currentRoles.length > 0) {
        await this.makeAdminRequest('DELETE', `/users/${keycloakUserId}/role-mappings/realm`, currentRoles);
      }

      // Assign new role
      await this.makeAdminRequest('POST', `/users/${keycloakUserId}/role-mappings/realm`, [role]);
      
      console.log(`Role '${roleName}' assigned to user ${keycloakUserId} in Keycloak`);
      return true;
    } catch (error) {
      console.error('Error assigning role in Keycloak:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Delete user from Keycloak with session revocation
   */
  async deleteUser(keycloakUserId) {
    try {
      console.log(`Starting user deletion process for Keycloak user: ${keycloakUserId}`);
      
      // First, get user info for logging
      let userInfo = null;
      try {
        userInfo = await this.makeAdminRequest('GET', `/users/${keycloakUserId}`);
      } catch (error) {
        if (error.message.includes('404')) {
          throw new Error('User not found in Keycloak');
        }
        console.warn('Could not retrieve user info before deletion:', error.message);
      }
      
      // Revoke all active sessions for the user
      try {
        await this.revokeUserSessions(keycloakUserId);
      } catch (error) {
        console.warn('Could not revoke user sessions:', error.message);
        // Continue with deletion even if session revocation fails
      }
      
      // Delete the user
      await this.makeAdminRequest('DELETE', `/users/${keycloakUserId}`);
      
      const username = userInfo ? userInfo.username : keycloakUserId;
      console.log(`User successfully deleted from Keycloak: ${username} (${keycloakUserId})`);
      
      return {
        success: true,
        keycloakUserId: keycloakUserId,
        username: username,
        sessionsRevoked: true
      };
    } catch (error) {
      console.error('Error deleting user from Keycloak:', error.message);
      
      // Provide more specific error messages
      if (error.message.includes('404')) {
        throw new Error('User not found in Keycloak');
      } else if (error.message.includes('403')) {
        throw new Error('Insufficient permissions to delete user in Keycloak');
      } else if (error.message.includes('409')) {
        throw new Error('User cannot be deleted due to existing dependencies in Keycloak');
      }
      
      throw new Error(`Failed to delete user from Keycloak: ${error.message}`);
    }
  }

  /**
   * Revoke all active sessions for a user
   */
  async revokeUserSessions(keycloakUserId) {
    try {
      console.log(`Revoking active sessions for user: ${keycloakUserId}`);
      
      // Get user sessions
      const sessions = await this.makeAdminRequest('GET', `/users/${keycloakUserId}/sessions`);
      
      if (sessions && sessions.length > 0) {
        console.log(`Found ${sessions.length} active sessions for user ${keycloakUserId}`);
        
        // Revoke each session
        for (const session of sessions) {
          try {
            await this.makeAdminRequest('DELETE', `/sessions/${session.id}`);
          } catch (sessionError) {
            console.warn(`Failed to revoke session ${session.id}:`, sessionError.message);
          }
        }
        
        console.log(`Revoked ${sessions.length} sessions for user ${keycloakUserId}`);
        return sessions.length;
      } else {
        console.log(`No active sessions found for user ${keycloakUserId}`);
        return 0;
      }
    } catch (error) {
      console.error('Error revoking user sessions:', error.message);
      throw new Error(`Failed to revoke user sessions: ${error.message}`);
    }
  }

  /**
   * Check if user exists in Keycloak
   */
  async userExists(keycloakUserId) {
    try {
      const user = await this.makeAdminRequest('GET', `/users/${keycloakUserId}`);
      return user !== null;
    } catch (error) {
      if (error.message.includes('404')) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Enable/disable user in Keycloak
   */
  async setUserEnabled(keycloakUserId, enabled) {
    try {
      await this.makeAdminRequest('PUT', `/users/${keycloakUserId}`, { enabled });
      console.log(`User ${keycloakUserId} ${enabled ? 'enabled' : 'disabled'} in Keycloak`);
      return true;
    } catch (error) {
      console.error('Error updating user status in Keycloak:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Set user password
   */
  async setUserPassword(keycloakUserId, password, temporary = true) {
    try {
      const credentials = {
        type: 'password',
        value: password,
        temporary: temporary
      };

      await this.makeAdminRequest('PUT', `/users/${keycloakUserId}/reset-password`, credentials);
      console.log(`Password ${temporary ? '(temporary)' : ''} set for user ${keycloakUserId} in Keycloak`);
      return true;
    } catch (error) {
      console.error('Error setting user password in Keycloak:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Sync users from Keycloak to local database
   */
  async syncUsersFromKeycloak() {
    try {
      console.log('Starting user sync from Keycloak...');
      
      const keycloakUsers = await this.getAllUsers();
      const syncResults = {
        total: keycloakUsers.length,
        created: 0,
        updated: 0,
        errors: []
      };

      for (const kcUser of keycloakUsers) {
        try {
          // Get user roles
          const userRoles = await this.makeAdminRequest('GET', `/users/${kcUser.id}/role-mappings/realm`);
          const globalRole = this.mapKeycloakRoleToLocal(userRoles);

          const userInfo = {
            keycloak_user_id: kcUser.id,
            username: kcUser.username,
            email: kcUser.email,
            full_name: `${kcUser.firstName || ''} ${kcUser.lastName || ''}`.trim() || kcUser.username,
            global_role: globalRole,
            enabled: kcUser.enabled
          };

          // Use existing sync service
          const userSyncService = require('./userSync');
          await userSyncService.syncUser(userInfo);
          
          syncResults.updated++;
        } catch (error) {
          console.error(`Error syncing user ${kcUser.username}:`, error.message);
          syncResults.errors.push({
            username: kcUser.username,
            error: error.message
          });
        }
      }

      console.log('User sync completed:', syncResults);
      return syncResults;
    } catch (error) {
      console.error('Error syncing users from Keycloak:', error.message);
      throw error;
    }
  }

  /**
   * Map Keycloak roles to local roles
   */
  mapKeycloakRoleToLocal(keycloakRoles) {
    const roleNames = keycloakRoles.map(role => role.name);
    
    // Priority order: admin > manager > member > viewer
    if (roleNames.includes('admin')) return 'admin';
    if (roleNames.includes('manager')) return 'manager';
    if (roleNames.includes('member')) return 'member';
    if (roleNames.includes('viewer')) return 'viewer';
    
    // Default role
    return 'member';
  }

  /**
   * Get user sessions
   */
  async getUserSessions(keycloakUserId) {
    try {
      return await this.makeAdminRequest('GET', `/users/${keycloakUserId}/sessions`);
    } catch (error) {
      console.error('Error getting user sessions:', error.message);
      throw error;
    }
  }

  /**
   * Generate secure random password
   */
  generateSecurePassword(length = 12) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    // Ensure at least one character from each category
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*';
    
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Bulk create users in Keycloak with extended timeout
   */
  async createUsers(usersArray) {
    const results = {
      successful: [],
      failed: [],
      total: usersArray.length
    };

    console.log(`Starting bulk user creation for ${usersArray.length} users`);

    for (let i = 0; i < usersArray.length; i++) {
      const userInfo = usersArray[i];
      
      try {
        // Generate password if not provided
        if (!userInfo.password) {
          userInfo.password = this.generateSecurePassword();
          userInfo.temporaryPassword = true;
        }

        // Create user in Keycloak with extended timeout for bulk operations
        const keycloakUser = await this.createUser(userInfo, { timeout: 300000 }); // 5 minutes per user
        
        results.successful.push({
          index: i + 1,
          username: userInfo.username,
          email: userInfo.email,
          keycloakUserId: keycloakUser.id,
          password: userInfo.password,
          temporaryPassword: userInfo.temporaryPassword || false
        });

        console.log(`User created: ${userInfo.username} (${i + 1}/${usersArray.length})`);
        
      } catch (error) {
        console.error(`Failed to create user ${userInfo.username}:`, error.message);
        
        results.failed.push({
          index: i + 1,
          username: userInfo.username,
          email: userInfo.email,
          error: error.message,
          details: userInfo
        });
      }
    }

    console.log(`Bulk user creation completed: ${results.successful.length} successful, ${results.failed.length} failed`);
    return results;
  }

  /**
   * Export all users with comprehensive data
   */
  async exportAllUsers() {
    try {
      console.log('Starting comprehensive user export from Keycloak...');
      
      const keycloakUsers = await this.getAllUsers();
      const exportData = [];

      for (const kcUser of keycloakUsers) {
        try {
          // Get user roles
          const userRoles = await this.makeAdminRequest('GET', `/users/${kcUser.id}/role-mappings/realm`);
          
          // Get user groups
          const userGroups = await this.makeAdminRequest('GET', `/users/${kcUser.id}/groups`);
          
          // Get user sessions (for last login info)
          let lastLogin = null;
          try {
            const sessions = await this.makeAdminRequest('GET', `/users/${kcUser.id}/sessions`);
            if (sessions && sessions.length > 0) {
              // Find the most recent session
              const recentSession = sessions.reduce((latest, session) => {
                return new Date(session.lastAccess) > new Date(latest.lastAccess) ? session : latest;
              });
              lastLogin = recentSession.lastAccess;
            }
          } catch (sessionError) {
            // Sessions endpoint might not be available or user has no sessions
            console.warn(`Could not get sessions for user ${kcUser.username}:`, sessionError.message);
          }

          const userData = {
            id: kcUser.id,
            username: kcUser.username,
            email: kcUser.email || '',
            firstName: kcUser.firstName || '',
            lastName: kcUser.lastName || '',
            role: this.mapKeycloakRoleToLocal(userRoles),
            groups: userGroups.map(group => group.name),
            createdAt: kcUser.createdTimestamp ? new Date(kcUser.createdTimestamp).toISOString() : '',
            lastLogin: lastLogin,
            enabled: kcUser.enabled
          };

          exportData.push(userData);
          
        } catch (userError) {
          console.error(`Error exporting user ${kcUser.username}:`, userError.message);
          
          // Add user with basic info even if detailed info fails
          exportData.push({
            id: kcUser.id,
            username: kcUser.username,
            email: kcUser.email || '',
            firstName: kcUser.firstName || '',
            lastName: kcUser.lastName || '',
            role: 'member', // Default role
            groups: [],
            createdAt: kcUser.createdTimestamp ? new Date(kcUser.createdTimestamp).toISOString() : '',
            lastLogin: null,
            enabled: kcUser.enabled,
            exportError: userError.message
          });
        }
      }

      console.log(`User export completed: ${exportData.length} users exported`);
      return exportData;
      
    } catch (error) {
      console.error('Error exporting users from Keycloak:', error.message);
      throw new Error(`Failed to export users: ${error.message}`);
    }
  }

  /**
   * Test connection to Keycloak Admin API
   */
  async testConnection() {
    try {
      await this.getAdminToken();
      const serverInfo = await this.makeAdminRequest('GET', '');
      console.log('Keycloak Admin API connection successful');
      return {
        success: true,
        realm: serverInfo.realm,
        message: 'Connection successful'
      };
    } catch (error) {
      console.error('Keycloak Admin API connection failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
module.exports = new KeycloakAdminService();