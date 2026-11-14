// Circuit-level check of the charge-sharing step (Rabuske 2017, Fig. 3.7 and eq. 4.21).
// Two sampling capacitors C_TH (node p and node n to ground) hold the input. DAC capacitor j is
// precharged to V_PC between its own two plates and, at time t_j, connected across p and n through
// switches with on-resistance R_on: parallel (adds charge) or antiparallel (subtracts it).
// Ideal switches here; transistor switches need the PDK models (see README).

/**
 * steps: [{ c, sign }] with sign +1 = parallel, -1 = antiparallel, in connection order.
 * Returns { netlist, tran, tStep } where step j closes at (j + 1) * tStep.
 */
export function chargeShareNetlist({ cTh, vinP, vinN, vpc, steps, ron = 200, tStep = 2e-9 }) {
  const L = [];
  L.push(`Cthp p 0 ${cTh} ic=${vinP}`, `Cthn n 0 ${cTh} ic=${vinN}`);
  L.push('.model sw sw vt=0.5 vh=0.05 ron=' + ron + ' roff=1e12');
  steps.forEach((s, j) => {
    const t = (j + 1) * tStep;
    // plates a (charged to +V_PC against b); keep them referenced to ground through very large resistors
    L.push(`Cd${j} a${j} b${j} ${s.c} ic=${vpc}`, `Ra${j} a${j} 0 1e15`, `Rb${j} b${j} 0 1e15`);
    L.push(`Vg${j} g${j} 0 pulse(0 1 ${t} 10p 10p 1 2)`);
    const [toA, toB] = s.sign > 0 ? ['p', 'n'] : ['n', 'p'];
    // a step may bring its own switch resistance (switches scaled with the capacitor)
    const m = s.ron ? `sw${j}` : 'sw';
    if (s.ron) L.push(`.model ${m} sw vt=0.5 vh=0.05 ron=${s.ron} roff=1e12`);
    L.push(`S${j}a a${j} ${toA} g${j} 0 ${m}`, `S${j}b b${j} ${toB} g${j} 0 ${m}`);
  });
  const tEnd = (steps.length + 1) * tStep;
  return { netlist: L.join('\n'), tran: `tran ${tStep / 2000} ${tEnd} uic`, tStep };
}

/** Rabuske 2017, eq. 4.21: differential voltage after the first i steps (ideal, no parasitics). */
export function rabuske421({ cTh, vinP, vinN, vpc, steps }, i) {
  let num = (cTh / 2) * (vinP - vinN);
  let den = cTh / 2;
  for (let j = 0; j < i; j++) {
    num += steps[j].sign * steps[j].c * vpc;
    den += steps[j].c;
  }
  return num / den;
}
