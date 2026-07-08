<template>
  <q-page class="wfb-layout">
    <!-- Toolbar -->
    <div class="wfb-toolbar">
      <div style="display:flex;align-items:center;gap:10px">
        <router-link to="/ai/workflows" class="btn btn--ghost btn--sm btn--icon">
          <q-icon name="arrow_back" size="16px" />
        </router-link>
        <div>
          <div style="font-size:14px;font-weight:600;color:var(--text-primary)">{{ workflow?.name || 'Workflow Builder' }}</div>
          <div style="font-size:11px;color:var(--text-quaternary);font-family:var(--font-mono)">{{ workflow?.code }}</div>
        </div>
        <span v-if="workflow" class="badge" :class="workflow.enabled ? 'badge--active' : ''"
          :style="!workflow.enabled ? 'background:var(--surface-sunken);color:var(--text-tertiary)' : ''">
          {{ workflow.enabled ? 'enabled' : 'disabled' }}
        </span>
      </div>

      <!-- Node palette -->
      <div class="wfb-palette">
        <div v-for="nt in nodeTypes" :key="nt.type"
          class="wfb-palette__node"
          :style="`border-color:${nt.color};background:${nt.bg};color:${nt.color}`"
          draggable="true"
          @dragstart="onDragStart($event, nt.type)">
          <q-icon :name="nt.icon" size="13px" />
          <span>{{ nt.label }}</span>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:6px">
        <button class="btn btn--ghost btn--sm" @click="undo">
          <q-icon name="undo" size="14px" />
        </button>
        <button class="btn btn--ghost btn--sm" @click="clearCanvas">
          <q-icon name="delete_sweep" size="14px" />
          Clear
        </button>
        <button class="btn btn--secondary btn--sm" @click="validate">
          <q-icon name="check_circle_outline" size="14px" />
          Validate
        </button>
        <button class="btn btn--primary btn--sm" :disabled="saving" @click="saveWorkflow">
          <q-spinner v-if="saving" size="12px" style="color:white" />
          <q-icon v-else name="save" size="14px" />
          Save
        </button>
      </div>
    </div>

    <div class="wfb-body">
      <!-- Canvas -->
      <div class="wfb-canvas"
        ref="canvasRef"
        @dragover.prevent
        @drop="onDrop"
        @click.self="selectedNode=null"
        @mousemove="onMouseMove"
        @mouseup="stopDrag">

        <!-- Dot grid -->
        <svg class="wfb-grid" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="var(--border-subtle)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>

        <!-- Edges SVG -->
        <svg class="wfb-edges">
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="var(--border-strong)" />
            </marker>
          </defs>
          <path v-for="edge in edges" :key="edge.id"
            :d="getEdgePath(edge)"
            :stroke="selectedEdge===edge.id ? 'var(--brand-primary)' : 'var(--border-strong)'"
            stroke-width="1.5"
            fill="none"
            marker-end="url(#arrowhead)"
            style="cursor:pointer;transition:stroke 120ms ease"
            @click.stop="selectedEdge = edge.id"
          />
          <!-- Drawing edge -->
          <path v-if="drawingEdge"
            :d="`M ${drawingEdge.x1},${drawingEdge.y1} C ${drawingEdge.x1},${drawingEdge.y1+60} ${drawingEdge.x2},${drawingEdge.y2-60} ${drawingEdge.x2},${drawingEdge.y2}`"
            stroke="var(--brand-primary)" stroke-width="1.5" stroke-dasharray="5,4" fill="none" opacity="0.6" />
        </svg>

        <!-- Nodes -->
        <div v-for="node in nodes" :key="node.id"
          class="wfb-node"
          :class="[`wfb-node--${node.type}`, selectedNode?.id===node.id && 'wfb-node--selected']"
          :style="`left:${node.position.x}px;top:${node.position.y}px`"
          @mousedown.stop="startNodeDrag($event, node)"
          @click.stop="selectNode(node)">

          <!-- Node header -->
          <div class="wfb-node__header">
            <div class="wfb-node__type-dot" :style="`background:${nodeColor(node.type)}`" />
            <span class="wfb-node__type">{{ node.type.toUpperCase() }}</span>
          </div>

          <div class="wfb-node__label">{{ node.data.label }}</div>
          <div v-if="node.data.agent_code || node.data.team_code" class="wfb-node__sub">
            {{ node.data.agent_code || node.data.team_code }}
          </div>

          <!-- Output port -->
          <div v-if="node.type !== 'end'" class="wfb-port wfb-port--out"
            @mousedown.stop="startEdge($event, node)"
            title="Drag to connect" />
          <!-- Input port -->
          <div v-if="node.type !== 'start'" class="wfb-port wfb-port--in"
            @mouseup.stop="endEdge($event, node)" />
        </div>

        <!-- Empty hint -->
        <div v-if="!nodes.length" class="wfb-empty">
          <q-icon name="account_tree" size="40px" style="color:var(--border-default);margin-bottom:12px" />
          <div style="font-size:14px;font-weight:500;color:var(--text-tertiary)">Drag nodes from the palette to build your workflow</div>
          <div style="font-size:12px;color:var(--text-quaternary);margin-top:4px">Workflow steps run sequentially: Start → Agent/Team → End</div>
        </div>
      </div>

      <!-- Properties panel -->
      <transition name="slide-panel">
        <div v-if="selectedNode" class="wfb-props">
          <div class="wfb-props__header">
            <div style="display:flex;align-items:center;gap:8px">
              <div class="wfb-node__type-dot" :style="`background:${nodeColor(selectedNode.type)};width:8px;height:8px`" />
              <span style="font-size:13px;font-weight:600;color:var(--text-primary)">{{ selectedNode.type.charAt(0).toUpperCase() + selectedNode.type.slice(1) }} Node</span>
            </div>
            <button class="btn btn--ghost btn--icon btn--sm" @click="selectedNode=null">
              <q-icon name="close" size="16px" />
            </button>
          </div>

          <div class="wfb-props__body">
            <div style="margin-bottom:14px">
              <label class="field-label">Label</label>
              <q-input v-model="selectedNode.data.label" outlined dense />
            </div>

            <template v-if="selectedNode.type === 'agent'">
              <div>
                <label class="field-label">Agent</label>
                <q-select v-model="selectedNode.data.agent_code" :options="agentOptions"
                  outlined dense emit-value map-options clearable placeholder="Select agent" />
              </div>
            </template>

            <template v-if="selectedNode.type === 'team'">
              <div>
                <label class="field-label">Team</label>
                <q-select v-model="selectedNode.data.team_code" :options="teamOptions"
                  outlined dense emit-value map-options clearable placeholder="Select team" />
              </div>
            </template>

            <div style="margin-top:16px">
              <label class="field-label">Node ID</label>
              <span class="code-tag" style="display:inline-block;margin-top:4px">{{ selectedNode.id }}</span>
            </div>

            <button class="btn btn--secondary" style="width:100%;margin-top:16px;border-color:var(--status-error-text);color:var(--status-error-text)"
              @click="removeNode(selectedNode)">
              <q-icon name="delete_outline" size="15px" />
              Remove Node
            </button>
          </div>
        </div>
      </transition>
    </div>

    <!-- Validation toast -->
    <transition name="fade-up">
      <div v-if="validationMsg" class="wfb-validation"
        :class="validationOk ? 'wfb-validation--ok' : 'wfb-validation--err'">
        <q-icon :name="validationOk ? 'check_circle' : 'error_outline'" size="18px" />
        <span>{{ validationMsg }}</span>
        <button class="btn btn--ghost btn--icon btn--sm" @click="validationMsg=''" style="margin-left:auto">
          <q-icon name="close" size="16px" />
        </button>
      </div>
    </transition>
  </q-page>
</template>

<script>
import { defineComponent, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { agnoClient } from '../../../services/api/agno-runtime.client.js'
import { useUIStore } from '../../../stores/ui.store.js'

export default defineComponent({
  name: 'WorkflowBuilder',
  setup() {
    const route = useRoute()
    const $q = useQuasar()
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'Workflows', to: '/ai/workflows' }, { label: 'Builder' }])

    const canvasRef = ref(null)
    const workflow = ref(null), nodes = ref([]), edges = ref([])
    const saving = ref(false), selectedNode = ref(null), selectedEdge = ref(null)
    const validationMsg = ref(''), validationOk = ref(false)
    const agentOptions = ref([]), teamOptions = ref([])
    const agentsRaw = ref([]), teamsRaw = ref([])
    const drawingEdge = ref(null), edgeSource = ref(null)
    const dragging = ref(null), dragOffset = ref({ x: 0, y: 0 })
    let nodeCounter = 1

    const nodeTypes = [
      { type: 'start', label: 'Start', icon: 'play_circle_outline', color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
      { type: 'agent', label: 'Agent', icon: 'smart_toy', color: '#6366f1', bg: 'rgba(99,102,241,0.08)' },
      { type: 'team', label: 'Team', icon: 'group', color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)' },
      { type: 'end', label: 'End', icon: 'stop_circle', color: '#ef4444', bg: 'rgba(239,68,68,0.08)' }
    ]

    const nodeColor = (type) => ({
      start: '#10b981', agent: '#6366f1', team: '#8b5cf6', end: '#ef4444'
    }[type] || '#6b7280')

    function getEdgePath(edge) {
      const src = nodes.value.find(n => n.id === edge.source)
      const tgt = nodes.value.find(n => n.id === edge.target)
      if (!src || !tgt) return ''
      const x1 = src.position.x + 90, y1 = src.position.y + 44
      const x2 = tgt.position.x + 90, y2 = tgt.position.y
      return `M ${x1},${y1} C ${x1},${y1+60} ${x2},${y2-60} ${x2},${y2}`
    }

    function onDragStart(e, type) { e.dataTransfer.setData('nodeType', type) }

    function onDrop(e) {
      const type = e.dataTransfer.getData('nodeType')
      if (!type) return
      const rect = canvasRef.value.getBoundingClientRect()
      addNode(type, e.clientX - rect.left - 90, e.clientY - rect.top - 22)
    }

    function addNode(type, x = 160, y = 160) {
      nodes.value.push({
        id: `n${nodeCounter++}`, type,
        position: { x: Math.max(0, x), y: Math.max(0, y) },
        data: { label: `${type.charAt(0).toUpperCase() + type.slice(1)} ${nodeCounter - 1}`, agent_code: null, team_code: null }
      })
    }

    function startNodeDrag(e, node) {
      if (e.target.classList.contains('wfb-port')) return
      dragging.value = node
      const rect = e.currentTarget.getBoundingClientRect()
      dragOffset.value = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      document.addEventListener('mouseup', stopDrag)
    }

    function onMouseMove(e) {
      if (!dragging.value) return
      const rect = canvasRef.value.getBoundingClientRect()
      dragging.value.position.x = Math.max(0, e.clientX - rect.left - dragOffset.value.x)
      dragging.value.position.y = Math.max(0, e.clientY - rect.top - dragOffset.value.y)
      if (drawingEdge.value && edgeSource.value) {
        drawingEdge.value.x2 = e.clientX - rect.left
        drawingEdge.value.y2 = e.clientY - rect.top
      }
    }

    function stopDrag() {
      dragging.value = null
      drawingEdge.value = null
      edgeSource.value = null
      document.removeEventListener('mouseup', stopDrag)
    }

    function startEdge(e, node) {
      e.preventDefault(); e.stopPropagation()
      edgeSource.value = node
      const rect = canvasRef.value.getBoundingClientRect()
      drawingEdge.value = {
        x1: node.position.x + 90, y1: node.position.y + 44,
        x2: e.clientX - rect.left, y2: e.clientY - rect.top
      }
      document.addEventListener('mouseup', stopDrag)
    }

    function endEdge(e, node) {
      if (edgeSource.value && edgeSource.value.id !== node.id) {
        const exists = edges.value.some(ed => ed.source === edgeSource.value.id && ed.target === node.id)
        if (!exists) edges.value.push({ id: `e_${edgeSource.value.id}_${node.id}`, source: edgeSource.value.id, target: node.id })
      }
      drawingEdge.value = null; edgeSource.value = null
    }

    function selectNode(node) { selectedNode.value = node; selectedEdge.value = null }

    function removeNode(node) {
      nodes.value = nodes.value.filter(n => n.id !== node.id)
      edges.value = edges.value.filter(e => e.source !== node.id && e.target !== node.id)
      selectedNode.value = null
    }

    function clearCanvas() {
      $q.dialog({ title: 'Clear Canvas', message: 'Remove all nodes and edges?', cancel: true, ok: { color: 'negative', label: 'Clear', unelevated: true } })
        .onOk(() => { nodes.value = []; edges.value = []; selectedNode.value = null })
    }

    // The API only supports a strictly sequential chain (no branching/parallel),
    // so we walk edges from the Start node to linearize the graph into ordered steps.
    function linearOrder() {
      const start = nodes.value.find(n => n.type === 'start')
      if (!start) return null
      const order = []
      let current = start
      const visited = new Set()
      while (current) {
        if (visited.has(current.id)) return null // cycle — invalid
        visited.add(current.id)
        if (current.type !== 'start' && current.type !== 'end') order.push(current)
        if (current.type === 'end') break
        const outEdges = edges.value.filter(e => e.source === current.id)
        if (outEdges.length > 1) return null // branching not supported by API
        if (!outEdges.length) { current = null; break }
        current = nodes.value.find(n => n.id === outEdges[0].target)
      }
      return order
    }

    function validate() {
      const hasStart = nodes.value.some(n => n.type === 'start')
      const hasEnd = nodes.value.some(n => n.type === 'end')
      if (!hasStart || !hasEnd) {
        validationMsg.value = 'Workflow needs a Start and End node'
        validationOk.value = false
      } else if (nodes.value.length < 3) {
        validationMsg.value = 'Add at least one Agent or Team node between Start and End'
        validationOk.value = false
      } else {
        const order = linearOrder()
        if (!order) {
          validationMsg.value = 'Steps must form a single sequential chain (no branching/parallel/cycles) — the API only supports sequential workflows'
          validationOk.value = false
        } else if (order.some(n => (n.type === 'agent' && !n.data.agent_code) || (n.type === 'team' && !n.data.team_code))) {
          validationMsg.value = 'Every Agent/Team node needs a code selected'
          validationOk.value = false
        } else {
          validationMsg.value = 'Workflow is valid and ready to save'
          validationOk.value = true
        }
      }
      setTimeout(() => { validationMsg.value = '' }, 5000)
    }

    function undo() { if (nodes.value.length) nodes.value.pop() }

    async function saveWorkflow() {
      if (!workflow.value) return
      const order = linearOrder()
      if (!order) {
        $q.notify({ type: 'negative', message: 'Workflow steps must be a single sequential chain (Start → step → step → End)' })
        return
      }
      const steps = order.map(n => n.type === 'agent'
        ? { type: 'AGENT', agentCode: n.data.agent_code }
        : { type: 'TEAM', teamCode: n.data.team_code })
      if (steps.some(s => !s.agentCode && !s.teamCode)) {
        $q.notify({ type: 'negative', message: 'Every step needs an Agent or Team code selected' })
        return
      }
      saving.value = true
      try {
        // PUT /workflows/{id}: steps (if provided) replaces the whole sequence
        await agnoClient.updateWorkflow(workflow.value.id, { steps })
        $q.notify({ type: 'positive', message: 'Workflow saved' })
      } catch (e) {
        $q.notify({ type: 'negative', message: e.response?.data?.message || 'Save failed' })
      } finally { saving.value = false }
    }

    // GET /workflows/{id} returns steps as:
    //   { step_order, step_type: 'AGENT'|'TEAM', agent_id, team_id, step_config }
    // — note: ids, not the agentCode/teamCode used when WRITING steps (POST/PUT).
    // We resolve agent_id/team_id back to a code+label using the agents/teams lists,
    // which must already be loaded (agentsRaw/teamsRaw) before this runs.
    function layoutFromSteps(steps) {
      const sorted = [...steps].sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0))
      const startNode = { id: 'n_start', type: 'start', position: { x: 200, y: 60 }, data: { label: 'Start' } }
      const stepNodes = sorted.map((s, i) => {
        const isAgent = s.step_type === 'AGENT'
        const ref = isAgent
          ? agentsRaw.value.find(a => a.id === s.agent_id)
          : teamsRaw.value.find(t => t.id === s.team_id)
        const label = ref ? `${ref.name} (${ref.code})` : (isAgent ? s.agent_id : s.team_id) || 'Unknown'
        return {
          id: `n${i + 1}`,
          type: isAgent ? 'agent' : 'team',
          position: { x: 200, y: 60 + (i + 1) * 140 },
          data: {
            label,
            agent_code: isAgent ? (ref?.code || null) : null,
            team_code: !isAgent ? (ref?.code || null) : null
          }
        }
      })
      const endNode = { id: 'n_end', type: 'end', position: { x: 200, y: 60 + (steps.length + 1) * 140 }, data: { label: 'End' } }
      const chain = [startNode, ...stepNodes, endNode]
      const newEdges = []
      for (let i = 0; i < chain.length - 1; i++) {
        newEdges.push({ id: `e_${chain[i].id}_${chain[i + 1].id}`, source: chain[i].id, target: chain[i + 1].id })
      }
      nodeCounter = chain.length + 1
      return { nodes: chain, edges: newEdges }
    }

    onMounted(async () => {
      // Load agents/teams FIRST so layoutFromSteps can resolve agent_id/team_id -> code/name.
      const [a, t] = await Promise.allSettled([agnoClient.listAgents({ page_size: 100 }), agnoClient.listTeams({ page_size: 100 })])
      if (a.status === 'fulfilled') { agentsRaw.value = a.value.items; agentOptions.value = a.value.items.map(x => ({ label: `${x.name} (${x.code})`, value: x.code })) }
      if (t.status === 'fulfilled') { teamsRaw.value = t.value.items; teamOptions.value = t.value.items.map(x => ({ label: `${x.name} (${x.code})`, value: x.code })) }

      const id = route.params.id
      if (id && id !== 'new') {
        try {
          workflow.value = await agnoClient.getWorkflow(id)
          if (workflow.value.steps && workflow.value.steps.length) {
            const { nodes: n, edges: e } = layoutFromSteps(workflow.value.steps)
            nodes.value = n
            edges.value = e
          }
        } catch {}
      }

      if (!nodes.value.length) {
        nodes.value = [
          { id: 'n_start', type: 'start', position: { x: 200, y: 60 }, data: { label: 'Start' } },
          { id: 'n_end', type: 'end', position: { x: 200, y: 320 }, data: { label: 'End' } }
        ]
        nodeCounter = 3
      }
    })

    return { canvasRef, workflow, nodes, edges, saving, selectedNode, selectedEdge, validationMsg, validationOk, drawingEdge, nodeTypes, agentOptions, teamOptions, nodeColor, getEdgePath, onDragStart, onDrop, addNode, startNodeDrag, onMouseMove, stopDrag, startEdge, endEdge, selectNode, removeNode, clearCanvas, validate, undo, saveWorkflow }
  }
})
</script>

<style lang="scss">
.wfb-layout {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--header-height));
  padding: 0 !important;
  overflow: hidden;
}

.wfb-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--surface-raised);
  border-bottom: 1px solid var(--border-subtle);
  gap: 12px;
  flex-shrink: 0;
}

.wfb-palette {
  display: flex;
  align-items: center;
  gap: 6px;

  &__node {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border-radius: 6px;
    border: 1.5px solid;
    font-size: 11px;
    font-weight: 600;
    cursor: grab;
    transition: all 120ms ease;
    user-select: none;

    &:hover { transform: translateY(-1px); box-shadow: var(--shadow-md); }
    &:active { transform: scale(0.97); cursor: grabbing; }
  }
}

.wfb-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.wfb-canvas {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: var(--surface-overlay);
  cursor: default;
}

.wfb-grid {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.wfb-edges {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;

  path { pointer-events: stroke; }
}

.wfb-node {
  position: absolute;
  min-width: 180px;
  background: var(--surface-raised);
  border: 1.5px solid var(--border-default);
  border-radius: 10px;
  padding: 12px 14px 12px 12px;
  box-shadow: var(--shadow-md);
  cursor: grab;
  z-index: 2;
  transition: box-shadow 120ms ease, border-color 120ms ease;
  user-select: none;

  &:hover { box-shadow: var(--shadow-lg); }

  &--selected {
    box-shadow: 0 0 0 2px var(--brand-primary), var(--shadow-lg) !important;
    border-color: var(--brand-primary) !important;
  }

  &--start { border-color: #10b981; }
  &--agent { border-color: #6366f1; }
  &--team  { border-color: #8b5cf6; }
  &--end   { border-color: #ef4444; }

  &__header { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
  &__type-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  &__type { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-quaternary); }
  &__label { font-size: 13px; font-weight: 600; color: var(--text-primary); line-height: 1.3; }
  &__sub { font-size: 11px; color: var(--text-tertiary); margin-top: 3px; font-family: var(--font-mono); }
}

.wfb-port {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  z-index: 3;
  cursor: crosshair;
  transition: transform 120ms ease;

  &--out {
    right: -7px;
    top: 50%;
    transform: translateY(-50%);
    background: var(--brand-primary);
    border: 2px solid var(--surface-raised);
    &:hover { transform: translateY(-50%) scale(1.4); }
  }

  &--in {
    left: -7px;
    top: 50%;
    transform: translateY(-50%);
    background: var(--surface-raised);
    border: 2px solid var(--border-strong);
    &:hover { border-color: var(--brand-primary); transform: translateY(-50%) scale(1.4); }
  }
}

.wfb-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  text-align: center;
}

.wfb-props {
  width: 260px;
  background: var(--surface-raised);
  border-left: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border-subtle);
  }

  &__body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }
}

.wfb-validation {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  box-shadow: var(--shadow-lg);
  z-index: 100;
  min-width: 280px;

  &--ok { background: var(--status-success-bg); color: var(--status-success-text); border: 1px solid rgba(16,185,129,0.2); }
  &--err { background: var(--status-error-bg); color: var(--status-error-text); border: 1px solid rgba(239,68,68,0.2); }
}

// Transitions
.slide-panel-enter-active, .slide-panel-leave-active { transition: all 200ms ease; }
.slide-panel-enter-from, .slide-panel-leave-to { transform: translateX(100%); opacity: 0; }

.fade-up-enter-active, .fade-up-leave-active { transition: all 200ms ease; }
.fade-up-enter-from, .fade-up-leave-to { transform: translate(-50%, 10px); opacity: 0; }
</style>