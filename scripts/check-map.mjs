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
const { buildLinks } = await import(pathToFileURL(join(dir, 'routes.js')));

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

  if (link.path.includes('NaN')) problems.push(`${link.from} -> ${link.to}: path contains NaN`);
}

console.log(`${links.length} links, ${stations.size} stations`);

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):`);
  for (const problem of problems) console.error('  ' + problem);
  process.exit(1);
}

console.log('No line calls at a station it does not serve.');
