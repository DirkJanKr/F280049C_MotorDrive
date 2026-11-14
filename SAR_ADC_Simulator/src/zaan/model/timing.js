// Timing inside one conversion: settling of each step and comparator decision time.

/**
 * DAC settling for step i: binary to 0.5 LSB, with redundancy only to the next tolerance (slide 23).
 * One time constant per step, tau ln(w / t next). Kept for the optimizer and the illustrative Timing chart.
 * The timing budget does not use it: it uses the RC network of all connected capacitors in timingBudget.js,
 * because ngspice shows that a small late step first overshoots and then returns with the time constant of
 * the largest earlier capacitor (spice/settling.mjs).
 */
export function settlingTimes(d, tau) {
  return d.weights.map((w, i) => {
    const tNext = Math.max(0.5, d.tol[i + 1] ?? 0.5);
    return { binary: tau * Math.log(Math.max(1, w / 0.5)), redundant: tau * Math.log(Math.max(1, w / tNext)) };
  });
}

/** Comparator time constant tau = C_load / gm, gm = (gm/ID) x I_bias. */
export function comparatorTau(P) {
  return P.cload / (P.gmId * P.ibias);
}

/** Metastability: t = tau ln(V_final / |V_in|), with a floor so a zero input does not give infinity. */
export function decisionTime(tauC, vfinal, vin) {
  return tauC * Math.log(vfinal / Math.max(Math.abs(vin), vfinal * 1e-9));
}

/**
 * Per-sample conversion time from the node voltages of many conversions.
 * traces: arrays of node voltages per decision (V). Returns per-decision mean and the total distribution.
 */
export function conversionTimes(P, d, traces) {
  const tauC = comparatorTau(P);
  const settle = settlingTimes(d, P.tauDac);
  const n = d.decisions;
  const mean = new Array(n).fill(0);
  const totals = [];
  for (const vs of traces) {
    let t = P.tSample;
    for (let i = 0; i < n; i++) {
      const td = decisionTime(tauC, P.vfinal, vs[i]);
      mean[i] += td / traces.length;
      t += td + P.tLogic + (i < n - 1 ? settle[i].redundant : 0);
    }
    totals.push(t);
  }
  totals.sort((a, b) => a - b);
  const tConv = 1 / P.fs;
  const late = totals.filter((t) => t > tConv).length / totals.length;
  return { tauC, mean, settle, totals, tConv, late, median: totals[Math.floor(totals.length / 2)] };
}
