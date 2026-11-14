// Click a value to see where it comes from: the formula with symbols, the same
// formula with the current numbers, and the result. One entry per value id.

import { v, t, frac, sqrt, sup, paren } from '../zaan/ui/math.js';
import { eng, num, fq } from './kit.js';
import { NAME } from './names.js';
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

function budgetRow(c, id) {
  const l = line(id, c);
  const other = c.ui && c.ui.qUnit === 'V' ? eng(l.sigma, 'C') : `${eng(l.sigma / c.d.cTh, 'V')} at the input`;
  return `${fq(c, l.sigma, true)} = ${num(l.lsb, 3)} LSB (${other}); ${num(l.share, 1)} % of the allowed noise power`;
}

export const FORMULAS = {
  qlsb: (c) => ({
    title: 'Charge of one LSB',
    rows: [[`${QL} = ${frac(`${NCH} ${CM} ${v('V', 'in,max')}`, sup('2', v('B')))}`, frac(`${c.P.channels} × ${eng(c.d.cm, 'F')} × ${eng(c.P.fullScale, 'V')}`, sup('2', c.P.bits))]],
    res: `${eng(c.d.qLsb, 'C')}, which is ${eng(c.d.qLsb / c.d.cTh, 'V')} at the input`,
    note: `D, from the charge balance of Chen 2018, eq. 3 (p. 3056). Charge is Q+ − Q−, the difference between the two summing nodes. It equals 2 V REF C u / n u = 2 × ${eng(c.P.vref, 'V')} × ${eng(c.P.cu, 'F')} / ${c.P.lsbPerUnit}.`,
  }),
  qfs: (c) => ({
    title: 'Charge of the full scale',
    rows: [[`${v('Q', 'FS')} = ${NCH} ${CM} ${v('V', 'in,max')}`, `${c.P.channels} × ${eng(c.d.cm, 'F')} × ${eng(c.P.fullScale, 'V')}`]],
    res: eng(c.d.qFs, 'C'),
    note: 'D. Peak-to-peak differential input charge, Q+ − Q−. Every noise source is referred to this charge. Rabuske 2017, eq. 4.21 (p. 72 to 73) uses half of it, (C TH / 2) V.',
  }),
  cm: (c) => ({
    title: 'Memory capacitor C M',
    rows: [[`${NCH} ${v('V', 'in,max')} ${CM} = 4 ${VREF} ${v('C', 'DAC')}`, `${c.P.channels} × ${eng(c.P.fullScale, 'V')} × ${eng(c.d.cm, 'F')} = 4 × ${eng(c.P.vref, 'V')} × ${eng(c.P.cdacBalance, 'F')}`]],
    res: `${eng(c.d.cm, 'F')} (input, status A)`,
    note: 'C M is an input of the charge balance (Chen 2018, eq. 3, p. 3056); V REF and C DAC follow from it and from alpha. Chen uses 133 fF; that is not a Zaan value.',
  }),
  vref: (c) => ({
    title: 'Reference voltage V REF',
    rows: [[`${VREF} = ${frac(`${v('α')} ${v('V', 'in,max')}`, '2')}`, frac(`${num(c.P.alphaIn, 3)} × ${eng(c.P.fullScale, 'V')}`, '2')]],
    res: eng(c.P.vref, 'V'),
    note: `D, from Chen eq. 3 with alpha = C TH / (2 C DAC) (Rabuske 2017, eq. 4.58, p. 89): alpha = 2 V REF / V in,max. The alpha here is the ${NAME.alphaIn}.`,
  }),
  cu: (c) => ({
    title: 'Unit capacitor C u',
    rows: [[`${CU} = ${frac(`${v('n', 'u')} ${QL}`, `2 ${VREF}`)} = ${frac(`${v('n', 'u')} ${NCH} ${CM}`, `${sup('2', v('B'))} ${v('α')}`)}`, frac(`${c.P.lsbPerUnit} × ${c.P.channels} × ${eng(c.d.cm, 'F')}`, `${sup('2', c.P.bits)} × ${num(c.P.alphaIn, 3)}`)]],
    res: eng(c.P.cu, 'F'),
    note: `D. One unit capacitor precharged to V REF moves 2 V REF C u, which is n u LSB. The alpha here is the ${NAME.alphaIn}. The PDK minimum for the MIM device is ${eng(c.P.cuMin, 'F')}.`,
  }),
  cdac: (c) => ({
    title: NAME.cdacBalance,
    rows: [[`${v('C', 'DAC')} = ${frac(`${NCH} ${CM}`, `2 ${v('α')}`)}`, frac(`${c.P.channels} × ${eng(c.d.cm, 'F')}`, `2 × ${num(c.P.alphaIn, 3)}`)]],
    res: `${eng(c.P.cdacBalance, 'F')}, ${NAME.cdacBalance}`,
    note: `D, Chen eq. 3 with the ${NAME.alphaIn}. ${NAME.cdacEff}: ${eng(c.d.cdacEff, 'F')} (${num(c.d.sumW / c.P.lsbPerUnit, 2)} units). ${NAME.cdac}: ${eng(c.d.cdac, 'F')} (${num(c.d.units, 2)} units; the halving capacitors start empty).`,
  }),
  cnode: (c) => {
    const n = c.d.decisions;
    return {
      title: NAME.cnodeW,
      rows: [[`${v('C', 'node,i')} = ${NCH} ${CM} + ${v('C', 'par')} + ${t('Σ')}<sub>j&lt;i</sub> 2 ${v('C', 'j')}`, `${c.P.channels} × ${eng(c.d.cm, 'F')} + ${eng(c.P.cpar, 'F')} + ${eng(c.d.cNode[n - 1] - c.d.cNode[0], 'F')}`]],
      res: eng(c.d.cNode[n - 1], 'F'),
      note: `Starts at ${eng(c.d.cNode[0], 'F')} (the ${c.P.channels} cells and the node parasitic) and grows with every shared pair. The same comparator voltage is ${num(c.d.cNode[n - 1] / c.d.cNode[0], 2)} × more charge at the end than at the start. Each halving step adds a whole unit capacitor, so this is larger than the ideal binary value C TH (1 + 1 / alpha) of Rabuske 2017, eq. 4.52.`,
    };
  },
  lsbend: (c) => {
    const cl = c.d.cNode[c.d.decisions - 1];
    return { title: 'One LSB at the comparator, last decision', rows: [[`${v('V', 'LSB')} = ${frac(QL, v('C', 'node,last'))}`, frac(eng(c.d.qLsb, 'C'), eng(cl, 'F'))]], res: eng(c.d.qLsb / cl, 'V'), note: `Comparator offset and noise must be compared with this, not with the ${eng(c.P.fullScale, 'V')} / ${c.d.codes} LSB at the input.` };
  },
  allowed: (c) => ({
    title: 'Charge noise allowed for the ENOB aim',
    rows: [[`${v('σ', 'Q,max')} = ${frac(`${v('Q', 'FS')} / ${paren(`2${sqrt('2')}`)}`, `${sup('10', paren(`6.02 ${t('ENOB')} + 1.76`) + ' / 20')}`)}`, frac(`${eng(c.d.qFs, 'C')} / 2.83`, sup('10', `${num((6.02 * c.P.enobAim + 1.76) / 20, 3)}`))]],
    res: `${fq(c, c.budget.allowed, true)} = ${num(c.budget.allowed / c.d.qLsb, 3)} LSB`,
    note: `For a full-scale sine. Ideal ${c.P.bits}-bit quantisation alone is ${QL} / √12 = 0.289 LSB, ${num(((1 / 12) / (c.budget.allowed / c.d.qLsb) ** 2) * 100, 0)} % of this power at ENOB ${num(c.P.enobAim, 1)}.`,
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
  'b-sar': (c) => ({ title: 'Quantisation by the SAR levels', rows: [[`${v('σ', 'sar')} ≈ ${frac(v('w', 'min'), sqrt('12'))}`, frac(`${num(Math.min(...c.d.weights), 3)} LSB`, '3.46')]], res: budgetRow(c, 'sar'), note: `The levels the SAR can make are spaced by its smallest step, ${num(Math.min(...c.d.weights), 3)} LSB; with mismatch they are not exactly uniform. Simulated on ${c.sim && c.res ? c.res.enob.length : 4} chips with perfect weights and no rounding (the formula is the estimate for uniform levels).` }),
  'b-round': (c) => ({ title: `Rounding to ${Math.round(c.P.outBits)} output bits`, rows: [[`${sup(v('σ', 'round'), 2)} = ${sup(v('σ', 'rounded'), 2)} − ${sup(v('σ', 'sar'), 2)}`, `≈ ${frac(`${sup(v('LSB', 'out'), 2)}`, '12')}, ${v('LSB', 'out')} = ${num(2 ** -Math.max(0, Math.round(c.P.outBits - c.P.bits)), 3)} LSB`]], res: budgetRow(c, 'round'), note: 'With mismatch the calibrated levels lie between output codes. Rounding them to the output bits adds a second quantisation on top of the first. With the output LSB equal to the smallest step this almost doubles the quantisation power; two more output bits remove most of it. Simulated: same chips and weights, rounded minus not rounded.' }),
  'b-lut': (c) => ({ title: 'Weight error of the LUT', rows: [[`${sup(v('σ', 'LUT'), 2)} = ${sup(v('σ', 'with LUT weights'), 2)} − ${sup(v('σ', 'with perfect weights'), 2)}`, `${c.P.calMethod}`]], res: budgetRow(c, 'lut'), note: 'How much worse the chosen calibration is than perfectly known weights. Measured externally (LMS or least squares on a laptop with long averaging) the LUT is practically exact, so this line is zero. On-chip least squares on a ramp with 2 samples per code, or on-chip LMS with comparator noise, leave a small error.' }),
  'b-quant': (c) => (!line('quant', c) ? null : { title: 'Quantisation, rounding and LUT error together', rows: [[`${v('σ')} = ${sqrt(`${sup(v('σ', 'sar'), 2)} + ${sup(v('σ', 'round'), 2)} + ${sup(v('σ', 'LUT'), 2)}`)}`, `${num(line('quant', c).lsb, 3)} LSB`]], res: budgetRow(c, 'quant'), note: 'Switch the split on in the budget to see the three parts.' }),
  'b-samp': (c) => ({
    title: 'kT/C of the memory cells as charge',
    rows: c.budget.arrayGain
      ? [[`${v('σ', 'Q,M')} = ${sqrt(`${NCH} · 2 ${kT} ${CM}`)}`, sqrt(`${c.P.channels} × 2 × ${eng(1.381e-23 * c.P.temperature, 'J')} × ${eng(c.d.cm, 'F')}`)]]
      : [[`${v('σ', 'Q,M')} = ${NCH} ${sqrt(`2 ${kT} ${CM}`)}`, `${c.P.channels} × ${sqrt(`2 × ${eng(1.381e-23 * c.P.temperature, 'J')} × ${eng(c.d.cm, 'F')}`)}`]],
    res: budgetRow(c, 'samp'),
    note: c.budget.arrayGain
      ? `Each channel has a cell CM on node + and one on node −; each keeps a random charge with variance kT CM when its write switch opens, independent of the other side, so the differential charge of one channel has variance 2 kT CM. The ${c.P.channels} cells are independent, so the charges add in power (√N) while the aligned signal adds in amplitude (N): the beamformer gain of 10 log10 N = ${num(c.budget.arrayGainDb, 1)} dB.`
      : `Beamformer gain off: the cell noise is counted as if it added like the signal (N times), a worst case ${num(c.budget.arrayGainDb, 1)} dB higher in power.`,
  }),
  'b-pre': (c) => {
    const halves = c.d.steps.filter((x) => x.kind === 'half').length;
    return {
      title: 'CDAC precharge kT/C as charge',
      rows: [[`${v('σ', 'Q,pre')} = ${sqrt(`4 ${kT} ${v('C', 'DAC')} + ${v('n', '½')} · 4 ${kT} ${frac(CU, '2')}`)}, ${v('C', 'DAC')}: ${NAME.cdac}`, sqrt(`4 × ${eng(1.381e-23 * c.P.temperature, 'J')} × ${eng(c.d.cdac, 'F')} + ${halves} × 4 × ${eng(1.381e-23 * c.P.temperature, 'J')} × ${eng(c.P.cu / 2, 'F')}`)]],
      res: budgetRow(c, 'pre'),
      note: 'Each step is one floating capacitor C between node + and node −. When its precharge switches open it keeps a random plate charge with variance kT C. That charge enters node + and node − with opposite sign, so the differential charge sees twice it: variance 4 kT C. Every step is shared once, so all of the CDAC counts. A halving step also opens the switch between its two halves (series capacitance Cu / 2).',
    };
  },
  'b-comp': (c) => {
    const cl = c.d.cNode[c.d.decisions - 1];
    return { title: 'Comparator noise as charge', rows: [[`${v('σ', 'Q,cmp')} = ${v('C', 'node,last')} ${v('v', 'n')}`, `${eng(cl, 'F')} × ${eng(c.P.compNoise, 'V')}`]], res: budgetRow(c, 'comp'), note: `C node,last is the ${NAME.cnodeW}. A voltage noise v n at the comparator is the charge C node · v n on the node. C node includes the parasitic capacitance of the summing node (now ${eng(c.P.cpar, 'F')}). The budget counts the full σ² of the last decision. Simulated (error power with noise minus without): 0.197 LSB against 0.197 LSB for the default weights and 0.182 against 0.183 LSB for binary weights.` };
  },
  'b-slot': (c) => ({ title: 'Read-slot gain variation', rows: [[`${v('σ', 'G')} = ${frac(`σ(${v('C', 'M')})`, sqrt('2N'))}`, `${num(c.P.aC / Math.sqrt(c.d.cm * 1e15), 2)} % / √(2 × ${c.P.channels}) = ${num(c.P.aC / Math.sqrt(c.d.cm * 1e15) / Math.sqrt(2 * c.P.channels), 3)} %`], [`${v('σ', 'Q')} = ${v('σ', 'G')} · ${frac(v('Q', 'FS'), `2${sqrt('2')}`)}`, 'for a full-scale sine']], res: budgetRow(c, 'slot'), note: `Each read slot adds another set of N memory cells on node + and N on node −, so the sampling capacitance, and with it the gain, differs a little from sample to sample (Rabuske 2017, eq. 4.42: gain error = −ΔC / (C TH + ΔC)). The two sides are drawn independently; only their common part changes the gain (eq. 4.38), so the gain averages over 2N cells. The difference between the sides is second order (eq. 4.30, 4.33). It repeats every ${c.P.memCells} samples, is proportional to the signal, and can be removed with one digital gain per slot. Counted as zero while "Gain of each read slot" is set to calibrated.` }),
  'b-tint': (c) => ({ title: 'Jitter on the precharge time', rows: [[`${v('σ', 'Q')} = ${frac(v('σ', 't'), v('T', 'int'))} · ${frac(v('Q', 'FS'), `2${sqrt('2')}`)}`, `${frac(eng(c.P.jitter, 's'), eng(c.P.tIntShare / c.P.fs, 's'))} × ${eng(c.d.qFs / 2 / Math.SQRT2, 'C')}`], [`${v('T', 'int')} = ${v('k', 'int')} / ${v('f', 's')}`, `${num(c.P.tIntShare, 2)} / ${eng(c.P.fs, 'Hz')}`]], res: budgetRow(c, 'tint'), note: 'Chen 2018, p. 3056: the CDAC is charged by a current for T int, so a timing error scales the whole reference charge. The error is proportional to the signal; the value is for a full-scale sine. k int is the T int share of the clock period (Chen: 3/4). The same clock jitter value as for sampling is used (assumption).' }),
  'b-jit': (c) => {
    const f = c.P.f0 * (1 + c.P.fbw / 2);
    return { title: 'Sampling clock jitter as charge', rows: [[`${v('σ', 'Q,j')} = ${NCH} ${CM} · 2π ${v('f', 'max')} ${v('σ', 't')} ${v('V', 'rms')}`, `${eng(c.P.channels * c.d.cm, 'F')} × 2π × ${eng(f, 'Hz')} × ${eng(c.P.jitter, 's')} × ${eng(c.vrms, 'V')}`]], res: budgetRow(c, 'jit'), note: `A full-scale sine at the band edge f0 (1 + bw / 2) changes fastest; a timing error σt gives a voltage error 2π f σt V rms. Counted as if all channels jitter together (worst case: the ${c.P.channels} errors add like the signal).` };
  },
  gain: (c) => ({ title: 'Beamformer gain on channel noise', rows: [[`${v('G')} = 10 log<sub>10</sub> ${NCH}`, `10 log<sub>10</sub> ${c.P.channels}`]], res: `${num(c.budget.arrayGainDb, 2)} dB`, note: 'Signal from N aligned channels adds as N, independent noise as √N. Only noise that is independent per channel gets this; here that is the kT/C of the memory cells.' }),
  tol: (c) => ({ title: 'Tolerance of decision 1', rows: [[`${v('t', 'i')} = ${t('Σ')}<sub>j&gt;i</sub> ${v('w', 'j')} + ${v('w', 'last')} − ${v('w', 'i')}`, `${num(c.d.weights.slice(1).reduce((a, w) => a + w, 0), 2)} + ${num(c.d.weights[c.d.weights.length - 1], 2)} − ${num(c.d.weights[0], 2)}`]], res: `${num(c.d.tol[0], 2)} LSB`, note: 'How far the level after this decision may be wrong and still be reached by the later steps. After the last step the residue must lie within ± w last.' }),
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
  cover: (c) => ({ title: 'Coverage of the range', rows: [[`${t('Σ')} ${v('w', 'i')} + ${v('w', 'last')} ≥ ${sup('2', `${v('B')} − 1`)}`, `${num(c.d.cover.sum, 1)} + ${num(c.d.weights[c.d.weights.length - 1], 2)} ≥ ${2 ** (c.P.bits - 1)}`]], res: c.d.cover.ok ? `met, overrange ${num(c.d.cover.overrange * 100, 1)} %` : 'not met', note: 'From mid-scale the steps must reach either end of the input range. What they reach beyond it is overrange, which redundancy brings by itself.' }),
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
  let e;
  try {
    e = f(ctx);
  } catch {
    return null;
  }
  if (!e) return null;
  return `<div class="pop-h"><b>${e.title}</b><button class="pop-x" aria-label="close">×</button></div>
    ${e.rows.map(([sym, numeric]) => `<div class="eqline">${sym}</div><div class="eqnum">= ${numeric}</div>`).join('')}
    <div class="eqres">= ${e.res}</div>${e.note ? `<p class="pop-n">${e.note}</p>` : ''}`;
}
