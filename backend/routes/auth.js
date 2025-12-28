/**
 * Authentication Routes
 * Handles authentication-related endpoints
 */

const express = require('express');
const { authenticateJWT, optionalAuth } = require('../middleware/auth');
const { auditAuth } = require('../middleware/audit');
const userSyncService = require('../services/userSync');
const router = express.Router();

// Apply audit middleware to all auth routes
router.use(auditAuth);

/**
 * GET /api/auth/me
 * Get current user information
 */
router.get('/me', authenticateJWT, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user.id,
        keycloak_user_id: req.user.keycloak_user_id,
        username: req.user.username,
        email: req.user.email,
        full_name: req.user.full_name,
        global_role: req.user.global_role,
        email_verified: req.user.email_verified,
        is_active: req.user.db_user.is_active,
        created_at: req.user.db_user.created_at,
        updated_at: req.user.db_user.updated_at
      },
      token_info: {
        issued_at: req.user.token_issued_at,
        expires_at: req.user.token_expires_at,
        realm_roles: req.user.realm_roles,
        client_roles: req.user.client_roles
      }
    });
  } catch (error) {
    console.error('Error getting user info:', error);
    res.status(500).json({
      error: {
        code: 'USER_INFO_ERROR',
        message: 'Failed to retrieve user information',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/auth/verify
 * Verify JWT token validity
 */
router.get('/verify', authenticateJWT, (req, res) => {
  res.json({
    valid: true,
    user: {
      username: req.user.username,
      global_role: req.user.global_role
    },
    message: 'Token is valid'
  });
});

/**
 * POST /api/auth/sync
 * Force sync current user from Keycloak
 */
router.post('/sync', authenticateJWT, async (req, res) => {
  try {
    const syncedUser = await userSyncService.syncUserFromToken(req.token);
    
    res.json({
      message: 'User synchronized successfully',
      user: {
        id: syncedUser.id,
        username: syncedUser.username,
        email: syncedUser.email,
        global_role: syncedUser.global_role,
        updated_at: syncedUser.updated_at
      }
    });
  } catch (error) {
    console.error('Error syncing user:', error);
    res.status(500).json({
      error: {
        code: 'USER_SYNC_ERROR',
        message: 'Failed to synchronize user',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/auth/status
 * Get authentication status (optional auth)
 */
router.get('/status', optionalAuth, (req, res) => {
  if (req.user) {
    res.json({
      authenticated: true,
      user: {
        username: req.user.username,
        global_role: req.user.global_role
      }
    });
  } else {
    res.json({
      authenticated: false,
      message: 'No valid token provided'
    });
  }
});

module.exports = router;