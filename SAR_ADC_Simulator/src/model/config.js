/**
 * Simulator configuration. All values in SI units (V, F, s, K).
 * Every non-ideality is a separate block with an `enabled` flag so that the
 * ideal model is always one switch away; `ideal: true` disables all of them.
 */
export const DEFAULT_CONFIG = Object.freeze({
  scheme: 'conventional',
  bits: 8,
  unitCap: 5e-15,
  vref: 1.0,
  vcm: 0.5, // top-plate reset / comparator reference (conventional), switching level (VCM-based)
  vinCM: 0.5, // input common mode (differential schemes)
  vin: 0.3, // single-ended: absolute input; differential: Vin+ - Vin-
  ideal: false,
  nonIdeal: {
    mismatch: { enabled: false, sigmaUnit: 0.005, seed: 1 },
    topParasitic: { enabled: false, cap: 50e-15 },
    bottomParasitic: { enabled: false, ratio: 0.05 },
    comparatorOffset: { enabled: false, offset: 2e-3, cmCoefficient: 0 },
    comparatorNoise: { enabled: false, rms: 0.3e-3 },
    referenceError: { enabled: false, relative: 0.002 },
    samplingNoise: { enabled: false, kTC: true, temperature: 300, extraRms: 0 },
    jitter: { enabled: false, rms: 2e-12 },
  },
  timing: { tSample: 20e-9, tBit: 5e-9 },
  /** Optional explicit per-capacitor relative errors [[P...],[N...]] (overrides mismatch draw). */
  capErrorOverride: null,
});

function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function deepMerge(base, patch) {
  if (!isObject(patch)) return patch === undefined ? base : patch;
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = isObject(v) && isObject(base?.[k]) ? deepMerge(base[k], v) : v;
  }
  return out;
}

export function cloneConfig(cfg) {
  return JSON.parse(JSON.stringify(cfg));
}

export function normalizeConfig(cfg = {}) {
  const c = deepMerge(cloneConfig(DEFAULT_CONFIG), cfg);
  c.bits = Math.round(c.bits);
  if (!(c.bits >= 2 && c.bits <= 16)) throw new Error('Resolution must be 2–16 bits');
  if (!(c.unitCap > 0)) throw new Error('Unit capacitance must be positive');
  if (!(c.vref > 0)) throw new Error('Reference voltage must be positive');
  if (!(c.timing.tSample > 0 && c.timing.tBit > 0)) throw new Error('Timing must be positive');
  if (c.ideal) {
    for (const block of Object.values(c.nonIdeal)) block.enabled = false;
  }
  return c;
}

/** List of the non-idealities that are active in a normalized config. */
export function activeNonIdealities(c) {
  return Object.entries(c.nonIdeal)
    .filter(([, b]) => b.enabled)
    .map(([k]) => k);
}
