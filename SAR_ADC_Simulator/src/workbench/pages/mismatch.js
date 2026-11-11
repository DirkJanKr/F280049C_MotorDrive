// Mismatch page: Monte Carlo over many chips, one chip in detail, and the area on the chip.

import { group, knobs, card, fill, widthOf, plot, readouts, explain, eng, num, esc, COL } from '../kit.js';
import { designCdac } from '../../zaan/model/cdac.js';
import { drawChip, convert, combine } from '../../zaan/model/chargeSar.js';
import { leastSquaresWeights } from '../../zaan/model/calibrate.js';
import { rampLinearity } from '../../zaan/model/analysis.js';
import { testChip } from '../../zaan/model/testbench.js';
import { summarise } from '../../zaan/model/montecarlo.js';
import { createRng } from '../../model/rng.js';
import { L, runLms, dnlWith, diagram, describeLms } from '../anim/lmsAnim.js';
import { CHIP } from '../design.js';

const mc = { result: null, yieldCu: null, running: false, key: '' };

export const page = {
  id: 'mismatch',
  title: 'Mismatch and area',
  side(store) {
    const used = new Set();
    return group('Capacitors', knobs(store.values, ['cm', 'alpha', 'pairSigma', 'density', 'routing'], used)) + group('Simulation', knobs(store.values, ['chips', 'seed', 'bits'], used)) + `<p class="ks pad">The weights come from the SAR ADC page.</p>`;
  },
  main(store) {
    return `<div id="mmro"></div>
      <section class="card wide"><header><h3>Monte Carlo: many chips, before and after calibration</h3><span class="ctl"><button class="mini primary" id="mcRun">run Monte Carlo</button></span></header>
        <div class="grid2 inner"><div id="mcHist" class="cbody"></div><div id="mcYield" class="cbody"></div></div><p class="cap" id="mcCap">Press run. Each chip gets its own random capacitor errors from the PDK matching; its weights are then calibrated with a ramp, and the ENOB of a sine is measured with design and with calibrated weights.</p></section>
      <section class="card wide"><header><h3>Why binary matching needs such a large unit capacitor</h3></header><div class="cbody" id="mmFlip"></div><p class="cap" id="mmFlip-cap"></p></section>
      <div class="grid2">${card('mmErr', 'This chip: weight error per step')}${card('mmDnl', 'This chip: DNL and INL before and after calibration')}</div>
      <section class="card wide"><header><h3>LMS calibration on chip: the hookup and the weights converging</h3><span class="ctl"><label class="mini-l">μ <select id="lmsMu">${[5, 7, 9].map((k) => `<option value="${k}" ${(store.ui.lmsMu || 7) === k ? 'selected' : ''}>2^−${k}</option>`).join('')}</select></label><button class="mini primary" id="lmsPlay">▶ run calibration</button></span></header>
        <div id="lmsDiag"></div><div class="grid2 inner"><div id="lmsW" class="cbody"></div><div id="lmsE" class="cbody"></div></div><p class="cap" id="lmsCap"></p></section>
      <div class="grid2">${card('mmWhy', 'Why the DNL does not go below about 1 LSB here')}${card('mmArea', 'Area on the 3.2 mm × 5 mm chip, to scale')}</div>
      ${explain('What mismatch does here', [
        'Every capacitor comes out a little off its design value. A step built from k unit capacitors has a relative error of σu / √k, so the big steps are relatively accurate but carry the largest absolute error in LSB.',
        'With redundancy the comparison levels still find the input; only the weights used to add up the decisions are wrong. Calibration measures them once per chip and puts them in the LUT. Without redundancy a wrong weight loses codes, and calibration cannot get them back.',
      ])}`;
  },
  mount(store) {
    document.getElementById('mcRun').onclick = (e) => runMc(store, e.target);
    document.getElementById('lmsMu').onchange = (e) => {
      store.ui.lmsMu = Number(e.target.value);
      L.key = '';
      lms(store.ctx, true);
    };
    document.getElementById('lmsPlay').onclick = () => lms(store.ctx, true);
  },
  update(store, ctx) {
    const { d, P, sim } = ctx;
    flipCard(ctx);
    fill('mmro', readouts([
      ['σ of one unit capacitor', `${num(ctx.sigmaU * 100, 3)} %`, `at Cu = ${eng(P.cu, 'F')}`, '', 'sigmau'],
      ['Binary matching would need', eng(ctx.binCu, 'F'), 'unit capacitor for 3σ DNL < 0.5 LSB'],
      ['ENOB, this chip', `${num(sim.sRaw.enob, 2)} → ${num(sim.sCal.enob, 2)}`, 'design → calibrated', sim.sCal.enob >= P.enobAim ? 'ok' : 'bad'],
      ['Peak DNL, this chip', `${num(sim.linRaw.peakDnl, 2)} → ${num(sim.linCal.peakDnl, 2)}`, 'LSB'],
      ['Capacitor area', `${num(ctx.areaTotal * 1e6, 3)} mm²`, `${num((ctx.areaTotal / (CHIP.w * CHIP.h)) * 100, 2)} % of the chip`, '', 'area'],
    ]));
    const key = JSON.stringify([d.weights, ctx.steps.map((s) => s.kind), P.cu, P.aC, P.chips, P.seed, P.bits]);
    if (key !== mc.key) {
      mc.key = key;
      mc.result = null;
      mc.yieldCu = null;
    }
    drawMc(P);
    const w = widthOf('mmErr');
    const err = d.weights.map((wd, i) => sim.chip.wTrue[i] - wd);
    const sig = d.steps.map((st, i) => (st.kind === 'cap' || st.kind === 'small' ? (d.weights[i] * ctx.sigmaU) / Math.sqrt(st.units) : (d.weights[i] * ctx.sigmaU) / Math.SQRT2));
    const n = d.weights.length;
    const elim = Math.max(...sig.map((x) => 3 * x), ...err.map(Math.abs)) * 1.15;
    fill('mmErr', plot({
      height: 250, x: { min: 0.5, max: n + 0.5, label: 'step', ticks: Array.from({ length: n }, (_, i) => i + 1) }, y: { min: -elim, max: elim, label: 'weight error [LSB]' },
      series: [{ points: err.map((e, i) => [i + 1, e]), color: COL.cal, mode: 'dots', r: 5, label: 'this chip' }],
      hlines: [{ y: 0, color: COL.muted, dash: '' }],
      overlay: (sx, sy) => sig.map((sg, i) => `<rect x="${sx(i + 1) - 9}" y="${sy(3 * sg)}" width="18" height="${Math.max(1, sy(-3 * sg) - sy(3 * sg))}" rx="3" fill="var(--an)" opacity="0.16"/><line x1="${sx(i + 1) - 9}" x2="${sx(i + 1) + 9}" y1="${sy(sg)}" y2="${sy(sg)}" stroke="var(--an)" opacity="0.6"/><line x1="${sx(i + 1) - 9}" x2="${sx(i + 1) + 9}" y1="${sy(-sg)}" y2="${sy(-sg)}" stroke="var(--an)" opacity="0.6"/>`).join(''),
      legend: true,
    }, w), `Dots: true minus design weight of this chip (seed ${P.seed}). Shaded: ±3σ over many chips, lines at ±1σ; σ = w σu / √units for whole and small capacitors, about w σu / √2 for a halving step (approximation). What the tolerance must cover is on the SAR ADC page.`);
    const k = Array.from({ length: d.codes - 2 }, (_, i) => i + 1);
    const lim = Math.max(1, sim.linRaw.peakDnl, sim.linCal.peakDnl) * 1.1;
    fill('mmDnl', plot({ height: 160, x: { min: 0, max: d.codes, label: 'code' }, y: { min: -lim, max: lim, label: 'DNL' }, series: [{ points: k.map((i) => [i, sim.linRaw.dnl[i]]), color: COL.muted, width: 0.9, label: 'design weights' }, { points: k.map((i) => [i, sim.linCal.dnl[i]]), color: COL.an, width: 1.1, label: 'calibrated' }], legend: true }, w) + plot({ height: 160, x: { min: 0, max: d.codes, label: 'code' }, y: { min: -Math.max(1, sim.linRaw.peakInl) * 1.1, max: Math.max(1, sim.linRaw.peakInl) * 1.1, label: 'INL' }, series: [{ points: k.map((i) => [i, sim.linRaw.inl[i]]), color: COL.muted, width: 0.9 }, { points: k.map((i) => [i, sim.linCal.inl[i]]), color: COL.an, width: 1.1 }] }, w), 'Ramp of 16 samples per code without comparator noise (offset after calibration included), so the histogram itself does not scatter. Grey: design weights, cyan: calibrated weights rounded to the output bits.');
    area(ctx, widthOf('mmArea'));
    whyDnl(ctx);
    lms(ctx, false);
  },
};

function area(ctx, w) {
  const { d, P } = ctx;
  const cw = Math.min(220, w * 0.32);
  const ch = (cw * CHIP.h) / CHIP.w;
  const s = (a) => (Math.sqrt(a) / CHIP.w) * cw;
  const bin = designCdac({ ...P, radix: 2, cu: ctx.binCu, halvingOn: 'charge halving' }, P.memCells);
  const binA = ((bin.cdac + bin.memCaps * bin.cm) * P.routing) / P.density;
  const rows = [['Memory cells', `${d.memCaps} × ${eng(d.cm, 'F')}`, ctx.memArea], ['CDAC', `${num(d.units, 2)} × ${eng(P.cu, 'F')}`, ctx.cdacArea], ['Total', `× ${num(P.routing, 1)} routing and switches`, ctx.areaTotal]];
  fill('mmArea', `<div class="areabox"><svg viewBox="0 0 ${cw + 20} ${ch + 20}" class="tsvg" style="max-width:${cw + 20}px"><rect x="10" y="10" width="${cw}" height="${ch}" class="die"/><rect x="18" y="18" width="${s(binA)}" height="${s(binA)}" class="ar-bin"/><rect x="18" y="18" width="${s(ctx.memArea)}" height="${s(ctx.memArea)}" class="ar-mem"/><rect x="${22 + s(ctx.memArea)}" y="18" width="${s(ctx.cdacArea)}" height="${s(ctx.cdacArea)}" class="ar-cdac"/></svg>
    <table class="tbl"><thead><tr><th>Part</th><th>How many</th><th>mm²</th><th>% of chip</th></tr></thead><tbody>${rows.map(([a, b, c]) => `<tr><td>${a}</td><td>${b}</td><td class="num">${num(c * 1e6, 4)}</td><td class="num">${num((c / (CHIP.w * CHIP.h)) * 100, 2)}</td></tr>`).join('')}
    <tr><td class="dim">Binary, matched units</td><td class="dim">${eng(ctx.binCu, 'F')} units</td><td class="num dim">${num(binA * 1e6, 3)}</td><td class="num dim">${num((binA / (CHIP.w * CHIP.h)) * 100, 1)}</td></tr></tbody></table></div>`, 'Cyan: memory cells, amber: CDAC, faint red: the same converter with binary weights and units large enough for matching. Capacitor plates at the density set on the left; comparator, logic and IQ demodulator are not included.');
}

function runMc(store, btn) {
  if (mc.running) return;
  mc.running = true;
  btn.textContent = 'running…';
  const ctx = store.ctx;
  const { P, d } = ctx;
  const rng = createRng(P.seed);
  const n = Math.round(P.chips);
  const rows = [];
  const cus = [20e-15, 35e-15, 50e-15, 70e-15, 100e-15, 150e-15];
  const yieldPts = [];
  const step = () => {
    if (rows.length < n) {
      for (let k = 0; k < 4 && rows.length < n; k++) {
        const chip = drawChip(d, P, rng);
        const r = testChip(chip, d, P, rng, { samplesPerCode: 2 });
        rows.push({ enobRaw: r.sRaw.enob, enobCal: r.sCal.enob, dnlRaw: r.linRaw.peakDnl, dnlCal: r.linCal.peakDnl, missRaw: 0, missCal: 0 });
      }
      document.getElementById('mcCap').textContent = `Running… ${rows.length} of ${n} chips`;
      if (rows.length === n) {
        mc.result = summarise(rows);
        drawMc(P);
      }
    } else if (yieldPts.length < cus.length) {
      const cu = cus[yieldPts.length];
      const Pc = { ...P, cu };
      const dc = designCdac(Pc, P.memCells, ctx.steps);
      const r2 = createRng(P.seed + 100 + yieldPts.length);
      let ok = 0;
      for (let k = 0; k < 30; k++) if (testChip(drawChip(dc, Pc, r2), dc, Pc, r2, { samplesPerCode: 1 }).sCal.enob >= P.enobAim) ok++;
      yieldPts.push([cu * 1e15, (ok / 30) * 100]);
      mc.yieldCu = yieldPts.slice();
      drawMc(P);
    } else {
      mc.running = false;
      btn.textContent = 'run Monte Carlo';
      return;
    }
    setTimeout(step, 0);
  };
  setTimeout(step, 0);
}

function drawMc(P) {
  const h = document.getElementById('mcHist');
  if (!h || !mc.result) return;
  const r = mc.result;
  const lo = Math.min(r.enobRaw.min, r.enobCal.min, P.enobAim) - 0.05;
  const hi = Math.max(r.enobRaw.max, r.enobCal.max, P.enobAim) + 0.05;
  const nb = 30;
  const hist = (vals) => {
    const c = new Array(nb).fill(0);
    for (const x of vals) c[Math.max(0, Math.min(nb - 1, Math.floor(((x - lo) / (hi - lo)) * nb)))]++;
    return c.map((v, i) => [lo + (i * (hi - lo)) / nb, v]).concat([[hi, 0]]);
  };
  const a = hist(r.enobRaw.values);
  const b = hist(r.enobCal.values);
  const w = h.clientWidth - 4;
  h.innerHTML = plot({ height: 250, x: { min: lo, max: hi, label: 'ENOB [bit]' }, y: { min: 0, max: Math.max(...a.map((p) => p[1]), ...b.map((p) => p[1])) * 1.15, label: 'chips' }, series: [{ points: a, color: COL.muted, step: true, width: 1.6, label: 'design weights' }, { points: b, color: COL.an, step: true, width: 2.2, label: 'calibrated' }], vlines: [{ x: P.enobAim, color: COL.ref, label: 'aim' }], legend: true }, w);
  const y = document.getElementById('mcYield');
  if (y && mc.yieldCu) y.innerHTML = plot({ height: 250, x: { min: 0, max: 160, label: 'Cu [fF]' }, y: { min: 0, max: 105, label: 'chips at or above the aim [%]' }, series: [{ points: mc.yieldCu, color: COL.an, width: 2.2 }, { points: mc.yieldCu, color: COL.an, mode: 'dots', r: 4.5 }], vlines: [{ x: 35, color: COL.ref, label: 'PDK min' }] }, y.clientWidth - 4);
  const yieldNow = (r.enobCal.values.filter((x) => x >= P.enobAim).length / r.n) * 100;
  document.getElementById('mcCap').textContent = `${r.n} chips: mean ENOB ${num(r.enobRaw.mean, 2)} → ${num(r.enobCal.mean, 2)} bit, worst after calibration ${num(r.enobCal.min, 2)}; ${num(yieldNow, 0)} % reach the aim of ${num(P.enobAim, 1)}. Right: the same with 30 chips per unit capacitor value.`;
}

const W = { key: '', alt: null };

/** The same weights with one more charge-halving step (smallest step half as large), simulated on the same seed. */
function finerVariant(ctx) {
  const { P, d } = ctx;
  const key = JSON.stringify([d.weights, P.cu, P.aC, P.seed, P.vosCal, P.vref]);
  if (key === W.key) return W.alt;
  const caps = ctx.steps.filter((x) => x.kind === 'cap' || x.kind === 'small');
  const subs = ctx.steps.filter((x) => x.kind === 'half');
  const h = subs.length + 1;
  const steps = caps.concat(Array.from({ length: h }, (_, k) => ({ units: 0.5 ** (k + 1), kind: 'half' })), [{ units: 0.5 ** h, kind: 'rest' }]);
  const dv = designCdac(P, P.memCells, steps);
  const chip = drawChip(dv, P, createRng(P.seed));
  const xs = [];
  for (let j = 0; j < dv.codes * 8; j++) xs.push((j + 0.5) / 8);
  const dec = xs.map((x) => convert(chip, dv, x - dv.codes / 2, { vos: P.vosCal }));
  const cal = leastSquaresWeights(dec, xs);
  const lin = rampLinearity(dec.map((q) => combine(q, cal, dv.codes)), dv.codes);
  const enob = testChip(chip, dv, { ...P, compNoise: 0 }, createRng(P.seed + 9), { samplesPerCode: 1 }).sCal.enob;
  W.key = key;
  W.alt = { weights: dv.weights, lin, enob, decisions: dv.decisions };
  return W.alt;
}

function whyDnl(ctx) {
  const { d, sim } = ctx;
  const smallest = Math.min(...d.weights);
  const alt = finerVariant(ctx);
  fill('mmWhy', `<table class="tbl"><thead><tr><th></th><th>current</th><th>one more halving step</th></tr></thead><tbody>
    <tr><td>smallest step</td><td class="num">${num(smallest, 2)} LSB</td><td class="num">${num(Math.min(...alt.weights), 2)} LSB</td></tr>
    <tr><td>decisions</td><td class="num">${d.decisions}</td><td class="num">${alt.decisions}</td></tr>
    <tr><td>peak DNL after calibration</td><td class="num">${num(sim.linCal.peakDnl, 2)} LSB</td><td class="num">${num(alt.lin.peakDnl, 2)} LSB</td></tr>
    <tr><td>peak INL after calibration</td><td class="num">${num(sim.linCal.peakInl, 2)} LSB</td><td class="num">${num(alt.lin.peakInl, 2)} LSB</td></tr>
    <tr><td>ENOB after calibration, no comparator noise</td><td class="num">${num(sim.sCal0.enob, 2)}</td><td class="num">${num(alt.enob, 2)}</td></tr></tbody></table>`,
  `Calibration finds the true weights, but the result is still rounded to ${ctx.P.bits} bits. The levels a chip can produce are spaced by its smallest step. When that step is 1 LSB and the weights are off by a fraction of an LSB, a level can land anywhere between two output codes; after rounding, some codes get no input (DNL −1) and their neighbours get twice as much (DNL +1). The calibration is correct; the converter has no finer level to offer. One more charge-halving step makes the levels ½ LSB apart, so rounding can always pick the nearest code: DNL about ½ LSB. It costs one decision and one unit capacitor. A combiner output with more bits does not help here, because the levels themselves are not finer.`);
}

function lms(ctx, play) {
  const mu = ctx.ui.lmsMu || 7;
  const key = JSON.stringify([ctx.d.weights, ctx.P.seed, ctx.P.cu, ctx.P.aC, ctx.P.compNoise, ctx.P.vosCal, mu]);
  if (key !== L.key) {
    L.key = key;
    L.snaps = runLms(ctx, mu);
    L.frame = L.snaps.length - 1;
    L.dnl = dnlWith(ctx, { c: L.snaps[L.snaps.length - 1].c, w: L.snaps[L.snaps.length - 1].w });
  }
  clearTimeout(L.timer);
  const draw = () => {
    const s = L.snaps[L.frame];
    fill('lmsDiag', diagram(ctx, s, widthOf('lmsDiag', 1000)));
    const upto = L.snaps.slice(0, L.frame + 1);
    const cols = [COL.an, COL.ref, COL.cal, COL.clk];
    const kmax = L.snaps[L.snaps.length - 1].k;
    const lx = (k) => Math.log10(k + 1);
    const xax = { min: 0, max: lx(kmax), label: 'calibration samples', ticks: [0, 1, 2, 3].filter((v) => v <= lx(kmax)), format: (v) => `${10 ** v}` };
    const emax = Math.max(0.5, ...L.snaps.map((p) => Math.max(...p.err.slice(0, 4).map(Math.abs)))) * 1.1;
    fill('lmsW', plot({ height: 220, x: xax, y: { min: -emax, max: emax, label: 'w i − w true [LSB]' }, series: [0, 1, 2, 3].map((i) => ({ points: upto.map((p) => [lx(p.k), p.err[i]]), color: cols[i], width: 1.8, label: `w${i + 1}` })), hlines: [{ y: 0, color: COL.muted }], legend: true }, widthOf('lmsW')));
    fill('lmsE', plot({ height: 220, x: xax, y: { min: 0, max: Math.max(1.5, ...L.snaps.slice(0, 6).map((p) => p.erms)), label: 'rms of e [LSB]' }, series: [{ points: upto.map((p) => [lx(p.k), p.erms]), color: COL.dig, width: 2 }] }, widthOf('lmsE')));
    fill('lmsCap', `${describeLms(ctx, s)} After ${kmax + 1} samples: peak DNL ${num(L.dnl.peakDnl, 2)} LSB with the LMS weights (least squares on a ramp: ${num(ctx.sim.linCal.peakDnl, 2)} LSB).`);
  };
  if (!play) {
    draw();
    return;
  }
  L.frame = 0;
  const step = () => {
    draw();
    if (L.frame < L.snaps.length - 1 && document.getElementById('lmsDiag')) {
      L.frame = Math.min(L.snaps.length - 1, L.frame + 1);
      L.timer = setTimeout(step, 30);
    }
  };
  step();
}

/** The two codes around mid-scale of a binary list: every capacitor reverses, so every error counts twice. */
function flipCard(ctx) {
  const { P } = ctx;
  const ws = ctx.dBin.weights;
  const w = Math.max(520, widthOf('mmFlip'));
  const L = 190;
  const bw = (w - L - 20) / ws.length;
  const p = [`<svg viewBox="0 0 ${w} 150" class="tsvg tolc" role="img" aria-label="The two codes around mid-scale">`];
  const rowOf = (y, label, first) => {
    p.push(`<text x="8" y="${y + 20}" class="lbl">${label}</text>`);
    ws.forEach((x, i) => {
      const plus = i === 0 ? first : !first;
      p.push(`<rect x="${L + i * bw + 2}" y="${y}" width="${bw - 4}" height="30" rx="4" class="${plus ? 'tn-mis' : 'tn-off'}" opacity="0.85"/><text x="${L + i * bw + bw / 2}" y="${y + 20}" text-anchor="middle" class="tiny" style="fill:#fff">${plus ? '+' : '−'}${num(x, 0)}</text>`);
    });
  };
  rowOf(14, 'just below mid-scale', false);
  rowOf(64, 'just above mid-scale', true);
  p.push(`<text x="8" y="134" class="lbl">change of each step</text>`);
  ws.forEach((x, i) => p.push(`<text x="${L + i * bw + bw / 2}" y="134" text-anchor="middle" class="tiny">${i === 0 ? '+' : '−'}2·${num(x, 0)}</text>`));
  p.push('</svg>');
  const units = 2 * P.topUnits;
  const sNow = 2 * P.lsbPerUnit * Math.sqrt(units);
  const sigU = 0.5 / (3 * sNow);
  const sigConv = 0.5 / (3 * Math.sqrt(2 ** P.bits));
  const cConv = (P.aC / 100 / sigConv) ** 2 * 1e-15;
  fill('mmFlip', p.join(''), `Each box is one CDAC step with its weight in LSB: + is connected parallel, − antiparallel. The two codes should be one code step apart. Every step reverses, so its error counts twice: error of the code step = 2 · (δw 1 − δw 2 − … ). A step of k unit capacitors has σ = n u · σ u · √k LSB (n u = ${P.lsbPerUnit} LSB per unit). All ${units} units together: σ = 2 · n u · σ u · √${units} = ${num(sNow, 0)} · σ u LSB. For 3σ < 0.5 LSB: σ u < ${num(sigU * 100, 3)} %, and with the PDK matching that is C u = ${eng(ctx.binCu, 'F')}. The earlier ${eng(ctx.binCu / 4, 'F')} left out the factor 2 (it counted a capacitor as on or off, not as reversed); half the σ needs four times the capacitance. Cross-check: a usual binary array has ${2 ** P.bits} units of 1 LSB, σ = σ u · √${2 ** P.bits}, needing ${eng(cConv, 'F')} per unit and ${eng(cConv * 2 ** P.bits, 'F')} in total. This array has ${units} units of ${eng(ctx.binCu, 'F')}: ${eng(ctx.binCu * units, 'F')} in total, the same. Matching sets the total capacitance, however it is divided.`);
}
