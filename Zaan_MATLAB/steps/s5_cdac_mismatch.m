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
% ANSWER (alpha = 1, C_DAC = 64 units of 35 fF = 2.24 pF; built from 67 units:
% 63 for the whole steps, 4 for charge halving; 500 chips, full-range ramp)
% Both formulas are right, for different things:
%   DNL (width of a code on the input axis, nominal weights): 0.50 LSB = formula B
%   jump of the output value at mid-scale with the REAL weights: 1.02 LSB = formula A
%   INL: 0 at the mid transition, then about 0.5 LSB spread from code 0 out to
%   about a quarter of the range, back to 0 at the ends (end-point line).
% "Binary, no calibration, 3 sigma DNL < 0.5 LSB" is formula B: about 23.5 pF,
% not 94 pF. About 2.4 % of the chips have a missing code at 2.24 pF.
% The charge-halving steps carry mismatch too (both capacitors of each share).

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
% 2) Build the chips: every unit capacitor gets its own error
% -----------------------------
% Whole steps: n units in parallel, precharged to V_REF. Connected across the
% nodes it moves Q by 2 V_REF (sum of its real units).
% Halving steps (4, 2, 1 LSB): one source unit C_src is precharged to V_REF.
% It shares its charge with a fresh empty unit C_h. The charge splits by the
% ratio of the two REAL capacitors: q_h = q_src C_h / (C_src + C_h).
% Both C_src and C_h carry their own mismatch, so the halving steps have
% mismatch too, and because the same source is reused, their errors are
% correlated. (Charge halving after Craninckx 2007; the exact sequence is A.)
% The memory cells are ideal here: only the CDAC has mismatch.
n_chips = 500;
Q_real  = zeros(n_chips, numel(w));        % real charge each step moves [C]
for chip = 1:n_chips
    k = 0;
    for i = 1:numel(n_whole)                      % whole-unit steps
        C_step = sum(C_u * (1 + sig_u*randn(1, n_whole(i))));
        k = k + 1;  Q_real(chip, k) = 2 * V_REF * C_step;
    end
    C_src = C_u * (1 + sig_u*randn);              % halving source unit (own error)
    q_src = C_src * V_REF;                        % its plate charge
    for i = 1:n_half
        C_h   = C_u * (1 + sig_u*randn);          % a fresh empty unit (own error)
        q_h   = q_src * C_h / (C_src + C_h);      % split by the real ratio
        q_src = q_src - q_h;
        k = k + 1;  Q_real(chip, k) = 2 * q_h;    % connected across the nodes
    end
end
Q_nom = w * Q_LSB;                                % nominal step charges [C]

% spread of every step: measured over the chips, and expected
sig_Q   = std(Q_real) / Q_LSB;                    % [LSB]
sig_exp = [sqrt(n_whole) * lsb_u * sig_u, nan(1, n_half)];
fprintf('\nstep [LSB]  units   spread measured [LSB]   expected sqrt(n) x %.3f LSB\n', lsb_u*sig_u);
for k = 1:numel(w)
    if k <= numel(n_whole)
        fprintf('%9d  %5d   %10.4f            %10.4f\n', w(k), n_whole(k), sig_Q(k), sig_exp(k));
    else
        fprintf('%9d  halved  %9.4f            (from the halving ratio)\n', w(k), sig_Q(k));
    end
end

%% -----------------------------
% 3) Convert a slow ramp over the FULL range with every chip
% -----------------------------
% The comparator sees V = Q / C_node; only the sign matters, so we use the
% sign of the charge (step 1). The real charges go onto the nodes; the output
% is built with the NOMINAL weights (no calibration).
% The same decisions are also summed with the REAL weights (Q_rw), to see the
% output jump that formula A describes.
dx    = 0.01;                                     % ramp step [LSB]
x     = -513 : dx : 513;                          % input charge [LSB]
codes = -512 : 511;                               % all output codes
inner = 2 : numel(codes) - 1;                     % codes -511 ... 510 (ends are open)
DNL   = zeros(n_chips, numel(inner));             % DNL of every inner code [LSB]
INL   = zeros(n_chips, numel(inner));             % INL at the top edge of every code [LSB]
gap   = zeros(1, n_chips);                        % jump of the real-weight output at mid
i_up  = find(x > 0, 1);  i_dn = find(x < 0, 1, 'last');
for chip = 1:n_chips
    r = x * Q_LSB;  Q_out = zeros(size(x));  Q_rw = zeros(size(x));
    for k = 1:numel(w)
        s = 2*(r >= 0) - 1;
        r = r - s * Q_real(chip, k);              % the real charge goes onto the nodes
        Q_out = Q_out + s * Q_nom(k);             % the converter adds the nominal weight
        Q_rw  = Q_rw  + s * Q_real(chip, k);      % the same decisions, real weights
    end
    s = 2*(r >= 0) - 1;
    Q_out = Q_out + s * Q_nom(end)/2;
    code  = round(Q_out/Q_LSB - 0.5);             % -512 ... 511
    % code widths from a histogram (how many ramp points land in each code)
    count = accumarray(code(:) + 513, 1, [numel(codes) 1])';
    width = count(inner) * dx;                    % [LSB of input]
    LSB_avg = mean(width);                        % end-point line: average width
    DNL(chip, :) = width / LSB_avg - 1;           % DNL(c) = width / average - 1
    INL(chip, :) = cumsum(DNL(chip, :));          % INL(c) = sum of DNL up to c
    gap(chip) = (Q_rw(i_up) - Q_rw(i_dn)) / Q_LSB - (Q_nom(1) - sum(Q_nom(2:end))) * 2 / Q_LSB;
end
i0 = find(codes(inner) == 0);                     % index of code 0 (just above mid)

%% -----------------------------
% 4) The two formulas
% -----------------------------
form_A = 2^N_bits     * A_C / sqrt(C_DAC*1e15);
form_B = 2^(N_bits-1) * A_C / sqrt(C_DAC*1e15);
form_B_exact = sqrt(sum(sig_Q.^2));               % every step error counted once

%% -----------------------------
% 5) Results
% -----------------------------
sDNL = std(DNL);  sINL = std(INL);                % spread of every code over the chips
[~, cD] = max(sDNL);  [~, cI] = max(sINL);
fprintf('\nover %d chips, measured:\n', n_chips);
fprintf('  DNL of code 0 (input width):       spread %.3f LSB\n', sDNL(i0));
fprintf('  largest DNL spread of any code:    %.3f LSB at code %d\n', sDNL(cD), codes(inner(cD)));
fprintf('  largest INL spread of any code:    %.3f LSB at code %d\n', sINL(cI), codes(inner(cI)));
fprintf('  worst |DNL| per chip: median %.2f LSB;  worst |INL| per chip: median %.2f LSB\n', ...
        median(max(abs(DNL), [], 2)), median(max(abs(INL), [], 2)));
fprintf('  jump of the real output at mid:    spread %.3f LSB\n', std(gap));
fprintf('formulas:\n');
fprintf('  A  2^B A_C / sqrt(C_DAC)       = %.3f LSB\n', form_A);
fprintf('  B  2^(B-1) A_C / sqrt(C_DAC)   = %.3f LSB  (exact sum of step errors: %.3f)\n', form_B, form_B_exact);
fprintf('chips with at least one missing code (DNL = -1): %.1f %%\n', 100*mean(any(DNL <= -1 + 1e-9, 2)));
fprintf('\nfor 3 sigma DNL < 0.5 LSB (input width): C_DAC = %.1f pF with formula B, %.1f pF with A\n', ...
        (6 * 2^(N_bits-1) * A_C)^2 / 1000, (6 * 2^N_bits * A_C)^2 / 1000);
% What each formula describes:
% B: the width of a code on the input axis. Its lower edge is the first decision,
%    which compares with zero and needs no capacitor, so every step error counts once.
% A: the jump between the two output values on either side of mid-scale when the
%    decisions are read with the real weights. Both outputs carry the same error
%    with opposite sign, so the difference is that error twice.
% INL: at mid-scale the end-point line passes through zero (the converter is
%    symmetric), so the INL next to mid is the DNL of code 0 itself.
if abs(sDNL(i0)/form_B_exact - 1) < 0.1 && abs(std(gap)/form_A - 1) < 0.1
    disp('CHECK OK: DNL follows formula B, the output jump follows formula A')
else
    disp('CHECK FAILED')
end

%% -----------------------------
% 6) The ladder: staircase, DNL and INL of the worst chip, and the 3 sigma band
% -----------------------------
[~, wc] = max(max(abs(DNL), [], 2));              % chip with the worst DNL
r = x * Q_LSB;  Q_out = zeros(size(x));           % convert it again for the staircase
for k = 1:numel(w)
    s = 2*(r >= 0) - 1;  r = r - s * Q_real(wc, k);  Q_out = Q_out + s * Q_nom(k);
end
s = 2*(r >= 0) - 1;  code_wc = round((Q_out + s*Q_nom(end)/2)/Q_LSB - 0.5);
zoom = abs(x) <= 6;
figure;
subplot(3,1,1);
plot(x(zoom), code_wc(zoom), 'b', x(zoom), floor(x(zoom)), 'k--'); grid on;
xlabel('input charge [LSB]'); ylabel('code');
legend('worst chip', 'ideal', 'Location', 'northwest');
title('Ladder around mid-scale: binary CDAC from 35 fF units, no calibration');
subplot(3,1,2);
plot(codes(inner), DNL(wc,:), 'b', codes(inner), 3*sDNL, 'r', codes(inner), -3*sDNL, 'r'); grid on;
xlabel('code'); ylabel('DNL [LSB]'); legend('worst chip', '\pm 3\sigma over chips');
subplot(3,1,3);
plot(codes(inner), INL(wc,:), 'b', codes(inner), 3*sINL, 'r', codes(inner), -3*sINL, 'r'); grid on;
xlabel('code'); ylabel('INL [LSB]'); legend('worst chip', '\pm 3\sigma over chips');

