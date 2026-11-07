// Noise budget (addendum 8.1). All noise values in V rms, referred to the
// differential ADC input. Uncorrelated lines add as a root sum of squares.

export const NOISE_LINES = [
  { id: 'quant', label: 'Quantisation', block: 'CDAC', fixed: true },
  { id: 'ktc', label: 'kT/C sampling noise', block: 'Sampling switch' },
  { id: 'compNoise', label: 'Comparator noise', block: 'Comparator' },
  { id: 'compOffset', label: 'Comparator offset after calibration', block: 'Comparator' },
  { id: 'mismatch', label: 'CDAC mismatch after calibration', block: 'CDAC' },
  { id: 'jitter', label: 'Clock jitter', block: 'Sampling switch' },
  { id: 'refCharge', label: 'Reference charge error', block: 'Reference' },
];

/** Default shares of the noise power left after quantisation (status A). 10 % is kept as reserve. */
export const DEFAULT_SHARES = { ktc: 15, compNoise: 15, compOffset: 15, mismatch: 15, jitter: 15, refCharge: 15 };

/** rms of a full-scale sine: full scale is peak to peak, so V rms = FS / 2 / sqrt(2). */
export function signalRms(fullScale) {
  return fullScale / 2 / Math.SQRT2;
}

/** LSB = FS / 2^N */
export function lsbVolts(fullScale, bits) {
  return fullScale / 2 ** bits;
}

/** Ideal quantisation noise = LSB / sqrt(12) */
export function quantNoise(lsb) {
  return lsb / Math.sqrt(12);
}

/** sigma total = sqrt(sigma1^2 + sigma2^2 + ...) */
export function rss(values) {
  return Math.sqrt(values.reduce((s, v) => s + v * v, 0));
}

/** SNDR = 20 log10(V signal rms / sigma total), in dB */
export function sndrDb(vSig, sigma) {
  return 20 * Math.log10(vSig / sigma);
}

/** ENOB = (SNDR - 1.76 dB) / 6.02 dB */
export function enobFromSndr(sndr) {
  return (sndr - 1.76) / 6.02;
}

/** Total noise that gives exactly this ENOB for a full-scale sine. */
export function noiseForEnob(vSig, enob) {
  return vSig / 10 ** ((6.02 * enob + 1.76) / 20);
}

/**
 * Top-down allocation. Noise power left for the non-quantisation lines:
 *   sigma left^2 = sigma target^2 - sigma quant^2
 * each line gets sigma i = sqrt(share i / 100) x sigma left.
 */
export function allocateNoise({ vSig, quant, targetEnob, shares }) {
  const target = noiseForEnob(vSig, targetEnob);
  const leftPower = target * target - quant * quant;
  const left = leftPower > 0 ? Math.sqrt(leftPower) : 0;
  const lines = { quant };
  let shareSum = 0;
  for (const line of NOISE_LINES) {
    if (line.fixed) continue;
    const share = shares[line.id] ?? 0;
    shareSum += share;
    lines[line.id] = Math.sqrt(Math.max(0, share) / 100) * left;
  }
  return { target, left, lines, shareSum, feasible: leftPower > 0 };
}

/** Total noise and ENOB with the lines of blocks at source level "ideal" left out. */
export function evaluateNoise({ vSig, lines, included }) {
  const rows = NOISE_LINES.map((line) => {
    const on = line.fixed || included(line.block);
    return { ...line, sigma: lines[line.id] ?? 0, included: on };
  });
  const total = rss(rows.filter((r) => r.included).map((r) => r.sigma));
  const sndr = sndrDb(vSig, total);
  return { rows, total, sndr, enob: enobFromSndr(sndr) };
}
