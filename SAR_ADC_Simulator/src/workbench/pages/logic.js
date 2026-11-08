// SAR logic page: what the self-timed logic does, animated from one conversion.
// Behavioural: it shows the job of the logic, not its gate-level design (30 Nov block).

import { group, knobs, card, fill, widthOf, explain, eng, num, esc } from '../kit.js';
import { idealChip, convert } from '../../zaan/model/chargeSar.js';
import { decisionTime } from '../../zaan/model/timing.js';

const L = { plan: null, t: 0, raf: 0, playing: false };

function buildPlan(ctx, vin) {
  const { P, d } = ctx;
  const r = convert(idealChip(d), d, (vin / P.fullScale) * d.codes, { trace: true });
  const ph = [{ kind: 'sample', t0: 0, t1: P.tSample }];
  let t = P.tSample;
  for (let i = 0; i < d.decisions; i++) {
    const td = decisionTime(ctx.tauC, P.vfinal, r.steps[i].v);
    ph.push({ kind: 'decide', i, t0: t, t1: t + td });
    t += td;
    ph.push({ kind: 'logic', i, t0: t, t1: t + P.tLogic });
    t += P.tLogic;
    if (i < d.decisions - 1) {
      const ts = Math.max(ctx.settle[i].redundant, 0.02e-9);
      ph.push({ kind: 'share', i, t0: t, t1: t + ts });
      t += ts;
    }
  }
  ph.push({ kind: 'done', t0: t, t1: t + 1.5e-9 });
  return { r, ph, tEnd: t + 1.5e-9 };
}

export const page = {
  id: 'logic',
  title: 'SAR logic',
  side(store) {
    const used = new Set();
    return `<p class="ks pad">Behavioural view: what the logic must do. The circuit itself is designed in the 30 Nov block; times are illustrative.</p>` + group('Illustrative timing', knobs(store.values, ['tSample', 'tLogic', 'tauDac', 'ibias', 'cload'], used));
  },
  main() {
    return `<section class="card wide"><header><h3>The self-timed loop</h3><span class="ctl"><button class="mini" id="lgBack">◀ step</button><button class="mini primary" id="lgPlay">▶ play</button><button class="mini" id="lgNext">step ▶</button><label class="mini-l">input <input type="range" id="lgVin" step="0.001"/> <output id="lgVinO"></output></label></span></header>
      <div id="lgBlock"></div><p class="cap" id="lgSay"></p></section>
      <section class="card wide"><header><h3>Signals, as a logic analyzer would show them</h3></header><div id="lgWave"></div><p class="cap">Cursor follows the animation. Each decision starts when the previous one is done (VALID falls after the reset), not on a fixed clock.</p></section>
      ${explain('What each signal does', [
        '<b>SAMPLE</b> connects the selected memory cells to the node. <b>COMP</b> enables the dynamic comparator; it regenerates until one output wins. <b>VALID</b> rises when the outputs differ: the decision is made. Its edge clocks the decision into the register (<b>D</b>) and moves the one-hot <b>POINTER</b> to the next step.',
        '<b>SW</b> connects the precharged capacitor pair of the current step to the node, with the polarity set by the decision. Then the comparator is reset, VALID falls, and the next decision starts by itself. After the last decision <b>DONE</b> moves the raw decisions to the output register.',
      ])}`;
  },
  mount(store) {
    const vin = document.getElementById('lgVin');
    const P = store.ctx.P;
    vin.min = String(-P.fullScale / 2);
    vin.max = String(P.fullScale / 2);
    vin.value = String(store.ui.vin);
    vin.oninput = () => {
      store.ui.vin = Number(vin.value);
      page.update(store, store.ctx);
    };
    const steps = () => L.plan.ph.map((p) => p.t0);
    const go = (dir) => {
      const s = steps();
      let i = s.findIndex((x) => x > L.t + 1e-15);
      if (i < 0) i = s.length;
      const j = Math.max(0, Math.min(s.length - 1, dir > 0 ? i : i - 2));
      L.t = s[j] + 1e-14;
      draw(store.ctx);
    };
    document.getElementById('lgBack').onclick = () => go(-1);
    document.getElementById('lgNext').onclick = () => go(1);
    document.getElementById('lgPlay').onclick = (e) => {
      L.playing = !L.playing;
      e.target.textContent = L.playing ? '❚❚ pause' : '▶ play';
      if (!L.playing) return;
      if (L.t >= L.plan.tEnd) L.t = 0;
      let last = performance.now();
      const tick = (now) => {
        if (!L.playing) return;
        L.t += (((now - last) / 1000) * 1e-9) / 0.6;
        last = now;
        if (L.t >= L.plan.tEnd) {
          L.t = L.plan.tEnd;
          L.playing = false;
          e.target.textContent = '▶ play';
        }
        draw(store.ctx);
        if (L.playing && document.getElementById('lgWave')) L.raf = requestAnimationFrame(tick);
      };
      L.raf = requestAnimationFrame(tick);
    };
  },
  update(store, ctx) {
    L.plan = buildPlan(ctx, store.ui.vin);
    if (L.t > L.plan.tEnd) L.t = L.plan.tEnd;
    const o = document.getElementById('lgVinO');
    if (o) o.textContent = `${num(store.ui.vin, 3)} V`;
    draw(ctx);
  },
};

function phaseAt(t) {
  return L.plan.ph.find((p) => t >= p.t0 && t < p.t1) || L.plan.ph[L.plan.ph.length - 1];
}

function draw(ctx) {
  const ph = phaseAt(L.t);
  const n = ctx.d.decisions;
  const decided = L.plan.ph.filter((p) => p.kind === 'decide' && p.t1 <= L.t).length;
  block(ctx, ph, decided, widthOf('lgBlock', 1000));
  wave(ctx, widthOf('lgWave', 1000));
  const say = {
    sample: 'SAMPLE: the selected memory cells are connected to the node.',
    decide: `COMP: the comparator regenerates on decision ${ph.i + 1}; small inputs take longer.`,
    logic: `VALID: decision ${ph.i + 1} = ${L.plan.r.dec[ph.i]} is clocked into the register; the pointer moves on.`,
    share: `SW: step ${ph.i + 1} is shared with polarity ${L.plan.r.dec[ph.i] ? '−' : '+'} on the + side; the comparator is reset.`,
    done: `DONE: all ${n} raw decisions go to the output register.`,
  }[ph.kind];
  fill('lgSay', `${say} t = ${eng(L.t, 's')}.`);
}

function block(ctx, ph, decided, w) {
  const n = ctx.d.decisions;
  const H = 330;
  const act = (k) => (ph.kind === k ? 'act' : '');
  const cellW = Math.min(46, (w - 520) / n);
  const regX = 420;
  const cells = (y, fn) => Array.from({ length: n }, (_, i) => fn(i, regX + i * cellW, y)).join('');
  const pointer = ph.kind === 'done' ? -1 : ph.kind === 'sample' ? 0 : ph.i;
  const svg = `<svg viewBox="0 0 ${w} ${H}" class="lsvg" role="img" aria-label="SAR logic">
    <rect x="20" y="40" width="150" height="110" rx="12" class="lb ${act('decide')}"/><text x="95" y="72" class="lt" text-anchor="middle">comparator</text><text x="95" y="96" class="ls" text-anchor="middle">OUTP / OUTN</text><text x="95" y="124" class="lv" text-anchor="middle">${ph.kind === 'decide' ? 'regenerating' : decided ? `last = ${L.plan.r.dec[decided - 1]}` : 'reset'}</text>
    <rect x="210" y="40" width="160" height="110" rx="12" class="lb ${act('logic')}"/><text x="290" y="72" class="lt" text-anchor="middle">valid detect</text><text x="290" y="96" class="ls" text-anchor="middle">OUTP ≠ OUTN</text><text x="290" y="124" class="lv" text-anchor="middle">VALID ${ph.kind === 'logic' ? '1' : '0'}</text>
    <path d="M170 95 H210" class="lw ${act('logic')}"/><path d="M370 95 H${regX - 10}" class="lw ${act('logic')}"/>
    <text x="${regX}" y="34" class="ls">one-hot pointer</text>${cells(44, (i, x, y) => `<rect x="${x}" y="${y}" width="${cellW - 5}" height="34" rx="5" class="lc ${i === pointer ? 'ptr' : ''}"/><text x="${x + (cellW - 5) / 2}" y="${y + 22}" class="lcs" text-anchor="middle">${i + 1}</text>`)}
    <text x="${regX}" y="110" class="ls">decision register D</text>${cells(120, (i, x, y) => `<rect x="${x}" y="${y}" width="${cellW - 5}" height="34" rx="5" class="lc ${i < decided ? (L.plan.r.dec[i] ? 'one' : 'zero') : ''}"/><text x="${x + (cellW - 5) / 2}" y="${y + 23}" class="lcs" text-anchor="middle">${i < decided ? L.plan.r.dec[i] : '·'}</text>`)}
    <text x="${regX}" y="186" class="ls">switch drivers SW to the CDAC</text>${cells(196, (i, x, y) => `<rect x="${x}" y="${y}" width="${cellW - 5}" height="34" rx="5" class="lc ${ph.kind === 'share' && ph.i === i ? 'sw' : i < decided - (ph.kind === 'logic' || ph.kind === 'decide' ? 1 : 0) && i < n - 1 ? 'swd' : ''}"/><text x="${x + (cellW - 5) / 2}" y="${y + 23}" class="lcs" text-anchor="middle">${i < n - 1 ? `s${i + 1}` : ''}</text>`)}
    <path d="M${regX + n * cellW + 10} 213 H${w - 30} V290 H95 V150" class="lw ${act('share')}" marker-end="url(#la)"/>
    <text x="${w - 40}" y="306" class="ls" text-anchor="end">charge to the node, comparator reset, next decision starts</text>
    <rect x="${w - 170}" y="40" width="140" height="70" rx="12" class="lb ${act('done')}"/><text x="${w - 100}" y="70" class="lt" text-anchor="middle">DONE</text><text x="${w - 100}" y="94" class="ls" text-anchor="middle">to output register</text>
    <defs><marker id="la" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" class="lah"/></marker></defs>
  </svg>`;
  fill('lgBlock', svg);
}

function wave(ctx, w) {
  const { ph, tEnd, r } = L.plan;
  const sx = (t) => 110 + (t / tEnd) * (w - 120);
  const rows = ['SAMPLE', 'COMP', 'VALID', 'POINTER', 'D', 'SW', 'DONE'];
  const y0 = (i) => 20 + i * 44;
  const lvl = (i, hi) => y0(i) + (hi ? 4 : 26);
  const sig = (i, pred) => {
    let d = `M110 ${lvl(i, false)}`;
    for (const p of ph) {
      const hi = pred(p);
      d += ` L${sx(p.t0)} ${lvl(i, hi)} L${sx(p.t1)} ${lvl(i, hi)}`;
    }
    return `<path d="${d}" class="wv"/>`;
  };
  const bus = (i, label) => ph.filter((p) => label(p) !== null).map((p) => `<path d="M${sx(p.t0)} ${y0(i) + 15} l5 -11 H${sx(p.t1) - 5} l5 11 l-5 11 H${sx(p.t0) + 5} z" class="bus"/><text x="${(sx(p.t0) + sx(p.t1)) / 2}" y="${y0(i) + 20}" class="bt" text-anchor="middle">${label(p)}</text>`).join('');
  let D = '';
  let ptrRow = '';
  let known = '';
  for (const p of ph) {
    if (p.kind === 'logic') known += r.dec[p.i];
  }
  const parts = [
    sig(0, (p) => p.kind === 'sample'),
    sig(1, (p) => p.kind === 'decide'),
    sig(2, (p) => p.kind === 'logic'),
    bus(3, (p) => (p.kind === 'decide' && sx(p.t1) - sx(p.t0) > 14 ? String(p.i + 1) : null)),
    bus(4, (p) => (p.kind === 'logic' && sx(p.t1) - sx(p.t0) > 10 ? String(r.dec[p.i]) : null)),
    sig(5, (p) => p.kind === 'share'),
    sig(6, (p) => p.kind === 'done'),
  ];
  const labels = rows.map((name, i) => `<text x="8" y="${y0(i) + 20}" class="lbl">${name}</text>`).join('');
  const ticks = [];
  for (let k = 0; k <= Math.floor((tEnd * 1e9) / 2); k++) ticks.push(`<text x="${sx(k * 2e-9)}" y="${y0(7) + 6}" class="tiny" text-anchor="middle">${k * 2}</text>`);
  fill('lgWave', `<svg viewBox="0 0 ${w} ${y0(7) + 30}" class="tsvg">${labels}${parts.join('')}<line x1="${sx(L.t)}" x2="${sx(L.t)}" y1="10" y2="${y0(7) - 8}" class="cursor"/>${ticks.join('')}<text x="${w - 8}" y="${y0(7) + 22}" class="tiny" text-anchor="end">ns</text></svg>`);
}
