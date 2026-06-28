import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';

const TaskAttachments = ({ taskId, isEditing = false }) => {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Load attachments when component mounts or taskId changes
  useEffect(() => {
    if (taskId) {
      loadAttachments();
    }
  }, [taskId]);

  const loadAttachments = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/attachments/task/${taskId}`);
      setAttachments(response.data.attachments || []);
    } catch (error) {
      console.error('Error loading attachments:', error);
      if (error.response?.status !== 404) {
        toast.error('Failed to load attachments');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (files) => {
    if (!files || files.length === 0) return;

    // Validate files
    const validFiles = Array.from(files).filter(file => {
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`File "${file.name}" is too large. Maximum size is 10MB.`);
        return false;
      }

      // Check file type
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain', 'text/csv',
        'application/zip', 'application/x-zip-compressed'
      ];

      if (!allowedTypes.includes(file.type)) {
        toast.error(`File type "${file.type}" is not allowed.`);
        return false;
      }

      return true;
    });

    if (validFiles.length > 0) {
      uploadFiles(validFiles);
    }
  };

  const uploadFiles = async (files) => {
    setUploading(true);
    const formData = new FormData();
    
    files.forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await axios.post(`/api/attachments/task/${taskId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success(`${response.data.total_uploaded} file(s) uploaded successfully!`);
      
      // Add new attachments to the list
      setAttachments(prev => [...response.data.attachments, ...prev]);
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      const errorMessage = error.response?.data?.error?.message || 'Failed to upload files';
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (attachment) => {
    try {
      const response = await axios.get(`/api/attachments/${attachment.id}/download`, {
        responseType: 'blob',
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', attachment.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`Downloaded: ${attachment.filename}`);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
    }
  };

  const handleDelete = async (attachment) => {
    if (!window.confirm(`Are you sure you want to delete "${attachment.filename}"?`)) {
      return;
    }

    try {
      await axios.delete(`/api/attachments/${attachment.id}`);
      setAttachments(prev => prev.filter(a => a.id !== attachment.id));
      toast.success(`Deleted: ${attachment.filename}`);
    } catch (error) {
      console.error('Error deleting attachment:', error);
      const errorMessage = error.response?.data?.error?.message || 'Failed to delete attachment';
      toast.error(errorMessage);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    handleFileSelect(files);
  };

  const getFileIcon = (filename, mimeType) => {
    const ext = filename.split('.').pop().toLowerCase();
    
    if (mimeType?.startsWith('image/')) return 'IMG';
    if (mimeType === 'application/pdf') return 'PDF';
    if (ext === 'doc' || ext === 'docx') return 'DOC';
    if (ext === 'xls' || ext === 'xlsx') return 'XLS';
    if (ext === 'ppt' || ext === 'pptx') return 'PPT';
    if (ext === 'zip' || ext === 'rar') return 'ZIP';
    if (ext === 'txt') return 'TXT';
    if (ext === 'csv') return 'CSV';
    
    return 'FILE';
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="attachments-wrapper">
      <div className="attachments-header">
        <h4 className="attachments-title">
          Attachments ({attachments.length})
        </h4>
        
        {isEditing && (
          <div className="attachments-actions">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => handleFileSelect(e.target.files)}
              className="attachments-file-input"
              accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="attachments-add-btn"
            >
              {uploading ? 'Uploading...' : '+ Add Files'}
            </button>
          </div>
        )}
      </div>

      {/* Drag and Drop Area (only in editing mode) */}
      {isEditing && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`attachments-dropzone ${dragOver ? 'dragover' : ''}`}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="attachments-dropzone-content">
            {uploading ? (
              <div>
                <div>⏳ Uploading files...</div>
                <div className="attachments-dropzone-help">Please wait...</div>
              </div>
            ) : (
              <div>
                <div>Drag & drop files here or click to browse</div>
                <div className="attachments-dropzone-help">
                  Max 10MB per file • Images, PDFs, Documents, Archives
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="attachments-loading">
          Loading attachments...
        </div>
      )}

      {/* Attachments List */}
      {!loading && attachments.length === 0 && (
        <div className="attachments-empty">
          No attachments yet
        </div>
      )}

      {!loading && attachments.length > 0 && (
        <div className="attachments-list">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="attachment-item">
              <div className="attachment-info">
                <span className="attachment-icon">
                  {getFileIcon(attachment.filename, attachment.mime_type)}
                </span>
                <div className="attachment-details">
                  <div className="attachment-name" title={attachment.filename}>
                    {attachment.filename}
                  </div>
                  <div className="attachment-meta">
                    {formatFileSize(attachment.file_size)} • 
                    Uploaded by {attachment.uploaded_by_name || attachment.uploaded_by_username} • 
                    {new Date(attachment.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div className="attachment-actions">
                <button
                  onClick={() => handleDownload(attachment)}
                  className="attachment-action-btn"
                  title="Download"
                >
                  Download
                </button>
                
                {isEditing && (
                  <button
                    onClick={() => handleDelete(attachment)}
                    className="attachment-action-btn delete"
                    title="Delete"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TaskAttachments;