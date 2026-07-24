<template>
  <div>
    <div v-if="featureDisabled" class="empty-state" style="padding:60px">
      <div class="empty-state__icon"><q-icon name="webhook" /></div>
      <div class="empty-state__title">Tính năng này chưa được bật trên môi trường này</div>
      <div class="empty-state__desc">Liên hệ quản trị viên để bật <code class="code-tag">FEATURE_WORKFLOW_WEBHOOKS</code> trên backend.</div>
    </div>

    <template v-else>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div style="font-size:12px;color:var(--text-tertiary)">
          {{ rows.length }} webhook{{ rows.length !== 1 ? 's' : '' }}
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn--secondary btn--sm" @click="loadData">
            <q-icon name="refresh" size="14px" :class="loading && 'spin'" />
          </button>
          <button class="btn btn--primary btn--sm" @click="openCreate">
            <q-icon name="add" size="14px" />
            New Webhook
          </button>
        </div>
      </div>

      <div v-if="!rows.length && !loading" class="empty-state" style="padding:48px">
        <div class="empty-state__icon"><q-icon name="webhook" /></div>
        <div class="empty-state__title">Chưa có webhook nào</div>
        <button class="btn btn--primary" style="margin-top:12px" @click="openCreate">
          <q-icon name="add" size="15px" />Tạo webhook đầu tiên
        </button>
      </div>

      <q-table v-else :rows="rows" :columns="columns" :loading="loading" row-key="id" flat class="eap-table">
        <template #body-cell-webhook_token="props">
          <q-td :props="props">
            <div style="display:flex;align-items:center;gap:6px">
              <span class="code-tag" style="font-size:11px">{{ props.value?.substring(0, 14) }}…</span>
              <button class="btn btn--ghost btn--sm btn--icon" title="Copy invoke URL" @click="copyInvokeUrl(props.row)">
                <q-icon name="content_copy" size="13px" />
              </button>
            </div>
          </q-td>
        </template>
        <template #body-cell-invoke_path="props">
          <q-td :props="props" style="font-size:11px;color:var(--text-tertiary);word-break:break-all">
            {{ props.value }}
          </q-td>
        </template>
        <template #body-cell-enabled="props">
          <q-td :props="props">
            <q-toggle :model-value="props.value" dense @update:model-value="v => toggleEnabled(props.row, v)" />
          </q-td>
        </template>
        <template #body-cell-created_at="props">
          <q-td :props="props" style="font-size:12px;color:var(--text-tertiary)">
            {{ props.value ? dayjs(props.value).format('YYYY-MM-DD HH:mm') : '—' }}
          </q-td>
        </template>
        <template #body-cell-actions="props">
          <q-td :props="props" auto-width>
            <button class="tbl-action-btn tbl-action-btn--danger" title="Xóa" @click="confirmDelete(props.row)">
              <q-icon name="delete_outline" size="15px" />
            </button>
          </q-td>
        </template>
      </q-table>
    </template>

    <!-- Create dialog -->
    <BaseFormDialog v-model="dialog" title="Tạo Webhook mới"
      subtitle="POST /workflows/{workflow_id}/webhooks" icon="webhook" icon-color="#10b981"
      confirm-label="Tạo" :loading="saving" width="600px" @confirm="save">
      <div style="display:flex;flex-direction:column;gap:14px">
        <div>
          <label class="field-label">secret <span style="color:var(--text-quaternary)">(optional)</span></label>
          <div style="display:flex;gap:6px">
            <q-input v-model="form.secret" outlined dense type="password" style="flex:1" autocomplete="new-password" />
            <button class="btn btn--secondary btn--sm" @click="generateSecret">Generate random</button>
          </div>
          <div style="font-size:11px;color:var(--brand-danger);margin-top:4px">
            Nếu để trống, endpoint sẽ KHÔNG xác thực chữ ký — bất kỳ ai có URL đều gọi được.
          </div>
        </div>

        <div>
          <label class="field-label">input_field_path <span style="color:var(--text-quaternary)">(optional)</span></label>
          <q-input v-model="form.input_field_path" outlined dense placeholder="data.message" />
          <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px">
            Nếu hệ thống ngoài gửi <code>{"{"}"data":{"{"}"message":"..."{"}"}{"}"}</code>, nhập <code>data.message</code> để lấy đúng field đó làm input; để trống nếu muốn dùng toàn bộ JSON body.
          </div>
        </div>

        <div>
          <label class="field-label">allowed_source_ips <span style="color:var(--text-quaternary)">(optional)</span></label>
          <q-select v-model="form.allowed_source_ips" outlined dense multiple use-chips
            use-input new-value-mode="add-unique" :options="[]"
            hint="Nhấn Enter để thêm một IP" />
        </div>

        <div>
          <label class="field-label">user_id <span style="color:var(--text-quaternary)">(optional)</span></label>
          <q-input v-model="form.user_id" outlined dense placeholder="svc-account-01" />
        </div>

        <div class="row items-center">
          <q-toggle v-model="form.enabled" color="primary" />
          <span style="font-size:13px;color:var(--text-primary);margin-left:4px">Enabled</span>
        </div>

        <div v-if="apiError" class="api-error-box"><q-icon name="error_outline" size="16px" />{{ apiError }}</div>
      </div>
    </BaseFormDialog>

    <!-- One-time secret reveal — must explicitly acknowledge to close -->
    <q-dialog v-model="revealDialog" persistent>
      <q-card style="width:600px;max-width:96vw;border-radius:12px">
        <div class="dialog-header">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="dialog-header__icon" style="background:var(--brand-danger)">
              <q-icon name="warning" size="16px" style="color:white" />
            </div>
            <div class="dialog-header__title">Webhook đã được tạo — lưu lại thông tin này ngay</div>
          </div>
        </div>
        <div style="padding:20px;display:flex;flex-direction:column;gap:14px">
          <div>
            <label class="field-label">invoke URL</label>
            <div class="code-block" style="font-size:12px;word-break:break-all">{{ revealInfo.url }}</div>
          </div>

          <div v-if="revealInfo.secret">
            <label class="field-label" style="color:var(--brand-danger)">secret — đây là lần duy nhất bạn nhìn thấy giá trị này</label>
            <div class="code-block" style="font-size:12px;word-break:break-all;border:1.5px solid var(--brand-danger)">{{ revealInfo.secret }}</div>
          </div>
          <div v-else class="api-error-box">
            <q-icon name="info" size="16px" />
            Webhook này không có secret — endpoint KHÔNG xác thực chữ ký, ai có URL cũng gọi được.
          </div>

          <div>
            <label class="field-label">Ví dụ test bằng cURL</label>
            <pre class="code-block" style="font-size:11px;white-space:pre-wrap">{{ revealInfo.curl }}</pre>
          </div>

          <button class="btn btn--primary" style="width:100%" @click="closeReveal">
            Tôi đã lưu lại
          </button>
        </div>
      </q-card>
    </q-dialog>
  </div>
</template>

<script>
import { defineComponent, ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { workflowTriggersClient } from '../../../services/api/workflow-triggers.client.js'
import BaseFormDialog from '../../../shared/components/BaseFormDialog.vue'
import dayjs from 'dayjs'

function randomSecret(len = 40) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  const arr = new Uint32Array(len)
  crypto.getRandomValues(arr)
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length]
  return out
}

export default defineComponent({
  name: 'WorkflowWebhooksPanel',
  components: { BaseFormDialog },
  props: { workflowId: { type: String, required: true } },
  setup(props) {
    const $q = useQuasar()
    const rows = ref([]), loading = ref(false), saving = ref(false)
    const featureDisabled = ref(false)
    const dialog = ref(false), apiError = ref('')

    const defaultForm = () => ({
      secret: '', input_field_path: '', allowed_source_ips: [], user_id: '', enabled: true
    })
    const form = ref(defaultForm())

    const revealDialog = ref(false)
    const revealInfo = ref({ url: '', secret: '', curl: '' })

    const columns = [
      { name: 'webhook_token', label: 'Token', field: 'webhook_token', align: 'left' },
      { name: 'invoke_path', label: 'Invoke URL', field: 'invoke_path', align: 'left' },
      { name: 'enabled', label: 'Enabled', field: 'enabled', align: 'center' },
      { name: 'created_at', label: 'Ngày tạo', field: 'created_at', align: 'left' },
      { name: 'actions', label: '', field: 'actions', align: 'right' }
    ]

    async function loadData() {
      loading.value = true; featureDisabled.value = false
      try {
        const r = await workflowTriggersClient.listWebhooks(props.workflowId, { page_size: 100 })
        rows.value = r.items || []
      } catch (e) {
        if (workflowTriggersClient.isFeatureDisabledError(e)) featureDisabled.value = true
        else $q.notify({ type: 'negative', message: e.response?.data?.message || 'Tải danh sách webhook thất bại' })
      } finally { loading.value = false }
    }

    function openCreate() { apiError.value = ''; form.value = defaultForm(); dialog.value = true }
    function generateSecret() { form.value.secret = randomSecret() }

    function buildCurl(url, secret) {
      const lines = [
        `curl -X POST ${url} \\`,
        `  -H "Content-Type: application/json" \\`
      ]
      if (secret) lines.push(`  -H "X-Webhook-Signature: <hmac-sha256-hex-của-body-với-secret>" \\`)
      lines.push(`  -d '{"message": "nội dung test"}'`)
      return lines.join('\n')
    }

    async function save() {
      apiError.value = ''
      saving.value = true
      const secretSent = form.value.secret
      const body = {
        secret: form.value.secret || undefined,
        input_field_path: form.value.input_field_path || undefined,
        allowed_source_ips: form.value.allowed_source_ips.length ? form.value.allowed_source_ips : undefined,
        user_id: form.value.user_id || undefined,
        enabled: form.value.enabled
      }
      try {
        const created = await workflowTriggersClient.createWebhook(props.workflowId, body)
        const url = workflowTriggersClient.invokeUrl(created)
        revealInfo.value = { url, secret: secretSent, curl: buildCurl(url, secretSent) }
        dialog.value = false
        revealDialog.value = true
        loadData()
      } catch (e) {
        apiError.value = e.response?.data?.message || 'Tạo webhook thất bại'
      } finally { saving.value = false }
    }

    function closeReveal() { revealDialog.value = false; revealInfo.value = { url: '', secret: '', curl: '' } }

    async function toggleEnabled(row, val) {
      try {
        await workflowTriggersClient.updateWebhook(row.id, { enabled: val })
        row.enabled = val
        $q.notify({ type: 'positive', message: val ? 'Đã bật' : 'Đã tắt' })
      } catch (e) { $q.notify({ type: 'negative', message: e.response?.data?.message || 'Cập nhật thất bại' }) }
    }

    async function copyInvokeUrl(row) {
      try {
        await navigator.clipboard.writeText(workflowTriggersClient.invokeUrl(row))
        $q.notify({ type: 'positive', message: 'Đã copy invoke URL' })
      } catch { $q.notify({ type: 'negative', message: 'Copy thất bại' }) }
    }

    function confirmDelete(row) {
      $q.dialog({
        title: 'Xóa Webhook',
        message: 'Mọi hệ thống ngoài đang dùng URL này sẽ ngừng hoạt động ngay lập tức. Tiếp tục?',
        cancel: { label: 'Hủy', flat: true },
        ok: { label: 'Xóa', color: 'negative', unelevated: true }
      }).onOk(async () => {
        try {
          await workflowTriggersClient.deleteWebhook(row.id)
          $q.notify({ type: 'positive', message: 'Đã xóa' })
          loadData()
        } catch (e) { $q.notify({ type: 'negative', message: e.response?.data?.message || 'Xóa thất bại' }) }
      })
    }

    onMounted(loadData)

    return {
      rows, columns, loading, saving, featureDisabled,
      dialog, apiError, form, revealDialog, revealInfo, dayjs,
      loadData, openCreate, generateSecret, save, closeReveal,
      toggleEnabled, copyInvokeUrl, confirmDelete
    }
  }
})
</script>