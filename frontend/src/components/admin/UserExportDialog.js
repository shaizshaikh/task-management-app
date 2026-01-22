/**
 * User Export Dialog Component
 * Handles user data export to CSV/Excel formats
 */

import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const UserExportDialog = ({ onClose }) => {
  const [exportFormat, setExportFormat] = useState('csv');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    
    try {
      console.log('Starting user export...', { format: exportFormat, includeDeleted });
      
      const response = await axios.get('/api/users/export', {
        params: {
          format: exportFormat,
          include_deleted: includeDeleted
        },
        responseType: 'blob' // Important for file downloads
      });

      // Create blob and download link
      const blob = new Blob([response.data], {
        type: exportFormat === 'csv' 
          ? 'text/csv' 
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const extension = exportFormat === 'csv' ? 'csv' : 'xlsx';
      const filename = `users-export${includeDeleted ? '-with-deleted' : ''}-${timestamp}.${extension}`;
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(`Users exported successfully: ${filename}`);
      
      // Close dialog after successful export
      setTimeout(() => {
        onClose();
      }, 1000);
      
    } catch (error) {
      console.error('Export error:', error);
      const errorMessage = error.response?.data?.error?.message || 'Failed to export users';
      toast.error(errorMessage);
    } finally {
      setExporting(false);
    }
  };

  const getFormatIcon = (format) => {
    switch (format) {
      case 'csv': return 'CSV';
      case 'excel': return 'XLS';
      default: return 'FILE';
    }
  };

  const getFormatDescription = (format) => {
    switch (format) {
      case 'csv': 
        return 'Comma-separated values file. Compatible with Excel, Google Sheets, and most data tools.';
      case 'excel': 
        return 'Microsoft Excel format with formatting and multiple sheets support.';
      default: 
        return 'Standard file format';
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-medium">
        {/* Header */}
        <div className="export-header">
          <span className="export-icon">Export</span>
          <h3 className="export-title">
            Export Users
          </h3>
        </div>

        {/* Export Options */}
        <div className="export-format-section">
          <h4 className="export-format-title">Export Format</h4>
          
          <div className="export-format-options">
            {/* CSV Option */}
            <label className={`export-format-option ${exportFormat === 'csv' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="exportFormat"
                value="csv"
                checked={exportFormat === 'csv'}
                onChange={(e) => setExportFormat(e.target.value)}
                className="export-format-radio"
              />
              <div className="export-format-content">
                <div className="export-format-header">
                  <span className="export-format-icon">CSV</span>
                  CSV Format
                </div>
                <div className="export-format-description">
                  {getFormatDescription('csv')}
                </div>
              </div>
            </label>

            {/* Excel Option */}
            <label className={`export-format-option ${exportFormat === 'excel' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="exportFormat"
                value="excel"
                checked={exportFormat === 'excel'}
                onChange={(e) => setExportFormat(e.target.value)}
                className="export-format-radio"
              />
              <div className="export-format-content">
                <div className="export-format-header">
                  <span className="export-format-icon">XLS</span>
                  Excel Format
                </div>
                <div className="export-format-description">
                  {getFormatDescription('excel')}
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Export Options */}
        <div className="export-options-section">
          <h4 className="export-options-title">Export Options</h4>
          
          <label className="export-checkbox-option">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => setIncludeDeleted(e.target.checked)}
              className="export-checkbox"
            />
            <div className="export-checkbox-content">
              <div className="export-checkbox-label">
                Include deleted users
              </div>
              <div className="export-checkbox-description">
                Export will include soft-deleted users with deletion information
              </div>
            </div>
          </label>
        </div>

        {/* Export Information */}
        <div className="export-info-box">
          <div className="export-info-title">
            Export Information
          </div>
          <div className="export-info-content">
            <ul className="export-info-list">
              <li>• All user data from Keycloak and local database</li>
              <li>• Team memberships and roles</li>
              <li>• Task statistics and activity data</li>
              <li>• Account creation and last login dates</li>
              {includeDeleted && <li>• Deletion information and audit trail</li>}
            </ul>
          </div>
        </div>

        {/* Preview Information */}
        <div className="export-preview-box">
          <div className="export-preview-title">
            Export Preview
          </div>
          <div className="export-preview-grid">
            <span className="export-preview-label">Format:</span>
            <span className="export-preview-value">{getFormatIcon(exportFormat)} {exportFormat.toUpperCase()}</span>
            
            <span className="export-preview-label">Filename:</span>
            <span className="export-preview-value">
              users-export{includeDeleted ? '-with-deleted' : ''}-{new Date().toISOString().split('T')[0]}.{exportFormat === 'csv' ? 'csv' : 'xlsx'}
            </span>
            
            <span className="export-preview-label">Data:</span>
            <span className="export-preview-value">
              Active users{includeDeleted ? ' + deleted users' : ''}
            </span>
            
            <span className="export-preview-label">Columns:</span>
            <span className="export-preview-value">~15 columns including user info, roles, teams, and statistics</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="modal-actions">
          <button
            onClick={onClose}
            disabled={exporting}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          
          <button
            onClick={handleExport}
            disabled={exporting}
            className={`btn ${exporting ? 'btn-disabled' : 'btn-primary'}`}
          >
            {exporting ? 'Exporting...' : `Export ${exportFormat.toUpperCase()}`}
          </button>
        </div>

        {/* Loading Overlay */}
        {exporting && (
          <div className="export-loading-overlay">
            <div className="export-loading-content">
              <div className="export-loading-icon">Loading</div>
              <div className="export-loading-title">Exporting users...</div>
              <div className="export-loading-subtitle">
                Fetching data from Keycloak and generating file
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserExportDialog;