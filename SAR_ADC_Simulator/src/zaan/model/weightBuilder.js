// Weights designed from what every decision needs, the same as Zaan_MATLAB step 7b
// (fixed_errors.m and build_weights.m). All weights in LSB, largest first.
//
// Fixed errors per decision k (MATLAB step 7a), added linearly:
//   mismatch  3 sigma of step k and all later steps (whole units add in power; a halving
//             step gets the spread of one unit, A)
//   offset    v_os (C_end - C_node,k) / Q_LSB: the part of the offset charge that differs from the last decision
//   settling  eps w_(k-1), eps = e^(-n_tau): the part of the step before that has not arrived
// Tolerance t_k = (sum of later steps) + w_last - w_k (step 6). Rule: need_k + margin <= t_k.

/** Constants of the build from the workbench parameters and design. */
export function builderConstants(P, d) {
  return {
    cTh: d.cNode[0],
    qLsb: d.qLsb,
    cu: P.cu,
    lsbPerUnit: P.lsbPerUnit,
    sigmaU: P.aC / 100 / Math.sqrt(P.cu / 1e-15),
    half: 2 ** (P.bits - 1),
  };
}

/** Tolerance and fixed errors of every decision (numel(w) + 1 of them), in LSB. */
export function fixedErrors(w, eps, vos, K) {
  const n = w.length;
  const units = w.map((x) => x / K.lsbPerUnit);
  const sig = w.map((x, i) => (units[i] >= 1 ? (K.sigmaU / Math.sqrt(units[i])) * x : K.sigmaU * x));
  const cNode = [K.cTh];
  for (let i = 0; i < n; i++) cNode.push(cNode[i] + 2 * Math.max(units[i], 1) * K.cu);
  const cEnd = cNode[n];
  const t = [], mis = [], off = [], setl = [], need = [];
  for (let k = 0; k <= n; k++) {
    let later = 0;
    for (let j = k + 1; j < n; j++) later += w[j];
    t.push(k < n ? later + w[n - 1] - w[k] : 0);
    let v = 0;
    for (let j = k; j < n; j++) v += sig[j] ** 2;
    mis.push(k < n ? 3 * Math.sqrt(v) : 0);
    off.push((vos * (cEnd - cNode[k])) / K.qLsb);
    setl.push(k > 0 ? eps * w[k - 1] : 0);
    need.push(mis[k] + off[k] + setl[k]);
  }
  return { t, mis, off, setl, need, cNode, cEnd };
}

/** Reach beyond full scale minus what the errors need there, with a gain margin g (0.02 = 2 %). */
function spare(w, vos, g, K) {
  const e = fixedErrors(w, 0, vos, K);
  return w.reduce((a, x) => a + x, 0) + w[w.length - 1] - K.half * (1 + g) - e.mis[0] - (vos * e.cEnd) / K.qLsb;
}

function copes(w, eps, vos, m, K) {
  const e = fixedErrors(w, eps, vos, K);
  return e.t.every((t, k) => !(t > 0) || e.need[k] + m <= t + 1e-12);
}

/**
 * The cheapest list for n_tau time constants of settling per step: built backwards from the
 * halving tail, every step as large as the decisions allow, then the top shrunk unit by unit.
 * Returns null when no list exists (the tail cannot hold the unsettled part).
 */
export function buildWeights({ nTau, vos, tail = [4, 2, 1, 1], gMargin = 0, dMargin = 0 }, K) {
  const eps = Math.exp(-nTau);
  const lsbU = K.lsbPerUnit;
  let w = tail.slice();
  for (let guard = 0; guard < 40; guard++) {
    if (spare(w, vos, gMargin, K) >= 0) break;
    let best = 0;
    for (let u = 1; u <= 200; u++) {
      const wk = u * lsbU;
      if (wk < w[0]) continue;
      const v = [wk, ...w];
      const e = fixedErrors(v, eps, vos, K);
      const okAll = e.t.every((t, k) => !(t > 0) || e.need[k] + dMargin <= t + 1e-12);
      const okNext = e.t[0] - e.need[0] - dMargin >= eps * wk - 1e-12;
      if (!(okAll && okNext)) break;
      best = wk;
      if (spare(v, vos, gMargin, K) >= 0) break;
    }
    if (!best) return null;
    w = [best, ...w];
  }
  let changed = true;
  while (changed) {
    changed = false;
    const big = w.filter((x) => x >= lsbU).length;
    for (let i = 0; i < big; i++) {
      const v = w.slice();
      v[i] -= lsbU;
      if (v[i] < lsbU || v[i] < v[i + 1]) continue;
      if (spare(v, vos, gMargin, K) >= 0 && copes(v, eps, vos, dMargin, K)) {
        w = v;
        changed = true;
      }
    }
  }
  return w;
}

/**
 * Time table (MATLAB step 7b): for every n_tau the cheapest list, its decisions and the conversion
 * time in units of tau, T / tau = N_dec r + N_steps n_tau, for r = (comparator + logic delay) / tau.
 */
export function timeTable(opts, K, nTauList = [7.6, 6, 4.6, 4, 3.7, 3.4, 3.2, 3, 2.8, 2.6, 2.4], rList = [2, 5, 10]) {
  const rows = nTauList.map((nTau) => {
    const w = buildWeights({ ...opts, nTau }, K);
    return { nTau, w, decisions: w ? w.length + 1 : null, settle: w ? w.length * nTau : null, T: rList.map((r) => (w ? (w.length + 1) * r + w.length * nTau : null)) };
  });
  const best = rList.map((_, j) => {
    let bi = -1;
    rows.forEach((row, i) => { if (row.T[j] !== null && (bi < 0 || row.T[j] < rows[bi].T[j])) bi = i; });
    return bi;
  });
  return { rows, rList, best };
}
