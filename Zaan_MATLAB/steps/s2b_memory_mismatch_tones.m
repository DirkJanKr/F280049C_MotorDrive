%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%        STEP 2b: TONES FROM GAIN MISMATCH BETWEEN MEMORY CELLS           %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% QUESTION
% The memory cells are not exactly equal. How large are the tones this gives
% in the beamformer output, and how does that change with the cell size C_M?
%
% ANSWER (full-scale sine, differential cells, 40 chips per size)
% 280 fF: all tones together about -65.6 dBc. Each doubling of C_M: -3 dB.
% The simulation agrees with the hand formula sigma^2 / (2 N) within 0.5 dB.
% The total does not depend on the signal frequency (7, 10, 13 MHz). Inside
% the echo band 7 to 13 MHz about -71 dBc is left: the tones spread evenly
% over 0 to 20 MHz, and the band is 6 of those 20 MHz (-5.2 dB).
%
% THE STORY (in three sentences)
% 1. A memory cell is two capacitors (one on P, one on N). Each is a little
%    off its design value, so each cell has a slightly different gain.
% 2. A channel uses its 22 cells in turn, so its gain repeats the same
%    pattern every 22 samples. A gain that repeats every 22 samples
%    multiplies the signal by a pattern, and that creates tones at the
%    signal frequency +- multiples of fs / 22.
% 3. The 16 channels add the signal in phase (beamformer gain), but their
%    cell errors are independent, so the tones add only in power: the total
%    tone power relative to the signal drops by a factor N.
%
% Why sigma / sqrt(2): the cell stores charge on both capacitors, so its gain
% is the AVERAGE of the two errors, (e_P + e_N) / 2. Averaging two
% independent errors divides the spread by sqrt(2). (Their difference
% divides out in the voltage the comparator sees, Rabuske eq. 4.30.)
% Assumption (A): cells of different channels mismatch independently.
%
% HAND CHECK (do this on paper)
% One capacitor of 280 fF: sigma = A_C / sqrt(280) = 0.0499 / 16.7 = 0.30 %
% One cell (average of two):   0.30 % / sqrt(2) = 0.21 %
% Tones, all together:   sigma_cell^2 / N = (0.0021)^2 / 16 = 2.8e-7  ->  -65.6 dBc
%
% WHAT THE CODE DOES
%   1) values
%   2) which cell each channel uses at each sample
%   3) one chip: draw the cell gains, add the 16 channels, look at the spectrum
%   4) repeat for 40 chips and 5 cell sizes, compare with the hand formula
%   5) plot the spectrum of one chip

clear; close all; clc;
zaan_constants;
rng(2, 'twister');            % the same random chips every run

%% -----------------------------
% 1) Values
% -----------------------------
C_list  = [35 70 140 280 560] * 1e-15;   % cell sizes to try [F]
n_chips = 40;                            % random chips per size
n_fft   = M_cells * 512;                 % record length, so fs / 22 falls exactly on a bin
k_sig   = 2063;                          % the sine makes 2063 periods: about 7.3 MHz
m       = 0 : n_fft-1;                   % sample number
signal  = sin(2*pi*k_sig*m/n_fft);       % the echo after the delays (equal in every channel)

%% -----------------------------
% 2) Which cell each channel uses at each sample
% -----------------------------
% Channel j is delayed by kdel(j) samples (steering at theta). At sample m it
% writes into cell number mod(m - kdel(j), 22) + 1, so it walks through its
% 22 cells in turn. The channels start at different cells because of the delay.
delay_s = (0:N_ch-1) * pitch * sind(theta) / c_sound;   % delay per channel [s]
kdel    = round(delay_s * fs);                          % the same in samples
cell_of = zeros(N_ch, n_fft);
for j = 1:N_ch
    cell_of(j, :) = mod(m - kdel(j), M_cells) + 1;      % mod: remainder after dividing by 22
end

%% -----------------------------
% 3) and 4) Many chips, several cell sizes
% -----------------------------
fprintf(' C_M [fF]  one capacitor  tones, hand   tones, simulated   largest tone\n');
for i = 1:numel(C_list)
    sigma   = A_C / sqrt(C_list(i)*1e15);         % spread of one capacitor
    tones   = zeros(1, n_chips);                  % all tones together, per chip [relative power]
    largest = zeros(1, n_chips);
    for chip = 1:n_chips
        % 3a) every cell gets its own gain: the average of its P and N capacitor
        e_P  = sigma * randn(N_ch, M_cells);
        e_N  = sigma * randn(N_ch, M_cells);
        gain = 1 + (e_P + e_N) / 2;
        % 3b) the beamformer output: each channel's signal times the gain of the
        %     cell it uses at that sample, added over the 16 channels
        out = zeros(1, n_fft);
        for j = 1:N_ch
            out = out + gain(j, cell_of(j, :)) .* signal;   % .* multiplies sample by sample
        end
        % 3c) spectrum: remove the signal and DC, what is left are the tones
        P = abs(fft(out)).^2;   P = P(1 : n_fft/2);
        P_sig = P(k_sig + 1);                     % the signal (bin 0 is position 1)
        P(k_sig + 1) = 0;   P(1) = 0;
        tones(chip)   = sum(P) / P_sig;
        largest(chip) = max(P) / P_sig;
    end
    hand = sigma^2 / (2*N_ch);                    % the hand formula
    fprintf('%7.0f    %8.2f %%    %8.1f dBc    %8.1f dBc    %8.1f dBc\n', C_list(i)*1e15, ...
            sigma*100, 10*log10(hand), 10*log10(mean(tones)), 10*log10(max(largest)));
end

%% -----------------------------
% 5) Spectrum of one chip at 280 fF
% -----------------------------
sigma = A_C / sqrt(280);
gain  = 1 + sigma * (randn(N_ch, M_cells) + randn(N_ch, M_cells)) / 2;
out   = zeros(1, n_fft);
for j = 1:N_ch
    out = out + gain(j, cell_of(j, :)) .* signal;
end
P = abs(fft(out)).^2;   P = P(1 : n_fft/2);
f = (0 : n_fft/2-1) * fs / n_fft;                 % frequency of every bin [Hz]
figure; grid on;
plot(f/1e6, 10*log10(P / P(k_sig+1) + 1e-30));   % 1e-30 avoids log of 0
xlabel('Frequency [MHz]'); ylabel('Power relative to the signal [dBc]');
title('Memory cell tones, one chip, 280 fF: signal at 7.3 MHz, tones every fs / 22');

%% -----------------------------
% 6) Does the signal frequency matter? Total tones, and the part inside the echo band
% -----------------------------
% The total tone power does not depend on the signal frequency: the gain error
% multiplies the signal, whatever its frequency. But WHERE the tones land does:
% after the IQ demodulator only the echo band (7 to 13 MHz) is left.
% Frequencies on exact bins (whole number of periods), 280 fF, 40 chips each.
sigma = A_C / sqrt(280);
f_try = [7 10 13] * 1e6;
fprintf('\n signal    all tones    tones inside 7 to 13 MHz\n');
for f_t = f_try
    k   = round(f_t / fs * n_fft);  if mod(k, 2) == 0, k = k + 1; end   % odd bin: never a multiple of fs / 22
    sig = sin(2*pi*k*m/n_fft);
    f   = (0 : n_fft/2-1) * fs / n_fft;
    band = f >= 7e6 & f <= 13e6;
    t_all = 0;  t_band = 0;
    for chip = 1:n_chips
        gain = 1 + sigma * (randn(N_ch, M_cells) + randn(N_ch, M_cells)) / 2;
        out  = zeros(1, n_fft);
        for j = 1:N_ch, out = out + gain(j, cell_of(j, :)) .* sig; end
        P = abs(fft(out)).^2;   P = P(1 : n_fft/2);
        P_sig = P(k + 1);   P(k + 1) = 0;   P(1) = 0;
        t_all  = t_all  + sum(P) / P_sig / n_chips;
        t_band = t_band + sum(P(band)) / P_sig / n_chips;
    end
    fprintf('%6.2f MHz  %7.1f dBc   %7.1f dBc\n', k/n_fft*fs/1e6, 10*log10(t_all), 10*log10(t_band));
end
