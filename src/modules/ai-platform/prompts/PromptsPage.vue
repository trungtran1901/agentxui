<template>
  <q-page class="page-wrapper">
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-title">Prompt Templates</h1>
        <p class="page-subtitle">GET /prompts?code={code}&page=1&page_size=50 — Auto-versioned by code</p>
      </div>
      <div class="page-header__actions">
        <button class="btn btn--secondary" @click="loadData">
          <q-icon name="refresh" size="15px" :class="loading && 'spin'" />
        </button>
        <button class="btn btn--primary" @click="openCreate">
          <q-icon name="add" size="15px" />
          New Prompt
        </button>
      </div>
    </div>

    <!-- Filter by code -->
    <div class="filter-bar">
      <q-input v-model="filterCode" dense outlined placeholder="Filter by code (e.g. hrm_agent_prompt)" clearable
        style="min-width:280px" @update:model-value="loadData">
        <template #prepend><q-icon name="search" size="15px" style="color:var(--text-quaternary)" /></template>
      </q-input>
      <div style="font-size:12px;color:var(--text-tertiary)">{{ rows.length }} prompt{{ rows.length !== 1 ? 's' : '' }}
      </div>
    </div>

    <div class="surface" style="overflow:hidden">
      <q-table :rows="rows" :columns="columns" :loading="loading" row-key="id" flat class="eap-table"
        :pagination="{ rowsPerPage: 20 }">
        <template #body-cell-name="props">
          <q-td :props="props">
            <div style="font-weight:600;font-size:13px;color:var(--text-primary);cursor:pointer"
              @click="openEditor(props.row)">
              {{ props.row.name }}
            </div>
            <div style="margin-top:2px;display:flex;align-items:center;gap:6px">
              <span class="code-tag">{{ props.row.code }}</span>
              <span class="code-tag" style="background:var(--brand-primary-subtle);color:var(--brand-primary)">v{{
                props.row.version }}</span>
            </div>
          </q-td>
        </template>
        <template #body-cell-status="props">
          <q-td :props="props"><span class="badge" :class="`badge--${props.value || 'active'}`">{{ props.value ||
              'active' }}</span></q-td>
        </template>
        <template #body-cell-actions="props">
          <q-td :props="props" auto-width>
            <div style="display:flex;align-items:center;gap:2px;justify-content:flex-end">
              <button class="tbl-action-btn" @click="openEditor(props.row)" title="Edit content">
                <q-icon name="edit_note" size="15px" />
              </button>
              <button class="tbl-action-btn" @click="createNewVersion(props.row)" title="New version (same code)">
                <q-icon name="add_circle_outline" size="15px" />
              </button>
              <div class="tbl-action-divider" />
              <button class="tbl-action-btn tbl-action-btn--danger" @click="confirmDelete(props.row)" title="Delete">
                <q-icon name="delete_outline" size="15px" />
              </button>
            </div>
          </q-td>
        </template>
        <template #no-data>
          <div class="empty-state" style="width:100%;padding:60px">
            <div class="empty-state__icon"><q-icon name="article" /></div>
            <div class="empty-state__title">No prompts</div>
            <button class="btn btn--primary" @click="openCreate"><q-icon name="add" size="15px" />New Prompt</button>
          </div>
        </template>
      </q-table>
    </div>

    <!-- Create dialog (new code → version auto starts at 1) -->
    <BaseFormDialog v-model="dialog" title="New Prompt Template" icon="article" icon-color="#3b82f6" :loading="saving"
      @confirm="save">
      <div style="display:flex;flex-direction:column;gap:14px">
        <div>
          <label class="field-label">code <span style="color:var(--brand-danger)">*</span></label>
          <q-input v-model="form.code" outlined dense placeholder="hrm_agent_prompt"
            hint="Reusing an existing code creates a new auto-incremented version" />
        </div>
        <div>
          <label class="field-label">name <span style="color:var(--brand-danger)">*</span></label>
          <q-input v-model="form.name" outlined dense placeholder="HRM Agent System Prompt" />
        </div>
        <div>
          <label class="field-label">content <span style="color:var(--brand-danger)">*</span></label>
          <textarea v-model="form.content" class="prompt-textarea" rows="8"
            placeholder="You are a helpful HR assistant. {{context}}" />
        </div>
        <div v-if="apiError" class="api-error-box"><q-icon name="error_outline" size="16px" />{{ apiError }}</div>
      </div>
    </BaseFormDialog>

    <!-- Full editor dialog -->
    <q-dialog v-model="editorDialog" maximized>
      <q-card v-if="editorItem" style="display:flex;flex-direction:column">
        <div class="dialog-header">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="dialog-header__icon" style="background:#3b82f6"><q-icon name="article" size="16px"
                style="color:white" /></div>
            <div>
              <div class="dialog-header__title">{{ editorItem.name }}</div>
              <div style="display:flex;gap:6px;margin-top:2px">
                <span class="code-tag">{{ editorItem.code }}</span>
                <span class="code-tag" style="background:var(--brand-primary-subtle);color:var(--brand-primary)">v{{
                  editorItem.version }}</span>
              </div>
            </div>
          </div>
          <button class="dialog-header__close" @click="editorDialog = false"><q-icon name="close" size="18px" /></button>
        </div>
        <div style="flex:1;display:flex;overflow:hidden">
          <div style="flex:1;display:flex;flex-direction:column;border-right:1px solid var(--border-subtle)">
            <div
              style="padding:10px 16px;font-size:11px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid var(--border-subtle);background:var(--surface-overlay)">
              CONTENT (code & version are immutable on PUT)
            </div>
            <textarea v-model="editorContent" class="prompt-textarea" style="flex:1;border-radius:0;border:none" />
          </div>
          <div style="width:320px;display:flex;flex-direction:column">
            <div style="padding:14px 16px;font-size:12px;color:var(--text-tertiary)">
              Detected variables:
              <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">
                <span v-for="v in detectedVars" :key="v" class="code-tag">{{ v }}</span>
                <span v-if="!detectedVars.length" style="color:var(--text-quaternary)">
                  None — use <span v-pre>{{var}}</span> syntax
                </span>
              </div>
            </div>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn btn--secondary" @click="editorDialog = false">Close</button>
          <button class="btn btn--primary" :disabled="saving" @click="saveEditor">
            <q-spinner v-if="saving" size="13px" style="color:white" />Save Content
          </button>
        </div>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script>
import { defineComponent, ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { agnoClient } from '../../../services/api/agno-runtime.client.js'
import { useUIStore } from '../../../stores/ui.store.js'
import BaseFormDialog from '../../../shared/components/BaseFormDialog.vue'

export default defineComponent({
  name: 'PromptsPage',
  components: { BaseFormDialog },
  setup() {
    const $q = useQuasar()
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'AI Platform' }, { label: 'Prompts' }])

    const rows = ref([]), loading = ref(false), saving = ref(false), filterCode = ref('')
    const dialog = ref(false), apiError = ref('')
    const editorDialog = ref(false), editorItem = ref(null), editorContent = ref('')
    const form = ref({ code: '', name: '', content: '' })

    const columns = [
      { name: 'name', label: 'Name / Code / Version', field: 'name', align: 'left', sortable: true },
      { name: 'status', label: 'Status', field: 'status', align: 'left' },
      { name: 'actions', label: '', field: 'actions', align: 'right' }
    ]

    const detectedVars = computed(() => {
      const matches = editorContent.value.match(/\{\{(\w+)\}\}/g) || []
      return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))]
    })

    async function loadData() {
      loading.value = true
      try {
        // GET /prompts?code={code}&page=1&page_size=50
        const res = await agnoClient.listPrompts({
          code: filterCode.value || undefined,
          page: 1,
          page_size: 50
        })
        rows.value = res.items
      } catch { $q.notify({ type: 'negative', message: 'Failed to load prompts' }) }
      finally { loading.value = false }
    }

    function openCreate() { apiError.value = ''; form.value = { code: '', name: '', content: '' }; dialog.value = true }

    function createNewVersion(item) {
      apiError.value = ''
      form.value = { code: item.code, name: item.name, content: item.content }
      dialog.value = true
      $q.notify({ type: 'info', message: `Reusing code "${item.code}" will auto-increment to v${item.version + 1}` })
    }

    async function save() {
      if (!form.value.code || !form.value.name || !form.value.content) {
        apiError.value = 'code, name, and content are required'; return
      }
      saving.value = true; apiError.value = ''
      try {
        await agnoClient.createPrompt(form.value)
        $q.notify({ type: 'positive', message: 'Prompt created' })
        dialog.value = false; loadData()
      } catch (e) {
        apiError.value = e.response?.data?.detail || e.response?.data?.message || 'Save failed'
      } finally { saving.value = false }
    }

    function openEditor(item) { editorItem.value = item; editorContent.value = item.content; editorDialog.value = true }

    async function saveEditor() {
      if (!editorItem.value) return
      saving.value = true
      try {
        // PUT cannot change code/version — only content/name/description
        await agnoClient.updatePrompt(editorItem.value.id, { content: editorContent.value })
        $q.notify({ type: 'positive', message: 'Content updated' })
        editorDialog.value = false; loadData()
      } catch (e) { $q.notify({ type: 'negative', message: e.response?.data?.detail || 'Update failed' }) }
      finally { saving.value = false }
    }

    function confirmDelete(item) {
      $q.dialog({ title: 'Delete Prompt', message: `Delete "${item.name}" v${item.version}?`, cancel: { label: 'Cancel', flat: true }, ok: { label: 'Delete', color: 'negative', unelevated: true } })
        .onOk(async () => { await agnoClient.deletePrompt(item.id); loadData() })
    }

    onMounted(loadData)
    return { rows, columns, loading, saving, filterCode, dialog, apiError, editorDialog, editorItem, editorContent, form, detectedVars, loadData, openCreate, createNewVersion, save, openEditor, saveEditor, confirmDelete }
  }
})
</script>

<style lang="scss">
.prompt-textarea {
  width: 100%;
  padding: 14px 16px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.7;
  resize: none;
  outline: none;
  background: var(--surface-base);
  color: var(--text-primary);

  &:focus {
    border-color: var(--brand-primary);
    box-shadow: var(--shadow-focus);
  }
}
</style>