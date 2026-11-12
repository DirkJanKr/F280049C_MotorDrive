// Matching of a binary CDAC and the 3 sigma rule, for four ways to build the same 10 bits.
//   polarity: every capacitor is connected parallel or antiparallel (charge sharing), so one
//             capacitor covers twice the codes of a capacitor that is only switched on or off.
//   halving:  the last 3 bits come from charge halving (multi-step LSB precharge, Rabuske 2017 p. 41), not from more capacitors.
// The array is written as bits with code weights W_i = 2^(B-i). A bit made of u unit capacitors
// has a relative error sigma_u / sqrt(u); a halving bit sigma_u / sqrt(2); the last comparison
// of the polarity scheme has no capacitor and no error.
//   codes per unit       k = 2^B / M              (M = number of unit capacitors)
//   mid-scale code step  sigma = k * sigma_u * sqrt(M - 1)  ~  2^B * sigma_u / sqrt(M)
//   with sigma_u = A_C / sqrt(C_u):  sigma ~ 2^B * A_C / sqrt(M * C_u) = 2^B * A_C / sqrt(C_DAC)

export function matchingArray({ bits = 10, halving = true, polarity = true, halvingBits = 3 }) {
  const capBits = bits - (halving ? halvingBits : 0) - (polarity ? 1 : 0);
  const M = 2 ** capBits;
  const k = 2 ** bits / M;
  const list = [];
  for (let i = 1; i <= bits; i++) {
    const W = 2 ** (bits - i);
    if (i <= capBits) list.push({ W, kind: 'cap', units: W / k });
    else if (halving && i <= capBits + halvingBits) list.push({ W, kind: 'half', units: 0 });
    else list.push({ W, kind: 'final', units: 0 });
  }
  return { bits, M, k, list, halving, polarity };
}

/** Relative 1 sigma error of one bit weight. */
export function bitSigma(b, sigmaU) {
  return b.kind === 'cap' ? sigmaU / Math.sqrt(b.units) : b.kind === 'half' ? sigmaU / Math.SQRT2 : 0;
}

/** 1 sigma of the mid-scale code step in LSB (all bits change), from the formula. */
export function midSigma(arr, sigmaU) {
  return Math.sqrt(arr.list.reduce((a, b) => a + (b.W * bitSigma(b, sigmaU)) ** 2, 0));
}

/** Unit capacitor and total for 3 sigma < limit LSB. aC: matching of one capacitor in fraction * sqrt(fF). */
export function requiredCu(arr, aC, limit = 0.5, nSigma = 3) {
  const perSigmaU = midSigma(arr, 1);
  const sigmaU = limit / (nSigma * perSigmaU);
  const cu = (aC / sigmaU) ** 2 * 1e-15;
  return { sigmaU, cu, total: cu * arr.M };
}

/** Monte Carlo: chips with random bit weights. Returns the mid-scale DNL of each chip and the worst DNL over all codes. */
export function matchingMonteCarlo(arr, sigmaU, chips, rng) {
  const n = arr.list.length;
  const codes = 2 ** arr.bits;
  const mid = new Float64Array(chips);
  const worst = new Float64Array(chips);
  const W = new Float64Array(n);
  for (let c = 0; c < chips; c++) {
    for (let i = 0; i < n; i++) W[i] = arr.list[i].W * (1 + bitSigma(arr.list[i], sigmaU) * rng.gaussian());
    let prev = 0;
    let w = 0;
    for (let code = 1; code < codes; code++) {
      let lv = 0;
      for (let i = 0; i < n; i++) if ((code >> (n - 1 - i)) & 1) lv += W[i];
      const dnl = lv - prev - 1;
      if (Math.abs(dnl) > w) w = Math.abs(dnl);
      if (code === codes / 2) mid[c] = dnl;
      prev = lv;
    }
    worst[c] = w;
  }
  return { mid, worst };
}
