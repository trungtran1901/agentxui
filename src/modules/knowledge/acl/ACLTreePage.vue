<template>
  <q-page class="page-wrapper">
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-title">ACL Tree</h1>
        <p class="page-subtitle">Materialized path hierarchy — closest wins inheritance · GET /acl/tree</p>
      </div>
      <div class="page-header__actions">
        <button class="btn btn--secondary" @click="evalDialog = true">
          <q-icon name="verified_user" size="15px" />
          Evaluate Permission
        </button>
        <button class="btn btn--primary" @click="openCreate(null)">
          <q-icon name="add" size="15px" />
          Add Node
        </button>
      </div>
    </div>

    <div class="acl-layout">
      <!-- Tree Panel -->
      <div class="surface acl-tree-panel">
        <div class="acl-panel-header">
          <span style="font-size:13px;font-weight:600;color:var(--text-primary)">ACL Tree</span>
          <button class="btn btn--ghost btn--sm btn--icon" @click="loadTree" :disabled="loading">
            <q-icon name="refresh" size="15px" :class="loading && 'spin'" />
          </button>
        </div>

        <div v-if="loading" class="empty-state" style="padding:48px">
          <q-spinner size="28px" style="color:var(--brand-primary)" />
        </div>
        <div v-else-if="!tree.length" class="empty-state" style="padding:48px">
          <div class="empty-state__icon"><q-icon name="account_tree" /></div>
          <div class="empty-state__title">No nodes yet</div>
          <div class="empty-state__desc">Create a ROOT node to start</div>
          <button class="btn btn--primary" style="margin-top:16px" @click="openCreate(null)">
            <q-icon name="add" size="15px" />Create ROOT
          </button>
        </div>
        <div v-else class="acl-tree-body" @dragover.prevent @drop.prevent="onRootDrop">
          <AclNodeRow v-for="node in tree" :key="node.id"
            :node="node" :selected-id="selectedNode?.id" :depth="0"
            @select="selectNode" @create-child="openCreate"
            @edit="openEdit" @delete="confirmDelete"
            @drag-start="draggedNode=$event" @drop-on="onNodeDrop"
          />
        </div>
      </div>

      <!-- Detail Panel -->
      <div v-if="selectedNode" class="surface acl-detail-panel">
        <div class="acl-panel-header">
          <div style="display:flex;align-items:center;gap:8px">
            <div class="acl-type-chip" :class="`acl-type-chip--${selectedNode.node_type?.toLowerCase()}`">
              {{ selectedNode.node_type }}
            </div>
            <div>
              <div style="font-size:14px;font-weight:600;color:var(--text-primary)">{{ selectedNode.node_name }}</div>
              <div class="font-mono" style="font-size:11px;color:var(--text-quaternary)">{{ selectedNode.path }}</div>
            </div>
          </div>
          <div style="display:flex;gap:4px">
            <button class="btn btn--ghost btn--sm btn--icon" @click="openCreate(selectedNode)" title="Add child">
              <q-icon name="add" size="15px" />
            </button>
            <button class="btn btn--ghost btn--sm btn--icon" @click="openEdit(selectedNode)" title="Edit">
              <q-icon name="edit" size="15px" />
            </button>
          </div>
        </div>

        <div class="acl-detail-tabs">
          <button v-for="t in detailTabs" :key="t.key"
            :class="['acl-detail-tab', nodeTab===t.key && 'acl-detail-tab--active']"
            @click="nodeTab=t.key">{{ t.label }}</button>
        </div>

        <!-- ASSIGNMENTS -->
        <div v-show="nodeTab==='assignments'" class="acl-detail-body">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <span style="font-size:13px;font-weight:600;color:var(--text-primary)">Assignments</span>
            <button class="btn btn--secondary btn--sm" @click="assignDialog=true">
              <q-icon name="add" size="13px" /> Assign
            </button>
          </div>

          <div v-if="!nodeAssignments.length" class="empty-state" style="padding:32px">
            <div class="empty-state__icon"><q-icon name="assignment_ind" /></div>
            <div class="empty-state__title">No assignments</div>
          </div>
          <div v-for="a in nodeAssignments" :key="a.id" class="assignment-row">
            <div class="assignment-row__avatar" :class="`assignment-row__avatar--${a.subject_type?.toLowerCase()}`">
              <q-icon :name="a.subject_type==='USER'?'person':a.subject_type==='ROLE'?'badge':'group'" size="14px" />
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:500;color:var(--text-primary)">{{ a.subject_id }}</div>
              <div style="font-size:11px;color:var(--text-tertiary)">{{ a.subject_type }}</div>
            </div>
            <div class="permission-chip" :class="`permission-chip--${a.permission?.toLowerCase()}`">
              {{ a.permission }}
            </div>
          </div>
        </div>

        <!-- EVALUATE -->
        <div v-show="nodeTab==='evaluate'" class="acl-detail-body">
          <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:12px">
            POST /acl/evaluate — Closest-wins algorithm
          </div>
          <div style="display:flex;flex-direction:column;gap:10px">
            <div>
              <label class="field-label">user_id (Keycloak sub)</label>
              <q-input v-model="evalForm.user_id" outlined dense placeholder="u001" />
            </div>
            <div>
              <label class="field-label">permission</label>
              <q-select v-model="evalForm.permission" :options="['READ','WRITE','DELETE','ADMIN']" outlined dense />
            </div>
            <div>
              <label class="field-label">roles (comma separated)</label>
              <q-input v-model="evalRoles" outlined dense placeholder="HR_MANAGER,ADMIN" />
            </div>
            <div>
              <label class="field-label">groups (comma separated)</label>
              <q-input v-model="evalGroups" outlined dense placeholder="HR,Finance" />
            </div>
            <button class="btn btn--primary" style="width:100%" :disabled="evaluating" @click="doEvaluate">
              <q-spinner v-if="evaluating" size="13px" style="color:white" />
              Evaluate
            </button>

            <div v-if="evalResult" class="eval-result" :class="evalResult.allowed ? 'eval-result--ok' : 'eval-result--denied'">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                <q-icon :name="evalResult.allowed ? 'check_circle' : 'cancel'" size="20px" />
                <span style="font-size:15px;font-weight:700">{{ evalResult.allowed ? 'ALLOWED' : 'DENIED' }}</span>
              </div>
              <div style="font-size:12px;opacity:0.85">{{ evalResult.reason }}</div>
              <div v-if="evalResult.matched_node_id" class="font-mono" style="font-size:10px;margin-top:4px;opacity:0.7">
                matched node: {{ evalResult.matched_node_id }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Placeholder -->
      <div v-else class="surface empty-state" style="padding:60px">
        <div class="empty-state__icon"><q-icon name="account_tree" /></div>
        <div class="empty-state__title">Select a node</div>
        <div class="empty-state__desc">Click any node to manage assignments and evaluate permissions</div>
      </div>
    </div>

    <!-- Create/Edit Node Dialog -->
    <BaseFormDialog v-model="dialog"
      :title="editItem ? 'Update ACL Node' : `Create Node${parentItem ? ' under ' + parentItem.node_name : ''}`"
      icon="account_tree" icon-color="#6366f1"
      :loading="saving" @confirm="save">
      <div style="display:flex;flex-direction:column;gap:14px">
        <div>
          <label class="field-label">node_code <span style="color:var(--brand-danger)">*</span></label>
          <q-input v-model="form.node_code" outlined dense placeholder="HR_POLICIES" :disable="!!editItem" />
        </div>
        <div>
          <label class="field-label">node_name <span style="color:var(--brand-danger)">*</span></label>
          <q-input v-model="form.node_name" outlined dense placeholder="HR Policies" />
        </div>
        <div>
          <label class="field-label">node_type <span style="color:var(--brand-danger)">*</span></label>
          <q-select v-model="form.node_type" outlined dense
            :options="['ROOT','DOMAIN','CATEGORY','SUBCATEGORY']"
            :disable="!!editItem" />
        </div>
        <div v-if="form.parent_id" class="code-tag" style="font-size:11px">
          parent: {{ parentItem?.node_name }} ({{ form.parent_id }})
        </div>
        <div v-if="apiError" class="api-error-box">
          <q-icon name="error_outline" size="16px" />{{ apiError }}
        </div>
      </div>
    </BaseFormDialog>

    <!-- Assign Dialog -->
    <BaseFormDialog v-model="assignDialog" title="Create Assignment" icon="assignment_ind"
      confirm-label="Assign" :loading="savingAssign" @confirm="saveAssignment">
      <div style="display:flex;flex-direction:column;gap:14px">
        <div>
          <label class="field-label">subject_type <span style="color:var(--brand-danger)">*</span></label>
          <q-select v-model="assignForm.subject_type" outlined dense :options="['ROLE','GROUP','USER']" />
        </div>
        <div>
          <label class="field-label">subject_id <span style="color:var(--brand-danger)">*</span></label>
          <q-input v-model="assignForm.subject_id" outlined dense placeholder="HR_MANAGER / hr_group / user@email" />
        </div>
        <div>
          <label class="field-label">permission <span style="color:var(--brand-danger)">*</span></label>
          <q-select v-model="assignForm.permission" outlined dense :options="['READ','WRITE','DELETE','ADMIN']" />
          <div style="font-size:11px;color:var(--text-quaternary);margin-top:4px">READ &lt; WRITE &lt; DELETE &lt; ADMIN (higher implies lower)</div>
        </div>
        <div v-if="apiError" class="api-error-box">
          <q-icon name="error_outline" size="16px" />{{ apiError }}
        </div>
      </div>
    </BaseFormDialog>

    <!-- Global Evaluate Dialog -->
    <q-dialog v-model="evalDialog">
      <q-card style="width:500px;max-width:95vw;border-radius:12px">
        <div class="dialog-header">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="dialog-header__icon" style="background:#6366f1">
              <q-icon name="security" size="16px" style="color:white" />
            </div>
            <div class="dialog-header__title">Evaluate ACL Permission</div>
          </div>
          <button class="dialog-header__close" @click="evalDialog=false">
            <q-icon name="close" size="18px" />
          </button>
        </div>
        <div style="padding:20px;display:flex;flex-direction:column;gap:12px">
          <div><label class="field-label">node_id <span style="color:var(--brand-danger)">*</span></label>
            <q-input v-model="globalEval.node_id" outlined dense /></div>
          <div><label class="field-label">user_id</label>
            <q-input v-model="globalEval.user_id" outlined dense placeholder="Keycloak sub" /></div>
          <div><label class="field-label">permission</label>
            <q-select v-model="globalEval.permission" outlined dense :options="['READ','WRITE','DELETE','ADMIN']" /></div>
          <div><label class="field-label">roles</label>
            <q-input v-model="globalEval.roles" outlined dense placeholder="ROLE1,ROLE2" /></div>
          <div><label class="field-label">groups</label>
            <q-input v-model="globalEval.groups" outlined dense placeholder="GROUP1,GROUP2" /></div>
          <button class="btn btn--primary" :disabled="evaluating" @click="doGlobalEvaluate">Evaluate</button>
          <div v-if="evalResult" class="eval-result" :class="evalResult.allowed ? 'eval-result--ok' : 'eval-result--denied'">
            <div style="font-weight:700">{{ evalResult.allowed ? '✓ ALLOWED' : '✗ DENIED' }}</div>
            <div style="font-size:12px;margin-top:4px">{{ evalResult.reason }}</div>
          </div>
        </div>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script>
import { defineComponent, ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { knowledgeClient } from '../../../services/api/knowledge-platform.client.js'
import { keycloakService } from '../../../services/keycloak.service.js'
import { useUIStore } from '../../../stores/ui.store.js'
import BaseFormDialog from '../../../shared/components/BaseFormDialog.vue'
import AclNodeRow from './AclNodeRow.vue'

export default defineComponent({
  name: 'ACLTreePage',
  components: { BaseFormDialog, AclNodeRow },
  setup() {
    const $q = useQuasar()
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'Knowledge' }, { label: 'ACL Tree' }])

    const tree = ref([]), loading = ref(false), saving = ref(false)
    const selectedNode = ref(null), nodeTab = ref('assignments')
    const nodeAssignments = ref([])
    const dialog = ref(false), editItem = ref(null), parentItem = ref(null)
    const apiError = ref('')
    const form = ref({ node_code: '', node_name: '', node_type: 'DOMAIN', parent_id: null })
    const assignDialog = ref(false), savingAssign = ref(false)
    const assignForm = ref({ subject_type: 'ROLE', subject_id: '', permission: 'READ' })
    const evalDialog = ref(false), evaluating = ref(false), evalResult = ref(null)
    const evalForm = ref({ user_id: '', permission: 'READ' })
    const evalRoles = ref(''), evalGroups = ref('')
    const globalEval = ref({ node_id: '', user_id: '', permission: 'READ', roles: '', groups: '' })
    const draggedNode = ref(null)
    const detailTabs = [{ key: 'assignments', label: 'Assignments' }, { key: 'evaluate', label: 'Evaluate' }]

    async function loadTree() {
      loading.value = true
      try {
        tree.value = await knowledgeClient.getAclTree()
      } catch (e) {
        tree.value = []
        $q.notify({ type: 'negative', message: e.response?.data?.detail || `Failed to load ACL tree (${e.response?.status || e.message})` })
      } finally { loading.value = false }
    }

    async function selectNode(node) {
      selectedNode.value = node
      nodeTab.value = 'assignments'
      evalResult.value = null
      evalForm.value.user_id = keycloakService.getUserId() || ''
      try { nodeAssignments.value = await knowledgeClient.listAclAssignments({ node_id: node.id }) }
      catch (e) {
        nodeAssignments.value = []
        $q.notify({ type: 'negative', message: e.response?.data?.detail || 'Failed to load assignments' })
      }
    }

    function openCreate(parent) {
      parentItem.value = parent; editItem.value = null; apiError.value = ''
      form.value = { node_code: '', node_name: '', node_type: parent ? 'CATEGORY' : 'ROOT', parent_id: parent?.id || null }
      dialog.value = true
    }

    function openEdit(node) {
      parentItem.value = null; editItem.value = node; apiError.value = ''
      form.value = { node_code: node.node_code, node_name: node.node_name, node_type: node.node_type, parent_id: node.parent_id }
      dialog.value = true
    }

    async function save() {
      if (!form.value.node_code || !form.value.node_name) { apiError.value = 'node_code and node_name are required'; return }
      saving.value = true; apiError.value = ''
      try {
        if (editItem.value) {
          await knowledgeClient.updateAclNode(editItem.value.id, { node_name: form.value.node_name })
        } else {
          await knowledgeClient.createAclNode(form.value)
        }
        $q.notify({ type: 'positive', message: editItem.value ? 'Node updated' : 'Node created' })
        dialog.value = false; loadTree()
      } catch (e) {
        apiError.value = e.response?.data?.detail || 'Save failed'
      } finally { saving.value = false }
    }

    function confirmDelete(node) {
      $q.dialog({
        title: 'Delete ACL Node',
        message: `Delete <strong>${node.node_name}</strong> and all its descendants? Assignments will be cascade deleted.`,
        html: true,
        cancel: { label: 'Cancel', flat: true },
        ok: { label: 'Delete cascade', color: 'negative', unelevated: true }
      }).onOk(async () => {
        try {
          await knowledgeClient.deleteAclNode(node.id) // 204
          if (selectedNode.value?.id === node.id) selectedNode.value = null
          $q.notify({ type: 'positive', message: 'Node deleted' })
          loadTree()
        } catch (e) { $q.notify({ type: 'negative', message: e.response?.data?.detail || 'Delete failed' }) }
      })
    }

    async function saveAssignment() {
      if (!selectedNode.value || !assignForm.value.subject_id) { apiError.value = 'subject_id is required'; return }
      savingAssign.value = true; apiError.value = ''
      try {
        await knowledgeClient.createAclAssignment({
          node_id: selectedNode.value.id,
          subject_type: assignForm.value.subject_type,
          subject_id: assignForm.value.subject_id,
          permission: assignForm.value.permission
        })
        $q.notify({ type: 'positive', message: 'Assignment created' })
        assignDialog.value = false
        nodeAssignments.value = await knowledgeClient.listAclAssignments({ node_id: selectedNode.value.id })
      } catch (e) {
        apiError.value = e.response?.data?.detail || 'Failed'
      } finally { savingAssign.value = false }
    }

    async function doEvaluate() {
      if (!selectedNode.value) return
      evaluating.value = true; evalResult.value = null
      try {
        evalResult.value = await knowledgeClient.evaluateAcl({
          user_id: evalForm.value.user_id || undefined,
          node_id: selectedNode.value.id,
          permission: evalForm.value.permission,
          roles: evalRoles.value ? evalRoles.value.split(',').map(s => s.trim()).filter(Boolean) : undefined,
          groups: evalGroups.value ? evalGroups.value.split(',').map(s => s.trim()).filter(Boolean) : undefined
        })
      } catch (e) { $q.notify({ type: 'negative', message: e.response?.data?.detail || 'Evaluate failed' }) }
      finally { evaluating.value = false }
    }

    async function doGlobalEvaluate() {
      if (!globalEval.value.node_id) { $q.notify({ type: 'warning', message: 'node_id is required' }); return }
      evaluating.value = true; evalResult.value = null
      try {
        evalResult.value = await knowledgeClient.evaluateAcl({
          user_id: globalEval.value.user_id || undefined,
          node_id: globalEval.value.node_id,
          permission: globalEval.value.permission,
          roles: globalEval.value.roles ? globalEval.value.roles.split(',').map(s => s.trim()).filter(Boolean) : undefined,
          groups: globalEval.value.groups ? globalEval.value.groups.split(',').map(s => s.trim()).filter(Boolean) : undefined
        })
      } catch (e) { $q.notify({ type: 'negative', message: e.response?.data?.detail || 'Failed' }) }
      finally { evaluating.value = false }
    }

    function onNodeDrop({ target }) {
      if (!draggedNode.value || draggedNode.value.id === target.id) return
      $q.notify({ type: 'info', message: `Move "${draggedNode.value.node_name}" → "${target.node_name}" (requires backend move API)` })
      draggedNode.value = null
    }
    function onRootDrop() { draggedNode.value = null }

    onMounted(loadTree)
    return { tree, loading, saving, selectedNode, nodeTab, nodeAssignments, dialog, editItem, parentItem, form, apiError, assignDialog, savingAssign, assignForm, evalDialog, evaluating, evalResult, evalForm, evalRoles, evalGroups, globalEval, draggedNode, detailTabs, loadTree, selectNode, openCreate, openEdit, save, confirmDelete, saveAssignment, doEvaluate, doGlobalEvaluate, onNodeDrop, onRootDrop }
  }
})
</script>

<style lang="scss">
.acl-layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 12px;
  align-items: start;
  @media (max-width: 900px) { grid-template-columns: 1fr; }
}

.acl-tree-panel { display: flex; flex-direction: column; max-height: calc(100vh - 200px); }
.acl-detail-panel { display: flex; flex-direction: column; }

.acl-panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-bottom: 1px solid var(--border-subtle); flex-shrink: 0;
}

.acl-tree-body { flex: 1; overflow-y: auto; padding: 8px 6px; &::-webkit-scrollbar { width: 3px; } &::-webkit-scrollbar-thumb { background: var(--border-subtle); } }

.acl-node-row {
  display: flex; align-items: center; gap: 6px; padding: 6px 8px 6px 0;
  border-radius: 6px; cursor: pointer; transition: all 120ms ease; margin-bottom: 1px;
  position: relative;

  &:hover { background: var(--surface-sunken); }
  &--selected { background: var(--brand-primary-subtle); }
  &--dragover { background: rgba(99,102,241,0.12); border: 1.5px dashed var(--brand-primary); }

  &__toggle { background: transparent; border: none; cursor: pointer; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; color: var(--text-quaternary); flex-shrink: 0; }
  &__name { font-size: 13px; font-weight: 500; color: var(--text-primary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  &__actions { display: none; align-items: center; gap: 2px; flex-shrink: 0; }
  &:hover &__actions { display: flex; }
}

.acl-type-chip {
  font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  padding: 2px 5px; border-radius: 4px; flex-shrink: 0;
  &--root { background: rgba(239,68,68,0.1); color: #dc2626; }
  &--domain { background: rgba(99,102,241,0.1); color: #6366f1; }
  &--category { background: rgba(16,185,129,0.1); color: #059669; }
  &--subcategory { background: rgba(245,158,11,0.1); color: #d97706; }
  &--sm { font-size: 8px; padding: 1px 4px; }
}

.acl-detail-tabs { display: flex; border-bottom: 1px solid var(--border-subtle); padding: 0 10px; gap: 2px; }
.acl-detail-tab {
  padding: 9px 12px; border: none; background: transparent; font-size: 12px; font-weight: 500;
  color: var(--text-tertiary); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px;
  transition: all 120ms ease; font-family: var(--font-sans);
  &--active { color: var(--brand-primary); border-bottom-color: var(--brand-primary); }
  &:hover:not(.acl-detail-tab--active) { color: var(--text-primary); }
}

.acl-detail-body { padding: 16px; }

.assignment-row {
  display: flex; align-items: center; gap: 10px; padding: 10px 0;
  border-bottom: 1px solid var(--border-subtle);
  &:last-child { border-bottom: none; }

  &__avatar {
    width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    &--role { background: rgba(99,102,241,0.1); color: #6366f1; }
    &--group { background: rgba(16,185,129,0.1); color: #059669; }
    &--user { background: rgba(59,130,246,0.1); color: #3b82f6; }
  }
}

.permission-chip {
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  padding: 3px 8px; border-radius: 99px;
  &--read { background: var(--status-info-bg); color: var(--status-info-text); }
  &--write { background: rgba(245,158,11,0.1); color: #d97706; }
  &--delete { background: rgba(239,68,68,0.1); color: #dc2626; }
  &--admin { background: var(--status-error-bg); color: var(--status-error-text); font-weight: 800; }
}

.eval-result {
  padding: 12px 14px; border-radius: 8px; margin-top: 4px;
  &--ok { background: var(--status-success-bg); color: var(--status-success-text); border: 1px solid rgba(16,185,129,0.2); }
  &--denied { background: var(--status-error-bg); color: var(--status-error-text); border: 1px solid rgba(239,68,68,0.2); }
}
</style>