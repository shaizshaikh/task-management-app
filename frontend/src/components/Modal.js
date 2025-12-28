/**
 * Modern Dark Theme Modal Component
 * Consistent modal styling across the entire application
 */

import React, { useEffect, useRef } from 'react';
import './Modal.css';

const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  footer,
  size = 'medium', // small, medium, large, xlarge
  closeOnOverlayClick = true,
  showCloseButton = true
}) => {
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);

  // Handle ESC key to close modal and focus management
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      // Store the previously focused element
      previousActiveElement.current = document.activeElement;
      
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden'; // Prevent background scroll
      
      // Focus the modal after a brief delay to ensure it's rendered
      setTimeout(() => {
        if (modalRef.current) {
          const firstFocusable = modalRef.current.querySelector(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (firstFocusable) {
            firstFocusable.focus();
          } else {
            modalRef.current.focus();
          }
        }
      }, 100);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
      
      // Restore focus to the previously focused element
      if (previousActiveElement.current && !isOpen) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick} aria-hidden={!isOpen}>
      <div 
        ref={modalRef}
        className={`modal-container modal-${size}`} 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby={title ? "modal-title" : undefined}
        tabIndex="-1"
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="modal-header">
            {title && <h2 id="modal-title" className="modal-title">{title}</h2>}
            {showCloseButton && (
              <button
                className="modal-close-btn"
                onClick={onClose}
                aria-label="Close modal"
                type="button"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="modal-body">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
