// Beamformer animation: the memory cells as they sit on the chip. Every channel
// writes one cell per slot, round-robin (white frame = write pointer); a channel
// with an extra half step writes on CLK 180°, half a slot later (violet). At every
// read the read select takes from each channel the cell written its delay ago
// (green frame). Each cell shows the charge it holds as a bar. On the right the 16
// read charges are added on the node, with the node charge over time with and
// without the delays. Delays come from the beamformer model.

import { receiveDelays, quantise } from '../../zaan/model/beamformer.js';

// starts paused when the viewer asked the system for reduced motion
const A = { raf: 0, playing: !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches), speed: 1, sweep: false, angle: 0, slot: 0, store: null, on: [], off: [], geom: null, P: null };

function css(n) {
  return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';
}

function geometry(P, angle) {
  const tw = 1 / P.fs;
  const r = receiveDelays({ N: P.channels, pitch: P.pitch, theta: angle, F: P.focus, c: P.c });
  const qd = quantise(r.tau, P.delayStep);
  const h = qd.map((x) => Math.round(x / (tw / 2)));
  const tauMax = Math.max(...r.tau);
  // echoes far enough apart that one has passed every channel before the next arrives
  return { tw, tau: r.tau, back: h.map((x) => Math.ceil(x / 2)), c180: h.map((x) => x % 2), tauMax, period: Math.max(16, Math.ceil(tauMax / tw) + 14) };
}

export function beamControls() {
  return { setPlaying: (p) => (A.playing = p), setSpeed: (s) => (A.speed = s), setSweep: (s) => (A.sweep = s), state: A };
}

/** Time since the echo passed channel n (s); the channel needing the longest delay is hit first. */
function arrival(n, t) {
  const g = A.geom;
  const per = g.period * g.tw;
  const local = ((((t - 4 * g.tw) % per) + per) % per);
  return local - (g.tauMax - g.tau[n]);
}

function echo(n, t) {
  const P = A.P;
  const u = arrival(n, t);
  const sigma = 1 / (2 * Math.PI * ((P.fbw * P.f0) / 2.3548));
  return Math.exp(-(u * u) / (2 * sigma * sigma)) * Math.cos(2 * Math.PI * P.f0 * u);
}

function readCol(n, delays) {
  const M = A.P.memCells;
  return (((A.slot - 1 - (delays ? A.geom.back[n] : 0)) % M) + M) % M;
}

function writeSlot(delays) {
  const g = A.geom;
  const N = A.P.channels;
  const M = A.P.memCells;
  for (let n = 0; n < N; n++) A.store[n][A.slot % M] = echo(n, A.slot * g.tw + (g.c180[n] ? g.tw / 2 : 0));
  A.slot++;
  let on = 0;
  let off = 0;
  for (let n = 0; n < N; n++) {
    on += A.store[n][readCol(n, true)];
    off += A.store[n][readCol(n, false)];
  }
  A.on.push(on);
  A.off.push(off);
  if (A.on.length > 300) {
    A.on.splice(0, 150);
    A.off.splice(0, 150);
  }
}

export function startBeamAnim(canvas, getP, getUi = () => ({})) {
  cancelAnimationFrame(A.raf);
  if (!canvas) return;
  A.P = getP();
  A.angle = A.P.steer;
  A.geom = geometry(A.P, A.angle);
  A.store = Array.from({ length: A.P.channels }, () => new Array(A.P.memCells).fill(0));
  A.slot = 0;
  A.on = [];
  A.off = [];
  for (let k = 0; k < A.P.memCells; k++) writeSlot(true);
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 900;
  const narrow = W < 720;
  const rowH = narrow ? 20 : 26;
  const H = 52 + A.P.channels * rowH + (narrow ? 200 : 64);
  canvas.style.height = `${H}px`;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  let last = performance.now();
  let acc = 0;
  let sweepT = 0;
  const tick = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (A.playing) {
      acc += dt * A.speed;
      if (A.sweep) {
        sweepT += dt * A.speed;
        A.angle = ((15 * Math.sin(sweepT * 0.35)) * Math.PI) / 180;
        A.geom = geometry(A.P, A.angle);
      }
      while (acc > 0.32) {
        acc -= 0.32;
        writeSlot();
      }
    }
    draw(g, W, H, rowH, narrow, getUi().bfDelays !== false);
    if (canvas.isConnected) A.raf = requestAnimationFrame(tick);
  };
  A.raf = requestAnimationFrame(tick);
}

function draw(g, W, H, rowH, narrow, delays) {
  const P = A.P;
  const gm = A.geom;
  const N = P.channels;
  const M = P.memCells;
  const c = { an: css('--an'), ref: css('--ref'), clk: css('--clk'), dig: css('--dig'), ink: css('--ink'), muted: css('--muted'), line: css('--line'), cal: css('--cal'), panel: css('--panel2') };
  g.clearRect(0, 0, W, H);
  g.font = `${narrow ? 11 : 13}px "IBM Plex Sans", system-ui, sans-serif`;
  const top = 40;
  const elemW = narrow ? 70 : 190;
  const sumW = narrow ? 0 : 250;
  const gx = elemW + 14;
  const gw = W - gx - sumW - 18;
  const cw = gw / M;
  const t = (A.slot - 1) * gm.tw;
  g.fillStyle = c.muted;
  g.fillText(narrow ? 'echo' : `Echo at each element, ${((A.angle * 180) / Math.PI).toFixed(1)}°`, 10, 22);
  g.fillText(`Memory cells 1 to ${M} of each channel (bar = charge held)`, gx, 22);
  if (!narrow) g.fillText('Read cells added on the node', W - sumW, 22);
  // echo per element, and the wavefront through the pulse centres
  const ex = elemW - 18;
  g.strokeStyle = c.an;
  g.lineWidth = 2;
  g.globalAlpha = 0.7;
  // wavefront: where the pulse centre is, shown while it approaches the elements
  const span = narrow ? 5 : 12;
  g.beginPath();
  let pen = false;
  for (let n = 0; n < N; n++) {
    const u = -arrival(n, t) / gm.tw;
    const y = top + n * rowH + rowH / 2;
    if (u < -0.5 || u > (ex - 24) / span) {
      pen = false;
      continue;
    }
    const x = ex - u * span;
    if (!pen) g.moveTo(x, y);
    else g.lineTo(x, y);
    pen = true;
  }
  g.stroke();
  g.globalAlpha = 1;
  for (let n = 0; n < N; n++) {
    const y = top + n * rowH;
    const a = echo(n, t);
    g.fillStyle = c.muted;
    g.fillText(String(n + 1), 4, y + rowH / 2 + 4);
    g.fillStyle = a >= 0 ? c.an : c.cal;
    const bw = Math.abs(a) * (ex - 30);
    g.fillRect(ex - bw, y + rowH * 0.3, bw, rowH * 0.4);
    g.fillStyle = gm.c180[n] ? c.clk : c.an;
    g.fillRect(ex + 2, y + 3, 6, rowH - 6);
  }
  // cells
  for (let n = 0; n < N; n++) {
    const y = top + n * rowH;
    const wcol = (A.slot - 1 + M) % M;
    const rcol = readCol(n, delays);
    for (let k = 0; k < M; k++) {
      const x = gx + k * cw;
      g.fillStyle = c.panel;
      g.fillRect(x + 1, y + 1, cw - 2, rowH - 2);
      const v = A.store[n][k];
      const hh = (rowH / 2 - 3) * Math.max(-1, Math.min(1, v));
      g.fillStyle = v >= 0 ? c.an : c.cal;
      g.fillRect(x + cw * 0.22, y + rowH / 2 - Math.max(hh, 0), cw * 0.56, Math.abs(hh));
    }
    g.strokeStyle = gm.c180[n] ? c.clk : c.ink;
    g.lineWidth = 1.5;
    g.strokeRect(gx + wcol * cw + 0.5, y + 0.5, cw - 1, rowH - 1);
    g.strokeStyle = c.dig;
    g.lineWidth = 3;
    g.strokeRect(gx + rcol * cw + 2, y + 2, cw - 4, rowH - 4);
  }
  g.lineWidth = 1;
  // read values and their sum
  let sum = 0;
  for (let n = 0; n < N; n++) sum += A.store[n][readCol(n, delays)];
  const tr = narrow ? { x: 10, y: top + N * rowH + 30, w: W - 20, h: 120 } : { x: W - sumW, y: top + N * rowH * 0.5, w: sumW - 10, h: N * rowH * 0.5 };
  if (!narrow) {
    const bx = W - sumW;
    const nodeX = bx + 120;
    const nodeY = top + N * rowH * 0.22;
    for (let n = 0; n < N; n++) {
      const v = A.store[n][readCol(n, delays)];
      const y = top + n * rowH * 0.46 + 4;
      g.fillStyle = v >= 0 ? c.an : c.cal;
      g.fillRect(bx + 44, y, v * 40, rowH * 0.34);
      g.strokeStyle = c.line;
      g.beginPath();
      g.moveTo(bx + 86, y + 4);
      g.lineTo(nodeX - 18, nodeY);
      g.stroke();
    }
    g.fillStyle = sum >= 0 ? c.an : c.cal;
    g.globalAlpha = 0.85;
    g.beginPath();
    g.arc(nodeX, nodeY, 10 + Math.min(1, Math.abs(sum) / N) * 22, 0, 2 * Math.PI);
    g.fill();
    g.globalAlpha = 1;
    g.fillStyle = c.ink;
    g.fillText('Σ', nodeX - 4, nodeY + 5);
    g.fillText(`${sum.toFixed(1)} × CM·V`, nodeX + 38, nodeY + 5);
  }
  // node charge over time, with and without delays
  g.strokeStyle = c.line;
  g.strokeRect(tr.x, tr.y + 20, tr.w, tr.h - 24);
  const mid = tr.y + 20 + (tr.h - 24) / 2;
  const plot = (arr, col, lw) => {
    const s = arr.slice(-60);
    g.strokeStyle = col;
    g.lineWidth = lw;
    g.beginPath();
    s.forEach((v, i) => {
      const x = tr.x + (i / 59) * tr.w;
      const y = mid - (v / N) * ((tr.h - 30) / 2);
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    });
    g.stroke();
    g.lineWidth = 1;
  };
  plot(A.off, c.muted, delays ? 1.3 : 2.6);
  plot(A.on, c.dig, delays ? 2.6 : 1.3);
  const pk = (arr) => Math.max(0, ...arr.slice(-60).map(Math.abs));
  g.fillStyle = c.dig;
  g.fillText(`with delays: peak ${pk(A.on).toFixed(1)} of ${N}`, tr.x, tr.y + 12);
  g.fillStyle = c.muted;
  g.fillText(`without: ${pk(A.off).toFixed(1)}`, tr.x + (narrow ? 200 : 170), tr.y + 12);
  // legend
  const ly = top + N * rowH + (narrow ? 184 : 26);
  const items = [[c.ink, 'write pointer'], [c.clk, 'channel writes on CLK 180°'], [c.dig, delays ? 'cell read now' : 'cell read now (delays off: newest cell)'], [c.an, 'charge +'], [c.cal, 'charge −']];
  let lx = 10;
  for (const [col, txt] of items) {
    g.fillStyle = col;
    g.fillRect(lx, ly - 9, 10, 10);
    g.fillStyle = c.muted;
    g.fillText(txt, lx + 14, ly);
    lx += g.measureText(txt).width + 34;
  }
  if (!narrow) g.fillText(`slot ${A.slot} · one slot = ${(gm.tw * 1e9).toFixed(1)} ns`, W - 170, ly);
}

/** Use a new angle from the slider without restarting. */
export function setBeamAngle(P) {
  A.P = P;
  if (!A.sweep && A.store && A.store.length === P.channels) {
    A.angle = P.steer;
    A.geom = geometry(P, A.angle);
  }
}
