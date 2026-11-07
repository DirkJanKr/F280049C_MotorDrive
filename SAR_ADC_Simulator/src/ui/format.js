const PREFIX = [
  [1e-18, 'a'], [1e-15, 'f'], [1e-12, 'p'], [1e-9, 'n'], [1e-6, 'µ'], [1e-3, 'm'], [1, ''], [1e3, 'k'], [1e6, 'M'], [1e9, 'G'],
];

/** Engineering notation with SI prefix, e.g. eng(4.2e-15,'C') -> "4.200 fC". */
export function eng(value, unit = '', digits = 4) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '−∞';
  if (value === 0) return `0 ${unit}`.trim();
  const a = Math.abs(value);
  let p = PREFIX[0];
  for (const cand of PREFIX) if (a >= cand[0] * 0.9999995) p = cand;
  const scaled = value / p[0];
  const intDigits = Math.max(1, Math.floor(Math.log10(Math.abs(scaled))) + 1);
  const dec = Math.max(0, digits - intDigits);
  return `${minus(scaled.toFixed(dec))} ${p[1]}${unit}`;
}

/** Fixed number with real minus sign. */
export function fx(value, decimals = 3) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '−∞';
  return minus(value.toFixed(decimals));
}

export function signed(value, decimals = 3) {
  if (!Number.isFinite(value)) return fx(value, decimals);
  return (value > 0 ? '+' : '') + fx(value, decimals);
}

export function minus(s) {
  return String(s).replace(/^-/, '−');
}

export function bin(code, bits) {
  return code.toString(2).padStart(bits, '0');
}

export function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export const TERM_LABEL = { VINP: 'VIN+', VINN: 'VIN−', VREF: 'VREF', GND: 'GND', VCM: 'VCM' };
export function termLabel(t, differential) {
  if (!differential && t === 'VINP') return 'VIN';
  return TERM_LABEL[t] ?? t;
}
export const TERM_COLOR = { VINP: 'var(--t-vin)', VINN: 'var(--t-vin)', VREF: 'var(--t-vref)', GND: 'var(--t-gnd)', VCM: 'var(--t-vcm)' };
