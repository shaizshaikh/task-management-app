/**
 * File Upload Middleware
 * Handles file uploads with validation for user import functionality
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configure storage
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/temp');
    
    // Ensure upload directory exists
    try {
      await fs.mkdir(uploadDir, { recursive: true });
    } catch (error) {
      console.error('Error creating upload directory:', error);
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `user-import-${uniqueSuffix}${extension}`);
  }
});

// File filter for CSV and Excel files
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'text/csv',
    'application/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  
  const allowedExtensions = ['.csv', '.xls', '.xlsx'];
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for large imports
    files: 1 // Only one file at a time
  }
});

/**
 * Middleware for handling user import file uploads
 */
const uploadUserImportFile = (req, res, next) => {
  const uploadSingle = upload.single('importFile');
  
  uploadSingle(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'FILE_TOO_LARGE',
          message: 'File size exceeds 10MB limit',
          maxSize: '10MB'
        });
      }
      if (error.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          error: 'TOO_MANY_FILES',
          message: 'Only one file can be uploaded at a time'
        });
      }
      return res.status(400).json({
        error: 'UPLOAD_ERROR',
        message: error.message
      });
    } else if (error) {
      return res.status(400).json({
        error: 'INVALID_FILE_TYPE',
        message: error.message,
        allowedTypes: ['CSV', 'Excel (.xls, .xlsx)']
      });
    }
    
    if (!req.file) {
      return res.status(400).json({
        error: 'NO_FILE_UPLOADED',
        message: 'Please select a file to upload'
      });
    }
    
    // Add file info to request
    req.uploadedFile = {
      path: req.file.path,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    };
    
    next();
  });
};

/**
 * Cleanup temporary files
 */
const cleanupTempFile = async (filePath) => {
  try {
    await fs.unlink(filePath);
    console.log(`Temporary file cleaned up: ${filePath}`);
  } catch (error) {
    console.error(`Error cleaning up temporary file ${filePath}:`, error);
  }
};

/**
 * Middleware to cleanup temp files after request
 */
const cleanupMiddleware = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Cleanup temp file after response is sent
    if (req.uploadedFile && req.uploadedFile.path) {
      setImmediate(() => {
        cleanupTempFile(req.uploadedFile.path);
      });
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

/**
 * Validate file exists and is readable
 */
const validateUploadedFile = async (req, res, next) => {
  if (!req.uploadedFile) {
    return res.status(400).json({
      error: 'NO_FILE_INFO',
      message: 'File information not found'
    });
  }
  
  try {
    await fs.access(req.uploadedFile.path);
    next();
  } catch (error) {
    return res.status(500).json({
      error: 'FILE_ACCESS_ERROR',
      message: 'Uploaded file could not be accessed'
    });
  }
};

module.exports = {
  uploadUserImportFile,
  cleanupTempFile,
  cleanupMiddleware,
  validateUploadedFile
};