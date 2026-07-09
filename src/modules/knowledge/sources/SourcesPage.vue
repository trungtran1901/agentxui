<template>
  <q-page class="page-wrapper">
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-title">Sources</h1>
        <p class="page-subtitle">GET/POST /sources · connector-based ingestion — sync, schedule, and chunk per source</p>
      </div>
      <div class="page-header__actions">
        <button class="btn btn--secondary" @click="loadData">
          <q-icon name="refresh" size="15px" :class="loading && 'spin'" />
        </button>
        <button class="btn btn--primary" @click="openCreate">
          <q-icon name="add" size="15px" />
          New Source
        </button>
      </div>
    </div>

    <div class="filter-bar">
      <q-select v-model="filterCollection" :options="collectionOptions" label="Filter by collection"
        outlined dense clearable emit-value map-options style="min-width:220px"
        @update:model-value="loadData" />
      <div style="font-size:12px;color:var(--text-tertiary)">
        {{ rows.length }} source{{ rows.length !== 1 ? 's' : '' }}
      </div>
    </div>

    <div class="surface" style="overflow:hidden">
      <q-table :rows="rows" :columns="columns" :loading="loading" row-key="id"
        flat class="eap-table" :pagination="{ rowsPerPage: 20 }">

        <template #body-cell-name="props">
          <q-td :props="props">
            <div style="font-weight:600;font-size:13px;color:var(--text-primary)">{{ props.row.name }}</div>
            <div style="margin-top:2px;display:flex;align-items:center;gap:6px">
              <span class="code-tag">{{ props.row.type_code }}</span>
              <span v-if="props.row.schedule_type" class="code-tag" style="font-size:10px">{{ props.row.schedule_type }}</span>
            </div>
          </q-td>
        </template>

        <template #body-cell-status="props">
          <q-td :props="props">
            <div style="display:flex;align-items:center;gap:6px">
              <span class="badge" :class="statusClass(props.value)">{{ props.value || 'unknown' }}</span>
              <span v-if="!props.row.enabled" class="badge badge--inactive badge--no-dot" style="font-size:10px">disabled</span>
            </div>
            <div v-if="props.row.last_error" style="font-size:11px;color:var(--brand-danger);margin-top:3px">
              {{ props.row.last_error }}
            </div>
          </q-td>
        </template>

        <template #body-cell-progress="props">
          <q-td :props="props" style="color:var(--text-tertiary);font-size:12px">
            {{ props.row.document_count ?? 0 }} docs · {{ props.row.indexed_chunks ?? 0 }} chunks
          </q-td>
        </template>

        <template #body-cell-last_sync_at="props">
          <q-td :props="props" style="color:var(--text-tertiary);font-size:12px">
            {{ props.value ? dayjs(props.value).fromNow() : '—' }}
            <div v-if="props.row.next_sync_at" style="font-size:10px;color:var(--text-quaternary)">
              next: {{ dayjs(props.row.next_sync_at).fromNow() }}
            </div>
          </q-td>
        </template>

        <template #body-cell-actions="props">
          <q-td :props="props" auto-width>
            <div style="display:flex;align-items:center;gap:2px;justify-content:flex-end">
              <button v-if="props.row.status !== 'SYNCING' && props.row.status !== 'RUNNING'"
                class="tbl-action-btn" title="Sync now (POST /sources/{id}/sync)"
                @click="doSync(props.row)">
                <q-icon name="sync" size="15px" style="color:var(--brand-primary)" />
              </button>
              <button v-else
                class="tbl-action-btn" title="Stop sync (POST /sources/{id}/stop)"
                @click="doStop(props.row)">
                <q-icon name="stop_circle" size="15px" style="color:var(--brand-danger)" />
              </button>
              <button class="tbl-action-btn" title="Reindex (full re-run)" @click="doReindex(props.row)">
                <q-icon name="model_training" size="15px" style="color:#8b5cf6" />
              </button>
              <button class="tbl-action-btn" title="Health & job history" @click="openDetail(props.row)">
                <q-icon name="monitor_heart" size="15px" style="color:var(--brand-secondary)" />
              </button>
              <button class="tbl-action-btn" title="Edit" @click="openEdit(props.row)">
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
            <div class="empty-state__icon"><q-icon name="hub" /></div>
            <div class="empty-state__title">No sources yet</div>
            <div class="empty-state__desc">Connect a data source (SharePoint, web crawl, S3, …) to start ingesting content automatically. For one-off files, you can still use <router-link to="/knowledge/documents">Documents Upload</router-link>.</div>
            <button class="btn btn--primary" @click="openCreate">
              <q-icon name="add" size="15px" />New Source
            </button>
          </div>
        </template>
      </q-table>
    </div>

    <!-- ============ CREATE / EDIT DIALOG ============ -->
    <BaseFormDialog v-model="formDialog"
      :title="editItem ? 'Update Source' : 'New Source'"
      :subtitle="editItem ? `PUT /sources/${editItem.id}` : 'POST /sources'"
      icon="hub" icon-color="#6366f1"
      confirm-label="Save" :loading="saving" width="620px"
      @confirm="save">
      <div style="display:flex;flex-direction:column;gap:14px">
        <div>
          <label class="field-label">collection_id <span style="color:var(--brand-danger)">*</span></label>
          <q-select v-model="form.collection_id" :options="collectionOptions"
            outlined dense emit-value map-options placeholder="Select collection" :disable="!!editItem" />
        </div>

        <div>
          <label class="field-label">name <span style="color:var(--brand-danger)">*</span></label>
          <q-input v-model="form.name" outlined dense placeholder="Company SharePoint — HR Docs" />
        </div>

        <!-- Connector type — dynamically loaded from GET /connectors -->
        <div>
          <label class="field-label">
            connector type <span style="color:var(--brand-danger)">*</span>
            <span class="field-hint" style="margin-left:4px;color:var(--text-quaternary)">GET /connectors</span>
          </label>
          <div class="skill-type-picker">
            <button v-for="c in connectors" :key="c.type_code"
              :class="['skill-type-pill', form.type_code === c.type_code && 'skill-type-pill--active']"
              :style="form.type_code === c.type_code ? 'border-color:var(--brand-primary);background:var(--brand-primary-subtle);color:var(--brand-primary)' : ''"
              :disabled="!!editItem || c.enabled === false"
              @click="selectConnector(c)">
              <q-icon name="cable" size="14px" />
              {{ c.display_name || c.type_code }}
            </button>
          </div>
          <div v-if="selectedConnector?.description" class="skill-type-desc">{{ selectedConnector.description }}</div>
        </div>

        <!-- Dynamic connector configuration -->
        <div v-if="selectedConnector" class="knowledge-config-panel">
          <div class="knowledge-config-panel__header">
            <q-icon name="tune" size="16px" style="color:#8b5cf6" />
            <span>Connector Configuration</span>
          </div>
          <div style="padding:14px 16px">
            <DynamicConnectorForm v-model="form.configuration" :schema="selectedConnector.config_schema" />
          </div>
        </div>

        <!-- Schedule -->
        <div class="row q-col-gutter-md">
          <div class="col-6">
            <label class="field-label">schedule_type</label>
            <q-select v-model="form.schedule_type" outlined dense clearable
              :options="['MANUAL','CRON','INTERVAL','WEBHOOK','DAILY','WEEKLY','MONTHLY']" placeholder="MANUAL" />
          </div>
          <div class="col-6" v-if="form.schedule_type && form.schedule_type !== 'manual'">
            <label class="field-label">schedule_config (JSON)</label>
            <q-input v-model="scheduleConfigText" outlined dense placeholder='{"cron":"0 * * * *"}' />
          </div>
        </div>

        <!-- Chunk strategy -->
        <div class="row q-col-gutter-md">
          <div class="col-6">
            <label class="field-label">chunk_strategy</label>
            <q-select v-model="form.chunk_strategy" outlined dense clearable
              :options="['PARAGRAPH','SENTENCE','HEADING','TOKEN','SEMANTIC','RECURSIVE','WINDOW']" placeholder="PARAGRAPH" />
          </div>
          <div class="col-6">
            <label class="field-label">chunk_config (JSON)</label>
            <q-input v-model="chunkConfigText" outlined dense placeholder='{"chunk_size":800}' />
          </div>
        </div>

        <div v-if="apiError" class="api-error-box">
          <q-icon name="error_outline" size="16px" />{{ apiError }}
        </div>
      </div>
    </BaseFormDialog>

    <!-- ============ DETAIL DIALOG: Health + Job History ============ -->
    <q-dialog v-model="detailDialog" style="max-width:720px">
      <q-card v-if="detailSource" style="width:720px;max-width:96vw;border-radius:12px">
        <div class="dialog-header">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="dialog-header__icon" style="background:var(--brand-secondary)">
              <q-icon name="monitor_heart" size="16px" style="color:white" />
            </div>
            <div>
              <div class="dialog-header__title">{{ detailSource.name }}</div>
              <div class="dialog-header__subtitle">GET /sources/{{ detailSource.id }}/health · /jobs</div>
            </div>
          </div>
          <button class="dialog-header__close" @click="detailDialog=false"><q-icon name="close" size="18px" /></button>
        </div>

        <q-tabs v-model="detailTab" dense align="left" style="border-bottom:1px solid var(--border-subtle)">
          <q-tab name="health" label="Health" icon="favorite" />
          <q-tab name="jobs" label="Sync Jobs" icon="history" />
        </q-tabs>

        <div style="max-height:420px;overflow-y:auto;padding:16px">
          <div v-show="detailTab==='health'">
            <div v-if="loadingHealth" class="hint-card"><q-spinner size="16px" color="primary" /> Checking…</div>
            <pre v-else-if="healthData" class="code-block" style="font-size:12px">{{ JSON.stringify(healthData, null, 2) }}</pre>
            <div v-else class="empty-state" style="padding:24px">No health data</div>
          </div>

          <div v-show="detailTab==='jobs'">
            <div v-if="loadingJobs" class="hint-card"><q-spinner size="16px" color="primary" /> Loading…</div>
            <div v-else-if="!jobs.length" class="empty-state" style="padding:24px">
              <div class="empty-state__title">No sync jobs yet</div>
            </div>
            <div v-else class="timeline">
              <div v-for="job in jobs" :key="job.id" class="timeline__item">
                <div class="timeline__dot" :style="jobDotStyle(job.status)">
                  <q-icon :name="jobIcon(job.status)" size="14px" />
                </div>
                <div class="timeline__content">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span class="badge" :class="statusClass(job.status)">{{ job.status }}</span>
                    <span style="font-size:11px;color:var(--text-quaternary)">{{ job.triggered_by }}</span>
                  </div>
                  <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">
                    discovered {{ job.documents_discovered ?? 0 }} · processed {{ job.documents_processed ?? 0 }}
                    · skipped {{ job.documents_skipped ?? 0 }} · failed {{ job.documents_failed ?? 0 }}
                  </div>
                  <div v-if="job.error_message" style="font-size:11px;color:var(--brand-danger);margin-top:4px">{{ job.error_message }}</div>
                  <div style="font-size:10px;color:var(--text-quaternary);margin-top:4px">
                    {{ job.started_at ? dayjs(job.started_at).format('YYYY-MM-DD HH:mm:ss') : '—' }}
                    <template v-if="job.finished_at"> → {{ dayjs(job.finished_at).format('HH:mm:ss') }}</template>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script>
import { defineComponent, ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { knowledgeClient } from '../../../services/api/knowledge-platform.client.js'
import { useUIStore } from '../../../stores/ui.store.js'
import BaseFormDialog from '../../../shared/components/BaseFormDialog.vue'
import DynamicConnectorForm from '../../../shared/components/DynamicConnectorForm.vue'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
dayjs.extend(relativeTime)

export default defineComponent({
  name: 'SourcesPage',
  components: { BaseFormDialog, DynamicConnectorForm },
  setup() {
    const $q = useQuasar()
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'Knowledge' }, { label: 'Sources' }])

    const rows = ref([]), loading = ref(false)
    const filterCollection = ref(null), collectionOptions = ref([])
    const connectors = ref([])

    const formDialog = ref(false), saving = ref(false), apiError = ref('')
    const editItem = ref(null)
    const defaultForm = () => ({
      name: '', type_code: '', collection_id: null, configuration: {},
      schedule_type: null, schedule_config: {}, chunk_strategy: null, chunk_config: {}
    })
    const form = ref(defaultForm())
    const scheduleConfigText = ref(''), chunkConfigText = ref('')

    const selectedConnector = computed(() => connectors.value.find(c => c.type_code === form.value.type_code))

    const columns = [
      { name: 'name', label: 'Name / Type', field: 'name', align: 'left', sortable: true },
      { name: 'status', label: 'Status', field: 'status', align: 'left' },
      { name: 'progress', label: 'Progress', field: 'document_count', align: 'left' },
      { name: 'last_sync_at', label: 'Last Sync', field: 'last_sync_at', align: 'left' },
      { name: 'actions', label: '', field: 'actions', align: 'right' }
    ]

    const statusClass = (s) => ({
      ACTIVE: 'badge--active', SYNCED: 'badge--active', HEALTHY: 'badge--active', SUCCESS: 'badge--active',
      SYNCING: 'badge--running', RUNNING: 'badge--running',
      ERROR: 'badge--error', FAILED: 'badge--error', UNHEALTHY: 'badge--error',
      PENDING: 'badge--pending', QUEUED: 'badge--pending'
    }[(s || '').toUpperCase()] || 'badge--inactive')

    async function loadCollections() {
      try {
        const cols = await knowledgeClient.listCollections()
        collectionOptions.value = cols.map(c => ({ label: c.name, value: c.id }))
      } catch { collectionOptions.value = [] }
    }

    async function loadConnectors() {
      try { connectors.value = await knowledgeClient.listConnectors() }
      catch { connectors.value = [] }
    }

    async function loadData() {
      loading.value = true
      try {
        rows.value = await knowledgeClient.listSources(
          filterCollection.value ? { collection_id: filterCollection.value } : undefined
        )
      } catch { $q.notify({ type: 'negative', message: 'Failed to load sources' }) }
      finally { loading.value = false }
    }

    function openCreate() {
      editItem.value = null; apiError.value = ''
      form.value = defaultForm()
      scheduleConfigText.value = ''; chunkConfigText.value = ''
      formDialog.value = true
    }

    function openEdit(item) {
      editItem.value = item; apiError.value = ''
      form.value = {
        name: item.name, type_code: item.type_code, collection_id: item.collection_id,
        configuration: item.configuration || {},
        schedule_type: item.schedule_type || null, schedule_config: item.schedule_config || {},
        chunk_strategy: item.chunk_strategy || null, chunk_config: item.chunk_config || {}
      }
      scheduleConfigText.value = item.schedule_config ? JSON.stringify(item.schedule_config) : ''
      chunkConfigText.value = item.chunk_config ? JSON.stringify(item.chunk_config) : ''
      formDialog.value = true
    }

    function selectConnector(c) {
      if (editItem.value || c.enabled === false) return
      form.value.type_code = c.type_code
      form.value.configuration = {}
    }

    function parseJsonOrEmpty(text) {
      if (!text || !text.trim()) return {}
      try { return JSON.parse(text) } catch { return {} }
    }

    async function save() {
      if (!form.value.collection_id || !form.value.name || !form.value.type_code) {
        apiError.value = 'collection_id, name, and connector type are required'; return
      }
      saving.value = true; apiError.value = ''
      try {
        const payload = {
          name: form.value.name,
          ...(editItem.value ? {} : { type_code: form.value.type_code, collection_id: form.value.collection_id }),
          configuration: form.value.configuration,
          ...(editItem.value ? { enabled: editItem.value.enabled ?? true } : {}),
          schedule_type: form.value.schedule_type || undefined,
          schedule_config: parseJsonOrEmpty(scheduleConfigText.value),
          chunk_strategy: form.value.chunk_strategy || undefined,
          chunk_config: parseJsonOrEmpty(chunkConfigText.value)
        }
        if (editItem.value) await knowledgeClient.updateSource(editItem.value.id, payload)
        else await knowledgeClient.createSource(payload)
        $q.notify({ type: 'positive', message: `Source ${editItem.value ? 'updated' : 'created'}` })
        formDialog.value = false
        loadData()
      } catch (e) {
        apiError.value = e.response?.data?.detail || 'Save failed'
      } finally { saving.value = false }
    }

    async function doSync(src) {
      try {
        await knowledgeClient.syncSource(src.id)
        $q.notify({ type: 'positive', message: 'Sync triggered (POST /sources/{id}/sync)' })
        setTimeout(loadData, 1200)
      } catch (e) { $q.notify({ type: 'negative', message: e.response?.data?.detail || 'Sync failed' }) }
    }

    async function doStop(src) {
      try {
        await knowledgeClient.stopSource(src.id)
        $q.notify({ type: 'info', message: 'Stop requested' })
        setTimeout(loadData, 1200)
      } catch (e) { $q.notify({ type: 'negative', message: e.response?.data?.detail || 'Stop failed' }) }
    }

    async function doReindex(src) {
      $q.dialog({
        title: 'Reindex Source', message: `Full re-run of the ingestion pipeline for "${src.name}"?`,
        cancel: { label: 'Cancel', flat: true }, ok: { label: 'Reindex', color: 'primary', unelevated: true }
      }).onOk(async () => {
        try {
          await knowledgeClient.reindexSource(src.id)
          $q.notify({ type: 'positive', message: 'Reindex queued' })
          setTimeout(loadData, 1200)
        } catch (e) { $q.notify({ type: 'negative', message: e.response?.data?.detail || 'Reindex failed' }) }
      })
    }

    function confirmDelete(src) {
      $q.dialog({
        title: 'Delete Source', message: `Delete <strong>${src.name}</strong>? Ingested documents will be removed.`,
        html: true, cancel: { label: 'Cancel', flat: true }, ok: { label: 'Delete', color: 'negative', unelevated: true }
      }).onOk(async () => {
        try { await knowledgeClient.deleteSource(src.id); $q.notify({ type: 'positive', message: 'Source deleted' }); loadData() }
        catch (e) { $q.notify({ type: 'negative', message: e.response?.data?.detail || 'Delete failed' }) }
      })
    }

    // Detail dialog: health + jobs
    const detailDialog = ref(false), detailSource = ref(null), detailTab = ref('health')
    const healthData = ref(null), loadingHealth = ref(false)
    const jobs = ref([]), loadingJobs = ref(false)

    async function openDetail(src) {
      detailSource.value = src; detailTab.value = 'health'
      healthData.value = null; jobs.value = []
      detailDialog.value = true
      loadingHealth.value = true
      try { healthData.value = await knowledgeClient.getSourceHealth(src.id) }
      catch (e) { healthData.value = { error: e.response?.data?.detail || 'Health check failed' } }
      finally { loadingHealth.value = false }
      loadingJobs.value = true
      try { jobs.value = await knowledgeClient.listSourceJobs(src.id) }
      catch { jobs.value = [] }
      finally { loadingJobs.value = false }
    }

    const jobIcon = (s) => ({ SUCCESS: 'check', FAILED: 'close', RUNNING: 'sync' }[(s || '').toUpperCase()] || 'schedule')
    const jobDotStyle = (s) => {
      const map = { SUCCESS: '#10b981', FAILED: '#ef4444', RUNNING: '#3b82f6' }
      const c = map[(s || '').toUpperCase()] || '#9ca3af'
      return `background:${c}22;color:${c}`
    }

    onMounted(() => { loadData(); loadCollections(); loadConnectors() })

    return {
      rows, columns, loading, filterCollection, collectionOptions, connectors, selectedConnector,
      formDialog, saving, apiError, editItem, form, scheduleConfigText, chunkConfigText,
      statusClass, loadData, openCreate, openEdit, selectConnector, save,
      doSync, doStop, doReindex, confirmDelete,
      detailDialog, detailSource, detailTab, healthData, loadingHealth, jobs, loadingJobs,
      openDetail, jobIcon, jobDotStyle, dayjs
    }
  }
})
</script>