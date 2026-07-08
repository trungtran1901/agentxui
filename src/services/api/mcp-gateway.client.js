import axios from 'axios'
import { keycloakService } from '../keycloak.service.js'
import { ENV } from '../env.js'
// const BASE_URL = import.meta.env.VITE_MCP_API_URL || ''

class MCPGatewayClient {
  constructor() {
    const BASE_URL = ENV.MCP_API_URL
    this.http = axios.create({
      baseURL: BASE_URL + '/api/v1',
      timeout: 60000,
      headers: { 'Content-Type': 'application/json' }
    })
    this.httpHealth = axios.create({
      baseURL: BASE_URL,
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' }
    })

    const authInterceptor = (config) => {
      const token = keycloakService.getToken()
      if (token) config.headers.Authorization = `Bearer ${token}`
      // Echo our own correlation id so it's traceable end-to-end
      config.headers['X-Correlation-ID'] = config.headers['X-Correlation-ID'] || crypto.randomUUID()
      return config
    }
    this.http.interceptors.request.use(authInterceptor)
    this.httpHealth.interceptors.request.use(authInterceptor)

    // Standard error envelope:
    // { success: false, error: { code, message, details }, correlationId }
    const errInterceptor = (err) => {
      const envelope = err.response?.data
      const corrId = err.response?.headers?.['x-correlation-id'] || envelope?.correlationId
      console.error(`[MCP] ${envelope?.error?.code || err.message} (${corrId || 'no-correlation-id'}):`, envelope?.error?.message)
      return Promise.reject(err)
    }
    this.http.interceptors.response.use(r => r, errInterceptor)
    this.httpHealth.interceptors.response.use(r => r, errInterceptor)
  }

  // =============================================
  // CAPABILITY REGISTRY
  // =============================================

  /** POST /capabilities — 201 created, or 409 CAPABILITY_ALREADY_EXISTS */
  async createCapability(body) {
    // body: { code, name, description?, provider_type: mock|http|n8n, endpoint?, input_schema?, output_schema?, enabled? }
    const { data } = await this.http.post('/capabilities', body)
    return data
  }

  /** GET /capabilities?enabled=&provider_type=&limit=&offset= */
  async listCapabilities(params) {
    // params: { enabled?, provider_type?, limit?, offset? }
    const { data } = await this.http.get('/capabilities', { params })
    return data // { items, limit, offset, total }
  }

  /** GET /capabilities/{id} — or 404 CAPABILITY_NOT_FOUND */
  async getCapability(id) {
    const { data } = await this.http.get(`/capabilities/${id}`)
    return data
  }

  /** PUT /capabilities/{id} — partial update, only provided fields change */
  async updateCapability(id, body) {
    const { data } = await this.http.put(`/capabilities/${id}`, body)
    return data
  }

  /** POST /capabilities/{id}/enable */
  async enableCapability(id) {
    const { data } = await this.http.post(`/capabilities/${id}/enable`)
    return data
  }

  /** POST /capabilities/{id}/disable */
  async disableCapability(id) {
    const { data } = await this.http.post(`/capabilities/${id}/disable`)
    return data
  }

  /** DELETE /capabilities/{id} — 204, soft delete */
  async deleteCapability(id) {
    await this.http.delete(`/capabilities/${id}`)
  }

  // =============================================
  // EXECUTION
  // =============================================

  /** POST /execute
   *  Success 200: { success, capability, data, error, errorCode, executionId }
   *  Soft failure also 200 with success:false + errorCode (e.g. DOWNSTREAM_HTTP_ERROR)
   *  Hard failure: 502 PROVIDER_EXECUTION_FAILED (error envelope)
   */
  async execute(body) {
    // body: { capability: code, payload, context? }
    const { data } = await this.http.post('/execute', body)
    return data
  }

  // =============================================
  // HEALTH
  // =============================================

  /** GET /health — liveness only */
  async health() {
    const { data } = await this.httpHealth.get('/health')
    return data // { status: 'ok' }
  }

  /** GET /ready — checks Postgres + Redis */
  async ready() {
    const { data } = await this.httpHealth.get('/ready')
    return data // { status: 'ok'|'degraded', checks: { database, redis } }
  }

  /** GET /version */
  async version() {
    const { data } = await this.httpHealth.get('/version')
    return data // { name, version, environment }
  }
}

export const mcpClient = new MCPGatewayClient()