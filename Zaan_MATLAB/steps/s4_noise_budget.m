%% s4_noise_budget.m   STEP 4: the noise budget so far, and what it leaves for the comparator
% QUESTION: adding up only what the earlier steps have shown, how much of the ENOB 9.5
% budget is left for the comparator, and what comparator noise does that allow?
% Everything in LSB^2 (charge squared divided by Q_LSB^2). Charge convention Q = Q+ - Q-.
%
% Two lists, kept apart on purpose:
%   STUDIED      worked out and checked in an earlier step
%   NOT STUDIED  sources I know exist but have not worked out yet; each has the
%                assumption behind its number and what is needed to check it.
%                They are shown, but the comparator target is computed without them.
% Not here at all: rounding to 10 bit with calibrated weights. That only exists once
% the redundancy and calibration are designed (steps 7 and 8).

clear; clc;
here = fileparts(mfilename('fullpath')); if isempty(here), here = pwd; end
addpath(fullfile(fileparts(here), '1_settings'));
p = zaan_params();
d = zaan_derive(p);
kT = p.k * p.T;  L = d.Q_LSB;                     % one LSB of charge [C]
P_sig = (2^p.N_bits / 2)^2 / 2;                   % a full-scale sine [LSB^2]

%% 1. From step 3: the CDAC and the node at the last decision
V_REF = p.alpha * p.V_FS / 2;
C_DAC = d.Q_FS / (4 * V_REF);
C_end = d.C_TH + 2 * C_DAC;

%% 2. STUDIED: each line was worked out and checked in its own step
sig_cell = p.A_C / sqrt(p.C_M * 1e15);
studied = {
  'quantisation, ideal 10 bit',      1/12,                          'step 0'
  'kT/C of the memory cells',        2 * p.N_ch * kT * p.C_M / L^2, 'step 2a (simulated)'
  'memory gain tones, full scale',   sig_cell^2 / p.N_ch * P_sig,   'step 2b (simulated)'
};

%% 3. NOT STUDIED: placeholders, with the assumption and what is needed to check them
open_items = {
  'kT/C of the CDAC',               4 * kT * C_DAC / L^2, ...
      'Rabuske eq. 4.100, times 2 for Q+ - Q-; not simulated yet', ...
      'own step once the CDAC is designed (step 5)'
  'extra charge per memory cell',   0.25 / 12, ...
      'a 25 % share I allowed in step 2c, not a measured value', ...
      'Cadence Monte Carlo of the cell switch: spread of the charge per cell'
  'switch noise during conversion', 2 * kT * C_end / L^2, ...
      'my estimate, upper bound; Rabuske p. 99 names it but gives no formula', ...
      'Cadence noise simulation of the comparator with the switched CDAC'
  'clock jitter on the write',      (d.C_TH * 2*pi*p.f_max * p.jitter * p.V_FS/(2*sqrt(2)) / L)^2, ...
      '1 ps rms assumed, formula not worked out with you yet', ...
      'own step; the jitter of the system clock (a spec from the clock source)'
};

%% 4. Print both lists
P_allowed = 1/12 * 2^(2 * (p.N_bits - p.ENOB));   % total for the ENOB aim [LSB^2]
enob = @(Pt) (10 * log10(P_sig / Pt) - 1.76) / 6.02;
fprintf('STUDIED\n%-32s %9s %7s   %s\n', 'source', '[LSB^2]', 'share', 'where');
for i = 1:size(studied, 1)
    fprintf('%-32s %9.4f %6.0f %%   %s\n', studied{i,1}, studied{i,2}, 100*studied{i,2}/P_allowed, studied{i,3});
end
P_studied = sum([studied{:, 2}]);
fprintf('%-32s %9.4f %6.0f %%   ENOB %.2f\n\n', 'sum studied', P_studied, 100*P_studied/P_allowed, enob(P_studied));

fprintf('NOT STUDIED (placeholders)\n');
for i = 1:size(open_items, 1)
    fprintf('%-32s %9.4f %6.0f %%\n     assumption: %s\n     to check:   %s\n', open_items{i,1}, ...
            open_items{i,2}, 100*open_items{i,2}/P_allowed, open_items{i,3}, open_items{i,4});
end
P_open = sum([open_items{:, 2}]);
fprintf('%-32s %9.4f %6.0f %%   ENOB with them %.2f\n\n', 'sum placeholders', P_open, 100*P_open/P_allowed, enob(P_studied + P_open));

%% 5. The comparator: its noise v_n is a charge v_n * C_node at the last decision
left = P_allowed - P_studied;                     % what the studied sources leave
fprintf('allowed for ENOB %.1f: %.4f LSB^2; the studied sources leave %.4f LSB^2\n', p.ENOB, P_allowed, left);
if left > 0
    fprintf('so the comparator may have at most %.0f uV rms (before the placeholders)\n', sqrt(left) * L / C_end * 1e6);
else
    fprintf('nothing is left for the comparator\n');
end
