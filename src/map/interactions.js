import { APP_BY_ID } from '../data/apps.js';
import { emphasisForApp, emphasisForLink, getState, setState, subscribe, toggleFilter } from '../state.js';

/**
 * Everything that reacts to state: highlighting, filtering, and keeping the
 * selected station on screen. The rules come from state.js, so the map dims
 * exactly the same things the old scene did.
 */
export function wireInteractions({ viewport, stage, map, prefersReducedMotion }) {
  const { rowEls, laneEls, linkEls, stationEls } = map;

  for (const { header } of rowEls.values()) {
    const button = header.querySelector('.row-header__button');
    button?.addEventListener('click', () => toggleFilter('stageFilter', button.dataset.stage));
  }

  function applyState() {
    const { flowFilter, stageFilter, selected, hovered } = getState();

    for (const entry of stationEls.values()) {
      const emphasis = emphasisForApp(entry.app);
      for (const node of [entry.group, entry.label]) {
        node.classList.toggle('is-focus', emphasis === 'focus');
        node.classList.toggle('is-dim', emphasis === 'dim');
      }
      entry.label.classList.toggle('is-selected', selected === entry.app.id);
      entry.label.setAttribute('aria-pressed', String(selected === entry.app.id));
    }

    for (const { link, group } of linkEls.values()) {
      const emphasis = emphasisForLink(link, APP_BY_ID);
      group.classList.toggle('is-focus', emphasis === 'focus');
      group.classList.toggle('is-dim', emphasis === 'dim');
    }

    for (const { row, band, header } of rowEls.values()) {
      const active = stageFilter === row.id;
      const dim = Boolean(stageFilter) && !active && !row.isOffCycle;
      band.classList.toggle('is-active', active);
      header.classList.toggle('is-active', active);
      header.classList.toggle('is-dim', dim);
      header.querySelector('.row-header__button')?.setAttribute('aria-pressed', String(active));
    }

    for (const [flowId, { guide, header }] of laneEls) {
      const active = flowFilter === flowId;
      const dim = Boolean(flowFilter) && !active;
      guide.classList.toggle('is-dim', dim);
      header.classList.toggle('is-active', active);
      header.classList.toggle('is-dim', dim);
    }

    if (hovered && hovered !== selected) {
      stationEls.get(hovered)?.group.parentNode?.append(stationEls.get(hovered).group);
    }
  }

  applyState();
  const unsubscribeState = subscribe(applyState);

  // Bring a station into view when it is chosen from search or from a relation
  // link in the detail panel, which may be far off screen on a long map.
  let lastSelected = null;
  const unsubscribeScroll = subscribe(({ selected }) => {
    if (selected === lastSelected) return;
    lastSelected = selected;
    const entry = selected ? stationEls.get(selected) : null;
    if (!entry) return;
    entry.label.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'center',
      inline: 'center',
    });
  });

  // Clicking the empty map clears the selection.
  function clearOnBackdrop(event) {
    if (event.target === viewport || event.target === stage) setState({ selected: null });
  }
  viewport.addEventListener('pointerdown', clearOnBackdrop);

  return {
    applyState,
    destroy() {
      unsubscribeState();
      unsubscribeScroll();
      viewport.removeEventListener('pointerdown', clearOnBackdrop);
    },
  };
}

/**
 * Scales the map down when the window is narrower than it is, and never scales
 * it up: past a certain size the lines stop meaning anything and it just looks
 * blown up. Below the readable floor it stays put and the viewport scrolls.
 */
export function createFitter({ viewport, stage, map }) {
  const MIN_SCALE = 0.62;
  let fitAll = false;

  function fit() {
    const available = viewport.clientWidth - 32;
    const byWidth = Math.min(1, available / map.width);
    const byHeight = (viewport.clientHeight - 32) / map.height;
    const scale = fitAll
      ? Math.min(byWidth, byHeight)
      : Math.max(MIN_SCALE, byWidth);
    stage.style.transform = `scale(${scale})`;
    stage.style.width = `${map.width}px`;
    stage.style.height = `${map.height}px`;
    // The wrapper has to reserve the SCALED size, or the page scrolls to the
    // unscaled box and leaves a dead gap at the bottom.
    stage.parentElement.style.width = `${map.width * scale}px`;
    stage.parentElement.style.height = `${map.height * scale}px`;
  }

  fit();
  window.addEventListener('resize', fit);

  return {
    fit,
    destroy() {
      window.removeEventListener('resize', fit);
      stage.style.cssText = '';
      stage.parentElement.style.cssText = '';
    },
    get isFitAll() {
      return fitAll;
    },
    toggleFitAll() {
      fitAll = !fitAll;
      fit();
      return fitAll;
    },
  };
}
