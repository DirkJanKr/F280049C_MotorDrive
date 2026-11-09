// LMS foreground calibration as it would run on chip. A known test input x ref is
// converted; the raw decisions s i = ±1 multiply the weight registers w i; the sum y
// is compared with x ref; the error e updates every register: w i ← w i + μ e s i.
// Nothing else is needed in hardware: one adder tree, one subtractor, a shift by μ = 2^−k.

import { convert, combine, designWeights } from '../../zaan/model/chargeSar.js';
import { rampLinearity } from '../../zaan/model/analysis.js';
import { createRng } from '../../model/rng.js';
import { eng, num } from '../kit.js';

export const L = { snaps: [], frame: 0, timer: 0, key: '' };

/** Run LMS on the simulated chip. Returns snapshots every `every` samples. */
export function runLms(ctx, muExp, n = 4000) {
  const { d, P, sim } = ctx;
  const rng = createRng(P.seed + 77);
  const mu = 2 ** -muExp;
  const start = designWeights(d);
  let c = start.c;
  const w = start.w.slice();
  const truth = [...sim.chip.wTrue, 0.5];
  const snaps = [];
  let e2 = 0;
  for (let k = 0; k < n; k++) {
    const x = (rng.uniform() - 0.5) * d.codes * 0.98;
    const dec = convert(sim.chip, d, x, { vos: P.vosCal, noise: P.compNoise, rng });
    let y = c;
    for (let i = 0; i < dec.length; i++) y += (dec[i] ? 1 : -1) * w[i];
    const e = x + d.codes / 2 - 0.5 - y;
    c += mu * e;
    for (let i = 0; i < dec.length; i++) w[i] += mu * e * (dec[i] ? 1 : -1);
    e2 = 0.98 * e2 + 0.02 * e * e;
    const keep = k < 50 || (k < 500 && k % 5 === 0) || k % 40 === 0 || k === n - 1;
    if (keep) snaps.push({ k, x, dec: Array.from(dec), y, e, w: w.slice(), c, err: w.map((v, i) => v - truth[i]), learned: w.map((v, i) => v - start.w[i]), erms: Math.sqrt(e2) });
  }
  return snaps;
}

/** DNL with a set of weights: dense noise-free ramp. */
export function dnlWith(ctx, cw) {
  const { d, P, sim } = ctx;
  const out = [];
  for (let j = 0; j < d.codes * 8; j++) out.push(combine(convert(sim.chip, d, (j + 0.5) / 8 - d.codes / 2, { vos: P.vosCal }), cw, d.codes));
  return rampLinearity(out, d.codes);
}

/** Block diagram of the calibration hookup with the values of one snapshot. */
export function diagram(ctx, s, w) {
  const n = s.dec.length;
  const W = Math.max(n * 46 + 560, w);
  const H = 360;
  const regX = 360;
  const regW = Math.min(56, (W - regX - 200) / n);
  const p = [`<svg viewBox="0 0 ${W} ${H}" class="lsvg lms" role="img" aria-label="LMS calibration hookup">`];
  p.push('<defs><marker id="lm" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto"><path d="M0,0 L12,6 L0,12 z" class="lah"/></marker></defs>');
  const box = (x, y, bw, bh, t, sub, cls = '') => `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="10" class="lb ${cls}"/><text x="${x + bw / 2}" y="${y + 24}" class="lt" text-anchor="middle">${t}</text>${sub ? `<text x="${x + bw / 2}" y="${y + 46}" class="ls" text-anchor="middle">${sub}</text>` : ''}`;
  const wire = (d, cls = '') => `<path d="${d}" class="lw ${cls}" marker-end="url(#lm)"/>`;
  p.push(box(14, 40, 140, 70, 'test input', `x ref = ${num(s.x + ctx.d.codes / 2, 1)}`, 'act'));
  p.push(`<text x="20" y="130" class="ls">known value, also sent</text><text x="20" y="146" class="ls">digitally to the subtractor</text>`);
  p.push(box(180, 40, 150, 70, 'cells + SAR', `${n} raw decisions`));
  p.push(wire('M154 75 H178', 'act'));
  // decisions and weight registers
  for (let i = 0; i < n; i++) {
    const x = regX + i * regW;
    const sgn = s.dec[i] ? '+' : '−';
    p.push(`<rect x="${x}" y="40" width="${regW - 5}" height="30" rx="5" class="lc ${s.dec[i] ? 'one' : 'zero'}"/><text x="${x + (regW - 5) / 2}" y="60" class="lcs" text-anchor="middle">${sgn}</text>`);
    const dl = s.learned[i];
    p.push(`<rect x="${x}" y="96" width="${regW - 5}" height="44" rx="5" class="lc reg"/><text x="${x + (regW - 5) / 2}" y="114" class="lcs sm" text-anchor="middle">${Number(s.w[i].toPrecision(3))}</text><text x="${x + (regW - 5) / 2}" y="132" class="lcs sm ${Math.abs(dl) > 0.05 ? 'warnt' : 'okt'}" text-anchor="middle">${dl >= 0 ? '+' : '−'}${num(Math.abs(dl), 2)}</text>`);
  }
  p.push(`<text x="${regX}" y="32" class="ls">s i = ±1</text><text x="${regX}" y="90" class="ls">weight registers w i [LSB], and how far LMS moved them from the design value</text>`);
  p.push(wire(`M330 75 H${regX - 6}`, 'act'));
  const sumX = regX + n * regW + 30;
  p.push(`<circle cx="${sumX + 24}" cy="118" r="24" class="lb act"/><text x="${sumX + 24}" y="125" class="lt" text-anchor="middle">Σ</text>`);
  p.push(wire(`M${regX + n * regW - 4} 118 H${sumX - 2}`, 'act'));
  p.push(`<text x="${sumX + 56}" y="112" class="ls">y = c + Σ s i w i</text><text x="${sumX + 56}" y="130" class="lcs">${num(s.y, 2)}</text>`);
  // subtractor
  p.push(`<circle cx="${sumX + 24}" cy="230" r="24" class="lb"/><text x="${sumX + 24}" y="237" class="lt" text-anchor="middle">−</text>`);
  p.push(wire(`M${sumX + 24} 142 V204`, 'act'));
  p.push(wire(`M84 110 V230 H${sumX - 2}`, ''));
  p.push(`<text x="180" y="224" class="ls">x ref (digital)</text>`);
  p.push(`<text x="${sumX + 56}" y="226" class="ls">e = x ref − 0.5 − y</text><text x="${sumX + 56}" y="244" class="lcs ${Math.abs(s.e) > 1 ? 'warnt' : ''}">${num(s.e, 3)} LSB</text>`);
  // update path
  p.push(box(regX, 280, n * regW - 5, 54, `update every register: w i ← w i + μ · e · s i,  μ = 2^−${ctx.ui.lmsMu || 7}`, 'a shift and an add per register, no multiplier', 'act'));
  p.push(wire(`M${sumX + 24} 254 V307 H${regX + n * regW}`, 'act'));
  p.push(wire(`M${regX + (n * regW) / 2} 280 V144`, 'act'));
  p.push(`<text x="14" y="${H - 14}" class="ls">sample ${s.k + 1} · offset register c = ${num(s.c, 2)} · running rms of e ${num(s.erms, 3)} LSB</text>`);
  p.push('</svg>');
  return p.join('');
}

export function describeLms(ctx, s) {
  return `During calibration the switch at the input connects the test source instead of the beamformer. Every sample, the error between the known input and the sum of the weighted decisions nudges each weight register in the direction that makes the error smaller. The registers start at the design weights; after a few hundred samples they sit on the weights of this chip (the plot compares the four largest with their true values). The last two registers do not go to their design split: LMS shares the last LSB between them in whatever way gives the smallest error, which is allowed because only their sum matters. Comparator noise of ${eng(ctx.P.compNoise, 'V')} keeps them moving a little; a smaller μ averages that out but converges slower.`;
}
