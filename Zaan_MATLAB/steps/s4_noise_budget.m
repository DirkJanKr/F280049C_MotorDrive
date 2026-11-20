%% s4_noise_budget.m   STEP 4: the noise budget so far, and what it leaves for the comparator
% QUESTION: adding up only what the earlier steps have shown, how much of the ENOB 9.5
% budget is left for the comparator, and what comparator noise does that allow?
% Every source is first a CHARGE: its rms value in fC. Then, to compare and add them:
%   divide by one LSB of charge (Q_LSB = 4.375 fC)  ->  the same noise in LSB rms
%   square it                                       ->  its power in LSB^2
% Noise sources add in POWER, not in rms: 3 fC and 4 fC rms together are 5 fC, not 7.
% Charge convention Q = Q+ - Q-.
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

%% 2. STUDIED: each line was worked out and checked in its own step. Values: rms charge [C]
sig_cell = p.A_C / sqrt(p.C_M * 1e15);
Q_sig = d.Q_FS / (2 * sqrt(2));                   % rms charge of a full-scale sine [C]
studied = {
  'quantisation, ideal 10 bit',      L / sqrt(12),                  'step 0'
  'kT/C of the memory cells',        sqrt(2 * p.N_ch * kT * p.C_M), 'step 2a (simulated)'
  'memory gain tones, full scale',   sig_cell / sqrt(p.N_ch) * Q_sig, 'step 2b (simulated)'
};

%% 3. NOT STUDIED: placeholders, with the assumption and what is needed to check them
open_items = {
  'kT/C of the CDAC',               sqrt(4 * kT * C_DAC), ...
      'Rabuske eq. 4.100, times 2 for Q+ - Q-; not simulated yet', ...
      'own step once the CDAC is designed (step 5)'
  'extra charge per memory cell',   0.5 * L / sqrt(12), ...
      'a 25 % share (in power) I allowed in step 2c, not a measured value', ...
      'Cadence Monte Carlo of the cell switch: spread of the charge per cell'
  'switch noise during conversion', sqrt(2 * kT * C_end), ...
      'my estimate, upper bound; Rabuske p. 99 names it but gives no formula', ...
      'Cadence noise simulation of the comparator with the switched CDAC'
  'clock jitter on the write',      d.C_TH * 2*pi*p.f_max * p.jitter * p.V_FS/(2*sqrt(2)), ...
      '1 ps rms assumed, formula not worked out with you yet', ...
      'own step; the jitter of the system clock (a spec from the clock source)'
};

%% 4. Print both lists: charge first, then in LSB, then as power
q_allowed = L / sqrt(12) * 2^(p.N_bits - p.ENOB);   % total rms charge the ENOB aim allows [C]
P_allowed = (q_allowed / L)^2;                       % the same as power [LSB^2]
enob = @(Pt) (10 * log10(P_sig / Pt) - 1.76) / 6.02;
fC = 1e15;
fprintf('one LSB = %.3f fC.  ENOB %.1f allows %.3f fC rms in total = %.3f LSB rms = %.4f LSB^2\n\n', ...
        L * fC, p.ENOB, q_allowed * fC, q_allowed / L, P_allowed);
hdr = '%-32s %9s %9s %9s %7s\n';
row = '%-32s %9.3f %9.3f %9.4f %6.0f %%';
fprintf(['STUDIED\n' hdr], 'source', 'fC rms', 'LSB rms', 'LSB^2', 'share');
for i = 1:size(studied, 1)
    q = studied{i, 2};
    fprintf([row '   %s\n'], studied{i,1}, q * fC, q / L, (q / L)^2, 100 * (q / L)^2 / P_allowed, studied{i,3});
end
P_studied = sum(([studied{:, 2}] / L).^2);
fprintf([row '   ENOB %.2f\n\n'], 'sum (in power)', sqrt(P_studied) * L * fC, sqrt(P_studied), P_studied, ...
        100 * P_studied / P_allowed, enob(P_studied));

fprintf(['NOT STUDIED (placeholders)\n' hdr], 'source', 'fC rms', 'LSB rms', 'LSB^2', 'share');
for i = 1:size(open_items, 1)
    q = open_items{i, 2};
    fprintf([row '\n     assumption: %s\n     to check:   %s\n'], open_items{i,1}, q * fC, q / L, ...
            (q / L)^2, 100 * (q / L)^2 / P_allowed, open_items{i,3}, open_items{i,4});
end
P_open = sum(([open_items{:, 2}] / L).^2);
fprintf([row '   ENOB with them %.2f\n\n'], 'sum (in power)', sqrt(P_open) * L * fC, sqrt(P_open), P_open, ...
        100 * P_open / P_allowed, enob(P_studied + P_open));

%% 5. The comparator: its noise v_n becomes a charge v_n * C_node at the last decision
left = P_allowed - P_studied;                     % power the studied sources leave [LSB^2]
fprintf('the studied sources leave %.4f LSB^2 = %.3f fC rms\n', left, sqrt(max(left, 0)) * L * fC);
if left > 0
    q_comp = sqrt(left) * L;                      % rms charge the comparator may add [C]
    fprintf('the comparator may add %.3f fC rms; at the last decision the node is %.2f pF,\n', q_comp * fC, C_end * 1e12);
    fprintf('so v_n = q / C_node = %.0f uV rms at most (before the placeholders)\n', q_comp / C_end * 1e6);
else
    fprintf('nothing is left for the comparator\n');
end
