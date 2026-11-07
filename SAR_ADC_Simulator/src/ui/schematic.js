/**
 * Interactive capacitor-array schematic (SVG). Pure view: draws the state of
 * one recorded snapshot; never computes circuit quantities itself.
 */
import { esc, fx, eng, signed, termLabel, TERM_COLOR } from './format.js';

const CW = 66;
const LEFT = 150;
const ROW_H = 220;
const TOP = 8;

export function chargeScale(trace) {
  let m = 0;
  for (const s of trace.snapshots) for (const a of s.arrays) for (const q of a.charges.top) m = Math.max(m, Math.abs(q));
  return m || 1;
}

export function renderSchematic({ adc, trace, step, selected, qMax }) {
  const snap = trace.snapshots[step];
  const prev = step > 0 ? trace.snapshots[step - 1] : null;
  const diff = adc.scheme.differential;
  const N = adc.config.bits;
  const n = adc.arrays[0].n;
  const xCapsEnd = LEFT + n * CW;
  const xCp = xCapsEnd + 22;
  const xComp = xCapsEnd + 210;
  const sarW = Math.max(190, N * 19 + 24);
  const xSar = xComp + 96;
  const W = xSar + sarW + 16;
  const H = TOP + adc.arrays.length * ROW_H + 6;
  const changed = new Set(snap.changes.map((c) => `${c.array}:${c.cap}`));
  const out = [];
  out.push(`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Capacitor array schematic">`);
  out.push(
    `<defs><marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--muted)"/></marker></defs>`
  );

  const busYs = [];
  adc.arrays.forEach((arr, a) => {
    const st = snap.arrays[a];
    const pst = prev ? prev.arrays[a] : null;
    const y0 = TOP + a * ROW_H;
    const busY = y0 + 48;
    busYs.push(busY);
    const rails = arr.rails;
    const railY = (r) => y0 + 118 + r * 15;
    const gridY = railY(rails.length - 1) + 22;
    const node = diff ? (a === 0 ? 'Vx+' : 'Vx−') : 'Vx';
    out.push(`<text x="12" y="${y0 + 16}" font-size="12" font-weight="600">${diff ? (a === 0 ? 'P-side array' : 'N-side array') : 'CDAC array'}</text>`);
    out.push(`<text x="12" y="${y0 + 30}" font-size="10.5" class="muted">top-plate node ${node}</text>`);

    // rails
    rails.forEach((t, r) => {
      const y = railY(r);
      out.push(`<line x1="${LEFT - 4}" x2="${xCapsEnd - 2}" y1="${y}" y2="${y}" stroke="${TERM_COLOR[t]}" stroke-width="1.2" opacity="0.75"/>`);
      const vt = trace.sources[t];
      out.push(`<text x="${LEFT - 10}" y="${y + 3.5}" text-anchor="end" font-size="10.5" fill="${TERM_COLOR[t]}" class="mono">${termLabel(t, diff)} ${fx(vt, 3)} V</text>`);
    });
    // grid labels
    ['C  [fF]', 'Q  [fC]', 'Vb [V]'].forEach((lab, r) => {
      out.push(`<text x="${LEFT - 10}" y="${gridY + r * 13 + 3.5}" text-anchor="end" font-size="10" class="muted mono">${lab}</text>`);
    });

    // top-plate sampling switch + bus
    const xBusL = LEFT - 14;
    const sw = st.topForced;
    const sampTerm = trace.snapshots[0].arrays[a].topForcedTo;
    out.push(`<line x1="${xBusL}" x2="${xCapsEnd + 36}" y1="${busY}" y2="${busY}" stroke="var(--text)" stroke-width="2"/>`);
    out.push(`<circle cx="${xBusL}" cy="${busY}" r="2.5" fill="var(--text)"/>`);
    out.push(`<circle cx="${xBusL - 34}" cy="${busY}" r="2.5" fill="none" stroke="${TERM_COLOR[sampTerm]}"/>`);
    out.push(
      sw
        ? `<line x1="${xBusL}" x2="${xBusL - 32}" y1="${busY}" y2="${busY}" stroke="var(--accent)" stroke-width="2"/>`
        : `<line x1="${xBusL}" x2="${xBusL - 30}" y1="${busY}" y2="${busY - 13}" stroke="var(--muted)" stroke-width="2"/>`
    );
    out.push(`<text x="${xBusL - 40}" y="${busY + 3.5}" text-anchor="end" font-size="10.5" fill="${TERM_COLOR[sampTerm]}" class="mono">${termLabel(sampTerm, diff)}</text>`);
    out.push(`<text x="${xBusL - 17}" y="${busY + 15}" text-anchor="middle" font-size="9.5" class="muted">${sw ? 'closed' : 'open'}</text>`);

    // capacitors
    for (let i = 0; i < arr.n; i++) {
      const cx = LEFT + i * CW + CW / 2;
      const key = `${a}:${i}`;
      const isCh = changed.has(key);
      const isSel = selected && selected.a === a && selected.i === i;
      const q = st.charges.top[i];
      const t = st.terminals[i];
      const r = rails.indexOf(t);
      out.push(`<g class="cap-col" data-cap="${key}">`);
      out.push(
        `<rect class="col-bg" x="${LEFT + i * CW + 2}" y="${y0 + 20}" width="${CW - 4}" height="${gridY + 32 - (y0 + 20)}" rx="4" fill="${isCh ? 'var(--accent-soft)' : 'transparent'}" stroke="${
          isSel ? 'var(--accent)' : 'none'
        }"/>`
      );
      out.push(`<text x="${cx}" y="${y0 + 26}" text-anchor="middle" font-size="11" font-weight="600">${esc(arr.labels[i])}</text>`);
      out.push(`<text x="${cx}" y="${y0 + 38}" text-anchor="middle" font-size="9.5" class="muted mono">${arr.units[i]}Cu</text>`);
      out.push(`<line x1="${cx}" x2="${cx}" y1="${busY}" y2="${y0 + 66}" stroke="var(--text)" stroke-width="1.4"/>`);
      out.push(`<circle cx="${cx}" cy="${busY}" r="2" fill="var(--text)"/>`);
      const op = 0.12 + 0.88 * Math.min(1, Math.abs(q) / qMax);
      out.push(`<rect x="${cx - 17}" y="${y0 + 67}" width="34" height="8" fill="${q >= 0 ? 'var(--q-pos)' : 'var(--q-neg)'}" opacity="${op.toFixed(3)}"/>`);
      out.push(`<line x1="${cx - 19}" x2="${cx + 19}" y1="${y0 + 66}" y2="${y0 + 66}" stroke="var(--text)" stroke-width="3"/>`);
      out.push(`<line x1="${cx - 19}" x2="${cx + 19}" y1="${y0 + 76}" y2="${y0 + 76}" stroke="${TERM_COLOR[t]}" stroke-width="3"/>`);
      out.push(`<line x1="${cx}" x2="${cx}" y1="${y0 + 76}" y2="${y0 + 96}" stroke="${TERM_COLOR[t]}" stroke-width="1.4"/>`);
      out.push(`<circle cx="${cx}" cy="${y0 + 96}" r="2.4" fill="${TERM_COLOR[t]}"/>`);
      rails.forEach((rt, rr) => {
        out.push(`<circle cx="${cx + 13}" cy="${railY(rr)}" r="2.4" fill="${rr === r ? TERM_COLOR[rt] : 'var(--panel-2)'}" stroke="${TERM_COLOR[rt]}"/>`);
      });
      if (isCh && pst) {
        const pr = rails.indexOf(pst.terminals[i]);
        if (pr >= 0) out.push(`<line x1="${cx}" y1="${y0 + 96}" x2="${cx + 13}" y2="${railY(pr)}" stroke="var(--faint)" stroke-width="1.5" stroke-dasharray="3 2"/>`);
      }
      if (r >= 0) {
        out.push(`<line x1="${cx}" y1="${y0 + 96}" x2="${cx + 13}" y2="${railY(r)}" stroke="${isCh ? 'var(--accent)' : TERM_COLOR[t]}" stroke-width="2.2"/>`);
      } else {
        // connected to a terminal that has no rail in this array (e.g. input during sampling)
        out.push(`<line x1="${cx}" y1="${y0 + 96}" x2="${cx - 14}" y2="${y0 + 108}" stroke="${TERM_COLOR[t]}" stroke-width="2.2"/>`);
      }
      out.push(`<text x="${cx}" y="${gridY + 3.5}" text-anchor="middle" font-size="10" class="mono">${fx(arr.actual[i] * 1e15, arr.actual[i] * 1e15 >= 1000 ? 0 : 2)}</text>`);
      out.push(`<text x="${cx}" y="${gridY + 16.5}" text-anchor="middle" font-size="10" class="mono" fill="${q >= 0 ? 'var(--q-pos)' : 'var(--q-neg)'}">${fx(q * 1e15, Math.abs(q * 1e15) >= 100 ? 1 : 3)}</text>`);
      out.push(`<text x="${cx}" y="${gridY + 29.5}" text-anchor="middle" font-size="10" class="mono" fill="${TERM_COLOR[t]}">${fx(st.vBottom[i], 3)}</text>`);
      out.push('</g>');
    }

    // parasitic
    const cp = arr.topParasitic;
    const pcol = cp > 0 ? 'var(--text)' : 'var(--faint)';
    const dash = cp > 0 ? '' : 'stroke-dasharray="3 2"';
    out.push(`<line x1="${xCp}" x2="${xCp}" y1="${busY}" y2="${y0 + 66}" stroke="${pcol}" ${dash}/>`);
    out.push(`<line x1="${xCp - 11}" x2="${xCp + 11}" y1="${y0 + 66}" y2="${y0 + 66}" stroke="${pcol}" stroke-width="2.5" ${dash}/>`);
    out.push(`<line x1="${xCp - 11}" x2="${xCp + 11}" y1="${y0 + 74}" y2="${y0 + 74}" stroke="${pcol}" stroke-width="2.5" ${dash}/>`);
    out.push(`<line x1="${xCp}" x2="${xCp}" y1="${y0 + 74}" y2="${y0 + 86}" stroke="${pcol}" ${dash}/>`);
    out.push(`<path d="M${xCp - 8} ${y0 + 86}H${xCp + 8}M${xCp - 5} ${y0 + 90}H${xCp + 5}M${xCp - 2} ${y0 + 94}H${xCp + 2}" stroke="${pcol}"/>`);
    out.push(`<text x="${xCp}" y="${y0 + 108}" text-anchor="middle" font-size="10" class="${cp > 0 ? '' : 'faint'} mono">Cp</text>`);
    out.push(`<text x="${xCp}" y="${y0 + 120}" text-anchor="middle" font-size="9.5" class="muted mono">${cp > 0 ? eng(cp, 'F', 3) : 'off'}</text>`);

    // node readout
    const xl = xCapsEnd + 44;
    out.push(`<text x="${xl}" y="${busY - 22}" font-size="12" font-weight="700" class="mono" fill="${a === 0 ? 'var(--s-p)' : 'var(--s-n)'}">${node} = ${fx(st.vTop, 5)} V</text>`);
    out.push(`<text x="${xl}" y="${busY - 8}" font-size="10" class="mono muted">Q_X = ${eng(st.qNode, 'C', 5)}</text>`);
    const dv = snap.transition.deltaVtop[a];
    out.push(`<text x="${xl}" y="${busY + 20}" font-size="10" class="mono ${Math.abs(dv) > 0 ? '' : 'muted'}">ΔV = ${signed(dv * 1e3, 3)} mV</text>`);
    out.push(`<text x="${xl}" y="${busY + 33}" font-size="10" class="mono muted">${st.topForced ? 'driven (switch closed)' : 'floating: Q conserved'}</text>`);
  });

  // comparator wiring
  const plus = adc.scheme.comparator.plus;
  const minus = adc.scheme.comparator.minus;
  let yc;
  let topSign;
  let botSign;
  if (!diff) {
    yc = busYs[0] + 16;
    out.push(`<line x1="${xCapsEnd + 36}" x2="${xComp}" y1="${busYs[0]}" y2="${busYs[0]}" stroke="var(--text)" stroke-width="2"/>`);
    out.push(`<path d="M${xComp} ${yc + 16}H${xComp - 18}V${yc + 52}" stroke="var(--t-vcm)" stroke-width="1.5" fill="none"/>`);
    out.push(`<circle cx="${xComp - 18}" cy="${yc + 52}" r="2.5" fill="none" stroke="var(--t-vcm)"/>`);
    out.push(`<text x="${xComp - 26}" y="${yc + 64}" text-anchor="end" font-size="10.5" fill="var(--t-vcm)" class="mono">VCM ${fx(trace.sources.VCM, 3)} V (ref.)</text>`);
    topSign = minus.type === 'top' ? '−' : '+';
    botSign = topSign === '−' ? '+' : '−';
  } else {
    yc = (busYs[0] + busYs[1]) / 2;
    const xr = xComp - 30;
    out.push(`<path d="M${xCapsEnd + 36} ${busYs[0]}H${xr}V${yc - 16}H${xComp}" stroke="var(--s-p)" stroke-width="2" fill="none"/>`);
    out.push(`<path d="M${xCapsEnd + 36} ${busYs[1]}H${xr}V${yc + 16}H${xComp}" stroke="var(--s-n)" stroke-width="2" fill="none"/>`);
    topSign = plus.type === 'top' && plus.array === 0 ? '+' : '−';
    botSign = topSign === '+' ? '−' : '+';
  }
  out.push(`<path d="M${xComp} ${yc - 34}L${xComp} ${yc + 34}L${xComp + 60} ${yc}Z" fill="var(--panel)" stroke="var(--text)" stroke-width="1.6"/>`);
  out.push(`<text x="${xComp + 6}" y="${yc - 12}" font-size="13" font-weight="700">${topSign}</text>`);
  out.push(`<text x="${xComp + 6}" y="${yc + 21}" font-size="13" font-weight="700">${botSign}</text>`);
  out.push(`<line x1="${xComp + 60}" x2="${xSar}" y1="${yc}" y2="${yc}" stroke="var(--text)" stroke-width="1.6" marker-end="url(#arrowhead)"/>`);
  out.push(`<text x="${xComp + 30}" y="${yc + 52}" text-anchor="middle" font-size="10.5" class="muted">comparator</text>`);
  const c = snap.comparator;
  if (c) {
    out.push(`<circle cx="${xComp + 78}" cy="${yc - 14}" r="10" fill="${c.decision ? 'var(--ok)' : 'var(--panel-2)'}" stroke="var(--border)"/>`);
    out.push(`<text x="${xComp + 78}" y="${yc - 10}" text-anchor="middle" font-size="12" font-weight="700" fill="${c.decision ? '#06281c' : 'var(--text)'}">${c.decision}</text>`);
    out.push(`<text x="${xComp + 30}" y="${yc + 66}" text-anchor="middle" font-size="10" class="mono">V+ − V− = ${signed((c.vPlus - c.vMinus) * 1e3, 3)} mV</text>`);
    if (c.vos || c.noise)
      out.push(`<text x="${xComp + 30}" y="${yc + 79}" text-anchor="middle" font-size="9.5" class="mono muted">Vos ${signed(c.vos * 1e3, 2)} · vn ${signed(c.noise * 1e3, 2)} mV</text>`);
  }

  // SAR logic block
  const yS = yc - 44;
  out.push(`<rect x="${xSar}" y="${yS}" width="${sarW}" height="88" rx="6" fill="var(--panel)" stroke="var(--border)"/>`);
  out.push(`<text x="${xSar + 10}" y="${yS + 16}" font-size="11" font-weight="600">SAR logic / register</text>`);
  const dec = snap.decisions;
  const cur = snap.phase === 'compare' ? dec.length - 1 : -1;
  for (let k = 0; k < N; k++) {
    const bx = xSar + 10 + k * 19;
    const known = k < dec.length;
    const isCur = k === cur;
    out.push(`<rect x="${bx}" y="${yS + 26}" width="16" height="22" rx="3" fill="${known ? (dec[k] ? 'color-mix(in srgb, var(--ok) 28%, transparent)' : 'var(--panel-2)') : 'transparent'}" stroke="${
      isCur ? 'var(--accent)' : 'var(--border)'
    }" stroke-width="${isCur ? 2 : 1}"/>`);
    out.push(`<text x="${bx + 8}" y="${yS + 41}" text-anchor="middle" font-size="11" class="mono" font-weight="600">${known ? dec[k] : '·'}</text>`);
    out.push(`<text x="${bx + 8}" y="${yS + 58}" text-anchor="middle" font-size="8.5" class="muted mono">${N - 1 - k}</text>`);
  }
  const codeTxt = dec.length === N ? `code = ${trace.code} (0x${trace.code.toString(16).toUpperCase()})` : `${dec.length}/${N} bits resolved`;
  out.push(`<text x="${xSar + 10}" y="${yS + 78}" font-size="10.5" class="mono">${codeTxt}</text>`);
  out.push(`<path d="M${xSar + sarW / 2} ${yS}V${TOP + 6}H${xComp - 4}" stroke="var(--muted)" stroke-dasharray="4 3" fill="none" marker-end="url(#arrowhead)"/>`);
  out.push(`<text x="${xComp + 4}" y="${TOP + 18}" font-size="9.5" class="muted">→ bottom-plate switches</text>`);
  out.push('</svg>');
  return out.join('');
}

export function legendHtml(adc) {
  const diff = adc.scheme.differential;
  const terms = new Set(adc.arrays.flatMap((a) => a.rails));
  terms.add(adc.arrays[0].inputTerminal);
  const items = [...terms].map((t) => `<span><i style="background:${TERM_COLOR[t]}"></i>${termLabel(t, diff)}</span>`);
  items.push('<span><i class="box" style="background:var(--q-pos)"></i>Q &gt; 0 on top plate</span>');
  items.push('<span><i class="box" style="background:var(--q-neg)"></i>Q &lt; 0 on top plate</span>');
  items.push('<span><i class="box" style="background:var(--accent-soft);border:1px solid var(--accent)"></i>switched in this step (dashed = previous position)</span>');
  items.push('<span>click a capacitor for details</span>');
  return items.join('');
}
