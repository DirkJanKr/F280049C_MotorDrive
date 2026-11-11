// Levels page: what mismatch does to the levels of the converter, and what rounding to the
// output bits then does. Three rows on one input axis (in LSB):
//   1 a perfect chip: every level is 1 LSB wide and its value is a whole code
//   2 this chip (simulated mismatch): the levels have moved; the tick is the calibrated value y
//   3 the output codes after rounding y; a code is red when no level lands on it, amber when two do
// Levels are found by converting a fine ramp without noise and grouping equal decisions.

import { group, knobs, fill, widthOf, readouts, explain, num, esc, plot, COL } from '../kit.js';
import { idealChip, convert, designWeights, drawChip, combine } from '../../zaan/model/chargeSar.js';
import { designCdac } from '../../zaan/model/cdac.js';
import { buildSteps } from '../../zaan/model/steps.js';
import { leastSquaresWeights } from '../../zaan/model/calibrate.js';
import { sineMetrics, rampLinearity, coherentCycles } from '../../zaan/model/analysis.js';
import { createRng } from '../../model/rng.js';

// Item 5: weight lists for the test. M = decisions, w_M = last step.
const TEST = [
  ['11 decisions, last step 1', { radix: 2, topUnits: 33, halvings: 3 }],
  ['12 decisions, last step 1', { radix: 1.9, topUnits: 32, halvings: 3 }],
  ['12 decisions, last step ½', { radix: 2, topUnits: 33, halvings: 4 }],
  ['13 decisions, last step ½', { radix: 1.9, topUnits: 32, halvings: 4 }],
  ['14 decisions, last step ¼', { radix: 1.9, topUnits: 32, halvings: 5 }],
];

/** One list on `chips` chips: ENOB of (a) real-valued, (b) 10 bit, (c) 11 and 12 bit; DNL, missing codes, largest level gap. */
function testList(P, o, chips) {
  const d = designCdac(P, P.memCells, buildSteps({ ...o, halvingOn: true }));
  const M = 2048;
  const J = coherentCycles(M, 0.1);
  const A = (d.codes / 2) * 10 ** (-0.5 / 20);
  const acc = { sndr: 0, inl: 0, a: 0, b: 0, c1: 0, c2: 0, dnl: 0, miss: 0, gap: 0 };
  for (let k = 0; k < chips; k++) {
    const chip = drawChip(d, P, createRng(P.seed + 17 * (k + 1)));
    const xs = [];
    for (let j = 0; j < d.codes * 16; j++) xs.push((j + 0.5) / 16);
    const decR = xs.map((x) => convert(chip, d, x - d.codes / 2, { vos: P.vosCal }));
    const cw = leastSquaresWeights(decR, xs);
    const decS = [];
    for (let i = 0; i < M; i++) decS.push(convert(chip, d, A * Math.sin((2 * Math.PI * J * i) / M), { vos: P.vosCal }));
    const enob = (f) => sineMetrics(decS.map((q) => combine(q, cw, d.codes, f)), J, P.bits).enob;
    acc.a += enob(10);
    acc.b += enob(0);
    acc.c1 += enob(1);
    acc.c2 += enob(2);
    const lin = rampLinearity(decR.map((q) => combine(q, cw, d.codes)), d.codes);
    acc.dnl += lin.peakDnl;
    acc.inl += lin.peakInl;
    acc.sndr += sineMetrics(decS.map((q) => combine(q, cw, d.codes, 0)), J, P.bits).sndr;
    acc.miss += lin.missing;
    // largest gap between neighbouring reachable values, away from the ends
    const ys = [...new Set(decR.slice(16 * 16, -16 * 16).map((q) => Math.round(combine(q, cw, d.codes, 12) * 4096) / 4096))].sort((p, q) => p - q);
    let g = 0;
    for (let i = 1; i < ys.length; i++) g = Math.max(g, ys[i] - ys[i - 1]);
    acc.gap = Math.max(acc.gap, g);
  }
  const m = (x) => x / chips;
  return { d, a: m(acc.a), b: m(acc.b), c1: m(acc.c1), c2: m(acc.c2), sndr: m(acc.sndr), inl: m(acc.inl), dnl: m(acc.dnl), miss: m(acc.miss), gap: acc.gap };
}


/** Levels in [x0, x1] (codes): input interval and combined value y for each run of equal decisions. */
function levels(chip, d, cw, x0, x1, vos) {
  const out = [];
  const step = 1 / 64;
  let prev = null;
  for (let x = x0; x <= x1; x += step) {
    const dec = convert(chip, d, x - d.codes / 2, { vos });
    const key = dec.join('');
    if (key !== prev) {
      let y = cw.c;
      for (let i = 0; i < dec.length; i++) y += (dec[i] ? 1 : -1) * cw.w[i];
      out.push({ a: x, b: x, y: y + 0.5 });
      prev = key;
    }
    out[out.length - 1].b = x + step;
  }
  return out.filter((l) => l.b - l.a > 0.03);
}

export const page = {
  id: 'levels',
  title: 'Levels and rounding',
  side(store) {
    const used = new Set();
    return group('Mismatch', knobs(store.values, ['pairSigma', 'cm', 'seed'], used)) + group('Output', knobs(store.values, ['outBits', 'halvings'], used));
  },
  main(store) {
    return `<div id="lvro"></div>
      <section class="card wide"><header><h3>One sample: from the raw decisions to the 10-bit word</h3><span class="ctl"><label class="mini-l">input <input type="range" id="lvAt" min="40" max="980" step="1" value="${store.ui.lvAt || 262}"/> <output id="lvAtO"></output></label></span></header>
        <div class="cbody" id="lvBits"></div><p class="cap" id="lvBits-cap"></p></section>
      <section class="card wide"><header><h3>The same over a range of inputs: error of the output</h3></header><div class="cbody" id="lvRange"></div><p class="cap" id="lvRange-cap"></p></section>
      <section class="card wide"><header><h3>All inputs: how much error each output width has</h3></header><div class="cbody" id="lvRms"></div><p class="cap" id="lvRms-cap"></p></section>
      <section class="card wide"><header><h3>Test: is rounding back to 10 bit a real loss?</h3><button class="mini primary" id="lvRun">▶ run on 8 chips per list</button></header><div class="cbody" id="lvTest"><p class="cap">Press run. For each weight list, chips with mismatch are calibrated and a sine and a ramp are converted without comparator noise.</p></div><p class="cap" id="lvTest-cap"></p></section>
      ${explain('Why rounding costs so much here', [
        'The converter makes its raw decisions and adds them with the weights measured for this chip. Those weights are not whole numbers, so the sum is not a whole number either: the converter knows the input more finely than one LSB grid.',
        'A 10-bit word has only whole codes. Rounding the sum to it throws that finer knowledge away. The levels of the converter are about one LSB apart and the grid is one LSB wide, but the two do not line up, so this is a second quantisation on top of the first.',
        'Two quantisations of one LSB each add up to about 0.4 LSB rms, where one alone gives 0.29: half a bit. Keeping one or two more bits in the word, or making the last step of the search half an LSB, removes most of it.',
      ])}`;
  },
  mount(store) {
    document.getElementById('lvRun').onclick = (e) => runTest(store.ctx, e.target);
    document.getElementById('lvAt').oninput = (e) => {
      store.ui.lvAt = Number(e.target.value);
      draw(store.ctx);
    };
  },
  update(store, ctx) {
    const { res, d, P } = ctx;
    fill('lvro', readouts([
      ['Error of the levels alone', `${num(res.sar, 3)} LSB rms`, 'perfect weights, no rounding', '', 'b-sar'],
      ['Added by rounding', `${num(res.round, 3)} LSB rms`, `to ${Math.round(P.outBits)} output bits`, res.round > 0.2 ? 'bad' : 'ok', 'b-round'],
      ['Together', `${num(Math.hypot(res.sar, res.round), 3)} LSB rms`, 'an ideal 10-bit converter has 0.289'],
      ['Smallest step', `${num(Math.min(...d.weights), 2)} LSB`, 'sets how far apart the levels are'],
    ]));
    draw(ctx);
  },
};

function draw(ctx) {
  return drawBits(ctx);
  const { d, P, sim } = ctx;
  const at = ctx.ui.lvAt || 262;
  document.getElementById('lvAtO').textContent = String(at);
  const x0 = at - 5;
  const x1 = at + 5;
  const w = Math.max(340, widthOf('lvView'));
  const L = 110;
  const sx = (x) => L + ((x - x0) / (x1 - x0)) * (w - L - 16);
  const fb = Math.max(0, Math.round(P.outBits - P.bits));
  const q = 2 ** -fb;
  const perfect = levels(idealChip(d), d, designWeights(d), x0, x1, 0);
  const real = levels(sim.chip, d, sim.cal, x0, x1, P.vosCal);
  const hits = {};
  for (const l of real) {
    l.sliver = l.b - l.a <= 0.3; // overlap of redundant paths, not a level of its own
    if (l.sliver) continue;
    const c = Math.round((l.y - 0.5) / q) * q;
    hits[c] = (hits[c] || 0) + 1;
    l.code = c;
  }
  const box = (l, y, cls) => `<rect x="${sx(Math.max(l.a, x0))}" y="${y}" width="${Math.max(1, sx(Math.min(l.b, x1)) - sx(Math.max(l.a, x0)) - 1.5)}" height="34" rx="4" class="${cls}"/>`;
  const p = [`<svg viewBox="0 0 ${w} 330" class="tsvg lvsvg" role="img" aria-label="Levels of a perfect chip, of this chip, and the output codes">`];
  p.push(`<text x="6" y="52" class="lbl">perfect chip</text><text x="6" y="152" class="lbl">this chip</text><text x="6" y="262" class="lbl">output codes</text>`);
  for (const l of perfect) p.push(box(l, 30, 'lv-p') + (l.y > x0 && l.y < x1 ? `<line x1="${sx(l.y)}" x2="${sx(l.y)}" y1="30" y2="64" class="lv-t"/>` : ''));
  for (const l of real) {
    p.push(box(l, 130, 'lv-r'));
    if (!l.sliver && l.y > x0 && l.y < x1) p.push(`<line x1="${sx(l.y)}" x2="${sx(l.y)}" y1="130" y2="164" class="lv-t"/><path d="M${sx(l.y)} 166 L${sx(l.code + 0.5)} 238" class="lv-a"/>`);
  }
  for (let c = Math.ceil(x0 / q) * q; c < x1; c += q) {
    const n = hits[c] || 0;
    p.push(`<rect x="${sx(c)}" y="240" width="${Math.max(1, sx(c + q) - sx(c) - 1.5)}" height="34" rx="4" class="lv-c n${Math.min(n, 2)}"/>`);
    if (q === 1) p.push(`<text x="${sx(c + 0.5)}" y="262" class="tiny" text-anchor="middle">${c}</text>`);
  }
  for (let c = Math.ceil(x0); c <= x1; c++) p.push(`<line x1="${sx(c)}" x2="${sx(c)}" y1="20" y2="290" class="tick"/><text x="${sx(c)}" y="306" class="tiny" text-anchor="middle">${c}</text>`);
  p.push(`<text x="${w - 16}" y="324" class="tiny" text-anchor="end">input [LSB]</text></svg>`);
  // thin slivers where redundant paths overlap are not levels of their own
  const all = levels(sim.chip, d, sim.cal, 8, d.codes - 8, P.vosCal).filter((l) => l.b - l.a > 0.3);
  const cnt = {};
  for (const l of all) { const c = Math.round((l.y - 0.5) / q) * q; cnt[c] = (cnt[c] || 0) + 1; }
  const total = Math.round((d.codes - 16) / q);
  const two = Object.values(cnt).filter((n) => n >= 2).length;
  const none = total - Object.keys(cnt).length;
  fill('lvView', p.join(''), `Boxes: input ranges with the same decisions. Ticks: the value the combiner computes. Arrows: where rounding puts it. Output codes: green one level, amber two levels, red none. Over the whole range of this chip (seed ${P.seed}): ${all.length} levels for ${total} output codes; ${two} codes get two levels and ${none} get none. Move the slider to find such places; try 12 output bits or one more step below one unit in the values on this page.`);
  const err = d.weights.map((wd, i) => sim.chip.wTrue[i] - wd);
  const mx = Math.max(...err.map(Math.abs), 0.05);
  const bw = (w - 20) / err.length;
  fill('lvW', `<svg viewBox="0 0 ${w} 150" class="tsvg">${err.map((e, i) => `<rect x="${10 + i * bw + 6}" y="${e >= 0 ? 70 - (e / mx) * 50 : 70}" width="${bw - 12}" height="${Math.max(1, (Math.abs(e) / mx) * 50)}" rx="3" class="${e >= 0 ? 'lv-up' : 'lv-dn'}"/><text x="${10 + i * bw + bw / 2}" y="140" class="tiny" text-anchor="middle">${esc(num(d.weights[i], d.weights[i] < 10 ? 1 : 0))}</text><text x="${10 + i * bw + bw / 2}" y="${e >= 0 ? 66 - (e / mx) * 50 : 84 + (Math.abs(e) / mx) * 50}" class="tiny" text-anchor="middle">${e >= 0 ? '+' : '−'}${num(Math.abs(e), 2)}</text>`).join('')}<line x1="10" x2="${w - 10}" y1="70" y2="70" class="tick"/></svg>`,
    `True weight minus design weight of each step, in LSB (labels below: the design weight). The large steps are off by the most LSB, and every level that uses a step moves by that amount. One unit capacitor of ${num(P.cu * 1e15, 1)} fF has σ = ${num(ctx.sigmaU * 100, 2)} %.`);
}

function runTest(ctx, btn) {
  const { P } = ctx;
  btn.textContent = 'running…';
  const out = [];
  const ideal = 10 - 0.5 / 6.02; // an ideal 10-bit quantizer, sine at -0.5 dBFS
  const step = () => {
    if (out.length < TEST.length) {
      out.push([TEST[out.length][0], testList(P, TEST[out.length][1], 8)]);
      show();
      setTimeout(step, 0);
    } else btn.textContent = '▶ run again';
  };
  const show = () => {
    const tr = out.map(([name, r]) => `<tr><td>${esc(name)}</td><td class="num">${r.d.weights.slice(-4).map((w) => num(w, 2)).join(' ')}</td><td class="num">${num(r.a, 2)}</td><td class="num">${num(r.b, 2)}</td><td class="num">${num(r.c1, 2)}</td><td class="num">${num(r.c2, 2)}</td><td class="num">${num(r.a - r.b, 2)}</td><td class="num">${num(r.sndr, 1)}</td><td class="num">${num(r.dnl, 2)}</td><td class="num">${num(r.inl, 2)}</td><td class="num">${num(r.miss, 1)}</td><td class="num">${num(r.gap, 2)}</td></tr>`).join('');
    fill('lvTest', `<div class="tablewrap"><table class="tbl"><thead><tr><th>Weight list</th><th>Last steps [LSB]</th><th>(a) ENOB real-valued</th><th>(b) 10 bit</th><th>(c) 11 bit</th><th>(c) 12 bit</th><th>Lost by (b)</th><th>SNDR of (b) [dB]</th><th>Peak DNL of (b)</th><th>Peak INL of (b)</th><th>Missing codes of (b)</th><th>Largest level gap of (a) [LSB]</th></tr></thead><tbody>${tr}</tbody></table></div>`,
      out.length < TEST.length ? `Running ${out.length} of ${TEST.length}…` : `(d) An ideal 10-bit quantizer gives ENOB ${num(ideal, 2)} on this sine (−0.5 dBFS). Mismatch from the PDK expression, weights calibrated by least squares on a noise-free ramp, mean of 8 chips. <b>Claim 1, rounding adds noise:</b> yes. With a last step of 1 LSB it costs ${num(out[1][1].a - out[1][1].b, 2)} bit; with ½ LSB the real-valued output is finer, so the difference grows to ${num(out[3][1].a - out[3][1].b, 2)} bit, while the 10-bit result itself rises from ${num(out[1][1].b, 2)} to ${num(out[3][1].b, 2)}. Keeping 2 more bits recovers almost all of it. <b>Claim 2, DNL above 0.5 with missing codes proves too little redundancy:</b> no. Every list here has enough redundancy for its mismatch, and the largest gap between reachable levels stays near the last step (${num(out[1][1].gap, 2)} LSB for 12 decisions), yet the rounded output shows DNL near ${num(out[1][1].dnl, 1)} and missing codes. The DNL of the rounded output measures the rounding. Too little redundancy shows as a level gap clearly larger than the last step. <b>Fix with a 10-bit output:</b> a last step of ½ LSB (one more decision). A ¼ LSB step gains little more.`);
  };
  setTimeout(step, 0);
}

/** Raw decisions, their calibrated weights, the sum, and what each output width keeps. */
function drawBits(ctx) {
  const { d, P, sim } = ctx;
  // xin is the input on the scale of the output codes (the middle of code c is c)
  const xin = (ctx.ui.lvAt || 262) + 0.37;
  document.getElementById('lvAtO').textContent = num(xin, 2);
  const decOf = (x) => convert(sim.chip, d, x + 0.5 - d.codes / 2, { vos: P.vosCal });
  const val = (x, f) => combine(decOf(x), sim.cal, d.codes, f);
  const dec = decOf(xin);
  const n = dec.length;
  const cells = Array.from(dec).map((b, i) => `<td class="num" style="text-align:center"><div style="font-weight:700;font-size:15px;color:${b ? 'var(--an)' : 'var(--cal)'}">${b}</div><div class="dim">${b ? '+' : '−'}${num(sim.cal.w[i], 2)}</div></td>`).join('');
  const real = val(xin, 10);
  const bin = (v, f) => {
    const s2 = Math.round(v * 2 ** f).toString(2).padStart(P.bits + f, '0');
    return f ? `${s2.slice(0, P.bits)}<b style="color:var(--cal)">.${s2.slice(P.bits)}</b>` : s2;
  };
  const outRow = (label, f) => `<tr><td>${label}</td><td class="num" style="font-family:var(--mono)">${bin(val(xin, f), f)}</td><td class="num">${num(val(xin, f), f ? 2 : 0)}</td><td class="num"><b>${num(val(xin, f) - real, 2)}</b></td><td class="num">${num(val(xin, f) - xin, 2)}</td></tr>`;
  fill('lvBits', `<div class="tablewrap"><table class="tbl"><thead><tr><th>decision</th>${Array.from(dec).map((_, i) => `<th style="text-align:center">${i + 1}</th>`).join('')}</tr></thead><tbody><tr><td>raw bit<br><span class="dim">its weight [LSB]</span></td>${cells}</tr></tbody></table></div>
    <p style="margin:10px 0 6px">Input <b>${num(xin, 2)}</b> &nbsp;→&nbsp; sum of the ${n} decisions with the calibrated weights: <b>${num(real, 2)}</b> &nbsp; (the converter itself is off by ${num(real - xin, 2)} LSB)</p>
    <div class="tablewrap"><table class="tbl"><thead><tr><th>Output word</th><th>bits</th><th>value</th><th>changed by rounding [LSB]</th><th>error against the input [LSB]</th></tr></thead><tbody>
    ${outRow(`${P.bits} bit`, 0)}${outRow(`${P.bits + 1} bit`, 1)}${outRow(`${P.bits + 2} bit`, 2)}</tbody></table></div>`,
    `The converter makes ${n} raw decisions. Each is added (1) or subtracted (0) with the weight measured for this chip (seed ${P.seed}). The sum is not a whole number. The ${P.bits}-bit word keeps only whole codes; the bits after the point are what a wider word would keep. Move the slider: the rounding changes the value by anything up to ½ LSB.`);
  // range: three stacked plots with the same axes
  const x0 = Math.max(20, Math.round(xin) - 24);
  const a = [];
  const b = [];
  const c = [];
  for (let x = x0; x <= x0 + 48; x += 1 / 16) {
    const r = val(x, 10);
    const w10 = val(x, 0);
    a.push([x, r - x]);
    b.push([x, w10 - r]);
    c.push([x, w10 - x]);
  }
  const rms = (pts) => Math.sqrt(pts.reduce((s2, q) => s2 + q[1] * q[1], 0) / pts.length);
  const one = (pts, col, label) => `<p class="cap" style="margin:6px 0 0"><b>${label}</b>: ${num(rms(pts), 2)} LSB rms in this window</p>` + plot({ height: 150, x: { min: x0, max: x0 + 48, label: 'input [code]' }, y: { min: -1.1, max: 1.1, label: 'LSB' },
    series: [{ points: pts, color: col, width: 1.5 }], bands: [{ y0: -0.5, y1: 0.5, color: 'color-mix(in srgb, var(--cal) 10%, transparent)' }], vlines: [{ x: xin, color: COL.ink }] }, widthOf('lvRange'));
  fill('lvRange', one(a, COL.an, '1. Error of the converter before rounding') + one(b, COL.cal, `2. What rounding to ${P.bits} bits adds`) + one(c, COL.ref, `3. Error of the ${P.bits}-bit word: 1 and 2 together`),
    'Plot 1 is what any 10-bit converter has: a sawtooth inside ±½ LSB (shaded). Plot 2 is new: because the levels of this chip do not sit on the 10-bit grid, rounding moves each one by up to ½ LSB. How much depends on where you look; over the whole range it is as large as plot 1 (table below). Plot 3 is the two together, which can reach ±1 LSB. Two errors of the same size: that is why rounding costs half a bit.');
  // all inputs
  const key = JSON.stringify([d.weights, P.seed, P.cu, P.aC, P.vosCal]);
  if (drawBits.key !== key) {
    drawBits.key = key;
    const acc = [0, 0, 0, 0];
    let m = 0;
    for (let x = 48; x < d.codes - 48; x += 0.25) {
      [10, 2, 1, 0].forEach((f, k) => { acc[k] += (val(x, f) - x) ** 2; });
      m++;
    }
    drawBits.rms = acc.map((v) => Math.sqrt(v / m));
  }
  const r = drawBits.rms;
  const ideal = 1 / Math.sqrt(12);
  const bar = (label, v, col) => `<tr><td style="width:240px">${label}</td><td><div style="height:20px;width:${Math.min(100, (v / 0.5) * 100)}%;background:${col};border-radius:3px"></div></td><td class="num" style="width:150px">${num(v, 3)} LSB rms</td><td class="num" style="width:150px">ENOB ${num(P.bits - Math.log2(v / ideal), 2)}</td></tr>`;
  fill('lvRms', `<table class="tbl"><tbody>${bar('ideal 10-bit converter', ideal, 'var(--muted)')}${bar('this chip, sum before rounding', r[0], 'var(--an)')}${bar(`${P.bits + 2}-bit word`, r[1], 'var(--an)')}${bar(`${P.bits + 1}-bit word`, r[2], 'var(--ref)')}${bar(`${P.bits}-bit word`, r[3], 'var(--cal)')}</tbody></table>`,
    `Ramp over the whole range of this chip, no comparator noise. Rounding to ${P.bits} bits adds ${num(Math.sqrt(Math.max(0, r[3] ** 2 - r[0] ** 2)), 2)} LSB rms on top of the ${num(r[0], 2)} the converter has by itself: ${num(Math.log2(r[3] / r[0]), 2)} bit of ENOB. The two add as powers: √(${num(r[0], 2)}² + 0.29²) = ${num(Math.hypot(r[0], ideal), 2)}.`);
}
