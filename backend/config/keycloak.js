/**
 * Keycloak Configuration
 * Handles Keycloak client setup and JWT validation
 */

require('dotenv').config();

// Keycloak configuration based on realm-export.json
const keycloakConfig = {
  realm: process.env.KEYCLOAK_REALM || 'task-management',
  'auth-server-url': process.env.KEYCLOAK_URL || 'http://keycloak:8080',
  'ssl-required': 'external',
  resource: process.env.KEYCLOAK_CLIENT_ID || 'task-management-frontend',
  'public-client': true,
  'confidential-port': 0,
  'verify-token-audience': true
};

// JWT validation configuration - accept multiple issuers for network access
const externalKeycloakUrl = process.env.KEYCLOAK_EXTERNAL_URL || 'http://localhost:8081';
const internalKeycloakUrl = keycloakConfig['auth-server-url']; // Use internal URL for JWKS
const jwtConfig = {
  // Accept multiple possible issuers for network access flexibility
  issuer: [
    `${externalKeycloakUrl}/realms/${keycloakConfig.realm}`,
    `http://localhost:8081/realms/${keycloakConfig.realm}`,
    // Accept any IP address on port 8081 for network access
    new RegExp(`^http://[\\d\\.]+:8081/realms/${keycloakConfig.realm}$`)
  ],
  audience: false, // Disable audience validation for now
  algorithms: ['RS256'],
  jwksUri: `${internalKeycloakUrl}/realms/${keycloakConfig.realm}/protocol/openid-connect/certs`
};

// Role mappings from Keycloak to application
const roleMappings = {
  // Global roles (realm roles)
  'admin': 'admin',
  'manager': 'manager', 
  'member': 'member',
  'viewer': 'viewer',
  
  // Default role for users without specific roles
  'default': 'member'
};

// Environment-specific configuration
const config = {
  keycloak: keycloakConfig,
  jwt: jwtConfig,
  roles: roleMappings,
  
  // API endpoints
  endpoints: {
    userInfo: `${keycloakConfig['auth-server-url']}/realms/${keycloakConfig.realm}/protocol/openid-connect/userinfo`,
    token: `${keycloakConfig['auth-server-url']}/realms/${keycloakConfig.realm}/protocol/openid-connect/token`,
    logout: `${keycloakConfig['auth-server-url']}/realms/${keycloakConfig.realm}/protocol/openid-connect/logout`,
    adminUsers: `${keycloakConfig['auth-server-url']}/admin/realms/${keycloakConfig.realm}/users`
  },
  
  // Token validation settings
  validation: {
    clockTolerance: 30, // seconds
    maxAge: '5m', // 5 minutes
    ignoreExpiration: false,
    ignoreNotBefore: false
  }
};

module.exports = config;