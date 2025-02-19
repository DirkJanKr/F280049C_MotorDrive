//#############################################################################
//
// FILE:   lab_main.c
//
// TITLE:  C2000 Academy Lab Startup Project
//
//
// This example is a startup project for C2000 Academy lab.
//
//#############################################################################
//
//
// $Copyright:
// Copyright (C) 2022 Texas Instruments Incorporated - http://www.ti.com/
//
// Redistribution and use in source and binary forms, with or without 
// modification, are permitted provided that the following conditions 
// are met:
// 
//   Redistributions of source code must retain the above copyright 
//   notice, this list of conditions and the following disclaimer.
// 
//   Redistributions in binary form must reproduce the above copyright
//   notice, this list of conditions and the following disclaimer in the 
//   documentation and/or other materials provided with the   
//   distribution.
// 
//   Neither the name of Texas Instruments Incorporated nor the names of
//   its contributors may be used to endorse or promote products derived
//   from this software without specific prior written permission.
// 
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS 
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT 
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT 
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, 
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT 
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT 
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE 
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
// $
//#############################################################################

//
// Included Files
//
#include "driverlib.h"
#include "device.h"
#include "math.h"

#define Vbase 24
#define wbase 600
#define Vinverter 24
#define wstep 4

#define ENCODER_RESOLUTION  4096
#define POLE_PAIRS          4

#define pwmcount 2000
#define valdeadband 5

float theta = 0;
float w = 0;

float vala, valb, valc;

float wref = 30;
float dt = 0;

float voltage = 0;


uint16_t Ia;
uint16_t Ib;
uint16_t Ic;

int32_t position = 0;

float ea = 0;
float mechAngle = 0;

uint32_t previousTime, currentTime;


// Function to initialize the device
void initDevice() {
    Device_init();     // Initialize system clocks and peripherals
    Device_initGPIO(); // Initialize GPIO
}

// Function to configure GPIO for ePWM output
void configureGPIO() {
    GPIO_setPinConfig(GPIO_10_EPWM6A);              // Configure GPIO0 as EPWM1A
    GPIO_setDirectionMode(10, GPIO_DIR_MODE_OUT);   // Set GPIO0 as output
    GPIO_setPinConfig(GPIO_11_EPWM6B);              // Configure GPIO01 as EPWM1B
    GPIO_setDirectionMode(11, GPIO_DIR_MODE_OUT);   // Set GPIO1 as output

    GPIO_setPinConfig(GPIO_8_EPWM5A);
    GPIO_setDirectionMode(8, GPIO_DIR_MODE_OUT);
    GPIO_setPinConfig(GPIO_9_EPWM5B);
    GPIO_setDirectionMode(9, GPIO_DIR_MODE_OUT);

    GPIO_setPinConfig(GPIO_4_EPWM3A);
    GPIO_setDirectionMode(4, GPIO_DIR_MODE_OUT);
    GPIO_setPinConfig(GPIO_5_EPWM3B);
    GPIO_setDirectionMode(5, GPIO_DIR_MODE_OUT);

    GPIO_setPinConfig(GPIO_13_GPIO13);
    GPIO_setDirectionMode(13, GPIO_DIR_MODE_OUT);
    GPIO_writePin(13, 1);

    // Configure GPIOs for eQEP functionality
    GPIO_setPinConfig(GPIO_14_EQEP2A);
    GPIO_setPinConfig(GPIO_15_EQEP2B);
    GPIO_setPinConfig(GPIO_26_EQEP2I); // Index signal (optional)

    // Disable pin locks and enable internal pullups
    //GPIO_setPadConfig(0, GPIO_PIN_TYPE_PULLUP);
    //GPIO_setPadConfig(1, GPIO_PIN_TYPE_PULLUP);
    //GPIO_setPadConfig(2, GPIO_PIN_TYPE_PULLUP);
}

// Function to configure ePWM modules
void configureEPWM() {
    // Disable the time base clock before configuration
    SysCtl_disablePeripheral(SYSCTL_PERIPH_CLK_TBCLKSYNC);

    // Set up the time base for ePWM1
    EPWM_setTimeBasePeriod(EPWM6_BASE, pwmcount);                   // Set the period (controls PWM frequency)
    EPWM_setPhaseShift(EPWM6_BASE, 0);                              // No phase shift
    EPWM_setTimeBaseCounter(EPWM6_BASE, 0);                         // Start counter at 0
    EPWM_setTimeBaseCounterMode(EPWM6_BASE, EPWM_COUNTER_MODE_UP);  // Count up mode
    EPWM_setClockPrescaler(EPWM6_BASE, EPWM_CLOCK_DIVIDER_1, EPWM_HSCLOCK_DIVIDER_1);

    // Set up the time base for ePWM4
    EPWM_setTimeBasePeriod(EPWM5_BASE, pwmcount);
    EPWM_setPhaseShift(EPWM5_BASE, 0);
    EPWM_setTimeBaseCounter(EPWM5_BASE, 0);
    EPWM_setTimeBaseCounterMode(EPWM5_BASE, EPWM_COUNTER_MODE_UP);
    EPWM_setClockPrescaler(EPWM5_BASE, EPWM_CLOCK_DIVIDER_1, EPWM_HSCLOCK_DIVIDER_1);

    // Set up the time base for ePWM2
    EPWM_setTimeBasePeriod(EPWM3_BASE, pwmcount);
    EPWM_setPhaseShift(EPWM3_BASE, 0);
    EPWM_setTimeBaseCounter(EPWM3_BASE, 0);
    EPWM_setTimeBaseCounterMode(EPWM3_BASE, EPWM_COUNTER_MODE_UP);
    EPWM_setClockPrescaler(EPWM3_BASE, EPWM_CLOCK_DIVIDER_1, EPWM_HSCLOCK_DIVIDER_1);

    // Set the compare value for duty cycle
    EPWM_setCounterCompareValue(EPWM6_BASE, EPWM_COUNTER_COMPARE_A, 0);
    EPWM_setCounterCompareValue(EPWM5_BASE, EPWM_COUNTER_COMPARE_A, 0);
    EPWM_setCounterCompareValue(EPWM3_BASE, EPWM_COUNTER_COMPARE_A, 0);

    // Configure actions outputs
    EPWM_setActionQualifierAction(EPWM6_BASE, EPWM_AQ_OUTPUT_A,
                                  EPWM_AQ_OUTPUT_LOW, EPWM_AQ_OUTPUT_ON_TIMEBASE_ZERO);
    EPWM_setActionQualifierAction(EPWM6_BASE, EPWM_AQ_OUTPUT_A,
                                  EPWM_AQ_OUTPUT_HIGH, EPWM_AQ_OUTPUT_ON_TIMEBASE_UP_CMPA);
    EPWM_setActionQualifierAction(EPWM5_BASE, EPWM_AQ_OUTPUT_A,
                                  EPWM_AQ_OUTPUT_LOW, EPWM_AQ_OUTPUT_ON_TIMEBASE_ZERO);
    EPWM_setActionQualifierAction(EPWM5_BASE, EPWM_AQ_OUTPUT_A,
                                  EPWM_AQ_OUTPUT_HIGH, EPWM_AQ_OUTPUT_ON_TIMEBASE_UP_CMPA);
    EPWM_setActionQualifierAction(EPWM3_BASE, EPWM_AQ_OUTPUT_A,
                                  EPWM_AQ_OUTPUT_LOW, EPWM_AQ_OUTPUT_ON_TIMEBASE_ZERO);
    EPWM_setActionQualifierAction(EPWM3_BASE, EPWM_AQ_OUTPUT_A,
                                  EPWM_AQ_OUTPUT_HIGH, EPWM_AQ_OUTPUT_ON_TIMEBASE_UP_CMPA);

    // Configure Deadband settings
    EPWM_setDeadBandDelayPolarity(EPWM6_BASE, EPWM_DB_FED, EPWM_DB_POLARITY_ACTIVE_LOW);
    EPWM_setDeadBandDelayMode(EPWM6_BASE, EPWM_DB_RED, true);
    EPWM_setRisingEdgeDelayCountShadowLoadMode(EPWM6_BASE, EPWM_RED_LOAD_ON_CNTR_ZERO);
    EPWM_disableRisingEdgeDelayCountShadowLoadMode(EPWM6_BASE);
    EPWM_setRisingEdgeDelayCount(EPWM6_BASE, valdeadband);
    EPWM_setDeadBandDelayMode(EPWM6_BASE, EPWM_DB_FED, true);
    EPWM_setFallingEdgeDelayCountShadowLoadMode(EPWM6_BASE, EPWM_FED_LOAD_ON_CNTR_ZERO);
    EPWM_disableFallingEdgeDelayCountShadowLoadMode(EPWM6_BASE);
    EPWM_setFallingEdgeDelayCount(EPWM6_BASE, valdeadband);

    EPWM_setDeadBandDelayPolarity(EPWM5_BASE, EPWM_DB_FED, EPWM_DB_POLARITY_ACTIVE_LOW);
    EPWM_setDeadBandDelayMode(EPWM5_BASE, EPWM_DB_RED, true);
    EPWM_setRisingEdgeDelayCountShadowLoadMode(EPWM5_BASE, EPWM_RED_LOAD_ON_CNTR_ZERO);
    EPWM_disableRisingEdgeDelayCountShadowLoadMode(EPWM5_BASE);
    EPWM_setRisingEdgeDelayCount(EPWM5_BASE, valdeadband);
    EPWM_setDeadBandDelayMode(EPWM5_BASE, EPWM_DB_FED, true);
    EPWM_setFallingEdgeDelayCountShadowLoadMode(EPWM5_BASE, EPWM_FED_LOAD_ON_CNTR_ZERO);
    EPWM_disableFallingEdgeDelayCountShadowLoadMode(EPWM5_BASE);
    EPWM_setFallingEdgeDelayCount(EPWM5_BASE, valdeadband);

    EPWM_setDeadBandDelayPolarity(EPWM3_BASE, EPWM_DB_FED, EPWM_DB_POLARITY_ACTIVE_LOW);
    EPWM_setDeadBandDelayMode(EPWM3_BASE, EPWM_DB_RED, true);
    EPWM_setRisingEdgeDelayCountShadowLoadMode(EPWM3_BASE, EPWM_RED_LOAD_ON_CNTR_ZERO);
    EPWM_disableRisingEdgeDelayCountShadowLoadMode(EPWM3_BASE);
    EPWM_setRisingEdgeDelayCount(EPWM3_BASE, valdeadband);
    EPWM_setDeadBandDelayMode(EPWM3_BASE, EPWM_DB_FED, true);
    EPWM_setFallingEdgeDelayCountShadowLoadMode(EPWM3_BASE, EPWM_FED_LOAD_ON_CNTR_ZERO);
    EPWM_disableFallingEdgeDelayCountShadowLoadMode(EPWM3_BASE);
    EPWM_setFallingEdgeDelayCount(EPWM3_BASE, valdeadband);

    // Enable time base clock after configuration
    SysCtl_enablePeripheral(SYSCTL_PERIPH_CLK_TBCLKSYNC);
}

void ADC_init(){
    //ADCA
    ADC_setVREF(ADCA_BASE, ADC_REFERENCE_INTERNAL, ADC_REFERENCE_3_3V);
    ADC_setPrescaler(ADCA_BASE, ADC_CLK_DIV_8_0);
    ADC_setInterruptPulseMode(ADCA_BASE, ADC_PULSE_END_OF_CONV);
    ADC_enableConverter(ADCA_BASE);
    DEVICE_DELAY_US(5000);
    ADC_disableBurstMode(ADCA_BASE);
    ADC_setSOCPriority(ADCA_BASE, ADC_PRI_ALL_ROUND_ROBIN);
    ADC_setupSOC(ADCA_BASE, ADC_SOC_NUMBER0, ADC_TRIGGER_SW_ONLY, ADC_CH_ADCIN9, 20U);
    ADC_setInterruptSOCTrigger(ADCA_BASE, ADC_SOC_NUMBER0, ADC_INT_SOC_TRIGGER_NONE);

    ADC_setInterruptSource(ADCA_BASE, ADC_INT_NUMBER1, ADC_SOC_NUMBER0);
    ADC_clearInterruptStatus(ADCA_BASE, ADC_INT_NUMBER1);
    ADC_disableContinuousMode(ADCA_BASE, ADC_INT_NUMBER1);
    ADC_enableInterrupt(ADCA_BASE, ADC_INT_NUMBER1);

    //ADCB
    ADC_setVREF(ADCB_BASE, ADC_REFERENCE_INTERNAL, ADC_REFERENCE_3_3V);
    ADC_setPrescaler(ADCB_BASE, ADC_CLK_DIV_8_0);
    ADC_setInterruptPulseMode(ADCB_BASE, ADC_PULSE_END_OF_CONV);
    ADC_enableConverter(ADCB_BASE);
    DEVICE_DELAY_US(5000);
    ADC_disableBurstMode(ADCB_BASE);
    ADC_setSOCPriority(ADCB_BASE, ADC_PRI_ALL_ROUND_ROBIN);
    ADC_setupSOC(ADCB_BASE, ADC_SOC_NUMBER0, ADC_TRIGGER_SW_ONLY, ADC_CH_ADCIN2, 20U);
    ADC_setInterruptSOCTrigger(ADCB_BASE, ADC_SOC_NUMBER0, ADC_INT_SOC_TRIGGER_NONE);
    ADC_setInterruptSource(ADCB_BASE, ADC_INT_NUMBER1, ADC_SOC_NUMBER0);
    ADC_clearInterruptStatus(ADCB_BASE, ADC_INT_NUMBER1);
    ADC_disableContinuousMode(ADCB_BASE, ADC_INT_NUMBER1);
    ADC_enableInterrupt(ADCB_BASE, ADC_INT_NUMBER1);

    //ADCC
    ADC_setVREF(ADCC_BASE, ADC_REFERENCE_INTERNAL, ADC_REFERENCE_3_3V);
    ADC_setPrescaler(ADCC_BASE, ADC_CLK_DIV_8_0);
    ADC_setInterruptPulseMode(ADCC_BASE, ADC_PULSE_END_OF_CONV);
    ADC_enableConverter(ADCC_BASE);
    DEVICE_DELAY_US(5000);
    ADC_disableBurstMode(ADCC_BASE);
    ADC_setSOCPriority(ADCC_BASE, ADC_PRI_ALL_ROUND_ROBIN);
    ADC_setupSOC(ADCC_BASE, ADC_SOC_NUMBER0, ADC_TRIGGER_SW_ONLY, ADC_CH_ADCIN0, 20U);
    ADC_setInterruptSOCTrigger(ADCC_BASE, ADC_SOC_NUMBER0, ADC_INT_SOC_TRIGGER_NONE);
    ADC_setInterruptSource(ADCC_BASE, ADC_INT_NUMBER1, ADC_SOC_NUMBER0);
    ADC_clearInterruptStatus(ADCC_BASE, ADC_INT_NUMBER1);
    ADC_disableContinuousMode(ADCC_BASE, ADC_INT_NUMBER1);
    ADC_enableInterrupt(ADCC_BASE, ADC_INT_NUMBER1);
}

void PGA_init(){
    PGA_setGain(PGA1_BASE, PGA_GAIN_24);
    PGA_setFilterResistor(PGA1_BASE, PGA_LOW_PASS_FILTER_DISABLED);
    PGA_enable(PGA1_BASE);
    //
    // Delay for PGA to power up.
    //
    DEVICE_DELAY_US(500);

    PGA_setGain(PGA3_BASE, PGA_GAIN_3);
    PGA_setFilterResistor(PGA3_BASE, PGA_LOW_PASS_FILTER_DISABLED);
    PGA_enable(PGA3_BASE);
    DEVICE_DELAY_US(500);

    PGA_setGain(PGA5_BASE, PGA_GAIN_12);
    PGA_setFilterResistor(PGA5_BASE, PGA_LOW_PASS_FILTER_DISABLED);
    PGA_enable(PGA5_BASE);
    DEVICE_DELAY_US(500);
}


void initEQEP(void)
{
    EQEP_disableModule(EQEP2_BASE);
    EQEP_setDecoderConfig(EQEP2_BASE, EQEP_CONFIG_2X_RESOLUTION | EQEP_CONFIG_QUADRATURE);
    EQEP_setPositionCounterConfig(EQEP2_BASE, EQEP_POSITION_RESET_IDX, 0xFFFFFFFF);
    EQEP_setInitialPosition(EQEP2_BASE, 0);
    EQEP_enableUnitTimer(EQEP2_BASE, DEVICE_SYSCLK_FREQ / 1000000); // Unit timer frequency: 100 Hz
    EQEP_enableModule(EQEP2_BASE);

}


void DAC_init(){
    DAC_setReferenceVoltage(DACB_BASE, DAC_REF_ADC_VREFHI);
    DAC_setGainMode(DACB_BASE, DAC_GAIN_TWO);
    DAC_setLoadMode(DACB_BASE, DAC_LOAD_SYSCLK);
    DAC_enableOutput(DACB_BASE);
    DAC_setShadowValue(DACB_BASE, 2048U);

    DEVICE_DELAY_US(5000);
}

void ASYSCTL_init(){
    ASysCtl_disableTemperatureSensor();
    ASysCtl_setAnalogReferenceInternal( ASYSCTL_VREFHIA | ASYSCTL_VREFHIB | ASYSCTL_VREFHIC );
    ASysCtl_setAnalogReference1P65( ASYSCTL_VREFHIA | ASYSCTL_VREFHIB | ASYSCTL_VREFHIC );
}

void configureCPUTimer() {
    // Initialize CPU Timer 0
    CPUTimer_setPeriod(CPUTIMER0_BASE, 0xFFFFFFFF); // Set max period to prevent overflow
    CPUTimer_setPreScaler(CPUTIMER0_BASE, 0);       // No prescaler for accurate timing
    CPUTimer_startTimer(CPUTIMER0_BASE);            // Start the timer
}

// Function to get the current timer counter value
uint32_t getTimerCounterValue() {
    return HWREG(CPUTIMER0_BASE + CPUTIMER_O_TIM); // Access the timer counter register
}

float getElapsedTimeInMicroseconds(uint32_t startTime, uint32_t endTime) {
    // Calculate the time difference in timer ticks (timer counts down)
    float timeDifference = startTime - endTime;
    return timeDifference / 100; /// DEVICE_SYSCLK_FREQ; (wrong) // Convert ticks to microseconds
}

float getElectricalAngle(uint32_t position)
{
    mechAngle = (float)position / ENCODER_RESOLUTION * 2.0f * M_PI; // Mechanical angle in radians
    float elecAngle = mechAngle * POLE_PAIRS; // Electrical angle in radians
    return elecAngle - floor(elecAngle / (2.0f * M_PI)) * 2.0f * M_PI; // Wrap to 0-2 pi
}


// Main function
int main(void) {
    initDevice();         // Initialize the device
    configureGPIO();      // Configure GPIO for ePWM output
    configureEPWM();      // Configure ePWM modules
    configureCPUTimer();  // Configure CPU Timer module

    EALLOW;

    ASYSCTL_init();
    ADC_init();
    DAC_init();
    initEQEP();
    PGA_init();

    EDIS;


   // Record the initial time
   previousTime = getTimerCounterValue();

    while (1) {
        // Get the current time and calculate the elapsed time
        currentTime = getTimerCounterValue();
        dt = getElapsedTimeInMicroseconds(previousTime, currentTime) / 1000000;
        previousTime = currentTime;

        // Frequency ramp function
        if (w < wref) {
            w += wstep*dt;
        } else if (w > wref) {
            w -= wstep*dt;
        }

        // Update the angle
        theta += dt * w;
        if (theta > 2 * M_PI) {
            theta -= 2 * M_PI;
        }

        position = EQEP_getPosition(EQEP2_BASE);
        ea = getElectricalAngle(position);

        // Get the v/f voltage
        voltage = Vbase * (w / wbase) / Vinverter ;

        // Calculate the counter compare values
        vala = voltage * (sinf(theta) + 1) / 2;
        valb = voltage * (sinf(theta - 0.666666*M_PI) + 1) / 2;
        valc = voltage * (sinf(theta + 0.666666*M_PI) + 1) / 2;

        // Set the counter epwm values
        EPWM_setCounterCompareValue(EPWM6_BASE, EPWM_COUNTER_COMPARE_A, pwmcount*(1-vala));
        EPWM_setCounterCompareValue(EPWM5_BASE, EPWM_COUNTER_COMPARE_A, pwmcount*(1-valb));
        EPWM_setCounterCompareValue(EPWM3_BASE, EPWM_COUNTER_COMPARE_A, pwmcount*(1-valc));


        ADC_forceSOC(ADCA_BASE, ADC_SOC_NUMBER0);
        ADC_forceSOC(ADCC_BASE, ADC_SOC_NUMBER0);
        ADC_forceSOC(ADCB_BASE, ADC_SOC_NUMBER0);

        while(ADC_getInterruptStatus(ADCA_BASE, ADC_INT_NUMBER1) == false)
        {
        }
        ADC_clearInterruptStatus(ADCA_BASE, ADC_INT_NUMBER1);

        while(ADC_getInterruptStatus(ADCB_BASE, ADC_INT_NUMBER1) == false)
        {
        }
        ADC_clearInterruptStatus(ADCB_BASE, ADC_INT_NUMBER1);
        while(ADC_getInterruptStatus(ADCC_BASE, ADC_INT_NUMBER1) == false)
        {
        }
        ADC_clearInterruptStatus(ADCC_BASE, ADC_INT_NUMBER1);



        Ia = ADC_readResult(ADCARESULT_BASE, ADC_SOC_NUMBER0) * 10;
        Ib = ADC_readResult(ADCCRESULT_BASE, ADC_SOC_NUMBER0) * 10;
        Ic = ADC_readResult(ADCBRESULT_BASE, ADC_SOC_NUMBER0) * 10;

        //DEVICE_DELAY_US(10000);

    }
}

