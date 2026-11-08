// Complete schematic as one SVG in world units (2400 × 1300).
// Level 1: system blocks with summaries. Level 2: switches, capacitors, nets.
// Level 3: component values. Elements carry data-el for the inspector; parts the
// conversion animation moves carry ids. Uncited structures are dashed and marked "?".

import { eng, num, esc } from '../zaan/ui/fmt.js';

export const WORLD = { w: 2400, h: 1300 };

/** Parent block of each element, for the Block zoom level. */
export const PARENT = { cdacP: 'node', cdacN: 'node', cell: 'bf', wptr: 'bf', rsel: 'bf', chbus: 'bf', sw: 'bf', ocal: 'comp', lut: 'comb', clk180: 'clk', start: 'clk', calmode: 'clk' };

/** Bounding boxes of the blocks, used for zooming to a block. */
export const BOXES = {
  lna: [40, 140, 240, 760], test: [40, 940, 240, 160], bf: [320, 140, 650, 960], node: [1010, 140, 570, 700],
  cdacP: [1010, 140, 570, 330], cdacN: [1010, 500, 570, 340], ref: [1010, 880, 570, 220], comp: [1620, 300, 260, 340], ocal: [1620, 520, 260, 120],
  logic: [1620, 690, 260, 410], reg: [1920, 140, 440, 280], comb: [1920, 460, 440, 280], lut: [1920, 460, 440, 280], iq: [1920, 780, 440, 180],
  clk: [40, 1140, 2320, 130], clk180: [40, 1140, 2320, 130], start: [40, 1140, 2320, 130], calmode: [40, 1140, 2320, 130],
  cell: [340, 190, 610, 340], wptr: [350, 560, 290, 70], rsel: [660, 560, 290, 70], chbus: [350, 660, 600, 290], sw: [340, 190, 610, 340], sys: [0, 0, 2400, 1300],
};

const T = (x, y, s, cls = '', a = 'start') => `<text x="${x}" y="${y}" class="${cls}" text-anchor="${a}">${s}</text>`;
const L = (pts, cls, id = '') => `<path ${id ? `id="${id}"` : ''} d="M${pts.map((p) => p.join(' ')).join(' L')}" class="${cls}"/>`;

function block(id, title, summary, [x, y, w, h], opts = {}) {
  return `<g class="blk ${opts.unknown ? 'unknown' : ''}" data-el="${id}">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" class="bbox"/>
    <g class="l1">${T(x + 16, y + 34, esc(title), 'bt')}</g>
    <g class="l2">${T(x + 12, y - 8, esc(title), 'bt2')}</g>
    ${summary ? `<g class="l1">${summary.map((s, i) => T(x + 16, y + 80 + i * 40, s, 'bsum')).join('')}</g>` : ''}
  </g>`;
}

/** Capacitor with horizontal plates, centred at x; top plate at y. */
function cap(x, y, w = 24, cls = 'cap', id = '') {
  return `<g ${id ? `id="${id}"` : ''} class="${cls}"><line x1="${x - w / 2}" x2="${x + w / 2}" y1="${y}" y2="${y}"/><line x1="${x - w / 2}" x2="${x + w / 2}" y1="${y + 7}" y2="${y + 7}"/></g>`;
}

/** Switch from (x1,y1) to (x2,y2); open by default, the animation closes it. */
function sw(x1, y1, x2, y2, id, cls = 'sw') {
  const ox = x2 + (y2 === y1 ? 0 : 9);
  const oy = y2 - (y2 === y1 ? 9 : 0);
  return `<g class="${cls}" data-el="sw"><circle cx="${x1}" cy="${y1}" r="3"/><circle cx="${x2}" cy="${y2}" r="3" class="sw-c"/><line id="${id}" x1="${x1}" y1="${y1}" x2="${ox}" y2="${oy}" data-open="${ox} ${oy}" data-closed="${x2} ${y2}"/></g>`;
}

export function buildSchematic(ctx, values) {
  const { P, d, halfSteps, qd, tw } = ctx;
  const val = (id) => values.find((v) => v.id === id);
  const refVar = val('refVariant').value;
  const feType = val('feType').value;
  const M = P.memCells ?? ctx.cells;
  const out = [`<svg id="schem" viewBox="0 0 ${WORLD.w} ${WORLD.h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Zaan schematic">`];
  out.push('<defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" class="gridline"/></pattern><marker id="ar" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" class="arrowhead"/></marker></defs>');
  out.push(`<rect x="-2000" y="-2000" width="${WORLD.w + 4000}" height="${WORLD.h + 4000}" fill="url(#grid)" data-el="sys"/>`);
  out.push(T(40, 90, 'Zaan · charge-sharing SAR ADC with merged receive beamformer · one tile', 'title'));

  // ---------- blocks (level 1 summaries) ----------
  out.push(block('lna', '16 LNA outputs', [`type: ${feType ?? '?'}`, `R drive: ${val('rDrive').value ?? '?'} kΩ`, `Smax ${num(val('sMaxAfe').value, 0)} mV rms`], BOXES.lna, { unknown: !feType }));
  out.push(block('test', 'Test input', ['sine or ramp, cal mode'], BOXES.test));
  out.push(block('bf', 'Beamformer: memory cells', [`${P.channels} ch × ${M} cells, CM ${eng(d.cm, 'F')}`, `step ${eng(P.delayStep, 's')}: ${halfSteps.filter((x) => x).length} ch on CLK 180°`, `longest delay ${eng(ctx.tauMax, 's')}`], BOXES.bf));
  out.push(block('node', 'Charge-sharing node and CDAC', [`${d.weights.length} steps: ${d.weights.slice(0, 4).map((w) => num(w, 0)).join(', ')} … LSB`, `${d.decisions} decisions, CDAC ${eng(d.cdac, 'F')}`, `node ${eng(d.cNode[0], 'F')} → ${eng(d.cNode[d.decisions - 1], 'F')}`], BOXES.node));
  out.push(block('ref', 'Reference VREF', [`${eng(P.vref, 'V')}, variant: ${refVar ?? '?'}`], BOXES.ref, { unknown: !refVar }));
  out.push(block('comp', 'Comparator', [`τ ${eng(ctx.D.tauComp.value, 's')}`, `LSB ${eng(ctx.D.vLsbLast.value, 'V')} at the end`], [1620, 300, 260, 210]));
  out.push(block('ocal', 'Offset calibration', [], BOXES.ocal));
  out.push(block('logic', 'Self-timed SAR logic', [`${d.decisions} decisions`, `median ${eng(ctx.timing.median, 's')}`, `of ${eng(tw, 's')}`], BOXES.logic));
  out.push(block('reg', 'Output register', [], BOXES.reg));
  out.push(block('comb', 'Combiner and LUT', [`D = Σ dᵢ wᵢ → ${P.bits} bit`, `LUT: ${val('lutType').value ?? '? (per bit or code)'}`], BOXES.comb));
  out.push(block('iq', 'IQ demodulator', [`mix f0 = ${eng(P.f0, 'Hz')}`, `extent: ${val('iqExtent').value ?? '?'}`], BOXES.iq, { unknown: !val('iqExtent').value }));

  // ---------- inter-block nets (level 1 and up) ----------
  out.push(L([[280, 520], [320, 520]], 'n-an thick', 'net-in'));
  out.push(L([[280, 1020], [300, 1020], [300, 560], [320, 560]], 'n-cal thick', 'net-test'));
  out.push(L([[970, 600], [990, 600], [990, 420], [1010, 420]], 'n-an thick', 'net-bf'));
  out.push(L([[1580, 420], [1620, 420]], 'n-an thick', 'net-p'));
  out.push(L([[1580, 560], [1600, 560], [1600, 470], [1620, 470]], 'n-an thick', 'net-n'));
  out.push(L([[1750, 510], [1750, 690]], 'n-dig thick', 'net-dec'));
  out.push(L([[1880, 760], [1900, 760], [1900, 280], [1920, 280]], 'n-dig thick', 'net-reg'));
  out.push(L([[2140, 420], [2140, 460]], 'n-dig thick'));
  out.push(L([[2140, 740], [2140, 780]], 'n-dig thick'));
  out.push(L([[2360, 870], [2390, 870]], 'n-dig thick') + T(2392, 862, 'image', 'lbl', 'end'));
  out.push(L([[1290, 880], [1290, 845]], 'n-ref thick', 'net-ref'));
  out.push(L([[1750, 1100], [1750, 1120], [1000, 1120], [1000, 470]], 'n-clk dash', 'net-ctl'));
  out.push(T(1010, 1112, 'switch control s1 … s' + d.weights.length, 'lbl n-clk-t'));
  out.push(L([[2360, 300], [2390, 300]], 'n-cal thick') + T(2392, 292, 'raw off chip', 'lbl', 'end'));

  // register bits (visible at every level: the animation fills them)
  const n = d.decisions;
  const bw = Math.min(32, 400 / n);
  for (let i = 0; i < n; i++) {
    out.push(`<g class="rbit" data-el="reg"><rect id="rb-${i}" x="${1940 + i * bw}" y="${300}" width="${bw - 4}" height="44" rx="4"/>${T(1940 + i * bw + (bw - 4) / 2, 330, '·', 'rbt', 'middle').replace('<text', `<text id="rbt-${i}"`)}</g>`);
  }
  out.push(T(1940, 380, `d1 … d${n}: raw decisions`, 'lbl'));
  out.push(`<g class="l1">${T(1640, 610, 'trim pair, charge pump', 'bsum')}</g>`);
  out.push(`<text id="compOut" x="1840" y="420" class="bigv" text-anchor="middle">·</text>`);
  out.push(`<text id="nodeV" x="1570" y="405" class="nodev" text-anchor="end"></text>`);

  // ---------- level 2: inside the blocks ----------
  const l2 = [];
  // LNA channel 1 source and stacked channels
  l2.push(`<g data-el="lna"><circle cx="100" cy="300" r="26" class="src"/>${T(100, 308, '~', 'srct', 'middle')}${L([[126, 300], [150, 300]], 'n-an')}<path d="M150 300 l8 -10 l12 20 l12 -20 l12 20 l12 -20 l8 10" class="res"/>${L([[214, 300], [260, 300], [260, 520], [280, 520]], 'n-an')}${T(150, 270, 'R drive ' + (val('rDrive').value ?? '?') + ' kΩ', 'lbl')}${T(60, 360, 'channel 1', 'lbl')}</g>`);
  for (let k = 0; k < 4; k++) l2.push(`<rect x="${70 + k * 8}" y="${420 + k * 8}" width="170" height="120" rx="8" class="stack" data-el="lna"/>`);
  l2.push(T(80, 480, 'channels 2 to 16', 'lbl') + T(80, 506, 'same source and R', 'lbl dim'));
  l2.push(`<g data-el="test"><circle cx="100" cy="1030" r="22" class="src cal"/>${T(100, 1037, '~', 'srct', 'middle')}${sw(130, 1030, 190, 1030, 'sw-test', 'sw cal')}${L([[190, 1030], [280, 1020]], 'n-cal')}${T(130, 1075, 'TEST (cal mode)', 'lbl')}</g>`);
  // channel 1 memory cells: two rows
  const cw = 52;
  for (let i = 0; i < M; i++) {
    const row = i < Math.ceil(M / 2) ? 0 : 1;
    const col = row ? i - Math.ceil(M / 2) : i;
    const x = 380 + col * cw;
    const y0 = row ? 380 : 210;
    l2.push(`<g data-el="cell" id="cell-${i}">${sw(x, y0, x, y0 + 30, `wsw-${i}`, 'sw')}${cap(x, y0 + 38, 26, 'cap mem')}${sw(x, y0 + 52, x, y0 + 82, `rsw-${i}`, 'sw')}${T(x, y0 + 106, String(i + 1), 'idx', 'middle')}</g>`);
  }
  l2.push(L([[300, 520], [330, 520], [330, 210], [380 + (Math.ceil(M / 2) - 1) * cw, 210]], 'n-an'));
  l2.push(L([[330, 380], [380 + (M - Math.ceil(M / 2) - 1) * cw, 380]], 'n-an'));
  l2.push(L([[380, 292], [380 + (Math.ceil(M / 2) - 1) * cw, 292], [940, 292], [940, 600]], 'n-an', 'rbus1'));
  l2.push(L([[380, 462], [380 + (M - Math.ceil(M / 2) - 1) * cw, 462], [940, 462]], 'n-an'));
  l2.push(T(350, 200, 'write bus, channel 1', 'lbl'));
  l2.push(`<g data-el="wptr"><rect x="350" y="560" width="290" height="70" rx="8" class="sub"/>${T(362, 590, 'write pointer (ring counter)', 'lbl')}${T(362, 616, 'CLK or CLK 180°, per channel', 'lbl dim')}</g>`);
  l2.push(`<g data-el="rsel"><rect x="660" y="560" width="290" height="70" rx="8" class="sub"/>${T(672, 590, 'read select', 'lbl')}${T(672, 616, 'same cell index, all channels', 'lbl dim')}</g>`);
  // channels 2..16 with their clock
  l2.push(`<g data-el="chbus"><rect x="350" y="660" width="600" height="290" rx="10" class="sub"/>${T(366, 692, 'channels 1 to 16: delay steps and write clock', 'lbl')}`);
  const N = P.channels;
  const gw = Math.min(34, 560 / N);
  for (let c = 0; c < N; c++) {
    const on180 = halfSteps[c];
    const stepsHalf = Math.round(qd[c] / (tw / 2));
    l2.push(`<rect x="${366 + c * gw}" y="712" width="${gw - 5}" height="40" rx="4" class="${on180 ? 'chip180' : 'chip0'}"/>${T(366 + c * gw + (gw - 5) / 2, 738, String(c + 1), 'idx', 'middle')}`);
    l2.push(`<g class="l3">${T(366 + c * gw + (gw - 5) / 2, 776, String(stepsHalf / 2), 'tiny', 'middle')}</g>`);
  }
  l2.push(`<rect x="366" y="800" width="14" height="14" class="chip0"/>${T(388, 813, 'CLK (rising edge)', 'lbl dim')}<rect x="590" y="800" width="14" height="14" class="chip180"/>${T(612, 813, 'CLK 180°', 'lbl dim')}`);
  l2.push(`<g class="l3">${T(366, 790, 'delay in 25 ns slots', 'tiny')}</g>`);
  l2.push(T(366, 850, `${N} × ${M} × 2 sides = ${N * M * 2} memory capacitors`, 'lbl'));
  l2.push(T(366, 880, `cells needed for ±${num(P.steer * (180 / Math.PI), 1)}°: ${ctx.need.m}`, `lbl ${ctx.need.m > M ? 'bad' : ''}`));
  l2.push(L([[950, 760], [990, 760], [990, 600]], 'n-an thick'));
  l2.push('</g>');
  // node nets and CDAC halves
  l2.push(L([[1010, 420], [1580, 420]], 'n-an thick', 'sumP') + T(1020, 410, 'SUM +', 'lbl'));
  l2.push(L([[1010, 560], [1580, 560]], 'n-an thick', 'sumN') + T(1020, 590, 'SUM −', 'lbl'));
  l2.push(L([[1010, 175], [1570, 175]], 'n-ref') + T(1020, 166, 'VREF precharge', 'lbl n-ref-t'));
  l2.push(L([[1010, 805], [1570, 805]], 'n-ref') + T(1020, 830, 'VREF precharge', 'lbl n-ref-t'));
  l2.push(L([[1290, 845], [1290, 805]], 'n-ref'));
  const sx = (i) => 1060 + i * Math.min(46, 480 / d.weights.length);
  d.weights.forEach((w, i) => {
    const half = d.steps[i].kind !== 'cap';
    const x = sx(i);
    l2.push(`<g data-el="cdacP">${sw(x, 175, x, 205, `psw-${i}`, 'sw ref')}${cap(x, 230, 24, half ? 'cap half' : 'cap', `capP-${i}`)}${sw(x, 260, x, 420, `ssw-p-${i}`, 'sw')}${T(x, 300, num(w, 0), 'wlbl', 'middle')}<g class="l3">${T(x, 330, d.steps[i].kind === 'cap' ? `${d.steps[i].units}Cu` : '½ⁿ', 'tiny', 'middle')}${T(x, 350, eng(d.steps[i].kind === 'cap' ? d.steps[i].units * P.cu : P.cu, 'F', 2), 'tiny', 'middle')}</g></g>`);
    l2.push(`<g data-el="cdacN">${sw(x, 805, x, 775, `nsw-${i}`, 'sw ref')}${cap(x, 742, 24, half ? 'cap half' : 'cap', `capN-${i}`)}${sw(x, 735, x, 560, `ssw-n-${i}`, 'sw')}${T(x, 690, num(w, 0), 'wlbl', 'middle')}</g>`);
  });
  l2.push(T(1060, 470, 'step weights in LSB; purple: charge halving', 'lbl dim'));
  l2.push(`<g class="l3">${T(1060, 640, `node: ${eng(d.cNode[0], 'F')} at decision 1, ${eng(d.cNode[d.decisions - 1], 'F')} at the last`, 'tiny')}</g>`);
  // reference variants
  const variants = ['ping-pong CDAC', 'reservoir C RSV with servo (Guo 2024)', 'external pin (DFT)'];
  l2.push(`<g data-el="ref"><circle cx="1070" cy="1010" r="24" class="src ref"/>${T(1070, 1017, 'V', 'srct', 'middle')}${T(1110, 940, 'variant (none decided):', 'lbl')}`);
  variants.forEach((name, k) => {
    const y = 970 + k * 34;
    const on = refVar === name;
    l2.push(`<line x1="1094" y1="1010" x2="1150" y2="${y}" class="vsw ${on ? 'on' : refVar ? '' : 'unknown'}"/>${T(1160, y + 6, (on ? '● ' : '○ ') + name, `lbl ${on ? 'n-ref-t' : 'dim'}`)}`);
  });
  l2.push(T(1110, 1086, 'shared with sensitive analog channels: no switching spikes', 'lbl warnt'));
  l2.push('</g>');
  // comparator
  l2.push(`<g data-el="comp"><path d="M1660 380 L1660 500 L1760 440 Z" class="compsym"/>${T(1670, 425, '+', 'lbl')}${T(1670, 485, '−', 'lbl')}${L([[1620, 420], [1660, 420]], 'n-an')}${L([[1620, 470], [1660, 470]], 'n-an')}${L([[1760, 440], [1800, 440]], 'n-dig')}</g>`);
  l2.push(`<g data-el="ocal">${T(1636, 580, 'charge pump trims an aux pair', 'lbl dim')}${T(1636, 606, '(Chen 2018 p. 3058)', 'lbl dim')}</g>`);
  // logic with handshake
  l2.push(`<g data-el="logic"><rect x="1650" y="760" width="200" height="90" rx="8" class="sub"/>${T(1662, 792, 'decision k', 'lbl')}${T(1662, 820, 'set switch s(k), k+1', 'lbl dim')}
    <path id="hs" d="M1700 860 C1700 960, 1800 960, 1800 860" class="n-clk hs"/>${T(1662, 990, 'ready / valid handshake', 'lbl')}${T(1662, 1018, 'next step starts when ready', 'lbl dim')}</g>`);
  // combiner, LUT, IQ
  l2.push(`<g data-el="comb"><rect x="1940" y="510" width="180" height="90" rx="8" class="sub"/>${T(1952, 545, 'D = Σ dᵢ wᵢ', 'lbl')}${T(1952, 575, `round to ${P.bits} bit`, 'lbl dim')}</g>`);
  const lutRows = (ctx.sim?.cal?.w ?? d.weights).slice(0, 4).map((w, i) => T(2150, 540 + i * 26, `w${i + 1} = ${num(w, 2)}`, 'tiny'));
  l2.push(`<g data-el="lut"><rect x="2140" y="510" width="200" height="200" rx="8" class="sub ${ctx ? '' : ''}"/>${T(2150, 526, 'LUT', 'lbl')}${lutRows.join('')}${T(2150, 680, 'calibrated, this chip', 'tiny')}</g>`);
  l2.push(`<g data-el="iq">${T(1940, 900, 'cos and sin at f0, low-pass, decimate', 'lbl dim')}</g>`);
  out.push(`<g class="l2">${l2.join('')}</g>`);

  // ---------- clocks and control band ----------
  out.push(`<g data-el="clk">${L([[60, 1170], [2340, 1170]], 'n-clk')}${T(60, 1160, 'CLK 40 MHz (write, rising edge)', 'lbl n-clk-t')}${L([[500, 1170], [500, 630]], 'n-clk dash')}</g>`);
  out.push(`<g data-el="clk180">${L([[60, 1200], [2340, 1200]], 'n-clk')}${T(560, 1192, 'CLK 180° (write, 12.5 ns later)', 'lbl n-clk-t')}${L([[520, 1200], [520, 630]], 'n-clk dash')}</g>`);
  out.push(`<g data-el="start">${L([[60, 1230], [2340, 1230]], 'n-clk')}${T(1060, 1222, 'conversion start', 'lbl n-clk-t')}${L([[1700, 1230], [1700, 1100]], 'n-clk dash')}</g>`);
  out.push(`<g data-el="calmode">${L([[60, 1260], [2340, 1260]], 'n-cal')}${T(1500, 1252, 'calibration mode', 'lbl n-cal-t')}${L([[160, 1260], [160, 1100]], 'n-cal dash')}${L([[2350, 1260], [2350, 300]], 'n-cal dash')}</g>`);

  out.push('<g id="dots"></g><rect id="hilite" x="0" y="0" width="0" height="0" rx="18" class="hilite"/>');
  out.push('</svg>');
  return out.join('');
}
