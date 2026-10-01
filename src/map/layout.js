import { APPS } from '../data/apps.js';
import { EDGES, FLOWS } from '../data/flows.js';
import { STAGES } from '../data/stages.js';

/**
 * Turns the registry into metro-map coordinates.
 *
 * The two axes of the model survive the move from 3D: a stage is a ROW running
 * down the page in cycle order, a flow is a LANE running across it. A tool sits
 * where its row meets its lane, so its position still states what it does and
 * where in the cycle it does it.
 *
 * Rows grow taller when a cell holds several tools, which is what lets the map
 * absorb 30 or 60 tools without anything overlapping: it gets longer, not denser.
 */

// Every station sits on this grid, because routes are searched on it: a line
// can only run between two stations if both are nodes of the same lattice.
const GRID = 12;

export const METRIC = {
  grid: GRID,
  headerColumn: 216, // stage name and description down the left
  laneX0: 25 * GRID, // centre of the first lane
  // Wide enough to leave a corridor between one lane's labels and the next
  // lane's stations for lines to run down.
  laneWidth: 23 * GRID,
  slotHeight: 5 * GRID,
  rowPadding: 2.5 * GRID, // half a slot, so a station lands on the grid
  backboneGap: 5 * GRID,
  stationRadius: 9,
  labelOffset: 18,
  labelWidth: 208,
  marginTop: 9 * GRID,
  marginBottom: 72,
  returnLaneGap: 92, // how far right the cycle-closing line sweeps
};

const BACKBONE_ROW = {
  id: 'backbone',
  label: 'Backbone',
  description: 'Serves every step of the cycle rather than sitting inside one.',
};

export function laneFor(flowId) {
  const index = FLOWS.findIndex((flow) => flow.id === flowId);
  return Math.max(index, 0);
}

export function laneX(flowId) {
  return METRIC.laneX0 + laneFor(flowId) * METRIC.laneWidth;
}

// Clear space kept between two stacked labels.
const LABEL_GAP = 8;

/**
 * Where each tool in one cell sits, measured from the top of the row's content.
 *
 * Tools are a slot apart, or further when their labels are tall enough to meet:
 * a long name wraps, and a planned tool carries a badge. Every step is rounded
 * up to whole grid steps so the stations stay on the routing grid.
 */
function stackCell(apps) {
  const offsets = [];
  apps.forEach((app, index) => {
    if (index === 0) {
      offsets.push(METRIC.slotHeight / 2);
      return;
    }
    const needed = (labelHeight(apps[index - 1]) + labelHeight(app)) / 2 + LABEL_GAP;
    const step = Math.max(METRIC.slotHeight, Math.ceil(needed / GRID) * GRID);
    offsets.push(offsets[index - 1] + step);
  });
  return offsets;
}

/** Every row in top-to-bottom order: the six stages, then the backbone band. */
export function buildRows() {
  const rows = [];
  let y = METRIC.marginTop;

  const definitions = [
    ...STAGES.map((stage, index) => ({ ...stage, order: index + 1, isBackbone: false })),
    { ...BACKBONE_ROW, order: null, isBackbone: true },
  ];

  for (const definition of definitions) {
    const inRow = APPS.filter((app) => app.stage === definition.id);
    const offsets = new Map();
    let extent = METRIC.slotHeight;
    for (const flow of FLOWS) {
      const inCell = inRow.filter((app) => app.flow === flow.id);
      stackCell(inCell).forEach((offset, index) => offsets.set(inCell[index].id, offset));
      if (inCell.length > 0) extent = Math.max(extent, offsets.get(inCell.at(-1).id) + METRIC.slotHeight / 2);
    }
    const height = extent + METRIC.rowPadding * 2;

    if (definition.isBackbone) y += METRIC.backboneGap;

    rows.push({
      ...definition,
      y,
      height,
      offsets,
      apps: inRow,
      hasLiveTool: inRow.some((app) => app.status === 'live'),
    });
    y += height;
  }

  return rows;
}

/** Station centres, keyed by app id. */
export function buildStations(rows) {
  const stations = new Map();

  for (const row of rows) {
    for (const flow of FLOWS) {
      const inCell = row.apps.filter((app) => app.flow === flow.id);
      inCell.forEach((app) => {
        stations.set(app.id, {
          app,
          row,
          x: laneX(flow.id),
          y: row.y + METRIC.rowPadding + row.offsets.get(app.id),
        });
      });
    }
  }

  return stations;
}

/**
 * A tool is an interchange when it is on a link carrying a currency other than
 * its own - Sales Dashboard reports information but feeds money into Finance.
 * Interchanges get the double-ring station, exactly as on a transit map.
 */
export function buildInterchanges() {
  const foreign = new Map();
  for (const edge of EDGES) {
    for (const id of [edge.from, edge.to]) {
      if (!foreign.has(id)) foreign.set(id, new Set());
      foreign.get(id).add(edge.flow);
    }
  }
  const interchanges = new Set();
  for (const app of APPS) {
    const flows = foreign.get(app.id);
    if (flows && [...flows].some((flowId) => flowId !== app.flow)) interchanges.add(app.id);
  }
  return interchanges;
}

// Rough glyph widths of the label type, measured against the rendered map and
// rounded up: a box that is a little too big only costs a route a detour, a
// box that is too small lets a line run under a name.
const NAME_CHAR_WIDTH = 9.5;
const TAGLINE_CHAR_WIDTH = 5.6;
const LABEL_CHROME = 18; // padding and border around the text
const NAME_LINE = 16.25;
const TAGLINE_LINE = 13.65;
const BADGE_LINE = 14;

/**
 * Where a station's label sits, estimated from its text.
 *
 * Labels are HTML and only get a size once they are laid out, but routes are
 * built before that - and in Node, by the map check. So the box is predicted
 * from the copy with the same type metrics the stylesheet uses.
 */
function labelHeight(app) {
  const content = METRIC.labelWidth - LABEL_CHROME;
  const lines = (text, charWidth) => Math.max(1, Math.ceil((text.length * charWidth) / content));
  return (
    LABEL_CHROME / 2 +
    lines(app.name, NAME_CHAR_WIDTH) * NAME_LINE +
    (app.status === 'planned' ? BADGE_LINE : 0) +
    lines(app.tagline, TAGLINE_CHAR_WIDTH) * TAGLINE_LINE
  );
}

export function labelBox(app, station) {
  const width = Math.min(
    METRIC.labelWidth,
    LABEL_CHROME +
      Math.max(app.name.length * NAME_CHAR_WIDTH, app.tagline.length * TAGLINE_CHAR_WIDTH),
  );
  const height = labelHeight(app);
  const left = station.x + METRIC.labelOffset;
  return { left, right: left + width, top: station.y - height / 2, bottom: station.y + height / 2 };
}

export function totalHeight(rows) {
  const last = rows[rows.length - 1];
  return last.y + last.height + METRIC.marginBottom;
}

export function totalWidth() {
  return (
    METRIC.laneX0 +
    (FLOWS.length - 1) * METRIC.laneWidth +
    METRIC.labelOffset +
    METRIC.labelWidth +
    METRIC.returnLaneGap
  );
}

export { BACKBONE_ROW };
