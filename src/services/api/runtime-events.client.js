import axios from 'axios'
import { ENV } from '../env.js'
import { keycloakService } from '../keycloak.service.js'

/**
 * runtime-events.client.js — v2 Runtime Events (emit / list / SSE tail)
 *
 * Three documented operations:
 *   POST /runtime-events                                     — emit an event
 *   GET  /runtime-events?entity_type=&entity_id=&page=&page_size= — history
 *   GET  /runtime-events/stream?entity_type=&entity_id=      — SSE tail
 *
 * The SSE endpoint requires a Bearer token, which the native EventSource
 * API cannot send. Rather than introduce a new streaming approach, this
 * follows the exact fetch()+ReadableStream+manual-SSE-line-parsing pattern
 * already used for POST /chat/stream in PlaygroundPage.vue.
 */

const MAX_PAGE_SIZE = 200

class RuntimeEventsClient {
  constructor() {
    const BASE_URL = ENV.AGNO_API_URL
    this.baseUrl = BASE_URL

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
          console.error(`[RuntimeEvents] ${d?.error_code || err.message}:`, d?.message)
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
        .get('/runtime-events', { params: { page_size: 1 } })
        .then(() => true)
        .catch((e) => {
          if (e.response?.status === 404) return false
          this._availabilityPromise = null
          return false
        })
    }
    return this._availabilityPromise
  }

  /** POST /runtime-events */
  async emit({ entity_type, entity_id, event_name, payload, correlation_id }) {
    const body = {
      entity_type, entity_id, event_name,
      payload: payload || {},
      ...(correlation_id ? { correlation_id } : {})
    }
    const { data } = await this.http.post('/runtime-events', body)
    return data
  }

  /**
   * Fire-and-forget variant for lightweight UI instrumentation (e.g. a page
   * emitting "PageOpened" on mount) where a failed emit — flag off, blip,
   * whatever — should never affect the calling page. Swallows all errors,
   * returns null on failure instead of throwing.
   */
  async emitSafe(args) {
    try { return await this.emit(args) }
    catch { return null }
  }

  /** GET /runtime-events?entity_type=&entity_id=&page=&page_size= */
  async list({ entity_type, entity_id, page, page_size } = {}) {
    const params = {}
    if (entity_type) params.entity_type = entity_type
    if (entity_id) params.entity_id = entity_id
    if (page != null) params.page = page
    if (page_size != null) params.page_size = Math.min(page_size, MAX_PAGE_SIZE)
    const { data } = await this.http.get('/runtime-events', { params })
    return data // { items, total, page, page_size, has_next }
  }

  /**
   * Open an SSE tail for (entity_type, entity_id). Fire-and-forget style:
   * starts reading immediately, calls `onEvent({event, data})` per frame.
   * Returns a controller `{ stop() }` — callers MUST call stop() on
   * unmount/tab-switch to close the underlying stream (mirrors
   * PlaygroundPage.vue's cancelStream() cleanup for chat streaming).
   *
   * @param {{entity_type:string, entity_id:string}} params
   * @param {(frame:{event:string, data:object}) => void} onEvent
   * @param {(err:Error) => void} [onError]
   * @returns {{stop: () => void}}
   */
  openStream(params, onEvent, onError) {
    const token = keycloakService.getToken()
    const qs = new URLSearchParams(params).toString()
    const url = `${this.baseUrl}/api/v1/runtime-events/stream?${qs}`

    let stopped = false
    let reader = null

    const run = async () => {
      try {
        const resp = await fetch(url, {
          headers: {
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        reader = resp.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        let currentEvent = 'message'

        while (!stopped) {
          // eslint-disable-next-line no-await-in-loop
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop()

          for (const line of lines) {
            if (line.startsWith('event:')) { currentEvent = line.slice(6).trim(); continue }
            if (!line.startsWith('data:')) continue
            const raw = line.slice(5).trim()
            if (!raw) continue
            let data
            try { data = JSON.parse(raw) } catch { continue }
            onEvent({ event: currentEvent, data })
          }
        }
      } catch (e) {
        if (!stopped && onError) onError(e)
      }
    }

    run()

    return {
      stop() {
        stopped = true
        if (reader) { try { reader.cancel() } catch { /* already closed */ } }
      }
    }
  }
}

export const runtimeEventsClient = new RuntimeEventsClient()