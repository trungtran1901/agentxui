import { defineStore } from 'pinia'
import { agnoClient } from '../services/api/agno-runtime.client.js'
import { mcpClient } from '../services/api/mcp-gateway.client.js'

export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    counts: { agentos: 0, teams: 0, agents: 0, workflows: 0, capabilities: 0, sessions: 0 },
    loading: false,
    lastRefresh: null
  }),
  actions: {
    async fetchAll() {
      this.loading = true
      const results = await Promise.allSettled([
        agnoClient.listAgentOS({ page_size: 1 }),
        agnoClient.listTeams({ page_size: 1 }),
        agnoClient.listAgents({ page_size: 1 }),
        agnoClient.listWorkflows({ page_size: 1 }),
        mcpClient.listCapabilities({ page_size: 1 }),
        agnoClient.listSessions({ page_size: 1 })
      ])
      const keys = ['agentos', 'teams', 'agents', 'workflows', 'capabilities', 'sessions']
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') this.counts[keys[i]] = r.value?.total || 0
      })
      this.lastRefresh = new Date()
      this.loading = false
    }
  }
})
