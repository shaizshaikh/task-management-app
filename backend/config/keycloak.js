/**
 * Keycloak Configuration
 * Handles Keycloak client setup and JWT validation via Nginx proxy
 */

require('dotenv').config();

// Keycloak configuration - now proxied through Nginx
const keycloakConfig = {
  realm: process.env.KEYCLOAK_REALM || 'task-management',
  'auth-server-url': process.env.KEYCLOAK_URL || 'http://keycloak-service:8080',
  'ssl-required': 'external',
  resource: process.env.KEYCLOAK_CLIENT_ID || 'task-management-frontend',
  'public-client': true,
  'confidential-port': 0,
  'verify-token-audience': true
};

// JWT validation configuration - simplified for reverse proxy
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
const jwtConfig = {
  // Accept tokens from any issuer (disable issuer validation)
  issuer: false,
  audience: false, // Disable audience validation
  algorithms: ['RS256'],
  // Use internal URL for JWKS (container-to-container communication)
  jwksUri: `${process.env.KEYCLOAK_URL || 'http://keycloak-service:8080'}/auth/realms/${keycloakConfig.realm}/protocol/openid-connect/certs`
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
  
  // API endpoints - use internal URLs for backend-to-keycloak communication
  endpoints: {
    userInfo: `${process.env.KEYCLOAK_URL || 'http://keycloak-service:8080'}/auth/realms/${keycloakConfig.realm}/protocol/openid-connect/userinfo`,
    token: `${process.env.KEYCLOAK_URL || 'http://keycloak-service:8080'}/auth/realms/${keycloakConfig.realm}/protocol/openid-connect/token`,
    logout: `${process.env.KEYCLOAK_URL || 'http://keycloak-service:8080'}/auth/realms/${keycloakConfig.realm}/protocol/openid-connect/logout`,
    adminUsers: `${process.env.KEYCLOAK_URL || 'http://keycloak-service:8080'}/admin/realms/${keycloakConfig.realm}/users`
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