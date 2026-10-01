import { APPS, badgesFor } from '../data/apps.js';
import { FLOW_BY_ID } from '../data/flows.js';
import { masterLineFor } from '../data/masters.js';
import { ROWS } from '../data/stages.js';

/**
 * The accessible, plain-text view of the registry.
 *
 * Always rendered and visually hidden, so screen readers and keyboard users get
 * a plain list of links built from the same registry the map is built from.
 */
export function renderAppIndex(container) {
  const groups = ROWS;
  container.innerHTML = '';

  const heading = document.createElement('h1');
  heading.className = 'app-index__title';
  heading.textContent = 'MBC Hub';
  container.append(heading);

  const intro = document.createElement('p');
  intro.className = 'app-index__intro';
  intro.textContent =
    'Every internal tool, grouped by where it sits in the company cycle.';
  container.append(intro);

  for (const group of groups) {
    const apps = APPS.filter((app) => app.stage === group.id);
    if (apps.length === 0) continue;

    const section = document.createElement('section');
    section.className = 'app-index__group';

    const title = document.createElement('h2');
    title.textContent = group.label;
    section.append(title);

    const description = document.createElement('p');
    description.className = 'app-index__group-note';
    description.textContent = group.description;
    section.append(description);

    const list = document.createElement('ul');
    list.className = 'app-index__list';

    for (const app of apps) {
      const item = document.createElement('li');
      item.className = `app-card app-card--${app.flow}`;
      item.dataset.appId = app.id;

      const titleEl = document.createElement('h3');
      if (app.url) {
        const link = document.createElement('a');
        link.href = app.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = app.name;
        titleEl.append(link);
      } else {
        titleEl.textContent = app.name;
      }
      item.append(titleEl);

      const meta = document.createElement('p');
      meta.className = 'app-card__meta';
      meta.textContent = `${FLOW_BY_ID[app.flow].label} flow`;
      for (const badge of badgesFor(app)) meta.textContent += ` - ${badge}`;
      const masterLine = masterLineFor(app.id);
      if (masterLine) meta.textContent += ` - ${masterLine.toLowerCase()}`;
      item.append(meta);

      const summary = document.createElement('p');
      summary.className = 'app-card__summary';
      summary.textContent = app.summary;
      item.append(summary);

      list.append(item);
    }

    section.append(list);
    container.append(section);
  }
}
