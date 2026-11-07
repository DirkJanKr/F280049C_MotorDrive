// Conflicts panel. Every number is recomputed from the registry, so the
// panel follows edits. Nothing here is resolved; each item lists its branches.

import { si } from './params.js';
import { dacToSampleRatio } from './specSheets.js';
import { decisionTime } from './timingBudget.js';

const f = (v, d = 3) => Number(v.toFixed(d)).toString();

export function buildConflicts(reg) {
  const fsV = si(reg, 'fullScale');
  const q = (enob) => fsV / 2 ** enob / Math.sqrt(12);
  const side = si(reg, 'mimSide') * 1e6; // um
  const density = si(reg, 'capDensity') * 1e3; // fF/um2
  const mimArea = side * side * density; // fF
  const mimPdk = si(reg, 'mimMin') * 1e15;
  const radix = si(reg, 'radix');
  const bits = si(reg, 'bits');
  const needed = Math.log(2 ** bits) / Math.log(radix);
  const pitch = si(reg, 'pitch');
  const aperture = (si(reg, 'elements') - 1) * pitch;
  const theta = si(reg, 'steer');
  const c = si(reg, 'c');
  const delay = (aperture * Math.sin(theta)) / c;
  const tw = 1 / si(reg, 'fs');
  const ratio = dacToSampleRatio(reg);
  const cs = si(reg, 'channels') * si(reg, 'cmExample');
  const cdac = ratio * cs;
  const qref = cdac * si(reg, 'vref');
  const tConv = 1 / si(reg, 'fs');
  const n = si(reg, 'rawDecisions');
  const tDec = decisionTime({ tConv, tSample: si(reg, 'tSample'), tLogic: si(reg, 'tLogic'), n });

  return [
    {
      id: '1', title: 'ENOB versus quantisation noise', status: 'U',
      lines: [
        `ENOB 10:  ${f(fsV)} V / 2^10 / sqrt(12) = ${f(q(10) * 1e6, 1)} uV rms`,
        `ENOB 9.5: ${f(fsV)} V / 2^9.5 / sqrt(12) = ${f(q(9.5) * 1e6, 1)} uV rms`,
        `ENOB 9:   ${f(fsV)} V / 2^9 / sqrt(12) = ${f(q(9) * 1e6, 1)} uV rms`,
        `13 Oct chain uses ${f(si(reg, 'adcQuantNoise') * 1e6, 0)} uV rms, which is the ENOB 10 value, while the chain was built on ENOB 9.`,
      ],
      branches: ['Choose the basis below; phase 4 recomputes the chain with it.'],
      chooser: true,
    },
    {
      id: '2', title: 'Minimum MIM value', status: 'S*',
      lines: [
        `Area x density: ${f(side, 2)} um x ${f(side, 2)} um x ${f(density, 2)} fF/um2 = ${f(mimArea, 2)} fF`,
        `PDK: ${f(mimPdk, 2)} fF. Difference ${f(mimPdk - mimArea, 2)} fF = ${f(((mimPdk - mimArea) / mimArea) * 100, 1)} %.`,
      ],
      branches: [
        `Use ${f(mimArea, 1)} fF (density only): consistent with "use 2 fF/um2 in all calculations", underestimates small caps if the PDK is right.`,
        `Use ${f(mimPdk, 1)} fF (PDK): includes the suspected fringe or perimeter part (not confirmed); then density alone is wrong for small caps.`,
      ],
    },
    {
      id: '3', title: 'Raw decisions', status: 'U',
      lines: [
        `Pure radix ${f(radix, 2)}: ln(2^${bits}) / ln(${f(radix, 2)}) = ${f(Math.log(2 ** bits), 3)} / ${f(Math.log(radix), 3)} = ${f(needed, 2)}, so ${Math.ceil(needed)} decisions.`,
        `Registry: ${n} raw decisions, ${n - Math.ceil(needed)} more than a pure radix ${f(radix, 2)} array needs.`,
        'Phase 2 computes the count from the actual weights (charge-halving LSBs and per-step radix change it).',
      ],
      branches: [
        `${Math.ceil(needed)} decisions: less time per decision, less redundancy margin.`,
        `${n} decisions: more redundancy, ${n - Math.ceil(needed)} extra decision times inside 25 ns.`,
      ],
    },
    {
      id: '4', title: 'Memory capacitors versus delay step', status: 'U',
      lines: [
        `Aperture D = (elements - 1) x pitch = ${si(reg, 'elements') - 1} x ${f(pitch * 1e6, 0)} um = ${f(aperture * 1e3, 2)} mm`,
        `Delay = D sin(theta) / c = ${f(aperture, 4)} m x ${f(Math.sin(theta), 4)} / ${f(c, 0)} m/s = ${f(delay * 1e9, 1)} ns`,
        `At a write period of ${f(tw * 1e9, 1)} ns: ${f(delay * 1e9, 1)} / ${f(tw * 1e9, 1)} = ${f(delay / tw, 1)} periods; at 12.5 ns: ${f(delay / 12.5e-9, 1)} steps.`,
        `${si(reg, 'memCaps')} memory capacitors per channel fit the ${f(tw * 1e9, 1)} ns case.`,
      ],
      branches: [
        '25 ns step: fits 22 capacitors, sidelobes flagged by Yahua.',
        '12.5 ns step at the same write clock: needs a mechanism not known yet (Hopf paper), or about twice the capacitors.',
      ],
    },
    {
      id: 'F5', title: 'V REF versus full scale (derived, please confirm)', status: 'D',
      lines: [
        'Balance after all sharing steps: sum(plus/minus Cdac,i x V REF) = Cs x Vin, so Vin,max = V REF x sum Cdac / Cs.',
        `sum Cdac / Cs = (FS / 2) / V REF = ${f(fsV / 2, 3)} V / ${f(si(reg, 'vref'), 3)} V = ${f(ratio, 2)} (V / V)`,
        `Example (A): Cs = ${si(reg, 'channels')} x ${f(si(reg, 'cmExample') * 1e15, 1)} fF = ${f(cs * 1e15, 0)} fF, so sum Cdac = ${f(cdac * 1e15, 0)} fF, before redundancy.`,
        `Comparator sees the input scaled by 1 / (1 + ${f(ratio, 2)}) = ${f(1 / (1 + ratio), 3)} at the end of conversion.`,
      ],
      branches: ['Single-ended view with the one-flipped-capacitor assumption (A). Phase 2 computes it from the real topology.'],
    },
    {
      id: 'F6', title: 'Reference still supplies charge (derived)', status: 'D',
      lines: [
        `Q per conversion = sum Cdac x V REF = ${f(cdac * 1e12, 3)} pF x ${f(si(reg, 'vref'), 3)} V = ${f(qref * 1e15, 0)} fC`,
        `Average current I = Q x fs = ${f(qref * 1e15, 0)} fC x ${f(si(reg, 'fs') / 1e6, 0)} MS/s = ${f(qref * si(reg, 'fs') * 1e6, 2)} uA (C/s = A)`,
        'Drawn during precharge, not as spikes at each decision.',
      ],
      branches: ['Whether this meets the shared-reference constraint depends on reference generation (open item).'],
    },
    {
      id: 'F7', title: 'Time per decision (derived, Ts unknown)', status: 'D',
      lines: [
        `tdec = (Tconv - Ts - n x tlogic) / n = (${f(tConv * 1e9, 2)} ns - ${f(si(reg, 'tSample') * 1e9, 2)} ns - ${n} x ${f(si(reg, 'tLogic') * 1e9, 2)} ns) / ${n} = ${f(tDec * 1e9, 3)} ns`,
        'Ts and tlogic have status ?. See the sweep in the budget module.',
      ],
      branches: ['Phase 3 compares this against the metastability decision time.'],
    },
    {
      id: 'F8', title: 'A constant comparator offset does not lower SNDR', status: 'D',
      lines: [
        'A constant offset shifts every code transition by the same voltage. In the FFT it lands in the DC bin, which SNDR excludes.',
        'It costs input range instead: offset / full scale of the range is lost at one end.',
        'Only offset that changes during operation (temperature, common mode, per conversion) acts as noise.',
      ],
      branches: [
        'Keep the line in the noise budget: conservative, takes budget from other blocks.',
        'Set its share to 0 and track offset as a range loss: more budget for the others.',
      ],
    },
  ];
}
