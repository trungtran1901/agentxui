<template>
  <BaseCrudPage
    title="AgentOS"
    subtitle="Manage Agent Operating System instances — POST /agent-os (code must be unique)"
    entity-name="AgentOS"
    :rows="rows"
    :columns="columns"
    :loading="loading"
    show-clone
    @create="openCreate"
    @edit="openEdit"
    @view="r => $router.push('/ai/agentos/'+r.id)"
    @delete="confirmDelete"
    @refresh="loadData"
    @search="q => { search = q; loadData() }"
  >
    <template #body-cell-name="props">
      <q-td :props="props">
        <router-link :to="`/ai/agentos/${props.row.id}`"
          style="font-weight:600;color:var(--brand-primary);text-decoration:none;font-size:13px">
          {{ props.row.name }}
        </router-link>
        <div style="margin-top:2px">
          <span class="code-tag">{{ props.row.code }}</span>
        </div>
      </q-td>
    </template>
    <template #body-cell-status="props">
      <q-td :props="props">
        <span v-if="props.row.enabled" class="badge badge--active">enabled</span>
        <span v-else class="badge" style="background:var(--surface-sunken);color:var(--text-tertiary)">disabled</span>
      </q-td>
    </template>
    <template #body-cell-created_at="props">
      <q-td :props="props" style="color:var(--text-tertiary);font-size:12px">
        {{ dayjs(props.value).format('MMM D, YYYY') }}
      </q-td>
    </template>
  </BaseCrudPage>

  <BaseFormDialog
    v-model="dialog"
    :title="editItem ? 'Update AgentOS' : 'Create AgentOS'"
    icon="cloud_circle"
    icon-color="#6366f1"
    :loading="saving"
    @confirm="save"
  >
    <div style="display:flex;flex-direction:column;gap:16px">
      <div>
        <label class="field-label">Code <span style="color:var(--brand-danger)">*</span></label>
        <q-input v-model="form.code" outlined dense :disable="!!editItem"
          placeholder="my-agent-os" :hint="editItem ? 'Cannot be changed after creation' : 'Must be unique across all AgentOS'" />
      </div>
      <div>
        <label class="field-label">Display Name <span style="color:var(--brand-danger)">*</span></label>
        <q-input v-model="form.name" outlined dense placeholder="Production AgentOS" />
      </div>
      <div>
        <label class="field-label">Description</label>
        <q-input v-model="form.description" outlined dense type="textarea" :rows="3"
          placeholder="Describe the purpose of this AgentOS…" />
      </div>

      <div class="row q-col-gutter-md">
        <div class="col-6">
          <label class="field-label">Default Model</label>
          <q-select v-model="form.default_model_id" :options="modelOptions" outlined dense
            emit-value map-options clearable use-input @filter="filterModels"
            placeholder="None" :loading="loadingOptions" />
        </div>
        <div class="col-6">
          <label class="field-label">Shared Prompt</label>
          <q-select v-model="form.shared_prompt_id" :options="promptOptions" outlined dense
            emit-value map-options clearable use-input @filter="filterPrompts"
            placeholder="None" :loading="loadingOptions" />
        </div>
      </div>

      <div class="row items-center">
        <q-toggle v-model="form.enabled" color="primary" />
        <span style="font-size:13px;color:var(--text-primary);margin-left:4px">Enabled</span>
      </div>

      <div v-if="apiError" class="api-error-box">
        <q-icon name="error_outline" size="16px" />
        <span>{{ apiError }}</span>
      </div>
    </div>
  </BaseFormDialog>
</template>

<script>
import { defineComponent, ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { agnoClient } from '../../../services/api/agno-runtime.client.js'
import { useUIStore } from '../../../stores/ui.store.js'
import BaseCrudPage from '../../../shared/components/BaseCrudPage.vue'
import BaseFormDialog from '../../../shared/components/BaseFormDialog.vue'
import dayjs from 'dayjs'

export default defineComponent({
  name: 'AgentOSPage',
  components: { BaseCrudPage, BaseFormDialog },
  setup() {
    const $q = useQuasar()
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'AI Platform' }, { label: 'AgentOS' }])

    const rows = ref([]), loading = ref(false), saving = ref(false), search = ref('')
    const dialog = ref(false), editItem = ref(null), apiError = ref('')
    const form = ref({ code: '', name: '', description: '', default_model_id: null, shared_prompt_id: null, enabled: true })

    const allModels = ref([]), allPrompts = ref([]), loadingOptions = ref(false)
    const modelOptions = ref([]), promptOptions = ref([])

    function filterModels(val, update) {
      update(() => {
        const needle = val.toLowerCase()
        modelOptions.value = !val ? allModels.value : allModels.value.filter(o => o.label.toLowerCase().includes(needle))
      })
    }
    function filterPrompts(val, update) {
      update(() => {
        const needle = val.toLowerCase()
        promptOptions.value = !val ? allPrompts.value : allPrompts.value.filter(o => o.label.toLowerCase().includes(needle))
      })
    }

    async function loadOptions() {
      loadingOptions.value = true
      try {
        const [modelsRes, promptsRes] = await Promise.all([
          agnoClient.listModels({ page_size: 200 }),
          agnoClient.listPrompts({ page_size: 200 })
        ])
        allModels.value = modelsRes.items.map(m => ({ label: `${m.provider} / ${m.model}`, value: m.id }))
        allPrompts.value = promptsRes.items.map(p => ({ label: `${p.code} (v${p.version})`, value: p.id }))
        modelOptions.value = allModels.value
        promptOptions.value = allPrompts.value
      } catch (e) {
        $q.notify({ type: 'negative', message: 'Failed to load models/prompts for selection' })
      } finally { loadingOptions.value = false }
    }

    const columns = [
      { name: 'name', label: 'Name / Code', field: 'name', align: 'left', sortable: true },
      { name: 'status', label: 'Status', field: 'enabled', align: 'left' },
      { name: 'created_at', label: 'Created', field: 'created_at', align: 'left' },
      { name: 'actions', label: '', field: 'actions', align: 'right' }
    ]

    async function loadData() {
      loading.value = true
      try {
        const res = await agnoClient.listAgentOS({ page: 1, page_size: 100 })
        rows.value = res.items
      } catch (e) {
        $q.notify({ type: 'negative', message: 'Failed to load AgentOS list' })
      } finally { loading.value = false }
    }

    function openCreate() {
      editItem.value = null
      form.value = { code: '', name: '', description: '', default_model_id: null, shared_prompt_id: null, enabled: true }
      apiError.value = ''
      dialog.value = true
    }

    function openEdit(item) {
      editItem.value = item
      form.value = {
        code: item.code,
        name: item.name,
        description: item.description || '',
        default_model_id: item.default_model_id || null,
        shared_prompt_id: item.shared_prompt_id || null,
        enabled: item.enabled ?? true
      }
      apiError.value = ''
      dialog.value = true
    }

    async function save() {
      if (!form.value.code || !form.value.name) {
        apiError.value = 'Code and Name are required'
        return
      }
      saving.value = true; apiError.value = ''
      try {
        if (editItem.value) {
          await agnoClient.updateAgentOS(editItem.value.id, {
            name: form.value.name,
            description: form.value.description,
            default_model_id: form.value.default_model_id,
            shared_prompt_id: form.value.shared_prompt_id,
            enabled: form.value.enabled
          })
          $q.notify({ type: 'positive', message: 'AgentOS updated' })
        } else {
          await agnoClient.createAgentOS(form.value)
          $q.notify({ type: 'positive', message: 'AgentOS created' })
        }
        dialog.value = false
        loadData()
      } catch (e) {
        const ec = e.response?.data?.error_code
        apiError.value = ec === 'conflict'
          ? `Code "${form.value.code}" already exists (409 Conflict)`
          : e.response?.data?.message || 'Save failed'
      } finally { saving.value = false }
    }

    function confirmDelete(item) {
      $q.dialog({
        title: 'Delete AgentOS',
        message: `Delete <strong>${item.name}</strong>? This performs a soft delete.`,
        html: true,
        cancel: { label: 'Cancel', flat: true },
        ok: { label: 'Delete', color: 'negative', unelevated: true }
      }).onOk(async () => {
        try {
          await agnoClient.deleteAgentOS(item.id)
          $q.notify({ type: 'positive', message: 'AgentOS deleted' })
          loadData()
        } catch (e) {
          $q.notify({ type: 'negative', message: e.response?.data?.message || 'Delete failed' })
        }
      })
    }

    onMounted(() => { loadData(); loadOptions() })
    return {
      rows, columns, loading, saving, search, dialog, editItem, form, apiError, dayjs,
      modelOptions, promptOptions, loadingOptions, filterModels, filterPrompts,
      loadData, openCreate, openEdit, save, confirmDelete
    }
  }
})
</script>