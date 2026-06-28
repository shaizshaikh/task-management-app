/**
 * Task Comments Component
 * Handles displaying and managing comments for a specific task
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useRealtime } from '../hooks/useRealtime';
import { showError, showValidationWarning, announceInfo } from '../utils/accessibleNotifications';

const TaskComments = ({ taskId }) => {
  const { user } = useAuth();
  const { subscribe } = useRealtime();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingComment, setEditingComment] = useState(null);
  const [editText, setEditText] = useState('');

  // Load comments when component mounts or taskId changes
  useEffect(() => {
    if (taskId) {
      loadComments(); // Always load to get the count
    }
  }, [taskId]);

  // Periodic cleanup to remove any duplicates that might slip through
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      setComments(prev => {
        const uniqueComments = prev.filter((comment, index, arr) => 
          arr.findIndex(c => c.id === comment.id) === index
        );
        
        if (uniqueComments.length !== prev.length) {
          console.log('💬 Cleaned up duplicate comments:', prev.length - uniqueComments.length);
          return uniqueComments;
        }
        
        return prev;
      });
    }, 30000); // Clean up every 30 seconds

    return () => clearInterval(cleanupInterval);
  }, []);

  // WebSocket event handlers for real-time comment updates using centralized realtime client
  useEffect(() => {
    if (!taskId) return;

    const unsubscribe = subscribe('commentAdded', (data) => {
      console.log('💬 Comment event received:', data);
      if (data.comment && data.comment.task_id === taskId) {
        console.log('💬 Processing comment for task', taskId, 'Comment ID:', data.comment.id, 'From user:', data.comment.user_id, 'Current user:', user?.id);
        
        // Enhanced duplicate prevention
        setComments(prev => {
          const existsById = prev.some(c => c.id === data.comment.id);
          
          if (existsById) {
            console.log('💬 Comment already exists by ID, skipping WebSocket update');
            return prev;
          }
          
          // Additional check for potential duplicates by content and timing
          const existsByContent = prev.some(c => 
            c.content === data.comment.content && 
            c.user_id === data.comment.user_id &&
            Math.abs(new Date(c.created_at) - new Date(data.comment.created_at)) < 10000 // Within 10 seconds
          );
          
          if (existsByContent) {
            console.log('💬 Comment already exists by content/timing, skipping WebSocket update');
            return prev;
          }
          
          console.log('💬 Adding new comment from WebSocket');
          return [data.comment, ...prev];
        });
        
        // Only announce for comments from other users
        if (data.comment.user_id !== user?.id) {
          announceInfo(`New comment by ${data.comment.full_name || data.comment.username}`);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [taskId, user?.id, subscribe]);

  const loadComments = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/comments/task/${taskId}`);
      // Reverse the comments so newest appear first and remove any duplicates
      const commentsData = response.data.comments || [];
      const uniqueComments = commentsData.filter((comment, index, arr) => 
        arr.findIndex(c => c.id === comment.id) === index
      );
      setComments([...uniqueComments].reverse());
    } catch (error) {
      console.error('Error loading comments:', error);
      if (error.response?.status !== 403) {
        showError('Failed to load comments', user?.globalRole);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    
    if (!newComment.trim()) {
      showValidationWarning('Please enter a comment');
      return;
    }

    setSubmitting(true);
    try {
      const response = await axios.post(`/api/comments/task/${taskId}`, {
        comment: newComment.trim()
      });
      
      // Add comment locally immediately for better UX
      const newCommentData = response.data.comment;
      setComments(prev => {
        // Check if comment already exists to prevent duplicates
        const exists = prev.some(c => c.id === newCommentData.id);
        if (exists) {
          console.log('💬 Comment already exists locally, skipping');
          return prev;
        }
        console.log('💬 Adding comment locally');
        return [newCommentData, ...prev];
      });
      
      setNewComment('');
      console.log('💬 Comment submitted and added locally');
    } catch (error) {
      console.error('Error adding comment:', error);
      showError(error.response?.data?.error?.message || 'Failed to add comment', user?.globalRole);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditComment = async (commentId) => {
    if (!editText.trim()) {
      showValidationWarning('Please enter comment text');
      return;
    }

    try {
      const response = await axios.put(`/api/comments/${commentId}`, {
        comment: editText.trim()
      });
      
      // Update comment in the list
      setComments(prev => prev.map(comment => 
        comment.id === commentId ? response.data.comment : comment
      ));
      
      setEditingComment(null);
      setEditText('');
      // Success will be announced via real-time notification system
    } catch (error) {
      console.error('Error updating comment:', error);
      showError(error.response?.data?.error?.message || 'Failed to update comment', user?.globalRole);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) {
      return;
    }

    try {
      await axios.delete(`/api/comments/${commentId}`);
      
      // Remove comment from the list
      setComments(prev => prev.filter(comment => comment.id !== commentId));
      // Success will be announced via real-time notification system
    } catch (error) {
      console.error('Error deleting comment:', error);
      showError(error.response?.data?.error?.message || 'Failed to delete comment', user?.globalRole);
    }
  };

  const startEditing = (comment) => {
    setEditingComment(comment.id);
    setEditText(comment.comment);
  };

  const cancelEditing = () => {
    setEditingComment(null);
    setEditText('');
  };

  const canEditComment = (comment) => {
    return user?.globalRole === 'admin' || comment.user_id === user?.id;
  };

  const canDeleteComment = (comment) => {
    return user?.globalRole === 'admin' || comment.user_id === user?.id;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`;
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="comments-wrapper">
      {/* Comments Toggle */}
      <div className="comments-toggle-header">
        <button
          onClick={() => setShowComments(!showComments)}
          className={`comments-toggle-btn ${showComments ? 'active' : ''}`}
        >
          Comments ({comments.length})
          <span className="comment-toggle-icon">
            {showComments ? '▼' : '▶'}
          </span>
        </button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="comments-section">
          {/* Add Comment Form */}
          <form onSubmit={handleAddComment} className="comment-form">
            <div className="comment-form-row">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                rows="2"
                className="comment-textarea"
                disabled={submitting}
              />
              <button
                type="submit"
                disabled={submitting || !newComment.trim()}
                className="comment-submit-btn"
              >
                {submitting ? 'Adding...' : 'Add'}
              </button>
            </div>
          </form>

          {/* Comments List */}
          {loading ? (
            <div className="comments-loading">
              Loading comments...
            </div>
          ) : comments.length === 0 ? (
            <div className="comments-empty">
              No comments yet. Be the first to comment!
            </div>
          ) : (
            <div className="comments-list">
              {comments.map(comment => (
                <div key={comment.id} className="comment-item">
                  {/* Comment Header */}
                  <div className="comment-header">
                    <div className="comment-author-info">
                      <div className="comment-avatar">
                        {(comment.full_name || comment.username || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="comment-author-details">
                        <div className="comment-author-name">
                          {comment.full_name || comment.username}
                        </div>
                        <div className="comment-date">
                          {formatDate(comment.created_at)}
                          {comment.updated_at !== comment.created_at && (
                            <span> • edited</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Comment Actions */}
                    <div className="comment-actions">
                      {canEditComment(comment) && (
                        <button
                          onClick={() => startEditing(comment)}
                          className="comment-action-btn"
                        >
                          Edit
                        </button>
                      )}
                      {canDeleteComment(comment) && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="comment-action-btn delete"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Comment Content */}
                  {editingComment === comment.id ? (
                    <div className="comment-edit-form">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows="2"
                        className="comment-edit-textarea"
                      />
                      <div className="comment-edit-actions">
                        <button
                          onClick={() => handleEditComment(comment.id)}
                          className="comment-edit-save"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="comment-edit-cancel"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="comment-content">
                      {comment.comment}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TaskComments;