// Noise terms of the charge-sharing converter (review slide 25). k = 1.381e-23 J/K.

export const K_B = 1.381e-23;

/** kT/C of the N memory cells read together (differential): sqrt(2 k T / (N CM)), in V rms at the input. */
export function samplingNoise(P, d) {
  return Math.sqrt((2 * K_B * P.temperature) / (P.channels * d.cm));
}

/** CDAC precharge noise: charge sqrt(2 k T C_DAC), referred to the input through one LSB. */
export function prechargeNoise(P, d) {
  const q = Math.sqrt(2 * K_B * P.temperature * d.cdac);
  const lsbV = P.fullScale / d.codes;
  return { charge: q, lsb: q / d.qLsb, volts: (q / d.qLsb) * lsbV };
}

/** Comparator noise referred to the input at decision i: vn x Cnode_i / qLsb LSB. */
export function comparatorNoiseAt(P, d, i) {
  return ((P.compNoise * d.cNode[i]) / d.qLsb) * (P.fullScale / d.codes);
}

/** Jitter noise for a full-scale sine at the band edge f0 (1 + fbw / 2). */
export function jitterNoise(P) {
  const f = P.f0 * (1 + P.fbw / 2);
  const vrms = P.fullScale / 2 / Math.SQRT2;
  return { f, volts: 2 * Math.PI * f * P.jitter * vrms };
}

export function quantNoise(P) {
  return P.fullScale / 2 ** P.bits / Math.sqrt(12);
}

/** Total noise from rms parts and the resulting ENOB for a full-scale sine. */
export function enobOf(P, sigma) {
  const vrms = P.fullScale / 2 / Math.SQRT2;
  const sndr = 20 * Math.log10(vrms / sigma);
  return { sndr, enob: (sndr - 1.76) / 6.02 };
}

export function noiseForEnob(P, enob) {
  const vrms = P.fullScale / 2 / Math.SQRT2;
  return vrms / 10 ** ((6.02 * enob + 1.76) / 20);
}
