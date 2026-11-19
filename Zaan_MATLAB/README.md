# Zaan MATLAB

Behavioural model of the Zaan charge-sharing SAR ADC, one question per study.
Runs in MATLAB and in Octave, no toolboxes.

| Folder | What |
|---|---|
| `1_settings` | `zaan_params.m`: every input with its status (S, D, A, U). `zaan_derive.m`: the charges that follow. |
| `steps` | One script per design step, in order. See `DESIGN_FLOW.md`. |

Run a step: open it and press F5 (MATLAB), or `octave --eval "run('s0_charge_scale.m')"`.
