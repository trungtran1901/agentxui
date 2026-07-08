<template>
  <q-page class="q-pa-lg">
    <div class="text-h5 text-weight-bold q-mb-lg">System Settings</div>
    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-6">
        <q-card flat bordered style="border-radius:12px">
          <q-card-section style="border-bottom:1px solid var(--color-border)">
            <div class="text-subtitle1 text-weight-bold">API Base URLs</div>
          </q-card-section>
          <q-card-section class="q-gutter-md">
            <q-input v-model="settings.agnoUrl" label="Agno Runtime URL" outlined dense
              hint="VITE_AGNO_API_URL — default: /api/v1" />
            <q-input v-model="settings.mcpUrl" label="MCP Gateway URL" outlined dense
              hint="VITE_MCP_API_URL — default: /api/v1" />
            <q-input v-model="settings.knowledgeUrl" label="Knowledge Platform URL" outlined dense
              hint="VITE_KNOWLEDGE_API_URL — default: /api/v1" />
            <q-btn color="primary" label="Lưu cấu hình" unelevated @click="saveSettings" />
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-md-6">
        <q-card flat bordered style="border-radius:12px">
          <q-card-section style="border-bottom:1px solid var(--color-border)">
            <div class="text-subtitle1 text-weight-bold">Authentication</div>
          </q-card-section>
          <q-card-section class="q-gutter-md">
            <q-input v-model="authToken" label="Bearer Token (lưu vào localStorage)" outlined dense type="password" />
            <q-btn color="primary" label="Cập nhật Token" unelevated @click="saveToken" />
            <q-btn flat color="negative" label="Xóa Token" @click="clearToken" />
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>
<script>
import { defineComponent, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useUIStore } from '../../../stores/ui.store'
import { ENV } from '../../../services/env'
export default defineComponent({
  name: 'SettingsPage',
  setup() {
    const $q = useQuasar(); const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'System' }, { label: 'Settings' }])
    const settings = ref({ agnoUrl: ENV.AGNO_API_URL || '/api/v1', mcpUrl: ENV.MCP_API_URL || '/api/v1', knowledgeUrl: ENV.KNOWLEDGE_API_URL || '/api/v1' })
    const authToken = ref(localStorage.getItem('auth_token') || '')
    function saveSettings() { $q.notify({ type: 'info', message: 'URL cấu hình chỉ có hiệu lực qua biến môi trường VITE_*' }) }
    function saveToken() { localStorage.setItem('auth_token', authToken.value); $q.notify({ type: 'positive', message: 'Token đã lưu' }) }
    function clearToken() { localStorage.removeItem('auth_token'); authToken.value = ''; $q.notify({ type: 'positive', message: 'Token đã xóa' }) }
    return { settings, authToken, saveSettings, saveToken, clearToken }
  }
})
</script>
