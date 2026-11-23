function [t, mis, off, setl, need, C_node] = fixed_errors(w, eps_settle, v_os)
% FIXED_ERRORS  Tolerance and fixed errors of every decision, in LSB (step 7a).
%   w           step weights [LSB]
%   eps_settle  part of a step not yet settled at the next decision
%   v_os        comparator offset left after calibration [V]
% Returns, for decisions 1 .. numel(w)+1:
%   t     tolerance (step 6)
%   mis   mismatch: 3 sigma of the errors of this step and all later steps
%   off   offset: the part of v_os * C_node that differs from the last decision
%   setl  settling: the unsettled part of the step before
%   need  mis + off + setl, the tolerance this decision needs
%   C_node the node capacitance at every decision [F]
alpha = [];      % MATLAB has a built-in function alpha(); naming it here first tells MATLAB
                 % it is a variable in this function, so the script below can fill it
zaan_constants;
n     = numel(w);
Q_LSB = N_ch * C_M * V_FS / 2^N_bits;
V_REF = alpha * V_FS / 2;
lsb_u = 2 * C_u * V_REF / Q_LSB;                    % one unit capacitor = 8 LSB
sig_u = A_C / sqrt(C_u * 1e15);                     % spread of one unit (PDK)
units = w / lsb_u;
sig_w = sig_u ./ sqrt(max(units, 1)) .* w;          % whole units: errors add in power
sig_w(units < 1) = sig_u * w(units < 1);            % halved steps: one unit's spread (A)
C_node = N_ch*C_M + [0, cumsum(2 * max(units, 1) * C_u)];

t = zeros(1, n+1);  mis = zeros(1, n+1);
for k = 1:n
    t(k)   = sum(w(k+1:end)) + w(end) - w(k);
    mis(k) = 3 * sqrt(sum(sig_w(k:end).^2));
end
off  = v_os * (C_node(end) - C_node) / Q_LSB;
setl = [0, eps_settle * w];  setl = setl(1:n+1);
need = mis + off + setl;
end
