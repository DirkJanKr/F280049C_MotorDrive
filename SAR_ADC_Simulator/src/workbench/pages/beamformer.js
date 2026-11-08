// Beamformer page: the memory cells at work for any steering angle, and what follows from it.

import { group, knobs, card, fill, widthOf, plot, readouts, explain, eng, num, COL } from '../kit.js';
import { startBeamAnim, beamControls, setBeamAngle } from '../anim/beamAnim.js';
import { receiveDelays, quantise, cellsNeeded, beamPattern, worstPhaseError } from '../../zaan/model/beamformer.js';
import { K_B } from '../../zaan/model/noise.js';

export const page = {
  id: 'beamformer',
  title: 'Beamformer',
  side(store) {
    const used = new Set();
    return group('Beam', knobs(store.values, ['steer', 'delayStep', 'rxFocus'], used)) + group('Tile and cells', knobs(store.values, ['channels', 'pitch', 'memCells', 'c'], used)) + group('Signal', knobs(store.values, ['f0', 'fbw', 'fs'], used), false);
  },
  main() {
    return `<section class="card wide"><header><h3>The memory cells at work</h3><span class="ctl"><button class="mini" id="bfPlay">pause</button><button class="mini" id="bfSweep">sweep −15° … +15°</button><label class="mini-l">speed <select id="bfSpeed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select></label></span></header>
        <canvas id="bfcv" class="cv" height="560"></canvas>
        <p class="cap">Each channel writes one cell per slot (white frame). A channel with an extra half step writes on CLK 180°, half a slot later (violet). At every read, the read select takes from each channel the cell written its delay ago (green frame); because the delays match the arrival times, those 16 cells hold the same part of the echo and their charges add up. Change the angle and the green pattern moves.</p></section>
      <div id="bfro"></div>
      <div class="grid2">${card('bfDelay', 'Delay per element, exact and rounded to the step')}${card('bfCells', 'Memory cells needed against steering angle')}</div>
      <div class="grid2">${card('bfBeam', 'Beam pattern: exact, 12.5 ns and 25 ns steps')}${card('bfClk', 'Write and read timing with CLK and CLK 180°')}</div>
      ${explain('How the delay works', [
        'Echoes from the steering direction reach the elements one after another. To add them, the earlier channels must wait. Each channel writes its signal into a ring of memory cells, one cell per write slot of 25 ns, and the read takes an older cell from a channel that must wait longer.',
        'Whole slots of delay come from reading further back in the ring. The half slot comes from the clock: a channel that writes on CLK 180° samples 12.5 ns later, so the same cell holds a sample shifted by half a slot. The number of cells is still set by the longest delay in 25 ns slots, plus one for zero delay.',
        'The read connects the chosen cell of all 16 channels to one node; their charges add. That is the delay-and-sum, done without an amplifier.',
      ])}`;
  },
  mount(store, ctx) {
    restart(store);
    const c = beamControls();
    document.getElementById('bfPlay').onclick = (e) => {
      c.setPlaying(!c.state.playing);
      e.target.textContent = c.state.playing ? 'pause' : 'play';
    };
    document.getElementById('bfSweep').onclick = (e) => {
      c.setSweep(!c.state.sweep);
      e.target.classList.toggle('on', c.state.sweep);
      if (!c.state.sweep) setBeamAngle(store.ctx.P);
    };
    document.getElementById('bfSpeed').onchange = (e) => c.setSpeed(Number(e.target.value));
  },
  update(store, ctx) {
    const { P, need, tauMax, delays, qd, halfSteps, tw } = ctx;
    if (lastShape !== `${P.channels}-${P.memCells}-${P.fs}`) restart(store);
    setBeamAngle(P);
    const cmVal = ctx.d.cm;
    const kt = Math.sqrt((2 * K_B * P.temperature) / (P.channels * cmVal));
    fill('bfro', readouts([
      ['Longest delay', eng(tauMax, 's'), `at ±${num(Math.abs(P.steer) * (180 / Math.PI), 1)}°`],
      ['Cells needed per channel', `${need.m}`, `you set ${P.memCells}`, need.m > P.memCells ? 'bad' : 'ok'],
      ['Memory capacitors', `${P.memCells * P.channels * 2}`, `${P.memCells} × ${P.channels} × 2 sides`],
      ['Channels on CLK 180°', `${halfSteps.filter((h) => h).length} of ${P.channels}`, 'at this angle'],
      ['Worst phase error', `${num(worstPhaseError(P.f0, P.delayStep), 1)}°`, `at ${eng(P.delayStep, 's')} steps`],
      ['Memory cell CM', eng(cmVal, 'F'), `kT/C of 16 read together ${eng(kt, 'V')} rms`],
    ]));
    const w = widthOf('bfDelay');
    const ns = (x) => x * 1e9;
    fill('bfDelay', plot({ x: { min: 0.5, max: P.channels + 0.5, label: 'element' }, y: { min: 0, max: Math.max(ns(Math.max(...delays.tau)), ns(Math.max(...qd)), 1) * 1.12, label: 'delay [ns]' }, series: [{ points: delays.tau.map((x, i) => [i + 1, ns(x)]), color: COL.an, width: 2.4, label: 'exact' }, { points: qd.map((x, i) => [i + 1, ns(x)]), color: COL.ref, mode: 'dots', r: 4.5, label: `rounded to ${num(ns(P.delayStep), 2)} ns` }], legend: true }, w), `Plane wave unless a receive focus is set. Longest delay ${eng(Math.max(...delays.tau), 's')}.`);
    const ang = [];
    for (let a = 0; a <= 30; a += 0.5) ang.push(a);
    const curve = (step) => ang.map((a) => [a, cellsNeeded(Math.max(...receiveDelays({ N: P.channels, pitch: P.pitch, theta: (a * Math.PI) / 180, F: Infinity, c: P.c }).tau), step, tw).m]);
    fill('bfCells', plot({ x: { min: 0, max: 30, label: 'steering angle [°]' }, y: { min: 0, max: 45, label: 'cells per channel' }, series: [{ points: curve(25e-9), color: COL.muted, step: true, label: '25 ns step' }, { points: curve(P.delayStep), color: COL.an, step: true, width: 2.2, label: `${num(ns(P.delayStep), 2)} ns step` }], vlines: [{ x: Math.abs(P.steer) * (180 / Math.PI), color: COL.ref }], hlines: [{ y: P.memCells, color: COL.dig, dash: '5 3' }], legend: true }, w), `Green dashed: the ${P.memCells} cells you set. The 12.5 ns step needs no extra cells: they are counted in 25 ns slots.`);
    const base = { N: P.channels, pitch: P.pitch, theta: P.steer, F: P.focus, c: P.c, f0: P.f0 };
    const e = beamPattern({ ...base, tau: delays.tau });
    const a = beamPattern({ ...base, tau: quantise(delays.tau, 12.5e-9) });
    const b = beamPattern({ ...base, tau: quantise(delays.tau, 25e-9) });
    const s = (bp) => bp.angles.map((x, i) => [x, bp.db[i]]);
    const sg = Math.sin(P.steer) - Math.sign(P.steer || 1) * (ctx.lambda / P.pitch);
    const grating = P.pitch > ctx.lambda / 2 && Math.abs(sg) <= 1 ? `The pitch is ${num(P.pitch / ctx.lambda, 2)} wavelengths (λ = ${num(ctx.lambda * 1e6, 0)} µm), so a grating lobe appears near ${num((Math.asin(sg) * 180) / Math.PI, 0)}° at full level in this array factor; the element directivity (not modeled) lowers it. ` : '';
    fill('bfBeam', plot({ x: { min: -90, max: 90, label: 'angle [°]' }, y: { min: -50, max: 2, label: 'level [dB]' }, series: [{ points: s(b), color: COL.muted, width: 1.2, label: '25 ns' }, { points: s(e), color: COL.an, width: 2.2, label: 'exact' }, { points: s(a), color: COL.ref, width: 1.6, dash: '5 3', label: '12.5 ns' }], legend: true }, w), `${grating}Narrowband at f0, array factor only.`);
    fill('bfClk', clocks(ctx, w), 'One channel on CLK, one on CLK 180°. The half-slot shift is what gives the 12.5 ns step without extra cells; the read instant within the slot is drawn for illustration.');
  },
};

let lastShape = '';
function restart(store) {
  const cv = document.getElementById('bfcv');
  if (!cv) return;
  const P = store.ctx.P;
  lastShape = `${P.channels}-${P.memCells}-${P.fs}`;
  cv.width = cv.clientWidth;
  startBeamAnim(cv, () => store.ctx.P);
}

function clocks(ctx, w) {
  const { tw, halfSteps } = ctx;
  const per = 5;
  const sx = (t) => 120 + (t / (per * tw)) * (w - 130);
  const sq = (y, shift) => {
    let d = `M120 ${y + 20}`;
    for (let k = 0; k < per * 2 + 1; k++) {
      const t0 = (k * tw) / 2 + shift - tw / 2;
      const hi = k % 2 === 1;
      d += ` L${sx(Math.max(0, t0))} ${hi ? y : y + 20} L${sx(Math.min(per * tw, t0 + tw / 2))} ${hi ? y : y + 20}`;
    }
    return `<path d="${d}" class="wclk"/>`;
  };
  const marks = (y, shift, cls) => Array.from({ length: per }, (_, k) => `<rect x="${sx(k * tw + shift) - 3}" y="${y}" width="6" height="18" class="${cls}"/><text x="${sx(k * tw + shift)}" y="${y + 34}" class="tiny" text-anchor="middle">cell ${k + 1}</text>`).join('');
  const c = halfSteps.findIndex((h) => h);
  return `<svg viewBox="0 0 ${w} 250" class="tsvg" role="img">
    <text x="6" y="36" class="lbl">CLK</text>${sq(22, 0)}
    <text x="6" y="80" class="lbl">CLK 180°</text>${sq(66, tw / 2)}
    <text x="6" y="124" class="lbl">ch 1 writes</text>${marks(110, 0, 'wev')}
    <text x="6" y="174" class="lbl">ch ${c + 1} writes</text>${marks(160, tw / 2, 'wev180')}
    <text x="6" y="224" class="lbl">read, all ch</text>${marks(210, tw * 0.75, 'rev')}
  </svg>`;
}
