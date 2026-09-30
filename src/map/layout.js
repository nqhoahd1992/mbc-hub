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

export const METRIC = {
  headerColumn: 216, // stage name and description down the left
  laneX0: 300, // centre of the first lane
  laneWidth: 268,
  slotHeight: 62,
  rowPadding: 26,
  backboneGap: 64,
  stationRadius: 9,
  labelOffset: 18,
  labelWidth: 208,
  marginTop: 108,
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
    const perLane = FLOWS.map(
      (flow) => inRow.filter((app) => app.flow === flow.id).length,
    );
    const slots = Math.max(1, ...perLane);
    const height = slots * METRIC.slotHeight + METRIC.rowPadding * 2;

    if (definition.isBackbone) y += METRIC.backboneGap;

    rows.push({
      ...definition,
      y,
      height,
      slots,
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
      inCell.forEach((app, index) => {
        stations.set(app.id, {
          app,
          row,
          x: laneX(flow.id),
          y: row.y + METRIC.rowPadding + index * METRIC.slotHeight + METRIC.slotHeight / 2,
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
