%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%   STEP 8: CALIBRATION, THE SECOND QUANTISATION, AND THE FIRST HONEST    %
%                                  ENOB                                   %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% QUESTION
% With every error of steps 2 to 7h switched on, what ENOB, DNL and INL does
% the 10-bit output reach after calibration? Does the rounding of the
% calibrated sum to 10 bit cost ENOB, and does one more half-LSB step help
% (12 or 13 decisions, an open decision)?
%
% ANSWER (10 chips, all errors on; v_os 1 mV, 4.6 tau, 45 uV are A; D from simulation)
%   ideal check                          ENOB 10.01
%   no calibration                       ENOB 9.29, INL 2.2 LSB, missing codes
%   calibrated, 12 decisions             ENOB 9.53, but 13 missing codes: the rounding
%   calibrated, 13 decisions (+ 0.5)     ENOB 9.79, DNL 0.54, no missing codes
%   with the memory gain tones of step 2b (-62.6 dBc) added in power:
%                                        9.26 (12 decisions), 9.43 (13 decisions)
% So with the tones, ENOB 9.5 is NOT reached. Step 4 counted the quantisation
% once (1/12 LSB^2); the second quantisation adds 1/12 (12 decisions) or
% 1/48 (13 decisions) on top. The memory tones (0.072 LSB^2) are the largest
% single item after quantisation.

% THE STORY
% 1. Calibration. The chip's steps are not their nominal size (mismatch,
%    parasitic gain). A known input (here: random inputs, foreground) is
%    converted; least squares finds the weight of every decision that best
%    rebuilds the input from the decisions. Those 12 or 13 numbers are the
%    LUT. From then on the output is the sum of the decisions times the LUT.
% 2. The second quantisation. The sum has its own resolution: the last step
%    leaves an error of up to half the last step. That sum is then rounded to
%    a 10-bit code. With nominal weights the sum always lands on the half-LSB
%    grid and rounding adds nothing. With calibrated weights it lands
%    anywhere, so rounding adds a second error. Two independent errors of
%    1 LSB width add in power: 1/12 + 1/12 = 1/6 LSB^2, i.e. 0.5 bit lost.
%    A finer last step (half an LSB, one more decision) shrinks the first
%    error to 1/48 LSB^2: 1/12 + 1/48 = 5/48, only 0.16 bit lost.
% 3. The ENOB. Rabuske eq. 4.73: the error power of a converter is the ideal
%    1/12 LSB^2 plus the mean square of its INL. Random noise adds on top:
%        P = 1/12 + mean(INL^2) + q_noise^2          [LSB^2]
%        ENOB = 10 - 0.5 log2(P / (1/12))
%    The simulated FFT must agree with this.
%
% HAND CHECK
% Random noise in LSB^2 (steps 2a and 7h): memory kT/C 0.0019 + CDAC kT/C
% 0.0019 + comparator 0.0086 = 0.0124.
% 12 decisions: P = 1/12 + 1/12 + 0.0124 = 0.179  -> ENOB = 10 - 0.5 log2(0.179 x 12) = 9.45
% 13 decisions: P = 1/12 + 1/48 + 0.0124 = 0.117  -> ENOB = 10 - 0.5 log2(0.117 x 12) = 9.76
% Memory tones: full-scale sine 512^2 / 2 = 131072 LSB^2, x 10^(-6.26) = 0.072 LSB^2.
% Eq. 4.73 with the INL of a noise-free ramp comes out a bit LOWER than the
% FFT: noise dithers the rounding, so the static INL overstates its cost.

% WHAT THE CODE DOES
%   1) the errors: mismatch per chip, offset, settling, CDAC kT/C, comparator
%      and memory noise
%   2) per chip: calibrate (least squares), then convert a sine (FFT -> ENOB)
%      and a slow ramp without noise (DNL, INL)
%   3) four cases: ideal check, no calibration, calibrated with 12 and 13 decisions
%   4) ENOB against Rabuske eq. 4.73, and with the memory tones of step 2b

clear; close all; clc;
zaan_constants;
C_TH  = N_ch * C_M;
Q_LSB = C_TH * V_FS / 2^N_bits;
V_REF = alpha * V_FS / 2;
lsb_u = 2 * C_u * V_REF / Q_LSB;
sig_u = A_C / sqrt(C_u * 1e15);

%% -----------------------------
% 1) The errors
% -----------------------------
v_os  = 1e-3;                     % comparator offset after its own trim [V]    A (step 7f allows 3.5 mV)
eps_s = exp(-4.6);                % settling, 4.6 tau (step 7b)                 A
v_n   = 45e-6;                    % comparator noise [V rms] (step 4)            A (target)
q_mem = sqrt(2 * N_ch * kB * T * C_M);   % memory kT/C on the input [C rms] (step 2a)
tone_dBc = 10*log10((A_C/sqrt(C_M*1e15))^2 / (2*N_ch));   % memory gain tones, differential cell (step 2b): -65.6 dBc at 280 fF   D
n_chips = 10;
N_fft = 4096;  cyc = 1301;        % coherent sine: 1301 periods in 4096 samples
f_in  = cyc / N_fft * fs;         % 12.7 MHz, near f_max
A_sin = 0.95 * 512 * Q_LSB;       % -0.45 dBFS [C]
xs    = A_sin * sin(2*pi*cyc*(0:N_fft-1)/N_fft);
xr    = (-511.5 : 0.02 : 511.5) * Q_LSB;          % ramp for DNL and INL [C]
xc    = (rand(1, 4e4) - 0.5) * 1020 * Q_LSB;       % calibration inputs [C]

cases = {'ideal, nominal weights', 'all errors, no calibration', ...
         'all errors, calibrated, 12 decisions', 'all errors, calibrated, 13 decisions'};
res = zeros(numel(cases), 5);     % ENOB fft, ENOB eq. 4.73, DNL max, INL max, missing codes
rng(8, 'twister');
for c = 1:numel(cases)
    w = w_design;  if c == 4, w = [w_design 0.5]; end
    n = numel(w);
    units = w / lsb_u;
    sig_r = sig_u ./ sqrt(max(units, 1));  sig_r(units < 1) = sig_u;
    C_node = C_TH + [0, cumsum(2 * max(units, 1) * C_u)];
    q_pre  = 2 * sqrt(kB * T * w * Q_LSB / (2*V_REF));   % CDAC kT/C per step [C]
    on = (c > 1);                                         % errors on?
    r = zeros(n_chips, 5);
    for chip = 1:n_chips
        Q_real = w * Q_LSB .* (1 + on * sig_r .* randn(1, n));
        conv = @(x, noisy) cs_sar(x + noisy*on*q_mem*randn(size(x)), Q_real, Q_real, C_node, ...
               noisy*on*v_n*C_node, on*v_os*C_node, on*eps_s, noisy*on*q_pre);
        %% 2) calibration: least squares from decisions to input -> LUT
        if c >= 3
            [~, S] = conv(xc, 1);
            LUT = [S', ones(numel(xc), 1)] \ xc';
        else
            LUT = [w, w(end)/2, 0]' * Q_LSB;             % nominal weights
        end
        out = @(S) min(max(round(([S', ones(size(S,2),1)] * LUT)' / Q_LSB - 0.5), -512), 511) + 0.5;
        % sine -> FFT -> ENOB
        [~, S] = conv(xs, 1);  y = out(S);
        Y = abs(fft(y)).^2;  Y = Y(2:N_fft/2);              % no DC
        P_s = Y(cyc);  P_n = sum(Y) - P_s;
        r(chip, 1) = (10*log10(P_s/P_n) + 20*log10(512*Q_LSB/A_sin) - 1.76) / 6.02;   % referred to full scale
        % ramp without noise -> DNL, INL
        [~, S] = conv(xr, 0);  code = out(S) - 0.5;
        cnt = accumarray(code(:) + 513, 1, [1024 1])';
        wid = cnt(2:end-1) * 0.02;  dnl = wid/mean(wid) - 1;  inl = cumsum(dnl);
        % Rabuske eq. 4.73 plus random noise
        q_rand2 = on * ((q_mem/Q_LSB)^2 + sum((q_pre/Q_LSB).^2) + (v_n*C_node(end)/Q_LSB)^2);
        % (the second quantisation needs no extra term: it shows up as uneven
        %  code widths, so it is already inside the INL)
        P = 1/12 + mean(inl.^2) + q_rand2;
        r(chip, 2) = N_bits - 0.5*log2(P*12);
        r(chip, 3:5) = [max(abs(dnl)), max(abs(inl)), sum(dnl <= -1 + 1e-9)];
    end
    res(c, :) = mean(r, 1);  res(c, 5) = max(r(:, 5));
end

%% -----------------------------
% 3) and 4) Results
% -----------------------------
fprintf('%-38s  ENOB fft  ENOB eq.4.73  DNL max  INL max  missing codes (worst chip)\n', 'case (mean of 10 chips)');
for c = 1:numel(cases)
    fprintf('%-38s  %7.2f  %10.2f  %7.2f  %7.2f  %6d\n', cases{c}, res(c, :));
end
for c = 3:4
    sndr = 6.02*res(c,1) + 1.76;
    tot  = -10*log10(10^(-sndr/10) + 10^(tone_dBc/10));
    fprintf('%s, with the memory tones (%.1f dBc): ENOB %.2f\n', cases{c}, tone_dBc, (tot - 1.76)/6.02);
end
if abs(res(1,1) - 10) < 0.05 && all(res(3:4,1) - res(3:4,2) > -0.05 & res(3:4,1) - res(3:4,2) < 0.3)
    disp('CHECK OK: ideal gives 10 bit; Rabuske eq. 4.73 (static INL) is a lower bound within 0.3 bit')
else
    disp('CHECK FAILED')
end
