<template>
  <q-page class="agent-detail" v-if="item">
    <!-- Header -->
    <div class="agent-detail__header">
      <q-btn flat round icon="arrow_back" to="/ai/agents" class="q-mr-sm" />
      <div class="agent-detail__avatar">
        <q-icon name="smart_toy" size="22px" />
      </div>
      <div class="agent-detail__heading">
        <div class="text-h5 text-weight-bold">{{ item.name }}</div>
        <div class="row items-center q-gutter-xs q-mt-xs">
          <span class="code-tag">{{ item.code }}</span>
          <span class="text-grey-6 text-caption code-mono">{{ item.id }}</span>
        </div>
      </div>
      <q-space />
      <span class="badge q-mr-md" :class="item.enabled ? 'badge--active' : 'badge--inactive'">{{ item.enabled ? 'enabled' : 'disabled' }}</span>
      <q-btn outline color="primary" icon="rule_folder" label="Capabilities" class="q-mr-sm" unelevated
        :to="`/mcp/assignments?level=agent&target_id=${item.id}`" />
      <q-btn color="primary" icon="save" label="Lưu thay đổi" unelevated :loading="saving" @click="saveAgent" />
    </div>

    <div class="agent-detail__body">
      <div class="agent-detail__main">
        <q-card flat bordered class="modern-card">
          <q-tabs v-model="activeTab" dense align="left" class="agent-detail__tabs" active-color="primary" indicator-color="primary">
            <q-tab name="general" label="General" icon="info" />
            <q-tab name="model" label="Model" icon="psychology" />
            <q-tab name="prompt" label="Prompt" icon="article" />
            <q-tab name="skills" label="Skills" icon="extension" />
            <q-tab name="memory" label="Memory" icon="memory" />
          </q-tabs>

          <q-tab-panels v-model="activeTab" animated>
            <!-- GENERAL -->
            <q-tab-panel name="general" class="agent-detail__panel">
              <div class="field-grid field-grid--8-4">
                <div class="field-group">
                  <label class="field-label">name <span class="field-required">*</span></label>
                  <q-input v-model="form.name" outlined dense />
                </div>
                <div class="field-group">
                  <label class="field-label">code</label>
                  <q-input :model-value="item.code" outlined dense disable hint="Không đổi được sau khi tạo" />
                </div>
              </div>

              <div class="field-group">
                <label class="field-label">description</label>
                <q-input v-model="form.description" outlined dense type="textarea" :rows="3" placeholder="Mô tả ngắn gọn vai trò của agent..." />
              </div>

              <div class="field-grid field-grid--6-6">
                <div class="field-group">
                  <label class="field-label">team</label>
                  <div class="static-value">
                    <q-icon name="groups" size="16px" color="grey-6" />
                    <router-link v-if="team" :to="`/ai/teams/${team.id}`" class="text-primary text-weight-medium" style="text-decoration:none">
                      {{ team.name }}
                    </router-link>
                    <span v-else class="code-mono">{{ item.team_id }}</span>
                  </div>
                </div>
                <div class="field-group">
                  <label class="field-label">status</label>
                  <div class="static-value">
                    <q-toggle v-model="form.enabled" dense />
                    <span class="text-caption text-grey-6">{{ form.enabled ? 'Enabled' : 'Disabled' }}</span>
                  </div>
                </div>
              </div>
            </q-tab-panel>

            <!-- MODEL -->
            <q-tab-panel name="model" class="agent-detail__panel">
              <div class="field-group">
                <label class="field-label">
                  model_id
                  <span class="field-hint">PUT /agents/{id}</span>
                </label>
                <q-select v-model="form.model_id" outlined dense :options="modelOptions" emit-value map-options
                  clearable placeholder="Dùng model mặc định của AgentOS">
                  <template #prepend><q-icon name="psychology" size="18px" color="grey-6" /></template>
                </q-select>
              </div>

              <div class="field-grid field-grid--4-8">
                <div class="field-group">
                  <label class="field-label">temperature</label>
                  <q-input v-model.number="form.temperature" outlined dense type="number" step="0.1" min="0" max="2">
                    <template #prepend><q-icon name="thermostat" size="18px" color="grey-6" /></template>
                  </q-input>
                </div>
                <div class="field-group">
                  <label class="field-label">&nbsp;</label>
                  <div class="hint-card">
                    <q-icon name="info" size="16px" color="blue-6" />
                    Temperature thấp (0–0.3) → trả lời nhất quán, ổn định. Cao (0.7–1) → sáng tạo, đa dạng hơn.
                  </div>
                </div>
              </div>
            </q-tab-panel>

            <!-- PROMPT -->
            <q-tab-panel name="prompt" class="agent-detail__panel">
              <div class="field-group">
                <label class="field-label">
                  prompt_id
                  <span class="field-hint">PUT /agents/{id}</span>
                </label>
                <q-select v-model="form.prompt_id" outlined dense :options="promptOptions" emit-value map-options
                  clearable placeholder="Không gán prompt — agent dùng shared_prompt của AgentOS"
                  @update:model-value="loadPromptPreview">
                  <template #prepend><q-icon name="article" size="18px" color="grey-6" /></template>
                </q-select>
              </div>

              <div v-if="loadingPrompt" class="hint-card">
                <q-spinner size="16px" color="primary" /> Đang tải nội dung prompt...
              </div>

              <div v-else-if="promptPreview" class="field-group">
                <label class="field-label">
                  Nội dung
                  <span class="field-hint">read-only — sửa tại trang Prompts</span>
                  <span class="code-tag" style="margin-left:6px">v{{ promptPreview.version }}</span>
                </label>
                <textarea class="json-textarea" rows="12" disabled :value="promptPreview.content" />
              </div>

              <div v-else class="hint-card">
                <q-icon name="info" size="16px" color="grey-6" />
                Agent này chưa được gán prompt riêng.
              </div>
            </q-tab-panel>

            <!-- SKILLS -->
            <q-tab-panel name="skills" class="agent-detail__panel">
              <div class="panel-section-head">
                <div>
                  <div class="text-subtitle2 text-weight-bold">Skills được gán</div>
                  <span class="field-hint">POST /skills/assign · GET /agents/{id}/skills</span>
                </div>
                <q-space />
                <q-btn outline color="primary" icon="add" label="Gán Skill" size="sm" unelevated @click="assignSkillDialog = true" />
              </div>
              <div class="modern-list">
                <div v-for="s in agentSkills" :key="s.id" class="modern-list__item">
                  <q-avatar size="34px" color="teal-1" text-color="teal-8" icon="extension" style="border-radius:9px" />
                  <div class="modern-list__body">
                    <div class="text-weight-medium">{{ s.name }}</div>
                    <div class="text-caption text-grey-6">{{ (s.capability_codes || []).join(', ') || '—' }}</div>
                  </div>
                  <q-btn flat round icon="remove_circle" color="red" size="sm" @click="unassignSkill(s)" :loading="removingSkill === s.id" />
                </div>
                <div v-if="!agentSkills.length" class="empty-state" style="padding:32px">
                  <div class="empty-state__title">Chưa có skill nào</div>
                </div>
              </div>
            </q-tab-panel>

            <!-- MEMORY -->
            <q-tab-panel name="memory" class="agent-detail__panel">
              <div class="panel-section-head">
                <div>
                  <div class="text-subtitle2 text-weight-bold">Agentic Memory</div>
                  <span class="field-hint">GET /agents/{id}/memories</span>
                </div>
                <q-space />
                <q-btn outline color="primary" size="sm" label="Load" icon="refresh" unelevated @click="loadAgentMemory" :loading="loadingMemory" />
              </div>
              <div class="modern-list">
                <div v-for="m in agentMemories" :key="m.id" class="modern-list__item modern-list__item--align-start">
                  <q-avatar size="34px" color="blue-1" text-color="blue-8" icon="memory" style="border-radius:9px" />
                  <div class="modern-list__body">
                    <div style="white-space:normal;line-height:1.6">{{ m.content }}</div>
                    <div class="text-caption text-grey-6 q-mt-xs">{{ dayjs(m.created_at).format('YYYY-MM-DD HH:mm') }}</div>
                  </div>
                  <q-btn flat round icon="delete" size="sm" color="red" @click="deleteMemory(m)" />
                </div>
                <div v-if="!agentMemories.length && !loadingMemory" class="empty-state" style="padding:32px">
                  <div class="empty-state__title">Chưa có memory — AI tự đúc rút sau mỗi session</div>
                </div>
              </div>
            </q-tab-panel>
          </q-tab-panels>
        </q-card>
      </div>

      <div class="agent-detail__side">
        <q-card flat bordered class="modern-card">
          <q-card-section>
            <div class="text-subtitle1 text-weight-bold q-mb-md">Statistics</div>
            <div class="stat-row">
              <span>Skills assigned</span>
              <q-badge color="teal" :label="agentSkills.length" rounded />
            </div>
            <div class="stat-row">
              <span>Memories</span>
              <q-badge color="blue" :label="agentMemories.length" rounded />
            </div>
            <div class="stat-row">
              <span>Created</span>
              <span class="text-caption text-grey-6">{{ dayjs(item.created_at).format('YYYY-MM-DD') }}</span>
            </div>
            <div class="stat-row">
              <span>Updated</span>
              <span class="text-caption text-grey-6">{{ dayjs(item.updated_at).format('YYYY-MM-DD') }}</span>
            </div>
          </q-card-section>
        </q-card>

        <q-card flat bordered class="modern-card modern-card--danger q-mt-md">
          <q-card-section>
            <div class="text-subtitle1 text-weight-bold q-mb-sm">Danger zone</div>
            <div class="text-caption text-grey-6 q-mb-md">Soft delete — record được giữ lại để tham chiếu lịch sử.</div>
            <q-btn outline color="negative" icon="delete_outline" label="Delete Agent" class="full-width" unelevated @click="confirmDelete" />
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>

  <q-page v-else class="column items-center justify-center">
    <q-spinner size="48px" color="primary" />
  </q-page>

  <!-- Assign Skill Dialog -->
  <BaseFormDialog v-model="assignSkillDialog" title="Gán Skill cho Agent" icon="extension"
    confirm-label="Gán" :loading="assigningSkill" width="480px" @confirm="doAssignSkill">
    <div class="field-group">
      <label class="field-label">skill_id <span class="field-required">*</span></label>
      <q-select v-model="skillToAssign" outlined dense :options="allSkillOptions" emit-value map-options placeholder="Chọn Skill" />
    </div>
  </BaseFormDialog>
</template>

<script>
import { defineComponent, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { agnoClient } from '../../../services/api/agno-runtime.client'
import BaseFormDialog from '../../../shared/components/BaseFormDialog.vue'
import dayjs from 'dayjs'

export default defineComponent({
  name: 'AgentDetail',
  components: { BaseFormDialog },
  setup() {
    const route = useRoute(), router = useRouter(), $q = useQuasar()
    const item = ref(null), team = ref(null)
    const activeTab = ref('general'), saving = ref(false)
    const form = ref({ name: '', description: '', enabled: true, model_id: null, prompt_id: null, temperature: 0.7 })

    const modelOptions = ref([]), promptOptions = ref([]), allSkillOptions = ref([])
    const promptPreview = ref(null), loadingPrompt = ref(false)
    const agentSkills = ref([]), agentMemories = ref([])
    const loadingMemory = ref(false), removingSkill = ref(null)
    const assignSkillDialog = ref(false), skillToAssign = ref(null), assigningSkill = ref(false)

    async function loadMeta() {
      const [models, skills, prompts] = await Promise.allSettled([
        agnoClient.listModels({ page_size: 100 }),
        agnoClient.listSkills({ page_size: 100 }),
        agnoClient.listPrompts({ page_size: 100 })
      ])
      if (models.status === 'fulfilled') modelOptions.value = models.value.items.map(m => ({ label: `${m.provider} / ${m.model}`, value: m.id }))
      if (skills.status === 'fulfilled') allSkillOptions.value = skills.value.items.map(s => ({ label: s.name, value: s.id }))
      if (prompts.status === 'fulfilled') promptOptions.value = prompts.value.items.map(p => ({ label: `${p.name} (${p.code} · v${p.version})`, value: p.id }))
    }

    async function loadPromptPreview() {
      if (!form.value.prompt_id) { promptPreview.value = null; return }
      loadingPrompt.value = true
      try { promptPreview.value = await agnoClient.getPrompt(form.value.prompt_id) }
      catch { promptPreview.value = null }
      finally { loadingPrompt.value = false }
    }

    async function saveAgent() {
      if (!item.value) return
      saving.value = true
      try {
        item.value = await agnoClient.updateAgent(item.value.id, {
          name: form.value.name, description: form.value.description, enabled: form.value.enabled,
          model_id: form.value.model_id, prompt_id: form.value.prompt_id, temperature: form.value.temperature
        })
        $q.notify({ type: 'positive', message: 'Đã lưu' })
      } catch (e) {
        $q.notify({ type: 'negative', message: e.response?.data?.message || 'Lỗi' })
      } finally { saving.value = false }
    }

    function confirmDelete() {
      $q.dialog({ title: 'Xóa Agent', message: `Xóa "${item.value.name}"? Record được giữ lại để tham chiếu lịch sử (soft delete).`, cancel: { label: 'Hủy' }, ok: { color: 'red', label: 'Xóa', unelevated: true } })
        .onOk(async () => {
          await agnoClient.deleteAgent(item.value.id)
          $q.notify({ type: 'positive', message: 'Đã xóa' })
          router.push('/ai/agents')
        })
    }

    async function loadAgentMemory() {
      if (!item.value) return
      loadingMemory.value = true
      try { const r = await agnoClient.listAgentMemories(item.value.id); agentMemories.value = r.items }
      catch { agentMemories.value = [] }
      finally { loadingMemory.value = false }
    }

    async function deleteMemory(m) {
      await agnoClient.deleteMemory(m.id)
      agentMemories.value = agentMemories.value.filter(x => x.id !== m.id)
      $q.notify({ type: 'positive', message: 'Đã xóa memory' })
    }

    async function loadAgentSkills() {
      if (!item.value) return
      try {
        // GET /agents/{id}/skills — not paginated; backend may return a bare
        // array or an {items:[...]} envelope, so handle both defensively.
        const r = await agnoClient.listAgentSkills(item.value.id)
        agentSkills.value = Array.isArray(r) ? r : (r.items || [])
      } catch {
        agentSkills.value = []
      }
    }

    async function doAssignSkill() {
      if (!item.value || !skillToAssign.value) return
      assigningSkill.value = true
      try {
        await agnoClient.assignSkill(item.value.id, skillToAssign.value)
        $q.notify({ type: 'positive', message: 'Đã gán skill (POST /skills/assign)' })
        assignSkillDialog.value = false
        skillToAssign.value = null
        await loadAgentSkills()
      } catch (e) { $q.notify({ type: 'negative', message: e.response?.data?.message || 'Lỗi' }) }
      finally { assigningSkill.value = false }
    }

    async function unassignSkill(skill) {
      if (!item.value) return
      removingSkill.value = skill.id
      try {
        await agnoClient.unassignSkill(item.value.id, skill.id)
        agentSkills.value = agentSkills.value.filter(s => s.id !== skill.id)
        $q.notify({ type: 'positive', message: 'Đã gỡ skill (POST /skills/unassign)' })
      } catch (e) { $q.notify({ type: 'negative', message: e.response?.data?.message || 'Lỗi' }) }
      finally { removingSkill.value = null }
    }

    onMounted(async () => {
      item.value = await agnoClient.getAgent(route.params.id)
      form.value = {
        name: item.value.name, description: item.value.description || '', enabled: item.value.enabled ?? true,
        model_id: item.value.model_id || null, prompt_id: item.value.prompt_id || null, temperature: item.value.temperature ?? 0.7
      }
      loadMeta()
      loadPromptPreview()
      try { team.value = await agnoClient.getTeam(item.value.team_id) } catch { team.value = null }
      loadAgentSkills()
    })

    return { item, team, activeTab, saving, form, modelOptions, promptOptions, promptPreview, loadingPrompt, allSkillOptions, agentSkills, agentMemories,
      loadingMemory, removingSkill, assignSkillDialog, skillToAssign, assigningSkill, dayjs,
      saveAgent, confirmDelete, loadAgentMemory, deleteMemory, doAssignSkill, unassignSkill, loadPromptPreview }
  }
})
</script>

<style scoped>
/* ===== Layout shell ===== */
.agent-detail {
  padding: 28px 32px 48px;
  background: var(--surface-page, #f6f7f9);
  min-height: 100%;
}
.agent-detail__header {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 22px;
}
.agent-detail__avatar {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--brand-primary, #2563eb), #7c3aed);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.28);
}
.agent-detail__heading { line-height: 1.3; }
.agent-detail__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 20px;
  align-items: start;
}
@media (max-width: 1100px) {
  .agent-detail__body { grid-template-columns: 1fr; }
}
.agent-detail__main, .agent-detail__side { min-width: 0; }

/* ===== Cards ===== */
.modern-card {
  border-radius: 14px;
  border-color: var(--border-subtle, #e5e8ec);
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
  overflow: hidden;
}
.modern-card--danger { border-color: rgba(220, 38, 38, 0.18); }

.agent-detail__tabs {
  padding: 0 24px;
  border-bottom: 1px solid var(--border-subtle, #e5e8ec);
}
.agent-detail__panel {
  padding: 28px 32px 32px !important;
  display: flex;
  flex-direction: column;
  gap: 22px;
}

/* ===== Field layout (CSS grid — avoids Quasar row/col negative-margin edge clipping) ===== */
.field-grid {
  display: grid;
  gap: 20px;
}
.field-grid--8-4 { grid-template-columns: 2fr 1fr; }
.field-grid--6-6 { grid-template-columns: 1fr 1fr; }
.field-grid--4-8 { grid-template-columns: 1fr 2fr; }
@media (max-width: 640px) {
  .field-grid--8-4, .field-grid--6-6, .field-grid--4-8 { grid-template-columns: 1fr; }
}

.field-group { display: flex; flex-direction: column; }
.field-label {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #5f6b7a);
  letter-spacing: 0.2px;
}
.field-required { color: var(--brand-danger, #dc2626); }
.field-hint {
  font-weight: 400;
  font-size: 11px;
  color: var(--text-quaternary, #9aa3af);
  margin-left: 6px;
}

.static-value {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 2px;
}

.hint-card {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: var(--surface-overlay, #f3f5f8);
  border: 1px solid var(--border-subtle, #e5e8ec);
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--text-secondary, #5f6b7a);
}

.json-textarea {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--border-default, #d8dde3);
  border-radius: 10px;
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  line-height: 1.6;
  resize: vertical;
  outline: none;
  background: var(--surface-base, #fff);
  color: var(--text-primary, #1a1f29);
}
.json-textarea:focus { border-color: var(--brand-primary, #2563eb); }
.json-textarea:disabled { background: var(--surface-overlay, #f3f5f8); color: var(--text-secondary, #5f6b7a); }

/* ===== Section heads & lists ===== */
.panel-section-head { display: flex; align-items: center; }

.modern-list { display: flex; flex-direction: column; gap: 8px; }
.modern-list__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--border-subtle, #e5e8ec);
  border-radius: 12px;
  background: var(--surface-base, #fff);
  transition: border-color .15s ease, box-shadow .15s ease;
}
.modern-list__item:hover {
  border-color: var(--border-default, #d8dde3);
  box-shadow: 0 1px 4px rgba(16, 24, 40, 0.06);
}
.modern-list__item--align-start { align-items: flex-start; }
.modern-list__body { flex: 1; min-width: 0; }

/* ===== Sidebar stats ===== */
.stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 0;
  border-bottom: 1px solid var(--border-subtle, #eef0f3);
  font-size: 13px;
}
.stat-row:last-child { border-bottom: none; }
</style>