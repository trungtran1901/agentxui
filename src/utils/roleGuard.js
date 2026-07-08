/**
 * roleGuard.js - Route protection utilities for role-based access control
 */

import { keycloakService } from 'src/services/keycloak.service'

/**
 * Create a route guard that checks if user has required roles
 * @param {string|string[]} requiredRoles - Role(s) required to access the route
 * @param {boolean} requireAll - If true, user must have ALL roles. If false, ANY role is sufficient
 * @returns {Function} - Route guard function
 */
export function createRoleGuard(requiredRoles, requireAll = false) {
  return (to, from, next) => {
    if (!keycloakService.isAuthenticated()) {
      next({ name: 'login' })
      return
    }

    const hasAccess = requireAll 
      ? keycloakService.hasAllRoles(requiredRoles)
      : keycloakService.hasAnyRole(requiredRoles)

    if (hasAccess) {
      next()
    } else {
      console.warn(
        `Access denied to route ${to.path}. Required roles: ${Array.isArray(requiredRoles) ? requiredRoles.join(', ') : requiredRoles}`
      )
      next({ name: 'unauthorized' })
    }
  }
}

/**
 * Create a route guard for module-level access
 * @param {string} moduleName - Module identifier
 * @returns {Function} - Route guard function
 */
export function createModuleGuard(moduleName) {
  return (to, from, next) => {
    if (!keycloakService.isAuthenticated()) {
      next({ name: 'login' })
      return
    }

    if (keycloakService.hasModuleAccess(moduleName)) {
      next()
    } else {
      console.warn(`Access denied to module: ${moduleName}`)
      next({ name: 'unauthorized' })
    }
  }
}

/**
 * Check if user has role (synchronous, for component-level checks)
 * @param {string|string[]} roles - Role(s) to check
 * @param {boolean} requireAll - If true, user must have ALL roles
 * @returns {boolean}
 */
export function checkRole(roles, requireAll = false) {
  if (!keycloakService.isAuthenticated()) {
    return false
  }
  
  return requireAll 
    ? keycloakService.hasAllRoles(roles)
    : keycloakService.hasAnyRole(roles)
}

/**
 * Check if user has module access (synchronous)
 * @param {string} moduleName
 * @returns {boolean}
 */
export function checkModuleAccess(moduleName) {
  if (!keycloakService.isAuthenticated()) {
    return false
  }
  
  return keycloakService.hasModuleAccess(moduleName)
}

/**
 * Get user's current roles
 * @returns {string[]}
 */
export function getUserRoles() {
  return keycloakService.getUserRoles()
}
