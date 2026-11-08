// One conversion, played on the schematic. Driven by the model trace of the
// simulated chip (same as the decision table): switch states, charge dots,
// node voltage, comparator decision, register bits, and a time cursor.

import { convert } from '../zaan/model/chargeSar.js';
import { decisionTime } from '../zaan/model/timing.js';
import { eng, num } from '../zaan/ui/fmt.js';

export const anim = { playing: false, t: 0, speed: 1, plan: null, raf: 0, onFrame: null };

/** Timeline of one conversion in model time (seconds). */
export function buildPlan(ctx, vin) {
  const { P, d, sim } = ctx;
  const x = (vin / P.fullScale) * d.codes;
  const r = convert(sim.chip, d, x, { vos: P.vosCal, trace: true });
  const tauC = ctx.D.tauComp.value;
  const phases = [{ kind: 'sample', t0: 0, t1: P.tSample }];
  let t = P.tSample;
  for (let i = 0; i < d.decisions; i++) {
    if (i > 0) {
      const ts = Math.max(ctx.settle[i - 1].redundant, 0.05e-9);
      phases.push({ kind: 'share', i: i - 1, bit: r.dec[i - 1], t0: t, t1: t + ts });
      t += ts;
    }
    const td = decisionTime(tauC, P.vfinal, r.steps[i].v + P.vosCal);
    phases.push({ kind: 'decide', i, bit: r.dec[i], t0: t, t1: t + td });
    t += td;
    phases.push({ kind: 'logic', i, t0: t, t1: t + P.tLogic });
    t += P.tLogic;
  }
  // which memory cell is read: the oldest written cell in the ring (index shown only)
  // Channel 1 cell read at this instant: the ring position is arbitrary, cell 1 is shown.
  const readCell = 0;
  return { x, r, phases, tEnd: t, readCell, vin };
}

function phaseAt(plan, t) {
  return plan.phases.find((p) => t >= p.t0 && t < p.t1) || plan.phases[plan.phases.length - 1];
}

function setSwitch(id, closed) {
  const el = document.getElementById(id);
  if (!el) return;
  const [x, y] = (closed ? el.dataset.closed : el.dataset.open).split(' ');
  el.setAttribute('x2', x);
  el.setAttribute('y2', y);
  el.classList.toggle('closed', closed);
}

function centre(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  const b = el.getBBox();
  return [b.x + b.width / 2, b.y + b.height / 2];
}

/** Draw the state of the schematic at model time t. */
export function drawAt(plan, ctx, t) {
  if (!plan) return;
  const { d } = ctx;
  const n = d.decisions;
  const ph = phaseAt(plan, t);
  const decided = plan.phases.filter((p) => p.kind === 'decide' && p.t1 <= t).length;
  const shared = plan.phases.filter((p) => p.kind === 'share' && p.t0 <= t).map((p) => p.i);
  for (let i = 0; i < d.weights.length; i++) {
    const on = shared.includes(i);
    setSwitch(`ssw-p-${i}`, on);
    setSwitch(`ssw-n-${i}`, on);
    setSwitch(`psw-${i}`, !on && t > 0);
    setSwitch(`nsw-${i}`, !on && t > 0);
  }
  const M = ctx.P.memCells ?? ctx.cells;
  for (let k = 0; k < M; k++) setSwitch(`rsw-${k}`, ph.kind === 'sample' && k === plan.readCell);
  for (let i = 0; i < n; i++) {
    const r = document.getElementById(`rb-${i}`);
    const tx = document.getElementById(`rbt-${i}`);
    if (!r) continue;
    const known = i < decided;
    r.setAttribute('class', known ? (plan.r.dec[i] ? 'one' : 'zero') : ph.kind === 'decide' && ph.i === i ? 'cur' : '');
    if (tx) tx.textContent = known ? String(plan.r.dec[i]) : '·';
  }
  const co = document.getElementById('compOut');
  if (co) {
    co.textContent = ph.kind === 'decide' ? (t > (ph.t0 + ph.t1) / 2 ? String(ph.bit) : '?') : decided ? String(plan.r.dec[decided - 1]) : '·';
    co.setAttribute('class', `bigv ${ph.kind === 'decide' ? 'active' : ''}`);
  }
  const step = plan.r.steps[Math.min(decided, n - 1)];
  const nv = document.getElementById('nodeV');
  if (nv) nv.textContent = t > 0 ? `V node ${num(step.v * 1e3, 2)} mV · C ${eng(step.cn, 'F')}` : '';
  const hs = document.getElementById('hs');
  if (hs) hs.classList.toggle('pulse', ph.kind === 'logic');
  drawDots(plan, ph, t > 0 ? t : -1);
}

/** Charge dots: from the read cell to the node while sampling, from a step capacitor to the node while sharing. */
function drawDots(plan, ph, t) {
  const g = document.getElementById('dots');
  if (!g) return;
  let from = null;
  let to = null;
  let cls = 'dot';
  if (t < 0) {
    g.innerHTML = '';
    return;
  }
  if (ph.kind === 'sample') {
    from = centre(`cell-${plan.readCell}`);
    to = [1100, 420];
  } else if (ph.kind === 'share') {
    from = centre(`capP-${ph.i}`);
    to = from ? [from[0], 420] : null;
    cls = ph.bit ? 'dot down' : 'dot up';
  }
  if (!from || !to) {
    g.innerHTML = '';
    return;
  }
  const f = (t - ph.t0) / (ph.t1 - ph.t0 || 1);
  const dots = [];
  for (let k = 0; k < 6; k++) {
    const u = (f + k / 6) % 1;
    dots.push(`<circle cx="${from[0] + (to[0] - from[0]) * u}" cy="${from[1] + (to[1] - from[1]) * u}" r="7" class="${cls}"/>`);
    if (ph.kind === 'share') {
      const fn = centre(`capN-${ph.i}`);
      if (fn) dots.push(`<circle cx="${fn[0]}" cy="${fn[1] + (560 - fn[1]) * u}" r="7" class="${cls}"/>`);
    }
  }
  g.innerHTML = dots.join('');
}

/** Time of the start of decision k (for stepping). */
export function decisionStart(plan, k) {
  const p = plan.phases.filter((q) => q.kind === 'decide')[k];
  return p ? p.t1 - 1e-15 : plan.tEnd;
}

export function play(ctx) {
  anim.playing = true;
  let last = performance.now();
  const tick = (now) => {
    if (!anim.playing) return;
    const dt = (now - last) / 1000;
    last = now;
    // 1 ns of model time takes 0.45 s at speed 1
    anim.t += (dt * anim.speed * 1e-9) / 0.45;
    if (anim.t >= anim.plan.tEnd) {
      anim.t = anim.plan.tEnd;
      anim.playing = false;
    }
    drawAt(anim.plan, ctx, anim.t);
    if (anim.onFrame) anim.onFrame();
    if (anim.playing) anim.raf = requestAnimationFrame(tick);
  };
  anim.raf = requestAnimationFrame(tick);
}

export function pause() {
  anim.playing = false;
  cancelAnimationFrame(anim.raf);
}
