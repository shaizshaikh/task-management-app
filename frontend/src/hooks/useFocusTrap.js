/**
 * Custom Hook: useFocusTrap
 * Implements WCAG 2.1 compliant focus trap for modals
 * Traps Tab/Shift+Tab navigation within a container element
 * 
 * Usage:
 * const modalRef = useFocusTrap(isOpen, onEscape);
 * <div ref={modalRef} role="dialog" aria-modal="true">...</div>
 * 
 * @param {boolean} isActive - Whether the focus trap is active
 * @param {function} onEscape - Optional callback when Escape key is pressed
 */

import { useEffect, useRef } from 'react';

const FOCUSABLE_ELEMENTS = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable]',
  '[tabindex]:not([tabindex="-1"])',
  '[role="button"]:not([disabled])'
].join(',');

const useFocusTrap = (isActive = true, onEscape = null) => {
  const containerRef = useRef(null);
  const previousActiveElement = useRef(null);
  const hasInitializedFocus = useRef(false);
  const onEscapeRef = useRef(onEscape);

  // Update the escape callback ref without triggering re-render
  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!isActive || !containerRef.current) {
      hasInitializedFocus.current = false;
      return;
    }

    const container = containerRef.current;

    // Store the element that had focus before modal opened (only once)
    if (!previousActiveElement.current) {
      previousActiveElement.current = document.activeElement;
    }

    // Set aria-hidden on main content
    const mainContent = document.getElementById('main-content');
    const appBody = document.querySelector('.app-body');
    if (mainContent) mainContent.setAttribute('aria-hidden', 'true');
    if (appBody) appBody.setAttribute('aria-hidden', 'true');

    // Get all focusable elements within the container
    const getFocusableElements = () => {
      return Array.from(container.querySelectorAll(FOCUSABLE_ELEMENTS))
        .filter(el => {
          // Filter out elements that are not visible or have display: none
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && 
                 style.visibility !== 'hidden' && 
                 el.offsetParent !== null;
        });
    };

    // Focus first element or container (only on initial mount)
    const focusFirstElement = () => {
      if (hasInitializedFocus.current) return;
      
      const focusableElements = getFocusableElements();
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      } else if (container.hasAttribute('tabindex')) {
        container.focus();
      }
      hasInitializedFocus.current = true;
    };

    // Focus first element after a brief delay to ensure DOM is ready
    const timeoutId = setTimeout(focusFirstElement, 100);

    // Handle Tab and Shift+Tab to trap focus
    const handleKeyDown = (e) => {
      // Handle Escape key using the ref
      if (e.key === 'Escape' && onEscapeRef.current) {
        onEscapeRef.current(e);
        return;
      }

      if (e.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // Shift+Tab on first element -> focus last element
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
      // Tab on last element -> focus first element
      else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };

    // Add event listener
    container.addEventListener('keydown', handleKeyDown);

    // Cleanup function
    return () => {
      clearTimeout(timeoutId);
      container.removeEventListener('keydown', handleKeyDown);

      // Remove aria-hidden from main content
      if (mainContent) mainContent.removeAttribute('aria-hidden');
      if (appBody) appBody.removeAttribute('aria-hidden');

      // Restore focus to the element that opened the modal
      if (previousActiveElement.current && previousActiveElement.current.focus) {
        // Use setTimeout to ensure modal is fully closed before restoring focus
        setTimeout(() => {
          if (previousActiveElement.current && previousActiveElement.current.focus) {
            previousActiveElement.current.focus();
          }
          previousActiveElement.current = null;
        }, 0);
      }
      
      // Reset the flag when modal closes
      hasInitializedFocus.current = false;
    };
  }, [isActive]); // Only depend on isActive

  return containerRef;
};

export default useFocusTrap;
