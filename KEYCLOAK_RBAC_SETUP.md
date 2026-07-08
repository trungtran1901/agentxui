# 🔐 Hướng dẫn cấu hình Keycloak RBAC (Role-Based Access Control)

## 📋 Mục lục
1. [Khái niệm cơ bản](#khái-niệm-cơ-bản)
2. [Cấu hình biến môi trường](#cấu-hình-biến-môi-trường)
3. [Cấu hình Keycloak Admin Console](#cấu-hình-keycloak-admin-console)
4. [Sử dụng Role Guard trong ứng dụng](#sử-dụng-role-guard-trong-ứng-dụng)
5. [Ví dụ thực tế](#ví-dụ-thực-tế)

---

## 🎯 Khái niệm cơ bản

### Realm Roles
- Roles cấp realm, áp dụng cho toàn bộ realm
- Ví dụ: `admin`, `user`, `manager`
- Được quản lý tại: Realm Settings → Roles

### Client Roles  
- Roles cấp client, chỉ áp dụng cho client cụ thể
- Ví dụ: `admin` cho client `enterprise-portal`
- Được quản lý tại: Clients → [Client Name] → Roles

### Composite Roles
- Roles có chứa các roles khác bên trong
- Ví dụ: Role `admin` có chứa `user`, `editor`, `viewer`

---

## 🔧 Cấu hình biến môi trường

Thêm các biến sau vào file `.env` hoặc cấu hình container:

```bash
# Keycloak Configuration
VITE_URL_AUTH=https://keycloak.example.com
VITE_REALM=your-realm
VITE_CLIENT_ID=enterprise-portal

# RBAC Configuration
VITE_KEYCLOAK_ENFORCE_ROLES=true
VITE_REQUIRED_ROLES=admin,user
VITE_MODULE_ROLE_MAP={"dashboard":"user","ai-platform":"admin","knowledge":"user,editor","mcp":"admin"}

# API URLs
VITE_AGNO_API_URL=/agno
VITE_MCP_API_URL=/mcp
VITE_KNOWLEDGE_API_URL=/knowledge
```

### Chi tiết từng biến:

| Biến | Ý nghĩa | Ví dụ |
|------|---------|-------|
| `VITE_KEYCLOAK_ENFORCE_ROLES` | Bắt buộc enforce roles | `true` / `false` |
| `VITE_REQUIRED_ROLES` | Roles tối thiểu để đăng nhập | `admin,user` |
| `VITE_MODULE_ROLE_MAP` | Mapping module → roles | `{"dashboard":"user","ai-platform":"admin"}` |

**Module Role Map Format:**
```json
{
  "dashboard": "user",                    // 1 role
  "ai-platform": "admin",                 // 1 role
  "knowledge": ["user", "editor"],        // Multiple roles (ANY)
  "mcp": ["admin", "system-admin"],       // Multiple roles (ANY)
  "operations": "admin,auditor"           // Comma-separated
}
```

---

## 🔑 Cấu hình Keycloak Admin Console

### Step 1: Tạo Realm Roles

1. Truy cập **Keycloak Admin Console**
2. Chọn realm của bạn (trên cùng bên trái)
3. Vào menu **Realm Settings** → **Roles**
4. Click **Create role**

**Tạo các roles cơ bản:**

```
Role Name: admin
Description: Administrator role with full access
```

```
Role Name: user
Description: Basic user role with limited access
```

```
Role Name: editor
Description: User can edit content
```

```
Role Name: viewer
Description: User can only view content (read-only)
```

```
Role Name: auditor
Description: User can view audit logs
```

---

### Step 2: Tạo Composite Roles (Optional - Best Practice)

1. Vào **Realm Settings** → **Roles**
2. Click role `admin`
3. Tab **Composite Roles** → Toggle **Composite role** ON
4. Click **Add roles**
5. Chọn các roles cần include: `user`, `editor`, `auditor`

**Kết quả:** User có role `admin` sẽ tự động có các roles: `user`, `editor`, `auditor`

---

### Step 3: Tạo/Cấu hình Client

1. Vào **Clients**
2. Click client của bạn (ví dụ: `enterprise-portal`)
3. **Settings tab:**
   - Tìm **Client ID**: `enterprise-portal`
   - Tìm **Valid Redirect URIs**: `https://your-app.com/*`
   - Click **Save**

4. **Roles tab:**
   - Click **Create role**
   - Role Name: `enterprise-admin`
   - Description: `Enterprise specific admin`

---

### Step 4: Gán Roles cho Users

#### Cách 1: Gán Realm Roles

1. Vào **Users**
2. Click tên user
3. Tab **Role Mapping**
4. Click **Assign role**
5. Chọn realm roles cần gán (ví dụ: `admin`, `user`)
6. Click **Assign**

#### Cách 2: Gán Client Roles

1. Vào **Users** → User
2. Tab **Role Mapping**
3. Dropdown **Filter by Clients** → Chọn client (`enterprise-portal`)
4. Click **Assign role**
5. Chọn client roles
6. Click **Assign**

---

### Step 5: Bật Token Claim cho Roles (Quan trọng!)

Đảm bảo roles được include trong JWT token:

1. Vào **Clients** → `enterprise-portal`
2. Tab **Mappers**
3. Click **Create** (hoặc cấu hình existing mappers)

**Mapper 1: Realm Roles**
```
Name: realm-roles-mapper
Mapper Type: User Realm Role
Token Claim Name: realm_access.roles
Add to access token: ON
Add to ID token: ON
Add to userinfo: ON
```

**Mapper 2: Client Roles**
```
Name: client-roles-mapper
Mapper Type: User Client Role
Token Claim Name: resource_access.${client_id}.roles
Client ID: enterprise-portal
Add to access token: ON
Add to ID token: ON
Add to userinfo: ON
```

---

### Step 6: Tạo Groups (Optional - Tiên tiến)

1. Vào **Groups**
2. Click **New**
3. Tên: `portal-admins`
4. Click **Create**
5. Tab **Role Mapping** → Gán roles cho group
6. Vào **Users** → User → **Groups** → Thêm user vào group

**Lợi ích:** Quản lý hàng loạt users cùng một lần

---

## 📱 Sử dụng Role Guard trong ứng dụng

### Option 1: Bảo vệ Routes (trong `router/routes.js`)

```javascript
import { createRoleGuard, createModuleGuard } from 'src/utils/roleGuard'

const routes = [
  {
    path: '/dashboard',
    component: () => import('pages/DashboardPage.vue'),
    beforeEnter: createRoleGuard('user') // Yêu cầu role 'user'
  },
  {
    path: '/admin',
    component: () => import('pages/AdminPage.vue'),
    beforeEnter: createRoleGuard('admin') // Yêu cầu role 'admin'
  },
  {
    path: '/ai-platform',
    component: () => import('pages/AIPage.vue'),
    beforeEnter: createModuleGuard('ai-platform') // Dùng module-level access
  },
  {
    path: '/audit',
    component: () => import('pages/AuditPage.vue'),
    beforeEnter: createRoleGuard(['admin', 'auditor'], false) // Yêu cầu ANY role
  }
]
```

### Option 2: Kiểm tra trong Components

```vue
<template>
  <div>
    <!-- Hiển thị nếu user có role 'admin' -->
    <section v-if="checkRole('admin')">
      <h2>Admin Section</h2>
      <button @click="deleteUser">Delete User</button>
    </section>

    <!-- Hiển thị nếu user có ANY role trong list -->
    <section v-if="checkRole(['admin', 'editor'])">
      <h2>Content Management</h2>
    </section>

    <!-- Hiển thị nếu user có module access -->
    <section v-if="checkModuleAccess('ai-platform')">
      <h2>AI Platform</h2>
    </section>

    <!-- Hiển thị user roles -->
    <div>
      <strong>Your Roles:</strong> {{ userRoles.join(', ') }}
    </div>
  </div>
</template>

<script setup>
import { checkRole, checkModuleAccess, getUserRoles } from 'src/utils/roleGuard'
import { computed } from 'vue'

const userRoles = computed(() => getUserRoles())
</script>
```

### Option 3: Dùng trong Service Methods

```javascript
import { keycloakService } from 'src/services/keycloak.service'

export async function deleteUser(userId) {
  // Kiểm tra quyền trước khi gọi API
  if (!keycloakService.hasRealmRole('admin')) {
    throw new Error('Insufficient permissions')
  }
  
  const token = keycloakService.getToken()
  return fetch(`/api/users/${userId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
}
```

### Option 4: Composable cho Components

```javascript
// composables/useAuth.js
import { keycloakService } from 'src/services/keycloak.service'
import { computed, ref } from 'vue'

export function useAuth() {
  const user = computed(() => keycloakService.getUserInfo())
  const roles = computed(() => keycloakService.getUserRoles())
  const isAdmin = computed(() => keycloakService.hasRealmRole('admin'))
  
  const hasRole = (role) => keycloakService.hasRealmRole(role)
  const hasAnyRole = (roleList) => keycloakService.hasAnyRole(roleList)
  
  return {
    user,
    roles,
    isAdmin,
    hasRole,
    hasAnyRole
  }
}
```

Sử dụng trong component:
```vue
<script setup>
import { useAuth } from 'src/composables/useAuth'

const { isAdmin, hasRole } = useAuth()
</script>

<template>
  <button v-if="isAdmin" @click="deleteUser">Delete</button>
  <button v-if="hasRole('editor')">Edit</button>
</template>
```

---

## 📚 Ví dụ thực tế

### Scenario 1: Multi-Level Access Control

```bash
# .env
VITE_MODULE_ROLE_MAP={
  "dashboard": "user",
  "ai-platform": "admin",
  "knowledge": ["user", "editor"],
  "mcp": "admin",
  "operations": ["admin", "auditor"],
  "system": "system-admin"
}

VITE_REQUIRED_ROLES=user,viewer
```

### Scenario 2: Route Protection

```javascript
// router/routes.js
{
  path: '/modules',
  component: MainLayout,
  children: [
    {
      path: 'dashboard',
      component: () => import('modules/dashboard/DashboardPage.vue'),
      beforeEnter: createModuleGuard('dashboard')
    },
    {
      path: 'ai-platform',
      component: () => import('modules/ai-platform/AIPage.vue'),
      beforeEnter: createModuleGuard('ai-platform')
    },
    {
      path: 'knowledge',
      component: () => import('modules/knowledge/KnowledgePage.vue'),
      beforeEnter: createModuleGuard('knowledge')
    }
  ]
}
```

### Scenario 3: Keycloak Realm Setup

```
Realm: enterprise-portal

Roles:
├── admin (Composite)
│   ├── user
│   ├── editor
│   └── auditor
├── user
├── editor
├── viewer
└── auditor

Client: enterprise-portal
├── Roles
│   ├── enterprise-admin
│   └── viewer
└── Mappers
    ├── realm-roles-mapper
    └── client-roles-mapper

Users:
├── alice (Roles: admin, enterprise-admin)
├── bob (Roles: user, editor)
├── charlie (Roles: viewer)
└── diana (Roles: admin)
```

---

## ⚠️ Lưu ý quan trọng

1. **Token Refresh**: Token hết hạn sau ~5 phút. Service sẽ tự động refresh khi cần
2. **Role Changes**: Nếu thay đổi role của user, user phải logout + login để cập nhật token
3. **Composite Roles**: Dùng composite roles để quản lý hiệu quả (1 role chứa nhiều roles con)
4. **Module Mapping**: Để trống `MODULE_ROLE_MAP` sẽ cho phép tất cả users (nếu `ENFORCE_ROLES=false`)
5. **Client ID**: Đảm bảo `Client ID` trong code khớp với Keycloak

---

## 🐛 Troubleshooting

### Problem: Token không có roles claim

**Solution:**
- Kiểm tra Mappers trong client có bật chưa
- Verify `Token Claim Name` có đúng: `resource_access.${client_id}.roles`
- Logout + Login lại

### Problem: User bị logout ngay sau đăng nhập

**Solution:**
- Check `VITE_REQUIRED_ROLES` - user có đủ roles không?
- Kiểm tra `VITE_KEYCLOAK_ENFORCE_ROLES=true` - nếu không cần, set thành `false`

### Problem: Module access không hoạt động

**Solution:**
- Kiểm tra `MODULE_ROLE_MAP` format có đúng JSON không
- Verify module name khớp trong routes + `MODULE_ROLE_MAP`
- Check console log cho error message

---

## 📞 Support

Tham khảo tài liệu chính thức:
- https://www.keycloak.org/docs/latest/server_admin/
- https://www.keycloak.org/docs/latest/securing_apps/
