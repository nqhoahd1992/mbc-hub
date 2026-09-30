import { CubicBezierCurve3, EllipseCurve, Vector3 } from 'three';

export const TAU = Math.PI * 2;

/** Converts a position around a ring (0..1) to a point in the XZ plane. */
export function pointOnRing(turn, radius, y = 0, target = new Vector3()) {
  const angle = turn * TAU;
  return target.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
}

/** Flat ring geometry source, used for the stage arcs. */
export function ringArcPoints(radius, startTurn, endTurn, segments = 96, y = 0) {
  const curve = new EllipseCurve(0, 0, radius, radius, startTurn * TAU, endTurn * TAU, false, 0);
  return curve.getPoints(segments).map((p) => new Vector3(p.x, y, p.y));
}

/**
 * The link curve used by every flow stream.
 *
 * Control points are pushed away from the world centre by `bow` so links arc
 * over the ring instead of cutting through the core, and lifted by `lift` so
 * two links between the same pair of stages never overlap.
 */
export function linkCurve(from, to, { bow = 0.35, lift = 0 } = {}) {
  const a = from.clone();
  const b = to.clone();
  const chord = a.distanceTo(b);

  const c1 = a.clone().lerp(b, 0.28);
  const c2 = a.clone().lerp(b, 0.72);

  const outwardA = new Vector3(a.x, 0, a.z);
  const outwardB = new Vector3(b.x, 0, b.z);
  if (outwardA.lengthSq() > 1e-6) outwardA.normalize();
  if (outwardB.lengthSq() > 1e-6) outwardB.normalize();

  c1.addScaledVector(outwardA, chord * bow);
  c2.addScaledVector(outwardB, chord * bow);
  c1.y += lift;
  c2.y += lift;

  return new CubicBezierCurve3(a, c1, c2, b);
}

/** Resamples a curve into a flat Float32Array of xyz triples. */
export function sampleCurve(curve, samples) {
  const data = new Float32Array(samples * 3);
  const point = new Vector3();
  for (let i = 0; i < samples; i += 1) {
    curve.getPointAt(i / (samples - 1), point);
    data[i * 3] = point.x;
    data[i * 3 + 1] = point.y;
    data[i * 3 + 2] = point.z;
  }
  return data;
}
