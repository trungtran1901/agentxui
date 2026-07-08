<template>
  <q-page class="q-pa-lg">
    <div class="row items-center q-mb-lg">
      <div><div class="text-h5 text-weight-bold">Feature Flags</div><div class="text-grey-6 text-caption">Quản lý tính năng theo môi trường</div></div>
    </div>
    <q-card flat bordered style="border-radius:12px">
      <q-table :rows="flags" :columns="cols" row-key="key" flat class="enterprise-table">
        <template #body-cell-enabled="props">
          <q-td :props="props"><q-toggle v-model="props.row.enabled" dense @update:model-value="toggleFlag(props.row)" /></q-td>
        </template>
        <template #body-cell-env="props">
          <q-td :props="props"><q-chip dense size="sm" :color="props.value==='all'?'positive':props.value==='prod'?'warning':'blue'" text-color="white" :label="props.value" /></q-td>
        </template>
      </q-table>
    </q-card>
  </q-page>
</template>
<script>
import { defineComponent, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useUIStore } from '../../../stores/ui.store'
export default defineComponent({
  name: 'FeatureFlagsPage',
  setup() {
    const $q = useQuasar(); const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'System' }, { label: 'Feature Flags' }])
    const flags = ref([
      { key: 'chat_stream', name: 'Chat Streaming (SSE)', enabled: true, env: 'all', description: 'POST /chat/stream' },
      { key: 'workflow_stream', name: 'Workflow Streaming', enabled: true, env: 'all', description: 'POST /workflows/{id}/run/stream' },
      { key: 'agentic_memory', name: 'Agentic Memory', enabled: true, env: 'all', description: 'Auto memory extraction' },
      { key: 'capability_resolve', name: 'Capability Resolution', enabled: true, env: 'all', description: 'POST /capabilities/resolve' },
      { key: 'acl_vector_filter', name: 'ACL Vector Filter', enabled: false, env: 'prod', description: 'In-database vector ACL' },
    ])
    const cols = [
      { name: 'key', label: 'Key', field: 'key', align: 'left' },
      { name: 'name', label: 'Tên', field: 'name', align: 'left' },
      { name: 'enabled', label: 'Enabled', field: 'enabled', align: 'center' },
      { name: 'env', label: 'Env', field: 'env', align: 'left' },
      { name: 'description', label: 'Mô tả', field: 'description', align: 'left' }
    ]
    function toggleFlag(flag) { $q.notify({ type: 'positive', message: `${flag.name}: ${flag.enabled ? 'ON' : 'OFF'}` }) }
    return { flags, cols, toggleFlag }
  }
})
</script>
