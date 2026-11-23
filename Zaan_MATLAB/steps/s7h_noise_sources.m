%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%   STEP 7h: THE PLACEHOLDER NOISE SOURCES OF STEP 4, NOW SIMULATED       %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% QUESTION
% Step 4 listed CDAC kT/C, comparator noise and clock jitter as formulas only.
% Now the CDAC exists (w_design): does the simulated conversion give the
% same rms charge as the formula?
%
% ANSWER: see the printout. Every source matches its formula within a few %.
% The comparator noise only counts at the LAST node: early noisy decisions
% are repaired by redundancy (step 7e: noise needs no tolerance, it only
% has to stay small next to the tolerance).
%
% THE STORY
% Each source enters the conversion at a different place, so each has its
% own formula:
%  a) CDAC kT/C. Every step capacitor C_k is precharged to V_REF through a
%     switch; when the switch opens, kT/C noise is frozen on it: charge
%     sqrt(kB T C_k). Connected across the nodes it moves Q = Q+ - Q- by
%     twice that. The output adds the nominal weight, so this error stays:
%         q = sqrt(sum 4 kB T C_k) = sqrt(4 kB T C_DAC)   (Rabuske eq. 4.100, x2 for Q+ - Q-)
%  b) Comparator noise v_n. It disturbs the decision, not the charge. A wrong
%     early decision is repaired by the later steps, so only the last decision
%     counts, where the node is C_end:   q = v_n C_end
%  c) Clock jitter on the write. A time error sigma_t on a slope dV/dt is a
%     voltage error; on the memory capacitance it is a charge error. For a
%     full-scale sine at f_max (all channels with the same clock: worst case)
%         q = C_TH 2 pi f_max sigma_t (V_FS / 2) / sqrt(2)
% Switch noise during the conversion (charge sharing through the switch
% resistance) has no closed formula in Rabuske; it stays a placeholder until
% a Cadence transient-noise run of the CDAC with the comparator.
%
% HAND CHECK
% a) C_DAC = 2.24 pF: sqrt(4 x 1.38e-23 x 300 x 2.24e-12) = 0.192 fC = 0.044 LSB
% b) 45 uV x 8.96 pF = 0.40 fC = 0.092 LSB
% c) 4.48 pF x 2 pi x 13e6 x 1e-12 x 0.5 / sqrt(2) = 0.129 fC = 0.030 LSB
%
% WHAT THE CODE DOES
%   For each source alone: convert many random inputs with cs_sar.m (ideal
%   capacitors, read with the real weights), take the rms error, subtract the
%   rms error of the same conversion without the source, compare with the formula.

clear; close all; clc;
zaan_constants;
C_TH  = N_ch * C_M;
Q_LSB = C_TH * V_FS / 2^N_bits;
V_REF = alpha * V_FS / 2;
w = w_design;  n = numel(w);
Q   = w * Q_LSB;                                   % ideal step charges [C]
C_k = Q / (2 * V_REF);                             % step capacitors [F]
C_node = C_TH + [0, cumsum(2 * C_k)];              % node at every decision [F]
C_end  = C_node(end);
rng(3, 'twister');
N  = 2e5;
x  = (rand(1, N) - 0.5) * 1000 * Q_LSB;            % random inputs over the range [C]
z  = zeros(1, n+1);  zp = zeros(1, n);
base = cs_sar(x, Q, Q, C_node, z, z, 0, zp) - x;   % only the quantisation error
p0 = mean(base.^2);
noise = @(y) sqrt(max(mean((y - x).^2) - p0, 0)); % rms charge added by a source [C]

%% -----------------------------
% a) CDAC kT/C
% -----------------------------
q_pre = 2 * sqrt(kB * T * C_k);
q_a = noise(cs_sar(x, Q, Q, C_node, z, z, 0, q_pre));
f_a = sqrt(4 * kB * T * sum(C_k));

%% -----------------------------
% b) comparator noise, 45 uV rms (the step 4 allowance)
% -----------------------------
v_n = 45e-6;
q_b = noise(cs_sar(x, Q, Q, C_node, v_n * C_node, z, 0, zp));
f_b = v_n * C_end;

%% -----------------------------
% c) clock jitter on the write, sine at f_max
% -----------------------------
sig_t = 1e-12;                                     % rms jitter [s]                  A
tt = (0:N-1) / fs;
A  = C_TH * V_FS / 2 * 0.98;                       % full-scale sine amplitude [C]
xs = A * sin(2*pi*f_max*tt);
xj = A * sin(2*pi*f_max*(tt + sig_t*randn(1, N))); % sampled at the wrong moment
% The jitter error enters BEFORE the conversion, as a wrong input charge.
% Measured there: it is 0.001 LSB^2 next to 0.083 LSB^2 of quantisation, too
% small to pull out of the converted output with 2e5 samples (+-25 % scatter).
q_c = sqrt(mean((xj - xs).^2));
f_c = C_TH * 2*pi*f_max * sig_t * V_FS/2 / sqrt(2);

%% -----------------------------
% Results
% -----------------------------
name = {'a) CDAC kT/C', 'b) comparator 45 uV', 'c) jitter 1 ps, f_max'};
qs = [q_a q_b q_c];  fs_ = [f_a f_b f_c];
fprintf('source                  simulated [fC]  formula [fC]   [LSB]   [LSB^2]\n');
for i = 1:3
    fprintf('%-22s %10.3f %13.3f %9.3f %9.4f\n', name{i}, qs(i)*1e15, fs_(i)*1e15, qs(i)/Q_LSB, (qs(i)/Q_LSB)^2);
end
if all(abs(qs ./ fs_ - 1) < 0.1), disp('CHECK OK: every source follows its formula'), else, disp('CHECK FAILED'), end
