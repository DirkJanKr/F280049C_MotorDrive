// Number formatting for the Zaan views. Uses "n/a" instead of dashes.

const PREFIX = [[1e-15, 'f'], [1e-12, 'p'], [1e-9, 'n'], [1e-6, 'µ'], [1e-3, 'm'], [1, ''], [1e3, 'k'], [1e6, 'M']];

/** Engineering notation: eng(2.82e-4, 'V rms') gives "282 uV rms". */
export function eng(v, unit = '', digits = 3) {
  if (!Number.isFinite(v)) return 'n/a';
  if (v === 0) return `0 ${unit}`.trim();
  let best = PREFIX[0];
  for (const p of PREFIX) if (Math.abs(v) >= p[0] * 0.9995) best = p;
  return `${Number((v / best[0]).toPrecision(digits))} ${best[1]}${unit}`.trim();
}

export function num(v, d = 3) {
  return Number.isFinite(v) ? Number(v.toFixed(d)).toString() : 'n/a';
}

export function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

/** Small tag for values that are not decided yet. */
export function estimateTag(on = true) {
  return on ? '<span class="tag-est" title="not decided yet">estimate</span>' : '';
}

/** A value in SI shown with its unit, for spec sheet rows. */
export function siValue(v, unit) {
  if (unit === 'V rms' || unit === 'V' || unit === 's' || unit === 's rms' || unit === 'F') {
    const base = unit.split(' ')[0];
    const tail = unit.includes('rms') ? ' rms' : '';
    return eng(v, base) + tail;
  }
  return `${num(v, 3)} ${unit}`.trim();
}
