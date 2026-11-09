// Click a value to see where it comes from: the formula with symbols, the same
// formula with the current numbers, and the result. One entry per value id.

import { v, t, frac, sqrt, sup, paren } from '../zaan/ui/math.js';
import { eng, num, fq } from './kit.js';
export { fv } from './kit.js';

const QL = v('Q', 'LSB');
const CM = v('C', 'M');
const NCH = v('N', 'ch');
const VREF = v('V', 'REF');
const CU = v('C', 'u');
const kT = `${v('k')}${v('T')}`;
const deg = (x) => `${num((x * 180) / Math.PI, 1)}°`;

function line(name, ctx) {
  return ctx.budget.lines.find((l) => l.id === name);
}

function budgetRow(ctx, id) {
  const l = line(id, ctx);
  const other = c.ui && c.ui.qUnit === 'V' ? eng(l.sigma, 'C') : `${eng(l.sigma / c.d.cNode[0], 'V')} at the input`;
  return `${fq(c, l.sigma, true)} = ${num(l.lsb, 3)} LSB (${other}); ${num(l.share, 1)} % of the allowed noise power`;
}

export const FORMULAS = {
  qlsb: (c) => ({
    title: 'Charge of one LSB',
    rows: [[`${QL} = ${frac(`2 ${VREF} ${CU}`, v('n', 'u'))}`, `${frac(`2 × ${eng(c.P.vref, 'V')} × ${eng(c.P.cu, 'F')}`, `${c.P.lsbPerUnit}`)}`]],
    res: `${eng(c.d.qLsb, 'C')}, which is ${eng(c.d.qLsb / c.d.cNode[0], 'V')} at the input`,
    note: `One unit capacitor precharged to VREF and shared differentially moves 2 VREF Cu (assumption, consistent with the review). n u = ${c.P.lsbPerUnit} LSB per unit capacitor. Charge and input voltage are tied by Q in = N ch CM V in.`,
  }),
  qfs: (c) => ({
    title: 'Charge of the full scale',
    rows: [[`${v('Q', 'FS')} = ${sup('2', v('N'))} ${QL} = ${NCH} ${CM} ${v('V', 'FS')}`, `${sup('2', c.P.bits)} × ${eng(c.d.qLsb, 'C')}`]],
    res: eng(c.d.qFs, 'C'),
    note: 'The input charge on the node is Q in = N ch · CM · V in, so all noise is referred to this charge.',
  }),
  cm: (c) => ({
    title: 'Memory cell CM from the charge balance',
    rows: [[`${CM} = ${frac(`${sup('2', v('N'))} ${QL}`, `${NCH} ${v('V', 'FS')}`)}`, frac(`${sup('2', c.P.bits)} × ${eng(c.d.qLsb, 'C')}`, `${c.P.channels} × ${eng(c.P.fullScale, 'V')}`)]],
    res: eng(c.d.cm, 'F'),
    note: `Half-range charge balance: the full-scale input charge equals 2^N LSB of step charge. The slide method with the total CDAC gives 4 VREF CDAC / (N ch V FS) = ${eng(c.d.cmSlide, 'F')}; which one holds with redundancy is an open item.`,
  }),
  cdac: (c) => ({
    title: 'Total CDAC capacitance',
    rows: [[`${v('C', 'DAC')} = ${v('n', 'units')} ${CU}`, `${num(c.d.units, 2)} × ${eng(c.P.cu, 'F')}`]],
    res: eng(c.d.cdac, 'F'),
    note: 'Whole-unit steps plus the charge-halving chain (one source capacitor and one per halving). One side of the differential pair.',
  }),
  cnode: (c) => {
    const n = c.d.decisions;
    return {
      title: 'Node capacitance at the last decision',
      rows: [[`${v('C', 'node,i')} = ${NCH} ${CM} + ${t('Σ')}<sub>j&lt;i</sub> 2 ${v('C', 'j')}`, `${c.P.channels} × ${eng(c.d.cm, 'F')} + ${eng(c.d.cNode[n - 1] - c.d.cNode[0], 'F')}`]],
      res: eng(c.d.cNode[n - 1], 'F'),
      note: `Starts at ${eng(c.d.cNode[0], 'F')} (the 16 cells) and grows with every shared pair. The same comparator voltage is ${num(c.d.cNode[n - 1] / c.d.cNode[0], 2)} × more charge at the end than at the start.`,
    };
  },
  lsbend: (c) => {
    const cl = c.d.cNode[c.d.decisions - 1];
    return { title: 'One LSB at the comparator, last decision', rows: [[`${v('V', 'LSB')} = ${frac(QL, v('C', 'node,last'))}`, frac(eng(c.d.qLsb, 'C'), eng(cl, 'F'))]], res: eng(c.d.qLsb / cl, 'V'), note: 'Comparator offset and noise must be compared with this, not with the 1 V / 1024 LSB at the input.' };
  },
  allowed: (c) => ({
    title: 'Charge noise allowed for the ENOB aim',
    rows: [[`${v('σ', 'Q,max')} = ${frac(`${v('Q', 'FS')} / ${paren(`2${sqrt('2')}`)}`, `${sup('10', paren(`6.02 ${t('ENOB')} + 1.76`) + ' / 20')}`)}`, frac(`${eng(c.d.qFs, 'C')} / 2.83`, sup('10', `${num((6.02 * c.P.enobAim + 1.76) / 20, 3)}`))]],
    res: `${fq(c, c.budget.allowed, true)} = ${num(c.budget.allowed / c.d.qLsb, 3)} LSB`,
    note: `For a full-scale sine. Quantisation alone is ${QL} / √12 = 0.289 LSB, so it uses ${num(line('q', c).share, 0)} % of this.`,
  }),
  enob: (c) => ({
    title: 'ENOB from the charge budget',
    rows: [
      [`${v('σ', 'Q')} = ${sqrt(`${t('Σ')} ${sup(v('σ', 'Q,k'), 2)}`)}`, fq(c, c.budget.total, true)],
      [`${t('SNDR')} = 20 log<sub>10</sub> ${frac(`${v('Q', 'FS')} / ${paren(`2${sqrt('2')}`)}`, v('σ', 'Q'))}`, `${num(c.budget.sndr, 2)} dB`],
      [`${t('ENOB')} = ${frac(`${t('SNDR')} − 1.76`, '6.02')}`, frac(`${num(c.budget.sndr, 2)} − 1.76`, '6.02')],
    ],
    res: `${num(c.budget.enob, 2)} bit (aim ${num(c.P.enobAim, 1)})`,
    note: 'Converter only, from the beamformer onward. Charges add in power, never in rms.',
  }),
  'b-q': (c) => ({ title: 'Quantisation noise as charge', rows: [[`${v('σ', 'Q,q')} = ${frac(QL, sqrt('12'))}`, frac(eng(c.d.qLsb, 'C'), '3.46')]], res: budgetRow(c, 'q'), note: `Uniform rounding error of the ${c.P.bits}-bit output.` }),
  'b-samp': (c) => ({
    title: 'kT/C of the memory cells as charge',
    rows: c.budget.arrayGain
      ? [[`${v('σ', 'Q,M')} = ${sqrt(`${NCH} · 2 ${kT} ${CM}`)}`, sqrt(`${c.P.channels} × 2 × ${eng(1.381e-23 * c.P.temperature, 'J')} × ${eng(c.d.cm, 'F')}`)]]
      : [[`${v('σ', 'Q,M')} = ${NCH} ${sqrt(`2 ${kT} ${CM}`)}`, `${c.P.channels} × ${sqrt(`2 × ${eng(1.381e-23 * c.P.temperature, 'J')} × ${eng(c.d.cm, 'F')}`)}`]],
    res: budgetRow(c, 'samp'),
    note: c.budget.arrayGain
      ? `Each channel has a cell CM on node + and one on node −; each keeps a random charge with variance kT CM when its write switch opens, independent of the other side, so the differential charge of one channel has variance 2 kT CM. The ${c.P.channels} cells are independent, so the charges add in power (√N) while the aligned signal adds in amplitude (N): the beamformer gain of 10 log10 N = ${num(c.budget.arrayGainDb, 1)} dB.`
      : 'Beamformer gain off: the cell noise is counted as if it added like the signal (N times), a worst case 12 dB higher in power.',
  }),
  'b-pre': (c) => {
    const halves = c.d.steps.filter((x) => x.kind === 'half').length;
    return {
      title: 'CDAC precharge kT/C as charge',
      rows: [[`${v('σ', 'Q,pre')} = ${sqrt(`4 ${kT} ${v('C', 'DAC')} + ${v('n', '½')} · 4 ${kT} ${frac(CU, '2')}`)}`, sqrt(`4 × ${eng(1.381e-23 * c.P.temperature, 'J')} × ${eng(c.d.cdac, 'F')} + ${halves} × 4 × ${eng(1.381e-23 * c.P.temperature, 'J')} × ${eng(c.P.cu / 2, 'F')}`)]],
      res: budgetRow(c, 'pre'),
      note: 'Each step is one floating capacitor C between node + and node −. When its precharge switches open it keeps a random plate charge with variance kT C. That charge enters node + and node − with opposite sign, so the differential charge sees twice it: variance 4 kT C. Every step is shared once, so all of the CDAC counts. A halving step also opens the switch between its two halves (series capacitance Cu / 2).',
    };
  },
  'b-comp': (c) => {
    const cl = c.d.cNode[c.d.decisions - 1];
    const simL = (c.sim.compSimV * c.d.cNode[0]) / c.d.qLsb;
    return { title: 'Comparator noise as charge', rows: [[`${v('σ', 'Q,cmp')} = ${v('C', 'node,last')} ${v('v', 'n')}`, `${eng(cl, 'F')} × ${eng(c.P.compNoise, 'V')}`]], res: budgetRow(c, 'comp'), note: `A voltage noise v n at the comparator is the charge C node · v n on the node. Earlier decisions see it on a smaller node and are repaired by redundancy; the last decisions are not, so the largest node counts. This is a first-order upper estimate: the simulated chip with and without comparator noise gives ${num(simL, 3)} LSB against ${num(cl * c.P.compNoise / c.d.qLsb, 3)} LSB here, because a noisy last decision only changes the code when the residue is within the noise.` };
  },
  'b-jit': (c) => {
    const f = c.P.f0 * (1 + c.P.fbw / 2);
    return { title: 'Sampling clock jitter as charge', rows: [[`${v('σ', 'Q,j')} = ${NCH} ${CM} · 2π ${v('f', 'max')} ${v('σ', 't')} ${v('V', 'rms')}`, `${eng(c.P.channels * c.d.cm, 'F')} × 2π × ${eng(f, 'Hz')} × ${eng(c.P.jitter, 's')} × ${eng(c.vrms, 'V')}`]], res: budgetRow(c, 'jit'), note: 'A full-scale sine at the band edge f0 (1 + bw / 2) changes fastest; a timing error σt gives a voltage error 2π f σt V rms. Counted as if all channels jitter together (worst case: the 16 errors add like the signal).' };
  },
  'b-cal': (c) => {
    const e = c.sim.res.map((x) => x.enob);
    return { title: 'Mismatch, offset and rounding after calibration', rows: [[`${v('σ', 'Q,cal')} = ${NCH} ${CM} ${sqrt(`${t('mean')} ${sup(v('σ', 'V,sim'), 2)} − ${sup(v('σ', 'V,q'), 2)}`)}`, `${eng(c.d.cNode[0], 'F')} × ${eng(line('cal', c).sigma / c.d.cNode[0], 'V')}`]], res: budgetRow(c, 'cal'), note: `Simulated on ${e.length} chips (seeds from ${c.P.seed}) without comparator noise; ENOB after calibration ${num(Math.min(...e), 2)} to ${num(Math.max(...e), 2)}. The error of each chip minus ideal quantisation, averaged in power. Most of it is rounding: with the smallest step at ${num(Math.min(...c.d.weights), 2)} LSB, the calibrated levels are not finer than the output LSB, so rounding to ${c.P.bits} bits makes some codes 0 or 2 LSB wide.` };
  },
  gain: (c) => ({ title: 'Beamformer gain on channel noise', rows: [[`${v('G')} = 10 log<sub>10</sub> ${NCH}`, `10 log<sub>10</sub> ${c.P.channels}`]], res: `${num(c.budget.arrayGainDb, 2)} dB`, note: 'Signal from N aligned channels adds as N, independent noise as √N. Only noise that is independent per channel gets this; here that is the kT/C of the memory cells.' }),
  tol: (c) => ({ title: 'Tolerance of decision 1', rows: [[`${v('t', 'i')} = ${t('Σ')}<sub>j&gt;i</sub> ${v('w', 'j')} + 1 − ${v('w', 'i')}`, `${num(c.d.weights.slice(1).reduce((a, w) => a + w, 0), 2)} + 1 − ${num(c.d.weights[0], 2)}`]], res: `${num(c.d.tol[0], 2)} LSB`, note: 'How far the level after this decision may be wrong and still be reached by the later steps.' }),
  need: (c) => {
    const r = c.tolNeed[0];
    return {
      title: 'What decision 1 needs from its tolerance',
      rows: [
        [`${t('mismatch')} = 3 ${sqrt(`${t('Σ')}<sub>j≥i</sub> ${sup(v('σ', 'w,j'), 2)}`)}, ${v('σ', 'w,j')} = ${frac(`${v('w', 'j')} ${v('σ', 'u')}`, sqrt(v('n', 'j')))}`, `${num(r.mismatch, 2)} LSB`],
        [`${t('offset')} = ${frac(`|${v('v', 'os')}| ${paren(`${v('C', 'node,last')} − ${v('C', 'node,i')}`)}`, QL)}`, `${num(r.offset, 2)} LSB after calibration (${num(r.offsetRaw, 2)} before)`],
        [`${t('noise')} = ${frac(`3 ${v('C', 'node,i')} ${v('v', 'n')}`, QL)}`, `${num(r.noise, 2)} LSB, shown only`],
      ],
      res: `need ${num(r.need, 2)} LSB, have ${num(r.have, 2)} + ½ LSB`,
      note: 'The common part of the offset shifts every code equally; only the difference from the last decision uses tolerance.',
    };
  },
  cover: (c) => ({ title: 'Coverage of the range', rows: [[`${t('Σ')} ${v('w', 'i')} ≥ ${sup('2', `${v('N')} − 1`)} − 1`, `${num(c.d.cover.sum, 1)} ≥ ${c.d.cover.need}`]], res: c.d.cover.ok ? 'met' : 'not met', note: 'From mid-scale the steps must reach either end.' }),
  decisions: (c) => ({ title: 'Number of decisions', rows: [[`${v('n')} = ${v('n', 'steps')} + 1`, `${c.d.weights.length} + 1`]], res: `${c.d.decisions}`, note: 'One decision before each step and one after the last step.' }),
  cells: (c) => ({
    title: 'Memory cells per channel',
    rows: [[`${v('M')} = ⌈ ⌈${frac(v('τ', 'max'), v('Δτ'))}⌉ ${frac(v('Δτ'), v('T', 'w'))} ⌉ + 1`, `⌈ ⌈${frac(eng(c.tauMax, 's'), eng(c.P.delayStep, 's'))}⌉ × ${frac(eng(c.P.delayStep, 's'), eng(c.tw, 's'))} ⌉ + 1`]],
    res: `${c.need.m}`, note: 'Delays are counted in write slots T w = 1 / fs; the half step comes from CLK 180°, not from an extra cell.',
  }),
  taumax: (c) => ({ title: 'Longest delay', rows: [[`${v('τ', 'max')} = ${frac(`${paren(`${NCH} − 1`)} ${v('p')} sin ${v('θ')}`, v('c'))}`, frac(`${c.P.channels - 1} × ${eng(c.P.pitch, 'm')} × sin ${deg(Math.abs(c.P.steer))}`, `${num(c.P.c, 0)} m/s`)]], res: eng(c.tauMax, 's'), note: 'Plane wave at the largest steering angle.' }),
  sigmau: (c) => ({ title: 'Mismatch of one unit capacitor', rows: [[`${v('σ', 'u')} = ${frac(v('A', 'C'), sqrt(`${CU} / ${t('fF')}`))}`, frac(`${num(c.P.aC, 2)} %`, sqrt(num(c.P.cu * 1e15, 1)))]], res: `${num(c.sigmaU * 100, 3)} %`, note: 'A C from the PDK pair figure: σ(ΔC/C) of a pair is √2 times that of one capacitor.' }),
  smallest: (c) => ({ title: 'Smallest capacitor', rows: [[`${v('C', 'min')} = ${t('min')} ${v('n', 'j')} ${CU}`, `${eng(c.smallest, 'F')}`]], res: eng(c.smallest, 'F'), note: 'Charge halving keeps every capacitor at Cu; small capacitors go below it.' }),
  area: (c) => ({ title: 'Capacitor area', rows: [[`${v('A')} = ${frac(`${paren(`${v('n', 'M')} ${CM} + ${v('C', 'DAC')}`)} ${v('k', 'r')}`, v('ρ'))}`, frac(`${paren(`${c.d.memCaps} × ${eng(c.d.cm, 'F')} + ${eng(c.d.cdac, 'F')}`)} × ${c.P.routing}`, `${num(c.P.density * 1e3, 1)} fF/µm²`)]], res: `${num(c.areaTotal * 1e6, 4)} mm²`, note: 'k r: area factor for routing and switches; ρ: capacitor density.' }),
  tauc: (c) => ({ title: 'Comparator time constant', rows: [[`${v('τ')} = ${frac(v('C', 'load'), `${paren(`${v('g', 'm')} / ${v('I', 'D')}`)} ${v('I', 'bias')}`)}`, frac(eng(c.P.cload, 'F'), `${c.P.gmId} /V × ${eng(c.P.ibias, 'A')}`)]], res: eng(c.tauC, 's'), note: 'Illustrative values.' }),
  tconv: (c) => ({ title: 'Conversion time', rows: [[`${v('T', 'conv')} = ${v('T', 's')} + ${t('Σ')} ${paren(`τ ln ${frac(v('V', 'f'), `|${v('V', 'in,i')}|`)} + ${v('t', 'logic')} + ${v('t', 'settle,i')}`)}`, `median over 300 samples`]], res: `${eng(c.timing.median, 's')} of ${eng(c.tw, 's')}`, note: 'Illustrative values; nothing about timing is decided.' }),
  phase: (c) => ({ title: 'Worst phase error of the delay step', rows: [[`${v('φ', 'max')} = 360° ${v('f', '0')} ${frac(v('Δτ'), '2')}`, `360° × ${eng(c.P.f0, 'Hz')} × ${eng(c.P.delayStep / 2, 's')}`]], res: `${num(c.phaseErr, 1)}°`, note: 'Rounding to the nearest step is off by at most half a step.' }),
};


export function formulaHtml(id, ctx) {
  const f = FORMULAS[id];
  if (!f) return null;
  const e = f(ctx);
  return `<div class="pop-h"><b>${e.title}</b><button class="pop-x" aria-label="close">×</button></div>
    ${e.rows.map(([sym, numeric]) => `<div class="eqline">${sym}</div><div class="eqnum">= ${numeric}</div>`).join('')}
    <div class="eqres">= ${e.res}</div>${e.note ? `<p class="pop-n">${e.note}</p>` : ''}`;
}
