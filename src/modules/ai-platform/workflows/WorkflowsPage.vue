<template>
  <BaseCrudPage
    title="Workflows"
    subtitle="Thiết kế và quản lý workflow tuần tự (Step 1 → Step 2 → … → Step N)"
    entity-name="Workflow"
    :rows="rows"
    :columns="columns"
    :loading="loading"
    @create="openCreate"
    @edit="openEdit"
    @delete="confirmDelete"
    @refresh="loadData"
    @search="q => { search = q; loadData() }"
  >
    <template #filters>
      <div class="col-auto">
        <q-select v-model="filterAgentOS" :options="agentOSOptions" label="AgentOS" outlined dense
          clearable emit-value map-options style="min-width:160px" @update:model-value="loadData" />
      </div>
    </template>

    <template #body-cell-name="props">
      <q-td :props="props">
        <div class="text-weight-medium">{{ props.row.name }}</div>
        <div class="text-caption text-grey-6 code-mono">code: {{ props.row.code }}</div>
        <div v-if="props.row.steps?.length" class="text-caption text-grey-5">{{ props.row.steps.length }} bước</div>
      </q-td>
    </template>

    <template #body-cell-steps="props">
      <q-td :props="props">
        <div class="row q-gutter-xs">
          <q-avatar v-for="(s, i) in (props.row.steps || []).slice(0, 4)" :key="i"
            size="22px" color="blue-1" text-color="blue-8" style="border-radius:4px;font-size:10px;font-weight:700">
            {{ i + 1 }}
          </q-avatar>
          <q-avatar v-if="(props.row.steps || []).length > 4" size="22px" color="grey-2" text-color="grey-7"
            style="border-radius:4px;font-size:10px">+{{ props.row.steps.length - 4 }}</q-avatar>
        </div>
      </q-td>
    </template>

    <template #body-cell-actions="props">
      <q-td :props="props" auto-width>
        <q-btn flat round dense icon="account_tree" size="sm" color="primary"
          :to="`/ai/workflows/${props.row.id}/builder`" class="q-mr-xs">
          <q-tooltip>Mở Builder</q-tooltip>
        </q-btn>
        <q-btn flat round dense icon="play_arrow" size="sm" color="positive" class="q-mr-xs"
          @click="runWorkflow(props.row)">
          <q-tooltip>Chạy workflow</q-tooltip>
        </q-btn>
        <q-btn flat round dense icon="history" size="sm" color="grey" class="q-mr-xs"
          @click="viewRuns(props.row)">
          <q-tooltip>Lịch sử runs</q-tooltip>
        </q-btn>
        <q-btn flat round dense icon="more_vert" size="sm">
          <q-menu>
            <q-list style="min-width:160px">
              <q-item clickable v-close-popup @click="openEdit(props.row)">
                <q-item-section avatar><q-icon name="edit" /></q-item-section>
                <q-item-section>Sửa thông tin</q-item-section>
              </q-item>
              <q-item clickable v-close-popup :to="`/ai/workflows/${props.row.id}/builder`">
                <q-item-section avatar><q-icon name="account_tree" /></q-item-section>
                <q-item-section>Mở Builder</q-item-section>
              </q-item>
              <q-item clickable v-close-popup :to="`/ai/workflows/${props.row.id}`">
                <q-item-section avatar><q-icon name="schedule" /></q-item-section>
                <q-item-section>Schedules & Webhooks</q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="viewRuns(props.row)">
                <q-item-section avatar><q-icon name="history" /></q-item-section>
                <q-item-section>Lịch sử runs</q-item-section>
              </q-item>
              <q-separator />
              <q-item clickable v-close-popup class="text-red" @click="confirmDelete(props.row)">
                <q-item-section avatar><q-icon name="delete" color="red" /></q-item-section>
                <q-item-section>Xóa</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </q-td>
    </template>
  </BaseCrudPage>

  <!-- Create/Edit Dialog -->
  <BaseFormDialog v-model="dialog" :title="editItem ? 'Sửa Workflow' : 'Tạo Workflow mới'"
    icon="account_tree" :loading="saving" width="700px" @confirm="save">
    <div class="q-gutter-md">
      <div class="row q-col-gutter-md">
        <div class="col-7"><q-input v-model="form.name" label="Tên Workflow *" outlined dense /></div>
        <div class="col-5"><q-input v-model="form.code" label="Code (duy nhất) *" outlined dense :disable="!!editItem" /></div>
      </div>
      <q-select v-model="form.agent_os_id" label="AgentOS *" outlined dense
        :options="agentOSOptions" emit-value map-options />
      <q-input v-model="form.description" label="Mô tả" outlined dense type="textarea" rows="2" />

      <!-- Steps builder -->
      <div>
        <div class="row items-center q-mb-sm">
          <div class="text-subtitle2">Các bước (steps)</div>
          <q-space />
          <q-btn flat dense icon="add" label="Thêm bước" size="sm" @click="addStep" />
        </div>
        <div class="text-caption text-grey-6 q-mb-sm">Thứ tự tuần tự: Step 1 → Step 2 → … Mỗi bước gọi một Agent hoặc Team.</div>
        <div v-for="(step, i) in form.steps" :key="i"
          class="row items-center q-col-gutter-sm q-mb-sm enterprise-card q-pa-sm" style="border-radius:8px">
          <div class="col-auto">
            <q-avatar size="28px" color="primary" text-color="white" style="border-radius:6px;font-size:12px;font-weight:700">
              {{ i + 1 }}
            </q-avatar>
          </div>
          <div class="col-4">
            <q-select v-model="step.targetType" :options="['Agent','Team']" outlined dense label="Loại" />
          </div>
          <div class="col">
            <q-select v-if="step.targetType === 'Agent'" v-model="step.agentCode"
              :options="agentCodeOptions" outlined dense label="Agent Code" emit-value map-options />
            <q-select v-else v-model="step.teamCode"
              :options="teamCodeOptions" outlined dense label="Team Code" emit-value map-options />
          </div>
          <div class="col-auto">
            <q-btn flat round dense icon="remove" color="red" size="sm" @click="removeStep(i)" />
          </div>
        </div>
        <div v-if="!form.steps.length" class="text-grey text-center q-py-md text-caption">
          Chưa có bước nào — bấm "Thêm bước"
        </div>
      </div>
    </div>
  </BaseFormDialog>

  <!-- Workflow Runs Dialog -->
  <q-dialog v-model="runsDialog" style="max-width:900px">
    <q-card style="width:900px;max-width:95vw;border-radius:12px">
      <q-card-section class="row items-center" style="border-bottom:1px solid rgba(0,0,0,0.08)">
        <q-icon name="history" color="primary" size="20px" class="q-mr-sm" />
        <div class="text-subtitle1 text-weight-bold">Workflow Runs — {{ selectedWf?.name }}</div>
        <q-space />
        <q-btn flat round icon="close" v-close-popup />
      </q-card-section>
      <q-scroll-area style="height:500px">
        <q-table :rows="workflowRuns" :columns="runCols" flat dense row-key="id" :loading="loadingRuns" class="enterprise-table">
          <template #body-cell-status="props">
            <q-td :props="props">
              <span class="status-badge" :class="runStatusClass(props.value)">{{ props.value }}</span>
            </q-td>
          </template>
          <template #body-cell-actions="props">
            <q-td :props="props" auto-width>
              <q-btn flat round dense icon="visibility" size="sm" @click="viewRunDetail(props.row)" />
            </q-td>
          </template>
        </q-table>
      </q-scroll-area>
    </q-card>
  </q-dialog>

  <!-- Run Detail Dialog -->
  <q-dialog v-model="runDetailDialog" style="max-width:700px">
    <q-card v-if="selectedRun" style="width:700px;max-width:95vw;border-radius:12px">
      <q-card-section class="row items-center" style="border-bottom:1px solid rgba(0,0,0,0.08)">
        <div class="text-subtitle1 text-weight-bold">Run Detail</div>
        <q-space />
        <span class="status-badge q-mr-md" :class="runStatusClass(selectedRun.status)">{{ selectedRun.status }}</span>
        <q-btn flat round icon="close" v-close-popup />
      </q-card-section>
      <q-tabs v-model="runTab" dense align="left" style="border-bottom:1px solid rgba(0,0,0,0.08)">
        <q-tab name="steps" label="Steps" icon="list" />
        <q-tab name="events" label="Events" icon="event_note" />
        <q-tab name="io" label="Input/Output" icon="swap_horiz" />
      </q-tabs>
      <q-tab-panels v-model="runTab" animated style="max-height:420px;overflow-y:auto">
        <q-tab-panel name="steps" class="q-pa-md">
          <div v-for="step in runSteps" :key="step.id" class="q-mb-sm">
            <div class="enterprise-card" style="border-radius:8px;padding:12px">
              <div class="row items-center q-mb-xs">
                <q-avatar size="24px" color="primary" text-color="white" style="border-radius:4px;font-size:11px;font-weight:700">{{ step.order }}</q-avatar>
                <div class="q-ml-sm text-weight-medium">{{ step.agent_id || step.team_id || `Step ${step.order}` }}</div>
                <q-space />
                <span class="status-badge" :class="runStatusClass(step.status)">{{ step.status }}</span>
              </div>
              <div v-if="step.output" class="code-mono text-grey-6" style="font-size:11px;white-space:pre-wrap">
                {{ JSON.stringify(step.output).substring(0, 200) }}
              </div>
            </div>
          </div>
          <div v-if="!runSteps.length" class="text-grey text-center q-py-md">Chưa có step data</div>
        </q-tab-panel>
        <q-tab-panel name="events" class="q-pa-md">
          <div v-for="ev in runEvents" :key="ev.id" class="q-mb-xs">
            <div class="enterprise-card" style="border-radius:8px;padding:8px 12px">
              <div class="row items-center">
                <q-chip dense size="xs" color="blue-1" text-color="blue-8" :label="ev.type" />
                <q-space />
                <span class="text-caption text-grey-5">{{ dayjs(ev.created_at).format('HH:mm:ss') }}</span>
              </div>
            </div>
          </div>
          <div v-if="!runEvents.length" class="text-grey text-center q-py-md">Không có events</div>
        </q-tab-panel>
        <q-tab-panel name="io" class="q-pa-md">
          <div class="text-caption text-grey-6 q-mb-xs">Input</div>
          <pre class="code-mono" style="background:#1e1e1e;color:#d4d4d4;border-radius:8px;padding:12px;font-size:11px;white-space:pre-wrap">{{ JSON.stringify(selectedRun.input, null, 2) || 'null' }}</pre>
          <div class="text-caption text-grey-6 q-mt-md q-mb-xs">Result</div>
          <pre class="code-mono" style="background:#1e1e1e;color:#d4d4d4;border-radius:8px;padding:12px;font-size:11px;white-space:pre-wrap">{{ JSON.stringify(selectedRun.result, null, 2) || 'null' }}</pre>
        </q-tab-panel>
      </q-tab-panels>
    </q-card>
  </q-dialog>
</template>

<script>
import { defineComponent, ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { agnoClient } from '../../../services/api/agno-runtime.client'
import { useUIStore } from '../../../stores/ui.store'
import BaseCrudPage from '../../../shared/components/BaseCrudPage.vue'
import BaseFormDialog from '../../../shared/components/BaseFormDialog.vue'
import dayjs from 'dayjs'

export default defineComponent({
  name: 'WorkflowsPage',
  components: { BaseCrudPage, BaseFormDialog },
  setup() {
    const $q = useQuasar()
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'AI Platform' }, { label: 'Workflows' }])

    const rows = ref([]), loading = ref(false), saving = ref(false)
    const search = ref(''), filterAgentOS = ref(null)
    const agentOSOptions = ref([]), agentCodeOptions = ref([]), teamCodeOptions = ref([])
    const dialog = ref(false), editItem = ref(null)
    const runsDialog = ref(false), runDetailDialog = ref(false)
    const selectedWf = ref(null), workflowRuns = ref([]), loadingRuns = ref(false)
    const selectedRun = ref(null), runSteps = ref([]), runEvents = ref([]), runTab = ref('steps')

    const defaultForm = () => ({ name: '', code: '', agent_os_id: null, description: '', steps: [] })
    const form = ref(defaultForm())

    const columns = [
      { name: 'name', label: 'Tên / Code', field: 'name', align: 'left', sortable: true },
      { name: 'steps', label: 'Steps', field: 'steps', align: 'left' },
      { name: 'status', label: 'Status', field: 'status', align: 'left' },
      { name: 'created_at', label: 'Ngày tạo', field: 'created_at', align: 'left', format: v => dayjs(v).format('YYYY-MM-DD') },
      { name: 'actions', label: '', field: 'actions', align: 'right' }
    ]

    const runCols = [
      { name: 'id', label: 'Run ID', field: 'id', align: 'left', format: v => v?.substring(0, 16) + '…' },
      { name: 'status', label: 'Status', field: 'status', align: 'left' },
      { name: 'created_at', label: 'Thời gian', field: 'created_at', align: 'left', format: v => dayjs(v).format('YYYY-MM-DD HH:mm:ss') },
      { name: 'actions', label: '', field: 'actions', align: 'right' }
    ]

    const runStatusClass = s => ({
      completed: 'status-active', success: 'status-active',
      running: 'status-running', failed: 'status-error', error: 'status-error'
    })[s] || 'status-pending'

    async function loadData() {
      loading.value = true
      try {
        const res = await agnoClient.listWorkflows({
          agent_os_id: filterAgentOS.value || undefined,
          page: 1, page_size: 100
        })
        rows.value = res.items
      } catch { $q.notify({ type: 'negative', message: 'Lỗi tải workflows' }) }
      finally { loading.value = false }
    }

    async function loadMeta() {
      const [aos, agents, teams] = await Promise.allSettled([
        agnoClient.listAgentOS({ page_size: 100 }),
        agnoClient.listAgents({ page_size: 100 }),
        agnoClient.listTeams({ page_size: 100 })
      ])
      if (aos.status === 'fulfilled') agentOSOptions.value = aos.value.items.map(a => ({ label: a.name, value: a.id }))
      if (agents.status === 'fulfilled') agentCodeOptions.value = agents.value.items.map(a => ({ label: `${a.code} (${a.name})`, value: a.code }))
      if (teams.status === 'fulfilled') teamCodeOptions.value = teams.value.items.map(t => ({ label: `${t.code} (${t.name})`, value: t.code }))
    }

    function openCreate() {
      editItem.value = null
      form.value = defaultForm()
      dialog.value = true
    }

    function openEdit(wf) {
      editItem.value = wf
      form.value = {
        name: wf.name, code: wf.code, agent_os_id: wf.agent_os_id,
        description: wf.description || '',
        steps: (wf.steps || []).map(s => ({
          targetType: s.agentCode ? 'Agent' : 'Team',
          agentCode: s.agentCode || null,
          teamCode: s.teamCode || null
        }))
      }
      dialog.value = true
    }

    function addStep() {
      form.value.steps.push({ targetType: 'Agent', agentCode: null, teamCode: null })
    }

    function removeStep(i) { form.value.steps.splice(i, 1) }

    async function save() {
      if (!form.value.name || !form.value.code || !form.value.agent_os_id) {
        $q.notify({ type: 'warning', message: 'Vui lòng điền đầy đủ thông tin bắt buộc' }); return
      }
      saving.value = true
      try {
        const steps = form.value.steps.map((s, i) => ({
          order: i + 1,
          ...(s.targetType === 'Agent' ? { agentCode: s.agentCode } : { teamCode: s.teamCode })
        }))
        const payload = { name: form.value.name, code: form.value.code, agent_os_id: form.value.agent_os_id, description: form.value.description, steps }
        if (editItem.value) {
          await agnoClient.updateWorkflow(editItem.value.id, payload)
          $q.notify({ type: 'positive', message: 'Đã cập nhật — steps mới ghi đè hoàn toàn (wholesale replacement)' })
        } else {
          await agnoClient.createWorkflow(payload)
          $q.notify({ type: 'positive', message: 'Workflow đã được tạo' })
        }
        dialog.value = false; loadData()
      } catch (e) {
        const ec = e.response?.data?.error_code
        if (ec === 'conflict') $q.notify({ type: 'negative', message: 'Code workflow đã tồn tại (409 Conflict)' })
        else $q.notify({ type: 'negative', message: e.response?.data?.message || 'Lưu thất bại' })
      } finally { saving.value = false }
    }

    function confirmDelete(wf) {
      $q.dialog({ title: 'Xóa Workflow', message: `Xóa "${wf.name}"?`, cancel: { label: 'Hủy' }, ok: { color: 'red', label: 'Xóa', unelevated: true } })
        .onOk(async () => {
          try { await agnoClient.deleteWorkflow(wf.id); $q.notify({ type: 'positive', message: 'Đã xóa' }); loadData() }
          catch (e) { $q.notify({ type: 'negative', message: e.response?.data?.message || 'Xóa thất bại' }) }
        })
    }

    async function runWorkflow(wf) {
      $q.dialog({ title: 'Chạy Workflow', message: 'Input JSON (có thể để trống):', prompt: { model: '{}', type: 'textarea' }, cancel: { label: 'Hủy' }, ok: { color: 'positive', label: 'Run', unelevated: true } })
        .onOk(async val => {
          try {
            let input = {}
            try { input = JSON.parse(val) } catch {}
            const run = await agnoClient.runWorkflow(wf.id, input)
            $q.notify({ type: 'positive', message: `Workflow đã chạy — status: ${run.status}` })
          } catch (e) { $q.notify({ type: 'negative', message: e.response?.data?.message || 'Chạy thất bại' }) }
        })
    }

    async function viewRuns(wf) {
      selectedWf.value = wf; runsDialog.value = true; loadingRuns.value = true; workflowRuns.value = []
      try {
        const res = await agnoClient.listWorkflowRuns({ workflow_id: wf.id, page_size: 50 })
        workflowRuns.value = res.items
      } catch { workflowRuns.value = [] }
      finally { loadingRuns.value = false }
    }

    async function viewRunDetail(run) {
      selectedRun.value = run; runTab.value = 'steps'
      runSteps.value = []; runEvents.value = []
      runDetailDialog.value = true
      const [steps, events] = await Promise.allSettled([
        agnoClient.getWorkflowRunSteps(run.id),
        agnoClient.getWorkflowRunEvents(run.id)
      ])
      if (steps.status === 'fulfilled') runSteps.value = steps.value
      if (events.status === 'fulfilled') runEvents.value = events.value
    }

    onMounted(() => { loadData(); loadMeta() })

    return {
      rows, columns, loading, saving, search, filterAgentOS, agentOSOptions, agentCodeOptions, teamCodeOptions,
      dialog, editItem, form, runsDialog, runDetailDialog, selectedWf, workflowRuns, loadingRuns,
      selectedRun, runSteps, runEvents, runTab, runCols, runStatusClass, dayjs,
      loadData, openCreate, openEdit, addStep, removeStep, save, confirmDelete, runWorkflow, viewRuns, viewRunDetail
    }
  }
})
</script>