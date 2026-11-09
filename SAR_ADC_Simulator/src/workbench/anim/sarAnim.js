// SAR conversion step by step, drawn as the circuit: the memory cells on the node,
// the CDAC steps as capacitors that join the node one by one with the polarity the
// decision chose, the comparator and the raw decisions.
// Differential: one floating capacitor per step between node + and node −; node + gets
// ∓q/2 and node − the opposite (Q+ = Q/2, Q− = −Q/2 around a constant common mode).
// Single-ended view: one node holding the differential charge Q on C node, the same decisions.

import { eng, num } from '../kit.js';

export const S = { trace: null, ctx: null, state: 0, from: 0, f: 1, playing: false, timer: 0, raf: 0, mode: 'diff' };

/** States: 0 = sampled; 2k+1 = decision k made; 2k+2 = step k shared. */
export function maxState(ctx) {
  return 2 * ctx.d.decisions - 1;
}

function cellsBlock(x, y, q, qMax, label, sub) {
  const h = 92;
  const fillH = (Math.abs(q) / qMax) * (h / 2 - 6);
  return `<rect x="${x}" y="${y - h / 2}" width="190" height="${h}" rx="10" class="mem"/>
    <line x1="${x + 30}" x2="${x + 30}" y1="${y - h / 2 + 6}" y2="${y + h / 2 - 6}" class="axis"/>
    <rect x="${x + 22}" y="${q >= 0 ? y - fillH : y}" width="16" height="${Math.max(1, fillH)}" class="${q >= 0 ? 'qpos' : 'qneg'}"/>
    <text x="${x + 48}" y="${y - 8}" class="lbl">${label}</text><text x="${x + 48}" y="${y + 14}" class="lbl dim">${sub}</text>`;
}

export function view(ctx, trace, state, w, mode = 'diff') {
  const { d, P } = ctx;
  const n = d.decisions;
  const diff = mode === 'diff';
  const k = state === 0 ? -1 : Math.floor((state - 1) / 2);
  const decided = state === 0 ? 0 : k + 1;
  const sharedUpTo = state === 0 ? -1 : state % 2 === 0 ? k : k - 1;
  const st = trace.steps[Math.min(sharedUpTo + 1, n)];
  const steps = d.weights.length;
  const H = diff ? 480 : 330;
  const x0 = 300;
  const x1 = w - 200;
  const cw = (x1 - x0) / steps;
  const yP = diff ? 175 : 190;
  const yN = 305;
  const q = st.Q;
  const qMax = Math.max(...trace.steps.map((s) => Math.abs(s.Q)), 1e-18);
  const p = [`<svg viewBox="0 0 ${w} ${H}" class="dsvg" role="img" aria-label="${diff ? 'Differential' : 'Single-ended'} conversion">`];
  p.push(`<text x="16" y="26" class="lbl b">${P.channels} memory cells, read together</text>`);
  if (diff) {
    p.push(cellsBlock(16, yP, q / 2, qMax / 2, `Q+ ${eng(q / 2, 'C')}`, `V+ − Vcm ${eng(st.v / 2, 'V')}`));
    p.push(cellsBlock(16, yN, -q / 2, qMax / 2, `Q− ${eng(-q / 2, 'C')}`, `V− − Vcm ${eng(-st.v / 2, 'V')}`));
  } else p.push(cellsBlock(16, yP, q, qMax, `Q ${eng(q, 'C')}`, `V − Vcm ${eng(st.v, 'V')}`));
  p.push(`<line x1="206" x2="${x1 + 20}" y1="${yP}" y2="${yP}" class="node"/><text x="${x0 - 56}" y="${yP - 10}" class="lbl b">${diff ? 'node +' : 'node'}</text>`);
  if (diff) p.push(`<line x1="206" x2="${x1 + 20}" y1="${yN}" y2="${yN}" class="node"/><text x="${x0 - 56}" y="${yN + 26}" class="lbl b">node −</text>`);
  for (let i = 0; i < steps; i++) {
    const cx = x0 + i * cw + cw / 2;
    const shared = i <= sharedUpTo;
    const bit = trace.dec[i];
    const now = state % 2 === 0 && i === k && state > 0;
    const kind = d.steps[i].kind;
    const wt = d.weights[i];
    const pol = shared ? (bit ? 'minus' : 'plus') : 'wait';
    const half = Math.min(cw * 0.36, 26);
    // the capacitor: two plates; above node + (and below node − in differential)
    const plates = (y, dir, cls) => `<g class="capg ${cls} ${kind} ${now ? 'now' : ''}"><line x1="${cx}" x2="${cx}" y1="${y}" y2="${y + dir * 46}" class="lead ${shared ? 'on' : ''}"/>
      <line x1="${cx - half}" x2="${cx + half}" y1="${y + dir * 46}" y2="${y + dir * 46}" class="plate"/><line x1="${cx - half}" x2="${cx + half}" y1="${y + dir * 56}" y2="${y + dir * 56}" class="plate"/>
      <line x1="${cx}" x2="${cx}" y1="${y + dir * 56}" y2="${y + dir * 74}" class="lead2"/></g>`;
    p.push(plates(yP, -1, pol));
    p.push(`<text x="${cx}" y="${yP - 84}" class="wl" text-anchor="middle">${num(wt, wt < 10 ? 2 : 0)}</text>`);
    if (diff) {
      p.push(plates(yN, 1, shared ? (bit ? 'plus' : 'minus') : 'wait'));
      p.push(`<path d="M${cx + half + 4} ${yP - 64} C${cx + half + 16} ${yP - 20}, ${cx + half + 16} ${yN + 20}, ${cx + half + 4} ${yN + 64}" class="float ${shared ? 'on' : ''}"/>`);
    } else p.push(`<path d="M${cx - 8} ${yP - 74} H${cx + 8} M${cx - 5} ${yP - 78} H${cx + 5}" class="gnd"/>`);
    if (shared) {
      p.push(`<text x="${cx}" y="${yP - 100}" class="pol ${bit ? 'neg' : 'posv'}" text-anchor="middle">${bit ? '−' : '+'}</text>`);
      if (diff) p.push(`<text x="${cx}" y="${yN + 100}" class="pol ${bit ? 'posv' : 'neg'}" text-anchor="middle">${bit ? '+' : '−'}</text>`);
    }
  }
  // comparator and output
  const cx = x1 + 52;
  const cy = diff ? (yP + yN) / 2 : yP;
  const act = state % 2 === 1 ? 'act' : '';
  p.push(`<path d="M${cx} ${cy - 46} L${cx} ${cy + 46} L${cx + 66} ${cy} Z" class="cmp ${act}"/>`);
  p.push(`<path d="M${x1 + 20} ${yP} H${cx - 12} V${cy - 22} H${cx}" class="wire2"/>`);
  if (diff) p.push(`<path d="M${x1 + 20} ${yN} H${cx - 12} V${cy + 22} H${cx}" class="wire2"/>`);
  else p.push(`<text x="${cx - 40}" y="${cy + 30}" class="lbl dim">Vcm</text><path d="M${cx - 12} ${cy + 22} H${cx}" class="wire2"/>`);
  p.push(`<text x="${cx + 6}" y="${cy - 14}" class="lbl">+</text><text x="${cx + 6}" y="${cy + 28}" class="lbl">−</text>`);
  p.push(`<text x="${cx + 86}" y="${cy + 14}" class="big ${act}">${decided ? trace.dec[decided - 1] : '·'}</text>`);
  // raw decisions
  const bw = Math.min(32, (w - 300) / n);
  for (let i = 0; i < n; i++) {
    const known = i < decided;
    p.push(`<rect x="${20 + i * bw}" y="${H - 48}" width="${bw - 4}" height="32" rx="5" class="rb ${known ? (trace.dec[i] ? 'one' : 'zero') : ''} ${i === decided - 1 && act ? 'cur' : ''}"/><text x="${20 + i * bw + (bw - 4) / 2}" y="${H - 26}" class="rbt" text-anchor="middle">${known ? trace.dec[i] : '·'}</text>`);
  }
  p.push(`<text x="${24 + n * bw}" y="${H - 26}" class="lbl dim">raw decisions d1 … d${n}</text>`);
  p.push(`<text x="${w - 14}" y="26" class="lbl" text-anchor="end">Q ${eng(q, 'C')} · C node ${eng(st.cn, 'F')} · ${diff ? 'V+ − V−' : 'V − Vcm'} ${eng(st.v, 'V')}</text>`);
  p.push('</svg>');
  return p.join('');
}

export function describe(ctx, trace, state, mode = 'diff') {
  const n = ctx.d.decisions;
  const diff = mode === 'diff';
  if (state === 0) return `Sampled: the ${ctx.P.channels} selected memory cells are connected to the node; their charge Q = ${ctx.P.channels} CM · V in = ${eng(trace.steps[0].Q, 'C')} is the input. No step is shared yet.`;
  const k = Math.floor((state - 1) / 2);
  const st = trace.steps[k];
  if (state % 2 === 1) return `Decision ${k + 1} of ${n}: the comparator sees ${diff ? 'V+ − V−' : 'V − Vcm'} = ${eng(st.v, 'V')} and outputs ${trace.dec[k]}.`;
  const w = ctx.d.weights[k];
  const nx = trace.steps[k + 1];
  return `Step ${k + 1} (${num(w, 2)} LSB, q = ${eng(w * ctx.d.qLsb, 'C')}) is connected with sign ${trace.dec[k] ? '−' : '+'}${diff ? ' to node + and the opposite to node −' : ''}, pulling the charge towards zero: ${eng(st.Q, 'C')} → ${eng(nx.Q, 'C')}. The node capacitance grows to ${eng(nx.cn, 'F')}.`;
}
