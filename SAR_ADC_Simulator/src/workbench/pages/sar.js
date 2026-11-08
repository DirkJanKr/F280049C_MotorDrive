// SAR ADC page: design the weights (with or without charge halving for the LSBs),
// then step through a differential charge-sharing conversion and compare designs.

import { group, knobs, card, fill, widthOf, plot, bars, readouts, explain, eng, num, esc, COL } from '../kit.js';
import { PRESETS } from '../weights.js';
import { view, describe, maxState, S } from '../anim/sarAnim.js';
import { idealChip, convert, combine, designWeights } from '../../zaan/model/chargeSar.js';
import { createRng } from '../../model/rng.js';
import { termify } from '../terms.js';

export const page = {
  id: 'sar',
  title: 'SAR ADC',
  side(store) {
    const used = new Set();
    const ui = store.ui;
    const gen = ui.weightMode !== 'custom';
    const presets = `<label class="kl">Start from a preset</label><select id="preset" class="sel"><option value="">choose…</option>${Object.keys(PRESETS).map((p) => `<option>${esc(p)}</option>`).join('')}</select>`;
    const mode = `<div class="seg"><button class="${gen ? 'on' : ''}" data-mode="generator">generate from radix</button><button class="${gen ? '' : 'on'}" data-mode="custom">type the weights</button></div>`;
    const genKnobs = knobs(store.values, ['radix', 'topUnits', 'halvings'], used);
    const list = `<label class="kl" for="wlist">${termify('Weights in LSB, largest first', used)}</label><textarea id="wlist" class="wl-in" rows="3">${esc(ui.customWeights)}</textarea><p class="ks">Steps of one unit or more are whole capacitors; smaller steps follow the choice below.</p>`;
    return group('Weights', mode + presets + (gen ? genKnobs : list) + knobs(store.values, ['halvingOn', 'lsbPerUnit'], used)) +
      group('CDAC and reference', knobs(store.values, ['cu', 'vref', 'fullScale', 'bits', 'rawDecisions'], used)) +
      group('Comparator in this view', `<label class="chk"><input type="checkbox" id="useOff" ${ui.useOff ? 'checked' : ''}/> include the offset before calibration</label><label class="chk"><input type="checkbox" id="useNoise" ${ui.useNoise ? 'checked' : ''}/> include comparator noise</label><label class="chk"><input type="checkbox" id="useChip" ${ui.useChip ? 'checked' : ''}/> use the simulated chip (mismatch)</label>` + knobs(store.values, ['vos', 'compNoise'], used), false);
  },
  main() {
    return `<div id="wstrip" class="wstrip"></div><div id="sarErr"></div><div id="sarro"></div>
      <section class="card wide"><header><h3>One differential conversion, step by step</h3><span class="ctl">
        <button class="mini" id="sBack">◀ step</button><button class="mini primary" id="sPlay">▶ play</button><button class="mini" id="sNext">step ▶</button><button class="mini" id="sReset">⏮</button>
        <label class="mini-l">input <input type="range" id="sVin" step="0.001"/> <output id="sVinO"></output></label></span></header>
        <div id="sarView"></div><p class="cap" id="sarSay"></p></section>
      <div class="grid2">${card('sWalk', 'The search: comparison level per decision')}${card('sTol', 'Tolerance per decision (redundancy)')}</div>
      <div class="grid2">${card('sTable', 'Charges per decision, both sides')}${card('sCmp', 'Compare designs', '<button class="mini" id="keepA">keep current as A</button>')}</div>
      ${explain('Reading this page', [
        'The weights are the charges of the CDAC steps, in LSB. With radix 2 they halve every step (binary); with a smaller radix they shrink slower, so the later steps together can reach further than one step: that surplus is the tolerance, which repairs a wrong early decision.',
        'Below one unit capacitor a step can be made by charge halving (a unit capacitor shares its charge with an empty unit capacitor, again and again) or by a physically smaller capacitor. Halving keeps every capacitor at the PDK minimum; small capacitors save area but go below 35 fF and match worse.',
        'Every step is a capacitor pair, one on each side. After each decision the pair is shared onto the node with a polarity that pulls the difference V+ − V− towards zero. The charge is kept; the node capacitance grows, so later steps see a smaller voltage per LSB.',
      ])}`;
  },
  mount(store) {
    const P = store.ctx.P;
    const vin = document.getElementById('sVin');
    vin.min = String(-P.fullScale / 2);
    vin.max = String(P.fullScale / 2);
    vin.value = String(store.ui.vin);
    vin.oninput = () => {
      store.ui.vin = Number(vin.value);
      S.state = maxState(store.ctx);
      page.update(store, store.ctx);
    };
    const go = (s) => {
      S.state = Math.max(0, Math.min(maxState(store.ctx), s));
      drawView(store);
    };
    document.getElementById('sBack').onclick = () => go(S.state - 1);
    document.getElementById('sNext').onclick = () => go(S.state + 1);
    document.getElementById('sReset').onclick = () => go(0);
    document.getElementById('sPlay').onclick = (e) => {
      S.playing = !S.playing;
      e.target.textContent = S.playing ? '❚❚ pause' : '▶ play';
      clearInterval(S.timer);
      if (S.playing) {
        if (S.state >= maxState(store.ctx)) S.state = 0;
        S.timer = setInterval(() => {
          if (S.state >= maxState(store.ctx)) {
            S.playing = false;
            clearInterval(S.timer);
            e.target.textContent = '▶ play';
          } else go(S.state + 1);
        }, 650);
      }
    };
    document.getElementById('keepA').onclick = () => {
      store.ui.compareA = summary(store.ctx, store.ui);
      page.update(store, store.ctx);
    };
  },
  update(store, ctx) {
    const { d, P, steps } = ctx;
    fill('wstrip', d.weights.map((w, i) => `<span class="wc ${steps[i].kind}" title="${steps[i].kind === 'cap' ? `${steps[i].units} unit capacitors` : steps[i].kind === 'small' ? `small capacitor ${eng(steps[i].units * P.cu, 'F')}` : 'charge halving'}">${num(w, w < 10 ? 2 : 0)}</span>`).join('') + `<span class="wn">LSB · <i class="k cap"></i>whole capacitors <i class="k half"></i>charge halving <i class="k small"></i>small capacitors</span>`);
    fill('sarErr', ctx.stepsError ? `<div class="warnbox">${esc(ctx.stepsError)} The generated weights are shown meanwhile.</div>` : !d.cover.ok ? `<div class="warnbox">The steps add up to ${num(d.cover.sum, 0)} LSB; ${d.cover.need} are needed to reach both ends of the range, so codes near full scale are lost.</div>` : '');
    const small = ctx.smallest < 35e-15 - 1e-21;
    fill('sarro', readouts([
      ['Decisions', `${d.decisions}`, `planned ${P.rawDecisions}`, d.decisions === P.rawDecisions ? 'ok' : 'warn'],
      ['Sum of the steps', `${num(d.cover.sum, 1)} LSB`, `${d.cover.need} needed`, d.cover.ok ? 'ok' : 'bad'],
      ['First tolerance', `${num(d.tol[0], 1)} LSB`, 'repair room after decision 1'],
      ['CDAC', eng(d.cdac, 'F'), `${num(d.units, 2)} units of ${eng(P.cu, 'F')}`],
      ['Memory cell CM', eng(d.cm, 'F'), 'from the charge balance'],
      ['Smallest capacitor', eng(ctx.smallest, 'F'), small ? 'below the 35 fF PDK minimum' : 'at or above 35 fF', small ? 'bad' : 'ok'],
      ['ENOB, one chip', `${num(ctx.sim.sRaw.enob, 2)} → ${num(ctx.sim.sCal.enob, 2)}`, 'design → calibrated weights'],
    ]));
    // conversion trace
    const x = (store.ui.vin / P.fullScale) * d.codes;
    const chip = store.ui.useChip ? ctx.sim.chip : idealChip(d);
    S.trace = convert(chip, d, x, { vos: store.ui.useOff ? P.vos : 0, noise: store.ui.useNoise ? P.compNoise : 0, rng: createRng(7), trace: true });
    S.ctx = ctx;
    if (S.state > maxState(ctx)) S.state = maxState(ctx);
    document.getElementById('sVinO').textContent = `${num(store.ui.vin, 3)} V`;
    drawView(store);
    walk(ctx, chip, x);
    tolerance(store, ctx);
    table(ctx);
    compare(store, ctx);
  },
};

function drawView(store) {
  const w = widthOf('sarView', 1000);
  fill('sarView', view(S.ctx, S.trace, S.state, w));
  const code = combine(S.trace.dec, designWeights(S.ctx.d), S.ctx.d.codes);
  fill('sarSay', `${describe(S.ctx, S.trace, S.state)}${S.state === maxState(S.ctx) ? ` Output code ${code} (ideal ${Math.max(0, Math.min(S.ctx.d.codes - 1, Math.floor((store.ui.vin / S.ctx.P.fullScale) * S.ctx.d.codes + S.ctx.d.codes / 2)))}).` : ''}`);
}

function walk(ctx, chip, x) {
  const { d } = ctx;
  const n = d.decisions;
  const xc = x + d.codes / 2;
  const wTrue = chip.q.map((q) => q / d.qLsb);
  const lv = [d.codes / 2];
  for (let i = 0; i < n - 1; i++) lv.push(lv[i] + (S.trace.dec[i] ? 1 : -1) * wTrue[i]);
  const reach = lv.map((_, i) => wTrue.slice(i).reduce((a, w) => a + w, 0));
  const w = widthOf('sWalk');
  fill('sWalk', plot({
    height: 260, x: { min: 0.5, max: n + 0.5, label: 'decision', ticks: Array.from({ length: n }, (_, i) => i + 1) }, y: { min: 0, max: d.codes, label: 'level [code]' },
    series: [{ points: lv.map((L, i) => [i + 1, L]), color: COL.an, width: 2 }, { points: lv.map((L, i) => [i + 1, L]), color: COL.an, mode: 'dots', r: 4 }],
    hlines: [{ y: xc, color: COL.ref, dash: '6 3', width: 1.5 }],
    overlay: (sx, sy) => lv.map((L, i) => `<rect x="${sx(i + 1) - 7}" y="${sy(Math.min(d.codes, L + reach[i] + 0.5))}" width="14" height="${Math.abs(sy(Math.max(0, L - reach[i] - 0.5)) - sy(Math.min(d.codes, L + reach[i] + 0.5)))}" rx="3" fill="${Math.abs(xc - L) <= reach[i] + 0.5 ? 'var(--dig)' : 'var(--bad)'}" opacity="0.2"/>`).join(''),
  }, w), 'Dashed: the input. Bars: what the remaining steps can still reach; while the input stays inside, a wrong decision is repaired.');
}

function tolerance(store, ctx) {
  const { d } = ctx;
  const A = store.ui.compareA;
  const n = Math.max(d.decisions, A ? A.tol.length : 0);
  const labels = Array.from({ length: n }, (_, i) => `${i + 1}`);
  const series = [{ label: 'current', values: labels.map((_, i) => d.tol[i] ?? NaN), color: 'var(--an)' }];
  if (A) series.push({ label: `A: ${A.label}`, values: labels.map((_, i) => A.tol[i] ?? NaN), color: 'var(--ref)' });
  fill('sTol', bars({ labels, series, height: 240, y: { label: 'LSB' } }, widthOf('sTol')), 't = (sum of later steps) + 1 − w. Binary gives 0 everywhere: one wrong decision is never repaired.');
}

function table(ctx) {
  const { d } = ctx;
  const n = d.decisions;
  const rows = S.trace.steps.slice(0, n).map((s, i) => `<tr><td>${i + 1}</td><td class="num">${i < n - 1 ? num(d.weights[i], 2) : 'none'}</td><td class="num">${num((s.Q / 2) * 1e15, 2)}</td><td class="num">${num((-s.Q / 2) * 1e15, 2)}</td><td class="num">${num(s.Q * 1e15, 2)}</td><td class="num">${num(s.cn * 1e12, 3)}</td><td class="num">${num(s.v * 1e3, 3)}</td><td>${s.bit}</td></tr>`).join('');
  fill('sTable', `<div class="tablewrap"><table class="tbl"><thead><tr><th>Decision</th><th>Step [LSB]</th><th>Q+ [fC]</th><th>Q− [fC]</th><th>Q diff [fC]</th><th>C node [pF]</th><th>V diff [mV]</th><th>Bit</th></tr></thead><tbody>${rows}</tbody></table></div>`, 'Before each decision. Per side assuming a symmetric pair around a constant common mode (assumption); the differential charge follows the charge-sharing model.');
}

export function summary(ctx, ui) {
  const { d, P } = ctx;
  return {
    label: ui.weightMode === 'custom' ? 'typed list' : `radix ${num(P.radix, 2)}, ${P.halvingOn}`,
    weights: d.weights.slice(), tol: d.tol.slice(), decisions: d.decisions, sum: d.cover.sum, units: d.units, cdac: d.cdac, cm: d.cm, smallest: ctx.smallest, area: ctx.areaTotal, enobRaw: ctx.sim.sRaw.enob, enobCal: ctx.sim.sCal.enob,
  };
}

function compare(store, ctx) {
  const A = store.ui.compareA;
  const C = summary(ctx, store.ui);
  if (!A) {
    fill('sCmp', '<p class="cap">Press keep current as A, change the weights, and the two designs appear side by side here.</p>');
    return;
  }
  const row = (k, a, c) => `<tr><td>${k}</td><td class="num">${a}</td><td class="num">${c}</td></tr>`;
  fill('sCmp', `<table class="tbl"><thead><tr><th></th><th>A: ${esc(A.label)}</th><th>current: ${esc(C.label)}</th></tr></thead><tbody>
    ${row('weights', A.weights.map((w) => num(w, 2)).join(' '), C.weights.map((w) => num(w, 2)).join(' '))}
    ${row('decisions', A.decisions, C.decisions)}${row('sum of steps [LSB]', num(A.sum, 1), num(C.sum, 1))}
    ${row('first tolerance [LSB]', num(A.tol[0], 1), num(C.tol[0], 1))}${row('unit capacitors', num(A.units, 2), num(C.units, 2))}
    ${row('CDAC', eng(A.cdac, 'F'), eng(C.cdac, 'F'))}${row('memory cell', eng(A.cm, 'F'), eng(C.cm, 'F'))}
    ${row('smallest capacitor', eng(A.smallest, 'F'), eng(C.smallest, 'F'))}${row('capacitor area [mm²]', num(A.area * 1e6, 4), num(C.area * 1e6, 4))}
    ${row('ENOB one chip, design weights', num(A.enobRaw, 2), num(C.enobRaw, 2))}${row('ENOB one chip, calibrated', num(A.enobCal, 2), num(C.enobCal, 2))}
  </tbody></table>`, 'Same chip seed for both; for many chips use the Mismatch page.');
}
