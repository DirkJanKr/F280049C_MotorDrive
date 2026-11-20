%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%   STEP 6: IS A WRONG DECISION REPAIRED EXACTLY WITHIN THE TOLERANCE?    %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% QUESTION
% The tolerance of decision k is
%     t_k = (sum of the later steps) + (last step) - w_k          (slide 22)
% It claims: an error at decision k up to t_k is repaired completely by the
% later steps. Is that true, and is it exactly the limit?
%
% ANSWER
% Yes. For every decision, the largest error that still gives the right
% result (within ½ LSB) is exactly t_k. Binary steps have t_k = 0 everywhere.
% Beyond it, the result is off by ½ + (error - t_k) LSB, until the error is
% larger than any charge that can be left at that decision (see the plot).
%
% A small converter on purpose, the one of slide 22: steps 9, 5, 3, 2, 1, 1 LSB
% (6 steps, 7 decisions), in charge (multiples of Q_LSB). The weights of Zaan
% come in step 7; this step only proves the rule they will be designed with.
%
% How an error is made: at decision k only, the comparator sees the charge
% left PLUS an error charge e. That is what an offset, noise or a step that
% has not settled yet does to that one decision.

clear; close all; clc;
zaan_constants;
Q_LSB = N_ch * C_M * V_FS / 2^N_bits;     % from step 0 [C]

%% -----------------------------
% 1) The steps and their tolerances
% -----------------------------
w = [9 5 3 2 1 1];                        % step weights [LSB]
n = numel(w);                             % 6 steps, 7 decisions
t = zeros(1, n+1);                        % tolerance per decision; the last one has 0
for k = 1:n
    t(k) = sum(w(k+1:end)) + w(end) - w(k);
end
fprintf('steps [LSB]:  %s\n', num2str(w));
fprintf('tolerance:    %s   (decisions 1 to %d)\n\n', num2str(t), n+1);
% num2str turns a list of numbers into text, for printing

%% -----------------------------
% 2) For every decision and every error size: the worst result over all inputs
% -----------------------------
x     = -18 : 0.01 : 18;                  % input charge [LSB], inside the range
e_list = 0 : 0.05 : 6;                    % error sizes to try [LSB]
worst = zeros(n+1, numel(e_list));        % largest |output - input| [LSB]

for k = 1:n+1                             % decision that gets the error
    for i = 1:numel(e_list)
        for sgn = [-1 1]                  % the error can push either way
            r = x * Q_LSB;  Q_out = zeros(size(x));
            for j = 1:n+1
                seen = r;                                 % what the comparator sees
                if j == k, seen = r + sgn*e_list(i)*Q_LSB; end
                s = 2*(seen >= 0) - 1;
                if j <= n
                    r = r - s * w(j)*Q_LSB;               % connect step j
                    Q_out = Q_out + s * w(j)*Q_LSB;
                else
                    Q_out = Q_out + s * w(n)*Q_LSB/2;     % last decision
                end
            end
            err = max(abs(Q_out/Q_LSB - x));
            worst(k, i) = max(worst(k, i), err);
        end
    end
end

%% -----------------------------
% 3) The largest error that is still fully repaired, per decision
% -----------------------------
fprintf(' decision   tolerance t_k   largest error repaired\n');
e_max = zeros(1, n+1);
for k = 1:n+1
    ok = find(worst(k, :) <= 0.5 + 1e-9);    % error sizes that keep the result within ½ LSB
    e_max(k) = e_list(ok(end));
    fprintf('%9d %13.2f %20.2f\n', k, t(k), e_max(k));
end
if all(abs(e_max - t) < 0.05 + 1e-9), disp('CHECK OK: repaired exactly up to the tolerance'), else, disp('CHECK FAILED'), end

figure; hold on; grid on;
for k = 1:n+1
    plot(e_list, worst(k, :), 'LineWidth', 1.5);
end
plot([0 6], [0.5 0.5], 'k--');
xlabel('error at the decision [LSB]'); ylabel('worst result error [LSB]');
legend('d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'quantisation, ½ LSB');
title('An error is repaired until it exceeds the tolerance of its decision');

%% -----------------------------
% 4) Contrast: binary steps 8, 4, 2, 1 have no tolerance
% -----------------------------
wb = [8 4 2 1];
tb = zeros(1, numel(wb));
for k = 1:numel(wb), tb(k) = sum(wb(k+1:end)) + wb(end) - wb(k); end
fprintf('\nbinary 8 4 2 1: tolerance %s: any error at those decisions is not repaired\n', num2str(tb));
