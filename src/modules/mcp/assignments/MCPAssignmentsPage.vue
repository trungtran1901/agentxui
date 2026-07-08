<template>
  <q-page class="q-pa-lg">
    <div class="row items-center q-mb-lg">
      <div>
        <div class="text-h5 text-weight-bold">Capability Assignments</div>
        <div style="color:var(--text-tertiary);font-size:12px;margin-top:2px">
          POST /api/v1/capabilities/assignments (Agno Runtime) · capability codes come from MCP Gateway — GET /api/v1/capabilities
        </div>
      </div>
      <q-space />
      <q-btn outline no-caps icon="refresh" label="Refresh" :loading="loadingCaps" @click="loadAllCapabilities"
        style="color:var(--brand-primary);border-color:var(--brand-primary);border-radius:8px" />
    </div>

    <q-tabs v-model="mainTab" dense no-caps class="q-mb-md" align="left"
      active-color="var(--brand-primary)" indicator-color="var(--brand-primary)">
      <q-tab name="assign" label="Assign" icon="rule_folder" />
      <q-tab name="resolve" label="Resolve Effective" icon="account_tree" />
    </q-tabs>
    <q-separator class="q-mb-lg" />

    <!-- ===================== ASSIGN TAB ===================== -->
    <div v-show="mainTab === 'assign'">
      <q-card flat bordered class="q-mb-md" style="border-radius:12px">
        <q-card-section>
          <div class="row q-col-gutter-sm items-center">
            <div class="col-auto">
              <q-select v-model="level" :options="levelOptions" outlined dense emit-value map-options
                label="Level" style="min-width:140px" @update:model-value="onLevelChange" />
            </div>

            <div class="col-auto" v-if="level === 'agent_os' || level === 'team' || level === 'agent'">
              <q-select v-model="selAgentOS" :options="agentOSOptions" outlined dense emit-value map-options
                clearable label="AgentOS" style="min-width:180px" @update:model-value="onAgentOSChange" />
            </div>
            <div class="col-auto" v-if="level === 'team' || level === 'agent'">
              <q-select v-model="selTeam" :options="teamOptions" outlined dense emit-value map-options
                clearable label="Team" style="min-width:180px" :disable="!selAgentOS" @update:model-value="onTeamChange" />
            </div>
            <div class="col-auto" v-if="level === 'agent'">
              <q-select v-model="selAgent" :options="agentOptions" outlined dense emit-value map-options
                clearable label="Agent" style="min-width:180px" :disable="!selTeam" />
            </div>

            <q-space />
            <div class="col-auto">
              <q-btn unelevated no-caps label="Load assignments" dense :disable="!targetId" :loading="loadingAssignments"
                @click="loadAssignments" style="background:var(--brand-primary);color:#fff;border-radius:8px;padding:0 16px" />
            </div>
          </div>
        </q-card-section>
      </q-card>

      <q-card flat bordered style="border-radius:12px" v-if="targetId">
        <q-card-section>
          <div class="row items-center q-mb-md">
            <div class="text-subtitle1 text-weight-bold">Assigned capability codes</div>
            <q-space />
            <span class="code-tag">{{ level }} :: {{ targetId.substring(0,12) }}…</span>
          </div>

          <label class="field-label">capability_codes</label>
          <q-select v-model="selectedCodes" :options="capabilityOptions" outlined dense multiple use-chips
            emit-value map-options hint="POST replaces the FULL set for this level/target" />

          <div class="row q-mt-md">
            <q-space />
            <q-btn unelevated no-caps label="Save assignment" :loading="saving" @click="saveAssignments"
              style="background:var(--brand-primary);color:#fff;border-radius:8px;padding:0 16px" />
          </div>
        </q-card-section>
      </q-card>

      <div v-else class="text-center q-py-xl" style="color:var(--text-tertiary)">Chọn level + target rồi bấm "Load assignments"</div>
    </div>

    <!-- ===================== RESOLVE TAB ===================== -->
    <div v-show="mainTab === 'resolve'">
      <q-card flat bordered class="q-mb-md" style="border-radius:12px">
        <q-card-section>
          <div class="row q-col-gutter-sm items-center">
            <div class="col-auto">
              <q-select v-model="resAgentOS" :options="agentOSOptions" outlined dense emit-value map-options
                clearable label="AgentOS *" style="min-width:180px" @update:model-value="onResolveOSChange" />
            </div>
            <div class="col-auto">
              <q-select v-model="resTeam" :options="resTeamOptions" outlined dense emit-value map-options
                clearable label="Team" style="min-width:180px" :disable="!resAgentOS" @update:model-value="onResolveTeamChange" />
            </div>
            <div class="col-auto">
              <q-select v-model="resAgent" :options="resAgentOptions" outlined dense emit-value map-options
                clearable label="Agent" style="min-width:180px" :disable="!resTeam" />
            </div>
            <q-space />
            <div class="col-auto">
              <q-btn unelevated no-caps label="Resolve" dense :disable="!resAgentOS" :loading="resolving" @click="doResolve"
                style="background:var(--brand-primary);color:#fff;border-radius:8px;padding:0 16px" />
            </div>
          </div>
        </q-card-section>
      </q-card>

      <div v-if="resolveResult" class="row q-col-gutter-md">
        <div class="col-12 col-md-4" v-for="lvl in resolveLevels" :key="lvl.key">
          <q-card flat bordered style="border-radius:12px;height:100%">
            <q-card-section>
              <div class="text-caption q-mb-sm" style="color:var(--text-tertiary)">{{ lvl.label }}</div>
              <div style="display:flex;flex-wrap:wrap;gap:4px">
                <span v-for="c in resolveResult[lvl.key] || []" :key="c" class="code-tag">{{ c }}</span>
                <span v-if="!(resolveResult[lvl.key]||[]).length" style="font-size:12px;color:var(--text-tertiary)">—</span>
              </div>
            </q-card-section>
          </q-card>
        </div>
        <div class="col-12">
          <q-card flat bordered style="border-radius:12px;border-color:var(--brand-primary)">
            <q-card-section>
              <div class="text-subtitle2 text-weight-bold q-mb-sm">Effective capabilities (intersection)</div>
              <div style="display:flex;flex-wrap:wrap;gap:6px">
                <span v-for="c in resolveResult.effective_capabilities || []" :key="c" class="badge badge--active">{{ c }}</span>
                <span v-if="!(resolveResult.effective_capabilities||[]).length" style="color:var(--text-tertiary)">No effective capabilities — agent cannot call MCP tools</span>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>
      <div v-else class="text-center q-py-xl" style="color:var(--text-tertiary)">Chọn ít nhất AgentOS rồi bấm "Resolve"</div>
    </div>
  </q-page>
</template>

<script>
import { defineComponent, ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { agnoClient } from '../../../services/api/agno-runtime.client.js'
import { mcpClient } from '../../../services/api/mcp-gateway.client.js'
import { useUIStore } from '../../../stores/ui.store.js'

export default defineComponent({
  name: 'MCPAssignmentsPage',
  setup() {
    const $q = useQuasar()
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'MCP Integration' }, { label: 'Assignments' }])

    const mainTab = ref('assign')
    const loadingCaps = ref(false), capabilityOptions = ref([])

    // ---- ASSIGN TAB state ----
    const levelOptions = [
      { label: 'AgentOS', value: 'agent_os' },
      { label: 'Team', value: 'team' },
      { label: 'Agent', value: 'agent' }
    ]
    const level = ref('agent_os')
    const agentOSOptions = ref([]), teamOptions = ref([]), agentOptions = ref([])
    const selAgentOS = ref(null), selTeam = ref(null), selAgent = ref(null)
    const targetId = ref(null)
    const selectedCodes = ref([])
    const loadingAssignments = ref(false), saving = ref(false)

    function recomputeTargetId() {
      targetId.value = level.value === 'agent_os' ? selAgentOS.value
        : level.value === 'team' ? selTeam.value
        : selAgent.value
      selectedCodes.value = []
    }

    function onLevelChange() { selAgentOS.value = null; selTeam.value = null; selAgent.value = null; teamOptions.value = []; agentOptions.value = []; recomputeTargetId() }

    async function onAgentOSChange() {
      selTeam.value = null; selAgent.value = null; agentOptions.value = []
      recomputeTargetId()
      if (!selAgentOS.value) { teamOptions.value = []; return }
      try {
        const r = await agnoClient.listTeams({ agent_os_id: selAgentOS.value, page_size: 100 })
        teamOptions.value = r.items.map(t => ({ label: t.name, value: t.id }))
      } catch { teamOptions.value = [] }
    }

    async function onTeamChange() {
      selAgent.value = null
      recomputeTargetId()
      if (!selTeam.value) { agentOptions.value = []; return }
      try {
        const r = await agnoClient.listAgents({ team_id: selTeam.value, page_size: 100 })
        agentOptions.value = r.items.map(a => ({ label: a.name, value: a.id }))
      } catch { agentOptions.value = [] }
    }

    async function loadAllCapabilities() {
      loadingCaps.value = true
      try {
        // pull every enabled capability from the MCP Gateway registry for the picker
        const r = await mcpClient.listCapabilities({ enabled: true, limit: 200, offset: 0 })
        capabilityOptions.value = r.items.map(c => ({ label: `${c.name} (${c.code})`, value: c.code }))
      } catch (e) {
        $q.notify({ type: 'negative', message: 'Failed to load capabilities from MCP Gateway' })
      } finally { loadingCaps.value = false }
    }

    async function loadAgentOSOptions() {
      const r = await agnoClient.listAgentOS({ page_size: 100 })
      agentOSOptions.value = r.items.map(o => ({ label: o.name, value: o.id }))
    }

    async function loadAssignments() {
      if (!targetId.value) return
      loadingAssignments.value = true
      try {
        // GET /capabilities/assignments?level=&target_id=
        const r = await agnoClient.listCapabilityAssignments({ level: level.value, target_id: targetId.value })
        selectedCodes.value = r.capability_codes || r.items || []
      } catch {
        selectedCodes.value = []
      } finally { loadingAssignments.value = false }
    }

    async function saveAssignments() {
      if (!targetId.value) return
      saving.value = true
      try {
        // POST /capabilities/assignments — replaces the FULL set for level/target
        await agnoClient.setCapabilityAssignments({ level: level.value, target_id: targetId.value, capability_codes: selectedCodes.value })
        $q.notify({ type: 'positive', message: 'Assignment saved (full set replaced)' })
      } catch (e) {
        $q.notify({ type: 'negative', message: e.response?.data?.message || e.response?.data?.error?.message || 'Save failed' })
      } finally { saving.value = false }
    }

    // ---- RESOLVE TAB state ----
    const resAgentOS = ref(null), resTeam = ref(null), resAgent = ref(null)
    const resTeamOptions = ref([]), resAgentOptions = ref([])
    const resolving = ref(false), resolveResult = ref(null)
    const resolveLevels = [
      { key: 'agent_os_capabilities', label: 'AgentOS capabilities' },
      { key: 'team_capabilities', label: 'Team capabilities' },
      { key: 'agent_capabilities', label: 'Agent capabilities' }
    ]

    async function onResolveOSChange() {
      resTeam.value = null; resAgent.value = null; resAgentOptions.value = []; resolveResult.value = null
      if (!resAgentOS.value) { resTeamOptions.value = []; return }
      const r = await agnoClient.listTeams({ agent_os_id: resAgentOS.value, page_size: 100 })
      resTeamOptions.value = r.items.map(t => ({ label: t.name, value: t.id }))
    }

    async function onResolveTeamChange() {
      resAgent.value = null; resolveResult.value = null
      if (!resTeam.value) { resAgentOptions.value = []; return }
      const r = await agnoClient.listAgents({ team_id: resTeam.value, page_size: 100 })
      resAgentOptions.value = r.items.map(a => ({ label: a.name, value: a.id }))
    }

    async function doResolve() {
      if (!resAgentOS.value) return
      resolving.value = true
      try {
        // POST /capabilities/resolve -> agent_os/team/agent capability lists + effective intersection
        resolveResult.value = await agnoClient.resolveCapabilities({
          agent_os_id: resAgentOS.value,
          team_id: resTeam.value || undefined,
          agent_id: resAgent.value || undefined
        })
      } catch (e) {
        $q.notify({ type: 'negative', message: e.response?.data?.message || 'Resolve failed' })
        resolveResult.value = null
      } finally { resolving.value = false }
    }

    onMounted(() => { loadAllCapabilities(); loadAgentOSOptions() })

    return {
      mainTab, loadingCaps, capabilityOptions, loadAllCapabilities,
      levelOptions, level, agentOSOptions, teamOptions, agentOptions,
      selAgentOS, selTeam, selAgent, targetId, selectedCodes, loadingAssignments, saving,
      onLevelChange, onAgentOSChange, onTeamChange, loadAssignments, saveAssignments,
      resAgentOS, resTeam, resAgent, resTeamOptions, resAgentOptions, resolving, resolveResult, resolveLevels,
      onResolveOSChange, onResolveTeamChange, doResolve
    }
  }
})
</script>