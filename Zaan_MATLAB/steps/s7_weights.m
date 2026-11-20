%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%     STEP 7: ALL ERRORS AGAINST THE TOLERANCE: WHAT REDUNDANCY SOLVES    %
%                     AND WHAT REACHES THE OUTPUT                         %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% QUESTION
% With a redundant weight list and calibrated weights, which errors are
% repaired by the tolerance, which reach the output, and what SNDR is left?
%
% ANSWER (with the values of section 1, one chip, 7.3 MHz sine)
% Repaired by the tolerance: CDAC mismatch (0.43 LSB -> 0), offset (0.17 -> 0.004),
% settling (2.2 -> 0.005). Not repaired: everything on the input (memory tones,
% extra charge, kT/C, jitter), the precharge kT/C, and the noise of the last
% decisions. All together 0.354 LSB rms: SNDR 59.7 dB, ENOB 9.62, before rounding.

% HOW
% Every error is put into the conversion where it physically happens, in charge.
% The converter is run with one error at a time, then with all of them, on a
% sine. "Where it enters" is the error's size at its own place; "in the output"
% is what the simulation finds in the result. The difference is what the
% tolerance repaired.
%
% NOT HERE YET
% Rounding to 10 bits (the second quantisation) comes in step 8, and so does
% the calibration itself: here the weights are read perfectly (assumption).
%
% FILL IN the values of section 1. Status after every value.

clear; close all; clc;
zaan_constants;
rng(7, 'twister');

%% -----------------------------
% 1) Values to fill in (each error can be switched off with 0)
% -----------------------------
w          = [224 128 72 40 24 16 8 4 2 1 0.5 0.5];  % weight list [LSB]        A (candidate + 1 unit)
v_n        = 50e-6;     % comparator noise [V rms]                              A
v_os       = 0.15e-3;   % comparator offset left after calibration [V]          S (Malki 2014, p. 1174)
eps_settle = 0.01;      % part of a step not yet settled at the next decision   A (placeholder)
switch_on  = 1;         % switch noise sqrt(2 kT C_node) per decision, 1 = on    D (placeholder, upper bound)
cdac_ktc   = 1;         % precharge kT/C of every step, 1 = on                   Rabuske eq. 4.100 (not simulated before)
mem_ktc    = 1;         % kT/C of the memory cells, 1 = on                       step 2a
mem_gain   = 1;         % gain mismatch of the memory cells, 1 = on              step 2b
sig_q_cell = 0.16e-15;  % extra charge per memory cell, spread [C]              A (spec from step 2c)
jitter     = 1e-12;     % clock jitter on the write [s rms]                     A (not studied)

%% -----------------------------
% 2) The converter: charge scale, steps, node per decision (steps 0, 3, 5)
% -----------------------------
C_TH  = N_ch * C_M;
Q_LSB = C_TH * V_FS / 2^N_bits;
V_REF = alpha * V_FS / 2;
lsb_u = 2 * C_u * V_REF / Q_LSB;                  % one unit = 8 LSB
sig_u = A_C / sqrt(C_u * 1e15);
n     = numel(w);
units = w / lsb_u;
C_step = max(units, 1) * C_u;                     % physical capacitor of each step
C_node = C_TH + [0, cumsum(2 * C_step)];          % node at every decision
Q_nom  = w * Q_LSB;
sig_rel = sig_u ./ sqrt(max(units, 1));  sig_rel(units < 1) = sig_u;   % as step 5
Q_real = Q_nom .* (1 + sig_rel .* randn(1, n));   % ONE chip: its real steps

t = zeros(1, n+1);
for k = 1:n, t(k) = sum(w(k+1:end)) + w(end) - w(k); end

%% -----------------------------
% 3) The input: a sine at -0.5 dBFS, exactly on an FFT bin
% -----------------------------
n_s  = 4096;  cyc = 751;                          % 751 periods: about 7.3 MHz
m    = 0:n_s-1;
A    = 10^(-0.5/20) * 2^(N_bits-1);               % amplitude [LSB]
x_id = A * sin(2*pi*cyc*m/n_s) * Q_LSB;           % the ideal input charge [C]

% errors on the input itself (before the converter), from steps 2a to 2c
kdel = round((0:N_ch-1) * pitch * sind(theta) / c_sound * fs);
g = 1 + (A_C/sqrt(C_M*1e15)) * randn(N_ch, M_cells);   % memory gain per cell
q = sig_q_cell * randn(N_ch, M_cells);                 % memory extra charge per cell
gain_pat = zeros(1, n_s);  off_pat = zeros(1, n_s);
for j = 1:N_ch
    cell = mod(m - kdel(j), M_cells) + 1;
    gain_pat = gain_pat + (g(j, cell) - 1) / N_ch;       % average gain error of the sum
    off_pat  = off_pat + q(j, cell);
end
in_err = { mem_gain * gain_pat .* x_id, ...                                   % memory gain tones
           off_pat - mean(off_pat), ...                                       % memory extra charge
           mem_ktc * sqrt(2*N_ch*kB*T*C_M) * randn(1, n_s), ...               % memory kT/C
           jitter * 2*pi*cyc/n_s*fs * A*Q_LSB * cos(2*pi*cyc*m/n_s) .* randn(1, n_s) };   % jitter

%% -----------------------------
% 4) Run the converter: no errors, each error alone, all together
% -----------------------------
zero  = zeros(1, n+1);
q_cmp = v_n * C_node;                                      % comparator noise as charge
q_sw  = switch_on * sqrt(2*kB*T*C_node);                   % switch noise as charge
q_off = v_os * C_node;                                     % offset as charge
q_pre = cdac_ktc * sqrt(4*kB*T*C_step);                    % precharge noise per step
names = {'memory gain tones', 'memory extra charge', 'memory kT/C', 'clock jitter', ...
         'CDAC mismatch (calibrated)', 'CDAC precharge kT/C', 'comparator noise', ...
         'switch noise', 'comparator offset', 'settling'};
% where each error enters, rms [LSB]: on the input, or the largest over the decisions
enter = [std(in_err{1}), std(in_err{2}), std(in_err{3}), std(in_err{4}), ...
         sqrt(sum((Q_real - Q_nom).^2)), sqrt(sum(q_pre.^2)), max(q_cmp), max(q_sw), ...
         max(abs(q_off - q_off(end))), max(eps_settle * Q_real)] / Q_LSB;

base = cs_sar(x_id, Q_nom, Q_nom, C_node, zero, zero, 0, zero*0) / Q_LSB;
e0   = base - x_id/Q_LSB;                                  % quantisation of the SAR itself
P0   = mean((e0 - mean(e0)).^2);
outp = zeros(1, numel(names));
for i = 1:numel(names)
    x = x_id;  Qr = Q_nom;  qd = zero;  qo = zero;  es = 0;  qp = zero*0;
    if i <= 4, x = x_id + in_err{i}; end
    if i == 5, Qr = Q_real; end
    if i == 6, qp = q_pre; end
    if i == 7, qd = q_cmp; end
    if i == 8, qd = q_sw; end
    if i == 9, qo = q_off; end
    if i == 10, es = eps_settle; end
    y = cs_sar(x, Qr, Qr, C_node, qd, qo, es, qp) / Q_LSB;    % read with the real weights
    e = y - x_id/Q_LSB;  e = e - mean(e);                     % remove the plain offset
    outp(i) = sqrt(max(mean(e.^2) - P0, 0));                  % what this error adds [LSB rms]
end
% all together
x_all = x_id + in_err{1} + in_err{2} + in_err{3} + in_err{4};
y = cs_sar(x_all, Q_real, Q_real, C_node, sqrt(q_cmp.^2 + q_sw.^2), q_off, eps_settle, q_pre) / Q_LSB;
e = y - x_id/Q_LSB;  e = e - mean(e);
P_all = mean(e.^2);
SNDR  = 10*log10((A^2/2) / P_all);
ENOB  = (SNDR - 1.76) / 6.02;

%% -----------------------------
% 5) Results
% -----------------------------
fprintf('weights: %s\n', num2str(w));
fprintf('tolerance per decision: %s\n\n', num2str(t, '%.1f  '));
fprintf('%-28s %16s %16s\n', 'error', 'where it enters', 'in the output');
fprintf('%-28s %16.3f\n', 'SAR quantisation (last step)', sqrt(P0));
for i = 1:numel(names)
    fprintf('%-28s %12.3f LSB %12.3f LSB\n', names{i}, enter(i), outp(i));
end
fprintf('\nall together: %.3f LSB rms in the output: SNDR %.1f dB, ENOB %.2f\n', sqrt(P_all), SNDR, ENOB);
fprintf('(before rounding to 10 bit, perfect calibration; one chip)\n');

figure; bar([enter; outp]'); grid on;
set(gca, 'XTick', 1:numel(names), 'XTickLabel', names);
ylabel('rms error [LSB]'); legend('where it enters', 'in the output');
title(sprintf('What the tolerance repairs: SNDR %.1f dB, ENOB %.2f', SNDR, ENOB));
