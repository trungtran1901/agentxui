import { useRoute } from 'vue-router'

/**
 * uiContext.js — builds the optional `uiContext` object for ChatRequest.
 *
 * Per the v2 API brief: uiContext is additive on POST /chat and
 * POST /chat/stream. If omitted entirely, behavior is unchanged from
 * before this field existed — so this helper returns `undefined` (not an
 * empty object) whenever there's nothing meaningful to send, and callers
 * should spread it conditionally:
 *
 *   const body = { ...baseChatBody, ...(uiContext ? { uiContext } : {}) }
 *
 * This file intentionally does NOT read agent-specific state (agentOsCode,
 * teamCode, etc.) — that stays owned by the calling page (e.g.
 * PlaygroundPage.vue), which passes in only what it already tracks.
 */

/**
 * @param {object} opts
 * @param {string} [opts.applicationId] - stable app identifier, if the host page has one
 * @param {string} [opts.pageId]        - UI Metadata Registry page code for the current screen
 * @param {string} [opts.schemaVersion] - schema_version of the page metadata in use, if known
 * @param {object} [opts.currentRecord] - the record/entity currently in focus, if any
 * @param {array}  [opts.selectedItems] - currently selected rows/items, if any
 * @param {object} [opts.variables]     - arbitrary key/value context (fiscal year, filters, etc.)
 * @param {string} [opts.locale]        - defaults to navigator.language
 * @param {string} [opts.device]        - defaults to a simple viewport-width heuristic
 * @param {object} [opts.route]         - vue-router route object; defaults to current route if available
 * @returns {object|undefined} uiContext, or undefined if there's nothing worth sending
 */
export function buildUiContext(opts = {}) {
  let route = opts.route
  if (!route) {
    try { route = useRoute() } catch { route = null }
  }

  const locale = opts.locale || (typeof navigator !== 'undefined' ? navigator.language : undefined)
  const device = opts.device || (typeof window !== 'undefined'
    ? (window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1200 ? 'tablet' : 'desktop')
    : undefined)

  const ctx = {
    applicationId: opts.applicationId || undefined,
    pageId: opts.pageId || undefined,
    schemaVersion: opts.schemaVersion || undefined,
    route: route?.fullPath || route?.path || undefined,
    currentRecord: opts.currentRecord && Object.keys(opts.currentRecord).length ? opts.currentRecord : undefined,
    selectedItems: opts.selectedItems && opts.selectedItems.length ? opts.selectedItems : undefined,
    variables: opts.variables && Object.keys(opts.variables).length ? opts.variables : undefined,
    locale: locale || undefined,
    device: device || undefined
  }

  // Strip undefined keys so we can cheaply test "is this empty".
  const cleaned = Object.fromEntries(Object.entries(ctx).filter(([, v]) => v !== undefined))

  return Object.keys(cleaned).length ? cleaned : undefined
}