%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%                STEP 1: ONE IDEAL CONVERSION, IN CHARGE                  %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% QUESTION
% Does a charge-sharing SAR, followed decision by decision, end within ½ LSB
% of the input?
%
% ANSWER
% Yes: over 10000 inputs the largest error is 0.500 LSB, rms about 0.29 LSB.
%
% Ideal binary steps on purpose: this checks the model, it does not choose
% the CDAC (that is step 5 onwards). No errors, no noise.
%
% How one conversion works, in charge:
%   r = the charge still on the nodes; it starts at the input charge
%   decision k: the comparator gives the sign of r (+1 or -1)
%   step k is connected straight or crossed, so r moves towards zero:
%       r = r - s * step(k)
%   after the last step the comparator decides once more.
%   Result: the sum of the steps taken, plus half the last step.

clear; close all; clc;
zaan_constants;
rng(1, 'twister');         % fixed random numbers: the same inputs every run
% 'twister' names the generator, so this also works after an old rand('seed') call

% from step 0
C_TH  = N_ch * C_M;
Q_FS  = C_TH * V_FS;
Q_LSB = Q_FS / 2^N_bits;

%% -----------------------------
% 1) Ideal binary steps: 256, 128, ..., 1 LSB (9 steps, 10 decisions)
% -----------------------------
steps = 2.^(N_bits-2 : -1 : 0) * Q_LSB;   % step charges [C]
% a:-1:b counts down from a to b; 2.^x raises 2 to every element of x
n = numel(steps);                         % numel = number of elements

%% -----------------------------
% 2) One sample, decision by decision
% -----------------------------
Q_in  = 0.3137 * Q_FS;     % some input charge [C]
r     = Q_in;              % charge left on the nodes
Q_out = 0;                 % what the converter reports
r_hist = zeros(1, n+1);    % keep r before every decision, for the plot

fprintf('input charge %.2f fC (%.2f LSB)\n\n', Q_in*1e15, Q_in/Q_LSB);
fprintf(' decision   left before [fC]   sign   step [fC]   left after [fC]\n');
for k = 1:n
    r_hist(k) = r;
    s = 2*(r >= 0) - 1;            % comparator: +1 if r >= 0, else -1
    r_new = r - s*steps(k);        % connect step k so r moves towards zero
    fprintf('%9d %18.2f %+6d %11.2f %17.2f\n', k, r*1e15, s, steps(k)*1e15, r_new*1e15);
    Q_out = Q_out + s*steps(k);    % add the step we took
    r = r_new;
end
r_hist(n+1) = r;
s = 2*(r >= 0) - 1;                % last decision, no step after it
Q_out = Q_out + s*steps(n)/2;      % lands in the middle of the last interval
fprintf('%9d %18.2f %+6d %11s\n', n+1, r*1e15, s, '(no step)');
fprintf('\nresult %.2f fC, input %.2f fC, error %.3f LSB\n', Q_out*1e15, Q_in*1e15, (Q_out - Q_in)/Q_LSB);

figure; hold on; grid on;
stairs(1:n+1, r_hist/Q_LSB, 'LineWidth', 1.5);
plot([1 n+1], [0 0], 'k--');
xlabel('decision'); ylabel('charge left on the nodes [LSB]');
title('One conversion: the charge left moves towards zero');

%% -----------------------------
% 3) Check: many inputs over the whole range
% -----------------------------
Q_in  = (rand(1, 10000) - 0.5) * Q_FS;     % rand = uniform between 0 and 1
r     = Q_in;
Q_out = zeros(size(Q_in));                 % zeros(size(x)) = zeros shaped like x
for k = 1:n
    s = 2*(r >= 0) - 1;                    % works on all 10000 inputs at once
    r = r - s*steps(k);
    Q_out = Q_out + s*steps(k);
end
s = 2*(r >= 0) - 1;
Q_out = Q_out + s*steps(n)/2;
err = (Q_out - Q_in) / Q_LSB;
fprintf('10000 inputs: largest error %.3f LSB, rms %.3f LSB (ideal 1/sqrt(12) = %.3f)\n', ...
        max(abs(err)), std(err), 1/sqrt(12));
if max(abs(err)) <= 0.5 + 1e-12, disp('CHECK OK'), else, disp('CHECK FAILED'), end
