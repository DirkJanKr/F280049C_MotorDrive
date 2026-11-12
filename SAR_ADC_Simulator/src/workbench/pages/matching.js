// Matching page: the 3 sigma rule for the CDAC, shown as an equation, worked out side by side for
// charge redistribution (a capacitor is on or off) and charge sharing (parallel or antiparallel),
// and checked with a Monte Carlo. One switch: are the last 3 bits made by charge halving.

import { fill, widthOf, plot, explain, eng, num, COL } from '../kit.js';
import { matchingArray, midSigma, requiredCu, matchingMonteCarlo } from '../../zaan/model/matching.js';
import { createRng } from '../../model/rng.js';

const CHIPS = 600;
const memo = {};
const frac = (a, b) => `<span class="frac"><span class="fn">${a}</span><span class="fd">${b}</span></span>`;
const sq = (x) => `√<span style="border-top:1px solid currentColor;padding:0 3px">${x}</span>`;
const sub = (a, b) => `${a}<sub>${b}</sub>`;
const big = (html) => `<div style="font-size:19px;font-weight:600;color:var(--ink);padding:6px 0">${html}</div>`;

function arrayView(arr, w) {
  const n = arr.list.length;
  const L = 96;
  const bw = (w - L - 6) / n;
  const colOf = { cap: 'var(--an)', half: 'var(--ref)', final: 'var(--muted)' };
  const p = [`<svg viewBox="0 0 ${w} 150" class="tsvg" role="img" aria-label="The bits of the array">`];
  arr.list.forEach((b, i) => {
    const x = L + i * bw;
    p.push(`<rect x="${x + 1.5}" y="4" width="${bw - 3}" height="24" rx="3" fill="${colOf[b.kind]}" opacity="0.9"/><text x="${x + bw / 2}" y="20" text-anchor="middle" class="tiny" style="fill:#fff">${b.W}</text>`);
    p.push(`<text x="${x + bw / 2}" y="42" text-anchor="middle" class="tiny">${b.kind === 'cap' ? `${b.units}u` : b.kind === 'half' ? '½' : '–'}</text>`);
  });
  p.push(`<text x="4" y="20" class="tiny">code weight</text><text x="4" y="42" class="tiny">units</text>`);
  [['below mid', (i) => i !== 0], ['above mid', (i) => i === 0]].forEach(([label, on], r) => {
    const y = 56 + r * 32;
    p.push(`<text x="4" y="${y + 16}" class="tiny">${label}</text>`);
    arr.list.forEach((b, i) => {
      const a = on(i);
      const txt = arr.polarity ? (a ? '+' : '−') : a ? 'on' : 'off';
      const fillc = arr.polarity ? (a ? 'var(--an)' : 'var(--cal)') : a ? 'var(--an)' : 'var(--panel2)';
      p.push(`<rect x="${L + i * bw + 1.5}" y="${y}" width="${bw - 3}" height="24" rx="3" fill="${fillc}" stroke="var(--line)"/><text x="${L + i * bw + bw / 2}" y="${y + 16}" text-anchor="middle" class="tiny" style="fill:${arr.polarity || a ? '#fff' : 'var(--ink)'}">${txt}</text>`);
    });
  });
  p.push(`<text x="${L}" y="136" class="tiny">${arr.polarity ? 'every capacitor reverses' : 'the largest switches on, the rest off'}</text></svg>`);
  return p.join('');
}

function histogram(values, lo, hi, bins) {
  const h = new Array(bins).fill(0);
  for (const v of values) {
    const k = Math.floor(((v - lo) / (hi - lo)) * bins);
    if (k >= 0 && k < bins) h[k]++;
  }
  const pts = [];
  h.forEach((c, i) => pts.push([lo + ((hi - lo) * i) / bins, c], [lo + ((hi - lo) * (i + 1)) / bins, c]));
  return pts;
}

/** One column: the array, the equation with its numbers, the Monte Carlo. */
function column(id, arr, sigmaU, aC, cu, P) {
  const sig = midSigma(arr, sigmaU);
  const need = requiredCu(arr, aC);
  const key = JSON.stringify([arr.M, arr.halving, sigmaU, P.seed]);
  if (!memo[id] || memo[id].key !== key) memo[id] = { key, mc: matchingMonteCarlo(arr, sigmaU, CHIPS, createRng(P.seed + 77)) };
  const mc = memo[id].mc;
  const sd = Math.sqrt(mc.mid.reduce((a, v) => a + v * v, 0) / CHIPS);
  const pass = Array.from(mc.worst).filter((v) => v < 0.5).length / CHIPS;
  const span = Math.max(1, 4 * sig);
  const pts = histogram(mc.mid, -span, span, 36);
  const w = Math.max(360, widthOf(id));
  const bad = 3 * sig > 0.5;
  fill(id, `${arrayView(arr, w)}
    <table class="tbl" style="margin-top:6px"><tbody>
      <tr><td style="width:46%">unit capacitors M</td><td class="num"><b>${arr.M}</b></td></tr>
      <tr><td>codes per unit, k = 2<sup>B</sup> / M</td><td class="num">${2 ** P.bits} / ${arr.M} = <b>${arr.k}</b></td></tr>
      <tr><td>σ = k · ${sub('σ', 'u')} · ${sq('M − 1')}</td><td class="num">${arr.k} × ${num(sigmaU * 100, 3)} % × ${sq(arr.M - 1)} = <b>${num(arr.k * sigmaU * Math.sqrt(arr.M - 1), 3)} LSB</b></td></tr>
      <tr><td>3σ, limit 0.5 LSB</td><td class="num"><b style="color:${bad ? 'var(--bad)' : 'var(--ok, var(--an))'}">${num(3 * sig, 2)} LSB</b></td></tr>
      <tr><td>unit needed for 3σ &lt; 0.5</td><td class="num"><b>${eng(need.cu, 'F')}</b> × ${arr.M} = ${eng(need.total, 'F')}</td></tr>
      <tr><td>CDAC with the unit set above</td><td class="num">${arr.M} × ${eng(cu, 'F')} = <b>${eng(arr.M * cu, 'F')}</b></td></tr>
    </tbody></table>
    ${plot({ height: 190, x: { min: -span, max: span, label: 'error of the mid-scale code step [LSB]' }, y: { min: 0, max: Math.max(...pts.map((q) => q[1])) * 1.15, label: 'chips' },
      series: [{ points: pts, color: COL.an, width: 1.8 }], vlines: [{ x: -0.5, color: COL.bad, dash: '5 3' }, { x: 0.5, color: COL.bad, dash: '5 3', label: '±0.5' }] }, w)}`,
  `Monte Carlo on ${CHIPS} chips: σ = ${num(sd, 3)} LSB, the equation gives ${num(sig, 3)} LSB. Chips with every code step inside ±0.5 LSB: ${num(pass * 100, 0)} %.`);
  return { sig, need };
}

export const page = {
  id: 'matching',
  title: 'The 3σ rule',
  main(store) {
    const hal = store.ui.mmHalving !== false;
    return `<section class="card wide"><header><h3>The equation</h3></header><div class="cbody" id="mmEq"></div></section>
      <section class="card wide"><header><h3>Set the unit capacitor</h3><span class="ctl">
        <label class="mini-l">unit capacitor ${sub('C', 'u')} <input type="range" id="mmCu" min="10" max="2000" step="5" value="${store.ui.mmCu || 35}"/> <output id="mmCuO"></output></label>
        <span class="seg sm2"><button data-mm="1" class="${hal ? 'on' : ''}">last 3 bits by charge halving</button><button data-mm="0" class="${hal ? '' : 'on'}">all bits from capacitors</button></span></span></header>
        <div class="cbody" id="mmChain"></div></section>
      <div class="grid2"><section class="card"><header><h3>Charge redistribution: a capacitor is on or off</h3></header><div class="cbody" id="mmA"></div><p class="cap" id="mmA-cap"></p></section>
      <section class="card"><header><h3>Charge sharing: parallel or antiparallel</h3></header><div class="cbody" id="mmB"></div><p class="cap" id="mmB-cap"></p></section></div>
      <section class="card wide"><header><h3>What the comparison shows</h3></header><div class="cbody" id="mmSum"></div></section>
      ${explain('Why charge sharing needs half the capacitors', [
        'In charge redistribution a capacitor either takes part or it does not. To cover 1024 codes with capacitors alone you need 1024 units of one code each.',
        'In charge sharing a capacitor is never left out. It is connected one way round or the other, so it moves the result up or down by its weight: a range of twice its weight. Half the capacitors cover the same codes, and each one is worth two codes.',
        'For matching that changes nothing in total. There are half as many capacitors to average over, but each counts for twice as much, so to match as well each must be twice as large. The total capacitance comes out the same. The same holds for charge halving, which removes three more factors of two from the count.',
      ])}`;
  },
  mount(store) {
    document.querySelectorAll('[data-mm]').forEach((b) => {
      b.onclick = () => {
        store.ui.mmHalving = b.dataset.mm === '1';
        document.querySelectorAll('[data-mm]').forEach((x) => x.classList.toggle('on', x === b));
        page.update(store, store.ctx);
      };
    });
    document.getElementById('mmCu').oninput = (e) => {
      store.ui.mmCu = Number(e.target.value);
      page.update(store, store.ctx);
    };
  },
  update(store, ctx) {
    const { P } = ctx;
    const hal = store.ui.mmHalving !== false;
    const cu = (store.ui.mmCu || 35) * 1e-15;
    const aC = P.aC / 100; // one capacitor, fraction * sqrt(fF)
    const pairSlope = (P.aC / 100) * Math.SQRT2 / Math.sqrt(P.density * 1e3 || 2); // um, from the PDK pair sigma and the density
    const sigmaU = aC / Math.sqrt(cu / 1e-15);
    document.getElementById('mmCuO').textContent = eng(cu, 'F');
    fill('mmEq', `<div class="grid2 inner"><div>
        ${big(`${sub('σ', 'u')} = ${frac(sub('A', 'C'), sq(sub('C', 'u')))}`)}<p class="cap">one unit capacitor (Pelgrom). ${sub('A', 'C')}: matching of the PDK capacitor.</p>
        ${big(`${sub('σ', 'step')} = k · ${sub('σ', 'u')} · ${sq('M − 1')} &nbsp;,&nbsp; k = ${frac('2<sup>B</sup>', 'M')}`)}<p class="cap">the worst code step, at mid-scale, where all M − 1 unit capacitors change. k: codes that one unit is worth.</p></div><div>
        ${big(`${sub('σ', 'step')} ≈ ${frac(`2<sup>B</sup> · ${sub('A', 'C')}`, sq(`M · ${sub('C', 'u')}`))} = ${frac(`2<sup>B</sup> · ${sub('A', 'C')}`, sq(sub('C', 'DAC')))}`)}<p class="cap">put together: only the total capacitance ${sub('C', 'DAC')} = M · ${sub('C', 'u')} counts.</p>
        ${big(`3 · ${sub('σ', 'step')} &lt; ½ LSB &nbsp;⟹&nbsp; ${sub('C', 'DAC')} &gt; (6 · 2<sup>B</sup> · ${sub('A', 'C')})²`)}<p class="cap">the 3σ rule. With B = ${P.bits} and ${sub('A', 'C')} = ${num(aC * 100, 2)} %·√fF: ${eng((6 * 2 ** P.bits * aC) ** 2 * 1e-15, 'F')}.</p></div></div>`);
    fill('mmChain', `<p style="margin:2px 0">PDK: pair mismatch σ(ΔC/C) = ${num(pairSlope, 4)} µm / √area &nbsp;→&nbsp; one capacitor: ${sub('A', 'C')} = <b>${num(aC * 100, 2)} %·√fF</b> &nbsp;→&nbsp; at ${sub('C', 'u')} = ${eng(cu, 'F')}: &nbsp; ${sub('σ', 'u')} = ${num(aC * 100, 2)} / √${num(cu * 1e15, 0)} = <b>${num(sigmaU * 100, 3)} %</b> &nbsp; (a pair: ${num(sigmaU * Math.SQRT2 * 100, 3)} %)</p>
      <p class="cap">The matching of the PDK is fixed; the mismatch of a unit follows from its size. The PDK value itself is in the inspector under Capacitors (pair mismatch at 35 fF).</p>`);
    const a = column('mmA', matchingArray({ bits: P.bits, halving: hal, polarity: false }), sigmaU, aC, cu, P);
    const b = column('mmB', matchingArray({ bits: P.bits, halving: hal, polarity: true }), sigmaU, aC, cu, P);
    const A = matchingArray({ bits: P.bits, halving: hal, polarity: false });
    const B = matchingArray({ bits: P.bits, halving: hal, polarity: true });
    fill('mmSum', `<div class="tablewrap"><table class="tbl"><thead><tr><th></th><th>Charge redistribution</th><th>Charge sharing</th><th>What it means</th></tr></thead><tbody>
      <tr><td>Unit capacitors</td><td class="num">${A.M}</td><td class="num">${B.M}</td><td>half as many: each is used in both directions</td></tr>
      <tr><td>Codes per unit</td><td class="num">${A.k}</td><td class="num">${B.k}</td><td>each counts twice as much</td></tr>
      <tr><td>3σ at ${eng(cu, 'F')} units</td><td class="num">${num(3 * a.sig, 2)} LSB</td><td class="num">${num(3 * b.sig, 2)} LSB</td><td>√2 worse at the same unit size</td></tr>
      <tr><td>Unit for 3σ &lt; 0.5 LSB</td><td class="num">${eng(a.need.cu, 'F')}</td><td class="num">${eng(b.need.cu, 'F')}</td><td>twice as large</td></tr>
      <tr><td>Total for 3σ &lt; 0.5 LSB</td><td class="num">${eng(a.need.total, 'F')}</td><td class="num">${eng(b.need.total, 'F')}</td><td><b>the same</b>: matching sets a total capacitance</td></tr>
      <tr><td>Total with ${eng(cu, 'F')} units</td><td class="num">${eng(A.M * cu, 'F')}</td><td class="num">${eng(B.M * cu, 'F')}</td><td><b>half</b>: this is the gain once calibration removes the matching limit</td></tr>
    </tbody></table></div><p class="cap">${hal ? 'With charge halving for the last 3 bits both arrays have 8 times fewer units than without. Switch it off above to see all bits made from capacitors.' : 'All bits from capacitors. Switch charge halving on above: both arrays lose a factor 8 in units, and the totals for matching stay the same.'}</p>`);
  },
};
