/**
 * EXAMPLE: router/routes-with-rbac.js
 * 
 * Ví dụ cách sử dụng role guards trong định tuyến
 * Hãy integrate những phần này vào file routes.js hiện tại của bạn
 */

import { createRoleGuard, createModuleGuard } from 'src/utils/roleGuard'

/**
 * Ví dụ 1: Routes cơ bản có role protection
 */
const basicProtectedRoutes = [
  {
    path: '/public',
    component: () => import('pages/PublicPage.vue')
    // Không cần guard - ai cũng có thể truy cập
  },
  {
    path: '/dashboard',
    component: () => import('modules/dashboard/DashboardPage.vue'),
    // Yêu cầu role 'user'
    beforeEnter: createRoleGuard('user')
  },
  {
    path: '/admin',
    component: () => import('pages/AdminPage.vue'),
    // Yêu cầu role 'admin'
    beforeEnter: createRoleGuard('admin')
  },
  {
    path: '/audit',
    component: () => import('pages/AuditPage.vue'),
    // Yêu cầu BẤT KỲ role nào trong list
    beforeEnter: createRoleGuard(['admin', 'auditor'], false)
  },
  {
    path: '/settings',
    component: () => import('pages/SettingsPage.vue'),
    // Yêu cầu CẢ 'admin' VÀ 'system-admin'
    beforeEnter: createRoleGuard(['admin', 'system-admin'], true)
  }
]

/**
 * Ví dụ 2: Module-level protection
 */
const moduleProtectedRoutes = [
  {
    path: '/modules',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      {
        path: 'dashboard',
        component: () => import('modules/dashboard/DashboardPage.vue'),
        beforeEnter: createModuleGuard('dashboard')
      },
      {
        path: 'ai-platform',
        component: () => import('modules/ai-platform/AgentOSPage.vue'),
        beforeEnter: createModuleGuard('ai-platform')
      },
      {
        path: 'knowledge',
        component: () => import('modules/knowledge/SearchPlayground.vue'),
        beforeEnter: createModuleGuard('knowledge')
      },
      {
        path: 'mcp',
        component: () => import('modules/mcp/MCPServersPage.vue'),
        beforeEnter: createModuleGuard('mcp')
      },
      {
        path: 'operations',
        component: () => import('modules/operations/OperationsPage.vue'),
        beforeEnter: createModuleGuard('operations')
      },
      {
        path: 'system',
        component: () => import('modules/system/SystemPage.vue'),
        beforeEnter: createModuleGuard('system')
      }
    ]
  }
]

/**
 * Ví dụ 3: Custom guards cho complex scenarios
 */
const customGuardExample = (to, from, next) => {
  import('src/services/keycloak.service').then(({ keycloakService }) => {
    // Custom logic
    if (!keycloakService.isAuthenticated()) {
      next({ name: 'login' })
      return
    }

    const userInfo = keycloakService.getUserInfo()

    // Complex condition: user must be admin AND have been created in last 30 days
    if (keycloakService.hasRealmRole('admin')) {
      next()
    } else {
      console.warn('Access denied: requires admin role')
      next({ name: 'access-denied' })
    }
  })
}

const complexProtectedRoutes = [
  {
    path: '/sensitive-operations',
    component: () => import('pages/SensitiveOpsPage.vue'),
    beforeEnter: customGuardExample
  }
]

/**
 * Ví dụ 4: Access Denied & 404 pages (phải thêm vào routes)
 */
const errorPages = [
  {
    path: '/access-denied',
    name: 'access-denied',
    component: () => import('shared/components/AccessDeniedPage.vue')
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('shared/components/NotFoundPage.vue')
  }
]

export default [
  ...basicProtectedRoutes,
  ...moduleProtectedRoutes,
  ...complexProtectedRoutes,
  ...errorPages
]
