################################################################################
# Automatically-generated file. Do not edit!
################################################################################

SHELL = cmd.exe

# Each subdirectory must supply rules for building sources it contributes
build-138162639: ../lab_f28004x_launchpad.syscfg
	@echo 'Building file: "$<"'
	@echo 'Invoking: SysConfig'
	"C:/ti/ccs2000/ccs/utils/sysconfig_1.22.0/sysconfig_cli.bat" --script "C:/Users/dirkj/OneDrive/Documenten/Workspace_CCS_MotorDrive/Vf_CurrentSense/lab_f28004x_launchpad.syscfg" -o "syscfg" -s "C:/ti/C2000Ware_MotorControl_SDK_5_03_00_00/c2000ware/.metadata/sdk.json" -b "/boards/LAUNCHXL_F280049C" --compiler ccs
	@echo 'Finished building: "$<"'
	@echo ' '

syscfg/board.c: build-138162639 ../lab_f28004x_launchpad.syscfg
syscfg/board.h: build-138162639
syscfg/board.cmd.genlibs: build-138162639
syscfg/board.opt: build-138162639
syscfg/board.json: build-138162639
syscfg/pinmux.csv: build-138162639
syscfg/epwm.dot: build-138162639
syscfg/c2000ware_libraries.cmd.genlibs: build-138162639
syscfg/c2000ware_libraries.opt: build-138162639
syscfg/c2000ware_libraries.c: build-138162639
syscfg/c2000ware_libraries.h: build-138162639
syscfg/clocktree.h: build-138162639
syscfg: build-138162639

syscfg/%.obj: ./syscfg/%.c $(GEN_OPTS) | $(GEN_FILES) $(GEN_MISC_FILES)
	@echo 'Building file: "$<"'
	@echo 'Invoking: C2000 Compiler'
	"C:/ti/ccs2000/ccs/tools/compiler/ti-cgt-c2000_22.6.1A23259/bin/cl2000" -v28 -ml -mt --cla_support=cla2 --float_support=fpu32 --tmu_support=tmu0 --vcu_support=vcu0 -Ooff --include_path="C:/Users/dirkj/OneDrive/Documenten/Workspace_CCS_MotorDrive/Vf_CurrentSense" --include_path="C:/ti/C2000Ware_MotorControl_SDK_5_03_00_00/c2000ware" --include_path="C:/Users/dirkj/OneDrive/Documenten/Workspace_CCS_MotorDrive/Vf_CurrentSense/device" --include_path="C:/ti/C2000Ware_MotorControl_SDK_5_03_00_00/c2000ware/driverlib/f28004x/driverlib" --include_path="C:/ti/ccs2000/ccs/tools/compiler/ti-cgt-c2000_22.6.1A23259/include" --define=DEBUG --define=RAM --define=_LAUNCHXL_F280049C --diag_suppress=10063 --diag_warning=225 --diag_wrap=off --display_error_number --gen_func_subsections=on --abi=eabi --preproc_with_compile --preproc_dependency="syscfg/$(basename $(<F)).d_raw" --include_path="C:/Users/dirkj/OneDrive/Documenten/Workspace_CCS_MotorDrive/Vf_CurrentSense/CPU1_RAM/syscfg" --obj_directory="syscfg" $(GEN_OPTS__FLAG) "$<"
	@echo 'Finished building: "$<"'
	@echo ' '

%.obj: ../%.c $(GEN_OPTS) | $(GEN_FILES) $(GEN_MISC_FILES)
	@echo 'Building file: "$<"'
	@echo 'Invoking: C2000 Compiler'
	"C:/ti/ccs2000/ccs/tools/compiler/ti-cgt-c2000_22.6.1A23259/bin/cl2000" -v28 -ml -mt --cla_support=cla2 --float_support=fpu32 --tmu_support=tmu0 --vcu_support=vcu0 -Ooff --include_path="C:/Users/dirkj/OneDrive/Documenten/Workspace_CCS_MotorDrive/Vf_CurrentSense" --include_path="C:/ti/C2000Ware_MotorControl_SDK_5_03_00_00/c2000ware" --include_path="C:/Users/dirkj/OneDrive/Documenten/Workspace_CCS_MotorDrive/Vf_CurrentSense/device" --include_path="C:/ti/C2000Ware_MotorControl_SDK_5_03_00_00/c2000ware/driverlib/f28004x/driverlib" --include_path="C:/ti/ccs2000/ccs/tools/compiler/ti-cgt-c2000_22.6.1A23259/include" --define=DEBUG --define=RAM --define=_LAUNCHXL_F280049C --diag_suppress=10063 --diag_warning=225 --diag_wrap=off --display_error_number --gen_func_subsections=on --abi=eabi --preproc_with_compile --preproc_dependency="$(basename $(<F)).d_raw" --include_path="C:/Users/dirkj/OneDrive/Documenten/Workspace_CCS_MotorDrive/Vf_CurrentSense/CPU1_RAM/syscfg" $(GEN_OPTS__FLAG) "$<"
	@echo 'Finished building: "$<"'
	@echo ' '


