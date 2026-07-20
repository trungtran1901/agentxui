<template>
  <q-page class="page-wrapper">
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-title">Observability</h1>
        <p class="page-subtitle">GET /observations · POST/GET /runtime-events · GET /runtime-events/stream (v2, feature-flagged)</p>
      </div>
    </div>

    <q-tabs v-model="mainTab" dense no-caps class="q-mb-md" align="left"
      active-color="var(--brand-primary)" indicator-color="var(--brand-primary)">
      <q-tab name="observations" label="Observations" icon="insights" />
      <q-tab name="events" label="Runtime Events" icon="bolt" />
    </q-tabs>
    <q-separator class="q-mb-lg" />

    <!-- ===================== OBSERVATIONS TAB ===================== -->
    <div v-show="mainTab === 'observations'">
      <div v-if="obsAvailable === null" class="surface empty-state" style="padding:48px">
        <q-spinner size="28px" style="color:var(--brand-primary)" />
      </div>
      <div v-else-if="obsAvailable === false" class="surface empty-state" style="padding:48px">
        <div class="empty-state__icon"><q-icon name="insights" /></div>
        <div class="empty-state__title">Runtime Observations is not enabled</div>
        <div class="empty-state__desc">This backend environment does not have the v2 Observations feature flag turned on.</div>
      </div>

      <template v-else>
        <div class="filter-bar">
          <q-input v-model="runIdInput" dense outlined placeholder="run_id (uuid)" style="min-width:320px"
            @keydown.enter="loadObservations" />
          <button class="btn btn--primary btn--sm" :disabled="!runIdInput.trim()" @click="loadObservations">
            <q-icon name="search" size="14px" /> Load
          </button>
          <div style="flex:1" />
          <div style="font-size:12px;color:var(--text-tertiary)">{{ observations.length }} observation{{ observations.length !== 1 ? 's' : '' }}</div>
        </div>

        <div class="surface" style="overflow:hidden">
          <div v-if="loadingObs" class="empty-state" style="padding:40px">
            <q-spinner size="26px" style="color:var(--brand-primary)" />
          </div>
          <div v-else-if="!observations.length" class="empty-state" style="padding:48px">
            <div class="empty-state__icon"><q-icon name="insights" /></div>
            <div class="empty-state__title">{{ obsLoaded ? 'No observations for this run' : 'Enter a run_id and click Load' }}</div>
            <div class="empty-state__desc">Observations are written by the backend during a run — KNOWLEDGE_RETRIEVAL, SKILL_OUTPUT, BUSINESS_RESPONSE, UI_RESULT, WARNING, ERROR.</div>
          </div>
          <div v-else class="timeline" style="padding:16px">
            <div v-for="o in observations" :key="o.id" class="timeline__item">
              <div class="timeline__dot" :style="obsDotStyle(o.observation_type)">
                <q-icon :name="obsIcon(o.observation_type)" size="14px" />
              </div>
              <div class="timeline__content">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                  <span class="badge" :class="obsBadgeClass(o.observation_type)">{{ o.observation_type }}</span>
                  <span class="code-tag" style="font-size:10px">{{ o.source }}</span>
                  <span v-if="o.agent_id" class="code-tag" style="font-size:10px">agent: {{ o.agent_id.substring(0,10) }}…</span>
                  <span v-if="o.execution_time_ms != null" style="font-size:11px;color:var(--text-quaternary)">{{ o.execution_time_ms.toFixed(1) }}ms</span>
                  <span style="margin-left:auto;font-size:10px;color:var(--text-quaternary)">{{ dayjs(o.created_at).format('HH:mm:ss.SSS') }}</span>
                </div>
                <pre v-if="o.payload" class="code-block" style="font-size:11px;margin-top:8px;max-height:220px;overflow-y:auto">{{ JSON.stringify(o.payload, null, 2) }}</pre>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- ===================== RUNTIME EVENTS TAB ===================== -->
    <div v-show="mainTab === 'events'">
      <div v-if="evtAvailable === null" class="surface empty-state" style="padding:48px">
        <q-spinner size="28px" style="color:var(--brand-primary)" />
      </div>
      <div v-else-if="evtAvailable === false" class="surface empty-state" style="padding:48px">
        <div class="empty-state__icon"><q-icon name="bolt" /></div>
        <div class="empty-state__title">Runtime Events is not enabled</div>
        <div class="empty-state__desc">This backend environment does not have the v2 Runtime Events feature flag turned on.</div>
      </div>

      <template v-else>
        <div class="filter-bar">
          <q-input v-model="entityType" dense outlined placeholder="entity_type (e.g. page)" style="width:170px" />
          <q-input v-model="entityId" dense outlined placeholder="entity_id (e.g. hr-leave-page)" style="min-width:220px"
            @keydown.enter="loadEvents" />
          <button class="btn btn--secondary btn--sm" :disabled="!canTargetEntity" @click="loadEvents">
            <q-icon name="refresh" size="14px" /> Load history
          </button>
          <button class="btn btn--sm" :class="tailing ? 'btn--danger' : 'btn--primary'"
            :disabled="!canTargetEntity" @click="toggleTail">
            <q-icon :name="tailing ? 'stop_circle' : 'sensors'" size="14px" />
            {{ tailing ? 'Stop tail' : 'Tail live (SSE)' }}
          </button>
          <div style="flex:1" />
          <button class="btn btn--ghost btn--sm" :disabled="!canTargetEntity" @click="openEmitDialog">
            <q-icon name="send" size="14px" /> Emit test event
          </button>
        </div>

        <div v-if="tailing" class="api-error-box" style="background:var(--status-success-bg);color:var(--status-success-text);border-color:rgba(16,185,129,0.2);margin-bottom:12px">
          <q-icon name="sensors" size="16px" />
          Tailing live — new events for <strong>{{ entityType }}/{{ entityId }}</strong> will appear at the top automatically.
        </div>

        <div class="surface" style="overflow:hidden">
          <div v-if="loadingEvents" class="empty-state" style="padding:40px">
            <q-spinner size="26px" style="color:var(--brand-primary)" />
          </div>
          <div v-else-if="!events.length" class="empty-state" style="padding:48px">
            <div class="empty-state__icon"><q-icon name="bolt" /></div>
            <div class="empty-state__title">{{ evtLoaded || tailing ? 'No events yet' : 'Enter entity_type + entity_id, then Load history or Tail live' }}</div>
          </div>
          <div v-else class="timeline" style="padding:16px">
            <div v-for="ev in events" :key="ev.id" class="timeline__item anim-fade">
              <div class="timeline__dot" :style="ev.__live ? 'background:var(--status-success-bg);color:var(--status-success-text)' : 'background:var(--surface-sunken);color:var(--text-tertiary)'">
                <q-icon :name="ev.__live ? 'sensors' : 'history'" size="13px" />
              </div>
              <div class="timeline__content">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                  <span class="code-tag">{{ ev.event_name }}</span>
                  <span v-if="ev.__live" class="badge badge--running badge--no-dot" style="font-size:9px">LIVE</span>
                  <span v-if="ev.correlation_id" style="font-size:10px;color:var(--text-quaternary)">corr: {{ ev.correlation_id.substring(0,12) }}…</span>
                  <span style="margin-left:auto;font-size:10px;color:var(--text-quaternary)">{{ ev.created_at ? dayjs(ev.created_at).format('HH:mm:ss.SSS') : 'just now' }}</span>
                </div>
                <pre v-if="ev.payload && Object.keys(ev.payload).length" class="code-block" style="font-size:11px;margin-top:8px">{{ JSON.stringify(ev.payload, null, 2) }}</pre>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Emit dialog -->
    <BaseFormDialog v-model="emitDialog" title="Emit Runtime Event" subtitle="POST /runtime-events"
      icon="send" icon-color="#10b981" confirm-label="Emit" :loading="emitting" @confirm="doEmit">
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="code-tag" style="width:fit-content">{{ entityType }} / {{ entityId }}</div>
        <div>
          <label class="field-label">event_name <span style="color:var(--brand-danger)">*</span></label>
          <q-input v-model="emitForm.event_name" outlined dense placeholder="PageOpened" />
        </div>
        <div>
          <label class="field-label">payload (JSON)</label>
          <textarea v-model="emitPayloadText" class="json-textarea" rows="5" placeholder='{"userId":"user-123"}' />
        </div>
        <div>
          <label class="field-label">correlation_id <span style="color:var(--text-quaternary)">(optional)</span></label>
          <q-input v-model="emitForm.correlation_id" outlined dense placeholder="auto-generated if left blank" />
        </div>
        <div v-if="apiError" class="api-error-box"><q-icon name="error_outline" size="16px" />{{ apiError }}</div>
      </div>
    </BaseFormDialog>
  </q-page>
</template>

<script>
import { defineComponent, ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useQuasar } from 'quasar'
import { observationsClient, OBSERVATION_TYPES } from '../../../services/api/observations.client.js'
import { runtimeEventsClient } from '../../../services/api/runtime-events.client.js'
import { useUIStore } from '../../../stores/ui.store.js'
import BaseFormDialog from '../../../shared/components/BaseFormDialog.vue'
import dayjs from 'dayjs'

export default defineComponent({
  name: 'ObservabilityPage',
  components: { BaseFormDialog },
  setup() {
    const $q = useQuasar()
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'Operations' }, { label: 'Observability' }])

    const mainTab = ref('observations')

    // ===== OBSERVATIONS =====
    const obsAvailable = ref(null)
    const runIdInput = ref(''), observations = ref([]), loadingObs = ref(false), obsLoaded = ref(false)

    const OBS_COLORS = {
      KNOWLEDGE_RETRIEVAL: { color: '#3b82f6', bg: '#dbeafe', icon: 'manage_search' },
      SKILL_OUTPUT: { color: '#8b5cf6', bg: '#ede9fe', icon: 'extension' },
      BUSINESS_RESPONSE: { color: '#10b981', bg: '#d1fae5', icon: 'chat' },
      UI_RESULT: { color: '#6366f1', bg: '#e0e7ff', icon: 'touch_app' },
      WARNING: { color: '#f59e0b', bg: '#fef3c7', icon: 'warning' },
      ERROR: { color: '#ef4444', bg: '#fee2e2', icon: 'error_outline' }
    }
    function obsDotStyle(type) {
      const c = OBS_COLORS[type] || { color: '#6b7280', bg: '#f3f4f6' }
      return `border-color:${c.color};background:${c.bg};color:${c.color}`
    }
    function obsIcon(type) { return (OBS_COLORS[type] || {}).icon || 'circle' }
    function obsBadgeClass(type) {
      if (type === 'ERROR') return 'badge--error'
      if (type === 'WARNING') return 'badge--warning'
      if (type === 'BUSINESS_RESPONSE') return 'badge--active'
      return 'badge--info'
    }

    async function loadObservations() {
      if (!runIdInput.value.trim()) return
      loadingObs.value = true; obsLoaded.value = true
      try {
        const res = await observationsClient.list({ run_id: runIdInput.value.trim(), page_size: 100 })
        observations.value = res.items || []
      } catch (e) {
        if (e.response?.status === 404) { obsAvailable.value = false; return }
        $q.notify({ type: 'negative', message: 'Failed to load observations' })
      } finally { loadingObs.value = false }
    }

    // ===== RUNTIME EVENTS =====
    const evtAvailable = ref(null)
    const entityType = ref('page'), entityId = ref('')
    const events = ref([]), loadingEvents = ref(false), evtLoaded = ref(false)
    const canTargetEntity = computed(() => !!entityType.value.trim() && !!entityId.value.trim())

    const tailing = ref(false)
    let tailController = null

    async function loadEvents() {
      if (!canTargetEntity.value) return
      loadingEvents.value = true; evtLoaded.value = true
      try {
        const res = await runtimeEventsClient.list({
          entity_type: entityType.value.trim(),
          entity_id: entityId.value.trim(),
          page_size: 100
        })
        // Most-recent-first, matching the timeline's newest-at-top convention used elsewhere in the app.
        events.value = [...(res.items || [])].reverse()
      } catch (e) {
        if (e.response?.status === 404) { evtAvailable.value = false; return }
        $q.notify({ type: 'negative', message: 'Failed to load runtime events' })
      } finally { loadingEvents.value = false }
    }

    function toggleTail() {
      if (tailing.value) { stopTail(); return }
      if (!canTargetEntity.value) return
      tailing.value = true
      tailController = runtimeEventsClient.openStream(
        { entity_type: entityType.value.trim(), entity_id: entityId.value.trim() },
        (frame) => {
          events.value.unshift({
            id: frame.data?.id || `live-${Date.now()}-${Math.random()}`,
            event_name: frame.data?.event_name || frame.event,
            payload: frame.data?.payload || {},
            correlation_id: frame.data?.correlation_id,
            created_at: frame.data?.created_at || new Date().toISOString(),
            __live: true
          })
          if (events.value.length > 200) events.value.pop()
        },
        (err) => {
          $q.notify({ type: 'warning', message: `Tail stream ended: ${err.message}` })
          tailing.value = false
        }
      )
    }
    function stopTail() {
      tailing.value = false
      if (tailController) { tailController.stop(); tailController = null }
    }

    // ===== EMIT dialog =====
    const emitDialog = ref(false), emitting = ref(false), apiError = ref('')
    const emitForm = ref({ event_name: '', correlation_id: '' })
    const emitPayloadText = ref('{}')

    function openEmitDialog() {
      emitForm.value = { event_name: '', correlation_id: '' }
      emitPayloadText.value = '{}'
      apiError.value = ''
      emitDialog.value = true
    }

    async function doEmit() {
      apiError.value = ''
      if (!emitForm.value.event_name.trim()) { apiError.value = 'event_name is required'; return }
      let payload = {}
      try { payload = emitPayloadText.value.trim() ? JSON.parse(emitPayloadText.value) : {} }
      catch { apiError.value = 'payload is not valid JSON'; return }

      emitting.value = true
      try {
        await runtimeEventsClient.emit({
          entity_type: entityType.value.trim(),
          entity_id: entityId.value.trim(),
          event_name: emitForm.value.event_name.trim(),
          payload,
          correlation_id: emitForm.value.correlation_id.trim() || undefined
        })
        $q.notify({ type: 'positive', message: 'Event emitted' })
        emitDialog.value = false
        // If we're tailing, the emitted event will arrive via SSE momentarily;
        // if not, refresh history so the emit is visible immediately.
        if (!tailing.value) loadEvents()
      } catch (e) {
        apiError.value = e.response?.data?.message || 'Emit failed'
      } finally { emitting.value = false }
    }

    onMounted(async () => {
      obsAvailable.value = await observationsClient.isAvailable()
      evtAvailable.value = await runtimeEventsClient.isAvailable()
    })

    onBeforeUnmount(() => { stopTail() })

    return {
      dayjs, mainTab,
      obsAvailable, runIdInput, observations, loadingObs, obsLoaded, loadObservations,
      obsDotStyle, obsIcon, obsBadgeClass,
      evtAvailable, entityType, entityId, events, loadingEvents, evtLoaded, canTargetEntity,
      tailing, loadEvents, toggleTail,
      emitDialog, emitting, apiError, emitForm, emitPayloadText, openEmitDialog, doEmit
    }
  }
})
</script>

<style lang="scss">
// .badge--info is already defined globally in app.scss (status-running-bg/text) —
// intentionally NOT redefined here to avoid a same-specificity cascade collision.

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