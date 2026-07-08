<template>
  <q-page class="page-wrapper">
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-title">Collections</h1>
        <p class="page-subtitle">GET /collections · POST /collections · Each collection maps to an ACL node</p>
      </div>
      <div class="page-header__actions">
        <button class="btn btn--secondary" @click="loadData">
          <q-icon name="refresh" size="15px" :class="loading && 'spin'" />
          Refresh
        </button>
        <button class="btn btn--primary" @click="openCreate">
          <q-icon name="add" size="15px" />
          New Collection
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="surface" style="overflow:hidden">
      <q-table :rows="rows" :columns="columns" :loading="loading" row-key="id"
        flat class="eap-table" :pagination="{ rowsPerPage: 20 }">

        <template #body-cell-name="props">
          <q-td :props="props">
            <div style="font-weight:600;font-size:13px;color:var(--text-primary)">{{ props.row.name }}</div>
            <div style="margin-top:2px">
              <span class="code-tag">{{ props.row.code }}</span>
            </div>
            <div v-if="props.row.description" style="font-size:12px;color:var(--text-tertiary);margin-top:3px">
              {{ props.row.description }}
            </div>
          </q-td>
        </template>

        <template #body-cell-acl_node_id="props">
          <q-td :props="props">
            <div v-if="props.value" class="font-mono" style="font-size:11px;color:var(--text-tertiary)">
              {{ props.value.substring(0, 18) }}…
            </div>
            <span v-else style="color:var(--text-quaternary);font-size:12px">—</span>
          </q-td>
        </template>

        <template #body-cell-actions="props">
          <q-td :props="props" auto-width>
            <div style="display:flex;align-items:center;gap:2px;justify-content:flex-end">
              <button class="tbl-action-btn" @click="openEdit(props.row)" title="Edit">
                <q-icon name="edit" size="15px" />
              </button>
              <div class="tbl-action-divider" />
              <button class="tbl-action-btn tbl-action-btn--danger" @click="confirmDelete(props.row)" title="Delete">
                <q-icon name="delete_outline" size="15px" />
              </button>
            </div>
          </q-td>
        </template>

        <template #no-data>
          <div class="empty-state" style="width:100%;padding:60px">
            <div class="empty-state__icon"><q-icon name="folder_open" /></div>
            <div class="empty-state__title">No collections</div>
            <div class="empty-state__desc">Create a collection and bind it to an ACL node</div>
            <button class="btn btn--primary" @click="openCreate">
              <q-icon name="add" size="15px" />New Collection
            </button>
          </div>
        </template>
      </q-table>
    </div>

    <!-- Create/Edit Dialog -->
    <BaseFormDialog v-model="dialog"
      :title="editItem ? 'Update Collection' : 'New Collection'"
      icon="folder" icon-color="#f59e0b"
      :loading="saving" @confirm="save">
      <div style="display:flex;flex-direction:column;gap:14px">
        <div>
          <label class="field-label">code <span style="color:var(--brand-danger)">*</span></label>
          <q-input v-model="form.code" outlined dense placeholder="HR_POLICIES" :disable="!!editItem"
            :hint="editItem ? 'Cannot be changed' : ''" />
        </div>
        <div>
          <label class="field-label">name <span style="color:var(--brand-danger)">*</span></label>
          <q-input v-model="form.name" outlined dense placeholder="HR Policies" />
        </div>
        <div>
          <label class="field-label">description</label>
          <q-input v-model="form.description" outlined dense type="textarea" :rows="2"
            placeholder="All HR policy documents" />
        </div>
        <div>
          <label class="field-label">acl_node_id <span style="color:var(--brand-danger)">*</span></label>
          <q-select v-model="form.acl_node_id" :options="aclNodeOptions"
            outlined dense emit-value map-options clearable
            placeholder="Select ACL node" />
          <div style="font-size:11px;color:var(--text-quaternary);margin-top:4px">
            Links this collection to the ACL permission hierarchy
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
  name: 'CollectionsPage',
  components: { BaseFormDialog },
  setup() {
    const $q = useQuasar()
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'Knowledge' }, { label: 'Collections' }])

    const rows = ref([]), loading = ref(false), saving = ref(false)
    const dialog = ref(false), editItem = ref(null), apiError = ref('')
    const aclNodeOptions = ref([])
    const form = ref({ code: '', name: '', description: '', acl_node_id: null })

    const columns = [
      { name: 'name', label: 'Name / Code', field: 'name', align: 'left', sortable: true },
      { name: 'acl_node_id', label: 'ACL Node ID', field: 'acl_node_id', align: 'left' },
      { name: 'actions', label: '', field: 'actions', align: 'right' }
    ]

    // Flatten ACL tree to options
    function flattenTree(nodes, prefix = '') {
      return nodes.reduce((acc, n) => {
        acc.push({ label: prefix + n.node_name + ` (${n.node_code})`, value: n.id })
        if (n.children?.length) acc.push(...flattenTree(n.children, prefix + '  '))
        return acc
      }, [])
    }

    async function loadMeta() {
      try {
        const tree = await knowledgeClient.getAclTree()
        aclNodeOptions.value = flattenTree(tree)
      } catch { aclNodeOptions.value = [] }
    }

    async function loadData() {
      loading.value = true
      try { rows.value = await knowledgeClient.listCollections() }
      catch { $q.notify({ type: 'negative', message: 'Failed to load collections' }) }
      finally { loading.value = false }
    }

    function openCreate() {
      editItem.value = null; apiError.value = ''
      form.value = { code: '', name: '', description: '', acl_node_id: null }
      dialog.value = true
    }

    function openEdit(item) {
      editItem.value = item; apiError.value = ''
      form.value = { code: item.code, name: item.name, description: item.description || '', acl_node_id: item.acl_node_id }
      dialog.value = true
    }

    async function save() {
      if (!form.value.code || !form.value.name || !form.value.acl_node_id) {
        apiError.value = 'code, name, and acl_node_id are required'; return
      }
      saving.value = true; apiError.value = ''
      try {
        if (editItem.value) {
          await knowledgeClient.updateCollection(editItem.value.id, {
            name: form.value.name,
            description: form.value.description
          })
          $q.notify({ type: 'positive', message: 'Collection updated' })
        } else {
          await knowledgeClient.createCollection(form.value)
          $q.notify({ type: 'positive', message: 'Collection created' })
        }
        dialog.value = false; loadData()
      } catch (e) {
        apiError.value = e.response?.data?.detail || 'Save failed'
      } finally { saving.value = false }
    }

    function confirmDelete(item) {
      $q.dialog({
        title: 'Delete Collection',
        message: `Delete <strong>${item.name}</strong>? This will cascade delete all documents.`,
        html: true,
        cancel: { label: 'Cancel', flat: true },
        ok: { label: 'Delete', color: 'negative', unelevated: true }
      }).onOk(async () => {
        try {
          await knowledgeClient.deleteCollection(item.id) // 204
          $q.notify({ type: 'positive', message: 'Collection deleted' })
          loadData()
        } catch (e) { $q.notify({ type: 'negative', message: e.response?.data?.detail || 'Delete failed' }) }
      })
    }

    onMounted(() => { loadData(); loadMeta() })
    return { rows, columns, loading, saving, dialog, editItem, form, apiError, aclNodeOptions, loadData, openCreate, openEdit, save, confirmDelete }
  }
})
</script>