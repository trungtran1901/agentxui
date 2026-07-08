<template>
  <q-page class="q-pa-lg" v-if="item">
    <div class="row items-center q-mb-lg">
      <q-btn flat icon="arrow_back" :to="'/ai/agentos'" class="q-mr-sm" />
      <div>
        <div class="text-h5 text-weight-bold">{{ item.name }}</div>
        <div style="color:var(--text-tertiary);font-size:12px">{{ item.id }}</div>
      </div>
      <q-space />
      <span class="badge q-mr-md" :class="item.enabled ? 'badge--active' : ''"
        :style="!item.enabled ? 'background:var(--surface-sunken);color:var(--text-tertiary)' : ''">
        {{ item.enabled ? 'enabled' : 'disabled' }}
      </span>
      <q-btn outline no-caps icon="edit" label="Edit" @click="openEdit"
        style="color:var(--brand-primary);border-color:var(--brand-primary);border-radius:8px" />
    </div>

    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-8">
        <q-card flat bordered style="border-radius:12px">
          <q-card-section>
            <div class="text-subtitle1 text-weight-bold q-mb-md">Details</div>
            <div class="row q-col-gutter-sm">
              <div class="col-6">
                <div class="text-caption" style="color:var(--text-tertiary)">Name</div>
                <div class="text-weight-medium q-mt-xs">{{ item.name }}</div>
              </div>
              <div class="col-6">
                <div class="text-caption" style="color:var(--text-tertiary)">Code</div>
                <div class="q-mt-xs"><span class="code-tag">{{ item.code }}</span></div>
              </div>
              <div class="col-12 q-mt-sm">
                <div class="text-caption" style="color:var(--text-tertiary)">Description</div>
                <div class="text-weight-medium q-mt-xs">{{ item.description || '—' }}</div>
              </div>
              <div class="col-6 q-mt-sm">
                <div class="text-caption" style="color:var(--text-tertiary)">Default Model</div>
                <div class="q-mt-xs">
                  <span v-if="defaultModel" class="code-tag">{{ defaultModel.provider }} / {{ defaultModel.model }}</span>
                  <span v-else style="color:var(--text-tertiary);font-size:13px">—</span>
                </div>
              </div>
              <div class="col-6 q-mt-sm">
                <div class="text-caption" style="color:var(--text-tertiary)">Shared Prompt</div>
                <div class="q-mt-xs">
                  <span v-if="sharedPrompt" class="code-tag">{{ sharedPrompt.code }} (v{{ sharedPrompt.version }})</span>
                  <span v-else style="color:var(--text-tertiary);font-size:13px">—</span>
                </div>
              </div>
              <div class="col-6 q-mt-sm">
                <div class="text-caption" style="color:var(--text-tertiary)">Created</div>
                <div class="text-weight-medium q-mt-xs">{{ dayjs(item.created_at).format('YYYY-MM-DD HH:mm') }}</div>
              </div>
              <div class="col-6 q-mt-sm">
                <div class="text-caption" style="color:var(--text-tertiary)">Updated</div>
                <div class="text-weight-medium q-mt-xs">{{ dayjs(item.updated_at).format('YYYY-MM-DD HH:mm') }}</div>
              </div>
            </div>
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
                <q-item-section side><q-badge color="blue" :label="item.agent_count ?? 0" /></q-item-section>
              </q-item>
              <q-item>
                <q-item-section>Teams</q-item-section>
                <q-item-section side><q-badge color="green" :label="item.team_count ?? 0" /></q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <BaseFormDialog
      v-model="dialog"
      title="Update AgentOS"
      icon="cloud_circle"
      icon-color="#6366f1"
      :loading="saving"
      @confirm="save"
    >
      <div style="display:flex;flex-direction:column;gap:16px">
        <div>
          <label class="field-label">Code</label>
          <q-input v-model="form.code" outlined dense disable hint="Cannot be changed after creation" />
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
  </q-page>
  <q-page v-else class="column items-center justify-center">
    <q-spinner size="48px" style="color:var(--brand-primary)" />
  </q-page>
</template>

<script>
import { defineComponent, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { agnoClient } from '../../../services/api/agno-runtime.client'
import BaseFormDialog from '../../../shared/components/BaseFormDialog.vue'
import dayjs from 'dayjs'

export default defineComponent({
  name: 'AgentOSDetail',
  components: { BaseFormDialog },
  setup() {
    const route = useRoute()
    const $q = useQuasar()
    const item = ref(null)
    const dialog = ref(false), saving = ref(false), apiError = ref('')
    const defaultModel = ref(null), sharedPrompt = ref(null)
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

    async function loadLinkedResources() {
      defaultModel.value = null
      sharedPrompt.value = null
      try {
        if (item.value.default_model_id) defaultModel.value = await agnoClient.getModel(item.value.default_model_id)
      } catch { defaultModel.value = null }
      try {
        if (item.value.shared_prompt_id) sharedPrompt.value = await agnoClient.getPrompt(item.value.shared_prompt_id)
      } catch { sharedPrompt.value = null }
    }

    async function loadItem() {
      item.value = await agnoClient.getAgentOS(route.params.id)
      await loadLinkedResources()
    }

    function openEdit() {
      form.value = {
        code: item.value.code,
        name: item.value.name,
        description: item.value.description || '',
        default_model_id: item.value.default_model_id || null,
        shared_prompt_id: item.value.shared_prompt_id || null,
        enabled: item.value.enabled ?? true
      }
      apiError.value = ''
      dialog.value = true
    }

    async function save() {
      if (!form.value.name) { apiError.value = 'Name is required'; return }
      saving.value = true; apiError.value = ''
      try {
        await agnoClient.updateAgentOS(item.value.id, {
          name: form.value.name,
          description: form.value.description,
          default_model_id: form.value.default_model_id,
          shared_prompt_id: form.value.shared_prompt_id,
          enabled: form.value.enabled
        })
        $q.notify({ type: 'positive', message: 'AgentOS updated' })
        dialog.value = false
        await loadItem()
      } catch (e) {
        apiError.value = e.response?.data?.message || 'Save failed'
      } finally { saving.value = false }
    }

    onMounted(() => { loadItem(); loadOptions() })

    return {
      item, dialog, saving, apiError, form, dayjs,
      defaultModel, sharedPrompt, modelOptions, promptOptions, loadingOptions,
      filterModels, filterPrompts, openEdit, save
    }
  }
})
</script>