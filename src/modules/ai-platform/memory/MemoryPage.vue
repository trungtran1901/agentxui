<template>
  <q-page class="q-pa-lg">
    <div class="row items-center q-mb-lg">
      <div>
        <div class="text-h5 text-weight-bold">Agentic Memory</div>
        <div class="text-grey-6 text-caption">GET /memories · GET /agents/{id}/memories · DELETE /memories/{id}</div>
      </div>
      <q-space />
      <q-btn outline color="primary" icon="refresh" label="Làm mới" :loading="loading" @click="loadData" />
    </div>

    <!-- Filters -->
    <q-card flat bordered class="q-mb-md" style="border-radius:10px">
      <q-card-section class="q-py-sm q-px-md">
        <div class="row q-col-gutter-sm items-center">
          <div class="col-auto">
            <q-select v-model="selectedAgent" :options="agentOptions" label="Agent" outlined dense clearable
              emit-value map-options style="min-width:180px" @update:model-value="onAgentChange" />
          </div>
          <div class="col-auto">
            <q-input v-model="userIdFilter" outlined dense placeholder="user_id" style="width:160px" />
          </div>
          <div class="col-auto">
            <q-btn color="primary" label="Tìm kiếm" dense unelevated @click="loadData" />
          </div>
          <div class="text-caption text-grey-6 q-ml-sm">Memory được AI tự đúc rút sau mỗi session có user_id</div>
        </div>
      </q-card-section>
    </q-card>

    <q-card flat bordered style="border-radius:12px">
      <q-table :rows="rows" :columns="columns" :loading="loading" row-key="id" flat class="enterprise-table"
        :pagination="{ rowsPerPage: 20 }">
        <template #body-cell-content="props">
          <q-td :props="props" style="max-width:500px">
            <div style="white-space:normal;line-height:1.6">{{ props.value }}</div>
          </q-td>
        </template>
        <template #body-cell-actions="props">
          <q-td :props="props" auto-width>
            <q-btn flat round dense icon="delete" size="sm" color="red" @click="deleteMemory(props.row)" :loading="deleting === props.row.id">
              <q-tooltip>Xóa cứng (AI "quên" thông tin này)</q-tooltip>
            </q-btn>
          </q-td>
        </template>
        <template #no-data>
          <div class="column items-center q-py-xl text-grey">
            <q-icon name="memory" size="56px" color="grey-3" />
            <div class="text-subtitle1 q-mt-md">Chưa có memory nào</div>
            <div class="text-caption q-mt-xs">Memory được tự động tạo sau mỗi session có user_id</div>
          </div>
        </template>
      </q-table>
    </q-card>

    <div class="text-caption text-grey-5 q-mt-md">
      Tổng: {{ total }} memory records · Endpoint: GET /memories hoặc GET /agents/{id}/memories
    </div>
  </q-page>
</template>

<script>
import { defineComponent, ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { agnoClient } from '../../../services/api/agno-runtime.client'
import { useUIStore } from '../../../stores/ui.store'
import dayjs from 'dayjs'

export default defineComponent({
  name: 'MemoryPage',
  setup() {
    const $q = useQuasar(); const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'AI Platform' }, { label: 'Memory' }])

    const rows = ref([]), loading = ref(false), total = ref(0), deleting = ref(null)
    const selectedAgent = ref(null), agentOptions = ref([]), userIdFilter = ref('')

    const columns = [
      { name: 'agent_id', label: 'Agent', field: 'agent_id', align: 'left', format: v => v || '—' },
      { name: 'user_id', label: 'User', field: 'user_id', align: 'left', format: v => v || '—' },
      { name: 'content', label: 'Nội dung', field: 'content', align: 'left' },
      { name: 'created_at', label: 'Đúc rút lúc', field: 'created_at', align: 'left', format: v => dayjs(v).format('YYYY-MM-DD HH:mm') },
      { name: 'actions', label: '', field: 'actions', align: 'right' }
    ]

    async function loadMeta() {
      try { const r = await agnoClient.listAgents({ page_size: 100 }); agentOptions.value = r.items.map(a => ({ label: a.name, value: a.id })) } catch {}
    }

    async function loadData() {
      loading.value = true
      try {
        let res
        if (selectedAgent.value) {
          // GET /agents/{agent_id}/memories
          res = await agnoClient.listAgentMemories(selectedAgent.value)
        } else {
          // GET /memories (global)
          const p = { page_size: 100 }
          if (userIdFilter.value) p.user_id = userIdFilter.value
          res = await agnoClient.listMemories(p)
        }
        rows.value = res.items; total.value = res.total
      } finally { loading.value = false }
    }

    function onAgentChange() { loadData() }

    async function deleteMemory(m) {
      $q.dialog({ title: 'Xóa Memory', message: 'AI sẽ "quên" thông tin này. Xóa cứng, không thể khôi phục.', cancel: { label: 'Hủy' }, ok: { color: 'red', label: 'Xóa cứng', unelevated: true } })
        .onOk(async () => {
          deleting.value = m.id
          try {
            await agnoClient.deleteMemory(m.id) // DELETE /memories/{id}
            rows.value = rows.value.filter(x => x.id !== m.id)
            total.value--
            $q.notify({ type: 'positive', message: 'Đã xóa memory' })
          } catch (e) { $q.notify({ type: 'negative', message: e.response?.data?.message || 'Xóa thất bại' }) }
          finally { deleting.value = null }
        })
    }

    onMounted(() => { loadMeta(); loadData() })
    return { rows, columns, loading, total, deleting, selectedAgent, agentOptions, userIdFilter, loadData, onAgentChange, deleteMemory }
  }
})
</script>
