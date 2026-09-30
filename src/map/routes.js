import { EDGES } from '../data/flows.js';
import { APP_BY_ID } from '../data/apps.js';
import { METRIC, labelBox, totalWidth } from './layout.js';

/**
 * Octilinear routing: every segment is vertical, horizontal or exactly 45
 * degrees, with rounded corners. That constraint is what makes a transit map
 * readable - the eye follows a line it can predict.
 *
 * Routes are SEARCHED rather than drawn from a template. Each one is a
 * shortest path over a grid whose nodes are the only places a line may run,
 * with prices on the things that make a map lie or get hard to read. Links
 * are laid one at a time, and every route already on the map becomes part of
 * the terrain for the ones after it.
 */

const CORNER_RADIUS = 14;
// How close a line may come to a station it does not call at. Two grid steps:
// one step clears the dot, but a line hugging a station that closely still
// reads as calling at it.
const CLEARANCE = 2 * METRIC.grid + 1;
// A route's own stations only need the line kept off the dot itself - it is
// leaving or arriving there, and has to turn close by.
const OWN_CLEARANCE = METRIC.stationRadius + 7;
// Short run straight out of a station before a route changes direction.
const LEAD = 20;
// Straight run a route must end on. The arrowhead sits just outside the
// station and is 9px long; if the last corner is closer than this, the arrow
// lands on the curve and points somewhere the line is not going.
export const ARRIVAL = METRIC.stationRadius + 5 + 9 + CORNER_RADIUS + 2;
// Near a station two links both arrive at, or both leave, they may share
// track: that is what converging on the same place looks like. A link
// arriving and a link leaving never share, or the arrowhead lands on the
// line going the other way.
export const SHARED_APPROACH = ARRIVAL + 3 * METRIC.grid;
// How far a label's box is grown before a line counts as running under it.
const LABEL_MARGIN = 8;

/**
 * What a route pays, in pixels of extra length, for each thing it does.
 * Hard rules - calling at a station it does not serve, printing on top of
 * another line - are not priced; those edges are simply not in the graph.
 */
const PRICE = {
  bend45: 40,
  bend90: 120,
  // Per grid step spent underneath a label. High enough that a line goes a
  // long way round rather than hide a name, but still finite: a label boxed
  // in on every side must not make its tool unreachable.
  label: 300,
  crossing: 36,
  // Two diagonals one grid step apart are only 8.5px from each other, so
  // their casings merge and the pair reads as one thick line.
  crowding: 400,
  // Leaving a station heading away from where the route is going, or arriving
  // from beyond it, makes the line double back on itself sideways.
  wrongWay: 150,
  // Per step of track shared with another route into (or out of) the same
  // station. Allowed, but the second line vanishes under the first for that
  // stretch - arrow included - so a way in of its own is worth a detour.
  sharing: 50,
};

const G = METRIC.grid;
const NONE = [];
// Index order matters: neighbouring entries are 45 degrees apart.
const DIRECTIONS = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];
const STEP_LENGTH = DIRECTIONS.map(([dx, dy]) => Math.hypot(dx, dy) * G);
// For a diagonal, the direction of the other diagonal through the same cell.
const CROSSING_DIAGONAL = DIRECTIONS.map(([dx, dy]) =>
  DIRECTIONS.findIndex(([x, y]) => x === -dx && y === dy),
);

function turnCost(from, to) {
  const turn = Math.min(Math.abs(from - to), 8 - Math.abs(from - to));
  if (turn === 0) return 0;
  if (turn === 1) return PRICE.bend45;
  if (turn === 2) return PRICE.bend90;
  return Infinity; // an acute switchback is never drawn
}

function stepsFor(length, direction) {
  return Math.ceil(length / STEP_LENGTH[direction]);
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

function segmentHitsBox(a, b, box) {
  // Octilinear steps are one grid cell long, so their ends and middle are a
  // fine enough sample.
  for (const t of [0, 0.5, 1]) {
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) return true;
  }
  return false;
}

function popcount(mask) {
  let count = 0;
  for (let m = mask; m; m &= m - 1) count += 1;
  return count;
}

/**
 * A binary min-heap of (priority, value) pairs on typed arrays. The search
 * pushes hundreds of thousands of entries per map, and allocating a pair for
 * each one was most of the routing time.
 */
function createHeap() {
  let priorities = new Float64Array(1024);
  let values = new Int32Array(1024);
  let size = 0;

  const swap = (a, b) => {
    const p = priorities[a];
    priorities[a] = priorities[b];
    priorities[b] = p;
    const v = values[a];
    values[a] = values[b];
    values[b] = v;
  };

  return {
    get size() {
      return size;
    },
    push(priority, value) {
      if (size === priorities.length) {
        const grownPriorities = new Float64Array(size * 2);
        grownPriorities.set(priorities);
        priorities = grownPriorities;
        const grownValues = new Int32Array(size * 2);
        grownValues.set(values);
        values = grownValues;
      }
      priorities[size] = priority;
      values[size] = value;
      let i = size;
      size += 1;
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (priorities[parent] <= priorities[i]) break;
        swap(parent, i);
        i = parent;
      }
    },
    /** Removes the smallest entry; read it first with topPriority/topValue. */
    pop() {
      size -= 1;
      if (size === 0) return;
      priorities[0] = priorities[size];
      values[0] = values[size];
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let smallest = i;
        if (left < size && priorities[left] < priorities[smallest]) smallest = left;
        if (right < size && priorities[right] < priorities[smallest]) smallest = right;
        if (smallest === i) break;
        swap(smallest, i);
        i = smallest;
      }
    },
    topPriority: () => priorities[0],
    topValue: () => values[0],
  };
}

/**
 * The lattice routes run on, with what every step of it passes near already
 * worked out: which stations it would graze and which labels it would run
 * under. That never changes between links, so it is computed once.
 */
function createGrid(stations) {
  const ids = [...stations.keys()];
  const stationIndex = new Map(ids.map((id, index) => [id, index]));
  const boxes = ids.map((id) => {
    const station = stations.get(id);
    const box = labelBox(station.app, station);
    return {
      left: box.left - LABEL_MARGIN,
      right: box.right + LABEL_MARGIN,
      top: box.top - LABEL_MARGIN,
      bottom: box.bottom + LABEL_MARGIN,
    };
  });

  const xs = [...stations.values()].map((station) => station.x);
  const ys = [...stations.values()].map((station) => station.y);
  // Lines stay between the first lane's margin and the cycle-closing lane.
  const x0 = Math.min(...xs) - 5 * G;
  const x1 = Math.floor((returnLaneX() - 2 * G) / G) * G;
  const y0 = Math.min(...ys) - 4 * G;
  const y1 = Math.max(...ys) + 4 * G;
  const cols = Math.round((x1 - x0) / G) + 1;
  const rows = Math.round((y1 - y0) / G) + 1;

  const nodeAt = (col, row) =>
    col < 0 || row < 0 || col >= cols || row >= rows ? -1 : row * cols + col;
  const colOf = (node) => node % cols;
  const rowOf = (node) => Math.floor(node / cols);
  const point = (node) => ({ x: x0 + colOf(node) * G, y: y0 + rowOf(node) * G });
  const nodeOf = ({ x, y }) => nodeAt(Math.round((x - x0) / G), Math.round((y - y0) / G));
  const neighbour = (node, direction) =>
    nodeAt(colOf(node) + DIRECTIONS[direction][0], rowOf(node) + DIRECTIONS[direction][1]);

  // An undirected step is stored once, from whichever end points "forward".
  const edgeId = (node, direction) => {
    if (direction < 4) return node * 4 + direction;
    const other = neighbour(node, direction);
    return other < 0 ? -1 : other * 4 + (direction - 4);
  };

  const edgeCount = cols * rows * 4;
  const stationMask = new Int32Array(edgeCount);
  const dotMask = new Int32Array(edgeCount);
  const labelMask = new Int32Array(edgeCount);

  for (let node = 0; node < cols * rows; node += 1) {
    const a = point(node);
    for (let direction = 0; direction < 4; direction += 1) {
      const other = neighbour(node, direction);
      if (other < 0) continue;
      const b = point(other);
      const id = node * 4 + direction;
      ids.forEach((stationId, index) => {
        const station = stations.get(stationId);
        const distance = distanceToSegment(station.x, station.y, a, b);
        if (distance < CLEARANCE) stationMask[id] |= 1 << index;
        if (distance < OWN_CLEARANCE) dotMask[id] |= 1 << index;
        if (segmentHitsBox(a, b, boxes[index])) labelMask[id] |= 1 << index;
      });
    }
  }

  return {
    cols,
    rows,
    stationIndex,
    stationMask,
    dotMask,
    labelMask,
    point,
    nodeOf,
    neighbour,
    edgeId,
    colOf,
    rowOf,
    nodeAt,
  };
}

/**
 * What the routes laid so far have claimed. A step belongs to at most one
 * route, except near a station both routes serve.
 */
function createClaims(grid, stations) {
  // Indexed by edge id and node rather than keyed in a Map: these are read for
  // every step every search considers, and array reads are far cheaper.
  const edges = new Array(grid.cols * grid.rows * 4); // edge id -> owners
  const nodes = new Array(grid.cols * grid.rows); // node -> owners

  const add = (list, key, owner) => {
    if (!list[key]) list[key] = [];
    list[key].push(owner);
  };

  // True when this spot is in the approach to a station both links arrive
  // at, or the lead-out from one they both leave.
  const shared = (owner, ends, ...points) =>
    [0, 1].some(
      (end) =>
        owner.ends[end] === ends[end] &&
        points.every((p) => {
          const station = stations.get(ends[end]);
          return Math.hypot(p.x - station.x, p.y - station.y) <= SHARED_APPROACH;
        }),
    );

  return {
    claim(nodeList, ends, edge = null) {
      const owner = { ends, edge, nodes: [], edges: [] };
      for (let i = 0; i < nodeList.length; i += 1) {
        add(nodes, nodeList[i], owner);
        owner.nodes.push(nodeList[i]);
        if (i === 0) continue;
        const direction = directionBetween(grid, nodeList[i - 1], nodeList[i]);
        const id = grid.edgeId(nodeList[i - 1], direction);
        add(edges, id, owner);
        owner.edges.push(id);
      }
      return owner;
    },
    release(owner) {
      const drop = (list, key) => {
        const rest = (list[key] ?? []).filter((other) => other !== owner);
        list[key] = rest.length > 0 ? rest : undefined;
      };
      owner.nodes.forEach((node) => drop(nodes, node));
      owner.edges.forEach((id) => drop(edges, id));
    },
    /** The routes holding a step of this path - the ones actually in its way. */
    ownersAlong(nodeList) {
      const found = new Set();
      for (let i = 1; i < nodeList.length; i += 1) {
        const direction = directionBetween(grid, nodeList[i - 1], nodeList[i]);
        for (const owner of edges[grid.edgeId(nodeList[i - 1], direction)] ?? []) found.add(owner);
      }
      return found;
    },
    /** Infinity when the step is taken; otherwise what it costs to share its surroundings. */
    price(node, direction, next, ends) {
      // Most of the grid is empty, and this runs for every step the search
      // looks at, so nothing is computed until something is actually there.
      const onEdge = edges[grid.edgeId(node, direction)];
      const onNode = nodes[next];
      const diagonal = direction % 2 === 1;
      let across = null;
      let beside = null;
      if (diagonal) {
        const [dx, dy] = DIRECTIONS[direction];
        const col = grid.colOf(node);
        const row = grid.rowOf(node);
        // The other diagonal of the same cell: an X crossing with no shared node.
        const other = grid.nodeAt(col + dx, row);
        if (other >= 0) across = edges[grid.edgeId(other, CROSSING_DIAGONAL[direction])];
        // Parallel diagonals one column either side.
        for (const offset of [-1, 1]) {
          const side = grid.nodeAt(col + offset, row);
          const owners = side >= 0 ? edges[grid.edgeId(side, direction)] : undefined;
          if (owners) beside = beside ? beside.concat(owners) : owners;
        }
      }
      if (!onEdge && !onNode && !across && !beside) return 0;

      const a = grid.point(node);
      const b = grid.point(next);
      const foreign = (owners, ...points) =>
        (owners ?? []).some((owner) => !shared(owner, ends, ...points));

      if (foreign(onEdge, a, b)) return Infinity;
      let price = onEdge ? onEdge.length * PRICE.sharing : 0;
      if (foreign(onNode, b)) price += PRICE.crossing;
      if (foreign(across, a, b)) price += PRICE.crossing;
      if (beside) {
        for (const owner of beside) if (!shared(owner, ends, a, b)) price += PRICE.crowding;
      }
      return price;
    },
  };
}

function directionBetween(grid, a, b) {
  const dx = Math.sign(grid.colOf(b) - grid.colOf(a));
  const dy = Math.sign(grid.rowOf(b) - grid.rowOf(a));
  return DIRECTIONS.findIndex(([x, y]) => x === dx && y === dy);
}

/**
 * The cheapest route between two stations, or null when there is none.
 *
 * A route leaves on a straight LEAD and arrives on a straight ARRIVAL, in any
 * of the eight directions; between them it is an A* search over (node,
 * heading) so that bends can be priced.
 */
function searchRoute(grid, claims, stations, edge) {
  const from = stations.get(edge.from);
  const to = stations.get(edge.to);
  const ends = [edge.from, edge.to];
  const endMask = (1 << grid.stationIndex.get(edge.from)) | (1 << grid.stationIndex.get(edge.to));
  const start = grid.nodeOf(from);
  const goal = grid.nodeOf(to);
  if (start < 0 || goal < 0) return null;

  // Work moves down the page, so a forward route never climbs: a line that
  // rises before it falls reads as flowing the wrong way. A level link is free
  // to dip under its row and come back up.
  const fall = Math.sign(to.y - from.y);
  const allowed = DIRECTIONS.map(([, dy]) => fall === 0 || dy * fall >= 0);

  // Cost of one step, or Infinity. `allowEnds` lets the lead-out and the
  // arrival run start on their own stations; anywhere else a route may pass
  // near its own station but never across the dot.
  const stepCost = (node, direction, allowEnds) => {
    if (!allowed[direction]) return Infinity;
    const next = grid.neighbour(node, direction);
    if (next < 0) return Infinity;
    const id = grid.edgeId(node, direction);
    const grazes =
      (grid.stationMask[id] & ~endMask) || (!allowEnds && grid.dotMask[id] & endMask);
    if (grazes) return Infinity;
    const claimed = claims.price(node, direction, next, ends);
    if (claimed === Infinity) return Infinity;
    return STEP_LENGTH[direction] + claimed + popcount(grid.labelMask[id]) * PRICE.label;
  };

  const across = Math.sign(to.x - from.x);
  const wrongWay = (direction) =>
    across !== 0 && DIRECTIONS[direction][0] === -across ? PRICE.wrongWay : 0;

  const run = (node, direction, steps) => {
    const nodes = [node];
    let cost = 0;
    for (let i = 0; i < steps; i += 1) {
      const step = stepCost(nodes[nodes.length - 1], direction, true);
      if (step === Infinity) return null;
      cost += step;
      nodes.push(grid.neighbour(nodes[nodes.length - 1], direction));
    }
    return { nodes, cost };
  };

  // Where a route may enter the station, keyed by the node the run starts on.
  const arrivals = new Map();
  for (let direction = 0; direction < 8; direction += 1) {
    const steps = stepsFor(ARRIVAL, direction);
    const [dx, dy] = DIRECTIONS[direction];
    const entry = grid.nodeAt(grid.colOf(goal) - dx * steps, grid.rowOf(goal) - dy * steps);
    if (entry < 0) continue;
    const approach = run(entry, direction, steps);
    if (!approach) continue;
    approach.cost += wrongWay(direction);
    if (!arrivals.has(entry)) arrivals.set(entry, []);
    arrivals.get(entry).push({ direction, ...approach });
  }
  if (arrivals.size === 0) return null;
  // The same arrivals, indexed for the search's inner loop.
  const arrivalAt = [];
  for (const [entry, list] of arrivals) arrivalAt[entry] = list;

  const states = grid.cols * grid.rows * 8;
  const GOAL = states;
  const best = new Float64Array(states + 1).fill(Infinity);
  const previous = new Int32Array(states + 1).fill(-1);
  let goalArrival = null;
  const goalCol = grid.colOf(goal);
  const goalRow = grid.rowOf(goal);
  // Octile distance to the goal: the length of the shortest octilinear path,
  // which no route can beat, so the search stays exact.
  const heuristic = (node) => {
    const dx = Math.abs(grid.colOf(node) - goalCol) * G;
    const dy = Math.abs(grid.rowOf(node) - goalRow) * G;
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };

  const heap = createHeap();
  const leads = new Map();
  for (let direction = 0; direction < 8; direction += 1) {
    const lead = run(start, direction, stepsFor(LEAD, direction));
    if (!lead) continue;
    lead.cost += wrongWay(direction);
    const node = lead.nodes[lead.nodes.length - 1];
    const state = node * 8 + direction;
    if (lead.cost < best[state]) {
      best[state] = lead.cost;
      leads.set(state, lead);
      heap.push(lead.cost + heuristic(node), state);
    }
  }

  while (heap.size > 0) {
    const priority = heap.topPriority();
    const state = heap.topValue();
    heap.pop();
    if (state === GOAL) break;
    const cost = best[state];
    if (priority > cost + heuristic(Math.floor(state / 8)) + 1e-6) continue;

    const node = Math.floor(state / 8);
    const heading = state % 8;

    for (const arrival of arrivalAt[node] ?? NONE) {
      const total = cost + turnCost(heading, arrival.direction) + arrival.cost;
      if (total < best[GOAL]) {
        best[GOAL] = total;
        previous[GOAL] = state;
        goalArrival = arrival;
        heap.push(total, GOAL);
      }
    }

    for (let direction = 0; direction < 8; direction += 1) {
      const turn = turnCost(heading, direction);
      if (turn === Infinity) continue;
      const step = stepCost(node, direction, false);
      if (step === Infinity) continue;
      const next = grid.neighbour(node, direction);
      const nextState = next * 8 + direction;
      const total = cost + turn + step;
      if (total < best[nextState]) {
        best[nextState] = total;
        previous[nextState] = state;
        heap.push(total + heuristic(next), nextState);
      }
    }
  }

  // Two stations in line and close together have no room for a lead and an
  // arrival of their own; one straight run is both, and is the obvious drawing.
  const direct = straightRun(grid, start, goal, run);
  if (direct && direct.cost <= best[GOAL]) return direct;

  if (!goalArrival) return null;

  const middle = [];
  let state = previous[GOAL];
  while (previous[state] !== -1) {
    middle.push(Math.floor(state / 8));
    state = previous[state];
  }
  const lead = leads.get(state);
  middle.reverse();
  // `middle` starts one step after the lead's last node and ends on the node
  // the arrival run starts from.
  const nodes = [...lead.nodes, ...middle, ...goalArrival.nodes.slice(1)];
  return { nodes, cost: best[GOAL] };
}

function straightRun(grid, start, goal, run) {
  const dx = grid.colOf(goal) - grid.colOf(start);
  const dy = grid.rowOf(goal) - grid.rowOf(start);
  if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) return null;
  const direction = DIRECTIONS.findIndex(([x, y]) => x === Math.sign(dx) && y === Math.sign(dy));
  return run(start, direction, Math.max(Math.abs(dx), Math.abs(dy)));
}

/** Drops the points in the middle of straight runs, keeping only the turns. */
function corners(points) {
  return points.filter((point, index) => {
    if (index === 0 || index === points.length - 1) return true;
    const a = points[index - 1];
    const b = points[index + 1];
    return (point.x - a.x) * (b.y - point.y) - (point.y - a.y) * (b.x - point.x) !== 0;
  });
}

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

function returnLaneX() {
  return totalWidth() - METRIC.returnLaneGap / 2;
}

/**
 * Backward link: a tool feeding an earlier step. There is exactly one of these
 * in the model today - customer reviews re-entering product development - and
 * it is the link that makes the cycle a cycle, so it sweeps out to the right
 * margin where it can be seen closing the loop rather than cutting through.
 *
 * It drops below the station it leaves and comes down onto the one it reaches,
 * because running level out of a station or into one would take it under that
 * station's label.
 */
function returnPoints(from, to) {
  const x = returnLaneX();
  const below = from.y + 3 * G;
  // Two grid steps higher than any route may run, so it can never line up
  // with a route along the top of the map and read as the same line.
  const above = to.y - stepsFor(ARRIVAL, 2) * G - 2 * G;
  return [from, { x: from.x, y: below }, { x, y: below }, { x, y: above }, { x: to.x, y: above }, to];
}

/** The grid nodes a straight, grid-aligned polyline passes over. */
function nodesAlong(grid, points) {
  const nodes = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const steps = Math.floor(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / G);
    const sx = Math.sign(b.x - a.x);
    const sy = Math.sign(b.y - a.y);
    for (let s = 0; s <= steps; s += 1) {
      const node = grid.nodeOf({ x: a.x + sx * s * G, y: a.y + sy * s * G });
      if (node >= 0 && nodes[nodes.length - 1] !== node) nodes.push(node);
    }
  }
  return nodes;
}

/**
 * The orders links are tried in. Laying routes one at a time is greedy - the
 * first link through a tight spot takes the best way in, and a later one has
 * to go round - so no single order suits every map. Longest first gives long
 * links the few clean crossings they have; shortest first protects tools that
 * sit close together. Each is laid in full and the cheapest map is kept.
 */
function layingOrders(stations) {
  const span = (edge) => {
    const a = stations.get(edge.from);
    const b = stations.get(edge.to);
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  };
  const indexed = EDGES.map((edge, index) => ({ edge, index }));
  const bySpan = (sign) =>
    [...indexed].sort((a, b) => sign * (span(b.edge) - span(a.edge)) || a.index - b.index);
  return [bySpan(1), bySpan(-1), indexed, [...indexed].reverse()].map((order) =>
    order.map(({ edge }) => edge),
  );
}

// A link with no legal route at all costs more than any drawable map.
const UNROUTED_PRICE = 1e7;

function layLinks(stations, grid, order, ideals) {
  const claims = createClaims(grid, stations);
  const laid = new Map();

  // The return line is fixed, so it goes down first and everything else
  // treats it as terrain.
  for (const edge of EDGES) {
    const from = stations.get(edge.from);
    const to = stations.get(edge.to);
    if (!from || !to || to.y >= from.y) continue;
    const points = returnPoints(from, to);
    claims.claim(nodesAlong(grid, points), [edge.from, edge.to]);
    laid.set(edge, { points, isReturn: true, cost: 0 });
  }

  const lay = (edge) => {
    const found = searchRoute(grid, claims, stations, edge);
    const owner = found ? claims.claim(found.nodes, [edge.from, edge.to], edge) : null;
    laid.set(edge, {
      // No legal route at all is a layout problem, not something to hide: draw
      // it straight so the map check reports exactly what it runs through.
      points: found ? corners(found.nodes.map(grid.point)) : [stations.get(edge.from), stations.get(edge.to)],
      isReturn: false,
      unrouted: !found,
      cost: found ? found.cost : UNROUTED_PRICE,
      owner,
    });
  };

  for (const edge of order) {
    if (laid.has(edge) || !stations.get(edge.from) || !stations.get(edge.to)) continue;
    lay(edge);
  }

  improve(stations, claims, laid, lay, ideals);

  let total = 0;
  for (const { cost } of laid.values()) total += cost;
  return { laid, total };
}

// A route this much dearer than it would be on an empty map is worth trying
// to free.
const DETOUR_WORTH_FIXING = 60;

/**
 * Undoes the worst of the greedy laying.
 *
 * For each route that had to go well out of its way, the routes sitting on its
 * ideal path are lifted, the detoured route is laid first this time, and the
 * lifted ones are laid again after it. The change is kept only when the whole
 * group comes out cheaper.
 */
function improve(stations, claims, laid, lay, ideals) {
  const detours = [];
  for (const [edge, entry] of laid) {
    if (entry.isReturn || entry.unrouted) continue;
    const ideal = ideals.get(edge);
    if (ideal && entry.cost - ideal.cost > DETOUR_WORTH_FIXING) {
      detours.push({ edge, excess: entry.cost - ideal.cost, ideal });
    }
  }
  detours.sort((a, b) => b.excess - a.excess);

  const span = (edge) => {
    const a = stations.get(edge.from);
    const b = stations.get(edge.to);
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  };

  for (const { edge, ideal } of detours) {
    const blockers = [...claims.ownersAlong(ideal.nodes)]
      .map((owner) => owner.edge)
      .filter((other) => other && other !== edge);
    if (blockers.length === 0) continue;

    const group = [edge, ...new Set(blockers)];
    const before = group.map((member) => [member, laid.get(member)]);
    const cost = (entries) => entries.reduce((sum, [, entry]) => sum + entry.cost, 0);

    for (const [, entry] of before) if (entry.owner) claims.release(entry.owner);
    lay(edge);
    [...group.slice(1)].sort((a, b) => span(b) - span(a)).forEach(lay);
    const after = group.map((member) => [member, laid.get(member)]);

    if (cost(after) >= cost(before)) {
      for (const [, entry] of after) if (entry.owner) claims.release(entry.owner);
      for (const [member, entry] of before) {
        laid.set(member, entry);
        if (entry.owner) entry.owner = claims.claim(entry.owner.nodes, entry.owner.ends, member);
      }
    }
  }
}

export function buildLinks(stations) {
  const grid = createGrid(stations);
  // Each link's route on an empty map: the yardstick for how far out of its
  // way the laid route went. It does not depend on the order, so it is found once.
  const empty = createClaims(grid, stations);
  const ideals = new Map(
    EDGES.filter((edge) => stations.get(edge.from) && stations.get(edge.to)).map((edge) => [
      edge,
      searchRoute(grid, empty, stations, edge),
    ]),
  );
  const { laid } = layingOrders(stations)
    .map((order) => layLinks(stations, grid, order, ideals))
    .reduce((best, attempt) => (attempt.total < best.total ? attempt : best));

  return EDGES.filter((edge) => laid.has(edge)).map((edge) => {
    const { points, isReturn, unrouted } = laid.get(edge);
    return {
      ...edge,
      points,
      path: roundedPath(points),
      isReturn,
      unrouted: Boolean(unrouted),
      ghost:
        APP_BY_ID[edge.from]?.status === 'planned' ||
        APP_BY_ID[edge.to]?.status === 'planned',
      end: points[points.length - 1],
      approach: points[points.length - 2],
    };
  });
}

export { roundedPath };
