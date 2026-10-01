/**
 * Axis 3 of the company model: where a record is born.
 *
 * The map's two axes say what a tool moves and where in the cycle it does it.
 * Neither answers the question every integration eventually turns on: when two
 * tools both show the same raw material, which of them is allowed to change it?
 *
 * So a record has exactly ONE owner - the tool it is created, changed and
 * withdrawn in - and any number of copies, which are fed from the owner and
 * never the other way round. That asymmetry is the whole point: a copy that can
 * be edited is not a copy, it is a second owner, and two owners is how the same
 * material ends up with two different names.
 *
 *   label    what the record is called, short enough to print on a station
 *   owner    the app id it is born in
 *   copies   app ids that hold it but may not change it
 *   note     the scope, when the name alone does not fix it
 *
 * Only records the registry can back up belong here. A record nobody owns yet
 * is left out rather than guessed at - an empty answer is better than a wrong
 * one, because this list is what somebody will trust when they wire two tools
 * together.
 */
export const MASTERS = [
  {
    id: 'sku',
    label: 'SKU',
    owner: 'product-app',
    copies: [],
    note: 'Every SKU the company sells, under change control.',
  },
  {
    id: 'raw-material',
    label: 'Raw material',
    owner: 'raw-material',
    copies: ['cosmetri'],
    note: 'Created, changed and withdrawn under change control in the RM app; Cosmetri is fed from it afterwards.',
  },
  {
    id: 'rm-supplier',
    label: 'RM supplier',
    owner: 'raw-material',
    copies: [],
    note: 'The suppliers the raw materials come from.',
  },
  {
    id: 'packaging-material',
    label: 'Packaging material',
    owner: 'packaging',
    copies: [],
    note: 'The packaging a product is made up of, under change control.',
  },
  {
    id: 'packaging-supplier',
    label: 'PK supplier',
    owner: 'packaging',
    copies: [],
    note: 'The suppliers the packaging comes from.',
  },
  {
    id: 'supplier',
    label: 'Supplier',
    owner: 'procurement',
    copies: [],
    note: 'Everyone the company buys from other than the raw material and packaging suppliers.',
  },
];

/**
 * What part a tool plays in master data, or null when it plays none.
 *
 * A tool that owns a record and also holds a copy of another would read as the
 * owner: owning is the stronger claim, and it is the one that decides who may
 * change what. No tool does both today.
 */
export function masterRoleFor(appId) {
  const owned = MASTERS.filter((record) => record.owner === appId);
  if (owned.length > 0) return { role: 'owner', records: owned };
  const copied = MASTERS.filter((record) => record.copies.includes(appId));
  if (copied.length > 0) return { role: 'copy', records: copied };
  return null;
}

/** The one line a station prints in master data mode. */
export function masterLineFor(appId) {
  const found = masterRoleFor(appId);
  if (!found) return '';
  const names = found.records.map((record) => record.label).join(' · ');
  return found.role === 'owner' ? `Owns ${names}` : `Copy of ${names}`;
}

/** True when this link is a record being fed from its owner to a copy. */
export function linkFeedsACopy(link) {
  return MASTERS.some(
    (record) => record.owner === link.from && record.copies.includes(link.to),
  );
}

export const MASTER_APP_IDS = new Set(
  MASTERS.flatMap((record) => [record.owner, ...record.copies]),
);
