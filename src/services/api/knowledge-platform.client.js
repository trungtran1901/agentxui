import axios from 'axios'
import { keycloakService } from '../keycloak.service.js'
import { ENV } from '../env.js'
// const BASE_URL =  import.meta.env.VITE_KNOWLEDGE_API_URL || ''

class KnowledgePlatformClient {
  constructor() {
    const BASE_URL = ENV.KNOWLEDGE_API_URL
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
      console.error(`[Knowledge] ${err.response?.status}: ${d?.detail || err.message}`)
      return Promise.reject(err)
    }
    this.http.interceptors.response.use(r => r, errInterceptor)
    this.httpHealth.interceptors.response.use(r => r, errInterceptor)
  }

  // =============================================
  // ACL TREE
  // =============================================

  /** GET /acl/tree — nested tree of all nodes */
  async getAclTree() {
    const { data } = await this.http.get('/acl/tree')
    return data // AclNode[] with children
  }

  /** POST /acl/nodes — create node (parent_id null = new root) */
  async createAclNode(body) {
    // body: { parent_id?, node_code, node_name, node_type: ROOT|DOMAIN|CATEGORY|SUBCATEGORY }
    const { data } = await this.http.post('/acl/nodes', body)
    return data
  }

  /** PUT /acl/nodes/{id} — update node_name */
  async updateAclNode(id, body) {
    // body: { node_name }
    const { data } = await this.http.put(`/acl/nodes/${id}`, body)
    return data
  }

  /** DELETE /acl/nodes/{id} — cascade to children + assignments — 204 */
  async deleteAclNode(id) {
    await this.http.delete(`/acl/nodes/${id}`)
  }

  // =============================================
  // ACL ASSIGNMENTS
  // =============================================

  /** POST /acl/assignments — create assignment */
  async createAclAssignment(body) {
    // body: { node_id, subject_type: ROLE|GROUP|USER, subject_id, permission: READ|WRITE|DELETE|ADMIN }
    const { data } = await this.http.post('/acl/assignments', body)
    return data
  }

  /** GET /acl/assignments?node_id={id} — list assignments (node_id optional) */
  async listAclAssignments(params) {
    // params: { node_id? }
    const { data } = await this.http.get('/acl/assignments', { params })
    return data // AclAssignment[]
  }

  // =============================================
  // ACL EVALUATE — "closest wins" inheritance
  // =============================================

  /** POST /acl/evaluate
   *  Keycloak sub → user_id; roles/groups from token claims
   */
  async evaluateAcl(body) {
    // body: { user_id, node_id, permission: READ|WRITE|DELETE|ADMIN, roles?, groups? }
    // Returns: { allowed, matched_assignment_id, matched_node_id, reason }
    const { data } = await this.http.post('/acl/evaluate', body)
    return data
  }

  // =============================================
  // COLLECTIONS
  // =============================================

  /** GET /collections — list all collections */
  async listCollections() {
    const { data } = await this.http.get('/collections')
    return data // Collection[]
  }

  /** POST /collections */
  async createCollection(body) {
    // body: { code, name, description?, acl_node_id }
    const { data } = await this.http.post('/collections', body)
    return data
  }

  /** PUT /collections/{id} */
  async updateCollection(id, body) {
    // body: { name?, description? }
    const { data } = await this.http.put(`/collections/${id}`, body)
    return data
  }

  /** DELETE /collections/{id} — 204, cascades to documents */
  async deleteCollection(id) {
    await this.http.delete(`/collections/${id}`)
  }

  // =============================================
  // DOCUMENTS
  // =============================================

  /** GET /documents?collection_id={id} — list documents */
  async listDocuments(params) {
    // params: { collection_id? }
    const { data } = await this.http.get('/documents', { params })
    return data // Document[]
  }

  /** GET /documents/{id} */
  async getDocument(id) {
    const { data } = await this.http.get(`/documents/${id}`)
    return data
  }

  /** POST /documents/upload — multipart/form-data
   *  Fields: collection_id (uuid), title (string), description? (string), file (binary)
   */
  async uploadDocument(formData) {
    const { data } = await this.http.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return data
    // Returns: { id, collection_id, title, description, status: UPLOADED, version, mime_type, file_size }
  }

  /** DELETE /documents/{id} — 204 */
  async deleteDocument(id) {
    await this.http.delete(`/documents/${id}`)
  }

  /** POST /documents/{id}/process — enqueue ingestion pipeline (OCR→chunk→embed→index)
   *  Returns immediately; poll GET /documents/{id} for status INDEXED|FAILED
   */
  async processDocument(id) {
    const { data } = await this.http.post(`/documents/${id}/process`)
    return data // { status: 'queued', documentId }
  }

  /** POST /documents/{id}/reindex — purge vectors then re-run pipeline */
  async reindexDocument(id) {
    const { data } = await this.http.post(`/documents/${id}/reindex`)
    return data // { status: 'queued', documentId }
  }

  /** POST /documents/{id}/reembed — re-run embedding after model change */
  async reembedDocument(id) {
    const { data } = await this.http.post(`/documents/${id}/reembed`)
    return data // { status: 'queued', documentId }
  }

  // =============================================
  // SEARCH
  // =============================================

  /** POST /search — permission-aware + agent-aware retrieval
   *  Keycloak sub = user_id for ACL resolution
   */
  async search(body) {
    // body: { query, agentId?, collectionId?, topK?, embeddingModelCode?, rerankModelCode? }
    // Returns: { results: [ { chunkId, score, content, documentId, page, bbox, sourceMetadata } ] }
    const { data } = await this.http.post('/search', body)
    return data
  }

  // =============================================
  // CHUNKS
  // =============================================

  /** GET /chunks/{id}/source — citation/presigned URL for a chunk */
  async getChunkSource(chunkId) {
    // Returns: { document_id, page, bbox, source_url }
    const { data } = await this.http.get(`/chunks/${chunkId}/source`)
    return data
  }

  // =============================================
  // AGENT SCOPES
  // =============================================

  /** POST /agent-scopes — grant agent access to ACL node */
  async createAgentScope(body) {
    // body: { agent_id, acl_node_id }
    const { data } = await this.http.post('/agent-scopes', body)
    return data // { id, agent_id, acl_node_id }
  }

  /** GET /agent-scopes/{agent_id} */
  async getAgentScopes(agentId) {
    const { data } = await this.http.get(`/agent-scopes/${agentId}`)
    return data // AgentScope[]
  }

  // =============================================
  // KNOWLEDGE REGISTRY
  // =============================================

  /** GET /registry/knowledge-types */
  async listKnowledgeTypes() {
    const { data } = await this.http.get('/registry/knowledge-types')
    return data // [{ id, code, name }]
  }

  /** POST /registry/knowledge-types */
  async createKnowledgeType(body) {
    // body: { code, name }
    const { data } = await this.http.post('/registry/knowledge-types', body)
    return data
  }

  /** GET /registry/document-categories */
  async listDocumentCategories() {
    const { data } = await this.http.get('/registry/document-categories')
    return data
  }

  /** POST /registry/document-categories */
  async createDocumentCategory(body) {
    const { data } = await this.http.post('/registry/document-categories', body)
    return data
  }

  /** GET /registry/document-tags */
  async listDocumentTags() {
    const { data } = await this.http.get('/registry/document-tags')
    return data
  }

  /** POST /registry/document-tags */
  async createDocumentTag(body) {
    const { data } = await this.http.post('/registry/document-tags', body)
    return data
  }

  /** GET /registry/document-templates */
  async listDocumentTemplates() {
    const { data } = await this.http.get('/registry/document-templates')
    return data // [{ id, code, name, schemaDefinition }]
  }

  /** POST /registry/document-templates */
  async createDocumentTemplate(body) {
    // body: { code, name, schema_definition: { fields: [...] } }
    const { data } = await this.http.post('/registry/document-templates', body)
    return data
  }

  // =============================================
  // AI MODEL REGISTRY (Knowledge Platform)
  // =============================================

  /** GET /ai-models */
  async listAiModels() {
    const { data } = await this.http.get('/ai-models')
    return data // [{ id, model_code, model_name, model_type: LLM|EMBEDDING|RERANK, endpoint, enabled, is_default }]
  }

  /** POST /ai-models */
  async createAiModel(body) {
    // body: { model_code, model_name, model_type, endpoint, enabled, is_default, config? }
    const { data } = await this.http.post('/ai-models', body)
    return data
  }

  // =============================================
  // HEALTH
  // =============================================

  /** GET /health — liveness, no auth */
  async health() {
    const { data } = await this.httpHealth.get('/health')
    return data // { status: 'ok' }
  }

  /** GET /ready — readiness, checks DB + Redis, no auth */
  async ready() {
    const { data } = await this.httpHealth.get('/ready')
    return data // { status: 'ok'|'degraded', checks: { database, redis } }
  }

  /** GET /version — no auth */
  async version() {
    const { data } = await this.httpHealth.get('/version')
    return data // { name, version, env }
  }
  // =============================================
  // SOURCES (v2) — Connector-based ingestion registry
  // Replaces manual "Documents Upload" as the primary ingestion model.
  // =============================================

  /** GET /sources?collection_id={id} */
  async listSources(params) {
    const { data } = await this.http.get('/sources', { params })
    return data // Source[]
  }

  async getSource(id) {
    const { data } = await this.http.get(`/sources/${id}`)
    return data
  }

  /** POST /sources — configuration shape is dynamic per connector,
   *  driven by GET /connectors[].config_schema. Never hardcode fields. */
  async createSource(body) {
    const { data } = await this.http.post('/sources', body)
    return data
  }

  async updateSource(id, body) {
    const { data } = await this.http.put(`/sources/${id}`, body)
    return data
  }

  async deleteSource(id) {
    await this.http.delete(`/sources/${id}`)
  }

  async syncSource(id) {
    const { data } = await this.http.post(`/sources/${id}/sync`)
    return data
  }

  async stopSource(id) {
    const { data } = await this.http.post(`/sources/${id}/stop`)
    return data
  }

  async getSourceHealth(id) {
    const { data } = await this.http.get(`/sources/${id}/health`)
    return data
  }

  async listSourceJobs(id) {
    const { data } = await this.http.get(`/sources/${id}/jobs`)
    return data // SyncJob[]
  }

  async reindexSource(id) {
    const { data } = await this.http.post(`/sources/${id}/reindex`)
    return data
  }

  // =============================================
  // CONNECTORS (v2) — Plugin registry, drives dynamic config forms
  // =============================================

  async listConnectors() {
    const { data } = await this.http.get('/connectors')
    return data // [{ type_code, display_name, description, enabled, config_schema }]
  }

  async listRegisteredConnectors() {
    const { data } = await this.http.get('/connectors/registered')
    return data
  }

  // =============================================
  // PREVIEW (v2)
  // =============================================

  async previewUrl(body) {
    const { data } = await this.http.post('/preview/url', body)
    return data
  }

  async previewSource(sourceId, maxResources) {
    const { data } = await this.http.post(`/preview/source/${sourceId}`, null, {
      params: maxResources ? { max_resources: maxResources } : undefined
    })
    return data
  }

  async previewChunks(body) {
    const { data } = await this.http.post('/preview/chunks', body)
    return data
  }

  // =============================================
  // WEBHOOKS (v2)
  // =============================================

  async createWebhook(body) {
    const { data } = await this.http.post('/webhooks', body)
    return data
  }

  async listWebhooks(params) {
    const { data } = await this.http.get('/webhooks', { params })
    return data // Webhook[]
  }

  async deleteWebhook(id) {
    await this.http.delete(`/webhooks/${id}`)
  }
  // POST /webhooks/receive/{token} is called by EXTERNAL systems only — not used here.
}

export const knowledgeClient = new KnowledgePlatformClient()