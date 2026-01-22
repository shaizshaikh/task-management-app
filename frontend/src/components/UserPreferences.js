/**
 * User Preferences Component
 * Simple preferences for theme, notifications, etc.
 */

import React, { useState } from 'react';
import { toast } from 'react-toastify';

const UserPreferences = ({ isOpen, onClose }) => {
  const [preferences, setPreferences] = useState({
    theme: 'dark',
    notifications: true,
    emailNotifications: true,
    language: 'en'
  });

  const handleSave = () => {
    // TODO: Save to backend/localStorage
    toast.success('Preferences saved successfully!');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="mb-0">Preferences</h2>
          <button 
            className="modal-close"
            onClick={onClose}
            aria-label="Close preferences"
          >
            ✕
          </button>
        </div>
        
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label" htmlFor="theme-select">
              Theme
            </label>
            <select
              id="theme-select"
              className="form-input"
              value={preferences.theme}
              onChange={(e) => setPreferences({...preferences, theme: e.target.value})}
            >
              <option value="dark">Dark Theme</option>
              <option value="light">Light Theme (Coming Soon)</option>
              <option value="auto">Auto (System)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">
              <input
                type="checkbox"
                checked={preferences.notifications}
                onChange={(e) => setPreferences({...preferences, notifications: e.target.checked})}
                className="mr-2"
              />
              Enable browser notifications
            </label>
          </div>

          <div className="form-group">
            <label className="form-label">
              <input
                type="checkbox"
                checked={preferences.emailNotifications}
                onChange={(e) => setPreferences({...preferences, emailNotifications: e.target.checked})}
                className="mr-2"
              />
              Enable email notifications
            </label>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="language-select">
              Language
            </label>
            <select
              id="language-select"
              className="form-input"
              value={preferences.language}
              onChange={(e) => setPreferences({...preferences, language: e.target.value})}
            >
              <option value="en">English</option>
              <option value="es">Español (Coming Soon)</option>
              <option value="fr">Français (Coming Soon)</option>
            </select>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save Preferences
          </button>
        </div>

        <style jsx>{`
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: var(--bg-overlay);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1040;
          }

          .modal-content {
            background-color: var(--bg-secondary);
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow-xl);
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
          }

          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: var(--spacing-lg);
            border-bottom: 1px solid var(--border-primary);
          }

          .modal-close {
            background: none;
            border: none;
            font-size: 1.5rem;
            color: var(--text-secondary);
            cursor: pointer;
            padding: var(--spacing-xs);
            border-radius: var(--radius-md);
            transition: all var(--animation-duration) ease-in-out;
          }

          .modal-close:hover {
            background-color: var(--bg-tertiary);
            color: var(--text-primary);
          }

          .modal-body {
            padding: var(--spacing-lg);
          }

          .modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: var(--spacing-md);
            padding: var(--spacing-lg);
            border-top: 1px solid var(--border-primary);
          }

          .mr-2 {
            margin-right: var(--spacing-sm);
          }
        `}</style>
      </div>
    </div>
  );
};

export default UserPreferences;