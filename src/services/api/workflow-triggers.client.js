import axios from 'axios'
import { ENV } from '../env.js'
import { keycloakService } from '../keycloak.service.js'

const MAX_PAGE_SIZE = 200

class WorkflowTriggersClient {
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
        const d = err.response?.data
        if (err.response?.status !== 404) {
          console.error(`[WorkflowTriggers] ${d?.error_code || err.message}:`, d?.message)
        }
        return Promise.reject(err)
      }
    )
  }

  // Returns true when the error envelope indicates the feature flag is off,
  // as opposed to a genuine "record not found" 404.
  isFeatureDisabledError(err) {
    if (err?.response?.status !== 404) return false
    const d = err.response?.data
    return d?.error_code === 'not_found' && /not enabled/i.test(d?.message || '')
  }

  // =============================================
  // SCHEDULES
  // =============================================

  async listSchedules(workflowId, { page, page_size } = {}) {
    const params = {}
    if (page != null) params.page = page
    if (page_size != null) params.page_size = Math.min(page_size, MAX_PAGE_SIZE)
    const { data } = await this.http.get(`/workflows/${workflowId}/schedules`, { params })
    return data // { items, total, page, page_size, has_next }
  }

  async createSchedule(workflowId, body) {
    // body: { schedule_type, cron_expression?, interval_seconds?, timezone?, input_template, user_id?, enabled? }
    const { data } = await this.http.post(`/workflows/${workflowId}/schedules`, body)
    return data
  }

  async getSchedule(scheduleId) {
    const { data } = await this.http.get(`/schedules/${scheduleId}`)
    return data
  }

  async updateSchedule(scheduleId, body) {
    const { data } = await this.http.put(`/schedules/${scheduleId}`, body)
    return data
  }

  async deleteSchedule(scheduleId) {
    await this.http.delete(`/schedules/${scheduleId}`)
  }

  async triggerSchedule(scheduleId) {
    const { data } = await this.http.post(`/schedules/${scheduleId}/trigger`)
    return data
  }

  // =============================================
  // WEBHOOKS
  // =============================================

  async listWebhooks(workflowId, { page, page_size } = {}) {
    const params = {}
    if (page != null) params.page = page
    if (page_size != null) params.page_size = Math.min(page_size, MAX_PAGE_SIZE)
    const { data } = await this.http.get(`/workflows/${workflowId}/webhooks`, { params })
    return data // { items, total, page, page_size, has_next }
  }

  async createWebhook(workflowId, body) {
    // body: { secret?, input_field_path?, allowed_source_ips?, user_id?, enabled? }
    const { data } = await this.http.post(`/workflows/${workflowId}/webhooks`, body)
    return data
  }

  async updateWebhook(webhookId, body) {
    const { data } = await this.http.put(`/webhooks/${webhookId}`, body)
    return data
  }

  async deleteWebhook(webhookId) {
    await this.http.delete(`/webhooks/${webhookId}`)
  }

  invokeUrl(webhookOrPath) {
    const base = (ENV.AGNO_API_URL || '').replace(/\/$/, '')
    const path = webhookOrPath.invoke_path || webhookOrPath
    return `${base}${path.startsWith('/') ? '' : '/'}${path}`
  }
}

export const workflowTriggersClient = new WorkflowTriggersClient()