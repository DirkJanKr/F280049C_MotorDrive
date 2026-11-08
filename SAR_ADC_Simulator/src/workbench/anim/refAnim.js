// Reference variants: charge drawn per decision, drawn as current pulses with a
// moving cursor. Charge redistribution comes from the conventional CDAC model;
// the charge-sharing variants draw the precharge charge of derive.js once per conversion.

import { referenceWaveforms } from '../../zaan/model/reference.js';

let raf = 0;

function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
}

export function startRefAnim(canvas, ctx, variant, play = false) {
  cancelAnimationFrame(raf);
  if (!canvas) return;
  const g = canvas.getContext('2d');
  const conv = 4;
  const w = referenceWaveforms(ctx.P, ctx.d, conv, 4);
  const q = ctx.D.refQ.value;
  const slots = w.slots;
  const total = w.red.length;
  const rows = [
    { name: 'charge redistribution (for comparison)', data: w.red, color: '--bad', key: null },
    { name: 'ping-pong CDAC', data: w.red.map((_, i) => (i % slots === 0 ? q : 0)), color: '--ref', key: 'ping-pong CDAC' },
    { name: 'reservoir C RSV + servo: from C RSV', data: w.red.map((_, i) => (i % slots === 0 ? q : 0)), color: '--ref', key: 'reservoir C RSV with servo (Guo 2024)', note: 'servo refill from VREF: profile ?' },
    { name: 'external pin (DFT)', data: w.red.map((_, i) => (i % slots === 0 ? q : 0)), color: '--ref', key: 'external pin (DFT)' },
  ];
  const max = Math.max(...rows.flatMap((r) => r.data.map(Math.abs)), 1e-18);
  const W = canvas.width;
  const H = canvas.height;
  const x0 = 250;
  const rh = (H - 30) / rows.length;
  let cur = play ? 0 : total;
  let last = performance.now();
  const draw = () => {
    g.clearRect(0, 0, W, H);
    g.font = '12px "IBM Plex Sans", system-ui, sans-serif';
    rows.forEach((r, k) => {
      const y0 = 10 + k * rh;
      const base = y0 + rh * 0.75;
      const sel = variant && r.key === variant;
      g.fillStyle = sel ? css('--ref') : css('--muted');
      g.fillText((sel ? '● ' : '') + r.name, 8, base - 4);
      if (r.note) {
        g.fillStyle = css('--muted');
        g.fillText(r.note, 8, base + 12);
      }
      g.strokeStyle = css('--line');
      g.beginPath();
      g.moveTo(x0, base);
      g.lineTo(W - 8, base);
      g.stroke();
      for (let i = 0; i < total; i++) {
        const x = x0 + ((i + 0.5) / total) * (W - x0 - 10);
        const h = (r.data[i] / max) * rh * 0.6;
        g.globalAlpha = i < cur ? 1 : 0.18;
        g.fillStyle = css(r.color);
        g.fillRect(x - 2, base - Math.max(h, 0), 4, Math.abs(h));
      }
      g.globalAlpha = 1;
    });
    for (let c = 1; c < conv; c++) {
      const x = x0 + ((c * slots) / total) * (W - x0 - 10);
      g.strokeStyle = css('--line');
      g.setLineDash([3, 3]);
      g.beginPath();
      g.moveTo(x, 4);
      g.lineTo(x, H - 20);
      g.stroke();
      g.setLineDash([]);
    }
    g.fillStyle = css('--muted');
    g.fillText(`${conv} conversions, ${slots} decision slots each`, x0, H - 6);
  };
  const tick = (now) => {
    cur += ((now - last) / 1000) * 10;
    last = now;
    draw();
    if (cur < total && canvas.isConnected) raf = requestAnimationFrame(tick);
  };
  draw();
  if (play) raf = requestAnimationFrame(tick);
}
