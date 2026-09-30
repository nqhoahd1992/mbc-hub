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

/** Cross-cutting tools do not live on the ring - they thread through every stage. */
export const BACKBONE = {
  id: 'backbone',
  label: 'Backbone',
  description: 'Serves every stage of the cycle rather than sitting inside one.',
};
