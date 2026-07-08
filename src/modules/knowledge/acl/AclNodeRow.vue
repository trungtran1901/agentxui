<template>
  <div>
    <div class="acl-node-row"
      :class="{ 'acl-node-row--selected': node.id === selectedId, 'acl-node-row--dragover': isDragOver }"
      :style="{ paddingLeft: (depth * 20 + 10) + 'px' }"
      draggable="true"
      @dragstart.stop="$emit('drag-start', node)"
      @dragover.prevent.stop="isDragOver = true"
      @dragleave.stop="isDragOver = false"
      @drop.stop="isDragOver = false; $emit('drop-on', { target: node })"
      @click="$emit('select', node)">
      <button class="acl-node-row__toggle" @click.stop="expanded = !expanded"
        :style="{ opacity: node.children?.length ? 1 : 0.2 }">
        <q-icon :name="expanded ? 'expand_more' : 'chevron_right'" size="16px" />
      </button>
      <div class="acl-type-chip acl-type-chip--sm" :class="'acl-type-chip--' + node.node_type?.toLowerCase()">
        {{ node.node_type }}
      </div>
      <span class="acl-node-row__name">{{ node.node_name }}</span>
      <span class="font-mono" style="font-size:10px;color:var(--text-quaternary);margin-left:6px">{{ node.node_code }}</span>
      <div class="acl-node-row__actions">
        <button class="btn btn--ghost btn--sm btn--icon" title="Add child" @click.stop="$emit('create-child', node)">
          <q-icon name="add" size="13px" />
        </button>
        <button class="btn btn--ghost btn--sm btn--icon" @click.stop>
          <q-icon name="more_vert" size="13px" />
          <q-menu>
            <q-list style="min-width:140px;padding:4px">
              <q-item clickable v-close-popup @click="$emit('edit', node)" style="border-radius:6px;min-height:34px">
                <q-item-section avatar style="min-width:28px"><q-icon name="edit" size="14px" /></q-item-section>
                <q-item-section style="font-size:13px">Edit</q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="$emit('create-child', node)" style="border-radius:6px;min-height:34px">
                <q-item-section avatar style="min-width:28px"><q-icon name="add" size="14px" /></q-item-section>
                <q-item-section style="font-size:13px">Add child</q-item-section>
              </q-item>
              <q-separator style="margin:4px 0" />
              <q-item clickable v-close-popup class="text-red" @click="$emit('delete', node)" style="border-radius:6px;min-height:34px">
                <q-item-section avatar style="min-width:28px"><q-icon name="delete" size="14px" color="red" /></q-item-section>
                <q-item-section style="font-size:13px">Delete (cascade)</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </button>
      </div>
    </div>
    <template v-if="expanded && node.children?.length">
      <AclNodeRow v-for="child in node.children" :key="child.id"
        :node="child" :selected-id="selectedId" :depth="depth + 1"
        @select="$emit('select', $event)" @create-child="$emit('create-child', $event)"
        @edit="$emit('edit', $event)" @delete="$emit('delete', $event)"
        @drag-start="$emit('drag-start', $event)" @drop-on="$emit('drop-on', $event)" />
    </template>
  </div>
</template>

<script>
import { defineComponent } from 'vue'

// Recursive ACL node row. Must be a real SFC (not an inline `template:` string)
// because Vite aliases 'vue' to the runtime-only build, which has no template
// compiler — inline string templates fail to render in that build.
export default defineComponent({
  name: 'AclNodeRow',
  props: { node: Object, selectedId: String, depth: Number },
  emits: ['select', 'create-child', 'edit', 'delete', 'drag-start', 'drop-on'],
  data: () => ({ expanded: true, isDragOver: false })
})
</script>