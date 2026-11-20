%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%                  STEP 3: THE CHARGE BALANCE AT ALPHA = 1                %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% QUESTION
% Which reference voltage and how much CDAC capacitance balance the full-scale
% charge, and how much does the node grow during the conversion?
%
% ANSWER (alpha = 1)
% V_REF = 0.5 V, C_DAC = 2.24 pF. One LSB is 0.98 mV at the comparator at
% decision 1 and 0.49 mV at the end: alpha / (1 + alpha) = 50 % is left.
%
% Still no weight list: the CDAC is only a total here; ideal binary steps are
% the reference case for the node growth, as in step 1.

clear; close all; clc;
zaan_constants;

% from step 0
C_TH  = N_ch * C_M;
Q_FS  = C_TH * V_FS;
Q_LSB = Q_FS / 2^N_bits;

%% -----------------------------
% 1) What the CDAC must deliver
% -----------------------------
% A capacitor C at V_REF across the nodes moves Q by 2 C V_REF, straight (+)
% or crossed (-). The whole CDAC spans 4 V_REF C_DAC, which must equal Q_FS:
%     Q_FS = C_TH V_FS = 4 V_REF C_DAC                  (Chen 2018, eq. 3, p. 3056)
% alpha = C_TH / (2 C_DAC) (Rabuske 2017, eq. 4.58), so V_REF = alpha V_FS / 2.
V_REF = alpha * V_FS / 2;
C_DAC = Q_FS / (4 * V_REF);
fprintf('alpha = %.1f: V_REF = alpha V_FS / 2 = %.2f V\n', alpha, V_REF);
fprintf('C_DAC = Q_FS / (4 V_REF) = %.0f fC / %.1f V = %.2f pF\n', Q_FS*1e15, 4*V_REF, C_DAC*1e12);
fprintf('charge the reference puts on the CDAC per conversion: C_DAC V_REF = %.0f fC\n\n', C_DAC*V_REF*1e15);

%% -----------------------------
% 2) The node grows: C_TH at decision 1, C_TH + 2 C_DAC at the end
% -----------------------------
% A capacitor across the two nodes adds 2 C to each node (Rabuske 2017, eq. 4.21).
% The comparator sees V = Q / C_node: one LSB gives fewer volts at every decision.
% Binary reference: after k-1 steps a fraction 1 - 2^-(k-1) of the CDAC is on.
k = 1:N_bits;
C_node = C_TH + 2 * C_DAC * (1 - 2.^-(k-1));
V_LSB  = Q_LSB ./ C_node;          % ./ divides element by element

fprintf(' decision   C_node [pF]   1 LSB at the comparator\n');
for i = k
    fprintf('%9d %13.2f %18.3f mV\n', i, C_node(i)*1e12, V_LSB(i)*1e3);
end
fprintf('at the end %.0f %% of decision 1 is left; alpha / (1 + alpha) = %.0f %%\n', ...
        100*C_node(1)/C_node(end), 100*alpha/(1 + alpha));

figure; plot(k, V_LSB*1e3, 'o-', 'LineWidth', 1.5); grid on;
xlabel('decision'); ylabel('1 LSB at the comparator [mV]');
title('The same charge gives fewer volts as the node grows');

%% -----------------------------
% 3) Check: binary steps as capacitors add up to the charge balance
% -----------------------------
steps   = 2.^(N_bits-2 : -1 : 0) * Q_LSB;   % step charges of step 1 [C]
C_steps = steps / (2 * V_REF);              % each step moves Q by 2 C V_REF
fprintf('\nbinary capacitors add up to %.3f pF: %d of the %d LSB, the last LSB is the last decision\n', ...
        sum(C_steps)*1e12, sum(steps/Q_LSB), 2^(N_bits-1));
alpha_check = C_TH / (2 * C_DAC);
fprintf('alpha back from the capacitances: %.3f\n', alpha_check);
if abs(alpha_check - alpha) < 1e-9, disp('CHECK OK'), else, disp('CHECK FAILED'), end
