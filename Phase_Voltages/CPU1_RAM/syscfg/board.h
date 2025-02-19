/*
 * Copyright (c) 2020 Texas Instruments Incorporated - http://www.ti.com
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * *  Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 *
 * *  Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * *  Neither the name of Texas Instruments Incorporated nor the names of
 *    its contributors may be used to endorse or promote products derived
 *    from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 * THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
 * OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
 * EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 */

#ifndef BOARD_H
#define BOARD_H

//*****************************************************************************
//
// If building with a C++ compiler, make all of the definitions in this header
// have a C binding.
//
//*****************************************************************************
#ifdef __cplusplus
extern "C"
{
#endif

//
// Included Files
//

#include "driverlib.h"
#include "device.h"

//*****************************************************************************
//
// PinMux Configurations
//
//*****************************************************************************

//
// SPIB -> mySPI0 Pinmux
//
//
// SPIB_PICO - GPIO Settings
//
#define GPIO_PIN_SPIB_PICO 24
#define mySPI0_SPIPICO_GPIO 24
#define mySPI0_SPIPICO_PIN_CONFIG GPIO_24_SPIB_SIMO
//
// SPIB_POCI - GPIO Settings
//
#define GPIO_PIN_SPIB_POCI 25
#define mySPI0_SPIPOCI_GPIO 25
#define mySPI0_SPIPOCI_PIN_CONFIG GPIO_25_SPIB_SOMI
//
// SPIB_CLK - GPIO Settings
//
#define GPIO_PIN_SPIB_CLK 14
#define mySPI0_SPICLK_GPIO 14
#define mySPI0_SPICLK_PIN_CONFIG GPIO_14_SPIB_CLK
//
// SPIB_PTE - GPIO Settings
//
#define GPIO_PIN_SPIB_PTE 15
#define mySPI0_SPIPTE_GPIO 15
#define mySPI0_SPIPTE_PIN_CONFIG GPIO_15_SPIB_STE

//*****************************************************************************
//
// ADC Configurations
//
//*****************************************************************************
#define B_Channel_BASE ADCB_BASE
#define B_Channel_RESULT_BASE ADCBRESULT_BASE
#define B_Channel_SOC0 ADC_SOC_NUMBER0
#define B_Channel_FORCE_SOC0 ADC_FORCE_SOC0
#define B_Channel_SAMPLE_WINDOW_SOC0 100
#define B_Channel_TRIGGER_SOURCE_SOC0 ADC_TRIGGER_EPWM1_SOCA
#define B_Channel_CHANNEL_SOC0 ADC_CH_ADCIN1
#define B_Channel_SOC1 ADC_SOC_NUMBER1
#define B_Channel_FORCE_SOC1 ADC_FORCE_SOC1
#define B_Channel_SAMPLE_WINDOW_SOC1 150
#define B_Channel_TRIGGER_SOURCE_SOC1 ADC_TRIGGER_EPWM1_SOCA
#define B_Channel_CHANNEL_SOC1 ADC_CH_ADCIN2
#define B_Channel_SOC2 ADC_SOC_NUMBER2
#define B_Channel_FORCE_SOC2 ADC_FORCE_SOC2
#define B_Channel_SAMPLE_WINDOW_SOC2 150
#define B_Channel_TRIGGER_SOURCE_SOC2 ADC_TRIGGER_EPWM1_SOCA
#define B_Channel_CHANNEL_SOC2 ADC_CH_ADCIN0
void B_Channel_init();

#define C_Channel_BASE ADCC_BASE
#define C_Channel_RESULT_BASE ADCCRESULT_BASE
#define C_Channel_SOC0 ADC_SOC_NUMBER0
#define C_Channel_FORCE_SOC0 ADC_FORCE_SOC0
#define C_Channel_SAMPLE_WINDOW_SOC0 150
#define C_Channel_TRIGGER_SOURCE_SOC0 ADC_TRIGGER_EPWM1_SOCA
#define C_Channel_CHANNEL_SOC0 ADC_CH_ADCIN2
#define C_Channel_SOC1 ADC_SOC_NUMBER1
#define C_Channel_FORCE_SOC1 ADC_FORCE_SOC1
#define C_Channel_SAMPLE_WINDOW_SOC1 150
#define C_Channel_TRIGGER_SOURCE_SOC1 ADC_TRIGGER_EPWM1_SOCA
#define C_Channel_CHANNEL_SOC1 ADC_CH_ADCIN5
void C_Channel_init();

#define A_Channel_BASE ADCA_BASE
#define A_Channel_RESULT_BASE ADCARESULT_BASE
#define A_Channel_SOC0 ADC_SOC_NUMBER0
#define A_Channel_FORCE_SOC0 ADC_FORCE_SOC0
#define A_Channel_SAMPLE_WINDOW_SOC0 150
#define A_Channel_TRIGGER_SOURCE_SOC0 ADC_TRIGGER_EPWM1_SOCA
#define A_Channel_CHANNEL_SOC0 ADC_CH_ADCIN6
void A_Channel_init();


//*****************************************************************************
//
// ASYSCTL Configurations
//
//*****************************************************************************

//*****************************************************************************
//
// INTERRUPT Configurations
//
//*****************************************************************************

// Interrupt Settings for INT_B_Channel_1
// ISR need to be defined for the registered interrupts
#define INT_B_Channel_1 INT_ADCB1
#define INT_B_Channel_1_INTERRUPT_ACK_GROUP INTERRUPT_ACK_GROUP1
extern __interrupt void INT_myADC0_1_ISR(void);

//*****************************************************************************
//
// SPI Configurations
//
//*****************************************************************************
#define mySPI0_BASE SPIB_BASE
#define mySPI0_BITRATE 1000000
#define mySPI0_DATAWIDTH 16
void mySPI0_init();

//*****************************************************************************
//
// Board Configurations
//
//*****************************************************************************
void	Board_init();
void	ADC_init();
void	ASYSCTL_init();
void	INTERRUPT_init();
void	SPI_init();
void	PinMux_init();

//*****************************************************************************
//
// Mark the end of the C bindings section for C++ compilers.
//
//*****************************************************************************
#ifdef __cplusplus
}
#endif

#endif  // end of BOARD_H definition
