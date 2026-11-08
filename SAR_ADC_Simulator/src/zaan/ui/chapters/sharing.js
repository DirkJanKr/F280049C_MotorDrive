// Chapter 3: one charge-sharing conversion, decision by decision.

import { knob, uiKnob, knobGroup } from '../knobs.js';
import { context } from '../ctx.js';
import { plot, bars, figure, C } from '../charts.js';
import { eng, num, esc } from '../fmt.js';
import { v, t, frac, eq } from '../math.js';
import { readouts, fillReadouts, check, insight } from '../callouts.js';
import { idealChip, drawChip, convert, combine, designWeights } from '../../model/chargeSar.js';
import { createRng } from '../../../model/rng.js';

export function chipFor(state, d, P) {
  return state.ui.useChip ? drawChip(d, P, createRng(P.seed)) : idealChip(d);
}

export const chapter = {
  id: 'sharing', n: 3, short: 'Charge sharing', title: 'How does a charge-sharing conversion work?',
  lede: 'The 16 delayed memory cells are shared onto one node. Precharged DAC capacitors are then shared onto it, one per decision, with a polarity set by the comparator. Charge is kept; capacitance grows.',
  view(state) {
    return {
      knobs:
        knobGroup('Input', uiKnob(state, 'vin', { label: 'Differential input', min: -0.5, max: 0.5, step: 0.001, unit: 'V' })) +
        knobGroup('Circuit', knob(state, 'vref') + knob(state, 'vos') + `<label class="kcheck"><input type="checkbox" id="useChip" ${state.ui.useChip ? 'checked' : ''}/> Fabricated chip with mismatch (seed ${state.reg.find((p) => p.id === 'seed').value})</label>`),
      main: `${readouts('sh-ro')}
        ${figure('sh-walk', 'The search: comparison level per decision', 'Green band: everything the steps left can still reach. If the input stays inside it, a wrong decision is repaired.')}
        <div class="grid2">${figure('sh-cap', 'Capacitance on the node grows')}${figure('sh-volt', 'What the comparator sees')}</div>
        ${figure('sh-off', 'Offset, in LSB, against the tolerance of each decision')}
        <div id="sh-check"></div>
        <details class="math-d"><summary>Decision table</summary><div class="tablewrap" id="sh-table"></div></details>
        <details class="math-d"><summary>Show the math</summary><div class="math" id="sh-math"></div></details>`,
    };
  },
  update(state) {
    const { P, d } = context(state);
    const chip = chipFor(state, d, P);
    const x = (state.ui.vin / P.fullScale) * d.codes;
    const r = convert(chip, d, x, { vos: P.vos, trace: true });
    const xc = x + d.codes / 2;
    const code = combine(r.dec, designWeights(d), d.codes);
    const n = d.decisions;
    // levels with the true (physical) step charges
    const levels = [d.codes / 2];
    const wTrue = chip.q.map((q) => q / d.qLsb);
    for (let i = 0; i < n - 1; i++) levels.push(levels[i] + (r.dec[i] ? 1 : -1) * wTrue[i]);
    const reach = levels.map((_, i) => wTrue.slice(i).reduce((a, w) => a + w, 0));
    const walk = levels.map((L, i) => [i + 1, L]);
    document.getElementById('sh-walk').innerHTML = plot({
      height: 280,
      x: { min: 0.5, max: n + 0.5, label: 'decision', ticks: Array.from({ length: n }, (_, i) => i + 1) },
      y: { min: 0, max: d.codes, label: 'level [code]' },
      series: [
        { points: walk, color: C.a, width: 2, label: 'comparison level' },
        { points: walk.map((p, i) => [p[0], p[1]]), color: C.a, mode: 'dots', r: 4 },
      ],
      hlines: [{ y: xc, color: C.b, dash: '6 3', width: 1.5 }],
      overlay: (sx, sy) =>
        levels
          .map((L, i) => {
            const inside = Math.abs(xc - L) <= reach[i] + 0.5;
            const x0 = sx(i + 1) - 7;
            return `<rect x="${x0}" y="${sy(Math.min(d.codes, L + reach[i] + 0.5))}" width="14" height="${Math.abs(sy(Math.max(0, L - reach[i] - 0.5)) - sy(Math.min(d.codes, L + reach[i] + 0.5)))}" rx="3" fill="${inside ? 'var(--ok)' : 'var(--bad)'}" opacity="0.18"/>
              <text x="${sx(i + 1)}" y="${sy(L) - 9}" text-anchor="middle" font-size="10" fill="${r.dec[i] ? 'var(--ok)' : 'var(--muted)'}">${r.dec[i] ? '▲' : '▼'}</text>`;
          })
          .join('') + `<text x="${sx(0.6)}" y="${sy(xc) + 16}" font-size="11" fill="${C.b}">input ${num(xc, 1)}</text>`,
      legend: true,
    });
    const cn = r.steps.slice(0, n).map((s) => s.cn * 1e12);
    const lab = Array.from({ length: n }, (_, i) => `${i + 1}`);
    document.getElementById('sh-cap').innerHTML = bars({ width: 400, labels: lab, series: [{ label: 'node capacitance [pF]', values: cn, color: 'var(--c3)' }], height: 230 });
    document.getElementById('sh-cap-cap').textContent = `From ${num(cn[0], 2)} pF (16 memory cells) to ${num(r.steps[n].cn * 1e12, 2)} pF after the last share.`;
    const vs = r.steps.slice(0, n).map((s) => s.v * 1e3);
    const vmax = Math.max(...vs.map(Math.abs), 1e-3);
    document.getElementById('sh-volt').innerHTML = plot({ width: 400,
      height: 230,
      x: { min: 0.5, max: n + 0.5, label: 'decision', ticks: Array.from({ length: n }, (_, i) => i + 1) },
      y: { min: -vmax * 1.15, max: vmax * 1.15, label: 'node voltage [mV]' },
      series: [{ points: vs.map((y, i) => [i + 1, y]), color: C.a, width: 2 }, { points: vs.map((y, i) => [i + 1, y]), color: C.a, mode: 'dots', r: 3.5 }],
      hlines: [{ y: 0, color: C.muted, dash: '' }, { y: -P.vos * 1e3, color: C.bad, dash: '4 3' }],
    });
    document.getElementById('sh-volt-cap').textContent = `Red dashed: the comparator trips at −Vos = ${num(-P.vos * 1e3, 2)} mV. One LSB at the last decision is ${num((d.qLsb / d.cNode[n - 1]) * 1e3, 3)} mV.`;
    const offL = r.steps.slice(0, n).map((s) => Math.abs(s.offsetLsb));
    document.getElementById('sh-off').innerHTML = bars({
      labels: lab, height: 240,
      series: [{ label: 'tolerance [LSB]', values: d.tol.map((x) => Math.min(x, 60)), color: 'var(--c3)' }, { label: `offset at ${num(P.vos * 1e3, 1)} mV [LSB]`, values: offL, color: 'var(--bad)' }],
    });
    document.getElementById('sh-off-cap').textContent = `The same offset voltage is worth ${num(offL[0], 2)} LSB at decision 1 and ${num(offL[n - 1], 2)} LSB at decision ${n}, where the tolerance is 0. A changing error is a nonlinearity; it needs offset calibration.`;
    const per = (i) => (d.cNode[i] * 1e-3) / d.qLsb;
    document.getElementById('sh-check').innerHTML = check(
      'Offset per mV: your slides 11 and 36 differ',
      `Slide 11: 1.0 / 2.3 / 3.6 LSB per mV (first, halfway, last). Slide 36: 2.6 LSB per mV. This model: ${num(per(0), 2)} / ${num(per(Math.floor(n / 2)), 2)} / ${num(per(n - 1), 2)} LSB per mV, from the node capacitance before each decision. Slide 36's 512 · Vos / VREF corresponds to a node of 2 · CDAC only.`
    ) + insight('Why the node capacitance does not change the decision', 'The comparator compares the sign of Q / C; C is always positive, so the decision follows the charge. Only offset and noise, which are voltages, become charge errors that grow with C.');
    fillReadouts(document.getElementById('sh-ro'), [
      ['Output code', `${code}`, `ideal ${Math.max(0, Math.min(d.codes - 1, Math.floor(xc)))}`, code === Math.floor(xc) ? 'ok' : 'bad'],
      ['Decisions', `${n}`, `${n - 1} shared steps`],
      ['Node at start', eng(d.cNode[0], 'F'), `16 × CM, CM ${eng(d.cm, 'F')}`],
      ['LSB at last decision', eng(d.qLsb / d.cNode[n - 1], 'V'), 'at the comparator'],
    ]);
    const rows = r.steps.slice(0, n).map((s, i) => `<tr><td>${i + 1}</td><td class="num">${i < n - 1 ? num(wTrue[i], 2) : 'none'}</td><td class="num">${num(s.Q * 1e15, 2)}</td><td class="num">${num(s.cn * 1e12, 3)}</td><td class="num">${num(s.v * 1e3, 3)}</td><td class="num">${num(s.offsetLsb, 2)}</td><td>${s.bit}</td></tr>`).join('');
    document.getElementById('sh-table').innerHTML = `<table class="tbl"><thead><tr><th>Decision</th><th>Step [LSB]</th><th>Q [fC]</th><th>C node [pF]</th><th>V [mV]</th><th>Offset [LSB]</th><th>Bit</th></tr></thead><tbody>${rows}</tbody></table><p class="note">Charge after the last share: ${num(r.steps[n].Q * 1e15, 3)} fC = input charge minus the shared step charges (charge conservation).</p>`;
    document.getElementById('sh-math').innerHTML = [
      eq(v('Q', 'in'), '=', `${v('N')} ${v('C', 'M')} ${v('V', 'in')}`, ',', v('Q', 'LSB'), '=', frac(`2 ${v('V', 'REF')} ${v('C', 'u')}`, t('LSB per unit')), '=', eng(d.qLsb, 'C')),
      eq(t('After step'), v('i'), ':', v('Q'), '←', `${v('Q')} − ${v('s', 'i')} ${v('q', 'i')}`, ',', v('C', 'node'), '←', `${v('C', 'node')} + 2 ${v('C', 'i')}`),
      eq(v('V', 'node'), '=', frac(v('Q'), v('C', 'node')), ',', t('offset in LSB'), '=', frac(`${v('C', 'node')} ${v('V', 'os')}`, v('Q', 'LSB'))),
      `<p class="note">${esc('Assumption (A): one unit step delivers 2 · VREF · Cu of differential charge and adds 2 · Cu to the node, as implied by slides 11, 15 and 36.')}</p>`,
    ].join('');
  },
};
