<template>
  <q-page class="page-wrapper" v-if="available === null">
    <!-- Feature-flag probe in flight -->
    <div class="surface empty-state" style="padding:60px">
      <q-spinner size="28px" style="color:var(--brand-primary)" />
    </div>
  </q-page>

  <q-page class="page-wrapper" v-else-if="available === false">
    <!-- Backend flag is OFF here — degrade gracefully, no error -->
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-title">Business Objects</h1>
        <p class="page-subtitle">GET /business-objects — Business Object Registry (v2)</p>
      </div>
    </div>
    <div class="surface empty-state" style="padding:60px">
      <div class="empty-state__icon"><q-icon name="schema" /></div>
      <div class="empty-state__title">Business Object Registry is not enabled</div>
      <div class="empty-state__desc">This backend environment does not have the v2 Business Object Registry feature flag turned on. Nothing to do here — check back once it's enabled.</div>
    </div>
  </q-page>

  <template v-else>
    <BaseCrudPage
      title="Business Objects"
      subtitle="GET /business-objects — versioned entity descriptions (fields, relationships, validation)"
      entity-name="Business Object"
      :rows="displayRows"
      :columns="columns"
      :loading="loading"
      :pagination="pagination"
      :show-create="true"
      @create="openCreate"
      @edit="openEdit"
      @view="openDetail"
      @delete="confirmDelete"
      @refresh="loadData"
      @search="onSearch"
      @page-change="onPageChange"
    >
      <template #filters>
        <div class="col-auto" style="font-size:11px;color:var(--text-quaternary);align-self:center">
          <q-icon name="info" size="12px" style="margin-right:3px" />
          Search filters the loaded page only — GET /business-objects has no server-side search param
        </div>
      </template>

      <template #body-cell-name="props">
        <q-td :props="props">
          <div style="font-weight:600;font-size:13px;color:var(--text-primary);cursor:pointer" @click="openDetail(props.row)">
            {{ props.row.name }}
          </div>
          <div style="margin-top:2px;display:flex;align-items:center;gap:6px">
            <span class="code-tag">{{ props.row.code }}</span>
            <span class="code-tag" style="background:var(--brand-primary-subtle);color:var(--brand-primary)">v{{ props.row.version }}</span>
          </div>
          <div v-if="props.row.description" style="font-size:12px;color:var(--text-tertiary);margin-top:3px">{{ props.row.description }}</div>
        </q-td>
      </template>

      <template #body-cell-fields="props">
        <q-td :props="props">
          <div style="display:flex;flex-wrap:wrap;gap:4px;max-width:280px">
            <span v-for="f in (props.row.payload?.fields || []).slice(0,4)" :key="f.name" class="code-tag">{{ f.name }}</span>
            <span v-if="(props.row.payload?.fields || []).length > 4" class="code-tag" style="opacity:0.6">
              +{{ props.row.payload.fields.length - 4 }}
            </span>
            <span v-if="!(props.row.payload?.fields || []).length" style="color:var(--text-quaternary);font-size:12px">—</span>
          </div>
        </q-td>
      </template>

      <template #body-cell-status="props">
        <q-td :props="props">
          <span class="badge" :class="props.row.enabled ? 'badge--active' : 'badge--inactive'">{{ props.row.enabled ? 'enabled' : 'disabled' }}</span>
        </q-td>
      </template>

      <!-- List actions: view + edit (creates a new version via PUT) -->
      <template #body-cell-actions="props">
        <q-td :props="props" auto-width>
          <div style="display:flex;align-items:center;gap:2px;justify-content:flex-end">
            <button class="tbl-action-btn" @click="openDetail(props.row)" title="View">
              <q-icon name="visibility" size="15px" />
            </button>
            <button class="tbl-action-btn" @click="openEdit(props.row)" title="Edit (creates a new version)">
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

    <!-- Detail dialog — read-only, shows fields / relationships / validation -->
    <q-dialog v-model="detailDialog" style="max-width:720px">
      <q-card v-if="detailItem" style="width:720px;max-width:96vw;border-radius:12px">
        <div class="dialog-header">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="dialog-header__icon" style="background:#6366f1">
              <q-icon name="schema" size="16px" style="color:white" />
            </div>
            <div>
              <div class="dialog-header__title">{{ detailItem.name }}</div>
              <div class="dialog-header__subtitle">
                <span class="code-tag">{{ detailItem.code }}</span>
                <span class="code-tag" style="margin-left:6px">v{{ detailItem.version }}</span>
              </div>
            </div>
          </div>
          <button class="dialog-header__close" @click="detailDialog=false">
            <q-icon name="close" size="18px" />
          </button>
        </div>

        <div v-if="loadingDetail" class="empty-state" style="padding:48px">
          <q-spinner size="28px" style="color:var(--brand-primary)" />
        </div>

        <template v-else>
          <q-tabs v-model="detailTab" dense align="left" style="border-bottom:1px solid var(--border-subtle);padding:0 16px">
            <q-tab name="fields" label="Fields" icon="list" />
            <q-tab name="relationships" label="Relationships" icon="hub" />
            <q-tab name="validation" label="Validation" icon="rule" />
          </q-tabs>

          <div style="max-height:420px;overflow-y:auto;padding:16px">
            <!-- businessMeaning banner, if present -->
            <div v-if="detailItem.payload?.businessMeaning" class="hint-card" style="margin-bottom:14px">
              <q-icon name="info" size="16px" color="grey-6" />
              {{ detailItem.payload.businessMeaning }}
            </div>

            <!-- FIELDS -->
            <div v-show="detailTab==='fields'">
              <div v-if="!(detailItem.payload?.fields || []).length" class="empty-state" style="padding:32px">
                <div class="empty-state__title">No fields defined</div>
              </div>
              <div v-for="f in detailItem.payload?.fields || []" :key="f.name" class="bo-field-row">
                <div style="flex:1;min-width:0">
                  <div style="display:flex;align-items:center;gap:6px">
                    <span style="font-size:13px;font-weight:600;color:var(--text-primary)">{{ f.name }}</span>
                    <span v-if="f.required" class="code-tag" style="font-size:9px;color:var(--brand-danger)">required</span>
                  </div>
                  <div v-if="f.description" style="font-size:11px;color:var(--text-tertiary);margin-top:2px">{{ f.description }}</div>
                  <div v-if="f.type === 'reference' && f.referenceObjectCode" style="font-size:11px;color:var(--text-tertiary);margin-top:2px">
                    references <span class="code-tag" style="font-size:10px">{{ f.referenceObjectCode }}</span>
                  </div>
                  <div v-if="f.type === 'enum' && f.enumValues?.length" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">
                    <span v-for="v in f.enumValues" :key="v" class="code-tag" style="font-size:10px">{{ v }}</span>
                  </div>
                </div>
                <span class="code-tag" style="flex-shrink:0">{{ f.type }}</span>
              </div>
            </div>

            <!-- RELATIONSHIPS -->
            <div v-show="detailTab==='relationships'">
              <div v-if="!(detailItem.payload?.relationships || []).length" class="empty-state" style="padding:32px">
                <div class="empty-state__title">No relationships defined</div>
              </div>
              <div v-for="r in detailItem.payload?.relationships || []" :key="r.name" class="bo-field-row">
                <div style="flex:1;min-width:0">
                  <div style="font-size:13px;font-weight:600;color:var(--text-primary)">{{ r.name }}</div>
                  <div style="font-size:11px;color:var(--text-tertiary);margin-top:2px">
                    → <span class="code-tag" style="font-size:10px">{{ r.targetObjectCode }}</span>
                  </div>
                </div>
                <span class="code-tag" style="flex-shrink:0">{{ r.cardinality }}</span>
              </div>
            </div>

            <!-- VALIDATION -->
            <div v-show="detailTab==='validation'">
              <div v-if="!(detailItem.payload?.validation || []).length" class="empty-state" style="padding:32px">
                <div class="empty-state__title">No validation rules defined</div>
              </div>
              <div v-for="(v, i) in detailItem.payload?.validation || []" :key="i" class="bo-field-row" style="align-items:flex-start">
                <div style="flex:1;min-width:0">
                  <code class="code-tag" style="display:block;width:fit-content;font-size:11px">{{ v.rule }}</code>
                  <div style="font-size:12px;color:var(--text-secondary);margin-top:6px">{{ v.message }}</div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <div class="dialog-footer">
          <button class="btn btn--secondary" style="border-color:var(--status-error-text);color:var(--status-error-text)"
            @click="detailDialog=false; confirmDelete(detailItem)">
            <q-icon name="delete_outline" size="15px" />Delete
          </button>
          <div style="flex:1" />
          <button class="btn btn--secondary" @click="detailDialog=false">Close</button>
          <button class="btn btn--primary" @click="detailDialog=false; openEdit(detailItem)">
            <q-icon name="edit" size="15px" />Edit (new version)
          </button>
        </div>
      </q-card>
    </q-dialog>

    <!-- ============ CREATE / EDIT DIALOG ============ -->
    <BaseFormDialog
      v-model="formDialog"
      :title="editItem ? `Edit Business Object — ${editItem.code}` : 'Create Business Object'"
      :subtitle="editItem ? `PUT /business-objects/${editItem.id} — creates a new version (v${(editItem.version||1)+1}); send the FULL payload, not a delta` : 'POST /business-objects — version auto-assigned, starts at 1'"
      icon="schema" icon-color="#6366f1"
      :confirm-label="editItem ? 'Save new version' : 'Create'" :loading="saving" width="760px"
      @confirm="save"
    >
      <div v-if="loadingEditPayload" class="empty-state" style="padding:32px">
        <q-spinner size="24px" style="color:var(--brand-primary)" />
      </div>
      <div v-else style="display:flex;flex-direction:column;gap:16px">
        <!-- Identity -->
        <div class="row q-col-gutter-md">
          <div class="col-5">
            <label class="field-label">code <span style="color:var(--brand-danger)">*</span></label>
            <q-input v-model="form.code" outlined dense placeholder="leave_request"
              :disable="!!editItem"
              :hint="editItem ? 'Immutable — inherited from previous version' : 'pattern: ^[a-z0-9][a-z0-9\-_.]*$ — lowercase, digits, - _ . only'" />
          </div>
          <div class="col-7">
            <label class="field-label">name <span style="color:var(--brand-danger)">*</span></label>
            <q-input v-model="form.name" outlined dense placeholder="Leave Request" />
          </div>
        </div>

        <div>
          <label class="field-label">description</label>
          <q-input v-model="form.description" outlined dense type="textarea" :rows="2"
            placeholder="An employee's request for time off" />
        </div>

        <!-- ===== FIELDS builder ===== -->
        <div class="form-section" style="margin-bottom:0">
          <div class="bo-builder-head">
            <span class="bo-builder-head__title">Fields</span>
            <button class="btn btn--secondary btn--sm" @click="addField">
              <q-icon name="add" size="13px" /> Add field
            </button>
          </div>

          <div v-for="(f, i) in form.fields" :key="i" class="bo-builder-row">
            <div style="width:100%">
              <div class="row q-col-gutter-sm items-start">
                <div class="col-3">
                  <q-input v-model="f.name" outlined dense placeholder="name" label="field name" />
                </div>
                <div class="col-3">
                  <q-select v-model="f.type" outlined dense use-input new-value-mode="add-unique"
                    :options="fieldTypeOptions" label="type"
                    hint="pick or type a custom type" />
                </div>
                <div class="col-2" style="padding-top:22px">
                  <q-toggle v-model="f.required" dense label="required" />
                </div>
                <!-- Type-specific extra field: reference -> referenceObjectCode, enum -> enumValues.
                     These no longer hide the description box below — a reference
                     field can (and usually should) still have its own description. -->
                <div class="col-4">
                  <q-input v-if="f.type === 'reference'" v-model="f.referenceObjectCode" outlined dense
                    placeholder="employee" label="referenceObjectCode" />
                  <q-input v-else-if="f.type === 'enum'" v-model="f.enumValuesText" outlined dense
                    placeholder="pending,approved,rejected" label="enumValues (comma-separated)" />
                  <div v-else style="height:40px" />
                </div>
                <div class="col-12">
                  <q-input v-model="f.description" outlined dense placeholder="description (optional)" label="description" />
                </div>
                <div class="col-12" style="text-align:right">
                  <button class="btn btn--ghost btn--sm" @click="removeField(i)" title="Remove field">
                    <q-icon name="remove_circle_outline" size="15px" style="color:var(--brand-danger)" />
                    Remove field
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div v-if="!form.fields.length" class="bo-builder-empty">No fields yet — click "Add field"</div>
        </div>

        <!-- ===== RELATIONSHIPS builder ===== -->
        <div class="form-section" style="margin-bottom:0">
          <div class="bo-builder-head">
            <span class="bo-builder-head__title">Relationships</span>
            <button class="btn btn--secondary btn--sm" @click="addRelationship">
              <q-icon name="add" size="13px" /> Add relationship
            </button>
          </div>

          <div v-for="(r, i) in form.relationships" :key="i" class="bo-builder-row">
            <div class="row q-col-gutter-sm items-start" style="width:100%">
              <div class="col-4">
                <q-input v-model="r.name" outlined dense placeholder="employee" label="name" />
              </div>
              <div class="col-4">
                <q-input v-model="r.targetObjectCode" outlined dense placeholder="employee" label="targetObjectCode" />
              </div>
              <div class="col-3">
                <q-select v-model="r.cardinality" outlined dense :options="cardinalityOptions" label="cardinality" />
              </div>
              <div class="col-1" style="padding-top:22px">
                <button class="btn btn--ghost btn--sm btn--icon" @click="removeRelationship(i)" title="Remove relationship">
                  <q-icon name="remove_circle_outline" size="16px" style="color:var(--brand-danger)" />
                </button>
              </div>
            </div>
          </div>
          <div v-if="!form.relationships.length" class="bo-builder-empty">No relationships yet</div>
        </div>

        <!-- ===== VALIDATION builder ===== -->
        <div class="form-section" style="margin-bottom:0">
          <div class="bo-builder-head">
            <span class="bo-builder-head__title">Validation rules</span>
            <button class="btn btn--secondary btn--sm" @click="addValidation">
              <q-icon name="add" size="13px" /> Add rule
            </button>
          </div>

          <div v-for="(v, i) in form.validation" :key="i" class="bo-builder-row">
            <div class="row q-col-gutter-sm items-start" style="width:100%">
              <div class="col-5">
                <q-input v-model="v.rule" outlined dense placeholder="days > 0" label="rule" class="font-mono" />
              </div>
              <div class="col-6">
                <q-input v-model="v.message" outlined dense placeholder="Days must be positive" label="message" />
              </div>
              <div class="col-1" style="padding-top:22px">
                <button class="btn btn--ghost btn--sm btn--icon" @click="removeValidation(i)" title="Remove rule">
                  <q-icon name="remove_circle_outline" size="16px" style="color:var(--brand-danger)" />
                </button>
              </div>
            </div>
          </div>
          <div v-if="!form.validation.length" class="bo-builder-empty">No validation rules yet</div>
        </div>

        <!-- businessMeaning -->
        <div>
          <label class="field-label">businessMeaning <span style="color:var(--text-quaternary)">(optional)</span></label>
          <q-input v-model="form.businessMeaning" outlined dense type="textarea" :rows="2"
            placeholder="Represents a request submitted by an employee for approved time off." />
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
  </template>
</template>

<script>
import { defineComponent, ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { businessObjectsClient, CODE_PATTERN } from '../../services/api/business-objects.client.js'
import { useUIStore } from '../../stores/ui.store.js'
import BaseCrudPage from '../../shared/components/BaseCrudPage.vue'
import BaseFormDialog from '../../shared/components/BaseFormDialog.vue'

export default defineComponent({
  name: 'BusinessObjectsPage',
  components: { BaseCrudPage, BaseFormDialog },
  setup() {
    const $q = useQuasar()
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'Business Objects' }])

    // null = probing, true/false = resolved. Gate the entire surface on this
    // so a disabled backend flag renders as an explanatory empty-state, not
    // a broken table or console error.
    const available = ref(null)

    const rows = ref([]), loading = ref(false), search = ref('')
    // GET /business-objects only accepts page/page_size (confirmed by the
    // detailed API reference — no search/filter param exists server-side),
    // so we fetch a generous page and filter client-side. 100 keeps this a
    // single request for realistic registry sizes while staying well under
    // the documented max page_size of 200.
    const pagination = ref({ page: 1, rowsPerPage: 100, rowsNumber: 0 })

    const columns = [
      { name: 'name', label: 'Name / Code', field: 'name', align: 'left', sortable: true },
      { name: 'fields', label: 'Fields', field: 'fields', align: 'left' },
      { name: 'status', label: 'Status', field: 'enabled', align: 'left' },
      { name: 'actions', label: '', field: 'actions', align: 'right' }
    ]

    // Client-side filter over the currently-loaded page — see note above
    // and the on-screen hint in the #filters slot.
    const displayRows = computed(() => {
      const q = search.value.trim().toLowerCase()
      if (!q) return rows.value
      return rows.value.filter(r =>
        r.name?.toLowerCase().includes(q) ||
        r.code?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
      )
    })

    const detailDialog = ref(false), detailItem = ref(null), loadingDetail = ref(false), detailTab = ref('fields')

    // ===== CREATE / EDIT dialog state =====
    const formDialog = ref(false), saving = ref(false), apiError = ref('')
    // editItem !== null  => editing (PUT, new version). editItem === null => creating (POST).
    const editItem = ref(null)
    const loadingEditPayload = ref(false)

    const fieldTypeOptions = ['string', 'number', 'date', 'boolean', 'enum', 'reference']
    const cardinalityOptions = ['one-to-one', 'one-to-many', 'many-to-one', 'many-to-many']

    function defaultForm() {
      return {
        code: '', name: '', description: '',
        fields: [], relationships: [], validation: [],
        businessMeaning: '', enabled: true
      }
    }
    const form = ref(defaultForm())

    function addField() {
      form.value.fields.push({ name: '', type: 'string', required: false, description: '', enumValuesText: '', referenceObjectCode: '' })
    }
    function removeField(i) { form.value.fields.splice(i, 1) }

    function addRelationship() {
      form.value.relationships.push({ name: '', targetObjectCode: '', cardinality: 'many-to-one' })
    }
    function removeRelationship(i) { form.value.relationships.splice(i, 1) }

    function addValidation() {
      form.value.validation.push({ rule: '', message: '' })
    }
    function removeValidation(i) { form.value.validation.splice(i, 1) }

    function openCreate() {
      editItem.value = null
      form.value = defaultForm()
      apiError.value = ''
      formDialog.value = true
    }

    // Populate the same dialog/form from an existing row for editing.
    // We always re-fetch the LATEST version by code first — the row passed
    // in (e.g. from a stale list snapshot or the read-only detail view)
    // might not be the current version, and PUT must be issued against the
    // most recent id to avoid silently branching off an old version.
    async function openEdit(row) {
      apiError.value = ''
      formDialog.value = true
      loadingEditPayload.value = true
      try {
        const latest = (await businessObjectsClient.getLatestByCode(row.code)) || row
        editItem.value = latest
        const payload = latest.payload || {}
        form.value = {
          code: latest.code,
          name: latest.name,
          description: latest.description || '',
          fields: (payload.fields || []).map(f => ({
            name: f.name || '',
            type: f.type || 'string',
            required: !!f.required,
            description: f.description || '',
            enumValuesText: (f.enumValues || []).join(','),
            referenceObjectCode: f.referenceObjectCode || ''
          })),
          relationships: (payload.relationships || []).map(r => ({
            name: r.name || '', targetObjectCode: r.targetObjectCode || '', cardinality: r.cardinality || 'many-to-one'
          })),
          validation: (payload.validation || []).map(v => ({ rule: v.rule || '', message: v.message || '' })),
          businessMeaning: payload.businessMeaning || '',
          enabled: latest.enabled ?? true
        }
      } catch (e) {
        apiError.value = e.response?.data?.message || 'Failed to load latest version for editing'
      } finally {
        loadingEditPayload.value = false
      }
    }

    async function save() {
      apiError.value = ''

      if (!form.value.name) {
        apiError.value = 'name is required'
        return
      }
      if (!editItem.value) {
        // Only validate/send code on create — it's immutable afterwards.
        if (!form.value.code) { apiError.value = 'code is required'; return }
        if (!CODE_PATTERN.test(form.value.code)) {
          apiError.value = 'code must match ^[a-z0-9][a-z0-9\\-_.]*$ (lowercase, digits, - _ . only)'
          return
        }
      }

      const cleanFields = form.value.fields
        .filter(f => f.name && f.type)
        .map(f => {
          const out = { name: f.name, type: f.type, required: !!f.required }
          if (f.description) out.description = f.description
          if (f.type === 'enum' && f.enumValuesText) {
            out.enumValues = f.enumValuesText.split(',').map(s => s.trim()).filter(Boolean)
          }
          if (f.type === 'reference' && f.referenceObjectCode) {
            out.referenceObjectCode = f.referenceObjectCode
          }
          return out
        })
      const cleanRelationships = form.value.relationships
        .filter(r => r.name && r.targetObjectCode)
        .map(r => ({ name: r.name, targetObjectCode: r.targetObjectCode, cardinality: r.cardinality || 'many-to-one' }))
      const cleanValidation = form.value.validation
        .filter(v => v.rule)
        .map(v => ({ rule: v.rule, message: v.message || '' }))

      saving.value = true
      try {
        if (editItem.value) {
          // PUT /business-objects/{id} — creates a NEW version. payload is
          // replaced wholesale server-side, so always send the complete
          // object (fields + relationships + validation + businessMeaning),
          // never a partial delta — see business-objects.client.js note.
          await businessObjectsClient.update(editItem.value.id, {
            name: form.value.name,
            description: form.value.description || undefined,
            payload: {
              fields: cleanFields,
              relationships: cleanRelationships,
              validation: cleanValidation,
              businessMeaning: form.value.businessMeaning || undefined
            },
            enabled: form.value.enabled
          })
          $q.notify({ type: 'positive', message: `New version created for "${form.value.code}"` })
        } else {
          await businessObjectsClient.create({
            code: form.value.code,
            name: form.value.name,
            description: form.value.description || undefined,
            payload: {
              fields: cleanFields,
              relationships: cleanRelationships,
              validation: cleanValidation,
              businessMeaning: form.value.businessMeaning || undefined
            },
            enabled: form.value.enabled
          })
          $q.notify({ type: 'positive', message: `Business object "${form.value.code}" created` })
        }
        formDialog.value = false
        editItem.value = null
        pagination.value.page = 1
        loadData()
      } catch (e) {
        const d = e.response?.data
        apiError.value = d?.error_code === 'validation_failed'
          ? (d?.message || 'Validation failed (422) — check required fields and code pattern')
          : (d?.message || 'Save failed')
      } finally { saving.value = false }
    }

    async function loadData() {
      loading.value = true
      try {
        const res = await businessObjectsClient.list({
          page: pagination.value.page,
          page_size: pagination.value.rowsPerPage
        })
        rows.value = res.items || []
        pagination.value.rowsNumber = res.total ?? rows.value.length
      } catch (e) {
        // Shouldn't normally hit here since availability was already probed,
        // but stay defensive — a mid-session flag flip shouldn't crash the page.
        if (e.response?.status === 404) { available.value = false; return }
        $q.notify({ type: 'negative', message: 'Failed to load business objects' })
      } finally { loading.value = false }
    }

    // Purely client-side — does NOT refetch, since there's nothing server-side to ask for.
    function onSearch(q) { search.value = q || '' }

    function onPageChange(reqProp) {
      pagination.value.page = reqProp.pagination.page
      pagination.value.rowsPerPage = reqProp.pagination.rowsPerPage
      loadData()
    }

    // Soft delete — DELETE /business-objects/{id}. Always resolve to the
    // LATEST version's id first (same as edit), so deleting from a stale
    // list snapshot never targets an old, already-superseded version.
    function confirmDelete(row) {
      $q.dialog({
        title: 'Delete Business Object',
        message: `Delete <strong>${row.name}</strong> (<code>${row.code}</code>)? This is a soft delete — the record is kept for history but disappears from listings.`,
        html: true,
        cancel: { label: 'Cancel', flat: true },
        ok: { label: 'Delete', color: 'negative', unelevated: true }
      }).onOk(async () => {
        try {
          const latest = (await businessObjectsClient.getLatestByCode(row.code)) || row
          await businessObjectsClient.remove(latest.id)
          $q.notify({ type: 'positive', message: `"${row.code}" deleted` })
          if (detailItem.value?.code === row.code) detailDialog.value = false
          loadData()
        } catch (e) {
          $q.notify({ type: 'negative', message: e.response?.data?.message || 'Delete failed' })
        }
      })
    }

    async function openDetail(row) {
      detailItem.value = row
      detailDialog.value = true
      detailTab.value = 'fields'
      loadingDetail.value = true
      try {
        // Always resolve to the LATEST version by code for the detail view,
        // even if the row in the list table came from a paginated snapshot.
        const latest = await businessObjectsClient.getLatestByCode(row.code)
        if (latest) detailItem.value = latest
      } catch {
        // keep the list-row data as a fallback; not worth a hard error for a read-only view
      } finally { loadingDetail.value = false }
    }

    onMounted(async () => {
      available.value = await businessObjectsClient.isAvailable()
      if (available.value) loadData()
    })

    return {
      available, rows, displayRows, columns, loading, pagination,
      detailDialog, detailItem, loadingDetail, detailTab,
      formDialog, saving, apiError, editItem, loadingEditPayload, form, fieldTypeOptions, cardinalityOptions,
      addField, removeField, addRelationship, removeRelationship, addValidation, removeValidation,
      openCreate, openEdit, save, confirmDelete,
      loadData, onSearch, onPageChange, openDetail
    }
  }
})
</script>

<style lang="scss">
.bo-field-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 4px;
  border-bottom: 1px solid var(--border-subtle);
  &:last-child { border-bottom: none; }
}

.bo-builder-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;

  &__title {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-tertiary);
  }
}

.bo-builder-row {
  display: flex;
  align-items: flex-start;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--surface-overlay);
  border: 1px solid var(--border-subtle);
  margin-bottom: 8px;
}

.bo-builder-empty {
  font-size: 12px;
  color: var(--text-quaternary);
  padding: 8px 4px 4px;
}
</style>