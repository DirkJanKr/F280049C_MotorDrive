%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%      STEP 7f: COMPARATOR OFFSET: HOW MUCH MAY THE COMPARATOR HAVE?      %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% QUESTION
% How large may the comparator offset v_os be (after its own calibration)
% with plain binary weights (Rabuske 4.6), and with our weight list w_design?
%
% ANSWER (alpha = 1, w_design, settling 4.6 tau, 3 sigma mismatch)
% See the printout. Binary: no missing codes only if |v_os| < alpha V_LSB
% = 0.98 mV (Rabuske eq. 4.60), checked by simulation. With w_design the
% limit is set by the decision with the least spare tolerance.
%
% THE STORY
% The comparator decides on the voltage V = Q / C_node, plus its offset v_os.
% In charge: it compares Q with q_os = v_os C_node. The node grows with every
% step that is connected (step 3): from C_TH at decision 1 to C_end = C_TH +
% 2 C_DAC at the last one. So the same voltage offset is a GROWING charge.
% The part every decision shares (the last value, v_os C_end) only shifts the
% whole output: an ADC offset, (1 + 1/alpha) v_os referred to the input
% (Rabuske eq. 4.63), removed by calibration. What is left differs per
% decision, so it is a fixed error, exactly the off term of step 7a:
%     e_k = v_os (C_end - C_node,k) / Q_LSB          [LSB]
% It is largest at decision 1: v_os 2 C_DAC / Q_LSB = v_os / (alpha V_LSB),
% which is Rabuske's worst DNL (eq. 4.59). Binary has no tolerance, so above
% 1 LSB codes go missing (eq. 4.60). Redundancy gives every decision a
% tolerance, and the offset must fit in it together with mismatch and settling.
%
% HAND CHECK (do this on paper)
% v_os = 1 mV:  2 C_DAC = 4.48 pF,  Q_LSB = 4.375 fC
% e_1 = 1e-3 V x 4.48e-12 F / 4.375e-15 C = 1.02 LSB
% Rabuske: 1 mV / (1 x 0.977 mV) = 1.02 LSB. The same number.
% 15 mV would be 15.4 LSB at decision 1.
%
% WHAT THE CODE DOES
%   1) binary, ideal capacitors: worst DNL against Rabuske eq. 4.59
%   2) w_design: the largest v_os the tolerances allow, decision by decision
%   3) many chips at that limit and at 15 mV: do they convert right?

clear; close all; clc;
zaan_constants;
C_TH  = N_ch * C_M;
Q_LSB = C_TH * V_FS / 2^N_bits;
V_REF = alpha * V_FS / 2;
V_LSB = V_FS / 2^N_bits;
n_tau = 4.6;  eps_s = exp(-n_tau);

%% -----------------------------
% 1) Binary, ideal capacitors: does Rabuske's DNL formula hold?
% -----------------------------
wb  = 2.^(N_bits-2 : -1 : 0);                       % 256 ... 1 [LSB]
Qb  = wb * Q_LSB;
Cb  = C_TH + [0, cumsum(2 * Qb / (2*V_REF))];       % node at every decision [F]
x   = (-512.5 : 0.01 : 511.5) * Q_LSB;              % ramp [C]
z   = zeros(1, numel(wb)+1);
fprintf('binary:  v_os [mV]  worst DNL measured  Rabuske v_os/(alpha V_LSB)  missing codes\n');
for v_os = [0.25 0.5 0.9 1.5 3] * 1e-3
    y    = cs_sar(x, Qb, Qb, Cb, z, v_os * Cb, 0, zeros(1, numel(wb)));
    code = round(y / Q_LSB - 0.5);
    cnt  = accumarray(code(:) + 513, 1, [1024 1])';
    dnl  = cnt(2:end-1) * 0.01 - 1;
    fprintf('         %6.2f      %8.2f LSB          %8.2f LSB              %d\n', ...
            v_os*1e3, max(abs(dnl)), v_os/(alpha*V_LSB), sum(dnl <= -1 + 1e-9));
end

%% -----------------------------
% 2) w_design: the largest offset the tolerances allow
% -----------------------------
% need = mismatch + offset + settling (step 7a). Raise v_os until one
% decision with tolerance runs out.
w = w_design;
v_ok = 0;
for v = 0 : 0.01e-3 : 30e-3
    [t, ~, ~, ~, need] = fixed_errors(w, eps_s, v);
    if all(need(t > 0) <= t(t > 0)), v_ok = v; else, break, end
end
[t, mis, off, setl, need] = fixed_errors(w, eps_s, v_ok);
[~, ~, off15] = fixed_errors(w, eps_s, 15e-3);
fprintf('\nw_design %s, settling %.1f tau\n', num2str(w), n_tau);
fprintf('decision  tolerance  mismatch  settling  offset room  offset at 15 mV [LSB]\n');
for k = 1:numel(t)
    fprintf('%6d  %9.2f  %8.2f  %8.2f  %10.2f  %10.2f\n', k, t(k), mis(k), setl(k), t(k)-mis(k)-setl(k), off15(k));
end
fprintf('largest offset allowed: %.2f mV  (= %.2f x alpha V_LSB)\n', v_ok*1e3, v_ok/(alpha*V_LSB));

%% -----------------------------
% 3) Many chips: at the limit, and at 15 mV
% -----------------------------
for v_os = [v_ok, 15e-3]
    [t, ~, ~, ~, need] = fixed_errors(w, eps_s, v_os);
    allow = w(end)/2 + max(need(t == 0)) + 0.03;
    err = chip_errors(w, eps_s, v_os, 100, 7);
    fprintf('v_os %.2f mV: largest error %.2f LSB (allowed %.2f), chips beyond: %d of 100\n', ...
            v_os*1e3, max(err), allow, sum(err > allow));
end
