import { APP_BY_ID } from '../data/apps.js';
import { FLOW_BY_ID } from '../data/flows.js';
import { rowLabel } from '../data/stages.js';
import { getState, subscribe } from '../state.js';

/** A one-line read-out that follows the pointer while a tool is hovered. */
export function createTooltip(element, tracked) {
  let visible = false;

  tracked.addEventListener('pointermove', (event) => {
    if (!visible) return;
    const offset = 18;
    const maxX = window.innerWidth - element.offsetWidth - 12;
    const maxY = window.innerHeight - element.offsetHeight - 12;
    element.style.transform = `translate(${Math.min(event.clientX + offset, maxX)}px, ${Math.min(
      event.clientY + offset,
      maxY,
    )}px)`;
  });

  function applyState() {
    const { hovered, selected } = getState();
    const app = hovered && hovered !== selected ? APP_BY_ID[hovered] : null;

    if (!app) {
      visible = false;
      element.hidden = true;
      return;
    }

    const stage = rowLabel(app.stage);
    element.innerHTML = `
      <strong>${app.name}</strong>
      <span>${app.tagline}</span>
      <em>${stage} &middot; ${FLOW_BY_ID[app.flow].label}</em>
    `;
    element.hidden = false;
    visible = true;
  }

  applyState();
  subscribe(applyState);
}
