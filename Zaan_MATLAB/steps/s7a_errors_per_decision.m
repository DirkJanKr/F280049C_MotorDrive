%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%        STEP 7a: WHICH ERRORS DOES EVERY DECISION HAVE TO ABSORB?        %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% THE STORY
% Step 6 showed that a decision may be wrong by up to its tolerance. So the
% next question is: by how much CAN each decision be wrong? Three errors move
% what the comparator sees by a fixed amount; they must fit in the tolerance.
%   Mismatch: the steps are not exactly their design value (step 5). With
%     calibration the output reads the real weights, but the input must still be
%     reachable with the real steps. At decision k the step itself and all later
%     steps can be off, so their errors (3 sigma, added in power) must fit.
%   Offset: the comparator has an offset voltage v_os. In charge it is
%     v_os * C_node, and the node grows at every decision, so the offset charge
%     differs per decision. The part every decision shares is one plain shift of
%     the result; only the difference with the last decision uses tolerance.
%   Settling: the step before has not fully arrived when the comparator looks;
%     the missing part eps * w(k-1) is an error at decision k.
% These are FIXED for a given chip and input, and can push the same way, so
% they are ADDED: need_k = mismatch + offset + settling (proven in step 7e).
% Noise is different: it only flips a decision when the charge left is within
% the noise, so it leaves an error of about its own size, repaired or not. It
% needs no tolerance; the graph shows it for comparison.
% CLAIM: if need_k <= t_k at every decision that has tolerance, no code is lost.
% (Proven by simulation in steps 7c to 7e.)
%
% WHAT THE CODE DOES
%   1) values: the weight list, offset, settling, comparator noise
%   2) every decision's tolerance and errors (function fixed_errors.m)
%   3) the table, and a graph like the workbench

clear; close all; clc;
zaan_constants;

%% -----------------------------
% 1) Values
% -----------------------------
w          = w_design;   % weight list from zaan_constants [LSB]
n_tau      = 4.6;        % time constants waited after every step              A
eps_settle = exp(-n_tau);% part of a step not yet settled: 1 %
v_os       = 0.15e-3;    % comparator offset left after calibration [V]         S (Malki 2014, p. 1174)
v_n        = 50e-6;      % comparator noise [V rms], only for the graph         A

%% -----------------------------
% 2) Tolerance and errors per decision
% -----------------------------
[t, mis, off, setl, need, C_node] = fixed_errors(w, eps_settle, v_os);
Q_LSB = N_ch * C_M * V_FS / 2^N_bits;
noise3 = 3 * v_n * C_node / Q_LSB;                 % comparator noise, 3 sigma [LSB]
d = 1:numel(t);

%% -----------------------------
% 3) Table and graph
% -----------------------------
fprintf('weights: %s;  settling %.1f tau = %.1f %% left\n\n', num2str(w), n_tau, eps_settle*100);
fprintf(' dec  tolerance  mismatch  offset  settling   needs   margin   noise 3s\n');
for k = d
    flag = '';  if t(k) > 0 && need(k) > t(k), flag = '  <- NOT COVERED'; end
    fprintf('%4d %10.2f %9.2f %7.2f %9.2f %7.2f %8.2f %9.2f%s\n', k, t(k), mis(k), off(k), setl(k), need(k), t(k)-need(k), noise3(k), flag);
end

xmax = 3;
figure; hold on; grid on;
barh(d, [mis; off; setl]', 0.6, 'stacked');                   % the fixed errors, stacked
barh(d + 0.38, noise3, 0.15, 'FaceColor', [0.7 0.7 0.7]);    % noise, thin, apart
for k = d
    if t(k) <= xmax, plot([t(k) t(k)], [k-0.4 k+0.4], 'g-', 'LineWidth', 3);
    else, text(xmax*0.98, k, sprintf('%.0f ->', t(k)), 'HorizontalAlignment', 'right'); end
end
set(gca, 'YDir', 'reverse');  xlim([0 xmax]);
xlabel('LSB'); ylabel('decision');
legend('mismatch', 'offset', 'settling', 'noise (needs no tolerance)', 'Location', 'southeast');
title('Fixed errors per decision against the tolerance (green)');
