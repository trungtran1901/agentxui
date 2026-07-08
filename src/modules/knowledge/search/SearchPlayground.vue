<template>
  <q-page class="page-wrapper">
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-title">Search Playground</h1>
        <p class="page-subtitle">POST /search — Permission-aware + agent-aware retrieval</p>
      </div>
    </div>

    <div class="search-layout">
      <!-- Left: Query Config -->
      <div class="surface search-config">
        <div class="search-config__header">
          <span style="font-size:13px;font-weight:600;color:var(--text-primary)">Query Parameters</span>
        </div>
        <div class="search-config__body">
          <div>
            <label class="field-label">query <span style="color:var(--brand-danger)">*</span></label>
            <div class="search-query-box" :class="{ 'search-query-box--focus': queryFocus }">
              <textarea v-model="query" class="search-query-textarea" rows="3"
                placeholder="Enter your search query…"
                @focus="queryFocus=true" @blur="queryFocus=false"
                @keydown.ctrl.enter.prevent="runSearch" />
              <div class="search-query-hint">Ctrl+Enter to search</div>
            </div>
          </div>

          <div>
            <label class="field-label">agentId <span style="color:var(--text-quaternary)">(optional)</span></label>
            <q-select v-model="form.agentId" :options="agentOptions" outlined dense clearable emit-value map-options />
          </div>

          <div>
            <label class="field-label">collectionId <span style="color:var(--text-quaternary)">(optional)</span></label>
            <q-select v-model="form.collectionId" :options="collectionOptions" outlined dense clearable emit-value map-options />
          </div>

          <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <label class="field-label" style="margin:0">topK</label>
              <span class="code-tag">{{ form.topK }}</span>
            </div>
            <q-slider v-model="form.topK" :min="1" :max="20" :step="1" color="indigo" />
          </div>

          <div>
            <label class="field-label">embeddingModelCode <span style="color:var(--text-quaternary)">(optional)</span></label>
            <q-select v-model="form.embeddingModelCode" :options="embeddingModelOptions" outlined dense clearable emit-value map-options />
          </div>

          <div>
            <label class="field-label">rerankModelCode <span style="color:var(--text-quaternary)">(optional)</span></label>
            <q-select v-model="form.rerankModelCode" :options="rerankModelOptions" outlined dense clearable emit-value map-options />
          </div>

          <button class="btn btn--primary" style="width:100%;height:40px;font-size:14px"
            :disabled="!query.trim() || searching" @click="runSearch">
            <q-spinner v-if="searching" size="16px" style="color:white" />
            <q-icon v-else name="search" size="18px" />
            {{ searching ? 'Searching…' : 'Search' }}
          </button>
        </div>
      </div>

      <!-- Right: Results -->
      <div style="display:flex;flex-direction:column;gap:12px;min-width:0">
        <div v-if="lastSearch" class="search-stats-bar anim-fade">
          <q-icon name="info_outline" size="16px" style="color:var(--brand-info);flex-shrink:0" />
          <span style="font-size:13px;color:var(--text-secondary)">
            <strong>{{ results.length }}</strong> results for
            "<span style="color:var(--brand-primary)">{{ lastSearch.query }}</span>"
            <span v-if="lastSearch.latency_ms"> · {{ lastSearch.latency_ms }}ms</span>
          </span>
        </div>

        <div v-if="searching" class="empty-state" style="padding:60px">
          <q-spinner size="32px" style="color:var(--brand-primary);margin-bottom:16px" />
          <div class="empty-state__title">Searching…</div>
        </div>
        <div v-else-if="!results.length && !lastSearch" class="empty-state" style="padding:60px">
          <div class="empty-state__icon"><q-icon name="manage_search" /></div>
          <div class="empty-state__title">Run a search</div>
          <div class="empty-state__desc">Enter a query and press Search or Ctrl+Enter</div>
        </div>
        <div v-else-if="!results.length" class="empty-state" style="padding:60px">
          <div class="empty-state__icon"><q-icon name="search_off" /></div>
          <div class="empty-state__title">No results found</div>
          <div class="empty-state__desc">No chunks matched within your accessible ACL scope</div>
        </div>

        <div v-for="(result, i) in results" :key="result.chunkId"
          class="search-result anim-fade" :style="`animation-delay:${i*30}ms`">
          <div class="search-result__header">
            <div class="search-result__rank">{{ i + 1 }}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:3px">
                {{ result.documentName || ('Document ' + (result.documentId?.substring(0,12) + '…')) }}
              </div>
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                <span v-if="result.page != null" class="code-tag" style="font-size:10px">
                  <q-icon name="description" size="10px" /> page {{ result.page }}
                </span>
                <span class="code-tag" style="font-size:10px">
                  chunk {{ result.chunkId?.substring(0,10) }}…
                </span>
                <!-- Source button -->
                <button class="btn btn--secondary btn--sm source-btn"
                  :class="{ 'source-btn--loading': loadingSourceId === result.chunkId }"
                  @click="openSource(result)">
                  <q-spinner v-if="loadingSourceId === result.chunkId" size="11px" />
                  <q-icon v-else name="article" size="12px" />
                  <span>Xem tài liệu</span>
                </button>
              </div>
            </div>
            <div class="search-result__score" :class="scoreClass(result.score)">
              {{ (result.score * 100).toFixed(1) }}%
            </div>
          </div>
          <div class="search-result__content">{{ result.content }}</div>
          <div v-if="result.sourceMetadata" style="margin-top:8px">
            <q-expansion-item dense label="Source metadata"
              style="border-top:1px solid var(--border-subtle);margin-top:8px;padding-top:4px">
              <pre class="code-block" style="font-size:11px;margin-top:8px">{{ JSON.stringify(result.sourceMetadata, null, 2) }}</pre>
            </q-expansion-item>
          </div>
        </div>
      </div>
    </div>

    <!-- ====================================================
         SOURCE VIEWER DIALOG — GET /chunks/{id}/source
         ==================================================== -->
    <q-dialog v-model="sourceDialog" maximized>
      <q-card style="display:flex;flex-direction:column;border-radius:0">
        <!-- Dialog header -->
        <div class="source-viewer__header">
          <div style="display:flex;align-items:center;gap:10px;min-width:0">
            <div style="width:30px;height:30px;border-radius:8px;background:var(--brand-primary);display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <q-icon name="article" size="16px" style="color:white" />
            </div>
            <div style="min-width:0">
              <div style="font-size:14px;font-weight:600;color:var(--text-primary)">
                {{ activeSourceChunk?.documentName || 'Tài liệu nguồn' }}
              </div>
              <div style="display:flex;align-items:center;gap:6px;margin-top:2px;flex-wrap:wrap">
                <span class="code-tag" style="font-size:10px">chunk: {{ activeSourceChunk?.chunkId?.substring(0,16) }}…</span>
                <span v-if="sourceData?.page != null" class="code-tag" style="font-size:10px">
                  page {{ sourceData.page }}
                </span>
                <span class="code-tag" style="font-size:10px">
                  doc: {{ sourceData?.document_id?.substring(0,12) }}…
                </span>
              </div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
            <button v-if="sourceData?.source_url" class="btn btn--secondary btn--sm"
              @click="openExternal" title="Mở trong tab mới">
              <q-icon name="open_in_new" size="14px" />
              Mở ngoài
            </button>
            <button class="btn btn--secondary btn--sm"
              @click="showBbox = !showBbox"
              :class="showBbox && 'btn--primary'" title="Highlight vùng chunk">
              <q-icon name="crop_free" size="14px" />
              {{ showBbox ? 'Ẩn bbox' : 'Highlight' }}
            </button>
            <button class="btn btn--ghost btn--icon" @click="sourceDialog=false">
              <q-icon name="close" size="18px" />
            </button>
          </div>
        </div>

        <!-- Body: split layout — left = metadata, right = document -->
        <div class="source-viewer__body">
          <!-- Left panel: chunk metadata -->
          <div class="source-viewer__meta">
            <div class="source-viewer__meta-section">
              <div class="source-viewer__meta-title">Chunk Info</div>
              <div class="source-meta-rows">
                <div class="source-meta-row">
                  <span class="source-meta-row__key">chunk_id</span>
                  <span class="source-meta-row__val font-mono">{{ activeSourceChunk?.chunkId }}</span>
                </div>
                <div class="source-meta-row">
                  <span class="source-meta-row__key">document_id</span>
                  <span class="source-meta-row__val font-mono">{{ sourceData?.document_id }}</span>
                </div>
                <div class="source-meta-row">
                  <span class="source-meta-row__key">page</span>
                  <span class="source-meta-row__val">{{ sourceData?.page ?? '—' }}</span>
                </div>
                <div class="source-meta-row">
                  <span class="source-meta-row__key">score</span>
                  <span class="source-meta-row__val">
                    <span class="search-result__score" :class="scoreClass(activeSourceChunk?.score || 0)"
                      style="display:inline-block">
                      {{ ((activeSourceChunk?.score || 0) * 100).toFixed(1) }}%
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <!-- BBox -->
            <div v-if="sourceData?.bbox" class="source-viewer__meta-section">
              <div class="source-viewer__meta-title">Bounding Box (px)</div>
              <div class="bbox-grid">
                <div class="bbox-cell">
                  <span class="bbox-cell__key">x0</span>
                  <span class="bbox-cell__val">{{ sourceData.bbox.x0 }}</span>
                </div>
                <div class="bbox-cell">
                  <span class="bbox-cell__key">y0</span>
                  <span class="bbox-cell__val">{{ sourceData.bbox.y0 }}</span>
                </div>
                <div class="bbox-cell">
                  <span class="bbox-cell__key">x1</span>
                  <span class="bbox-cell__val">{{ sourceData.bbox.x1 }}</span>
                </div>
                <div class="bbox-cell">
                  <span class="bbox-cell__key">y1</span>
                  <span class="bbox-cell__val">{{ sourceData.bbox.y1 }}</span>
                </div>
              </div>
              <div style="font-size:11px;color:var(--text-quaternary);margin-top:6px">
                W: {{ (sourceData.bbox.x1 - sourceData.bbox.x0) }}px ·
                H: {{ (sourceData.bbox.y1 - sourceData.bbox.y0) }}px
              </div>
            </div>

            <!-- Chunk content -->
            <div class="source-viewer__meta-section" style="flex:1">
              <div class="source-viewer__meta-title">Nội dung chunk</div>
              <div class="source-chunk-content">{{ activeSourceChunk?.content }}</div>
            </div>
          </div>

          <!-- Right panel: document viewer -->
          <div class="source-viewer__doc">
            <div v-if="loadingSourceId" class="source-viewer__loading">
              <q-spinner size="36px" style="color:var(--brand-primary)" />
              <div style="font-size:13px;color:var(--text-tertiary);margin-top:12px">
                Đang tải tài liệu nguồn…
              </div>
            </div>

            <div v-else-if="!sourceData?.source_url" class="source-viewer__loading">
              <div class="empty-state__icon"><q-icon name="broken_image" /></div>
              <div style="font-size:13px;color:var(--text-tertiary);margin-top:8px">Không có source URL</div>
            </div>

            <!-- PDF viewer (iframe with bbox overlay) -->
            <div v-else-if="isPdf" class="source-viewer__pdf-wrap" ref="pdfWrapRef">
              <!-- iframe: embed PDF with page anchor -->
              <iframe
                :src="pdfSrcWithPage"
                class="source-viewer__iframe"
                @load="onIframeLoad"
                ref="iframeRef"
              />

              <!-- BBox highlight overlay (shown when showBbox=true) -->
              <div v-if="showBbox && sourceData.bbox && iframeLoaded"
                class="bbox-overlay"
                :style="bboxOverlayStyle">
                <div class="bbox-overlay__label">chunk</div>
              </div>

              <!-- Fallback: cannot overlay cross-origin iframe -->
              <div v-if="showBbox && isCrossOrigin" class="bbox-crossorigin-note">
                <q-icon name="info_outline" size="14px" />
                Bbox highlight không hiển thị được trên cross-origin PDF — dùng nút "Mở ngoài" để xem trong tab mới với tọa độ đã sao chép.
              </div>
            </div>

            <!-- Non-PDF: image or other — open externally -->
            <div v-else class="source-viewer__loading">
              <q-icon name="insert_drive_file" size="48px" style="color:var(--text-quaternary);margin-bottom:12px" />
              <div style="font-size:13px;font-weight:500;color:var(--text-primary)">Tài liệu không phải PDF</div>
              <div style="font-size:12px;color:var(--text-tertiary);margin-top:4px;margin-bottom:16px">
                Định dạng này cần mở trong tab mới
              </div>
              <button class="btn btn--primary" @click="openExternal">
                <q-icon name="open_in_new" size="15px" />
                Mở tài liệu
              </button>
            </div>
          </div>
        </div>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script>
import { defineComponent, ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { knowledgeClient } from '../../../services/api/knowledge-platform.client.js'
import { agnoClient } from '../../../services/api/agno-runtime.client.js'
import { useUIStore } from '../../../stores/ui.store.js'

export default defineComponent({
  name: 'SearchPlayground',
  setup() {
    const $q = useQuasar()
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'Knowledge' }, { label: 'Search Playground' }])

    const query = ref(''), queryFocus = ref(false)
    const form = ref({ agentId: null, collectionId: null, topK: 5, embeddingModelCode: null, rerankModelCode: null })
    const agentOptions = ref([]), collectionOptions = ref([])
    const embeddingModelOptions = ref([]), rerankModelOptions = ref([])
    const searching = ref(false), results = ref([]), lastSearch = ref(null)

    // Source viewer state
    const sourceDialog = ref(false)
    const sourceData = ref(null)          // response from GET /chunks/{id}/source
    const activeSourceChunk = ref(null)   // the full result object clicked
    const loadingSourceId = ref(null)     // chunkId being loaded (shows spinner inline + in dialog)
    const showBbox = ref(true)
    const iframeLoaded = ref(false)
    const iframeRef = ref(null)
    const pdfWrapRef = ref(null)

    // ---- Score helper ----
    const scoreClass = (score) =>
      score >= 0.8 ? 'search-result__score--high'
      : score >= 0.6 ? 'search-result__score--mid'
      : 'search-result__score--low'

    // ---- Source URL computed ----
    const isPdf = computed(() => {
      const url = sourceData.value?.source_url || ''
      // strip query params for extension check
      const path = url.split('?')[0].toLowerCase()
      return path.endsWith('.pdf')
    })

    // PDF src with page anchor (#page=N)
    const pdfSrcWithPage = computed(() => {
      const url = sourceData.value?.source_url || ''
      const page = sourceData.value?.page
      if (!url) return ''
      return page ? `${url}#page=${page}` : url
    })

    // Detect cross-origin for iframe overlay warning
    const isCrossOrigin = computed(() => {
      try {
        const url = new URL(sourceData.value?.source_url || '')
        return url.origin !== window.location.origin
      } catch { return false }
    })

    // BBox overlay: position relative to iframe
    // We can only do this accurately for same-origin iframes.
    // For cross-origin (presigned S3 URL), we show a note instead.
    // The overlay is positioned as percentage of pdf page dimensions
    // using the bbox pixel coordinates. Since we don't know the PDF page
    // size in pixels, we use a best-effort relative positioning.
    const bboxOverlayStyle = computed(() => {
      const bbox = sourceData.value?.bbox
      if (!bbox) return {}
      // A4 at 150dpi ≈ 1240x1754px; use that as reference
      const PAGE_W = 1240, PAGE_H = 1754
      const left = (bbox.x0 / PAGE_W * 100).toFixed(2) + '%'
      const top = (bbox.y0 / PAGE_H * 100).toFixed(2) + '%'
      const width = ((bbox.x1 - bbox.x0) / PAGE_W * 100).toFixed(2) + '%'
      const height = ((bbox.y1 - bbox.y0) / PAGE_H * 100).toFixed(2) + '%'
      return { left, top, width, height }
    })

    function onIframeLoad() { iframeLoaded.value = true }

    // ---- Open external (new tab) ----
    function openExternal() {
      if (sourceData.value?.source_url) window.open(sourceData.value.source_url, '_blank')
    }

    // ---- Fetch chunk source and open viewer ----
    async function openSource(result) {
      activeSourceChunk.value = result
      sourceData.value = null
      iframeLoaded.value = false
      showBbox.value = true
      sourceDialog.value = true
      loadingSourceId.value = result.chunkId
      try {
        // GET /chunks/{chunk_id}/source
        // Returns: { document_id, page, bbox: { x0, x1, y0, y1 }, source_url }
        sourceData.value = await knowledgeClient.getChunkSource(result.chunkId)
      } catch (e) {
        $q.notify({ type: 'negative', message: e.response?.data?.detail || 'Không tải được tài liệu nguồn' })
        sourceDialog.value = false
      } finally {
        loadingSourceId.value = null
      }
    }

    // ---- Load meta ----
    async function loadMeta() {
      const [agents, cols, models] = await Promise.allSettled([
        agnoClient.listAgents({ page_size: 100 }),
        knowledgeClient.listCollections(),
        knowledgeClient.listAiModels()
      ])
      if (agents.status === 'fulfilled')
        agentOptions.value = agents.value.items.map(a => ({ label: a.name, value: a.id }))
      if (cols.status === 'fulfilled')
        collectionOptions.value = cols.value.map(c => ({ label: c.name, value: c.id }))
      if (models.status === 'fulfilled') {
        embeddingModelOptions.value = models.value.filter(m => m.model_type === 'EMBEDDING').map(m => ({ label: m.model_name, value: m.model_code }))
        rerankModelOptions.value = models.value.filter(m => m.model_type === 'RERANK').map(m => ({ label: m.model_name, value: m.model_code }))
      }
    }

    // ---- Search ----
    async function runSearch() {
      if (!query.value.trim()) return
      searching.value = true; results.value = []
      const t0 = Date.now()
      try {
        const body = {
          query: query.value,
          ...(form.value.agentId ? { agentId: form.value.agentId } : {}),
          ...(form.value.collectionId ? { collectionId: form.value.collectionId } : {}),
          topK: form.value.topK,
          ...(form.value.embeddingModelCode ? { embeddingModelCode: form.value.embeddingModelCode } : {}),
          ...(form.value.rerankModelCode ? { rerankModelCode: form.value.rerankModelCode } : {})
        }
        const res = await knowledgeClient.search(body)
        results.value = res.results || []
        lastSearch.value = { query: query.value, latency_ms: Date.now() - t0 }
      } catch (e) {
        $q.notify({ type: 'negative', message: e.response?.data?.detail || 'Search failed' })
      } finally { searching.value = false }
    }

    onMounted(loadMeta)

    return {
      query, queryFocus, form, agentOptions, collectionOptions,
      embeddingModelOptions, rerankModelOptions,
      searching, results, lastSearch,
      sourceDialog, sourceData, activeSourceChunk, loadingSourceId,
      showBbox, iframeLoaded, iframeRef, pdfWrapRef,
      isPdf, pdfSrcWithPage, isCrossOrigin, bboxOverlayStyle,
      scoreClass, runSearch, openSource, openExternal, onIframeLoad
    }
  }
})
</script>

<style lang="scss">
/* Search layout */
.search-layout { display: grid; grid-template-columns: 300px 1fr; gap: 16px; align-items: start; @media (max-width: 900px) { grid-template-columns: 1fr; } }
.search-config {
  display: flex; flex-direction: column; position: sticky; top: 20px;
  &__header { padding: 14px 16px; border-bottom: 1px solid var(--border-subtle); }
  &__body { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
}
.search-query-box { border: 1px solid var(--border-default); border-radius: var(--radius-md); overflow: hidden; transition: border-color 150ms, box-shadow 150ms; &--focus { border-color: var(--brand-primary); box-shadow: var(--shadow-focus); } }
.search-query-textarea { width: 100%; padding: 10px 12px; border: none; outline: none; font-family: var(--font-sans); font-size: 13px; color: var(--text-primary); background: var(--surface-base); resize: none; line-height: 1.5; &::placeholder { color: var(--text-quaternary); } }
.search-query-hint { padding: 4px 12px 6px; font-size: 10px; color: var(--text-quaternary); background: var(--surface-overlay); border-top: 1px solid var(--border-subtle); }
.search-stats-bar { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--status-info-bg); border: 1px solid rgba(59,130,246,0.15); border-radius: var(--radius-md); }

/* Search result card */
.search-result {
  padding: 14px 16px; border: 1px solid var(--border-subtle); border-radius: var(--radius-lg);
  margin-bottom: 8px; background: var(--surface-raised); transition: all 120ms ease;
  &:hover { border-color: var(--border-default); box-shadow: var(--shadow-sm); }
  &__header { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; }
  &__rank { width: 24px; height: 24px; border-radius: 6px; background: var(--brand-primary); color: white; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  &__score { font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 99px; flex-shrink: 0;
    &--high { background: var(--status-success-bg); color: var(--status-success-text); }
    &--mid { background: var(--status-warning-bg); color: var(--status-warning-text); }
    &--low { background: var(--surface-sunken); color: var(--text-tertiary); } }
  &__content { font-size: 13px; line-height: 1.7; color: var(--text-secondary); padding: 10px 12px; background: var(--surface-overlay); border-radius: var(--radius-md); border-left: 3px solid var(--brand-primary); }
}

/* Source button */
.source-btn {
  height: 22px !important;
  padding: 0 8px !important;
  font-size: 11px !important;
  gap: 3px !important;
  &--loading { opacity: 0.7; pointer-events: none; }
}

/* ===== SOURCE VIEWER ===== */
.source-viewer {
  &__header {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 14px 20px; border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-raised); flex-shrink: 0;
  }

  &__body {
    flex: 1; display: flex; overflow: hidden;
  }

  /* Left: metadata panel */
  &__meta {
    width: 280px; flex-shrink: 0;
    border-right: 1px solid var(--border-subtle);
    overflow-y: auto; padding: 16px;
    display: flex; flex-direction: column; gap: 16px;
    background: var(--surface-raised);

    &::-webkit-scrollbar { width: 4px; }
    &::-webkit-scrollbar-thumb { background: var(--border-subtle); border-radius: 2px; }
  }

  &__meta-section { display: flex; flex-direction: column; gap: 8px; }
  &__meta-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-quaternary); }

  /* Right: document viewer */
  &__doc {
    flex: 1; overflow: hidden; position: relative;
    background: #404040;
    display: flex; align-items: center; justify-content: center;
  }

  &__loading {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 40px; color: #ccc; text-align: center;
  }

  &__pdf-wrap {
    width: 100%; height: 100%; position: relative; overflow: hidden;
  }

  &__iframe {
    width: 100%; height: 100%; border: none; display: block;
  }
}

/* Source metadata rows */
.source-meta-rows { display: flex; flex-direction: column; gap: 6px; }
.source-meta-row {
  display: flex; flex-direction: column; gap: 1px;
  padding: 6px 8px; background: var(--surface-overlay); border-radius: 6px;
  &__key { font-size: 10px; font-weight: 600; color: var(--text-quaternary); text-transform: uppercase; letter-spacing: 0.06em; }
  &__val { font-size: 11px; color: var(--text-primary); word-break: break-all; line-height: 1.4; }
}

/* BBox grid */
.bbox-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.bbox-cell {
  padding: 6px 8px; background: rgba(99,102,241,0.06); border: 1px solid rgba(99,102,241,0.15); border-radius: 6px;
  display: flex; flex-direction: column; gap: 1px;
  &__key { font-size: 9px; font-weight: 700; color: var(--brand-primary); text-transform: uppercase; }
  &__val { font-size: 13px; font-weight: 700; color: var(--text-primary); }
}

/* Chunk content in meta panel */
.source-chunk-content {
  font-size: 12px; line-height: 1.7; color: var(--text-secondary);
  padding: 10px; background: var(--surface-overlay); border-radius: 6px;
  border-left: 3px solid var(--brand-primary);
  max-height: 260px; overflow-y: auto;
}

/* BBox overlay on top of iframe */
.bbox-overlay {
  position: absolute; pointer-events: none; z-index: 10;
  border: 2.5px solid #f59e0b;
  background: rgba(245,158,11,0.12);
  border-radius: 3px;
  transition: all 200ms ease;

  &__label {
    position: absolute; top: -20px; left: 0;
    background: #f59e0b; color: white;
    font-size: 10px; font-weight: 700;
    padding: 2px 6px; border-radius: 4px 4px 0 0;
    text-transform: uppercase; letter-spacing: 0.06em;
    white-space: nowrap;
  }
}

/* Cross-origin note */
.bbox-crossorigin-note {
  position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
  background: rgba(0,0,0,0.75); color: white; backdrop-filter: blur(4px);
  padding: 8px 14px; border-radius: 8px; font-size: 11px;
  display: flex; align-items: center; gap: 6px;
  max-width: 480px; text-align: center; line-height: 1.5;
  pointer-events: none; z-index: 20;
}
</style>