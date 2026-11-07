/**
 * Seeded pseudo-random number generator (mulberry32) with a Box–Muller
 * Gaussian source. Every stochastic effect in the simulator (mismatch draw,
 * kT/C noise, comparator noise, jitter) goes through an explicit RNG so that
 * any result can be reproduced exactly from its seed.
 */
export function createRng(seed = 1) {
  let state = (seed >>> 0) || 0x9e3779b9;
  let spare = null;

  function uniform() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function gaussian() {
    if (spare !== null) {
      const v = spare;
      spare = null;
      return v;
    }
    let u = 0;
    while (u === 0) u = uniform();
    const v = uniform();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  }

  return { uniform, gaussian };
}
