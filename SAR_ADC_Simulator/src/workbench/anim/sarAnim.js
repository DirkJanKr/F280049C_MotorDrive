// Charge sharing as buckets. Width of a bucket = capacitance, water level above
// the common-mode line = voltage, area between the line and the level = charge.
// Connected capacitors share one level, so the node bucket is the memory cells
// plus every step shared so far. Charge is kept when a step joins.
//
// Differential: each step is one floating capacitor between node + and node −,
// precharged to VREF. In the half circuit of each side it is 2C holding ±VREF/2,
// so each side receives ∓q/2 (q = 2 VREF C). Single-ended view: one node holding
// the differential charge Q on C node, the same LSB and the same decisions.

import { eng, num } from '../kit.js';

export const S = { trace: null, ctx: null, state: 0, from: 0, f: 1, playing: false, timer: 0, raf: 0, mode: 'diff' };

/** States: 0 = sampled; 2k+1 = decision k made; 2k+2 = step k shared. */
export function maxState(ctx) {
  return 2 * ctx.d.decisions - 1;
}

function sharedCount(state) {
  if (state === 0) return 0;
  const k = Math.floor((state - 1) / 2);
  return state % 2 === 0 ? k + 1 : k;
}

/** Vertical scale: a round number of mV per bucket half-height, so the level is readable. */
function scaleFor(vmax, hh) {
  const raw = Math.max(Math.abs(vmax), 1e-7) / 0.8;
  const p = 10 ** Math.floor(Math.log10(raw));
  const full = [1, 2, 5, 10].map((m) => m * p).find((x) => x >= raw);
  return { full, k: hh / full };
}

function bucket(x, y, w, h, cls) {
  return `<path d="M${x} ${y} V${y + h} H${x + w} V${y}" class="bk ${cls}"/>`;
}

/** One side: a node bucket made of segments, all at one level. sign = +1 (node +) or −1 (node −). */
function side(o) {
  const { x0, y, h, segs, level, sc, label, sign, mode } = o;
  const mid = y + h / 2;
  const width = segs.reduce((a, s) => a + s.w, 0);
  const ly = mid - Math.max(-h / 2, Math.min(h / 2, level * sc.k));
  const out = [];
  out.push(`<rect x="${x0}" y="${Math.min(ly, y + h)}" width="${width}" height="${Math.max(0, y + h - ly)}" class="water"/>`);
  out.push(`<rect x="${x0}" y="${Math.min(ly, mid)}" width="${width}" height="${Math.abs(mid - ly)}" class="${level >= 0 ? 'qp' : 'qn'}"/>`);
  let x = x0;
  for (const s of segs) {
    out.push(`<line x1="${x}" x2="${x}" y1="${y}" y2="${y + h}" class="seg"/>`);
    if (s.w > 26) out.push(`<text x="${x + s.w / 2}" y="${sign > 0 || mode === 'single' ? y - 6 : y + h + 16}" class="sgl" text-anchor="middle">${s.label}</text>`);
    x += s.w;
  }
  out.push(bucket(x0, y, width, h, ''));
  out.push(`<line x1="${x0 - 8}" x2="${x0 + width + 8}" y1="${mid}" y2="${mid}" class="vcm"/>`);
  out.push(`<text x="${x0 + width + 12}" y="${mid + 4}" class="sgl">Vcm</text>`);
  out.push(`<text x="${x0 + 6}" y="${y + 18}" class="lbl b">${label}</text>`);
  return { svg: out.join(''), width, ly };
}

export function view(ctx, trace, state, w, mode = 'diff', f = 1, from = state) {
  const { d, P } = ctx;
  const n = d.decisions;
  const diff = mode === 'diff';
  const H = diff ? 500 : 440;
  const cFinal = trace.steps[n - 1].cn;
  const sx = (w - 230) / cFinal;
  const x0 = 24;
  const nNow = sharedCount(state);
  const moving = state % 2 === 0 && state > 0 && from === state - 1 && f < 1 ? nNow - 1 : -1;
  const before = trace.steps[Math.max(0, nNow - 1)];
  const after = trace.steps[nNow];
  const lerp = (a, b) => a + (b - a) * f;
  const vNode = moving >= 0 ? lerp(before.v, after.v) : after.v;
  const vSide = diff ? vNode / 2 : vNode;
  const hB = diff ? 120 : 210;
  const yTop = 44;
  const yDac = diff ? yTop + hB + 36 : yTop + hB + 44;
  const yBot = yDac + 96;
  const vScale = Math.max(Math.abs(diff ? before.v / 2 : before.v), Math.abs(vSide));
  const sc = scaleFor(vScale, hB / 2);
  const segs = [{ w: d.cNode[0] * sx, label: `${P.channels} cells` }];
  for (let i = 0; i < nNow; i++) if (i !== moving) segs.push({ w: d.cAdd[i] * sx, label: num(d.weights[i], d.weights[i] < 10 ? 1 : 0) });
  const parts = [`<svg viewBox="0 0 ${w} ${H}" class="dsvg" role="img" aria-label="Charge sharing shown as buckets">`];
  const top = side({ x0, y: yTop, h: hB, segs, level: vSide, sc, label: diff ? 'node +' : 'node', sign: 1, mode });
  parts.push(top.svg);
  let bot = null;
  if (diff) {
    bot = side({ x0, y: yBot, h: hB, segs, level: -vSide, sc, label: 'node −', sign: -1, mode });
    parts.push(bot.svg);
  }
  // scale bar
  parts.push(`<line x1="${w - 196}" x2="${w - 196}" y1="${yTop + hB / 2}" y2="${yTop}" class="sbar"/><text x="${w - 190}" y="${yTop + 12}" class="sgl">${eng(sc.full, 'V')}</text>`);
  // DAC capacitors not yet shared, and the one moving in
  let dx = x0;
  const dacH = 54;
  for (let i = 0; i < d.weights.length; i++) {
    const cw = Math.max(3, d.cAdd[i] * sx);
    const kind = d.steps[i].kind;
    if (i < nNow && i !== moving) {
      dx += cw + 4;
      continue;
    }
    let x = dx;
    let y = yDac;
    if (i === moving) {
      const tx = x0 + top.width;
      x = lerp(dx, tx);
      y = lerp(yDac, diff ? yDac : yTop + hB - dacH);
    }
    const pol = trace.dec[i] ? '−' : '+';
    const showPol = i < nNow || (state % 2 === 1 && i === nNow);
    parts.push(`<rect x="${x}" y="${y}" width="${cw}" height="${dacH}" rx="3" class="dac ${kind} ${i === moving ? 'mv' : ''}"/>`);
    if (cw > 22) parts.push(`<text x="${x + cw / 2}" y="${y + dacH / 2 + 5}" class="wl" text-anchor="middle">${num(d.weights[i], d.weights[i] < 10 ? 1 : 0)}</text>`);
    if (showPol && cw > 10) parts.push(`<text x="${x + cw / 2}" y="${y - 6}" class="pol" text-anchor="middle">${diff ? `${pol}½q` : `${pol}q`}</text>`);
    dx += cw + 4;
  }
  parts.push(`<text x="${x0}" y="${yDac + dacH + 18}" class="sgl">${diff ? `CDAC steps, each a floating capacitor between node + and node −, precharged to VREF = ${eng(P.vref, 'V')}` : `CDAC steps, each precharged to VREF = ${eng(P.vref, 'V')}`}; width = capacitance, label = weight in LSB</text>`);
  // comparator
  const cx = w - 150;
  const cy = diff ? (yTop + hB / 2 + yBot + hB / 2) / 2 : yTop + hB / 2;
  const act = state % 2 === 1 ? 'act' : '';
  parts.push(`<path d="M${cx} ${cy - 46} L${cx} ${cy + 46} L${cx + 64} ${cy} Z" class="cmp ${act}"/>`);
  parts.push(`<path d="M${x0 + top.width + 40} ${yTop + hB / 2} H${cx - 14} V${cy - 22} H${cx}" class="wire"/>`);
  if (diff) parts.push(`<path d="M${x0 + bot.width + 40} ${yBot + hB / 2} H${cx - 14} V${cy + 22} H${cx}" class="wire"/>`);
  parts.push(`<text x="${cx + 6}" y="${cy - 16}" class="sgl">+</text><text x="${cx + 6}" y="${cy + 28}" class="sgl">${diff ? '−' : 'Vcm'}</text>`);
  const decided = state === 0 ? 0 : Math.floor((state - 1) / 2) + 1;
  parts.push(`<text x="${cx + 84}" y="${cy + 14}" class="big ${act}">${decided ? trace.dec[decided - 1] : '·'}</text>`);
  const q = moving >= 0 ? lerp(before.Q, after.Q) : after.Q;
  parts.push(`<text x="${w - 12}" y="22" class="lbl" text-anchor="end">${diff ? `Q+ = ${eng(q / 2, 'C')}, Q− = ${eng(-q / 2, 'C')}` : `Q = ${eng(q, 'C')}`} · C node ${eng(moving >= 0 ? lerp(before.cn, after.cn) : after.cn, 'F')} · ${diff ? 'V+ − V−' : 'V − Vcm'} = ${eng(vNode, 'V')}</text>`);
  // raw decisions
  const bw = Math.min(30, (w - 260) / n);
  for (let i = 0; i < n; i++) {
    const known = i < decided;
    parts.push(`<rect x="${x0 + i * bw}" y="${H - 44}" width="${bw - 4}" height="30" rx="5" class="rb ${known ? (trace.dec[i] ? 'one' : 'zero') : ''} ${i === decided - 1 && act ? 'cur' : ''}"/><text x="${x0 + i * bw + (bw - 4) / 2}" y="${H - 23}" class="rbt" text-anchor="middle">${known ? trace.dec[i] : '·'}</text>`);
  }
  parts.push(`<text x="${x0 + n * bw + 10}" y="${H - 23}" class="sgl">raw decisions d1 … d${n}</text></svg>`);
  return parts.join('');
}

export function describe(ctx, trace, state, mode) {
  const n = ctx.d.decisions;
  const diff = mode === 'diff';
  if (state === 0) return `Sampled: the ${ctx.P.channels} selected memory cells form the node bucket. The water above the Vcm line is the input charge Q = ${ctx.P.channels} CM · V in = ${eng(trace.steps[0].Q, 'C')}${diff ? ', half on each side with opposite sign' : ''}.`;
  const k = Math.floor((state - 1) / 2);
  const st = trace.steps[k];
  if (state % 2 === 1) return `Decision ${k + 1} of ${n}: the comparator sees ${diff ? 'V+ − V−' : 'V − Vcm'} = ${eng(st.v, 'V')} and outputs ${trace.dec[k]}.`;
  const w = ctx.d.weights[k];
  const nx = trace.steps[k + 1];
  return `Step ${k + 1} (${num(w, 2)} LSB, charge q = ${eng(w * ctx.d.qLsb, 'C')}) joins the node with sign ${trace.dec[k] ? '−' : '+'}${diff ? ' on node + and the opposite on node −' : ''}. The bucket gets ${eng(ctx.d.cAdd[k], 'F')} wider; the charge goes from ${eng(st.Q, 'C')} to ${eng(nx.Q, 'C')} and the level to ${eng(nx.v, 'V')}.`;
}
