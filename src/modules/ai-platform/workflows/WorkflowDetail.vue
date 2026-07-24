<template>
  <q-page class="page-wrapper" v-if="workflow">
    <div class="page-header">
      <div class="page-header__left">
        <div style="display:flex;align-items:center;gap:10px">
          <q-btn flat round dense icon="arrow_back" to="/ai/workflows" />
          <div>
            <h1 class="page-title">{{ workflow.name }}</h1>
            <p class="page-subtitle">
              <span class="code-tag">{{ workflow.code }}</span>
              Schedules & Webhooks — automated triggers for this workflow
            </p>
          </div>
        </div>
      </div>
      <div class="page-header__actions">
        <router-link :to="`/ai/workflows/${workflow.id}/builder`" class="btn btn--secondary" style="text-decoration:none">
          <q-icon name="account_tree" size="15px" />
          Open Builder
        </router-link>
      </div>
    </div>

    <div class="surface" style="overflow:hidden">
      <q-tabs v-model="tab" dense align="left" style="border-bottom:1px solid var(--border-subtle);padding:0 12px">
        <q-tab name="schedules" label="Schedules" icon="schedule" />
        <q-tab name="webhooks" label="Webhooks" icon="webhook" />
      </q-tabs>

      <div style="padding:20px">
        <WorkflowSchedulesPanel v-if="tab === 'schedules'" :workflow-id="workflow.id" />
        <WorkflowWebhooksPanel v-if="tab === 'webhooks'" :workflow-id="workflow.id" />
      </div>
    </div>
  </q-page>

  <q-page v-else class="column items-center justify-center">
    <q-spinner size="48px" style="color:var(--brand-primary)" />
  </q-page>
</template>

<script>
import { defineComponent, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { agnoClient } from '../../../services/api/agno-runtime.client.js'
import { useUIStore } from '../../../stores/ui.store.js'
import WorkflowSchedulesPanel from './WorkflowSchedulesPanel.vue'
import WorkflowWebhooksPanel from './WorkflowWebhooksPanel.vue'

export default defineComponent({
  name: 'WorkflowDetail',
  components: { WorkflowSchedulesPanel, WorkflowWebhooksPanel },
  setup() {
    const route = useRoute()
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'AI Platform' }, { label: 'Workflows', to: '/ai/workflows' }, { label: 'Detail' }])

    const workflow = ref(null)
    const tab = ref('schedules')

    onMounted(async () => {
      workflow.value = await agnoClient.getWorkflow(route.params.id)
    })

    return { workflow, tab }
  }
})
</script>