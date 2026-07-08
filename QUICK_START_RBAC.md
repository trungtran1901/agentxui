# 🚀 Quick Start Guide - RBAC Implementation

## Làm gì tiếp theo?

### 1️⃣ Cấu hình ngay (5 phút)

**File: `.env.local` (Development)**
```bash
VITE_URL_AUTH=http://localhost:8080
VITE_REALM=master
VITE_CLIENT_ID=enterprise-portal
VITE_KEYCLOAK_ENFORCE_ROLES=true
VITE_REQUIRED_ROLES=user
VITE_MODULE_ROLE_MAP={"dashboard":"user","ai-platform":"admin","knowledge":"user"}
```

### 2️⃣ Cấu hình Keycloak (10 phút)

**Truy cập:** Keycloak Admin Console

1. **Realm Settings → Roles → Create:**
   - `admin` (with composite roles: user, editor)
   - `user`
   - `editor`

2. **Clients → enterprise-portal → Mappers:**
   - Enable realm-roles-mapper
   - Enable client-roles-mapper

3. **Users → Your User → Role Mapping:**
   - Assign role `admin` (for testing)

### 3️⃣ Test ngay (5 phút)

```bash
# Terminal 1: Keycloak
docker run -p 8080:8080 keycloak/keycloak start-dev

# Terminal 2: App
quasar dev

# Terminal 3: Browser
open http://localhost:9090
# Login with test user
# Check DevTools Console for role info
```

### 4️⃣ Sử dụng trong routes (2 phút)

File: `src/router/index.js`

```javascript
import { createRoleGuard, createModuleGuard } from 'src/utils/roleGuard'

// Protect route with role
{
  path: '/admin',
  beforeEnter: createRoleGuard('admin'),
  component: () => import('pages/AdminPage.vue')
}

// Protect by module
{
  path: '/ai-platform',
  beforeEnter: createModuleGuard('ai-platform'),
  component: () => import('pages/AIPage.vue')
}
```

### 5️⃣ Sử dụng trong components (2 phút)

File: `src/components/YourComponent.vue`

```vue
<template>
  <div v-if="checkRole('admin')">Admin content</div>
  <div v-if="checkModuleAccess('ai-platform')">AI Platform</div>
</template>

<script setup>
import { checkRole, checkModuleAccess } from 'src/utils/roleGuard'
</script>
```

---

## 📚 Tài liệu tham khảo

| Tài liệu | Nội dung |
|---------|---------|
| **KEYCLOAK_RBAC_SETUP.md** | Hướng dẫn chi tiết cấu hình Keycloak |
| **IMPLEMENTATION_SUMMARY.md** | Tóm tắt các thay đổi + checklist |
| **EXAMPLE_ROUTER_RBAC.js** | 15+ ví dụ routes protection |
| **EXAMPLE_COMPONENT_RBAC.vue** | 5 ví dụ component usage |
| **.env.rbac.example** | Tất cả environment variables |

---

## 🔑 API Summary

### Service Methods
```javascript
import { keycloakService } from 'src/services/keycloak.service'

keycloakService.hasRealmRole('admin')
keycloakService.hasAnyRole(['admin', 'user'])
keycloakService.hasAllRoles(['admin', 'user'])
keycloakService.hasModuleAccess('ai-platform')
keycloakService.getUserRoles()
```

### Utility Functions
```javascript
import { checkRole, checkModuleAccess, getUserRoles } from 'src/utils/roleGuard'

checkRole('admin')
checkModuleAccess('ai-platform')
getUserRoles()
```

### Route Guards
```javascript
import { createRoleGuard, createModuleGuard } from 'src/utils/roleGuard'

beforeEnter: createRoleGuard('admin')
beforeEnter: createModuleGuard('ai-platform')
```

---

## ⚡ Common Scenarios

### Scenario 1: Admin-Only Page
```javascript
{
  path: '/system/settings',
  beforeEnter: createRoleGuard('admin'),
  component: () => import('pages/SettingsPage.vue')
}
```

### Scenario 2: Multiple Roles (ANY)
```javascript
{
  path: '/audit',
  beforeEnter: createRoleGuard(['admin', 'auditor']),
  component: () => import('pages/AuditPage.vue')
}
```

### Scenario 3: Module-Level Access
```javascript
{
  path: '/ai-platform',
  beforeEnter: createModuleGuard('ai-platform'),
  component: () => import('pages/AIPage.vue')
}
```

### Scenario 4: Component-Level Check
```vue
<q-btn
  v-if="checkRole('admin')"
  label="Delete"
  @click="deleteUser"
/>
```

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Token không có roles | Kiểm tra Keycloak Mappers → Enable role mappers |
| User bị logout ngay | Kiểm tra VITE_REQUIRED_ROLES vs user's roles |
| Module access không hoạt động | Kiểm tra MODULE_ROLE_MAP format (phải JSON) |
| Role không update | User cần logout + login lại |

---

## 📊 Role Mapping Templates

### Template 1: Minimal
```json
{
  "dashboard": "user",
  "ai-platform": "admin",
  "knowledge": "user"
}
```

### Template 2: Standard
```json
{
  "dashboard": "user",
  "ai-platform": "admin",
  "knowledge": "user,editor",
  "mcp": "admin",
  "operations": "admin,auditor"
}
```

### Template 3: Advanced
```json
{
  "dashboard": "user",
  "ai-platform": "ai-admin,super-admin",
  "knowledge": "kb-user,kb-editor,admin",
  "mcp": "mcp-admin",
  "operations": "ops-admin,auditor",
  "system": "system-admin,super-admin"
}
```

---

## ✅ Implementation Checklist

- [ ] Read `KEYCLOAK_RBAC_SETUP.md`
- [ ] Configure `.env.local` with RBAC variables
- [ ] Login to Keycloak Admin Console
- [ ] Create realm roles (admin, user, editor, etc.)
- [ ] Enable role mappers in client
- [ ] Assign roles to test users
- [ ] Update routes with guards
- [ ] Test login and access control
- [ ] Update components with role checks
- [ ] Test all scenarios
- [ ] Deploy to staging
- [ ] Final production deployment

---

## 🎯 Next Steps

1. **Read**: Skim through `KEYCLOAK_RBAC_SETUP.md` (15 min)
2. **Configure**: Set up `.env.local` (2 min)
3. **Admin**: Create roles in Keycloak (5 min)
4. **Code**: Add guards to sensitive routes (10 min)
5. **Test**: Verify role enforcement works (5 min)
6. **Deploy**: Push to production (5 min)

**Total Time: ~40 minutes**

---

## 📞 Support

- **Keycloak Docs**: https://www.keycloak.org/docs/latest/server_admin/
- **RBAC Setup Guide**: See `KEYCLOAK_RBAC_SETUP.md`
- **Implementation Summary**: See `IMPLEMENTATION_SUMMARY.md`
- **Code Examples**: See `EXAMPLE_*.js` and `EXAMPLE_*.vue`

---

**Happy coding! 🚀**
