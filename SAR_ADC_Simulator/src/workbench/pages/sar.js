// SAR ADC page: design the weights (with or without charge halving for the LSBs),
// watch a conversion as buckets of charge, see what each decision needs from its
// tolerance, and let the optimizer search the weights.

import { group, knobs, card, fill, widthOf, plot, readouts, explain, eng, num, esc, COL, fv, fq } from '../kit.js';
import { PRESETS } from '../weights.js';
import { view, describe, maxState, S } from '../anim/sarAnim.js';
import { idealChip, convert, combine, designWeights } from '../../zaan/model/chargeSar.js';
import { createRng } from '../../model/rng.js';
import { termify } from '../terms.js';
import { failBox } from '../checks.js';
import { offsetLsb, comparatorCharge } from '../budget.js';

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
      group('Charge balance', knobs(store.values, ['cm', 'alpha', 'fullScale', 'bits', 'rawDecisions'], used)) +
      group('Comparator', knobs(store.values, ['vos', 'vosCal', 'compNoise'], used)) +
      group('In the bucket view', `<label class="chk"><input type="checkbox" id="useOff" ${ui.useOff ? 'checked' : ''}/> include the offset before calibration</label><label class="chk"><input type="checkbox" id="useNoise" ${ui.useNoise ? 'checked' : ''}/> include comparator noise</label><label class="chk"><input type="checkbox" id="useChip" ${ui.useChip ? 'checked' : ''}/> use the simulated chip (mismatch)</label>`, false);
  },
  main(store) {
    const m = store.ui.sarMode || 'diff';
    return `<div id="sarFails"></div><div id="wstrip" class="wstrip"></div><div id="sarErr"></div><div id="sarro"></div>
      <section class="card wide"><header><h3>One conversion, step by step</h3><span class="ctl">
        <span class="seg sm2"><button class="${m === 'diff' ? 'on' : ''}" data-sarmode="diff">differential</button><button class="${m === 'single' ? 'on' : ''}" data-sarmode="single">single-ended</button></span>
        <button class="mini" id="sBack">◀ step</button><button class="mini primary" id="sPlay">▶ play</button><button class="mini" id="sNext">step ▶</button><button class="mini" id="sReset">⏮</button>
        <label class="mini-l">input <input type="range" id="sVin" step="0.001"/> <output id="sVinO"></output></label></span></header>
        <div id="sarView"></div><p class="cap" id="sarSay"></p>
        <p class="cap">Left: the charge of the memory cells on the node. Each CDAC step is a capacitor precharged to VREF; after each decision it is connected with the polarity that pulls the charge towards zero (green +, magenta −). In the differential view one capacitor floats between node + and node − (dotted), so the two nodes get opposite charges. The charge is kept; the node capacitance grows with every step, so later steps see a smaller voltage per LSB.</p></section>
      <section class="card wide"><header><h3>What each decision needs from its tolerance</h3></header><div class="cbody" id="sTol"></div><p class="cap" id="sTol-cap"></p></section>
      <div class="grid2">${card('sWalk', 'The search: comparison level per decision')}${card('sTable', 'Charges per decision')}</div>
      <section class="card wide"><header><h3>Compare designs</h3><button class="mini" id="keepA">keep current as A</button></header><div class="cbody" id="sCmp"></div><p class="cap" id="sCmp-cap"></p></section>
      <section class="card wide"><header><h3>Circuit level: ngspice against Rabuske eq. 4.21</h3></header><div class="cbody" id="spiceCmp"><p class="cap">Loading the ngspice run…</p></div><p class="cap" id="spiceCmp-cap"></p></section>
      ${explain('Reading this page', [
        'The weights are the charges of the CDAC steps, in LSB. With radix 2 they halve every step (binary); with a smaller radix they shrink slower, so the later steps together reach further than one step: that surplus is the tolerance, which repairs a wrong early decision.',
        'Below one unit capacitor a step can be made by charge halving (a unit capacitor shares its charge with an empty unit capacitor, again and again) or by a physically smaller capacitor. Halving keeps every capacitor at the PDK minimum; small capacitors save area but go below 35 fF and match worse.',
        'Offset and noise of the comparator are voltages, but the node grows with every step. As charge they are v × C node, so the same offset counts more at later decisions. Calibration of the comparator lowers the offset; what is left shows in the tolerance chart.',
      ])}`;
  },
  mount(store) {
    spicePanel();
    const P = store.ctx.P;
    const vin = document.getElementById('sVin');
    vin.min = String(-P.fullScale / 2);
    vin.max = String(P.fullScale / 2);
    vin.value = String(store.ui.vin);
    vin.oninput = () => {
      store.ui.vin = Number(vin.value);
      S.state = maxState(store.ctx);
      S.from = S.state;
      page.update(store, store.ctx);
    };
    const go = (s) => {
      const next = Math.max(0, Math.min(maxState(store.ctx), s));
      S.from = S.state;
      S.state = next;
      tween(store);
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
          if (S.state >= maxState(store.ctx) || !document.getElementById('sarView')) {
            S.playing = false;
            clearInterval(S.timer);
            e.target.textContent = '▶ play';
          } else go(S.state + 1);
        }, 900);
      }
    };
    document.getElementById('keepA').onclick = () => {
      store.ui.compareA = summary(store.ctx, store.ui);
      page.update(store, store.ctx);
    };
  },
  update(store, ctx) {
    const { d, P, steps } = ctx;
    fill('sarFails', failBox(ctx, ['cover', 'tol', 'small', 'dec']));
    fill('wstrip', d.weights.map((w, i) => `<span class="wc ${steps[i].kind}" title="${steps[i].kind === 'cap' ? `${steps[i].units} unit capacitors` : steps[i].kind === 'small' ? `small capacitor ${eng(steps[i].units * P.cu, 'F')}` : 'charge halving'}">${num(w, w < 10 ? 2 : 0)}</span>`).join('') + `<span class="wn">LSB · <i class="k cap"></i>whole capacitors <i class="k half"></i>charge halving <i class="k small"></i>small capacitors</span>`);
    fill('sarErr', ctx.stepsError ? `<div class="warnbox">${esc(ctx.stepsError)} The generated weights are shown meanwhile.</div>` : '');
    const small = ctx.smallest < 35e-15 - 1e-21;
    fill('sarro', readouts([
      ['Decisions', `${d.decisions}`, `planned ${P.rawDecisions}`, d.decisions === P.rawDecisions ? 'ok' : 'warn', 'decisions'],
      ['Sum of the steps', `${num(d.cover.sum, 1)} LSB`, `${d.cover.need} needed`, d.cover.ok ? 'ok' : 'bad', 'cover'],
      ['One LSB as charge', eng(d.qLsb, 'C'), `${eng(d.qLsb / d.cNode[0], 'V')} at the input`, '', 'qlsb'],
      ['CDAC', eng(d.cdac, 'F'), `${num(d.units, 2)} units of ${eng(P.cu, 'F')}`, '', 'cdac'],
      ['Memory cell CM', eng(d.cm, 'F'), 'from the charge balance', '', 'cm'],
      ['Node at the last decision', eng(d.cNode[d.decisions - 1], 'F'), `1 LSB = ${eng(d.qLsb / d.cNode[d.decisions - 1], 'V')} there`, '', 'cnode'],
      ['Smallest capacitor', eng(ctx.smallest, 'F'), small ? 'below the 35 fF PDK minimum' : 'at or above 35 fF', small ? 'bad' : 'ok', 'smallest'],
    ]));
    const x = (store.ui.vin / P.fullScale) * d.codes;
    const chip = store.ui.useChip ? ctx.sim.chip : idealChip(d);
    S.trace = convert(chip, d, x, { vos: store.ui.useOff ? P.vos : 0, noise: store.ui.useNoise ? P.compNoise : 0, rng: createRng(7), trace: true });
    S.ctx = ctx;
    S.mode = store.ui.sarMode || 'diff';
    if (S.state > maxState(ctx)) S.state = maxState(ctx);
    S.from = S.state;
    document.getElementById('sVinO').textContent = `${num(store.ui.vin, 3)} V`;
    drawView(store);
    walk(ctx, chip, x);
    tolerance(ctx);
    table(ctx);
    compare(store, ctx);
  },
};

function tween(store) {
  cancelAnimationFrame(S.raf);
  const t0 = performance.now();
  const dur = S.state === S.from + 1 && S.state % 2 === 0 ? 650 : 0;
  const tick = (now) => {
    S.f = dur ? Math.min(1, (now - t0) / dur) : 1;
    drawView(store);
    if (S.f < 1) S.raf = requestAnimationFrame(tick);
  };
  S.raf = requestAnimationFrame(tick);
}

function drawView(store) {
  const w = widthOf('sarView', 1000);
  fill('sarView', view(S.ctx, S.trace, S.state, Math.max(560, w), S.mode, S.f, S.from));
  const code = combine(S.trace.dec, designWeights(S.ctx.d), S.ctx.d.codes);
  fill('sarSay', `${describe(S.ctx, S.trace, S.state, S.mode)}${S.state === maxState(S.ctx) ? ` Output code ${code} (ideal ${Math.max(0, Math.min(S.ctx.d.codes - 1, Math.floor((store.ui.vin / S.ctx.P.fullScale) * S.ctx.d.codes + S.ctx.d.codes / 2)))}).` : ''}`);
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

/** Rows per decision: stacked need (mismatch, offset after calibration, noise) against the tolerance + ½ LSB. */
function tolerance(ctx) {
  const rows = ctx.tolNeed;
  const w = Math.max(340, widthOf('sTol'));
  const rh = 26;
  const L = 96;
  const R = 70;
  const xmax = Math.max(1.5, ...rows.map((r) => r.need + r.noise), ...rows.map((r) => r.mismatch + r.offsetRaw)) * 1.15;
  const sx = (v) => L + (Math.min(v, xmax) / xmax) * (w - L - R);
  const H = 40 + rows.length * rh + 30;
  const p = [`<svg viewBox="0 0 ${w} ${H}" class="tsvg tolc" role="img" aria-label="Tolerance needed against available">`];
  const ticks = [0, 0.5, 1, 2, 3, 4, 5, 8, 10, 20].filter((t) => t <= xmax);
  for (const t of ticks) p.push(`<line x1="${sx(t)}" x2="${sx(t)}" y1="30" y2="${H - 26}" class="tick"/><text x="${sx(t)}" y="${H - 10}" class="tiny" text-anchor="middle">${t}</text>`);
  p.push(`<text x="${w - 8}" y="${H - 10}" class="tiny" text-anchor="end">LSB</text>`);
  rows.forEach((r, i) => {
    const y = 34 + i * rh;
    const have = r.have + 0.5;
    p.push(`<text x="8" y="${y + 15}" class="lbl">decision ${r.i + 1}</text>`);
    let acc = 0;
    for (const [val, cls] of [[r.mismatch, 'tn-mis'], [r.offset, 'tn-off'], [r.noise, 'tn-noise']]) {
      p.push(`<rect x="${sx(acc)}" y="${y + 3}" width="${Math.max(0, sx(acc + val) - sx(acc))}" height="${rh - 9}" class="${cls}"/>`);
      acc += val;
    }
    p.push(`<line x1="${sx(r.mismatch + r.offsetRaw)}" x2="${sx(r.mismatch + r.offsetRaw)}" y1="${y + 1}" y2="${y + rh - 4}" class="tn-raw"/>`);
    if (!r.last) {
      const hx = sx(have);
      p.push(`<line x1="${hx}" x2="${hx}" y1="${y}" y2="${y + rh - 3}" class="tn-have ${r.ok ? '' : 'bad'}"/>`);
      if (have > xmax) p.push(`<text x="${w - R + 6}" y="${y + 15}" class="tiny">${num(r.have, 0)} + ½ →</text>`);
      else if (!r.ok) p.push(`<text x="${w - R + 6}" y="${y + 15}" class="tiny bad">short</text>`);
    } else p.push(`<text x="${w - R + 6}" y="${y + 15}" class="tiny">no repair</text>`);
  });
  p.push(`<g class="tleg"><rect x="${L}" y="8" width="12" height="12" class="tn-mis"/><text x="${L + 16}" y="18" class="tiny">DAC mismatch 3σ</text><rect x="${L + 150}" y="8" width="12" height="12" class="tn-off"/><text x="${L + 166}" y="18" class="tiny">offset against the last decision</text><rect x="${L + 400}" y="8" width="12" height="12" class="tn-noise"/><text x="${L + 416}" y="18" class="tiny">comparator noise 3σ</text></g>`);
  p.push('</svg>');
  const P = ctx.P;
  const d = ctx.d;
  fill('sTol', p.join(''), `Green line: the tolerance plus ½ LSB, what the later steps can still repair. The need for the check is ${fv('need', 'mismatch + offset')}; comparator noise is drawn on top but counted in the ${fv('b-comp', 'noise budget')}, since an unrepaired noise error is output noise. White tick: mismatch + the offset before calibration (${eng(P.vos, 'V')}); calibration brings it to ${eng(P.vosCal, 'V')}. The offset as charge grows with the node, ${num(offsetLsb(d, P.vosCal, 0).total, 2)} LSB at decision 1 to ${num(offsetLsb(d, P.vosCal, d.decisions - 1).total, 2)} LSB at the last; only the difference from the last uses tolerance, the rest shifts every code equally. Comparator noise as charge: ${fq(ctx, comparatorCharge(P, d, 0), true)} at decision 1, ${fq(ctx, comparatorCharge(P, d, d.decisions - 1), true)} at the last.`);
}

function table(ctx) {
  const { d, P } = ctx;
  const n = d.decisions;
  const rows = S.trace.steps.slice(0, n).map((s, i) => `<tr><td>${i + 1}</td><td class="num">${i < n - 1 ? num(d.weights[i], 2) : 'none'}</td><td class="num">${num(s.Q * 1e15, 3)}</td><td class="num">${num(s.cn * 1e12, 3)}</td><td class="num">${num(s.v * 1e3, 3)}</td><td class="num">${num(offsetLsb(d, P.vosCal, i).total, 2)}</td><td class="num">${num(comparatorCharge(P, d, i) / d.qLsb, 3)}</td><td>${s.bit}</td></tr>`).join('');
  fill('sTable', `<div class="tablewrap"><table class="tbl"><thead><tr><th>Decision</th><th>Step [LSB]</th><th>Q diff [fC]</th><th>C node [pF]</th><th>V diff [mV]</th><th>Offset [LSB]</th><th>Noise σ [LSB]</th><th>Bit</th></tr></thead><tbody>${rows}</tbody></table></div>`, `Before each decision. Offset after calibration and comparator noise, both as charge on the node in LSB: v × C node / Q LSB.`);
}

export function summary(ctx, ui) {
  const { d, P } = ctx;
  return {
    label: ui.weightMode === 'custom' ? 'typed list' : `radix ${num(P.radix, 2)}, ${P.halvingOn}`,
    weights: d.weights.slice(), tol: d.tol.slice(), decisions: d.decisions, sum: d.cover.sum, units: d.units, cdac: d.cdac, cm: d.cm, smallest: ctx.smallest, area: ctx.areaTotal, enobRaw: ctx.sim.sRaw.enob, enobCal: ctx.sim.sCal.enob, enob: ctx.budget.enob,
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
  fill('sCmp', `<div class="tablewrap"><table class="tbl"><thead><tr><th></th><th>A: ${esc(A.label)}</th><th>current: ${esc(C.label)}</th></tr></thead><tbody>
    ${row('weights', A.weights.map((w) => num(w, 2)).join(' '), C.weights.map((w) => num(w, 2)).join(' '))}
    ${row('decisions', A.decisions, C.decisions)}${row('sum of steps [LSB]', num(A.sum, 1), num(C.sum, 1))}
    ${row('first tolerance [LSB]', num(A.tol[0], 1), num(C.tol[0], 1))}${row('unit capacitors', num(A.units, 2), num(C.units, 2))}
    ${row('CDAC', eng(A.cdac, 'F'), eng(C.cdac, 'F'))}${row('memory cell', eng(A.cm, 'F'), eng(C.cm, 'F'))}
    ${row('smallest capacitor', eng(A.smallest, 'F'), eng(C.smallest, 'F'))}${row('capacitor area [mm²]', num(A.area * 1e6, 4), num(C.area * 1e6, 4))}
    ${row('ENOB from the charge budget', num(A.enob ?? NaN, 2), num(C.enob, 2))}${row('ENOB one chip, calibrated, no kT/C', num(A.enobCal, 2), num(C.enobCal, 2))}
  </tbody></table></div>`, 'Same chip seed for both; for many chips use the Mismatch page.');
}

/** Circuit-level panel: the ngspice transient of the charge-sharing steps (spice/export.mjs) and eq. 4.21. */
async function spicePanel() {
  let data;
  try {
    data = await (await fetch('src/workbench/data/spice-charge.json')).json();
  } catch {
    fill('spiceCmp', '<p class="cap">No ngspice run found. Run node spice/export.mjs with ngspice installed.</p>');
    return;
  }
  const ns = (t) => t * 1e9;
  const sim = data.t.map((t, i) => [ns(t), data.vpn[i] * 1e3]);
  const eq = [];
  data.steps.forEach((st, i) => { eq.push([ns(i * data.tStep), st.eq * 1e3], [ns((i + 1) * data.tStep), st.eq * 1e3]); });
  const ys = data.vpn.map((v) => v * 1e3);
  const pad = (Math.max(...ys) - Math.min(...ys)) * 0.08;
  const rows = data.steps.map((st, i) => `<tr><td>${i === 0 ? 'sampled' : `after step ${i}`}</td><td class="num">${num(st.spice * 1e3, 4)} mV</td><td class="num">${num(st.eq * 1e3, 4)} mV</td><td class="num">${num((st.spice - st.eq) * 1e6, 2)} µV</td></tr>`).join('');
  fill('spiceCmp', plot({ height: 240, legend: true, x: { min: 0, max: ns(data.t[data.t.length - 1]), label: 'time [ns]' }, y: { min: Math.min(...ys) - pad, max: Math.max(...ys) + pad, label: 'V P − V N [mV]' },
    series: [{ points: eq, color: COL.ref, width: 2.5, dash: '6 4', label: 'eq. 4.21' }, { points: sim, color: COL.an, width: 1.6, label: 'ngspice' }] }, widthOf('spiceCmp'))
    + `<div class="tablewrap"><table class="tbl"><thead><tr><th>Moment</th><th>ngspice</th><th>eq. 4.21</th><th>difference</th></tr></thead><tbody>${rows}</tbody></table></div>`,
  `Circuit: two sampling capacitors C TH = ${eng(data.config.cTh, 'F')} holding ${num((data.config.vinP - data.config.vinN) * 1e3, 0)} mV, and three precharged DAC capacitors (${data.config.steps.map((s) => eng(s.c, 'F')).join(', ')}, V PC = ${eng(data.config.vpc, 'V')}) connected one after another, ${data.config.steps.map((s) => (s.sign > 0 ? 'parallel' : 'antiparallel')).join(', ')}. Ideal switches of ${data.ron} Ω; each value read just before the next switch closes. Example values, not the design. Transistor switches need the PDK models. ngspice ${esc(data.ngspice)}, run on ${data.generated} by spice/export.mjs; the test suite checks that this run still agrees.`);
}
