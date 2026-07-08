<template>
  <q-page class="q-pa-lg">
    <div class="row items-center q-mb-lg">
      <div><div class="text-h5 text-weight-bold">Background Jobs</div><div class="text-grey-6 text-caption">Scheduler & Job Monitor</div></div>
      <q-space />
      <q-btn outline color="primary" icon="refresh" :loading="loading" @click="loadData" />
    </div>
    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-8">
        <q-card flat bordered style="border-radius:12px">
          <q-card-section style="border-bottom:1px solid var(--color-border)">
            <div class="text-subtitle1 text-weight-bold">Job History</div>
          </q-card-section>
          <q-table :rows="jobs" :columns="cols" row-key="id" flat class="enterprise-table" :loading="loading">
            <template #body-cell-status="props">
              <q-td :props="props"><span class="status-badge" :class="statusClass(props.value)">{{ props.value }}</span></q-td>
            </template>
          </q-table>
        </q-card>
      </div>
      <div class="col-12 col-md-4">
        <q-card flat bordered style="border-radius:12px">
          <q-card-section style="border-bottom:1px solid var(--color-border)">
            <div class="text-subtitle1 text-weight-bold">Scheduled Jobs</div>
          </q-card-section>
          <q-list dense class="q-pa-sm">
            <q-item v-for="sched in scheduled" :key="sched.name" class="q-py-sm">
              <q-item-section avatar><q-avatar size="32px" color="blue-1" text-color="blue-8" icon="schedule" style="border-radius:8px" /></q-item-section>
              <q-item-section>
                <q-item-label class="text-weight-medium">{{ sched.name }}</q-item-label>
                <q-item-label caption>{{ sched.cron }}</q-item-label>
              </q-item-section>
              <q-item-section side><q-toggle v-model="sched.enabled" dense /></q-item-section>
            </q-item>
          </q-list>
        </q-card>
      </div>
    </div>
  </q-page>
</template>
<script>
import { defineComponent, ref, onMounted } from 'vue'
import { useUIStore } from '../../../stores/ui.store'
import dayjs from 'dayjs'
export default defineComponent({
  name: 'BackgroundJobsPage',
  setup() {
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'System' }, { label: 'Background Jobs' }])
    const loading = ref(false), jobs = ref([])
    const scheduled = ref([
      { name: 'Memory Cleanup', cron: '0 2 * * *', enabled: true },
      { name: 'Session Expire', cron: '*/30 * * * *', enabled: true },
      { name: 'Vector Reindex', cron: '0 3 * * 0', enabled: false }
    ])
    const cols = [
      { name: 'name', label: 'Job', field: 'name', align: 'left' },
      { name: 'status', label: 'Status', field: 'status', align: 'left' },
      { name: 'started_at', label: 'Started', field: 'started_at', align: 'left', format: v => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—' },
      { name: 'duration', label: 'Duration', field: 'duration', align: 'left', format: v => v ? `${v}s` : '—' }
    ]
    const statusClass = s => s === 'completed' ? 'status-active' : s === 'running' ? 'status-running' : s === 'failed' ? 'status-error' : 'status-pending'
    async function loadData() {
      loading.value = true
      await new Promise(r => setTimeout(r, 300))
      jobs.value = [
        { id: '1', name: 'Memory Cleanup', status: 'completed', started_at: new Date(Date.now() - 3600000), duration: 12 },
        { id: '2', name: 'Session Expire', status: 'completed', started_at: new Date(Date.now() - 1800000), duration: 3 },
        { id: '3', name: 'Vector Reindex', status: 'failed', started_at: new Date(Date.now() - 7200000), duration: 240 }
      ]
      loading.value = false
    }
    onMounted(loadData)
    return { loading, jobs, scheduled, cols, statusClass, loadData }
  }
})
</script>
