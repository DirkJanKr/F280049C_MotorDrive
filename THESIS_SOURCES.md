# Thesis sources: quotes and where they support the design

Quotes Dirk-Jan wants to cite later, with page, and what they support. Status S = page checked.

## Rabuske and Fernandes, Charge-Sharing SAR ADCs (Springer 2017), chapter 4

| Page | Quote or equation | Supports | Status |
|---|---|---|---|
| 89 | "By definition, a DNL lower than −1 in the transfer curve of an ADC represents a nonmonotonic behavior, while a DNL equal to −1 represents a missing code. In a SAR ADC, the monotonicity is guaranteed by the architecture, preventing the DNL to present values lower than −1. Missing codes, however, are still possible." (minus signs restored: the extracted text drops them) | Why the MATLAB checks count missing codes (DNL = −1), steps 5, 7f, 8 | S |
| 89 | eq. 4.59 and 4.60: worst DNL from offset abs(V os) / (alpha V LSB); no missing codes if abs(V os) < alpha V LSB | Offset limit for binary, MATLAB 7f (simulated, matches) | S |
| 74 | eq. 4.22 to 4.24: at the largest input the residue is one LSB, Q 0 = Q TH,max − Q DAC,111..1, so V IR = 2^(B+1) C 0 V PC / C TH | Charge balance and full scale, MATLAB s3 | S |
| 98 | "Figure 4.18 plots ENOB for ADCs with resolutions between 6 and 14 bits, alpha between 0.5 and 5, 2 V of input range and an exaggerated range of comparator offset voltage of 0 to 100 mV. The plot reveals that the model is less accurate for low values of alpha and low resolutions ... For resolutions above 8 bits with alpha larger than 1, abs(delta ENOB) < 2 %. Interestingly, the ENOB achieved with (4.97) is slightly pessimistic" | The offset ENOB model (eq. 4.97) is accurate for our case (10 bit, alpha = 1) | S |
| not in Rabuske | Raising alpha above 1 gains little: not stated in the book (searched by Dirk-Jan, 25 Nov). Own derivation for the thesis: comparator LSB = V LSB alpha / (1 + alpha); offset DNL 1/alpha (eq. 4.59); CDAC kT/C (1 + alpha) / alpha^2 (eq. 4.99, 4.100); V REF and reference energy rise with alpha | Reason for alpha = 1 (decided 18 Nov) | D |

## Redundancy and weight design (found 23 Nov, abstracts only; read full text before citing)
Hotta et al. 2010 (IEEJ); Chang, Lee, Boning 2011 (GLSVLSI); IEICE Electronics Express 11(10) 2014; Ogawa et al. 2010 (IEICE); Electronics 14(10):2032, 2025. See the weight design method page: https://claude.ai/artifact/6Gu4HmfiHjnYApi2Lp8x7b
