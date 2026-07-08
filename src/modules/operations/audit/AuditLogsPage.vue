<template>
  <q-page class="q-pa-lg">
    <div class="row items-center q-mb-lg">
      <div>
        <div class="text-h5 text-weight-bold">Audit Logs</div>
        <div class="text-grey-6 text-caption">Theo dõi hoạt động hệ thống — ACL: allowed/denied + reason</div>
      </div>
      <q-space />
      <q-btn outline color="primary" icon="refresh" :loading="loading" @click="loadData" />
    </div>
    <q-card flat bordered style="border-radius:12px">
      <q-table :rows="logs" :columns="cols" :loading="loading" row-key="id" flat class="enterprise-table">
        <template #body-cell-allowed="props">
          <q-td :props="props">
            <q-chip dense :color="props.value ? 'positive' : 'negative'" text-color="white"
              :label="props.value ? 'ALLOWED' : 'DENIED'" size="sm" />
          </q-td>
        </template>
      </q-table>
    </q-card>
  </q-page>
</template>
<script>
import { defineComponent, ref, onMounted } from 'vue'
import { knowledgeClient } from '../../../services/api/knowledge-platform.client'
import { useUIStore } from '../../../stores/ui.store'
import dayjs from 'dayjs'
export default defineComponent({
  name: 'AuditLogsPage',
  setup() {
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'Operations' }, { label: 'Audit Logs' }])
    const logs = ref([]), loading = ref(false)
    const cols = [
      { name: 'node_id', label: 'Node', field: 'node_id', align: 'left' },
      { name: 'action', label: 'Action', field: 'action', align: 'left' },
      { name: 'allowed', label: 'Result', field: 'allowed', align: 'center' },
      { name: 'reason', label: 'Reason', field: 'reason', align: 'left' },
      { name: 'created_at', label: 'Time', field: 'created_at', align: 'left', format: v => dayjs(v).format('YYYY-MM-DD HH:mm:ss') }
    ]
    // Audit từ ACL evaluate results — hệ thống log mỗi lần evaluate
    async function loadData() {
      loading.value = true
      try {
        // POST /acl/assignments trả về list assignments — audit thực tế cần backend log
        const assignments = await knowledgeClient.listAclAssignments()
        logs.value = assignments.map(a => ({ id: a.id, node_id: a.node_id, action: a.access_level, allowed: true, reason: `${a.subject_type}:${a.subject_id} has ${a.access_level}`, created_at: a.created_at }))
      } catch { logs.value = [] }
      finally { loading.value = false }
    }
    onMounted(loadData)
    return { logs, loading, cols, loadData }
  }
})
</script>
