function [y, S] = cs_sar(x, Q_real, Q_read, C_node, q_dec, q_off, eps_settle, q_pre)
% CS_SAR  One charge-sharing SAR conversion for many samples at once, in charge.
% A function file (not a script) because step 7 runs the same conversion many
% times, each with other errors switched on.
%
%   x          input charge of every sample [C] (row)
%   Q_real     the charge each step really moves [C] (from the real capacitors)
%   Q_read     the weights the output is added up with [C] (calibrated = Q_real)
%   C_node     node capacitance at every decision [F] (not used for the sign,
%              kept so the errors below can be given as charges per decision)
%   q_dec      rms noise charge at every decision [C] (comparator, switches)
%   q_off      fixed error charge at every decision [C] (offset: v_os * C_node)
%   eps_settle part of the previous step's charge not yet on the node when the
%              next decision is made (0 = fully settled)
%   q_pre      rms precharge (kT/C) noise of every step [C]
%   y          output charge [C]: the steps taken plus half the last step
%   S          (optional) every decision, +1 or -1, one row per decision (step 8)

n = numel(Q_real);
r = x;                                      % charge left on the nodes
y = zeros(size(x));
s_prev = zeros(size(x));
S = zeros(n+1, numel(x));
for k = 1:n+1
    seen = r + q_off(k) + q_dec(k) * randn(size(x));     % what the comparator sees
    if k > 1, seen = seen + eps_settle * s_prev * Q_real(k-1); end   % not yet arrived
    s = 2*(seen >= 0) - 1;                               % decision
    S(k, :) = s;
    if k <= n
        q_k = Q_real(k) + q_pre(k) * randn(size(x));      % this conversion's step charge
        r = r - s .* q_k;                                % connect step k
        y = y + s * Q_read(k);                           % add its weight
        s_prev = s;
    else
        y = y + s * Q_read(n) / 2;                       % last decision
    end
end
end
