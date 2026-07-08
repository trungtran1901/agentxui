import { createPinia } from 'pinia'

export { useDashboardStore } from './dashboard.store.js'
export { useAgentStore } from './agent.store.js'
export { useWorkflowStore } from './workflow.store.js'
export { useKnowledgeStore } from './knowledge.store.js'
export { useMCPStore } from './mcp.store.js'
export { useUIStore } from './ui.store.js'

export default createPinia