import axios from 'axios'
import { ENV } from '../env.js'
import { keycloakService } from '../keycloak.service.js'

/**
 * keycloak-admin.client.js — Keycloak User Lookup (FEATURE_KEYCLOAK_ADMIN_API)
 *
 * Additive, feature-flagged surface on the Agno Runtime backend (same base
 * URL + /api/v1). 404 under /keycloak/users means the flag is off —
 * callers should treat 404 as "not available" and fall back to a plain
 * text input for user ids instead of an autocomplete/resolve UX.
 *
 * Two operations:
 *   GET /keycloak/users          — search-as-you-type user picker
 *   GET /keycloak/users/resolve  — batch userID -> {username, email, ...}
 *
 * resolveUsers() never throws for individual unknown ids — the backend
 * returns `null` for those keys, and callers should render a fallback
 * (e.g. the raw id truncated) rather than treat it as an error.
 */

class KeycloakAdminClient {
  constructor() {
    const BASE_URL = ENV.AGNO_API_URL

    this.http = axios.create({
      baseURL: BASE_URL + '/api/v1',
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' }
    })

    this.http.interceptors.request.use((config) => {
      const token = keycloakService.getToken()
      if (token) config.headers.Authorization = `Bearer ${token}`
      return config
    })

    this.http.interceptors.response.use(
      r => r,
      (err) => {
        if (err.response?.status !== 404) {
          const d = err.response?.data
          console.error(`[KeycloakAdmin] ${d?.error_code || err.message}:`, d?.message)
        }
        return Promise.reject(err)
      }
    )

    this._availabilityPromise = null
    // Small in-memory cache on top of the backend's 5-min Redis cache —
    // avoids re-resolving the same ids repeatedly while paging within a
    // single session (backend note recommends this pattern explicitly).
    this._resolveCache = new Map()
  }

  /** Cached, one-shot feature-flag probe. */
  async isAvailable() {
    if (!this._availabilityPromise) {
      this._availabilityPromise = this.http
        .get('/keycloak/users', { params: { max_results: 1 } })
        .then(() => true)
        .catch((e) => {
          if (e.response?.status === 404) return false
          this._availabilityPromise = null
          return false
        })
    }
    return this._availabilityPromise
  }

  /** GET /keycloak/users?search=&first=&max_results= */
  async searchUsers({ search, first, max_results } = {}) {
    const params = {}
    if (search) params.search = search
    if (first != null) params.first = first
    if (max_results != null) params.max_results = Math.min(max_results, 100)
    const { data } = await this.http.get('/keycloak/users', { params })
    return data // [{ id, username, email, first_name, last_name, enabled }]
  }

  /**
   * GET /keycloak/users/resolve?ids=a,b,c
   * @param {string[]} ids
   * @returns {Promise<Record<string, object|null>>}
   */
  async resolveUsers(ids) {
    const unique = [...new Set((ids || []).filter(Boolean))]
    if (!unique.length) return {}

    const uncached = unique.filter(id => !this._resolveCache.has(id))
    if (uncached.length) {
      const { data } = await this.http.get('/keycloak/users/resolve', { params: { ids: uncached.join(',') } })
      Object.entries(data || {}).forEach(([id, info]) => this._resolveCache.set(id, info))
    }

    const result = {}
    unique.forEach(id => { result[id] = this._resolveCache.get(id) ?? null })
    return result
  }

  /** Display helper — username, else email, else a truncated id. */
  displayLabel(info, fallbackId) {
    if (info?.username) return info.username
    if (info?.email) return info.email
    return fallbackId ? `${fallbackId.substring(0, 12)}…` : 'unknown'
  }
}

export const keycloakAdminClient = new KeycloakAdminClient()