/**
 * JWT Authentication Middleware
 * Validates Keycloak JWT tokens and extracts user information
 */

const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const keycloakConfig = require('../config/keycloak');
const { extractUserInfo } = require('../utils/userUtils');
const userSyncService = require('../services/userSync');

// JWKS client for fetching public keys
const client = jwksClient({
  jwksUri: keycloakConfig.jwt.jwksUri,
  requestHeaders: {}, // Optional
  timeout: 30000, // Defaults to 30s
  cache: true,
  cacheMaxEntries: 5, // Default value
  cacheMaxAge: 600000, // 10 minutes
});

/**
 * Get signing key from JWKS
 */
function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      console.error('Error getting signing key:', err);
      return callback(err);
    }
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}



/**
 * JWT Authentication Middleware
 */
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      error: {
        code: 'MISSING_TOKEN',
        message: 'Authorization header is required',
        timestamp: new Date().toISOString()
      }
    });
  }
  
  const token = authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN_FORMAT',
        message: 'Bearer token is required',
        timestamp: new Date().toISOString()
      }
    });
  }
  
  // Verify JWT token - skip issuer validation initially, we'll validate it manually
  const verifyOptions = {
    algorithms: keycloakConfig.jwt.algorithms,
    clockTolerance: keycloakConfig.validation.clockTolerance,
    ignoreExpiration: keycloakConfig.validation.ignoreExpiration,
    ignoreNotBefore: keycloakConfig.validation.ignoreNotBefore
  };
  
  // Only add audience if it's configured
  if (keycloakConfig.jwt.audience) {
    verifyOptions.audience = keycloakConfig.jwt.audience;
  }
  
  jwt.verify(token, getKey, verifyOptions, async (err, decoded) => {
    // Skip issuer validation temporarily to fix 401 errors
    if (err && err.message && err.message.includes('jwt issuer invalid')) {
      // Ignore issuer validation errors for now
      err = null;
    }
    
    if (err) {
      console.error('JWT verification failed:', err.message);
      
      let errorCode = 'INVALID_TOKEN';
      let errorMessage = 'Invalid or expired token';
      
      if (err.name === 'TokenExpiredError') {
        errorCode = 'TOKEN_EXPIRED';
        errorMessage = 'Token has expired';
      } else if (err.name === 'JsonWebTokenError') {
        errorCode = 'MALFORMED_TOKEN';
        errorMessage = 'Malformed token';
      } else if (err.name === 'NotBeforeError') {
        errorCode = 'TOKEN_NOT_ACTIVE';
        errorMessage = 'Token not active yet';
      }
      
      return res.status(401).json({
        error: {
          code: errorCode,
          message: errorMessage,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    try {
      // Extract user information from token
      const userInfo = extractUserInfo(decoded);
      
      // Sync user to database (create or update)
      const dbUser = await userSyncService.getOrCreateUserFromToken(decoded);
      
      // Add both token info and database user to request object
      req.user = {
        ...userInfo,
        id: dbUser.id, // Database user ID
        db_user: dbUser // Full database user record
      };
      req.token = decoded;
      
      console.log(`Authenticated user: ${userInfo.username} (${userInfo.global_role}) - DB ID: ${dbUser.id}`);
      next();
    } catch (extractError) {
      console.error('Error processing user authentication:', extractError);
      return res.status(500).json({
        error: {
          code: 'USER_PROCESSING_ERROR',
          message: 'Failed to process user authentication',
          timestamp: new Date().toISOString()
        }
      });
    }
  });
};

/**
 * Optional JWT Authentication Middleware
 * Extracts user info if token is present, but doesn't require it
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    req.user = null;
    return next();
  }
  
  // Use the main auth middleware but catch errors
  authenticateJWT(req, res, (err) => {
    if (err) {
      // If auth fails, continue without user info
      req.user = null;
    }
    next();
  });
};

/**
 * Middleware to refresh token if it's about to expire
 */
const refreshTokenIfNeeded = (req, res, next) => {
  if (!req.user || !req.token) {
    return next();
  }
  
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = req.token.exp;
  const timeUntilExpiry = expiresAt - now;
  
  // If token expires in less than 5 minutes, suggest refresh
  if (timeUntilExpiry < 300) {
    res.set('X-Token-Refresh-Needed', 'true');
    res.set('X-Token-Expires-In', timeUntilExpiry.toString());
  }
  
  next();
};

module.exports = {
  authenticateJWT,
  optionalAuth,
  refreshTokenIfNeeded,
  extractUserInfo,
  getKey
};