// Chapter 6: a quiet reference and a small offset.

import { knob, knobGroup } from '../knobs.js';
import { context } from '../ctx.js';
import { plot, bars, figure, C } from '../charts.js';
import { eng, num } from '../fmt.js';
import { v, t, frac, eq } from '../math.js';
import { readouts, fillReadouts, check, insight } from '../callouts.js';
import { prechargeCharge, referenceWaveforms } from '../../model/reference.js';
import { idealChip } from '../../model/chargeSar.js';
import { testChip } from '../../model/testbench.js';
import { createRng } from '../../../model/rng.js';

export const chapter = {
  id: 'reference', n: 6, short: 'Reference & offset', title: 'How do we keep the reference quiet and the offset small?',
  lede: 'Charge sharing charges the CDAC once, before the conversion. The comparator offset is the error the tolerance cannot absorb at the end.',
  view(state) {
    return {
      knobs: knobGroup('Reference', knob(state, 'vref')) + knobGroup('Comparator offset', knob(state, 'vos') + knob(state, 'vosCal')),
      main: `${readouts('rf-ro')}
        ${figure('rf-wave', 'Charge drawn from V REF, per bit cycle, for six conversions')}
        <div class="grid2">${figure('rf-off', 'Offset against tolerance, before and after offset calibration')}${figure('rf-enob', 'ENOB against the offset left after calibration')}</div>
        ${figure('rf-area', 'Reference structure and CDAC area')}
        <div id="rf-check"></div>
        <details class="math-d"><summary>Show the math</summary><div class="math" id="rf-math"></div></details>`,
    };
  },
  update(state) {
    const { P, d } = context(state);
    const w = referenceWaveforms(P, d);
    const fC = (q) => q * 1e15;
    const pts = (arr) => arr.map((q, i) => [i, fC(q)]);
    const ymax = Math.max(...w.red.map(fC), ...w.share.map(fC)) * 1.1;
    document.getElementById('rf-wave').innerHTML = plot({
      height: 250, x: { min: -1, max: w.red.length, label: `bit cycle (${w.slots} per conversion)` }, y: { min: Math.min(0, ...w.red.map(fC)) * 1.1, max: ymax, label: 'charge [fC]' },
      series: [{ points: pts(w.red), color: C.bad, mode: 'stem', width: 3, base: 0, label: 'charge redistribution' }, { points: pts(w.share).map(([x, y]) => [x + 0.35, y]), color: C.a, mode: 'stem', width: 3, base: 0, label: 'charge sharing (precharge)' }],
      vlines: Array.from({ length: 6 }, (_, k) => ({ x: k * w.slots - 0.5, color: 'var(--line)', dash: '2 3' })),
      legend: true,
    });
    const pre = prechargeCharge(P, d);
    const red = w.red.filter((x, i) => i % w.slots !== 0);
    const spread = Math.max(...red) - Math.min(...red);
    document.getElementById('rf-wave-cap').textContent = `Red: a conventional differential CDAC of the same total capacitance draws a different charge at every bit, set by the signal (spread ${eng(spread, 'C')}). Teal: charge sharing draws ${eng(pre.q, 'C')} once per conversion and nothing during the decisions.`;
    const n = d.decisions;
    const lab = Array.from({ length: n }, (_, i) => `${i + 1}`);
    const off = (vos) => d.cNode.slice(0, n).map((c) => (c * vos) / d.qLsb);
    document.getElementById('rf-off').innerHTML = bars({ width: 400,
      labels: lab, height: 230,
      series: [{ label: 'tolerance', values: d.tol.map((x) => Math.min(x, 20)), color: 'var(--c3)' }, { label: `${num(P.vos * 1e3, 1)} mV`, values: off(P.vos), color: 'var(--bad)' }, { label: `${num(P.vosCal * 1e3, 2)} mV`, values: off(P.vosCal), color: 'var(--accent)' }],
      y: { label: 'LSB' },
    });
    document.getElementById('rf-off-cap').textContent = `At the last decisions the tolerance is 0, while the offset is worth ${num(off(P.vos)[n - 1], 2)} LSB before and ${num(off(P.vosCal)[n - 1], 2)} LSB after offset calibration. Tolerance bars capped at 20.`;
    const sweep = [0, 0.05, 0.1, 0.2, 0.3, 0.5, 0.75, 1, 1.5, 2].map((mv) => {
      const rng = createRng(7);
      const r = testChip(idealChip(d), d, { ...P, vosCal: mv * 1e-3, compNoise: 0 }, rng, { samplesPerCode: 1 });
      return [mv, r.sRaw.enob, r.sCal.enob];
    });
    document.getElementById('rf-enob').innerHTML = plot({ width: 400,
      height: 230, x: { min: 0, max: 2, label: 'offset left [mV]' }, y: { min: Math.min(...sweep.map((s) => s[1])) - 0.1, max: P.bits + 0.1, label: 'ENOB [bit]' },
      series: [{ points: sweep.map((s) => [s[0], s[1]]), color: C.muted, width: 1.6, label: 'design weights' }, { points: sweep.map((s) => [s[0], s[2]]), color: C.a, width: 2, label: 'weights calibrated with the offset present' }],
      hlines: [{ y: P.enobAim, color: C.b }], vlines: [{ x: P.vosCal * 1e3, color: C.b }],
      legend: true,
    });
    document.getElementById('rf-enob-cap').textContent = 'Ideal capacitors, no comparator noise: only the offset nonlinearity. Weight calibration absorbs part of it when the offset is present during calibration.';
    document.getElementById('rf-area').innerHTML = bars({
      labels: ['Ping-pong (Chen 2018)', 'One CDAC + reservoir (Guo 2024)'], height: 210,
      series: [{ label: 'CDAC [pF]', values: [2 * d.cdac * 1e12, d.cdac * 1e12], color: 'var(--accent)' }],
      y: { label: 'pF' },
    });
    document.getElementById('rf-area-cap').textContent = `Ping-pong doubles the CDAC to ${eng(2 * d.cdac, 'F')}. The reservoir saves area only if C_RSV plus its servo stays below one CDAC, ${eng(d.cdac, 'F')}; C_RSV is not sized yet.`;
    document.getElementById('rf-check').innerHTML =
      check('Offset during weight calibration', 'Offset present while the weights are measured can push decisions outside their redundancy range and corrupt the weights (Lopez-Angulo, IMSE). Calibrate the offset first, or keep it within the tolerance during weight calibration.') +
      insight('Why the reference stays quiet', 'The reference only refills the CDAC between conversions, with the same charge every time. During the decisions it is disconnected, so the analog channels sharing it see no signal-dependent spikes.');
    fillReadouts(document.getElementById('rf-ro'), [
      ['Precharge per conversion', eng(pre.q, 'C'), 'V REF times the precharged capacitance (Chen 2018, eq. 2)'],
      ['Average reference current', eng(pre.current, 'A'), `at ${num(P.fs / 1e6, 0)} MS/s`],
      ['Offset at last decision', `${num(off(P.vosCal)[n - 1], 2)} LSB`, `after calibration (${num(P.vosCal * 1e3, 2)} mV)`],
      ['Ping-pong CDAC area', eng(2 * d.cdac, 'F'), 'two copies'],
    ]);
    document.getElementById('rf-math').innerHTML = [
      eq(v('Q', 'pre'), '=', `${v('V', 'REF')} ${v('C', 'pre')}`, '=', `${num(P.vref * 1e3, 0)} ${t('mV')} × ${eng(pre.q / P.vref, 'F')}`, '=', eng(pre.q, 'C'), t('(C pre: whole-unit capacitors and the one halving source unit; the halving capacitors start empty)')),
      eq(v('I', 'avg'), '=', `${v('Q', 'pre')} ${v('f', 's')}`, '=', eng(pre.current, 'A')),
      eq(t('offset in LSB at decision'), v('i'), '=', frac(`${v('C', 'node,i')} ${v('V', 'os')}`, v('Q', 'LSB'))),
    ].join('');
  },
};
