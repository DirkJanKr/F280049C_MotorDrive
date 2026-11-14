// Settling of the charge-sharing steps in ngspice, swept over the switch resistance.
// Ideal switches with a fixed on-resistance; transistor switches need the PDK models.
// Run with: node spice/settling.mjs   (writes src/workbench/data/spice-settling.json)

import { chargeShareNetlist } from './chargeShare.mjs';
import { stepCaps, stepSettling, deviation, settledAfter } from '../src/zaan/model/timingBudget.js';

/**
 * One transient with all steps of the design; the sign of each step is the ideal decision.
 * Returns per step { j, tSpice, tModel }: the time after which the distance to the settled value
 * stays below e^-3 of its start, from ngspice and from the RC network of the model.
 */
export function settlingRun(d, P, ron, runTransient, mode = 'same', vin = 0.31) {
  const caps = stepCaps(d);
  const cu = Math.min(...caps.map((s) => s.c));
  const tStep = 40 * Math.max(...stepSettling(caps, ron, mode).map((s) => s.tau), 2 * ron * caps[0].c * (mode === 'unit' ? cu / caps[0].c : 1));
  const cTh = 2 * caps[0].cd;
  const q1 = d.qLsb / 2; // one LSB as differential-mode charge
  // ideal decisions from the charge balance (Rabuske 2017, eq. 4.21); r = residue before each step [LSB]
  let q = (cTh / 2) * vin;
  const res = [];
  const steps = caps.map((s) => {
    res.push(q / q1);
    const sign = q > 0 ? -1 : 1;
    q += sign * s.c * P.vref;
    return { c: s.c, sign, ron: mode === 'unit' ? (ron * cu) / s.c : ron };
  });
  const net = chargeShareNetlist({ cTh, vinP: 0.5 + vin / 2, vinN: 0.5 - vin / 2, vpc: P.vref, steps, ron, tStep });
  const r = runTransient(net.netlist, `tran ${tStep / 8000} ${(steps.length + 1) * tStep} uic`, ['v(p)', 'v(n)']);
  const v = Array.from(r['v(p)'], (x, i) => x - r['v(n)'][i]);
  const at = (t) => r.t.findIndex((x) => x >= t);
  return caps.map((s, j) => {
    const t0 = (j + 1) * tStep;
    const k0 = at(t0);
    const vEnd = v[at(t0 + tStep * 0.98)];
    const a0 = Math.abs(v[k0 - 1] - vEnd);
    let k = at(t0 + tStep * 0.98);
    while (k > k0 && Math.abs(v[k] - vEnd) < a0 * Math.exp(-3)) k--;
    const dev = deviation(caps, j, res[j], mode);
    return { j, w: s.w, tSpice: r.t[k] - t0, tModel: settledAfter(dev, Math.abs(dev.e[0]) * Math.exp(-3)) * ron };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { writeFileSync } = await import('node:fs');
  const { ngspiceVersion, runTransient } = await import('./ngspice.mjs');
  const { createValues } = await import('../src/workbench/values.js');
  const { design } = await import('../src/workbench/design.js');
  const c = design(createValues(), {});
  const runs = [];
  for (const [mode, ron] of [['same', 250], ['same', 500], ['same', 1000], ['same', 2000], ['unit', 8000]]) runs.push({ mode, ron, steps: settlingRun(c.d, c.P, ron, runTransient, mode) });
  const out = { ngspice: ngspiceVersion(), generated: new Date().toISOString().slice(0, 10), weights: c.d.weights, runs };
  writeFileSync(new URL('../src/workbench/data/spice-settling.json', import.meta.url), JSON.stringify(out));
  for (const run of runs) console.log(run.mode, run.ron, 'ohm, ngspice / model:', run.steps.map((s) => `${(s.tSpice / s.tModel).toFixed(2)}`).join(' '));
}
