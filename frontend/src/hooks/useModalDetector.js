/**
 * Custom Hook: useModalDetector
 * Detects when any modal is open in the application by observing the DOM
 * Returns true when a modal is open, false otherwise
 */

import { useState, useEffect } from 'react';

const useModalDetector = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // Function to check if any modal is currently in the DOM
    const checkForModal = () => {
      const modalOverlay = document.querySelector('.modal-overlay, .manager-modal-overlay');
      setIsModalOpen(!!modalOverlay);
    };

    // Initial check
    checkForModal();

    // Create a MutationObserver to watch for modal additions/removals
    const observer = new MutationObserver(() => {
      checkForModal();
    });

    // Observe the entire document body for changes
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Cleanup
    return () => {
      observer.disconnect();
    };
  }, []);

  return isModalOpen;
};

export default useModalDetector;
