import { APPS } from '../data/apps.js';
import { FLOW_BY_ID } from '../data/flows.js';
import { STAGES } from '../data/stages.js';
import { emphasisForApp, getState, setState, subscribe, toggleFilter } from '../state.js';
import { BACKBONE_ROW } from './layout.js';

/**
 * The narrow-screen view: a strip map, the diagram transit systems print inside
 * a carriage when there is no room for the real thing.
 *
 * Four lanes side by side cannot fit a phone at a readable size - scaling the
 * map down only produces tiny text and scrolling in two directions. So on a
 * phone the map straightens out into one line running down the page, still in
 * cycle order, with the flow shown on each station rather than as a route.
 * Connections move into the detail panel, one tap away, where they are easier
 * to read than a crossing line would have been.
 */
export function createStrip(container) {
  container.innerHTML = '';
  const strip = document.createElement('div');
  strip.className = 'strip';

  const sections = [
    ...STAGES.map((stage, index) => ({ ...stage, order: index + 1, isBackbone: false })),
    { ...BACKBONE_ROW, order: null, isBackbone: true },
  ];

  const stationEls = new Map();
  const sectionEls = new Map();

  for (const definition of sections) {
    const apps = APPS.filter((app) => app.stage === definition.id);

    const section = document.createElement('section');
    section.className = `strip__section${definition.isBackbone ? ' strip__section--backbone' : ''}`;

    const header = document.createElement('div');
    header.className = 'strip__header';

    if (definition.isBackbone) {
      header.innerHTML = `
        <span class="strip__header-name">${definition.label}</span>
        <span class="strip__header-description">${definition.description}</span>
      `;
    } else {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'strip__header-button';
      button.dataset.stage = definition.id;
      button.innerHTML = `
        <span class="strip__order">${definition.order}</span>
        <span class="strip__header-name">${definition.label}</span>
        <span class="strip__header-description">${definition.description}</span>
      `;
      button.addEventListener('click', () => toggleFilter('stageFilter', definition.id));
      header.append(button);
    }
    section.append(header);

    const list = document.createElement('ul');
    list.className = 'strip__stations';

    if (apps.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'strip__empty';
      empty.textContent = 'No tool yet';
      list.append(empty);
    }

    for (const app of apps) {
      const flow = FLOW_BY_ID[app.flow];
      const isPlanned = app.status === 'planned';

      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `strip__station strip__station--${app.flow}${
        isPlanned ? ' strip__station--planned' : ''
      }`;
      button.dataset.appId = app.id;
      button.innerHTML = `
        <span class="strip__dot"></span>
        <span class="strip__name">${app.name}</span>
        ${isPlanned ? '<span class="strip__badge">planned</span>' : ''}
        <span class="strip__tagline">${app.tagline}</span>
        <span class="strip__flow">${flow.label}</span>
      `;
      button.addEventListener('click', () => setState({ selected: app.id }));
      item.append(button);
      list.append(item);
      stationEls.set(app.id, button);
    }

    section.append(list);
    strip.append(section);
    sectionEls.set(definition.id, { definition, section });
  }

  // The cycle closes: say so, since the strip cannot draw the line back up.
  const loop = document.createElement('p');
  loop.className = 'strip__loop';
  loop.innerHTML = '<span aria-hidden="true">&#8634;</span> What customers say starts the next cycle at Develop.';
  strip.append(loop);

  container.append(strip);

  function applyState() {
    const { stageFilter, selected } = getState();

    for (const app of APPS) {
      const button = stationEls.get(app.id);
      if (!button) continue;
      const emphasis = emphasisForApp(app);
      button.classList.toggle('is-dim', emphasis === 'dim');
      button.classList.toggle('is-selected', selected === app.id);
      button.setAttribute('aria-pressed', String(selected === app.id));
    }

    for (const [id, { definition, section }] of sectionEls) {
      const active = stageFilter === id;
      section.classList.toggle('is-active', active);
      section.classList.toggle(
        'is-dim',
        Boolean(stageFilter) && !active && !definition.isBackbone,
      );
      section
        .querySelector('.strip__header-button')
        ?.setAttribute('aria-pressed', String(active));
    }
  }

  applyState();
  const unsubscribe = subscribe(applyState);

  let lastSelected = null;
  const unsubscribeScroll = subscribe(({ selected }) => {
    if (selected === lastSelected) return;
    lastSelected = selected;
    stationEls.get(selected)?.scrollIntoView({ block: 'center' });
  });

  return {
    destroy() {
      unsubscribe();
      unsubscribeScroll();
      container.innerHTML = '';
    },
  };
}
