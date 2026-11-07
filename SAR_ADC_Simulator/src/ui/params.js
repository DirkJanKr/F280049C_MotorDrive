/** Parameter sidebar: declarative schema -> form, two-way bound to the app state. */
import { SCHEME_LIST, getScheme } from '../model/switching/index.js';
import { esc, eng, fx } from './format.js';

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
export function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
  o[keys[keys.length - 1]] = value;
}

function groups(state) {
  const scheme = getScheme(state.config.scheme);
  const diff = scheme.differential;
  return [
    {
      title: 'CDAC configuration',
      fields: [
        { path: 'config.scheme', label: 'Switching architecture', type: 'select', options: SCHEME_LIST.map((s) => [s.id, s.name]) },
        { path: 'config.bits', label: 'Resolution', unit: 'bit', type: 'int', min: Math.max(4, scheme.minBits), max: 16, step: 1 },
        { path: 'config.unitCap', label: 'Unit capacitor Cu', unit: 'fF', scale: 1e-15, min: 0.01, max: 10000, step: 0.1 },
      ],
      derived: 'cdac',
    },
    {
      title: 'References & input',
      fields: [
        { path: 'config.vref', label: 'Reference VREF', sub: 'nominal; used to decode codes', unit: 'V', min: 0.05, max: 10, step: 0.01 },
        {
          path: 'config.vcm',
          label: 'Common-mode VCM',
          sub: diff ? (scheme.id === 'vcm' ? 'bottom-plate switching level' : 'top-plate reset level') : 'top-plate reset & comparator ref.',
          unit: 'V',
          min: -10,
          max: 10,
          step: 0.01,
        },
        ...(diff ? [{ path: 'config.vinCM', label: 'Input common mode', sub: '(Vin+ + Vin−)/2', unit: 'V', min: -10, max: 10, step: 0.01 }] : []),
        {
          path: 'config.vin',
          label: diff ? 'Differential input Vd' : 'Input voltage Vin',
          sub: diff ? 'Vin+ − Vin−, range ±VREF' : 'range 0 … VREF',
          unit: 'V',
          min: -20,
          max: 20,
          step: 0.001,
        },
      ],
      derived: 'input',
    },
    {
      title: 'Timing',
      fields: [
        { path: 'config.timing.tSample', label: 'Sampling (track) time', unit: 'ns', scale: 1e-9, min: 0.01, max: 1e6, step: 1 },
        { path: 'config.timing.tBit', label: 'Bit-cycle time', unit: 'ns', scale: 1e-9, min: 0.01, max: 1e6, step: 0.5 },
      ],
      derived: 'timing',
    },
    {
      title: 'Capacitor mismatch',
      enable: 'config.nonIdeal.mismatch.enabled',
      fields: [
        { path: 'config.nonIdeal.mismatch.sigmaUnit', label: 'σ(ΔC/C) of unit cap', sub: 'C of k units: σ/√k (Pelgrom)', unit: '%', scale: 0.01, min: 0, max: 50, step: 0.05 },
        { path: 'config.nonIdeal.mismatch.seed', label: 'Mismatch seed', sub: 'one fabricated die', type: 'int', min: 1, max: 1e9, step: 1, button: { id: 'rerollMismatch', label: '↻' } },
      ],
    },
    {
      title: 'Top-plate parasitic',
      enable: 'config.nonIdeal.topParasitic.enabled',
      fields: [{ path: 'config.nonIdeal.topParasitic.cap', label: 'Cp (top plate → GND)', sub: 'attenuates DAC steps by Ct/(Ct+Cp)', unit: 'fF', scale: 1e-15, min: 0, max: 1e6, step: 1 }],
    },
    {
      title: 'Bottom-plate parasitic',
      enable: 'config.nonIdeal.bottomParasitic.enabled',
      fields: [{ path: 'config.nonIdeal.bottomParasitic.ratio', label: 'αCi (bottom plate → GND)', sub: 'costs reference charge, not accuracy', unit: '%', scale: 0.01, min: 0, max: 100, step: 0.5 }],
    },
    {
      title: 'Comparator offset',
      enable: 'config.nonIdeal.comparatorOffset.enabled',
      fields: [
        { path: 'config.nonIdeal.comparatorOffset.offset', label: 'Static offset Vos', unit: 'mV', scale: 1e-3, min: -1000, max: 1000, step: 0.1 },
        { path: 'config.nonIdeal.comparatorOffset.cmCoefficient', label: 'CM-dependent offset', sub: 'ΔVos per V of input CM shift', unit: 'mV/V', scale: 1e-3, min: -1000, max: 1000, step: 0.1 },
      ],
    },
    {
      title: 'Comparator noise',
      enable: 'config.nonIdeal.comparatorNoise.enabled',
      fields: [{ path: 'config.nonIdeal.comparatorNoise.rms', label: 'Input-referred noise', sub: 'Gaussian, per decision', unit: 'mV rms', scale: 1e-3, min: 0, max: 1000, step: 0.01 }],
    },
    {
      title: 'Reference error',
      enable: 'config.nonIdeal.referenceError.enabled',
      fields: [{ path: 'config.nonIdeal.referenceError.relative', label: 'VREF,actual / VREF − 1', sub: 'static gain error', unit: '%', scale: 0.01, min: -50, max: 50, step: 0.01 }],
    },
    {
      title: 'Sampling noise',
      enable: 'config.nonIdeal.samplingNoise.enabled',
      fields: [
        { path: 'config.nonIdeal.samplingNoise.kTC', label: 'kT/C noise', sub: 'charge noise frozen at hold', type: 'checkbox' },
        { path: 'config.nonIdeal.samplingNoise.temperature', label: 'Temperature', unit: 'K', min: 1, max: 1000, step: 1 },
        { path: 'config.nonIdeal.samplingNoise.extraRms', label: 'Extra input noise', sub: 'driver / input network', unit: 'µV rms', scale: 1e-6, min: 0, max: 1e6, step: 1 },
      ],
    },
    {
      title: 'Aperture jitter',
      enable: 'config.nonIdeal.jitter.enabled',
      fields: [{ path: 'config.nonIdeal.jitter.rms', label: 'Sampling-clock jitter', sub: 'dynamic (sine) test only', unit: 'ps rms', scale: 1e-12, min: 0, max: 1e6, step: 0.1 }],
    },
    {
      title: 'Analysis settings',
      fields: [
        { path: 'ui.noiseSeed', label: 'Noise seed (single conv.)', type: 'int', min: 1, max: 1e9, step: 1 },
        { path: 'ui.fftPoints', label: 'FFT points', type: 'select', options: [[1024, '1024'], [4096, '4096'], [16384, '16384']], numeric: true },
        { path: 'ui.ampDbfs', label: 'Sine amplitude', unit: 'dBFS', min: -120, max: 0, step: 0.1 },
        { path: 'ui.finRatio', label: 'fin / fs (approx.)', sub: 'coherent: odd cycle count', min: 0.0001, max: 0.4999, step: 0.001 },
        { path: 'ui.samplesPerCode', label: 'Ramp samples / code', sub: '0 = auto; DNL resolution 1/M LSB', type: 'int', min: 0, max: 4096, step: 1 },
      ],
    },
  ];
}

function fieldHtml(f, state) {
  const v = getPath(state, f.path);
  let control;
  if (f.type === 'select') {
    control = `<div class="field"><select data-path="${f.path}" ${f.numeric ? 'data-numeric="1"' : ''}>${f.options
      .map(([val, lab]) => `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lab)}</option>`)
      .join('')}</select></div>`;
  } else if (f.type === 'checkbox') {
    control = `<label class="toggle"><input type="checkbox" data-path="${f.path}" ${v ? 'checked' : ''}/> <span>${v ? 'on' : 'off'}</span></label>`;
  } else {
    const shown = f.scale ? v / f.scale : v;
    const txt = Number.isFinite(shown) ? +shown.toPrecision(10) : '';
    control = `<div class="field"><input type="number" data-path="${f.path}" data-scale="${f.scale ?? 1}" data-int="${f.type === 'int' ? 1 : 0}" min="${f.min ?? ''}" max="${f.max ?? ''}" step="${f.step ?? 'any'}" value="${txt}"/>${
      f.unit ? `<span class="unit">${esc(f.unit)}</span>` : ''
    }${f.button ? `<button class="btn ghost" id="${f.button.id}" title="new random draw" style="border:0;padding:2px 6px">${f.button.label}</button>` : ''}</div>`;
  }
  return `<div class="prow"><label>${esc(f.label)}${f.sub ? `<span class="sub">${esc(f.sub)}</span>` : ''}</label>${control}</div>`;
}

export function renderParams(el, state) {
  const html = groups(state)
    .map((g) => {
      const on = g.enable ? !!getPath(state, g.enable) : true;
      const head = g.enable
        ? `<label class="toggle"><input type="checkbox" data-path="${g.enable}" ${on ? 'checked' : ''}/><h3>${esc(g.title)}</h3></label><span class="tag phys">physical effect</span>`
        : `<h3>${esc(g.title)}</h3>`;
      return `<div class="pgroup ${on ? '' : 'off'}"><div class="pgroup-head">${head}</div>${g.fields.map((f) => fieldHtml(f, state)).join('')}${
        g.derived ? `<div class="derived" data-derived="${g.derived}"></div>` : ''
      }</div>`;
    })
    .join('');
  el.innerHTML = html;
}

/** Wire events once; `onChange(path, value)` is called with SI values. */
export function bindParams(el, onChange) {
  const handle = (e) => {
    const t = e.target;
    const path = t.dataset?.path;
    if (!path) return;
    if (t.type === 'checkbox') {
      onChange(path, t.checked, true);
      return;
    }
    if (t.tagName === 'SELECT') {
      onChange(path, t.dataset.numeric ? Number(t.value) : t.value, true);
      return;
    }
    const raw = t.value.trim();
    let v = Number(raw);
    const min = t.min === '' ? -Infinity : Number(t.min);
    const max = t.max === '' ? Infinity : Number(t.max);
    const ok = raw !== '' && Number.isFinite(v) && v >= min && v <= max && (t.dataset.int !== '1' || Number.isInteger(v));
    t.parentElement.classList.toggle('invalid', !ok);
    if (!ok) return;
    v *= Number(t.dataset.scale);
    onChange(path, v, false);
  };
  el.addEventListener('input', (e) => {
    if (e.target.type === 'number') handle(e);
  });
  el.addEventListener('change', handle);
}

export function updateDerived(el, adc, state) {
  const set = (key, html) => {
    const d = el.querySelector(`[data-derived="${key}"]`);
    if (d) d.innerHTML = html;
  };
  if (!adc) return;
  const a0 = adc.arrays[0];
  const sides = adc.arrays.length;
  set(
    'cdac',
    `Caps/side <b>${a0.n}</b> (${a0.n - 1} binary + dummy) · <b>${adc.theory.unitsPerSide}</b> Cu<br>` +
      `Ct/side <b>${eng(a0.totalCap, 'F')}</b>${sides > 1 ? ` · total <b>${eng(a0.totalCap * sides, 'F')}</b>` : ''}<br>` +
      `C<sub>node</sub> = Ct+Cp <b>${eng(a0.nodeCap, 'F')}</b> · Ct/(Ct+Cp) <b>${fx(adc.theory.attenuation, 5)}</b><br>` +
      `${esc(adc.scheme.description)}`
  );
  const src = adc.sourceVoltages(state.config.vin);
  const r = adc.range;
  const warn = [];
  if (state.config.vin < r.low || state.config.vin > r.high) warn.push('Input outside the conversion range: output saturates.');
  if (adc.scheme.differential && (src[0] < 0 || src[0] > state.config.vref || src[1] < 0 || src[1] > state.config.vref))
    warn.push('Vin+ or Vin− outside 0…VREF: a real switch/driver would clip (not modeled).');
  if (adc.scheme.id === 'vcm' && Math.abs(state.config.vcm - state.config.vref / 2) > 1e-9)
    warn.push('VCM ≠ VREF/2: steps become asymmetric per side (common-mode drift), differential steps stay exact.');
  set(
    'input',
    `Range <b>${fx(r.low, 3)} … ${fx(r.high, 3)} V</b> · LSB <b>${eng(r.lsb, 'V')}</b><br>` +
      (adc.scheme.differential ? `Vin+ <b>${fx(src[0], 4)} V</b> · Vin− <b>${fx(src[1], 4)} V</b><br>` : '') +
      `VREF,actual <b>${fx(adc.vrefActual, 5)} V</b>` +
      warn.map((w) => `<div class="warnmsg">⚠ ${esc(w)}</div>`).join('')
  );
  set('timing', `T<sub>conv</sub> <b>${eng(adc.timing.tConv, 's')}</b> · fs <b>${eng(adc.timing.fs, 'S/s')}</b>`);
}
