// Formula typesetting with real symbols, built from HTML and Unicode
// (σ √ Σ π τ θ × − ±). No library, so it renders the same on laptop and phone.

/** Italic variable, optionally with a subscript: v('σ', 'q') gives σ with subscript q. */
export function v(name, subscript = '') {
  return `<i>${name}</i>${subscript ? `<sub>${subscript}</sub>` : ''}`;
}

/** Upright text inside a formula (units, function names, words). */
export function t(text) {
  return `<span class="mt">${text}</span>`;
}

export function frac(num, den) {
  return `<span class="frac"><span class="fn">${num}</span><span class="fd">${den}</span></span>`;
}

export function sqrt(x) {
  return `<span class="sqrt"><span class="rs">√</span><span class="rad">${x}</span></span>`;
}

export function sup(base, s) {
  return `${base}<sup>${s}</sup>`;
}

export function paren(x) {
  return `<span class="par">(</span>${x}<span class="par">)</span>`;
}

/** One displayed equation line. */
export function eq(...parts) {
  return `<div class="eqline">${parts.join(' ')}</div>`;
}

/** Number with a real minus sign. */
export function n(x) {
  return String(x).replace(/^-/, '−');
}
