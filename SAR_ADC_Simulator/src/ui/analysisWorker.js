/** Web worker: runs the expensive analyses (ramp histogram, FFT, energy) off the UI thread. */
import { createAdc } from '../model/adc.js';
import { staticLinearity } from '../analysis/static.js';
import { dynamicPerformance } from '../analysis/dynamic.js';
import { averageSwitchingEnergy } from '../analysis/energy.js';

export function runAnalysis(config, opts) {
  const adc = createAdc(config);
  const s = staticLinearity(adc, { samplesPerCode: opts.samplesPerCode || undefined });
  const d = dynamicPerformance(adc, { points: opts.fftPoints, amplitudeDbfs: opts.ampDbfs, finRatio: opts.finRatio });
  const e = averageSwitchingEnergy(adc, { maxConversions: 1024 });
  delete s.hist;
  delete s.transitions;
  delete d.codes;
  return { static: s, dynamic: d, energy: e };
}

if (typeof self !== 'undefined' && typeof window === 'undefined') {
  self.onmessage = (ev) => {
    const { id, config, opts } = ev.data;
    try {
      const r = runAnalysis(config, opts);
      self.postMessage({ id, result: r });
    } catch (err) {
      self.postMessage({ id, error: String(err && err.message ? err.message : err) });
    }
  };
}
