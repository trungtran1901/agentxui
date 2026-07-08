import { defineStore } from 'pinia'

export const useUIStore = defineStore('ui', {
  state: () => ({
    sidebarCollapsed: false,
    darkMode: false,
    notifications: [],
    breadcrumbs: []
  }),
  getters: {
    unreadCount: (state) => state.notifications.filter(n => !n.read).length
  },
  actions: {
    toggleSidebar() { this.sidebarCollapsed = !this.sidebarCollapsed },
    toggleDark() { this.darkMode = !this.darkMode },
    setBreadcrumbs(items) { this.breadcrumbs = items },
    addNotification(type, message) {
      this.notifications.unshift({ id: Date.now().toString(), type, message, read: false, created_at: new Date() })
      if (this.notifications.length > 50) this.notifications.pop()
    },
    markAllRead() { this.notifications.forEach(n => n.read = true) }
  }
})
