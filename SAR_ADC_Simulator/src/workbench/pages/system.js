// System page: the chain from the beamformer to the IQ demodulator as large cards,
// each with its key numbers, a small picture and whether its checks pass. A sample
// moves along the chain. Below: what feeds the chain (reference, clocks, calibration).
// Click a card to open its page.

import { eng, num, esc, readouts, fq } from '../kit.js';

export const page = {
  id: 'system',
  title: 'System',
  side(store, ctx) {
    return summaryPanel(ctx);
  },
  main() {
    return '<div class="sysview" id="sysview"></div>';
  },
  update(store, ctx) {
    const el = document.getElementById('sysview');
    if (!el) return;
    el.innerHTML = chain(ctx);
    const side = document.getElementById('sysside');
    if (side) side.outerHTML = summaryPanel(ctx);
  },
};

function summaryPanel(ctx) {
  const { d, P, budget: b } = ctx;
  const bad = ctx.checks.filter((c) => c.state !== 'ok');
  const fails = bad.length
    ? `<div class="fails side">${bad.map((c) => `<a class="fail ${c.state}" href="#${c.go}"><b>${esc(c.label)}: ${esc(c.value)}</b><span>${c.why}</span></a>`).join('')}</div>`
    : '<p class="okline">Every check passes.</p>';
  return `<div id="sysside"><h3 class="sh">At a glance</h3>${readouts([
    ['ENOB, converter only', `${num(b.enob, 2)}`, `aim ${num(P.enobAim, 1)}`, b.ok ? 'ok' : 'bad', 'enob'],
    [ctx.ui.qUnit === 'V' ? 'Noise at the input' : 'Noise as charge', fq(ctx, b.total, true), `allowed ${fq(ctx, b.allowed, true)}`, b.ok ? 'ok' : 'bad', 'allowed'],
    ['One LSB', eng(d.qLsb, 'C'), `${eng(d.qLsb / d.cNode[0], 'V')} at the input`, '', 'qlsb'],
    ['Decisions', `${d.decisions}`, `planned ${P.rawDecisions}`, '', 'decisions'],
    ['CDAC', eng(d.cdac, 'F'), `${num(d.units, 0)} × ${eng(P.cu, 'F')}`, '', 'cdac'],
    ['Memory cell', eng(d.cm, 'F'), `${d.memCaps} in the array`, '', 'cm'],
    ['Capacitor area', `${num(ctx.areaTotal * 1e6, 3)} mm²`, `${num((ctx.areaTotal / (3.2e-3 * 5e-3)) * 100, 2)} % of the chip`, '', 'area'],
  ])}
  <h3 class="sh">What does not pass</h3>${fails}
  <h3 class="sh">Noise power, share of the allowance</h3><div class="nb">${b.lines
    .map((n) => `<div class="nbr"><span>${esc(n.label)}</span><span class="nbt"><span class="${n.ok ? '' : 'over'}" style="width:${Math.min(100, n.share).toFixed(1)}%"></span></span><b>${num(n.share, 0)} %</b></div>`)
    .join('')}</div><p class="cap">Total ${num(b.used, 0)} % of what ENOB ${num(P.enobAim, 1)} allows. Details on the <a href="#budget">Budget page</a>. Everything before the beamformer is left out.</p></div>`;
}


function stateOf(ctx, ids) {
  const c = ctx.checks.filter((k) => ids.includes(k.id));
  if (c.some((k) => k.state === 'bad')) return 'bad';
  if (c.some((k) => k.state === 'warn')) return 'warn';
  return 'ok';
}

function card(go, title, lines, pic, state, sub = '') {
  return `<div class="blk ${state}" data-go="${go}" tabindex="0" role="link" aria-label="${esc(title)}">
    <div class="bh"><span class="dot"></span><b>${esc(title)}</b></div>
    <div class="bp">${pic}</div>
    <ul>${lines.map((l) => `<li>${l}</li>`).join('')}</ul>${sub ? `<p class="bs">${sub}</p>` : ''}<span class="bgo">open ›</span></div>`;
}

const arrow = (label) => `<div class="arr"><span class="lane"><i></i></span><small>${label}</small></div>`;

function cellsPic(ctx) {
  const { P, qd, tw, halfSteps } = ctx;
  const N = Math.min(P.channels, 16);
  const M = Math.min(P.memCells, 24);
  const cw = 120 / M;
  const ch = 64 / N;
  let s = '';
  for (let n = 0; n < N; n++) {
    const back = Math.ceil(Math.round(qd[n] / (tw / 2)) / 2);
    for (let k = 0; k < M; k++) {
      const read = k === (M - 1 - back + M * 4) % M;
      s += `<rect x="${k * cw}" y="${n * ch}" width="${cw - 0.8}" height="${ch - 0.8}" class="${read ? 'gr' : halfSteps[n] ? 'g180' : 'g0'}"/>`;
    }
  }
  return `<svg viewBox="0 0 120 64" class="pic">${s}</svg>`;
}

function capsPic(ctx) {
  const { d } = ctx;
  const n = d.weights.length;
  const mx = Math.max(...d.weights);
  const bw = 120 / n;
  return `<svg viewBox="0 0 120 64" class="pic">${d.weights.map((w, i) => {
    const h = 6 + 52 * Math.sqrt(w / mx);
    return `<rect x="${i * bw + 1}" y="${58 - h}" width="${bw - 2}" height="${h}" rx="1.5" class="${d.steps[i].kind === 'cap' ? 'cw' : 'ch'}"/>`;
  }).join('')}<line x1="0" x2="120" y1="60" y2="60" class="base"/></svg>`;
}

function compPic() {
  return '<svg viewBox="0 0 120 64" class="pic"><path d="M40 8 L40 56 L84 32 Z" class="csym"/><path d="M14 20 H40 M14 44 H40 M84 32 H108" class="cw2"/><text x="44" y="24" class="pt">+</text><text x="44" y="50" class="pt">−</text></svg>';
}

function logicPic(ctx) {
  const n = Math.min(ctx.d.decisions, 14);
  const bw = 112 / n;
  return `<svg viewBox="0 0 120 64" class="pic">${Array.from({ length: n }, (_, i) => `<rect x="${4 + i * bw}" y="22" width="${bw - 2}" height="20" rx="2" class="bt ${i < n / 2 ? 'on' : ''}"/>`).join('')}<path d="M10 52 C40 64, 80 64, 110 52" class="loop"/></svg>`;
}

function lutPic(ctx) {
  return `<svg viewBox="0 0 120 64" class="pic"><text x="8" y="24" class="pt">Σ d<tspan baseline-shift="sub" font-size="9">i</tspan> w<tspan baseline-shift="sub" font-size="9">i</tspan></text><rect x="64" y="8" width="48" height="48" rx="4" class="lut"/>${[0, 1, 2, 3].map((i) => `<line x1="68" x2="108" y1="${18 + i * 10}" y2="${18 + i * 10}" class="base"/>`).join('')}<text x="8" y="50" class="pt">${Math.round(ctx.P.outBits)} bit</text></svg>`;
}

function iqPic() {
  return '<svg viewBox="0 0 120 64" class="pic"><path d="M4 56 H116" class="base"/><path d="M70 56 Q80 10 90 56" class="sp1"/><path d="M30 56 Q40 10 50 56" class="sp2"/><path d="M76 30 C64 20, 56 20, 46 28" class="mv"/></svg>';
}

function chain(ctx) {
  const { P, d, budget: b } = ctx;
  const lastLsb = d.qLsb / d.cNode[d.decisions - 1];
  const comp = b.lines.find((l) => l.id === 'comp');
  const main = [
    card('beamformer', 'Beamformer', [`${P.channels} × ${P.memCells} memory cells`, `step ${eng(P.delayStep, 's')}`, `CM ${eng(d.cm, 'F')}`], cellsPic(ctx), stateOf(ctx, ['cells'])),
    arrow('charge'),
    card('sar', 'Charge sharing', [`${d.decisions} decisions`, `CDAC ${eng(d.cdac, 'F')}, ${num(d.units, 0)} units`, `1 LSB = ${eng(d.qLsb, 'C')}`], capsPic(ctx), stateOf(ctx, ['cover', 'tol', 'small'])),
    arrow('V node'),
    card('budget', 'Comparator', [`noise ${eng(P.compNoise, 'V')} rms`, `last LSB ${eng(lastLsb, 'V')}`, `${num(comp.share, 0)} % of the noise allowance`], compPic(), comp.ok ? 'ok' : 'warn'),
    arrow('bit'),
    card('logic', 'SAR logic', ['self-timed', `${d.decisions} raw decisions`, `${eng(ctx.tw / d.decisions, 's')} per decision at most`], logicPic(ctx), stateOf(ctx, ['dec'])),
    arrow(`${d.decisions} bits`),
    card('mismatch', 'Combiner + LUT', [`Σ dᵢ wᵢ → ${Math.round(P.outBits)} bit`, `weights: ${esc(String(P.calMethod).split(' (')[0])}`, `ENOB ${num(b.enob, 2)} (aim ${num(P.enobAim, 1)})`], lutPic(ctx), stateOf(ctx, ['enob'])),
    arrow(`${Math.round(P.outBits)} bits`),
    card('iq', 'IQ demodulator', [`mix with ${eng(P.f0, 'Hz')}`, `low-pass, ↓ ${Math.round(P.iqDecim)}`, `${eng(P.fs / Math.round(P.iqDecim), 'S/s')} I and Q`], iqPic(), 'ok'),
  ].join('');
  const feed = [
    `<div class="feed ref" data-go="sar"><b>Reference</b><span>VREF ${eng(P.vref, 'V')}, precharges the CDAC steps once per conversion</span><span class="to">→ CDAC</span></div>`,
    `<div class="feed clk" data-go="timing"><b>Clocks</b><span>CLK ${num(P.fs / 1e6, 0)} MHz and CLK 180° (${eng(ctx.tw / 2, 's')} later) write the cells</span><span class="to">→ beamformer, SAR logic</span></div>`,
    `<div class="feed cal" data-go="mismatch"><b>Calibration</b><span>weights into the LUT; comparator offset trimmed to ${eng(P.vosCal, 'V')}</span><span class="to">→ LUT, comparator</span></div>`,
  ].join('');
  return `<div class="chain">${main}</div><div class="feeds">${feed}</div>
    <p class="cap syscap">From the beamformer onward; everything before it is left out. A dot on a card is green when its checks pass, orange when one asks for a look, red when one fails. Click a card to open its page.</p>`;
}
