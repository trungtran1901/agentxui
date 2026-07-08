import { defineStore } from 'pinia'
import { agnoClient } from '../services/api/agno-runtime.client.js'

export const useWorkflowStore = defineStore('workflow', {
  state: () => ({ workflows: [], selectedWorkflow: null, currentRuns: [], loading: false, total: 0 }),
  actions: {
    async fetchWorkflows(params) {
      this.loading = true
      try { const r = await agnoClient.listWorkflows(params); this.workflows = r.items; this.total = r.total }
      finally { this.loading = false }
    },
    async runWorkflow(id, input) { return await agnoClient.runWorkflow(id, input) }
  }
})
