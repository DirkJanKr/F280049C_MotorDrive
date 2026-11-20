%% s3_charge_balance.m   STEP 3: the charge balance at alpha = 1
% QUESTION: what reference voltage and how much CDAC capacitance does the converter
% need to balance the full-scale charge, and how much does the node grow during the
% conversion (which sets how many volts one LSB of charge gives the comparator)?
% Still no weight list: the CDAC is only a total here; binary steps are used as the
% reference case for the node growth, as in step 1.
%
% Charge convention: Q = Q+ - Q-.

clear; clc;
here = fileparts(mfilename('fullpath')); if isempty(here), here = pwd; end
addpath(fullfile(fileparts(here), '1_settings'));
p = zaan_params();
d = zaan_derive(p);
fC = 1e15;

%% 1. What the CDAC must deliver
% A capacitor C precharged to V_REF and connected across the nodes moves Q by 2 C V_REF,
% straight (+) or crossed (-). The whole CDAC therefore spans -2 C_DAC V_REF .. +2 C_DAC V_REF,
% a range of 4 V_REF C_DAC. It must match the full scale of the input:
%     Q_FS = C_TH V_FS = 4 V_REF C_DAC                      (Chen 2018, eq. 3, p. 3056)
% alpha = C_TH / (2 C_DAC) (Rabuske 2017, eq. 4.58), so V_REF = alpha V_FS / 2.
V_REF = p.alpha * p.V_FS / 2;
C_DAC = d.Q_FS / (4 * V_REF);
fprintf('alpha = %.1f:  V_REF = alpha V_FS / 2 = %.2f V\n', p.alpha, V_REF);
fprintf('C_DAC = Q_FS / (4 V_REF) = %.0f fC / %.1f V = %.2f pF\n', d.Q_FS * fC, 4 * V_REF, C_DAC * 1e12);
fprintf('charge the reference puts on the CDAC per conversion: C_DAC V_REF = %.0f fC\n\n', C_DAC * V_REF * fC);

%% 2. The node grows: C_TH at the first decision, C_TH + 2 C_DAC at the end
% A capacitor across the two nodes adds 2 C to each node (Rabuske 2017, eq. 4.21).
% The comparator sees a voltage V = Q / C_node, so one LSB of charge gives fewer volts
% at every decision. Binary reference case: after k-1 steps a fraction 1 - 2^-(k-1) of
% the CDAC is connected.
k = 1:p.N_bits;
C_node = d.C_TH + 2 * C_DAC * (1 - 2.^-(k - 1));
fprintf('%9s %14s %22s\n', 'decision', 'C_node [pF]', '1 LSB at comparator');
for i = k
    fprintf('%9d %14.2f %17.3f mV\n', i, C_node(i) * 1e12, d.Q_LSB / C_node(i) * 1e3);
end
fprintf('at the end: %.0f %% of the volts per LSB of decision 1, alpha / (1 + alpha) = %.0f %%\n', ...
        100 * C_node(1) / C_node(end), 100 * p.alpha / (1 + p.alpha));

%% 3. CHECK: binary steps as capacitors, they must add up to the charge balance
steps = 2.^(p.N_bits - 2 : -1 : 0) * d.Q_LSB;   % step charges of step 1 [C]
C_steps = steps / (2 * V_REF);                  % each step moves Q by 2 C V_REF
fprintf('\nbinary capacitors add up to %.3f pF: %d of the %d LSB, the last LSB is the last decision\n', ...
        sum(C_steps) * 1e12, sum(steps / d.Q_LSB), 2^(p.N_bits - 1));
alpha_check = d.C_TH / (2 * C_DAC);
fprintf('alpha back from the capacitances: C_TH / (2 C_DAC) = %.3f\n', alpha_check);
if abs(alpha_check - p.alpha) < 1e-9, disp('CHECK OK'), else, disp('CHECK FAILED'), end

