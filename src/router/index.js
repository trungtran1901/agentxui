import { createRouter, createWebHistory } from 'vue-router'
import { routes } from './routes.js'
import { keycloakService } from 'src/services/keycloak.service'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL || '/'),
  routes
})

// Global guard: if Keycloak init determined accessDenied, block all navigation
router.beforeEach((to, from, next) => {
  // Always allow the unauthorized page itself
  if (to.name === 'unauthorized') return next()

  // If service flagged access denied, redirect all routes to unauthorized
  if (keycloakService && keycloakService.accessDenied) {
    return next({ name: 'unauthorized' })
  }

  next()
})

export default router
