/**
 * User Import Dialog Component
 * Handles bulk user import from CSV/Excel files
 */

import React, { useState, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const UserImportDialog = ({ onClose, onImportComplete }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (file) => {
    // Validate file type
    const allowedTypes = [
      'text/csv',
      'application/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    const allowedExtensions = ['.csv', '.xls', '.xlsx'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      toast.error('Please select a CSV or Excel file');
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setImportResults(null);
    setShowResults(false);
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error('Please select a file to import');
      return;
    }

    setImporting(true);
    
    try {
      const formData = new FormData();
      formData.append('importFile', selectedFile);

      const response = await axios.post('/api/users/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setImportResults(response.data);
      setShowResults(true);
      
      const { results } = response.data;
      
      if (results.failed === 0) {
        toast.success(`Successfully imported ${results.successful} users!`);
      } else if (results.successful > 0) {
        toast.warning(`Imported ${results.successful} users with ${results.failed} failures`);
      } else {
        toast.error(`Import failed: ${results.failed} users could not be imported`);
      }

      if (results.skipped > 0) {
        toast.info(`${results.skipped} users were skipped (already exist)`);
      }

      // Notify parent component
      if (onImportComplete) {
        onImportComplete(response.data);
      }

    } catch (error) {
      console.error('Import error:', error);
      const errorMessage = error.response?.data?.error?.message || 'Failed to import users';
      toast.error(errorMessage);
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = async (format = 'csv') => {
    try {
      const response = await axios.get(`/api/users/import/template?format=${format}`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { 
        type: format === 'csv' ? 'text/csv' : 'application/vnd.ms-excel' 
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `user-import-template.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(`Template downloaded: user-import-template.${format}`);
    } catch (error) {
      console.error('Template download error:', error);
      toast.error('Failed to download template');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (filename) => {
    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    switch (extension) {
      case '.csv': return '📊';
      case '.xls':
      case '.xlsx': return '📈';
      default: return '📄';
    }
  };

  if (showResults && importResults) {
    return (
      <div className="modal-overlay">
        <div className="modal-content modal-large">
          {/* Results Header */}
          <div className="import-results-header">
            <span className="import-results-icon">✅</span>
            <h3 className="import-results-title">
              Import Results
            </h3>
          </div>

          {/* Summary */}
          <div className="import-results-summary">
            <div className="import-results-stat success">
              <div className="import-results-stat-number">
                {importResults.results.successful}
              </div>
              <div className="import-results-stat-label">Successful</div>
            </div>
            
            <div className="import-results-stat warning">
              <div className="import-results-stat-number">
                {importResults.results.skipped}
              </div>
              <div className="import-results-stat-label">Skipped</div>
            </div>
            
            <div className="import-results-stat error">
              <div className="import-results-stat-number">
                {importResults.results.failed}
              </div>
              <div className="import-results-stat-label">Failed</div>
            </div>
            
            <div className="import-results-stat">
              <div className="import-results-stat-number">
                {importResults.results.total_processed}
              </div>
              <div className="import-results-stat-label">Total</div>
            </div>
          </div>

          {/* Successful Users */}
          {importResults.details.successful_users.length > 0 && (
            <div className="import-results-section">
              <h4 className="import-results-section-title success">
                ✅ Successfully Imported ({importResults.details.successful_users.length})
              </h4>
              <div className="import-results-list">
                {importResults.details.successful_users.map((user, index) => (
                  <div key={index} className="import-results-item">
                    <div>
                      <div className="import-results-item-name">{user.full_name} (@{user.username})</div>
                      <div className="import-results-item-details">
                        {user.email} - {user.role}
                      </div>
                    </div>
                    {user.password && (
                      <div className="import-results-item-password">
                        Password: {user.password}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Failed Users */}
          {importResults.details.failed_users.length > 0 && (
            <div className="import-results-section">
              <h4 className="import-results-section-title error">
                ❌ Failed Imports ({importResults.details.failed_users.length})
              </h4>
              <div className="import-results-list">
                {importResults.details.failed_users.map((user, index) => (
                  <div key={index} className="import-results-item">
                    <div className="import-results-item-name">{user.username} ({user.email})</div>
                    <div className="import-results-item-error">
                      Error: {user.error}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skipped Users */}
          {importResults.details.skipped_users.length > 0 && (
            <div className="import-results-section">
              <h4 className="import-results-section-title warning">
                ⚠️ Skipped Users ({importResults.details.skipped_users.length})
              </h4>
              <div className="import-results-list">
                {importResults.details.skipped_users.map((user, index) => (
                  <div key={index} className="import-results-item">
                    <div className="import-results-item-name">{user.username} ({user.email})</div>
                    <div className="import-results-item-details">
                      {user.reason}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Parse Errors */}
          {importResults.details.parse_errors.length > 0 && (
            <div className="import-results-section">
              <h4 className="import-results-section-title error">
                📋 File Parse Errors ({importResults.details.parse_errors.length})
              </h4>
              <div className="import-results-list">
                {importResults.details.parse_errors.map((error, index) => (
                  <div key={index} className="import-results-item">
                    <div className="import-results-item-name">Row {error.row}</div>
                    <div className="import-results-item-error">
                      {error.errors.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="modal-actions">
            <button
              onClick={() => {
                setShowResults(false);
                setImportResults(null);
                setSelectedFile(null);
              }}
              className="btn btn-primary"
            >
              Import More Users
            </button>
            
            <button
              onClick={onClose}
              className="btn btn-success"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-medium">
        {/* Header */}
        <div className="import-header">
          <span className="import-icon">📥</span>
          <h3 className="import-title">
            Import Users
          </h3>
        </div>

        {/* Instructions */}
        <div className="import-instructions-box">
          <div className="import-instructions-title">
            📋 Import Instructions
          </div>
          <ul className="import-instructions-list">
            <li>Upload a CSV or Excel file with user data</li>
            <li>Required columns: username, email, firstName, lastName, role</li>
            <li>Optional columns: groups, temporaryPassword, enabled</li>
            <li>Maximum file size: 10MB</li>
            <li>Existing users will be skipped</li>
          </ul>
        </div>

        {/* Template Download */}
        <div className="import-template-section">
          <div className="import-template-title">
            📄 Download Templates
          </div>
          <div className="import-template-buttons">
            <button
              onClick={() => handleDownloadTemplate('csv')}
              className="import-template-button csv"
            >
              📊 Download CSV Template
            </button>
            
            <button
              onClick={() => handleDownloadTemplate('excel')}
              className="import-template-button excel"
            >
              📈 Download Excel Template
            </button>
          </div>
        </div>

        {/* File Upload Area */}
        <div
          className={`import-upload-area ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xls,.xlsx"
            onChange={handleFileInputChange}
          />
          
          {selectedFile ? (
            <div className="import-file-preview">
              <div className="import-file-icon">
                {getFileIcon(selectedFile.name)}
              </div>
              <div className="import-file-name">
                {selectedFile.name}
              </div>
              <div className="import-file-size">
                {formatFileSize(selectedFile.size)}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFile(null);
                }}
                className="import-file-remove"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="import-upload-placeholder">
              <div className="import-upload-icon">📁</div>
              <div className="import-upload-text">
                Click to select a file or drag and drop
              </div>
              <div className="import-upload-hint">
                Supported formats: CSV, Excel (.xls, .xlsx)
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="modal-actions">
          <button
            onClick={onClose}
            disabled={importing}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          
          <button
            onClick={handleImport}
            disabled={!selectedFile || importing}
            className={`btn ${!selectedFile || importing ? 'btn-disabled' : 'btn-primary'}`}
          >
            {importing ? '🔄 Importing...' : '📥 Import Users'}
          </button>
        </div>

        {/* Loading Overlay */}
        {importing && (
          <div className="import-loading-overlay">
            <div className="import-loading-content">
              <div className="import-loading-icon">🔄</div>
              <div className="import-loading-title">Importing users...</div>
              <div className="import-loading-subtitle">
                This may take a few moments
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserImportDialog;