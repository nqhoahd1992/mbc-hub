/**
 * Axis 1 of the company model: where a tool sits in the manufacturing cycle.
 *
 * The ring is closed on purpose - what a factory learns at `listen` re-enters at
 * `develop`. Angles are in turns (0..1) and are converted to radians by the scene.
 *
 * Keep each description to one line: it is read in the HUD's cycle panel, which
 * is the thing that tells a first-time visitor what the ring actually means.
 */
export const STAGES = [
  {
    id: 'develop',
    label: 'Develop',
    turn: 0,
    description: 'Deciding what to make, and starting it as a project.',
  },
  {
    id: 'source',
    label: 'Source',
    turn: 1 / 6,
    description: 'Finding, approving and buying what it is made of.',
  },
  {
    id: 'produce',
    label: 'Produce',
    turn: 2 / 6,
    description: 'Manufacturing and quality control.',
  },
  {
    id: 'distribute',
    label: 'Distribute',
    turn: 3 / 6,
    description: 'Getting finished stock to the channels that sell it.',
  },
  {
    id: 'sell',
    label: 'Sell',
    turn: 4 / 6,
    description: 'Listing, advertising and reporting what customers buy.',
  },
  {
    id: 'listen',
    label: 'Listen',
    turn: 5 / 6,
    description: 'Reading back what the market said.',
  },
];

export const STAGE_BY_ID = Object.fromEntries(STAGES.map((stage) => [stage.id, stage]));

/**
 * The bands below the ring: rows that are not steps of the cycle.
 *
 * There are two, because "not a step" covers two different things and one band
 * had to call them the same thing. An OCR service another tool calls to read an
 * invoice is not the same kind of thing as the finance system of the company,
 * and putting them under one name either flatters the service or belittles the
 * system. Each band is named for what its tools ARE, never for how much they
 * matter - this map does not rank its tools.
 */
export const BANDS = [
  {
    id: 'company',
    label: 'Company Systems',
    description: 'Run for the whole company rather than for one step of the cycle.',
  },
  {
    id: 'shared',
    label: 'Shared Tools',
    description: 'Called by another tool to do one job, rather than owned by a step.',
  },
];

export const BAND_BY_ID = Object.fromEntries(BANDS.map((band) => [band.id, band]));

/** Every row a tool can sit in: the six steps, then the bands. */
export const ROWS = [...STAGES, ...BANDS];

/** What to call the row a tool sits in, whether that is a step or a band. */
export function rowLabel(stageId) {
  return STAGE_BY_ID[stageId]?.label ?? BAND_BY_ID[stageId]?.label ?? stageId;
}
