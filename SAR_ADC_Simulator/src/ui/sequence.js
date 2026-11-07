/** Conversion log: one row per recorded snapshot; rows are clickable. */
import { esc, fx, signed, bin, termLabel } from './format.js';

export function renderSequence({ adc, trace, step }) {
  const diff = adc.scheme.differential;
  const N = adc.config.bits;
  const lsb = adc.range.lsb;
  const rows = trace.snapshots.map((s, idx) => {
    const ev = s.changes.length
      ? s.changes
          .slice(0, 4)
          .map((c) => `${diff ? (c.array ? 'N.' : 'P.') : ''}${adc.arrays[c.array].labels[c.cap]}→<span class="term ${c.to}">${termLabel(c.to, diff)}</span>`)
          .join(' ') + (s.changes.length > 4 ? ` +${s.changes.length - 4}` : '')
      : s.phase === 'sample'
        ? 'top → ' + s.arrays.map((a) => termLabel(a.topForcedTo, diff)).join('/')
        : s.phase === 'hold'
          ? 'top switch opens'
          : '—';
    const vx = s.arrays.map((a) => fx(a.vTop, 4)).join(' / ');
    const dac = Number.isFinite(s.dacLevel) ? `${fx(s.dacLevel, 4)}` : '—';
    const dacL = Number.isFinite(s.dacLevel) ? fx((s.dacLevel - adc.range.low) / lsb, 2) : '';
    const c = s.comparator;
    const bit = c ? `<span class="bit${c.decision}">${c.decision}</span>` : '';
    const partial = s.decisions.length ? s.decisions.join('') + '·'.repeat(N - s.decisions.length) : '';
    return `<tr class="clickable ${idx === step ? 'current' : ''}" data-step="${idx}"><td class="num">${idx}</td><td class="l">${esc(
      s.phase === 'compare' ? `b${s.bitIndex}` : s.phase
    )}</td><td class="l">${ev}</td><td class="num">${vx}</td><td class="num" title="${dacL} LSB from bottom of range">${dac}</td><td class="num">${
      c ? signed((c.diff) * 1e3, 3) : ''
    }</td><td>${bit}</td><td class="num">${partial}</td></tr>`;
  });
  return `<table class="data"><thead><tr><th>#</th><th>Phase</th><th>Switching event</th><th>${diff ? 'Vx+ / Vx− [V]' : 'Vx [V]'}</th><th>DAC level [V]</th><th>Comp. in [mV]</th><th>Bit</th><th>Register</th></tr></thead><tbody>${rows.join(
    ''
  )}</tbody></table><div class="derived" style="padding:6px 2px">Output <b>${trace.code}</b> = 0b${bin(trace.code, N)} · ideal ${trace.idealCode} · DAC level = input at which an ideal comparator would balance the current switch state (input-referred; includes mismatch, Cp and VREF error). Comp. in = V+ − V− + Vos + noise.</div>`;
}
