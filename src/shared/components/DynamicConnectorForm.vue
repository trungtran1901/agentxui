<template>
  <div style="display:flex;flex-direction:column;gap:12px">
    <div v-for="(prop, key) in schemaProps" :key="key">
      <label class="field-label">
        {{ prop.title || key }}
        <span v-if="isRequired(key)" style="color:var(--brand-danger)">*</span>
      </label>

      <!-- boolean -->
      <q-toggle v-if="prop.type === 'boolean'"
        :model-value="!!modelValue[key]" dense
        @update:model-value="v => update(key, v)" />

      <!-- enum -->
      <q-select v-else-if="prop.enum"
        :model-value="modelValue[key]" outlined dense
        :options="prop.enum" clearable
        @update:model-value="v => update(key, v)" />

      <!-- number / integer -->
      <q-input v-else-if="prop.type === 'number' || prop.type === 'integer'"
        :model-value="modelValue[key]" outlined dense type="number"
        @update:model-value="v => update(key, v === '' ? null : Number(v))" />

      <!-- long text -->
      <q-input v-else-if="prop.format === 'textarea' || prop.type === 'object'"
        :model-value="typeof modelValue[key] === 'object' ? JSON.stringify(modelValue[key], null, 2) : modelValue[key]"
        outlined dense type="textarea" :rows="3"
        @update:model-value="v => updateRaw(key, v)" />

      <!-- password / secret -->
      <q-input v-else-if="prop.format === 'password' || /token|secret|key|password/i.test(key)"
        :model-value="modelValue[key]" outlined dense type="password" autocomplete="new-password"
        @update:model-value="v => update(key, v)" />

      <!-- default: string -->
      <q-input v-else
        :model-value="modelValue[key]" outlined dense
        :placeholder="prop.description || ''"
        @update:model-value="v => update(key, v)" />

      <div v-if="prop.description" style="font-size:11px;color:var(--text-quaternary);margin-top:3px">
        {{ prop.description }}
      </div>
    </div>

    <div v-if="!schemaProps || !Object.keys(schemaProps).length" class="hint-card">
      <q-icon name="info" size="16px" color="grey-6" />
      This connector does not require additional configuration.
    </div>
  </div>
</template>

<script>
import { defineComponent, computed } from 'vue'

// Renders a form purely from a JSON Schema `config_schema` object returned
// by GET /connectors. Adding a new connector server-side requires ZERO
// frontend changes — the form appears automatically.
export default defineComponent({
  name: 'DynamicConnectorForm',
  props: {
    schema: { type: Object, default: () => ({}) }, // config_schema from /connectors
    modelValue: { type: Object, default: () => ({}) }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const schemaProps = computed(() => props.schema?.properties || {})
    const required = computed(() => props.schema?.required || [])
    const isRequired = (key) => required.value.includes(key)

    function update(key, value) {
      emit('update:modelValue', { ...props.modelValue, [key]: value })
    }
    function updateRaw(key, raw) {
      // Try JSON parse for object-typed fields; fall back to raw string
      const prop = schemaProps.value[key]
      if (prop?.type === 'object') {
        try { update(key, JSON.parse(raw)) } catch { update(key, raw) }
      } else {
        update(key, raw)
      }
    }

    return { schemaProps, isRequired, update, updateRaw }
  }
})
</script>