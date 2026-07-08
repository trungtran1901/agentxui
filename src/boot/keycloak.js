import { boot } from 'quasar/wrappers'
import { keycloakService } from '../services/keycloak.service.js'
import { ENV } from '../services/env.js'

export default boot(async ({ app, router }) => {
  // Set router instance on keycloak service for redirects
  keycloakService.setRouter(router)

  // Skip Keycloak entirely in local dev when VITE_KEYCLOAK_ENABLED=false
  if (!ENV.KEYCLOAK_ENABLED) {
    console.warn('[Keycloak] disabled (VITE_KEYCLOAK_ENABLED=false) — skipping SSO init')
    app.config.globalProperties.$keycloak = keycloakService
    app.provide('keycloak', keycloakService)
    return
  }

  try {
    const authenticated = await keycloakService.init()
    if (!authenticated) {
      console.warn('[Keycloak] Not authenticated — redirecting to login…')
    }

    // Auto refresh token every 30 seconds
    setInterval(async () => {
      try { await keycloakService.refreshToken() }
      catch { console.error('[Keycloak] Token refresh failed') }
    }, 30000)

    app.config.globalProperties.$keycloak = keycloakService
    app.provide('keycloak', keycloakService)
  } catch (err) {
    console.error('[Keycloak] Init failed:', err)
    throw err
  }
})