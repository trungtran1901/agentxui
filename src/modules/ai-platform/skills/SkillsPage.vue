<template>
  <q-page class="page-wrapper">
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-title">Skills</h1>
        <p class="page-subtitle">
          GET /skills?page=1&page_size=50 · skill_type: MCP | WORKFLOW | PROMPT | CUSTOM | KNOWLEDGE
        </p>
      </div>
      <div class="page-header__actions">
        <button class="btn btn--secondary" @click="loadData">
          <q-icon name="refresh" size="15px" :class="loading && 'spin'" />
        </button>
        <button class="btn btn--primary" @click="openCreate">
          <q-icon name="add" size="15px" />
          New Skill
        </button>
      </div>
    </div>

    <!-- Filter -->
    <div class="filter-bar">
      <q-select v-model="filterType" :options="skillTypeOptions" label="Filter by type"
        outlined dense clearable emit-value map-options style="min-width:200px"
        @update:model-value="loadData" />
      <div style="font-size:12px;color:var(--text-tertiary)">
        {{ pagination.rowsNumber }} skill{{ pagination.rowsNumber !== 1 ? 's' : '' }}
      </div>
    </div>

    <div class="surface" style="overflow:hidden">
      <q-table :rows="rows" :columns="columns" :loading="loading" row-key="id" flat class="eap-table"
        :pagination="pagination" @request="onRequest">

        <template #body-cell-name="props">
          <q-td :props="props">
            <div style="display:flex;align-items:center;gap:8px">
              <div class="skill-type-icon" :class="`skill-type-icon--${(props.row.skill_type||'MCP').toLowerCase()}`">
                <q-icon :name="skillTypeIcon(props.row.skill_type)" size="14px" />
              </div>
              <div>
                <div style="display:flex;align-items:center;gap:6px">
                  <span style="font-weight:600;font-size:13px;color:var(--text-primary)">{{ props.row.name }}</span>
                  <span v-if="props.row.enabled === false" class="badge badge--inactive badge--no-dot" style="font-size:10px">disabled</span>
                </div>
                <div style="display:flex;align-items:center;gap:5px;margin-top:2px">
                  <span class="code-tag">{{ props.row.code }}</span>
                </div>
                <div v-if="props.row.description" style="font-size:11px;color:var(--text-tertiary);margin-top:1px">{{ props.row.description }}</div>
              </div>
            </div>
          </q-td>
        </template>

        <template #body-cell-skill_type="props">
          <q-td :props="props">
            <span class="skill-type-badge" :class="`skill-type-badge--${(props.value||'MCP').toLowerCase()}`">
              {{ props.value || 'MCP' }}
            </span>
          </q-td>
        </template>

        <template #body-cell-capability_codes="props">
          <q-td :props="props">
            <template v-if="props.row.skill_type === 'KNOWLEDGE'">
              <div style="display:flex;align-items:center;gap:5px">
                <q-icon name="folder" size="12px" style="color:#d97706;flex-shrink:0" />
                <span style="font-size:12px;color:var(--text-secondary);font-weight:500">
                  {{ collectionLabel(props.row.config?.collectionId) }}
                </span>
              </div>
            </template>
            <template v-else-if="props.row.skill_type === 'WORKFLOW'">
              <div style="display:flex;align-items:center;gap:5px">
                <q-icon name="account_tree" size="12px" style="color:#d97706;flex-shrink:0" />
                <span style="font-size:12px;color:var(--text-secondary);font-weight:500">
                  {{ workflowLabel(props.row.config?.workflowCode) }}
                </span>
                <span v-if="props.row.config?.maxTriggerDepth != null" class="code-tag" style="font-size:9px">
                  depth {{ props.row.config.maxTriggerDepth }}
                </span>
              </div>
            </template>
            <template v-else-if="props.row.skill_type === 'UI'">
              <div style="display:flex;align-items:center;gap:5px;max-width:320px">
                <q-icon name="touch_app" size="12px" style="color:#ec4899;flex-shrink:0" />
                <span style="font-size:12px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                  {{ props.row.instructions || '—' }}
                </span>
              </div>
            </template>
            <template v-else>
              <div style="display:flex;flex-wrap:wrap;gap:4px;max-width:280px">
                <span v-for="c in (props.value||[]).slice(0,3)" :key="c" class="code-tag">{{ c }}</span>
                <span v-if="(props.value||[]).length > 3" class="code-tag" style="opacity:0.6">
                  +{{ props.value.length - 3 }}
                </span>
                <span v-if="!props.value?.length" style="color:var(--text-quaternary);font-size:12px">—</span>
              </div>
            </template>
          </q-td>
        </template>

        <template #body-cell-actions="props">
          <q-td :props="props" auto-width>
            <div style="display:flex;align-items:center;gap:2px;justify-content:flex-end">
              <button v-if="props.row.skill_type === 'KNOWLEDGE'"
                class="tbl-action-btn" title="Test skill (POST /skills/{id}/test)"
                @click="openTest(props.row)">
                <q-icon name="play_circle_outline" size="15px" style="color:var(--brand-secondary)" />
              </button>
              <button class="tbl-action-btn" @click="openEdit(props.row)" title="Edit">
                <q-icon name="edit" size="15px" />
              </button>
              <div class="tbl-action-divider" />
              <button class="tbl-action-btn tbl-action-btn--danger" @click="confirmDelete(props.row)">
                <q-icon name="delete_outline" size="15px" />
              </button>
            </div>
          </q-td>
        </template>

        <template #no-data>
          <div class="empty-state" style="width:100%;padding:60px">
            <div class="empty-state__icon"><q-icon name="extension" /></div>
            <div class="empty-state__title">No skills</div>
            <button class="btn btn--primary" @click="openCreate">
              <q-icon name="add" size="15px" />New Skill
            </button>
          </div>
        </template>
      </q-table>
    </div>

    <!-- Create/Edit Dialog -->
    <BaseFormDialog v-model="dialog"
      :title="editItem ? 'Edit Skill' : 'New Skill'"
      icon="extension" icon-color="#14b8a6"
      :loading="saving" width="680px" @confirm="save">
      <div style="display:flex;flex-direction:column;gap:16px">

        <!-- skill_type selector -->
        <div>
          <label class="field-label">skill_type <span style="color:var(--brand-danger)">*</span></label>
          <div class="skill-type-picker">
            <button v-for="t in skillTypes" :key="t.value"
              :class="['skill-type-pill', form.skill_type===t.value && 'skill-type-pill--active']"
              :style="form.skill_type===t.value ? `border-color:${t.color};background:${t.bg};color:${t.color}` : ''"
              @click="form.skill_type = t.value; form.capability_codes = []; form.config = defaultConfig(t.value); form.instructions = ''">
              <q-icon :name="t.icon" size="14px" />
              {{ t.label }}
            </button>
          </div>
          <div class="skill-type-desc">{{ currentType?.desc }}</div>
        </div>

        <div style="display:flex;gap:12px">
          <div style="flex:1">
            <label class="field-label">code <span style="color:var(--brand-danger)">*</span></label>
            <q-input v-model="form.code" outlined dense placeholder="hr_policy_search"
              :disable="!!editItem"
              :hint="editItem ? 'Cannot be changed after creation' : 'Unique identifier used by agents (snake_case)'" />
          </div>
          <div style="flex:1">
            <label class="field-label">name <span style="color:var(--brand-danger)">*</span></label>
            <q-input v-model="form.name" outlined dense placeholder="HR Policy Search" />
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface-overlay);border-radius:8px;border:1px solid var(--border-subtle)">
          <q-toggle v-model="form.enabled" dense />
          <div>
            <div style="font-size:13px;font-weight:500;color:var(--text-primary)">Enabled</div>
            <div style="font-size:11px;color:var(--text-tertiary)">Disabled skills are skipped during agent instruction resolution</div>
          </div>
        </div>

        <div>
          <label class="field-label">description</label>
          <q-input v-model="form.description" outlined dense type="textarea" :rows="2" />
        </div>

        <!-- capability_codes — only for MCP/CUSTOM -->
        <div v-if="['MCP','CUSTOM'].includes(form.skill_type)">
          <label class="field-label">capability_codes <span style="color:var(--brand-danger)">*</span></label>
          <q-select v-model="form.capability_codes" outlined dense multiple use-chips
            use-input new-value-mode="add-unique" :options="[]"
            hint="Press Enter to add a capability code (e.g. customer.create)" />
        </div>

        <!-- KNOWLEDGE config section -->
        <div v-if="form.skill_type === 'KNOWLEDGE'" class="knowledge-config-panel">
          <div class="knowledge-config-panel__header">
            <q-icon name="storage" size="16px" style="color:#8b5cf6" />
            <span>Knowledge Platform Config</span>
            <code class="code-tag" style="margin-left:auto;font-size:10px">KnowledgeSkillConfig</code>
          </div>

          <div style="display:flex;flex-direction:column;gap:12px;padding:16px">
            <div>
              <label class="field-label">knowledgeBaseUrl <span style="color:var(--brand-danger)">*</span></label>
              <q-input v-model="form.config.knowledgeBaseUrl" outlined dense
                placeholder="http://knowledge-platform:8080" />
              <div style="font-size:11px;color:var(--text-quaternary);margin-top:3px">
                Per-skill URL — allows multiple Knowledge Platform instances (prod/test/department)
              </div>
            </div>

            <div>
              <label class="field-label">searchApi</label>
              <q-input v-model="form.config.searchApi" outlined dense
                placeholder="/api/v1/search" />
            </div>

            <div style="display:flex;gap:12px">
              <div style="flex:1">
                <label class="field-label">collectionId <span style="color:var(--brand-danger)">*</span></label>
                <q-select
                  v-model="form.config.collectionId"
                  :options="collectionOptions"
                  outlined dense emit-value map-options clearable
                  placeholder="Select collection…"
                  :loading="loadingCollections"
                  use-input input-debounce="0"
                  @filter="filterCollections"
                >
                  <template #option="scope">
                    <q-item v-bind="scope.itemProps">
                      <q-item-section avatar>
                        <div style="width:28px;height:28px;border-radius:6px;background:rgba(245,158,11,0.1);color:#d97706;display:flex;align-items:center;justify-content:center">
                          <q-icon name="folder" size="14px" />
                        </div>
                      </q-item-section>
                      <q-item-section>
                        <q-item-label style="font-size:13px;font-weight:600">{{ scope.opt.label }}</q-item-label>
                        <q-item-label caption class="font-mono" style="font-size:10px">{{ scope.opt.value }}</q-item-label>
                      </q-item-section>
                    </q-item>
                  </template>
                  <template #selected-item="scope">
                    <div style="display:flex;align-items:center;gap:6px">
                      <q-icon name="folder" size="13px" style="color:#d97706" />
                      <span style="font-size:13px">{{ scope.opt?.label || scope.opt }}</span>
                    </div>
                  </template>
                  <template #no-option>
                    <q-item>
                      <q-item-section class="text-grey">No collections found</q-item-section>
                    </q-item>
                  </template>
                </q-select>
                <div v-if="form.config.collectionId" class="font-mono"
                  style="font-size:10px;color:var(--text-quaternary);margin-top:4px;padding:0 2px">
                  id: {{ form.config.collectionId }}
                </div>
              </div>
              <div style="flex:1">
                <label class="field-label">agentId <span style="color:var(--text-quaternary)">(optional)</span></label>
                <q-input v-model="form.config.agentId" outlined dense
                  placeholder="cb75a8f9-…" class="font-mono" />
              </div>
            </div>

            <div>
              <label class="field-label">embeddingModelCode</label>
              <q-input v-model="form.config.embeddingModelCode" outlined dense
                placeholder="Qwen/Qwen3-Embedding-0.6B" />
            </div>

            <div style="display:flex;gap:12px">
              <div style="flex:1">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                  <label class="field-label" style="margin:0">topK</label>
                  <span class="code-tag">{{ form.config.topK }}</span>
                </div>
                <q-slider v-model="form.config.topK" :min="1" :max="50" :step="1" color="deep-purple" />
              </div>
              <div style="flex:1">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                  <label class="field-label" style="margin:0">timeout (s)</label>
                  <span class="code-tag">{{ form.config.timeout }}s</span>
                </div>
                <q-slider v-model="form.config.timeout" :min="5" :max="120" :step="5" color="deep-purple" />
              </div>
            </div>

            <div class="search-toggle">
              <q-toggle v-model="form.config.stream" dense />
              <div>
                <div style="font-size:13px;font-weight:500;color:var(--text-primary)">stream</div>
                <div style="font-size:11px;color:var(--text-tertiary)">Enable streaming search response</div>
              </div>
            </div>
          </div>
        </div>

        <!-- WORKFLOW config section -->
        <div v-if="form.skill_type === 'WORKFLOW'" class="knowledge-config-panel" style="border-color:rgba(245,158,11,0.25);background:rgba(245,158,11,0.03)">
          <div class="knowledge-config-panel__header" style="background:rgba(245,158,11,0.06);border-bottom-color:rgba(245,158,11,0.15);color:#b45309">
            <q-icon name="account_tree" size="16px" style="color:#d97706" />
            <span>Workflow Trigger Config</span>
            <code class="code-tag" style="margin-left:auto;font-size:10px">WorkflowSkillConfig</code>
          </div>

          <div style="display:flex;flex-direction:column;gap:12px;padding:16px">
            <div>
              <label class="field-label">workflowCode <span style="color:var(--brand-danger)">*</span></label>
              <q-select
                v-model="form.config.workflowCode"
                :options="workflowOptions"
                outlined dense emit-value map-options clearable
                placeholder="Select workflow…"
                :loading="loadingWorkflows"
                use-input input-debounce="0"
                @filter="filterWorkflows"
              >
                <template #option="scope">
                  <q-item v-bind="scope.itemProps">
                    <q-item-section avatar>
                      <div style="width:28px;height:28px;border-radius:6px;background:rgba(245,158,11,0.1);color:#d97706;display:flex;align-items:center;justify-content:center">
                        <q-icon name="account_tree" size="14px" />
                      </div>
                    </q-item-section>
                    <q-item-section>
                      <q-item-label style="font-size:13px;font-weight:600">{{ scope.opt.label }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </template>
                <template #no-option>
                  <q-item>
                    <q-item-section class="text-grey">No workflows found</q-item-section>
                  </q-item>
                </template>
              </q-select>
              <div style="font-size:11px;color:var(--text-quaternary);margin-top:3px">
                The workflow (by code) this skill triggers when the agent invokes it — e.g. <code class="code-tag" style="font-size:10px">leave_request_flow</code>
              </div>
            </div>

            <div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                <label class="field-label" style="margin:0">maxTriggerDepth <span style="color:var(--brand-danger)">*</span></label>
                <span class="code-tag">{{ form.config.maxTriggerDepth }}</span>
              </div>
              <q-slider v-model="form.config.maxTriggerDepth" :min="1" :max="5" :step="1" color="orange" />
              <div style="font-size:11px;color:var(--text-quaternary);margin-top:3px">
                Recursion guard — caps how many nested workflow-triggers-workflow hops are allowed before the run is stopped (prevents infinite trigger loops). Default: 1.
              </div>
            </div>
          </div>
        </div>

        <!-- UI config section — Action DSL guidance instructions -->
        <div v-if="form.skill_type === 'UI'" class="knowledge-config-panel" style="border-color:rgba(236,72,153,0.25);background:rgba(236,72,153,0.03)">
          <div class="knowledge-config-panel__header" style="background:rgba(236,72,153,0.06);border-bottom-color:rgba(236,72,153,0.15);color:#be185d">
            <q-icon name="touch_app" size="16px" style="color:#ec4899" />
            <span>UI Action Instructions</span>
            <code class="code-tag" style="margin-left:auto;font-size:10px">propose_ui_action</code>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px;padding:16px">
            <div>
              <label class="field-label">instructions <span style="color:var(--brand-danger)">*</span></label>
              <textarea v-model="form.instructions" class="ui-instructions-textarea" rows="6"
                placeholder="Khi nhân viên mô tả nhu cầu nghỉ phép bằng lời, hãy dùng tool propose_ui_action để điền các field trên form leave-request-form (leave.startDate, leave.endDate, leave.reason, leave.type). KHÔNG tự ý bấm nút submit (leave.submit) — chỉ điền, để nhân viên tự xác nhận và bấm gửi." />
            </div>
            <div class="ui-hint-box">
              <q-icon name="info" size="16px" style="color:#ec4899;flex-shrink:0" />
              <div>
                Guides the agent to call <code class="code-tag" style="font-size:10px">propose_ui_action</code> and target
                <strong>UI Metadata component codes</strong> (e.g. <code class="code-tag" style="font-size:10px">leave.startDate</code>) —
                never raw CSS selectors. Be explicit about which actions are allowed (e.g. <code class="code-tag" style="font-size:10px">SET_VALUE</code>)
                and which are off-limits (e.g. <code class="code-tag" style="font-size:10px">CLICK_BUTTON</code> on a submit target) so the agent fills
                the form but leaves confirmation to the human. See the Business Objects / UI Metadata browsers to look up exact component codes.
              </div>
            </div>
          </div>
        </div>

        <div v-if="apiError" class="api-error-box">
          <q-icon name="error_outline" size="16px" />{{ apiError }}
        </div>
      </div>
    </BaseFormDialog>

    <!-- Test dialog — POST /skills/{id}/test -->
    <q-dialog v-model="testDialog">
      <q-card style="width:600px;max-width:96vw;border-radius:12px">
        <div class="dialog-header">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="dialog-header__icon" style="background:#8b5cf6">
              <q-icon name="science" size="16px" style="color:white" />
            </div>
            <div>
              <div class="dialog-header__title">Test Knowledge Skill</div>
              <div class="dialog-header__subtitle">POST /skills/{{ testSkill?.id }}/test</div>
            </div>
          </div>
          <button class="dialog-header__close" @click="testDialog=false">
            <q-icon name="close" size="18px" />
          </button>
        </div>
        <div style="padding:20px;display:flex;flex-direction:column;gap:14px">
          <!-- Skill info -->
          <div v-if="testSkill" class="knowledge-config-panel" style="border-radius:8px">
            <div class="knowledge-config-panel__header">
              <q-icon name="extension" size="14px" style="color:#8b5cf6" />
              <span class="font-mono" style="font-size:12px">{{ testSkill.name }}</span>
              <span class="code-tag" style="margin-left:8px;font-size:10px">
                {{ collectionLabel(testSkill.config?.collectionId) }}
              </span>
            </div>
          </div>

          <div>
            <label class="field-label">query <span style="color:var(--brand-danger)">*</span></label>
            <div class="search-query-box" :class="{ 'search-query-box--focus': testQueryFocus }">
              <textarea v-model="testQuery" class="search-query-textarea" rows="3"
                placeholder="How many vacation days do I get?"
                @focus="testQueryFocus=true" @blur="testQueryFocus=false"
                @keydown.ctrl.enter.prevent="runTest" />
              <div class="search-query-hint">Ctrl+Enter to test</div>
            </div>
          </div>

          <button class="btn btn--primary" style="width:100%" :disabled="!testQuery.trim() || testing" @click="runTest">
            <q-spinner v-if="testing" size="14px" style="color:white" />
            <q-icon v-else name="play_arrow" size="16px" />
            {{ testing ? 'Testing…' : 'Run Test' }}
          </button>

          <!-- Result -->
          <template v-if="testResult">
            <div style="display:flex;align-items:center;gap:8px">
              <span class="badge" :class="testResult.ok ? 'badge--active' : 'badge--error'">
                {{ testResult.ok ? 'OK' : 'FAILED' }}
              </span>
              <span class="code-tag">{{ testResult.chunk_count ?? 0 }} chunks</span>
              <span class="code-tag">{{ testResult.latency_ms }}ms</span>
            </div>

            <div v-if="testResult.error" class="api-error-box">
              <q-icon name="error_outline" size="16px" />{{ testResult.error }}
            </div>

            <div v-if="testResult.context">
              <label class="field-label" style="margin-bottom:6px;display:block">Knowledge Context</label>
              <pre class="code-block" style="font-size:12px;max-height:280px;overflow-y:auto">{{ testResult.context }}</pre>
            </div>
          </template>
        </div>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script>
import { defineComponent, ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { agnoClient } from '../../../services/api/agno-runtime.client.js'
import { knowledgeClient } from '../../../services/api/knowledge-platform.client.js'
import { useUIStore } from '../../../stores/ui.store.js'
import BaseFormDialog from '../../../shared/components/BaseFormDialog.vue'

export default defineComponent({
  name: 'SkillsPage',
  components: { BaseFormDialog },
  setup() {
    const $q = useQuasar()
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'AI Platform' }, { label: 'Skills' }])

    const rows = ref([]), loading = ref(false), saving = ref(false), filterType = ref(null)
    const dialog = ref(false), editItem = ref(null), apiError = ref('')
    const allCollections = ref([]), collectionOptions = ref([]), loadingCollections = ref(false)
    const allWorkflows = ref([]), workflowOptions = ref([]), loadingWorkflows = ref(false)
    const testDialog = ref(false), testSkill = ref(null), testQuery = ref('')
    const testQueryFocus = ref(false), testing = ref(false), testResult = ref(null)
    const pagination = ref({ page: 1, rowsPerPage: 50, rowsNumber: 0 })

    const skillTypes = [
      { value: 'MCP', label: 'MCP', icon: 'extension', color: '#14b8a6', bg: 'rgba(20,184,166,0.08)', desc: 'Executes via MCP Gateway capability codes — POST /execute' },
      { value: 'KNOWLEDGE', label: 'Knowledge', icon: 'storage', color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', desc: 'Searches a Knowledge Platform collection and injects context into agent instructions' },
      { value: 'WORKFLOW', label: 'Workflow', icon: 'account_tree', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', desc: 'Triggers a workflow execution' },
      { value: 'PROMPT', label: 'Prompt', icon: 'article', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', desc: 'Injects a prompt template as additional instructions' },
      { value: 'UI', label: 'UI', icon: 'touch_app', color: '#ec4899', bg: 'rgba(236,72,153,0.08)', desc: 'Guides the agent to propose UI Actions (Action DSL) via the propose_ui_action tool — fills/interacts with a specific form without submitting it' },
      { value: 'CUSTOM', label: 'Custom', icon: 'code', color: '#6b7280', bg: 'rgba(107,114,128,0.08)', desc: 'Custom executor via capability codes' }
    ]

    const skillTypeOptions = [
      { label: 'All types', value: null },
      ...skillTypes.map(t => ({ label: t.label, value: t.value }))
    ]

    const currentType = computed(() => skillTypes.find(t => t.value === form.value.skill_type))

    const skillTypeIcon = (type) => skillTypes.find(t => t.value === type)?.icon || 'extension'

    function defaultConfig(type) {
      if (type === 'KNOWLEDGE') {
        return {
          knowledgeBaseUrl: '',
          searchApi: '/api/v1/search',
          collectionId: '',
          agentId: '',
          embeddingModelCode: '',
          topK: 15,
          timeout: 30,
          stream: false
        }
      }
      if (type === 'WORKFLOW') {
        return {
          workflowCode: '',
          maxTriggerDepth: 1
        }
      }
      return {}
    }

    const defaultForm = () => ({
      code: '', name: '', description: '', skill_type: 'MCP',
      capability_codes: [], config: {}, instructions: '', enabled: true
    })
    const form = ref(defaultForm())

    const columns = [
      { name: 'name', label: 'Name', field: 'name', align: 'left', sortable: true },
      { name: 'skill_type', label: 'Type', field: 'skill_type', align: 'left' },
      { name: 'capability_codes', label: 'Capabilities / Config', field: 'capability_codes', align: 'left' },
      { name: 'actions', label: '', field: 'actions', align: 'right' }
    ]

    async function loadCollections() {
      loadingCollections.value = true
      try {
        const cols = await knowledgeClient.listCollections()
        allCollections.value = cols.map(c => ({ label: c.name, value: c.id, code: c.code }))
        collectionOptions.value = [...allCollections.value]
      } catch { allCollections.value = []; collectionOptions.value = [] }
      finally { loadingCollections.value = false }
    }

    function collectionLabel(id) {
      if (!id) return '—'
      const found = allCollections.value.find(c => c.value === id)
      return found ? found.label : id.substring(0, 14) + '…'
    }

    function filterCollections(val, update) {
      update(() => {
        if (!val) { collectionOptions.value = [...allCollections.value]; return }
        const q = val.toLowerCase()
        collectionOptions.value = allCollections.value.filter(
          c => c.label.toLowerCase().includes(q) || (c.code || '').toLowerCase().includes(q)
        )
      })
    }

    async function loadWorkflows() {
      loadingWorkflows.value = true
      try {
        // GET /workflows — same listing used by WorkflowsPage.vue's step builder
        const res = await agnoClient.listWorkflows({ page_size: 100 })
        allWorkflows.value = res.items.map(w => ({ label: `${w.name} (${w.code})`, value: w.code }))
        workflowOptions.value = [...allWorkflows.value]
      } catch { allWorkflows.value = []; workflowOptions.value = [] }
      finally { loadingWorkflows.value = false }
    }

    function workflowLabel(code) {
      if (!code) return '—'
      const found = allWorkflows.value.find(w => w.value === code)
      return found ? found.label : code
    }

    function filterWorkflows(val, update) {
      update(() => {
        if (!val) { workflowOptions.value = [...allWorkflows.value]; return }
        const q = val.toLowerCase()
        workflowOptions.value = allWorkflows.value.filter(w => w.label.toLowerCase().includes(q))
      })
    }

    async function loadData() {
      loading.value = true
      try {
        const res = await agnoClient.listSkills({
          page: pagination.value.page,
          page_size: pagination.value.rowsPerPage,
          ...(filterType.value ? { skill_type: filterType.value } : {})
        })
        rows.value = res.items
        pagination.value.rowsNumber = res.total
      } catch { $q.notify({ type: 'negative', message: 'Failed to load skills' }) }
      finally { loading.value = false }
    }

    function onRequest(req) {
      pagination.value.page = req.pagination.page
      pagination.value.rowsPerPage = req.pagination.rowsPerPage
      loadData()
    }

    function openCreate() {
      editItem.value = null; apiError.value = ''
      form.value = defaultForm()
      dialog.value = true
    }

    function openEdit(item) {
      editItem.value = item; apiError.value = ''
      form.value = {
        code: item.code || '',
        name: item.name,
        description: item.description || '',
        skill_type: item.skill_type || 'MCP',
        capability_codes: [...(item.capability_codes || [])],
        config: item.config ? { ...defaultConfig(item.skill_type || 'MCP'), ...item.config } : defaultConfig(item.skill_type || 'MCP'),
        instructions: item.instructions || '',
        enabled: item.enabled !== undefined ? item.enabled : true
      }
      dialog.value = true
    }

    async function save() {
      if (!form.value.name || !form.value.skill_type) {
        apiError.value = 'name and skill_type are required'; return
      }
      if (!editItem.value && !form.value.code) {
        apiError.value = 'code is required'; return
      }
      if (['MCP', 'CUSTOM'].includes(form.value.skill_type) && !form.value.capability_codes.length) {
        apiError.value = 'At least one capability_code is required for MCP/CUSTOM skills'; return
      }
      if (form.value.skill_type === 'KNOWLEDGE') {
        if (!form.value.config.knowledgeBaseUrl || !form.value.config.collectionId) {
          apiError.value = 'knowledgeBaseUrl and collectionId are required for Knowledge skills'; return
        }
      }
      if (form.value.skill_type === 'WORKFLOW') {
        if (!form.value.config.workflowCode) {
          apiError.value = 'workflowCode is required for Workflow skills'; return
        }
        if (!form.value.config.maxTriggerDepth || form.value.config.maxTriggerDepth < 1) {
          apiError.value = 'maxTriggerDepth must be at least 1'; return
        }
      }
      if (form.value.skill_type === 'UI' && !form.value.instructions.trim()) {
        apiError.value = 'instructions is required for UI skills'; return
      }
      saving.value = true; apiError.value = ''
      try {
        const payload = {
          ...(editItem.value ? {} : { code: form.value.code }),
          name: form.value.name,
          description: form.value.description,
          skill_type: form.value.skill_type,
          enabled: form.value.enabled,
          ...((['MCP', 'CUSTOM'].includes(form.value.skill_type)) ? { capability_codes: form.value.capability_codes } : {}),
          ...((['KNOWLEDGE', 'WORKFLOW'].includes(form.value.skill_type)) ? { config: form.value.config } : {}),
          ...(form.value.skill_type === 'UI' ? { instructions: form.value.instructions } : {})
        }
        if (editItem.value) await agnoClient.updateSkill(editItem.value.id, payload)
        else await agnoClient.createSkill(payload)
        $q.notify({ type: 'positive', message: `Skill ${editItem.value ? 'updated' : 'created'}` })
        dialog.value = false; loadData()
      } catch (e) { apiError.value = e.response?.data?.detail || 'Save failed' }
      finally { saving.value = false }
    }

    function openTest(skill) {
      testSkill.value = skill
      testQuery.value = ''
      testResult.value = null
      testDialog.value = true
    }

    async function runTest() {
      if (!testSkill.value || !testQuery.value.trim()) return
      testing.value = true; testResult.value = null
      try {
        // POST /api/v1/skills/{id}/test  { query }
        testResult.value = await agnoClient.testSkill(testSkill.value.id, testQuery.value)
      } catch (e) {
        testResult.value = {
          ok: false,
          error: e.response?.data?.detail || e.message,
          chunk_count: 0,
          latency_ms: 0,
          context: null
        }
      } finally { testing.value = false }
    }

    function confirmDelete(item) {
      $q.dialog({ title: 'Delete Skill', message: `Delete "${item.name}"?`, cancel: { label: 'Cancel', flat: true }, ok: { label: 'Delete', color: 'negative', unelevated: true } })
        .onOk(async () => { await agnoClient.deleteSkill(item.id); loadData() })
    }

    onMounted(() => { loadData(); loadCollections(); loadWorkflows() })
    return { rows, columns, loading, saving, filterType, skillTypeOptions, dialog, editItem, form, apiError, pagination, skillTypes, currentType, skillTypeIcon, defaultConfig, allCollections, collectionOptions, loadingCollections, collectionLabel, filterCollections, allWorkflows, workflowOptions, loadingWorkflows, workflowLabel, filterWorkflows, testDialog, testSkill, testQuery, testQueryFocus, testing, testResult, loadData, onRequest, openCreate, openEdit, save, openTest, runTest, confirmDelete }
  }
})
</script>

<style lang="scss">
.skill-type-picker {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.skill-type-pill {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 99px;
  border: 1.5px solid var(--border-default);
  background: var(--surface-raised);
  color: var(--text-tertiary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 120ms ease;
  font-family: var(--font-sans);
  white-space: nowrap;

  &:hover { border-color: var(--border-strong); color: var(--text-primary); }
  &--active { font-weight: 700; }
}

.skill-type-desc {
  font-size: 11px;
  color: var(--text-quaternary);
  margin-top: 6px;
  line-height: 1.5;
  min-height: 16px;
}

.skill-type-icon {
  width: 30px; height: 30px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;

  &--mcp      { background: rgba(20,184,166,0.1); color: #14b8a6; }
  &--knowledge { background: rgba(139,92,246,0.1); color: #8b5cf6; }
  &--workflow  { background: rgba(245,158,11,0.1); color: #d97706; }
  &--prompt    { background: rgba(59,130,246,0.1); color: #3b82f6; }
  &--ui        { background: rgba(236,72,153,0.1); color: #ec4899; }
  &--custom    { background: var(--surface-sunken); color: var(--text-tertiary); }
}

.skill-type-badge {
  display: inline-block;
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; padding: 2px 7px; border-radius: 99px;

  &--mcp      { background: rgba(20,184,166,0.1); color: #14b8a6; }
  &--knowledge { background: rgba(139,92,246,0.1); color: #8b5cf6; }
  &--workflow  { background: rgba(245,158,11,0.1); color: #d97706; }
  &--prompt    { background: rgba(59,130,246,0.1); color: #3b82f6; }
  &--ui        { background: rgba(236,72,153,0.1); color: #ec4899; }
  &--custom    { background: var(--surface-sunken); color: var(--text-tertiary); }
}

.knowledge-config-panel {
  border: 1.5px solid rgba(139,92,246,0.25);
  border-radius: 10px;
  background: rgba(139,92,246,0.03);
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 10px 14px;
    background: rgba(139,92,246,0.06);
    border-bottom: 1px solid rgba(139,92,246,0.15);
    font-size: 12px;
    font-weight: 600;
    color: #7c3aed;
  }
}

.body--dark .knowledge-config-panel {
  border-color: rgba(139,92,246,0.3);
  background: rgba(139,92,246,0.05);
  &__header { background: rgba(139,92,246,0.1); color: #a78bfa; }
}

.ui-instructions-textarea {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.7;
  resize: vertical;
  outline: none;
  background: var(--surface-base);
  color: var(--text-primary);

  &:focus { border-color: #ec4899; box-shadow: 0 0 0 3px rgba(236,72,153,0.15); }
}

.ui-hint-box {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--surface-overlay);
  border: 1px solid var(--border-subtle);
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--text-secondary);
}
</style>