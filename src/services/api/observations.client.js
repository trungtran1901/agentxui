import axios from 'axios'
import { ENV } from '../env.js'
import { keycloakService } from '../keycloak.service.js'

/**
 * observations.client.js — v2 Runtime Observations
 *
 * GET /api/v1/observations?run_id=&page=&page_size= is the only documented
 * operation — Observations are written by the backend during a run
 * (knowledge retrieval, skill output, etc.); there is no create/update/
 * delete surface for the UI. 404 = feature disabled, same convention as
 * every other v2 endpoint in this app.
 */

/** observation_type enum (documented, exhaustive). */
export const OBSERVATION_TYPES = [
  'KNOWLEDGE_RETRIEVAL', 'SKILL_OUTPUT', 'BUSINESS_RESPONSE', 'UI_RESULT', 'WARNING', 'ERROR'
]

const MAX_PAGE_SIZE = 200

class ObservationsClient {
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
          console.error(`[Observations] ${d?.error_code || err.message}:`, d?.message)
        }
        return Promise.reject(err)
      }
    )

    this._availabilityPromise = null
  }

  /** Cached, one-shot feature-flag probe — same pattern as every other v2 client. */
  async isAvailable() {
    if (!this._availabilityPromise) {
      this._availabilityPromise = this.http
        .get('/observations', { params: { page_size: 1 } })
        .then(() => true)
        .catch((e) => {
          if (e.response?.status === 404) return false
          this._availabilityPromise = null
          return false
        })
    }
    return this._availabilityPromise
  }

  /** GET /observations?run_id=&page=&page_size= */
  async list({ run_id, page, page_size } = {}) {
    const params = {}
    if (run_id) params.run_id = run_id
    if (page != null) params.page = page
    if (page_size != null) params.page_size = Math.min(page_size, MAX_PAGE_SIZE)
    const { data } = await this.http.get('/observations', { params })
    return data // { items, total, page, page_size, has_next }
  }
}

export const observationsClient = new ObservationsClient()