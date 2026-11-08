// Delay-and-sum beamformer of one tile (review chapter 2). Closed form, narrowband at f0.

/** Element positions, centred on the tile: x_n = (n - (N-1)/2) p. */
export function elementX(N, pitch) {
  return Array.from({ length: N }, (_, n) => (n - (N - 1) / 2) * pitch);
}

/** Path length from a point at range F and angle theta to each element. */
function paths(xs, F, theta) {
  const px = F * Math.sin(theta);
  const pz = F * Math.cos(theta);
  return xs.map((x) => Math.hypot(x - px, pz));
}

/**
 * Receive delays for steering theta and focus F (F = Infinity: plane wave).
 * tau_n = (r_max - r_n) / c, so the furthest element waits 0 and the others wait longer.
 */
export function receiveDelays({ N, pitch, theta, F, c }) {
  const xs = elementX(N, pitch);
  let r;
  if (!Number.isFinite(F)) r = xs.map((x) => -x * Math.sin(theta));
  else r = paths(xs, F, theta);
  const rmax = Math.max(...r);
  return { xs, tau: r.map((ri) => (rmax - ri) / c) };
}

export function quantise(tau, step) {
  return tau.map((t) => Math.round(t / step) * step);
}

/**
 * Memory cells per channel (slide 7 and backup): the longest delay, rounded up to the delay step,
 * in write slots, rounded up: K = ceil(ceil(tau_max / step) x step / Tw); M = K + 1 (zero delay).
 */
export function cellsNeeded(tauMax, step, tWrite) {
  const k = Math.ceil((Math.ceil(tauMax / step - 1e-9) * step) / tWrite - 1e-9);
  return { k, m: k + 1 };
}

/** Worst phase error from rounding to the nearest step: 360 deg x f0 x step / 2. */
export function worstPhaseError(f0, step) {
  return (360 * f0 * step) / 2;
}

/**
 * Beam pattern on an arc at the focus: AF(phi) = |sum exp(j 2 pi f0 (r_n(phi)/c + tau_n))| / N.
 * Returns angles (deg) and levels (dB).
 */
export function beamPattern({ N, pitch, theta, F, c, f0, tau }) {
  const xs = elementX(N, pitch);
  const R = Number.isFinite(F) ? F : 1;
  const angles = [];
  const db = [];
  for (let a = -90; a <= 90; a += 0.25) {
    const phi = (a * Math.PI) / 180;
    const r = Number.isFinite(F) ? paths(xs, R, phi) : xs.map((x) => -x * Math.sin(phi));
    let re = 0;
    let im = 0;
    for (let n = 0; n < N; n++) {
      const ph = 2 * Math.PI * f0 * (r[n] / c + tau[n]);
      re += Math.cos(ph);
      im += Math.sin(ph);
    }
    angles.push(a);
    db.push(20 * Math.log10(Math.max(Math.hypot(re, im) / N, 1e-6)));
  }
  return { angles, db, sidelobe: peakSidelobe(angles, db) };
}

/** Highest level outside the main lobe (main lobe = between the first minima around the peak). */
export function peakSidelobe(angles, db) {
  let p = 0;
  for (let i = 1; i < db.length; i++) if (db[i] > db[p]) p = i;
  let l = p;
  while (l > 0 && db[l - 1] < db[l]) l--;
  let r = p;
  while (r < db.length - 1 && db[r + 1] < db[r]) r++;
  let s = -Infinity;
  for (let i = 0; i < db.length; i++) if (i < l || i > r) s = Math.max(s, db[i]);
  return { level: s - db[p], peakAngle: angles[p] };
}
