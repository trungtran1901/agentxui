<template>
  <q-page class="page-wrapper">
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-title">Webhooks</h1>
        <p class="page-subtitle">POST /webhooks · GET /webhooks — let external systems trigger a source sync</p>
      </div>
      <div class="page-header__actions">
        <button class="btn btn--secondary" @click="loadData">
          <q-icon name="refresh" size="15px" :class="loading && 'spin'" />
        </button>
        <button class="btn btn--primary" @click="openCreate">
          <q-icon name="add" size="15px" />
          New Webhook
        </button>
      </div>
    </div>

    <div class="filter-bar">
      <q-select v-model="filterSource" :options="sourceOptions" label="Filter by source"
        outlined dense clearable emit-value map-options style="min-width:240px"
        @update:model-value="loadData" />
    </div>

    <div class="surface" style="overflow:hidden">
      <q-table :rows="rows" :columns="columns" :loading="loading" row-key="id" flat class="eap-table"
        :pagination="{ rowsPerPage: 20 }">
        <template #body-cell-source_id="props">
          <q-td :props="props">{{ sourceLabel(props.value) }}</q-td>
        </template>
        <template #body-cell-token="props">
          <q-td :props="props">
            <div style="display:flex;align-items:center;gap:6px">
              <span class="code-tag" style="font-size:11px">{{ props.value?.substring(0, 14) }}…</span>
              <button class="btn btn--ghost btn--sm btn--icon" @click="copyReceiveUrl(props.value)" title="Copy receive URL">
                <q-icon name="content_copy" size="13px" />
              </button>
            </div>
          </q-td>
        </template>
        <template #body-cell-enabled="props">
          <q-td :props="props">
            <span class="badge" :class="props.value ? 'badge--active' : 'badge--inactive'">{{ props.value ? 'enabled' : 'disabled' }}</span>
          </q-td>
        </template>
        <template #body-cell-last_triggered_at="props">
          <q-td :props="props" style="color:var(--text-tertiary);font-size:12px">
            {{ props.value ? dayjs(props.value).fromNow() : 'never' }}
          </q-td>
        </template>
        <template #body-cell-actions="props">
          <q-td :props="props" auto-width>
            <button class="tbl-action-btn tbl-action-btn--danger" @click="confirmDelete(props.row)" title="Delete">
              <q-icon name="delete_outline" size="15px" />
            </button>
          </q-td>
        </template>
        <template #no-data>
          <div class="empty-state" style="width:100%;padding:60px">
            <div class="empty-state__icon"><q-icon name="webhook" /></div>
            <div class="empty-state__title">No webhooks</div>
            <div class="empty-state__desc">Create a webhook to let an external system (e.g. a CMS) push sync events into a Source without polling.</div>
            <button class="btn btn--primary" @click="openCreate"><q-icon name="add" size="15px" />New Webhook</button>
          </div>
        </template>
      </q-table>
    </div>

    <BaseFormDialog v-model="dialog" title="Create Webhook" subtitle="POST /webhooks"
      icon="webhook" icon-color="#10b981" confirm-label="Create" :loading="saving" @confirm="save">
      <div style="display:flex;flex-direction:column;gap:14px">
        <div>
          <label class="field-label">source_id <span style="color:var(--brand-danger)">*</span></label>
          <q-select v-model="form.source_id" :options="sourceOptions" outlined dense emit-value map-options placeholder="Select source" />
        </div>
        <div>
          <label class="field-label">description</label>
          <q-input v-model="form.description" outlined dense placeholder="Triggered by SharePoint Flow" />
        </div>
        <div v-if="apiError" class="api-error-box"><q-icon name="error_outline" size="16px" />{{ apiError }}</div>
      </div>
    </BaseFormDialog>

    <!-- Reveal secret token once, right after creation -->
    <q-dialog v-model="tokenDialog">
      <q-card style="width:520px;max-width:95vw;border-radius:12px">
        <div class="dialog-header">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="dialog-header__icon" style="background:#10b981"><q-icon name="key" size="16px" style="color:white" /></div>
            <div class="dialog-header__title">Webhook created</div>
          </div>
          <button class="dialog-header__close" @click="tokenDialog=false"><q-icon name="close" size="18px" /></button>
        </div>
        <div style="padding:20px">
          <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:8px">
            Save this URL now — the token acts as the secret and is not shown again in full.
          </div>
          <div class="code-block" style="font-size:12px;word-break:break-all">{{ newReceiveUrl }}</div>
          <button class="btn btn--primary" style="width:100%;margin-top:14px" @click="copyReceiveUrl(newToken)">
            <q-icon name="content_copy" size="15px" />Copy URL
          </button>
        </div>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script>
import { defineComponent, ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { knowledgeClient } from '../../../services/api/knowledge-platform.client.js'
import { useUIStore } from '../../../stores/ui.store.js'
import { ENV } from '../../../services/env.js'
import BaseFormDialog from '../../../shared/components/BaseFormDialog.vue'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
dayjs.extend(relativeTime)

export default defineComponent({
  name: 'WebhooksPage',
  components: { BaseFormDialog },
  setup() {
    const $q = useQuasar()
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'Knowledge' }, { label: 'Webhooks' }])

    const rows = ref([]), loading = ref(false)
    const filterSource = ref(null), sourceOptions = ref([]), sourceMap = ref({})
    const dialog = ref(false), saving = ref(false), apiError = ref('')
    const form = ref({ source_id: null, description: '' })
    const tokenDialog = ref(false), newToken = ref(''), newReceiveUrl = ref('')

    const columns = [
      { name: 'source_id', label: 'Source', field: 'source_id', align: 'left' },
      { name: 'description', label: 'Description', field: 'description', align: 'left', format: v => v || '—' },
      { name: 'token', label: 'Token / URL', field: 'token', align: 'left' },
      { name: 'enabled', label: 'Status', field: 'enabled', align: 'left' },
      { name: 'last_triggered_at', label: 'Last Triggered', field: 'last_triggered_at', align: 'left' },
      { name: 'actions', label: '', field: 'actions', align: 'right' }
    ]

    const sourceLabel = (id) => sourceMap.value[id] || id?.substring(0, 12) + '…'

    function receiveUrl(token) {
      // POST /api/v1/webhooks/receive/{token} — no JWT required
      const base = (ENV.KNOWLEDGE_API_URL || '').replace(/\/$/, '')
      return `${base}/api/v1/webhooks/receive/${token}`
    }

    async function copyReceiveUrl(token) {
      try {
        await navigator.clipboard.writeText(receiveUrl(token))
        $q.notify({ type: 'positive', message: 'Receive URL copied' })
      } catch { $q.notify({ type: 'negative', message: 'Copy failed' }) }
    }

    async function loadSources() {
      try {
        const src = await knowledgeClient.listSources()
        sourceOptions.value = src.map(s => ({ label: s.name, value: s.id }))
        src.forEach(s => { sourceMap.value[s.id] = s.name })
      } catch { sourceOptions.value = [] }
    }

    async function loadData() {
      loading.value = true
      try {
        rows.value = await knowledgeClient.listWebhooks(
          filterSource.value ? { source_id: filterSource.value } : undefined
        )
      } catch { $q.notify({ type: 'negative', message: 'Failed to load webhooks' }) }
      finally { loading.value = false }
    }

    function openCreate() { form.value = { source_id: filterSource.value || null, description: '' }; apiError.value = ''; dialog.value = true }

    async function save() {
      if (!form.value.source_id) { apiError.value = 'source_id is required'; return }
      saving.value = true; apiError.value = ''
      try {
        const created = await knowledgeClient.createWebhook(form.value)
        dialog.value = false
        newToken.value = created.token
        newReceiveUrl.value = receiveUrl(created.token)
        tokenDialog.value = true
        loadData()
      } catch (e) { apiError.value = e.response?.data?.detail || 'Create failed' }
      finally { saving.value = false }
    }

    function confirmDelete(wh) {
      $q.dialog({ title: 'Delete Webhook', message: 'External triggers via this URL will stop working immediately.', cancel: { label: 'Cancel', flat: true }, ok: { label: 'Delete', color: 'negative', unelevated: true } })
        .onOk(async () => {
          try { await knowledgeClient.deleteWebhook(wh.id); $q.notify({ type: 'positive', message: 'Deleted' }); loadData() }
          catch (e) { $q.notify({ type: 'negative', message: e.response?.data?.detail || 'Delete failed' }) }
        })
    }

    onMounted(() => { loadSources(); loadData() })
    return { rows, columns, loading, filterSource, sourceOptions, dialog, saving, apiError, form,
      tokenDialog, newToken, newReceiveUrl, sourceLabel, copyReceiveUrl, loadData, openCreate, save, confirmDelete, dayjs }
  }
})
</script>