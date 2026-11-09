// Every pass or fail of the design, with the reason in numbers and what would fix it.

import { eng, num, fq } from './kit.js';

const PDK_MIN = 35e-15;

function fixFor(line, ctx) {
  const { P, d, budget } = ctx;
  const a = line.maxAlone;
  const lastC = d.cNode[d.decisions - 1];
  switch (line.id) {
    case 'sar':
    case 'quant':
      return `The levels of the SAR are ${num(Math.min(...d.weights), 2)} LSB apart at the finest; a smaller smallest step (one more charge-halving step) makes them finer, and more combiner output bits keep that resolution.`;
    case 'round':
      return `Keep more bits after the combiner: rounding to ${Math.round(P.outBits)} bits throws away what the calibrated weights resolve. ${Math.round(P.outBits) + 2} bits removes most of this line at no cost in decisions.`;
    case 'lut':
      return 'Measure the weights more accurately: longer averaging, or measure them externally and load the LUT.';
    case 'comp':
      return a > 0
        ? `Comparator noise below ${eng(a / lastC, 'V')} rms (now ${eng(P.compNoise, 'V')}), or a smaller node capacitance at the last decision (now ${eng(lastC, 'F')}): the same voltage noise is less charge on a smaller node.`
        : 'Even without comparator noise the other lines exceed the allowance.';
    case 'samp':
      return `This charge is √(2kT·N·CM)${budget.arrayGain ? '' : ' × √N (beamformer gain is off)'}. Relative to the signal it shrinks with a larger CM, which follows from VREF and Cu through the charge balance.`;
    case 'pre':
      return `This charge is √(4kT·CDAC) = ${fq(ctx, line.sigma, true)}; one LSB is 2·VREF·Cu / ${P.lsbPerUnit}. A larger VREF makes the LSB larger at the same CDAC.`;
    case 'jit':
      return a > 0 ? `Jitter below ${eng(a / (P.channels * d.cm * 2 * Math.PI * P.f0 * (1 + P.fbw / 2) * (ctx.vrms)), 's')} rms (now ${eng(P.jitter, 's')}).` : 'Even without jitter the other lines exceed the allowance.';
    default:
      return '';
  }
}

function enobCheck(ctx) {
  const { P, budget: b } = ctx;
  const sorted = b.lines.slice().sort((x, y) => y.share - x.share);
  const over = sorted.filter((l) => !l.ok);
  const top = sorted.find((l) => !l.fixed) || sorted[0];
  const q = b.lines.find((l) => l.fixed);
  const why = `${b.ok ? '' : 'Too much noise. '}The noise adds up to ${fq(ctx, b.total, true)} (${num(b.total / ctx.d.qLsb, 3)} LSB), ${num(b.used, 0)} % of the ${fq(ctx, b.allowed, true)} that ENOB ${num(P.enobAim, 1)} allows. The quantisation by the SAR levels takes ${num(q.share, 0)} % by itself; the largest other line is ${top.label.toLowerCase()} with ${num(top.share, 0)} %.${over.length ? ` Over its own allocation: ${over.map((l) => `${l.label.toLowerCase()} (${num(l.share, 1)} % of ${num(l.alloc, 1)} %)`).join('; ')}.` : ''}`;
  return { id: 'enob', label: 'ENOB of the converter', state: b.ok ? 'ok' : 'bad', value: `${num(b.enob, 2)} bit`, limit: `aim ${num(P.enobAim, 1)}`, why, fix: b.ok ? '' : fixFor(top, ctx), go: 'budget', f: 'enob' };
}

function toleranceCheck(ctx) {
  const bad = ctx.tolNeed.filter((r) => !r.ok);
  if (!bad.length) {
    const m = Math.min(...ctx.tolNeed.filter((r) => !r.last).map((r) => r.have + 0.5 - r.need));
    return { id: 'tol', label: 'Redundancy covers the errors', state: 'ok', value: `margin ${num(m, 2)} LSB`, limit: 'need ≤ tolerance + ½ LSB', why: 'At every decision the tolerance plus half an LSB is larger than what mismatch (3σ) and the offset left after calibration need. Comparator noise is in the noise budget.', fix: '', go: 'sar', f: 'tol' };
  }
  const list = bad.slice(0, 4).map((r) => `decision ${r.i + 1} needs ${num(r.need, 2)} LSB (mismatch ${num(r.mismatch, 2)}, offset ${num(r.offset, 2)}) but has ${num(r.have, 2)} + ½`).join('; ');
  const mis = bad.reduce((a, r) => a + r.mismatch, 0) >= bad.reduce((a, r) => a + r.offset, 0);
  return {
    id: 'tol', label: 'Redundancy covers the errors', state: 'bad', value: `${bad.length} decision${bad.length > 1 ? 's' : ''} short`, limit: 'need ≤ tolerance + ½ LSB',
    why: `${list}. A wrong decision there cannot be repaired by the later steps, so codes are lost.`,
    fix: mis ? 'Mostly mismatch: a smaller radix (more redundancy) or a larger Cu. The optimizer on the SAR ADC page searches this.' : 'Mostly offset: lower the offset left after calibration, or add redundancy.',
    go: 'sar', f: 'tol',
  };
}

export function runChecks(ctx) {
  const { P, d, need } = ctx;
  const out = [enobCheck(ctx), toleranceCheck(ctx)];
  out.push({
    id: 'cover', label: 'Steps reach both ends of the range', state: d.cover.ok ? 'ok' : 'bad', value: `${num(d.cover.sum, 1)} LSB`, limit: `${d.cover.need} needed`,
    why: d.cover.ok ? 'The sum of the steps reaches half the codes.' : `The steps add up to ${num(d.cover.sum, 1)} LSB, but ${d.cover.need} are needed to move from mid-scale to either end; inputs near full scale clip.`,
    fix: d.cover.ok ? '' : 'Raise the first step or the radix, or add a step.', go: 'sar', f: 'cover',
  });
  out.push({
    id: 'cells', label: 'Memory cells per channel', state: need.m > P.memCells ? 'bad' : 'ok', value: `${need.m} needed`, limit: `${P.memCells} set`,
    why: need.m > P.memCells ? `At ±${num(Math.abs(P.steer) * (180 / Math.PI), 1)}° the longest delay is ${eng(ctx.tauMax, 's')}; that takes ${need.m} cells of ${eng(ctx.tw, 's')}, more than the ${P.memCells} there are.` : `The longest delay ${eng(ctx.tauMax, 's')} fits in ${need.m} of the ${P.memCells} cells.`,
    fix: need.m > P.memCells ? `Set ${need.m} cells, or reduce the steering range.` : '', go: 'beamformer', f: 'cells',
  });
  const small = ctx.smallest < PDK_MIN - 1e-21;
  out.push({
    id: 'small', label: 'Smallest capacitor', state: small ? 'warn' : 'ok', value: eng(ctx.smallest, 'F'), limit: 'PDK minimum 35 fF',
    why: small ? `A step uses a ${eng(ctx.smallest, 'F')} capacitor, below the 35 fF minimum of the MIM device; its matching is unknown from the PDK.` : 'Every capacitor is at least the PDK minimum.',
    fix: small ? 'Use charge halving for the steps below one unit.' : '', go: 'sar', f: 'smallest',
  });
  out.push({
    id: 'dec', label: 'Decisions against the plan', state: d.decisions === P.rawDecisions ? 'ok' : 'warn', value: `${d.decisions}`, limit: `planned ${P.rawDecisions}`,
    why: d.decisions === P.rawDecisions ? 'The weights give the planned number of raw decisions.' : `The weights give ${d.decisions} decisions; the plan has ${P.rawDecisions}. Each decision costs time; the output register needs ${d.decisions} bits.`,
    fix: '', go: 'sar', f: 'decisions',
  });
  const late = ctx.timing.median > ctx.tw;
  out.push({
    id: 'time', label: 'Conversion fits in one sample period (illustrative)', state: late ? 'warn' : 'ok', value: eng(ctx.timing.median, 's'), limit: eng(ctx.tw, 's'),
    why: late ? `With the illustrative timing values the median conversion takes ${eng(ctx.timing.median, 's')}, longer than 1 / fs = ${eng(ctx.tw, 's')}. No timing value is decided yet.` : `Median ${eng(ctx.timing.median, 's')} of ${eng(ctx.tw, 's')}; ${num(ctx.timing.late * 100, 1)} % of samples are late. Illustrative values.`,
    fix: late ? 'See the Timing page: comparator τ, settling and logic delay.' : '', go: 'timing', f: 'tconv',
  });
  return out;
}

/** A box listing the checks of one page that do not pass, with why and fix. */
export function failBox(ctx, ids) {
  const bad = ctx.checks.filter((c) => ids.includes(c.id) && c.state !== 'ok');
  if (!bad.length) return '';
  return `<div class="fails">${bad.map((c) => `<div class="fail ${c.state}"><b>${c.label}: ${c.value} (${c.limit})</b><p>${c.why}</p>${c.fix ? `<p class="fix">Fix: ${c.fix}</p>` : ''}</div>`).join('')}</div>`;
}
