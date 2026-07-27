<template>
  <q-page class="page-wrapper" v-if="available === null">
    <div class="surface empty-state" style="padding:60px">
      <q-spinner size="28px" style="color:var(--brand-primary)" />
    </div>
  </q-page>

  <q-page class="page-wrapper" v-else-if="available === false">
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-title">Quota Management</h1>
        <p class="page-subtitle">GET /quota/policies — Quota Policy Registry</p>
      </div>
    </div>
    <div class="surface empty-state" style="padding:60px">
      <div class="empty-state__icon"><q-icon name="speed" /></div>
      <div class="empty-state__title">Quota Management chưa được bật</div>
      <div class="empty-state__desc">Backend environment này chưa bật feature flag <code class="code-tag">FEATURE_QUOTA_MANAGEMENT</code>. Liên hệ quản trị viên để kích hoạt.</div>
    </div>
  </q-page>

  <template v-else>
    <BaseCrudPage
      title="Quota Policies"
      subtitle="POST/PUT/DELETE /quota/policies — Giới hạn quota theo GLOBAL / GROUP / USER"
      entity-name="Quota Policy"
      :rows="displayRows" :columns="columns" :loading="loading"
      @create="openCreate" @edit="openEdit" @delete="confirmDelete"
      @refresh="loadData" @search="q => { search = q }"
    >
      <template #filters>
        <div class="col-auto">
          <q-select v-model="filterScopeType" :options="scopeTypeFilterOptions" label="Scope Type" outlined dense
            clearable emit-value map-options style="min-width:160px" @update:model-value="loadData" />
        </div>
      </template>

      <template #body-cell-name="props">
        <q-td :props="props">
          <span class="badge" :class="scopeBadgeClass(props.row.scope_type)">{{ props.row.scope_type }}</span>
          <div style="margin-top:4px">
            <template v-if="props.row.scope_value">
              <span v-if="props.row.scope_type === 'USER' && userLabel(props.row.scope_value)" class="code-tag">
                {{ userLabel(props.row.scope_value) }}
              </span>
              <span v-else class="code-tag">{{ props.row.scope_value }}</span>
            </template>
            <span v-else style="font-size:12px;color:var(--text-quaternary)">—</span>
          </div>
        </q-td>
      </template>

      <template #body-cell-model="props">
        <q-td :props="props">
          <span v-if="props.row.model_id" class="code-tag">{{ modelLabel(props.row.model_id) }}</span>
          <span v-else style="font-size:12px;color:var(--text-tertiary)">Tất cả model</span>
        </q-td>
      </template>

      <template #body-cell-metric="props">
        <q-td :props="props"><span class="code-tag">{{ props.row.metric }}</span></q-td>
      </template>

      <template #body-cell-period="props">
        <q-td :props="props">
          <span class="code-tag">{{ props.row.period }}</span>
          <div v-if="props.row.period === 'FIXED_WINDOW'" style="font-size:11px;color:var(--text-quaternary);margin-top:2px">
            {{ props.row.window_seconds }}s
          </div>
        </q-td>
      </template>

      <template #body-cell-limit_value="props">
        <q-td :props="props" style="font-weight:600;font-size:13px;color:var(--text-primary)">
          {{ props.value?.toLocaleString() }}
        </q-td>
      </template>

      <template #body-cell-priority="props">
        <q-td :props="props">{{ props.value }}</q-td>
      </template>

      <template #body-cell-status="props">
        <q-td :props="props">
          <q-toggle :model-value="props.row.enabled" dense @update:model-value="v => toggleEnabled(props.row, v)" />
        </q-td>
      </template>

      <template #body-cell-actions="props">
        <q-td :props="props" auto-width>
          <div style="display:flex;align-items:center;gap:2px;justify-content:flex-end">
            <button class="tbl-action-btn" @click="openEdit(props.row)" title="Edit">
              <q-icon name="edit" size="15px" />
            </button>
            <div class="tbl-action-divider" />
            <button class="tbl-action-btn tbl-action-btn--danger" @click="confirmDelete(props.row)" title="Delete">
              <q-icon name="delete_outline" size="15px" />
            </button>
          </div>
        </q-td>
      </template>
    </BaseCrudPage>

    <!-- ============ CREATE / EDIT DIALOG ============ -->
    <BaseFormDialog v-model="dialog"
      :title="editItem ? 'Sửa Quota Policy' : 'Tạo Quota Policy mới'"
      :subtitle="editItem ? 'Chỉ có thể sửa limit_value / priority / enabled / window_seconds' : 'POST /quota/policies'"
      icon="speed" icon-color="#6366f1"
      :loading="saving" width="600px" @confirm="save">
      <div style="display:flex;flex-direction:column;gap:14px">
        <div>
          <label class="field-label">Scope Type <span style="color:var(--brand-danger)">*</span></label>
          <div class="subject-type-picker">
            <button v-for="t in scopeTypes" :key="t"
              :class="['subject-type-btn', form.scope_type===t && 'subject-type-btn--active']"
              :disabled="!!editItem"
              @click="!editItem && (form.scope_type = t)">
              {{ t }}
            </button>
          </div>
        </div>

        <div v-if="form.scope_type !== 'GLOBAL'">
          <label class="field-label">Scope Value <span style="color:var(--brand-danger)">*</span></label>
          <UserPicker v-if="form.scope_type === 'USER' && !editItem"
            v-model="form.scope_value" placeholder="Tìm user theo username/email/họ tên…" />
          <q-input v-else v-model="form.scope_value" outlined dense :disable="!!editItem"
            :placeholder="form.scope_type === 'USER' ? 'Keycloak user ID (sub claim)' : 'Tên group Keycloak'" />
          <div style="font-size:11px;color:var(--text-quaternary);margin-top:4px">
            {{ form.scope_type === 'USER' ? 'Nhập hoặc tìm theo Keycloak user ID (sub claim)' : 'Tên group đã được đồng bộ vào Keycloak (kể cả từ LDAP)' }}
          </div>
        </div>

        <div>
          <label class="field-label">Model</label>
          <q-select v-model="form.model_id" :options="modelOptions" outlined dense
            emit-value map-options clearable :disable="!!editItem"
            placeholder="Tất cả model" />
        </div>

        <div class="row q-col-gutter-md">
          <div class="col-6">
            <label class="field-label">Metric <span style="color:var(--brand-danger)">*</span></label>
            <q-select v-model="form.metric" :options="metrics" outlined dense :disable="!!editItem" />
          </div>
          <div class="col-6">
            <label class="field-label">Period <span style="color:var(--brand-danger)">*</span></label>
            <q-select v-model="form.period" :options="periods" outlined dense :disable="!!editItem" />
          </div>
        </div>

        <div v-if="form.period === 'FIXED_WINDOW'">
          <label class="field-label">window_seconds <span style="color:var(--brand-danger)">*</span></label>
          <q-input v-model.number="form.window_seconds" outlined dense type="number" min="10" />
          <div style="display:flex;gap:6px;margin-top:8px">
            <button class="btn btn--ghost btn--sm" @click="form.window_seconds = 3600">1 giờ (3600)</button>
            <button class="btn btn--ghost btn--sm" @click="form.window_seconds = 86400">1 ngày (86400)</button>
          </div>
        </div>

        <div>
          <label class="field-label">{{ limitValueLabel }} <span style="color:var(--brand-danger)">*</span></label>
          <q-input v-model.number="form.limit_value" outlined dense type="number" min="0" />
        </div>

        <div>
          <label class="field-label">
            Priority
            <q-icon name="info" size="13px" style="margin-left:2px;color:var(--text-quaternary)">
              <q-tooltip>Dùng để phân xử khi user thuộc nhiều nhóm có policy khác nhau cho cùng metric+period — priority cao hơn được ưu tiên.</q-tooltip>
            </q-icon>
          </label>
          <q-input v-model.number="form.priority" outlined dense type="number" />
        </div>

        <q-toggle v-model="form.enabled" label="Enabled" />

        <div v-if="apiError" class="api-error-box"><q-icon name="error_outline" size="16px" />{{ apiError }}</div>
      </div>
    </BaseFormDialog>
  </template>
</template>

<script>
import { defineComponent, ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { quotaClient } from '../../../services/api/quota.client.js'
import { agnoClient } from '../../../services/api/agno-runtime.client.js'
import { keycloakAdminClient } from '../../../services/api/keycloak-admin.client.js'
import { useUIStore } from '../../../stores/ui.store.js'
import UserPicker from '../../../shared/components/UserPicker.vue'
import BaseCrudPage from '../../../shared/components/BaseCrudPage.vue'
import BaseFormDialog from '../../../shared/components/BaseFormDialog.vue'

export default defineComponent({
  name: 'QuotaPoliciesPage',
  components: { BaseCrudPage, BaseFormDialog, UserPicker },
  setup() {
    const $q = useQuasar()
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'Quota Management' }, { label: 'Policies' }])

    const available = ref(null)
    const rows = ref([]), loading = ref(false), search = ref('')
    const filterScopeType = ref(null)
    const modelOptions = ref([]), modelMap = ref({})
    const userMap = ref({}) // scope_value (user id) -> resolved Keycloak user info, USER-scope rows only

    const scopeTypes = ['GLOBAL', 'GROUP', 'USER']
    const metrics = ['REQUESTS', 'TOKENS', 'COST_USD']
    const periods = ['DAILY', 'MONTHLY', 'FIXED_WINDOW']
    const scopeTypeFilterOptions = [
      { label: 'All scopes', value: null },
      ...scopeTypes.map(t => ({ label: t, value: t }))
    ]

    const columns = [
      { name: 'name', label: 'Scope', field: 'scope_type', align: 'left' },
      { name: 'model', label: 'Model', field: 'model_id', align: 'left' },
      { name: 'metric', label: 'Metric', field: 'metric', align: 'left' },
      { name: 'period', label: 'Period', field: 'period', align: 'left' },
      { name: 'limit_value', label: 'Limit', field: 'limit_value', align: 'right' },
      { name: 'priority', label: 'Priority', field: 'priority', align: 'center' },
      { name: 'status', label: 'Enabled', field: 'enabled', align: 'center' },
      { name: 'actions', label: '', field: 'actions', align: 'right' }
    ]

    const scopeBadgeClass = (t) => ({
      GLOBAL: 'badge--running', GROUP: 'badge--pending', USER: 'badge--active'
    }[t] || 'badge--inactive')

    const modelLabel = (id) => modelMap.value[id] || id?.substring(0, 12) + '…'
    const userLabel = (id) => userMap.value[id]
      ? keycloakAdminClient.displayLabel(userMap.value[id], id)
      : null

    async function resolveUsers() {
      const ids = rows.value.filter(r => r.scope_type === 'USER' && r.scope_value).map(r => r.scope_value)
      if (!ids.length) return
      try { userMap.value = { ...userMap.value, ...(await keycloakAdminClient.resolveUsers(ids)) } }
      catch { /* Keycloak Admin API off or transient error — fall back to raw ids */ }
    }

    const displayRows = computed(() => {
      const q = search.value.trim().toLowerCase()
      if (!q) return rows.value
      return rows.value.filter(r => (r.scope_value || '').toLowerCase().includes(q))
    })

    const limitValueLabel = computed(() => ({
      REQUESTS: 'Số lượt request tối đa',
      TOKENS: 'Số token tối đa (input + output)',
      COST_USD: 'Chi phí tối đa (USD)'
    }[form.value.metric] || 'Limit'))

    function defaultForm() {
      return {
        scope_type: 'GLOBAL', scope_value: '', model_id: null,
        metric: 'TOKENS', period: 'DAILY', window_seconds: null,
        limit_value: 0, priority: 0, enabled: true
      }
    }
    const form = ref(defaultForm())
    const dialog = ref(false), editItem = ref(null), saving = ref(false), apiError = ref('')

    async function loadModels() {
      try {
        const r = await agnoClient.listModels({ page_size: 200 })
        modelOptions.value = r.items.map(m => ({ label: `${m.provider} / ${m.model}`, value: m.id }))
        r.items.forEach(m => { modelMap.value[m.id] = `${m.provider}/${m.model}` })
      } catch { modelOptions.value = [] }
    }

    async function loadData() {
      loading.value = true
      try {
        const res = await quotaClient.listPolicies({
          scope_type: filterScopeType.value || undefined,
          page_size: 200
        })
        rows.value = res.items || []
        resolveUsers()
      } catch (e) {
        if (e.response?.status === 404) { available.value = false; return }
        $q.notify({ type: 'negative', message: 'Failed to load quota policies' })
      } finally { loading.value = false }
    }

    function openCreate() {
      editItem.value = null; apiError.value = ''
      form.value = defaultForm()
      dialog.value = true
    }

    function openEdit(item) {
      editItem.value = item; apiError.value = ''
      form.value = {
        scope_type: item.scope_type, scope_value: item.scope_value || '',
        model_id: item.model_id || null, metric: item.metric, period: item.period,
        window_seconds: item.window_seconds || null,
        limit_value: item.limit_value, priority: item.priority ?? 0,
        enabled: item.enabled ?? true
      }
      dialog.value = true
    }

    async function save() {
      apiError.value = ''
      if (!editItem.value) {
        if (form.value.scope_type !== 'GLOBAL' && !form.value.scope_value.trim()) {
          apiError.value = 'scope_value là bắt buộc khi scope_type != GLOBAL'; return
        }
        if (form.value.period === 'FIXED_WINDOW' && (!form.value.window_seconds || form.value.window_seconds < 10)) {
          apiError.value = 'window_seconds là bắt buộc và tối thiểu 10 khi period = FIXED_WINDOW'; return
        }
      }
      if (form.value.limit_value == null || form.value.limit_value < 0) {
        apiError.value = 'limit_value phải >= 0'; return
      }

      saving.value = true
      try {
        if (editItem.value) {
          await quotaClient.updatePolicy(editItem.value.id, {
            limit_value: form.value.limit_value,
            priority: form.value.priority,
            enabled: form.value.enabled,
            ...(form.value.period === 'FIXED_WINDOW' ? { window_seconds: form.value.window_seconds } : {})
          })
          $q.notify({ type: 'positive', message: 'Đã cập nhật policy' })
        } else {
          await quotaClient.createPolicy({
            scope_type: form.value.scope_type,
            scope_value: form.value.scope_type === 'GLOBAL' ? '' : form.value.scope_value,
            model_id: form.value.model_id,
            metric: form.value.metric,
            period: form.value.period,
            window_seconds: form.value.period === 'FIXED_WINDOW' ? form.value.window_seconds : null,
            limit_value: form.value.limit_value,
            priority: form.value.priority,
            enabled: form.value.enabled
          })
          $q.notify({ type: 'positive', message: 'Đã tạo policy' })
        }
        dialog.value = false
        loadData()
      } catch (e) {
        const ec = e.response?.data?.error_code
        apiError.value = ec === 'conflict'
          ? 'Đã tồn tại policy trùng (scope + model + metric + period) — 409 Conflict'
          : e.response?.data?.message || 'Lưu thất bại'
      } finally { saving.value = false }
    }

    async function toggleEnabled(row, val) {
      try {
        await quotaClient.updatePolicy(row.id, { enabled: val })
        row.enabled = val
        $q.notify({ type: 'positive', message: val ? 'Đã bật' : 'Đã tắt' })
      } catch (e) {
        $q.notify({ type: 'negative', message: e.response?.data?.message || 'Cập nhật thất bại' })
      }
    }

    function confirmDelete(item) {
      $q.dialog({
        title: 'Xóa Quota Policy',
        message: `Xóa policy cho "${item.scope_type}${item.scope_value ? ' / ' + item.scope_value : ''}"? Record được giữ lại để tham chiếu lịch sử (soft delete).`,
        cancel: { label: 'Hủy' },
        ok: { color: 'red', label: 'Xóa', unelevated: true }
      }).onOk(async () => {
        try {
          await quotaClient.deletePolicy(item.id)
          $q.notify({ type: 'positive', message: 'Đã xóa' })
          loadData()
        } catch (e) {
          $q.notify({ type: 'negative', message: e.response?.data?.message || 'Xóa thất bại' })
        }
      })
    }

    onMounted(async () => {
      available.value = await quotaClient.isAvailable()
      if (available.value) { loadData(); loadModels() }
    })

    return {
      available, rows, displayRows, columns, loading, search, filterScopeType, scopeTypeFilterOptions,
      scopeTypes, metrics, periods, modelOptions, dialog, editItem, form, saving, apiError,
      limitValueLabel, scopeBadgeClass, modelLabel, userLabel,
      loadData, openCreate, openEdit, save, toggleEnabled, confirmDelete
    }
  }
})
</script>

<style scoped>
.subject-type-picker { display: flex; gap: 6px; }
.subject-type-btn {
  flex: 1;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px; border-radius: 8px; border: 1.5px solid var(--border-default);
  background: var(--surface-raised); color: var(--text-tertiary); cursor: pointer;
  font-size: 12px; font-weight: 500; transition: all 120ms ease; font-family: var(--font-sans);
  &:hover:not(:disabled) { border-color: var(--brand-primary); color: var(--brand-primary); }
  &--active { border-color: var(--brand-primary); background: var(--brand-primary-subtle); color: var(--brand-primary); font-weight: 600; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
}
</style>