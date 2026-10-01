import { APPS } from '../data/apps.js';
import { FLOWS, appTouchesFlow } from '../data/flows.js';
import { STAGE_BY_ID } from '../data/stages.js';
import { getState, setState, subscribe, toggleFilter } from '../state.js';

/**
 * The top bar: what this is, the four line filters, and the controls.
 *
 * The filters are titled as filters on purpose. The map's lane headers use the
 * same swatches, but they label where a tool sits; these pick which lines light
 * up, and a line's colour is what travels it, not the lane it starts in.
 *
 * The stages are deliberately not repeated here - on the map each one is a
 * labelled row carrying its own description, so listing them again would only
 * add a second place to keep in step.
 */
export function createOverlay(container, { onResetView, onOpenSearch, onToggleFit }) {
  container.innerHTML = `
    <div class="hud__brand">
      <p class="hud__eyebrow">Max Biocare</p>
      <h1 class="hud__title">MBC Hub</h1>
      <p class="hud__subtitle">
        Rows are the steps of one company cycle. Lines are what moves between them.
      </p>
    </div>

    <section class="legend" aria-label="Filter by line">
      <h2 class="legend__title">Filter by line</h2>
      <ul class="legend__list"></ul>
    </section>

    <div class="hud__controls">
      <button type="button" class="hint-button" data-action="search">
        <kbd>/</kbd> Search
      </button>
      <button type="button" class="hint-button" data-action="fit" aria-pressed="false">Fit all</button>
      <button type="button" class="hint-button" data-action="reset">Reset</button>
      <button type="button" class="hint-button hint-button--clear" data-action="clear" hidden>
        Clear filter
      </button>
      <p class="hud__count"></p>
    </div>
  `;

  const list = container.querySelector('.legend__list');
  const clearButton = container.querySelector('[data-action="clear"]');
  const count = container.querySelector('.hud__count');

  for (const flow of FLOWS) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `legend__item legend__item--${flow.id}`;
    button.dataset.flow = flow.id;
    button.title = flow.description;
    button.innerHTML = `
      <span class="legend__swatch legend__swatch--${flow.shape}"></span>
      <span class="legend__label">${flow.label}</span>
    `;
    button.addEventListener('click', () => toggleFilter('flowFilter', flow.id));
    item.append(button);
    list.append(item);
  }

  clearButton.addEventListener('click', () => setState({ flowFilter: null, stageFilter: null }));
  container.querySelector('[data-action="reset"]').addEventListener('click', () => {
    setState({ selected: null, flowFilter: null, stageFilter: null });
    onResetView();
  });
  container.querySelector('[data-action="search"]').addEventListener('click', onOpenSearch);

  const fitButton = container.querySelector('[data-action="fit"]');
  fitButton.addEventListener('click', () => {
    const fitAll = onToggleFit();
    fitButton.classList.toggle('is-active', fitAll);
    fitButton.setAttribute('aria-pressed', String(fitAll));
    fitButton.textContent = fitAll ? 'Actual size' : 'Fit all';
  });

  function applyState() {
    const { flowFilter, stageFilter } = getState();

    for (const button of list.querySelectorAll('.legend__item')) {
      const active = button.dataset.flow === flowFilter;
      button.classList.toggle('is-active', active);
      button.classList.toggle('is-dim', Boolean(flowFilter) && !active);
      button.setAttribute('aria-pressed', String(active));
    }

    const hasFilter = Boolean(flowFilter || stageFilter);
    clearButton.hidden = !hasFilter;

    const matching = APPS.filter(
      (app) =>
        (!flowFilter || appTouchesFlow(app, flowFilter)) &&
        (!stageFilter || app.stage === stageFilter),
    );
    const planned = matching.filter((app) => app.status === 'planned').length;

    const scope = [
      flowFilter && `${FLOWS.find((f) => f.id === flowFilter).label} line`,
      stageFilter && `${STAGE_BY_ID[stageFilter]?.label ?? stageFilter} step`,
    ]
      .filter(Boolean)
      .join(', ');

    count.textContent = scope
      ? `${matching.length} tools on ${scope}${planned ? ` (${planned} planned)` : ''}`
      : `${APPS.length} tools, ${planned} of them still planned`;
  }

  applyState();
  subscribe(applyState);
}
