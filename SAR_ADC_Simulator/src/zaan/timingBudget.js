// Timing budget (addendum 8.1). All times in seconds.

/** Conversion period Tconv = 1 / fs */
export function conversionPeriod(fs) {
  return 1 / fs;
}

/** Average time per decision: tdec = (Tconv - Ts - n x tlogic) / n */
export function decisionTime({ tConv, tSample, tLogic, n }) {
  return (tConv - tSample - n * tLogic) / n;
}

/** The timing lines with an equal split over the n decisions. */
export function timingLines({ tConv, tSample, tLogic, n }) {
  const tDec = decisionTime({ tConv, tSample, tLogic, n });
  const lines = [{ label: 'Sampling time Ts', value: tSample }];
  for (let k = 0; k < n; k++) lines.push({ label: `Decision ${k + 1}: decide and settle`, value: tDec });
  lines.push({ label: `Logic delay, ${n} x tlogic`, value: n * tLogic });
  const used = lines.reduce((s, l) => s + l.value, 0);
  return { lines, tDec, used, slack: tConv - used };
}

/** tdec for a list of sampling times, because Ts is still unknown. */
export function sweepSampleTime({ tConv, tLogic, n, values }) {
  return values.map((tSample) => ({ tSample, tDec: decisionTime({ tConv, tSample, tLogic, n }) }));
}
