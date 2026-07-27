<template>
  <q-page class="q-pa-lg">
    <div class="row items-center q-mb-lg">
      <div>
        <div class="text-h5 text-weight-bold">Model Registry</div>
        <div style="color:var(--text-tertiary);font-size:12px;margin-top:2px">
          GET/POST/PUT/DELETE /models · Cặp (provider, model) là duy nhất
        </div>
      </div>
      <q-space />
      <q-btn unelevated no-caps icon="add" label="Đăng ký Model" @click="openCreate"
        style="background:var(--brand-primary);color:#fff;border-radius:8px;padding:0 16px" />
    </div>

    <q-card flat bordered style="border-radius:12px">
      <q-table :rows="rows" :columns="columns" :loading="loading" row-key="id" flat class="enterprise-table">
        <template #body-cell-name="props">
          <q-td :props="props">
            <div class="row items-center q-gutter-xs">
              <q-chip dense size="xs" :color="providerColor(props.row.provider)" text-color="white" :label="props.row.provider" />
              <span class="code-tag">{{ props.row.model }}</span>
            </div>
            <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px">
              temp: {{ props.row.temperature }} · max_tokens: {{ props.row.max_tokens }}
              <span v-if="props.row.base_url"> · base_url: {{ props.row.base_url }}</span>
            </div>
            <div v-if="props.row.cost_per_1k_input_tokens != null || props.row.cost_per_1k_output_tokens != null"
              style="font-size:11px;color:var(--text-tertiary);margin-top:2px">
              $/1k in: {{ props.row.cost_per_1k_input_tokens ?? '—' }} · $/1k out: {{ props.row.cost_per_1k_output_tokens ?? '—' }}
            </div>
          </q-td>
        </template>
        <template #body-cell-enabled="props">
          <q-td :props="props">
            <q-toggle :model-value="props.value" dense color="primary" @update:model-value="v => toggleEnabled(props.row, v)" />
          </q-td>
        </template>
        <template #body-cell-created_at="props">
          <q-td :props="props" style="color:var(--text-tertiary);font-size:12px">
            {{ props.value }}
          </q-td>
        </template>
        <template #body-cell-actions="props">
          <q-td :props="props" auto-width>
            <q-btn flat round dense icon="edit" size="sm" style="color:var(--brand-primary)" @click="openEdit(props.row)" class="q-mr-xs" />
            <q-btn flat round dense icon="delete" size="sm" color="negative" @click="confirmDelete(props.row)" />
          </q-td>
        </template>
        <template #no-data>
          <div class="column items-center q-py-xl" style="color:var(--text-tertiary)">
            <q-icon name="psychology" size="48px" color="grey-3" />
            <div class="text-subtitle1 q-mt-md">Chưa có model nào</div>
          </div>
        </template>
      </q-table>
    </q-card>

    <BaseFormDialog v-model="dialog" :title="editItem ? 'Cập nhật Model' : 'Đăng ký Model mới'"
      icon="psychology" icon-color="#6366f1" :loading="saving" width="650px" @confirm="save">
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="row q-col-gutter-md">
          <div class="col-6">
            <label class="field-label">Provider <span style="color:var(--brand-danger)">*</span></label>
            <q-select v-model="form.provider" outlined dense :options="['openai','anthropic','openai_like']" :disable="!!editItem" />
          </div>
          <div class="col-6">
            <label class="field-label">Model ID <span style="color:var(--brand-danger)">*</span></label>
            <q-input v-model="form.model" outlined dense
              :placeholder="form.provider === 'anthropic' ? 'claude-sonnet-4-6' : 'gpt-4o-mini'"
              :disable="!!editItem" />
          </div>
        </div>

        <div class="row q-col-gutter-md">
          <div class="col-6">
            <label class="field-label">Temperature</label>
            <q-input v-model.number="form.temperature" outlined dense type="number" step="0.1" min="0" max="2" />
          </div>
          <div class="col-6">
            <label class="field-label">Max Tokens</label>
            <q-input v-model.number="form.max_tokens" outlined dense type="number" step="1" min="1" />
          </div>
        </div>

        <div class="row q-col-gutter-md">
          <div class="col-6">
            <label class="field-label">
              Cost / 1k input tokens (USD)
              <span style="font-weight:400;color:var(--text-tertiary)">(tuỳ chọn)</span>
            </label>
            <q-input v-model.number="form.cost_per_1k_input_tokens" outlined dense type="number" step="0.0001" min="0"
              placeholder="0.0025" />
          </div>
          <div class="col-6">
            <label class="field-label">
              Cost / 1k output tokens (USD)
              <span style="font-weight:400;color:var(--text-tertiary)">(tuỳ chọn)</span>
            </label>
            <q-input v-model.number="form.cost_per_1k_output_tokens" outlined dense type="number" step="0.0001" min="0"
              placeholder="0.0100" />
          </div>
        </div>
        <div style="font-size:11px;color:var(--text-quaternary);margin-top:-8px">
          Dùng để quy đổi metric COST_USD trong Quota Management và các báo cáo chi phí. Để trống nếu chưa xác định.
        </div>

        <div v-if="form.provider === 'openai_like'" class="row q-col-gutter-md">
          <div class="col-12" style="font-size:11px;color:var(--text-tertiary);margin-bottom:-4px">
            openai_like trỏ tới một endpoint tương thích OpenAI (vLLM, LM Studio, Azure OpenAI, …) — cần khai báo base_url
          </div>
          <div class="col-6">
            <label class="field-label">Base URL <span style="color:var(--brand-danger)">*</span></label>
            <q-input v-model="form.base_url" outlined dense placeholder="https://my-endpoint.example.com/v1" />
          </div>
          <div class="col-6">
            <label class="field-label">API Key</label>
            <q-input v-model="form.api_key" outlined dense type="password" placeholder="sk-…" autocomplete="new-password" />
          </div>
        </div>
        <div v-else class="row q-col-gutter-md">
          <div class="col-6">
            <label class="field-label">Base URL <span style="font-weight:400;color:var(--text-tertiary)">(tuỳ chọn — ghi đè endpoint mặc định)</span></label>
            <q-input v-model="form.base_url" outlined dense placeholder="https://api.openai.com/v1" />
          </div>
          <div class="col-6">
            <label class="field-label">API Key <span style="font-weight:400;color:var(--text-tertiary)">(tuỳ chọn — ghi đè key mặc định)</span></label>
            <q-input v-model="form.api_key" outlined dense type="password" placeholder="sk-…" autocomplete="new-password" />
          </div>
        </div>

        <div>
          <label class="field-label">
            extra_client_params <span style="font-weight:400;color:var(--text-tertiary)">(JSON, tuỳ chọn)</span>
          </label>
          <q-input v-model="extraParamsText" outlined dense type="textarea" :rows="3"
            placeholder='{ "organization": "org_123" }'
            :error="!!extraParamsError" :error-message="extraParamsError" />
        </div>

        <div class="row items-center" style="padding-top:4px">
          <q-toggle v-model="form.enabled" color="primary" />
          <span style="font-size:13px;color:var(--text-primary);margin-left:4px">Enabled</span>
        </div>
      </div>
    </BaseFormDialog>
  </q-page>
</template>

<script>
import { defineComponent, ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { agnoClient } from '../../../services/api/agno-runtime.client'
import { useUIStore } from '../../../stores/ui.store'
import BaseFormDialog from '../../../shared/components/BaseFormDialog.vue'
import dayjs from 'dayjs'
export default defineComponent({
  name: 'ModelsPage', components: { BaseFormDialog },
  setup() {
    const $q = useQuasar(); const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'AI Platform' }, { label: 'Models' }])
    const rows = ref([]), loading = ref(false), saving = ref(false), dialog = ref(false), editItem = ref(null)
    const defaultForm = () => ({
      provider: 'openai', model: '', temperature: 0.7, max_tokens: 4096, enabled: true,
      base_url: '', api_key: '', cost_per_1k_input_tokens: null, cost_per_1k_output_tokens: null
    })
    const form = ref(defaultForm())
    const extraParamsText = ref(''), extraParamsError = ref('')
    const columns = [
      { name: 'name', label: 'Provider / Model', field: 'model', align: 'left', sortable: true },
      { name: 'enabled', label: 'Enabled', field: 'enabled', align: 'center' },
      { name: 'created_at', label: 'Ngày thêm', field: 'created_at', align: 'left', format: v => dayjs(v).format('YYYY-MM-DD') },
      { name: 'actions', label: '', field: 'actions', align: 'right' }
    ]
    const providerColor = p => p === 'openai' ? 'teal' : p === 'anthropic' ? 'orange' : p === 'openai_like' ? 'indigo' : 'purple'
    async function loadData() { loading.value = true; try { const r = await agnoClient.listModels(); rows.value = r.items } finally { loading.value = false } }
    function openCreate() {
      editItem.value = null
      form.value = defaultForm()
      extraParamsText.value = ''
      extraParamsError.value = ''
      dialog.value = true
    }
    function openEdit(m) {
      editItem.value = m
      form.value = {
        provider: m.provider, model: m.model, temperature: m.temperature, max_tokens: m.max_tokens, enabled: m.enabled,
        base_url: m.base_url || '', api_key: m.api_key || '',
        cost_per_1k_input_tokens: m.cost_per_1k_input_tokens ?? null,
        cost_per_1k_output_tokens: m.cost_per_1k_output_tokens ?? null
      }
      extraParamsText.value = m.extra_client_params && Object.keys(m.extra_client_params).length
        ? JSON.stringify(m.extra_client_params, null, 2) : ''
      extraParamsError.value = ''
      dialog.value = true
    }
    async function toggleEnabled(m, val) {
      try { await agnoClient.updateModel(m.id, { enabled: val }); m.enabled = val; $q.notify({ type: 'positive', message: val ? 'Model đã bật' : 'Model đã tắt' }) }
      catch { $q.notify({ type: 'negative', message: 'Cập nhật thất bại' }) }
    }
    async function save() {
      extraParamsError.value = ''
      let extra_client_params
      if (extraParamsText.value.trim()) {
        try { extra_client_params = JSON.parse(extraParamsText.value) }
        catch { extraParamsError.value = 'JSON không hợp lệ'; return }
      }
      if (form.value.provider === 'openai_like' && !form.value.base_url) {
        $q.notify({ type: 'negative', message: 'base_url là bắt buộc với provider openai_like' })
        return
      }
      saving.value = true
      try {
        if (editItem.value) {
          await agnoClient.updateModel(editItem.value.id, {
            temperature: form.value.temperature,
            max_tokens: form.value.max_tokens,
            enabled: form.value.enabled,
            base_url: form.value.base_url || undefined,
            api_key: form.value.api_key || undefined,
            cost_per_1k_input_tokens: form.value.cost_per_1k_input_tokens,
            cost_per_1k_output_tokens: form.value.cost_per_1k_output_tokens,
            extra_client_params
          })
        } else {
          await agnoClient.createModel({
            provider: form.value.provider,
            model: form.value.model,
            temperature: form.value.temperature,
            max_tokens: form.value.max_tokens,
            enabled: form.value.enabled,
            base_url: form.value.base_url || undefined,
            api_key: form.value.api_key || undefined,
            cost_per_1k_input_tokens: form.value.cost_per_1k_input_tokens,
            cost_per_1k_output_tokens: form.value.cost_per_1k_output_tokens,
            extra_client_params
          })
        }
        $q.notify({ type: 'positive', message: editItem.value ? 'Đã cập nhật' : 'Đã đăng ký model' }); dialog.value = false; loadData()
      } catch (e) {
        const ec = e.response?.data?.error_code
        if (ec === 'conflict') $q.notify({ type: 'negative', message: 'Cặp (provider, model) đã tồn tại (409)' })
        else if (ec === 'validation_failed') $q.notify({ type: 'negative', message: e.response?.data?.message || 'Validation thất bại (422)' })
        else $q.notify({ type: 'negative', message: e.response?.data?.message || 'Lỗi' })
      } finally { saving.value = false }
    }
    function confirmDelete(m) {
      $q.dialog({ title: 'Xóa Model', message: `Xóa "${m.provider}/${m.model}"? Record được giữ lại trong DB để tham chiếu lịch sử.`, cancel: { label: 'Hủy' }, ok: { color: 'red', label: 'Xóa mềm', unelevated: true } })
        .onOk(async () => { await agnoClient.deleteModel(m.id); loadData() })
    }
    onMounted(loadData)
    return { rows, columns, loading, saving, dialog, editItem, form, extraParamsText, extraParamsError, providerColor, loadData, openCreate, openEdit, toggleEnabled, save, confirmDelete }
  }
})
</script>