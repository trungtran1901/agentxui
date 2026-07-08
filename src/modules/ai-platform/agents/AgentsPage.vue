<template>
  <BaseCrudPage
    title="Agents"
    subtitle="Quản lý AI Agent — cặp (team_id, code) là duy nhất"
    entity-name="Agent"
    :rows="rows" :columns="columns" :loading="loading"
    @create="openCreate" @edit="goToDetail"
    @delete="confirmDelete" @view="goToDetail"
    @refresh="loadData" @search="q => { search = q; loadData() }"
  >
    <template #filters>
      <div class="col-auto">
        <q-select v-model="filterTeam" :options="teamOptions" label="Team" outlined dense
          clearable emit-value map-options style="min-width:160px" @update:model-value="loadData" />
      </div>
    </template>
    <template #body-cell-name="props">
      <q-td :props="props">
        <router-link :to="`/ai/agents/${props.row.id}`" class="text-primary text-weight-medium" style="text-decoration:none">{{ props.row.name }}</router-link>
        <div style="margin-top:2px"><span class="code-tag">{{ props.row.code }}</span></div>
      </q-td>
    </template>
    <template #body-cell-model="props">
      <q-td :props="props">
        <q-chip v-if="props.row.model_id" dense size="sm" color="blue-1" text-color="blue-8" icon="psychology" :label="getModelName(props.row.model_id)" />
        <span v-else class="text-grey-5">—</span>
      </q-td>
    </template>
    <template #body-cell-status="props">
      <q-td :props="props"><span class="badge" :class="props.row.enabled ? 'badge--active' : 'badge--inactive'">{{ props.row.enabled ? 'enabled' : 'disabled' }}</span></q-td>
    </template>
  </BaseCrudPage>

  <!-- Create Dialog -->
  <BaseFormDialog v-model="createDialog" title="Tạo Agent mới" icon="smart_toy" :loading="saving" width="560px" @confirm="createAgent">
    <div style="display:flex;flex-direction:column;gap:14px">
      <div>
        <label class="field-label">team_id <span style="color:var(--brand-danger)">*</span></label>
        <q-select v-model="createForm.team_id" outlined dense :options="teamOptions" emit-value map-options placeholder="Chọn Team" />
      </div>
      <div class="row q-col-gutter-md">
        <div class="col-5">
          <label class="field-label">code <span style="color:var(--brand-danger)">*</span></label>
          <q-input v-model="createForm.code" outlined dense placeholder="lead-qualifier" hint="Duy nhất trong Team đã chọn" />
        </div>
        <div class="col-7">
          <label class="field-label">name <span style="color:var(--brand-danger)">*</span></label>
          <q-input v-model="createForm.name" outlined dense placeholder="Lead Qualifier" />
        </div>
      </div>
      <div>
        <label class="field-label">description</label>
        <q-input v-model="createForm.description" outlined dense type="textarea" :rows="2" placeholder="Mô tả ngắn về agent..." />
      </div>
      <div v-if="apiError" class="api-error-box"><q-icon name="error_outline" size="16px" />{{ apiError }}</div>
    </div>
  </BaseFormDialog>
</template>

<script>
import { defineComponent, ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { agnoClient } from '../../../services/api/agno-runtime.client'
import { useUIStore } from '../../../stores/ui.store'
import BaseCrudPage from '../../../shared/components/BaseCrudPage.vue'
import BaseFormDialog from '../../../shared/components/BaseFormDialog.vue'
import dayjs from 'dayjs'

export default defineComponent({
  name: 'AgentsPage',
  components: { BaseCrudPage, BaseFormDialog },
  setup() {
    const $q = useQuasar(); const uiStore = useUIStore(); const router = useRouter()
    uiStore.setBreadcrumbs([{ label: 'AI Platform' }, { label: 'Agents' }])

    const rows = ref([]), loading = ref(false), saving = ref(false), search = ref(''), filterTeam = ref(null)
    const teamOptions = ref([]), modelMap = ref({})
    const createDialog = ref(false), apiError = ref('')
    const createForm = ref({ team_id: null, code: '', name: '', description: '' })

    const columns = [
      { name: 'name', label: 'Tên / Code', field: 'name', align: 'left', sortable: true },
      { name: 'model', label: 'Model', field: 'model_id', align: 'left' },
      { name: 'status', label: 'Status', field: 'status', align: 'left' },
      { name: 'created_at', label: 'Ngày tạo', field: 'created_at', align: 'left', format: v => dayjs(v).format('YYYY-MM-DD') },
      { name: 'actions', label: '', field: 'actions', align: 'right' }
    ]

    const getModelName = id => modelMap.value[id] || id

    async function loadData() {
      loading.value = true
      try { const r = await agnoClient.listAgents({ team_id: filterTeam.value || undefined, page_size: 100 }); rows.value = r.items }
      finally { loading.value = false }
    }

    async function loadMeta() {
      const [teams, models] = await Promise.allSettled([
        agnoClient.listTeams({ page_size: 100 }),
        agnoClient.listModels({ page_size: 100 })
      ])
      if (teams.status === 'fulfilled') teamOptions.value = teams.value.items.map(t => ({ label: t.name, value: t.id }))
      if (models.status === 'fulfilled') models.value.items.forEach(m => modelMap.value[m.id] = `${m.provider}/${m.model}`)
    }

    function openCreate() { createForm.value = { team_id: filterTeam.value || null, code: '', name: '', description: '' }; apiError.value = ''; createDialog.value = true }

    async function createAgent() {
      if (!createForm.value.team_id || !createForm.value.code || !createForm.value.name) { apiError.value = 'team_id, code và name là bắt buộc'; return }
      saving.value = true; apiError.value = ''
      try {
        await agnoClient.createAgent(createForm.value)
        $q.notify({ type: 'positive', message: 'Đã tạo Agent' }); createDialog.value = false; loadData()
      } catch (e) {
        const ec = e.response?.data?.error_code
        apiError.value = ec === 'conflict' ? 'Code đã tồn tại trong Team này (409 Conflict)' : e.response?.data?.message || 'Lỗi'
      } finally { saving.value = false }
    }

    function goToDetail(agent) { router.push(`/ai/agents/${agent.id}`) }

    function confirmDelete(agent) {
      $q.dialog({ title: 'Xóa Agent', message: `Xóa "${agent.name}"? Record được giữ lại để tham chiếu lịch sử (soft delete).`, cancel: { label: 'Hủy' }, ok: { color: 'red', label: 'Xóa', unelevated: true } })
        .onOk(async () => { await agnoClient.deleteAgent(agent.id); $q.notify({ type: 'positive', message: 'Đã xóa' }); loadData() })
    }

    onMounted(() => { loadData(); loadMeta() })
    return { rows, columns, loading, saving, search, filterTeam, teamOptions, createDialog, createForm, apiError,
      getModelName, loadData, openCreate, createAgent, goToDetail, confirmDelete }
  }
})
</script>

<style scoped>
.field-label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #5f6b7a);
  letter-spacing: 0.2px;
}
</style>