// One computation from the current values: model inputs, derived values with
// their formulas, noise budget, timing and conflicts. Every view reads this.
// The physics comes from src/zaan/model; nothing is re-implemented here.

import { designCdac, binaryMatchingCu } from '../zaan/model/cdac.js';
import { receiveDelays, cellsNeeded, worstPhaseError, quantise } from '../zaan/model/beamformer.js';
import { samplingNoise, prechargeNoise, comparatorNoiseAt, jitterNoise, quantNoise, enobOf, noiseForEnob, K_B } from '../zaan/model/noise.js';
import { comparatorTau, conversionTimes, settlingTimes } from '../zaan/model/timing.js';
import { prechargeCharge } from '../zaan/model/reference.js';
import { drawChip, convert } from '../zaan/model/chargeSar.js';
import { testChip } from '../zaan/model/testbench.js';
import { createRng } from '../model/rng.js';
import { v, t, frac, sqrt, sup, eq, paren } from '../zaan/ui/math.js';
import { eng, num } from '../zaan/ui/fmt.js';

export const CHIP_AREA = 3.2e-3 * 5e-3;

/** SI value of an input, or null when unknown. */
export function siOf(values, id) {
  const x = values.find((q) => q.id === id);
  return x && x.kind === 'num' && x.value !== null && x.value !== '' && Number.isFinite(Number(x.value)) ? Number(x.value) * x.si : null;
}

/** Model parameter object (SI). Unknown values stay null; the models never receive a guess. */
export function modelParams(values) {
  const g = (id) => siOf(values, id);
  const pair = g('pairSigma');
  return {
    fs: g('fs'), f0: g('f0'), fbw: g('fbw'), fullScale: g('fullScale'), bits: g('bits'), outBits: g('bits'), enobAim: g('enobAim'),
    channels: g('channels'), pitch: g('pitch'), steer: g('steer'), focus: g('rxFocus') ?? Infinity, delayStep: g('delayStep'), c: g('c'),
    vref: g('vref'), cu: g('cu'), density: g('density'), aC: pair === null ? null : ((pair / Math.SQRT2) * Math.sqrt(35)) * 100,
    radix: g('radix'), topUnits: g('topUnits'), lsbPerUnit: g('lsbPerUnit'), halvings: g('halvings'), routing: g('routing'),
    vos: g('vos'), vosCal: g('vosCal'), compNoise: g('compNoise'), ibias: g('ibias'), gmId: g('gmId'), cload: g('cload'), vfinal: g('vfinal'),
    tSample: g('tSample'), tauDac: g('tauDac'), tLogic: g('tLogic'), temperature: g('temperature'), jitter: g('jitter'),
    chips: g('chips'), seed: g('seed'), memCells: g('memCells'),
  };
}

function entry(id, label, block, value, unit, formula, opts = {}) {
  return { id, label, block, value, unit, formula, status: 'D', ...opts };
}

let simKey = '';
let simCache = null;

/** Mismatch, offset and rounding left after calibration, from one simulated chip (cached). */
function calibratedError(P, d) {
  const key = JSON.stringify([d.weights, P.cu, P.aC, P.seed, P.vosCal, P.vref, P.bits, P.fullScale]);
  if (key === simKey) return simCache;
  const rng = createRng(P.seed);
  const chip = drawChip(d, P, rng);
  const r = testChip(chip, d, { ...P, compNoise: 0 }, rng, { samplesPerCode: 2 });
  const vrms = P.fullScale / 2 / Math.SQRT2;
  const conv = (vrms * 10 ** (-0.5 / 20)) / 10 ** (r.sCal.sndr / 20);
  simCache = { conv, chip, cal: r.cal, sCal: r.sCal, sRaw: r.sRaw };
  simKey = key;
  return simCache;
}

export function derive(values, overrides = {}) {
  const P = modelParams(values);
  const plane = receiveDelays({ N: P.channels, pitch: P.pitch, theta: P.steer, F: Infinity, c: P.c });
  const tauMax = Math.max(...plane.tau);
  const tw = 1 / P.fs;
  const need = cellsNeeded(tauMax, P.delayStep, tw);
  const cells = overrides.cells ?? need.m;
  let d = designCdac(P, P.memCells ?? cells);
  if (overrides.cm !== undefined) {
    const cNode = [P.channels * overrides.cm];
    for (const c of d.cAdd) cNode.push(cNode[cNode.length - 1] + c);
    d = { ...d, cm: overrides.cm, cNode };
  }
  const q = quantNoise(P);
  const samp = samplingNoise(P, d);
  const pre = prechargeNoise(P, d);
  const comp = comparatorNoiseAt(P, d, d.decisions - 1);
  const jit = jitterNoise(P);
  const sim = calibratedError(P, d);
  const calRest = Math.sqrt(Math.max(sim.conv ** 2 - q ** 2, 0));
  const bfNoise = siOf(values, 'noiseAfterBf');
  const refNoiseRel = siOf(values, 'refNoise');
  const vrms = P.fullScale / 2 / Math.SQRT2;
  const noise = [
    { id: 'bf', label: 'LNA and PMUT noise after beamformer', sigma: bfNoise, src: '13 Oct chain', status: 'U' },
    { id: 'samp', label: 'Sampling kT/C, 16 memory cells', sigma: samp, src: '√(2kT / (16 CM))', status: 'D' },
    { id: 'pre', label: 'CDAC precharge kT/C', sigma: pre.volts, src: '√(2kT CDAC) / QLSB', status: 'D' },
    { id: 'comp', label: 'Comparator noise', sigma: comp, src: 'at the last decision', status: 'D' },
    { id: 'q', label: 'Quantisation', sigma: q, src: 'LSB / √12', status: 'D' },
    { id: 'cal', label: 'Mismatch, offset, rounding after calibration', sigma: calRest, src: `simulated chip, seed ${P.seed}`, status: 'D' },
    { id: 'jit', label: 'Clock jitter', sigma: jit.volts, src: `at ${eng(jit.f, 'Hz')}`, status: 'D' },
    { id: 'ref', label: 'Reference noise', sigma: refNoiseRel === null ? null : refNoiseRel * vrms, src: refNoiseRel === null ? 'unknown' : 'relative × signal rms', status: refNoiseRel === null ? '?' : 'D' },
  ];
  const total = Math.sqrt(noise.reduce((a, l) => a + (l.sigma ?? 0) ** 2, 0));
  const enob = enobOf(P, total);
  // timing from node voltages of a sine on the simulated chip
  const rng = createRng(P.seed + 1);
  const traces = [];
  for (let k = 0; k < 300; k++) {
    const x = (d.codes / 2) * 0.95 * Math.sin((2 * Math.PI * 37 * k) / 300) + (rng.uniform() - 0.5);
    const r = convert(sim.chip, d, x, { vos: P.vosCal, trace: true });
    traces.push(r.steps.slice(0, d.decisions).map((s) => s.v + P.vosCal));
  }
  const timing = conversionTimes(P, d, traces);
  const refQ = prechargeCharge(P, d);
  const binCu = binaryMatchingCu(P);
  const lsbV = P.fullScale / 2 ** P.bits;
  const vLsbLast = d.qLsb / d.cNode[d.decisions - 1];
  const sigmaU = P.aC / 100 / Math.sqrt(P.cu / 1e-15);
  const delays = receiveDelays({ N: P.channels, pitch: P.pitch, theta: P.steer, F: P.focus, c: P.c });
  const qd = quantise(delays.tau, P.delayStep);
  const halfSteps = qd.map((x) => Math.round(x / (tw / 2)) % 2);

  const D = {};
  const add = (e) => (D[e.id] = e);
  add(entry('tConv', 'Conversion period', 'system', tw, 's', eq(v('T', 'conv'), '=', frac('1', v('f', 's')), '=', frac('1', `${num(P.fs / 1e6, 2)} ${t('MS/s')}`), '=', eng(tw, 's')), { el: 'clk' }));
  add(entry('lsb', 'LSB at the input', 'system', lsbV, 'V', eq(t('LSB'), '=', frac(v('V', 'FS'), sup('2', v('N'))), '=', frac(`${num(P.fullScale)} ${t('V')}`, sup('2', P.bits)), '=', eng(lsbV, 'V'))));
  add(entry('enobPred', 'Predicted ENOB', 'system', enob.enob, 'bit', eq(t('ENOB'), '=', frac(`20 log<sub>10</sub>(${v('V', 'sig')} / ${v('σ', 'total')}) − 1.76`, '6.02'), '=', frac(`${num(enob.sndr, 2)} − 1.76`, '6.02'), '=', num(enob.enob, 3)), { el: 'sys' }));
  add(entry('noiseTotal', 'Total input-referred noise', 'system', total, 'V rms', eq(v('σ', 'total'), '=', sqrt(`Σ ${sup(v('σ', 'i'), 2)}`), '=', eng(total, 'V'), t('(unknown lines left out)'))));
  add(entry('tauMax', 'Longest steering delay', 'beamformer', tauMax, 's', eq(v('τ', 'max'), '=', frac(`(${v('N')} − 1) ${v('p')} sin ${v('θ')}`, v('c')), '=', frac(`${P.channels - 1} × ${num(P.pitch * 1e6, 0)} ${t('µm')} × ${num(Math.sin(P.steer), 4)}`, `${num(P.c, 0)} ${t('m/s')}`), '=', eng(tauMax, 's')), { el: 'bf' }));
  add(entry('cellsNeeded', 'Memory cells needed per channel', 'beamformer', need.m, '', eq(v('M'), '=', `⌈${frac(`⌈${v('τ', 'max')} / ${v('Δτ')}⌉ ${v('Δτ')}`, v('T', 'w'))}⌉ + 1`, '=', `${need.k} + 1`, '=', need.m), { el: 'bf', unlock: 'cells' }));
  add(entry('phaseErr', 'Worst phase error from the delay step', 'beamformer', worstPhaseError(P.f0, P.delayStep), '°', eq(v('Δφ'), '=', frac(`360° ${v('f', '0')} ${v('Δτ')}`, '2'), '=', `${num(worstPhaseError(P.f0, P.delayStep), 2)}°`)));
  add(entry('holdTime', 'Longest hold time of a memory cell', 'beamformer', (P.memCells ?? cells) * tw, 's', eq(v('t', 'hold'), '=', `${v('M')} ${v('T', 'w')}`, '=', `${P.memCells ?? cells} × ${eng(tw, 's')}`, '=', eng((P.memCells ?? cells) * tw, 's'))));
  add(entry('clk180', 'Channels writing on CLK 180°', 'beamformer', halfSteps.filter((x) => x).length, '', eq(t('channels whose rounded delay is an odd number of'), frac(v('T', 'w'), '2'))));
  add(entry('sigmaU', 'Mismatch σ of one unit capacitor', 'cdac', sigmaU, '%', eq(v('σ', 'u'), '=', frac(`${v('σ', 'pair')}(35 ${t('fF')})`, sqrt('2')), sqrt(frac(`35 ${t('fF')}`, v('C', 'u'))), '=', `${num(sigmaU * 100, 3)} %`), { scale: 100 }));
  add(entry('decisions', 'Decisions from the weights', 'cdac', d.decisions, '', eq(v('n'), '=', `${t('steps')} + 1`, '=', `${d.weights.length} + 1`, '=', d.decisions), { el: 'logic' }));
  add(entry('units', 'Unit capacitors in the CDAC', 'cdac', d.units, '', eq(t('units'), '=', `Σ ${t('whole steps')} + ${paren(`${t('halvings')} + 1`)}`, '=', d.units)));
  add(entry('cdac', 'Total CDAC capacitance', 'cdac', d.cdac, 'F', eq(v('C', 'DAC'), '=', `${t('units')} × ${v('C', 'u')}`, '=', `${d.units} × ${eng(P.cu, 'F')}`, '=', eng(d.cdac, 'F')), { el: 'cdacP' }));
  add(entry('qLsb', 'Charge of one LSB', 'cdac', d.qLsb, 'C', eq(v('Q', 'LSB'), '=', frac(`2 ${v('V', 'REF')} ${v('C', 'u')}`, t('LSB per unit')), '=', frac(`2 × ${eng(P.vref, 'V')} × ${eng(P.cu, 'F')}`, P.lsbPerUnit), '=', eng(d.qLsb, 'C'))));
  add(entry('cm', 'Memory cell CM (half-range charge balance)', 'cdac', d.cm, 'F', eq(`${v('N')} ${v('V', 'FS')} ${v('C', 'M')}`, '=', `${sup('2', v('N', 'b'))} ${v('Q', 'LSB')}`, '→', v('C', 'M'), '=', frac(`${2 ** P.bits} × ${eng(d.qLsb, 'C')}`, `${P.channels} × ${num(P.fullScale)} ${t('V')}`), '=', eng(d.cm, 'F')), { el: 'cell', unlock: 'cm' }));
  add(entry('cmSlide', 'Memory cell CM with total CDAC (slide 25)', 'cdac', d.cmSlide, 'F', eq(v('C', 'M'), '=', frac(`4 ${v('V', 'REF')} ${v('C', 'DAC')}`, `${v('N')} ${v('V', 'FS')}`), '=', eng(d.cmSlide, 'F'))));
  add(entry('vLsbLast', 'LSB at the comparator, last decision', 'comparator', vLsbLast, 'V', eq(v('V', 'LSB'), '=', frac(v('Q', 'LSB'), v('C', 'node,last')), '=', frac(eng(d.qLsb, 'C'), eng(d.cNode[d.decisions - 1], 'F')), '=', eng(vLsbLast, 'V')), { el: 'comp' }));
  add(entry('attenuation', 'Input to comparator, last decision', 'beamformer', d.cNode[0] / d.cNode[d.decisions - 1], '', eq(frac(v('C', 'node,0'), v('C', 'node,last')), '=', frac(eng(d.cNode[0], 'F'), eng(d.cNode[d.decisions - 1], 'F')), '=', num(d.cNode[0] / d.cNode[d.decisions - 1], 3))));
  add(entry('area', 'ADC capacitor area (CDAC + memory cells)', 'cdac', d.area, 'm²', eq(v('A'), '=', frac(`${v('C', 'DAC')} + ${d.memCaps} ${v('C', 'M')}`, v('ρ', 'C')), '×', t('routing'), '=', `${num(d.area * 1e6, 4)} ${t('mm²')}`), { scale: 1e6, unitShow: 'mm²' }));
  add(entry('binCu', 'Unit capacitor that binary matching would need', 'cdac', binCu.cu, 'F', eq(`3 ${v('σ', 'u')} ${t('LSB/unit')} ${sqrt(`2 ${t('first step')}`)}`, '<', '0.5', '→', v('C', 'u'), '≥', eng(binCu.cu, 'F'))));
  add(entry('kTCsamp', 'Sampling kT/C noise', 'sampling', samp, 'V rms', eq(v('σ'), '=', sqrt(frac(`2 ${v('k')} ${v('T')}`, `${v('N')} ${v('C', 'M')}`)), '=', sqrt(frac(`2 × ${K_B} × ${num(P.temperature, 0)}`, `${P.channels} × ${eng(d.cm, 'F')}`)), '=', eng(samp, 'V')), { el: 'cell' }));
  add(entry('lnaR', 'Largest LNA drive resistance for settling', 'frontend', tw / 20 / d.cm, 'Ω', eq(v('R'), '≤', frac(`${v('T', 'w')} / 20`, v('C', 'M')), '=', frac(eng(tw / 20, 's'), eng(d.cm, 'F')), '=', eng(tw / 20 / d.cm, 'Ω'), t('(Chen 2018 p. 3055: τ ≤ Ts / 20)')), { el: 'lna' }));
  add(entry('refQ', 'Reference charge per conversion', 'reference', refQ.q, 'C', eq(v('Q', 'pre'), '≈', `2 ${v('V', 'REF')} ${v('C', 'DAC')}`, '=', eng(refQ.q, 'C')), { el: 'ref' }));
  add(entry('refI', 'Average reference current', 'reference', refQ.current, 'A', eq(v('I', 'ref'), '=', `${v('Q', 'pre')} ${v('f', 's')}`, '=', eng(refQ.current, 'A')), { el: 'ref' }));
  add(entry('tauComp', 'Comparator regeneration time constant', 'comparator', comparatorTau(P), 's', eq(v('τ'), '=', frac(v('C', 'load'), `(${v('g', 'm')}/${v('I', 'D')}) ${v('I', 'bias')}`), '=', frac(eng(P.cload, 'F'), `${num(P.gmId, 1)} × ${eng(P.ibias, 'A')}`), '=', eng(comparatorTau(P), 's')), { el: 'comp' }));
  add(entry('tConvMedian', 'Median conversion time', 'logic', timing.median, 's', eq(v('t', 'conv'), '=', `${v('T', 's')} + Σ (${v('t', 'dec,i')} + ${v('t', 'settle,i')} + ${v('t', 'logic')})`, '=', eng(timing.median, 's'), t('(median of 300 samples)')), { el: 'logic' }));
  add(entry('tConvWorst', 'Worst conversion time (300 samples)', 'logic', timing.totals[timing.totals.length - 1], 's', eq(t('max over the samples'), '=', eng(timing.totals[timing.totals.length - 1], 's'))));

  const conflicts = buildConflicts(P, d, values);
  return { P, d, tw, tauMax, need, cells, delays, qd, halfSteps, noise, total, enob, timing, sim, D, conflicts, vrms, settle: settlingTimes(d, P.tauDac) };
}

function buildConflicts(P, d, values) {
  const out = [];
  if (Math.abs(P.fs / P.f0 - 4) < 1e-9) {
    out.push({ id: 'fs4f0', title: 'fs is exactly 4 × f0', body: `${num(P.fs / 1e6, 1)} MS/s ÷ ${num(P.f0 / 1e6, 1)} MHz = 4, while the sample rate is deliberately not 4 times the centre frequency.`, el: 'clk' });
  }
  out.push({ id: 'cmBalance', title: 'Charge balance with redundancy', body: `Half-range charge gives CM = ${eng(d.cm, 'F')}; the total CDAC (slide 25) gives ${eng(d.cmSlide, 'F')}. Which charge has to balance the input is open (derived, to confirm).`, el: 'cell' });
  const n = d.decisions;
  const per = (i) => (d.cNode[i] * 1e-3) / d.qLsb;
  out.push({ id: 'offsetSlides', title: 'Offset per mV: slides 11 and 36 differ', body: `Slide 11: 1.0 / 2.3 / 3.6 LSB per mV; slide 36: 2.6 LSB per mV. Model: ${num(per(0), 2)} / ${num(per(Math.floor(n / 2)), 2)} / ${num(per(n - 1), 2)} LSB per mV.`, el: 'comp' });
  const sMaxAfe = siOf(values, 'sMaxAfe');
  const fsRms = P.fullScale / 2 / Math.SQRT2;
  if (sMaxAfe !== null && sMaxAfe > fsRms) {
    out.push({ id: 'smaxFs', title: 'Smax after the AFE exceeds the ADC full scale', body: `13 Oct chain: Smax after AFE ${eng(sMaxAfe, 'V')} rms; a full-scale sine of ${num(P.fullScale)} V pp differential is ${eng(fsRms, 'V')} rms. The largest echoes clip unless gain or full scale changes.`, el: 'lna' });
  }
  const lambda = P.c / P.f0;
  const sg = Math.sin(P.steer) - lambda / P.pitch;
  if (P.pitch > lambda / 2) {
    out.push({ id: 'grating', title: 'Element pitch is larger than half a wavelength', body: `λ = c / f0 = ${num(lambda * 1e6, 0)} µm, pitch ${num(P.pitch * 1e6, 0)} µm = ${num(P.pitch / lambda, 2)} λ. Steering to ${num(P.steer * (180 / Math.PI), 1)}° gives a grating lobe${Math.abs(sg) <= 1 ? ` at ${num(Math.asin(sg) * (180 / Math.PI), 1)}°` : ''} at full level in the array factor. The directivity of the 180 µm wide element (not modeled) lowers it; check against your MATLAB beams.`, el: 'bf' });
  }
  out.push({ id: 'matching', title: 'Matching: area slope and capacitance slope differ', body: `0.0499 µm / √(16 µm²) = 1.25 % uses the 4 µm × 4 µm area; the same slope per capacitance at 35 fF gives 1.19 %. The workbench uses your 1.25 %.`, el: 'cdacP' });
  return out;
}
