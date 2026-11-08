// Chart helpers on top of the shared SVG plotter. Colours come from CSS tokens.

import { linePlot, niceTicks } from '../../ui/plot.js';
import { esc } from './fmt.js';

export const C = {
  a: 'var(--accent)',
  b: 'var(--c2)',
  c: 'var(--c3)',
  d: 'var(--c4)',
  ok: 'var(--ok)',
  bad: 'var(--bad)',
  muted: 'var(--muted)',
  grid: 'var(--line)',
};

let uid = 0;

/** Drawing width that keeps chart text readable: never wider than the screen allows. */
export function fitWidth(w = 640) {
  const screen = typeof window === 'undefined' ? 1200 : window.innerWidth;
  return Math.max(300, Math.min(w, screen - 64));
}

export function plot(o) {
  return linePlot({ id: `p${++uid}`, height: 260, ...o, width: fitWidth(o.width ?? 640) });
}

/**
 * Grouped bar chart. groups: labels on x; series: [{label, values, color}].
 * Optional hline {y, label, color}.
 */
export function bars({ labels, series, y = {}, hline = null, width: w0 = 640, height = 240, valueFmt = null }) {
  const width = fitWidth(w0);
  const m = { l: 52, r: 12, t: 26, b: 34 };
  const pw = width - m.l - m.r;
  const ph = height - m.t - m.b;
  const all = series.flatMap((s) => s.values).concat(hline ? [hline.y] : []);
  const ymin = Math.min(0, y.min ?? Math.min(...all));
  const ymax = y.max ?? Math.max(...all, 1e-12) * 1.1;
  const sy = (v) => m.t + ph - ((v - ymin) / (ymax - ymin || 1)) * ph;
  const gw = pw / labels.length;
  const bw = Math.min(26, (gw - 6) / series.length);
  const out = [`<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img">`];
  for (const t of niceTicks(ymin, ymax, 4)) {
    out.push(`<line x1="${m.l}" x2="${m.l + pw}" y1="${sy(t)}" y2="${sy(t)}" stroke="var(--line)"/>`);
    out.push(`<text x="${m.l - 6}" y="${sy(t) + 3.5}" text-anchor="end" font-size="10" class="muted mono">${+t.toPrecision(4)}</text>`);
  }
  if (y.label) out.push(`<text transform="translate(12 ${m.t + ph / 2}) rotate(-90)" text-anchor="middle" font-size="10.5" class="muted">${esc(y.label)}</text>`);
  labels.forEach((lab, i) => {
    const x0 = m.l + i * gw + (gw - bw * series.length) / 2;
    series.forEach((s, j) => {
      const v = s.values[i];
      if (!Number.isFinite(v)) return;
      const top = sy(Math.max(v, 0));
      const h = Math.abs(sy(v) - sy(0));
      out.push(`<rect x="${x0 + j * bw}" y="${top}" width="${bw - 2}" height="${Math.max(0.5, h)}" rx="2" fill="${s.color}"><title>${esc(s.label)} ${esc(lab)}: ${valueFmt ? valueFmt(v) : +v.toPrecision(4)}</title></rect>`);
    });
    out.push(`<text x="${m.l + i * gw + gw / 2}" y="${height - 16}" text-anchor="middle" font-size="10" class="muted">${esc(lab)}</text>`);
  });
  if (hline) {
    out.push(`<line x1="${m.l}" x2="${m.l + pw}" y1="${sy(hline.y)}" y2="${sy(hline.y)}" stroke="${hline.color}" stroke-dasharray="5 3" stroke-width="1.5"/>`);
    if (hline.label) out.push(`<text x="${m.l + pw - 4}" y="${sy(hline.y) - 5}" text-anchor="end" font-size="10.5" fill="${hline.color}">${esc(hline.label)}</text>`);
  }
  let lx = m.l;
  for (const s of series) {
    out.push(`<rect x="${lx}" y="8" width="10" height="10" rx="2" fill="${s.color}"/><text x="${lx + 14}" y="17" font-size="10.5">${esc(s.label)}</text>`);
    lx += 30 + s.label.length * 6;
  }
  out.push('</svg>');
  return out.join('');
}

/** Figure card: title, chart, caption. */
export function figure(id, title, caption = '') {
  return `<figure class="fig"><figcaption class="fig-title">${esc(title)}</figcaption><div class="fig-body" id="${id}"></div>${caption ? `<p class="fig-cap" id="${id}-cap">${caption}</p>` : `<p class="fig-cap" id="${id}-cap"></p>`}</figure>`;
}
