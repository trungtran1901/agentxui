<template>
  <q-page class="page-wrapper">
    <!-- Page Header -->
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-title">{{ title }}</h1>
        <p v-if="subtitle" class="page-subtitle">{{ subtitle }}</p>
      </div>
      <div class="page-header__actions">
        <slot name="header-actions">
          <button v-if="showCreate" class="btn btn--primary" @click="$emit('create')">
            <q-icon name="add" size="16px" />
            <span>New {{ entityName }}</span>
          </button>
        </slot>
      </div>
    </div>

    <!-- Filter Bar -->
    <div v-if="showFilters" class="filter-bar">
      <q-input
        v-model="searchText"
        dense outlined
        :placeholder="`Search ${entityName}s…`"
        clearable
        style="min-width:220px"
        @update:model-value="$emit('search', searchText)"
      >
        <template #prepend>
          <q-icon name="search" size="15px" style="color:var(--text-quaternary)" />
        </template>
      </q-input>

      <slot name="filters" />

      <div style="flex:1" />

      <button class="btn btn--secondary btn--sm" @click="$emit('refresh')">
        <q-icon name="refresh" size="15px" />
        <span>Refresh</span>
      </button>
    </div>

    <!-- Table -->
    <div class="surface" style="overflow:hidden">
      <q-table
        :rows="rows"
        :columns="columns"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        flat
        class="eap-table"
        @request="$emit('page-change', $event)"
      >
        <template v-for="(_, name) in $slots" #[name]="slotData">
          <slot :name="name" v-bind="slotData || {}" />
        </template>

        <!-- Status column -->
        <template #body-cell-status="props">
          <q-td :props="props">
            <span class="badge" :class="`badge--${props.value}`">{{ props.value }}</span>
          </q-td>
        </template>

        <!-- Actions column -->
        <template #body-cell-actions="props">
          <q-td :props="props" auto-width>
            <div style="display:flex;align-items:center;gap:2px;justify-content:flex-end">
              <button class="tbl-action-btn" @click="$emit('view', props.row)" title="View">
                <q-icon name="open_in_new" size="15px" />
              </button>
              <button class="tbl-action-btn" @click="$emit('edit', props.row)" title="Edit">
                <q-icon name="edit" size="15px" />
              </button>
              <button v-if="showClone" class="tbl-action-btn" @click="$emit('clone', props.row)" title="Clone">
                <q-icon name="content_copy" size="15px" />
              </button>
              <div class="tbl-action-divider" />
              <button class="tbl-action-btn tbl-action-btn--danger" @click="$emit('delete', props.row)" title="Delete">
                <q-icon name="delete_outline" size="15px" />
              </button>
            </div>
          </q-td>
        </template>

        <!-- Loading -->
        <template #loading>
          <q-inner-loading showing>
            <q-spinner size="28px" style="color:var(--brand-primary)" />
          </q-inner-loading>
        </template>

        <!-- Empty -->
        <template #no-data>
          <div class="empty-state" style="width:100%">
            <div class="empty-state__icon">
              <q-icon name="inbox" />
            </div>
            <div class="empty-state__title">No {{ entityName }}s yet</div>
            <div class="empty-state__desc">
              Get started by creating your first {{ entityName.toLowerCase() }}.
            </div>
            <button v-if="showCreate" class="btn btn--primary" @click="$emit('create')">
              <q-icon name="add" size="15px" />
              <span>Create {{ entityName }}</span>
            </button>
          </div>
        </template>
      </q-table>
    </div>
  </q-page>
</template>

<script>
import { defineComponent, ref } from 'vue'
export default defineComponent({
  name: 'BaseCrudPage',
  props: {
    title: String,
    subtitle: String,
    entityName: { type: String, default: 'Item' },
    rows: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    loading: Boolean,
    pagination: { type: Object, default: () => ({ rowsPerPage: 15 }) },
    showCreate: { type: Boolean, default: true },
    showClone: { type: Boolean, default: false },
    showFilters: { type: Boolean, default: true }
  },
  emits: ['create', 'edit', 'delete', 'clone', 'view', 'search', 'refresh', 'page-change'],
  setup() {
    const searchText = ref('')
    return { searchText }
  }
})
</script>

<style lang="scss">
.eap-table {
  .q-table__container { border-radius: 0 !important; border: none !important; box-shadow: none !important; }
  thead tr th { background: var(--surface-overlay) !important; }
}

.tbl-action-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-quaternary);
  transition: all 120ms ease;
  opacity: 0;

  .q-table tbody tr:hover & { opacity: 1; }

  &:hover {
    background: var(--surface-sunken);
    color: var(--text-primary);
  }

  &--danger:hover {
    background: var(--status-error-bg);
    color: var(--status-error-text);
  }
}

.tbl-action-divider {
  width: 1px;
  height: 14px;
  background: var(--border-subtle);
  margin: 0 2px;
}
</style>
