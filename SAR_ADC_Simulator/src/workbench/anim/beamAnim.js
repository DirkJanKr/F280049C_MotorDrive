// Beamformer animation: an echo wavefront crosses the 16 elements at the steering
// angle; each channel writes its cells round-robin on CLK or CLK 180°; the read
// select takes the delayed cell of every channel; the charges sum on the node.
// Delays, clock choice and cell count come from the model (derive.js).

let raf = 0;

function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
}

export function startBeamAnim(canvas, ctx) {
  cancelAnimationFrame(raf);
  if (!canvas) return;
  const g = canvas.getContext('2d');
  const { P, tw, qd, delays, halfSteps } = ctx;
  const N = P.channels;
  const M = P.memCells ?? ctx.cells;
  const tauMax = Math.max(...delays.tau);
  const T0 = 6 * tw;
  const arr = delays.tau.map((t) => T0 + (tauMax - t));
  const sigma = 1 / (2 * Math.PI * ((P.fbw * P.f0) / 2.3548));
  const amp = (n, t) => Math.exp(-((t - arr[n]) ** 2) / (2 * sigma * sigma)) * Math.cos(2 * Math.PI * P.f0 * (t - arr[n]));
  const slotsOf = qd.map((q) => Math.round(q / (tw / 2)));
  const W = canvas.width;
  const H = canvas.height;
  const gx0 = 190;
  const cw = Math.max(8, (W - gx0 - 90) / M);
  const ch = Math.max(8, (H - 50) / N);
  const store = Array.from({ length: N }, () => new Array(M).fill(0));
  let slot = 0;
  let last = performance.now();
  let acc = 0;
  const sums = [];
  const draw = () => {
    const an = css('--an');
    const clk = css('--clk');
    const ref = css('--ref');
    const ink = css('--ink');
    const muted = css('--muted');
    g.clearRect(0, 0, W, H);
    g.font = '12px "IBM Plex Sans", system-ui, sans-serif';
    g.fillStyle = muted;
    g.fillText('elements', 10, 16);
    g.fillText(`cells 1 to ${M} per channel (write pointer ▸, read ◻)`, gx0, 16);
    g.fillText('sum', W - 70, 16);
    const t = slot * tw;
    // wavefront: element n is hit at t = arr[n]; before that the front is to the left of it
    const yC = 30 + (N * ch) / 2;
    g.strokeStyle = an;
    g.lineWidth = 2;
    g.globalAlpha = 0.7;
    g.beginPath();
    for (let n = 0; n < N; n++) {
      const x = 150 - ((arr[n] - t) / tw) * 14;
      const y = 30 + n * ch + ch / 2;
      if (n === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.save();
    g.beginPath();
    g.rect(10, 20, 165, N * ch + 20);
    g.clip();
    g.restore();
    g.stroke();
    g.globalAlpha = 1;
    g.lineWidth = 1;
    for (let n = 0; n < N; n++) {
      const y = 30 + n * ch + ch / 2;
      const a = amp(n, t);
      g.fillStyle = halfSteps[n] ? clk : an;
      g.beginPath();
      g.arc(150, y, 4, 0, 2 * Math.PI);
      g.fill();
      g.fillRect(156, y - 1, Math.abs(a) * 26, 2);
      g.fillStyle = muted;
      g.fillText(String(n + 1), 118, y + 4);
      // cells
      const wcol = slot % M;
      for (let k = 0; k < M; k++) {
        const v = store[n][k];
        g.fillStyle = v >= 0 ? an : ref;
        g.globalAlpha = Math.min(1, Math.abs(v) * 0.9 + 0.06);
        g.fillRect(gx0 + k * cw, 30 + n * ch + 1, cw - 2, ch - 2);
      }
      g.globalAlpha = 1;
      g.fillStyle = halfSteps[n] ? clk : ink;
      g.fillText('▸', gx0 + wcol * cw - 9, 30 + n * ch + ch - 2);
      const back = Math.ceil(slotsOf[n] / 2);
      const rcol = (((slot - back) % M) + M) % M;
      g.strokeStyle = ink;
      g.strokeRect(gx0 + rcol * cw - 0.5, 30 + n * ch + 0.5, cw - 1, ch - 1);
    }
    // sum trace
    g.strokeStyle = an;
    g.lineWidth = 2;
    g.beginPath();
    sums.slice(-40).forEach((s, i, a) => {
      const x = W - 80 + (i / 40) * 70;
      const y = yC - s * (N * ch) * 0.45;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    });
    g.stroke();
    g.lineWidth = 1;
    g.fillStyle = muted;
    g.fillText(`slot ${slot}, t = ${(t * 1e9).toFixed(1)} ns`, 10, H - 8);
    g.fillStyle = clk;
    g.fillText('violet: CLK 180° channels', gx0, H - 8);
  };
  const tick = (now) => {
    acc += (now - last) / 1000;
    last = now;
    if (acc > 0.33) {
      acc = 0;
      // write: channel n samples at slot*tw (+ tw/2 on CLK 180°)
      for (let n = 0; n < N; n++) store[n][slot % M] = amp(n, slot * tw + (halfSteps[n] ? tw / 2 : 0));
      slot++;
      // read: the cell written ceil(half-slots / 2) slots ago
      let s = 0;
      for (let n = 0; n < N; n++) {
        const back = Math.ceil(slotsOf[n] / 2);
        s += store[n][(((slot - 1 - back) % M) + M) % M];
      }
      sums.push(s / N);
      if (slot > 4 * M) {
        slot = 0;
        sums.length = 0;
        for (const r of store) r.fill(0);
      }
      draw();
    }
    if (canvas.isConnected) raf = requestAnimationFrame(tick);
  };
  draw();
  raf = requestAnimationFrame(tick);
}
