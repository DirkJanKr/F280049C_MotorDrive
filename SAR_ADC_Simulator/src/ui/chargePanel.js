/** Charge redistribution view: per-capacitor charge before/after the current switching event. */
import { esc, eng, fx, signed, termLabel } from './format.js';
import { niceTicks } from './plot.js';

function barChart(arr, before, after, changed, title, selectedIdx) {
  const n = arr.n + 1; // + parasitic
  const W = Math.max(520, 60 + n * 40);
  const H = 160;
  const m = { l: 48, r: 8, t: 18, b: 26 };
  const pw = W - m.l - m.r;
  const ph = H - m.t - m.b;
  const vals = [];
  for (let i = 0; i < arr.n; i++) vals.push(after.top[i], before ? before.top[i] : 0);
  vals.push(after.parasitic, before ? before.parasitic : 0);
  let lim = Math.max(1e-30, ...vals.map(Math.abs)) * 1e15;
  const ticks = niceTicks(-lim, lim, 4);
  lim = Math.max(Math.abs(ticks[0]), Math.abs(ticks[ticks.length - 1]), lim);
  const sy = (v) => m.t + ph / 2 - (v / lim) * (ph / 2);
  const gw = pw / n;
  const o = [`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`];
  o.push(`<text x="${m.l}" y="12" font-size="10.5" class="muted">${esc(title)} — charge on top plates [fC]: dashed = before, solid = after</text>`);
  for (const t of ticks) {
    o.push(`<line x1="${m.l}" x2="${m.l + pw}" y1="${sy(t)}" y2="${sy(t)}" stroke="var(--grid)"/>`);
    o.push(`<text x="${m.l - 5}" y="${sy(t) + 3.5}" text-anchor="end" font-size="9.5" class="muted mono">${fx(t, Math.abs(ticks[1] - ticks[0]) < 1 ? 2 : 0)}</text>`);
  }
  o.push(`<line x1="${m.l}" x2="${m.l + pw}" y1="${sy(0)}" y2="${sy(0)}" stroke="var(--muted)"/>`);
  for (let i = 0; i < n; i++) {
    const isP = i === arr.n;
    const qa = (isP ? after.parasitic : after.top[i]) * 1e15;
    const qb = before ? (isP ? before.parasitic : before.top[i]) * 1e15 : null;
    const x = m.l + i * gw;
    const bw = Math.min(12, gw / 2 - 3);
    if (changed.has(i)) o.push(`<rect x="${x + 1}" y="${m.t}" width="${gw - 2}" height="${ph}" fill="var(--accent-soft)"/>`);
    if (i === selectedIdx) o.push(`<rect x="${x + 1}" y="${m.t}" width="${gw - 2}" height="${ph}" fill="none" stroke="var(--accent)"/>`);
    if (qb !== null) {
      const y1 = Math.min(sy(0), sy(qb));
      o.push(`<rect x="${x + gw / 2 - bw - 1}" y="${y1}" width="${bw}" height="${Math.abs(sy(qb) - sy(0))}" fill="none" stroke="var(--faint)" stroke-dasharray="2 1.5"/>`);
    }
    const y2 = Math.min(sy(0), sy(qa));
    o.push(`<rect x="${x + gw / 2 + 1}" y="${y2}" width="${bw}" height="${Math.max(0.5, Math.abs(sy(qa) - sy(0)))}" fill="${qa >= 0 ? 'var(--q-pos)' : 'var(--q-neg)'}" opacity="${isP ? 0.55 : 0.95}"/>`);
    o.push(`<text x="${x + gw / 2}" y="${H - 10}" text-anchor="middle" font-size="9.5" class="mono ${isP ? 'muted' : ''}">${isP ? 'Cp' : esc(arr.labels[i])}</text>`);
  }
  o.push('</svg>');
  return o.join('');
}

export function renderCharge({ adc, trace, step, selected }) {
  const snap = trace.snapshots[step];
  const prev = step > 0 ? trace.snapshots[step - 1] : null;
  const diff = adc.scheme.differential;
  const tr = snap.transition;
  const parts = [];
  parts.push(
    `<div class="step-detail" style="padding-top:0"><span class="t">${prev ? `${esc(prev.title)} → ${esc(snap.title)}` : esc(snap.title)}</span><div class="d">${
      snap.phase === 'sample'
        ? 'Top plate driven by a source: Q_X = Σ Ci(Vtop − Vb,i) + Cp·Vtop is set here and frozen at the hold instant.'
        : snap.phase === 'hold'
          ? 'Top-plate switch opens. From now on node X is floating and Σ charge on it is conserved.'
          : snap.changes.length
            ? `${snap.changes.length} bottom-plate switch${snap.changes.length > 1 ? 'es' : ''} moved. Charge redistributes among the capacitors; the total on node X is unchanged.`
            : 'No switching in this step.'
    }</div></div>`
  );

  // summary tiles
  const tiles = [];
  snap.arrays.forEach((st, a) => {
    const nm = diff ? (a === 0 ? '+' : '−') : '';
    const pst = prev ? prev.arrays[a] : null;
    if (snap.phase !== 'sample') {
      tiles.push(tile(`ΔVx${nm} (charge solver)`, `${signed(tr.deltaVtop[a] * 1e3, 4)} mV`, `Vx${nm} = ${fx(st.vTop, 5)} V`));
      tiles.push(
        tile(
          `ΔVx${nm} hand formula`,
          `${signed(tr.predictedDeltaVtop[a] * 1e3, 4)} mV`,
          snap.phase === 'hold' ? 'q_kT/C / (Ct+Cp)' : 'Σ Ci·ΔVb,i / (Ct+Cp)'
        )
      );
      const before = pst ? pst.qNode : st.qNode;
      const resid = st.charges.totalTop - st.qNode;
      tiles.push(tile(`Q_X${nm} before → after`, `${eng(before, 'C', 5)}`, `→ ${eng(st.charges.totalTop, 'C', 5)}`));
      const okc = Math.abs(resid) <= 1e-12 * adc.arrays[a].nodeCap * Math.max(1, adc.config.vref);
      tiles.push(tile(`Conservation residual${nm}`, eng(Math.abs(resid), 'C', 2), okc ? '✓ Σ Q on node X conserved' : '✗ conservation violated', okc ? 'good' : 'bad'));
    } else {
      tiles.push(tile(`Q_X${nm} sampled`, eng(st.qNode, 'C', 5), `Vtop forced to ${termLabel(st.topForcedTo, diff)}`));
    }
  });
  if (snap.phase !== 'sample') {
    tiles.push(tile('Charge from VREF', eng(tr.sourceCharge.VREF, 'C', 4), 'this step'));
    tiles.push(tile('Energy from VREF', eng(tr.energyRef, 'J', 4), `cumulative ${eng(snap.energyRefCum, 'J', 4)}`));
    if (adc.scheme.id === 'vcm') tiles.push(tile('Energy from VCM', eng(tr.energyVcm, 'J', 4), `cumulative ${eng(snap.energyVcmCum, 'J', 4)}`));
  }
  parts.push(`<div class="tiles">${tiles.join('')}</div>`);

  // selected capacitor detail
  if (selected && snap.arrays[selected.a]) {
    const arr = adc.arrays[selected.a];
    const i = selected.i;
    const st = snap.arrays[selected.a];
    const pst = prev ? prev.arrays[selected.a] : null;
    const qa = st.charges.top[i];
    const qb = pst ? pst.charges.top[i] : null;
    parts.push(
      `<div class="eq">${esc(`${arr.name === 'P' && !diff ? '' : arr.name + '-side '}${arr.labels[i]}: C = ${eng(arr.actual[i], 'F', 6)} (nominal ${eng(arr.nominal[i], 'F', 6)}, ε = ${signed(arr.errors[i] * 100, 4)} %)`)}
${esc(`bottom plate: ${pst ? termLabel(pst.terminals[i], diff) + ' → ' : ''}${termLabel(st.terminals[i], diff)},  Vb = ${fx(st.vBottom[i], 5)} V`)}
${esc(`Q_top = C·(Vx − Vb) = ${eng(arr.actual[i], 'F', 5)} × (${fx(st.vTop, 5)} − ${fx(st.vBottom[i], 5)}) V = ${eng(qa, 'C', 6)}`)}${
        qb !== null ? `\n${esc(`ΔQ_top = ${eng(qa - qb, 'C', 6)}`)}` : ''
      }</div>`
    );
  }

  // bar charts + tables
  snap.arrays.forEach((st, a) => {
    const arr = adc.arrays[a];
    const pst = prev ? prev.arrays[a] : null;
    const changed = new Set(snap.changes.filter((c) => c.array === a).map((c) => c.cap));
    const title = diff ? (a === 0 ? 'P side' : 'N side') : 'CDAC';
    parts.push(`<div style="overflow-x:auto;margin-top:10px">${barChart(arr, pst ? pst.charges : null, st.charges, changed, title, selected && selected.a === a ? selected.i : -1)}</div>`);
    const rows = [];
    for (let i = 0; i < arr.n; i++) {
      const qb = pst ? pst.charges.top[i] : NaN;
      const qa = st.charges.top[i];
      const cls = [changed.has(i) ? 'changed' : '', selected && selected.a === a && selected.i === i ? 'sel' : ''].join(' ');
      rows.push(
        `<tr class="${cls} clickable" data-cap="${a}:${i}"><td>${esc(arr.labels[i])}</td><td class="num">${fx(arr.actual[i] * 1e15, 3)}</td><td class="num">${signed(arr.errors[i] * 100, 3)}</td><td class="l">${
          pst && pst.terminals[i] !== st.terminals[i] ? `<span class="term ${pst.terminals[i]}">${termLabel(pst.terminals[i], diff)}</span>→` : ''
        }<span class="term ${st.terminals[i]}">${termLabel(st.terminals[i], diff)}</span></td><td class="num">${fx(st.vBottom[i], 4)}</td><td class="num">${fx(qb * 1e15, 4)}</td><td class="num">${fx(qa * 1e15, 4)}</td><td class="num">${pst ? signed((qa - qb) * 1e15, 4) : '—'}</td></tr>`
      );
    }
    const pb = pst ? pst.charges.parasitic : NaN;
    rows.push(
      `<tr><td class="muted">Cp</td><td class="num">${fx(arr.topParasitic * 1e15, 3)}</td><td></td><td class="l"><span class="term GND">GND</span></td><td class="num">0.0000</td><td class="num">${fx(pb * 1e15, 4)}</td><td class="num">${fx(st.charges.parasitic * 1e15, 4)}</td><td class="num">${pst ? signed((st.charges.parasitic - pb) * 1e15, 4) : '—'}</td></tr>`
    );
    const tb = pst ? pst.charges.totalTop : NaN;
    rows.push(
      `<tr class="total"><td>Σ node X</td><td class="num">${fx(arr.nodeCap * 1e15, 3)}</td><td></td><td></td><td></td><td class="num">${fx(tb * 1e15, 4)}</td><td class="num">${fx(st.charges.totalTop * 1e15, 4)}</td><td class="num">${pst ? signed((st.charges.totalTop - tb) * 1e15, 6) : '—'}</td></tr>`
    );
    parts.push(
      `<div class="table-scroll" style="max-height:300px"><table class="data"><thead><tr><th>Cap</th><th>C [fF]</th><th>ε [%]</th><th>Bottom plate</th><th>Vb [V]</th><th>Q before [fC]</th><th>Q after [fC]</th><th>ΔQ [fC]</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`
    );
  });
  return parts.join('');
}

function tile(k, v, s, cls = '') {
  return `<div class="tile ${cls}"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div>${s ? `<div class="s">${esc(s)}</div>` : ''}</div>`;
}
export { tile };
