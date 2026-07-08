<template>
  <q-page class="q-pa-lg" v-if="item">
    <div class="row items-center q-mb-lg">
      <q-btn flat icon="arrow_back" to="/ai/teams" class="q-mr-sm" />
      <div>
        <div class="text-h5 text-weight-bold">{{ item.name }}</div>
        <div class="row items-center q-gutter-xs q-mt-xs">
          <span class="code-tag">{{ item.code }}</span>
          <span class="text-grey-6 text-caption code-mono">{{ item.id }}</span>
        </div>
      </div>
      <q-space />
      <span class="badge q-mr-md" :class="item.enabled ? 'badge--active' : 'badge--inactive'">{{ item.enabled ? 'enabled' : 'disabled' }}</span>
      <q-btn outline color="primary" icon="rule_folder" label="Capabilities" class="q-mr-sm"
        :to="`/mcp/assignments?level=team&target_id=${item.id}`" />
      <q-btn outline color="primary" icon="edit" label="Edit" @click="openEdit" />
    </div>

    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-8">
        <q-card flat bordered style="border-radius:12px">
          <q-card-section>
            <div class="text-subtitle1 text-weight-bold q-mb-md">Details</div>
            <div class="row q-col-gutter-sm">
              <div class="col-6">
                <div class="text-caption text-grey-6">Name</div>
                <div class="text-weight-medium q-mt-xs">{{ item.name }}</div>
              </div>
              <div class="col-6">
                <div class="text-caption text-grey-6">Code</div>
                <div class="text-weight-medium q-mt-xs code-mono">{{ item.code }}</div>
              </div>
              <div class="col-6 q-mt-sm">
                <div class="text-caption text-grey-6">AgentOS</div>
                <router-link v-if="agentOS" :to="`/ai/agentos/${agentOS.id}`" class="text-weight-medium q-mt-xs text-primary" style="text-decoration:none;display:block">
                  {{ agentOS.name }}
                </router-link>
                <div v-else class="text-weight-medium q-mt-xs code-mono">{{ item.agent_os_id }}</div>
              </div>
              <div class="col-6 q-mt-sm">
                <div class="text-caption text-grey-6">Status</div>
                <span class="badge q-mt-xs" :class="item.enabled ? 'badge--active' : 'badge--inactive'">{{ item.enabled ? 'enabled' : 'disabled' }}</span>
              </div>
              <div class="col-12 q-mt-sm">
                <div class="text-caption text-grey-6">Description</div>
                <div class="text-weight-medium q-mt-xs">{{ item.description || '—' }}</div>
              </div>
              <div class="col-6 q-mt-sm">
                <div class="text-caption text-grey-6">Created</div>
                <div class="text-weight-medium q-mt-xs">{{ dayjs(item.created_at).format('YYYY-MM-DD HH:mm') }}</div>
              </div>
              <div class="col-6 q-mt-sm">
                <div class="text-caption text-grey-6">Updated</div>
                <div class="text-weight-medium q-mt-xs">{{ dayjs(item.updated_at).format('YYYY-MM-DD HH:mm') }}</div>
              </div>
            </div>
          </q-card-section>
        </q-card>

        <q-card flat bordered style="border-radius:12px" class="q-mt-md">
          <q-card-section>
            <div class="row items-center q-mb-md">
              <div class="text-subtitle1 text-weight-bold">Agents</div>
              <q-space />
              <q-btn dense flat color="primary" icon="add" label="New Agent" :to="`/ai/agents?team_id=${item.id}`" />
            </div>
            <q-table :rows="agents" :columns="agentColumns" :loading="loadingAgents" row-key="id" flat dense
              class="eap-table" hide-pagination :rows-per-page-options="[0]">
              <template #body-cell-name="props">
                <q-td :props="props">
                  <router-link :to="`/ai/agents/${props.row.id}`" class="text-primary text-weight-medium" style="text-decoration:none">{{ props.row.name }}</router-link>
                  <div style="margin-top:2px"><span class="code-tag">{{ props.row.code }}</span></div>
                </q-td>
              </template>
              <template #body-cell-enabled="props">
                <q-td :props="props"><span class="badge" :class="props.value ? 'badge--active' : 'badge--inactive'">{{ props.value ? 'enabled' : 'disabled' }}</span></q-td>
              </template>
              <template #no-data>
                <div class="empty-state" style="width:100%;padding:32px">
                  <div class="empty-state__title">No agents in this team yet</div>
                </div>
              </template>
            </q-table>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-4">
        <q-card flat bordered style="border-radius:12px">
          <q-card-section>
            <div class="text-subtitle1 text-weight-bold q-mb-md">Statistics</div>
            <q-list dense>
              <q-item>
                <q-item-section>Agents</q-item-section>
                <q-item-section side><q-badge color="blue" :label="agents.length" /></q-item-section>
              </q-item>
              <q-item>
                <q-item-section>Enabled agents</q-item-section>
                <q-item-section side><q-badge color="green" :label="agents.filter(a => a.enabled).length" /></q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>

        <q-card flat bordered style="border-radius:12px" class="q-mt-md">
          <q-card-section>
            <div class="text-subtitle1 text-weight-bold q-mb-sm">Danger zone</div>
            <div class="text-caption text-grey-6 q-mb-md">Soft delete — record được giữ lại để tham chiếu lịch sử.</div>
            <q-btn outline color="negative" icon="delete_outline" label="Delete Team" class="full-width" @click="confirmDelete" />
          </q-card-section>
        </q-card>
      </div>
    </div>

    <BaseFormDialog v-model="dialog" title="Sửa Team" icon="group" :loading="saving" width="560px" @confirm="save">
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="row q-col-gutter-md">
          <div class="col-6">
            <label class="field-label">code</label>
            <q-input :model-value="item.code" outlined dense disable hint="Không đổi được sau khi tạo" />
          </div>
          <div class="col-6">
            <label class="field-label">name <span style="color:var(--brand-danger)">*</span></label>
            <q-input v-model="form.name" outlined dense />
          </div>
        </div>
        <div>
          <label class="field-label">description</label>
          <q-input v-model="form.description" outlined dense type="textarea" :rows="3" />
        </div>
        <q-toggle v-model="form.enabled" label="Enabled" />
        <div v-if="apiError" class="api-error-box"><q-icon name="error_outline" size="16px" />{{ apiError }}</div>
      </div>
    </BaseFormDialog>
  </q-page>

  <q-page v-else class="column items-center justify-center">
    <q-spinner size="48px" color="primary" />
  </q-page>
</template>

<script>
import { defineComponent, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { agnoClient } from '../../../services/api/agno-runtime.client'
import dayjs from 'dayjs'

export default defineComponent({
  name: 'TeamDetail',
  setup() {
    const route = useRoute(), router = useRouter(), $q = useQuasar()
    const item = ref(null), agentOS = ref(null)
    const agents = ref([]), loadingAgents = ref(false)
    const dialog = ref(false), saving = ref(false), apiError = ref('')
    const form = ref({ name: '', description: '', enabled: true })

    const agentColumns = [
      { name: 'name', label: 'Tên / Code', field: 'name', align: 'left' },
      { name: 'enabled', label: 'Status', field: 'enabled', align: 'left' }
    ]

    async function loadAgents() {
      loadingAgents.value = true
      try { const r = await agnoClient.listAgents({ team_id: item.value.id, page_size: 100 }); agents.value = r.items }
      catch { agents.value = [] }
      finally { loadingAgents.value = false }
    }


    function openEdit() {
      apiError.value = ''
      form.value = { name: item.value.name, description: item.value.description || '', enabled: item.value.enabled ?? true }
      dialog.value = true
    }

    async function save() {
      if (!form.value.name) { apiError.value = 'name là bắt buộc'; return }
      saving.value = true; apiError.value = ''
      try {
        item.value = await agnoClient.updateTeam(item.value.id, { name: form.value.name, description: form.value.description, enabled: form.value.enabled })
        $q.notify({ type: 'positive', message: 'Đã cập nhật' })
        dialog.value = false
      } catch (e) {
        apiError.value = e.response?.data?.message || 'Cập nhật thất bại'
      } finally { saving.value = false }
    }

    function confirmDelete() {
      $q.dialog({ title: 'Xóa Team', message: `Xóa "${item.value.name}"? Record được giữ lại để tham chiếu lịch sử (soft delete).`, cancel: { label: 'Hủy' }, ok: { color: 'red', label: 'Xóa', unelevated: true } })
        .onOk(async () => {
          await agnoClient.deleteTeam(item.value.id)
          $q.notify({ type: 'positive', message: 'Đã xóa' })
          router.push('/ai/teams')
        })
    }

    onMounted(async () => {
      item.value = await agnoClient.getTeam(route.params.id)
      loadAgents()
      try {
        const osList = await agnoClient.listAgentOS({ page_size: 100 })
        agentOS.value = osList.items.find(o => o.id === item.value.agent_os_id) || null
      } catch { agentOS.value = null }
    })

    return { item, agentOS, agents, agentColumns, loadingAgents, dialog, saving, apiError, form, dayjs, openEdit, save, confirmDelete }
  }
})
</script>