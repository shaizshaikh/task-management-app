/**
 * User Import Dialog Component - PERFORMANCE OPTIMIZED
 * Reduced re-renders and DOM operations for better typing performance
 */

import React, { useState, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const UserImportDialog = ({ onClose, onImportComplete }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [showResults, setShowResults] = useState(false);
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

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return false;
    }

    return true;
  }, []);

  const handleFileSelect = useCallback((file) => {
    if (!validateFile(file)) return;
    
    setSelectedFile(file);
    setImportResults(null);
    setShowResults(false);
  }, [validateFile]);

  const handleFileInputChange = useCallback((e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  // Optimized drag handlers
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
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
  }, [selectedFile, onImportComplete]);

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
                Supported formats: CSV, Excel (.xls, .xlsx)
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

export default React.memo(UserImportDialog);