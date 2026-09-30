import { APPS } from '../data/apps.js';
import { FLOWS, appTouchesFlow } from '../data/flows.js';
import { STAGES, STAGE_BY_ID } from '../data/stages.js';
import { getState, setState, subscribe, toggleFilter } from '../state.js';

/**
 * The HUD: title, the flow legend that doubles as the filter, and the hints.
 * Every control here writes to the shared state; nothing talks to the scene.
 */
export function createOverlay(container, { onResetView, onOpenSearch }) {
  container.innerHTML = `
    <header class="hud__brand">
      <p class="hud__eyebrow">Max Biocare</p>
      <h1 class="hud__title">MBC Hub</h1>
      <p class="hud__subtitle">
        The ring is one turn of the company. Each tool sits at the step it serves.
      </p>
    </header>

    <section class="legend legend--stages" aria-label="Filter by stage">
      <h2 class="legend__title">The cycle</h2>
      <ol class="legend__list legend__list--stages"></ol>
    </section>

    <section class="legend" aria-label="Filter by flow">
      <h2 class="legend__title">What moves</h2>
      <ul class="legend__list"></ul>
      <button type="button" class="legend__clear" hidden>Clear filter</button>
    </section>

    <footer class="hud__hints">
      <button type="button" class="hint-button" data-action="search">
        <kbd>/</kbd> Search
      </button>
      <button type="button" class="hint-button" data-action="reset">Reset view</button>
      <p class="hud__count"></p>
    </footer>
  `;

  const list = container.querySelector('.legend__list:not(.legend__list--stages)');
  const stageList = container.querySelector('.legend__list--stages');
  const clearButton = container.querySelector('.legend__clear');
  const count = container.querySelector('.hud__count');

  // The six stages, in order, numbered to match the ring. This is the panel that
  // answers "what am I looking at" without needing a tooltip.
  STAGES.forEach((stage, index) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'stage-item';
    button.dataset.stage = stage.id;
    button.innerHTML = `
      <span class="stage-item__order">${index + 1}</span>
      <span class="stage-item__label">${stage.label}</span>
      <span class="stage-item__description">${stage.description}</span>
    `;
    button.addEventListener('click', () => toggleFilter('stageFilter', stage.id));
    item.append(button);
    stageList.append(item);
  });

  for (const flow of FLOWS) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `legend__item legend__item--${flow.id}`;
    button.dataset.flow = flow.id;
    button.innerHTML = `
      <span class="legend__swatch legend__swatch--${flow.shape}"></span>
      <span class="legend__label">${flow.label}</span>
      <span class="legend__description">${flow.description}</span>
    `;
    button.addEventListener('click', () => toggleFilter('flowFilter', flow.id));
    item.append(button);
    list.append(item);
  }

  clearButton.addEventListener('click', () =>
    setState({ flowFilter: null, stageFilter: null }),
  );

  container.querySelector('[data-action="reset"]').addEventListener('click', () => {
    setState({ selected: null, flowFilter: null, stageFilter: null });
    onResetView();
  });
  container.querySelector('[data-action="search"]').addEventListener('click', onOpenSearch);

  function applyState() {
    const { flowFilter, stageFilter } = getState();

    for (const button of list.querySelectorAll('.legend__item')) {
      const active = button.dataset.flow === flowFilter;
      button.classList.toggle('is-active', active);
      button.classList.toggle('is-dim', Boolean(flowFilter) && !active);
      button.setAttribute('aria-pressed', String(active));
    }

    for (const button of stageList.querySelectorAll('.stage-item')) {
      const active = button.dataset.stage === stageFilter;
      button.classList.toggle('is-active', active);
      button.classList.toggle('is-dim', Boolean(stageFilter) && !active);
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
      flowFilter && `${FLOWS.find((f) => f.id === flowFilter).label} flow`,
      stageFilter && `${STAGE_BY_ID[stageFilter]?.label ?? stageFilter} stage`,
    ]
      .filter(Boolean)
      .join(', ');

    count.textContent = scope
      ? `${matching.length} tools in ${scope}${planned ? ` (${planned} planned)` : ''}`
      : `${APPS.length} tools, ${planned} of them still planned`;
  }

  applyState();
  subscribe(applyState);
}
