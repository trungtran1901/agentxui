<template>
  <q-page class="page-wrapper">
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-title">Monitoring</h1>
        <p class="page-subtitle">GET /health · GET /ready · GET /version — System observability</p>
      </div>
      <div class="page-header__actions">
        <label class="search-toggle" style="cursor:pointer">
          <q-toggle v-model="autoRefresh" dense />
          <span style="font-size:13px;color:var(--text-secondary)">Auto 30s</span>
        </label>
        <button class="btn btn--secondary" :disabled="loading" @click="loadAll">
          <q-icon name="refresh" size="15px" :class="loading && 'spin'" />
          Refresh
        </button>
      </div>
    </div>

    <!-- Service Health Cards -->
    <div class="monitor-grid q-mb-md">
      <div v-for="svc in services" :key="svc.name" class="surface monitor-card">
        <div class="monitor-card__top">
          <div class="monitor-card__status-dot" :class="svc.liveness ? 'monitor-card__status-dot--ok' : 'monitor-card__status-dot--err'" />
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:600;color:var(--text-primary)">{{ svc.name }}</div>
            <span class="code-tag" style="font-size:10px;margin-top:2px;display:inline-block">{{ svc.version || '—' }}</span>
          </div>
          <span class="badge" :class="svc.liveness ? 'badge--active' : 'badge--error'">
            {{ svc.liveness ? 'healthy' : 'down' }}
          </span>
        </div>
        <div class="monitor-card__metrics">
          <div class="monitor-metric">
            <div class="monitor-metric__value" :class="!svc.readiness && 'monitor-metric__value--err'">
              <q-icon :name="svc.readiness ? 'check' : 'close'" size="18px" />
            </div>
            <div class="monitor-metric__label">Ready</div>
          </div>
          <div class="monitor-metric">
            <div class="monitor-metric__value" :class="svc.latency > 500 && 'monitor-metric__value--warn'">{{ svc.latency }}ms</div>
            <div class="monitor-metric__label">Latency</div>
          </div>
          <div class="monitor-metric">
            <div class="monitor-metric__value">{{ svc.build || '—' }}</div>
            <div class="monitor-metric__label">Build</div>
          </div>
        </div>
        <q-linear-progress
          :value="svc.liveness ? 1 : 0"
          :color="svc.liveness ? 'positive' : 'negative'"
          size="2px"
          style="border-radius:0 0 10px 10px;margin:-1px -1px -1px -1px"
        />
      </div>
    </div>

    <!-- Charts -->
    <div class="monitor-charts q-mb-md">
      <div class="surface" style="padding:20px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <span style="font-size:14px;font-weight:600;color:var(--text-primary)">Request Rate (24h)</span>
          <div class="play-mode-toggle">
            <button v-for="r in ['1h','6h','24h']" :key="r"
              :class="['play-mode-btn', chartRange===r && 'play-mode-btn--active']"
              @click="chartRange=r">{{ r }}</button>
          </div>
        </div>
        <v-chart :option="reqChartOpt" style="height:200px" autoresize />
      </div>
      <div class="surface" style="padding:20px">
        <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:16px">Error Distribution</div>
        <v-chart :option="errPieOpt" style="height:200px" autoresize />
      </div>
    </div>

    <!-- Version Info -->
    <div class="surface" style="padding:0;overflow:hidden">
      <div style="padding:14px 20px;border-bottom:1px solid var(--border-subtle)">
        <span style="font-size:14px;font-weight:600;color:var(--text-primary)">Version Information</span>
        <span class="code-tag" style="margin-left:8px;font-size:10px">GET /version</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0">
        <div v-for="svc in services" :key="svc.name"
          style="padding:16px 20px;border-right:1px solid var(--border-subtle)">
          <div style="font-size:12px;color:var(--text-quaternary);margin-bottom:6px">{{ svc.name }}</div>
          <div class="font-mono" style="font-size:14px;font-weight:600;color:var(--text-primary)">{{ svc.version || 'unknown' }}</div>
          <div style="font-size:11px;color:var(--text-quaternary);margin-top:2px">{{ svc.build || '—' }}</div>
        </div>
      </div>
    </div>
  </q-page>
</template>

<script>
import { defineComponent, ref, computed, onMounted, onUnmounted, watch } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, PieChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { agnoClient } from '../../../services/api/agno-runtime.client.js'
import { mcpClient } from '../../../services/api/mcp-gateway.client.js'
import { knowledgeClient } from '../../../services/api/knowledge-platform.client.js'
import { useUIStore } from '../../../stores/ui.store.js'

use([CanvasRenderer, LineChart, PieChart, BarChart, GridComponent, TooltipComponent, LegendComponent])
const hours = [...Array(24)].map((_, i) => `${String(i).padStart(2,'0')}:00`)
const rand = (a, b) => Math.floor(Math.random() * (b - a)) + a

export default defineComponent({
  name: 'MonitoringPage',
  components: { VChart },
  setup() {
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'Operations' }, { label: 'Monitoring' }])
    const loading = ref(false), autoRefresh = ref(false), chartRange = ref('24h')
    let timer = null
    const services = ref([
      { name: 'Agno Runtime', liveness: false, readiness: false, version: '—', build: '—', latency: 0 },
      { name: 'MCP Gateway', liveness: false, readiness: false, version: '—', build: '—', latency: 0 },
      { name: 'Knowledge Platform', liveness: false, readiness: false, version: '—', build: '—', latency: 0 }
    ])
    const chartGrid = { left: 36, right: 12, top: 8, bottom: 28 }
    const chartXAxis = { type: 'category', data: hours, axisTick: { show: false }, axisLine: { lineStyle: { color: 'var(--border-subtle)' } }, axisLabel: { fontSize: 10, color: 'var(--text-quaternary)', interval: 3 } }
    const chartYAxis = { type: 'value', splitLine: { lineStyle: { color: 'var(--border-subtle)', type: 'dashed' } }, axisLabel: { fontSize: 10, color: 'var(--text-quaternary)' } }
    const reqChartOpt = computed(() => ({
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, textStyle: { fontSize: 11, color: 'var(--text-tertiary)' }, data: ['Agno Runtime', 'MCP Gateway'] },
      grid: { ...chartGrid, bottom: 44 },
      xAxis: chartXAxis, yAxis: chartYAxis,
      series: [
        { name: 'Agno Runtime', type: 'line', smooth: true, data: hours.map(() => rand(60,400)), itemStyle: { color: '#6366f1' }, areaStyle: { color: 'rgba(99,102,241,0.07)' }, lineStyle: { width: 2 }, symbol: 'none' },
        { name: 'MCP Gateway', type: 'line', smooth: true, data: hours.map(() => rand(20,200)), itemStyle: { color: '#10b981' }, areaStyle: { color: 'rgba(16,185,129,0.07)' }, lineStyle: { width: 2 }, symbol: 'none' }
      ]
    }))
    const errPieOpt = {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 0, textStyle: { fontSize: 11 } },
      series: [{
        type: 'pie', radius: ['42%', '68%'], center: ['50%', '44%'],
        label: { show: false },
        data: [
          { value: 68, name: 'runtime_execution_failed', itemStyle: { color: '#ef4444' } },
          { value: 18, name: 'mcp_gateway_error', itemStyle: { color: '#f59e0b' } },
          { value: 8, name: 'capability_resolution_failed', itemStyle: { color: '#8b5cf6' } },
          { value: 6, name: 'validation_failed', itemStyle: { color: '#3b82f6' } }
        ]
      }]
    }
    async function loadAll() {
      loading.value = true
      const checks = [
        { i: 0, h: () => agnoClient.health(), r: () => agnoClient.ready(), v: () => agnoClient.version() },
        { i: 1, h: () => mcpClient.health(), r: () => mcpClient.ready(), v: () => mcpClient.version() },
        { i: 2, h: () => knowledgeClient.health(), r: () => knowledgeClient.ready(), v: () => knowledgeClient.version() }
      ]
      await Promise.allSettled(checks.map(async c => {
        const t0 = Date.now()
        const [h, r, v] = await Promise.allSettled([c.h(), c.r(), c.v()])
        services.value[c.i].liveness = h.status === 'fulfilled'
        services.value[c.i].readiness = r.status === 'fulfilled'
        services.value[c.i].version = v.status === 'fulfilled' ? v.value?.version || '—' : '—'
        services.value[c.i].build = v.status === 'fulfilled' ? v.value?.build || '—' : '—'
        services.value[c.i].latency = Date.now() - t0
      }))
      loading.value = false
    }
    watch(autoRefresh, val => { if (val) timer = setInterval(loadAll, 30000); else clearInterval(timer) })
    onMounted(loadAll)
    onUnmounted(() => clearInterval(timer))
    return { loading, autoRefresh, chartRange, services, reqChartOpt, errPieOpt, loadAll }
  }
})
</script>

<style lang="scss">
.monitor-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  @media (max-width: 900px) { grid-template-columns: 1fr; }
}

.monitor-card {
  padding: 16px;
  overflow: hidden;

  &__top { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 14px; }

  &__status-dot {
    width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 4px;
    &--ok { background: var(--brand-secondary); }
    &--err { background: var(--brand-danger); animation: pulse-dot 1.5s ease infinite; }
  }

  &__metrics { display: flex; gap: 0; border-top: 1px solid var(--border-subtle); padding-top: 12px; }
}

.monitor-metric {
  flex: 1;
  text-align: center;
  & + & { border-left: 1px solid var(--border-subtle); }

  &__value { font-size: 18px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; justify-content: center; &--err { color: var(--brand-danger); } &--warn { color: var(--brand-warning); } }
  &__label { font-size: 10px; color: var(--text-quaternary); text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px; }
}

.monitor-charts {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 12px;
  @media (max-width: 900px) { grid-template-columns: 1fr; }
}
</style>
