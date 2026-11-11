% Zaan charge-sharing SAR ADC: small reference model.
% Purpose: check the rounding question (Item 5) independently of the workbench.
% One file, no toolboxes. Run it: it prints the rms error of four outputs.
%
% Model (charge domain, Q = Q+ minus Q-):
%   The input is a charge x, in LSB, from -512 to +512.
%   Decision i: s(i) = +1 if the residue r > 0, else -1.
%   After decision i the step i is subtracted with that sign: r = r - s(i)*w(i).
%   There are M steps and M+1 decisions; the last decision has no step.
%   Output value: y = sum(s(1:M).*w) + s(M+1)*w(M)/2   (weights known exactly)

clear; rng(1);                           % fixed seed: same chip every run

%% values
B      = 10;                             % output bits
wDes   = [256 136 72 40 24 16 8 4 2 1 1];% design weights in LSB, largest first
units  = wDes/8;                         % unit capacitors per step (8 LSB per unit)
sigU   = 0.0084;                         % sigma of one unit capacitor (35 fF): 1.193 % / sqrt(2)
nChips = 20;                             % chips to average over
x      = (-500:1/16:500)';               % ramp input in LSB, 16 points per LSB

%% loop over chips
e2 = zeros(nChips,4); none = zeros(nChips,1); two = zeros(nChips,1);
for c = 1:nChips
    % mismatch: a step of k units has relative sigma sigU/sqrt(k).
    % Simplification: steps below one unit get the sigma of one unit.
    sig = sigU ./ sqrt(max(units,1));
    w   = wDes .* (1 + sig.*randn(size(wDes)));   % true weights of this chip

    y = zeros(size(x));
    for k = 1:numel(x)
        y(k) = convert(x(k), w);
    end

    out = [y, round_to(y,0), round_to(y,1), round_to(y,2)];   % (a) (b) (c1) (c2)
    for j = 1:4
        err = out(:,j) - x;
        e2(c,j) = mean((err - mean(err)).^2);     % power of the error, offset removed
    end

    % how many 10-bit codes get no level, or two levels
    lev   = unique(round(y*1e6)/1e6);             % the distinct values this chip can make
    codes = round_to(lev,0);
    n     = histcounts(codes, (min(codes)-0.5):(max(codes)+0.5));
    none(c) = sum(n==0);  two(c) = sum(n>=2);
end

%% results
rmsErr = sqrt(mean(e2,1));
ideal  = 1/sqrt(12);                              % (d) ideal 10-bit quantizer
fprintf('rms error in LSB, mean over %d chips\n', nChips);
fprintf('  (a) real-valued, true weights : %.3f\n', rmsErr(1));
fprintf('  (b) rounded to 10 bit         : %.3f\n', rmsErr(2));
fprintf('  (c) rounded to 11 bit         : %.3f\n', rmsErr(3));
fprintf('  (c) rounded to 12 bit         : %.3f\n', rmsErr(4));
fprintf('  (d) ideal 10-bit quantizer    : %.3f\n', ideal);
fprintf('ENOB lost by rounding to 10 bit : %.2f bit\n', log2(rmsErr(2)/ideal));
fprintf('codes with no level: %.0f, with two levels: %.0f (mean per chip)\n', mean(none), mean(two));

%% functions
function y = convert(x, w)
% One conversion. x: input in LSB. w: true step weights. y: output value in LSB.
    M = numel(w);
    r = x;                                        % residue
    y = 0;
    for i = 1:M
        s = sign_of(r);                           % comparator decision
        r = r - s*w(i);                           % the step joins with that sign
        y = y + s*w(i);                           % the combiner adds the same weight
    end
    y = y + sign_of(r)*w(M)/2;                    % last decision: half the last step
end

function s = sign_of(r)
    if r > 0, s = 1; else, s = -1; end
end

function q = round_to(y, fracBits)
% Round to a grid of 2^-fracBits LSB. The codes sit at half-integers here
% (-0.5, +0.5, ...), because the input range is centred on zero.
    k = 2^fracBits;
    q = (round((y+0.5)*k))/k - 0.5;
end
