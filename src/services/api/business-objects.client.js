import axios from 'axios'
import { ENV } from '../env.js'
import { keycloakService } from '../keycloak.service.js'

/**
 * business-objects.client.js — v2 Business Object Registry
 * (FEATURE_BUSINESS_OBJECT_REGISTRY)
 *
 * Additive, feature-flagged surface on the Agno Runtime backend (same
 * base URL + /api/v1 as agno-runtime.client.js and ui-metadata.client.js).
 * 404 means "feature disabled" OR "id/code not found" — both share
 * error_code "not_found" in the envelope, so treat 404 uniformly as
 * "nothing to show here", never as a hard error.
 *
 * Structurally identical to UI Metadata Registry (see ui-metadata.client.js
 * for the full versioning writeup — PUT creates a new version/id, GET /{id}
 * returns an exact pinned version, DELETE is a soft delete) with two
 * differences confirmed by the detailed API reference:
 *   1. No `kind` — every Business Object is code-unique on its own,
 *      there's no parent/child hierarchy like UI Metadata has.
 *   2. list() ONLY accepts `page` / `page_size` — there is NO server-side
 *      search/filter param (no `q`, no `code` filter, nothing). Any
 *      "search" UX built on top of this client must filter client-side
 *      over already-fetched rows.
 */

/** `code` must match this on create — same pattern as ui-metadata. */
export const CODE_PATTERN = /^[a-z0-9][a-z0-9\-_.]*$/

const MAX_PAGE_SIZE = 200

class BusinessObjectsClient {
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
          console.error(`[BusinessObjects] ${d?.error_code || err.message}:`, d?.message)
        }
        return Promise.reject(err)
      }
    )

    this._availabilityPromise = null
  }

  /**
   * One-shot, cached feature-flag probe — same pattern as
   * uiMetadataClient.isAvailable(). GET /business-objects only 404s when
   * the flag is off (empty registry returns 200 + items: []), so this is
   * an unambiguous signal. Call once at page mount and gate the whole
   * browser surface on the result instead of checking per-request.
   */
  async isAvailable() {
    if (!this._availabilityPromise) {
      this._availabilityPromise = this.http
        .get('/business-objects', { params: { page_size: 1 } })
        .then(() => true)
        .catch((e) => {
          if (e.response?.status === 404) return false
          this._availabilityPromise = null
          return false
        })
    }
    return this._availabilityPromise
  }

  /**
   * GET /business-objects?page=&page_size= — paginated list.
   * IMPORTANT: page/page_size are the ONLY accepted params per the API
   * reference — no search/filter/sort. Do not pass extra params expecting
   * server-side filtering; they will simply be ignored.
   */
  async list({ page, page_size } = {}) {
    const params = {}
    if (page != null) params.page = page
    if (page_size != null) params.page_size = Math.min(page_size, MAX_PAGE_SIZE)
    const { data } = await this.http.get('/business-objects', { params })
    return data // { items, total, page, page_size, has_next }
  }

  /** GET /business-objects/{id} — the EXACT version for this id (use for
   *  "view history" only, never for runtime reads). */
  async get(id) {
    const { data } = await this.http.get(`/business-objects/${id}`)
    return data
  }

  /**
   * GET /business-objects/by-code/{code}/latest — the read path for the
   * browser's detail view. Returns null (not throw) on 404.
   */
  async getLatestByCode(code) {
    try {
      const { data } = await this.http.get(`/business-objects/by-code/${encodeURIComponent(code)}/latest`)
      return data
    } catch (e) {
      if (e.response?.status === 404) return null
      throw e
    }
  }

  /**
   * POST /business-objects — create a new object (version auto-assigned,
   * starts at 1). `payload` shape:
   *   {
   *     fields: [{ name, type, required?, description?, enumValues?, referenceObjectCode? }],
   *     relationships: [{ name, targetObjectCode, cardinality? }],
   *     validation: [{ rule, message, ...anything }],  // free-form dicts
   *     businessMeaning?: string
   *   }
   */
  async create(body) {
    // body: { code, name, description?, payload, enabled? }
    const { data } = await this.http.post('/business-objects', body)
    return data
  }

  /**
   * PUT /business-objects/{id} — creates a NEW version (server-side
   * `exclude_unset`). CAUTION: unlike simple field patches, `payload` is a
   * single merged object — if you send `payload` at all, you must send the
   * ENTIRE new payload (fields + relationships + validation + businessMeaning).
   * The server replaces payload wholesale, it does not deep-merge it.
   * Response has a NEW `id` — re-fetch via getLatestByCode() afterwards.
   */
  async update(id, body) {
    // body: any subset of { name, description, payload (whole object), enabled }
    const { data } = await this.http.put(`/business-objects/${id}`, body)
    return data
  }

  /** DELETE /business-objects/{id} — soft delete (204, no body). */
  async remove(id) {
    await this.http.delete(`/business-objects/${id}`)
  }
}

export const businessObjectsClient = new BusinessObjectsClient()