// Source level per block (addendum 8.2). Imported levels stay unavailable
// until a CSV import exists for that block (phase 3).

export const BLOCKS = ['CDAC', 'Reference', 'Comparator', 'Sampling switch', 'SAR logic'];

export const LEVELS = [
  { id: 'ideal', label: 'Ideal', needsImport: false },
  { id: 'hand', label: 'Hand calculation', needsImport: false },
  { id: 'schematic', label: 'Schematic simulation', needsImport: true },
  { id: 'postlayout', label: 'Post-layout extraction', needsImport: true },
];

export function defaultLevels() {
  return Object.fromEntries(BLOCKS.map((b) => [b, 'hand']));
}

/** A block contributes its budget lines unless it is set to ideal. */
export function blockIncluded(levels, block) {
  return levels[block] !== 'ideal';
}
