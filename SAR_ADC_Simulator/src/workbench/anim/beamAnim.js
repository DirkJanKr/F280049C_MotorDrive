// Beamformer animation, three views on one time axis.
// Left: a plane wavefront at the steering angle reaches the elements one after another.
// Middle: per channel the echo (line) and the charge sampled into its memory cells (bars),
//   newest cell at the right. The cell the read select takes is framed green; with the
//   delays on these frames line up along the echo.
// Right: the 16 read charges and their sum on the node. Bottom: the node charge over time
//   with and without the delays.
// Cells are drawn by age so the pattern is easy to follow; on the chip they stay in place
// and a pointer goes round. Delays come from the beamformer model.

import { receiveDelays, quantise } from '../../zaan/model/beamformer.js';

const A = { raf: 0, playing: true, speed: 1, sweep: false, angle: 0, slot: 0, frac: 0, cells: [], sumOn: [], sumOff: [], geom: null, P: null };

function css(n) {
  return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';
}

function geometry(P, angle) {
  const tw = 1 / P.fs;
  const r = receiveDelays({ N: P.channels, pitch: P.pitch, theta: angle, F: P.focus, c: P.c });
  const qd = quantise(r.tau, P.delayStep);
  const h = qd.map((x) => Math.round(x / (tw / 2)));
  return { tw, tau: r.tau, qd, back: h.map((x) => Math.ceil(x / 2)), c180: h.map((x) => x % 2), tauMax: Math.max(...r.tau), period: Math.max(24, Math.ceil(Math.max(...r.tau) / tw) + 12) };
}

export function beamControls() {
  return { setPlaying: (p) => (A.playing = p), setSpeed: (s) => (A.speed = s), setSweep: (s) => (A.sweep = s), state: A };
}

/** Echo at channel n and time t: a 10 MHz burst that reaches channel n at t0 + (τmax − τn), once per period. */
function echo(n, t) {
  const g = A.geom;
  const P = A.P;
  const per = g.period * g.tw;
  const u = ((((t - 6 * g.tw - (g.tauMax - g.tau[n])) % per) + per * 1.5) % per) - per / 2;
  const sigma = 1 / (2 * Math.PI * ((P.fbw * P.f0) / 2.3548));
  return Math.exp(-(u * u) / (2 * sigma * sigma)) * Math.cos(2 * Math.PI * P.f0 * u);
}

function writeSlot() {
  const g = A.geom;
  const N = A.P.channels;
  const M = A.P.memCells;
  for (let n = 0; n < N; n++) {
    A.cells[n].unshift(echo(n, A.slot * g.tw + (g.c180[n] ? g.tw / 2 : 0)));
    A.cells[n].length = M;
  }
  let on = 0;
  let off = 0;
  for (let n = 0; n < N; n++) {
    on += A.cells[n][Math.min(M - 1, g.back[n])] || 0;
    off += A.cells[n][0] || 0;
  }
  A.sumOn.push(on);
  A.sumOff.push(off);
  if (A.sumOn.length > 400) {
    A.sumOn.splice(0, 200);
    A.sumOff.splice(0, 200);
  }
  A.slot++;
}

function layout(W, N) {
  const narrow = W < 760;
  const rowH = Math.max(16, Math.min(26, 420 / N));
  const top = 44;
  const geo = narrow ? null : { x: 10, w: 130 };
  const sx0 = narrow ? 34 : 176;
  const comb = narrow ? { x: W - 112, w: 104 } : { x: W - 300, w: 290 };
  const strips = { x: sx0, w: comb.x - 16 - sx0 };
  const traceY = top + N * rowH + 26;
  return { narrow, rowH, top, geo, strips, comb, traceY, H: traceY + 150 };
}

export function startBeamAnim(canvas, getP, getUi) {
  cancelAnimationFrame(A.raf);
  if (!canvas) return;
  A.P = getP();
  A.angle = A.P.steer;
  A.geom = geometry(A.P, A.angle);
  A.cells = Array.from({ length: A.P.channels }, () => []);
  A.sumOn = [];
  A.sumOff = [];
  A.slot = 0;
  for (let k = 0; k < A.P.memCells + 4; k++) writeSlot();
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 900;
  const L = layout(W, A.P.channels);
  canvas.style.height = `${L.H}px`;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(L.H * dpr);
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  let last = performance.now();
  let sweepT = 0;
  const tick = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (A.playing) {
      if (A.sweep) {
        sweepT += dt * A.speed;
        A.angle = ((15 * Math.sin(sweepT * 0.3)) * Math.PI) / 180;
        A.geom = geometry(A.P, A.angle);
      }
      A.frac += (dt * A.speed) / 0.35;
      while (A.frac >= 1) {
        A.frac -= 1;
        writeSlot();
      }
    }
    draw(g, W, L, getUi ? getUi() : {});
    if (canvas.isConnected) A.raf = requestAnimationFrame(tick);
  };
  A.raf = requestAnimationFrame(tick);
}

function draw(g, W, L, ui) {
  const P = A.P;
  const gm = A.geom;
  const N = P.channels;
  const M = P.memCells;
  const delays = ui.bfDelays !== false;
  const col = { an: css('--an'), ref: css('--ref'), clk: css('--clk'), dig: css('--dig'), ink: css('--ink'), muted: css('--muted'), line: css('--line'), cal: css('--cal') };
  g.clearRect(0, 0, W, L.H);
  g.font = '13px "IBM Plex Sans", system-ui, sans-serif';
  g.fillStyle = col.muted;
  const tNow = (A.slot - 1 + A.frac) * gm.tw;
  const cw = L.strips.w / M;
  const xOfAge = (age, half) => L.strips.x + L.strips.w - (age + A.frac + (half ? -0.5 : 0) + 0.5) * cw;
  if (L.geo) g.fillText(`Wavefront at ${((A.angle * 180) / Math.PI).toFixed(1)}°`, L.geo.x, 20);
  g.fillText('Each channel: the echo and the charge in its memory cells, newest at the right', L.strips.x, 20);
  g.fillText(L.narrow ? 'Read, add' : 'Read cells, added on the node', L.comb.x, 20);
  // geometry: crests of the burst moving right, hitting element n when its echo peaks
  if (L.geo) {
    const v = (L.rowH / P.pitch) * P.c;
    const xe = L.geo.x + L.geo.w - 8;
    g.save();
    g.beginPath();
    g.rect(L.geo.x, L.top - 6, L.geo.w, N * L.rowH + 12);
    g.clip();
    const per = gm.period * gm.tw;
    for (let p = -1; p <= 1; p++) {
      for (let c = -2; c <= 2; c++) {
        g.strokeStyle = col.an;
        g.globalAlpha = Math.exp(-(c * c) / 2) * 0.85;
        g.lineWidth = 2;
        g.beginPath();
        for (let n = 0; n < N; n++) {
          const tHit = 6 * gm.tw + (gm.tauMax - gm.tau[n]) + Math.floor(tNow / per + p) * per + c / P.f0;
          const x = xe - (tHit - tNow) * v;
          const y = L.top + n * L.rowH + L.rowH / 2;
          if (n === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
      }
    }
    g.restore();
    g.globalAlpha = 1;
    for (let n = 0; n < N; n++) {
      const a = Math.abs(echo(n, tNow));
      g.fillStyle = gm.c180[n] ? col.clk : col.an;
      g.globalAlpha = 0.35 + 0.65 * a;
      g.fillRect(xe, L.top + n * L.rowH + 3, 8, L.rowH - 6);
    }
    g.globalAlpha = 1;
  }
  // strips: echo line and cell bars
  for (let n = 0; n < N; n++) {
    const y0 = L.top + n * L.rowH;
    const ym = y0 + L.rowH / 2;
    const amp = L.rowH * 0.44;
    g.fillStyle = col.muted;
    g.fillText(String(n + 1), L.strips.x - 24, ym + 4);
    g.strokeStyle = col.line;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(L.strips.x, ym);
    g.lineTo(L.strips.x + L.strips.w, ym);
    g.stroke();
    g.strokeStyle = col.muted;
    g.globalAlpha = 0.6;
    g.beginPath();
    for (let k = 0; k <= 160; k++) {
      const x = L.strips.x + (k / 160) * L.strips.w;
      const t = tNow - ((L.strips.x + L.strips.w - x) / cw - 0.5) * gm.tw;
      const y = ym - echo(n, t) * amp;
      if (k === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    g.globalAlpha = 1;
    const read = delays ? gm.back[n] : 0;
    for (let a = 0; a < M; a++) {
      const val = A.cells[n][a] || 0;
      const x = xOfAge(a, gm.c180[n]);
      if (x < L.strips.x - 1 || x > L.strips.x + L.strips.w) continue;
      g.fillStyle = val >= 0 ? col.an : col.cal;
      g.globalAlpha = a === read ? 1 : 0.75;
      g.fillRect(x - cw * 0.28, Math.min(ym, ym - val * amp), cw * 0.56, Math.abs(val * amp));
      if (a === read) {
        g.globalAlpha = 1;
        g.strokeStyle = col.dig;
        g.lineWidth = 2.5;
        g.strokeRect(x - cw * 0.45, y0 + 1.5, cw * 0.9, L.rowH - 3);
      }
    }
    g.globalAlpha = 1;
    if (gm.c180[n]) {
      g.fillStyle = col.clk;
      g.fillRect(L.strips.x - 8, y0 + 4, 3, L.rowH - 8);
    }
  }
  // combine: the read values as bars, lines to the node, the sum
  const bx = L.comb.x;
  const bw = L.narrow ? 54 : 120;
  const nodeX = bx + bw + (L.narrow ? 26 : 70);
  const nodeY = L.top + (N * L.rowH) / 2;
  let sum = 0;
  for (let n = 0; n < N; n++) {
    const val = A.cells[n][delays ? gm.back[n] : 0] || 0;
    sum += val;
    const ym = L.top + n * L.rowH + L.rowH / 2;
    g.strokeStyle = col.line;
    g.beginPath();
    g.moveTo(bx + bw / 2, ym);
    g.lineTo(nodeX, nodeY);
    g.stroke();
    g.fillStyle = val >= 0 ? col.an : col.cal;
    g.fillRect(bx + bw / 2, ym - L.rowH * 0.3, (val * bw) / 2, L.rowH * 0.6);
  }
  const r = 10 + Math.min(1, Math.abs(sum) / N) * (L.narrow ? 12 : 30);
  g.fillStyle = sum >= 0 ? col.an : col.cal;
  g.globalAlpha = 0.85;
  g.beginPath();
  g.arc(nodeX, nodeY, r, 0, 2 * Math.PI);
  g.fill();
  g.globalAlpha = 1;
  g.fillStyle = col.ink;
  g.fillText('Σ', nodeX - 4, nodeY + 5);
  if (!L.narrow) {
    g.fillText(`Q = CM · Σ V = ${sum.toFixed(1)} × CM V`, bx, L.top + N * L.rowH + 14);
    g.fillStyle = col.muted;
    g.fillText(`V node = Q / (${N} CM)`, nodeX - 60, nodeY + 50);
    g.fillText('= average of the 16', nodeX - 60, nodeY + 68);
  }
  // trace of the node charge, with and without delays
  const ty = L.traceY;
  const th = 110;
  const tx0 = L.strips.x;
  const tw = W - tx0 - 12;
  const n = 120;
  const on = A.sumOn.slice(-n);
  const off = A.sumOff.slice(-n);
  g.strokeStyle = col.line;
  g.strokeRect(tx0, ty, tw, th);
  g.beginPath();
  g.moveTo(tx0, ty + th / 2);
  g.lineTo(tx0 + tw, ty + th / 2);
  g.stroke();
  const line = (arr, c, wd) => {
    g.strokeStyle = c;
    g.lineWidth = wd;
    g.beginPath();
    arr.forEach((s, i) => {
      const x = tx0 + ((i + n - arr.length) / (n - 1)) * tw;
      const y = ty + th / 2 - (s / N) * (th / 2 - 4);
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    });
    g.stroke();
    g.lineWidth = 1;
  };
  line(off, col.muted, delays ? 1.4 : 2.6);
  line(on, col.dig, delays ? 2.6 : 1.4);
  const pk = (arr) => Math.max(0, ...arr.map(Math.abs));
  g.fillStyle = col.muted;
  g.fillText('node charge over time', L.narrow ? 8 : 10, ty + 14);
  g.fillStyle = col.dig;
  g.fillText(`with delays: peak ${pk(on).toFixed(1)} of ${N}`, L.narrow ? 8 : 10, ty + 36);
  g.fillStyle = col.muted;
  g.fillText(`without: peak ${pk(off).toFixed(1)}`, L.narrow ? 8 : 10, ty + 56);
  if (L.narrow) return;
  g.fillText(`slot ${A.slot} · one slot = ${(gm.tw * 1e9).toFixed(1)} ns · bars: charge CM · V per cell · violet mark: writes on CLK 180°, half a slot later`, tx0, ty + th + 22);
}

/** Use a new angle from the slider without restarting. */
export function setBeamAngle(P) {
  A.P = P;
  if (!A.sweep && A.cells.length === P.channels) {
    A.angle = P.steer;
    A.geom = geometry(P, A.angle);
  }
}
