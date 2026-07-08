<template>
  <q-page class="notfound-page">
    <div class="notfound-content">
      <div class="notfound-code">404</div>
      <div class="notfound-title">Page not found</div>
      <div class="notfound-desc">The page you're looking for doesn't exist or has been moved.</div>
      <router-link to="/" class="btn btn--primary" style="text-decoration:none;margin-top:24px;display:inline-flex">
        <q-icon name="arrow_back" size="16px" />
        Back to Dashboard
      </router-link>
    </div>
  </q-page>
</template>
<script>
import { defineComponent } from 'vue'
export default defineComponent({ name: 'NotFoundPage' })
</script>
<style lang="scss">
.notfound-page { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: var(--surface-overlay); }
.notfound-content { text-align: center; }
.notfound-code { font-size: 96px; font-weight: 900; color: var(--border-subtle); letter-spacing: -0.05em; line-height: 1; }
.notfound-title { font-size: 24px; font-weight: 700; color: var(--text-primary); margin-top: 8px; }
.notfound-desc { font-size: 14px; color: var(--text-tertiary); margin-top: 8px; }
</style>
