import Keycloak from 'keycloak-js'
import { ENV } from './env.js'

class KeycloakService {
  constructor() {
    this.keycloak = null
    this.router = null
    this.accessDenied = false
  }

  /**
   * Set router instance (called from boot process)
   * @param {Router} routerInstance
   */
  setRouter(routerInstance) {
    this.router = routerInstance
  }

  init() {
    this.keycloak = new Keycloak({
      url:      ENV.KEYCLOAK_URL,
      realm:    ENV.KEYCLOAK_REALM,
      clientId: ENV.KEYCLOAK_CLIENT
    })

    return this.keycloak.init({
      onLoad: 'login-required',
      checkLoginIframe: false,
      enableLogging: true,
      flow: 'implicit'
    }).then(() => {
      if (ENV.KEYCLOAK_ENFORCE_ROLES) {
        return this._enforceRequiredRoles()
      }
    })
  }

  getToken() {
    return this.keycloak?.token || localStorage.getItem('auth_token') || null
  }

  getUserId() {
    return this.keycloak?.tokenParsed?.sub || null
  }

  getUserInfo() {
    const parsed = this.keycloak?.tokenParsed || {}
    return {
      sub:              parsed.sub,
      email:            parsed.email,
      name:             parsed.name || parsed.preferred_username,
      username:         parsed.preferred_username,
      realmRoles:       parsed.realm_access?.roles || [],
      clientRoles:      parsed.resource_access?.[ENV.KEYCLOAK_CLIENT]?.roles || [],
      groups:           parsed.groups || []
    }
  }

  isAuthenticated() { 
    return !!this.keycloak?.authenticated 
  }

  /**
   * Check if user has a specific realm role
   * @param {string} role - Role name
   * @returns {boolean}
   */
  hasRealmRole(role) {
    const userInfo = this.getUserInfo()
    return userInfo.realmRoles.includes(role)
  }

  /**
   * Check if user has a specific client role
   * @param {string} role - Role name
   * @returns {boolean}
   */
  hasClientRole(role) {
    const userInfo = this.getUserInfo()
    return userInfo.clientRoles.includes(role)
  }

  /**
   * Check if user has ANY of the specified roles (realm or client)
   * @param {string|string[]} roles - Role name(s)
   * @returns {boolean}
   */
  hasAnyRole(roles) {
    const roleList = Array.isArray(roles) ? roles : [roles]
    const userInfo = this.getUserInfo()
    const allRoles = [...userInfo.realmRoles, ...userInfo.clientRoles]
    return roleList.some(role => allRoles.includes(role))
  }

  /**
   * Check if user has ALL of the specified roles
   * @param {string|string[]} roles - Role name(s)
   * @returns {boolean}
   */
  hasAllRoles(roles) {
    const roleList = Array.isArray(roles) ? roles : [roles]
    const userInfo = this.getUserInfo()
    const allRoles = [...userInfo.realmRoles, ...userInfo.clientRoles]
    return roleList.every(role => allRoles.includes(role))
  }

  /**
   * Check if user has required roles for a specific module
   * @param {string} moduleName - Module identifier (e.g., 'dashboard', 'ai-platform')
   * @returns {boolean}
   */
  hasModuleAccess(moduleName) {
    const moduleRoles = ENV.MODULE_ROLE_MAP[moduleName]
    if (!moduleRoles) {
      // If module not in map, allow access (not restricted)
      return true
    }
    
    const requiredRoles = Array.isArray(moduleRoles) ? moduleRoles : [moduleRoles]
    return this.hasAnyRole(requiredRoles)
  }

  /**
   * Get user's roles combined (realm + client)
   * @returns {string[]}
   */
  getUserRoles() {
    const userInfo = this.getUserInfo()
    return [...new Set([...userInfo.realmRoles, ...userInfo.clientRoles])]
  }

  /**
   * Enforce minimum required roles - redirect to 401 if user doesn't have required roles
   * @private
   * @returns {Promise<void>}
   */
  async _enforceRequiredRoles() {
    if (!ENV.KEYCLOAK_ENFORCE_ROLES || ENV.REQUIRED_ROLES.length === 0) {
      return
    }

    const hasRequiredRoles = this.hasAnyRole(ENV.REQUIRED_ROLES)
    if (!hasRequiredRoles) {
      console.error(
        `User doesn't have required roles. Required: ${ENV.REQUIRED_ROLES.join(', ')}, User has: ${this.getUserRoles().join(', ')}`
      )
      // Mark access denied and redirect to 401 page if router is available.
      // Do NOT throw here — throwing during Quasar boot causes the app to fail to mount
      this.accessDenied = true
      if (this.router && typeof this.router.push === 'function') {
        try {
          // navigate but don't await to avoid blocking
          this.router.push({ name: 'unauthorized' })
        } catch (err) {
          console.error('Failed to navigate to /401:', err)
        }
      }

      // Return false so callers can react, but do not rethrow
      return false
    }
  }

  logout() { 
    return this.keycloak?.logout({ redirectUri: window.location.origin }) 
  }

  refreshToken() { 
    return this.keycloak?.updateToken(30) 
  }
}

export const keycloakService = new KeycloakService()