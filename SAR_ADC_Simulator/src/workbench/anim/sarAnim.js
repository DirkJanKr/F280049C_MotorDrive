// Differential charge-sharing conversion, step by step.
// Model: the differential node charge Q and capacitance Cn come from the charge-sharing model.
// Shown per side assuming a symmetric pair around a constant common mode:
// Q+ = +Q/2, Q- = -Q/2, V+ - Vcm = +V/2, V- - Vcm = -V/2. A shared step moves q/2 on each side.

import { eng, num, esc } from '../kit.js';

export const S = { trace: null, ctx: null, state: 0, playing: false, timer: 0, onChange: null };

/** States: 0 = sampled; 2k+1 = decision k made; 2k+2 = step k shared. */
export function maxState(ctx) {
  return 2 * ctx.d.decisions - 1;
}

export function view(ctx, trace, state, w) {
  const { d } = ctx;
  const n = d.decisions;
  const k = state === 0 ? -1 : Math.floor((state - 1) / 2);
  const decided = state === 0 ? 0 : k + 1;
  const sharedUpTo = state === 0 ? -1 : state % 2 === 0 ? k : k - 1;
  const st = trace.steps[Math.min(sharedUpTo + 1, n)];
  const steps = d.weights.length;
  const H = 470;
  const x0 = 210;
  const x1 = w - 200;
  const cw = (x1 - x0) / steps;
  const yP = 170;
  const yN = 300;
  const q = st.Q;
  const qMax = Math.max(...trace.steps.map((s) => Math.abs(s.Q)), 1e-18);
  const bar = (y, val, cls) => {
    const len = (Math.abs(val) / qMax) * 140;
    return `<rect x="${x0 - 170}" y="${y - 50}" width="150" height="100" rx="10" class="mem"/><rect x="${x0 - 160}" y="${val >= 0 ? y - len / 3 : y}" width="16" height="${Math.max(1, len / 3)}" class="${cls}"/>`;
  };
  const parts = [`<svg viewBox="0 0 ${w} ${H}" class="dsvg" role="img" aria-label="Differential conversion">`];
  parts.push(`<text x="16" y="28" class="lbl b">16 memory cells, sampled</text>`);
  parts.push(bar(yP, q / 2, q >= 0 ? 'qpos' : 'qneg') + bar(yN, -q / 2, -q >= 0 ? 'qpos' : 'qneg'));
  parts.push(`<text x="${x0 - 130}" y="${yP - 8}" class="lbl">Q+ ${num((q / 2) * 1e15, 2)} fC</text><text x="${x0 - 130}" y="${yP + 18}" class="lbl dim">V+ − Vcm ${num((st.v / 2) * 1e3, 2)} mV</text>`);
  parts.push(`<text x="${x0 - 130}" y="${yN - 8}" class="lbl">Q− ${num((-q / 2) * 1e15, 2)} fC</text><text x="${x0 - 130}" y="${yN + 18}" class="lbl dim">V− − Vcm ${num((-st.v / 2) * 1e3, 2)} mV</text>`);
  parts.push(`<line x1="${x0 - 20}" x2="${x1 + 20}" y1="${yP}" y2="${yP}" class="node"/><line x1="${x0 - 20}" x2="${x1 + 20}" y1="${yN}" y2="${yN}" class="node"/>`);
  parts.push(`<text x="${x0 - 14}" y="${yP - 10}" class="lbl b">node +</text><text x="${x0 - 14}" y="${yN + 28}" class="lbl b">node −</text>`);
  for (let i = 0; i < steps; i++) {
    const cx = x0 + i * cw + cw / 2;
    const shared = i <= sharedUpTo;
    const bit = trace.dec[i];
    const sp = shared ? (bit ? 'minus' : 'plus') : 'wait';
    const sn = shared ? (bit ? 'plus' : 'minus') : 'wait';
    const kind = d.steps[i].kind;
    const now = state % 2 === 0 && i === k && state > 0;
    parts.push(`<g class="step ${now ? 'now' : ''}">
      <rect x="${cx - cw * 0.36}" y="${yP - 110}" width="${cw * 0.72}" height="44" rx="6" class="cap ${sp} ${kind}"/>
      <text x="${cx}" y="${yP - 82}" class="wl" text-anchor="middle">${num(d.weights[i], d.weights[i] < 10 ? 2 : 0)}</text>
      <line x1="${cx}" x2="${cx}" y1="${yP - 66}" y2="${yP}" class="lead ${shared ? 'on' : ''}"/>
      <rect x="${cx - cw * 0.36}" y="${yN + 66}" width="${cw * 0.72}" height="44" rx="6" class="cap ${sn} ${kind}"/>
      <line x1="${cx}" x2="${cx}" y1="${yN}" y2="${yN + 66}" class="lead ${shared ? 'on' : ''}"/>
      ${shared ? `<text x="${cx}" y="${yP - 118}" class="pol" text-anchor="middle">${bit ? '−' : '+'}</text><text x="${cx}" y="${yN + 128}" class="pol" text-anchor="middle">${bit ? '+' : '−'}</text>` : ''}
    </g>`);
  }

  // comparator and bits
  const cx = x1 + 60;
  parts.push(`<path d="M${cx} ${yP + 10} L${cx} ${yN - 10} L${cx + 70} ${(yP + yN) / 2} Z" class="cmp ${state % 2 === 1 ? 'act' : ''}"/>`);
  parts.push(`<line x1="${x1 + 20}" x2="${cx}" y1="${yP}" y2="${yP + 30}" class="node thin"/><line x1="${x1 + 20}" x2="${cx}" y1="${yN}" y2="${yN - 30}" class="node thin"/>`);
  parts.push(`<text x="${cx + 8}" y="${yP + 40}" class="lbl">+</text><text x="${cx + 8}" y="${yN - 24}" class="lbl">−</text>`);
  const out = decided ? trace.dec[decided - 1] : null;
  parts.push(`<text x="${cx + 92}" y="${(yP + yN) / 2 + 12}" class="big ${state % 2 === 1 ? 'act' : ''}">${out === null ? '·' : out}</text>`);
  const bw = Math.min(30, (w - 40) / n);
  for (let i = 0; i < n; i++) {
    const known = i < decided;
    parts.push(`<rect x="${20 + i * bw}" y="${H - 50}" width="${bw - 4}" height="34" rx="5" class="rb ${known ? (trace.dec[i] ? 'one' : 'zero') : ''} ${i === decided - 1 && state % 2 === 1 ? 'cur' : ''}"/><text x="${20 + i * bw + (bw - 4) / 2}" y="${H - 27}" class="rbt" text-anchor="middle">${known ? trace.dec[i] : '·'}</text>`);
  }
  parts.push(`<text x="${20 + n * bw + 14}" y="${H - 27}" class="lbl dim">raw decisions d1 … d${n}</text>`);
  parts.push(`<text x="${w - 16}" y="28" class="lbl" text-anchor="end">differential: Q ${num(q * 1e15, 2)} fC · C node ${eng(st.cn, 'F')} · V ${num(st.v * 1e3, 3)} mV</text>`);
  parts.push('</svg>');
  return parts.join('');
}

export function describe(ctx, trace, state) {
  const n = ctx.d.decisions;
  if (state === 0) return 'Sampled: the 16 selected memory cells are connected to the node; their charge is the input. No DAC capacitor is shared yet.';
  const k = Math.floor((state - 1) / 2);
  const st = trace.steps[k];
  if (state % 2 === 1) return `Decision ${k + 1} of ${n}: the comparator sees V+ − V− = ${num(st.v * 1e3, 3)} mV and outputs ${trace.dec[k]}.`;
  const w = ctx.d.weights[k];
  return `Step ${k + 1} shared: the ${num(w, 2)} LSB capacitor pair joins the node. Because the decision was ${trace.dec[k]}, the + side receives ${trace.dec[k] ? '−' : '+'}q/2 and the − side ${trace.dec[k] ? '+' : '−'}q/2. Charge is kept; the node capacitance grows to ${eng(trace.steps[k + 1].cn, 'F')}.`;
}
