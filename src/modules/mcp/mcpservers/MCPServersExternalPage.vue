<template>
  <q-page class="page-wrapper">
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-title">MCP Servers</h1>
        <p class="page-subtitle">
          GET/POST /mcp-servers · external MCP servers used as providers for `mcp`-type capabilities
        </p>
      </div>
      <div class="page-header__actions">
        <button class="btn btn--secondary" @click="loadData">
          <q-icon name="refresh" size="15px" :class="loading && 'spin'" />
        </button>
        <button class="btn btn--primary" @click="openCreate">
          <q-icon name="add" size="15px" />
          Add MCP Server
        </button>
      </div>
    </div>

    <div class="api-error-box" style="margin-bottom:16px;background:var(--status-info-bg);color:var(--status-info-text);border-color:rgba(59,130,246,0.2)">
      <q-icon name="info_outline" size="16px" />
      GET /mcp-servers currently only returns <strong>enabled</strong> servers — no pagination or filter yet.
      Disabling a server will make any capability whose <code class="code-tag" style="font-size:10px">endpoint</code>
      references it fail at execute time (<code class="code-tag" style="font-size:10px">PROVIDER_EXECUTION_FAILED</code>).
    </div>

    <div class="surface" style="overflow:hidden">
      <q-table :rows="rows" :columns="columns" :loading="loading" row-key="id" flat class="eap-table">
        <template #body-cell-name="props">
          <q-td :props="props">
            <div style="font-weight:600;font-size:13px;color:var(--text-primary)">{{ props.row.name }}</div>
            <div style="margin-top:2px">
              <span class="code-tag" :style="transportTagStyle(props.row.transport)">{{ props.row.transport }}</span>
            </div>
          </q-td>
        </template>

        <template #body-cell-connection="props">
          <q-td :props="props">
            <code class="code-mono" style="font-size:11px;color:var(--text-tertiary);word-break:break-all">
              {{ connectionSummary(props.row) }}
            </code>
          </q-td>
        </template>

        <template #body-cell-enabled="props">
          <q-td :props="props">
            <q-toggle :model-value="props.value" dense @update:model-value="v => toggleEnabled(props.row, v)" />
          </q-td>
        </template>

        <template #body-cell-created_at="props">
          <q-td :props="props" style="color:var(--text-tertiary);font-size:12px">
            {{ props.value ? dayjs(props.value).format('YYYY-MM-DD HH:mm') : '—' }}
          </q-td>
        </template>

        <template #body-cell-actions="props">
          <q-td :props="props" auto-width>
            <div style="display:flex;align-items:center;gap:2px;justify-content:flex-end">
              <button class="tbl-action-btn" @click="copyEndpointHint(props.row)" title="Copy endpoint prefix (server_name::)">
                <q-icon name="content_copy" size="15px" />
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
            <div class="empty-state__icon"><q-icon name="dns" /></div>
            <div class="empty-state__title">No MCP servers</div>
            <div class="empty-state__desc">Register an external MCP server (e.g. flint-chart-mcp) to use it as a capability provider.</div>
            <button class="btn btn--primary" @click="openCreate"><q-icon name="add" size="15px" />Add MCP Server</button>
          </div>
        </template>
      </q-table>
    </div>

    <!-- Create dialog -->
    <BaseFormDialog v-model="dialog" title="Add MCP Server" subtitle="POST /mcp-servers"
      icon="dns" icon-color="#6366f1" confirm-label="Create" :loading="saving" width="620px" @confirm="save">
      <div style="display:flex;flex-direction:column;gap:16px">
        <div>
          <label class="field-label">name <span style="color:var(--brand-danger)">*</span></label>
          <q-input v-model="form.name" outlined dense placeholder="flint-chart"
            hint="Unique — referenced as <name>::<tool_name> in capability.endpoint" />
        </div>

        <div>
          <label class="field-label">transport <span style="color:var(--brand-danger)">*</span></label>
          <div class="skill-type-picker">
            <button v-for="t in transports" :key="t.value"
              :class="['skill-type-pill', form.transport === t.value && 'skill-type-pill--active']"
              :style="form.transport === t.value ? `border-color:${t.color};background:${t.bg};color:${t.color}` : ''"
              @click="form.transport = t.value">
              <q-icon :name="t.icon" size="14px" />
              {{ t.label }}
            </button>
          </div>
          <div class="skill-type-desc">{{ currentTransport?.desc }}</div>
        </div>

        <!-- stdio form -->
        <div v-if="form.transport === 'stdio'" class="knowledge-config-panel">
          <div class="knowledge-config-panel__header">
            <q-icon name="terminal" size="16px" style="color:#8b5cf6" />
            <span>Process launch (Gateway spawns this)</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:12px;padding:16px">
            <div>
              <label class="field-label">command <span style="color:var(--brand-danger)">*</span></label>
              <q-input v-model="stdio.command" outlined dense placeholder="npx" />
            </div>
            <div>
              <label class="field-label">args (comma-separated)</label>
              <q-input v-model="stdio.argsText" outlined dense placeholder="-y, flint-chart-mcp" />
            </div>
            <div>
              <label class="field-label">env (JSON, optional)</label>
              <textarea v-model="stdio.envText" class="json-textarea" rows="3" placeholder='{"API_KEY": "..."}' />
            </div>
          </div>
        </div>

        <!-- sse / streamable_http form -->
        <div v-else class="knowledge-config-panel">
          <div class="knowledge-config-panel__header">
            <q-icon name="cable" size="16px" style="color:#8b5cf6" />
            <span>{{ form.transport === 'sse' ? 'SSE endpoint' : 'Streamable HTTP endpoint' }}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:12px;padding:16px">
            <div>
              <label class="field-label">url <span style="color:var(--brand-danger)">*</span></label>
              <q-input v-model="http.url" outlined dense
                :placeholder="form.transport === 'sse' ? 'http://flint-chart-mcp:8300/sse' : 'https://mcp.example.com/mcp'" />
            </div>
            <div>
              <label class="field-label">headers (JSON, optional)</label>
              <textarea v-model="http.headersText" class="json-textarea" rows="3" placeholder='{"Authorization": "Bearer xxx"}' />
            </div>
          </div>
        </div>

        <q-toggle v-model="form.enabled" label="Enabled" />

        <div v-if="apiError" class="api-error-box"><q-icon name="error_outline" size="16px" />{{ apiError }}</div>
      </div>
    </BaseFormDialog>
  </q-page>
</template>

<script>
import { defineComponent, ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { mcpClient } from '../../../services/api/mcp-gateway.client.js'
import { useUIStore } from '../../../stores/ui.store.js'
import BaseFormDialog from '../../../shared/components/BaseFormDialog.vue'
import dayjs from 'dayjs'

export default defineComponent({
  name: 'MCPServersExternalPage',
  components: { BaseFormDialog },
  setup() {
    const $q = useQuasar()
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'MCP Integration' }, { label: 'MCP Servers' }])

    const rows = ref([]), loading = ref(false), saving = ref(false)
    const dialog = ref(false), apiError = ref('')

    const transports = [
      { value: 'stdio', label: 'stdio', icon: 'terminal', color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', desc: 'Gateway spawns the process itself (command + args + env).' },
      { value: 'sse', label: 'SSE', icon: 'cable', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', desc: 'Connects to an already-running MCP server over Server-Sent Events.' },
      { value: 'streamable_http', label: 'Streamable HTTP', icon: 'http', color: '#10b981', bg: 'rgba(16,185,129,0.08)', desc: 'Connects over the Streamable HTTP MCP transport.' }
    ]
    const currentTransport = computed(() => transports.find(t => t.value === form.value.transport))

    const columns = [
      { name: 'name', label: 'Name / Transport', field: 'name', align: 'left', sortable: true },
      { name: 'connection', label: 'Connection', field: 'connection', align: 'left' },
      { name: 'enabled', label: 'Enabled', field: 'enabled', align: 'center' },
      { name: 'created_at', label: 'Created', field: 'created_at', align: 'left' },
      { name: 'actions', label: '', field: 'actions', align: 'right' }
    ]

    const defaultForm = () => ({ name: '', transport: 'sse', enabled: true })
    const form = ref(defaultForm())
    const stdio = ref({ command: '', argsText: '', envText: '' })
    const http = ref({ url: '', headersText: '' })

    function transportTagStyle(t) {
      const found = transports.find(x => x.value === t)
      return found ? `background:${found.bg};color:${found.color}` : ''
    }

    function connectionSummary(row) {
      const c = row.connection || {}
      if (row.transport === 'stdio') {
        return `${c.command || ''} ${(c.args || []).join(' ')}`.trim() || '—'
      }
      return c.url || '—'
    }

    async function loadData() {
      loading.value = true
      try {
        const res = await mcpClient.listMcpServers()
        rows.value = res.items || []
      } catch (e) {
        $q.notify({ type: 'negative', message: 'Failed to load MCP servers' })
      } finally { loading.value = false }
    }

    function openCreate() {
      apiError.value = ''
      form.value = defaultForm()
      stdio.value = { command: '', argsText: '', envText: '' }
      http.value = { url: '', headersText: '' }
      dialog.value = true
    }

    function parseJsonOrEmpty(text) {
      if (!text || !text.trim()) return {}
      try { return JSON.parse(text) } catch { return null }
    }

    async function save() {
      apiError.value = ''
      if (!form.value.name.trim()) { apiError.value = 'name is required'; return }

      let connection
      if (form.value.transport === 'stdio') {
        if (!stdio.value.command.trim()) { apiError.value = 'command is required for stdio transport'; return }
        const env = parseJsonOrEmpty(stdio.value.envText)
        if (env === null) { apiError.value = 'env is not valid JSON'; return }
        connection = {
          command: stdio.value.command.trim(),
          args: stdio.value.argsText.split(',').map(s => s.trim()).filter(Boolean),
          env
        }
      } else {
        if (!http.value.url.trim()) { apiError.value = 'url is required'; return }
        const headers = parseJsonOrEmpty(http.value.headersText)
        if (headers === null) { apiError.value = 'headers is not valid JSON'; return }
        connection = { url: http.value.url.trim(), headers }
      }

      saving.value = true
      try {
        await mcpClient.createMcpServer({
          name: form.value.name.trim(),
          transport: form.value.transport,
          connection,
          enabled: form.value.enabled
        })
        $q.notify({ type: 'positive', message: 'MCP server created' })
        dialog.value = false
        loadData()
      } catch (e) {
        const d = e.response?.data
        apiError.value = e.response?.status === 422
          ? (d?.message || 'Validation failed (422) — check required fields')
          : (d?.message || 'Create failed')
      } finally { saving.value = false }
    }

    async function toggleEnabled(row, val) {
      try {
        if (val) await mcpClient.enableMcpServer(row.id)
        else await mcpClient.disableMcpServer(row.id)
        row.enabled = val
        $q.notify({
          type: val ? 'positive' : 'warning',
          message: val ? 'Enabled' : 'Disabled — capabilities pointing here will now fail at execute time'
        })
      } catch (e) {
        $q.notify({ type: 'negative', message: e.response?.data?.message || 'Update failed' })
      }
    }

    async function copyEndpointHint(row) {
      try {
        await navigator.clipboard.writeText(`${row.name}::`)
        $q.notify({ type: 'positive', message: `Copied "${row.name}::" — append the tool name for capability.endpoint` })
      } catch { $q.notify({ type: 'negative', message: 'Copy failed' }) }
    }

    function confirmDelete(row) {
      $q.dialog({
        title: 'Delete MCP Server',
        message: `Delete "${row.name}"? This is a soft delete. Any capability with endpoint "${row.name}::&lt;tool&gt;" will start failing.`,
        html: true,
        cancel: { label: 'Cancel', flat: true },
        ok: { label: 'Delete', color: 'negative', unelevated: true }
      }).onOk(async () => {
        try {
          await mcpClient.deleteMcpServer(row.id)
          $q.notify({ type: 'positive', message: 'Deleted' })
          loadData()
        } catch (e) { $q.notify({ type: 'negative', message: e.response?.data?.message || 'Delete failed' }) }
      })
    }

    onMounted(loadData)
    return {
      rows, columns, loading, saving, dialog, apiError, form, stdio, http,
      transports, currentTransport, dayjs,
      transportTagStyle, connectionSummary, loadData, openCreate, save,
      toggleEnabled, copyEndpointHint, confirmDelete
    }
  }
})
</script>