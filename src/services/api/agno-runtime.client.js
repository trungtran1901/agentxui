import axios from 'axios'
import { ENV } from '../env.js'
import { keycloakService } from '../keycloak.service.js'

class AgnoRuntimeClient {
  constructor() {
    // Read from ENV (window.__ENV__ → import.meta.env fallback)
    const BASE_URL = ENV.AGNO_API_URL

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
      return config
    }
    this.http.interceptors.request.use(authInterceptor)
    this.httpHealth.interceptors.request.use(authInterceptor)

    const errInterceptor = (err) => {
      const d = err.response?.data
      console.error(`[Agno] ${d?.error_code || err.message}:`, d?.message)
      return Promise.reject(err)
    }
    this.http.interceptors.response.use(r => r, errInterceptor)
    this.httpHealth.interceptors.response.use(r => r, errInterceptor)
  }

  // ===== AGENT-OS =====
  // GET /agent-os?page=&page_size=
  async listAgentOS(p) { const { data } = await this.http.get('/agent-os', { params: p }); return data }
  async getAgentOS(id) { const { data } = await this.http.get(`/agent-os/${id}`); return data }
  async createAgentOS(body) { const { data } = await this.http.post('/agent-os', body); return data }
  async updateAgentOS(id, body) { const { data } = await this.http.put(`/agent-os/${id}`, body); return data }
  async deleteAgentOS(id) { await this.http.delete(`/agent-os/${id}`) }

  // ===== TEAMS =====
  async listTeams(p) { const { data } = await this.http.get('/teams', { params: p }); return data }
  async getTeam(id) { const { data } = await this.http.get(`/teams/${id}`); return data }
  async createTeam(body) { const { data } = await this.http.post('/teams', body); return data }
  async updateTeam(id, body) { const { data } = await this.http.put(`/teams/${id}`, body); return data }
  async deleteTeam(id) { await this.http.delete(`/teams/${id}`) }

  // ===== AGENTS =====
  async listAgents(p) { const { data } = await this.http.get('/agents', { params: p }); return data }
  async getAgent(id) { const { data } = await this.http.get(`/agents/${id}`); return data }
  async createAgent(body) { const { data } = await this.http.post('/agents', body); return data }
  async updateAgent(id, body) { const { data } = await this.http.put(`/agents/${id}`, body); return data }
  async deleteAgent(id) { await this.http.delete(`/agents/${id}`) }

  // ===== PROMPTS =====
  // GET /prompts?code={code}&page=1&page_size=50
  async listPrompts(p) { const { data } = await this.http.get('/prompts', { params: p }); return data }
  async getPrompt(id) { const { data } = await this.http.get(`/prompts/${id}`); return data }
  async createPrompt(body) { const { data } = await this.http.post('/prompts', body); return data }
  async updatePrompt(id, body) { const { data } = await this.http.put(`/prompts/${id}`, body); return data }
  async deletePrompt(id) { await this.http.delete(`/prompts/${id}`) }

  // ===== SKILLS =====
  // GET /skills?page=1&page_size=50
  async listSkills(p) { const { data } = await this.http.get('/skills', { params: p }); return data }
  async getSkill(id) { const { data } = await this.http.get(`/skills/${id}`); return data }
  async createSkill(body) { const { data } = await this.http.post('/skills', body); return data }
  async updateSkill(id, body) { const { data } = await this.http.put(`/skills/${id}`, body); return data }
  async deleteSkill(id) { await this.http.delete(`/skills/${id}`) }
  // GET /agents/{agent_id}/skills
  async listAgentSkills(agent_id) { const { data } = await this.http.get(`/agents/${agent_id}/skills`); return data }
  async assignSkill(agent_id, skill_id) { await this.http.post('/skills/assign', { agent_id, skill_id }) }
  async unassignSkill(agent_id, skill_id) { await this.http.post('/skills/unassign', { agent_id, skill_id }) }
  // POST /skills/{id}/test { query } — KNOWLEDGE skill only
  // Returns: { skill_id, skill_code, ok, context, chunk_count, latency_ms, error }
  async testSkill(id, query) { const { data } = await this.http.post(`/skills/${id}/test`, { query }); return data }

  // ===== MODELS =====
  async listModels(p) { const { data } = await this.http.get('/models', { params: p }); return data }
  async getModel(id) { const { data } = await this.http.get(`/models/${id}`); return data }
  async createModel(body) { const { data } = await this.http.post('/models', body); return data }
  async updateModel(id, body) { const { data } = await this.http.put(`/models/${id}`, body); return data }
  async deleteModel(id) { await this.http.delete(`/models/${id}`) }

  // ===== CHAT =====
  async chat(body) { const { data } = await this.http.post('/chat', body); return data }
  getChatStreamUrl() { return `${ENV.AGNO_API_URL}/api/v1/chat/stream` }

  // ===== SESSIONS =====
  async listSessions(p) { const { data } = await this.http.get('/sessions', { params: p }); return data }
  async getSession(id, user_id) { const { data } = await this.http.get(`/sessions/${id}`, { params: user_id ? { user_id } : undefined }); return data }

  // ===== RUNS =====
  async listRuns(p) { const { data } = await this.http.get('/runs', { params: p }); return data }
  async getRun(id) { const { data } = await this.http.get(`/runs/${id}`); return data }
  async getRunEvents(id) { const { data } = await this.http.get(`/runs/${id}/events`); return data }
  // POST /runs/{id}/cancel — 202 Accepted, stops a streaming run
  async cancelRun(runId) { const { data } = await this.http.post(`/runs/${runId}/cancel`); return data }
  getRunStreamUrl(id) { return `${ENV.AGNO_API_URL}/api/v1/runs/${id}/stream` }

  // ===== WORKFLOWS =====
  async listWorkflows(p) { const { data } = await this.http.get('/workflows', { params: p }); return data }
  async getWorkflow(id) { const { data } = await this.http.get(`/workflows/${id}`); return data }
  async createWorkflow(body) { const { data } = await this.http.post('/workflows', body); return data }
  async updateWorkflow(id, body) { const { data } = await this.http.put(`/workflows/${id}`, body); return data }
  async deleteWorkflow(id) { await this.http.delete(`/workflows/${id}`) }
  async runWorkflow(id, input) { const { data } = await this.http.post(`/workflows/${id}/run`, { input }); return data }
  getWorkflowStreamUrl(id) { return `${ENV.AGNO_API_URL}/api/v1/workflows/${id}/run/stream` }

  // ===== WORKFLOW RUNS =====
  async listWorkflowRuns(p) { const { data } = await this.http.get('/workflow-runs', { params: p }); return data }
  async getWorkflowRun(id) { const { data } = await this.http.get(`/workflow-runs/${id}`); return data }
  async getWorkflowRunSteps(id) { const { data } = await this.http.get(`/workflow-runs/${id}/steps`); return data }
  async getWorkflowRunEvents(id) { const { data } = await this.http.get(`/workflow-runs/${id}/events`); return data }

  // ===== MEMORIES =====
  async listMemories(p) { const { data } = await this.http.get('/memories', { params: p }); return data }
  async listAgentMemories(agent_id) { const { data } = await this.http.get(`/agents/${agent_id}/memories`); return data }
  async deleteMemory(id) { await this.http.delete(`/memories/${id}`) }
  async listCapabilityAssignments(p) { const { data } = await this.http.get('/capabilities/assignments', { params: p }); return data }
  async setCapabilityAssignments(body) { const { data } = await this.http.post('/capabilities/assignments', body); return data }
  async resolveCapabilities(body) { const { data } = await this.http.post('/capabilities/resolve', body); return data }
  async uploadAttachment(formData) {
    const { data } = await this.http.post('/attachments/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return data
  }
  // ===== HEALTH =====
  async health() { const { data } = await this.httpHealth.get('/health'); return data }
  async ready() { const { data } = await this.httpHealth.get('/ready'); return data }
  async version() { const { data } = await this.httpHealth.get('/version'); return data }
}

export const agnoClient = new AgnoRuntimeClient()