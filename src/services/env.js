/**
 * env.js — Single source of truth for all runtime configuration.
 *
 * Priority order:
 *   1. window.__ENV__   — written by deploy/docker-entrypoint.sh at container
 *                         start from container env vars. Allows reusing one
 *                         built image across environments without rebuilding.
 *   2. import.meta.env  — Vite bake-in, used during local `quasar dev` where
 *                         the entrypoint script never runs.
 *
 * Usage anywhere in the app:
 *   import { env } from 'src/services/env.js'
 *   const url = env('VITE_AGNO_API_URL', '')
 */

const runtimeEnv = typeof window !== 'undefined' ? (window.__ENV__ || {}) : {}

export function env(key, defaultValue = '') {
  // window.__ENV__ values come in as strings (written by shell script)
  const runtimeVal = runtimeEnv[key]
  if (runtimeVal !== undefined && runtimeVal !== '') return runtimeVal

  // Fallback: Vite bake-in (works for local dev + build-time overrides)
  const viteVal = import.meta.env[key]
  if (viteVal !== undefined && viteVal !== '') return viteVal

  return defaultValue
}

// Pre-resolved constants (read once at module load time)
export const ENV = {
  // Keycloak Configuration
  KEYCLOAK_URL:           env('VITE_URL_AUTH', ''),
  KEYCLOAK_REALM:         env('VITE_REALM', ''),
  KEYCLOAK_CLIENT:        env('VITE_CLIENT_ID', ''),
  KEYCLOAK_ENABLED:       env('VITE_KEYCLOAK_ENABLED', 'true') !== 'false',
  
  // Role-Based Access Control (RBAC) Configuration
  KEYCLOAK_ENFORCE_ROLES: env('VITE_KEYCLOAK_ENFORCE_ROLES', 'true') !== 'false',
  REQUIRED_ROLES:         parseRoles(env('VITE_REQUIRED_ROLES', 'admin,user')),
  MODULE_ROLE_MAP:        parseModuleRoles(env('VITE_MODULE_ROLE_MAP', '')),

  AGNO_API_URL:           env('VITE_AGNO_API_URL', '/agno'),
  MCP_API_URL:            env('VITE_MCP_API_URL', '/mcp'),
  KNOWLEDGE_API_URL:      env('VITE_KNOWLEDGE_API_URL', '/knowledge'),
}

/**
 * Parse required roles from comma-separated string
 * @param {string} rolesStr - e.g., "admin,user,manager"
 * @returns {string[]}
 */
function parseRoles(rolesStr) {
  if (!rolesStr) return []
  return rolesStr.split(',').map(r => r.trim()).filter(Boolean)
}

/**
 * Parse module-to-roles mapping from JSON string
 * @param {string} mapStr - e.g., '{"dashboard":"user","ai-platform":"admin","knowledge":"user,editor"}'
 * @returns {Object}
 */
function parseModuleRoles(mapStr) {
  if (!mapStr) return {}
  try {
    return JSON.parse(mapStr)
  } catch (e) {
    console.warn('Invalid VITE_MODULE_ROLE_MAP JSON:', e)
    return {}
  }
}