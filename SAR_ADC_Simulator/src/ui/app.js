/**
 * Dashboard controller: owns the UI state, rebuilds the model when parameters
 * change and dispatches rendering. Physics lives only in src/model.
 */
import { DEFAULT_CONFIG, cloneConfig, deepMerge } from '../model/config.js';
import { createAdc } from '../model/adc.js';
import { convert } from '../model/sar.js';
import { createRng } from '../model/rng.js';
import { getScheme } from '../model/switching/index.js';
import { renderParams, bindParams, setPath, getPath, updateDerived } from './params.js';
import { renderSchematic, legendHtml, chargeScale } from './schematic.js';
import { renderCharge } from './chargePanel.js';
import { renderSequence } from './sequence.js';
import { renderWaveforms } from './waveforms.js';
import { renderResults } from './results.js';
import { renderAssumptions } from './assumptions.js';
import { esc, fx, eng, signed, bin } from './format.js';

const $ = (id) => document.getElementById(id);

const state = {
  config: (() => {
    const c = cloneConfig(DEFAULT_CONFIG);
    delete c.capErrorOverride;
    return c;
  })(),
  ui: { noiseSeed: 1, fftPoints: 4096, ampDbfs: -0.5, finRatio: 0.0977, samplesPerCode: 0 },
  step: 0,
  selected: null,
  playing: false,
};
let adc = null;
let trace = null;
let qMax = 1;
let analysis = null;
let analysisKey = '';
let playTimer = null;

// ---------- persistence (URL hash: shareable configuration) ----------
const embedded = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();
function loadFromHash() {
  if (embedded) return;
  try {
    if (!location.hash || location.hash.length < 3) return;
    const obj = JSON.parse(decodeURIComponent(location.hash.slice(1)));
    if (obj.c) state.config = deepMerge(state.config, obj.c);
    if (obj.u) state.ui = { ...state.ui, ...obj.u };
  } catch {
    /* ignore malformed hash */
  }
}
function saveToHash() {
  if (embedded) return;
  try {
    history.replaceState(null, '', '#' + encodeURIComponent(JSON.stringify({ c: state.config, u: state.ui })));
  } catch {
    /* ignore */
  }
}

// ---------- model rebuild ----------
function rebuild() {
  try {
    adc = createAdc(state.config);
    trace = convert(adc, state.config.vin, { record: true, rng: createRng(state.ui.noiseSeed) });
  } catch (err) {
    $('stepDetail').innerHTML = `<div class="errmsg">⚠ ${esc(err.message)}</div>`;
    return false;
  }
  state.step = Math.min(state.step, trace.snapshots.length - 1);
  if (state.selected && !(adc.arrays[state.selected.a] && state.selected.i < adc.arrays[state.selected.a].n)) state.selected = null;
  qMax = chargeScale(trace);
  saveToHash();
  return true;
}

function analysisOptions() {
  return { fftPoints: state.ui.fftPoints, ampDbfs: state.ui.ampDbfs, finRatio: state.ui.finRatio, samplesPerCode: state.ui.samplesPerCode };
}

let worker = null;
let workerFailed = false;
let reqId = 0;
let debounce = null;
function scheduleAnalysis() {
  const cfg = { ...state.config, vin: 0 };
  const key = JSON.stringify([cfg, analysisOptions()]);
  if (key === analysisKey && analysis) return;
  analysisKey = key;
  analysis = null;
  $('analysisStatus').textContent = 'computing static & dynamic analysis…';
  renderResultsView();
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    const id = ++reqId;
    const opts = analysisOptions();
    if (!workerFailed) {
      try {
        if (!worker) {
          worker = new Worker(new URL('./analysisWorker.js', import.meta.url), { type: 'module' });
          worker.onmessage = (ev) => {
            if (ev.data.id !== reqId) return;
            analysis = ev.data.error ? { error: ev.data.error } : ev.data.result;
            analysisDone();
          };
          worker.onerror = () => {
            workerFailed = true;
            worker = null;
            runInline(reqId, cfg, opts);
          };
        }
        worker.postMessage({ id, config: cfg, opts });
        return;
      } catch {
        workerFailed = true;
      }
    }
    runInline(id, cfg, opts);
  }, 250);
}
async function runInline(id, cfg, opts) {
  const { runAnalysis } = await import('./analysisWorker.js');
  setTimeout(() => {
    if (id !== reqId) return;
    try {
      analysis = runAnalysis(cfg, opts);
    } catch (err) {
      analysis = { error: err.message };
    }
    analysisDone();
  }, 0);
}
function analysisDone() {
  const t = analysis && analysis.static ? `ramp ${analysis.static.conversions.toLocaleString()} conversions · FFT ${analysis.dynamic.points} points` : '';
  $('analysisStatus').textContent = t;
  renderResultsView();
  renderReadout();
}

// ---------- rendering ----------
function renderReadout() {
  if (!trace) return;
  const N = adc.config.bits;
  const items = [
    ['Code', `${trace.code}`],
    ['Binary', bin(trace.code, N)],
    ['Ideal', `${trace.idealCode}`],
    ['Error', `${signed(trace.code - trace.idealCode, 0)} LSB`],
  ];
  if (analysis && analysis.static) {
    items.push(['|DNL|max', fx(analysis.static.peakDnl, 3)], ['|INL|max', fx(analysis.static.peakInl, 3)], ['SNDR', `${fx(analysis.dynamic.sndr, 2)} dB`], ['ENOB', fx(analysis.dynamic.enob, 2)]);
  }
  $('readout').innerHTML = items.map(([k, v]) => `<div class="readout-item"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join('');
}

function fitSchematic() {
  const wrap = $('schematic');
  const svg = wrap.querySelector('svg');
  if (!svg) return;
  const W = Number(svg.getAttribute('width'));
  const H = Number(svg.getAttribute('height'));
  const avail = wrap.clientWidth - 2;
  const scale = Math.max(0.7, Math.min(1.15, avail / W));
  svg.style.width = `${W * scale}px`;
  svg.style.height = `${H * scale}px`;
}

function renderStepViews() {
  if (!trace) return;
  const snap = trace.snapshots[state.step];
  const last = trace.snapshots.length - 1;
  $('stepSlider').max = String(last);
  $('stepSlider').value = String(state.step);
  $('stepLabel').textContent = `step ${state.step}/${last}`;
  $('stepDetail').innerHTML = `<div class="t">${esc(snap.title)}</div><div class="d">${esc(snap.detail)}${
    Number.isFinite(snap.dacLevel) && snap.phase !== 'hold' ? ` · DAC level ${fx(snap.dacLevel, 5)} V` : ''
  }</div>`;
  $('schematic').innerHTML = renderSchematic({ adc, trace, step: state.step, selected: state.selected, qMax });
  fitSchematic();
  $('charge').innerHTML = renderCharge({ adc, trace, step: state.step, selected: state.selected });
  $('chargeHint').textContent = state.selected ? 'capacitor selected — click again to clear' : 'click a capacitor or row for details';
  $('sequence').innerHTML = renderSequence({ adc, trace, step: state.step });
  const cur = $('sequence').querySelector('tr.current');
  if (cur && state.playing) cur.scrollIntoView({ block: 'nearest' });
  $('waveforms').innerHTML = renderWaveforms({ adc, trace, step: state.step, width: $('waveforms').clientWidth });
  document.querySelectorAll('[data-step="first"],[data-step="prev"]').forEach((b) => (b.disabled = state.step === 0));
  document.querySelectorAll('[data-step="next"],[data-step="last"]').forEach((b) => (b.disabled = state.step === last));
}

function renderResultsView() {
  if (!trace) return;
  $('results').innerHTML = renderResults({ adc, trace, analysis, width: $('results').clientWidth });
}

function renderVinSlider() {
  const r = adc.range;
  const s = $('vinSlider');
  const ext = 0.03 * r.fullScale;
  s.min = String(r.low - ext);
  s.max = String(r.high + ext);
  s.step = String(r.lsb / 16);
  s.value = String(state.config.vin);
  $('vinSliderLabel').textContent = adc.scheme.differential ? 'Vd = Vin+ − Vin−' : 'Vin';
  $('vinSliderOut').textContent = `${fx(state.config.vin, 5)} V`;
}

function renderAll({ params = false } = {}) {
  if (params) renderParams($('params'), viewState());
  if (!trace) return;
  updateDerived($('params'), adc, state);
  $('idealToggle').checked = !!state.config.ideal;
  renderVinSlider();
  $('schematicLegend').innerHTML = legendHtml(adc);
  renderStepViews();
  renderResultsView();
  renderReadout();
  $('assumptions').innerHTML = renderAssumptions(adc);
}

/** The parameter panel shows non-ideal blocks as disabled while "Ideal model" is on. */
function viewState() {
  if (!state.config.ideal) return state;
  const v = { ...state, config: cloneConfig(state.config) };
  for (const b of Object.values(v.config.nonIdeal)) b.enabled = false;
  return v;
}

function update({ params = false } = {}) {
  if (rebuild()) {
    renderAll({ params });
    scheduleAnalysis();
  } else if (params) {
    renderParams($('params'), viewState());
  }
}

// ---------- events ----------
function onParam(path, value, structural) {
  if (path === 'config.scheme') {
    const oldScheme = getScheme(state.config.scheme);
    const newScheme = getScheme(value);
    const oldAdc = adc;
    state.config.scheme = value;
    if (oldAdc && oldScheme.differential !== newScheme.differential) {
      const frac = (state.config.vin - oldAdc.range.low) / oldAdc.range.fullScale;
      const lo = newScheme.differential ? -state.config.vref : 0;
      const fs = newScheme.differential ? 2 * state.config.vref : state.config.vref;
      state.config.vin = +(lo + frac * fs).toFixed(6);
    }
    state.config.bits = Math.max(state.config.bits, newScheme.minBits);
    state.step = 0;
    update({ params: true });
    return;
  }
  if (path.endsWith('.enabled') && state.config.ideal) state.config.ideal = false;
  setPath(state, path, value);
  if (path === 'config.bits') state.step = Math.min(state.step, 0);
  update({ params: structural || path === 'config.bits' });
}

function setStep(s) {
  if (!trace) return;
  state.step = Math.max(0, Math.min(trace.snapshots.length - 1, s));
  renderStepViews();
}

function togglePlay(force) {
  state.playing = force ?? !state.playing;
  $('playBtn').textContent = state.playing ? '❚❚ Pause' : '▶ Play';
  clearInterval(playTimer);
  if (state.playing) {
    if (state.step >= trace.snapshots.length - 1) setStep(0);
    playTimer = setInterval(() => {
      if (state.step >= trace.snapshots.length - 1) togglePlay(false);
      else setStep(state.step + 1);
    }, 750);
  }
}

function selectCap(key) {
  const [a, i] = key.split(':').map(Number);
  state.selected = state.selected && state.selected.a === a && state.selected.i === i ? null : { a, i };
  renderStepViews();
}

function init() {
  try {
    const t = localStorage.getItem('sar-theme');
    if (t) document.documentElement.dataset.theme = t;
  } catch {
    /* storage unavailable */
  }
  loadFromHash();
  renderParams($('params'), viewState());
  bindParams($('params'), onParam);
  $('params').addEventListener('click', (e) => {
    if (e.target.id === 'rerollMismatch') {
      e.preventDefault();
      state.config.nonIdeal.mismatch.seed = 1 + Math.floor(Math.random() * 1e6);
      state.config.nonIdeal.mismatch.enabled = true;
      state.config.ideal = false;
      update({ params: true });
    }
  });
  $('idealToggle').addEventListener('change', (e) => {
    state.config.ideal = e.target.checked;
    update({ params: true });
  });
  $('themeBtn').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    const next = cur === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('sar-theme', next);
    } catch {
      /* ignore */
    }
  });
  $('vinSlider').addEventListener('input', (e) => {
    state.config.vin = Number(e.target.value);
    const inp = $('params').querySelector('input[data-path="config.vin"]');
    if (inp) inp.value = +state.config.vin.toPrecision(8);
    update();
  });
  document.querySelector('.stepbar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-step]');
    if (!b) return;
    const a = b.dataset.step;
    if (a === 'play') return togglePlay();
    togglePlay(false);
    if (a === 'first') setStep(0);
    if (a === 'prev') setStep(state.step - 1);
    if (a === 'next') setStep(state.step + 1);
    if (a === 'last') setStep(trace.snapshots.length - 1);
  });
  $('stepSlider').addEventListener('input', (e) => {
    togglePlay(false);
    setStep(Number(e.target.value));
  });
  $('reseedBtn').addEventListener('click', () => {
    state.ui.noiseSeed += 1;
    const inp = $('params').querySelector('input[data-path="ui.noiseSeed"]');
    if (inp) inp.value = state.ui.noiseSeed;
    update();
  });
  $('schematic').addEventListener('click', (e) => {
    const g = e.target.closest('[data-cap]');
    if (g) selectCap(g.dataset.cap);
  });
  $('charge').addEventListener('click', (e) => {
    const r = e.target.closest('[data-cap]');
    if (r) selectCap(r.dataset.cap);
  });
  $('sequence').addEventListener('click', (e) => {
    const r = e.target.closest('[data-step]');
    if (r) {
      togglePlay(false);
      setStep(Number(r.dataset.step));
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea')) return;
    if (e.key === 'ArrowRight') setStep(state.step + 1);
    else if (e.key === 'ArrowLeft') setStep(state.step - 1);
    else if (e.key === 'Home') setStep(0);
    else if (e.key === 'End') setStep(trace.snapshots.length - 1);
    else if (e.key === ' ') {
      e.preventDefault();
      togglePlay();
    } else return;
  });
  let rz;
  window.addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      renderStepViews();
      renderResultsView();
    }, 150);
  });
  update({ params: true });
}

init();
