/** Capability and performance probes. Everything the scene degrades on is decided here. */

export function supportsWebGL2() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * A coarse tier used to pick particle counts and whether bloom runs at all.
 * Device memory and core count are the only signals available before the first
 * frame; the render loop downgrades further if frames actually come in slow.
 */
export function detectPerformanceTier() {
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = navigator.deviceMemory ?? 4;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;

  if (coarsePointer || cores <= 4 || memory <= 4) return 'low';
  if (cores <= 8 || memory <= 8) return 'medium';
  return 'high';
}

export const TIER_SETTINGS = {
  low: { particlesPerLink: 14, bloom: false, maxPixelRatio: 1.25, antialias: false },
  medium: { particlesPerLink: 26, bloom: true, maxPixelRatio: 1.5, antialias: true },
  high: { particlesPerLink: 42, bloom: true, maxPixelRatio: 2, antialias: true },
};

export function settingsForTier(tier) {
  return TIER_SETTINGS[tier] ?? TIER_SETTINGS.medium;
}
