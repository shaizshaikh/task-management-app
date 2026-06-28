/**
 * Audit Logging Middleware
 * Tracks all CRUD operations, authentication events, and system activities
 */

const { pool } = require('../database');

/**
 * Audit logger service
 */
class AuditLogger {
  /**
   * Log a general operation
   */
  static async logOperation(userId, action, resourceType, resourceId, oldValues, newValues, req) {
    try {
      const ipAddress = req?.ip || req?.connection?.remoteAddress || 'unknown';
      const userAgent = req?.get('User-Agent') || 'unknown';

      await pool.execute(`
        INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userId,
        action,
        resourceType,
        resourceId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress,
        userAgent
      ]);

      console.log(`[AUDIT] ${action} on ${resourceType}:${resourceId} by user:${userId}`);
    } catch (error) {
      console.error('Failed to log audit entry:', error);
      // Don't throw - audit logging shouldn't break the main operation
    }
  }

  /**
   * Log authentication events
   */
  static async logAuthentication(userId, username, action, success, errorMessage, req) {
    try {
      const ipAddress = req?.ip || req?.connection?.remoteAddress || 'unknown';
      const userAgent = req?.get('User-Agent') || 'unknown';

      await pool.execute(`
        INSERT INTO authentication_logs (user_id, username, action, ip_address, user_agent, success, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        userId,
        username,
        action,
        ipAddress,
        userAgent,
        success,
        errorMessage
      ]);

      console.log(`[AUTH AUDIT] ${action} for ${username} - ${success ? 'SUCCESS' : 'FAILED'}`);
    } catch (error) {
      console.error('Failed to log authentication event:', error);
    }
  }

  /**
   * Log system events
   */
  static async logSystemEvent(eventType, description, severity = 'info', metadata = null) {
    try {
      await pool.execute(`
        INSERT INTO system_events (event_type, description, severity, metadata)
        VALUES (?, ?, ?, ?)
      `, [
        eventType,
        description,
        severity,
        metadata ? JSON.stringify(metadata) : null
      ]);

      console.log(`[SYSTEM AUDIT] ${eventType} - ${severity.toUpperCase()}: ${description}`);
    } catch (error) {
      console.error('Failed to log system event:', error);
    }
  }
}

/**
 * Middleware to audit CRUD operations
 * Captures before/after state for database operations
 */
const auditCRUD = (resourceType) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    const originalJson = res.json;
    
    // Store original data for comparison
    req.auditData = {
      resourceType,
      action: getActionFromMethod(req.method, req.route?.path),
      resourceId: req.params.id || null,
      oldValues: null,
      startTime: Date.now(),
      logged: false // Flag to prevent duplicate logging
    };

    // Capture old values for UPDATE and DELETE operations
    if ((req.method === 'PUT' || req.method === 'DELETE') && req.params.id) {
      try {
        req.auditData.oldValues = await getResourceData(resourceType, req.params.id);
      } catch (error) {
        console.warn('Could not capture old values for audit:', error.message);
      }
    }

    // Override response methods to capture new values
    res.send = function(data) {
      captureAuditData(req, res, data);
      return originalSend.call(this, data);
    };

    res.json = function(data) {
      captureAuditData(req, res, data);
      return originalJson.call(this, data);
    };

    next();
  };
};

/**
 * Capture audit data from response
 */
async function captureAuditData(req, res, responseData) {
  if (!req.user || !req.auditData) return;
  
  // Prevent duplicate logging (res.json calls res.send internally)
  if (req.auditData.logged) return;
  req.auditData.logged = true;

  try {
    const { resourceType, action, resourceId, oldValues } = req.auditData;
    
    // Only log successful operations (2xx status codes)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      let newValues = null;
      let finalResourceId = resourceId;

      // Parse response data
      let parsedData = responseData;
      if (typeof responseData === 'string') {
        try {
          parsedData = JSON.parse(responseData);
        } catch (e) {
          parsedData = { response: responseData };
        }
      }

      // Extract new values and resource ID from response
      if (parsedData) {
        // For CREATE operations, get the new resource ID
        if (action === 'CREATE' && parsedData.id) {
          finalResourceId = parsedData.id;
        }

        // Capture relevant data based on resource type
        newValues = extractRelevantData(parsedData, resourceType);
      }

      // Log the operation
      await AuditLogger.logOperation(
        req.user.id,
        action,
        resourceType,
        finalResourceId,
        oldValues,
        newValues,
        req
      );
    }
  } catch (error) {
    console.error('Error capturing audit data:', error);
  }
}

/**
 * Get action name from HTTP method and route
 */
function getActionFromMethod(method, routePath) {
  const methodMap = {
    'POST': 'CREATE',
    'GET': 'READ',
    'PUT': 'UPDATE',
    'PATCH': 'UPDATE',
    'DELETE': 'DELETE'
  };

  let action = methodMap[method] || method;

  // Add more specific actions based on route patterns
  if (routePath) {
    if (routePath.includes('/members')) action += '_MEMBER';
    if (routePath.includes('/role')) action += '_ROLE';
    if (routePath.includes('/comments')) action += '_COMMENT';
    if (routePath.includes('/attachments')) action += '_ATTACHMENT';
  }

  return action;
}

/**
 * Get existing resource data for comparison
 */
async function getResourceData(resourceType, resourceId) {
  try {
    let query, table;
    
    switch (resourceType) {
      case 'task':
        table = 'tasks';
        query = 'SELECT * FROM tasks WHERE id = ?';
        break;
      case 'team':
        table = 'teams';
        query = 'SELECT * FROM teams WHERE id = ?';
        break;
      case 'user':
        table = 'users';
        query = 'SELECT id, username, email, full_name, global_role, is_active FROM users WHERE id = ?';
        break;
      case 'comment':
        table = 'task_comments';
        query = 'SELECT * FROM task_comments WHERE id = ?';
        break;
      case 'attachment':
        table = 'task_attachments';
        query = 'SELECT * FROM task_attachments WHERE id = ?';
        break;
      default:
        return null;
    }

    const [rows] = await pool.execute(query, [resourceId]);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.warn(`Could not fetch ${resourceType} data for audit:`, error.message);
    return null;
  }
}

/**
 * Extract relevant data from response for audit logging
 */
function extractRelevantData(data, resourceType) {
  if (!data) return null;

  // Remove sensitive information and keep only relevant fields
  const sensitiveFields = ['password', 'token', 'secret', 'key'];
  
  const cleanData = JSON.parse(JSON.stringify(data));
  
  // Remove sensitive fields recursively
  function removeSensitiveFields(obj) {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    for (const key in obj) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        removeSensitiveFields(obj[key]);
      }
    }
    return obj;
  }

  return removeSensitiveFields(cleanData);
}

/**
 * Middleware to audit authentication events
 */
const auditAuth = async (req, res, next) => {
  const originalSend = res.send;
  const originalJson = res.json;
  
  // Override response methods to capture auth results
  res.send = function(data) {
    captureAuthAudit(req, res, data);
    return originalSend.call(this, data);
  };

  res.json = function(data) {
    captureAuthAudit(req, res, data);
    return originalJson.call(this, data);
  };

  next();
};

/**
 * Capture authentication audit data
 */
async function captureAuthAudit(req, res, responseData) {
  try {
    const isSuccess = res.statusCode >= 200 && res.statusCode < 300;
    let action = 'unknown';
    let username = 'unknown';
    let userId = null;
    let errorMessage = null;

    // Determine action from route
    if (req.route?.path?.includes('login')) action = 'login';
    else if (req.route?.path?.includes('logout')) action = 'logout';
    else if (req.route?.path?.includes('refresh')) action = 'token_refresh';
    else if (req.route?.path?.includes('verify')) action = 'token_verify';

    // Extract user info
    if (req.user) {
      userId = req.user.id;
      username = req.user.username;
    } else if (req.body?.username) {
      username = req.body.username;
    }

    // Extract error message for failed attempts
    if (!isSuccess) {
      action = action === 'login' ? 'failed_login' : 'failed_' + action;
      
      let parsedData = responseData;
      if (typeof responseData === 'string') {
        try {
          parsedData = JSON.parse(responseData);
        } catch (e) {
          parsedData = { error: responseData };
        }
      }
      
      errorMessage = parsedData?.error?.message || parsedData?.message || 'Authentication failed';
    }

    await AuditLogger.logAuthentication(userId, username, action, isSuccess, errorMessage, req);
  } catch (error) {
    console.error('Error capturing auth audit:', error);
  }
}

/**
 * Middleware to audit unauthorized access attempts
 */
const auditUnauthorized = async (req, res, next) => {
  const originalStatus = res.status;
  
  res.status = function(statusCode) {
    if (statusCode === 401 || statusCode === 403) {
      // Log unauthorized access attempt
      setImmediate(async () => {
        try {
          await AuditLogger.logAuthentication(
            req.user?.id || null,
            req.user?.username || 'anonymous',
            'unauthorized_access',
            false,
            `Attempted to access ${req.method} ${req.originalUrl}`,
            req
          );
        } catch (error) {
          console.error('Error logging unauthorized access:', error);
        }
      });
    }
    return originalStatus.call(this, statusCode);
  };

  next();
};

module.exports = {
  AuditLogger,
  auditCRUD,
  auditAuth,
  auditUnauthorized
};