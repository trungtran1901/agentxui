<template>
  <q-page class="page-wrapper">
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-title">Testing Console</h1>
        <p class="page-subtitle">POST /execute — payload forwarded as-is to the provider, context is passed through for audit</p>
      </div>
    </div>

    <div class="console-layout">
      <!-- Left: Request -->
      <div class="surface console-request">
        <div class="console-section-header">
          <span class="console-section-title">Request</span>
          <span class="code-tag" style="font-size:10px">POST /execute</span>
        </div>

        <div class="console-fields">
          <!-- Capability -->
          <div>
            <label class="field-label">capability <span style="color:var(--brand-danger)">*</span></label>
            <q-select v-model="capabilityCode" :options="capOptions" outlined dense
              use-input input-debounce="0" emit-value map-options clearable
              placeholder="e.g. customer.create"
              @filter="filterCaps" @update:model-value="onCapChange" />
          </div>

          <!-- Capability info card -->
          <div v-if="selectedCap" class="cap-info-card">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <span class="provider-chip" :class="`provider-chip--${selectedCap.provider_type}`">{{ selectedCap.provider_type }}</span>
              <span class="enable-toggle" :class="selectedCap.enabled ? 'enable-toggle--on' : 'enable-toggle--off'" style="cursor:default">
                <span class="enable-toggle__dot" />{{ selectedCap.enabled ? 'Enabled' : 'Disabled' }}
              </span>
            </div>
            <div v-if="selectedCap.description" style="font-size:12px;color:var(--text-tertiary)">{{ selectedCap.description }}</div>
            <div v-if="!selectedCap.enabled" class="api-error-box" style="margin-top:8px;font-size:11px">
              <q-icon name="warning" size="14px" />
              Disabled — execute will return 409 CAPABILITY_DISABLED
            </div>
          </div>

          <!-- Payload -->
          <div style="flex:1;display:flex;flex-direction:column">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
              <label class="field-label" style="margin:0">payload <span style="color:var(--text-quaternary)">(forwarded as-is to provider)</span></label>
              <div style="display:flex;gap:4px">
                <button class="btn btn--ghost btn--sm" @click="formatJson('payload')"><q-icon name="auto_fix_high" size="13px" /> Format</button>
                <button class="btn btn--ghost btn--sm" @click="payloadJson = '{}'">Clear</button>
              </div>
            </div>
            <div class="console-editor" style="flex:1;min-height:160px">
              <textarea v-model="payloadJson" class="console-textarea" spellcheck="false"
                placeholder='{\n  "name": "ABC Company"\n}' />
            </div>
          </div>

          <!-- Context -->
          <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
              <label class="field-label" style="margin:0">context <span style="color:var(--text-quaternary)">(passed through, not interpreted)</span></label>
              <button class="btn btn--ghost btn--sm" @click="formatJson('context')"><q-icon name="auto_fix_high" size="13px" /> Format</button>
            </div>
            <div class="console-editor" style="min-height:90px">
              <textarea v-model="contextJson" class="console-textarea" style="height:90px" spellcheck="false"
                placeholder='{\n  "userId": "u123"\n}' />
            </div>
          </div>

          <!-- Correlation -->
          <div>
            <label class="field-label">X-Correlation-ID <span style="color:var(--text-quaternary)">(optional header)</span></label>
            <div style="display:flex;gap:6px">
              <q-input v-model="correlationId" outlined dense style="flex:1" :placeholder="autoCorId" />
              <button class="btn btn--secondary btn--icon" @click="genCorrelationId" title="Generate">
                <q-icon name="refresh" size="16px" />
              </button>
            </div>
          </div>

          <button class="btn btn--primary" :disabled="!capabilityCode || executing" @click="execute"
            style="width:100%;height:40px;font-size:14px">
            <q-spinner v-if="executing" size="16px" style="color:white" />
            <q-icon v-else name="play_arrow" size="18px" />
            {{ executing ? 'Executing…' : 'Execute' }}
          </button>
        </div>
      </div>

      <!-- Right: Response -->
      <div class="surface console-response" style="display:flex;flex-direction:column">
        <div class="console-section-header">
          <span class="console-section-title">Response</span>
          <div style="display:flex;align-items:center;gap:8px" v-if="lastResult">
            <span class="badge" :class="lastResult.success ? 'badge--active' : 'badge--error'">
              {{ lastResult.success ? 'SUCCESS' : 'FAILED' }}
            </span>
            <span v-if="lastResult.errorCode" class="code-tag" style="color:var(--brand-danger)">{{ lastResult.errorCode }}</span>
            <span class="code-tag">{{ lastResult.latency_ms ?? 0 }}ms</span>
            <button class="btn btn--ghost btn--sm btn--icon" @click="copyResult" title="Copy"><q-icon name="content_copy" size="14px" /></button>
          </div>
        </div>

        <div class="console-tabs">
          <button v-for="t in resTabs" :key="t.key" :class="['console-tab', resTab===t.key && 'console-tab--active']" @click="resTab=t.key">
            {{ t.label }}
            <span v-if="t.key==='history' && history.length" class="console-tab__badge">{{ history.length }}</span>
          </button>
        </div>

        <div style="flex:1;overflow-y:auto;padding:16px">
          <!-- RESPONSE -->
          <div v-show="resTab==='response'">
            <div v-if="executing" class="empty-state" style="padding:60px">
              <q-spinner size="32px" style="color:var(--brand-primary);margin-bottom:16px" />
              <div class="empty-state__title">Executing…</div>
              <div class="empty-state__desc">POST /execute</div>
            </div>
            <div v-else-if="!lastResult" class="empty-state" style="padding:60px">
              <div class="empty-state__icon"><q-icon name="terminal" /></div>
              <div class="empty-state__title">No response yet</div>
              <div class="empty-state__desc">Select a capability and click Execute</div>
            </div>
            <template v-else>
              <!-- Hard failure: error envelope (404/409/502) -->
              <template v-if="lastResult.isHardFailure">
                <div class="api-error-box" style="margin-bottom:12px">
                  <q-icon name="error_outline" size="16px" />
                  <div>
                    <div style="font-weight:700">{{ lastResult.errorCode }} ({{ lastResult.httpStatus }})</div>
                    <div>{{ lastResult.error }}</div>
                  </div>
                </div>
                <label class="field-label">error.details</label>
                <pre class="code-block">{{ JSON.stringify(lastResult.details, null, 2) ?? 'null' }}</pre>
              </template>
              <!-- Execute response shape (200, success true or soft-fail) -->
              <template v-else>
                <div style="display:flex;gap:20px;margin-bottom:14px">
                  <div>
                    <label class="field-label">capability</label>
                    <div class="code-tag" style="display:inline-block;margin-top:4px">{{ lastResult.capability }}</div>
                  </div>
                  <div>
                    <label class="field-label">executionId</label>
                    <div class="code-tag" style="display:inline-block;margin-top:4px">{{ lastResult.executionId }}</div>
                  </div>
                </div>
                <div v-if="lastResult.error" style="margin-bottom:12px">
                  <div class="api-error-box">
                    <q-icon name="error_outline" size="16px" />
                    <div><div style="font-weight:600">{{ lastResult.errorCode }}</div><div>{{ lastResult.error }}</div></div>
                  </div>
                </div>
                <label class="field-label" style="margin-bottom:8px;display:block">data</label>
                <pre class="code-block">{{ JSON.stringify(lastResult.data, null, 2) ?? 'null' }}</pre>
              </template>
            </template>
          </div>

          <!-- HISTORY -->
          <div v-show="resTab==='history'">
            <div v-if="!history.length" class="empty-state" style="padding:40px">
              <div class="empty-state__icon"><q-icon name="history" /></div>
              <div class="empty-state__title">No history</div>
            </div>
            <div v-for="(h, i) in history" :key="i" class="history-item" :class="i===0 && 'history-item--latest'" @click="loadHistory(h)">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <span class="badge" :class="h.result.success ? 'badge--active' : 'badge--error'">{{ h.result.success ? 'OK' : 'ERR' }}</span>
                <span class="code-tag">{{ h.code }}</span>
                <span style="margin-left:auto;font-size:11px;color:var(--text-quaternary)">{{ h.result.latency_ms ?? 0 }}ms · {{ dayjs(h.at).format('HH:mm:ss') }}</span>
              </div>
              <div class="font-mono" style="font-size:10px;color:var(--text-tertiary);word-break:break-all">
                {{ h.result.errorCode || h.result.executionId || '—' }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </q-page>
</template>

<script>
import { defineComponent, ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { mcpClient } from '../../../services/api/mcp-gateway.client.js'
import { useUIStore } from '../../../stores/ui.store.js'
import dayjs from 'dayjs'

export default defineComponent({
  name: 'TestingConsolePage',
  setup() {
    const $q = useQuasar()
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'MCP Integration' }, { label: 'Testing Console' }])

    const capabilityCode = ref(''), allCapOpts = ref([]), capOptions = ref([]), allCaps = ref([])
    const selectedCap = ref(null)
    const payloadJson = ref('{\n  \n}'), contextJson = ref('{\n  \n}')
    const correlationId = ref(''), autoCorId = ref('')
    const executing = ref(false), lastResult = ref(null)
    const resTab = ref('response'), history = ref([])

    const resTabs = [{ key: 'response', label: 'Response' }, { key: 'history', label: 'History' }]

    function genCorrelationId() { autoCorId.value = crypto.randomUUID() }
    function filterCaps(val, update) {
      update(() => { const q = val.toLowerCase(); capOptions.value = q ? allCapOpts.value.filter(c => c.label.toLowerCase().includes(q)) : allCapOpts.value })
    }
    function onCapChange(code) {
      selectedCap.value = allCaps.value.find(c => c.code === code) || null
      if (selectedCap.value?.input_schema?.properties) {
        const ex = {}
        Object.entries(selectedCap.value.input_schema.properties).forEach(([k, def]) => {
          ex[k] = def.type === 'string' ? '' : def.type === 'number' ? 0 : def.type === 'boolean' ? false : null
        })
        payloadJson.value = JSON.stringify(ex, null, 2)
      }
    }
    function formatJson(which) {
      const ref_ = which === 'payload' ? payloadJson : contextJson
      try { ref_.value = JSON.stringify(JSON.parse(ref_.value), null, 2) } catch { $q.notify({ type: 'warning', message: 'Invalid JSON' }) }
    }

    async function execute() {
      if (!capabilityCode.value) return
      executing.value = true; lastResult.value = null; resTab.value = 'response'
      const t0 = Date.now()
      try {
        let payload = {}, context
        try { payload = JSON.parse(payloadJson.value) } catch {}
        try { context = JSON.parse(contextJson.value) } catch {}

        const headers = {}
        if (correlationId.value || autoCorId.value) headers['X-Correlation-ID'] = correlationId.value || autoCorId.value

        const res = await mcpClient.http.post('/execute', { capability: capabilityCode.value, payload, context }, { headers })
        const body = res.data
        body.latency_ms = Date.now() - t0
        body.isHardFailure = false
        lastResult.value = body

        history.value.unshift({ code: capabilityCode.value, result: body, at: new Date() })
        if (history.value.length > 30) history.value.pop()

        $q.notify({ type: body.success ? 'positive' : 'warning', message: body.success ? 'Execution successful' : `Soft failure: ${body.errorCode}` })
      } catch (e) {
        // Hard failure → error envelope { success:false, error:{code,message,details}, correlationId }
        const env = e.response?.data
        const result = {
          isHardFailure: true,
          httpStatus: e.response?.status,
          errorCode: env?.error?.code || 'NETWORK_ERROR',
          error: env?.error?.message || e.message,
          details: env?.error?.details,
          executionId: env?.correlationId,
          latency_ms: Date.now() - t0,
          success: false
        }
        lastResult.value = result
        history.value.unshift({ code: capabilityCode.value, result, at: new Date() })
        $q.notify({ type: 'negative', message: `${result.errorCode}: ${result.error}` })
      } finally { executing.value = false }
    }

    function loadHistory(h) { capabilityCode.value = h.code; lastResult.value = h.result }
    function copyResult() { navigator.clipboard.writeText(JSON.stringify(lastResult.value, null, 2)); $q.notify({ type: 'positive', message: 'Copied' }) }

    async function loadMeta() {
      genCorrelationId()
      try {
        const res = await mcpClient.listCapabilities({ limit: 200 })
        allCaps.value = res.items || []
        allCapOpts.value = allCaps.value.map(c => ({ label: `${c.code} — ${c.name}${!c.enabled ? ' (disabled)' : ''}`, value: c.code }))
        capOptions.value = [...allCapOpts.value]
      } catch {}
    }

    onMounted(loadMeta)
    return { capabilityCode, allCapOpts, capOptions, selectedCap, payloadJson, contextJson, correlationId, autoCorId, executing, lastResult, resTab, resTabs, history, dayjs, genCorrelationId, filterCaps, onCapChange, formatJson, execute, loadHistory, copyResult, mcpClient }
  }
})
</script>

<style lang="scss">
.console-layout { display: grid; grid-template-columns: 400px 1fr; gap: 12px; height: calc(100vh - var(--header-height) - 120px);
  @media (max-width: 900px) { grid-template-columns: 1fr; height: auto; } }
.console-request { display: flex; flex-direction: column; overflow: hidden; }
.console-response { overflow: hidden; }
.console-section-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--border-subtle); flex-shrink: 0; }
.console-section-title { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.console-fields { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 14px; }
.console-editor { border: 1px solid var(--border-default); border-radius: 6px; overflow: hidden; transition: border-color 150ms ease; &:focus-within { border-color: var(--brand-primary); box-shadow: var(--shadow-focus); } }
.console-textarea { width: 100%; height: 100%; min-height: 160px; padding: 12px; border: none; outline: none; font-family: var(--font-mono); font-size: 12px; line-height: 1.6; color: var(--text-primary); background: var(--surface-base); resize: none; tab-size: 2; }
.console-tabs { display: flex; gap: 2px; padding: 0 10px; border-bottom: 1px solid var(--border-subtle); flex-shrink: 0; }
.console-tab { display: flex; align-items: center; gap: 5px; padding: 10px 10px; border: none; background: transparent; font-size: 12px; font-weight: 500; color: var(--text-tertiary); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all 120ms ease; font-family: var(--font-sans);
  &--active { color: var(--brand-primary); border-bottom-color: var(--brand-primary); }
  &:hover:not(.console-tab--active) { color: var(--text-primary); }
  &__badge { background: var(--surface-sunken); color: var(--text-tertiary); font-size: 10px; font-weight: 600; border-radius: 99px; padding: 1px 5px; } }
.history-item { padding: 10px 12px; border-radius: 8px; cursor: pointer; border: 1px solid var(--border-subtle); margin-bottom: 6px; transition: all 120ms ease;
  &:hover { background: var(--surface-overlay); border-color: var(--border-default); }
  &--latest { border-color: var(--border-default); } }
.cap-info-card { padding: 10px 12px; background: var(--surface-overlay); border: 1px solid var(--border-subtle); border-radius: 8px; }
</style>