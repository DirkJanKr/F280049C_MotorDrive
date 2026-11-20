%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%        STEP 2b: TONES FROM GAIN MISMATCH BETWEEN MEMORY CELLS           %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% QUESTION
% Every channel uses its 22 cells in turn. The cells differ slightly, so the
% gain of the beamformer repeats every 22 samples. How large are the tones,
% and how much do they cost?
%
% ANSWER (full-scale sine)
% 280 fF: all tones together -62.6 dBc (1.18 fC rms), largest -65 to -68 dBc.
% Hand formula sigma^2 / N agrees within 0.5 dB. Each doubling of C_M: -3 dB.
%
% This is not kT/C: the error of a cell is drawn ONCE per chip and stays.
% In charge: a cell writes Q = C_M,i V, so a cell eps_i too large gives eps_i
% too much charge (a gain error). No ADC here: the output is the exact summed
% charge, so everything that is not the signal comes from the mismatch.
%
% Hand formula: one cell has spread sigma = A_C / sqrt(C_M). One channel puts
% sigma^2 (relative to the signal) into tones. N channels with INDEPENDENT
% cells add the signal coherently (beamformer gain) and the tones in power:
% total sigma^2 / N.
% ASSUMPTION: the cells of different channels are independent. A layout
% gradient shared by equal cell numbers would remove the 1/N.

clear; close all; clc;
zaan_constants;
rng(2, 'twister');        % fixed random numbers: the same chips every run

%% -----------------------------
% 1) Delays: which cell each channel reads (whole 25 ns slots)
% -----------------------------
tau  = (0:N_ch-1) * pitch * sind(theta) / c_sound;   % delay per channel [s]
kdel = round(tau * fs);                              % the same in slots
% sind = sine of an angle in degrees; round = to the nearest whole number

%% -----------------------------
% 2) Test signal: a sine exactly on one FFT bin
% -----------------------------
n_fft = M_cells * 512;     % record length; fs/M_cells is then exactly bin 512
k_sig = 2063;              % the sine makes 2063 periods: about 7.3 MHz
m = 0:n_fft-1;             % sample number
s = sin(2*pi*k_sig*m/n_fft);   % the echo after the delays (same for all channels)

C_list  = [35 70 140 280 560] * 1e-15;   % memory cell sizes to try [F]
n_chips = 40;                            % random chips per size
ADC_noise_dBc = -(6.02*ENOB_aim + 1.76); % total converter noise at the ENOB aim

fprintf('converter noise at ENOB %.1f: %.1f dBc\n\n', ENOB_aim, ADC_noise_dBc);
fprintf(' C_M [fF]   sigma [%%]   tones, hand   tones, sim   largest tone   ENOB loss\n');

%% -----------------------------
% 3) For every size: 40 chips, each with its own cells
% -----------------------------
for i = 1:numel(C_list)
    sig = A_C / sqrt(C_list(i)*1e15);        % relative spread of one cell
    tot = zeros(1, n_chips);                 % all tones per chip [dBc]
    big = zeros(1, n_chips);                 % largest tone per chip [dBc]
    for chip = 1:n_chips
        g = 1 + sig*randn(N_ch, M_cells);    % gain of every cell, drawn once
        Q = zeros(1, n_fft);                 % summed output charge (relative)
        for j = 1:N_ch
            cell = mod(m - kdel(j), M_cells) + 1;   % the cell channel j uses
            % mod(a, M) = remainder after dividing by M: 0, 1, ..., M-1, 0, ...
            Q = Q + g(j, cell) .* s;         % .* multiplies element by element
        end
        P  = abs(fft(Q)).^2;                 % power per frequency bin
        P  = P(1:n_fft/2);                   % keep 0 .. fs/2
        Ps = P(k_sig + 1);                   % the signal (bin 0 is position 1)
        P(k_sig + 1) = 0;  P(1) = 0;         % remove signal and DC: only tones left
        tot(chip) = 10*log10(sum(P)/Ps);
        big(chip) = 10*log10(max(P)/Ps);
    end
    hand = 10*log10(sig^2 / N_ch);
    t    = 10*log10(mean(10.^(tot/10)));     % average the POWER, then back to dB
    loss = log2(sqrt(1 + 10^((t - ADC_noise_dBc)/10)));   % ENOB lost by adding the tones
    fprintf('%8.0f %11.2f %10.1f dBc %10.1f dBc %10.1f dBc %10.3f bit\n', ...
            C_list(i)*1e15, sig*100, hand, t, max(big), loss);
end

%% -----------------------------
% 4) Plot: the spectrum of one chip at 280 fF
% -----------------------------
sig = A_C / sqrt(280);
g   = 1 + sig*randn(N_ch, M_cells);
Q   = zeros(1, n_fft);
for j = 1:N_ch
    Q = Q + g(j, mod(m - kdel(j), M_cells) + 1) .* s;
end
P  = abs(fft(Q)).^2;  P = P(1:n_fft/2);
Ps = P(k_sig + 1);
f  = (0:n_fft/2-1) * fs / n_fft;             % frequency of every bin [Hz]

figure; hold on; grid on;
plot(f/1e6, 10*log10(P/Ps + 1e-30), 'b');    % 1e-30 avoids log of 0 in empty bins
plot([0 f(end)/1e6], [1 1]*(ADC_noise_dBc - 10*log10(n_fft/2)), 'r--');
ylim([-130 5]);
xlabel('Frequency [MHz]'); ylabel('Power relative to the signal [dBc]');
title('One chip, C_M = 280 fF: tones from cell mismatch');
legend('signal and tones', 'ADC noise at ENOB 9.5, per bin');
