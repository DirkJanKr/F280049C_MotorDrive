// Monte Carlo over many chips, run in small chunks so the page stays responsive.

import { createRng } from '../../model/rng.js';
import { drawChip } from './chargeSar.js';
import { testChip } from './testbench.js';

export function runMonteCarlo(d, P, onProgress, onDone) {
  const rng = createRng(P.seed);
  const n = Math.round(P.chips);
  const out = [];
  let cancelled = false;
  function chunk() {
    if (cancelled) return;
    const end = Math.min(n, out.length + 4);
    while (out.length < end) {
      const chip = drawChip(d, P, rng);
      const r = testChip(chip, d, P, rng, { samplesPerCode: 2 });
      out.push({ enobRaw: r.sRaw.enob, enobCal: r.sCal.enob, dnlRaw: r.linRaw.peakDnl, dnlCal: r.linCal.peakDnl, missRaw: r.linRaw.missing, missCal: r.linCal.missing });
    }
    onProgress(out.length / n);
    if (out.length < n) setTimeout(chunk, 0);
    else onDone(summarise(out));
  }
  setTimeout(chunk, 0);
  return () => {
    cancelled = true;
  };
}

function stats(v) {
  const s = [...v].sort((a, b) => a - b);
  const mean = s.reduce((a, x) => a + x, 0) / s.length;
  return { mean, min: s[0], max: s[s.length - 1], p01: s[Math.floor(0.01 * (s.length - 1))], p99: s[Math.ceil(0.99 * (s.length - 1))], values: s };
}

export function summarise(rows) {
  const pick = (k) => stats(rows.map((r) => r[k]));
  return {
    n: rows.length,
    enobRaw: pick('enobRaw'), enobCal: pick('enobCal'), dnlRaw: pick('dnlRaw'), dnlCal: pick('dnlCal'),
    missingRaw: rows.filter((r) => r.missRaw > 0).length, missingCal: rows.filter((r) => r.missCal > 0).length,
  };
}
