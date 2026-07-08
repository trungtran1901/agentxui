<template>
  <BaseCrudPage
    title="Teams"
    subtitle="Quản lý đội ngũ AI — cặp (agent_os_id, code) là duy nhất"
    entity-name="Team"
    :rows="rows" :columns="columns" :loading="loading"
    @create="openCreate" @edit="openEdit" @delete="confirmDelete"
    @refresh="loadData" @search="q => { search = q; loadData() }"
  >
    <template #filters>
      <div class="col-auto">
        <q-select v-model="filterAgentOS" :options="agentOSOptions" label="AgentOS" outlined dense
          clearable emit-value map-options style="min-width:160px" @update:model-value="loadData" />
      </div>
    </template>
    <template #body-cell-name="props">
      <q-td :props="props">
        <router-link :to="`/ai/teams/${props.row.id}`" class="text-primary text-weight-medium" style="text-decoration:none">{{ props.row.name }}</router-link>
        <div style="margin-top:2px"><span class="code-tag">{{ props.row.code }}</span></div>
      </q-td>
    </template>
  </BaseCrudPage>

  <BaseFormDialog v-model="dialog" :title="editItem ? 'Sửa Team' : 'Tạo Team mới'" icon="group" :loading="saving" width="560px" @confirm="save">
    <div style="display:flex;flex-direction:column;gap:14px">
      <div>
        <label class="field-label">agent_os_id <span style="color:var(--brand-danger)">*</span></label>
        <q-select v-model="form.agent_os_id" outlined dense :options="agentOSOptions" emit-value map-options
          :disable="!!editItem" placeholder="Chọn AgentOS" />
      </div>

      <div class="row q-col-gutter-md">
        <div class="col-6">
          <label class="field-label">code <span style="color:var(--brand-danger)">*</span></label>
          <q-input v-model="form.code" outlined dense placeholder="sales"
            :disable="!!editItem" :hint="editItem ? 'Không đổi được sau khi tạo' : 'Duy nhất trong AgentOS đã chọn'" />
        </div>
        <div class="col-6">
          <label class="field-label">name <span style="color:var(--brand-danger)">*</span></label>
          <q-input v-model="form.name" outlined dense placeholder="Sales Team" />
        </div>
      </div>

      <div>
        <label class="field-label">description</label>
        <q-input v-model="form.description" outlined dense type="textarea" :rows="3" placeholder="Mô tả ngắn về team..." />
      </div>

      <q-toggle v-model="form.enabled" label="Enabled" />

      <div v-if="apiError" class="api-error-box"><q-icon name="error_outline" size="16px" />{{ apiError }}</div>
    </div>
  </BaseFormDialog>
</template>

<script>
import { defineComponent, ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { agnoClient } from '../../../services/api/agno-runtime.client'
import { useUIStore } from '../../../stores/ui.store'
import BaseCrudPage from '../../../shared/components/BaseCrudPage.vue'
import BaseFormDialog from '../../../shared/components/BaseFormDialog.vue'
import dayjs from 'dayjs'

export default defineComponent({
  name: 'TeamsPage', components: { BaseCrudPage, BaseFormDialog },
  setup() {
    const $q = useQuasar(); const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'AI Platform' }, { label: 'Teams' }])
    const rows = ref([]), loading = ref(false), saving = ref(false), search = ref(''), filterAgentOS = ref(null)
    const agentOSOptions = ref([]), dialog = ref(false), editItem = ref(null), apiError = ref('')
    const defaultForm = () => ({ agent_os_id: null, code: '', name: '', description: '', enabled: true })
    const form = ref(defaultForm())
    const columns = [
      { name: 'name', label: 'Tên / Code', field: 'name', align: 'left', sortable: true },
      { name: 'status', label: 'Status', field: 'status', align: 'left' },
      { name: 'created_at', label: 'Ngày tạo', field: 'created_at', align: 'left', format: v => dayjs(v).format('YYYY-MM-DD') },
      { name: 'actions', label: '', field: 'actions', align: 'right' }
    ]
    async function loadData() {
      loading.value = true
      try { const r = await agnoClient.listTeams({ agent_os_id: filterAgentOS.value || undefined, page_size: 100 }); rows.value = r.items }
      finally { loading.value = false }
    }
    async function loadMeta() {
      const r = await agnoClient.listAgentOS({ page_size: 100 }); agentOSOptions.value = r.items.map(a => ({ label: a.name, value: a.id }))
    }
    function openCreate() { editItem.value = null; apiError.value = ''; form.value = defaultForm(); dialog.value = true }
    function openEdit(item) {
      editItem.value = item; apiError.value = ''
      form.value = { agent_os_id: item.agent_os_id, code: item.code, name: item.name, description: item.description || '', enabled: item.enabled ?? true }
      dialog.value = true
    }
    async function save() {
      if (!form.value.agent_os_id || !form.value.code || !form.value.name) { apiError.value = 'agent_os_id, code và name là bắt buộc'; return }
      saving.value = true; apiError.value = ''
      try {
        if (editItem.value) await agnoClient.updateTeam(editItem.value.id, { name: form.value.name, description: form.value.description, enabled: form.value.enabled })
        else await agnoClient.createTeam(form.value)
        $q.notify({ type: 'positive', message: editItem.value ? 'Đã cập nhật' : 'Đã tạo Team' })
        dialog.value = false; loadData()
      } catch (e) {
        const ec = e.response?.data?.error_code
        apiError.value = ec === 'conflict' ? 'Code đã tồn tại trong AgentOS này (409 Conflict)' : e.response?.data?.message || 'Lỗi'
      } finally { saving.value = false }
    }
    function confirmDelete(item) {
      $q.dialog({ title: 'Xóa Team', message: `Xóa "${item.name}"? Record được giữ lại để tham chiếu lịch sử (soft delete).`, cancel: { label: 'Hủy' }, ok: { color: 'red', label: 'Xóa', unelevated: true } })
        .onOk(async () => { await agnoClient.deleteTeam(item.id); $q.notify({ type: 'positive', message: 'Đã xóa' }); loadData() })
    }
    onMounted(() => { loadData(); loadMeta() })
    return { rows, columns, loading, saving, search, filterAgentOS, agentOSOptions, dialog, editItem, form, apiError, loadData, openCreate, openEdit, save, confirmDelete }
  }
})
</script>