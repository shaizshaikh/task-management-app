/**
 * Focus Trap Modal Wrapper
 * Wraps inline modal content with WCAG 2.1 compliant focus trap
 * 
 * Usage:
 * <FocusTrapModal isOpen={showModal} onClose={handleClose} className="modal-overlay">
 *   <div className="modal-content">
 *     ... modal content ...
 *   </div>
 * </FocusTrapModal>
 */

import React, { useEffect, useCallback } from 'react';
import useFocusTrap from '../hooks/useFocusTrap';

const FocusTrapModal = ({ 
  isOpen, 
  onClose, 
  children, 
  className = 'modal-overlay',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy
}) => {
  const modalRef = useFocusTrap(isOpen);

  // Handle escape key
  const handleEscape = useCallback((e) => {
    if (closeOnEscape && e.key === 'Escape' && isOpen) {
      onClose();
    }
  }, [closeOnEscape, isOpen, onClose]);

  // Handle overlay click
  const handleOverlayClick = useCallback((e) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  }, [closeOnOverlayClick, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  return (
    <div 
      className={className}
      onClick={handleOverlayClick}
      aria-hidden={!isOpen}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        tabIndex="-1"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

export default FocusTrapModal;
