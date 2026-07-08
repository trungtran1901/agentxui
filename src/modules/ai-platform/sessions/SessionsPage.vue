<template>
  <q-page class="q-pa-lg">
    <div class="row items-center q-mb-lg">
      <div>
        <div class="text-h5 text-weight-bold">Sessions & Runs</div>
        <div class="text-grey-6 text-caption">GET /sessions · GET /runs · GET /runs/{id}/events</div>
      </div>
      <q-space />
      <q-btn outline color="primary" icon="refresh" label="Làm mới" :loading="loading" @click="loadData" />
    </div>

    <q-tabs v-model="mainTab" dense class="q-mb-md">
      <q-tab name="sessions" label="Sessions" icon="chat" />
      <q-tab name="runs" label="Runs" icon="play_circle" />
    </q-tabs>

    <!-- SESSIONS TAB -->
    <div v-show="mainTab === 'sessions'">
      <div class="row q-col-gutter-sm q-mb-md items-center">
        <div class="col-auto"><q-input v-model="userIdFilter" outlined dense placeholder="Lọc theo user_id" style="width:200px" @keydown.enter="loadData" /></div>
        <div class="col-auto"><q-btn color="primary" label="Lọc" dense unelevated @click="loadData" /></div>
        <div class="text-caption text-grey-6 q-ml-sm">Lọc user_id để tránh lộ dữ liệu chéo (404 nếu lệch)</div>
      </div>
      <q-card flat bordered style="border-radius:12px">
        <q-table :rows="sessions" :columns="sessionCols" :loading="loading" row-key="id" flat class="enterprise-table">
          <template #body-cell-status="props">
            <q-td :props="props"><span class="status-badge" :class="sessionStatusClass(props.value)">{{ props.value }}</span></q-td>
          </template>
          <template #body-cell-actions="props">
            <q-td :props="props" auto-width>
              <q-btn flat round dense icon="visibility" size="sm" color="primary" @click="openSession(props.row)" />
            </q-td>
          </template>
        </q-table>
      </q-card>
    </div>

    <!-- RUNS TAB -->
    <div v-show="mainTab === 'runs'">
      <div class="row q-col-gutter-sm q-mb-md items-center">
        <div class="col-auto"><q-input v-model="sessionIdFilter" outlined dense placeholder="Lọc theo session_id" style="width:240px" @keydown.enter="loadRuns" /></div>
        <div class="col-auto"><q-btn color="primary" label="Lọc" dense unelevated @click="loadRuns" /></div>
      </div>
      <q-card flat bordered style="border-radius:12px">
        <q-table :rows="runs" :columns="runCols" :loading="loadingRuns" row-key="id" flat class="enterprise-table">
          <template #body-cell-status="props">
            <q-td :props="props"><span class="status-badge" :class="runStatusClass(props.value)">{{ props.value }}</span></q-td>
          </template>
          <template #body-cell-actions="props">
            <q-td :props="props" auto-width>
              <q-btn flat round dense icon="event_note" size="sm" color="primary" @click="openRun(props.row)" title="Xem events" />
            </q-td>
          </template>
        </q-table>
      </q-card>
    </div>

    <!-- Session Detail Dialog -->
    <q-dialog v-model="sessionDialog" style="max-width:700px">
      <q-card v-if="selectedSession" style="width:700px;max-width:95vw;border-radius:12px">
        <q-card-section class="row items-center" style="border-bottom:1px solid rgba(0,0,0,0.08)">
          <div class="text-subtitle1 text-weight-bold">Session Detail</div>
          <q-space />
          <span class="status-badge q-mr-md" :class="sessionStatusClass(selectedSession.status)">{{ selectedSession.status }}</span>
          <q-btn flat round icon="close" v-close-popup />
        </q-card-section>
        <q-scroll-area style="height:450px">
          <div class="q-pa-md">
            <div v-if="loadingMessages" class="column items-center q-py-xl"><q-spinner size="32px" color="primary" /></div>
            <div v-for="msg in sessionMessages" :key="msg.id" class="q-mb-md">
              <div class="row items-start q-gutter-xs" :class="msg.role==='user'?'flex-row-reverse':''">
                <q-avatar size="28px" :color="msg.role==='user'?'primary':'grey-3'" :text-color="msg.role==='user'?'white':'grey-8'" style="border-radius:8px;flex-shrink:0">
                  <q-icon :name="msg.role==='user'?'person':'smart_toy'" size="14px" />
                </q-avatar>
                <div class="col" style="max-width:80%">
                  <div :class="msg.role==='user'?'chat-bubble-user':'chat-bubble-assistant'" style="display:inline-block;word-break:break-word">{{ msg.content }}</div>
                  <div class="text-caption text-grey-5 q-mt-xs" :class="msg.role==='user'?'text-right':''">{{ msg.role }} · {{ dayjs(msg.created_at).format('HH:mm:ss') }}</div>
                </div>
              </div>
            </div>
            <div v-if="!sessionMessages.length && !loadingMessages" class="text-grey text-center q-py-xl">Không có messages</div>
          </div>
        </q-scroll-area>
      </q-card>
    </q-dialog>

    <!-- Run Events Dialog -->
    <q-dialog v-model="runDialog" style="max-width:600px">
      <q-card v-if="selectedRun" style="width:600px;max-width:95vw;border-radius:12px">
        <q-card-section class="row items-center" style="border-bottom:1px solid rgba(0,0,0,0.08)">
          <div class="text-subtitle1 text-weight-bold">Run Events — GET /runs/{id}/events</div>
          <q-space />
          <q-btn flat round icon="close" v-close-popup />
        </q-card-section>
        <q-scroll-area style="height:400px">
          <div class="q-pa-md q-gutter-sm">
            <div v-for="ev in runEvents" :key="ev.id" style="background:var(--color-surface-alt);border:1px solid var(--color-border);border-radius:8px;padding:10px">
              <div class="row items-center q-mb-xs">
                <q-chip dense size="xs" color="blue-1" text-color="blue-8" :label="ev.type" />
                <q-space />
                <span class="text-caption text-grey-5">{{ dayjs(ev.created_at).format('HH:mm:ss.SSS') }}</span>
              </div>
              <div v-if="ev.payload" class="code-mono text-grey-6" style="font-size:11px;white-space:pre-wrap">{{ JSON.stringify(ev.payload, null, 2).substring(0, 300) }}</div>
            </div>
            <div v-if="!runEvents.length" class="text-grey text-center q-py-xl">Không có events</div>
          </div>
        </q-scroll-area>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script>
import { defineComponent, ref, onMounted } from 'vue'
import { agnoClient } from '../../../services/api/agno-runtime.client'
import { useUIStore } from '../../../stores/ui.store'
import dayjs from 'dayjs'

export default defineComponent({
  name: 'SessionsPage',
  setup() {
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'AI Platform' }, { label: 'Sessions & Runs' }])

    const mainTab = ref('sessions'), loading = ref(false), loadingRuns = ref(false)
    const sessions = ref([]), runs = ref([])
    const userIdFilter = ref(''), sessionIdFilter = ref('')
    const sessionDialog = ref(false), selectedSession = ref(null), sessionMessages = ref([]), loadingMessages = ref(false)
    const runDialog = ref(false), selectedRun = ref(null), runEvents = ref([])

    const sessionCols = [
      { name: 'id', label: 'Session ID', field: 'id', align: 'left', format: v => v?.substring(0, 16) + '…' },
      { name: 'user_id', label: 'User ID', field: 'user_id', align: 'left', format: v => v || '—' },
      { name: 'agent_id', label: 'Agent/Team', field: 'agent_id', align: 'left', format: v => v || '—' },
      { name: 'status', label: 'Status', field: 'status', align: 'left' },
      { name: 'created_at', label: 'Bắt đầu', field: 'created_at', align: 'left', format: v => dayjs(v).format('YYYY-MM-DD HH:mm') },
      { name: 'actions', label: '', field: 'actions', align: 'right' }
    ]

    const runCols = [
      { name: 'id', label: 'Run ID', field: 'id', align: 'left', format: v => v?.substring(0, 16) + '…' },
      { name: 'session_id', label: 'Session ID', field: 'session_id', align: 'left', format: v => v?.substring(0, 12) + '…' },
      { name: 'status', label: 'Status', field: 'status', align: 'left' },
      { name: 'created_at', label: 'Thời gian', field: 'created_at', align: 'left', format: v => dayjs(v).format('YYYY-MM-DD HH:mm:ss') },
      { name: 'actions', label: '', field: 'actions', align: 'right' }
    ]

    const sessionStatusClass = s => s === 'active' ? 'status-running' : s === 'completed' ? 'status-active' : 'status-error'
    const runStatusClass = s => s === 'completed' ? 'status-active' : s === 'running' ? 'status-running' : s === 'failed' ? 'status-error' : 'status-pending'

    async function loadData() {
      loading.value = true
      try {
        const p = { page_size: 50 }
        if (userIdFilter.value) p.user_id = userIdFilter.value
        const r = await agnoClient.listSessions(p)
        sessions.value = r.items
      } finally { loading.value = false }
    }

    async function loadRuns() {
      loadingRuns.value = true
      try {
        const p = { page_size: 100 }
        if (sessionIdFilter.value) p.session_id = sessionIdFilter.value
        const r = await agnoClient.listRuns(p)
        runs.value = r.items
      } finally { loadingRuns.value = false }
    }

    async function openSession(session) {
      selectedSession.value = session; sessionDialog.value = true
      sessionMessages.value = []; loadingMessages.value = true
      try {
        // GET /sessions/{id} trả về toàn bộ lịch sử messages
        const detail = await agnoClient.getSession(session.id, userIdFilter.value || undefined)
        sessionMessages.value = detail.messages || []
      } catch { sessionMessages.value = [] }
      finally { loadingMessages.value = false }
    }

    async function openRun(run) {
      selectedRun.value = run; runDialog.value = true; runEvents.value = []
      try { runEvents.value = await agnoClient.getRunEvents(run.id) } catch { runEvents.value = [] }
    }

    onMounted(() => { loadData(); loadRuns() })
    return { mainTab, loading, loadingRuns, sessions, runs, userIdFilter, sessionIdFilter,
      sessionCols, runCols, sessionDialog, selectedSession, sessionMessages, loadingMessages,
      runDialog, selectedRun, runEvents, sessionStatusClass, runStatusClass, dayjs,
      loadData, loadRuns, openSession, openRun }
  }
})
</script>
