<template>
  <q-page class="page-wrapper">
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-title">Documents</h1>
        <p class="page-subtitle">GET /documents · POST /documents/upload · POST /documents/{id}/process|reindex|reembed</p>
      </div>
      <div class="page-header__actions">
        <button class="btn btn--secondary" @click="loadData">
          <q-icon name="refresh" size="15px" :class="loading && 'spin'" />
        </button>
        <button class="btn btn--primary" @click="uploadDialog = true">
          <q-icon name="upload_file" size="15px" />
          Upload Document
        </button>
      </div>
    </div>

    <!-- Filter bar -->
    <div class="filter-bar">
      <q-select v-model="filterCollection" :options="collectionOptions" label="Filter by collection"
        outlined dense clearable emit-value map-options style="min-width:220px"
        @update:model-value="loadData" />
      <div style="font-size:12px;color:var(--text-tertiary)">
        {{ rows.length }} document{{ rows.length !== 1 ? 's' : '' }}
      </div>
    </div>

    <!-- Table -->
    <div class="surface" style="overflow:hidden">
      <q-table :rows="rows" :columns="columns" :loading="loading" row-key="id"
        flat class="eap-table" :pagination="{ rowsPerPage: 20 }">

        <template #body-cell-title="props">
          <q-td :props="props">
            <div class="doc-title-cell">
              <div class="doc-icon" :class="`doc-icon--${mimeClass(props.row.mime_type)}`">
                <q-icon :name="mimeIcon(props.row.mime_type)" size="16px" />
              </div>
              <div>
                <div style="font-weight:600;font-size:13px;color:var(--text-primary)">{{ props.row.title }}</div>
                <div v-if="props.row.description" style="font-size:11px;color:var(--text-tertiary);margin-top:1px">{{ props.row.description }}</div>
              </div>
            </div>
          </q-td>
        </template>

        <template #body-cell-status="props">
          <q-td :props="props">
            <div style="display:flex;align-items:center;gap:6px">
              <span class="badge" :class="statusClass(props.value)">{{ props.value }}</span>
              <q-spinner v-if="props.value === 'PROCESSING'" size="12px" style="color:var(--brand-primary)" />
            </div>
          </q-td>
        </template>

        <template #body-cell-file_size="props">
          <q-td :props="props" style="color:var(--text-tertiary);font-size:12px">
            {{ formatSize(props.value) }}
          </q-td>
        </template>

        <template #body-cell-version="props">
          <q-td :props="props">
            <span class="code-tag" style="font-size:10px">v{{ props.value }}</span>
          </q-td>
        </template>

        <template #body-cell-actions="props">
          <q-td :props="props" auto-width>
            <div style="display:flex;align-items:center;gap:2px;justify-content:flex-end">
              <!-- Process -->
              <button v-if="['UPLOADED','FAILED'].includes(props.row.status)"
                class="tbl-action-btn" title="Process (OCR→chunk→embed→index)"
                @click="processDoc(props.row, 'process')">
                <q-icon name="play_circle_outline" size="15px" style="color:var(--brand-secondary)" />
              </button>
              <!-- Reindex -->
              <button v-if="props.row.status === 'INDEXED'"
                class="tbl-action-btn" title="Reindex (purge vectors + re-run pipeline)"
                @click="processDoc(props.row, 'reindex')">
                <q-icon name="sync" size="15px" style="color:var(--brand-primary)" />
              </button>
              <!-- Reembed -->
              <button v-if="props.row.status === 'INDEXED'"
                class="tbl-action-btn" title="Reembed (after model change)"
                @click="processDoc(props.row, 'reembed')">
                <q-icon name="model_training" size="15px" style="color:#8b5cf6" />
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
            <div class="empty-state__icon"><q-icon name="description" /></div>
            <div class="empty-state__title">No documents</div>
            <div class="empty-state__desc">Upload a document to get started</div>
            <button class="btn btn--primary" @click="uploadDialog=true">
              <q-icon name="upload_file" size="15px" />Upload
            </button>
          </div>
        </template>
      </q-table>
    </div>

    <!-- Upload Dialog — multipart/form-data -->
    <BaseFormDialog v-model="uploadDialog"
      title="Upload Document"
      subtitle="POST /documents/upload (multipart/form-data)"
      icon="upload_file" icon-color="#6366f1"
      confirm-label="Upload" :loading="uploading" width="580px"
      @confirm="doUpload">
      <div style="display:flex;flex-direction:column;gap:14px">
        <!-- Collection -->
        <div>
          <label class="field-label">collection_id <span style="color:var(--brand-danger)">*</span></label>
          <q-select v-model="uploadForm.collection_id" :options="collectionOptions"
            outlined dense emit-value map-options placeholder="Select collection" />
        </div>

        <!-- Title -->
        <div>
          <label class="field-label">title <span style="color:var(--brand-danger)">*</span></label>
          <q-input v-model="uploadForm.title" outlined dense placeholder="Annual Leave Policy 2026" />
        </div>

        <!-- Description -->
        <div>
          <label class="field-label">description</label>
          <q-input v-model="uploadForm.description" outlined dense placeholder="Optional description" />
        </div>

        <!-- File picker -->
        <div>
          <label class="field-label">file <span style="color:var(--brand-danger)">*</span></label>
          <div
            class="upload-dropzone"
            :class="{ 'upload-dropzone--drag': isDragging, 'upload-dropzone--has-file': selectedFile }"
            @dragover.prevent="isDragging = true"
            @dragleave="isDragging = false"
            @drop.prevent="onFileDrop"
            @click="$refs.fileInput.click()">
            <input ref="fileInput" type="file" style="display:none"
              accept=".pdf,.docx,.doc,.txt,.md,.csv,.json,.xlsx,.pptx"
              @change="onFileSelect" />
            <template v-if="!selectedFile">
              <q-icon name="cloud_upload" size="32px" style="color:var(--text-quaternary);margin-bottom:8px" />
              <div style="font-size:13px;font-weight:500;color:var(--text-secondary)">
                {{ isDragging ? 'Drop file here' : 'Drag & drop or click to select' }}
              </div>
              <div style="font-size:11px;color:var(--text-quaternary);margin-top:4px">
                PDF, DOCX, TXT, MD, CSV, JSON, XLSX, PPTX
              </div>
            </template>
            <template v-else>
              <q-icon :name="mimeIcon(selectedFile.type)" size="28px" style="margin-bottom:6px;color:var(--brand-primary)" />
              <div style="font-size:13px;font-weight:600;color:var(--text-primary)">{{ selectedFile.name }}</div>
              <div style="font-size:11px;color:var(--text-tertiary);margin-top:2px">{{ formatSize(selectedFile.size) }}</div>
              <button class="btn btn--ghost btn--sm" style="margin-top:8px" @click.stop="selectedFile=null">
                Change file
              </button>
            </template>
          </div>
        </div>

        <!-- Progress -->
        <div v-if="uploading">
          <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:6px">Uploading…</div>
          <q-linear-progress indeterminate color="primary" size="4px" style="border-radius:2px" />
        </div>

        <!-- Auto-process toggle -->
        <div class="search-toggle">
          <q-toggle v-model="autoProcess" dense />
          <div>
            <div style="font-size:13px;font-weight:500;color:var(--text-primary)">Auto-process after upload</div>
            <div style="font-size:11px;color:var(--text-tertiary)">Enqueues POST /documents/{id}/process immediately</div>
          </div>
        </div>

        <div v-if="apiError" class="api-error-box">
          <q-icon name="error_outline" size="16px" />{{ apiError }}
        </div>
      </div>
    </BaseFormDialog>

    <!-- Processing result snackbar handled via notify -->
  </q-page>
</template>

<script>
import { defineComponent, ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { knowledgeClient } from '../../../services/api/knowledge-platform.client.js'
import { useUIStore } from '../../../stores/ui.store.js'
import BaseFormDialog from '../../../shared/components/BaseFormDialog.vue'

export default defineComponent({
  name: 'DocumentsPage',
  components: { BaseFormDialog },
  setup() {
    const $q = useQuasar()
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'Knowledge' }, { label: 'Documents' }])

    const rows = ref([]), loading = ref(false)
    const filterCollection = ref(null), collectionOptions = ref([])
    const uploadDialog = ref(false), uploading = ref(false), apiError = ref('')
    const selectedFile = ref(null), isDragging = ref(false), autoProcess = ref(true)
    const uploadForm = ref({ collection_id: null, title: '', description: '' })

    const columns = [
      { name: 'title', label: 'Title', field: 'title', align: 'left', sortable: true },
      { name: 'status', label: 'Status', field: 'status', align: 'left' },
      { name: 'version', label: 'Version', field: 'version', align: 'center' },
      { name: 'file_size', label: 'Size', field: 'file_size', align: 'left' },
      { name: 'mime_type', label: 'Type', field: 'mime_type', align: 'left', format: v => v || '—' },
      { name: 'actions', label: '', field: 'actions', align: 'right' }
    ]

    const statusClass = (s) => ({
      UPLOADED: 'badge--pending', PROCESSING: 'badge--running',
      INDEXED: 'badge--active', FAILED: 'badge--error'
    }[s] || 'badge--inactive')

    function mimeIcon(mime) {
      if (!mime) return 'description'
      if (mime.includes('pdf')) return 'picture_as_pdf'
      if (mime.includes('word') || mime.includes('docx')) return 'article'
      if (mime.includes('sheet') || mime.includes('csv') || mime.includes('xlsx')) return 'table_chart'
      if (mime.includes('json')) return 'data_object'
      if (mime.includes('image')) return 'image'
      return 'description'
    }

    function mimeClass(mime) {
      if (!mime) return 'default'
      if (mime.includes('pdf')) return 'pdf'
      if (mime.includes('word') || mime.includes('docx')) return 'doc'
      if (mime.includes('sheet') || mime.includes('csv')) return 'sheet'
      return 'default'
    }

    function formatSize(bytes) {
      if (!bytes) return '—'
      if (bytes < 1024) return `${bytes} B`
      if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
      return `${(bytes / 1048576).toFixed(1)} MB`
    }

    async function loadCollections() {
      try {
        const cols = await knowledgeClient.listCollections()
        collectionOptions.value = cols.map(c => ({ label: c.name, value: c.id }))
      } catch { collectionOptions.value = [] }
    }

    async function loadData() {
      loading.value = true
      try {
        rows.value = await knowledgeClient.listDocuments(
          filterCollection.value ? { collection_id: filterCollection.value } : undefined
        )
      } catch { $q.notify({ type: 'negative', message: 'Failed to load documents' }) }
      finally { loading.value = false }
    }

    function onFileSelect(e) { selectedFile.value = e.target.files[0] || null }
    function onFileDrop(e) {
      isDragging.value = false
      selectedFile.value = e.dataTransfer.files[0] || null
    }

    async function doUpload() {
      if (!uploadForm.value.collection_id || !uploadForm.value.title || !selectedFile.value) {
        apiError.value = 'collection_id, title, and file are required'; return
      }
      uploading.value = true; apiError.value = ''
      try {
        const fd = new FormData()
        fd.append('collection_id', uploadForm.value.collection_id)
        fd.append('title', uploadForm.value.title)
        if (uploadForm.value.description) fd.append('description', uploadForm.value.description)
        fd.append('file', selectedFile.value)

        const doc = await knowledgeClient.uploadDocument(fd)
        $q.notify({ type: 'positive', message: `Document uploaded — status: ${doc.status}` })

        if (autoProcess.value) {
          try {
            const res = await knowledgeClient.processDocument(doc.id)
            $q.notify({ type: 'info', message: `Processing queued (${res.status}) — poll status for INDEXED` })
          } catch (e2) {
            $q.notify({ type: 'warning', message: 'Upload OK but process enqueue failed: ' + (e2.response?.data?.detail || e2.message) })
          }
        }

        uploadDialog.value = false
        selectedFile.value = null
        uploadForm.value = { collection_id: null, title: '', description: '' }
        loadData()
      } catch (e) {
        apiError.value = e.response?.data?.detail || 'Upload failed'
      } finally { uploading.value = false }
    }

    async function processDoc(doc, action) {
      // action: 'process' | 'reindex' | 'reembed'
      const labels = {
        process: 'Processing queued (OCR→chunk→embed→index)',
        reindex: 'Reindex queued (purge vectors + re-run)',
        reembed: 'Re-embed queued'
      }
      try {
        let res
        if (action === 'process') res = await knowledgeClient.processDocument(doc.id)
        else if (action === 'reindex') res = await knowledgeClient.reindexDocument(doc.id)
        else res = await knowledgeClient.reembedDocument(doc.id)
        $q.notify({ type: 'positive', message: labels[action] + ` — ${res.status}` })
        setTimeout(loadData, 1500) // poll after short delay
      } catch (e) {
        $q.notify({ type: 'negative', message: e.response?.data?.detail || `${action} failed` })
      }
    }

    function confirmDelete(doc) {
      $q.dialog({
        title: 'Delete Document',
        message: `Delete <strong>${doc.title}</strong>? File will be removed from storage.`,
        html: true,
        cancel: { label: 'Cancel', flat: true },
        ok: { label: 'Delete', color: 'negative', unelevated: true }
      }).onOk(async () => {
        try {
          await knowledgeClient.deleteDocument(doc.id) // 204
          $q.notify({ type: 'positive', message: 'Document deleted' })
          loadData()
        } catch (e) { $q.notify({ type: 'negative', message: e.response?.data?.detail || 'Delete failed' }) }
      })
    }

    onMounted(() => { loadData(); loadCollections() })
    return { rows, columns, loading, filterCollection, collectionOptions, uploadDialog, uploading, apiError, selectedFile, isDragging, autoProcess, uploadForm, statusClass, mimeIcon, mimeClass, formatSize, loadData, onFileSelect, onFileDrop, doUpload, processDoc, confirmDelete }
  }
})
</script>

<style lang="scss">
.doc-title-cell { display: flex; align-items: flex-start; gap: 10px; }
.doc-icon {
  width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  &--pdf { background: rgba(239,68,68,0.1); color: #dc2626; }
  &--doc { background: rgba(59,130,246,0.1); color: #3b82f6; }
  &--sheet { background: rgba(16,185,129,0.1); color: #059669; }
  &--default { background: var(--surface-sunken); color: var(--text-tertiary); }
}

.upload-dropzone {
  border: 2px dashed var(--border-default); border-radius: 10px; padding: 28px;
  display: flex; flex-direction: column; align-items: center; text-align: center;
  cursor: pointer; transition: all 150ms ease;
  &:hover { border-color: var(--brand-primary); background: var(--brand-primary-subtle); }
  &--drag { border-color: var(--brand-primary); background: var(--brand-primary-subtle); }
  &--has-file { border-color: var(--brand-secondary); background: rgba(16,185,129,0.04); border-style: solid; }
}
</style>