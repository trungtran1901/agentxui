<template>
  <q-page class="q-pa-lg">
    <div class="text-h5 text-weight-bold q-mb-lg">Environment</div>
    <q-card flat bordered style="border-radius:12px">
      <q-card-section style="border-bottom:1px solid var(--color-border)">
        <div class="text-subtitle1 text-weight-bold">Runtime Environment Variables</div>
      </q-card-section>
      <q-card-section>
        <q-list dense bordered separator style="border-radius:8px">
          <q-item v-for="env in envVars" :key="env.key">
            <q-item-section style="max-width:280px"><q-item-label class="code-mono text-weight-bold" style="font-size:12px">{{ env.key }}</q-item-label></q-item-section>
            <q-item-section><q-item-label class="code-mono text-grey-7" style="font-size:12px">{{ env.value }}</q-item-label></q-item-section>
            <q-item-section side><q-chip dense size="xs" :color="env.set ? 'positive' : 'grey'" text-color="white" :label="env.set ? 'set' : 'default'" /></q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>
    <q-card flat bordered style="border-radius:12px;margin-top:16px">
      <q-card-section style="border-bottom:1px solid var(--color-border)">
        <div class="text-subtitle1 text-weight-bold">Version Info (GET /version)</div>
      </q-card-section>
      <q-card-section>
        <div v-if="versionInfo" class="row q-col-gutter-md">
          <div class="col-auto"><div class="text-caption text-grey-6">Version</div><code class="code-mono text-weight-bold">{{ versionInfo.version }}</code></div>
          <div v-if="versionInfo.build" class="col-auto"><div class="text-caption text-grey-6">Build</div><code class="code-mono">{{ versionInfo.build }}</code></div>
        </div>
        <q-btn outline color="primary" label="Fetch Version" class="q-mt-md" @click="fetchVersion" :loading="loading" />
      </q-card-section>
    </q-card>
  </q-page>
</template>
<script>
import { defineComponent, ref, onMounted } from 'vue'
import { agnoClient } from '../../../services/api/agno-runtime.client'
import { useUIStore } from '../../../stores/ui.store'
import { ENV } from '../../../services/env'
export default defineComponent({
  name: 'EnvironmentPage',
  setup() {
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'System' }, { label: 'Environment' }])
    const loading = ref(false), versionInfo = ref(null)
    const envVars = [
      { key: 'VITE_AGNO_API_URL', value: ENV.AGNO_API_URL || '/api/v1', set: !!ENV.AGNO_API_URL },
      { key: 'VITE_MCP_API_URL', value: ENV.MCP_API_URL || '/api/v1', set: !!ENV.MCP_API_URL },
      { key: 'VITE_KNOWLEDGE_API_URL', value: ENV.KNOWLEDGE_API_URL || '/api/v1', set: !!ENV.KNOWLEDGE_API_URL },
      { key: 'MODE', value: import.meta.env.MODE || 'development', set: true },
      { key: 'BASE_URL', value: import.meta.env.BASE_URL || '/', set: true }
    ]
    async function fetchVersion() { loading.value = true; try { versionInfo.value = await agnoClient.version() } catch { versionInfo.value = { version: 'unavailable' } } finally { loading.value = false } }
    onMounted(fetchVersion)
    return { loading, versionInfo, envVars, fetchVersion }
  }
})
</script>
