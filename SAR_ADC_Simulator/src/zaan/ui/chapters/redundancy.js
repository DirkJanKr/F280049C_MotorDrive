// Chapter 5: redundancy and calibration, one chip and many chips.

import { knob, knobGroup } from '../knobs.js';
import { context } from '../ctx.js';
import { plot, bars, figure, C } from '../charts.js';
import { num, esc } from '../fmt.js';
import { v, t, eq } from '../math.js';
import { readouts, fillReadouts, insight, check } from '../callouts.js';
import { drawChip } from '../../model/chargeSar.js';
import { testChip } from '../../model/testbench.js';
import { runMonteCarlo } from '../../model/montecarlo.js';
import { createRng } from '../../../model/rng.js';

let cancelMc = null;
let mcTimer = null;
let mcKey = '';
let mcResult = null;

export const chapter = {
  id: 'redundancy', n: 5, short: 'Redundancy', title: 'How can small capacitors still give 10 bits?',
  lede: 'Redundancy keeps every input within reach; calibration reads the result out with the measured weights. You need both.',
  view(state) {
    return {
      knobs:
        knobGroup('Weights', ['radix', 'topUnits', 'halvings', 'lsbPerUnit'].map((id) => knob(state, id)).join('')) +
        knobGroup('Calibration and output', knob(state, 'outBits')) +
        knobGroup('Monte Carlo', ['cu', 'chips', 'seed'].map((id) => knob(state, id)).join('')),
      main: `${readouts('rd-ro')}
        <div class="weights" id="rd-w"></div>
        ${figure('rd-tol', 'Tolerance per decision: how far a decision may be off and still be repaired')}
        <div class="grid2">${figure('rd-dnl', 'This chip: DNL before and after calibration')}${figure('rd-spec', 'This chip: spectrum of a sine')}</div>
        ${figure('rd-mc', 'Monte Carlo: ENOB over many chips')}
        <div id="rd-ins"></div>
        <details class="math-d"><summary>LUT: design and calibrated weights of this chip</summary><div class="tablewrap" id="rd-lut"></div></details>
        <details class="math-d"><summary>Three ways to calibrate</summary><div class="tablewrap">${directions()}</div></details>
        <details class="math-d"><summary>Show the math</summary><div class="math" id="rd-math"></div></details>`,
    };
  },
  update(state) {
    const { P, d } = context(state);
    document.getElementById('rd-w').innerHTML = d.weights.map((w, i) => `<span class="wchip ${d.steps[i].kind}">${num(w, 2)}</span>`).join('<span class="wsep">·</span>') + `<span class="wnote">LSB per step${d.cover.ok ? '' : ' · <b class="bad">range not covered</b>'}</span>`;
    const lab = Array.from({ length: d.decisions }, (_, i) => `${i + 1}`);
    document.getElementById('rd-tol').innerHTML = bars({ labels: lab, height: 220, series: [{ label: 'tolerance [LSB]', values: d.tol, color: 'var(--c3)' }] });
    document.getElementById('rd-tol-cap').textContent = `t_i = (sum of later steps) + 1 − w_i. Binary (radix 2.00) gives 0 everywhere. Sum of steps ${num(d.cover.sum, 0)} LSB, needed ${d.cover.need}.`;
    const rng = createRng(P.seed);
    const chip = drawChip(d, P, rng);
    const r = testChip(chip, d, P, rng, { samplesPerCode: 8 });
    const codesX = Array.from({ length: d.codes }, (_, i) => i);
    const dn = (arr) => codesX.slice(1, d.codes - 1).map((k) => [k, arr[k]]);
    const lim = Math.max(1, r.linRaw.peakDnl, r.linCal.peakDnl) * 1.1;
    document.getElementById('rd-dnl').innerHTML = plot({ width: 400,
      height: 230, x: { min: 0, max: d.codes, label: 'code' }, y: { min: -lim, max: lim, label: 'DNL [LSB]' },
      series: [{ points: dn(r.linRaw.dnl), color: C.muted, width: 1, label: 'design weights' }, { points: dn(r.linCal.dnl), color: C.a, width: 1.2, label: 'calibrated' }],
      legend: true,
    });
    document.getElementById('rd-dnl-cap').textContent = `Peak |DNL| ${num(r.linRaw.peakDnl, 2)} → ${num(r.linCal.peakDnl, 2)} LSB on the 10-bit codes (ramp histogram, 8 samples per code; comparator noise blurs it).`;
    const half = r.sRaw.spectrum.length;
    const sp = (s) => Array.from({ length: half - 1 }, (_, k) => [((k + 1) / (2 * (half - 1))) * P.fs / 1e6, s[k + 1]]);
    document.getElementById('rd-spec').innerHTML = plot({ width: 400,
      height: 230, x: { min: 0, max: P.fs / 2e6, label: 'frequency [MHz]' }, y: { min: -130, max: 5, label: 'dBFS' },
      series: [{ points: sp(r.sRaw.spectrum), color: C.muted, width: 0.8, label: `design ${num(r.sRaw.enob, 2)} bit` }, { points: sp(r.sCal.spectrum), color: C.a, width: 0.8, label: `calibrated ${num(r.sCal.enob, 2)} bit` }],
      legend: true,
    });
    document.getElementById('rd-spec-cap').textContent = `${r.J} cycles in 2048 points, coherent ${r.sRaw.coherent ? 'yes' : 'no'}; output ${P.outBits} bit. Includes comparator noise and the offset left after calibration.`;
    fillReadouts(document.getElementById('rd-ro'), [
      ['Decisions', `${d.decisions}`, d.decisions === 12 ? 'as planned (12)' : `you plan 12: ${d.decisions - 12 > 0 ? '+' : ''}${d.decisions - 12}`, d.decisions === 12 ? 'ok' : 'warn'],
      ['ENOB, this chip', `${num(r.sRaw.enob, 2)} → ${num(r.sCal.enob, 2)}`, 'design → calibrated', r.sCal.enob >= P.enobAim ? 'ok' : 'bad'],
      ['Monte Carlo yield', mcResult ? `${num((mcResult.enobCal.values.filter((x) => x >= P.enobAim).length / mcResult.n) * 100, 0)} %` : '…', `chips with ENOB ≥ ${num(P.enobAim, 1)}`],
      ['Unit capacitor', `${num(P.cu * 1e15, 0)} fF`, `σ one unit ${num((P.aC / Math.sqrt(P.cu * 1e15)), 2)} %`],
    ]);
    document.getElementById('rd-lut').innerHTML = `<table class="tbl"><thead><tr><th>Step</th><th>Design [LSB]</th><th>True [LSB]</th><th>Calibrated [LSB]</th></tr></thead><tbody>${d.weights
      .map((w, i) => `<tr><td>${i + 1}</td><td class="num">${num(w, 3)}</td><td class="num">${num(chip.wTrue[i], 3)}</td><td class="num">${num(r.cal.w[i], 3)}</td></tr>`)
      .join('')}</tbody></table><p class="note">Least squares on a ramp with known input (the lab version fits the sine phase too). The last decision and the offset term are solved with them.</p>`;
    document.getElementById('rd-ins').innerHTML =
      (P.outBits <= P.bits
        ? insight('Rounding the calibrated sum to 10 bits costs about half a bit', 'With mismatch, the calibrated sum lands between integer codes. Rounding it to 10 bits adds a second quantisation error of about 0.29 LSB rms. Try the combiner output resolution slider: 11 or 12 bits into the IQ demodulator keeps most of what calibration recovers.')
        : '') + (P.radix >= 2 ? check('Binary cannot be repaired', 'With radix 2.00 every tolerance is 0: a lost code stays lost, calibration only re-labels the codes that exist.') : '');
    document.getElementById('rd-math').innerHTML = [
      eq(v('t', 'i'), '=', `Σ<sub>j&gt;i</sub> ${v('w', 'j')} + 1 − ${v('w', 'i')}`),
      eq(v('D', 'out'), '=', `${v('c')} + Σ ${v('s', 'i')} ${v('w', 'i')}`, ',', v('s', 'i'), '=', '±1'),
      eq(t('Calibration: minimise'), `Σ<sub>k</sub> (${v('c')} + Σ ${v('s', 'ik')} ${v('w', 'i')} − ${v('x', 'k')})²`, t('over'), `${v('c')}, ${v('w', 'i')}`),
    ].join('');
    scheduleMc(P, d);
    drawMc(P);
  },
};

function scheduleMc(P, d) {
  const key = JSON.stringify([d.weights, P.cu, P.aC, P.chips, P.seed, P.vosCal, P.compNoise, P.outBits, P.vref]);
  if (key === mcKey) return;
  mcKey = key;
  mcResult = null;
  clearTimeout(mcTimer);
  if (cancelMc) cancelMc();
  const el = document.getElementById('rd-mc');
  if (el) el.innerHTML = '<div class="progress"><span style="width:0%"></span></div><p class="note">Running Monte Carlo…</p>';
  mcTimer = setTimeout(() => {
    cancelMc = runMonteCarlo(d, P, (f) => {
      const bar = document.querySelector('#rd-mc .progress span');
      if (bar) bar.style.width = `${(f * 100).toFixed(0)}%`;
    }, (res) => {
      mcResult = res;
      drawMc(P);
      const ro = document.querySelector('#rd-ro .ro:nth-child(3) .rv');
      if (ro) ro.textContent = `${num((res.enobCal.values.filter((x) => x >= P.enobAim).length / res.n) * 100, 0)} %`;
    });
  }, 350);
}

function hist(values, lo, hi, nb) {
  const h = new Array(nb).fill(0);
  for (const x of values) h[Math.max(0, Math.min(nb - 1, Math.floor(((x - lo) / (hi - lo)) * nb)))]++;
  return h;
}

function drawMc(P) {
  const el = document.getElementById('rd-mc');
  if (!el || !mcResult) return;
  const lo = Math.min(mcResult.enobRaw.min, mcResult.enobCal.min, P.enobAim) - 0.05;
  const hi = Math.max(mcResult.enobRaw.max, mcResult.enobCal.max, P.enobAim) + 0.05;
  const nb = 30;
  const step = (hi - lo) / nb;
  const toPts = (h) => h.map((c, i) => [lo + i * step, c]).concat([[hi, 0]]);
  const hr = hist(mcResult.enobRaw.values, lo, hi, nb);
  const hc = hist(mcResult.enobCal.values, lo, hi, nb);
  el.innerHTML = plot({
    height: 240, x: { min: lo, max: hi, label: 'ENOB [bit]' }, y: { min: 0, max: Math.max(...hr, ...hc) * 1.15, label: 'chips' },
    series: [{ points: toPts(hr), color: C.muted, step: true, width: 1.6, label: 'design weights' }, { points: toPts(hc), color: C.a, step: true, width: 2.2, label: 'calibrated' }],
    vlines: [{ x: P.enobAim, color: C.b, label: `aim ${num(P.enobAim, 1)}` }],
    legend: true,
  });
  const cap = document.getElementById('rd-mc-cap');
  if (cap) cap.textContent = `${mcResult.n} chips. Mean ENOB ${num(mcResult.enobRaw.mean, 2)} → ${num(mcResult.enobCal.mean, 2)} bit; worst ${num(mcResult.enobCal.min, 2)}. Worst |DNL| ${num(mcResult.dnlRaw.max, 2)} → ${num(mcResult.dnlCal.max, 2)} LSB (2 ramp samples per code, so DNL is coarse).`;
}

function directions() {
  const rows = [
    ['Raw redundant bits on chip, weights off chip', 'Simple chip; needs the 12 raw decisions off chip and an external solver in normal use.'],
    ['LMS and LUT fully on chip', 'Self-contained; costs digital area and power, and convergence must be verified.'],
    ['Foreground in MATLAB, raw bits off chip, LUT written back (review choice)', 'Small on-chip logic (LUT and adder); needs a calibration mode and a known test input once per chip.'],
  ];
  return `<table class="tbl"><thead><tr><th>Direction</th><th>What it costs</th></tr></thead><tbody>${rows.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</tbody></table>`;
}
