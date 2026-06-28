/**
 * File Cleanup Utility
 * Handles cleanup of temporary files and scheduled cleanup tasks
 */

const fs = require('fs').promises;
const path = require('path');

class FileCleanupService {
  constructor() {
    this.tempDir = path.join(__dirname, '../uploads/temp');
    this.maxFileAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  }

  /**
   * Clean up a specific file
   */
  async cleanupFile(filePath) {
    try {
      await fs.unlink(filePath);
      console.log(`File cleaned up: ${filePath}`);
      return true;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`Error cleaning up file ${filePath}:`, error);
      }
      return false;
    }
  }

  /**
   * Clean up old temporary files
   */
  async cleanupOldFiles() {
    try {
      // Ensure temp directory exists
      await fs.mkdir(this.tempDir, { recursive: true });
      
      const files = await fs.readdir(this.tempDir);
      const now = Date.now();
      let cleanedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        
        try {
          const stats = await fs.stat(filePath);
          const fileAge = now - stats.mtime.getTime();
          
          if (fileAge > this.maxFileAge) {
            await this.cleanupFile(filePath);
            cleanedCount++;
          }
        } catch (error) {
          console.error(`Error checking file ${filePath}:`, error);
        }
      }

      if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} old temporary files`);
      }
      
      return cleanedCount;
    } catch (error) {
      console.error('Error during cleanup of old files:', error);
      return 0;
    }
  }

  /**
   * Start scheduled cleanup (runs every hour)
   */
  startScheduledCleanup() {
    // Run cleanup immediately
    this.cleanupOldFiles();
    
    // Schedule cleanup every hour
    setInterval(() => {
      this.cleanupOldFiles();
    }, 60 * 60 * 1000); // 1 hour
    
    console.log('Scheduled file cleanup started (runs every hour)');
  }

  /**
   * Get temporary directory info
   */
  async getTempDirInfo() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      const files = await fs.readdir(this.tempDir);
      
      let totalSize = 0;
      const fileDetails = [];
      
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        try {
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
          fileDetails.push({
            name: file,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
          });
        } catch (error) {
          console.error(`Error getting stats for ${filePath}:`, error);
        }
      }
      
      return {
        directory: this.tempDir,
        fileCount: files.length,
        totalSize: totalSize,
        files: fileDetails
      };
    } catch (error) {
      console.error('Error getting temp directory info:', error);
      return {
        directory: this.tempDir,
        fileCount: 0,
        totalSize: 0,
        files: [],
        error: error.message
      };
    }
  }

  /**
   * Clean up all temporary files (emergency cleanup)
   */
  async cleanupAllFiles() {
    try {
      const files = await fs.readdir(this.tempDir);
      let cleanedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        if (await this.cleanupFile(filePath)) {
          cleanedCount++;
        }
      }

      console.log(`Emergency cleanup completed: ${cleanedCount} files removed`);
      return cleanedCount;
    } catch (error) {
      console.error('Error during emergency cleanup:', error);
      return 0;
    }
  }
}

// Create singleton instance
const fileCleanupService = new FileCleanupService();

module.exports = fileCleanupService;