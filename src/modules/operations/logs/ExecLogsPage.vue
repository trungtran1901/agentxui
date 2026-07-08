<template>
  <q-page class="q-pa-lg">
    <div class="row items-center q-mb-lg">
      <div>
        <div class="text-h5 text-weight-bold">Execution Logs</div>
        <div class="text-grey-6 text-caption">GET /runs · GET /workflow-runs · Lịch sử thực thi</div>
      </div>
      <q-space />
      <q-btn outline color="primary" icon="refresh" :loading="loading" @click="loadData" />
    </div>
    <q-tabs v-model="tab" dense class="q-mb-md">
      <q-tab name="runs" label="Runs (Chat)" icon="chat" />
      <q-tab name="wfruns" label="Workflow Runs" icon="account_tree" />
    </q-tabs>
    <q-card flat bordered style="border-radius:12px">
      <q-table :rows="tab==='runs' ? runs : wfRuns" :columns="tab==='runs' ? runCols : wfRunCols"
        :loading="loading" row-key="id" flat class="enterprise-table">
        <template #body-cell-status="props">
          <q-td :props="props">
            <span class="status-badge" :class="props.value==='completed'?'status-active':props.value==='running'?'status-running':props.value==='failed'?'status-error':'status-pending'">{{ props.value }}</span>
          </q-td>
        </template>
      </q-table>
    </q-card>
  </q-page>
</template>
<script>
import { defineComponent, ref, watch, onMounted } from 'vue'
import { agnoClient } from '../../../services/api/agno-runtime.client'
import { useUIStore } from '../../../stores/ui.store'
import dayjs from 'dayjs'
export default defineComponent({
  name: 'ExecLogsPage',
  setup() {
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'Operations' }, { label: 'Execution Logs' }])
    const tab = ref('runs'), loading = ref(false), runs = ref([]), wfRuns = ref([])
    const runCols = [
      { name: 'id', label: 'Run ID', field: 'id', align: 'left', format: v => v?.substring(0,16)+'…' },
      { name: 'session_id', label: 'Session', field: 'session_id', align: 'left', format: v => v?.substring(0,12)+'…' },
      { name: 'status', label: 'Status', field: 'status', align: 'left' },
      { name: 'created_at', label: 'Time', field: 'created_at', align: 'left', format: v => dayjs(v).format('YYYY-MM-DD HH:mm:ss') }
    ]
    const wfRunCols = [
      { name: 'id', label: 'Run ID', field: 'id', align: 'left', format: v => v?.substring(0,16)+'…' },
      { name: 'workflow_id', label: 'Workflow', field: 'workflow_id', align: 'left', format: v => v?.substring(0,12)+'…' },
      { name: 'status', label: 'Status', field: 'status', align: 'left' },
      { name: 'created_at', label: 'Time', field: 'created_at', align: 'left', format: v => dayjs(v).format('YYYY-MM-DD HH:mm:ss') }
    ]
    async function loadData() {
      loading.value = true
      try {
        if (tab.value === 'runs') { const r = await agnoClient.listRuns({ page_size: 100 }); runs.value = r.items }
        else { const r = await agnoClient.listWorkflowRuns({ page_size: 100 }); wfRuns.value = r.items }
      } finally { loading.value = false }
    }
    watch(tab, loadData)
    onMounted(loadData)
    return { tab, loading, runs, wfRuns, runCols, wfRunCols, loadData }
  }
})
</script>
