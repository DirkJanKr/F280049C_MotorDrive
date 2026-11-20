%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%   STEP 5: THE CDAC BUILT FROM REAL CAPACITORS, AND WHICH DNL FORMULA    %
%                               IS RIGHT                                  %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% QUESTION
% Built from PDK unit capacitors, what is the DNL of a plain binary
% charge-sharing CDAC at mid-scale? Two formulas disagree by a factor 2:
%   A (backup slide 51):  sigma_DNL = 2^B     A_C / sqrt(C_DAC in fF)
%   B (step 5 reasoning): sigma_DNL = 2^(B-1) A_C / sqrt(C_DAC in fF)
% This step builds the chips capacitor by capacitor, measures the DNL the
% standard way (the width of each code on the input axis), and also measures
% the jump in the OUTPUT value, to see what each formula really describes.
%
% ANSWER (alpha = 1, 64 units of 35 fF, 2000 chips)
% Both formulas are right, for different things:
%   DNL (width of a code on the input axis, nominal weights): 0.51 LSB = formula B
%   jump of the output value at mid-scale with the REAL weights: 1.04 LSB = formula A
% "Binary, no calibration, 3 sigma DNL < 0.5 LSB" is the first one: about 23.5 pF,
% not 94 pF. About 2.5 % of the chips lose a code at 2.24 pF.
%
% Binary weights on purpose: this shows the problem. Redundancy is step 6+.

clear; close all; clc;
zaan_constants;
rng(4, 'twister');         % fixed random numbers: the same chips every run

% from steps 0 and 3
C_TH  = N_ch * C_M;
Q_FS  = C_TH * V_FS;
Q_LSB = Q_FS / 2^N_bits;
V_REF = alpha * V_FS / 2;
C_DAC = Q_FS / (4 * V_REF);

%% -----------------------------
% 1) The unit capacitor and the binary steps
% -----------------------------
sig_u  = A_C / sqrt(C_u * 1e15);           % relative spread of one unit (PDK)
lsb_u  = 2 * C_u * V_REF / Q_LSB;          % one unit moves Q by 2 C_u V_REF = 8 LSB
w      = 2.^(N_bits-2 : -1 : 0);           % step weights [LSB]: 256 ... 1
n_whole = round(w(w >= lsb_u) / lsb_u);    % whole steps in units: 32 16 8 4 2 1
n_half  = sum(w < lsb_u);                  % steps made by halving one unit: 4 2 1 LSB
fprintf('unit %.0f fF = %.0f LSB, spread %.2f %%; whole steps use %d units, halving uses %d more\n', ...
        C_u*1e15, lsb_u, sig_u*100, sum(n_whole), n_half + 1);

%% -----------------------------
% 2) Build one chip: every unit capacitor gets its own error
% -----------------------------
% Whole steps: n units in parallel, precharged to V_REF. Connected across the
% nodes it moves Q by 2 V_REF (sum of its units).
% Halving: one source unit is precharged to V_REF and shares its charge with
% an empty unit, again and again. Each share splits the charge by the ratio of
% the two real capacitors; the shared unit is then used as the step.
% (A model of charge halving, Craninckx 2007; the exact sequence is an assumption.)
% The memory cells are ideal here: only the CDAC has mismatch.
n_chips = 2000;
Q_real  = zeros(n_chips, numel(w));        % real charge each step moves [C]
for chip = 1:n_chips
    k = 0;
    for i = 1:numel(n_whole)                      % whole-unit steps
        C_step = sum(C_u * (1 + sig_u*randn(1, n_whole(i))));
        k = k + 1;  Q_real(chip, k) = 2 * V_REF * C_step;
    end
    C_src = C_u * (1 + sig_u*randn);              % halving source unit
    q_src = C_src * V_REF;                        % its plate charge
    for i = 1:n_half
        C_h   = C_u * (1 + sig_u*randn);          % a fresh empty unit
        q_h   = q_src * C_h / (C_src + C_h);      % charge it takes in the share
        q_src = q_src - q_h;
        k = k + 1;  Q_real(chip, k) = 2 * q_h;    % connected across the nodes
    end
end
Q_nom = w * Q_LSB;                                % nominal step charges [C]

%% -----------------------------
% 3) Convert a slow ramp around mid-scale with every chip
% -----------------------------
% The comparator sees V = Q / C_node; only the sign matters, so we use the
% sign of the charge (step 1). Codes are read with the NOMINAL weights.
dx = 0.002;                                       % ramp step [LSB]
x  = -6 : dx : 6;                                 % input charge [LSB]
DNL0 = zeros(1, n_chips);                         % DNL of code 0 (just above mid)
DNLm = zeros(1, n_chips);                         % DNL of code -1 (just below mid)
gap  = zeros(1, n_chips);                         % jump of the REAL output value at mid
for chip = 1:n_chips
    r = x * Q_LSB;  Q_out = zeros(size(x));  S = zeros(numel(w), numel(x));
    for k = 1:numel(w)
        s = 2*(r >= 0) - 1;
        r = r - s * Q_real(chip, k);              % the real charge goes onto the nodes
        Q_out = Q_out + s * Q_nom(k);             % the converter adds the nominal weight
        S(k, :) = s;
    end
    s = 2*(r >= 0) - 1;
    Q_out = Q_out + s * Q_nom(end)/2;
    code = round(Q_out/Q_LSB - 0.5);              % ... -1, 0, 1, ... around mid-scale
    DNL0(chip) = sum(code == 0)  * dx - 1;        % width of code 0 minus 1 LSB
    DNLm(chip) = sum(code == -1) * dx - 1;        % width of code -1 minus 1 LSB
    % the same decisions read with the REAL weights (perfect calibration):
    % the output value just above and just below the mid-scale transition
    i_up = find(x > 0, 1);  i_dn = find(x < 0, 1, 'last');
    v_up = sum(S(:, i_up)' .* Q_real(chip, :));
    v_dn = sum(S(:, i_dn)' .* Q_real(chip, :));
    gap(chip) = (v_up - v_dn) / Q_LSB - (Q_nom(1) - sum(Q_nom(2:end))) * 2 / Q_LSB;
end

%% -----------------------------
% 4) The two formulas
% -----------------------------
sig_Q  = std(Q_real) / Q_LSB;                     % measured spread of each step [LSB]
form_A = 2^N_bits     * A_C / sqrt(C_DAC*1e15);
form_B = 2^(N_bits-1) * A_C / sqrt(C_DAC*1e15);
form_B_exact = sqrt(sum(sig_Q.^2));               % every step error counted once

%% -----------------------------
% 5) Results
% -----------------------------
fprintf('\nover %d chips, measured:\n', n_chips);
fprintf('  DNL of code  0 (input width):      spread %.3f LSB\n', std(DNL0));
fprintf('  DNL of code -1 (input width):      spread %.3f LSB\n', std(DNLm));
fprintf('  jump of the real output at mid:    spread %.3f LSB\n', std(gap));
fprintf('formulas:\n');
fprintf('  A  2^B A_C / sqrt(C_DAC)       = %.3f LSB\n', form_A);
fprintf('  B  2^(B-1) A_C / sqrt(C_DAC)   = %.3f LSB  (exact sum of step errors: %.3f)\n', form_B, form_B_exact);
fprintf('chips that lose code 0 (DNL = -1): %.1f %%\n', 100*mean(DNL0 <= -1 + 1e-9));
fprintf('\nfor 3 sigma DNL < 0.5 LSB (input width): C_DAC = %.1f pF with formula B, %.1f pF with A\n', ...
        (6 * 2^(N_bits-1) * A_C)^2 / 1000, (6 * 2^N_bits * A_C)^2 / 1000);
% What each formula describes:
% B: the width of a code on the input axis. Its lower edge is the first decision,
%    which compares with zero and needs no capacitor, so every step error counts once.
% A: the jump between the two output values on either side of mid-scale when the
%    decisions are read with the real weights. Both paths carry the errors with
%    opposite sign, so the difference counts them twice.
if abs(std(DNL0)/form_B_exact - 1) < 0.1 && abs(std(gap)/form_A - 1) < 0.1
    disp('CHECK OK: DNL follows formula B, the output jump follows formula A')
else
    disp('CHECK FAILED')
end

figure; hist(DNL0, 40); grid on;
xlabel('DNL of the code above mid-scale [LSB]'); ylabel('number of chips');
title('Binary CDAC built from 35 fF units: DNL at mid-scale');
