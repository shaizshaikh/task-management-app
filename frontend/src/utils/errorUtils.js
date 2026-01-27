/**
 * Error Handling Utilities
 * Standardized error message extraction and handling
 */

/**
 * Extract error message from axios error response
 * Handles the '_t' query parameter pollution issue
 */
export const extractErrorMessage = (error, fallbackMessage = 'Operation failed') => {
  let errorMessage = fallbackMessage;
  
  // Handle timeout errors specifically
  if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
    return 'Request timed out. The operation may have completed successfully.';
  }
  
  // Handle different error response structures
  if (error.response?.data) {
    const data = error.response.data;
    if (data.error?.message) {
      errorMessage = data.error.message;
    } else if (data.message) {
      errorMessage = data.message;
    } else if (typeof data === 'string') {
      errorMessage = data;
    }
  } else if (error.message && error.message !== 'Network Error') {
    errorMessage = error.message;
  }
  
  // Handle query parameter pollution (cache-busting parameters logged as errors)
  // Also handle single character or very short meaningless errors
  if (errorMessage === '_t' || 
      errorMessage === '_refresh' || 
      errorMessage.match(/^[_a-zA-Z0-9]{1,3}$/) ||
      errorMessage === 'Request failed with status code 200' ||
      errorMessage === 'Request failed with status code 201') {
    console.warn('Meaningless error message detected, treating as success:', errorMessage);
    return null; // Indicates this should be treated as success
  }
  
  return errorMessage;
};

/**
 * Handle API errors consistently across components
 */
export const handleApiError = (error, successMessage, fallbackMessage) => {
  const errorMessage = extractErrorMessage(error, fallbackMessage);
  
  // If error message is a query parameter, treat as success
  if (errorMessage === null) {
    return { success: true, message: successMessage };
  }
  
  return { success: false, message: errorMessage };
};