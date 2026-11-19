%% study_A_noise.m
% QUESTION: does the simulated converter noise match the hand calculation,
% source by source, for alpha = 0.4 and alpha = 1?
%
% Hand calculation, in LSB rms (charge counted as Q+ - Q-):
%   quantisation  w_last / sqrt(12)                 last step w_last
%   memory cells  sqrt(2 k T N C_M) / Q_LSB         Rabuske eq. 4.99, times 2
%   CDAC          sqrt(4 k T C_DAC) / Q_LSB         Rabuske eq. 4.100, times 2
%   comparator    v_n C_node,last / Q_LSB           noise at the last decision
% Simulation: many random inputs, each source alone and all together.
% Expected: within a few percent, except the comparator (see the note at the end).

clear; clc;
here = fileparts(mfilename('fullpath')); if isempty(here), here = pwd; end
root = fileparts(here);
addpath(fullfile(root, '1_settings'), fullfile(root, '2_circuit'));
randn('seed', 1); rand('seed', 1);              % same numbers every run

n_samp = 40000;
names  = {'quantisation', 'memory cells', 'CDAC precharge', 'comparator', 'all together', '+ round to 10 bit'};
cases  = {struct('samp', 0, 'pre', 0, 'comp', 0), struct('samp', 1, 'pre', 0, 'comp', 0), ...
          struct('samp', 0, 'pre', 1, 'comp', 0), struct('samp', 0, 'pre', 0, 'comp', 1), ...
          struct('samp', 1, 'pre', 1, 'comp', 1)};

for alpha = [0.4 1]
    p = zaan_params();  p.alpha = alpha;
    d = zaan_derive(p);
    kT = p.k * p.T;

    % hand calculation [LSB rms]
    q    = p.w(end) / sqrt(12);
    samp = sqrt(2 * kT * d.C_TH) / d.Q_LSB;
    pre  = sqrt(4 * kT * d.C_DAC) / d.Q_LSB;
    comp = p.v_n * d.C_node(end) / d.Q_LSB;
    noise_only = [0, samp, pre, comp];                       % the source without quantisation
    hand = [q, sqrt(q^2 + noise_only(2:4).^2), sqrt(q^2 + samp^2 + pre^2 + comp^2)];
    % rounding to the 10 bit output: with EXACT weights the ½ LSB grid lines up with the
    % whole-LSB grid, so both quantisations together are just ideal 10 bit: 1/sqrt(12)
    hand(end + 1) = sqrt(1/12 + samp^2 + pre^2 + comp^2);

    % simulation: inputs spread over 95 % of the range [LSB -> C]
    x    = (rand(n_samp, 1) - 0.5) * 0.95 * 2^p.N_bits;
    Q_in = x * d.Q_LSB;
    sim  = zeros(1, numel(cases) + 1);
    for c = 1:numel(cases)
        Q_out  = cs_sar_convert(Q_in, p, d, cases{c});
        sim(c) = std((Q_out - Q_in) / d.Q_LSB);
    end
    % the 10 bit output: round the reported value to whole LSB (middle of each code)
    y = floor(Q_out / d.Q_LSB) + 0.5;
    sim(end) = std(y - Q_in / d.Q_LSB);

    fprintf('\nalpha = %.1f:  V_REF = %.0f mV,  C_M = %.0f fF,  C_DAC = %.2f pF,  Q_LSB = %.2f fC\n', ...
            alpha, d.V_REF * 1e3, d.C_M * 1e15, d.C_DAC * 1e12, d.Q_LSB * 1e15);
    fprintf('%-16s %12s %12s %8s\n', 'error source', 'hand [LSB]', 'sim [LSB]', 'sim/hand');
    for c = 1:numel(names)
        fprintf('%-16s %12.4f %12.4f %8.3f\n', names{c}, hand(c), sim(c), sim(c) / hand(c));
    end
    % ENOB for a full-scale sine: signal power (2^B / 2)^2 / 2, in LSB^2
    enob = @(s) (10 * log10((2^p.N_bits / 2)^2 / 2 / s^2) - 1.76) / 6.02;
    fprintf('ENOB with the 10 bit output: hand %.2f, simulation %.2f\n', enob(hand(end)), enob(sim(end)));
end
% NOTES
% 1. Before rounding the error is below 1/sqrt(12) LSB, because the last step is ½ LSB.
%    The ENOB only means something with the rounding to the 10 bit output included.
%    Here the weights are exact, so the ½ LSB grid and the 10 bit grid line up and the two
%    quantisations together are exactly ideal 10 bit. With calibrated, non-integer weights
%    they do not line up, and the rounding adds its own 1/sqrt(12) (backup slide 54).
%    That case belongs to study D (mismatch and calibration).
% 2. Comparator: the noise acts at every decision, but a flip is only possible when the
%    residue is within the noise, so it leaves an error of about that size and the later
%    steps repair most of it. Only the last decision counts fully, and even there the
%    output can only move by the last step, so sim/hand may be a little below 1.
% 3. This is noise only, with exact weights. The workbench (9.5 at alpha 0.4, 9.7 at alpha 1)
%    also counts mismatch after calibration and jitter, so it is lower.
