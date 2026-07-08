import { defineStore } from 'pinia'
import { mcpClient } from '../services/api/mcp-gateway.client.js'

export const useMCPStore = defineStore('mcp', {
  state: () => ({ capabilities: [], loading: false, total: 0 }),
  actions: {
    async fetchCapabilities(params) {
      this.loading = true
      try { const r = await mcpClient.listCapabilities(params); this.capabilities = r.items || []; this.total = r.total || 0 }
      finally { this.loading = false }
    },
    async execute(capabilityCode, args, agentId) {
      return await mcpClient.execute({ capability_code: capabilityCode, arguments: args, agent_id: agentId })
    }
  }
})
