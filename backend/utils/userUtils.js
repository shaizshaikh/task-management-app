/**
 * User Utility Functions
 * Shared utilities for user processing
 */

const keycloakConfig = require('../config/keycloak');

/**
 * Extract user information from JWT token
 */
function extractUserInfo(decodedToken) {
  const realmRoles = decodedToken.realm_access?.roles || [];
  const clientRoles = decodedToken.resource_access?.[keycloakConfig.keycloak.resource]?.roles || [];
  
  // Map Keycloak roles to application roles
  let globalRole = keycloakConfig.roles.default;
  for (const role of realmRoles) {
    if (keycloakConfig.roles[role]) {
      globalRole = keycloakConfig.roles[role];
      break;
    }
  }
  
  return {
    keycloak_user_id: decodedToken.sub,
    username: decodedToken.preferred_username,
    email: decodedToken.email,
    full_name: decodedToken.name || `${decodedToken.given_name || ''} ${decodedToken.family_name || ''}`.trim(),
    global_role: globalRole,
    realm_roles: realmRoles,
    client_roles: clientRoles,
    email_verified: decodedToken.email_verified || false,
    token_issued_at: decodedToken.iat,
    token_expires_at: decodedToken.exp
  };
}

module.exports = {
  extractUserInfo
};