import axios from 'axios'
import { ENV } from '../env.js'
import { keycloakService } from '../keycloak.service.js'

/**
 * quota.client.js — Quota Management (FEATURE_QUOTA_MANAGEMENT)
 *
 * Additive, feature-flagged surface on the Agno Runtime backend
 * (same base URL + /api/v1 as agno-runtime.client.js). 404 under /quota
 * means the feature flag is off — callers should treat 404 as "not
 * available", never as a hard error. Use `isAvailable()` (cached) to
 * probe once per session instead of per-request.
 *
 * PUT /quota/policies/{id} only accepts a subset of fields — scope_type,
 * scope_value, model_id, metric, and period are immutable after creation.
 * To change any of those, delete the policy and create a new one.
 */

const MAX_PAGE_SIZE = 200

class QuotaClient {
  constructor() {
    const BASE_URL = ENV.AGNO_API_URL

    this.http = axios.create({
      baseURL: BASE_URL + '/api/v1',
      timeout: 30000,
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
          console.error(`[Quota] ${d?.error_code || err.message}:`, d?.message)
        }
        return Promise.reject(err)
      }
    )

    this._availabilityPromise = null
  }

  /** Cached, one-shot feature-flag probe. */
  async isAvailable() {
    if (!this._availabilityPromise) {
      this._availabilityPromise = this.http
        .get('/quota/policies', { params: { page_size: 1 } })
        .then(() => true)
        .catch((e) => {
          if (e.response?.status === 404) return false
          this._availabilityPromise = null
          return false
        })
    }
    return this._availabilityPromise
  }

  // =============================================
  // POLICIES
  // =============================================

  /** GET /quota/policies?scope_type=&scope_value=&page=&page_size= */
  async listPolicies({ scope_type, scope_value, page, page_size } = {}) {
    const params = {}
    if (scope_type) params.scope_type = scope_type
    if (scope_value) params.scope_value = scope_value
    if (page != null) params.page = page
    if (page_size != null) params.page_size = Math.min(page_size, MAX_PAGE_SIZE)
    const { data } = await this.http.get('/quota/policies', { params })
    return data // { items, total, page, page_size, has_next }
  }

  async getPolicy(id) {
    const { data } = await this.http.get(`/quota/policies/${id}`)
    return data
  }

  /** POST /quota/policies — 409 conflict if (scope_type, scope_value, model_id, metric, period) already exists */
  async createPolicy(body) {
    const { data } = await this.http.post('/quota/policies', body)
    return data
  }

  /** PUT /quota/policies/{id} — only limit_value/priority/enabled/window_seconds are mutable */
  async updatePolicy(id, body) {
    const { data } = await this.http.put(`/quota/policies/${id}`, body)
    return data
  }

  /** DELETE /quota/policies/{id} — 204, soft delete */
  async deletePolicy(id) {
    await this.http.delete(`/quota/policies/${id}`)
  }

  // =============================================
  // USAGE
  // =============================================

  /** GET /quota/usage?user_id=&since_days= */
  async getUsage({ user_id, since_days } = {}) {
    const { data } = await this.http.get('/quota/usage', { params: { user_id, since_days } })
    return data // { user_id, since_days, tokens, requests, cost_usd, granularity, timeseries }
  }

  /**
   * GET /quota/users?since_days=&sort_by=&page=&page_size=
   * Distinct users with usage in the window, with aggregate totals.
   * `username`/`email` are populated by the backend only when
   * FEATURE_KEYCLOAK_ADMIN_API is also on — null otherwise, in which case
   * callers should resolve via keycloakAdminClient.resolveUsers().
   */
  async listUsers({ since_days, sort_by, page, page_size } = {}) {
    const params = {}
    if (since_days != null) params.since_days = since_days
    if (sort_by) params.sort_by = sort_by
    if (page != null) params.page = page
    if (page_size != null) params.page_size = Math.min(page_size, MAX_PAGE_SIZE)
    const { data } = await this.http.get('/quota/users', { params })
    return data // { items, total, page, page_size, has_next }
  }
}

export const quotaClient = new QuotaClient()