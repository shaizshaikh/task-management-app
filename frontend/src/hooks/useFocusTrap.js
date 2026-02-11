/**
 * Custom Hook: useFocusTrap
 * Implements WCAG 2.1 compliant focus trap for modals
 * Traps Tab/Shift+Tab navigation within a container element
 * 
 * Usage:
 * const modalRef = useFocusTrap(isOpen);
 * <div ref={modalRef} role="dialog" aria-modal="true">...</div>
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
  '[tabindex]:not([tabindex="-1"])'
].join(',');

const useFocusTrap = (isActive = true) => {
  const containerRef = useRef(null);
  const previousActiveElement = useRef(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;

    // Store the element that had focus before modal opened
    previousActiveElement.current = document.activeElement;

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

    // Focus first element or container
    const focusFirstElement = () => {
      const focusableElements = getFocusableElements();
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      } else if (container.hasAttribute('tabindex')) {
        container.focus();
      }
    };

    // Focus first element after a brief delay to ensure DOM is ready
    requestAnimationFrame(() => {
      setTimeout(focusFirstElement, 50);
    });

    // Handle Tab and Shift+Tab to trap focus
    const handleKeyDown = (e) => {
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
        }, 0);
      }
    };
  }, [isActive]);

  return containerRef;
};

export default useFocusTrap;
