/**
 * Single source of truth for the palette.
 *
 * Every value is published twice: as a hex string the map draws with, and as a
 * CSS custom property the chrome styles with, so the two can never drift apart.
 */

export const FLOW_COLORS = {
  material: '#ff8a3d',
  money: '#7be495',
  information: '#38bdf8',
  people: '#b39bff',
};

export const UI_COLORS = {
  background: '#05070d',
  surface: '#0c1120',
  surfaceRaised: '#141c31',
  border: '#22304f',
  text: '#e8eefc',
  textMuted: '#8fa0c4',
  accent: '#e8eefc',
  planned: '#5a6b91',
};

/** Converts a hex string to `r, g, b` so CSS can build rgba() from it. */
export function hexToRgbChannels(hex) {
  const value = hex.replace('#', '');
  const int = parseInt(
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value,
    16,
  );
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255].join(', ');
}

/** Publishes the palette to :root so stylesheets can consume the same values. */
export function publishCssVariables(root = document.documentElement) {
  for (const [key, hex] of Object.entries(FLOW_COLORS)) {
    root.style.setProperty(`--flow-${key}`, hex);
    root.style.setProperty(`--flow-${key}-rgb`, hexToRgbChannels(hex));
  }
  for (const [key, hex] of Object.entries(UI_COLORS)) {
    const name = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    root.style.setProperty(`--ui-${name}`, hex);
    root.style.setProperty(`--ui-${name}-rgb`, hexToRgbChannels(hex));
  }
}
