<template>
  <q-page class="page-wrapper">
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-title">Execution Logs</h1>
        <p class="page-subtitle">Every POST /execute attempt — success, soft-failure, or hard-failure — is recorded by executionId</p>
      </div>
      <div class="page-header__actions">
        <button class="btn btn--secondary" @click="loadFromHistory">
          <q-icon name="refresh" size="15px" />
          Refresh
        </button>
      </div>
    </div>

    <div class="surface empty-state" style="padding:60px" v-if="!logs.length">
      <div class="empty-state__icon"><q-icon name="receipt_long" /></div>
      <div class="empty-state__title">No execution logs in this session</div>
      <div class="empty-state__desc">
        The gateway records every execution in <code class="code-tag">execution_logs</code> server-side.
        This view shows attempts made from the Testing Console during this session — a dedicated
        <code class="code-tag">GET /execution-logs</code> listing endpoint is not yet exposed by the API.
      </div>
      <router-link to="/mcp/console" class="btn btn--primary" style="text-decoration:none;margin-top:8px">
        <q-icon name="terminal" size="15px" />Open Testing Console
      </router-link>
    </div>

    <div v-else class="surface" style="overflow:hidden">
      <q-table :rows="logs" :columns="columns" row-key="executionId" flat class="eap-table" :pagination="{ rowsPerPage: 20 }">
        <template #body-cell-success="props">
          <q-td :props="props">
            <span class="badge" :class="props.value ? 'badge--active' : 'badge--error'">{{ props.value ? 'success' : 'failed' }}</span>
          </q-td>
        </template>
        <template #body-cell-errorCode="props">
          <q-td :props="props">
            <span v-if="props.value" class="code-tag" style="color:var(--brand-danger)">{{ props.value }}</span>
            <span v-else style="color:var(--text-quaternary)">—</span>
          </q-td>
        </template>
        <template #body-cell-executionId="props">
          <q-td :props="props"><span class="font-mono" style="font-size:11px">{{ props.value?.substring(0,18) }}…</span></q-td>
        </template>
      </q-table>
    </div>
  </q-page>
</template>

<script>
import { defineComponent, ref, onMounted } from 'vue'
import { useUIStore } from '../../../stores/ui.store.js'
import dayjs from 'dayjs'

export default defineComponent({
  name: 'ExecutionLogsPage',
  setup() {
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'MCP Integration' }, { label: 'Execution Logs' }])
    const logs = ref([])
    const columns = [
      { name: 'capability', label: 'Capability', field: 'capability', align: 'left' },
      { name: 'success', label: 'Status', field: 'success', align: 'left' },
      { name: 'errorCode', label: 'Error Code', field: 'errorCode', align: 'left' },
      { name: 'executionId', label: 'Execution ID', field: 'executionId', align: 'left' },
      { name: 'at', label: 'Time', field: 'at', align: 'left', format: v => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '—' }
    ]
    function loadFromHistory() {
      // No GET /execution-logs endpoint documented — this page is a placeholder
      // until the backend exposes a listing route.
      logs.value = []
    }
    onMounted(loadFromHistory)
    return { logs, columns, loadFromHistory }
  }
})
</script>