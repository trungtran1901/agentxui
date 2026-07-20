import axios from 'axios'
import { ENV } from '../env.js'
import { keycloakService } from '../keycloak.service.js'

/**
 * execution-plans.client.js — v2 Execution Plans (multi-agent / multi-step)
 *
 * Single documented operation: POST /api/v1/execution-plans/run.
 *
 * Unlike every other v2 client in this app, this endpoint has SIDE EFFECTS
 * — it actually dispatches a message through one or more agents/teams.
 * There is no safe, idempotent GET to pre-flight probe with (the way
 * isAvailable() does for the registry-style v2 endpoints), so this client
 * does NOT expose an isAvailable() method. Callers should attempt run()
 * only when the user opts in (e.g. "Multi-agent mode" toggle), and treat
 * the `disabled: true` flag on the return value as "feature not enabled
 * here" — see run() below.
 *
 * The brief also promises "a queryable step timeline" for a completed plan
 * run. No GET endpoint for that was included in the documented v2 API
 * reference — getStepTimeline() is a BEST-EFFORT call inferred by analogy
 * to this app's existing v1 GET /workflow-runs/{id}/steps convention. It
 * resolves to `null` on ANY failure (404 or otherwise), so callers must
 * treat a missing timeline as "not available", not an error. Confirm the
 * real endpoint shape against a running v2 instance before depending on it
 * for anything beyond an optional nice-to-have UI panel.
 */
class ExecutionPlansClient {
  constructor() {
    const BASE_URL = ENV.AGNO_API_URL

    this.http = axios.create({
      baseURL: BASE_URL + '/api/v1',
      // Multi-agent runs can genuinely take longer than a single chat
      // turn — longer timeout than the 30s used by the other, read-only
      // v2 clients in this app.
      timeout: 120000,
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
          console.error(`[ExecutionPlans] ${d?.error_code || err.message}:`, d?.message)
        }
        return Promise.reject(err)
      }
    )
  }

  /**
   * POST /execution-plans/run
   *
   * @param {object} body
   * @param {string} body.agentOs
   * @param {string} body.message
   * @param {Array<{agent_code?:string, team_code?:string, max_retries?:number}>} [body.steps]
   *        If omitted/empty, per the brief this falls back to a single-step
   *        plan equivalent to a normal chat dispatch against `agentOs` alone.
   * @param {string} [body.session_id]
   * @param {string} [body.user_id]
   * @returns {Promise<{disabled:boolean, planRunId?:string, status?:string, result?:string}>}
   *   Never throws for a 404 — resolves to `{ disabled: true }` instead, so
   *   call sites don't need a try/catch just to detect "not enabled here".
   *   Any other error (network, 422, 500) still throws normally.
   */
  async run(body) {
    try {
      const { data } = await this.http.post('/execution-plans/run', body)
      return { disabled: false, ...data }
    } catch (e) {
      if (e.response?.status === 404) return { disabled: true }
      throw e
    }
  }

  /**
   * BEST-EFFORT step timeline lookup for a completed plan run — see the
   * class-level note. Returns null on any failure instead of throwing.
   */
  async getStepTimeline(planRunId) {
    try {
      const { data } = await this.http.get(`/execution-plans/${planRunId}`)
      return data
    } catch {
      return null
    }
  }
}

export const executionPlansClient = new ExecutionPlansClient()