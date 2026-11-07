/** Explicit statement of what the model assumes and what it simulates. */
import { esc } from './format.js';

export function renderAssumptions(adc) {
  const ni = adc.config.nonIdeal;
  const st = (on) => `<span class="st ${on ? 'on' : 'off'}">${on ? 'active' : 'off'}</span>`;
  const phys = [
    ['Capacitor mismatch (random, σ/√units)', ni.mismatch.enabled],
    ['Top-plate parasitic Cp (gain/attenuation)', ni.topParasitic.enabled],
    ['Bottom-plate parasitic αCi (reference charge)', ni.bottomParasitic.enabled],
    ['Comparator offset incl. CM dependence', ni.comparatorOffset.enabled],
    ['Comparator noise (Gaussian per decision)', ni.comparatorNoise.enabled],
    ['Reference voltage error (static)', ni.referenceError.enabled],
    ['Sampling noise: kT/C charge + input noise', ni.samplingNoise.enabled],
    ['Aperture jitter (sine test)', ni.jitter.enabled],
  ];
  const ideal = [
    'Switches: zero on-resistance, no charge injection, no clock feedthrough, no leakage',
    'Sources (VREF, VCM, input driver): zero output impedance, no ripple or droop',
    'DAC settles completely within every bit cycle (no incomplete settling)',
    'Comparator: infinite gain, zero delay, no metastability, no kickback, no hysteresis',
    'Capacitors: linear, voltage-independent, no dielectric absorption',
    'Input stays inside the rails (no switch clipping is modeled)',
  ];
  const outScope = [
    'Transistor-level device behaviour (this is a behavioral model)',
    'Switch RC time constants and DAC settling waveforms',
    'Supply/reference bounce caused by the switching charge',
    'Redundancy / non-binary weighting and digital calibration (architecture prepared: add a scheme module)',
    'Split-array / bridge-capacitor CDACs',
  ];
  return `<div class="assume">
    <div><h3>Foundation</h3>
      <p>All voltages follow from charge conservation on the floating top-plate node:</p>
      <div class="eq">Q_X = Σ Ci·(Vx − Vb,i) + Cp·Vx = const
Vx  = (Q_X + Σ Ci·Vb,i) / (Σ Ci + Cp)
ΔVx = Σ Ci·ΔVb,i / (Σ Ci + Cp)</div>
      <p>Energy drawn from a source = V_source × charge delivered through the bottom plates connected to it.</p>
      <p><b>Scheme:</b> ${esc(adc.scheme.name)} — ${esc(adc.scheme.description)}</p>
    </div>
    <div><h3>Modeled physical effects</h3><ul>${phys.map(([t, on]) => `<li>${esc(t)}${st(on)}</li>`).join('')}</ul></div>
    <div><h3>Ideal assumptions (always)</h3><ul>${ideal.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      <h3 class="subsection">Not in this version</h3><ul>${outScope.map((t) => `<li class="muted">${esc(t)}</li>`).join('')}</ul></div>
  </div>`;
}
