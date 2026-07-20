import { onBeforeUnmount, onMounted } from 'vue'

/**
 * actionRegistry.js — live registry of addressable UI components.
 *
 * The Action DSL (see actionExecutor.js) never touches CSS selectors or
 * XPath. Instead, an agent-proposed action names a `target` that is a UI
 * Metadata Registry component code (e.g. "leave-request-form.days",
 * "leave.submit"). This registry is the runtime-side lookup: any mounted
 * Vue component can claim a code and expose a small set of handler
 * functions (setValue, click, focus, ...) for the executor to call.
 *
 * This is intentionally NOT tied to the UI Metadata Registry client itself
 * — a component can register a code here whether or not that code has a
 * corresponding /ui-metadata entry. The registry client is only consulted
 * by the executor for logging/diagnostics when a target can't be resolved
 * locally (see actionExecutor.js).
 */

/** @type {Map<string, object>} componentCode -> handlers object */
const registry = new Map()

/**
 * Handler shape (component registers only the subset it implements):
 * {
 *   setValue?(value),        selectValue?(value),   click?(),
 *   open?(),                 close?(),               focus?(),
 *   highlight?(value?),      expand?(value?),         collapse?(value?),
 *   refresh?(),              validate?(),              fillForm?(fieldsObject),
 *   uploadFile?(value),      downloadFile?(value)
 * }
 */

/**
 * Register a component under a code. Returns an unregister function.
 * Registering the same code twice replaces the previous handler (last
 * mounted instance wins) — components should unregister on unmount via
 * the returned function, which `useUIActionTarget()` does automatically.
 */
export function registerUIActionTarget(code, handlers) {
  if (!code) return () => {}
  registry.set(code, handlers)
  return () => {
    // Only remove if we're still the registered handler for this code —
    // avoids a race where B registers before A's unmount cleanup runs.
    if (registry.get(code) === handlers) registry.delete(code)
  }
}

/** Look up a live handler by component code. Returns null if not mounted/registered. */
export function getUIActionTarget(code) {
  return registry.get(code) || null
}

/** Debug helper — e.g. for a future observability panel (#5). */
export function listRegisteredUIActionTargets() {
  return [...registry.keys()]
}

/**
 * Composable: register a component's action handlers for the lifetime of
 * the calling component. Use inside `setup()`:
 *
 *   useUIActionTarget('leave.submit', { click: () => save() })
 *
 * `code` may be a plain string or a function/ref-like returning one, for
 * components whose code depends on props resolved after creation.
 */
export function useUIActionTarget(code, handlers) {
  let unregister = () => {}
  onMounted(() => {
    const resolvedCode = typeof code === 'function' ? code() : (code?.value ?? code)
    if (resolvedCode) unregister = registerUIActionTarget(resolvedCode, handlers)
  })
  onBeforeUnmount(() => unregister())
}