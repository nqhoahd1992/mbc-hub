/**
 * Asserts the map does not tell lies.
 *
 * A line that passes through a station reads as calling at it, so a route
 * grazing a tool it has nothing to do with asserts a relationship that is not in
 * the data. That is the one failure this map cannot afford, and it is invisible
 * in code review - it only shows up in geometry. Run this after adding a tool
 * or a link.
 */
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const dir = join(process.cwd(), 'src', 'map');
const { buildRows, buildStations, METRIC } = await import(pathToFileURL(join(dir, 'layout.js')));
const { buildLinks, ARRIVAL, SHARED_APPROACH } = await import(pathToFileURL(join(dir, 'routes.js')));

const CLEARANCE = METRIC.stationRadius + 6;

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

const rows = buildRows();
const stations = buildStations(rows);
const links = buildLinks(stations);

const problems = [];

for (const link of links) {
  if (link.unrouted) {
    problems.push(`${link.from} -> ${link.to}: no legal route exists, drawn straight instead`);
  }
  if (!link.points) {
    problems.push(`${link.from} -> ${link.to}: no points, cannot be checked`);
    continue;
  }
  for (const [id, station] of stations) {
    if (id === link.from || id === link.to) continue;
    for (let i = 0; i < link.points.length - 1; i += 1) {
      const d = distanceToSegment(station.x, station.y, link.points[i], link.points[i + 1]);
      if (d < CLEARANCE) {
        problems.push(
          `${link.from} -> ${link.to} passes through ${id} (${d.toFixed(1)}px, needs ${CLEARANCE})`,
        );
        break;
      }
    }
  }

  // The arrowhead is drawn along the last leg; if that leg is shorter than the
  // arrow plus a corner, the arrow sits on the bend and points off the line.
  const lastLeg = Math.hypot(link.end.x - link.approach.x, link.end.y - link.approach.y);
  if (lastLeg < ARRIVAL) {
    problems.push(
      `${link.from} -> ${link.to}: last leg ${lastLeg.toFixed(1)}px, arrow needs ${ARRIVAL}`,
    );
  }

  // A forward link only ever moves down the page. A leg that climbs back up
  // folds the line over itself into a kink.
  if (!link.isReturn) {
    const stepY = Math.sign(link.end.y - link.points[0].y);
    for (let i = 0; i < link.points.length - 1; i += 1) {
      if (stepY * (link.points[i + 1].y - link.points[i].y) < 0) {
        problems.push(`${link.from} -> ${link.to}: doubles back on itself at leg ${i + 1}`);
        break;
      }
    }
  }

  if (link.path.includes('NaN')) problems.push(`${link.from} -> ${link.to}: path contains NaN`);
}

/**
 * Two links drawn along the same stretch read as one, and the second one
 * silently vanishes from the map. Converging on a station is fine - that is
 * what arriving at the same place looks like - so overlap is only allowed close
 * to a station both links arrive at, or both leave.
 */

function overlap(a1, a2, b1, b2) {
  const length = Math.hypot(a2.x - a1.x, a2.y - a1.y);
  if (length < 0.01) return null;
  const ux = (a2.x - a1.x) / length;
  const uy = (a2.y - a1.y) / length;
  // Both ends of b must sit on a's line.
  const off = (p) => Math.abs((p.x - a1.x) * uy - (p.y - a1.y) * ux);
  if (off(b1) > 1 || off(b2) > 1) return null;
  const along = (p) => (p.x - a1.x) * ux + (p.y - a1.y) * uy;
  const start = Math.max(0, Math.min(along(b1), along(b2)));
  const end = Math.min(length, Math.max(along(b1), along(b2)));
  if (end - start < 1) return null;
  const at = (t) => ({ x: a1.x + ux * t, y: a1.y + uy * t });
  return [at(start), at(end)];
}

function nearSharedStation(point, a, b) {
  const shared = [a.from === b.from && a.from, a.to === b.to && a.to].filter(Boolean);
  return shared.some((id) => {
    const station = stations.get(id);
    return Math.hypot(point.x - station.x, point.y - station.y) <= SHARED_APPROACH;
  });
}

for (let i = 0; i < links.length; i += 1) {
  for (let j = i + 1; j < links.length; j += 1) {
    const a = links[i];
    const b = links[j];
    let found = false;
    for (let s = 0; s < a.points.length - 1 && !found; s += 1) {
      for (let t = 0; t < b.points.length - 1 && !found; t += 1) {
        const shared = overlap(a.points[s], a.points[s + 1], b.points[t], b.points[t + 1]);
        if (!shared) continue;
        if (shared.every((point) => nearSharedStation(point, a, b))) continue;
        problems.push(`${a.from} -> ${a.to} and ${b.from} -> ${b.to} are drawn on top of each other`);
        found = true;
      }
    }
  }
}

console.log(`${links.length} links, ${stations.size} stations`);

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):`);
  for (const problem of problems) console.error('  ' + problem);
  process.exit(1);
}

console.log('No line calls at a station it does not serve, and no two lines share a stretch.');
