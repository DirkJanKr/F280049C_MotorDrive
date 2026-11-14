/** Minimal dependency-free SVG plotting used by every chart in the dashboard. */
import { esc, minus } from './format.js';

export function niceTicks(min, max, count = 5) {
  if (!(max > min)) return [min];
  const span = max - min;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const norm = step0 / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const out = [];
  for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out;
}

function defaultFormat(v, ticks) {
  const step = ticks.length > 1 ? Math.abs(ticks[1] - ticks[0]) : Math.abs(v) || 1;
  const dec = Math.max(0, Math.min(6, -Math.floor(Math.log10(step) + 1e-9)));
  return minus(v.toFixed(dec));
}

/**
 * @param {object} o
 *  width, height, margin, x:{min,max,label,format,ticks}, y:{...},
 *  series:[{points:[[x,y]], color, width, dash, step, mode:'line'|'stem'|'dots', label, opacity}],
 *  vlines:[{x,color,label,dash}], hlines:[{y,color,label,dash}], bands:[{y0,y1,color}], xbands:[{x0,x1,color}],
 *  cursor: x, legend: bool, overlay: (sx, sy) => svg string
 */
export function linePlot(o) {
  const W = o.width ?? 640;
  const H = o.height ?? 200;
  // lines with a label are named at their right end instead of in a legend
  const named = o.legend ? (o.series || []).filter((q) => q.label && q.points && q.points.length) : [];
  const labW = named.length ? Math.min(170, 14 + Math.max(...named.map((q) => q.label.length)) * 6.3) : 0;
  const m = { l: 56, r: 14 + labW, t: 12, b: 32, ...(o.margin || {}) };
  const pw = W - m.l - m.r;
  const ph = H - m.t - m.b;
  const { x, y } = o;
  const sx = (v) => m.l + ((v - x.min) / (x.max - x.min || 1)) * pw;
  const sy = (v) => m.t + ph - ((v - y.min) / (y.max - y.min || 1)) * ph;
  const clampY = (v) => Math.max(m.t - 2, Math.min(m.t + ph + 2, sy(v)));
  const xt = x.ticks ?? niceTicks(x.min, x.max, Math.max(3, Math.round(pw / 90)));
  const yt = y.ticks ?? niceTicks(y.min, y.max, Math.max(2, Math.round(ph / 40)));
  const xf = x.format ?? ((v) => defaultFormat(v, xt));
  const yf = y.format ?? ((v) => defaultFormat(v, yt));
  const parts = [];
  parts.push(`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" role="img">`);
  parts.push(`<defs><clipPath id="${(o.id ?? 'p') + '-clip'}"><rect x="${m.l}" y="${m.t - 1}" width="${pw}" height="${ph + 2}"/></clipPath></defs>`);
  for (const b of o.xbands || []) {
    parts.push(`<rect x="${sx(b.x0)}" y="${m.t}" width="${Math.max(0, sx(b.x1) - sx(b.x0))}" height="${ph}" fill="${b.color}"/>`);
    if (b.label) parts.push(`<text x="${(sx(b.x0) + sx(b.x1)) / 2}" y="${m.t + 11}" text-anchor="middle" font-size="10" class="muted">${esc(b.label)}</text>`);
  }
  for (const b of o.bands || []) {
    parts.push(`<rect x="${m.l}" y="${sy(b.y1)}" width="${pw}" height="${Math.max(0, sy(b.y0) - sy(b.y1))}" fill="${b.color}"/>`);
  }
  for (const v of xt) parts.push(`<line x1="${sx(v)}" x2="${sx(v)}" y1="${m.t}" y2="${m.t + ph}" stroke="var(--grid)"/>`);
  for (const v of yt) parts.push(`<line x1="${m.l}" x2="${m.l + pw}" y1="${sy(v)}" y2="${sy(v)}" stroke="var(--grid)"/>`);
  parts.push(`<rect x="${m.l}" y="${m.t}" width="${pw}" height="${ph}" fill="none" stroke="var(--border)"/>`);
  // in the lower left corner the first x label would run into the lowest y label: start it at the axis instead
  const corner = (v) => Math.abs(v - x.min) < 1e-9 * (Math.abs(x.max - x.min) || 1) && yt.some((u) => Math.abs(u - y.min) < 1e-9 * (Math.abs(y.max - y.min) || 1));
  for (const v of xt) parts.push(`<text x="${sx(v)}" y="${m.t + ph + 14}" text-anchor="${corner(v) ? 'start' : 'middle'}" font-size="10.5" class="muted mono">${xf(v)}</text>`);
  for (const v of yt) parts.push(`<text x="${m.l - 6}" y="${sy(v) + 3.5}" text-anchor="end" font-size="10.5" class="muted mono">${yf(v)}</text>`);
  if (x.label) parts.push(`<text x="${m.l + pw / 2}" y="${H - 3}" text-anchor="middle" font-size="11.5" class="muted">${esc(x.label)}</text>`);
  if (y.label) parts.push(`<text transform="translate(12 ${m.t + ph / 2}) rotate(-90)" text-anchor="middle" font-size="11.5" class="muted">${esc(y.label)}</text>`);
  parts.push(`<g clip-path="url(#${(o.id ?? 'p') + '-clip'})">`);
  for (const h of o.hlines || []) {
    parts.push(`<line x1="${m.l}" x2="${m.l + pw}" y1="${sy(h.y)}" y2="${sy(h.y)}" stroke="${h.color}" stroke-dasharray="${h.dash ?? '4 3'}" stroke-width="${h.width ?? 1}"/>`);
  }
  for (const s of o.series || []) {
    const pts = s.points;
    if (!pts.length) continue;
    const op = s.opacity ?? 1;
    if (s.mode === 'stem') {
      const base = sy(Math.max(y.min, s.base ?? y.min));
      let d = '';
      for (const [px, py] of pts) d += `M${sx(px).toFixed(1)} ${base.toFixed(1)}V${clampY(py).toFixed(1)}`;
      parts.push(`<path d="${d}" stroke="${s.color}" stroke-width="${s.width ?? 1}" opacity="${op}" fill="none"/>`);
    } else if (s.mode === 'dots') {
      for (const [px, py] of pts) parts.push(`<circle cx="${sx(px)}" cy="${clampY(py)}" r="${s.r ?? 2.5}" fill="${s.color}" opacity="${op}"/>`);
    } else {
      let d = `M${sx(pts[0][0]).toFixed(2)} ${clampY(pts[0][1]).toFixed(2)}`;
      for (let i = 1; i < pts.length; i++) {
        if (s.step) d += `H${sx(pts[i][0]).toFixed(2)}V${clampY(pts[i][1]).toFixed(2)}`;
        else d += `L${sx(pts[i][0]).toFixed(2)} ${clampY(pts[i][1]).toFixed(2)}`;
      }
      if (s.step && s.until !== undefined) d += `H${sx(s.until).toFixed(2)}`;
      parts.push(`<path d="${d}" stroke="${s.color}" stroke-width="${s.width ?? 1.6}" fill="none" opacity="${op}" stroke-dasharray="${s.dash ?? ''}" stroke-linejoin="round"/>`);
    }
  }
  parts.push('</g>');
  for (const v of o.vlines || []) {
    parts.push(`<line x1="${sx(v.x)}" x2="${sx(v.x)}" y1="${m.t}" y2="${m.t + ph}" stroke="${v.color}" stroke-dasharray="${v.dash ?? '3 3'}" stroke-width="${v.width ?? 1}"/>`);
    if (v.label) parts.push(`<text x="${sx(v.x) + 4}" y="${m.t + ph - 5}" font-size="10" fill="${v.color}">${esc(v.label)}</text>`);
  }
  if (o.cursor !== undefined && o.cursor !== null) {
    parts.push(`<line x1="${sx(o.cursor)}" x2="${sx(o.cursor)}" y1="${m.t}" y2="${m.t + ph}" stroke="var(--accent)" stroke-width="1.5"/>`);
  }
  if (o.overlay) parts.push(o.overlay(sx, sy, { m, pw, ph }));
  if (named.length) {
    // label each line where it ends, nudged apart so labels do not overlap
    const tags = named.map((s) => {
      const inside = s.points.filter((q) => q[0] >= x.min && q[0] <= x.max && Number.isFinite(q[1]));
      const last = inside.length ? inside[inside.length - 1] : s.points[s.points.length - 1];
      return { s, y: clampY(last[1]) };
    }).sort((a, b) => a.y - b.y);
    for (let i = 1; i < tags.length; i++) if (tags[i].y - tags[i - 1].y < 12) tags[i].y = tags[i - 1].y + 12;
    const over = tags.length ? tags[tags.length - 1].y - (m.t + ph) : 0;
    if (over > 0) for (const t of tags) t.y -= over;
    for (const t of tags) {
      parts.push(`<line x1="${m.l + pw + 2}" x2="${m.l + pw + 10}" y1="${t.y}" y2="${t.y}" stroke="${t.s.color}" stroke-width="2" stroke-dasharray="${t.s.dash ?? ''}"/>`);
      parts.push(`<text x="${m.l + pw + 13}" y="${t.y + 3.5}" font-size="10.5" fill="${t.s.color}">${esc(t.s.label)}</text>`);
    }
  }
  parts.push('</svg>');
  return parts.join('');
}

/** Reduce a dense series to a min/max envelope with at most ~2*buckets points. */
export function envelope(xs, ys, buckets = 800) {
  const n = ys.length;
  if (n <= buckets * 2) return Array.from({ length: n }, (_, i) => [xs ? xs[i] : i, ys[i]]);
  const out = [];
  const per = n / buckets;
  for (let b = 0; b < buckets; b++) {
    const i0 = Math.floor(b * per);
    const i1 = Math.min(n, Math.floor((b + 1) * per));
    let lo = i0;
    let hi = i0;
    for (let i = i0; i < i1; i++) {
      if (ys[i] < ys[lo]) lo = i;
      if (ys[i] > ys[hi]) hi = i;
    }
    const a = Math.min(lo, hi);
    const c = Math.max(lo, hi);
    out.push([xs ? xs[a] : a, ys[a]]);
    if (c !== a) out.push([xs ? xs[c] : c, ys[c]]);
  }
  return out;
}

/** Max-per-bucket decimation (for spectra). */
export function maxDecimate(ys, buckets = 900, x0 = 0, dx = 1) {
  const n = ys.length;
  if (n <= buckets) return Array.from(ys, (v, i) => [x0 + i * dx, v]);
  const out = [];
  const per = n / buckets;
  for (let b = 0; b < buckets; b++) {
    const i0 = Math.floor(b * per);
    const i1 = Math.min(n, Math.floor((b + 1) * per));
    let hi = i0;
    for (let i = i0; i < i1; i++) if (ys[i] > ys[hi]) hi = i;
    out.push([x0 + hi * dx, ys[hi]]);
  }
  return out;
}
