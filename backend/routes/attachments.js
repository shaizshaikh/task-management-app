/**
 * Task Attachments Routes
 * Handles file attachments for tasks with RBAC
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { pool } = require('../database');
const { authenticateJWT } = require('../middleware/auth');
const { requireTaskAccess } = require('../middleware/rbac');
const { auditCRUD } = require('../middleware/audit');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/attachments');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-random-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${uniqueSuffix}-${name}${ext}`);
  }
});

// File filter for security
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv',
    'application/zip', 'application/x-zip-compressed'
  ];

  // Blocked extensions for security
  const blockedExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.js', '.vbs', '.jar'];
  const fileExt = path.extname(file.originalname).toLowerCase();

  if (blockedExtensions.includes(fileExt)) {
    cb(new Error('File type not allowed for security reasons'), false);
    return;
  }

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Max 5 files per request
  }
});

/**
 * GET /api/attachments/task/:taskId
 * Get all attachments for a task
 */
router.get('/task/:taskId', authenticateJWT, requireTaskAccess('VIEW_TASK'), async (req, res) => {
  try {
    const taskId = req.params.taskId;

    // Get attachments with uploader information
    const [attachments] = await pool.execute(`
      SELECT ta.id, ta.filename, ta.file_path, ta.file_size, ta.mime_type, ta.created_at,
             u.id as uploaded_by_id, u.username as uploaded_by_username, 
             u.full_name as uploaded_by_name
      FROM task_attachments ta
      JOIN users u ON ta.uploaded_by = u.id
      WHERE ta.task_id = ? AND u.is_active = TRUE
      ORDER BY ta.created_at DESC
    `, [taskId]);

    // Get task info for context
    const [taskInfo] = await pool.execute(`
      SELECT t.title, team.name as team_name
      FROM tasks t
      JOIN teams team ON t.team_id = team.id
      WHERE t.id = ?
    `, [taskId]);

    // Add download URLs and format file sizes
    const attachmentsWithUrls = attachments.map(attachment => ({
      ...attachment,
      download_url: `/api/attachments/${attachment.id}/download`,
      file_size_formatted: formatFileSize(attachment.file_size),
      file_extension: path.extname(attachment.filename).toLowerCase()
    }));

    res.json({
      task_id: parseInt(taskId),
      task_info: taskInfo[0] || null,
      attachments: attachmentsWithUrls,
      total: attachments.length,
      user_team_role: req.teamRole
    });
  } catch (error) {
    console.error('Error fetching task attachments:', error);
    res.status(500).json({
      error: {
        code: 'ATTACHMENTS_FETCH_ERROR',
        message: 'Failed to fetch task attachments',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /api/attachments/task/:taskId
 * Upload attachments to task
 */
router.post('/task/:taskId', authenticateJWT, requireTaskAccess('UPLOAD_ATTACHMENT'), auditCRUD('attachment'), upload.array('files', 5), async (req, res) => {
  try {
    const taskId = req.params.taskId;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({
        error: {
          code: 'NO_FILES',
          message: 'No files provided',
          timestamp: new Date().toISOString()
        }
      });
    }

    const uploadedAttachments = [];

    // Process each uploaded file
    for (const file of files) {
      try {
        // Save attachment info to database
        const [result] = await pool.execute(`
          INSERT INTO task_attachments (task_id, uploaded_by, filename, file_path, file_size, mime_type, created_at)
          VALUES (?, ?, ?, ?, ?, ?, NOW())
        `, [
          taskId,
          req.user.id,
          file.originalname,
          file.path,
          file.size,
          file.mimetype
        ]);

        // Get the created attachment with uploader info
        const [newAttachment] = await pool.execute(`
          SELECT ta.id, ta.filename, ta.file_path, ta.file_size, ta.mime_type, ta.created_at,
                 u.id as uploaded_by_id, u.username as uploaded_by_username, 
                 u.full_name as uploaded_by_name
          FROM task_attachments ta
          JOIN users u ON ta.uploaded_by = u.id
          WHERE ta.id = ?
        `, [result.insertId]);

        const attachment = {
          ...newAttachment[0],
          download_url: `/api/attachments/${newAttachment[0].id}/download`,
          file_size_formatted: formatFileSize(newAttachment[0].file_size),
          file_extension: path.extname(newAttachment[0].filename).toLowerCase()
        };

        uploadedAttachments.push(attachment);
      } catch (fileError) {
        console.error(`Error processing file ${file.originalname}:`, fileError);
        // Clean up the uploaded file if database insert failed
        try {
          await fs.unlink(file.path);
        } catch (unlinkError) {
          console.error('Error cleaning up file:', unlinkError);
        }
      }
    }

    if (uploadedAttachments.length === 0) {
      return res.status(500).json({
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Failed to upload any files',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Get task info for broadcasting
    const [taskInfo] = await pool.execute(`
      SELECT t.title, team.name as team_name, team.id as team_id
      FROM tasks t
      JOIN teams team ON t.team_id = team.id
      WHERE t.id = ?
    `, [taskId]);

    // Broadcast via RBAC-aware WebSocket
    const realtimeService = req.app.get('realtimeService');
    if (realtimeService) {
      await realtimeService.broadcastToTaskAudience({
        id: parseInt(taskId),
        title: taskInfo[0]?.title,
        team_name: taskInfo[0]?.team_name,
        team_id: taskInfo[0]?.team_id
      }, {
        type: 'attachmentsUploaded',
        attachments: uploadedAttachments,
        uploader: {
          id: req.user.id,
          username: req.user.username,
          name: req.user.full_name || req.user.username
        },
        timestamp: new Date().toISOString()
      }, 'attachmentsUploaded');
    }

    console.log(`${uploadedAttachments.length} attachments uploaded to task ${taskId} by ${req.user.username}`);

    res.status(201).json({
      message: `${uploadedAttachments.length} file(s) uploaded successfully`,
      attachments: uploadedAttachments,
      total_uploaded: uploadedAttachments.length,
      total_failed: files.length - uploadedAttachments.length
    });
  } catch (error) {
    console.error('Error uploading attachments:', error);
    
    // Clean up any uploaded files on error
    if (req.files) {
      for (const file of req.files) {
        try {
          await fs.unlink(file.path);
        } catch (unlinkError) {
          console.error('Error cleaning up file:', unlinkError);
        }
      }
    }

    res.status(500).json({
      error: {
        code: 'UPLOAD_ERROR',
        message: 'Failed to upload attachments',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/attachments/:id/download
 * Download attachment file
 */
router.get('/:id/download', authenticateJWT, async (req, res) => {
  try {
    const attachmentId = req.params.id;

    // Get attachment details with task info
    const [attachments] = await pool.execute(`
      SELECT ta.id, ta.filename, ta.file_path, ta.mime_type, ta.task_id,
             t.team_id
      FROM task_attachments ta
      JOIN tasks t ON ta.task_id = t.id
      JOIN teams team ON t.team_id = team.id
      WHERE ta.id = ? AND team.is_active = TRUE
    `, [attachmentId]);

    if (attachments.length === 0) {
      return res.status(404).json({
        error: {
          code: 'ATTACHMENT_NOT_FOUND',
          message: 'Attachment not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    const attachment = attachments[0];

    // Check if user has access to the task
    const { getUserTeamRole } = require('../middleware/rbac');
    const userTeamRole = await getUserTeamRole(req.user.id, attachment.team_id);
    
    if (!userTeamRole && req.user.global_role !== 'admin') {
      return res.status(403).json({
        error: {
          code: 'ACCESS_DENIED',
          message: 'Access denied to this attachment',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if file exists
    try {
      await fs.access(attachment.file_path);
    } catch (error) {
      return res.status(404).json({
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'Attachment file not found on server',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Set appropriate headers
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
    res.setHeader('Content-Type', attachment.mime_type);

    // Send file
    res.sendFile(path.resolve(attachment.file_path));

    console.log(`Attachment downloaded: ${attachment.filename} by ${req.user.username}`);
  } catch (error) {
    console.error('Error downloading attachment:', error);
    res.status(500).json({
      error: {
        code: 'DOWNLOAD_ERROR',
        message: 'Failed to download attachment',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * DELETE /api/attachments/:id
 * Delete attachment (uploader, team manager, or admin)
 */
router.delete('/:id', authenticateJWT, auditCRUD('attachment'), async (req, res) => {
  try {
    const attachmentId = req.params.id;

    // Get attachment details
    const [attachments] = await pool.execute(`
      SELECT ta.id, ta.filename, ta.file_path, ta.uploaded_by, ta.task_id,
             t.team_id, u.username as uploader_username
      FROM task_attachments ta
      JOIN tasks t ON ta.task_id = t.id
      JOIN users u ON ta.uploaded_by = u.id
      WHERE ta.id = ?
    `, [attachmentId]);

    if (attachments.length === 0) {
      return res.status(404).json({
        error: {
          code: 'ATTACHMENT_NOT_FOUND',
          message: 'Attachment not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    const attachment = attachments[0];

    // Check permissions
    let canDelete = false;

    // Admin can delete any attachment
    if (req.user.global_role === 'admin') {
      canDelete = true;
    }
    // Uploader can delete their own attachment
    else if (attachment.uploaded_by === req.user.id) {
      canDelete = true;
    }
    // Team manager can delete attachments in their team
    else {
      const { getUserTeamRole } = require('../middleware/rbac');
      const userTeamRole = await getUserTeamRole(req.user.id, attachment.team_id);
      if (userTeamRole === 'leader') {
        canDelete = true;
      }
    }

    if (!canDelete) {
      return res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions to delete this attachment',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Delete from database
    await pool.execute('DELETE FROM task_attachments WHERE id = ?', [attachmentId]);

    // Delete file from filesystem
    try {
      await fs.unlink(attachment.file_path);
    } catch (fileError) {
      console.error('Error deleting file from filesystem:', fileError);
      // Continue even if file deletion fails - database record is already deleted
    }

    console.log(`Attachment deleted: ${attachment.filename} (ID: ${attachmentId}) by ${req.user.username}`);

    res.json({
      message: 'Attachment deleted successfully',
      deleted_attachment: {
        id: parseInt(attachmentId),
        filename: attachment.filename,
        task_id: attachment.task_id,
        uploader_username: attachment.uploader_username
      }
    });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    res.status(500).json({
      error: {
        code: 'DELETE_ERROR',
        message: 'Failed to delete attachment',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/attachments/:id
 * Get attachment details
 */
router.get('/:id', authenticateJWT, async (req, res) => {
  try {
    const attachmentId = req.params.id;

    // Get attachment with task and uploader info
    const [attachments] = await pool.execute(`
      SELECT ta.id, ta.filename, ta.file_path, ta.file_size, ta.mime_type, ta.created_at,
             ta.task_id, t.title as task_title,
             u.id as uploaded_by_id, u.username as uploaded_by_username, 
             u.full_name as uploaded_by_name,
             team.id as team_id, team.name as team_name
      FROM task_attachments ta
      JOIN tasks t ON ta.task_id = t.id
      JOIN teams team ON t.team_id = team.id
      JOIN users u ON ta.uploaded_by = u.id
      WHERE ta.id = ? AND u.is_active = TRUE AND team.is_active = TRUE
    `, [attachmentId]);

    if (attachments.length === 0) {
      return res.status(404).json({
        error: {
          code: 'ATTACHMENT_NOT_FOUND',
          message: 'Attachment not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    const attachment = attachments[0];

    // Check if user has access to the task
    const { getUserTeamRole } = require('../middleware/rbac');
    const userTeamRole = await getUserTeamRole(req.user.id, attachment.team_id);
    
    if (!userTeamRole && req.user.global_role !== 'admin') {
      return res.status(403).json({
        error: {
          code: 'ACCESS_DENIED',
          message: 'Access denied to this attachment',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if user can delete this attachment
    const canDelete = (
      req.user.global_role === 'admin' ||
      attachment.uploaded_by_id === req.user.id ||
      userTeamRole === 'leader'
    );

    res.json({
      attachment: {
        ...attachment,
        download_url: `/api/attachments/${attachment.id}/download`,
        file_size_formatted: formatFileSize(attachment.file_size),
        file_extension: path.extname(attachment.filename).toLowerCase(),
        user_can_delete: canDelete,
        user_team_role: userTeamRole
      }
    });
  } catch (error) {
    console.error('Error fetching attachment details:', error);
    res.status(500).json({
      error: {
        code: 'ATTACHMENT_DETAILS_ERROR',
        message: 'Failed to fetch attachment details',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Utility function to format file size
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'File size exceeds 10MB limit',
          timestamp: new Date().toISOString()
        }
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: {
          code: 'TOO_MANY_FILES',
          message: 'Maximum 5 files allowed per upload',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
  
  if (error.message === 'File type not allowed') {
    return res.status(400).json({
      error: {
        code: 'INVALID_FILE_TYPE',
        message: 'File type not allowed',
        timestamp: new Date().toISOString()
      }
    });
  }

  if (error.message === 'File type not allowed for security reasons') {
    return res.status(400).json({
      error: {
        code: 'SECURITY_VIOLATION',
        message: 'File type blocked for security reasons',
        timestamp: new Date().toISOString()
      }
    });
  }

  next(error);
});

module.exports = router;