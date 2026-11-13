// Writes the ngspice run that the Conversion page shows: src/workbench/data/spice-charge.json.
// Run with: node spice/export.mjs   (needs ngspice on the PATH)

import { writeFileSync } from 'node:fs';
import { ngspiceVersion, runTransient } from './ngspice.mjs';
import { chargeShareNetlist, rabuske421 } from './chargeShare.mjs';

// Example values: C_TH = 16 x 112 fF, the first three steps of the example array at V_PC = 200 mV
const config = { cTh: 1.792e-12, vinP: 0.6, vinN: 0.4, vpc: 0.2, steps: [{ c: 1.12e-12, sign: -1 }, { c: 0.56e-12, sign: 1 }, { c: 0.28e-12, sign: -1 }] };
const { netlist, tran, tStep } = chargeShareNetlist({ ...config, tStep: 5e-9 });
const r = runTransient(netlist, tran, ['v(p)', 'v(n)']);
const vpn = Array.from(r['v(p)'], (v, i) => v - r['v(n)'][i]);
const keep = [];
const n = vpn.length;
for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 1500))) keep.push(i);
const steps = config.steps.map((_, i) => i).concat(config.steps.length).map((i) => {
  const k = r.t.findIndex((t) => t >= (i + 1) * tStep * 0.98);
  return { at: (i + 1) * tStep * 0.98, spice: vpn[k], eq: rabuske421(config, i) };
});
const out = { ngspice: ngspiceVersion(), generated: new Date().toISOString().slice(0, 10), config, tStep, ron: 200, netlist, t: keep.map((i) => r.t[i]), vpn: keep.map((i) => vpn[i]), steps };
writeFileSync(new URL('../src/workbench/data/spice-charge.json', import.meta.url), JSON.stringify(out));
console.log('written', out.t.length, 'points; steps', steps.map((s) => `${(s.spice * 1e3).toFixed(4)}/${(s.eq * 1e3).toFixed(4)} mV`).join(' '));
