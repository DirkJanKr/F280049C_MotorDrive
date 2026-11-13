// Circuit level against behavioural level: ngspice transient of the charge-sharing steps must end
// where Rabuske's eq. 4.21 (and so the workbench model) says. Skipped when ngspice is not installed.

import test from 'node:test';
import assert from 'node:assert/strict';
import { ngspiceVersion, runTransient } from '../spice/ngspice.mjs';
import { chargeShareNetlist, rabuske421 } from '../spice/chargeShare.mjs';

const have = ngspiceVersion();

test('ngspice: charge sharing settles to Rabuske eq. 4.21 after every step', { skip: !have && 'ngspice not installed' }, () => {
  const cfg = { cTh: 1.792e-12, vinP: 0.6, vinN: 0.4, vpc: 0.2, steps: [{ c: 1.12e-12, sign: -1 }, { c: 0.56e-12, sign: 1 }, { c: 0.28e-12, sign: -1 }] };
  const { netlist, tran, tStep } = chargeShareNetlist(cfg);
  const r = runTransient(netlist, tran, ['v(p)', 'v(n)']);
  for (let i = 0; i <= cfg.steps.length; i++) {
    const tEnd = (i + 1) * tStep * 0.98; // just before the next switch closes
    const k = r.t.findIndex((t) => t >= tEnd);
    const vSpice = r['v(p)'][k] - r['v(n)'][k];
    const vEq = rabuske421(cfg, i);
    assert.ok(Math.abs(vSpice - vEq) < 1e-4 * Math.max(1, Math.abs(vEq)) + 2e-6, `step ${i}: ngspice ${vSpice}, eq. 4.21 ${vEq}`);
  }
  // charge sharing keeps the common mode (Rabuske eq. 4.20)
  const last = r.t.length - 1;
  assert.ok(Math.abs((r['v(p)'][last] + r['v(n)'][last]) / 2 - 0.5) < 1e-4);
});

test('the ngspice data shown on the Conversion page matches the circuit and eq. 4.21', async () => {
  const { readFileSync } = await import('node:fs');
  const data = JSON.parse(readFileSync(new URL('../src/workbench/data/spice-charge.json', import.meta.url)));
  assert.ok(data.ngspice, 'records the ngspice version');
  data.steps.forEach((st, i) => {
    assert.ok(Math.abs(st.eq - rabuske421(data.config, i)) < 1e-12, `eq. 4.21 at step ${i}`);
    assert.ok(Math.abs(st.spice - st.eq) < 1e-5, `ngspice settles to eq. 4.21 at step ${i}`);
  });
  assert.ok(data.t.length === data.vpn.length && data.t.length > 100);
});
