<template>
  <q-page class="page-wrapper" v-if="available === null">
    <div class="surface empty-state" style="padding:60px">
      <q-spinner size="28px" style="color:var(--brand-primary)" />
    </div>
  </q-page>

  <q-page class="page-wrapper" v-else-if="available === false">
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-title">Quota theo User</h1>
        <p class="page-subtitle">GET /quota/users — Tổng hợp usage theo user</p>
      </div>
    </div>
    <div class="surface empty-state" style="padding:60px">
      <div class="empty-state__icon"><q-icon name="groups" /></div>
      <div class="empty-state__title">Quota Management chưa được bật</div>
      <div class="empty-state__desc">Backend environment này chưa bật feature flag <code class="code-tag">FEATURE_QUOTA_MANAGEMENT</code>.</div>
    </div>
  </q-page>

  <template v-else>
    <q-page class="page-wrapper">
      <div class="page-header">
        <div class="page-header__left">
          <h1 class="page-title">Quota theo User</h1>
          <p class="page-subtitle">GET /quota/users — Danh sách user đã phát sinh quota usage, bấm vào để xem chi tiết timeseries</p>
        </div>
        <div class="page-header__actions">
          <button class="btn btn--secondary" @click="loadData">
            <q-icon name="refresh" size="15px" :class="loading && 'spin'" />
          </button>
        </div>
      </div>

      <div class="filter-bar">
        <q-select v-model="sinceDays" :options="rangeOptions" outlined dense emit-value map-options
          label="Khoảng thời gian" style="min-width:200px" @update:model-value="loadData" />
        <q-select v-model="sortBy" :options="sortOptions" outlined dense emit-value map-options
          label="Sắp xếp theo" style="min-width:180px" @update:model-value="loadData" />
        <div style="flex:1" />
        <div style="font-size:12px;color:var(--text-tertiary)">{{ pagination.rowsNumber }} user</div>
      </div>

      <div class="surface" style="overflow:hidden">
        <q-table :rows="rows" :columns="columns" :loading="loading" row-key="user_id" flat class="eap-table"
          :pagination="pagination" @request="onRequest">

          <template #body-cell-user="props">
            <q-td :props="props" style="cursor:pointer" @click="goToUsage(props.row)">
              <div style="display:flex;align-items:center;gap:8px">
                <div style="width:28px;height:28px;border-radius:50%;background:var(--brand-primary-subtle);color:var(--brand-primary);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">
                  {{ initials(props.row) }}
                </div>
                <div style="min-width:0">
                  <div style="font-size:13px;font-weight:600;color:var(--brand-primary)">
                    {{ props.row.username || (props.row.user_id?.substring(0,16) + '…') }}
                  </div>
                  <div style="font-size:11px;color:var(--text-tertiary)">
                    {{ props.row.email || props.row.user_id }}
                  </div>
                </div>
              </div>
            </q-td>
          </template>

          <template #body-cell-total_tokens="props">
            <q-td :props="props" style="text-align:right;font-weight:600">{{ formatNum(props.value) }}</q-td>
          </template>
          <template #body-cell-total_requests="props">
            <q-td :props="props" style="text-align:right">{{ formatNum(props.value) }}</q-td>
          </template>
          <template #body-cell-total_cost_usd="props">
            <q-td :props="props" style="text-align:right">${{ formatNum(props.value) }}</q-td>
          </template>
          <template #body-cell-last_used_at="props">
            <q-td :props="props" style="color:var(--text-tertiary);font-size:12px">
              {{ props.value ? dayjs(props.value).fromNow() : '—' }}
            </q-td>
          </template>
          <template #body-cell-actions="props">
            <q-td :props="props" auto-width>
              <button class="tbl-action-btn" title="Xem chi tiết" @click="goToUsage(props.row)">
                <q-icon name="query_stats" size="15px" />
              </button>
            </q-td>
          </template>

          <template #no-data>
            <div class="empty-state" style="width:100%;padding:60px">
              <div class="empty-state__icon"><q-icon name="groups" /></div>
              <div class="empty-state__title">Không có user nào phát sinh usage trong khoảng thời gian này</div>
            </div>
          </template>
        </q-table>
      </div>

      <div v-if="!keycloakAvailable" class="api-error-box" style="margin-top:10px">
        <q-icon name="info_outline" size="16px" />
        Keycloak Admin API chưa bật — chỉ hiển thị user_id thô, không có username/email.
      </div>
    </q-page>
  </template>
</template>

<script>
import { defineComponent, ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { quotaClient } from '../../../services/api/quota.client.js'
import { keycloakAdminClient } from '../../../services/api/keycloak-admin.client.js'
import { useUIStore } from '../../../stores/ui.store.js'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
dayjs.extend(relativeTime)

export default defineComponent({
  name: 'QuotaUsersPage',
  setup() {
    const $q = useQuasar()
    const router = useRouter()
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'Quota Management' }, { label: 'Theo User' }])

    const available = ref(null), keycloakAvailable = ref(false)
    const rows = ref([]), loading = ref(false)
    const sinceDays = ref(30), sortBy = ref('tokens')
    const pagination = ref({ page: 1, rowsPerPage: 50, rowsNumber: 0 })

    const rangeOptions = [
      { label: '7 ngày gần nhất', value: 7 },
      { label: '30 ngày gần nhất', value: 30 },
      { label: '90 ngày gần nhất', value: 90 }
    ]
    const sortOptions = [
      { label: 'Tokens', value: 'tokens' },
      { label: 'Requests', value: 'requests' },
      { label: 'Cost (USD)', value: 'cost_usd' },
      { label: 'Dùng gần nhất', value: 'last_used_at' }
    ]

    const columns = [
      { name: 'user', label: 'User', field: 'user_id', align: 'left' },
      { name: 'total_tokens', label: 'Tokens', field: 'total_tokens', align: 'right', sortable: false },
      { name: 'total_requests', label: 'Requests', field: 'total_requests', align: 'right' },
      { name: 'total_cost_usd', label: 'Cost (USD)', field: 'total_cost_usd', align: 'right' },
      { name: 'last_used_at', label: 'Dùng gần nhất', field: 'last_used_at', align: 'left' },
      { name: 'actions', label: '', field: 'actions', align: 'right' }
    ]

    function formatNum(v) {
      if (v == null) return '0'
      return Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })
    }

    function initials(row) {
      const s = row.username || row.email || row.user_id || '?'
      return s.substring(0, 2).toUpperCase()
    }

    async function resolveMissingUsers() {
      // Backend already resolves username/email when FEATURE_KEYCLOAK_ADMIN_API
      // is on; if any rows still lack it (flag off, or resolve failed
      // upstream for that particular id), fall back to a client-side batch
      // resolve so the table degrades to raw ids only when truly necessary.
      const missing = rows.value.filter(r => !r.username && !r.email).map(r => r.user_id)
      if (!missing.length || !keycloakAvailable.value) return
      try {
        const resolved = await keycloakAdminClient.resolveUsers(missing)
        rows.value = rows.value.map(r => {
          const info = resolved[r.user_id]
          return info ? { ...r, username: r.username || info.username, email: r.email || info.email } : r
        })
      } catch { /* leave raw ids */ }
    }

    async function loadData() {
      loading.value = true
      try {
        const res = await quotaClient.listUsers({
          since_days: sinceDays.value,
          sort_by: sortBy.value,
          page: pagination.value.page,
          page_size: pagination.value.rowsPerPage
        })
        rows.value = res.items || []
        pagination.value.rowsNumber = res.total ?? rows.value.length
        resolveMissingUsers()
      } catch (e) {
        if (e.response?.status === 404) { available.value = false; return }
        $q.notify({ type: 'negative', message: 'Failed to load quota users' })
      } finally { loading.value = false }
    }

    function onRequest(reqProp) {
      pagination.value.page = reqProp.pagination.page
      pagination.value.rowsPerPage = reqProp.pagination.rowsPerPage
      loadData()
    }

    function goToUsage(row) {
      router.push({ path: '/quota/usage', query: { user_id: row.user_id } })
    }

    onMounted(async () => {
      available.value = await quotaClient.isAvailable()
      keycloakAvailable.value = await keycloakAdminClient.isAvailable()
      if (available.value) loadData()
    })

    return {
      available, keycloakAvailable, rows, columns, loading, sinceDays, sortBy, rangeOptions, sortOptions,
      pagination, dayjs, formatNum, initials, loadData, onRequest, goToUsage
    }
  }
})
</script>