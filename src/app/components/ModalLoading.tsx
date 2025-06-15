// components/LoadingModal.tsx
'use client'; // This component will run on the client-side

import React from 'react';

interface ModalLoadingProps {
  /**
   * Whether the loading modal is currently open and visible.
   */
  isOpen: boolean;
  /**
   * Optional message to display below the loading spinner.
   * Defaults to "Loading..."
   */
  redirect?: boolean;
}

/**
 * A full-screen, blocking loading modal component with a black and white theme.
 * Ideal for indicating asynchronous operations across the application.
 */
const ModalLoading: React.FC<ModalLoadingProps> = ({ isOpen, redirect = false }) => {
  if (!isOpen) {
    return null; // Don't render anything if the modal is not open
  }

  return (
    // Fixed overlay covering the entire viewport
    <div className={`fixed inset-0 ${!redirect ? 'bg-black bg-opacity-50' : 'bg-white'} flex items-center justify-center z-[9999]`}> {/* High z-index to ensure it's on top */}
      {/* Modal content container */}
      <div className="p-8 rounded-none max-w-sm w-full text-center flex flex-col items-center justify-center">
        {/* Loading Spinner */}
            <div className="animate-spin rounded-none h-12 w-12 border-2 border-black bg-white"></div>
      </div>
    </div>
  );
};

export default ModalLoading;