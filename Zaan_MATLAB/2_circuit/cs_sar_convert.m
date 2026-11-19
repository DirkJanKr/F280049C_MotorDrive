function Q_out = cs_sar_convert(Q_in, p, d, on)
% CS_SAR_CONVERT  Charge-sharing SAR conversion of many samples at once.
%   Q_in : input charges Q+ - Q- [C], one per sample (noise free)
%   on   : which noise is switched on, fields samp, pre, comp (true / false)
%   Q_out: the charge the converter reports [C], weights known exactly
%
%   Noise sources (Rabuske 2017, eq. 4.99 and 4.100; charge counted as Q+ - Q-):
%     samp : kT/C of the memory cells, variance 2 kT N C_M
%     pre  : each step capacitor keeps a plate charge error with variance kT C;
%            it enters node + and node - with opposite sign, so 2x in Q
%     comp : comparator noise v_n at every decision, on the voltage Q / C_node

Q = Q_in(:);
if on.samp
    Q = Q + sqrt(2 * p.k * p.T * d.C_TH) * randn(size(Q));
end
n = numel(p.w);
Q_out = zeros(size(Q));
for k = 1:n
    v = Q / d.C_node(k);                              % differential voltage [V]
    if on.comp, v = v + p.v_n * randn(size(Q)); end
    s = 2 * (v >= 0) - 1;                             % decision: +1 or -1
    dQ = d.dQ(k) * ones(size(Q));
    if on.pre
        dQ = dQ + 2 * sqrt(p.k * p.T * d.C_step(k)) * randn(size(Q));
    end
    Q = Q - s .* dQ;                                  % connect the step, straight or crossed
    Q_out = Q_out + s * d.dQ(k);                      % add the nominal weight
end
v = Q / d.C_node(n + 1);                              % last decision, no step after it
if on.comp, v = v + p.v_n * randn(size(Q)); end
s = 2 * (v >= 0) - 1;
Q_out = Q_out + s * d.dQ(n) / 2;                      % lands in the middle of the last interval
end
