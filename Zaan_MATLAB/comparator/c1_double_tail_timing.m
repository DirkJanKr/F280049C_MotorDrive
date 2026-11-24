%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%   C1: THE DOUBLE-TAIL COMPARATOR AS A HAND MODEL: DELAY AND NOISE       %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% QUESTION
% How long does the comparator take to decide an input of 1 LSB, and how
% does that depend on its sizes? Which first-stage capacitance does the noise
% target ask for? (Before Cadence: generic 180 nm values, all A.)
%
% THE STORY (Schinkel 2007, Fig. 17.7.2; Razavi 2015)
% 1. Reset: the clock is low. The first-stage nodes Di are precharged to V DD,
%    and through the middle transistors the outputs are held at ground.
% 2. Integration: the clock goes high. The first-stage tail turns on and the
%    input pair pulls current I D from each Di node. Both nodes fall together
%    (common mode, rate I D / C D), and the side with the larger input falls
%    faster: a difference grows as  dV D = gm dV in t / C D  (Razavi eq. 1 form).
% 3. Hand-over: when the Di nodes have fallen about V DD - V TH, the middle
%    transistors stop clamping the outputs and the latch starts. The gain
%    collected until then is
%        A int = gm t int / C D = (gm/ID) dV int,   dV int = V DD - V TH
%    (Razavi: A = gm V THN / I CM for the StrongARM; the double-tail lets the
%    Di nodes fall further, so it gains more before the latch starts.)
% 4. Regeneration: the latch (its own tail, Schinkel M12) amplifies
%    exponentially with tau reg = C out / gm latch (Razavi eq. 9), until the
%    outputs reach V DD / 2:
%        t reg = tau reg ln( (V DD / 2) / (k A int dV in) )
%    k: how much of dV D the middle stage passes on to the latch (A, 0.5).
% 5. Delay:  t d = t int + t reg. Every factor 10 smaller input adds
%    2.3 tau reg (Schinkel measured 37 to 44 ps per decade in 90 nm).
% 6. Noise (Razavi eq. 13 to 15): the input pair's noise is integrated on C D
%    during t int and then divided by the gain:
%        v n^2 = 8 k T gamma / (C D (gm/ID) dV int)
%    So the noise target sets C D, and C D with the time t int sets the current:
%        I D = C D dV int / t int
%
% HAND CHECK (generic values, A): gamma 1, gm/ID 15, dV int = 1.8 - 0.5 = 1.3 V,
% noise 100 uV:  C D = 8 x 4.14e-21 / (1e-8 x 15 x 1.3) = 170 fF.
% t int 0.3 ns:  I D = 170 fF x 1.3 V / 0.3 ns = 0.74 mA per side.
% 1 LSB = 0.49 mV: A int = 15 x 1.3 = 19.5, dV latch = 0.5 x 19.5 x 0.49 mV = 4.8 mV,
% t reg = 20 ps x ln(0.9 / 0.0048) = 20 ps x 5.2 = 0.10 ns,  t d = 0.40 ns.
%
% WHAT THE CODE DOES
%   1) values   2) first stage from the noise target   3) delay against input
%   4) the hard decisions (input sigma / 10)   5) energy, and what r becomes

clear; close all; clc;
kB = 1.380649e-23;  T = 300;

%% -----------------------------
% 1) Values (generic 180 nm, A; replace by the PDK tables and Cadence later)
% -----------------------------
VDD     = 1.8;        % supply [V]                                          A
VTH     = 0.5;        % threshold [V]                                        A
gamma   = 1;          % thermal noise factor                                 A
gmid1   = 15;         % input pair gm/ID [1/V] (moderate inversion)          A
v_noise = 100e-6;     % noise target [V rms] (workbench Comparator page)     A
t_int   = 0.3e-9;     % integration time we aim for [s]                      A
k_pass  = 0.5;        % part of dV D the middle stage passes to the latch    A
tau_reg = 20e-12;     % latch regeneration time constant [s]                 A
v_lsb   = 0.49e-3;    % 1 LSB at the last decision [V] (workbench)           D
JD1     = 12.9e-6;    % NMOS current density at gm/ID 15, L 0.18 um [A/um]   A (generic table)
fT1     = 14.7e9;     % NMOS fT at gm/ID 15, L 0.18 um [Hz]                  A (generic table)
tau_sw  = 0.2e-9;     % CDAC switch time constant 2 R on C u [s]             A (5.9 kOhm x 35 fF)

%% -----------------------------
% 2) First stage from the noise target
% -----------------------------
dVint = VDD - VTH;                                   % how far the Di nodes fall [V]
CD    = 8*kB*T*gamma / (v_noise^2 * gmid1 * dVint);  % capacitance per Di node [F]
ID1   = CD * dVint / t_int;                          % current per side [A]
W1    = ID1 / JD1;                                   % input transistor width [um]
Cgg1  = gmid1*ID1 / (2*pi*fT1);                      % its own gate capacitance [F]
Aint  = gmid1 * dVint;                               % gain at the hand-over
fprintf('first stage: C D = %.0f fF per node, I D = %.2f mA per side, W1 = %.0f um (C gg %.0f fF), A int = %.1f\n', ...
        CD*1e15, ID1*1e3, W1, Cgg1*1e15, Aint);

%% -----------------------------
% 3) Delay against input
% -----------------------------
dVin = logspace(-5, -1, 9);                          % 10 uV to 100 mV
dV0  = min(k_pass * Aint * dVin, VDD/2);             % difference at the latch input [V]
td   = t_int + tau_reg * log((VDD/2) ./ dV0);
fprintf('\n  input        delay\n');
for i = 1:numel(dVin), fprintf('%9.3g mV   %6.3f ns\n', dVin(i)*1e3, td(i)*1e9); end
fprintf('slope: %.0f ps per decade (Schinkel measured 37 to 44 in 90 nm)\n', tau_reg*log(10)*1e12);

%% -----------------------------
% 4) The decisions that matter
% -----------------------------
t_lsb  = t_int + tau_reg*log((VDD/2)/(k_pass*Aint*v_lsb));
t_hard = t_int + tau_reg*log((VDD/2)/(k_pass*Aint*v_noise/10));
fprintf('\n1 LSB (%.2f mV): %.2f ns;  hard decision (sigma/10 = %.0f uV): %.2f ns\n', v_lsb*1e3, t_lsb*1e9, v_noise/10*1e6, t_hard*1e9);

%% -----------------------------
% 5) Energy per decision and the ratio r for the weight design (step 7b2)
% -----------------------------
E = 2 * CD * VDD * dVint;                            % both Di nodes discharged and recharged [J]
fprintf('energy of the first stage: %.2f pJ per decision; at 13 decisions x 40 MS/s: %.2f mW\n', E*1e12, E*13*40e6*1e3);
fprintf('r = comparator delay / tau switch = %.1f (without logic delay)\n', t_lsb/tau_sw);
figure; semilogx(dVin*1e3, td*1e9, 'o-'); grid on;
xlabel('input difference [mV]'); ylabel('delay [ns]'); title('Double-tail delay against input (hand model)');
