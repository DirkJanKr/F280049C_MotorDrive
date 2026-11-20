%% s4_noise_budget.m   STEP 4: the noise budget in charge, and what is left for the comparator
% QUESTION: if we add up every error we know so far, how much of the ENOB 9.5 budget is
% left for the comparator, and what comparator noise does that allow?
% No simulation: every line comes from an earlier step or a formula, all in LSB^2
% (charge squared, divided by Q_LSB^2). Charge convention Q = Q+ - Q-.

clear; clc;
here = fileparts(mfilename('fullpath')); if isempty(here), here = pwd; end
addpath(fullfile(fileparts(here), '1_settings'));
p = zaan_params();
d = zaan_derive(p);
kT = p.k * p.T;  L = d.Q_LSB;                     % one LSB of charge [C]

%% 1. What step 3 gave us: the CDAC and the node at the last decision
V_REF  = p.alpha * p.V_FS / 2;
C_DAC  = d.Q_FS / (4 * V_REF);
C_end  = d.C_TH + 2 * C_DAC;                      % node at the last decision

%% 2. Every error we know, as a power in LSB^2
sig_cell = p.A_C / sqrt(p.C_M * 1e15);            % gain spread of one memory cell (step 2b)
P_sig = (2^p.N_bits / 2)^2 / 2;                   % a full-scale sine [LSB^2]
names = {'quantisation, ideal 10 bit'
         'rounding, calibrated weights'
         'kT/C memory cells'
         'kT/C CDAC'
         'switch noise, last decision'
         'memory gain tones, full scale'
         'memory extra charge (spec)'
         'clock jitter on the write'};
P = [1/12                                           % step 0
     0.5^2 / 12                                     % last step ½ LSB, backup slide 54
     2 * p.N_ch * kT * p.C_M / L^2                  % step 2a, Rabuske eq. 4.99
     4 * kT * C_DAC / L^2                           % Rabuske eq. 4.100, C_DAC from step 3
     2 * kT * C_end / L^2                           % my estimate, upper bound (Rabuske p. 99)
     sig_cell^2 / p.N_ch * P_sig                    % step 2b
     0.25 / 12                                      % step 2c, 25 % share
     (d.C_TH * 2*pi*p.f_max * p.jitter * p.V_FS/(2*sqrt(2)) / L)^2];   % 1 ps rms
src = {'step 0'
       'A: last step ½ LSB, backup slide 54'
       'step 2a, Rabuske eq. 4.99'
       'Rabuske eq. 4.100, C_DAC from step 3'
       'D: my estimate, upper bound (Rabuske p. 99)'
       'step 2b'
       'step 2c: 25 % share, A'
       'A: 1 ps rms'};

%% 3. The table, and what is left for ENOB 9.5
P_allowed = 1/12 * 2^(2 * (p.N_bits - p.ENOB));   % total for the ENOB aim [LSB^2]
fprintf('%-32s %10s %8s   %s\n', 'error', '[LSB^2]', 'share', 'from');
for i = 1:numel(P)
    fprintf('%-32s %10.4f %7.0f %%   %s\n', names{i}, P(i), 100 * P(i) / P_allowed, src{i});
end
left = P_allowed - sum(P);
enob = @(Pt) (10 * log10(P_sig / Pt) - 1.76) / 6.02;
fprintf('%-32s %10.4f %7.0f %%\n', 'sum', sum(P), 100 * sum(P) / P_allowed);
fprintf('allowed for ENOB %.1f: %.4f LSB^2,  left for the comparator: %.4f LSB^2\n', p.ENOB, P_allowed, left);
fprintf('ENOB without any comparator noise: %.2f\n\n', enob(sum(P)));

%% 4. The comparator: its noise v_n is a charge v_n * C_node at the last decision
if left > 0
    fprintf('comparator may have at most %.0f uV rms\n', sqrt(left) * L / C_end * 1e6);
else
    fprintf('nothing is left for the comparator at ENOB %.1f\n', p.ENOB);
end
for v_n = [25 50 70 100] * 1e-6
    Pc = (v_n * C_end / L)^2;
    fprintf('v_n = %3.0f uV: %.4f LSB^2, ENOB %.2f\n', v_n * 1e6, Pc, enob(sum(P) + Pc));
end
