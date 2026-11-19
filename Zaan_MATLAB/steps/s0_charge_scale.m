%% s0_charge_scale.m   STEP 0: the charge scale of the converter
% QUESTION: with alpha = 1 and a 35 fF unit, how big is one LSB, the full scale,
% each CDAC step and each memory cell, all in charge?
% Nothing is simulated here. It prints the numbers every later step builds on,
% and checks the charge balance (Chen 2018, eq. 3, p. 3056).
%
% Charge convention: Q = Q+ - Q- (difference of the two summing nodes).

clear; clc;
here = fileparts(mfilename('fullpath')); if isempty(here), here = pwd; end
addpath(fullfile(fileparts(here), '1_settings'));
p = zaan_params();
d = zaan_derive(p);
fC = 1e15;                                   % print charges in fC

%% 1. One unit capacitor, precharged to V_REF, connected across the nodes
% It holds C_u V_REF on its plates and moves Q by 2 C_u V_REF (one plate to
% each node, with opposite sign).
Q_unit = 2 * p.C_u * d.V_REF;
fprintf('V_REF = alpha V_FS / 2 = %.2f V\n', d.V_REF);
fprintf('one unit moves Q by 2 C_u V_REF = %.2f fC\n', Q_unit * fC);

%% 2. One LSB and the full scale
fprintf('one unit is %d LSB, so Q_LSB = %.3f fC\n', p.lsb_per_unit, d.Q_LSB * fC);
fprintf('full scale Q_FS = 2^%d Q_LSB = %.0f fC\n', p.N_bits, d.Q_FS * fC);

%% 3. The memory cells must hold that full scale: Q_FS = N C_M V_FS
fprintf('C_M = Q_FS / (N V_FS) = %.0f fF per cell, C_TH = N C_M = %.2f pF per node\n', ...
        d.C_M * 1e15, d.C_TH * 1e12);

%% 4. Every step: its weight, its charge, its capacitor
fprintf('\n%5s %10s %12s %12s\n', 'step', 'w [LSB]', 'charge [fC]', 'C [fF]');
for k = 1:numel(p.w)
    fprintf('%5d %10.2f %12.2f %12.0f\n', k, p.w(k), d.dQ(k) * fC, d.C_step(k) * 1e15);
end
fprintf('sum of the steps: %.1f LSB = %.0f fC, half the full scale is %.0f fC\n', ...
        sum(p.w), sum(d.dQ) * fC, d.Q_FS / 2 * fC);

%% 5. CHECK: the charge balance N V_FS C_M = 4 V_REF C_DAC (Chen 2018, eq. 3)
% C_DAC here is the capacitance that carries charge for a binary array: sum of
% the weights 512 LSB, each LSB worth Q_LSB / (2 V_REF) of capacitance.
C_DAC_bin = (2^(p.N_bits - 1) * d.Q_LSB) / (2 * d.V_REF);
left  = p.N_ch * p.V_FS * d.C_M;
right = 4 * d.V_REF * C_DAC_bin;
fprintf('\ncharge balance: N V_FS C_M = %.0f fC,  4 V_REF C_DAC = %.0f fC\n', left * fC, right * fC);
if abs(left - right) < 1e-6 * left, disp('CHECK OK'), else, disp('CHECK FAILED'), end
