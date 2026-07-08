<template>
  <q-page class="page-wrapper">
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-title">ACL Assignments</h1>
        <p class="page-subtitle">GET /acl/assignments · POST /acl/assignments — Bind subjects to ACL nodes with permissions</p>
      </div>
      <div class="page-header__actions">
        <button class="btn btn--secondary" @click="loadData">
          <q-icon name="refresh" size="15px" :class="loading && 'spin'" />
        </button>
        <button class="btn btn--primary" @click="openCreate">
          <q-icon name="add" size="15px" />
          New Assignment
        </button>
      </div>
    </div>

    <!-- Filter -->
    <div class="filter-bar">
      <q-select v-model="filterNode" :options="aclNodeOptions" label="Filter by ACL Node"
        outlined dense clearable emit-value map-options style="min-width:240px"
        @update:model-value="loadData" />
    </div>

    <div class="surface" style="overflow:hidden">
      <q-table :rows="rows" :columns="columns" :loading="loading" row-key="id"
        flat class="eap-table" :pagination="{ rowsPerPage: 20 }">

        <template #body-cell-subject="props">
          <q-td :props="props">
            <div style="display:flex;align-items:center;gap:8px">
              <div class="assignment-row__avatar" :class="`assignment-row__avatar--${props.row.subject_type?.toLowerCase()}`">
                <q-icon :name="props.row.subject_type==='USER'?'person':props.row.subject_type==='ROLE'?'badge':'group'" size="14px" />
              </div>
              <div>
                <div style="font-size:13px;font-weight:600;color:var(--text-primary)">{{ props.row.subject_id }}</div>
                <div style="font-size:11px;color:var(--text-tertiary)">{{ props.row.subject_type }}</div>
              </div>
            </div>
          </q-td>
        </template>

        <template #body-cell-permission="props">
          <q-td :props="props">
            <div class="permission-chip" :class="`permission-chip--${props.value?.toLowerCase()}`">
              {{ props.value }}
            </div>
          </q-td>
        </template>

        <template #body-cell-node_id="props">
          <q-td :props="props">
            <div class="font-mono" style="font-size:11px;color:var(--text-tertiary)">
              {{ nodeLabel(props.value) }}
            </div>
          </q-td>
        </template>

        <template #no-data>
          <div class="empty-state" style="width:100%;padding:60px">
            <div class="empty-state__icon"><q-icon name="assignment_ind" /></div>
            <div class="empty-state__title">No assignments</div>
            <div class="empty-state__desc">Grant access by creating assignments on ACL nodes</div>
            <button class="btn btn--primary" @click="openCreate">
              <q-icon name="add" size="15px" />New Assignment
            </button>
          </div>
        </template>
      </q-table>
    </div>

    <!-- Create Dialog -->
    <BaseFormDialog v-model="dialog" title="Create Assignment" icon="assignment_ind"
      icon-color="#8b5cf6" :loading="saving" @confirm="save">
      <div style="display:flex;flex-direction:column;gap:14px">
        <div>
          <label class="field-label">node_id <span style="color:var(--brand-danger)">*</span></label>
          <q-select v-model="form.node_id" :options="aclNodeOptions" outlined dense emit-value map-options
            placeholder="Select ACL node" />
        </div>
        <div>
          <label class="field-label">subject_type <span style="color:var(--brand-danger)">*</span></label>
          <div class="subject-type-picker">
            <button v-for="t in subjectTypes" :key="t.value"
              :class="['subject-type-btn', form.subject_type===t.value && 'subject-type-btn--active']"
              @click="form.subject_type = t.value">
              <q-icon :name="t.icon" size="16px" />
              {{ t.label }}
            </button>
          </div>
        </div>
        <div>
          <label class="field-label">subject_id <span style="color:var(--brand-danger)">*</span></label>
          <q-input v-model="form.subject_id" outlined dense
            :placeholder="form.subject_type==='USER' ? 'keycloak-sub-uuid or email' : form.subject_type==='ROLE' ? 'HR_MANAGER' : 'hr_group'" />
          <div style="font-size:11px;color:var(--text-quaternary);margin-top:4px">
            {{ form.subject_type === 'USER' ? 'Keycloak sub claim or user identifier' : form.subject_type === 'ROLE' ? 'Role name from Keycloak realm_access.roles' : 'Group name from Keycloak groups claim' }}
          </div>
        </div>
        <div>
          <label class="field-label">permission <span style="color:var(--brand-danger)">*</span></label>
          <div class="permission-picker">
            <button v-for="p in permissions" :key="p.value"
              :class="['permission-btn', `permission-btn--${p.value.toLowerCase()}`, form.permission===p.value && 'permission-btn--active']"
              @click="form.permission = p.value">
              {{ p.label }}
            </button>
          </div>
          <div style="font-size:11px;color:var(--text-quaternary);margin-top:6px">
            READ &lt; WRITE &lt; DELETE &lt; ADMIN — higher permission implies all lower ones
          </div>
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
import { useUIStore } from '../../../stores/ui.store.js'
import BaseFormDialog from '../../../shared/components/BaseFormDialog.vue'

export default defineComponent({
  name: 'AssignmentsPage',
  components: { BaseFormDialog },
  setup() {
    const $q = useQuasar()
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'Knowledge' }, { label: 'Assignments' }])

    const rows = ref([]), loading = ref(false), saving = ref(false)
    const filterNode = ref(null), aclNodeOptions = ref([])
    const dialog = ref(false), apiError = ref('')
    const form = ref({ node_id: null, subject_type: 'ROLE', subject_id: '', permission: 'READ' })
    const nodeMap = ref({})

    const subjectTypes = [
      { value: 'ROLE', label: 'Role', icon: 'badge' },
      { value: 'GROUP', label: 'Group', icon: 'group' },
      { value: 'USER', label: 'User', icon: 'person' }
    ]
    const permissions = [
      { value: 'READ', label: 'READ' },
      { value: 'WRITE', label: 'WRITE' },
      { value: 'DELETE', label: 'DELETE' },
      { value: 'ADMIN', label: 'ADMIN' }
    ]

    const columns = [
      { name: 'subject', label: 'Subject', field: 'subject_id', align: 'left' },
      { name: 'permission', label: 'Permission', field: 'permission', align: 'left' },
      { name: 'node_id', label: 'ACL Node', field: 'node_id', align: 'left' }
    ]

    const nodeLabel = (id) => nodeMap.value[id] || id?.substring(0, 16) + '…'

    function flattenTree(nodes, prefix = '') {
      return nodes.reduce((acc, n) => {
        nodeMap.value[n.id] = prefix + n.node_name
        acc.push({ label: prefix + n.node_name + ` (${n.node_code})`, value: n.id })
        if (n.children?.length) acc.push(...flattenTree(n.children, prefix + '  '))
        return acc
      }, [])
    }

    async function loadMeta() {
      try {
        const tree = await knowledgeClient.getAclTree()
        aclNodeOptions.value = flattenTree(tree)
      } catch {}
    }

    async function loadData() {
      loading.value = true
      try {
        rows.value = await knowledgeClient.listAclAssignments(
          filterNode.value ? { node_id: filterNode.value } : undefined
        )
      } finally { loading.value = false }
    }

    function openCreate() {
      apiError.value = ''
      form.value = { node_id: null, subject_type: 'ROLE', subject_id: '', permission: 'READ' }
      dialog.value = true
    }

    async function save() {
      if (!form.value.node_id || !form.value.subject_id) {
        apiError.value = 'node_id and subject_id are required'; return
      }
      saving.value = true; apiError.value = ''
      try {
        await knowledgeClient.createAclAssignment(form.value)
        $q.notify({ type: 'positive', message: 'Assignment created' })
        dialog.value = false; loadData()
      } catch (e) {
        apiError.value = e.response?.data?.detail || 'Save failed'
      } finally { saving.value = false }
    }

    onMounted(() => { loadMeta(); loadData() })
    return { rows, columns, loading, saving, filterNode, aclNodeOptions, dialog, form, apiError, subjectTypes, permissions, nodeLabel, loadData, openCreate, save }
  }
})
</script>

<style lang="scss">
.subject-type-picker {
  display: flex;
  gap: 6px;
}

.subject-type-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  border-radius: 8px;
  border: 1.5px solid var(--border-default);
  background: var(--surface-raised);
  color: var(--text-tertiary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 120ms ease;
  font-family: var(--font-sans);

  &:hover { border-color: var(--brand-primary); color: var(--brand-primary); }
  &--active { border-color: var(--brand-primary); background: var(--brand-primary-subtle); color: var(--brand-primary); font-weight: 600; }
}

.permission-picker {
  display: flex;
  gap: 6px;
}

.permission-btn {
  flex: 1;
  padding: 7px 4px;
  border-radius: 6px;
  border: 1.5px solid var(--border-default);
  background: var(--surface-raised);
  cursor: pointer;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  transition: all 120ms ease;
  font-family: var(--font-sans);
  color: var(--text-tertiary);

  &--active {
    &.permission-btn--read { background: var(--status-info-bg); color: var(--status-info-text); border-color: rgba(59,130,246,0.3); }
    &.permission-btn--write { background: rgba(245,158,11,0.1); color: #d97706; border-color: rgba(245,158,11,0.3); }
    &.permission-btn--delete { background: rgba(239,68,68,0.1); color: #dc2626; border-color: rgba(239,68,68,0.3); }
    &.permission-btn--admin { background: var(--status-error-bg); color: var(--status-error-text); border-color: rgba(239,68,68,0.4); }
  }
}
</style>