import { APP_BY_ID } from '../data/apps.js';
import { EDGES, FLOW_BY_ID } from '../data/flows.js';
import { BACKBONE, STAGE_BY_ID } from '../data/stages.js';
import { getState, setState, subscribe } from '../state.js';

function stageLabel(app) {
  return app.stage === 'backbone' ? BACKBONE.label : (STAGE_BY_ID[app.stage]?.label ?? app.stage);
}

function relatedList(appId, direction) {
  const key = direction === 'in' ? 'to' : 'from';
  const other = direction === 'in' ? 'from' : 'to';
  return EDGES.filter((edge) => edge[key] === appId)
    .map((edge) => ({ app: APP_BY_ID[edge[other]], note: edge.note }))
    .filter((entry) => entry.app);
}

/** The panel for the selected tool: what it is, what it connects to, and its link. */
export function createDetailPanel(panel) {
  function renderRelations(title, entries) {
    if (entries.length === 0) return '';
    const items = entries
      .map(
        (entry) => `
          <li>
            <button type="button" class="relation" data-app-id="${entry.app.id}">
              <span class="relation__name">${entry.app.name}</span>
              <span class="relation__note">${entry.note}</span>
            </button>
          </li>`,
      )
      .join('');
    return `<section class="detail__relations"><h3>${title}</h3><ul>${items}</ul></section>`;
  }

  function render(app) {
    const flow = FLOW_BY_ID[app.flow];
    const isPlanned = app.status === 'planned';

    panel.innerHTML = `
      <button type="button" class="detail__close" aria-label="Close details">&times;</button>
      <p class="detail__eyebrow">${stageLabel(app)} &middot; ${flow.label} flow</p>
      <h2 class="detail__name">${app.name}</h2>
      <p class="detail__tagline">${app.tagline}</p>
      <p class="detail__summary">${app.summary}</p>
      ${
        isPlanned
          ? '<p class="detail__planned">Not built yet. Its place in the model is already reserved, and the dashed links show what it will connect to.</p>'
          : `<a class="detail__open" href="${app.url}" target="_blank" rel="noopener noreferrer">
               Open ${app.name}
               <span aria-hidden="true">&#8599;</span>
             </a>
             <p class="detail__url">${app.url.replace('https://', '')}</p>`
      }
      ${renderRelations('Receives from', relatedList(app.id, 'in'))}
      ${renderRelations('Sends to', relatedList(app.id, 'out'))}
    `;

    panel.querySelector('.detail__close').addEventListener('click', () =>
      setState({ selected: null }),
    );
    for (const button of panel.querySelectorAll('.relation')) {
      button.addEventListener('click', () => setState({ selected: button.dataset.appId }));
      button.addEventListener('pointerenter', () => setState({ hovered: button.dataset.appId }));
      button.addEventListener('pointerleave', () => setState({ hovered: null }));
    }
  }

  function applyState() {
    const { selected } = getState();
    const app = selected ? APP_BY_ID[selected] : null;

    if (!app) {
      panel.hidden = true;
      panel.classList.remove('is-open');
      panel.innerHTML = '';
      return;
    }

    render(app);
    panel.hidden = false;
    // Next frame, so the open transition has a starting state to animate from.
    requestAnimationFrame(() => panel.classList.add('is-open'));
  }

  applyState();
  subscribe(applyState);
}
