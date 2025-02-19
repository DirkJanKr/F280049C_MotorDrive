//
// Included Files
//
#include "adc.h"
#include "driverlib.h"
#include "device.h"
#include "board.h"

//
// Globals
//
volatile uint16_t adcB0_raw = 0;
volatile uint16_t adcB1_raw = 0;
volatile uint16_t adcC2_raw = 0;
volatile uint16_t voltageBus_raw = 0;
volatile uint16_t currentBus_raw = 0;

float currentA, currentB, currentC, currentBus;
float busVoltage;

//
// Function Prototypes
//
void initEPWM(void);
void initADC(void);
void processADCData(void);
float convertBusVoltage(uint16_t adcRawValue);
float convertPhaseCurrent(uint16_t adcRawValue);
__interrupt void INT_myADC0_1_ISR(void);

//
// Main Function
//
void main(void)
{
    // Initialize device, peripherals, and interrupts
    Device_init();
    Device_initGPIO();
    Interrupt_initModule();
    Interrupt_initVectorTable();
    Board_init();

    // Initialize ADC with calibration and filtering
    initADC();

    // Configure ePWM for ADC triggering
    initEPWM();

    // Enable ADC interrupt
    Interrupt_enable(INT_ADCB1);

    // Enable Global and Realtime Interrupts
    EINT;
    ERTM;

    // Start ePWM1 for ADC triggering
    EPWM_enableADCTrigger(EPWM1_BASE, EPWM_SOC_A);
    EPWM_setTimeBaseCounterMode(EPWM1_BASE, EPWM_COUNTER_MODE_UP);

    // Main processing loop
    while (1)
    {
        processADCData();  // Convert raw ADC values to real-world values

        // Read ADC Channel 0
        uint16_t adcResult = ADS7038_Read_ADC(0);
        
        // Convert to voltage
        float voltage = (adcResult * 3.3) / 4095.0;

        DEVICE_DELAY_US(1000);  // Small delay

        // Add motor control logic here
    }

}

//
// Initialize ADC with Calibration & Filtering
//
void initADC(void)
{
    // Set the correct reference voltage (Ensure 3.3V or 2.5V)
    ADC_setVREF(ADCA_BASE, ADC_REFERENCE_INTERNAL, ADC_REFERENCE_3_3V);
    ADC_setVREF(ADCB_BASE, ADC_REFERENCE_INTERNAL, ADC_REFERENCE_3_3V);
    ADC_setVREF(ADCC_BASE, ADC_REFERENCE_INTERNAL, ADC_REFERENCE_3_3V);

    // Apply factory-programmed offset trimming
    ADC_setOffsetTrimAll(ADC_REFERENCE_INTERNAL, ADC_REFERENCE_3_3V);

    // Apply INL trimming for better linearity
    ADC_setINLTrim(ADCA_BASE);
    ADC_setINLTrim(ADCB_BASE);
    ADC_setINLTrim(ADCC_BASE);

    // Set ADC Prescaler
    ADC_setPrescaler(ADCA_BASE, ADC_CLK_DIV_2_0);
    ADC_setPrescaler(ADCB_BASE, ADC_CLK_DIV_2_0);
    ADC_setPrescaler(ADCC_BASE, ADC_CLK_DIV_2_0);

    // Enable ADC Converters
    ADC_enableConverter(ADCA_BASE);
    ADC_enableConverter(ADCB_BASE);
    ADC_enableConverter(ADCC_BASE);

    // Delay for ADC to stabilize
    DEVICE_DELAY_US(5000);
}

//
// ePWM Configuration for ADC Triggering
//
void initEPWM(void)
{
    EPWM_disableADCTrigger(EPWM1_BASE, EPWM_SOC_A);
    EPWM_setADCTriggerSource(EPWM1_BASE, EPWM_SOC_A, EPWM_SOC_TBCTR_U_CMPA);
    EPWM_setADCTriggerEventPrescale(EPWM1_BASE, EPWM_SOC_A, 1);
    EPWM_setCounterCompareValue(EPWM1_BASE, EPWM_COUNTER_COMPARE_A, 1000);
    EPWM_setTimeBasePeriod(EPWM1_BASE, 1999);
    EPWM_setClockPrescaler(EPWM1_BASE, EPWM_CLOCK_DIVIDER_1, EPWM_HSCLOCK_DIVIDER_1);
    EPWM_setTimeBaseCounterMode(EPWM1_BASE, EPWM_COUNTER_MODE_STOP_FREEZE);
}

//
// ADC Interrupt Service Routine (ISR)
//
__interrupt void INT_myADC0_1_ISR(void)
{
    // Read ADC results
    adcB0_raw = ADC_readResult(ADCBRESULT_BASE, ADC_SOC_NUMBER0);
    adcB1_raw = ADC_readResult(ADCBRESULT_BASE, ADC_SOC_NUMBER1);
    adcC2_raw = ADC_readResult(ADCCRESULT_BASE, ADC_SOC_NUMBER0);

    voltageBus_raw = ADC_readResult(ADCARESULT_BASE, ADC_SOC_NUMBER0);
    currentBus_raw = ADC_readResult(ADCBRESULT_BASE, ADC_SOC_NUMBER3);

    // Clear ADC interrupt flag
    ADC_clearInterruptStatus(ADCB_BASE, ADC_INT_NUMBER1);
    Interrupt_clearACKGroup(INTERRUPT_ACK_GROUP1);
}

//
// Convert Raw ADC Values to Real-world Units
//
void processADCData(void)
{
    currentA = convertPhaseCurrent(adcC2_raw);
    currentB = convertPhaseCurrent(adcB0_raw);
    currentC = convertPhaseCurrent(adcB1_raw);
    busVoltage = convertBusVoltage(voltageBus_raw);
    currentBus = convertPhaseCurrent(currentBus_raw);
}

//
// Convert Bus Voltage (0-400V from 0-2V ADC input)
//
float convertBusVoltage(uint16_t adcRawValue)
{
    const float v_ref = 3.3f;          // ADC reference voltage
    const float scalingFactor = 200.0f; // 2V input corresponds to 400V bus voltage
    return ((float)adcRawValue * v_ref / 4095.0f) * scalingFactor;
}

//
// Convert Phase Current (-150A to +150A)
//
float convertPhaseCurrent(uint16_t adcRawValue)
{
    const float fullScaleCurrent = 150.0f;  // ±150A range
    const int16_t adcOffset = 2048;         // Expected zero-current ADC value

    int16_t adjustedValue = adcRawValue - adcOffset;
    float current = ((float)adjustedValue * fullScaleCurrent) / 2048.0f;

    return current;
}


uint16_t ADS7038_SPI_Transfer(uint16_t data)
{
    uint16_t receivedData;

    // Assert CS (Active LOW)
    GPIO_writePin(ADS7038_CS_GPIO, 0);
    
    // Wait until SPI TX FIFO is empty
    while (SPI_getTxFIFOStatus(mySPI0_BASE) != SPI_FIFO_TXEMPTY);

    // Send command
    SPI_writeDataBlockingNonFIFO(mySPI0_BASE, data);

    // Wait for RX data
    while (SPI_getRxFIFOStatus(mySPI0_BASE) == SPI_FIFO_RXEMPTY);

    // Read received data
    receivedData = SPI_readDataBlockingNonFIFO(mySPI0_BASE);

    // Deassert CS (HIGH)
    GPIO_writePin(ADS7038_CS_GPIO, 1);

    return receivedData;
}

uint16_t ADS7038_Read_ADC(uint8_t channel)
{
    uint16_t command;
    uint16_t adcValue;

    // Ensure channel is valid (0-7)
    if (channel > 7) return 0xFFFF;

    // Send channel select command
    command = ADS7038_SELECT_CHANNEL(channel);
    ADS7038_SPI_Transfer(command);

    // Wait for ADC conversion (1-2 µs)
    DEVICE_DELAY_US(10);

    // Read ADC result
    adcValue = ADS7038_SPI_Transfer(ADS7038_CMD_NOP);

    return adcValue;
}



//
// End of file
//
