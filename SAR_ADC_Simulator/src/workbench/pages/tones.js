// Beamformer tones: memory cell mismatch (gain) and switch charge injection (offset), simulated
// with the same picture as MATLAB step 2b, plus what happens when the memory cells shrink.
// Story: a channel reuses its M cells, so any difference between cells repeats every M samples.
// A gain difference multiplies the echo (tones at f +- k fs/M, they scale with the echo);
// an injection difference adds a fixed charge (tones at k fs/M, they do not scale with the echo).

import { fill, widthOf, plot, readouts, explain, eng, num, COL, statusChip } from '../kit.js';
import { siOf, mismatchCoefficient } from '../design.js';
import { simulateTones, toneTheory, dbc } from '../../zaan/model/tones.js';

const memo = {};
const db = (p) => (p > 0 ? `${num(dbc(p), 1)} dBc` : 'none');
// How each budget line scales with C M (the CDAC follows at fixed alpha): exponent of C M / C M now (D).
const SCALE = { samp: -0.5, pre: -0.5, swn: -0.5, cell: -1 };

export const page = {
  id: 'tones',
  title: 'Mismatch tones',
  main(store) {
    const lv = store.ui.toneLevel ?? -1;
    return `<section class="card wide"><header><h3>Tones from the memory cells</h3><span class="ctl"><label class="mini-l">echo level <input type="range" id="tnLev" min="-60" max="0" step="1" value="${lv}"/> <output id="tnLevO"></output></label></span></header><div class="cbody" id="tnRead"></div></section>
      <section class="card wide"><header><h3>Spectrum of the beamformer output, one chip</h3></header><div class="cbody" id="tnSpec"></div><p class="cap" id="tnSpec-cap"></p></section>
      <div class="grid2"><section class="card"><header><h3>Tones against the echo level</h3></header><div class="cbody" id="tnLevel"></div><p class="cap" id="tnLevel-cap"></p></section>
      <section class="card"><header><h3>Shrinking the memory cells: MIM against MOM</h3></header><div class="cbody" id="tnScale"></div><p class="cap" id="tnScale-cap"></p></section></div>
      ${explain('How this is simulated', [
        'Every channel writes sample t into cell (t − d j) mod M, with d j its steering delay in samples. Each cell gets a random gain, the average of its P and N capacitor error (σ = A C / √C M), and a random extra charge from its switch (σ q, the value "Extra charge spread per memory cell").',
        'The 16 channels are added for a sine at the chosen level, and the power is read at every tone frequency. The same record repeated over 20 chips gives the averages; the spectrum shows the first chip.',
        'Theory (D): gain tones / signal = σ cap² / (2N) · (M − 1)/M; offset tones / signal = N σ q² (M − 1)/M / (A² / 2), A = level · Q FS / 2. The table shows both next to the simulation.',
      ])}
      ${explain('What this means for the image', [
        'Gain tones scale with the echo: about 66 dB below every echo, far under the array sidelobes. They mainly cost sine-wave ENOB.',
        'Offset tones do not scale with the echo. For a weak echo, or in a dark region, they are all that is left, repeating every M samples: stripes every c · M / (2 fs) in depth.',
        'Getting σ q: a Cadence Monte Carlo of one memory cell (its switches, at the real clock edges), reading the charge left on the cell for a fixed input; or bottom-plate sampling to make it signal-independent, then pattern subtraction (Chen 2018 p. 3059).',
      ])}`;
  },
  mount(store) {
    document.getElementById('tnLev').oninput = (e) => { store.ui.toneLevel = Number(e.target.value); page.update(store, store.ctx); };
  },
  update(store, ctx) {
    const { P, d, budget } = ctx;
    const v = store.values;
    const lv = store.ui.toneLevel ?? -1;
    document.getElementById('tnLevO').textContent = `${lv} dBFS`;
    const level = 10 ** (lv / 20);
    const aMem = P.aCMem / 100;
    const band = [P.f0 * (1 - siOf(v, 'fbw') / 2), P.f0 * (1 + siOf(v, 'fbw') / 2)];
    const o = { N: P.channels, M: P.memCells, fs: P.fs, f0: P.f0 * 0.73, pitch: P.pitch, steer: P.steer, cm: d.cm, aMem, cellQ: P.cellQ || 0, level, qFs: d.qFs, band, chips: 20, seed: P.seed + 5 };
    const key = JSON.stringify(o);
    if (memo.k !== key) { memo.k = key; memo.r = simulateTones(o); }
    const r = memo.r;
    const th = r.theory;
    fill('tnRead', readouts([
      ['Gain tones, all', db(r.gain), `theory ${db(th.gain)}; in band ${db(r.gainIn)}`],
      ['Offset tones, all', db(r.offset), `theory ${db(th.offset)}; in band ${db(r.offsetIn)}`],
      ['Largest single tone', db(r.largest), 'worst of 20 chips'],
      ['Memory cell', `${siOf(v, 'capMem')}, ${eng(d.cm, 'F')}`, `σ cap = ${num(th.sigCap * 100, 3)} %, σ q = ${num((P.cellQ || 0) * 1e15, 2)} fC`],
    ]) + `<p class="cap">Echo at ${lv} dBFS. Band ${num(band[0] / 1e6, 1)} to ${num(band[1] / 1e6, 1)} MHz. σ q ${statusChip('A')} is a placeholder until a Cadence Monte Carlo of the cell switch; A C of the memory cells ${statusChip(siOf(v, 'capMem') === 'MIM' ? 'S' : 'U')}.</p>`);
    const w = Math.max(360, widthOf('tnSpec'));
    const stems = (kind) => r.first.tones.filter((t) => t.kind === kind).map((t) => [t.f / 1e6, Math.max(-140, dbc(t.p))]);
    const lo = Math.min(-120, Math.floor(Math.min(...r.first.tones.map((t) => dbc(t.p)).filter(Number.isFinite)) / 10) * 10);
    fill('tnSpec', plot({ height: 230, x: { min: 0, max: P.fs / 2e6, label: 'frequency [MHz]' }, y: { min: lo, max: 5, label: 'dBc' }, legend: true,
      xbands: [{ x0: band[0] / 1e6, x1: band[1] / 1e6, color: 'var(--panel2)' }],
      series: [{ points: [[r.first.fSig / 1e6, 0]], mode: 'stem', color: COL.ink, width: 2, label: 'echo' }, { points: stems('gain'), mode: 'stem', color: COL.an, width: 1.6, label: 'gain tones' }, { points: stems('offset'), mode: 'stem', color: COL.ref, width: 1.6, label: 'injection tones' }] }, w),
    `Gain tones at f ± k · fs/${P.memCells}, injection tones at k · fs/${P.memCells} = k · ${num(P.fs / P.memCells / 1e6, 2)} MHz. Shaded: the echo band.`);
    const levels = Array.from({ length: 61 }, (_, i) => -60 + i);
    const t0 = toneTheory({ N: P.channels, M: P.memCells, cm: d.cm, aMem, cellQ: P.cellQ || 0, level: 1, qFs: d.qFs });
    const w2 = Math.max(320, widthOf('tnLevel'));
    const offAt = (L) => (t0.offset > 0 ? dbc(t0.offset) - L : -200);
    const cross = t0.offset > 0 ? dbc(t0.offset) - dbc(t0.gain) : null;
    fill('tnLevel', plot({ height: 210, x: { min: -60, max: 0, label: 'echo level [dBFS]' }, y: { min: -100, max: 0, label: 'all tones [dBc]' }, legend: true,
      series: [{ points: levels.map((L) => [L, dbc(t0.gain)]), color: COL.an, width: 2, label: 'gain' }, { points: levels.map((L) => [L, offAt(L)]), color: COL.ref, width: 2, label: 'injection' }],
      vlines: [{ x: lv, color: COL.ink }] }, w2),
    cross !== null ? `Theory lines. Injection tones pass the gain tones below ${num(cross, 0)} dBFS: weaker echoes see the fixed pattern more than the mismatch.` : 'No injection set: only gain tones, the same at every level.');
    const lines = budget.lines;
    const p0 = lines.reduce((a, l) => a + l.lsb ** 2, 0);
    const aMom = siOf(v, 'aMom');
    const aMim = mismatchCoefficient(siOf(v, 'pairSigma'), siOf(v, 'density')) / 100;
    const dens = siOf(v, 'momDensity');
    const enobAt = (cm, aNew) => {
      const f = cm / d.cm;
      const p = lines.reduce((a, l) => {
        let x = l.lsb * f ** (SCALE[l.id] ?? 0);
        if (l.id === 'slot' && l.lsb > 0) x = l.lsb * (aNew / aMem) * f ** -0.5;
        return a + x * x;
      }, 0);
      return budget.enob - 0.5 * Math.log2(p / p0);
    };
    const cms = Array.from({ length: 50 }, (_, i) => 15e-15 * 1.07 ** i).filter((c) => c <= 600e-15);
    const w3 = Math.max(320, widthOf('tnScale'));
    const area = (cm, type) => (cm / 280e-15) * (type === 'MOM' ? 1 / dens : 1);
    fill('tnScale', plot({ height: 210, x: { min: 0, max: 600, label: 'C M [fF]' }, y: { min: 6, max: 10, label: 'ENOB (budget)' }, legend: true,
      series: [{ points: cms.map((c) => [c * 1e15, enobAt(c, aMim)]), color: COL.ref, width: 2, label: 'MIM' }, { points: cms.map((c) => [c * 1e15, enobAt(c, aMom)]), color: COL.an, width: 2, label: 'MOM' }],
      vlines: [{ x: d.cm * 1e15, color: COL.ink, label: 'now' }, { x: 280 * dens, color: COL.muted, dash: '2 3', label: 'MOM, area of MIM 280 fF' }] }, w3)
      + `<table class="tbl" style="margin-top:6px"><thead><tr><th>C M</th><th>MIM: ENOB, area</th><th>MOM: ENOB, area</th></tr></thead><tbody>${[280, 140, 70, 35].map((c) => `<tr><td class="num">${c} fF</td><td class="num">${num(enobAt(c * 1e-15, aMim), 2)}, ${num(area(c * 1e-15, 'MIM'), 2)} ×</td><td class="num">${num(enobAt(c * 1e-15, aMom), 2)}, ${num(area(c * 1e-15, 'MOM'), 2)} ×</td></tr>`).join('')}</tbody></table>`,
    `Scaled from the noise budget (D): kT/C lines go with 1/√C M, the injection line with 1/C M (a fixed σ q in fC), the gain tones with A C / √C M, the rest stays. Area relative to MIM at 280 fF; MOM density ${num(dens, 2)} × MIM ${statusChip('A')}. The fixed injection charge is the wall when cells shrink; if the cell switch shrinks with C M, its charge shrinks too and that wall moves.`);
  },
};
