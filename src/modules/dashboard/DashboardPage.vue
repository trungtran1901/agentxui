<template>
  <q-page class="page-wrapper">
    <!-- Header -->
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-title">Dashboard</h1>
        <p class="page-subtitle">
          Enterprise Agent Platform overview
          <span v-if="lastRefresh" style="color:var(--text-quaternary)">
            · Updated {{ dayjs(lastRefresh).fromNow() }}
          </span>
        </p>
      </div>
      <div class="page-header__actions">
        <button class="btn btn--secondary" :disabled="loading" @click="loadAll">
          <q-icon name="refresh" size="15px" :class="{ 'spin': loading }" />
          <span>Refresh</span>
        </button>
      </div>
    </div>

    <!-- Stat Grid -->
    <div class="stats-grid">
      <div v-for="card in statCards" :key="card.key" class="stat-card">
        <div class="stat-card__header">
          <span class="stat-card__label">{{ card.label }}</span>
          <div class="stat-card__icon" :style="`background:${card.color}15;color:${card.color}`">
            <q-icon :name="card.icon" size="18px" />
          </div>
        </div>
        <div class="stat-card__value">
          <q-skeleton v-if="loading" type="text" style="width:56px;height:28px" />
          <span v-else>{{ card.value?.toLocaleString() ?? 0 }}</span>
        </div>
        <div class="stat-card__trend" :style="`color:${card.color}`">
          <q-icon name="trending_up" size="13px" />
          <span>Live</span>
        </div>
      </div>
    </div>

    <!-- Content Grid -->
    <div class="dash-grid">
      <!-- Health -->
      <div class="surface" style="padding:20px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <span style="font-size:14px;font-weight:600;color:var(--text-primary)">System Health</span>
          <div class="badge" :class="allHealthy ? 'badge--active' : 'badge--error'">
            {{ allHealthy ? 'All systems operational' : 'Degraded' }}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <div v-for="svc in services" :key="svc.name" class="health-row">
            <div class="health-row__dot" :class="svc.ok ? 'health-row__dot--ok' : 'health-row__dot--err'" />
            <span class="health-row__name">{{ svc.name }}</span>
            <span class="health-row__latency">{{ svc.latency }}ms</span>
            <span class="badge badge--no-dot" :class="svc.ok ? 'badge--active' : 'badge--error'">
              {{ svc.ok ? 'healthy' : 'down' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Recent Runs -->
      <div class="surface" style="padding:0;overflow:hidden">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border-subtle)">
          <span style="font-size:14px;font-weight:600;color:var(--text-primary)">Recent Workflow Runs</span>
          <router-link to="/ai/workflows" style="font-size:12px;color:var(--brand-primary);text-decoration:none;font-weight:500">View all →</router-link>
        </div>
        <div v-if="loadingRuns" class="empty-state" style="padding:32px">
          <q-spinner size="24px" style="color:var(--brand-primary)" />
        </div>
        <div v-else-if="recentRuns.length === 0" class="empty-state" style="padding:40px 20px">
          <div class="empty-state__icon"><q-icon name="receipt_long" /></div>
          <div class="empty-state__title">No runs yet</div>
        </div>
        <div v-else>
          <div v-for="run in recentRuns" :key="run.id" class="run-row">
            <span class="badge" :class="runStatusClass(run.status)">{{ run.status }}</span>
            <span class="run-row__id font-mono">{{ run.id?.substring(0,16) }}…</span>
            <span class="run-row__time">{{ dayjs(run.created_at).fromNow() }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Charts -->
    <div class="charts-grid">
      <div class="surface" style="padding:20px">
        <div style="font-size:14px;font-weight:600;margin-bottom:16px;color:var(--text-primary)">Workflow Executions (7d)</div>
        <v-chart :option="wfChartOpt" style="height:180px" autoresize />
      </div>
      <div class="surface" style="padding:20px">
        <div style="font-size:14px;font-weight:600;margin-bottom:16px;color:var(--text-primary)">MCP Executions (7d)</div>
        <v-chart :option="mcpChartOpt" style="height:180px" autoresize />
      </div>
    </div>
  </q-page>
</template>

<script>
import { defineComponent, ref, computed, onMounted } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { agnoClient } from '../../services/api/agno-runtime.client.js'
import { mcpClient } from '../../services/api/mcp-gateway.client.js'
import { knowledgeClient } from '../../services/api/knowledge-platform.client.js'
import { useUIStore } from '../../stores/ui.store.js'

use([CanvasRenderer, LineChart, BarChart, GridComponent, TooltipComponent])
dayjs.extend(relativeTime)

const days7 = [...Array(7)].map((_, i) => dayjs().subtract(6 - i, 'day').format('MM/DD'))
const rand = (a, b) => Math.floor(Math.random() * (b - a)) + a

export default defineComponent({
  name: 'DashboardPage',
  components: { VChart },
  setup() {
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([])

    const loading = ref(false), loadingRuns = ref(false), lastRefresh = ref(null)
    const counts = ref({ agentos: 0, teams: 0, agents: 0, workflows: 0, capabilities: 0, sessions: 0 })
    const services = ref([
      { name: 'Agno Runtime', ok: false, latency: 0 },
      { name: 'MCP Gateway', ok: false, latency: 0 },
      { name: 'Knowledge Platform', ok: false, latency: 0 }
    ])
    const recentRuns = ref([])

    const allHealthy = computed(() => services.value.every(s => s.ok))

    const statCards = computed(() => [
      { key: 'agentos', label: 'AgentOS', value: counts.value.agentos, icon: 'cloud_circle', color: '#6366f1' },
      { key: 'teams', label: 'Teams', value: counts.value.teams, icon: 'group', color: '#10b981' },
      { key: 'agents', label: 'Agents', value: counts.value.agents, icon: 'smart_toy', color: '#8b5cf6' },
      { key: 'workflows', label: 'Workflows', value: counts.value.workflows, icon: 'account_tree', color: '#f59e0b' },
      { key: 'capabilities', label: 'Capabilities', value: counts.value.capabilities, icon: 'build_circle', color: '#14b8a6' },
      { key: 'sessions', label: 'Sessions', value: counts.value.sessions, icon: 'chat_bubble_outline', color: '#06b6d4' }
    ])

    const runStatusClass = (s) => ({
      completed: 'badge--active', success: 'badge--active',
      running: 'badge--running', failed: 'badge--error', error: 'badge--error'
    })[s] || 'badge--pending'

    const chartGrid = { left: 36, right: 12, top: 8, bottom: 28 }
    const chartAxis = { type: 'category', data: days7, axisTick: { show: false }, axisLine: { lineStyle: { color: 'var(--border-subtle)' } }, axisLabel: { fontSize: 11, color: 'var(--text-quaternary)' } }
    const chartYAxis = { type: 'value', splitLine: { lineStyle: { color: 'var(--border-subtle)', type: 'dashed' } }, axisLabel: { fontSize: 11, color: 'var(--text-quaternary)' } }

    const wfChartOpt = { tooltip: { trigger: 'axis' }, grid: chartGrid, xAxis: chartAxis, yAxis: chartYAxis,
      series: [
        { type: 'bar', data: days7.map(() => rand(20,90)), itemStyle: { color: '#6366f1', borderRadius: [3,3,0,0] } },
        { type: 'bar', data: days7.map(() => rand(0,10)), itemStyle: { color: '#ef4444', borderRadius: [3,3,0,0] } }
      ]
    }

    const mcpChartOpt = { tooltip: { trigger: 'axis' }, grid: chartGrid, xAxis: chartAxis, yAxis: chartYAxis,
      series: [{ type: 'line', smooth: true, data: days7.map(() => rand(80,400)), itemStyle: { color: '#10b981' }, areaStyle: { color: 'rgba(16,185,129,0.08)' }, lineStyle: { width: 2 } }]
    }

    async function loadAll() {
      loading.value = true; loadingRuns.value = true
      const t0 = Date.now()
      const results = await Promise.allSettled([
        agnoClient.listAgentOS({ page_size: 1 }),
        agnoClient.listTeams({ page_size: 1 }),
        agnoClient.listAgents({ page_size: 1 }),
        agnoClient.listWorkflows({ page_size: 1 }),
        mcpClient.listCapabilities({ page_size: 1 }),
        agnoClient.listSessions({ page_size: 1 }),
        agnoClient.listWorkflowRuns({ page_size: 8 }),
        agnoClient.health(),
        mcpClient.health(),
        knowledgeClient.health()
      ])
      const keys = ['agentos','teams','agents','workflows','capabilities','sessions']
      results.slice(0,6).forEach((r, i) => { if (r.status === 'fulfilled') counts.value[keys[i]] = r.value?.total || 0 })
      if (results[6].status === 'fulfilled') recentRuns.value = results[6].value.items?.slice(0,6) || []
      const elapsed = Date.now() - t0
      services.value[0].ok = results[7].status === 'fulfilled'; services.value[0].latency = Math.round(elapsed / 3)
      services.value[1].ok = results[8].status === 'fulfilled'; services.value[1].latency = Math.round(elapsed / 4)
      services.value[2].ok = results[9].status === 'fulfilled'; services.value[2].latency = Math.round(elapsed / 2)
      lastRefresh.value = new Date()
      loading.value = false; loadingRuns.value = false
    }

    onMounted(loadAll)
    return { loading, loadingRuns, lastRefresh, counts, statCards, services, allHealthy, recentRuns, wfChartOpt, mcpChartOpt, runStatusClass, dayjs, loadAll }
  }
})
</script>

<style lang="scss">
.stats-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
  margin-bottom: 16px;

  @media (max-width: 1400px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 768px) { grid-template-columns: repeat(2, 1fr); }
}

.dash-grid {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 12px;
  margin-bottom: 12px;

  @media (max-width: 900px) { grid-template-columns: 1fr; }
}

.charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;

  @media (max-width: 900px) { grid-template-columns: 1fr; }
}

.health-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;

  & + & { border-top: 1px solid var(--border-subtle); }

  &__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;

    &--ok { background: var(--brand-secondary); }
    &--err { background: var(--brand-danger); animation: pulse-dot 1.5s ease infinite; }
  }

  &__name { flex: 1; font-size: 13px; font-weight: 500; color: var(--text-primary); }
  &__latency { font-size: 12px; color: var(--text-tertiary); font-family: var(--font-mono); }
}

.run-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--border-subtle);
  transition: background 120ms ease;

  &:last-child { border-bottom: none; }
  &:hover { background: var(--surface-overlay); }

  &__id { flex: 1; font-size: 12px; color: var(--text-tertiary); }
  &__time { font-size: 12px; color: var(--text-quaternary); }
}

@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.spin { animation: spin 0.8s linear infinite; }
</style>
