################################################################################
# Automatically-generated file. Do not edit!
################################################################################

SHELL = cmd.exe

# Each subdirectory must supply rules for building sources it contributes
build-956340975: ../adc_ex10_multiple_soc_epwm.syscfg
	@echo 'Building file: "$<"'
	@echo 'Invoking: SysConfig'
	"C:/ti/ccs2000/ccs/utils/sysconfig_1.22.0/sysconfig_cli.bat" --script "C:/Users/dirkj/OneDrive/Documenten/Workspace_CCS_MotorDrive/Phase_Voltages/adc_ex10_multiple_soc_epwm.syscfg" -o "syscfg" -s "C:/ti/c2000/C2000Ware_5_04_00_00/.metadata/sdk.json" -d "F28004x" -p "F28004x_100PZ" -r "F28004x_100PZ" --compiler ccs
	@echo 'Finished building: "$<"'
	@echo ' '

syscfg/board.c: build-956340975 ../adc_ex10_multiple_soc_epwm.syscfg
syscfg/board.h: build-956340975
syscfg/board.cmd.genlibs: build-956340975
syscfg/board.opt: build-956340975
syscfg/board.json: build-956340975
syscfg/pinmux.csv: build-956340975
syscfg/adc.dot: build-956340975
syscfg/c2000ware_libraries.cmd.genlibs: build-956340975
syscfg/c2000ware_libraries.opt: build-956340975
syscfg/c2000ware_libraries.c: build-956340975
syscfg/c2000ware_libraries.h: build-956340975
syscfg/clocktree.h: build-956340975
syscfg: build-956340975

syscfg/%.obj: ./syscfg/%.c $(GEN_OPTS) | $(GEN_FILES) $(GEN_MISC_FILES)
	@echo 'Building file: "$<"'
	@echo 'Invoking: C2000 Compiler'
	"C:/ti/ccs2000/ccs/tools/compiler/ti-cgt-c2000_22.6.1A23259/bin/cl2000" -v28 -ml -mt --cla_support=cla2 --float_support=fpu32 --tmu_support=tmu0 --vcu_support=vcu0 -Ooff --include_path="C:/Users/dirkj/OneDrive/Documenten/Workspace_CCS_MotorDrive/Phase_Voltages" --include_path="C:/ti/c2000/C2000Ware_5_04_00_00" --include_path="C:/Users/dirkj/OneDrive/Documenten/Workspace_CCS_MotorDrive/Phase_Voltages/device" --include_path="C:/ti/c2000/C2000Ware_5_04_00_00/driverlib/f28004x/driverlib/" --include_path="C:/ti/ccs2000/ccs/tools/compiler/ti-cgt-c2000_22.6.1A23259/include" --define=DEBUG --diag_suppress=10063 --diag_warning=225 --diag_wrap=off --display_error_number --gen_func_subsections=on --abi=eabi --preproc_with_compile --preproc_dependency="syscfg/$(basename $(<F)).d_raw" --include_path="C:/Users/dirkj/OneDrive/Documenten/Workspace_CCS_MotorDrive/Phase_Voltages/CPU1_RAM/syscfg" --obj_directory="syscfg" $(GEN_OPTS__FLAG) "$<"
	@echo 'Finished building: "$<"'
	@echo ' '


