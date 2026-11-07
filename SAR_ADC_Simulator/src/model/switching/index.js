import { conventionalSE, conventionalDiff } from './conventional.js';
import { monotonic } from './monotonic.js';
import { vcmBased } from './vcmBased.js';

export const SCHEMES = Object.freeze({
  [conventionalSE.id]: conventionalSE,
  [conventionalDiff.id]: conventionalDiff,
  [monotonic.id]: monotonic,
  [vcmBased.id]: vcmBased,
});

export const SCHEME_LIST = Object.freeze(Object.values(SCHEMES));

export function getScheme(id) {
  const s = SCHEMES[id];
  if (!s) throw new Error(`Unknown switching scheme "${id}"`);
  return s;
}
