%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%                  STEP 0: THE SPECIFICATION, IN CHARGE                   %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% QUESTION
% What are the full scale, one LSB and the noise we may add, all as charge?
%
% ANSWER (C_M = 280 fF)
% Q_FS = 4480 fC, Q_LSB = 4.375 fC. Quantisation noise 1.263 fC rms.
% For ENOB 9.5 everything else together may add as much as the quantisation.
%
% Charge convention, used in every step: Q = Q+ - Q-, the difference of the
% charges on the two summing nodes. No CDAC yet.

clear; close all; clc;
zaan_constants;            % runs the script with all given values

%% -----------------------------
% 1) The input charge
% -----------------------------
% A read connects N_ch memory cells to each node, so each node holds
% C_TH = N_ch * C_M. A differential input V gives Q+ - Q- = C_TH * V.
C_TH = N_ch * C_M;         % memory cells on one node during a read [F]
Q_FS = C_TH * V_FS;        % full-scale charge, peak to peak [C]

fprintf('C_TH = N C_M = %d x %.0f fF = %.2f pF per node\n', N_ch, C_M*1e15, C_TH*1e12);
fprintf('full scale Q_FS = C_TH V_FS = %.0f fC\n', Q_FS*1e15);
% fprintf prints text: %.2f is a number with 2 decimals, %d a whole number,
% \n a new line. The values after the text fill the % fields in order.

%% -----------------------------
% 2) One LSB
% -----------------------------
Q_LSB = Q_FS / 2^N_bits;   % one step of the converter [C]
fprintf('one LSB: Q_LSB = Q_FS / 2^%d = %.3f fC\n', N_bits, Q_LSB*1e15);

%% -----------------------------
% 3) The noise we may add for the ENOB aim
% -----------------------------
% Quantisation of an ideal converter adds Q_LSB^2 / 12 (rms Q_LSB / sqrt(12)).
% Every half bit less doubles the allowed noise power, so ENOB 9.5 allows
% twice the quantisation power: the rest may add as much as the quantisation.
q_quant   = Q_LSB / sqrt(12);                      % rms [C]
q_allowed = q_quant * 2^(N_bits - ENOB_aim);       % total rms for the aim [C]
q_other   = sqrt(q_allowed^2 - q_quant^2);         % what is left for the rest [C]

fprintf('quantisation noise: %.3f fC rms (%.3f LSB)\n', q_quant*1e15, q_quant/Q_LSB);
fprintf('allowed in total for ENOB %.1f: %.3f fC rms\n', ENOB_aim, q_allowed*1e15);
fprintf('left for all other noise:       %.3f fC rms (%.3f LSB)\n', q_other*1e15, q_other/Q_LSB);

%% -----------------------------
% 4) Check: ideal 10 bit gives SNDR = 6.02 B + 1.76 dB
% -----------------------------
% A full-scale sine has amplitude Q_FS/2, so power (Q_FS/2)^2 / 2.
SNDR = 10*log10( (Q_FS/2)^2/2 / q_quant^2 );
fprintf('\nideal SNDR = %.2f dB, formula 6.02 x %d + 1.76 = %.2f dB\n', SNDR, N_bits, 6.02*N_bits + 1.76);
if abs(SNDR - (6.02*N_bits + 1.76)) < 0.01, disp('CHECK OK'), else, disp('CHECK FAILED'), end
