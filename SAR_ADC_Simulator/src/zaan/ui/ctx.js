// Everything the chapters compute from the current knobs, cached per state.

import { siAll } from '../params.js';
import { designCdac } from '../model/cdac.js';
import { receiveDelays, cellsNeeded } from '../model/beamformer.js';

let lastKey = '';
let last = null;

export function context(state) {
  const key = JSON.stringify([state.reg.map((p) => p.value), state.ui]);
  if (key === lastKey) return last;
  const P = { ...siAll(state.reg), ...state.ui };
  const plane = receiveDelays({ N: P.channels, pitch: P.pitch, theta: P.steer, F: Infinity, c: P.c });
  const tauMax = Math.max(...plane.tau);
  const cells = cellsNeeded(tauMax, P.delayStep, 1 / P.fs);
  const d = designCdac(P, cells.m);
  last = { P, d, tauMax, cells };
  lastKey = key;
  return last;
}
