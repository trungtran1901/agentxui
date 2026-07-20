import { getUIActionTarget } from './actionRegistry.js'

/**
 * actionExecutor.js — dispatches a UIActionPlan (see brief §4) against
 * live, registered UI components.
 *
 * @typedef {object} UIAction
 * @property {string} actionType   - one of ACTION_TYPES below
 * @property {string} target       - UI Metadata Registry component code
 *                                    (NEVER a CSS selector or XPath)
 * @property {*} [value]           - action-specific payload
 * @property {string} [reason]
 * @property {string} [businessMeaning]
 * @property {number} [confidence]
 * @property {number} executionOrder - sort key, ascending
 *
 * @typedef {object} UIActionPlan
 * @property {number} dslVersion
 * @property {string} [runId]
 * @property {UIAction[]} actions
 */

/** Exhaustive today per the brief — kept as a list (not a strict enum) so
 *  an unrecognized future value degrades to "skip + log", never a throw. */
export const ACTION_TYPES = [
  'FILL_FORM', 'SET_VALUE', 'SELECT_VALUE', 'CLICK_BUTTON', 'NAVIGATE',
  'OPEN_DIALOG', 'CLOSE_DIALOG', 'UPLOAD_FILE', 'DOWNLOAD_FILE',
  'FOCUS_COMPONENT', 'HIGHLIGHT_COMPONENT', 'EXPAND_TREE', 'COLLAPSE_TREE',
  'REFRESH_GRID', 'VALIDATE_FORM'
]

/** The only dslVersion this executor was written against. A mismatch is
 *  logged, not fatal — see executeUIActionPlan(). */
export const KNOWN_DSL_VERSION = 1

/**
 * Execute every action in `plan.actions`, in ascending `executionOrder`.
 * Never throws — each action's outcome (ok / error / skipped) is captured
 * per-item in the returned array so a caller can surface failures without
 * a single bad action aborting the rest of the plan.
 *
 * @param {UIActionPlan} plan
 * @param {{ router?: import('vue-router').Router }} [ctx] - only needed if
 *        the plan contains a NAVIGATE action
 * @returns {Promise<Array<{actionType, target, executionOrder, ok, error?, skipped?}>>}
 */
export async function executeUIActionPlan(plan, ctx = {}) {
  const results = []
  if (!plan || !Array.isArray(plan.actions)) {
    console.warn('[ActionDSL] executeUIActionPlan called with an invalid plan (no actions[])', plan)
    return results
  }

  if (plan.dslVersion !== KNOWN_DSL_VERSION) {
    // Per the brief: an unrecognized dslVersion should degrade gracefully
    // (log) rather than throw. We still attempt best-effort execution,
    // since individual actionTypes are the more likely source of change.
    console.warn(`[ActionDSL] Unrecognized dslVersion=${plan.dslVersion} (executor targets ${KNOWN_DSL_VERSION}) — attempting best-effort execution`)
  }

  const ordered = [...plan.actions].sort(
    (a, b) => (a.executionOrder ?? 0) - (b.executionOrder ?? 0)
  )

  for (const action of ordered) {
    // Sequential, not parallel — actions commonly depend on prior state
    // (e.g. SET_VALUE before CLICK_BUTTON on the same form).
    // eslint-disable-next-line no-await-in-loop
    results.push(await executeSingleAction(action, ctx))
  }
  return results
}

async function executeSingleAction(action, { router } = {}) {
  const base = {
    actionType: action.actionType,
    target: action.target,
    executionOrder: action.executionOrder,
    ok: false
  }

  if (!ACTION_TYPES.includes(action.actionType)) {
    console.warn(`[ActionDSL] Unknown actionType "${action.actionType}" — skipping`, action)
    return { ...base, skipped: true, error: `unknown actionType "${action.actionType}"` }
  }

  // NAVIGATE is router-level, not component-level — no registered target needed.
  if (action.actionType === 'NAVIGATE') {
    if (!router) return { ...base, error: 'NAVIGATE action received but no router was passed to executeUIActionPlan()' }
    try {
      await router.push(action.value)
      return { ...base, ok: true }
    } catch (e) {
      return { ...base, error: e.message }
    }
  }

  const handler = getUIActionTarget(action.target)
  if (!handler) {
    console.warn(
      `[ActionDSL] No live UI handler registered for component code "${action.target}" ` +
      `— is the component mounted and registered via useUIActionTarget()?`,
      action
    )
    return { ...base, error: `no registered target "${action.target}"` }
  }

  try {
    await dispatchToHandler(action.actionType, handler, action.value)
    return { ...base, ok: true }
  } catch (e) {
    return { ...base, error: e.message }
  }
}

/** actionType -> handler method name. Centralized so adding a new
 *  actionType later is a one-line addition here (plus ACTION_TYPES above). */
const HANDLER_METHOD = {
  FILL_FORM: 'fillForm',
  SET_VALUE: 'setValue',
  SELECT_VALUE: 'selectValue',
  CLICK_BUTTON: 'click',
  OPEN_DIALOG: 'open',
  CLOSE_DIALOG: 'close',
  UPLOAD_FILE: 'uploadFile',
  DOWNLOAD_FILE: 'downloadFile',
  FOCUS_COMPONENT: 'focus',
  HIGHLIGHT_COMPONENT: 'highlight',
  EXPAND_TREE: 'expand',
  COLLAPSE_TREE: 'collapse',
  REFRESH_GRID: 'refresh',
  VALIDATE_FORM: 'validate'
}

async function dispatchToHandler(actionType, handler, value) {
  const method = HANDLER_METHOD[actionType]
  const fn = handler[method]
  if (typeof fn !== 'function') {
    throw new Error(`registered target does not implement "${method}()" (required for ${actionType})`)
  }
  return value === undefined ? fn() : fn(value)
}