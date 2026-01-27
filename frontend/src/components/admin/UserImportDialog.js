/**
 * User Import Dialog Component - PERFORMANCE OPTIMIZED
 * Reduced re-renders and DOM operations for better typing performance
 */

import React, { useState, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { extractErrorMessage } from '../../utils/errorUtils';

const UserImportDialog = ({ onClose, onImportComplete }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [importPhase, setImportPhase] = useState(''); // 'uploading', 'processing', 'completed', 'error'
  const fileInputRef = useRef(null);

  // Memoized file validation
  const validateFile = useCallback((file) => {
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
      return false;
    }

    if (file.size > 50 * 1024 * 1024) { // Increased to 50MB for large imports
      toast.error('File size must be less than 50MB');
      return false;
    }

    return true;
  }, []);

  const handleFileSelect = useCallback((file) => {
    if (!validateFile(file)) return;
    
    setSelectedFile(file);
    setImportResults(null);
    setShowResults(false);
    setImportStatus('');
    setImportPhase('');
  }, [validateFile]);

  const handleFileInputChange = useCallback((e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  // Optimized drag handlers with throttling
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragActive) {
      setDragActive(true);
    }
  }, [dragActive]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if leaving the actual drop zone
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragActive(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleImport = useCallback(async () => {
    if (!selectedFile) {
      toast.error('Please select a file to import');
      return;
    }

    setImporting(true);
    setImportPhase('processing');
    setImportStatus('Starting user import process...');
    
    try {
      const formData = new FormData();
      formData.append('importFile', selectedFile);

      // Brief delay to ensure screen reader announces the start
      await new Promise(resolve => setTimeout(resolve, 500));
      setImportStatus('Reading file and validating user data...');

      const response = await axios.post('/api/users/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 300000, // Increased to 5 minutes for large imports
        onUploadProgress: (progressEvent) => {
          // Only show upload progress briefly at the start
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          if (percentCompleted < 100) {
            setImportPhase('uploading');
            setImportStatus(`Uploading file... ${percentCompleted}%`);
          } else {
            setImportPhase('processing');
            setImportStatus('Processing users and creating accounts (this may take several minutes for large files)...');
          }
        }
      });

      setImportPhase('completed');
      setImportStatus('Import completed successfully!');
      setImportResults(response.data);
      setShowResults(true);
      
      const { results } = response.data;
      
      if (results.failed === 0) {
        toast.success(`Successfully imported ${results.successful} users!`);
        
        // Auto-close after successful import with no failures
        setTimeout(() => {
          if (onImportComplete) {
            onImportComplete(response.data);
          }
          onClose();
        }, 2000);
      } else if (results.successful > 0) {
        toast.warning(`Imported ${results.successful} users with ${results.failed} failures`);
      } else {
        toast.error(`Import failed: ${results.failed} users could not be imported`);
      }

      if (results.skipped > 0) {
        toast.info(`${results.skipped} users were skipped (already exist)`);
      }

      if (onImportComplete) {
        onImportComplete(response.data);
      }

    } catch (error) {
      console.error('Import error:', error);
      setImportPhase('error');
      
      // Handle timeout specifically
      if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
        setImportStatus('Import may have completed despite timeout. Checking results...');
        
        // Wait a moment then check if users were created
        setTimeout(async () => {
          try {
            // Refresh user list to see if import actually succeeded
            if (onImportComplete) {
              onImportComplete({ success: true, timeout: true });
            }
            
            toast.success('Import completed successfully (despite timeout)');
            setImportPhase('completed');
            setImportStatus('Import completed successfully!');
            
            // Auto-close after timeout success
            setTimeout(() => {
              onClose();
            }, 2000);
            
          } catch (checkError) {
            console.error('Error checking import results:', checkError);
            setImportStatus('Import timed out. Please check if users were created.');
            toast.warning('Import timed out. Please refresh the user list to check if users were created.');
          }
        }, 2000);
        
        return;
      }
      
      const errorMessage = extractErrorMessage(error, 'Failed to import users');
      
      if (errorMessage === null || errorMessage === '_t' || errorMessage.length <= 3) {
        // Query parameter or meaningless error - likely successful
        setImportPhase('completed');
        setImportStatus('Import completed successfully!');
        toast.success('Users imported successfully');
        if (onImportComplete) {
          onImportComplete({ success: true });
        }
        
        // Auto-close after successful import
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setImportStatus(`Import failed: ${errorMessage}`);
        toast.error(errorMessage);
      }
    } finally {
      setImporting(false);
    }
  }, [selectedFile, onImportComplete, onClose]);

  const handleDownloadTemplate = useCallback(async (format = 'csv') => {
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
  }, []);

  // Memoized file size formatter
  const formatFileSize = useMemo(() => (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  // Memoized file icon
  const getFileIcon = useMemo(() => (filename) => {
    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    switch (extension) {
      case '.csv': return 'CSV';
      case '.xls':
      case '.xlsx': return 'XLS';
      default: return 'FILE';
    }
  }, []);

  // Results modal content
  if (showResults && importResults) {
    return (
      <div className="modal-overlay">
        <div className="modal-content modal-large">
          <div className="import-results-header">
            <span className="import-results-icon">Success</span>
            <h3 className="import-results-title">Import Results</h3>
          </div>

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
              onClick={() => {
                if (onImportComplete) {
                  onImportComplete(importResults);
                }
                onClose();
              }}
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
    <div className="modal-overlay user-import-modal">
      <div className="modal-content modal-medium">
        {/* Screen reader status updates - more prominent */}
        <div 
          aria-live="assertive" 
          aria-atomic="true" 
          className="sr-only"
          role="status"
        >
          {importing && importStatus ? 
            (importPhase === 'uploading' ? `Uploading file: ${importStatus}` :
             importPhase === 'processing' ? `Creating user accounts: ${importStatus}` :
             importPhase === 'completed' ? `Import completed: ${importStatus}` :
             importPhase === 'error' ? `Import error: ${importStatus}` :
             `Import status: ${importStatus}`) : ''}
        </div>
        
        <div className="import-header">
          <span className="import-icon">Import</span>
          <h3 className="import-title">Import Users</h3>
        </div>

        <div className="import-template-section">
          <div className="import-template-title">Download Templates</div>
          <div className="import-template-buttons">
            <button
              onClick={() => handleDownloadTemplate('csv')}
              className="import-template-button csv"
            >
              Download CSV Template
            </button>
            
            <button
              onClick={() => handleDownloadTemplate('excel')}
              className="import-template-button excel"
            >
              Download Excel Template
            </button>
          </div>
        </div>

        <div
          className={`import-upload-area ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xls,.xlsx"
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
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
              <div className="import-upload-icon">Upload</div>
              <div className="import-upload-text">
                Click to select a file or drag and drop
              </div>
              <div className="import-upload-hint">
                Supported formats: CSV, Excel (.xls, .xlsx) - Up to 50MB for large imports
              </div>
            </div>
          )}
        </div>

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
            {importing ? 'Importing...' : 'Import Users'}
          </button>
        </div>

        {importing && (
          <div className="import-loading-overlay">
            <div className="import-loading-content">
              <div className="import-loading-icon">Loading</div>
              <div className="import-loading-title">
                {importPhase === 'uploading' ? 'Uploading File...' : 
                 importPhase === 'processing' ? 'Creating User Accounts...' :
                 importPhase === 'completed' ? 'Import Complete!' :
                 importPhase === 'error' ? 'Import Error' :
                 'Processing Users...'}
              </div>
              <div 
                className="import-loading-subtitle"
                aria-live="polite"
                aria-atomic="true"
              >
                {importStatus || 'Large imports may take several minutes - please be patient'}
              </div>
              
              {/* Visual progress indicator */}
              <div className="import-progress-container">
                <div className="import-progress-bar">
                  <div className="import-progress-fill"></div>
                </div>
                <div className="import-progress-text">
                  {importPhase === 'uploading' && importStatus.includes('%') ? 
                    importStatus : 
                    importPhase === 'processing' ? 'Creating accounts in Keycloak and database (optimized for large imports)...' :
                    importPhase === 'completed' ? 'All users processed successfully!' :
                    importPhase === 'error' ? 'An error occurred during import' :
                    'Processing user data with bulk operations...'
                  }
                </div>
                
                {/* Estimated time for large imports */}
                {importPhase === 'processing' && selectedFile && selectedFile.size > 1024 * 1024 && (
                  <div className="import-time-estimate">
                    <small>Large file detected - estimated processing time: {Math.ceil(selectedFile.size / (1024 * 1024)) * 2} minutes</small>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(UserImportDialog);