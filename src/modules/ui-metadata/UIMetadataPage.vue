<template>
  <q-page class="page-wrapper" v-if="available === null">
    <div class="surface empty-state" style="padding:60px">
      <q-spinner size="28px" style="color:var(--brand-primary)" />
    </div>
  </q-page>

  <q-page class="page-wrapper" v-else-if="available === false">
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-title">UI Metadata Registry</h1>
        <p class="page-subtitle">GET /ui-metadata — versioned application/page/form/field descriptions</p>
      </div>
    </div>
    <div class="surface empty-state" style="padding:60px">
      <div class="empty-state__icon"><q-icon name="dashboard_customize" /></div>
      <div class="empty-state__title">UI Metadata Registry is not enabled</div>
      <div class="empty-state__desc">This backend environment does not have the v2 UI Metadata Registry feature flag turned on.</div>
    </div>
  </q-page>

  <template v-else>
    <q-page class="page-wrapper">
      <div class="page-header">
        <div class="page-header__left">
          <h1 class="page-title">UI Metadata Registry</h1>
          <p class="page-subtitle">GET /ui-metadata — describes apps/pages/forms/fields; drives dynamic rendering + uiContext</p>
        </div>
        <div class="page-header__actions">
          <button class="btn btn--secondary" @click="loadData">
            <q-icon name="refresh" size="15px" :class="loading && 'spin'" />
          </button>
          <button class="btn btn--primary" @click="openCreate">
            <q-icon name="add" size="15px" />
            New Metadata
          </button>
        </div>
      </div>

      <!-- Breadcrumb trail when drilled into a parent -->
      <div v-if="breadcrumb.length" class="filter-bar" style="margin-bottom:8px">
        <button class="btn btn--ghost btn--sm" @click="goToRoot">
          <q-icon name="home" size="13px" /> Root
        </button>
        <template v-for="(b, i) in breadcrumb" :key="b.code">
          <q-icon name="chevron_right" size="14px" style="color:var(--text-quaternary)" />
          <button class="btn btn--ghost btn--sm" @click="drillTo(i)">{{ b.name || b.code }}</button>
        </template>
      </div>

      <!-- Filter bar -->
      <div class="filter-bar">
        <q-select v-model="filterKind" :options="kindOptions" outlined dense clearable
          emit-value map-options label="kind" style="min-width:200px"
          @update:model-value="loadData" />
        <q-input v-model="search" outlined dense clearable placeholder="Search loaded results…"
          style="min-width:220px">
          <template #prepend><q-icon name="search" size="15px" style="color:var(--text-quaternary)" /></template>
        </q-input>
        <div style="flex:1" />
        <div style="font-size:12px;color:var(--text-tertiary)">
          {{ displayRows.length }} item{{ displayRows.length !== 1 ? 's' : '' }}
        </div>
      </div>

      <div class="surface" style="overflow:hidden">
        <q-table :rows="displayRows" :columns="columns" :loading="loading" row-key="id"
          flat class="eap-table" :pagination="{ rowsPerPage: 20 }">

          <template #body-cell-name="props">
            <q-td :props="props">
              <div style="font-weight:600;font-size:13px;color:var(--text-primary);cursor:pointer"
                @click="openDetail(props.row)">
                {{ props.row.name }}
              </div>
              <div style="margin-top:2px;display:flex;align-items:center;gap:6px">
                <span class="code-tag">{{ props.row.code }}</span>
                <span class="code-tag" style="background:var(--brand-primary-subtle);color:var(--brand-primary)">v{{ props.row.version }}</span>
              </div>
              <div v-if="props.row.description" style="font-size:12px;color:var(--text-tertiary);margin-top:3px">{{ props.row.description }}</div>
            </q-td>
          </template>

          <template #body-cell-kind="props">
            <q-td :props="props">
              <span class="skill-type-badge" :style="kindBadgeStyle(props.value)">{{ props.value }}</span>
            </q-td>
          </template>

          <template #body-cell-status="props">
            <q-td :props="props">
              <span class="badge" :class="props.row.enabled ? 'badge--active' : 'badge--inactive'">{{ props.row.enabled ? 'enabled' : 'disabled' }}</span>
            </q-td>
          </template>

          <template #body-cell-actions="props">
            <q-td :props="props" auto-width>
              <div style="display:flex;align-items:center;gap:2px;justify-content:flex-end">
                <button v-if="hasChildrenKind(props.row.kind)" class="tbl-action-btn" @click="drillInto(props.row)" title="View children">
                  <q-icon name="account_tree" size="15px" style="color:var(--brand-primary)" />
                </button>
                <button class="tbl-action-btn" @click="openDetail(props.row)" title="View / edit payload">
                  <q-icon name="visibility" size="15px" />
                </button>
                <button class="tbl-action-btn" @click="openEdit(props.row)" title="New version (PUT)">
                  <q-icon name="edit" size="15px" />
                </button>
                <div class="tbl-action-divider" />
                <button class="tbl-action-btn tbl-action-btn--danger" @click="confirmDelete(props.row)" title="Delete (soft)">
                  <q-icon name="delete_outline" size="15px" />
                </button>
              </div>
            </q-td>
          </template>

          <template #no-data>
            <div class="empty-state" style="width:100%;padding:60px">
              <div class="empty-state__icon"><q-icon name="dashboard_customize" /></div>
              <div class="empty-state__title">No UI metadata {{ breadcrumb.length ? 'under this parent' : 'yet' }}</div>
              <div class="empty-state__desc">Register an APPLICATION or PAGE to start describing your UI as versioned metadata.</div>
              <button class="btn btn--primary" @click="openCreate">
                <q-icon name="add" size="15px" />New Metadata
              </button>
            </div>
          </template>
        </q-table>
      </div>
    </q-page>

    <!-- ============ CREATE / NEW VERSION DIALOG ============ -->
    <BaseFormDialog v-model="formDialog"
      :title="editItem ? `New Version — ${editItem.code}` : 'New UI Metadata'"
      :subtitle="editItem ? `PUT /ui-metadata/${editItem.id} — creates a new version, does not mutate in place` : 'POST /ui-metadata — version auto-starts at 1'"
      icon="dashboard_customize" icon-color="#6366f1"
      confirm-label="Save" :loading="saving" width="680px"
      @confirm="save">
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="row q-col-gutter-md">
          <div class="col-6">
            <label class="field-label">code <span style="color:var(--brand-danger)">*</span></label>
            <q-input v-model="form.code" outlined dense placeholder="leave-request-form"
              :disable="!!editItem"
              :hint="editItem ? 'Immutable — inherited from previous version' : 'pattern: ^[a-z0-9][a-z0-9\\-_.]*$'" />
          </div>
          <div class="col-6">
            <label class="field-label">kind <span style="color:var(--brand-danger)">*</span></label>
            <q-select v-model="form.kind" :options="kindOptionsRaw" outlined dense :disable="!!editItem" />
          </div>
        </div>

        <div>
          <label class="field-label">name <span style="color:var(--brand-danger)">*</span></label>
          <q-input v-model="form.name" outlined dense placeholder="Leave Request Form" />
        </div>

        <div>
          <label class="field-label">description</label>
          <q-input v-model="form.description" outlined dense type="textarea" :rows="2" />
        </div>

        <div>
          <label class="field-label">
            parent_code <span style="color:var(--text-quaternary)">(optional)</span>
          </label>
          <q-input v-model="form.parent_code" outlined dense placeholder="hr-leave-page"
            :disable="!!editItem"
            hint="e.g. a FORM's parent_code points at its PAGE" />
        </div>

        <div>
          <label class="field-label">schema_version <span style="color:var(--text-quaternary)">(optional)</span></label>
          <q-input v-model="form.schema_version" outlined dense placeholder="1.0" />
        </div>

        <div>
          <label class="field-label">
            payload (JSON) <span style="color:var(--brand-danger)">*</span>
            <span style="font-weight:400;color:var(--text-quaternary);margin-left:4px">
              PUT replaces payload wholesale — send the full object, not a delta
            </span>
          </label>
          <textarea v-model="payloadText" class="json-textarea" rows="10"
            placeholder='{
  "fields": [
    { "code": "reason", "label": "Reason", "type": "string", "required": false }
  ],
  "submitButtonCode": "leave.submit"
}' />
          <div v-if="payloadError" style="font-size:11px;color:var(--brand-danger);margin-top:4px">{{ payloadError }}</div>
        </div>

        <div class="row items-center">
          <q-toggle v-model="form.enabled" color="primary" />
          <span style="font-size:13px;color:var(--text-primary);margin-left:4px">Enabled</span>
        </div>

        <div v-if="apiError" class="api-error-box">
          <q-icon name="error_outline" size="16px" />{{ apiError }}
        </div>
      </div>
    </BaseFormDialog>

    <!-- ============ DETAIL / VERSION VIEW DIALOG ============ -->
    <q-dialog v-model="detailDialog" style="max-width:760px">
      <q-card v-if="detailItem" style="width:760px;max-width:96vw;border-radius:12px">
        <div class="dialog-header">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="dialog-header__icon" style="background:#6366f1">
              <q-icon name="dashboard_customize" size="16px" style="color:white" />
            </div>
            <div>
              <div class="dialog-header__title">{{ detailItem.name }}</div>
              <div class="dialog-header__subtitle">
                <span class="code-tag">{{ detailItem.code }}</span>
                <span class="code-tag" style="margin-left:6px">{{ detailItem.kind }}</span>
                <span class="code-tag" style="margin-left:6px">v{{ detailItem.version }}</span>
              </div>
            </div>
          </div>
          <button class="dialog-header__close" @click="detailDialog=false"><q-icon name="close" size="18px" /></button>
        </div>

        <div style="max-height:480px;overflow-y:auto;padding:16px">
          <div v-if="detailItem.parent_code" class="hint-card" style="margin-bottom:12px">
            <q-icon name="account_tree" size="16px" color="grey-6" />
            parent_code: <span class="code-tag" style="margin-left:4px">{{ detailItem.parent_code }}</span>
          </div>
          <label class="field-label" style="margin-bottom:6px;display:block">payload</label>
          <pre class="code-block" style="font-size:12px">{{ JSON.stringify(detailItem.payload, null, 2) }}</pre>
        </div>

        <div class="dialog-footer">
          <button class="btn btn--secondary" @click="detailDialog=false">Close</button>
          <button class="btn btn--primary" @click="detailDialog=false; openEdit(detailItem)">
            <q-icon name="edit" size="14px" />New Version
          </button>
        </div>
      </q-card>
    </q-dialog>
  </template>
</template>

<script>
import { defineComponent, ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { uiMetadataClient, UI_METADATA_KINDS, CODE_PATTERN } from '../../services/api/ui-metadata.client.js'
import { useUIStore } from '../../stores/ui.store.js'
import BaseFormDialog from '../../shared/components/BaseFormDialog.vue'

// Kinds that plausibly have children under them (drill-down affordance).
// Purely a UX nicety — parent_code linking works for any kind.
const PARENT_KINDS = ['APPLICATION', 'PAGE', 'FORM', 'GRID', 'DIALOG']

export default defineComponent({
  name: 'UIMetadataPage',
  components: { BaseFormDialog },
  setup() {
    const $q = useQuasar()
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'UI Metadata' }])

    const available = ref(null)
    const rows = ref([]), loading = ref(false), search = ref('')
    const filterKind = ref(null)
    const breadcrumb = ref([]) // [{code, name}] drill-down trail

    const kindOptionsRaw = UI_METADATA_KINDS
    const kindOptions = [{ label: 'All kinds', value: null }, ...UI_METADATA_KINDS.map(k => ({ label: k, value: k }))]

    const columns = [
      { name: 'name', label: 'Name / Code', field: 'name', align: 'left', sortable: true },
      { name: 'kind', label: 'Kind', field: 'kind', align: 'left' },
      { name: 'status', label: 'Status', field: 'enabled', align: 'left' },
      { name: 'actions', label: '', field: 'actions', align: 'right' }
    ]

    const KIND_COLORS = {
      APPLICATION: '#6366f1', PAGE: '#3b82f6', FORM: '#8b5cf6', DIALOG: '#f59e0b',
      GRID: '#14b8a6', BUSINESS_OBJECT: '#ec4899', FIELD: '#6b7280', VALIDATION_RULE: '#ef4444',
      LOOKUP: '#0ea5e9', BUSINESS_RULE: '#d97706', COMPONENT: '#84cc16', PERMISSION: '#dc2626', EVENT: '#a855f7'
    }
    function kindBadgeStyle(kind) {
      const c = KIND_COLORS[kind] || '#6b7280'
      return `background:${c}18;color:${c}`
    }
    function hasChildrenKind(kind) { return PARENT_KINDS.includes(kind) }

    const displayRows = computed(() => {
      const q = search.value.trim().toLowerCase()
      if (!q) return rows.value
      return rows.value.filter(r =>
        r.name?.toLowerCase().includes(q) ||
        r.code?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
      )
    })

    async function loadData() {
      loading.value = true
      try {
        const parentCode = breadcrumb.value.length ? breadcrumb.value[breadcrumb.value.length - 1].code : undefined
        // Per client note: parent_code takes priority server-side over kind —
        // only send kind when we're not drilled into a parent.
        const params = parentCode ? { parent_code: parentCode, page_size: 200 } : { kind: filterKind.value || undefined, page_size: 200 }
        const res = await uiMetadataClient.list(params)
        rows.value = res.items || []
      } catch (e) {
        if (e.response?.status === 404) { available.value = false; return }
        $q.notify({ type: 'negative', message: 'Failed to load UI metadata' })
      } finally { loading.value = false }
    }

    function drillInto(row) {
      breadcrumb.value.push({ code: row.code, name: row.name })
      filterKind.value = null
      loadData()
    }
    function drillTo(i) {
      breadcrumb.value = breadcrumb.value.slice(0, i + 1)
      loadData()
    }
    function goToRoot() {
      breadcrumb.value = []
      loadData()
    }

    // ===== Create / New Version =====
    const formDialog = ref(false), saving = ref(false), apiError = ref(''), payloadError = ref('')
    const editItem = ref(null)
    const defaultForm = () => ({
      code: '', kind: 'PAGE', name: '', description: '',
      parent_code: '', schema_version: '', enabled: true
    })
    const form = ref(defaultForm())
    const payloadText = ref('{}')

    function openCreate() {
      editItem.value = null; apiError.value = ''; payloadError.value = ''
      form.value = defaultForm()
      if (breadcrumb.value.length) form.value.parent_code = breadcrumb.value[breadcrumb.value.length - 1].code
      payloadText.value = '{}'
      formDialog.value = true
    }

    function openEdit(item) {
      editItem.value = item; apiError.value = ''; payloadError.value = ''
      form.value = {
        code: item.code, kind: item.kind, name: item.name, description: item.description || '',
        parent_code: item.parent_code || '', schema_version: item.schema_version || '', enabled: item.enabled ?? true
      }
      payloadText.value = JSON.stringify(item.payload || {}, null, 2)
      formDialog.value = true
    }

    async function save() {
      apiError.value = ''; payloadError.value = ''

      if (!editItem.value && !CODE_PATTERN.test(form.value.code || '')) {
        apiError.value = 'code must match ^[a-z0-9][a-z0-9\\-_.]*$ (lowercase, digits, - _ . only)'
        return
      }
      if (!form.value.name) { apiError.value = 'name is required'; return }

      let payload
      try { payload = JSON.parse(payloadText.value || '{}') }
      catch { payloadError.value = 'payload is not valid JSON'; return }

      saving.value = true
      try {
        if (editItem.value) {
          // PUT — code/kind immutable, payload replaced wholesale
          await uiMetadataClient.update(editItem.value.id, {
            name: form.value.name,
            description: form.value.description || undefined,
            parent_code: form.value.parent_code || undefined,
            payload,
            schema_version: form.value.schema_version || undefined,
            enabled: form.value.enabled
          })
          $q.notify({ type: 'positive', message: `New version created for "${editItem.value.code}"` })
        } else {
          await uiMetadataClient.create({
            code: form.value.code,
            kind: form.value.kind,
            name: form.value.name,
            description: form.value.description || undefined,
            parent_code: form.value.parent_code || undefined,
            payload,
            schema_version: form.value.schema_version || undefined,
            enabled: form.value.enabled
          })
          $q.notify({ type: 'positive', message: `"${form.value.code}" created` })
        }
        formDialog.value = false
        loadData()
      } catch (e) {
        const d = e.response?.data
        apiError.value = d?.message || (e.response?.status === 422 ? 'Validation failed (422)' : 'Save failed')
      } finally { saving.value = false }
    }

    // ===== Detail =====
    const detailDialog = ref(false), detailItem = ref(null)
    function openDetail(row) { detailItem.value = row; detailDialog.value = true }

    function confirmDelete(item) {
      $q.dialog({
        title: 'Delete UI Metadata',
        message: `Soft-delete <strong>${item.name}</strong> (v${item.version})? It drops out of listings but remains fetchable by id.`,
        html: true,
        cancel: { label: 'Cancel', flat: true },
        ok: { label: 'Delete', color: 'negative', unelevated: true }
      }).onOk(async () => {
        try {
          await uiMetadataClient.remove(item.id)
          $q.notify({ type: 'positive', message: 'Deleted' })
          loadData()
        } catch (e) { $q.notify({ type: 'negative', message: e.response?.data?.message || 'Delete failed' }) }
      })
    }

    onMounted(async () => {
      available.value = await uiMetadataClient.isAvailable()
      if (available.value) loadData()
    })

    return {
      available, rows, displayRows, columns, loading, search, filterKind, kindOptions, kindOptionsRaw,
      breadcrumb, drillInto, drillTo, goToRoot, hasChildrenKind, kindBadgeStyle,
      formDialog, saving, apiError, payloadError, editItem, form, payloadText,
      openCreate, openEdit, save, loadData,
      detailDialog, detailItem, openDetail, confirmDelete
    }
  }
})
</script>

<style lang="scss">
.json-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
  resize: vertical;
  outline: none;
  background: var(--surface-base);
  color: var(--text-primary);
  &:focus { border-color: var(--brand-primary); box-shadow: var(--shadow-focus); }
}
</style>