import { APPS, badgesFor } from '../data/apps.js';
import { masterLineFor } from '../data/masters.js';
import { FLOWS, FLOW_BY_ID } from '../data/flows.js';
import { setState } from '../state.js';
import { METRIC, laneX, totalHeight, totalWidth } from './layout.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
}

/**
 * Builds the map.
 *
 * Lines and stations are SVG, because they are geometry. Every piece of text is
 * an HTML element positioned over that geometry, because SVG cannot wrap text
 * and these names are long. Both live in one container, so a single transform
 * scales the whole map at once.
 */
export function renderMap(container, { rows, stations, links, interchanges }) {
  const width = totalWidth();
  const height = totalHeight(rows);

  container.innerHTML = '';
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;

  const canvas = svg('svg', {
    class: 'map__svg',
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
    'aria-hidden': 'true',
  });

  const bands = svg('g', { class: 'map__bands' });
  const guides = svg('g', { class: 'map__guides' });
  const lines = svg('g', { class: 'map__lines' });
  const marks = svg('g', { class: 'map__stations' });
  canvas.append(bands, guides, lines, marks);
  container.append(canvas);

  // --- row bands and their headers ----------------------------------------

  const rowEls = new Map();

  for (const row of rows) {
    const band = svg('rect', {
      class: `map__band${row.isOffCycle ? ' map__band--off-cycle' : ''}`,
      x: 0,
      y: row.y,
      width,
      height: row.height,
      rx: 10,
    });
    bands.append(band);

    const header = document.createElement('div');
    header.className = `row-header${row.isOffCycle ? ' row-header--off-cycle' : ''}`;
    header.style.top = `${row.y}px`;
    header.style.height = `${row.height}px`;

    if (row.isOffCycle) {
      header.innerHTML = `
        <span class="row-header__name">${row.label}</span>
        <span class="row-header__description">${row.description}</span>
      `;
    } else {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'row-header__button';
      button.dataset.stage = row.id;
      button.innerHTML = `
        <span class="row-header__order">${row.order}</span>
        <span class="row-header__name">${row.label}</span>
        <span class="row-header__description">${row.description}</span>
        ${row.hasLiveTool ? '' : '<span class="row-header__empty">no tool yet</span>'}
      `;
      header.append(button);
    }

    container.append(header);
    rowEls.set(row.id, { row, band, header });
  }

  // --- lane guides and their headers --------------------------------------

  const laneEls = new Map();
  const firstRow = rows[0];
  const lastRow = rows[rows.length - 1];

  for (const flow of FLOWS) {
    const x = laneX(flow.id);

    const guide = svg('line', {
      class: `map__guide map__guide--${flow.id}`,
      x1: x,
      y1: firstRow.y - 18,
      x2: x,
      y2: lastRow.y + lastRow.height + 10,
    });
    guides.append(guide);

    const header = document.createElement('div');
    header.className = `lane-header lane-header--${flow.id}`;
    header.style.left = `${x}px`;
    header.style.top = `${firstRow.y - 44}px`;
    header.innerHTML = `<span class="lane-header__swatch lane-header__swatch--${flow.shape}"></span><span>${flow.label}</span>`;
    container.append(header);

    laneEls.set(flow.id, { guide, header });
  }

  // --- links ---------------------------------------------------------------

  const linkEls = new Map();

  links.forEach((link, index) => {
    const flow = FLOW_BY_ID[link.flow];
    const group = svg('g', {
      class: `map__link map__link--${link.flow}${link.ghost ? ' map__link--ghost' : ''}${
        link.isReturn ? ' map__link--return' : ''
      }`,
    });

    // A dark casing under every line, so crossings read as one passing over
    // the other instead of merging into a blob.
    const casing = svg('path', { class: 'map__link-casing', d: link.path });
    const line = svg('path', { class: 'map__link-line', d: link.path, stroke: flow.color });
    group.append(casing, line);

    const angle =
      (Math.atan2(link.end.y - link.approach.y, link.end.x - link.approach.x) * 180) / Math.PI;
    const back = METRIC.stationRadius + 5;
    const tipX = link.end.x - Math.cos((angle * Math.PI) / 180) * back;
    const tipY = link.end.y - Math.sin((angle * Math.PI) / 180) * back;
    const arrow = svg('path', {
        class: 'map__link-arrow',
        d: 'M 0 0 L -9 4.5 L -9 -4.5 Z',
        fill: flow.color,
        transform: `translate(${tipX.toFixed(1)} ${tipY.toFixed(1)}) rotate(${angle.toFixed(1)})`,
    });
    group.append(arrow);

    lines.append(group);
    linkEls.set(index, { link, group, line, casing, arrow });
  });

  // --- stations ------------------------------------------------------------

  const stationEls = new Map();

  for (const app of APPS) {
    const station = stations.get(app.id);
    if (!station) continue;

    const flow = FLOW_BY_ID[app.flow];
    const isPlanned = app.status === 'planned';
    const isInterchange = interchanges.has(app.id);

    const group = svg('g', {
      class: `station station--${app.flow}${isPlanned ? ' station--planned' : ''}${
        isInterchange ? ' station--interchange' : ''
      }`,
    });

    if (isInterchange) {
      group.append(
        svg('circle', {
          class: 'station__ring',
          cx: station.x,
          cy: station.y,
          r: METRIC.stationRadius + 5,
          stroke: flow.color,
        }),
      );
    }

    group.append(
      svg('circle', {
        class: 'station__dot',
        cx: station.x,
        cy: station.y,
        r: METRIC.stationRadius,
        fill: isPlanned ? 'none' : flow.color,
        stroke: flow.color,
      }),
    );

    marks.append(group);

    const masterLine = masterLineFor(app.id);
    const label = document.createElement('button');
    label.type = 'button';
    label.className = `station-label station-label--${app.flow}${
      masterLine ? ' station-label--master' : ''
    }`;
    label.dataset.appId = app.id;
    label.style.left = `${station.x + METRIC.labelOffset}px`;
    label.style.top = `${station.y}px`;
    label.style.maxWidth = `${METRIC.labelWidth}px`;
    label.innerHTML =
      `<span class="station-label__name">${app.name}</span>` +
      badgesFor(app)
        .map(
          (badge) =>
            `<span class="station-label__badge station-label__badge--${badge}">${badge}</span>`,
        )
        .join('') +
      `<span class="station-label__tagline">${app.tagline}</span>` +
      (masterLine ? `<span class="station-label__master">${masterLine}</span>` : '');

    label.addEventListener('click', () => setState({ selected: app.id }));
    label.addEventListener('pointerenter', () => setState({ hovered: app.id }));
    label.addEventListener('pointerleave', () => setState({ hovered: null }));
    label.addEventListener('focus', () => setState({ hovered: app.id }));
    label.addEventListener('blur', () => setState({ hovered: null }));

    container.append(label);
    stationEls.set(app.id, { app, station, group, label });
  }

  return { canvas, rowEls, laneEls, linkEls, stationEls, width, height };
}
