<template>
  <q-page class="page-wrapper" v-if="available === null">
    <div class="surface empty-state" style="padding:60px">
      <q-spinner size="28px" style="color:var(--brand-primary)" />
    </div>
  </q-page>

  <q-page class="page-wrapper" v-else-if="available === false">
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-title">Quota Usage</h1>
        <p class="page-subtitle">GET /quota/usage — Tra cứu mức sử dụng quota theo user</p>
      </div>
    </div>
    <div class="surface empty-state" style="padding:60px">
      <div class="empty-state__icon"><q-icon name="query_stats" /></div>
      <div class="empty-state__title">Quota Management chưa được bật</div>
      <div class="empty-state__desc">Backend environment này chưa bật feature flag <code class="code-tag">FEATURE_QUOTA_MANAGEMENT</code>.</div>
    </div>
  </q-page>

  <template v-else>
    <q-page class="page-wrapper">
      <div class="page-header">
        <div class="page-header__left">
          <h1 class="page-title">Quota Usage</h1>
          <p class="page-subtitle">GET /quota/usage?user_id=&since_days= — Tổng hợp từ audit log (không phải số dư quota real-time)</p>
        </div>
      </div>

      <!-- Search bar -->
      <div class="filter-bar">
        <div style="min-width:320px">
          <UserPicker v-model="userId" placeholder="Tìm user theo username/email/họ tên…" @select="onUserSelect" />
        </div>
        <q-select v-model="sinceDays" :options="rangeOptions" outlined dense emit-value map-options
          style="min-width:200px" />
        <button class="btn btn--primary btn--sm" :disabled="!userId.trim() || loading" @click="loadUsage">
          <q-spinner v-if="loading" size="13px" style="color:white" />
          <q-icon v-else name="search" size="14px" />
          Tìm kiếm
        </button>
      </div>

      <div v-if="!usage && !loading && !searched" class="surface empty-state" style="padding:60px">
        <div class="empty-state__icon"><q-icon name="query_stats" /></div>
        <div class="empty-state__title">Nhập user_id để tra cứu usage</div>
        <div class="empty-state__desc">Nhập Keycloak user ID (sub claim) và chọn khoảng thời gian, sau đó bấm Tìm kiếm.</div>
      </div>

      <template v-else-if="usage">
        <div v-if="selectedUserInfo" style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <span style="font-size:13px;font-weight:600;color:var(--text-primary)">{{ selectedUserInfo.username || usage.user_id }}</span>
          <span v-if="selectedUserInfo.email" style="font-size:12px;color:var(--text-tertiary)">{{ selectedUserInfo.email }}</span>
          <span class="code-tag" style="font-size:10px">{{ usage.user_id }}</span>
        </div>

        <!-- Stat cards -->
        <div class="stats-grid q-mb-md">
          <div class="stat-card">
            <div class="stat-card__header">
              <span class="stat-card__label">Requests</span>
              <div class="stat-card__icon" style="background:rgba(99,102,241,0.1);color:#6366f1">
                <q-icon name="bolt" size="18px" />
              </div>
            </div>
            <div class="stat-card__value">{{ formatNum(usage.requests) }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card__header">
              <span class="stat-card__label">Tokens</span>
              <div class="stat-card__icon" style="background:rgba(16,185,129,0.1);color:#10b981">
                <q-icon name="memory" size="18px" />
              </div>
            </div>
            <div class="stat-card__value">{{ formatNum(usage.tokens) }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card__header">
              <span class="stat-card__label">Cost (USD)</span>
              <div class="stat-card__icon" style="background:rgba(245,158,11,0.1);color:#d97706">
                <q-icon name="attach_money" size="18px" />
              </div>
            </div>
            <div class="stat-card__value">${{ formatNum(usage.cost_usd) }}</div>
          </div>
        </div>

        <!-- Timeseries chart -->
        <div class="surface q-mb-md" style="padding:20px" v-if="usage.timeseries?.length">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <span style="font-size:14px;font-weight:600;color:var(--text-primary)">Usage theo thời gian</span>
            <div class="play-mode-toggle">
              <button v-for="m in metricModes" :key="m.key"
                :class="['play-mode-btn', chartMetric===m.key && 'play-mode-btn--active']"
                @click="chartMetric=m.key">{{ m.label }}</button>
            </div>
          </div>
          <v-chart :option="chartOption" style="height:260px" autoresize />
        </div>

        <!-- Applicable policies -->
        <div class="surface" style="overflow:hidden">
          <div style="padding:14px 16px;border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;gap:8px">
            <span style="font-size:13px;font-weight:600;color:var(--text-primary)">Policies áp dụng cho user này</span>
            <span class="code-tag" style="font-size:10px">scope_type=USER</span>
          </div>
          <div v-if="loadingPolicies" class="empty-state" style="padding:32px">
            <q-spinner size="24px" style="color:var(--brand-primary)" />
          </div>
          <div v-else-if="!userPolicies.length" class="empty-state" style="padding:32px">
            <div class="empty-state__title">Không có policy scope USER trực tiếp cho user này</div>
            <div class="empty-state__desc">Vẫn có thể còn áp dụng policy theo GROUP hoặc GLOBAL — hệ thống hiện chưa expose API tra cứu group của user để hiển thị tại đây.</div>
          </div>
          <div v-else style="padding:8px">
            <div v-for="p in userPolicies" :key="p.id" class="scope-row">
              <div class="scope-row__icon"><q-icon name="speed" size="16px" /></div>
              <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:6px">
                  <span class="code-tag">{{ p.metric }}</span>
                  <span class="code-tag">{{ p.period }}</span>
                  <span v-if="!p.enabled" class="badge badge--inactive badge--no-dot" style="font-size:10px">disabled</span>
                </div>
                <div style="font-size:12px;color:var(--text-tertiary);margin-top:3px">
                  limit: {{ p.limit_value?.toLocaleString() }} · priority: {{ p.priority }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <div v-else-if="loading" class="surface empty-state" style="padding:60px">
        <q-spinner size="28px" style="color:var(--brand-primary)" />
      </div>

      <div v-else class="surface empty-state" style="padding:60px">
        <div class="empty-state__icon"><q-icon name="search_off" /></div>
        <div class="empty-state__title">Không tìm thấy usage cho user này</div>
      </div>
    </q-page>
  </template>
</template>

<script>
import { defineComponent, ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useRoute } from 'vue-router'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import dayjs from 'dayjs'
import { quotaClient } from '../../../services/api/quota.client.js'
import { keycloakAdminClient } from '../../../services/api/keycloak-admin.client.js'
import { useUIStore } from '../../../stores/ui.store.js'
import UserPicker from '../../../shared/components/UserPicker.vue'

use([CanvasRenderer, LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent])

export default defineComponent({
  name: 'QuotaUsagePage',
  components: { VChart, UserPicker },
  setup() {
    const $q = useQuasar()
    const route = useRoute()
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'Quota Management' }, { label: 'Usage' }])

    const available = ref(null)
    const userId = ref(''), sinceDays = ref(30)
    const usage = ref(null), loading = ref(false), searched = ref(false)
    const userPolicies = ref([]), loadingPolicies = ref(false)
    const selectedUserInfo = ref(null)

    const rangeOptions = [
      { label: '7 ngày gần nhất', value: 7 },
      { label: '30 ngày gần nhất', value: 30 },
      { label: '90 ngày gần nhất', value: 90 },
      { label: 'Hôm nay (DAILY)', value: 1 }
    ]

    // ===== Timeseries chart =====
    const chartMetric = ref('tokens')
    const metricModes = [
      { key: 'tokens', label: 'Tokens' },
      { key: 'requests', label: 'Requests' },
      { key: 'cost_usd', label: 'Cost (USD)' }
    ]
    const METRIC_COLOR = { tokens: '#10b981', requests: '#6366f1', cost_usd: '#d97706' }

    const chartOption = computed(() => {
      const points = usage.value?.timeseries || []
      const labels = points.map(p => dayjs(p.period_start).format(
        usage.value?.granularity === 'daily' ? 'MM/DD' : 'MM/DD HH:mm'
      ))
      const values = points.map(p => p[chartMetric.value] ?? 0)
      const color = METRIC_COLOR[chartMetric.value] || '#6366f1'
      return {
        tooltip: { trigger: 'axis' },
        grid: { left: 44, right: 16, top: 16, bottom: 32 },
        xAxis: {
          type: 'category', data: labels,
          axisTick: { show: false },
          axisLine: { lineStyle: { color: 'var(--border-subtle)' } },
          axisLabel: { fontSize: 11, color: 'var(--text-quaternary)' }
        },
        yAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: 'var(--border-subtle)', type: 'dashed' } },
          axisLabel: { fontSize: 11, color: 'var(--text-quaternary)' }
        },
        series: [{
          type: 'bar',
          data: values,
          itemStyle: { color, borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 28
        }]
      }
    })

    function formatNum(v) {
      if (v == null) return '0'
      return Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })
    }

    function onUserSelect(info) {
      selectedUserInfo.value = info
    }

    async function loadUsage() {
      if (!userId.value.trim()) return
      loading.value = true; searched.value = true; usage.value = null
      try {
        usage.value = await quotaClient.getUsage({ user_id: userId.value.trim(), since_days: sinceDays.value })
      } catch (e) {
        $q.notify({ type: 'negative', message: e.response?.data?.message || 'Tra cứu usage thất bại' })
      } finally { loading.value = false }

      loadingPolicies.value = true
      try {
        const res = await quotaClient.listPolicies({ scope_type: 'USER', scope_value: userId.value.trim(), page_size: 200 })
        userPolicies.value = res.items || []
      } catch { userPolicies.value = [] }
      finally { loadingPolicies.value = false }
    }

    onMounted(async () => {
      available.value = await quotaClient.isAvailable()

      // Deep link from Quota Users list (?user_id=...) — pre-fill and
      // auto-search, and try to resolve a display name for the header.
      const qid = route.query.user_id
      if (qid) {
        userId.value = String(qid)
        loadUsage()
        try {
          const kcAvailable = await keycloakAdminClient.isAvailable()
          if (kcAvailable) {
            const resolved = await keycloakAdminClient.resolveUsers([String(qid)])
            selectedUserInfo.value = resolved[String(qid)] || null
          }
        } catch { /* keep raw id */ }
      }
    })

    return { available, userId, sinceDays, rangeOptions, usage, loading, searched, userPolicies, loadingPolicies, selectedUserInfo, formatNum, loadUsage, onUserSelect, chartMetric, metricModes, chartOption }
  }
})
</script>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  @media (max-width: 768px) { grid-template-columns: 1fr; }
}
.scope-row {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 8px; transition: background 120ms ease;
  &:hover { background: var(--surface-overlay); }
  &__icon {
    width: 30px; height: 30px; border-radius: 8px;
    background: var(--brand-primary-subtle); color: var(--brand-primary);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
}
</style>