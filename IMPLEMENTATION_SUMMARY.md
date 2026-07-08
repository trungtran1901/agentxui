# 🚀 Tóm tắt: Triển khai RBAC cho Enterprise Agent Portal

## 📝 Thay đổi đã thực hiện

### 1. **env.js** - Cấu hình môi trường mới
- ✅ Thêm `KEYCLOAK_ENFORCE_ROLES` - bắt buộc enforce roles
- ✅ Thêm `REQUIRED_ROLES` - roles tối thiểu để access
- ✅ Thêm `MODULE_ROLE_MAP` - mapping module → roles
- ✅ Hàm parse JSON và comma-separated formats

### 2. **keycloak.service.js** - Service mở rộng
- ✅ `hasRealmRole(role)` - check realm role
- ✅ `hasClientRole(role)` - check client role
- ✅ `hasAnyRole(roles)` - check ANY role (disjunction)
- ✅ `hasAllRoles(roles)` - check ALL roles (conjunction)
- ✅ `hasModuleAccess(moduleName)` - check module access
- ✅ `getUserRoles()` - lấy tất cả roles
- ✅ `_enforceRequiredRoles()` - auto logout nếu không có required roles

### 3. **roleGuard.js** - Utility mới (NEW FILE)
- ✅ `createRoleGuard(roles, requireAll)` - Route guard
- ✅ `createModuleGuard(moduleName)` - Module guard
- ✅ `checkRole(roles)` - Sync role check
- ✅ `checkModuleAccess(module)` - Sync module check
- ✅ `getUserRoles()` - Get user roles

### 4. **Tệp hướng dẫn**
- ✅ `KEYCLOAK_RBAC_SETUP.md` - Hướng dẫn chi tiết Keycloak Admin
- ✅ `EXAMPLE_ROUTER_RBAC.js` - Ví dụ route protection
- ✅ `EXAMPLE_COMPONENT_RBAC.vue` - Ví dụ component usage
- ✅ `.env.rbac.example` - Template environment variables

---

## 🔧 Bước 1: Cấu hình biến môi trường

### Local Development (`.env.local`)
```bash
VITE_URL_AUTH=http://localhost:8080
VITE_REALM=master
VITE_CLIENT_ID=enterprise-portal
VITE_KEYCLOAK_ENFORCE_ROLES=true
VITE_REQUIRED_ROLES=user
VITE_MODULE_ROLE_MAP={"dashboard":"user","ai-platform":"admin","knowledge":"user,editor"}
```

### Docker / Production
Thêm vào `docker-compose.yml` hoặc environment variables:
```yaml
environment:
  VITE_URL_AUTH: https://keycloak.prod.com
  VITE_REALM: production
  VITE_CLIENT_ID: enterprise-portal
  VITE_KEYCLOAK_ENFORCE_ROLES: "true"
  VITE_REQUIRED_ROLES: admin,user
  VITE_MODULE_ROLE_MAP: '{"dashboard":"user","ai-platform":"admin",...}'
```

---

## 🔑 Bước 2: Cấu hình Keycloak Admin Console

### 2.1 Tạo Realm Roles

Truy cập: **Realm Settings → Roles → Create role**

```
Roles cần tạo:
├── admin (Composite role - contains: user, editor, auditor)
├── user (Basic role)
├── editor (Can edit content)
├── viewer (Read-only)
├── auditor (Can view audit logs)
└── system-admin (System-level access)
```

### 2.2 Gán Realm Roles cho Users

**Clients → enterprise-portal**

1. Vào **Mappers tab**
2. Tìm hoặc tạo mapper: **realm-roles-mapper**
   - Mapper Type: User Realm Role
   - Token Claim Name: `realm_access.roles`
   - Add to access token: ✅ ON

3. Tạo mapper: **client-roles-mapper**
   - Mapper Type: User Client Role
   - Token Claim Name: `resource_access.${client_id}.roles`
   - Add to access token: ✅ ON

### 2.3 Tạo Client Roles (Optional)

**Clients → enterprise-portal → Roles**

```
Client Roles:
├── enterprise-admin
├── enterprise-viewer
└── enterprise-operator
```

### 2.4 Gán Roles cho Users

**Users → [Username] → Role Mapping**

1. Click **Assign role**
2. Chọn roles: `admin`, `user`, `editor`
3. Click **Assign**

---

## 📱 Bước 3: Sử dụng trong Application

### 3.1 Route Protection (router/index.js)

```javascript
import { createRoleGuard, createModuleGuard } from 'src/utils/roleGuard'

const routes = [
  {
    path: '/dashboard',
    beforeEnter: createRoleGuard('user'),
    component: () => import('pages/DashboardPage.vue')
  },
  {
    path: '/admin',
    beforeEnter: createRoleGuard('admin'),
    component: () => import('pages/AdminPage.vue')
  },
  {
    path: '/ai-platform',
    beforeEnter: createModuleGuard('ai-platform'),
    component: () => import('pages/AIPage.vue')
  }
]
```

### 3.2 Component Usage

```vue
<template>
  <!-- Show if user has 'admin' role -->
  <div v-if="checkRole('admin')">
    <button @click="deleteUser">Delete</button>
  </div>

  <!-- Show if user has ANY of these roles -->
  <div v-if="checkRole(['editor', 'admin'])">
    <button @click="editContent">Edit</button>
  </div>

  <!-- Show if user has module access -->
  <div v-if="checkModuleAccess('ai-platform')">
    <h2>AI Platform</h2>
  </div>

  <!-- Display user roles -->
  <p>Your roles: {{ getUserRoles().join(', ') }}</p>
</template>

<script setup>
import { checkRole, checkModuleAccess, getUserRoles } from 'src/utils/roleGuard'
</script>
```

### 3.3 Service/API Protection

```javascript
import { keycloakService } from 'src/services/keycloak.service'

export async function deleteUser(userId) {
  // Check permission before API call
  if (!keycloakService.hasRealmRole('admin')) {
    throw new Error('Insufficient permissions')
  }
  
  const token = keycloakService.getToken()
  return fetch(`/api/users/${userId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  })
}
```

---

## ⚙️ API Reference

### Keycloak Service Methods

```javascript
import { keycloakService } from 'src/services/keycloak.service'

// Get user information
const userInfo = keycloakService.getUserInfo()
// Returns: { sub, email, name, username, realmRoles, clientRoles, groups }

// Check single role
keycloakService.hasRealmRole('admin') // true/false
keycloakService.hasClientRole('admin') // true/false

// Check multiple roles
keycloakService.hasAnyRole(['admin', 'user']) // true if has ANY
keycloakService.hasAllRoles(['admin', 'user']) // true if has ALL

// Check module access
keycloakService.hasModuleAccess('ai-platform') // true/false

// Get all roles
keycloakService.getUserRoles() // ['admin', 'user', 'editor']

// Get token
keycloakService.getToken() // JWT token string
```

### Role Guard Functions

```javascript
import { 
  checkRole, 
  checkModuleAccess, 
  getUserRoles,
  createRoleGuard,
  createModuleGuard
} from 'src/utils/roleGuard'

// Synchronous checks (for components)
checkRole('admin')                    // true/false
checkRole(['admin', 'user'])         // true if ANY role matches
checkModuleAccess('ai-platform')     // true/false
getUserRoles()                        // ['admin', 'user']

// Route guards
const guard = createRoleGuard('admin')
const moduleGuard = createModuleGuard('ai-platform')
```

---

## 🧪 Testing

### Test 1: Login Flow
```bash
1. Truy cập http://localhost:9090
2. Đăng nhập với user có role 'admin'
3. Kiểm tra developer console: localStorage → auth_token
4. Check JWT token: jwt.io → paste token
5. Verify claims: realm_access.roles, resource_access.enterprise-portal.roles
```

### Test 2: Role Enforcement
```bash
1. Set VITE_REQUIRED_ROLES=admin
2. Đăng nhập với user có role 'user' (không phải admin)
3. Verify: User bị logout + error message
```

### Test 3: Module Access
```bash
1. Kiểm tra VITE_MODULE_ROLE_MAP
2. Truy cập route của module (ví dụ: /ai-platform)
3. Verify: 
   - Nếu user có role → access granted
   - Nếu user không có role → redirect to access-denied page
```

---

## 📊 Ví dụ Environment Variables

### Development
```bash
VITE_KEYCLOAK_ENFORCE_ROLES=false
VITE_REQUIRED_ROLES=user
VITE_MODULE_ROLE_MAP={}
```

### Production - Strict
```bash
VITE_KEYCLOAK_ENFORCE_ROLES=true
VITE_REQUIRED_ROLES=admin,user
VITE_MODULE_ROLE_MAP={
  "dashboard":"user",
  "ai-platform":"admin",
  "knowledge":"user,editor",
  "mcp":"admin",
  "operations":"admin,auditor",
  "system":"system-admin"
}
```

### Production - Flexible
```bash
VITE_KEYCLOAK_ENFORCE_ROLES=true
VITE_REQUIRED_ROLES=user
VITE_MODULE_ROLE_MAP={
  "dashboard":"user",
  "ai-platform":"ai-admin",
  "knowledge":"kb-user",
  "mcp":"mcp-admin",
  "operations":"ops-admin"
}
```

---

## ⚠️ Lưu ý quan trọng

1. **Token Claim Mapping**: Đảm bảo Keycloak mapper bật và có đúng format
2. **Role Names**: Phải giống hệt giữa Keycloak và application config
3. **Module Names**: Phải khớp với tên modules trong `MODULE_ROLE_MAP`
4. **Token Refresh**: Roles updates require logout + login
5. **Composite Roles**: Dùng để quản lý multiple roles efficiently

---

## 🔗 File References

| File | Mục đích |
|------|---------|
| `src/services/env.js` | Environment config + RBAC setup |
| `src/services/keycloak.service.js` | Keycloak service + role checks |
| `src/utils/roleGuard.js` | Route guards + role utilities |
| `KEYCLOAK_RBAC_SETUP.md` | Hướng dẫn chi tiết |
| `EXAMPLE_ROUTER_RBAC.js` | Route protection examples |
| `EXAMPLE_COMPONENT_RBAC.vue` | Component usage examples |
| `.env.rbac.example` | Environment template |

---

## 📞 Quick Support

### Problem: Token không có roles
```
→ Check Keycloak Mappers → Token Claim Names
→ Logout + Login lại
```

### Problem: User bị logout ngay sau login
```
→ Check VITE_REQUIRED_ROLES
→ Check user có đủ roles không
→ Xem browser console cho error message
```

### Problem: Module access không hoạt động
```
→ Check MODULE_ROLE_MAP format (phải là valid JSON)
→ Check module name khớp với routes
→ Check user roles trong token
```

---

## ✅ Checklist

- [ ] Cập nhật env.js ✅
- [ ] Cập nhật keycloak.service.js ✅
- [ ] Tạo roleGuard.js ✅
- [ ] Cấu hình .env với RBAC variables
- [ ] Truy cập Keycloak Admin Console
- [ ] Tạo realm roles (admin, user, editor, viewer, auditor)
- [ ] Tạo/cấu hình client
- [ ] Bật role mappers trong client
- [ ] Gán roles cho test users
- [ ] Update router với role guards
- [ ] Test login flow
- [ ] Test role enforcement
- [ ] Test module access
- [ ] Deploy to production

---

**Happy securing! 🔒**
