// Chapter 2: angles, delays and memory cells.

import { knob, knobGroup } from '../knobs.js';
import { context } from '../ctx.js';
import { plot, figure, C } from '../charts.js';
import { eng, num } from '../fmt.js';
import { v, t, frac, eq, paren } from '../math.js';
import { readouts, fillReadouts } from '../callouts.js';
import { receiveDelays, quantise, cellsNeeded, worstPhaseError, beamPattern } from '../../model/beamformer.js';

export const chapter = {
  id: 'beam', n: 2, short: 'Beamforming', title: 'Which angles and delays does a tile need?',
  lede: 'Steering sets the longest delay; the longest delay sets the memory cells; the delay step sets the sidelobes.',
  view(state) {
    return {
      knobs: knobGroup('Beam', ['steer', 'focus', 'delayStep'].map((id) => knob(state, id)).join('')) + knobGroup('Tile', ['channels', 'pitch', 'c'].map((id) => knob(state, id)).join('')),
      main: `${readouts('bm-ro')}
        <div class="grid2">${figure('bm-delay', 'Delay per element')}${figure('bm-cells', 'Memory cells per channel against steering')}</div>
        ${figure('bm-beam', 'Receive beam at the focus, exact against rounded delays')}
        <details class="math-d"><summary>Show the math</summary><div class="math" id="bm-math"></div></details>`,
    };
  },
  update(state) {
    const { P, tauMax, cells } = context(state);
    const N = P.channels;
    const ex = receiveDelays({ N, pitch: P.pitch, theta: P.steer, F: P.focus, c: P.c });
    const q = quantise(ex.tau, P.delayStep);
    const ns = (x) => x * 1e9;
    document.getElementById('bm-delay').innerHTML = plot({ width: 400,
      height: 240,
      x: { min: 0, max: N - 1, label: 'element' },
      y: { min: 0, max: Math.max(ns(Math.max(...ex.tau)), ns(Math.max(...q)), 1) * 1.1, label: 'delay [ns]' },
      series: [
        { points: ex.tau.map((x, i) => [i, ns(x)]), color: C.a, width: 2, label: 'exact' },
        { points: q.map((x, i) => [i, ns(x)]), color: C.b, mode: 'dots', r: 3.5, label: `rounded to ${num(ns(P.delayStep), 2)} ns` },
      ],
      legend: true,
    });
    const tw = 1 / P.fs;
    const ang = [];
    for (let a = 0; a <= 30; a += 0.5) ang.push(a);
    const curve = (step) =>
      ang.map((a) => {
        const r = receiveDelays({ N, pitch: P.pitch, theta: (a * Math.PI) / 180, F: Infinity, c: P.c });
        return [a, cellsNeeded(Math.max(...r.tau), step, tw).m];
      });
    document.getElementById('bm-cells').innerHTML = plot({ width: 400,
      height: 240,
      x: { min: 0, max: 30, label: 'steering angle [°]' },
      y: { min: 0, max: 45, label: 'cells per channel' },
      series: [
        { points: curve(25e-9), color: C.muted, step: true, label: '25 ns step' },
        { points: curve(P.delayStep), color: C.a, step: true, width: 2, label: `${num(ns(P.delayStep), 2)} ns step` },
        { points: [[P.steer * (180 / Math.PI), cells.m]], color: C.b, mode: 'dots', r: 5 },
      ],
      vlines: [{ x: P.steer * (180 / Math.PI), color: C.b }],
      legend: true,
    });
    const bpE = beamPattern({ N, pitch: P.pitch, theta: P.steer, F: P.focus, c: P.c, f0: P.f0, tau: ex.tau });
    const bpQ = beamPattern({ N, pitch: P.pitch, theta: P.steer, F: P.focus, c: P.c, f0: P.f0, tau: q });
    const b25 = beamPattern({ N, pitch: P.pitch, theta: P.steer, F: P.focus, c: P.c, f0: P.f0, tau: quantise(ex.tau, 25e-9) });
    document.getElementById('bm-beam').innerHTML = plot({
      height: 260,
      x: { min: -90, max: 90, label: 'angle [°]' },
      y: { min: -50, max: 2, label: 'level [dB]' },
      series: [
        { points: b25.angles.map((a, i) => [a, b25.db[i]]), color: C.muted, width: 1.2, label: '25 ns step' },
        { points: bpE.angles.map((a, i) => [a, bpE.db[i]]), color: C.a, width: 2, label: 'exact delays' },
        { points: bpQ.angles.map((a, i) => [a, bpQ.db[i]]), color: C.b, width: 1.6, dash: '5 3', label: `${num(ns(P.delayStep), 2)} ns step` },
      ],
      legend: true,
    });
    document.getElementById('bm-beam-cap').textContent = `Peak sidelobe: exact ${num(bpE.sidelobe.level, 1)} dB, ${num(ns(P.delayStep), 2)} ns step ${num(bpQ.sidelobe.level, 1)} dB, 25 ns step ${num(b25.sidelobe.level, 1)} dB. Narrowband at f0, focus on the arc; the 60 % bandwidth smooths the lobes somewhat.`;
    fillReadouts(document.getElementById('bm-ro'), [
      ['Longest delay', eng(tauMax, 's'), 'plane wave, edge element'],
      ['Cells per channel', `${cells.m}`, `${cells.k} steps + 1 for zero delay`],
      ['Memory capacitors', `${cells.m * N * 2}`, `${cells.m} × ${N} × 2 sides`],
      ['Worst phase error', `${num(worstPhaseError(P.f0, P.delayStep), 1)}°`, `25 ns would give ${num(worstPhaseError(P.f0, 25e-9), 1)}°`],
    ]);
    const D = (N - 1) * P.pitch;
    document.getElementById('bm-math').innerHTML = [
      eq(v('D'), '=', paren(`${v('N')} − 1`), v('p'), '=', `${N - 1} × ${num(P.pitch * 1e6, 0)} ${t('µm')}`, '=', `${num(D * 1e3, 2)} ${t('mm')}`),
      eq(v('τ', 'max'), '=', frac(`${v('D')} sin ${v('θ')}`, v('c')), '=', frac(`${num(D * 1e3, 2)} ${t('mm')} × ${num(Math.sin(P.steer), 3)}`, `${num(P.c, 0)} ${t('m/s')}`), '=', eng(tauMax, 's')),
      eq(v('K'), '=', `⌈${frac(v('τ', 'max'), v('T', 'w'))}⌉`, '=', `⌈${frac(eng(tauMax, 's'), eng(tw, 's'))}⌉`, '=', cells.k, ',', v('M'), '=', `${v('K')} + 1`, '=', cells.m),
      eq(v('Δφ'), '=', frac(`360° · ${v('f', '0')} · ${v('Δτ')}`, '2'), '=', `${num(worstPhaseError(P.f0, P.delayStep), 1)}°`),
      '<p class="note">The 12.5 ns step uses whole 25 ns cells: a channel writes on the falling clock edge for the extra half step (backup slide), so the cell count stays set by 25 ns slots.</p>',
    ].join('');
  },
};
