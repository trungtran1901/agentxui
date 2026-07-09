<template>
  <q-layout view="lHh Lpr lFf">
    <!-- SIDEBAR -->
    <q-drawer v-model="leftDrawerOpen" show-if-above :mini="miniMode" :width="232" :mini-width="56"
      class="sidenav-drawer">
      <div class="sidenav">
        <!-- Logo -->
        <div class="sidenav__logo" :class="{ 'sidenav__logo--mini': miniMode }">
          <div class="">
            <!-- <q-icon name="hub" color="white" size="16px" /> -->
            <q-img src="../../public/icons/favicon-32x32.png" style="width: 24px; height: 24px;" />
          </div>
          <div v-if="!miniMode" class="sidenav__logo-wordmark">
            <div class="brand-name">Agent<b>X</b></div>
            <div class="sidenav__logo-sub">Enterprise</div>
          </div>
        </div>

        <!-- Nav body -->
        <div class="sidenav__body">
          <!-- Main nav -->
          <router-link class="sidenav__item" :class="{ 'is-active': $route.path === '/' }" to="/">
            <span class="sidenav__item-icon"><q-icon name="dashboard" size="18px" /></span>
            <span v-if="!miniMode" class="sidenav__item-label">Dashboard</span>
            <q-tooltip v-if="miniMode" anchor="center right" self="center left" :offset="[8, 0]">Dashboard</q-tooltip>
          </router-link>

          <!-- AI Platform -->
          <div v-if="!miniMode" class="sidenav__section-label" style="margin-top:16px">AI Platform</div>
          <div v-if="miniMode" class="sidenav__mini-divider" />

          <template v-for="item in aiItems" :key="item.to">
            <router-link class="sidenav__item" :class="{ 'is-active': $route.path.startsWith(item.to) }" :to="item.to">
              <span class="sidenav__item-icon"><q-icon :name="item.icon" size="18px" /></span>
              <span v-if="!miniMode" class="sidenav__item-label">{{ item.label }}</span>
              <q-tooltip v-if="miniMode" anchor="center right" self="center left" :offset="[8, 0]">{{ item.label
                }}</q-tooltip>
            </router-link>
          </template>

          <!-- Knowledge -->
          <div v-if="!miniMode" class="sidenav__section-label" style="margin-top:16px">Knowledge</div>
          <div v-if="miniMode" class="sidenav__mini-divider" />

          <template v-for="item in knowledgeItems" :key="item.to">
            <router-link class="sidenav__item" :class="{ 'is-active': $route.path.startsWith(item.to) }" :to="item.to">
              <span class="sidenav__item-icon"><q-icon :name="item.icon" size="18px" /></span>
              <span v-if="!miniMode" class="sidenav__item-label">{{ item.label }}</span>
              <q-tooltip v-if="miniMode" anchor="center right" self="center left" :offset="[8, 0]">{{ item.label
                }}</q-tooltip>
            </router-link>
          </template>

          <!-- MCP -->
          <div v-if="!miniMode" class="sidenav__section-label" style="margin-top:16px">MCP Integration</div>
          <div v-if="miniMode" class="sidenav__mini-divider" />

          <template v-for="item in mcpItems" :key="item.to">
            <router-link class="sidenav__item" :class="{ 'is-active': $route.path.startsWith(item.to) }" :to="item.to">
              <span class="sidenav__item-icon"><q-icon :name="item.icon" size="18px" /></span>
              <span v-if="!miniMode" class="sidenav__item-label">{{ item.label }}</span>
              <q-tooltip v-if="miniMode" anchor="center right" self="center left" :offset="[8, 0]">{{ item.label
                }}</q-tooltip>
            </router-link>
          </template>

          <!-- Operations -->
          <div v-if="!miniMode" class="sidenav__section-label" style="margin-top:16px">Operations</div>
          <div v-if="miniMode" class="sidenav__mini-divider" />

          <template v-for="item in opsItems" :key="item.to">
            <router-link class="sidenav__item" :class="{ 'is-active': $route.path.startsWith(item.to) }" :to="item.to">
              <span class="sidenav__item-icon"><q-icon :name="item.icon" size="18px" /></span>
              <span v-if="!miniMode" class="sidenav__item-label">{{ item.label }}</span>
              <q-tooltip v-if="miniMode" anchor="center right" self="center left" :offset="[8, 0]">{{ item.label
                }}</q-tooltip>
            </router-link>
          </template>

          <!-- System -->
          <div v-if="!miniMode" class="sidenav__section-label" style="margin-top:16px">System</div>
          <div v-if="miniMode" class="sidenav__mini-divider" />

          <template v-for="item in systemItems" :key="item.to">
            <router-link class="sidenav__item" :class="{ 'is-active': $route.path.startsWith(item.to) }" :to="item.to">
              <span class="sidenav__item-icon"><q-icon :name="item.icon" size="18px" /></span>
              <span v-if="!miniMode" class="sidenav__item-label">{{ item.label }}</span>
              <q-tooltip v-if="miniMode" anchor="center right" self="center left" :offset="[8, 0]">{{ item.label
                }}</q-tooltip>
            </router-link>
          </template>
        </div>

        <!-- Footer -->
        <div class="sidenav__footer">
          <button class="sidenav__item sidenav__collapse-btn" @click="miniMode = !miniMode">
            <span class="sidenav__item-icon">
              <q-icon :name="miniMode ? 'chevron_right' : 'chevron_left'" size="18px" />
            </span>
            <span v-if="!miniMode" class="sidenav__item-label">Collapse</span>
          </button>
        </div>
      </div>
    </q-drawer>

    <!-- HEADER -->
    <q-header>
      <div class="topbar">
        <!-- Mobile hamburger -->
        <button class="topbar__icon-btn" @click="leftDrawerOpen = !leftDrawerOpen" style="display:none">
          <q-icon name="menu" />
        </button>

        <!-- Breadcrumb -->
        <q-breadcrumbs class="topbar__breadcrumb" active-color="grey-6" separator-color="grey-4">
          <q-breadcrumbs-el icon="home" to="/" />
          <q-breadcrumbs-el v-for="crumb in uiStore.breadcrumbs" :key="crumb.label" :label="crumb.label"
            :to="crumb.to" />
        </q-breadcrumbs>

        <div style="flex:1" />

        <!-- Search -->
        <div class="topbar__search">
          <q-input dense outlined placeholder="Search…" style="width:220px">
            <template #prepend>
              <q-icon name="search" size="16px" style="color:var(--text-quaternary)" />
            </template>
            <template #append>
              <span class="code-tag" style="font-size:10px;padding:1px 4px;opacity:0.6">⌘K</span>
            </template>
          </q-input>
        </div>

        <div class="topbar__divider" />

        <!-- Dark mode -->
        <button class="topbar__icon-btn" @click="toggleDark">
          <q-icon :name="$q.dark.isActive ? 'light_mode' : 'dark_mode'" size="18px" />
          <q-tooltip>Toggle dark mode</q-tooltip>
        </button>

        <!-- Notifications -->
        <button class="topbar__icon-btn" style="position:relative">
          <q-icon name="notifications_none" size="18px" />
          <span v-if="uiStore.unreadCount > 0" class="topbar__notif-dot">{{ uiStore.unreadCount }}</span>
          <q-tooltip>Notifications</q-tooltip>
          <q-menu style="width:320px">
            <div class="notif-panel">
              <div class="notif-panel__header">
                <span class="notif-panel__title">Notifications</span>
                <button class="btn btn--ghost btn--sm" @click="uiStore.markAllRead()">Mark all read</button>
              </div>
              <div v-if="uiStore.notifications.length === 0" class="empty-state" style="padding:32px 16px">
                <div class="empty-state__icon"><q-icon name="notifications_none" /></div>
                <div class="empty-state__title">All caught up</div>
              </div>
              <q-list v-else>
                <q-item v-for="n in uiStore.notifications.slice(0, 8)" :key="n.id" clickable>
                  <q-item-section avatar>
                    <div class="notif-panel__icon" :class="`notif-panel__icon--${n.type}`">
                      <q-icon :name="n.type === 'negative' ? 'error_outline' : 'info_outline'" size="16px" />
                    </div>
                  </q-item-section>
                  <q-item-section>
                    <q-item-label style="font-size:13px">{{ n.message }}</q-item-label>
                    <q-item-label caption>{{ dayjs(n.created_at).fromNow() }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <div v-if="!n.read" class="notif-panel__unread-dot" />
                  </q-item-section>
                </q-item>
              </q-list>
            </div>
          </q-menu>
        </button>

        <div class="topbar__divider" />

        <!-- User menu -->
        <div class="topbar__user">
          <div class="topbar__avatar">{{ userInitials }}</div>
          <div v-if="!miniMode" class="topbar__username">{{ userName }}</div>
          <q-icon name="expand_more" size="14px" style="color:var(--text-tertiary)" />
          <q-menu>
            <div style="width:200px;padding:4px">
              <div style="padding:10px 12px;border-bottom:1px solid var(--border-subtle);margin-bottom:4px">
                <div style="font-size:13px;font-weight:600;color:var(--text-primary)">{{ userName }}</div>
                <div style="font-size:11px;color:var(--text-tertiary)">{{ userEmail }}</div>
              </div>
              <q-item clickable v-close-popup to="/system/settings" style="border-radius:6px">
                <q-item-section avatar><q-icon name="settings" size="16px" /></q-item-section>
                <q-item-section>Settings</q-item-section>
              </q-item>
              <q-separator style="margin:4px 0" />
              <q-item clickable v-close-popup class="text-red" style="border-radius:6px" @click="logout">
                <q-item-section avatar><q-icon name="logout" color="red" size="16px" /></q-item-section>
                <q-item-section>Sign out</q-item-section>
              </q-item>
            </div>
          </q-menu>
        </div>
      </div>
    </q-header>

    <!-- PAGE -->
    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script>
import { defineComponent, ref, computed, inject } from 'vue'
import { useQuasar } from 'quasar'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useUIStore } from '../stores/ui.store.js'
import { keycloakService } from '../services/keycloak.service.js'

dayjs.extend(relativeTime)

export default defineComponent({
  name: 'MainLayout',
  setup() {
    const $q = useQuasar()
    const uiStore = useUIStore()
    const leftDrawerOpen = ref(true)
    const miniMode = ref(false)

    const userInfo = computed(() => keycloakService.getUserInfo())
    const userName = computed(() => userInfo.value?.name || userInfo.value?.username || 'Admin')
    const userEmail = computed(() => userInfo.value?.email || '')
    const userInitials = computed(() => {
      const n = userName.value
      return n.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
    })

    function toggleDark() {
      $q.dark.toggle()
      uiStore.darkMode = $q.dark.isActive
    }

    function logout() {
      keycloakService.logout()
    }

    const aiItems = [
      { label: 'AgentOS', icon: 'cloud_circle', to: '/ai/agentos' },
      { label: 'Teams', icon: 'group', to: '/ai/teams' },
      { label: 'Agents', icon: 'smart_toy', to: '/ai/agents' },
      { label: 'Skills', icon: 'extension', to: '/ai/skills' },
      { label: 'Prompts', icon: 'article', to: '/ai/prompts' },
      { label: 'Models', icon: 'psychology', to: '/ai/models' },
      { label: 'Workflows', icon: 'account_tree', to: '/ai/workflows' },
      { label: 'Sessions', icon: 'chat_bubble_outline', to: '/ai/sessions' },
      { label: 'Memory', icon: 'memory', to: '/ai/memory' },
      { label: 'Playground', icon: 'play_circle_outline', to: '/ai/playground' },
    ]

    const knowledgeItems = [
      { label: 'Sources', icon: 'hub', to: '/knowledge/sources' },
      { label: 'Collections', icon: 'folder_open', to: '/knowledge/collections' },
      { label: 'Documents', icon: 'description', to: '/knowledge/documents' },
      { label: 'Webhooks', icon: 'webhook', to: '/knowledge/webhooks' },
      { label: 'ACL Tree', icon: 'account_tree', to: '/knowledge/acl' },
      { label: 'Assignments', icon: 'assignment_ind', to: '/knowledge/assignments' },
      { label: 'Search', icon: 'manage_search', to: '/knowledge/search' },
    ]

    const mcpItems = [
      { label: 'Capabilities', icon: 'build_circle', to: '/mcp/capabilities' },
      { label: 'Assignments', icon: 'rule_folder', to: '/mcp/assignments' },
      { label: 'Testing Console', icon: 'terminal', to: '/mcp/console' },
      { label: 'Exec Logs', icon: 'receipt_long', to: '/mcp/logs' },
    ]

    const opsItems = [
      { label: 'Events', icon: 'event_note', to: '/ops/events' },
      { label: 'Exec Logs', icon: 'receipt_long', to: '/ops/logs' },
      { label: 'Audit', icon: 'security', to: '/ops/audit' },
      { label: 'Monitoring', icon: 'monitor_heart', to: '/ops/monitoring' },
    ]

    const systemItems = [
      { label: 'Settings', icon: 'tune', to: '/system/settings' },
      { label: 'Feature Flags', icon: 'flag', to: '/system/flags' },
      { label: 'Jobs', icon: 'schedule', to: '/system/jobs' },
      { label: 'Environment', icon: 'code', to: '/system/environment' },
    ]

    return {
      leftDrawerOpen, miniMode, uiStore, dayjs,
      userName, userEmail, userInitials,
      aiItems, knowledgeItems, mcpItems, opsItems, systemItems,
      toggleDark, logout
    }
  }
})
</script>

<style lang="scss">
.sidenav-drawer {
  .q-drawer__content {
    overflow: hidden !important;
  }
}

.brand-name {
  font-size: 14px;
  font-weight: 600;
  color: #000000;
  letter-spacing: 0.3px;

  b {
    background: linear-gradient(135deg, #ffca28, #ff7043);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
}

.sidenav {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--sidebar-bg);

  &__logo {
    height: var(--header-height);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 14px;
    border-bottom: 1px solid var(--border-subtle);
    flex-shrink: 0;
    text-decoration: none;

    &--mini {
      padding: 0;
      justify-content: center;
    }

    &-icon {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: var(--brand-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    &-wordmark {
      min-width: 0;
    }

    &-text {
      font-weight: 700;
      font-size: 14px;
      color: var(--text-primary);
      letter-spacing: -0.02em;
    }

    &-sub {
      font-size: 10px;
      color: var(--text-quaternary);
      margin-top: 1px;
    }
  }

  &__body {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 8px 6px;

    &::-webkit-scrollbar {
      width: 3px;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--border-subtle);
      border-radius: 2px;
    }
  }

  &__section-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-quaternary);
    padding: 0 8px 4px;
    display: block;
    margin-top: 16px;
  }

  &__mini-divider {
    height: 1px;
    background: var(--border-subtle);
    margin: 10px 8px;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    color: var(--text-tertiary);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 120ms ease;
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    margin-bottom: 1px;
    border: none;
    background: transparent;
    width: 100%;
    text-align: left;

    &:hover {
      background: var(--sidebar-nav-hover);
      color: var(--text-primary);
    }

    &.is-active {
      background: var(--sidebar-nav-active-bg);
      color: var(--sidebar-nav-active-text);
      font-weight: 600;
    }

    &-icon {
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    &-label {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  &__footer {
    flex-shrink: 0;
    padding: 8px 6px;
    border-top: 1px solid var(--border-subtle);
  }

  &__collapse-btn {
    font-family: var(--font-sans);
  }
}

// Header
.q-header .topbar {
  height: var(--header-height);
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 8px;
  background: var(--surface-raised);
  border-bottom: 1px solid var(--border-subtle);

  &__breadcrumb {
    .q-breadcrumbs__el {
      font-size: 12px !important;
    }
  }

  &__search {
    .q-field__control {
      height: 32px !important;
      background: var(--surface-overlay) !important;
      border-radius: 8px !important;
    }

    .q-field__native {
      line-height: 32px !important;
      font-size: 13px !important;
    }

    .q-field--outlined .q-field__control:before {
      border-color: var(--border-subtle) !important;
    }
  }

  &__divider {
    width: 1px;
    height: 18px;
    background: var(--border-subtle);
    margin: 0 4px;
    flex-shrink: 0;
  }

  &__icon-btn {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-tertiary);
    cursor: pointer;
    transition: all 120ms ease;
    background: transparent;
    border: none;
    position: relative;
    flex-shrink: 0;

    &:hover {
      background: var(--surface-sunken);
      color: var(--text-primary);
    }
  }

  &__notif-dot {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 16px;
    height: 16px;
    background: var(--brand-danger);
    color: white;
    border-radius: 50%;
    font-size: 9px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  &__user {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 120ms ease;

    &:hover {
      background: var(--surface-sunken);
    }
  }

  &__avatar {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--brand-primary);
    color: white;
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &__username {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
  }
}

// Notification panel
.notif-panel {
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px 10px;
    border-bottom: 1px solid var(--border-subtle);
    margin-bottom: 4px;
  }

  &__title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }

  &__icon {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-sunken);
    color: var(--text-tertiary);

    &--negative {
      background: var(--status-error-bg);
      color: var(--status-error-text);
    }

    &--positive {
      background: var(--status-success-bg);
      color: var(--status-success-text);
    }
  }

  &__unread-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--brand-primary);
  }
}

// Q-page-container resets
// .q-page-container { padding: 0 !important; }
.q-page {
  background: var(--surface-overlay) !important;
}
</style>