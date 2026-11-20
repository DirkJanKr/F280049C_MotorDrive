%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%            STEP 6: HOW LARGE A MISTAKE CAN REDUNDANCY REPAIR?           %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% THE STORY
% A SAR finds the input by steps: at every decision it adds or subtracts the
% next step, moving the charge on the nodes towards zero. If one decision goes
% the wrong way, the converter is now on the wrong side of the input. In a
% binary converter the steps that are left add up to exactly the gap that is
% still to be closed, so after a wrong turn they can never get back: the code
% is wrong. With redundancy the later steps add up to MORE than needed. That
% spare reach lets them walk back over a wrong turn. The spare reach of
% decision k is its tolerance:
%       t_k = (sum of the later steps) + (last step) - w_k
% The last step counts twice: once as a step, once because the last comparison
% still sorts the input into one of two intervals, each one last step wide.
% CLAIM: a mistake at decision k is repaired completely if it is at most t_k.
%
% HAND CHECK (do it on paper), steps 9 5 3 2 1 1, input 4 LSB:
%   decision 1 should say "up" (4 > 0) but says "down": level 0 - 9 = -9.
%   The later steps can climb at most 5+3+2+1+1 = 12: level -9 + 12 = 3.
%   The last comparison adds one interval of 1 above that: inputs up to 4 are
%   still coded right. t_1 = 12 + 1 - 9 = 4. An input of 4.5 is out of reach.
%
% WHAT THE CODE DOES
%   1) the steps and their tolerance from the formula
%   2) the hand check: one conversion with a forced wrong first decision
%   3) for every decision: give it an error of growing size and find the
%      largest one that still gives every input the right result
%   4) compare with the formula

clear; close all; clc;

%% -----------------------------
% 1) The steps and their tolerance (all in LSB)
% -----------------------------
w = [9 5 3 2 1 1];                          % step weights
n = numel(w);                               % 6 steps, so 7 decisions
t = zeros(1, n+1);                          % the last decision has no later steps: t = 0
for k = 1:n
    t(k) = sum(w(k+1:end)) + w(end) - w(k);
end
fprintf('steps:     %s\ntolerance: %s\n\n', num2str(w), num2str(t));

%% -----------------------------
% 2) The hand check: input 4 LSB, decision 1 forced the wrong way
% -----------------------------
x = 4;  level = 0;  out = 0;
fprintf('decision  sees    says   step   level after\n');
for k = 1:n+1
    s = sign(x - level);  if s == 0, s = 1; end     % the right answer
    if k == 1, s = -s; end                          % decision 1 goes the wrong way
    if k <= n
        level = level + s*w(k);  out = out + s*w(k);
        fprintf('%8d %6.1f %+6d %6.1f %10.1f\n', k, x - level + s*w(k), s, w(k), level);
    else
        out = out + s*w(n)/2;                       % last comparison: middle of the last interval
        fprintf('%8d %6.1f %+6d   (no step)\n', k, x - level, s);
    end
end
fprintf('result %.1f for input %.1f: error %.1f LSB (½ LSB or less is right)\n\n', out, x, out - x);

%% -----------------------------
% 3) Every decision, errors of growing size, all inputs
% -----------------------------
% The error is added to what the comparator sees at that one decision. That is
% what an offset, noise or an unsettled step does to it.
xs     = -20 : 0.01 : 20;                   % many inputs
e_list = 0 : 0.05 : 6;                      % error sizes
e_max  = zeros(1, n+1);                     % largest error still repaired, per decision
for k = 1:n+1
    for e = e_list
        worst = 0;
        for sgn = [-1 1]                    % the error can push either way
            level = zeros(size(xs));  out = zeros(size(xs));
            for j = 1:n+1
                seen = xs - level;  if j == k, seen = seen + sgn*e; end
                s = 2*(seen >= 0) - 1;
                if j <= n, level = level + s*w(j); out = out + s*w(j);
                else, out = out + s*w(n)/2; end
            end
            worst = max(worst, max(abs(out - xs)));
        end
        if worst <= 0.5 + 1e-9, e_max(k) = e; end   % still right everywhere
    end
end

%% -----------------------------
% 4) Compare with the formula
% -----------------------------
fprintf('decision   tolerance (formula)   largest error repaired (simulated)\n');
for k = 1:n+1
    fprintf('%8d %15.2f %25.2f\n', k, t(k), e_max(k));
end
if all(abs(e_max - t) < 0.05 + 1e-9), disp('CHECK OK: repaired exactly up to the tolerance'), else, disp('CHECK FAILED'), end
