<template>
  <BaseCrudPage
    title="MCP Servers"
    subtitle="Manage MCP server integrations and providers"
    entity-name="MCP Server"
    :rows="rows"
    :columns="columns"
    :loading="loading"
    @create="openCreate"
    @edit="openEdit"
    @delete="confirmDelete"
    @refresh="loadData"
    @search="q => { search = q; loadData() }"
  >
    <template #body-cell-name="props">
      <q-td :props="props">
        <div class="text-weight-medium">{{ props.row.name }}</div>
        <div class="text-caption text-grey-6 code-mono">{{ props.row.url }}</div>
      </q-td>
    </template>
    <template #body-cell-provider_type="props">
      <q-td :props="props">
        <q-chip dense size="sm"
          :color="props.value === 'http' ? 'blue-1' : props.value === 'n8n' ? 'orange-1' : 'grey-2'"
          :text-color="props.value === 'http' ? 'blue-8' : props.value === 'n8n' ? 'orange-8' : 'grey-8'"
          :label="props.value?.toUpperCase()"
        />
      </q-td>
    </template>
    <template #body-cell-actions="props">
      <q-td :props="props" auto-width>
        <q-btn flat round dense icon="wifi" size="sm" color="teal" class="q-mr-xs" @click="testConnection(props.row)">
          <q-tooltip>Test Connection</q-tooltip>
        </q-btn>
        <q-btn flat round dense icon="more_vert" size="sm">
          <q-menu>
            <q-list style="min-width:140px">
              <q-item clickable v-close-popup @click="openEdit(props.row)">
                <q-item-section avatar><q-icon name="edit" /></q-item-section>
                <q-item-section>Edit</q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="testConnection(props.row)">
                <q-item-section avatar><q-icon name="wifi" /></q-item-section>
                <q-item-section>Test Connection</q-item-section>
              </q-item>
              <q-separator />
              <q-item clickable v-close-popup class="text-red" @click="confirmDelete(props.row)">
                <q-item-section avatar><q-icon name="delete" color="red" /></q-item-section>
                <q-item-section>Delete</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </q-td>
    </template>
  </BaseCrudPage>

  <!-- Create/Edit Dialog -->
  <BaseFormDialog v-model="dialog" :title="editItem ? 'Edit MCP Server' : 'Add MCP Server'" icon="dns"
    :loading="saving" width="700px" @confirm="save">
    <div class="q-gutter-md">
      <div class="row q-col-gutter-md">
        <div class="col-8">
          <q-input v-model="form.name" label="Server Name *" outlined dense />
        </div>
        <div class="col-4">
          <q-select v-model="form.provider_type" label="Provider Type" outlined dense :options="['http','n8n','mock']" />
        </div>
      </div>
      <q-input v-model="form.description" label="Description" outlined dense />
      <q-input v-model="form.url" label="Server URL" outlined dense placeholder="https://..." />
      <div class="row q-col-gutter-md">
        <div class="col-6">
          <q-select v-model="form.auth_type" label="Auth Type" outlined dense clearable
            :options="['none','bearer','api_key','basic','oauth2']" />
        </div>
        <div class="col-6">
          <q-select v-model="form.status" label="Status" outlined dense :options="['active','inactive']" />
        </div>
      </div>
      <div v-if="form.auth_type === 'bearer' || form.auth_type === 'api_key'">
        <q-input v-model="form.auth_token" label="Token / API Key" outlined dense type="password" />
      </div>

      <!-- Headers section -->
      <div>
        <div class="row items-center q-mb-sm">
          <div class="text-caption text-weight-bold text-grey-7">Custom Headers</div>
          <q-space />
          <q-btn flat dense size="sm" icon="add" label="Add Header" @click="addHeader" />
        </div>
        <div v-for="(h, i) in form.headers_list" :key="i" class="row q-col-gutter-sm q-mb-sm items-center">
          <div class="col">
            <q-input v-model="h.key" outlined dense placeholder="Header Name" />
          </div>
          <div class="col">
            <q-input v-model="h.value" outlined dense placeholder="Value" />
          </div>
          <div class="col-auto">
            <q-btn flat round dense icon="remove" color="red" size="sm" @click="removeHeader(i)" />
          </div>
        </div>
      </div>
    </div>
  </BaseFormDialog>
</template>

<script>
import { defineComponent, ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { mcpClient } from '../../../services/api/mcp-gateway.client'
import { useUIStore } from '../../../stores/ui.store'
import BaseCrudPage from '../../../shared/components/BaseCrudPage.vue'
import BaseFormDialog from '../../../shared/components/BaseFormDialog.vue'
import dayjs from 'dayjs'

export default defineComponent({
  name: 'MCPServersPage',
  components: { BaseCrudPage, BaseFormDialog },
  setup() {
    const $q = useQuasar()
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'MCP Integration' }, { label: 'MCP Servers' }])

    const rows = ref([]), loading = ref(false), saving = ref(false), search = ref('')
    const dialog = ref(false), editItem = ref(null)
    const defaultForm = () => ({ name: '', description: '', provider_type: 'http', url: '', auth_type: null, auth_token: '', status: 'active', headers_list: [] })
    const form = ref(defaultForm())

    const columns = [
      { name: 'name', label: 'Name / URL', field: 'name', align: 'left', sortable: true },
      { name: 'provider_type', label: 'Type', field: 'provider_type', align: 'left' },
      { name: 'status', label: 'Status', field: 'status', align: 'left' },
      { name: 'capability_count', label: 'Capabilities', field: 'capability_count', align: 'center', format: v => v ?? 0 },
      { name: 'created_at', label: 'Created', field: 'created_at', align: 'left', format: v => dayjs(v).format('YYYY-MM-DD') },
      { name: 'actions', label: '', field: 'actions', align: 'right' }
    ]

    async function loadData() {
      loading.value = true
      try { const res = await mcpClient.listServers({ search: search.value }); rows.value = res.data }
      finally { loading.value = false }
    }

    function openCreate() { editItem.value = null; form.value = defaultForm(); dialog.value = true }

    function openEdit(item) {
      editItem.value = item
      form.value = {
        ...defaultForm(), ...item,
        headers_list: Object.entries(item.headers || {}).map(([key, value]) => ({ key, value }))
      }
      dialog.value = true
    }

    async function save() {
      saving.value = true
      try {
        const headers = {}
        form.value.headers_list.forEach(h => { if (h.key) headers[h.key] = h.value })
        const payload = { ...form.value, headers }
        if (editItem.value) await mcpClient.updateServer(editItem.value.id, payload)
        else await mcpClient.createServer(payload)
        $q.notify({ type: 'positive', message: 'Server saved' })
        dialog.value = false; loadData()
      } finally { saving.value = false }
    }

    function confirmDelete(item) {
      $q.dialog({ title: 'Delete Server', message: `Delete "${item.name}"?`, cancel: true, ok: { color: 'red', label: 'Delete', unelevated: true } })
        .onOk(async () => { await mcpClient.deleteServer(item.id); loadData() })
    }

    async function testConnection(item) {
      const n = $q.notify({ type: 'ongoing', message: `Testing connection to ${item.name}...`, timeout: 0 })
      try {
        const res = await mcpClient.testServerConnection(item.id)
        n({ type: res.success ? 'positive' : 'negative', message: res.message || (res.success ? 'Connected!' : 'Failed'), timeout: 3000 })
      } catch {
        n({ type: 'negative', message: 'Connection test failed', timeout: 3000 })
      }
    }

    function addHeader() { form.value.headers_list.push({ key: '', value: '' }) }
    function removeHeader(i) { form.value.headers_list.splice(i, 1) }

    onMounted(loadData)
    return { rows, columns, loading, saving, search, dialog, editItem, form, loadData, openCreate, openEdit, save, confirmDelete, testConnection, addHeader, removeHeader }
  }
})
</script>
