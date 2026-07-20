import axios from 'axios'
import { ENV } from '../env.js'
import { keycloakService } from '../keycloak.service.js'

/**
 * ui-metadata.client.js — v2 UI Metadata Registry (FEATURE_UI_METADATA_REGISTRY)
 *
 * Additive, feature-flagged surface on the Agno Runtime backend.
 * Every endpoint here 404s cleanly when the backend flag is off — callers
 * should treat 404 as "feature disabled", not an error. Use
 * `uiMetadataClient.isAvailable()` (cached) to probe once per session
 * instead of per-request.
 *
 * IMPORTANT — versioning semantics (per API reference):
 *   - Records are unique on (code, kind, version). PUT never mutates in
 *     place — it always creates a NEW row with a NEW id and version+1.
 *     The response `id` from a PUT is therefore NOT the same id you called
 *     PUT with. After a PUT, re-fetch via `getLatestByCode()` — don't hang
 *     onto the pre-PUT `entry_id` expecting it to reflect the update.
 *   - GET /{id} always returns the EXACT version for that id, even if a
 *     newer version now exists for the same (code, kind). Only use it for
 *     an explicit "view version history" screen — never for runtime reads.
 *   - DELETE is a soft delete (`deleted_at` is set); the row remains
 *     queryable via GET /{id} but disappears from list/latest results.
 */

/** `kind` enum accepted by POST / list filter — kept here so write-form UI
 *  (a future #4+ item) doesn't have to guess the accepted values. */
export const UI_METADATA_KINDS = [
  'APPLICATION', 'PAGE', 'FORM', 'DIALOG', 'GRID', 'BUSINESS_OBJECT',
  'FIELD', 'VALIDATION_RULE', 'LOOKUP', 'BUSINESS_RULE', 'COMPONENT',
  'PERMISSION', 'EVENT'
]

/** `code` must match this on create — enforced server-side (422 on mismatch),
 *  exposed here so a future create/edit form can validate client-side too. */
export const CODE_PATTERN = /^[a-z0-9][a-z0-9\-_.]*$/

const MAX_PAGE_SIZE = 200

class UIMetadataClient {
  constructor() {
    // Same base + /api/v1 convention as agno-runtime.client.js — this is
    // additive surface on the same Agno Runtime backend, not a new service.
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
        // 404 here is an expected "feature disabled" OR "code/id not found"
        // signal — both share error_code "not_found" per the API reference,
        // so we can't distinguish them from the envelope alone. Don't spam
        // the console for it like other clients do for real errors.
        if (err.response?.status !== 404) {
          const d = err.response?.data
          console.error(`[UIMetadata] ${d?.error_code || err.message}:`, d?.message)
        }
        return Promise.reject(err)
      }
    )

    // Cached per-session availability probe (see isAvailable()).
    this._availabilityPromise = null
  }

  /**
   * One-shot, cached feature-flag probe. Resolves true/false, never throws.
   * Recommended: call once at app/session start and gate any UI-metadata
   * surface (forms, dynamic fields, business-object browser) on the result,
   * rather than checking per-request.
   *
   * Uses GET /ui-metadata (page_size=1) rather than a by-code lookup,
   * because a by-code 404 is ambiguous (flag off vs. code simply doesn't
   * exist yet) while the plain list endpoint only 404s when the flag itself
   * is off — it returns 200 with `items: []` for "flag on, nothing there".
   */
  async isAvailable() {
    if (!this._availabilityPromise) {
      this._availabilityPromise = this.http
        .get('/ui-metadata', { params: { page_size: 1 } })
        .then(() => true)
        .catch((e) => {
          if (e.response?.status === 404) return false
          // Network/other errors: treat as unavailable but don't cache
          // permanently, in case it was transient.
          this._availabilityPromise = null
          return false
        })
    }
    return this._availabilityPromise
  }

  // =============================================
  // CRUD
  // =============================================

  /** POST /ui-metadata — version auto-assigned by server (starts at 1,
   *  increments per (code, kind)). Never send `version` in the body. */
  async create(body) {
    // body: { code, kind: UI_METADATA_KINDS[n], name, description?,
    //         parent_code?, payload, schema_version?, enabled? }
    const { data } = await this.http.post('/ui-metadata', body)
    return data
  }

  /**
   * GET /ui-metadata?kind=&parent_code=&page=&page_size= — paginated list.
   * Per the API reference: if `parent_code` is provided, `kind` is ignored
   * server-side (parent_code takes priority) — don't pass both expecting
   * an AND filter.
   */
  async list(params = {}) {
    const safeParams = { ...params }
    if (safeParams.page_size != null) {
      safeParams.page_size = Math.min(safeParams.page_size, MAX_PAGE_SIZE)
    }
    const { data } = await this.http.get('/ui-metadata', { params: safeParams })
    return data // { items, total, page, page_size, has_next }
  }

  /** GET /ui-metadata/{id} — the EXACT version for this id (use for "view
   *  history" only — see class-level versioning note). */
  async get(id) {
    const { data } = await this.http.get(`/ui-metadata/${id}`)
    return data
  }

  /**
   * GET /ui-metadata/by-code/{code}/latest?kind= — THE read path for runtime UI.
   * `kind` is required by the backend if the same `code` exists under
   * multiple kinds — always pass it when known to avoid ambiguity.
   * Returns null (not throw) on 404 so call sites can `if (!meta) return`
   * cleanly, whether the cause was "flag off" or "code not found".
   */
  async getLatestByCode(code, kind) {
    try {
      const { data } = await this.http.get(`/ui-metadata/by-code/${encodeURIComponent(code)}/latest`, {
        params: kind ? { kind } : undefined
      })
      return data
    } catch (e) {
      if (e.response?.status === 404) return null
      throw e
    }
  }

  /**
   * PUT /ui-metadata/{id} — creates a NEW version (server-side `exclude_unset`:
   * only fields present in `body` are applied on top of the previous version).
   * The response has a NEW `id` — see class-level versioning note. Do not
   * assume the id you called this with is still the "current" one.
   */
  async update(id, body) {
    // body: any subset of { name, description, parent_code, payload, schema_version, enabled }
    const { data } = await this.http.put(`/ui-metadata/${id}`, body)
    return data
  }

  /** DELETE /ui-metadata/{id} — soft delete (204, no body). The row stays
   *  fetchable via get(id) but drops out of list()/getLatestByCode(). */
  async remove(id) {
    await this.http.delete(`/ui-metadata/${id}`)
  }
}

export const uiMetadataClient = new UIMetadataClient()