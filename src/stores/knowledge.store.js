import { defineStore } from 'pinia'
import { knowledgeClient } from '../services/api/knowledge-platform.client.js'

export const useKnowledgeStore = defineStore('knowledge', {
  state: () => ({ aclTree: [], selectedNode: null, loading: false }),
  actions: {
    async fetchTree() {
      this.loading = true
      try { this.aclTree = await knowledgeClient.getAclTree() }
      finally { this.loading = false }
    },
    setSelectedNode(n) { this.selectedNode = n }
  }
})
