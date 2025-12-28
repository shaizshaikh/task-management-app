/**
 * File Processing Service
 * Handles parsing and generation of CSV/Excel files for user import/export
 */

const fs = require('fs').promises;
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const XLSX = require('xlsx');
const { createReadStream } = require('fs');

class FileProcessingService {
  constructor() {
    this.requiredImportColumns = [
      'username',
      'email', 
      'firstName',
      'lastName',
      'role'
    ];
    
    this.optionalImportColumns = [
      'groups',
      'temporaryPassword',
      'enabled'
    ];
    
    this.exportColumns = [
      'id',
      'username', 
      'email',
      'firstName',
      'lastName',
      'role',
      'groups',
      'createdAt',
      'lastLogin',
      'enabled'
    ];
  }

  /**
   * Parse CSV file and return user data
   */
  async parseCsvFile(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      const errors = [];
      let rowIndex = 0;

      createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          rowIndex++;
          try {
            const processedRow = this.processImportRow(data, rowIndex);
            if (processedRow.isValid) {
              results.push(processedRow.data);
            } else {
              errors.push({
                row: rowIndex,
                errors: processedRow.errors,
                data: data
              });
            }
          } catch (error) {
            errors.push({
              row: rowIndex,
              errors: [`Processing error: ${error.message}`],
              data: data
            });
          }
        })
        .on('end', () => {
          resolve({
            users: results,
            errors: errors,
            totalRows: rowIndex
          });
        })
        .on('error', (error) => {
          reject(new Error(`CSV parsing error: ${error.message}`));
        });
    });
  }

  /**
   * Parse Excel file and return user data
   */
  async parseExcelFile(filePath) {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0]; // Use first sheet
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      const results = [];
      const errors = [];
      
      jsonData.forEach((row, index) => {
        const rowIndex = index + 2; // Excel rows start at 1, header is row 1
        try {
          const processedRow = this.processImportRow(row, rowIndex);
          if (processedRow.isValid) {
            results.push(processedRow.data);
          } else {
            errors.push({
              row: rowIndex,
              errors: processedRow.errors,
              data: row
            });
          }
        } catch (error) {
          errors.push({
            row: rowIndex,
            errors: [`Processing error: ${error.message}`],
            data: row
          });
        }
      });
      
      return {
        users: results,
        errors: errors,
        totalRows: jsonData.length
      };
    } catch (error) {
      throw new Error(`Excel parsing error: ${error.message}`);
    }
  }

  /**
   * Process and validate a single import row
   */
  processImportRow(row, rowIndex) {
    const errors = [];
    const data = {};
    
    // Check required columns
    this.requiredImportColumns.forEach(column => {
      const value = row[column];
      if (!value || value.toString().trim() === '') {
        errors.push(`Missing required field: ${column}`);
      } else {
        data[column] = value.toString().trim();
      }
    });
    
    // Process optional columns
    this.optionalImportColumns.forEach(column => {
      if (row[column] !== undefined && row[column] !== null) {
        data[column] = row[column].toString().trim();
      }
    });
    
    // Validate email format
    if (data.email && !this.isValidEmail(data.email)) {
      errors.push('Invalid email format');
    }
    
    // Validate username format
    if (data.username && !this.isValidUsername(data.username)) {
      errors.push('Invalid username format (alphanumeric, underscore, and dot only)');
    }
    
    // Validate role
    if (data.role && !this.isValidRole(data.role)) {
      errors.push('Invalid role (must be: admin, manager, member, or viewer)');
    }
    
    // Process groups (comma-separated string to array)
    if (data.groups) {
      data.groups = data.groups.split(',').map(g => g.trim()).filter(g => g);
    }
    
    // Process boolean fields
    if (data.temporaryPassword !== undefined) {
      data.temporaryPassword = this.parseBoolean(data.temporaryPassword);
    }
    
    if (data.enabled !== undefined) {
      data.enabled = this.parseBoolean(data.enabled);
    } else {
      data.enabled = true; // Default to enabled
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors,
      data: data
    };
  }

  /**
   * Generate CSV file from user data
   */
  async generateCsvFile(users, outputPath) {
    const csvWriter = createCsvWriter({
      path: outputPath,
      header: this.exportColumns.map(column => ({
        id: column,
        title: this.formatColumnHeader(column)
      }))
    });
    
    const processedUsers = users.map(user => this.processExportRow(user));
    await csvWriter.writeRecords(processedUsers);
    
    return outputPath;
  }

  /**
   * Generate Excel file from user data
   */
  async generateExcelFile(users, outputPath) {
    const processedUsers = users.map(user => this.processExportRow(user));
    
    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(processedUsers, {
      header: this.exportColumns
    });
    
    // Set column headers
    const headerRow = {};
    this.exportColumns.forEach(column => {
      headerRow[column] = this.formatColumnHeader(column);
    });
    XLSX.utils.sheet_add_json(worksheet, [headerRow], { origin: 'A1', skipHeader: true });
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');
    
    // Write file
    XLSX.writeFile(workbook, outputPath);
    
    return outputPath;
  }

  /**
   * Process user data for export
   */
  processExportRow(user) {
    const exportRow = {};
    
    this.exportColumns.forEach(column => {
      switch (column) {
        case 'groups':
          exportRow[column] = Array.isArray(user[column]) 
            ? user[column].join(', ') 
            : user[column] || '';
          break;
        case 'createdAt':
        case 'lastLogin':
          exportRow[column] = user[column] 
            ? new Date(user[column]).toISOString().split('T')[0] 
            : '';
          break;
        case 'enabled':
          exportRow[column] = user[column] === true ? 'Yes' : 'No';
          break;
        default:
          exportRow[column] = user[column] || '';
      }
    });
    
    return exportRow;
  }

  /**
   * Validate email format
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate username format
   */
  isValidUsername(username) {
    const usernameRegex = /^[a-zA-Z0-9_.]{3,50}$/;
    return usernameRegex.test(username);
  }

  /**
   * Validate role
   */
  isValidRole(role) {
    const validRoles = ['admin', 'manager', 'member', 'viewer'];
    return validRoles.includes(role.toLowerCase());
  }

  /**
   * Parse boolean values from string
   */
  parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    const stringValue = value.toString().toLowerCase();
    return ['true', '1', 'yes', 'y'].includes(stringValue);
  }

  /**
   * Format column headers for export
   */
  formatColumnHeader(column) {
    const headerMap = {
      'id': 'User ID',
      'username': 'Username',
      'email': 'Email Address',
      'firstName': 'First Name',
      'lastName': 'Last Name',
      'role': 'Role',
      'groups': 'Groups',
      'createdAt': 'Created Date',
      'lastLogin': 'Last Login',
      'enabled': 'Enabled'
    };
    
    return headerMap[column] || column;
  }

  /**
   * Get file extension from path
   */
  getFileExtension(filePath) {
    return path.extname(filePath).toLowerCase();
  }

  /**
   * Determine if file is CSV or Excel
   */
  isExcelFile(filePath) {
    const extension = this.getFileExtension(filePath);
    return ['.xls', '.xlsx'].includes(extension);
  }

  /**
   * Parse import file (auto-detect CSV or Excel)
   */
  async parseImportFile(filePath) {
    try {
      if (this.isExcelFile(filePath)) {
        return await this.parseExcelFile(filePath);
      } else {
        return await this.parseCsvFile(filePath);
      }
    } catch (error) {
      throw new Error(`File parsing failed: ${error.message}`);
    }
  }

  /**
   * Generate export file (CSV or Excel based on format parameter)
   */
  async generateExportFile(users, format = 'csv') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `users-export-${timestamp}.${format}`;
    const outputPath = path.join(__dirname, '../uploads/temp', filename);
    
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });
    
    if (format.toLowerCase() === 'excel' || format.toLowerCase() === 'xlsx') {
      return await this.generateExcelFile(users, outputPath);
    } else {
      return await this.generateCsvFile(users, outputPath);
    }
  }
}

module.exports = FileProcessingService;