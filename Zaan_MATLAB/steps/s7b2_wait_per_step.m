%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%       STEP 7b2: A WAIT PER STEP INSTEAD OF ONE WAIT FOR ALL STEPS       %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% QUESTION
% Step 7b gave every step the same wait, n_tau time constants. The SAR is
% self-timed, so every decision can have its own delay. How short can each
% wait be, how much time does that save, and do the chips still convert right?
%
% ANSWER (w_design, v_os 0.15 mV, margin 0.2 LSB, last decisions 0.1 LSB, at
% least 1 tau per step; D from this script): settling drops from 40.7 tau
% (3.7 tau for all) to 26.4 tau; T / tau at r = 5 from 100.7 to 86.4. 200 chips:
% none beyond the allowed error. With a wait per step, 12 and 13 decisions are
% about equally fast; other weights gain little.
%
% THE STORY
% 1. Same tau is not the same wait. Every step is built from identical unit
%    cells (a capacitor with its own switch), so every step has the same
%    time constant tau = R C. That stays. How LONG we wait after each step is
%    a separate choice: a self-timed SAR can give every decision its own delay.
% 2. What a step needs. After step k the part eps w_k has not arrived yet
%    (eps = e^(-n), n the wait in tau). The next decision sees it as an error.
%    It is fine as long as it fits in the room that decision has left:
%        room = t - mismatch - offset - margin           (step 7a)
%        w_k e^(-n) <= room   ->   n = ln(w_k / room)
% 3. Why the waits differ. The big early steps are followed by decisions with
%    a large tolerance (lots of room): they may go after 1 to 3 tau. The binary
%    bottom (16 8 4 2 1) has almost no room: there a 16 LSB step needs 3.7 tau.
%    With one wait for all, every step had to wait as long as the worst one.
% 4. The last two decisions have no tolerance: their settling error goes
%    straight to the output. We allow it last_err (0.1 LSB, A).
% 5. A real circuit always needs some time per step (switch drivers, logic),
%    so no wait is shorter than min_wait (1 tau, A). Without that floor a free
%    search finds odd zig-zag lists that never wait; they exploit the model.
%
% HAND CHECK (do this on paper)
% Step 5 of w_design is 16 LSB; the decision after it (decision 6) has
% t = (8+4+2+1+1) + 1 - 16 = 1 LSB, mismatch 0.37, offset 0.02, margin 0.2:
%     room = 1 - 0.37 - 0.02 - 0.2 = 0.41 LSB
%     n    = ln(16 / 0.41) = ln(39) = 3.7 tau
% Step 1 is 200 LSB; decision 2 has t = (80+40+16+16+8+4+2+1+1) + 1 - 160 = 9 LSB,
% mismatch 1.30, offset 0.1, margin 0.2:   room = 7.4 LSB,  n = ln(200 / 7.4) = 3.3 tau.
% Step 4 is 40 LSB with 16 LSB of room: ln(40 / 16) = 0.9, so the floor of 1 tau applies.
%
% WHAT THE CODE DOES
%   1) values   2) the wait after every step of w_design (step_waits.m)
%   3) the same for other lists, and the conversion time T / tau
%   4) 200 chips with these waits: does every chip convert right? (as step 7c)

clear; close all; clc;
zaan_constants;

%% -----------------------------
% 1) Values
% -----------------------------
w        = w_design;
v_os     = 0.15e-3;     % comparator offset left after calibration [V]          S (Malki 2014)
d_margin = 0.2;         % margin every decision with tolerance keeps [LSB]     A (step 7b)
last_err = 0.1;         % settling error allowed at the last decisions [LSB]   A
min_wait = 1;           % shortest wait of any step [tau]                      A
n_same   = 3.7;         % the one wait of step 7b [tau]                        U
r_list   = [2 5 10];    % comparator + logic delay / tau                       A

%% -----------------------------
% 2) The wait after every step of w_design
% -----------------------------
[n_wait, room] = step_waits(w, v_os, d_margin, last_err, min_wait);
fprintf('step [LSB]   room of the next decision [LSB]   wait [tau]\n');
for k = 1:numel(w)
    fprintf('%8g   %16.2f   %22.2f\n', w(k), room(k), n_wait(k));
end
fprintf('settling in total: %.1f tau with a wait per step, %.1f tau with %.1f tau for all\n\n', ...
        sum(n_wait), numel(w)*n_same, n_same);

%% -----------------------------
% 3) Other lists, and the conversion time T / tau = N_dec r + sum of waits
% -----------------------------
lists = {w_design, build_weights(3.0, v_os, [4 2 1 1], false, 0.02, 0.2), ...
         build_weights(2.8, v_os, [4 2 1 1], false, 0.02, 0.2), build_weights(4.6, v_os, [4 2 1 1])};
fprintf('decisions  settling per step   same wait   T/tau at r = %s   list\n', num2str(r_list));
for i = 1:numel(lists)
    v = lists{i};  if isempty(v), continue, end
    nw = step_waits(v, v_os, d_margin, last_err, min_wait);
    if any(isnan(nw)), fprintf('%9d   no room at a decision                      %s\n', numel(v)+1, num2str(v)); continue, end
    fprintf('%9d   %10.1f tau   %8.1f tau   %s   %s\n', numel(v)+1, sum(nw), numel(v)*max(nw), ...
            num2str((numel(v)+1)*r_list + sum(nw), '%7.1f'), num2str(v));
end

%% -----------------------------
% 4) 200 chips with these waits (the proof of step 7c, now with one eps per step)
% -----------------------------
eps_k = exp(-n_wait);                                % unsettled part of every step
[t, ~, ~, ~, need] = fixed_errors(w, eps_k, v_os);
allow = w(end)/2 + max(need(t == 0)) + 0.03;         % last interval + errors without tolerance + ramp step
err = chip_errors(w, eps_k, v_os, 200, 1);
fprintf('\nevery decision keeps its margin: %d (smallest margin %.2f LSB)\n', ...
        all(t(t > 0) - need(t > 0) >= d_margin - 1e-9), min(t(t > 0) - need(t > 0)));
fprintf('200 chips: largest error %.3f LSB, allowed %.3f LSB, chips beyond: %d\n', max(err), allow, sum(err > allow));
if sum(err > allow) <= 1, disp('CHECK OK: a wait per step converts right'), else, disp('CHECK FAILED'), end
