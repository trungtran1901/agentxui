import { defineStore } from 'pinia'
import { agnoClient } from '../services/api/agno-runtime.client.js'

export const useAgentStore = defineStore('agent', {
  state: () => ({ agents: [], agentOSList: [], teams: [], loading: false, total: 0 }),
  actions: {
    async fetchAgents(params) {
      this.loading = true
      try { const r = await agnoClient.listAgents(params); this.agents = r.items; this.total = r.total }
      finally { this.loading = false }
    },
    async fetchAgentOS() { const r = await agnoClient.listAgentOS(); this.agentOSList = r.items },
    async fetchTeams() { const r = await agnoClient.listTeams(); this.teams = r.items }
  }
})
