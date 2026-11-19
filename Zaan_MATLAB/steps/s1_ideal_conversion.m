%% s1_ideal_conversion.m   STEP 1: one ideal conversion, in charge
% QUESTION: does a charge-sharing SAR, followed decision by decision, end within
% ½ LSB of the input?
% The reference case on purpose: ideal binary steps, no errors, no noise.
% The real CDAC (weights, unit capacitor) is designed later; this only checks the model.
%
% How one conversion works, in charge (Q = Q+ - Q-):
%   r = the charge still on the nodes, starts at the input charge
%   decision k: the comparator gives the sign of r (+1 or -1); only the sign matters
%   then step k is connected crossed or straight so that r moves towards zero:
%       r = r - s(k) * step(k)
%   after the last step the comparator decides once more, on what is left.
%   Result: the sum of the steps taken, plus half the last step for the last decision.

clear; clc;
here = fileparts(mfilename('fullpath')); if isempty(here), here = pwd; end
addpath(fullfile(fileparts(here), '1_settings'));
p = zaan_params();
d = zaan_derive(p);
fC = 1e15;

%% 1. Ideal binary steps in charge: 256, 128, ..., 1 LSB (9 steps, 10 decisions)
steps = 2.^(p.N_bits - 2 : -1 : 0) * d.Q_LSB;    % [C]
n = numel(steps);

%% 2. One sample, decision by decision
Q_in = 0.3137 * d.Q_FS;                            % some input charge [C]
r = Q_in;  Q_out = 0;
fprintf('input charge %.2f fC (%.2f LSB)\n\n', Q_in * fC, Q_in / d.Q_LSB);
fprintf('%9s %16s %6s %12s %16s\n', 'decision', 'left before [fC]', 'sign', 'step [fC]', 'left after [fC]');
for k = 1:n
    s = sign(r); if s == 0, s = 1; end
    r_new = r - s * steps(k);
    fprintf('%9d %16.2f %+6d %12.2f %16.2f\n', k, r * fC, s, steps(k) * fC, r_new * fC);
    Q_out = Q_out + s * steps(k);
    r = r_new;
end
s = sign(r); if s == 0, s = 1; end
Q_out = Q_out + s * steps(n) / 2;                  % last decision: half the last step
fprintf('%9d %16.2f %+6d %12s\n', n + 1, r * fC, s, '(no step)');
fprintf('\nresult %.2f fC, input %.2f fC, error %.3f LSB\n', Q_out * fC, Q_in * fC, (Q_out - Q_in) / d.Q_LSB);

%% 3. CHECK: many inputs over the whole range, every error within ½ LSB
Q_in = (rand(1, 10000) - 0.5) * d.Q_FS;
r = Q_in;  Q_out = zeros(size(Q_in));
for k = 1:n
    s = 2 * (r >= 0) - 1;
    r = r - s * steps(k);
    Q_out = Q_out + s * steps(k);
end
s = 2 * (r >= 0) - 1;
Q_out = Q_out + s * steps(n) / 2;
err = (Q_out - Q_in) / d.Q_LSB;
fprintf('10000 inputs: largest error %.3f LSB, rms error %.3f LSB (ideal 1/sqrt(12) = %.3f)\n', ...
        max(abs(err)), std(err), 1 / sqrt(12));
if max(abs(err)) <= 0.5 + 1e-12, disp('CHECK OK'), else, disp('CHECK FAILED'), end
