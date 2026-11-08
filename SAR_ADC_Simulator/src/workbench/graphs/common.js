// Shared helpers for graph definitions.

import { linePlot } from '../../ui/plot.js';
import { esc } from '../../zaan/ui/fmt.js';

export const COL = { an: 'var(--an)', ref: 'var(--ref)', clk: 'var(--clk)', dig: 'var(--dig)', cal: 'var(--cal)', muted: 'var(--muted)', bad: 'var(--bad)', ok: 'var(--ok)', ink: 'var(--ink)' };

let uid = 0;
export function lp(spec, w) {
  return linePlot({ id: `g${++uid}`, height: 220, ...spec, width: w });
}

/** Placeholder when a graph needs a value that is still "?". */
export function needs(labels) {
  return `<div class="needs"><span class="badge st-q">?</span> Needs ${labels.map((l) => `<b>${esc(l)}</b>`).join(', ')}. Fill it in on the left; the graph appears as soon as the value is known.</div>`;
}

/** Small horizontal bar list: rows [label, value (number or null), text]. */
export function hbars(rows, unit = '') {
  const max = Math.max(...rows.map((r) => r[1] ?? 0), 1e-30);
  return `<div class="hbars">${rows
    .map(([l, v, txt, cls]) => `<div class="hb"><span class="hbl">${esc(l)}</span><span class="hbt">${v === null ? '<span class="hbq">?</span>' : `<span class="hbf ${cls || ''}" style="width:${((v / max) * 100).toFixed(1)}%"></span>`}</span><span class="hbv">${txt ?? (v === null ? '?' : `${v} ${unit}`)}</span></div>`)
    .join('')}</div>`;
}

export function log10Ticks(min, max) {
  const t = [];
  for (let e = Math.ceil(min); e <= Math.floor(max); e++) t.push(e);
  return t;
}
