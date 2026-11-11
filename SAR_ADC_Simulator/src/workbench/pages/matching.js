// Matching page: how the 3 sigma rule is worked out for this CDAC, with two switches
// (charge halving, parallel or antiparallel use) and a Monte Carlo to check the formula.

import { group, knobs, fill, widthOf, plot, readouts, explain, eng, num, COL } from '../kit.js';
import { matchingArray, midSigma, requiredCu, matchingMonteCarlo, bitSigma } from '../../zaan/model/matching.js';
import { createRng } from '../../model/rng.js';

const CHIPS = 600;
const memo = { key: '', mc: null };
const st = (ui) => ({ halving: ui.mmHalving !== false, polarity: ui.mmPolarity !== false, cu: (ui.mmCu || 35) * 1e-15 });

function arrayView(arr, w) {
  const n = arr.list.length;
  const L = 150;
  const bw = (w - L - 10) / n;
  const colOf = { cap: 'var(--an)', half: 'var(--ref)', final: 'var(--muted)' };
  const p = [`<svg viewBox="0 0 ${w} 200" class="tsvg" role="img" aria-label="The bits of the array">`];
  p.push(`<text x="8" y="34" class="lbl">code weight</text><text x="8" y="74" class="lbl">made of</text>`);
  arr.list.forEach((b, i) => {
    const x = L + i * bw;
    p.push(`<rect x="${x + 2}" y="14" width="${bw - 4}" height="30" rx="4" fill="${colOf[b.kind]}" opacity="0.9"/><text x="${x + bw / 2}" y="34" text-anchor="middle" class="tiny" style="fill:#fff">${b.W}</text>`);
    p.push(`<text x="${x + bw / 2}" y="68" text-anchor="middle" class="tiny">${b.kind === 'cap' ? `${b.units} unit${b.units > 1 ? 's' : ''}` : b.kind === 'half' ? 'halving' : 'last'}</text><text x="${x + bw / 2}" y="82" text-anchor="middle" class="tiny">${b.kind === 'final' ? 'comparison' : ''}</text>`);
  });
  const rows = [['just below mid-scale', (i) => i !== 0], ['just above mid-scale', (i) => i === 0]];
  rows.forEach(([label, on], r) => {
    const y = 108 + r * 44;
    p.push(`<text x="8" y="${y + 20}" class="lbl">${label}</text>`);
    arr.list.forEach((b, i) => {
      const x = L + i * bw;
      const a = on(i);
      const txt = arr.polarity ? (a ? '+' : '−') : a ? 'on' : 'off';
      p.push(`<rect x="${x + 2}" y="${y}" width="${bw - 4}" height="30" rx="4" fill="${a ? 'var(--an)' : 'var(--panel2)'}" stroke="var(--line)"/><text x="${x + bw / 2}" y="${y + 20}" text-anchor="middle" class="tiny" style="fill:${a ? '#fff' : 'var(--ink)'}">${txt}</text>`);
    });
  });
  p.push('</svg>');
  return p.join('');
}

function histogram(values, lo, hi, bins) {
  const h = new Array(bins).fill(0);
  for (const v of values) {
    const k = Math.floor(((v - lo) / (hi - lo)) * bins);
    if (k >= 0 && k < bins) h[k]++;
  }
  const pts = [];
  h.forEach((c, i) => {
    const x0 = lo + ((hi - lo) * i) / bins;
    pts.push([x0, c], [x0 + (hi - lo) / bins, c]);
  });
  return pts;
}

export const page = {
  id: 'matching',
  title: 'The 3σ rule',
  side(store) {
    return group('Capacitor matching', knobs(store.values, ['pairSigma'], new Set()));
  },
  main(store) {
    const s = st(store.ui);
    return `<section class="card wide"><header><h3>How the 10 bits are built</h3><span class="ctl">
        <span class="seg sm2"><button data-mm="polarity" data-v="1" class="${s.polarity ? 'on' : ''}">parallel / antiparallel (charge sharing)</button><button data-mm="polarity" data-v="0" class="${s.polarity ? '' : 'on'}">on / off (charge redistribution)</button></span>
        <span class="seg sm2"><button data-mm="halving" data-v="1" class="${s.halving ? 'on' : ''}">charge halving for the last 3 bits</button><button data-mm="halving" data-v="0" class="${s.halving ? '' : 'on'}">all bits from capacitors</button></span>
        <label class="mini-l">unit capacitor <input type="range" id="mmCu" min="10" max="2000" step="5" value="${store.ui.mmCu || 35}"/> <output id="mmCuO"></output></label></span></header>
        <div class="cbody" id="mmArr"></div><p class="cap" id="mmArr-cap"></p></section>
      <div id="mmRo"></div>
      <div class="grid2"><section class="card"><header><h3>The calculation, with these numbers</h3></header><div class="cbody" id="mmEq"></div></section>
      <section class="card"><header><h3>Monte Carlo: the mid-scale code step on ${CHIPS} chips</h3></header><div class="cbody" id="mmMc"></div><p class="cap" id="mmMc-cap"></p></section></div>
      <section class="card wide"><header><h3>The four ways side by side</h3></header><div class="cbody" id="mmTab"></div><p class="cap" id="mmTab-cap"></p></section>
      ${explain('What the two switches do', [
        'Parallel or antiparallel: in charge sharing a capacitor is never left out. It adds its charge or subtracts it, so one capacitor moves the result over twice the range of a capacitor that is only switched on or off. Half the capacitors are enough for the same number of codes.',
        'Charge halving: the last three bits are made by sharing the charge of one unit capacitor with an empty one, again and again. No smaller capacitors are needed, so the array has 8 times fewer units.',
        'Neither switch changes the capacitance that matching needs in total. Fewer units means each unit counts for more codes, and to match as well as before each must be that much larger. What the switches change is the number of units, and with it the smallest CDAC you can build once the unit is at the PDK minimum.',
      ])}`;
  },
  mount(store) {
    document.querySelectorAll('[data-mm]').forEach((b) => {
      b.onclick = () => {
        store.ui[b.dataset.mm === 'polarity' ? 'mmPolarity' : 'mmHalving'] = b.dataset.v === '1';
        document.querySelectorAll(`[data-mm="${b.dataset.mm}"]`).forEach((x) => x.classList.toggle('on', x === b));
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
    const s = st(store.ui);
    const aC = P.aC / 100; // one capacitor, fraction * sqrt(fF)
    const arr = matchingArray({ bits: P.bits, halving: s.halving, polarity: s.polarity });
    const sigmaU = aC / Math.sqrt(s.cu / 1e-15);
    const sig = midSigma(arr, sigmaU);
    const need = requiredCu(arr, aC);
    document.getElementById('mmCuO').textContent = eng(s.cu, 'F');
    fill('mmArr', arrayView(arr, Math.max(560, widthOf('mmArr'))), `Blue: bits made of unit capacitors. Teal: bits made by charge halving. Grey: the last comparison, which needs no capacitor. Between the two codes around mid-scale every bit changes${arr.polarity ? ' polarity' : ''}, so the errors of all ${arr.M - 1} unit capacitors add up in that one code step. That is why it is the worst one.`);
    fill('mmRo', readouts([
      ['Unit capacitors', `${arr.M}`, `one unit is worth ${arr.k} code${arr.k > 1 ? 's' : ''}`],
      ['One unit, 1σ', `${num(sigmaU * 100, 2)} %`, `A C / √C u at ${eng(s.cu, 'F')}`],
      ['Mid-scale code step, 3σ', `${num(3 * sig, 2)} LSB`, 'limit 0.5 LSB', 3 * sig > 0.5 ? 'bad' : 'ok'],
      ['Unit needed for 3σ < 0.5', eng(need.cu, 'F'), `${arr.M} units: ${eng(need.total, 'F')} in total`],
      ['CDAC at this unit', eng(arr.M * s.cu, 'F'), `${arr.M} × ${eng(s.cu, 'F')}`],
    ]));
    const row = (a, b) => `<tr><td style="width:52%">${a}</td><td class="num">${b}</td></tr>`;
    fill('mmEq', `<table class="tbl"><tbody>
      ${row('One capacitor: σ u = A C / √C u', `${num(aC * 100, 2)} %·√fF / √${num(s.cu * 1e15, 0)} fF = ${num(sigmaU * 100, 3)} %`)}
      ${row('Codes per unit: k = 2^B / M', `${2 ** P.bits} / ${arr.M} = ${arr.k}`)}
      ${row('A bit of u units: σ = k · σ u · √u codes', `largest bit: ${arr.k} × ${num(sigmaU * 100, 3)} % × √${arr.list[0].units} = ${num(arr.k * sigmaU * Math.sqrt(arr.list[0].units), 3)}`)}
      ${row('Mid-scale step, all bits change: σ = k · σ u · √(M − 1)', `${arr.k} × ${num(sigmaU * 100, 3)} % × √${arr.M - 1} = <b>${num(arr.k * sigmaU * Math.sqrt(arr.M - 1), 3)} LSB</b>`)}
      ${row('The same with the total: σ ≈ 2^B · A C / √(M · C u)', `${2 ** P.bits} × ${num(aC * 100, 2)} % / √${num(arr.M * s.cu * 1e15, 0)} fF = ${num((2 ** P.bits * aC) / Math.sqrt(arr.M * s.cu * 1e15), 3)} LSB`)}
      ${row('3σ < 0.5 LSB needs σ u below', `0.5 / (3 × ${arr.k} × √${arr.M - 1}) = ${num(need.sigmaU * 100, 3)} %`)}
      ${row('so C u = (A C / σ u)²', `<b>${eng(need.cu, 'F')}</b>, total ${eng(need.total, 'F')}`)}
    </tbody></table>${s.halving ? `<p class="cap">The halving bits add a little: each is taken as σ u / √2 (assumption), which changes the result by less than 1 %.</p>` : ''}`);
    const key = JSON.stringify([s, aC, P.bits, P.seed]);
    if (memo.key !== key) {
      memo.key = key;
      memo.mc = matchingMonteCarlo(arr, sigmaU, CHIPS, createRng(P.seed + 77));
    }
    const mc = memo.mc;
    const sd = Math.sqrt(mc.mid.reduce((a, v) => a + v * v, 0) / CHIPS);
    const span = Math.max(1, 4 * sig);
    const pass = Array.from(mc.worst).filter((v) => v < 0.5).length / CHIPS;
    fill('mmMc', plot({ height: 250, x: { min: -span, max: span, label: 'error of the mid-scale code step [LSB]' }, y: { min: 0, max: Math.max(...histogram(mc.mid, -span, span, 40).map((q) => q[1])) * 1.15, label: 'chips' },
      series: [{ points: histogram(mc.mid, -span, span, 40), color: COL.an, width: 1.8 }],
      vlines: [{ x: -0.5, color: COL.bad, dash: '5 3' }, { x: 0.5, color: COL.bad, dash: '5 3', label: '±0.5' }, { x: 3 * sig, color: COL.ref, label: '3σ' }, { x: -3 * sig, color: COL.ref }] }, widthOf('mmMc')),
      `Simulated σ = ${num(sd, 3)} LSB, formula ${num(sig, 3)} LSB. Chips with every code step within ±0.5 LSB: ${num(pass * 100, 0)} %. Each chip draws every bit weight at random and all ${2 ** P.bits} codes are checked; the histogram shows the mid-scale step only.`);
    const tr = [[true, true], [true, false], [false, true], [false, false]].map(([pol, hal]) => {
      const a = matchingArray({ bits: P.bits, halving: hal, polarity: pol });
      const r = requiredCu(a, aC);
      const me = pol === s.polarity && hal === s.halving;
      return `<tr class="${me ? 'best' : ''}"><td>${pol ? 'charge sharing (±)' : 'charge redistribution (on/off)'}${hal ? ', last 3 bits by halving' : ''}</td><td class="num">${a.M}</td><td class="num">${a.k}</td><td class="num">${num(3 * midSigma(a, aC / Math.sqrt(35)), 2)}</td><td class="num">${eng(r.cu, 'F')}</td><td class="num">${eng(r.total, 'F')}</td><td class="num">${eng(a.M * 35e-15, 'F')}</td></tr>`;
    }).join('');
    fill('mmTab', `<div class="tablewrap"><table class="tbl"><thead><tr><th>Array</th><th>Units M</th><th>Codes per unit</th><th>3σ at 35 fF units [LSB]</th><th>Unit for 3σ &lt; 0.5</th><th>Total for 3σ &lt; 0.5</th><th>Total with 35 fF units</th></tr></thead><tbody>${tr}</tbody></table></div>`,
      'Two limits. Matching (no calibration) needs the same total in every row. The smallest capacitor of the PDK, 35 fF, sets the last column: that is where halving and the two polarities pay off, once redundancy and calibration have removed the matching limit.');
  },
};
export { bitSigma };
