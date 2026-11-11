% zaan_matching.m
% Matching of a binary CDAC and the 3 sigma rule, for four ways to build the same 10 bits.
%   polarity: every capacitor is connected parallel or antiparallel (charge sharing),
%             so one capacitor covers twice the codes of one that is switched on or off.
%   halving:  the last 3 bits come from charge halving (Malki 2014), not from capacitors.
% Formula (derived):
%   codes per unit        k     = 2^B / M              M = number of unit capacitors
%   mid-scale code step   sigma = k * sigma_u * sqrt(M - 1)   [LSB]
%   one capacitor         sigma_u = A_C / sqrt(C_u)
%   so                    sigma ~ 2^B * A_C / sqrt(M * C_u) = 2^B * A_C / sqrt(C_DAC)
% The Monte Carlo draws every bit weight at random and checks all code steps.
% Same model as src/zaan/model/matching.js of the workbench.

clear; rng(1);

B      = 10;          % bits
A_C    = 0.0499;      % matching of ONE capacitor, fraction * sqrt(fF). PDK pair slope / sqrt(2), at 2 fF/um^2
C_u    = 35;          % unit capacitor [fF] used for the Monte Carlo
chips  = 2000;        % Monte Carlo runs
limit  = 0.5;         % allowed 3 sigma error of the code step [LSB]
hBits  = 3;           % bits made by charge halving, when halving is on

names  = {'charge sharing, halving', 'charge sharing, no halving', ...
          'charge redistribution, 3 LSBs elsewhere', 'charge redistribution, all capacitors'};
polar  = [1 1 0 0];
halve  = [1 0 1 0];

fprintf('%-42s %6s %6s %10s %10s %12s %12s\n', 'array', 'M', 'k', 'formula', 'simulated', 'C_u needed', 'total');
figure;
for c = 1:4
    capBits = B - halve(c) * hBits - polar(c);   % bits made of unit capacitors
    M = 2^capBits;                               % unit capacitors
    k = 2^B / M;                                 % codes per unit
    W = 2.^(B - (1:B));                          % code weight of every bit: 512 ... 1

    % relative 1 sigma error of every bit weight
    sigma_u = A_C / sqrt(C_u);
    rel = zeros(1, B);
    for i = 1:B
        if i <= capBits
            rel(i) = sigma_u / sqrt(W(i) / k);   % a bit of u units: sigma_u / sqrt(u)
        elseif halve(c) && i <= capBits + hBits
            rel(i) = sigma_u / sqrt(2);          % halving bit (assumption)
        else
            rel(i) = 0;                          % last comparison of the polarity scheme: no capacitor
        end
    end

    % formula for the mid-scale code step
    sigma_mid = sqrt(sum((W .* rel).^2));

    % unit capacitor for 3 sigma < limit (sigma scales with 1 / sqrt(C_u))
    C_need = C_u * (3 * sigma_mid / limit)^2;    % [fF]

    % Monte Carlo
    codes = (0:2^B - 1)';
    bitsOn = zeros(2^B, B);
    for i = 1:B
        bitsOn(:, i) = bitand(bitshift(codes, -(B - i)), 1);
    end
    mid = zeros(chips, 1); worst = zeros(chips, 1);
    for n = 1:chips
        Wr = W .* (1 + rel .* randn(1, B));      % this chip's bit weights
        level = bitsOn * Wr';                    % analog level of every code
        dnl = diff(level) - 1;                   % error of every code step [LSB]
        mid(n) = dnl(2^(B - 1));                 % the step from 0111.. to 1000..
        worst(n) = max(abs(dnl));
    end

    fprintf('%-42s %6d %6d %10.3f %10.3f %9.0f fF %9.1f pF\n', names{c}, M, k, sigma_mid, std(mid), C_need, M * C_need / 1000);

    subplot(2, 2, c);
    histogram(mid, 40); hold on;
    xline(-limit, 'r--'); xline(limit, 'r--');
    xline(3 * sigma_mid, 'k'); xline(-3 * sigma_mid, 'k');
    title(sprintf('%s: M = %d', names{c}, M));
    xlabel('error of the mid-scale code step [LSB]'); ylabel('chips');
    legend(sprintf('%d chips at C_u = %d fF', chips, C_u), '\pm 0.5 LSB', '', '3 \sigma, formula', 'Location', 'best');
    fprintf('    chips with every code step within +-%.1f LSB: %.0f %%\n', limit, 100 * mean(worst < limit));
end

% What to see:
%  - "total" is the same in all four rows (about 94 pF): matching needs a total capacitance,
%    however it is divided.
%  - M differs: 64, 512, 128, 1024. With the unit at the PDK minimum of 35 fF the CDAC is
%    M * 35 fF = 2.2, 17.9, 4.5 and 35.8 pF. That is what halving and the two polarities buy,
%    once redundancy and calibration have removed the matching limit.
