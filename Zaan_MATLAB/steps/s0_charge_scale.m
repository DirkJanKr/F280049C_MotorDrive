%% s0_charge_scale.m   STEP 0: the specification, in charge
% QUESTION: what are the full scale, one LSB and the noise we may add, all in charge?
% Only the specification and a start value for the memory cell are used. No CDAC yet.
%
% Charge convention: Q = Q+ - Q- (difference of the two summing nodes).

clear; clc;
here = fileparts(mfilename('fullpath')); if isempty(here), here = pwd; end
addpath(fullfile(fileparts(here), '1_settings'));
p = zaan_params();
d = zaan_derive(p);
fC = 1e15;                                   % print charges in fC

%% 1. The input charge: N memory cells per node, each holding its share of V_FS
% A differential input V gives Q+ - Q- = C_TH V, with C_TH = N C_M on each node.
fprintf('C_TH = N C_M = %d x %.0f fF = %.2f pF per node\n', p.N_ch, p.C_M * 1e15, d.C_TH * 1e12);
fprintf('full scale Q_FS = C_TH V_FS = %.0f fC\n', d.Q_FS * fC);

%% 2. One LSB
fprintf('one LSB: Q_LSB = Q_FS / 2^%d = %.3f fC\n', p.N_bits, d.Q_LSB * fC);

%% 3. The noise we may add for the ENOB aim
% A full-scale sine has power (Q_FS/2)^2 / 2. Ideal quantisation adds Q_LSB^2 / 12.
% ENOB 9.5 allows a total noise power of Q_LSB^2/12 * 2^(2(10 - 9.5)) = 2 x quantisation,
% so everything else together may add as much as the quantisation itself.
q_total = d.Q_LSB / sqrt(12) * 2^(p.N_bits - p.ENOB);
q_extra = sqrt(q_total^2 - d.Q_LSB^2 / 12);
fprintf('quantisation noise: %.3f fC rms (%.3f LSB)\n', d.Q_LSB / sqrt(12) * fC, 1 / sqrt(12));
fprintf('total allowed for ENOB %.1f: %.3f fC rms; left for all other noise: %.3f fC rms (%.3f LSB)\n', ...
        p.ENOB, q_total * fC, q_extra * fC, q_extra / d.Q_LSB);

%% 4. CHECK: SNDR of an ideal 10 bit converter from these charges is 6.02 B + 1.76 dB
sndr = 10 * log10((d.Q_FS / 2)^2 / 2 / (d.Q_LSB^2 / 12));
fprintf('\nideal SNDR = %.2f dB, formula 6.02 x %d + 1.76 = %.2f dB\n', sndr, p.N_bits, 6.02 * p.N_bits + 1.76);
if abs(sndr - (6.02 * p.N_bits + 1.76)) < 0.01, disp('CHECK OK'), else, disp('CHECK FAILED'), end
