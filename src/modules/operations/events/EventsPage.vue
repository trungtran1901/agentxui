<template>
  <q-page class="q-pa-lg">
    <div class="row items-center q-mb-lg">
      <div>
        <div class="text-h5 text-weight-bold">Events</div>
        <div class="text-grey-6 text-caption">GET /runs/{id}/events · GET /workflow-runs/{id}/events — Event Timeline</div>
      </div>
      <q-space />
      <q-btn outline color="primary" icon="refresh" :loading="loading" @click="loadData" />
    </div>
    <div class="row q-col-gutter-sm q-mb-md items-center">
      <div class="col-auto"><q-select v-model="source" :options="[{label:'Run Events',value:'run'},{label:'Workflow Run Events',value:'wf_run'}]" emit-value map-options outlined dense style="min-width:180px" @update:model-value="loadData" /></div>
      <div class="col-auto"><q-input v-model="sourceId" outlined dense :placeholder="source==='run'?'run_id':'workflow_run_id'" style="min-width:220px" /></div>
      <div class="col-auto"><q-btn color="primary" label="Lấy Events" dense unelevated :loading="loading" @click="loadData" /></div>
    </div>
    <q-card flat bordered style="border-radius:12px">
      <q-table :rows="events" :columns="cols" :loading="loading" row-key="id" flat class="enterprise-table">
        <template #body-cell-type="props">
          <q-td :props="props"><q-chip dense size="sm" color="blue-1" text-color="blue-8" :label="props.value" /></q-td>
        </template>
        <template #body-cell-payload="props">
          <q-td :props="props">
            <code class="code-mono" style="font-size:11px">{{ JSON.stringify(props.value).substring(0, 100) }}</code>
          </q-td>
        </template>
        <template #no-data>
          <div class="column items-center q-py-xl text-grey">
            <q-icon name="event_note" size="48px" color="grey-3" />
            <div class="text-subtitle1 q-mt-md">Nhập ID rồi bấm "Lấy Events"</div>
            <div class="text-caption">Ví dụ: GET /runs/{run_id}/events</div>
          </div>
        </template>
      </q-table>
    </q-card>
  </q-page>
</template>
<script>
import { defineComponent, ref, onMounted } from 'vue'
import { agnoClient } from '../../../services/api/agno-runtime.client'
import { useUIStore } from '../../../stores/ui.store'
import dayjs from 'dayjs'
export default defineComponent({
  name: 'EventsPage',
  setup() {
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'Operations' }, { label: 'Events' }])
    const events = ref([]), loading = ref(false), source = ref('run'), sourceId = ref('')
    const cols = [
      { name: 'type', label: 'Event Type', field: 'type', align: 'left', sortable: true },
      { name: 'payload', label: 'Payload', field: 'payload', align: 'left' },
      { name: 'created_at', label: 'Thời gian', field: 'created_at', align: 'left', format: v => dayjs(v).format('HH:mm:ss.SSS') }
    ]
    async function loadData() {
      if (!sourceId.value) return
      loading.value = true
      try {
        let data
        if (source.value === 'run') data = await agnoClient.getRunEvents(sourceId.value)
        else data = await agnoClient.getWorkflowRunEvents(sourceId.value)
        events.value = data
      } catch { events.value = [] }
      finally { loading.value = false }
    }
    return { events, loading, source, sourceId, cols, loadData }
  }
})
</script>
