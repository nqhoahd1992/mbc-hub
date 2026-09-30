import { EDGES } from '../data/flows.js';
import { APP_BY_ID } from '../data/apps.js';
import { METRIC, totalWidth } from './layout.js';

/**
 * Octilinear routing: every segment is vertical, horizontal or exactly 45
 * degrees, with rounded corners. That constraint is what makes a transit map
 * readable - the eye follows a line it can predict.
 */

const CORNER_RADIUS = 14;
// How close a line may come to a station it does not call at.
const CLEARANCE = METRIC.stationRadius + 7;
// Short run straight out of a station before a route changes direction.
const LEAD = 20;
// How far below a row a level link drops to get past the stations on it.
const HORIZONTAL_GUTTER = 28;

/**
 * Rounds the corners of a polyline by trimming each turn into a quadratic.
 *
 * Consecutive duplicate points are dropped first. Two stations level with each
 * other produce a turn of zero length, and a zero-length leg divides by zero and
 * poisons the whole path with NaN.
 */
function roundedPath(input, radius = CORNER_RADIUS) {
  const points = input.filter(
    (point, index) =>
      index === 0 ||
      Math.abs(point.x - input[index - 1].x) > 0.01 ||
      Math.abs(point.y - input[index - 1].y) > 0.01,
  );

  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length - 1; i += 1) {
    const previous = points[i - 1];
    const corner = points[i];
    const next = points[i + 1];

    const inLength = Math.hypot(corner.x - previous.x, corner.y - previous.y);
    const outLength = Math.hypot(next.x - corner.x, next.y - corner.y);
    // Never eat more than half of either leg, or short segments invert.
    const r = Math.min(radius, inLength / 2, outLength / 2);
    if (!Number.isFinite(r) || r <= 0) {
      d += ` L ${corner.x.toFixed(1)} ${corner.y.toFixed(1)}`;
      continue;
    }

    const enter = {
      x: corner.x - ((corner.x - previous.x) / inLength) * r,
      y: corner.y - ((corner.y - previous.y) / inLength) * r,
    };
    const leave = {
      x: corner.x + ((next.x - corner.x) / outLength) * r,
      y: corner.y + ((next.y - corner.y) / outLength) * r,
    };

    d += ` L ${enter.x.toFixed(1)} ${enter.y.toFixed(1)}`;
    d += ` Q ${corner.x.toFixed(1)} ${corner.y.toFixed(1)} ${leave.x.toFixed(1)} ${leave.y.toFixed(1)}`;
  }

  const end = points[points.length - 1];
  return `${d} L ${end.x} ${end.y}`;
}

/** Forward link: down the page, changing lane with a single 45 degree run. */
function forwardPoints(from, to, nudge) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (dx === 0) return [from, to];

  const horizontal = Math.abs(dx);
  const vertical = Math.abs(dy);
  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy) || 1;

  if (vertical >= horizontal) {
    // Room to travel vertically: straight down, diagonal across, straight down.
    const slack = (vertical - horizontal) / 2 + nudge;
    const turn1 = { x: from.x, y: from.y + stepY * slack };
    const turn2 = { x: to.x, y: turn1.y + stepY * horizontal };
    return [from, turn1, turn2, to];
  }

  // Wider than it is tall: run across, cut the diagonal, run across again.
  const slack = (horizontal - vertical) / 2 + nudge;
  const turn1 = { x: from.x + stepX * slack, y: from.y };
  const turn2 = { x: turn1.x + stepX * vertical, y: to.y };
  return [from, turn1, turn2, to];
}

/** Distance from a point to a line segment. */
function distanceToSegment(px, py, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lengthSquared));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

/**
 * True when a route grazes a station it has nothing to do with.
 *
 * This matters more than it looks: a line passing through a station reads as
 * calling at it. A map that does that is asserting relationships that are not
 * in the data, which is exactly the thing this map exists to get right.
 */
function passesThroughStation(points, stations, edge) {
  for (const [id, station] of stations) {
    if (id === edge.from || id === edge.to) continue;
    for (let i = 0; i < points.length - 1; i += 1) {
      if (distanceToSegment(station.x, station.y, points[i], points[i + 1]) < CLEARANCE) {
        return true;
      }
    }
  }
  return false;
}

/**
 * The detour taken when the direct route would call at a station it should not.
 *
 * The trick is to spend the long part of the journey in a GUTTER - the empty
 * corridor between two lanes - instead of running down a lane where stations
 * live. The line steps out of its station, crosses to the gutter, runs, then
 * crosses back in.
 */
function gutterPoints(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);

  // Level with each other: drop below the row and run underneath.
  if (stepY === 0) {
    const below = from.y + HORIZONTAL_GUTTER;
    return [from, { x: from.x, y: below }, { x: to.x, y: below }, to];
  }

  // Same lane: bow out to the side of it and back.
  if (stepX === 0) {
    const gutter = from.x + METRIC.laneWidth * 0.25;
    const run = Math.abs(gutter - from.x);
    return [
      from,
      { x: from.x, y: from.y + stepY * LEAD },
      { x: gutter, y: from.y + stepY * (LEAD + run) },
      { x: gutter, y: to.y - stepY * (LEAD + run) },
      { x: to.x, y: to.y - stepY * LEAD },
      to,
    ];
  }

  const gutter = from.x + stepX * (METRIC.laneWidth / 2);
  const outRun = Math.abs(gutter - from.x);
  const inRun = Math.abs(to.x - gutter);

  const leaveStation = { x: from.x, y: from.y + stepY * LEAD };
  const enterGutter = { x: gutter, y: leaveStation.y + stepY * outRun };
  const enterStation = { x: to.x, y: to.y - stepY * LEAD };
  const leaveGutter = { x: gutter, y: enterStation.y - stepY * inRun };

  // Not enough height for the two diagonals plus the leads - keep it simple.
  if (stepY * (leaveGutter.y - enterGutter.y) < 0) return null;

  return [from, leaveStation, enterGutter, leaveGutter, enterStation, to];
}

/**
 * Backward link: a tool feeding an earlier step. There is exactly one of these
 * in the model today - customer reviews re-entering product development - and
 * it is the link that makes the cycle a cycle, so it sweeps out to the right
 * margin where it can be seen closing the loop rather than cutting through.
 */
function returnPoints(from, to) {
  const x = totalWidth() - METRIC.returnLaneGap / 2;
  return [
    from,
    { x, y: from.y },
    { x, y: to.y },
    to,
  ];
}

export function buildLinks(stations) {
  const perPair = new Map();

  return EDGES.flatMap((edge) => {
    const from = stations.get(edge.from);
    const to = stations.get(edge.to);
    if (!from || !to) return [];

    // Separate links that share a corridor so they do not print on top of
    // each other.
    const key = `${Math.min(from.y, to.y)}:${Math.max(from.y, to.y)}`;
    const repeat = perPair.get(key) ?? 0;
    perPair.set(key, repeat + 1);
    const nudge = repeat * 11;

    const isReturn = to.y < from.y;
    let points = isReturn ? returnPoints(from, to) : forwardPoints(from, to, nudge);

    // Take the direct route unless it would call at somebody else's station.
    if (!isReturn && passesThroughStation(points, stations, edge)) {
      points = gutterPoints(from, to) ?? points;
    }

    return [
      {
        ...edge,
        points,
        path: roundedPath(points),
        isReturn,
        ghost:
          APP_BY_ID[edge.from]?.status === 'planned' ||
          APP_BY_ID[edge.to]?.status === 'planned',
        end: points[points.length - 1],
        approach: points[points.length - 2],
      },
    ];
  });
}

export { roundedPath };
