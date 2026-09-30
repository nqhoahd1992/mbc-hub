import { appTouchesFlow } from './data/flows.js';

/**
 * The one shared store. The HUD writes to it, the scene reads from it.
 * Keeping it this small is what lets filters, search, hover and selection all
 * drive the same highlighting rules instead of each inventing its own.
 */
const state = {
  flowFilter: null, // flow id, or null for "all flows"
  stageFilter: null, // stage id, or null for "all stages"
  hovered: null, // app id
  selected: null, // app id
  introDone: false,
};

const listeners = new Set();

export function getState() {
  return state;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setState(patch) {
  let changed = false;
  for (const [key, value] of Object.entries(patch)) {
    if (state[key] !== value) {
      state[key] = value;
      changed = true;
    }
  }
  if (changed) {
    for (const listener of listeners) listener(state);
  }
}

/** Toggling the active value clears the filter, which is what users expect. */
export function toggleFilter(key, value) {
  setState({ [key]: state[key] === value ? null : value });
}

/**
 * The single highlighting rule, shared by nodes, links, labels and the HUD.
 * Returns 'focus' (actively picked out), 'normal' or 'dim'.
 */
export function emphasisForApp(app) {
  const matchesFilters =
    (!state.flowFilter || appTouchesFlow(app, state.flowFilter)) &&
    (!state.stageFilter || app.stage === state.stageFilter);

  if (!matchesFilters) return 'dim';
  if (state.selected === app.id || state.hovered === app.id) return 'focus';
  if (state.selected || state.hovered) return 'dim';
  if (state.flowFilter || state.stageFilter) return 'focus';
  return 'normal';
}

/** A link is only interesting when both of its ends are. */
export function emphasisForLink(link, appById) {
  const from = appById[link.from];
  const to = appById[link.to];
  if (!from || !to) return 'dim';

  if (state.flowFilter && link.flow !== state.flowFilter) return 'dim';
  if (state.stageFilter && from.stage !== state.stageFilter && to.stage !== state.stageFilter) {
    return 'dim';
  }

  const active = state.selected ?? state.hovered;
  if (active) {
    return link.from === active || link.to === active ? 'focus' : 'dim';
  }
  if (state.flowFilter || state.stageFilter) return 'focus';
  return 'normal';
}
