import { Vector3 } from 'three';
import { APPS } from '../data/apps.js';
import { EDGES, FLOWS } from '../data/flows.js';
import { STAGES } from '../data/stages.js';
import { linkCurve, pointOnRing } from '../utils/curves.js';

/**
 * Turns the data files into world coordinates.
 *
 * Everything positional lives here, so a new tool in src/data/apps.js is placed
 * automatically: its stage gives the angle, its flow gives the height band, and
 * tools sharing a stage are spread evenly across that stage's arc.
 */

export const LAYOUT = {
  ringRadius: 8.2,
  spineHeight: 7.4,
  spineSpacing: 2.9,
  stageArcPadding: 0.16,
  flowBandGap: 1.15,
  coreRadius: 1.15,
};

const FLOW_INDEX = Object.fromEntries(FLOWS.map((flow, index) => [flow.id, index]));

/** Height band for a flow, so the four currencies read as four layers. */
function flowHeight(flowId) {
  const index = FLOW_INDEX[flowId] ?? 0;
  return (index - (FLOWS.length - 1) / 2) * LAYOUT.flowBandGap;
}

function stageTurn(stageId) {
  return STAGES.find((stage) => stage.id === stageId)?.turn ?? 0;
}

function ringApps() {
  return APPS.filter((app) => app.stage !== 'backbone');
}

function backboneApps(side) {
  return APPS.filter((app) => app.stage === 'backbone' && (app.spineSide ?? 'above') === side);
}

/** Spreads n items symmetrically around 0 with the given spacing. */
function symmetricOffsets(count, spacing) {
  return Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * spacing);
}

export function buildAppPositions() {
  const positions = new Map();
  const sectorWidth = 1 / STAGES.length;

  for (const stage of STAGES) {
    const inStage = ringApps().filter((app) => app.stage === stage.id);
    if (inStage.length === 0) continue;

    const spacing = Math.min(
      (sectorWidth - LAYOUT.stageArcPadding * sectorWidth) / Math.max(inStage.length, 1),
      sectorWidth * 0.42,
    );
    const offsets = symmetricOffsets(inStage.length, spacing);

    inStage.forEach((app, index) => {
      positions.set(
        app.id,
        pointOnRing(stage.turn + offsets[index], LAYOUT.ringRadius, flowHeight(app.flow)),
      );
    });
  }

  // Backbone tools stack along the axis rather than side by side, so they read
  // as being ON the spine. Later entries in the registry sit further out, which
  // puts the tool everything else feeds - Finance - at the end of the run.
  for (const side of ['above', 'below']) {
    const apps = backboneApps(side);
    const direction = side === 'above' ? 1 : -1;
    apps.forEach((app, index) => {
      const fromTip = (apps.length - 1 - index) * LAYOUT.spineSpacing;
      positions.set(app.id, new Vector3(0, direction * (LAYOUT.spineHeight - fromTip), 0));
    });
  }

  return positions;
}

/**
 * One entry per edge, with the curve already built.
 * `ghost` marks a link that cannot flow yet because one end is still planned.
 */
export function buildLinks(appPositions, appById) {
  const seenPairs = new Map();

  return EDGES.flatMap((edge) => {
    const from = appPositions.get(edge.from);
    const to = appPositions.get(edge.to);
    if (!from || !to) return [];

    const pairKey = [edge.from, edge.to].sort().join('|');
    const repeat = seenPairs.get(pairKey) ?? 0;
    seenPairs.set(pairKey, repeat + 1);

    const touchesSpine =
      appById[edge.from]?.stage === 'backbone' || appById[edge.to]?.stage === 'backbone';

    const curve = linkCurve(from, to, {
      bow: touchesSpine ? 0.14 : 0.3,
      lift: repeat * 1.1,
    });

    return [
      {
        ...edge,
        curve,
        ghost:
          appById[edge.from]?.status === 'planned' || appById[edge.to]?.status === 'planned',
      },
    ];
  });
}

/** Label anchors for the six stage names, just outside the ring. */
export function buildStageAnchors() {
  return STAGES.map((stage) => ({
    stage,
    position: pointOnRing(stage.turn, LAYOUT.ringRadius + 3.4, -1.5),
  }));
}

/**
 * Vertical offsets for the node labels.
 *
 * Tools in the same stage sit close together on screen, so their labels collide.
 * Flow bands alone are not enough to separate them: two flows can be less than a
 * label's height apart, and a long name makes it worse. Instead, walk the stage
 * from the lowest tool upwards and push each label just far enough above the one
 * below it, so the gap is guaranteed whatever the names are.
 *
 * LABEL_MIN_GAP is in world units. A unit is about 28px at the overview distance,
 * but the world tilt and the camera elevation both foreshorten vertical offsets,
 * so a unit is worth closer to 23px on screen - and less again for a node on the
 * far side of the ring. 1.8 keeps a 24px label clear at every angle.
 */
const LABEL_MIN_GAP = 1.8;

export function buildLabelLifts(appPositions) {
  const lifts = new Map();
  const byStage = new Map();

  for (const app of APPS) {
    if (!byStage.has(app.stage)) byStage.set(app.stage, []);
    byStage.get(app.stage).push(app);
  }

  for (const group of byStage.values()) {
    const ordered = group
      .map((app) => ({ app, y: appPositions.get(app.id)?.y ?? 0 }))
      .sort((a, b) => a.y - b.y);

    let previousLabelY = -Infinity;
    for (const { app, y } of ordered) {
      const labelY = Math.max(y, previousLabelY + LABEL_MIN_GAP);
      lifts.set(app.id, labelY - y);
      previousLabelY = labelY;
    }
  }

  return lifts;
}

export { stageTurn, flowHeight };
