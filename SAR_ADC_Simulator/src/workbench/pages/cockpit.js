// Cockpit: the design at a glance for a system engineer.
//   1. the key readings, each linked to the page that explains it
//   2. where the values come from: S (paper), D (derived), A (assumption), U (owner decision)
//   3. sensitivity: which uncertain values move the ENOB and the time per decision most,
//      found by running the whole design again with each value at half and at twice its setting.
// A value whose status is A is a placeholder until the PDK, MATLAB or Cadence confirms it; the
// sensitivity says which of those to confirm first.

import { fill, readouts, explain, eng, num, esc, statusChip } from '../kit.js';
import { design } from '../design.js';
import { mainCase } from './timing.js';

const KEYS = ['cellQ', 'compNoise', 'vosCal', 'cpar', 'aMom', 'pairSigma', 'cm', 'nTau', 'tComp', 'jitter', 'kick', 'tLogic'];
let sens = null;
let running = false;

function scenario(store, id, factor) {
  const vals = store.values.map((x) => ({ ...x }));
  const v = vals.find((x) => x.id === id);
  if (!v || v.kind === 'choice' || v.value === null || v.value === '') return null;
  const x = Number(v.value);
  const [lo, hi] = v.range || [0, Infinity];
  v.value = x === 0 ? (factor > 1 ? (hi - lo) / 4 : 0) : Math.min(hi, Math.max(lo, x * factor));
  return design(vals, store.ui);
}

const reading = (c) => ({ enob: c.budget.enob, t: mainCase(c).perCycle, fails: c.checks.filter((k) => k.state === 'bad').length });

export const page = {
  id: 'cockpit',
  title: 'Cockpit',
  main() {
    return `<section class="card wide"><header><h3>The design now</h3></header><div class="cbody" id="ckRead"></div></section>
      <div class="grid2"><section class="card"><header><h3>Where the values come from</h3></header><div class="cbody" id="ckSrc"></div><p class="cap" id="ckSrc-cap"></p></section>
      <section class="card"><header><h3>What to confirm next</h3></header><div class="cbody" id="ckNext"></div></section></div>
      <section class="card wide"><header><h3>Sensitivity: each uncertain value at ½ × and 2 ×</h3><span class="ctl"><button class="mini primary" id="ckRun">run sensitivity</button></span></header><div class="cbody" id="ckSens"></div><p class="cap" id="ckSens-cap"></p></section>
      ${explain('How to use this page', [
        'Start here after any change. The readings at the top are the same numbers the other pages show; click one to see where it comes from.',
        'Every value carries a status. S comes from a paper or the PDK with a page, D is derived, A is an assumption, U is your decision. An A that moves the result a lot is the next thing to measure in MATLAB or Cadence.',
        'The sensitivity runs the whole design again for each value at half and at twice its setting (a value set to zero is tried at a quarter of its range). It takes a few seconds.',
      ])}`;
  },
  mount(store) {
    document.getElementById('ckRun').onclick = () => {
      if (running) return;
      running = true;
      const base = reading(store.ctx);
      const rows = [];
      const ids = KEYS.filter((id) => store.values.some((v) => v.id === id));
      let k = 0;
      const step = () => {
        if (k >= ids.length) {
          rows.sort((a, b) => b.span - a.span);
          sens = { base, rows };
          running = false;
          page.update(store, store.ctx);
          return;
        }
        const id = ids[k++];
        const lo = scenario(store, id, 0.5);
        const hi = scenario(store, id, 2);
        if (lo && hi) {
          const a = reading(lo), b = reading(hi);
          rows.push({ id, lo: a, hi: b, span: Math.abs(b.enob - a.enob) + Math.abs(b.t - a.t) / Math.max(base.t, 1e-12) });
        }
        fill('ckSens', `<p class="cap">Running ${k} of ${ids.length}: ${esc(id)}</p>`);
        setTimeout(step, 0);
      };
      setTimeout(step, 0);
    };
  },
  update(store, ctx) {
    const { P, d, budget } = ctx;
    const mc = mainCase(ctx);
    const fails = ctx.checks.filter((k) => k.state === 'bad'), warns = ctx.checks.filter((k) => k.state === 'warn');
    fill('ckRead', readouts([
      ['ENOB, noise budget', `${num(budget.enob, 2)}`, `aim ${num(P.enobAim, 1)}`, budget.ok ? 'ok' : 'bad', null],
      ['Checks', fails.length ? `${fails.length} fail` : warns.length ? `${warns.length} to look at` : 'all pass', `${ctx.checks.length} checks`, fails.length ? 'bad' : warns.length ? 'warn' : 'ok'],
      ['Time per decision', eng(mc.perCycle, 's'), mc.verdict, { fits: 'ok', marginal: 'warn' }[mc.verdict] || 'bad'],
      ['Decisions', `${d.decisions}`, `weights ${d.weights.slice(0, 4).map((w) => num(w, 0)).join(' ')} …`],
      ['1 LSB', eng(d.qLsb, 'C'), `C DAC ${eng(d.cdac, 'F')}`],
      ['Capacitors', `${store.values.find((v) => v.id === 'capCdac')?.value} CDAC`, `memory cells ${store.values.find((v) => v.id === 'capMem')?.value}, ${eng(d.cm, 'F')}`],
      ['Capacitor area', `${num(ctx.areaTotal * 1e6, 3)} mm²`, 'memory cells and CDAC'],
    ]));
    const used = store.values;
    const cnt = { S: 0, D: 0, A: 0, U: 0 };
    used.forEach((v) => { if (cnt[v.status] !== undefined) cnt[v.status]++; });
    const tot = Object.values(cnt).reduce((a, b) => a + b, 0);
    const col = { S: 'var(--an)', D: 'var(--clk)', A: 'var(--warn)', U: 'var(--dig)' };
    const name = { S: 'from a paper or the PDK', D: 'derived', A: 'assumption', U: 'your decision' };
    fill('ckSrc', `<div class="srcbar">${Object.entries(cnt).map(([k, n]) => `<span style="width:${(100 * n) / tot}%;background:${col[k]}" title="${k}: ${n}"></span>`).join('')}</div>
      <table class="tbl"><tbody>${Object.entries(cnt).map(([k, n]) => `<tr><td>${statusChip(k)} ${name[k]}</td><td class="num">${n}</td><td class="num">${num((100 * n) / tot, 0)} %</td></tr>`).join('')}</tbody></table>`,
    `${tot} values. Change a status or a source on the Values page.`);
    const assumed = KEYS.map((id) => store.values.find((v) => v.id === id)).filter((v) => v && v.status === 'A');
    const order = sens ? sens.rows.map((r) => r.id) : KEYS;
    const next = order.map((id) => assumed.find((v) => v.id === id)).filter(Boolean).slice(0, 6);
    fill('ckNext', `<table class="tbl"><thead><tr><th>Assumed value</th><th class="num">now</th><th>how to confirm</th></tr></thead><tbody>${next.map((v) => `<tr><td>${esc(v.label)}</td><td class="num">${esc(String(v.value))} ${esc(v.unit || '')}</td><td>${esc(HOW[v.id] || 'MATLAB or Cadence')}</td></tr>`).join('')}</tbody></table><p class="cap">${sens ? 'Ordered by the sensitivity below.' : 'Run the sensitivity to order these by how much they matter.'}</p>`);
    if (!sens) { fill('ckSens', '<p class="cap">Press run sensitivity. The design is run 24 times.</p>'); return; }
    const maxE = Math.max(0.05, ...sens.rows.map((r) => Math.max(Math.abs(r.lo.enob - sens.base.enob), Math.abs(r.hi.enob - sens.base.enob))));
    const bar = (dl, dh) => {
      const pos = (x) => 50 + (50 * x) / maxE;
      const seg = (x, cls) => { const a = Math.min(pos(0), pos(x)), b = Math.max(pos(0), pos(x)); return `<span class="${cls}" style="left:${a}%;width:${b - a}%"></span>`; };
      return `<div class="bar">${seg(dl, 'lo')}${seg(dh, 'hi')}<span class="mid"></span></div>`;
    };
    fill('ckSens', `<div class="sens"><span class="sh2">value</span><span class="sh2">status</span><span class="sh2">ENOB change: ½ × (blue), 2 × (amber)</span><span class="sh2">time / decision</span>
      ${sens.rows.map((r) => { const v = store.values.find((x) => x.id === r.id); const de = (x) => x.enob - sens.base.enob; return `<span>${esc(v.label)}</span><span>${statusChip(v.status)}</span>${bar(de(r.lo), de(r.hi))}<span class="num">${num((r.lo.t - sens.base.t) * 1e12, 0)} / ${num((r.hi.t - sens.base.t) * 1e12, 0)} ps</span>`; }).join('')}</div>`,
    `Base: ENOB ${num(sens.base.enob, 2)}, ${eng(sens.base.t, 's')} per decision. Bars span ±${num(maxE, 2)} bit. Ordered by total effect. Rerun after changing values.`);
  },
};

const HOW = {
  cellQ: 'Cadence Monte Carlo of one memory cell switch (charge left on the cell)',
  compNoise: 'Cadence noise run of the comparator (probability of a 1 against input)',
  vosCal: 'Comparator offset Monte Carlo, after the chosen calibration',
  cpar: 'Extraction of the summing bus after layout (PEX)',
  tComp: 'Cadence delay against input of the comparator',
  kick: 'Cadence kickback onto the CDAC node',
  tLogic: 'Standard cell timing of the SAR logic loop',
  nTau: 'Owner choice; follows from the time table',
  jitter: 'Clock source specification',
  cm: 'Owner choice: area against tones and kT/C',
};
