// Timing budget page: how one period is spent and what is left for the comparator and the logic.
// No comparator or logic delay is assumed. The switch resistance is not set, so it is swept.

import { card, fill, widthOf, plot, explain, eng, num, esc, COL } from '../kit.js';
import { timingCase, timingCases, stepCaps, stepSettling, PRIOR, cycleOf, MARGINAL } from '../../zaan/model/timingBudget.js';

// ngspice run of the settling (spice/settling.mjs); loaded like the data of the Conversion page
let spice = null;
let last = null;
const loaded = (async () => {
  try {
    spice = await (await fetch('src/workbench/data/spice-settling.json')).json();
  } catch {
    spice = null;
  }
  if (last && document.getElementById('tbSteps')) drawSteps(last);
})();

const SWEEP = [0, 250, 500, 1000, 2000];
const WORD = { fits: 'fits with margin', marginal: 'marginal', 'not shown': 'does not fit as shown so far' };
const CLS = { fits: 'ok', marginal: 'warn', 'not shown': 'bad' };
const GUO = cycleOf(PRIOR.guo);
const CHEN = cycleOf(PRIOR.chen);

/** The case the summary bar and the lead show: the present weights, ping-pong reference, no offset comparison. */
export function mainCase(ctx) {
  return timingCase(ctx.d, ctx.P, { ron: ctx.P.ron || 0, scheme: 'pingpong', extraHalf: false, offsetCmp: false, mode: ctx.P.swMode });
}

const caseName = (k) => `${k.decisions} decisions${k.offsetCmp ? ' + offset comparison' : ''}`;
const refName = (k) => (k.scheme === 'pingpong' ? 'two CDACs' : 'reservoir');
const ns = (t) => `${num(t * 1e9, 2)} ns`;
const table = (head, rows) => `<div class="tablewrap"><table class="tbl"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((x) => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

export const page = {
  id: 'timing',
  title: 'Timing budget',
  main() {
    return `${card('tbBars', 'How the 25 ns are spent, per case', '', 'wide')}
      ${card('tbVerdict', 'Time left per decision for comparator plus logic, and the verdict', '', 'wide')}
      ${card('tbSweep', 'Time left per decision against switch resistance', '', 'wide')}
      ${card('tbPrior', 'What Chen and Guo measured in 180 nm', '', 'wide')}
      ${card('tbParts', 'The intervals of one period', '', 'wide')}
      ${card('tbSteps', 'Settling of every CDAC step', '', 'wide')}
      ${explain('How to read this page', [
        'One period is 1 / fs. Part of it goes to things that can be calculated from capacitors and switch resistance: the read, the settling of every CDAC step, the node short for the offset comparison, the CDAC reset. What remains is divided over the decisions. That remainder is what the comparator and the logic together may take, per decision, on average.',
        'The comparator and logic delay are <b>not set</b>, because they need the PDK. The verdict therefore compares the time left with what was measured in the same node: Guo 2024 fits 11 comparison cycles in 25 ns, Chen 2018 fits 11 in 33.3 ns. Those numbers are upper limits of a whole cycle, including their own DAC settling.',
        '<b>Fits with margin</b>: the time left is at least the cycle Guo measured. <b>Marginal</b>: shorter, but by no more than Guo is shorter than Chen (25 %). <b>Does not fit as shown so far</b>: shorter than that; it needs a faster comparator and logic than either paper shows. The 25 % line is my choice (A).',
      ])}`;
  },
  update(store, ctx) {
    const { d, P } = ctx;
    const mode = P.swMode;
    const ron = P.ron || 0;
    const unset = !P.ron;
    const swText = mode === 'unit' ? 'one switch pair per unit capacitor' : 'the same switch for every capacitor';
    const cases = timingCases(d, P, ron, mode);

    // 1. bars
    const w = widthOf('tbBars', 1000);
    const x0 = 250;
    const sx = (t) => x0 + (t / 25e-9) * (w - x0 - 150) * (25e-9 * P.fs);
    const rowH = 30;
    const segCls = { read: 'ph-s', settle: 'ph-d', short: 'ph-l', rst: 'tb-rst' };
    const rows = cases.map((k, i) => {
      const y = 8 + i * rowH + (i >= 4 ? 10 : 0);
      let t = 0;
      let g = `<text x="8" y="${y + 16}" class="lbl">${esc(caseName(k))}</text>`;
      for (const p of k.parts) {
        if (p.t > 0) g += `<rect x="${sx(t)}" y="${y}" width="${Math.max(1, sx(t + p.t) - sx(t))}" height="22" class="${segCls[p.id]}"><title>${esc(p.label)}: ${ns(p.t)}</title></rect>`;
        t += p.t;
      }
      if (k.perCycle > 0) for (let c = 0; c < k.cycles; c++) g += `<rect x="${sx(t + c * k.perCycle)}" y="${y}" width="${Math.max(1, sx(t + (c + 1) * k.perCycle) - sx(t + c * k.perCycle) - 1)}" height="22" class="${c % 2 ? 'ph-c2' : 'ph-c'}"/>`;
      g += `<text x="${sx(k.period) + 8}" y="${y + 16}" class="tiny ${CLS[k.verdict] === 'bad' ? 'bad' : ''}">${k.perCycle > 0 ? `${k.cycles} × ${ns(k.perCycle)}` : 'no time left'}</text>`;
      return g;
    });
    const hBars = 8 + 8 * rowH + 34;
    const ticks = [0, 5, 10, 15, 20, 25].filter((t) => t * 1e-9 <= 1 / P.fs + 1e-12).map((t) => `<line x1="${sx(t * 1e-9)}" x2="${sx(t * 1e-9)}" y1="${hBars - 24}" y2="${hBars - 18}" class="tick"/><text x="${sx(t * 1e-9)}" y="${hBars - 4}" class="tiny" text-anchor="middle">${t} ns</text>`).join('');
    const groupLbl = `<text x="${x0 - 8}" y="${8 + 2 * rowH + 2}" class="tiny" text-anchor="end">two CDACs</text><text x="${x0 - 8}" y="${18 + 6 * rowH + 2}" class="tiny" text-anchor="end">reservoir</text>`;
    fill('tbBars', `<svg viewBox="0 0 ${w} ${hBars}" class="tsvg" role="img" aria-label="Timing budget per case">${rows.join('')}${groupLbl}${ticks}</svg>`,
      `${unset ? 'The switch resistance is not set, so these bars are for ideal switches: the upper limit of the time left. Set a value in the side panel to see the settling.' : `Switches of ${num(ron, 0)} Ω, ${swText}.`} Teal: CDAC settling. Violet: node short for the offset comparison. Grey: CDAC reset (reservoir only). Blue blocks: what is left, one block per comparison cycle, for comparator plus logic. Upper four rows: two CDACs that take turns, as in Chen 2018. Lower four: one CDAC that takes its charge from a reservoir, as in Guo 2024.`);

    // 2. verdict matrix over the sweep
    const cols = unset ? SWEEP : [...new Set([...SWEEP, ron])].sort((a, b) => a - b);
    const perR = cols.map((r) => timingCases(d, P, r, mode));
    // the reference scheme is a group row above its four cases, not a column repeated on every row
    const head = ['Case', 'Cycles', ...cols.map((r) => (r === 0 ? 'ideal switches' : `${num(r, 0)} Ω${r === ron && !unset ? ' (set)' : ''}`))];
    const verdictRow = (k, i) => `<tr><td>${esc(caseName(k))}</td><td class="num">${k.cycles}</td>${perR.map((list) => { const q = list[i]; return `<td class="num"><span class="tbv ${CLS[q.verdict]}" title="${WORD[q.verdict]}"><b>${q.perCycle > 0 ? ns(q.perCycle) : 'none'}</b></span></td>`; }).join('')}</tr>`;
    const body = cases.map((k, i) => `${i === 0 || refName(k) !== refName(cases[i - 1]) ? `<tr class="grp"><td colspan="${head.length}">${refName(k)}</td></tr>` : ''}${verdictRow(k, i)}`).join('');
    fill('tbVerdict', `<div class="tablewrap"><table class="tbl"><thead><tr>${head.map((h, j) => `<th${j ? ' class="num"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`,
      `Green: fits with margin. Amber: marginal. Red: does not fit as shown so far. Time left per decision = (1 / fs − read − CDAC settling − node short − CDAC reset) / cycles. Compared with the cycle Guo 2024 measured, at most ${ns(GUO)} (25 ns / 11), and Chen 2018, at most ${ns(CHEN)} (33.3 ns / 11). Switches: ${swText} (side panel). The sweep is not a choice of value. The two reference schemes differ only by the CDAC reset, because Guo's reservoir charges the CDAC during the first comparison, which needs no DAC (Guo 2024, p. 2607 and 2610).`);

    // 3. sweep plot
    const wp = widthOf('tbSweep');
    const pick = [0, 1, 2, 3];
    const colours = [COL.dig, COL.an, COL.ref, COL.bad];
    const line = (i) => [0, 2000].map((r) => [r, timingCases(d, P, r, mode)[i].perCycle * 1e9]);
    fill('tbSweep', plot({ x: { min: 0, max: 2000, label: 'switch on-resistance [Ω]' }, y: { min: 0, max: 3.2, label: 'time left per decision [ns]' }, series: pick.map((i, n) => ({ points: line(i).map(([r, t]) => [r, Math.max(0, t)]), color: colours[n], width: 2, label: caseName(cases[i]) })), hlines: [{ y: GUO * 1e9, color: COL.muted, dash: '6 3', label: 'Guo 2024' }, { y: CHEN * 1e9, color: COL.muted, dash: '2 3', label: 'Chen 2018' }, { y: GUO * (1 - MARGINAL) * 1e9, color: COL.bad, dash: '4 3' }], legend: true }, wp),
      `Two CDACs; the reservoir lines lie within ${ns(Math.max(...pick.map((i) => Math.abs(perR[perR.length - 1][i].perCycle - perR[perR.length - 1][i + 4].perCycle))))} of these. Dashed: the measured cycle of Guo and of Chen. Red dashed: 25 % below Guo, my line between marginal and not shown. ${mode === 'unit' ? 'With a switch pair per unit capacitor the settling hardly costs time.' : 'With the same switch on every capacitor the settling takes most of the period above a few hundred ohm.'}`);

    // 4. prior art
    fill('tbPrior', table(['', 'Chen 2018', 'Guo 2024', 'Zaan'], [
      ['Period', '33.3 ns (30 MS/s), p. 3053', '25 ns (40 MS/s), p. 2607', `${ns(1 / P.fs)}`],
      ['Comparison cycles', '10 + 1 for offset, Fig. 9(c) p. 3057', '11 (10 bit + 1 redundant), p. 2607', `${cases[0].cycles} to ${cases[3].cycles}`],
      ['Period / cycles', `at most ${ns(CHEN)}`, `at most ${ns(GUO)}`, `${ns(cases[0].period / cases[0].cycles)} to ${ns(cases[3].period / cases[3].cycles)}`],
      ['Reference', 'two CDACs take turns; precharge 25 ns, 3/4 of the period, p. 3056', 'one CDAC; reservoir recharged for 12.5 ns during the conversion, shared with the CDAC during the MSB comparison, p. 2610', 'not decided'],
      ['Inside the period besides the cycles', 'a short interval for charge redistribution, length not given, p. 3053; node reset during the offset cycle', 'CDAC reset at the end (Fig. 9(b)), length not given', 'see the intervals below'],
      ['Comparator', 'double-tail latch, first stage sized for noise, p. 3057', 'dynamic integrator with double integration; its integration time is "strictly limited by the AD conversion speed", p. 2609', 'not decided'],
    ]), 'Neither paper gives the comparator delay, the logic delay or the settling time by itself. Period divided by cycles is therefore an upper limit of one whole cycle, not a measured comparator speed.');

    // 5. intervals of the heaviest case
    const heavy = timingCase(d, P, { ron: 1000, scheme: 'reservoir', extraHalf: true, offsetCmp: true, mode });
    const partRow = (p) => [esc(p.label), unset ? `${ns(p.t)} per kΩ` : `${ns((p.t * ron) / 1000)}`, `<span class="stat st-${p.status}">${p.status}</span>`, esc(p.source)];
    fill('tbParts', table(['Interval', unset ? 'Length' : `Length at ${num(ron, 0)} Ω`, 'Status', 'How it is found'], [
      ...heavy.parts.map(partRow),
      ['Comparator decision plus logic, per cycle', 'not set', '', 'needs the PDK; this page reports what is left for it'],
      ['Precharge of the idle CDAC (two CDACs)', 'no time from the conversion', '<span class="stat st-S">S</span>', `Chen 2018, p. 3056. At 40 MS/s the idle CDAC has at most ${ns(1 / P.fs)} for reset and precharge; Chen used 25 ns of 33.3 ns. A shorter precharge time weighs the clock jitter more (Budget, line T int)`],
      ['Recharge of the reservoir', 'no time from the conversion', '<span class="stat st-S">S</span>', 'Guo 2024, p. 2610, Fig. 9(b): T CHG = 12.5 ns while the conversion runs'],
      ['Reservoir shares with the CDAC', 'inside the first comparison', '<span class="stat st-S">S</span>', `Guo 2024, p. 2607. It must end within one cycle. With C RSV = C DAC (Guo p. 2610) and settling to ½ LSB of full scale, the reservoir switch must stay below about ${num(timingCase(d, P, { ron, scheme: 'reservoir', extraHalf: true, offsetCmp: true, mode }).rRsvMax, 0)} Ω (D). A repeatable error here is only a gain error, so this is on the safe side`],
    ]), `Case shown: reservoir, ${heavy.decisions} decisions, offset comparison. Every calculated length is proportional to the switch resistance. The read takes no time while the node parasitic is ${P.cpar ? eng(P.cpar, 'F') : 'not set'}: the node sits at the average of the cell voltages at once, and only its own parasitic has to be charged.`);

    last = ctx;
    drawSteps(ctx);
  },
};

function drawSteps(ctx) {
  const { d, P } = ctx;
  const mode = P.swMode;
  const st = stepSettling(stepCaps(d), 1000, mode);
  const sp = spice ? spice.runs.find((r) => r.mode === mode) : null;
  const same = spice && JSON.stringify(spice.weights) === JSON.stringify(d.weights);
  fill('tbSteps', table(['Step', 'Weight [LSB]', 'Capacitor', 'On the nodes before', 'Own time constant per kΩ', 'Tolerance of the next decision [LSB]', 'Settling per kΩ, redundant', 'Settling per kΩ, to ½ LSB', 'ngspice / model'],
    st.map((s, j) => [`${j + 1}`, num(s.w, s.w < 1 ? 1 : 0), eng(s.c, 'F'), eng(s.cd, 'F'), ns(s.tau), num(s.tolNext, 1), `<b>${ns(s.tRed)}</b>`, ns(s.tBin), same && sp ? num(sp.steps[j].tSpice / sp.steps[j].tModel, 2) : 'other weights'])),
    `Own time constant: τ = 2 R C j C d / (C j + C d), the new capacitor with what is on the nodes. ${mode === 'same' ? 'With the same switch everywhere a small step settles much slower than its own time constant: the node first moves too far and then comes back with the time constant of the largest capacitor, which is still connected behind its own switches.' : 'With a switch pair per unit capacitor every branch has the same R C, so no slow tail remains.'} Sum, redundant: ${ns(st.reduce((a, s) => a + s.tRed, 0))} per kΩ; to ½ LSB: ${ns(st.reduce((a, s) => a + s.tBin, 0))} per kΩ. Worst case residue, earlier steps taken as settled (optimistic), memory cells as one capacitor. ${sp ? `ngspice ${esc(spice.ngspice)} with ideal switches of ${num(sp.ron, 0)} Ω, time to e⁻³ of the start (spice/settling.mjs, ${esc(spice.generated)}).` : 'ngspice data not loaded.'}`);
}
