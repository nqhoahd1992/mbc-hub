import './styles/main.css';

import { APP_BY_ID } from './data/apps.js';
import { publishCssVariables } from './utils/color.js';
import { getState, setState, subscribe } from './state.js';

import { buildInterchanges, buildRows, buildStations } from './map/layout.js';
import { buildLinks } from './map/routes.js';
import { renderMap } from './map/render.js';
import { createFitter, wireInteractions } from './map/interactions.js';
import { createStrip } from './map/strip.js';
import { createMapAnimation, playStripIntro } from './map/animate.js';

import { renderAppIndex } from './ui/appIndex.js';
import { createOverlay } from './ui/overlay.js';
import { createDetailPanel } from './ui/detailPanel.js';
import { createTooltip } from './ui/tooltip.js';
import { createSearch } from './ui/search.js';

/**
 * Below this width the four lanes cannot sit side by side at a readable size,
 * so the map straightens into the strip view instead of being scaled down.
 */
const WIDE_ENOUGH_FOR_THE_MAP = '(min-width: 880px)';

publishCssVariables();

/**
 * The top bar wraps to a different number of rows depending on width, so the
 * offset the viewport sits at has to be measured rather than guessed - guessing
 * it is what hides the first row of the map behind the bar.
 */
function trackBarHeight(bar) {
  const apply = () =>
    document.documentElement.style.setProperty('--bar-height', `${bar.offsetHeight}px`);
  apply();
  new ResizeObserver(apply).observe(bar);
}

const viewport = document.getElementById('viewport');
const wrapper = document.querySelector('.map-wrapper');
const stage = document.getElementById('map-stage');
const appIndex = document.getElementById('app-index');
const hud = document.getElementById('hud');

trackBarHeight(hud);

// Always rendered, visually hidden: the screen reader path through the same
// registry both views are built from.
renderAppIndex(appIndex);

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wide = window.matchMedia(WIDE_ENOUGH_FOR_THE_MAP);

let view = null;

function mountMap() {
  document.body.classList.remove('is-strip');
  const rows = buildRows();
  const stations = buildStations(rows);
  const links = buildLinks(stations);
  const interchanges = buildInterchanges();
  const map = renderMap(stage, { rows, stations, links, interchanges });
  const interactions = wireInteractions({ viewport, stage, map, prefersReducedMotion });
  const fitter = createFitter({ viewport, stage, map });

  const animation = createMapAnimation({ map, rows, stations, prefersReducedMotion });
  animation.playIntro();

  // A pulse runs down whatever the selected tool is connected to.
  let lastSelected = null;
  const unsubscribePulse = subscribe(({ selected }) => {
    if (selected === lastSelected) return;
    lastSelected = selected;
    animation.pulseFor(selected);
  });

  return {
    fitter,
    destroy() {
      unsubscribePulse();
      animation.destroy();
      interactions.destroy();
      fitter.destroy();
      stage.innerHTML = '';
    },
  };
}

function mountStrip() {
  document.body.classList.add('is-strip');
  stage.style.cssText = '';
  wrapper.style.cssText = '';
  const strip = createStrip(stage);
  const stopIntro = playStripIntro(stage, prefersReducedMotion);
  return {
    fitter: null,
    destroy() {
      stopIntro();
      strip.destroy();
    },
  };
}

function mountView() {
  view?.destroy();
  view = wide.matches ? mountMap() : mountStrip();
}

mountView();
wide.addEventListener('change', mountView);

// Master data mode only swaps what the labels say, so it belongs on the body
// rather than in either view: the map and the strip both read it from there.
subscribe(({ masterMode }) =>
  document.body.classList.toggle('is-master-mode', masterMode),
);

const search = createSearch(document.getElementById('search'), { onSelect: () => {} });

createOverlay(hud, {
  onResetView: () => {
    setState({ selected: null, flowFilter: null, stageFilter: null, masterMode: false });
    viewport.scrollTo({ top: 0, left: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  },
  onOpenSearch: () => search.open(),
  onToggleFit: () => view?.fitter?.toggleFitAll() ?? false,
});
createDetailPanel(document.getElementById('detail-panel'));
createTooltip(document.getElementById('tooltip'), window);

window.addEventListener('keydown', (event) => {
  if (search.isOpen) return;
  if (event.target instanceof HTMLElement && event.target.closest('input, textarea')) return;

  if (event.key === '/') {
    event.preventDefault();
    search.open();
    return;
  }
  if (event.key === 'Escape') {
    setState({ selected: null, flowFilter: null, stageFilter: null, masterMode: false });
    return;
  }
  if (event.key === 'Enter') {
    const app = getState().selected ? APP_BY_ID[getState().selected] : null;
    if (app?.url) window.open(app.url, '_blank', 'noopener,noreferrer');
  }
});

document.body.classList.add('is-ready');
