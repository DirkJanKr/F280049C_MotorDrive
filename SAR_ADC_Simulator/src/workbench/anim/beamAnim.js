// Beamformer animation. A wavefront crosses the elements at the steering angle;
// every channel writes its memory cells round-robin, on CLK or on CLK 180° for a
// half step; the read select takes, from every channel, the cell written its
// delay ago; the charges of those cells add on the shared node.
// Delays come from the beamformer model, so changing the angle changes the read pattern.

import { receiveDelays, quantise } from '../../zaan/model/beamformer.js';

const A = { raf: 0, playing: true, speed: 1, sweep: false, angle: 0, slot: 0, store: null, sums: [], geom: null };

function css(n) {
  return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';
}

function geometry(P, angle) {
  const tw = 1 / P.fs;
  const r = receiveDelays({ N: P.channels, pitch: P.pitch, theta: angle, F: P.focus, c: P.c });
  const qd = quantise(r.tau, P.delayStep);
  const halfSlots = qd.map((x) => Math.round(x / (tw / 2)));
  const tauMax = Math.max(...r.tau);
  return { tw, tau: r.tau, qd, halfSlots, back: halfSlots.map((h) => Math.ceil(h / 2)), c180: halfSlots.map((h) => h % 2), tauMax };
}

export function beamControls() {
  return { setPlaying: (p) => (A.playing = p), setSpeed: (s) => (A.speed = s), setSweep: (s) => (A.sweep = s), state: A };
}

export function startBeamAnim(canvas, getP, onAngle) {
  cancelAnimationFrame(A.raf);
  if (!canvas) return;
  const g = canvas.getContext('2d');
  let P = getP();
  A.angle = P.steer;
  A.geom = geometry(P, A.angle);
  const N = P.channels;
  const M = P.memCells;
  A.store = Array.from({ length: N }, () => new Array(M).fill(0));
  A.slot = 0;
  A.sums = [];
  const sigma = 1 / (2 * Math.PI * ((P.fbw * P.f0) / 2.3548));
  const period = 8; // slots between echoes
  const arrival = (n, t) => {
    // echoes arrive every `period` slots; element n is hit (tauMax - tau_n) after the first element
    const gm = A.geom;
    const t0 = 4 * gm.tw;
    const local = ((t - t0) % (period * gm.tw) + period * gm.tw) % (period * gm.tw);
    return local - (gm.tauMax - gm.tau[n]);
  };
  const amp = (n, t) => {
    const u = arrival(n, t);
    return Math.exp(-(u * u) / (2 * sigma * sigma)) * Math.cos(2 * Math.PI * P.f0 * u);
  };
  let last = performance.now();
  let acc = 0;
  let sweepT = 0;
  const W = canvas.width;
  const H = canvas.height;
  const draw = () => {
    const gm = A.geom;
    const an = css('--an');
    const clk = css('--clk');
    const ref = css('--ref');
    const ink = css('--ink');
    const muted = css('--muted');
    const dig = css('--dig');
    g.clearRect(0, 0, W, H);
    g.font = '14px "IBM Plex Sans", system-ui, sans-serif';
    const top = 44;
    const ch = Math.min(26, (H - top - 40) / N);
    const gx = 260;
    const gw = W - gx - 230;
    const cw = gw / M;
    g.fillStyle = muted;
    g.fillText(`Elements, angle ${(A.angle * 180 / Math.PI).toFixed(1)}°`, 16, 26);
    g.fillText(`Memory cells 1 to ${M} per channel`, gx, 26);
    g.fillText('Sum on the shared node', W - 210, 26);
    const t = A.slot * gm.tw;
    // wavefront through the elements
    g.strokeStyle = an;
    g.lineWidth = 2.5;
    g.globalAlpha = 0.8;
    g.beginPath();
    for (let n = 0; n < N; n++) {
      const u = arrival(n, t);
      const x = 200 + (u / gm.tw) * 22;
      const y = top + n * ch + ch / 2;
      if (n === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    g.globalAlpha = 1;
    g.lineWidth = 1;
    for (let n = 0; n < N; n++) {
      const y = top + n * ch + ch / 2;
      const a = amp(n, t);
      g.fillStyle = gm.c180[n] ? clk : an;
      g.fillRect(196, y - ch / 2 + 3, 8, ch - 6);
      g.fillStyle = muted;
      g.fillText(String(n + 1), 20, y + 5);
      g.fillStyle = gm.c180[n] ? clk : an;
      g.fillRect(48, y - 2, Math.abs(a) * 120, 4);
      // cells
      const wcol = A.slot % M;
      const rcol = (((A.slot - 1 - gm.back[n]) % M) + M) % M;
      for (let k = 0; k < M; k++) {
        const v = A.store[n][k];
        g.fillStyle = v >= 0 ? an : ref;
        g.globalAlpha = Math.min(1, Math.abs(v) * 0.95 + 0.07);
        g.fillRect(gx + k * cw + 1, top + n * ch + 2, cw - 3, ch - 4);
      }
      g.globalAlpha = 1;
      g.strokeStyle = gm.c180[n] ? clk : ink;
      g.lineWidth = 2;
      g.strokeRect(gx + wcol * cw, top + n * ch + 1, cw - 1, ch - 2);
      g.strokeStyle = dig;
      g.lineWidth = 3;
      g.strokeRect(gx + rcol * cw + 1, top + n * ch + 2, cw - 3, ch - 4);
      g.lineWidth = 1;
    }
    // sum trace
    const yC = top + (N * ch) / 2;
    g.strokeStyle = muted;
    g.beginPath();
    g.moveTo(W - 210, yC);
    g.lineTo(W - 20, yC);
    g.stroke();
    g.strokeStyle = dig;
    g.lineWidth = 2.5;
    g.beginPath();
    const tail = A.sums.slice(-60);
    tail.forEach((s, i) => {
      const x = W - 210 + (i / 60) * 190;
      const y = yC - s * N * ch * 0.45;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    });
    g.stroke();
    g.lineWidth = 1;
    g.fillStyle = muted;
    g.fillText(`slot ${A.slot} · ${(t * 1e9).toFixed(1)} ns · one slot = ${(gm.tw * 1e9).toFixed(1)} ns`, 16, H - 12);
    g.fillStyle = ink;
    g.fillText('white: write pointer', gx, H - 12);
    g.fillStyle = clk;
    g.fillText('violet: writes on CLK 180°', gx + 150, H - 12);
    g.fillStyle = dig;
    g.fillText('green: cell read now', gx + 350, H - 12);
  };
  const tick = (now) => {
    const dt = (now - last) / 1000;
    last = now;
    if (A.playing) {
      acc += dt * A.speed;
      if (A.sweep) {
        sweepT += dt * A.speed;
        const deg = 15 * Math.sin(sweepT * 0.35);
        A.angle = (deg * Math.PI) / 180;
        A.geom = geometry(P, A.angle);
        if (onAngle) onAngle(A.angle);
      }
      while (acc > 0.28) {
        acc -= 0.28;
        for (let n = 0; n < N; n++) A.store[n][A.slot % M] = amp(n, A.slot * A.geom.tw + (A.geom.c180[n] ? A.geom.tw / 2 : 0));
        A.slot++;
        let s = 0;
        for (let n = 0; n < N; n++) s += A.store[n][(((A.slot - 1 - A.geom.back[n]) % M) + M) % M];
        A.sums.push(s / N);
        if (A.sums.length > 400) A.sums.splice(0, 200);
      }
    }
    draw();
    if (canvas.isConnected) A.raf = requestAnimationFrame(tick);
  };
  A.raf = requestAnimationFrame(tick);
}

/** Use a new angle from the slider without restarting. */
export function setBeamAngle(P) {
  if (!A.sweep && A.store) {
    A.angle = P.steer;
    A.geom = geometry(P, A.angle);
  }
}
