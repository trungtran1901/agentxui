<template>
  <q-page class="page-wrapper">
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-title">MCP Capabilities</h1>
        <p class="page-subtitle">GET /api/v1/capabilities (MCP Gateway) — registry of callable capabilities (mock | http | n8n | mcp)</p>
      </div>
      <div class="page-header__actions">
        <button class="btn btn--secondary" @click="loadData">
          <q-icon name="refresh" size="15px" :class="loading && 'spin'" />
        </button>
        <button class="btn btn--primary" @click="openCreate">
          <q-icon name="add" size="15px" />
          New Capability
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar">
      <q-select v-model="filterProvider" :options="['mock','http','n8n','mcp']" clearable outlined dense
        label="provider_type" style="min-width:160px" @update:model-value="loadData" />
      <q-select v-model="filterEnabled" :options="enabledOptions" clearable outlined dense emit-value map-options
        label="enabled" style="min-width:140px" @update:model-value="loadData" />
      <q-space />
      <div style="font-size:12px;color:var(--text-tertiary)">{{ total }} capabilit{{ total === 1 ? 'y' : 'ies' }}</div>
    </div>

    <div class="surface" style="overflow:hidden">
      <q-table :rows="rows" :columns="columns" :loading="loading" row-key="id" flat class="eap-table"
        :pagination="pagination" @request="onRequest">
        <template #body-cell-name="props">
          <q-td :props="props">
            <div style="font-weight:600;font-size:13px;color:var(--text-primary)">{{ props.row.name }}</div>
            <div style="margin-top:2px;display:flex;align-items:center;gap:6px">
              <span class="code-tag">{{ props.row.code }}</span>
              <span class="code-tag" :style="providerTagStyle(props.row.provider_type)">{{ props.row.provider_type }}</span>
            </div>
            <div v-if="props.row.description" style="font-size:12px;color:var(--text-tertiary);margin-top:4px">{{ props.row.description }}</div>
          </q-td>
        </template>
        <template #body-cell-endpoint="props">
          <q-td :props="props">
            <code v-if="props.value" class="code-mono" style="font-size:11px;color:var(--text-tertiary)">{{ props.value }}</code>
            <span v-else style="color:var(--text-quaternary)">—</span>
          </q-td>
        </template>
        <template #body-cell-enabled="props">
          <q-td :props="props">
            <q-toggle :model-value="props.value" dense @update:model-value="v => toggleEnabled(props.row, v)" />
          </q-td>
        </template>
        <template #body-cell-actions="props">
          <q-td :props="props" auto-width>
            <div style="display:flex;align-items:center;gap:2px;justify-content:flex-end">
              <button class="tbl-action-btn" @click="openTest(props.row)" title="Test / Execute">
                <q-icon name="play_arrow" size="15px" />
              </button>
              <button class="tbl-action-btn" @click="openEdit(props.row)" title="Edit">
                <q-icon name="edit" size="15px" />
              </button>
              <div class="tbl-action-divider" />
              <button class="tbl-action-btn tbl-action-btn--danger" @click="confirmDelete(props.row)" title="Delete (soft)">
                <q-icon name="delete_outline" size="15px" />
              </button>
            </div>
          </q-td>
        </template>
        <template #no-data>
          <div class="empty-state" style="width:100%;padding:60px">
            <div class="empty-state__icon"><q-icon name="build_circle" /></div>
            <div class="empty-state__title">No capabilities</div>
            <button class="btn btn--primary" @click="openCreate"><q-icon name="add" size="15px" />New Capability</button>
          </div>
        </template>
      </q-table>
    </div>

    <!-- Create/Edit Dialog -->
    <BaseFormDialog v-model="dialog" :title="editItem ? 'Edit Capability' : 'New Capability'" icon="build_circle"
      icon-color="#f59e0b" :loading="saving" width="640px" @confirm="save">
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="row q-col-gutter-md">
          <div class="col-6">
            <label class="field-label">code <span style="color:var(--brand-danger)">*</span></label>
            <q-input v-model="form.code" outlined dense placeholder="customer.create" :disable="!!editItem"
              :hint="editItem ? 'Immutable after creation' : 'Unique — 409 CAPABILITY_ALREADY_EXISTS if taken'" />
          </div>
          <div class="col-6">
            <label class="field-label">name <span style="color:var(--brand-danger)">*</span></label>
            <q-input v-model="form.name" outlined dense placeholder="Create Customer" />
          </div>
        </div>
        <div>
          <label class="field-label">description</label>
          <q-input v-model="form.description" outlined dense type="textarea" :rows="2" />
        </div>
        <div class="row q-col-gutter-md">
          <div class="col-5">
            <label class="field-label">provider_type <span style="color:var(--brand-danger)">*</span></label>
            <q-select v-model="form.provider_type" outlined dense :options="['mock','http','n8n','mcp']"
              @update:model-value="onProviderTypeChange" />
          </div>
          <div class="col-7" v-if="form.provider_type === 'http' || form.provider_type === 'n8n'">
            <label class="field-label">endpoint</label>
            <q-input v-model="form.endpoint" outlined dense placeholder="http://crm.internal/customers" />
          </div>
        </div>

        <div v-if="form.provider_type === 'mcp'" class="row q-col-gutter-md">
          <div class="col-6">
            <label class="field-label">mcp_server <span style="color:var(--brand-danger)">*</span></label>
            <q-select v-model="mcpServerName" :options="mcpServerOptions" outlined dense
              emit-value map-options placeholder="Select MCP server"
              hint="Only enabled servers — GET /mcp-servers" />
          </div>
          <div class="col-6">
            <label class="field-label">tool_name <span style="color:var(--brand-danger)">*</span></label>
            <q-input v-model="mcpToolName" outlined dense placeholder="create_chart"
              hint="No discovery endpoint yet — check the MCP server's docs" />
          </div>
        </div>

        <div>
          <label class="field-label">input_schema (JSON Schema)</label>
          <textarea v-model="inputSchemaText" class="json-textarea" rows="4" placeholder='{"type":"object","required":["name"],"properties":{"name":{"type":"string"}}}' />
        </div>
        <div>
          <label class="field-label">output_schema (JSON Schema)</label>
          <textarea v-model="outputSchemaText" class="json-textarea" rows="3" placeholder='{"type":"object","properties":{"id":{"type":"string"}}}' />
        </div>
        <q-toggle v-model="form.enabled" label="Enabled" />
        <div v-if="apiError" class="api-error-box"><q-icon name="error_outline" size="16px" />{{ apiError }}</div>
      </div>
    </BaseFormDialog>

    <!-- Test / Execute Dialog -->
    <q-dialog v-model="testDialog">
      <q-card v-if="testItem" style="width:560px;max-width:95vw;border-radius:12px">
        <q-card-section class="row items-center" style="border-bottom:1px solid rgba(0,0,0,0.08)">
          <div class="text-subtitle1 text-weight-bold">Test — POST /api/v1/execute</div>
          <q-space />
          <q-btn flat round icon="close" v-close-popup />
        </q-card-section>
        <q-card-section>
          <div class="text-caption text-grey-6 q-mb-sm">capability: <span class="code-tag">{{ testItem.code }}</span></div>
          <label class="field-label">payload (JSON)</label>
          <textarea v-model="testPayloadText" class="json-textarea" rows="6" />
          <div v-if="testResult" class="q-mt-md" style="background:var(--surface-overlay);border:1px solid var(--border-subtle);border-radius:8px;padding:10px">
            <div class="row items-center q-mb-xs">
              <span class="badge" :class="testResult.success ? 'badge--active' : 'badge--error'">{{ testResult.success ? 'success' : (testResult.errorCode || 'failed') }}</span>
              <q-space />
              <span class="text-caption text-grey-5">executionId: {{ testResult.executionId }}</span>
            </div>
            <pre class="code-mono" style="font-size:11px;white-space:pre-wrap;margin:0">{{ JSON.stringify(testResult.success ? testResult.data : testResult.error, null, 2) }}</pre>
          </div>
        </q-card-section>
        <q-card-actions align="right" style="border-top:1px solid rgba(0,0,0,0.08)">
          <q-btn flat label="Close" v-close-popup />
          <q-btn color="primary" label="Execute" unelevated :loading="testing" @click="runTest" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script>
import { defineComponent, ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { mcpClient } from '../../../services/api/mcp-gateway.client.js'
import { useUIStore } from '../../../stores/ui.store.js'
import BaseFormDialog from '../../../shared/components/BaseFormDialog.vue'

export default defineComponent({
  name: 'CapabilitiesPage',
  components: { BaseFormDialog },
  setup() {
    const $q = useQuasar()
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'MCP Integration' }, { label: 'Capabilities' }])

    const rows = ref([]), loading = ref(false), saving = ref(false), total = ref(0)
    const dialog = ref(false), editItem = ref(null), apiError = ref('')
    const filterProvider = ref(null), filterEnabled = ref(null)
    const enabledOptions = [{ label: 'Enabled', value: true }, { label: 'Disabled', value: false }]
    const pagination = ref({ page: 1, rowsPerPage: 50, rowsNumber: 0 })

    const defaultForm = () => ({ code: '', name: '', description: '', provider_type: 'mock', endpoint: '', enabled: true })
    const form = ref(defaultForm())
    const inputSchemaText = ref(''), outputSchemaText = ref('')

    const mcpServerOptions = ref([]), mcpServerName = ref(null), mcpToolName = ref('')

    const testDialog = ref(false), testItem = ref(null), testPayloadText = ref('{}'), testResult = ref(null), testing = ref(false)

    const columns = [
      { name: 'name', label: 'Capability', field: 'name', align: 'left', sortable: true },
      { name: 'endpoint', label: 'Endpoint', field: 'endpoint', align: 'left' },
      { name: 'enabled', label: 'Enabled', field: 'enabled', align: 'center' },
      { name: 'actions', label: '', field: 'actions', align: 'right' }
    ]

    const providerTagStyle = p => p === 'http' ? 'background:#dbeafe;color:#1e40af'
      : p === 'n8n' ? 'background:#ede9fe;color:#5b21b6'
      : p === 'mcp' ? 'background:#dcfce7;color:#166534'
      : 'background:#f3f4f6;color:#374151'

    function splitMcpEndpoint(endpoint) {
      const idx = (endpoint || '').indexOf('::')
      if (idx === -1) return { server: null, tool: '' }
      return { server: endpoint.slice(0, idx), tool: endpoint.slice(idx + 2) }
    }

    function onProviderTypeChange() {
      form.value.endpoint = ''
      mcpServerName.value = null
      mcpToolName.value = ''
    }

    async function loadMcpServers() {
      try {
        const res = await mcpClient.listMcpServers()
        mcpServerOptions.value = (res.items || []).map(s => ({ label: `${s.name} (${s.transport})`, value: s.name }))
      } catch { mcpServerOptions.value = [] }
    }

    async function loadData() {
      loading.value = true
      try {
        const res = await mcpClient.listCapabilities({
          enabled: filterEnabled.value ?? undefined,
          provider_type: filterProvider.value || undefined,
          limit: pagination.value.rowsPerPage,
          offset: (pagination.value.page - 1) * pagination.value.rowsPerPage
        })
        rows.value = res.items
        total.value = res.total
        pagination.value.rowsNumber = res.total
      } catch (e) {
        $q.notify({ type: 'negative', message: e.response?.data?.error?.message || 'Failed to load capabilities' })
      } finally { loading.value = false }
    }

    function onRequest(reqProp) {
      pagination.value.page = reqProp.pagination.page
      pagination.value.rowsPerPage = reqProp.pagination.rowsPerPage
      loadData()
    }

    function openCreate() {
      editItem.value = null; apiError.value = ''
      form.value = defaultForm(); inputSchemaText.value = ''; outputSchemaText.value = ''
      mcpServerName.value = null; mcpToolName.value = ''
      dialog.value = true
    }

    function openEdit(item) {
      editItem.value = item; apiError.value = ''
      form.value = { code: item.code, name: item.name, description: item.description || '', provider_type: item.provider_type, endpoint: item.endpoint || '', enabled: item.enabled }
      inputSchemaText.value = item.input_schema ? JSON.stringify(item.input_schema, null, 2) : ''
      outputSchemaText.value = item.output_schema ? JSON.stringify(item.output_schema, null, 2) : ''
      if (item.provider_type === 'mcp') {
        const { server, tool } = splitMcpEndpoint(item.endpoint)
        mcpServerName.value = server
        mcpToolName.value = tool
      } else {
        mcpServerName.value = null
        mcpToolName.value = ''
      }
      dialog.value = true
    }

    function parseJsonField(text, label) {
      if (!text || !text.trim()) return undefined
      try { return JSON.parse(text) }
      catch { throw new Error(`${label} is not valid JSON`) }
    }

    async function save() {
      if (!form.value.code || !form.value.name || !form.value.provider_type) {
        apiError.value = 'code, name and provider_type are required'; return
      }

      if (form.value.provider_type === 'mcp') {
        if (!mcpServerName.value || !mcpToolName.value.trim()) {
          apiError.value = 'mcp_server and tool_name are required for provider_type "mcp"'; return
        }
        form.value.endpoint = `${mcpServerName.value}::${mcpToolName.value.trim()}`
      }

      let input_schema, output_schema
      try {
        input_schema = parseJsonField(inputSchemaText.value, 'input_schema')
        output_schema = parseJsonField(outputSchemaText.value, 'output_schema')
      } catch (e) { apiError.value = e.message; return }

      saving.value = true; apiError.value = ''
      const body = { ...form.value, input_schema, output_schema }
      try {
        if (editItem.value) await mcpClient.updateCapability(editItem.value.id, body)
        else await mcpClient.createCapability(body)
        $q.notify({ type: 'positive', message: 'Capability saved' })
        dialog.value = false; loadData()
      } catch (e) {
        const code = e.response?.data?.error?.code
        apiError.value = code === 'CAPABILITY_ALREADY_EXISTS'
          ? `Code "${form.value.code}" already exists (409)`
          : e.response?.data?.error?.message || 'Save failed'
      } finally { saving.value = false }
    }

    async function toggleEnabled(item, val) {
      try {
        if (val) await mcpClient.enableCapability(item.id)
        else await mcpClient.disableCapability(item.id)
        item.enabled = val
        $q.notify({ type: 'positive', message: val ? 'Enabled' : 'Disabled' })
      } catch (e) {
        $q.notify({ type: 'negative', message: e.response?.data?.error?.message || 'Update failed' })
      }
    }

    function confirmDelete(item) {
      $q.dialog({ title: 'Delete Capability', message: `Delete "${item.name}"? This is a soft delete — the row stays for audit history.`, cancel: { label: 'Cancel', flat: true }, ok: { label: 'Delete', color: 'negative', unelevated: true } })
        .onOk(async () => {
          try { await mcpClient.deleteCapability(item.id); $q.notify({ type: 'positive', message: 'Deleted' }); loadData() }
          catch (e) { $q.notify({ type: 'negative', message: e.response?.data?.error?.message || 'Delete failed' }) }
        })
    }

    function openTest(item) { testItem.value = item; testPayloadText.value = '{}'; testResult.value = null; testDialog.value = true }

    async function runTest() {
      let payload
      try { payload = JSON.parse(testPayloadText.value || '{}') }
      catch { $q.notify({ type: 'negative', message: 'Payload is not valid JSON' }); return }
      testing.value = true; testResult.value = null
      try {
        testResult.value = await mcpClient.execute({ capability: testItem.value.code, payload })
      } catch (e) {
        const env = e.response?.data
        testResult.value = { success: false, errorCode: env?.error?.code || 'PROVIDER_EXECUTION_FAILED', error: env?.error?.message || e.message, data: null, executionId: env?.correlationId }
      } finally { testing.value = false }
    }

    onMounted(() => { loadData(); loadMcpServers() })
    return { rows, columns, loading, saving, total, dialog, editItem, apiError, filterProvider, filterEnabled,
      enabledOptions, pagination, form, inputSchemaText, outputSchemaText, providerTagStyle,
      mcpServerOptions, mcpServerName, mcpToolName, onProviderTypeChange,
      testDialog, testItem, testPayloadText, testResult, testing,
      loadData, onRequest, openCreate, openEdit, save, toggleEnabled, confirmDelete, openTest, runTest }
  }
})
</script>

<style lang="scss">
.json-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
  resize: vertical;
  outline: none;
  background: var(--surface-base);
  color: var(--text-primary);

  &:focus { border-color: var(--brand-primary); box-shadow: var(--shadow-focus); }
}
</style>