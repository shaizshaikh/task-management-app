/**
 * Audit Routes - Professional Version
 * Handles audit log viewing, filtering, and export
 */

const express = require('express');
const { pool } = require('../database');
const { authenticateJWT } = require('../middleware/auth');


const router = express.Router();

/**
 * GET /api/audit
 * Get audit logs with advanced filtering and pagination
 */
router.get('/', authenticateJWT, async (req, res) => {
  try {
    console.log('=== AUDIT ENDPOINT REACHED ===');
    console.log('User:', req.user.username, 'Role:', req.user.global_role);
    
    // Check if user is admin (restrict audit logs to admins only)
    if (req.user.global_role !== 'admin') {
      console.log('User lacks admin permissions for audit logs');
      return res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin role required to view audit logs',
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log('User has management permissions, proceeding...');

    // Parse query parameters with proper filtering
    const filters = {
      action: req.query.action,
      resource_type: req.query.resource_type,
      resource_id: req.query.resource_id ? parseInt(req.query.resource_id) : null,
      user_id: req.query.user_id ? parseInt(req.query.user_id) : null,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      limit: Math.min(parseInt(req.query.limit) || 50, 500),
      offset: Math.max(parseInt(req.query.offset) || 0, 0),
      sort_by: req.query.sort_by || 'timestamp',
      sort_order: req.query.sort_order === 'asc' ? 'ASC' : 'DESC'
    };

    console.log('Filters applied:', filters);

    // Build dynamic query
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];

    // Apply filters
    if (filters.action) {
      query += ' AND action LIKE ?';
      params.push(`%${filters.action}%`);
    }

    if (filters.resource_type) {
      query += ' AND resource_type = ?';
      params.push(filters.resource_type);
    }

    if (filters.resource_id) {
      query += ' AND resource_id = ?';
      params.push(filters.resource_id);
    }

    if (filters.user_id) {
      query += ' AND user_id = ?';
      params.push(filters.user_id);
    }

    if (filters.start_date) {
      query += ' AND timestamp >= ?';
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ' AND timestamp <= ?';
      params.push(filters.end_date);
    }

    // Non-admin users can only see logs related to their teams or their own actions
    if (req.user.global_role !== 'admin') {
      query += ` AND (
        user_id = ? OR 
        (resource_type = 'team' AND resource_id IN (
          SELECT team_id FROM team_members WHERE user_id = ?
        )) OR
        (resource_type = 'task' AND resource_id IN (
          SELECT t.id FROM tasks t 
          JOIN team_members tm ON t.team_id = tm.team_id 
          WHERE tm.user_id = ?
        ))
      )`;
      params.push(req.user.id, req.user.id, req.user.id);
    }

    // Sorting
    const validSortFields = ['timestamp', 'action', 'resource_type', 'user_id'];
    const sortField = validSortFields.includes(filters.sort_by) ? filters.sort_by : 'timestamp';
    query += ` ORDER BY ${sortField} ${filters.sort_order}`;

    // Get total count for pagination (separate query to avoid parameter issues)
    let countQuery = query.replace('SELECT * FROM', 'SELECT COUNT(*) as total FROM');
    console.log('Count query:', countQuery);
    console.log('Count parameters:', params);
    
    const [countResult] = await pool.execute(countQuery, params);
    const total = countResult[0].total;

    // Add pagination using string interpolation to avoid parameter issues
    query += ` LIMIT ${filters.limit} OFFSET ${filters.offset}`;

    console.log('Final query:', query);
    console.log('Parameters:', params);

    // Execute main query (no additional parameters for LIMIT/OFFSET)
    const [logs] = await pool.execute(query, params);
    
    console.log('Query executed successfully, found', logs.length, 'logs out of', total, 'total');

    // Format response with enhanced data
    const formattedLogs = logs.map(log => ({
      ...log,
      // Parse JSON fields safely
      old_values: log.old_values ? (typeof log.old_values === 'string' ? JSON.parse(log.old_values) : log.old_values) : null,
      new_values: log.new_values ? (typeof log.new_values === 'string' ? JSON.parse(log.new_values) : log.new_values) : null,
      // Add computed fields for frontend
      log_type: 'operation', // Default type since audit_logs doesn't have this field
      username: null, // We could join with users table if needed
      full_name: null,
      success: true, // Default success since audit_logs doesn't track failures
      error_message: null,
      severity: 'info'
    }));

    res.json({
      logs: formattedLogs,
      pagination: {
        total,
        limit: filters.limit,
        offset: filters.offset,
        has_more: filters.offset + filters.limit < total
      },
      filters_applied: Object.keys(filters).filter(key => filters[key] !== null && filters[key] !== undefined && filters[key] !== ''),
      filtered: req.user.global_role !== 'admin'
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    console.error('Error details:', error.message);
    res.status(500).json({
      error: {
        code: 'AUDIT_FETCH_ERROR',
        message: 'Failed to fetch audit logs',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/audit/stats
 * Get audit statistics for dashboard
 */
router.get('/stats', authenticateJWT, async (req, res) => {
  try {
    console.log('=== AUDIT STATS ENDPOINT REACHED ===');
    
    // Check if user is admin (restrict audit stats to admins only)
    if (req.user.global_role !== 'admin') {
      return res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin role required to view audit statistics',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Simple stats query
    const [totalCount] = await pool.execute('SELECT COUNT(*) as total FROM audit_logs');
    const [recentCount] = await pool.execute('SELECT COUNT(*) as recent FROM audit_logs WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
    
    // Mock daily activity for the last 7 days
    const dailyActivity = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dailyActivity.push({
        date: date.toISOString().split('T')[0],
        total_events: Math.floor(Math.random() * 20) + 5, // Random for now
        operations: Math.floor(Math.random() * 15) + 3,
        auth_events: Math.floor(Math.random() * 8) + 1,
        system_events: Math.floor(Math.random() * 5) + 1
      });
    }

    res.json({
      statistics: {
        total_events: totalCount[0].total,
        recent_events: recentCount[0].recent,
        daily_activity: dailyActivity
      },
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching audit statistics:', error);
    res.status(500).json({
      error: {
        code: 'AUDIT_STATS_ERROR',
        message: 'Failed to fetch audit statistics',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/audit/export
 * Export audit logs as CSV with filtering
 */
router.get('/export', authenticateJWT, async (req, res) => {
  try {
    console.log('=== AUDIT EXPORT ENDPOINT REACHED ===');
    
    // Check if user is admin (restrict audit export to admins only)
    if (req.user.global_role !== 'admin') {
      return res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin role required to export audit logs',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Use same filtering logic as main endpoint but without pagination
    const filters = {
      action: req.query.action,
      resource_type: req.query.resource_type,
      resource_id: req.query.resource_id ? parseInt(req.query.resource_id) : null,
      user_id: req.query.user_id ? parseInt(req.query.user_id) : null,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      sort_by: req.query.sort_by || 'timestamp',
      sort_order: req.query.sort_order === 'asc' ? 'ASC' : 'DESC'
    };

    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];

    // Apply same filters as main endpoint
    if (filters.action) {
      query += ' AND action LIKE ?';
      params.push(`%${filters.action}%`);
    }

    if (filters.resource_type) {
      query += ' AND resource_type = ?';
      params.push(filters.resource_type);
    }

    if (filters.resource_id) {
      query += ' AND resource_id = ?';
      params.push(filters.resource_id);
    }

    if (filters.user_id) {
      query += ' AND user_id = ?';
      params.push(filters.user_id);
    }

    if (filters.start_date) {
      query += ' AND timestamp >= ?';
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ' AND timestamp <= ?';
      params.push(filters.end_date);
    }

    // Apply same RBAC filtering
    if (req.user.global_role !== 'admin') {
      query += ` AND (
        user_id = ? OR 
        (resource_type = 'team' AND resource_id IN (
          SELECT team_id FROM team_members WHERE user_id = ?
        )) OR
        (resource_type = 'task' AND resource_id IN (
          SELECT t.id FROM tasks t 
          JOIN team_members tm ON t.team_id = tm.team_id 
          WHERE tm.user_id = ?
        ))
      )`;
      params.push(req.user.id, req.user.id, req.user.id);
    }

    // Sorting
    const validSortFields = ['timestamp', 'action', 'resource_type', 'user_id'];
    const sortField = validSortFields.includes(filters.sort_by) ? filters.sort_by : 'timestamp';
    query += ` ORDER BY ${sortField} ${filters.sort_order}`;

    // Limit export to prevent huge files
    query += ' LIMIT 10000';

    const [logs] = await pool.execute(query, params);

    // Generate CSV content
    const csvHeaders = ['Timestamp', 'User ID', 'Action', 'Resource Type', 'Resource ID', 'IP Address', 'User Agent'];
    const csvRows = logs.map(log => [
      log.timestamp,
      log.user_id || '',
      log.action || '',
      log.resource_type || '',
      log.resource_id || '',
      log.ip_address || '',
      (log.user_agent || '').replace(/"/g, '""') // Escape quotes
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n');

    // Set CSV headers
    const filename = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    res.send(csvContent);
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({
      error: {
        code: 'AUDIT_EXPORT_ERROR',
        message: 'Failed to export audit logs',
        timestamp: new Date().toISOString()
      }
    });
  }
});

module.exports = router;