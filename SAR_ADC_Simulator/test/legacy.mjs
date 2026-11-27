// The values of the audits (Nov 2026, before the review of 18 Nov): alpha 0.40, C M 112 fF,
// read slots calibrated, no extra cell charge, settling and decision margin that do not bind.
// Tests that check audited numbers use these, so the audited physics stays checked
// while the workbench starts from the owner's decisions (alpha 1, C M 280 fF, w design).
import { createValues } from '../src/workbench/values.js';

export const LEGACY = { capCdac: 'MIM', alpha: 0.4, cm: 112, slotCal: 'calibrated', cellQ: 0, nTau: 10, decMargin: 0, gainMargin: 0 };

export function legacyValues() {
  const v = createValues();
  for (const [id, x] of Object.entries(LEGACY)) v.find((q) => q.id === id).value = x;
  return v;
}
