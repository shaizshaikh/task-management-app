/**
 * Accessible Notification Utilities
 * Provides screen reader announcements and replaces toast notifications
 * with proper real-time notifications for user actions
 */

import { toast } from 'react-toastify';

/**
 * Announce message to screen readers using ARIA live regions
 */
export const announceToScreenReader = (message, priority = 'polite') => {
  // Create or get existing live region
  let liveRegion = document.getElementById('sr-live-region');
  
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'sr-live-region';
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.style.position = 'absolute';
    liveRegion.style.left = '-10000px';
    liveRegion.style.width = '1px';
    liveRegion.style.height = '1px';
    liveRegion.style.overflow = 'hidden';
    document.body.appendChild(liveRegion);
  }
  
  // Update the live region content
  liveRegion.textContent = message;
  
  // Clear after announcement to allow repeated messages
  setTimeout(() => {
    if (liveRegion.textContent === message) {
      liveRegion.textContent = '';
    }
  }, 1000);
};

/**
 * Show error toast (admin only) or console error for others
 */
export const showError = (message, userRole = null) => {
  console.error('Application Error:', message);
  
  // Only show toast errors to admins
  if (userRole === 'admin') {
    toast.error(message, {
      position: 'top-right',
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true
    });
  }
  
  // Always announce errors to screen readers
  announceToScreenReader(`Error: ${message}`, 'assertive');
};

/**
 * Show validation warning (for invalid user operations)
 */
export const showValidationWarning = (message) => {
  toast.warning(message, {
    position: 'top-center',
    autoClose: 4000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true
  });
  
  // Announce validation issues to screen readers
  announceToScreenReader(`Validation: ${message}`, 'assertive');
};

/**
 * Show system error (admin only)
 */
export const showSystemError = (message, userRole = null) => {
  console.error('System Error:', message);
  
  if (userRole === 'admin') {
    toast.error(`System Error: ${message}`, {
      position: 'top-right',
      autoClose: 8000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true
    });
  }
  
  announceToScreenReader(`System error: ${message}`, 'assertive');
};

/**
 * Announce successful action completion (replaces success toasts)
 */
export const announceSuccess = (message) => {
  console.log('Action completed:', message);
  announceToScreenReader(`Success: ${message}`, 'polite');
};

/**
 * Announce information (replaces info toasts)
 */
export const announceInfo = (message) => {
  console.log('Information:', message);
  announceToScreenReader(message, 'polite');
};

/**
 * Enhanced notification announcement for real-time events
 */
export const announceNotification = (notification) => {
  const message = `${notification.title}: ${notification.message}`;
  const priority = notification.priority === 'high' ? 'assertive' : 'polite';
  
  console.log('New notification:', message);
  announceToScreenReader(message, priority);
};

/**
 * Connection status announcements (less intrusive)
 */
export const announceConnectionStatus = (status, userRole = null) => {
  const message = status === 'connected' 
    ? 'Real-time updates connected' 
    : 'Real-time updates disconnected';
  
  console.log('Connection status:', message);
  
  // Only announce connection changes to screen readers, no toasts
  announceToScreenReader(message, 'polite');
};

/**
 * Initialize accessible notifications system
 */
export const initializeAccessibleNotifications = () => {
  // Create the live region on app startup
  if (!document.getElementById('sr-live-region')) {
    announceToScreenReader(''); // This will create the live region
  }
  
  console.log('Accessible notifications system initialized');
};