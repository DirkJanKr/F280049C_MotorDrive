// Levels page: what mismatch does to the levels of the converter, and what rounding to the
// output bits then does. Three rows on one input axis (in LSB):
//   1 a perfect chip: every level is 1 LSB wide and its value is a whole code
//   2 this chip (simulated mismatch): the levels have moved; the tick is the calibrated value y
//   3 the output codes after rounding y; a code is red when no level lands on it, amber when two do
// Levels are found by converting a fine ramp without noise and grouping equal decisions.

import { group, knobs, fill, widthOf, readouts, explain, num, esc } from '../kit.js';
import { idealChip, convert, designWeights } from '../../zaan/model/chargeSar.js';

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
      <section class="card wide"><header><h3>Mismatch moves the levels; rounding moves them again</h3><span class="ctl"><label class="mini-l">look at code <input type="range" id="lvAt" min="6" max="1017" step="1" value="${store.ui.lvAt || 262}"/> <output id="lvAtO"></output></label></span></header>
        <div class="cbody" id="lvView"></div><p class="cap" id="lvView-cap"></p></section>
      <section class="card wide"><header><h3>Each step of this chip against its design value</h3></header><div class="cbody" id="lvW"></div><p class="cap" id="lvW-cap"></p></section>
      ${explain('How to read it', [
        'Row 1: a perfect chip. Each box is the range of inputs that gives one set of decisions. All boxes are 1 LSB wide and sit exactly on a code.',
        'Row 2: the same weights with mismatch. A capacitor that is slightly too large moves every level that uses it. Calibration knows the true weights, so the tick in each box is at the right place: the converter knows where its levels are. It cannot make more levels.',
        'Row 3: the output word has whole codes only (or half or quarter codes when the combiner keeps more bits). Each tick falls to the nearest one. Where the ticks have drifted half a code, two levels fall on one code and the next code gets none. That second rounding is the extra error.',
      ])}`;
  },
  mount(store) {
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
