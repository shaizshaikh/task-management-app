/**
 * Keycloak Configuration
 * Configures Keycloak client for authentication
 */

import Keycloak from 'keycloak-js';

// Dynamic Keycloak URL based on current domain
const getKeycloakUrl = () => {
  // If environment variable is set, use it
  if (process.env.REACT_APP_KEYCLOAK_URL) {
    return process.env.REACT_APP_KEYCLOAK_URL;
  }
  
  // Otherwise, use current domain with port 8081
  const currentHost = window.location.hostname;
  return `http://${currentHost}:8081`;
};

// Keycloak configuration - dynamic based on current domain
const keycloakConfig = {
  url: getKeycloakUrl(),
  realm: process.env.REACT_APP_KEYCLOAK_REALM || 'task-management',
  clientId: process.env.REACT_APP_KEYCLOAK_CLIENT_ID || 'task-management-frontend'
};

// Initialize Keycloak instance
const keycloak = new Keycloak(keycloakConfig);

// Keycloak initialization options
export const keycloakInitOptions = {
  onLoad: 'check-sso', // Check if user is already logged in
  silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
  checkLoginIframe: false, // Disable iframe check for development
  pkceMethod: 'S256' // Use PKCE for security
};

export default keycloak;