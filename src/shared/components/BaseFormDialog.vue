<template>
  <q-dialog v-model="show" :persistent="persistent" :maximized="maximized">
    <q-card :style="cardStyle" style="display:flex;flex-direction:column;max-height:90vh">
      <!-- Header -->
      <div class="dialog-header">
        <div style="display:flex;align-items:center;gap:10px">
          <div v-if="icon" class="dialog-header__icon" :style="iconBgStyle">
            <q-icon :name="icon" size="16px" style="color:white" />
          </div>
          <div>
            <div class="dialog-header__title">{{ title }}</div>
            <div v-if="subtitle" class="dialog-header__subtitle">{{ subtitle }}</div>
          </div>
        </div>
        <button class="dialog-header__close" @click="show = false">
          <q-icon name="close" size="18px" />
        </button>
      </div>

      <!-- Body -->
      <div style="flex:1;overflow-y:auto;padding:20px 24px">
        <slot />
      </div>

      <!-- Footer -->
      <div class="dialog-footer">
        <slot name="actions">
          <button class="btn btn--secondary" @click="show = false">Cancel</button>
          <button class="btn btn--primary" :disabled="loading" @click="$emit('confirm')">
            <q-spinner v-if="loading" size="14px" style="color:white;margin-right:6px" />
            {{ confirmLabel }}
          </button>
        </slot>
      </div>
    </q-card>
  </q-dialog>
</template>

<script>
import { defineComponent, computed } from 'vue'
export default defineComponent({
  name: 'BaseFormDialog',
  props: {
    modelValue: Boolean,
    title: String,
    subtitle: String,
    icon: String,
    iconColor: { type: String, default: '#6366f1' },
    confirmLabel: { type: String, default: 'Save' },
    loading: Boolean,
    persistent: { type: Boolean, default: true },
    maximized: Boolean,
    width: { type: String, default: '560px' }
  },
  emits: ['update:modelValue', 'confirm'],
  setup(props, { emit }) {
    const show = computed({
      get: () => props.modelValue,
      set: (v) => emit('update:modelValue', v)
    })
    const cardStyle = computed(() => `width:${props.width};max-width:96vw`)
    const iconBgStyle = computed(() => `background:${props.iconColor}`)
    return { show, cardStyle, iconBgStyle }
  }
})
</script>

<style lang="scss">
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;

  &__icon {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &__title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  &__subtitle {
    font-size: 12px;
    color: var(--text-tertiary);
    margin-top: 1px;
  }

  &__close {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-tertiary);
    transition: all 120ms ease;
    flex-shrink: 0;
    &:hover { background: var(--surface-sunken); color: var(--text-primary); }
  }
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--border-subtle);
  flex-shrink: 0;
}
</style>
