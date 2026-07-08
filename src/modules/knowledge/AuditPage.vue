<template>
  <q-page class="q-pa-lg">
    <div class="row items-center q-mb-lg">
      <div>
        <div class="text-h5 text-weight-bold">Knowledge Audit</div>
        <div class="text-grey-6 text-caption">ACL Assignments & Access History — GET /acl/assignments</div>
      </div>
      <q-space />
      <q-btn outline color="primary" icon="refresh" :loading="loading" @click="loadData" />
    </div>
    <q-card flat bordered style="border-radius:12px">
      <q-table :rows="rows" :columns="cols" :loading="loading" row-key="id" flat class="enterprise-table">
        <template #body-cell-subject_type="props">
          <q-td :props="props">
            <q-chip dense size="sm" :color="props.value==='USER'?'blue':props.value==='ROLE'?'purple':'green'" text-color="white" :label="props.value" />
          </q-td>
        </template>
        <template #body-cell-access_level="props">
          <q-td :props="props">
            <q-chip dense size="sm" :color="props.value==='ADMIN'?'negative':props.value==='DELETE'?'warning':props.value==='WRITE'?'blue':'positive'" text-color="white" :label="props.value" />
          </q-td>
        </template>
      </q-table>
    </q-card>
  </q-page>
</template>
<script>
import { defineComponent, ref, onMounted } from 'vue'
import { knowledgeClient } from '../../services/api/knowledge-platform.client'
import { useUIStore } from '../../stores/ui.store'
import dayjs from 'dayjs'
export default defineComponent({
  name: 'KnowledgeAuditPage',
  setup() {
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'Knowledge' }, { label: 'Audit' }])
    const rows = ref([]), loading = ref(false)
    const cols = [
      { name: 'node_id', label: 'Node ID', field: 'node_id', align: 'left' },
      { name: 'subject_type', label: 'Subject Type', field: 'subject_type', align: 'left' },
      { name: 'subject_id', label: 'Subject ID', field: 'subject_id', align: 'left' },
      { name: 'access_level', label: 'Access Level', field: 'access_level', align: 'left' },
      { name: 'created_at', label: 'Assigned At', field: 'created_at', align: 'left', format: v => dayjs(v).format('YYYY-MM-DD HH:mm') }
    ]
    async function loadData() {
      loading.value = true
      try { rows.value = await knowledgeClient.listAclAssignments() }
      catch { rows.value = [] }
      finally { loading.value = false }
    }
    onMounted(loadData)
    return { rows, loading, cols, loadData }
  }
})
</script>
