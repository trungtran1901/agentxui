<template>
  <div>
    <div v-if="featureDisabled" class="empty-state" style="padding:60px">
      <div class="empty-state__icon"><q-icon name="schedule" /></div>
      <div class="empty-state__title">Tính năng này chưa được bật trên môi trường này</div>
      <div class="empty-state__desc">Liên hệ quản trị viên để bật <code class="code-tag">FEATURE_WORKFLOW_SCHEDULING</code> trên backend.</div>
    </div>

    <template v-else>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div style="font-size:12px;color:var(--text-tertiary)">
          {{ rows.length }} schedule{{ rows.length !== 1 ? 's' : '' }}
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn--secondary btn--sm" @click="loadData">
            <q-icon name="refresh" size="14px" :class="loading && 'spin'" />
          </button>
          <button class="btn btn--primary btn--sm" @click="openCreate">
            <q-icon name="add" size="14px" />
            New Schedule
          </button>
        </div>
      </div>

      <div v-if="!rows.length && !loading" class="empty-state" style="padding:48px">
        <div class="empty-state__icon"><q-icon name="schedule" /></div>
        <div class="empty-state__title">Chưa có lịch chạy nào</div>
        <button class="btn btn--primary" style="margin-top:12px" @click="openCreate">
          <q-icon name="add" size="15px" />Tạo lịch chạy đầu tiên
        </button>
      </div>

      <q-table v-else :rows="rows" :columns="columns" :loading="loading" row-key="id" flat class="eap-table">
        <template #body-cell-schedule_type="props">
          <q-td :props="props">
            <span class="code-tag">{{ props.value }}</span>
            <div style="font-size:11px;color:var(--text-tertiary);margin-top:3px">{{ describeSchedule(props.row) }}</div>
          </q-td>
        </template>
        <template #body-cell-next_run_at="props">
          <q-td :props="props" style="font-size:12px;color:var(--text-tertiary)">
            {{ props.value ? dayjs(props.value).format('YYYY-MM-DD HH:mm') : '—' }}
          </q-td>
        </template>
        <template #body-cell-last_run_at="props">
          <q-td :props="props">
            <div style="font-size:12px;color:var(--text-tertiary)">{{ props.value ? dayjs(props.value).format('YYYY-MM-DD HH:mm') : '—' }}</div>
            <span v-if="props.row.last_status" class="badge" :class="lastStatusClass(props.row.last_status)" style="margin-top:3px">{{ props.row.last_status }}</span>
          </q-td>
        </template>
        <template #body-cell-enabled="props">
          <q-td :props="props">
            <q-toggle :model-value="props.value" dense @update:model-value="v => toggleEnabled(props.row, v)" />
          </q-td>
        </template>
        <template #body-cell-actions="props">
          <q-td :props="props" auto-width>
            <div style="display:flex;align-items:center;gap:2px;justify-content:flex-end">
              <button class="tbl-action-btn" title="Chạy thử ngay" @click="doTrigger(props.row)">
                <q-icon name="play_circle_outline" size="15px" :class="triggering === props.row.id && 'spin'" style="color:var(--brand-secondary)" />
              </button>
              <button class="tbl-action-btn" title="Sửa" @click="openEdit(props.row)">
                <q-icon name="edit" size="15px" />
              </button>
              <div class="tbl-action-divider" />
              <button class="tbl-action-btn tbl-action-btn--danger" title="Xóa" @click="confirmDelete(props.row)">
                <q-icon name="delete_outline" size="15px" />
              </button>
            </div>
          </q-td>
        </template>
      </q-table>
    </template>

    <!-- Create / Edit dialog -->
    <BaseFormDialog v-model="dialog" :title="editItem ? 'Sửa Schedule' : 'Tạo Schedule mới'"
      subtitle="POST /workflows/{workflow_id}/schedules" icon="schedule" icon-color="#f59e0b"
      :loading="saving" width="600px" @confirm="save">
      <div style="display:flex;flex-direction:column;gap:14px">
        <div>
          <label class="field-label">schedule_type <span style="color:var(--brand-danger)">*</span></label>
          <div class="subject-type-picker">
            <button v-for="t in ['CRON','INTERVAL']" :key="t"
              :class="['subject-type-btn', form.schedule_type === t && 'subject-type-btn--active']"
              @click="form.schedule_type = t">
              <q-icon :name="t === 'CRON' ? 'event_repeat' : 'timelapse'" size="16px" />
              {{ t }}
            </button>
          </div>
        </div>

        <div v-if="form.schedule_type === 'CRON'">
          <label class="field-label">cron_expression <span style="color:var(--brand-danger)">*</span></label>
          <q-input v-model="form.cron_expression" outlined dense placeholder="0 9 * * MON-FRI" />
          <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px">{{ describeCron(form.cron_expression) }}</div>
        </div>

        <div v-else>
          <label class="field-label">interval_seconds <span style="color:var(--brand-danger)">*</span></label>
          <q-input v-model.number="form.interval_seconds" outlined dense type="number" min="10" hint="Tối thiểu 10 giây" />
          <div style="display:flex;gap:6px;margin-top:8px">
            <button v-for="p in intervalPresets" :key="p.label" class="btn btn--ghost btn--sm"
              @click="form.interval_seconds = p.seconds">{{ p.label }}</button>
          </div>
        </div>

        <div>
          <label class="field-label">timezone</label>
          <q-input v-model="form.timezone" outlined dense placeholder="UTC" />
        </div>

        <div>
          <label class="field-label">input_template <span style="color:var(--brand-danger)">*</span></label>
          <q-input v-model="form.input_template" outlined dense type="textarea" :rows="3"
            placeholder="Kiểm tra báo cáo doanh thu hôm nay" />
          <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px">
            Nội dung này sẽ được gửi làm input mỗi lần workflow chạy tự động, giống như một tin nhắn cố định.
          </div>
        </div>

        <div>
          <label class="field-label">user_id <span style="color:var(--text-quaternary)">(optional)</span></label>
          <q-input v-model="form.user_id" outlined dense placeholder="svc-account-01" />
          <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px">Dùng để gán quyền sở hữu cho các run được tạo tự động.</div>
        </div>

        <div class="row items-center">
          <q-toggle v-model="form.enabled" color="primary" />
          <span style="font-size:13px;color:var(--text-primary);margin-left:4px">Enabled</span>
        </div>

        <div v-if="apiError" class="api-error-box"><q-icon name="error_outline" size="16px" />{{ apiError }}</div>
      </div>
    </BaseFormDialog>
  </div>
</template>

<script>
import { defineComponent, ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { workflowTriggersClient } from '../../../services/api/workflow-triggers.client.js'
import BaseFormDialog from '../../../shared/components/BaseFormDialog.vue'
import dayjs from 'dayjs'

const WEEKDAY_NAMES = { MON: 'Thứ 2', TUE: 'Thứ 3', WED: 'Thứ 4', THU: 'Thứ 5', FRI: 'Thứ 6', SAT: 'Thứ 7', SUN: 'CN' }

function describeCron(expr) {
  if (!expr || !expr.trim()) return 'Nhập cron expression để xem mô tả'
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return expr
  const [min, hour, dom, , dow] = parts

  const timePart = (/^\d+$/.test(min) && /^\d+$/.test(hour))
    ? `lúc ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`
    : `theo phút "${min}" giờ "${hour}"`

  let dayPart = 'mỗi ngày'
  if (dow !== '*') {
    const range = dow.match(/^([A-Z]{3})-([A-Z]{3})$/)
    if (range && WEEKDAY_NAMES[range[1]] && WEEKDAY_NAMES[range[2]]) {
      dayPart = `${WEEKDAY_NAMES[range[1]]} đến ${WEEKDAY_NAMES[range[2]]}`
    } else {
      const names = dow.split(',').map(d => WEEKDAY_NAMES[d] || d).join(', ')
      dayPart = names
    }
  } else if (dom !== '*') {
    dayPart = `ngày ${dom} hàng tháng`
  }

  return `${dayPart} ${timePart}`
}

export default defineComponent({
  name: 'WorkflowSchedulesPanel',
  components: { BaseFormDialog },
  props: { workflowId: { type: String, required: true } },
  setup(props) {
    const $q = useQuasar()
    const rows = ref([]), loading = ref(false), saving = ref(false), triggering = ref(null)
    const featureDisabled = ref(false)
    const dialog = ref(false), editItem = ref(null), apiError = ref('')

    const defaultForm = () => ({
      schedule_type: 'CRON', cron_expression: '', interval_seconds: 3600,
      timezone: 'UTC', input_template: '', user_id: '', enabled: true
    })
    const form = ref(defaultForm())

    const intervalPresets = [
      { label: '5 phút', seconds: 300 },
      { label: '15 phút', seconds: 900 },
      { label: '1 giờ', seconds: 3600 },
      { label: '1 ngày', seconds: 86400 }
    ]

    const columns = [
      { name: 'schedule_type', label: 'Lịch chạy', field: 'schedule_type', align: 'left' },
      { name: 'next_run_at', label: 'Lần chạy tiếp theo', field: 'next_run_at', align: 'left' },
      { name: 'last_run_at', label: 'Lần chạy gần nhất', field: 'last_run_at', align: 'left' },
      { name: 'enabled', label: 'Enabled', field: 'enabled', align: 'center' },
      { name: 'actions', label: '', field: 'actions', align: 'right' }
    ]

    const lastStatusClass = (s) => ({
      completed: 'badge--active', success: 'badge--active',
      failed: 'badge--error', error: 'badge--error', running: 'badge--running'
    }[s] || 'badge--pending')

    function describeSchedule(row) {
      if (row.schedule_type === 'CRON') return describeCron(row.cron_expression)
      if (!row.interval_seconds) return '—'
      const s = row.interval_seconds
      if (s % 86400 === 0) return `Mỗi ${s / 86400} ngày`
      if (s % 3600 === 0) return `Mỗi ${s / 3600} giờ`
      if (s % 60 === 0) return `Mỗi ${s / 60} phút`
      return `Mỗi ${s} giây`
    }

    async function loadData() {
      loading.value = true; featureDisabled.value = false
      try {
        const r = await workflowTriggersClient.listSchedules(props.workflowId, { page_size: 100 })
        rows.value = r.items || []
      } catch (e) {
        if (workflowTriggersClient.isFeatureDisabledError(e)) featureDisabled.value = true
        else $q.notify({ type: 'negative', message: e.response?.data?.message || 'Tải danh sách schedule thất bại' })
      } finally { loading.value = false }
    }

    function openCreate() { editItem.value = null; apiError.value = ''; form.value = defaultForm(); dialog.value = true }

    function openEdit(item) {
      editItem.value = item; apiError.value = ''
      form.value = {
        schedule_type: item.schedule_type,
        cron_expression: item.cron_expression || '',
        interval_seconds: item.interval_seconds || 3600,
        timezone: item.timezone || 'UTC',
        input_template: item.input_template || '',
        user_id: item.user_id || '',
        enabled: item.enabled ?? true
      }
      dialog.value = true
    }

    async function save() {
      apiError.value = ''
      if (form.value.schedule_type === 'CRON' && !form.value.cron_expression.trim()) {
        apiError.value = 'cron_expression là bắt buộc khi schedule_type=CRON'; return
      }
      if (form.value.schedule_type === 'INTERVAL' && (!form.value.interval_seconds || form.value.interval_seconds < 10)) {
        apiError.value = 'interval_seconds là bắt buộc và tối thiểu 10 giây'; return
      }
      if (!form.value.input_template.trim()) { apiError.value = 'input_template là bắt buộc'; return }

      const body = {
        schedule_type: form.value.schedule_type,
        ...(form.value.schedule_type === 'CRON'
          ? { cron_expression: form.value.cron_expression }
          : { interval_seconds: form.value.interval_seconds }),
        timezone: form.value.timezone || undefined,
        input_template: form.value.input_template,
        user_id: form.value.user_id || undefined,
        enabled: form.value.enabled
      }

      saving.value = true
      try {
        if (editItem.value) await workflowTriggersClient.updateSchedule(editItem.value.id, body)
        else await workflowTriggersClient.createSchedule(props.workflowId, body)
        $q.notify({ type: 'positive', message: 'Đã lưu schedule' })
        dialog.value = false
        loadData()
      } catch (e) {
        apiError.value = e.response?.data?.message || 'Lưu thất bại'
      } finally { saving.value = false }
    }

    async function toggleEnabled(row, val) {
      try {
        await workflowTriggersClient.updateSchedule(row.id, { enabled: val })
        row.enabled = val
        $q.notify({ type: 'positive', message: val ? 'Đã bật' : 'Đã tắt' })
      } catch (e) { $q.notify({ type: 'negative', message: e.response?.data?.message || 'Cập nhật thất bại' }) }
    }

    async function doTrigger(row) {
      triggering.value = row.id
      try {
        await workflowTriggersClient.triggerSchedule(row.id)
        $q.notify({ type: 'positive', message: 'Đã kích hoạt chạy thử' })
        setTimeout(loadData, 1200)
      } catch (e) {
        $q.notify({ type: 'negative', message: e.response?.data?.message || 'Chạy thử thất bại' })
      } finally { triggering.value = null }
    }

    function confirmDelete(row) {
      $q.dialog({
        title: 'Xóa Schedule',
        message: 'Xóa lịch chạy này? Hành động này không thể hoàn tác.',
        cancel: { label: 'Hủy', flat: true },
        ok: { label: 'Xóa', color: 'negative', unelevated: true }
      }).onOk(async () => {
        try {
          await workflowTriggersClient.deleteSchedule(row.id)
          $q.notify({ type: 'positive', message: 'Đã xóa' })
          loadData()
        } catch (e) { $q.notify({ type: 'negative', message: e.response?.data?.message || 'Xóa thất bại' }) }
      })
    }

    onMounted(loadData)

    return {
      rows, columns, loading, saving, triggering, featureDisabled,
      dialog, editItem, apiError, form, intervalPresets, dayjs,
      lastStatusClass, describeSchedule, describeCron,
      loadData, openCreate, openEdit, save, toggleEnabled, doTrigger, confirmDelete
    }
  }
})
</script>

<style lang="scss" scoped>
.subject-type-picker { display: flex; gap: 6px; }
.subject-type-btn {
  flex: 1;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px; border-radius: 8px; border: 1.5px solid var(--border-default);
  background: var(--surface-raised); color: var(--text-tertiary); cursor: pointer;
  font-size: 12px; font-weight: 500; transition: all 120ms ease; font-family: var(--font-sans);
  &:hover { border-color: var(--brand-primary); color: var(--brand-primary); }
  &--active { border-color: var(--brand-primary); background: var(--brand-primary-subtle); color: var(--brand-primary); font-weight: 600; }
}
</style>