%% s2b_memory_mismatch_tones.m   STEP 2b: how large are the tones from memory cell mismatch?
% QUESTION: every channel uses its 22 cells in turn. The cells differ slightly, so the
% gain of the beamformer repeats every 22 samples. How large are the tones that this
% gives, and how much do they add to the noise of the converter?
%
% In charge: a cell writes Q = C_M,i * V. A cell that is eps_i too large gives eps_i too
% much charge. Only gain mismatch here; offset charges per cell (switch charge injection)
% need Cadence data and come in step 2c.
% No ADC here: the output is the exact summed charge, so everything that is not the
% signal is caused by the mismatch.
%
% Hand estimate (D): one cell sigma_eps = A_C / sqrt(C_M). The pattern of one channel puts
% a power sigma_eps^2 (relative to the signal) into tones; N channels have independent
% cells, so the signal adds as N and the tones in power: total sigma_eps^2 / N.

clear; clc;
here = fileparts(mfilename('fullpath')); if isempty(here), here = pwd; end
addpath(fullfile(fileparts(here), '1_settings'));
p = zaan_params();
N = p.N_ch;  M = p.M_cells;
randn('seed', 2);

%% 1. Delays in whole 25 ns slots for the steering angle (cell rotation per channel)
tau  = (0:N-1) * p.pitch * sind(p.theta) / p.c;      % [s]
kdel = round(tau * p.fs);                            % [slots]

%% 2. A sine that falls exactly on an FFT bin; the tone spacing fs/M also on the bin grid
n_fft = M * 512;                       % fs / M is then exactly bin 512
k_sig = 2063;                          % odd bin, about 7.3 MHz
m = 0:n_fft-1;
s = sin(2 * pi * k_sig * m / n_fft);   % the aligned echo, after the delays

C_list = [35 70 140 280 560] * 1e-15;  % memory cell sizes to try [F]
n_chips = 40;
ADC_noise_dBc = -(6.02 * p.ENOB + 1.76);   % total converter noise at the ENOB aim
fprintf('converter noise at ENOB %.1f: %.1f dBc in total\n\n', p.ENOB, ADC_noise_dBc);
fprintf('%8s %10s %14s %14s %16s %16s\n', 'C_M [fF]', 'sigma [%]', 'tones, hand', 'tones, sim', 'largest tone', 'ENOB loss [bit]');

for C_M = C_list
    sig = p.A_C / sqrt(C_M * 1e15);             % relative spread of one cell
    tot = zeros(1, n_chips);  big = zeros(1, n_chips);
    for chip = 1:n_chips
        g = 1 + sig * randn(N, M);              % gain of every cell of every channel
        Q = zeros(1, n_fft);
        for j = 1:N
            cell = mod(m - kdel(j), M) + 1;     % the cell channel j wrote this sample into
            Q = Q + g(j, cell) .* s;            % its charge, relative to C_M V
        end
        P = abs(fft(Q)).^2;  P = P(1:n_fft/2);  % one-sided power
        Ps = P(k_sig + 1);  P(k_sig + 1) = 0;  P(1) = 0;   % keep only the tones
        tot(chip) = 10 * log10(sum(P) / Ps);
        big(chip) = 10 * log10(max(P) / Ps);
    end
    hand = 10 * log10(sig^2 / N);
    t = 10 * log10(mean(10.^(tot / 10)));
    loss = log2(sqrt(1 + 10^((t - ADC_noise_dBc) / 10)));   % extra noise power on top of the converter noise
    fprintf('%8.0f %10.2f %11.1f dBc %11.1f dBc %10.1f dBc max %14.3f\n', ...
            C_M * 1e15, sig * 100, hand, t, max(big), loss);
end
fprintf('\n"largest tone" is the worst of %d chips. ENOB loss: tones added to the converter noise.\n', n_chips);

%% 4. Plot: the spectrum of one chip at 280 fF, relative to the signal
C_M = 280e-15;  sig = p.A_C / sqrt(C_M * 1e15);
g = 1 + sig * randn(N, M);                       % one chip
Q = zeros(1, n_fft);
for j = 1:N
    Q = Q + g(j, mod(m - kdel(j), M) + 1) .* s;
end
P  = abs(fft(Q)).^2;  P = P(1:n_fft/2);          % power per bin, 0 .. fs/2
Ps = P(k_sig + 1);                               % the signal
f  = (0:n_fft/2 - 1) * p.fs / n_fft / 1e6;       % frequency of every bin [MHz]
figure;
plot(f, 10 * log10(P / Ps + 1e-30), 'b');        % 1e-30: empty bins would give log of 0
hold on;
plot([0 f(end)], [1 1] * (ADC_noise_dBc - 10 * log10(n_fft / 2)), 'r--');  % ADC noise per bin
grid on;  ylim([-130 5]);
xlabel('frequency [MHz]');  ylabel('power relative to the signal [dBc]');
title(sprintf('one chip, C_M = %.0f fF: tones from cell mismatch', C_M * 1e15));
legend('signal and tones', 'ADC noise at ENOB 9.5, per bin');
