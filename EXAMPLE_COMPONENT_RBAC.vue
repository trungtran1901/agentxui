<!-- EXAMPLE: Component with RBAC
     
     Các ví dụ cách sử dụng role guards trong Vue components
-->

<template>
  <div class="example-container">
    <!-- Example 1: Conditional rendering based on roles -->
    <section>
      <h3>Example 1: Conditional Rendering</h3>
      
      <!-- Hiển thị nếu user có role 'admin' -->
      <div v-if="checkRole('admin')" class="admin-section">
        <h4>🔑 Admin Controls</h4>
        <q-btn label="Delete User" color="negative" @click="deleteUserExample" />
        <q-btn label="System Settings" color="info" />
      </div>

      <!-- Hiển thị nếu user có BẤT KỲ role nào trong list -->
      <div v-if="checkRole(['editor', 'content-manager'])" class="editor-section">
        <h4>✏️ Content Management</h4>
        <q-btn label="Edit Content" color="primary" />
        <q-btn label="Publish" color="positive" />
      </div>

      <!-- Hiển thị nếu user có module access -->
      <div v-if="checkModuleAccess('ai-platform')" class="ai-section">
        <h4>🤖 AI Platform</h4>
        <q-btn label="Create Agent" color="purple" />
      </div>

      <!-- Hiển thị nếu user KHÔNG có role 'admin' -->
      <div v-if="!checkRole('admin')" class="user-section">
        <h4>👤 User Area</h4>
        <p>You are viewing this as a regular user</p>
      </div>
    </section>

    <!-- Example 2: Dynamic table columns based on roles -->
    <section>
      <h3>Example 2: Dynamic Table Columns</h3>
      <q-table
        title="Users"
        :rows="users"
        :columns="visibleColumns"
      >
        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <!-- Edit button visible to editors and admins -->
            <q-btn
              v-if="checkRole(['editor', 'admin'])"
              flat
              dense
              icon="edit"
              @click="editUser(props.row)"
            />
            
            <!-- Delete button only for admins -->
            <q-btn
              v-if="checkRole('admin')"
              flat
              dense
              icon="delete"
              @click="deleteUser(props.row)"
            />
            
            <!-- View button visible to all -->
            <q-btn
              flat
              dense
              icon="visibility"
              @click="viewUser(props.row)"
            />
          </q-td>
        </template>
      </q-table>
    </section>

    <!-- Example 3: Disabled buttons based on permissions -->
    <section>
      <h3>Example 3: Conditional Button States</h3>
      <div class="button-group">
        <q-btn
          label="Edit"
          :disable="!canEdit"
          :title="!canEdit ? 'Require editor role' : ''"
          @click="editItem"
        />
        <q-btn
          label="Delete"
          :disable="!canDelete"
          :title="!canDelete ? 'Require admin role' : ''"
          color="negative"
          @click="deleteItem"
        />
        <q-btn
          label="Export"
          :disable="!canExport"
          :title="!canExport ? 'Require admin or auditor role' : ''"
          color="info"
          @click="exportData"
        />
      </div>
    </section>

    <!-- Example 4: Role information display -->
    <section>
      <h3>Example 4: User Role Information</h3>
      <div class="user-info card">
        <p><strong>Username:</strong> {{ userInfo.username }}</p>
        <p><strong>Email:</strong> {{ userInfo.email }}</p>
        <p><strong>User ID:</strong> {{ userInfo.sub }}</p>
        <div>
          <strong>Realm Roles:</strong>
          <q-chip
            v-for="role in userInfo.realmRoles"
            :key="`realm-${role}`"
            color="primary"
            text-color="white"
          >
            {{ role }}
          </q-chip>
        </div>
        <div>
          <strong>Client Roles:</strong>
          <q-chip
            v-for="role in userInfo.clientRoles"
            :key="`client-${role}`"
            color="info"
            text-color="white"
          >
            {{ role }}
          </q-chip>
        </div>
        <div>
          <strong>All Roles Combined:</strong>
          <q-chip
            v-for="role in allRoles"
            :key="`all-${role}`"
            color="secondary"
            text-color="white"
          >
            {{ role }}
          </q-chip>
        </div>
      </div>
    </section>

    <!-- Example 5: Module access check -->
    <section>
      <h3>Example 5: Module Access Status</h3>
      <div class="module-status">
        <div
          v-for="module in ['dashboard', 'ai-platform', 'knowledge', 'mcp', 'operations', 'system']"
          :key="module"
          class="module-item"
        >
          <span>{{ module }}:</span>
          <q-icon
            :name="checkModuleAccess(module) ? 'check_circle' : 'cancel'"
            :color="checkModuleAccess(module) ? 'positive' : 'negative'"
            size="24px"
          />
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { keycloakService } from 'src/services/keycloak.service'
import { checkRole, checkModuleAccess, getUserRoles } from 'src/utils/roleGuard'
import { useQuasar } from 'quasar'

const $q = useQuasar()

// Get user info
const userInfo = computed(() => keycloakService.getUserInfo())
const allRoles = computed(() => keycloakService.getUserRoles())

// Permission computed properties
const canEdit = computed(() => checkRole(['editor', 'admin']))
const canDelete = computed(() => checkRole('admin'))
const canExport = computed(() => checkRole(['admin', 'auditor']))

// Example data
const users = ref([
  { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin' },
  { id: 2, name: 'Bob', email: 'bob@example.com', role: 'user' },
  { id: 3, name: 'Charlie', email: 'charlie@example.com', role: 'viewer' }
])

// Dynamic table columns
const allColumns = [
  { name: 'name', label: 'Name', field: 'name', align: 'left' },
  { name: 'email', label: 'Email', field: 'email', align: 'left' },
  { name: 'role', label: 'Role', field: 'role', align: 'left' },
  { name: 'actions', label: 'Actions', field: 'actions', align: 'center' }
]

const visibleColumns = computed(() => {
  // Base columns visible to all
  let cols = ['name', 'email', 'role']
  
  // Add actions column for authorized users
  if (canEdit.value || canDelete.value) {
    cols.push('actions')
  }
  
  return allColumns.filter(col => cols.includes(col.name))
})

// Action methods
const editUserExample = () => {
  if (!checkRole('admin')) {
    $q.notify({
      type: 'negative',
      message: 'You do not have permission to perform this action',
      position: 'top'
    })
    return
  }
  console.log('Edit user logic...')
}

const deleteUserExample = () => {
  if (!checkRole('admin')) {
    $q.notify({
      type: 'negative',
      message: 'Only admins can delete users',
      position: 'top'
    })
    return
  }
  console.log('Delete user logic...')
}

const editUser = (user) => {
  if (!canEdit.value) return
  console.log('Edit user:', user)
}

const deleteUser = (user) => {
  if (!canDelete.value) return
  console.log('Delete user:', user)
}

const viewUser = (user) => {
  console.log('View user:', user)
}

const editItem = () => {
  if (!canEdit.value) return
  console.log('Edit item')
}

const deleteItem = () => {
  if (!canDelete.value) return
  console.log('Delete item')
}

const exportData = () => {
  if (!canExport.value) return
  console.log('Export data')
}
</script>

<style scoped>
.example-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

section {
  margin-bottom: 32px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
}

h3 {
  margin-top: 0;
  margin-bottom: 16px;
  color: #1976d2;
}

h4 {
  margin: 0 0 12px 0;
  color: #424242;
}

.admin-section,
.editor-section,
.ai-section,
.user-section {
  margin: 12px 0;
  padding: 12px;
  border-left: 4px solid #1976d2;
  background-color: #f5f5f5;
}

.button-group {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.user-info {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 16px;
  background-color: #fafafa;
}

.user-info p {
  margin: 8px 0;
}

.user-info div {
  margin: 12px 0;
}

.module-status {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.module-item {
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);
}
</style>
