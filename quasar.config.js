/* eslint-env node */
const { configure } = require('quasar/wrappers')

module.exports = configure(function (/* ctx */) {
  return {
    boot: ['keycloak', 'pinia', 'vue-query'],
    css: ['app.scss'],
    extras: ['roboto-font', 'material-icons', 'mdi-v7'],
    build: {
      target: {
        browser: ['es2019', 'edge88', 'firefox78', 'chrome87', 'safari13.1'],
        node: 'node20'
      },
      vueRouterMode: 'history',
      env: {
        VITE_URL_AUTH: process.env.VITE_URL_AUTH,
        VITE_REALM: process.env.VITE_REALM,
        VITE_CLIENT_ID: process.env.VITE_CLIENT_ID,
        VITE_AGNO_API_URL: process.env.VITE_AGNO_API_URL,
        VITE_MCP_API_URL: process.env.VITE_MCP_API_URL,
        VITE_KNOWLEDGE_API_URL: process.env.VITE_KNOWLEDGE_API_URL,
        VITE_KEYCLOAK_ENABLED: process.env.VITE_KEYCLOAK_ENABLED
      }
    },
    devServer: { open: true },
    framework: {
      config: {
        dark: 'auto',
        notify: { position: 'top-right', timeout: 3000 }
      },
      plugins: ['Notify', 'Dialog', 'Loading', 'LocalStorage']
    },
    animations: [],
    ssr: { pwa: false, prodPort: 3000, middlewares: ['render'] },
    pwa: { workboxMode: 'generateSW' },
    electron: { inspectPort: 5858, bundler: 'packager' }
  }
})
