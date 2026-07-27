<template>
  <div>
    <!-- Autocomplete mode — Keycloak Admin API available -->
    <q-select v-if="available"
      :model-value="modelValue"
      :options="options"
      outlined dense use-input clearable
      input-debounce="300"
      option-value="id"
      :option-label="opt => displayLabel(opt)"
      emit-value
      :loading="searching"
      :placeholder="placeholder"
      @filter="onFilter"
      @update:model-value="onSelect"
    >
      <template #option="scope">
        <q-item v-bind="scope.itemProps">
          <q-item-section avatar>
            <div style="width:26px;height:26px;border-radius:50%;background:var(--brand-primary-subtle);color:var(--brand-primary);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">
              {{ initials(scope.opt) }}
            </div>
          </q-item-section>
          <q-item-section>
            <q-item-label style="font-size:13px">{{ scope.opt.username }}</q-item-label>
            <q-item-label caption>{{ scope.opt.email || scope.opt.id }}</q-item-label>
          </q-item-section>
          <q-item-section side v-if="scope.opt.enabled === false">
            <span class="badge badge--inactive badge--no-dot" style="font-size:9px">disabled</span>
          </q-item-section>
        </q-item>
      </template>
      <template #no-option>
        <q-item>
          <q-item-section class="text-grey" style="font-size:12px">
            {{ searching ? 'Đang tìm…' : 'Gõ để tìm user theo username/email/họ tên' }}
          </q-item-section>
        </q-item>
      </template>
      <template #selected-item="scope" v-if="selectedInfo">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:13px">{{ selectedInfo.username || scope.opt }}</span>
        </div>
      </template>
    </q-select>

    <!-- Fallback — plain text input when Keycloak Admin API is off -->
    <q-input v-else
      :model-value="modelValue"
      outlined dense
      :placeholder="placeholder || 'Keycloak user ID (sub claim)'"
      @update:model-value="v => $emit('update:modelValue', v)"
    />
  </div>
</template>

<script>
import { defineComponent, ref, onMounted, watch } from 'vue'
import { keycloakAdminClient } from '../../services/api/keycloak-admin.client.js'

// Autocomplete user picker backed by GET /keycloak/users. Degrades to a
// plain text input (raw Keycloak user id / sub) when
// FEATURE_KEYCLOAK_ADMIN_API is off on the backend, so every call site
// stays functional either way without extra branching.
export default defineComponent({
  name: 'UserPicker',
  props: {
    modelValue: { type: String, default: '' },
    placeholder: { type: String, default: 'Tìm user theo username/email…' }
  },
  emits: ['update:modelValue', 'select'],
  setup(props, { emit }) {
    const available = ref(null)
    const options = ref([])
    const searching = ref(false)
    const selectedInfo = ref(null)

    async function resolveSelected() {
      if (!props.modelValue || !available.value) { selectedInfo.value = null; return }
      try {
        const res = await keycloakAdminClient.resolveUsers([props.modelValue])
        selectedInfo.value = res[props.modelValue] || null
      } catch { selectedInfo.value = null }
    }

    function onFilter(val, update) {
      searching.value = true
      keycloakAdminClient.searchUsers({ search: val, max_results: 20 })
        .then(users => { update(() => { options.value = users; searching.value = false }) })
        .catch(() => { update(() => { options.value = []; searching.value = false }) })
    }

    function onSelect(id) {
      emit('update:modelValue', id || '')
      const info = options.value.find(o => o.id === id) || null
      selectedInfo.value = info
      emit('select', info)
    }

    function initials(opt) {
      const s = opt?.username || opt?.email || '?'
      return s.substring(0, 2).toUpperCase()
    }

    function displayLabel(opt) {
      if (!opt) return ''
      if (typeof opt === 'string') return selectedInfo.value?.username || opt
      return opt.username || opt.email || opt.id
    }

    watch(() => props.modelValue, resolveSelected)

    onMounted(async () => {
      available.value = await keycloakAdminClient.isAvailable()
      if (available.value) {
        onFilter('', () => {})
        resolveSelected()
      }
    })

    return { available, options, searching, selectedInfo, onFilter, onSelect, initials, displayLabel }
  }
})
</script>