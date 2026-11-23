function [n_wait, room] = step_waits(w, v_os, d_margin, last_err, min_wait)
% STEP_WAITS  Shortest wait after every step, in time constants (step 7b2).
%   w         step weights [LSB]
%   v_os      comparator offset left after calibration [V]
%   d_margin  margin every decision with tolerance keeps free [LSB]
%   last_err  settling error allowed at the decisions without tolerance [LSB]
%   min_wait  shortest wait any step may have [tau] (switch drivers, logic)
% Returns n_wait(k): the wait after step k, and room(k): what decision k+1 has
% left for the unsettled part of step k. NaN when a decision has no room.
% The unsettled part of step k is eps w_k with eps = e^(-n), so it fits when
%     w_k e^(-n) <= room   ->   n = ln(w_k / room)
[t, mis, off] = fixed_errors(w, 0, v_os);        % settling 0: we want what is left for it
n = numel(w);
room = zeros(1, n);  n_wait = zeros(1, n);
for k = 1:n
    j = k + 1;                                   % the decision after step k
    if t(j) > 0, room(k) = t(j) - mis(j) - off(j) - d_margin;
    else,        room(k) = last_err;
    end
    if room(k) > 0, n_wait(k) = max(min_wait, log(w(k) / room(k)));
    else,           n_wait(k) = NaN;
    end
end
end
