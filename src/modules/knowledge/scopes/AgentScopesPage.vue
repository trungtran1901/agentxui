<template>
  <q-page class="page-wrapper">
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-title">Agent Scopes</h1>
        <p class="page-subtitle">POST /agent-scopes · GET /agent-scopes/{agent_id} — Grant agents access to ACL nodes</p>
      </div>
      <div class="page-header__actions">
        <button class="btn btn--primary" @click="dialog = true">
          <q-icon name="add" size="15px" />
          New Scope
        </button>
      </div>
    </div>

    <!-- Agent selector -->
    <div class="filter-bar">
      <q-select v-model="selectedAgent" :options="agentOptions" label="Select agent"
        outlined dense emit-value map-options style="min-width:260px"
        @update:model-value="loadScopes" />
    </div>

    <div v-if="!selectedAgent" class="surface empty-state" style="padding:60px">
      <div class="empty-state__icon"><q-icon name="manage_accounts" /></div>
      <div class="empty-state__title">Select an agent</div>
      <div class="empty-state__desc">Choose an agent above to view and manage its knowledge scopes</div>
    </div>

    <div v-else class="surface" style="overflow:hidden">
      <div v-if="loading" class="empty-state" style="padding:48px">
        <q-spinner size="28px" style="color:var(--brand-primary)" />
      </div>
      <div v-else-if="!scopes.length" class="empty-state" style="padding:48px">
        <div class="empty-state__icon"><q-icon name="lock_open" /></div>
        <div class="empty-state__title">No scopes granted</div>
        <div class="empty-state__desc">This agent has no access to any ACL node yet</div>
        <button class="btn btn--primary" @click="dialog = true">
          <q-icon name="add" size="15px" />Grant Access
        </button>
      </div>
      <div v-else style="padding:8px">
        <div v-for="scope in scopes" :key="scope.id" class="scope-row">
          <div class="scope-row__icon"><q-icon name="account_tree" size="16px" /></div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;color:var(--text-primary)">{{ nodeLabel(scope.acl_node_id) }}</div>
            <div class="font-mono" style="font-size:11px;color:var(--text-quaternary)">{{ scope.acl_node_id }}</div>
          </div>
          <button class="tbl-action-btn tbl-action-btn--danger" @click="removeScope(scope)" title="Revoke">
            <q-icon name="remove_circle_outline" size="15px" />
          </button>
        </div>
      </div>
    </div>

    <!-- Create dialog -->
    <BaseFormDialog v-model="dialog" title="Grant Knowledge Scope" icon="manage_accounts"
      icon-color="#10b981" :loading="saving" confirm-label="Grant Access" @confirm="save">
      <div style="display:flex;flex-direction:column;gap:14px">
        <div>
          <label class="field-label">agent_id <span style="color:var(--brand-danger)">*</span></label>
          <q-select v-model="form.agent_id" :options="agentOptions" outlined dense emit-value map-options />
        </div>
        <div>
          <label class="field-label">acl_node_id <span style="color:var(--brand-danger)">*</span></label>
          <q-select v-model="form.acl_node_id" :options="aclNodeOptions" outlined dense emit-value map-options
            placeholder="Select ACL node to grant access to" />
        </div>
        <div style="font-size:11px;color:var(--text-quaternary);background:var(--surface-overlay);padding:10px 12px;border-radius:6px">
          The agent will be able to search/retrieve documents under this node and all its descendants, subject to the requesting user's own ACL evaluation at query time.
        </div>
        <div v-if="apiError" class="api-error-box">
          <q-icon name="error_outline" size="16px" />{{ apiError }}
        </div>
      </div>
    </BaseFormDialog>
  </q-page>
</template>

<script>
import { defineComponent, ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { knowledgeClient } from '../../../services/api/knowledge-platform.client.js'
import { agnoClient } from '../../../services/api/agno-runtime.client.js'
import { useUIStore } from '../../../stores/ui.store.js'
import BaseFormDialog from '../../../shared/components/BaseFormDialog.vue'

export default defineComponent({
  name: 'AgentScopesPage',
  components: { BaseFormDialog },
  setup() {
    const $q = useQuasar()
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'Knowledge' }, { label: 'Agent Scopes' }])

    const selectedAgent = ref(null), agentOptions = ref([])
    const scopes = ref([]), loading = ref(false)
    const aclNodeOptions = ref([]), nodeMap = ref({})
    const dialog = ref(false), saving = ref(false), apiError = ref('')
    const form = ref({ agent_id: null, acl_node_id: null })

    function flattenTree(nodes, prefix = '') {
      return nodes.reduce((acc, n) => {
        nodeMap.value[n.id] = prefix + n.node_name
        acc.push({ label: prefix + n.node_name + ` (${n.node_code})`, value: n.id })
        if (n.children?.length) acc.push(...flattenTree(n.children, prefix + '  '))
        return acc
      }, [])
    }

    const nodeLabel = (id) => nodeMap.value[id] || id

    async function loadMeta() {
      const [agents, tree] = await Promise.allSettled([
        agnoClient.listAgents({ page_size: 100 }),
        knowledgeClient.getAclTree()
      ])
      if (agents.status === 'fulfilled') agentOptions.value = agents.value.items.map(a => ({ label: a.name, value: a.id }))
      if (tree.status === 'fulfilled') aclNodeOptions.value = flattenTree(tree.value)
    }

    async function loadScopes() {
      if (!selectedAgent.value) { scopes.value = []; return }
      loading.value = true
      try { scopes.value = await knowledgeClient.getAgentScopes(selectedAgent.value) }
      catch { scopes.value = [] }
      finally { loading.value = false }
    }

    async function save() {
      if (!form.value.agent_id || !form.value.acl_node_id) {
        apiError.value = 'agent_id and acl_node_id are required'; return
      }
      saving.value = true; apiError.value = ''
      try {
        await knowledgeClient.createAgentScope(form.value)
        $q.notify({ type: 'positive', message: 'Scope granted' })
        dialog.value = false
        if (selectedAgent.value === form.value.agent_id) loadScopes()
      } catch (e) {
        apiError.value = e.response?.data?.detail || 'Failed'
      } finally { saving.value = false }
    }

    function removeScope(scope) {
      $q.dialog({ title: 'Revoke Scope', message: 'Revoke this agent\'s access to this node?', cancel: { label: 'Cancel', flat: true }, ok: { label: 'Revoke', color: 'negative', unelevated: true } })
        .onOk(() => {
          // No DELETE endpoint documented yet — notify user
          $q.notify({ type: 'info', message: 'Revoke requires a DELETE /agent-scopes/{id} endpoint (not in current API spec)' })
        })
    }

    onMounted(loadMeta)
    return { selectedAgent, agentOptions, scopes, loading, aclNodeOptions, dialog, saving, apiError, form, nodeLabel, loadScopes, save, removeScope }
  }
})
</script>

<style lang="scss">
.scope-row {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 8px; transition: background 120ms ease;
  &:hover { background: var(--surface-overlay); }

  &__icon {
    width: 30px; height: 30px; border-radius: 8px;
    background: rgba(16,185,129,0.1); color: #059669;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
}
</style>