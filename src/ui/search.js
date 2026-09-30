import { APPS } from '../data/apps.js';
import { FLOW_BY_ID } from '../data/flows.js';
import { BACKBONE, STAGE_BY_ID } from '../data/stages.js';
import { setState } from '../state.js';

/** Scores a tool against a query. Name matches beat tagline, summary and keywords. */
function score(app, query) {
  const q = query.toLowerCase();
  const name = app.name.toLowerCase();
  if (name.startsWith(q)) return 100;
  if (name.includes(q)) return 80;
  if (app.tagline.toLowerCase().includes(q)) return 60;
  if ((app.keywords ?? []).some((keyword) => keyword.toLowerCase().includes(q))) return 45;
  if (app.summary.toLowerCase().includes(q)) return 30;
  return 0;
}

function rank(query) {
  if (!query.trim()) return APPS.slice();
  return APPS.map((app) => ({ app, value: score(app, query.trim()) }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((entry) => entry.app);
}

/**
 * Quick launcher on "/".
 * Enter selects the tool (which flies the camera to it); Ctrl/Cmd+Enter opens it
 * straight away, for people who already know where they are going.
 */
export function createSearch(panel, { onSelect }) {
  panel.innerHTML = `
    <div class="search__box" role="dialog" aria-modal="true" aria-label="Find a tool">
      <input
        type="search"
        class="search__input"
        placeholder="Find a tool..."
        autocomplete="off"
        spellcheck="false"
        aria-controls="search-results"
      />
      <ul class="search__results" id="search-results" role="listbox"></ul>
      <p class="search__hint">
        <kbd>&uarr;</kbd><kbd>&darr;</kbd> move &middot; <kbd>Enter</kbd> focus &middot;
        <kbd>Ctrl</kbd>+<kbd>Enter</kbd> open &middot; <kbd>Esc</kbd> close
      </p>
    </div>
  `;

  const input = panel.querySelector('.search__input');
  const results = panel.querySelector('.search__results');

  let matches = [];
  let activeIndex = 0;

  function renderResults() {
    results.innerHTML = matches
      .map((app, index) => {
        const stage =
          app.stage === 'backbone' ? BACKBONE.label : (STAGE_BY_ID[app.stage]?.label ?? app.stage);
        return `
          <li
            role="option"
            id="search-option-${index}"
            class="search__result search__result--${app.flow} ${index === activeIndex ? 'is-active' : ''}"
            aria-selected="${index === activeIndex}"
            data-index="${index}"
          >
            <span class="search__result-name">${app.name}</span>
            <span class="search__result-meta">${stage} &middot; ${FLOW_BY_ID[app.flow].label}${
              app.status === 'planned' ? ' &middot; planned' : ''
            }</span>
            <span class="search__result-tagline">${app.tagline}</span>
          </li>`;
      })
      .join('');

    input.setAttribute(
      'aria-activedescendant',
      matches.length > 0 ? `search-option-${activeIndex}` : '',
    );
    results.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  }

  function refresh() {
    matches = rank(input.value);
    activeIndex = 0;
    renderResults();
  }

  function close() {
    panel.hidden = true;
    input.value = '';
  }

  function open() {
    panel.hidden = false;
    refresh();
    input.focus();
  }

  function commit(openDirectly) {
    const app = matches[activeIndex];
    if (!app) return;
    close();
    if (openDirectly && app.url) {
      window.open(app.url, '_blank', 'noopener,noreferrer');
      return;
    }
    setState({ selected: app.id });
    onSelect(app);
  }

  input.addEventListener('input', refresh);

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || (event.key === 'Tab' && !event.shiftKey)) {
      event.preventDefault();
      activeIndex = (activeIndex + 1) % Math.max(matches.length, 1);
      renderResults();
    } else if (event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey)) {
      event.preventDefault();
      activeIndex = (activeIndex - 1 + matches.length) % Math.max(matches.length, 1);
      renderResults();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      commit(event.ctrlKey || event.metaKey);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  });

  results.addEventListener('click', (event) => {
    const item = event.target.closest('[data-index]');
    if (!item) return;
    activeIndex = Number(item.dataset.index);
    commit(false);
  });

  panel.addEventListener('pointerdown', (event) => {
    if (event.target === panel) close();
  });

  return { open, close, get isOpen() { return !panel.hidden; } };
}
