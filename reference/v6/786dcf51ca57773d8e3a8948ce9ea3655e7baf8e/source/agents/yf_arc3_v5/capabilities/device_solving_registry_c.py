"""Explicit exports for the acquired K28 parent strategy."""
from .device_solving_contracts_c import (DeviceSolvingBindC,DeviceSolvingFinishC,DeviceSolvingReturnC,
    DeviceJoinInputC,DeviceJoinFactsC,DeviceJoinFinishC)
from .finite_instruction_device import DeviceRequest
from .family_result_join import FamilyJoinRequest
from .device_solving_c import (bind_device_solving,finish_device_solving,measure_device_join,get_device_join,finish_device_join)
from .device_solving_contracts_c import DeviceEvidenceInputC,DeviceEvidenceRowsC,DeviceEvidenceAppendC,DeviceEvidenceSealC
from .device_evidence_c import bind_device_evidence,measure_device_evidence,start_device_evidence,append_device_evidence,seal_device_evidence
from .device_solving_contracts_c import DeviceExecutionJoinC,DeviceSolvingFactsC
from .device_solving_c import join_device_execution
from .device_solving_contracts_c import DeviceStageCostFactsC,DeviceStageCostFinishC
from .finite_search_contracts_c import FiniteSearchInputC
from .device_stage_cost_c import bind_device_stage_cost_query,finish_device_stage_cost
from .device_solving_contracts_c import DeviceObservedSealC,DeviceOwnerPublicationJoinC
from .device_observed_effect_c import seal_device_observed_effects,join_device_owner_publication
from .device_solving_contracts_c import DeviceOperatorMethodJoinC,DeviceMemoryFactsC,DeviceMemoryRequestC,DeviceMemoryJoinC
from .device_operator_capture_c import join_device_operator_method,prepare_device_operator_capture,bind_device_operator_capture,seal_device_operator_capture
from .device_solving_contracts_c import DeviceCheckpointInputC,DeviceCheckpointNextInputC,DeviceCheckpointNextFactsC
from .device_checkpoint_c import bind_device_checkpoint_request,measure_device_next_program,bind_device_next_program,finish_device_checkpoint,missing_device_checkpoint
from .device_solving_contracts_c import DeviceEditCompilerFinishC
from .device_edit_compiler_c import finish_device_edit_compiler
from .device_solving_contracts_c import DeviceEditChainBindC,DeviceEditChainAppendC,DeviceEditCompilerFactsC
from .device_edit_chain_c import bind_device_edit_chain,append_device_edit_chain
from .device_example_isolation_c import start_device_example_isolation,join_device_example_isolation
from .device_solving_contracts_c import DeviceIsolationJoinC
from .device_solving_contracts_c import DeviceCheckpointStrategyFactsC,DeviceCheckpointStrategyInputC
from .device_checkpoint_strategy_c import bind_device_strategy_query,append_device_strategy_result,finish_device_strategy,start_device_strategy_meanings
from .device_strategy_question_c import DeviceStrategyQuestionFinishC,finish_device_strategy_question
from .device_solving_contracts_c import DeviceReceptacleJoinC
from .device_receptacle_c import join_device_receptacle,join_device_hazard_source
from .device_solving_contracts_c import DeviceCheckpointTriggerC,DeviceCheckpointTriggerInputC
from .device_checkpoint_trigger_c import measure_device_checkpoint_trigger,bind_device_checkpoint_trigger,finish_device_checkpoint_trigger
from .device_temporal_windows_c import measure_device_temporal_windows,seal_device_temporal_windows
from .device_temporal_trigger_c import measure_device_temporal_trigger,finish_device_temporal_trigger

DEVICE_SOLVING_C_TYPES=("DeviceFieldBindingC","DeviceSolvingInputC","DeviceSolvingFactsC","DeviceSolvingBindC",
    "DeviceSolvingFinishC","DeviceSolvingReturnC","DeviceJoinInputC","DeviceJoinFactsC","DeviceJoinFinishC")
DEVICE_SOLVING_C_TYPES += ("DeviceDemoSourceC",)
DEVICE_SOLVING_C_TYPES += ("DeviceEvidenceInputC","DeviceEvidenceRowsC","DeviceEvidenceAppendC","DeviceEvidenceSealC")
DEVICE_SOLVING_C_TYPES += ("DeviceExecutionIndicatorContractC","DeviceExecutionIndicatorSourceC","DeviceExecutionFactsC","DeviceExecutionJoinC")
DEVICE_SOLVING_C_TYPES += ("DeviceStageEditGroupC","DeviceStageCostPlanC","DeviceStageCostSourceC","DeviceStageCostFactsC","DeviceStageCostFinishC")
DEVICE_SOLVING_C_TYPES += ("DeviceReleasedPredictionC","DeviceObservedIntervalC","DeviceObservedFactsC","DeviceObservedSealC",
    "DeviceOwnerPublicationFactsC","DeviceOwnerPublicationJoinC")
DEVICE_SOLVING_C_TYPES += ("DeviceOperatorUnitsC","DeviceOperatorWitnessC","DeviceOperatorMethodC","DeviceOperatorCaptureC",
    "DeviceOperatorRecallC","DeviceOperatorMethodFactsC","DeviceOperatorMethodJoinC","DeviceMemoryFactsC","DeviceMemoryRequestC","DeviceMemoryJoinC")
DEVICE_SOLVING_C_TYPES += ("DeviceCheckpointContinuationC","DeviceCheckpointSourceC","DeviceCheckpointFactsC","DeviceCheckpointInputC",
    "DeviceCheckpointNextFactsC","DeviceCheckpointNextInputC")
DEVICE_SOLVING_C_TYPES += ("DevicePhaseIndicatorContractC","DevicePhaseObservationC","DevicePhaseTraceSourceC")
DEVICE_SOLVING_C_TYPES += ("DevicePrimitivePredictionC",)
DEVICE_SOLVING_C_TYPES += ("DeviceTraitActuatorC","DeviceEditCompilerSourceC","DeviceEditCompilerFactsC","DeviceEditCompilerFinishC")
DEVICE_SOLVING_C_TYPES += ("DeviceEditChainBindC","DeviceEditChainAppendC")
DEVICE_SOLVING_C_TYPES += ("DeviceIsolationJoinC",)
DEVICE_SOLVING_C_TYPES += ("DeviceCheckpointStrategySourceC","DeviceCheckpointStrategyFactsC","DeviceCheckpointStrategyInputC")
DEVICE_SOLVING_C_TYPES += ("DeviceStrategyQuestionFactsC","DeviceStrategyQuestionFinishC")
DEVICE_SOLVING_C_TYPES += ("DeviceReceptaclePropertyC","DeviceReceptacleSourceC","DeviceReceptacleFactsC","DeviceReceptacleJoinC")
DEVICE_SOLVING_C_TYPES += ("DeviceHazardSourceC",)
DEVICE_SOLVING_C_TYPES += ("DeviceCheckpointTriggerC","DeviceCheckpointTriggerInputC")
DEVICE_SOLVING_C_ENTRIES=(
    ("capability.device_solving_native_c",bind_device_solving,DeviceSolvingBindC,DeviceRequest),
    ("capability.device_solving_return_c",finish_device_solving,DeviceSolvingFinishC,DeviceSolvingReturnC),
    ("capability.device_join_measure_c",measure_device_join,DeviceJoinInputC,DeviceJoinFactsC),
    ("capability.device_join_input_c",get_device_join,DeviceJoinInputC,FamilyJoinRequest),
    ("capability.device_join_finish_c",finish_device_join,DeviceJoinFinishC,DeviceSolvingReturnC),
    ("capability.device_evidence_input_c",bind_device_evidence,DeviceJoinInputC,DeviceEvidenceInputC),
    ("capability.device_evidence_measure_c",measure_device_evidence,DeviceEvidenceInputC,DeviceEvidenceRowsC),
    ("capability.device_evidence_start_c",start_device_evidence,DeviceEvidenceInputC,DeviceEvidenceRowsC),
    ("capability.device_evidence_append_c",append_device_evidence,DeviceEvidenceAppendC,DeviceEvidenceRowsC),
    ("capability.device_evidence_seal_c",seal_device_evidence,DeviceEvidenceSealC,DeviceSolvingReturnC),
    ("capability.device_execution_join_c",join_device_execution,DeviceExecutionJoinC,DeviceSolvingFactsC),
    ("capability.device_stage_cost_query_c",bind_device_stage_cost_query,DeviceStageCostFinishC,FiniteSearchInputC),
    ("capability.device_stage_cost_finish_c",finish_device_stage_cost,DeviceStageCostFinishC,DeviceSolvingReturnC),
    ("capability.device_observed_seal_c",seal_device_observed_effects,DeviceObservedSealC,DeviceSolvingReturnC),
    ("capability.device_owner_publication_join_c",join_device_owner_publication,DeviceOwnerPublicationJoinC,DeviceSolvingReturnC),
    ("capability.device_operator_method_join_c",join_device_operator_method,DeviceOperatorMethodJoinC,DeviceSolvingReturnC),
    ("capability.device_memory_prepare_c",prepare_device_operator_capture,DeviceJoinInputC,DeviceMemoryFactsC),
    ("capability.device_memory_input_c",bind_device_operator_capture,DeviceMemoryFactsC,DeviceMemoryRequestC),
    ("capability.device_memory_seal_c",seal_device_operator_capture,DeviceMemoryJoinC,DeviceSolvingReturnC),
    ("capability.device_checkpoint_request_c",bind_device_checkpoint_request,DeviceCheckpointInputC,DeviceRequest),
    ("capability.device_checkpoint_next_measure_c",measure_device_next_program,DeviceCheckpointInputC,DeviceCheckpointNextFactsC),
    ("capability.device_checkpoint_next_request_c",bind_device_next_program,DeviceCheckpointNextInputC,DeviceRequest),
    ("capability.device_checkpoint_finish_c",finish_device_checkpoint,DeviceCheckpointNextInputC,DeviceSolvingReturnC),
    ("capability.device_checkpoint_missing_c",missing_device_checkpoint,DeviceCheckpointInputC,DeviceSolvingReturnC),
    ("capability.device_edit_compiler_finish_c",finish_device_edit_compiler,DeviceEditCompilerFinishC,DeviceSolvingReturnC),
    ("capability.device_edit_chain_input_c",bind_device_edit_chain,DeviceEditChainBindC,FiniteSearchInputC),
    ("capability.device_edit_chain_append_c",append_device_edit_chain,DeviceEditChainAppendC,DeviceEditCompilerFactsC),
    ("capability.device_example_isolation_start_c",start_device_example_isolation,DeviceSolvingBindC,DeviceEvidenceRowsC),
    ("capability.device_example_isolation_join_c",join_device_example_isolation,DeviceIsolationJoinC,DeviceSolvingFactsC),
    ("capability.device_strategy_query_c",bind_device_strategy_query,DeviceCheckpointStrategyInputC,DeviceRequest),
    ("capability.device_strategy_append_c",append_device_strategy_result,DeviceCheckpointStrategyInputC,DeviceCheckpointStrategyFactsC),
    ("capability.device_strategy_meanings_start_c",start_device_strategy_meanings,DeviceCheckpointStrategyInputC,DeviceEvidenceRowsC),
    ("capability.device_strategy_question_finish_c",finish_device_strategy_question,DeviceStrategyQuestionFinishC,DeviceSolvingReturnC),
    ("capability.device_receptacle_join_c",join_device_receptacle,DeviceReceptacleJoinC,DeviceSolvingFactsC),
    ("capability.device_hazard_source_join_c",join_device_hazard_source,DeviceReceptacleJoinC,DeviceSolvingFactsC),
    ("capability.device_checkpoint_trigger_measure_c",measure_device_checkpoint_trigger,DeviceJoinInputC,DeviceCheckpointTriggerC),
    ("capability.device_checkpoint_trigger_query_c",bind_device_checkpoint_trigger,DeviceCheckpointTriggerInputC,DeviceRequest),
    ("capability.device_checkpoint_trigger_finish_c",finish_device_checkpoint_trigger,DeviceCheckpointTriggerInputC,DeviceSolvingReturnC),
    ("capability.device_temporal_windows_measure_c",measure_device_temporal_windows,DeviceJoinInputC,DeviceEvidenceRowsC),
    ("capability.device_temporal_windows_seal_c",seal_device_temporal_windows,DeviceEvidenceSealC,DeviceSolvingReturnC),
    ("capability.device_temporal_trigger_measure_c",measure_device_temporal_trigger,DeviceJoinInputC,DeviceCheckpointTriggerC),
    ("capability.device_temporal_trigger_finish_c",finish_device_temporal_trigger,DeviceCheckpointTriggerInputC,DeviceSolvingReturnC),
    ("capability.device_strategy_finish_c",finish_device_strategy,DeviceCheckpointStrategyInputC,DeviceSolvingReturnC))


def device_solving_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref,implementation=method,input_model=inputs,output_model=outputs,
        source_file=method.__module__.rsplit(".",1)[-1]+".py",applicability=("current_finite_device_parent_question",),
        invariants=("current_acquisition","frozen_parent_why","separate_real_demo_worlds","no_ACT"),
        falsifiers=("stale_request","unsupported_law_promotion","demo_counted_as_real_progress")) for ref,method,inputs,outputs in DEVICE_SOLVING_C_ENTRIES)


def device_solving_signatures_c(type_spec,parameter_spec):
    def p(name,kind):return parameter_spec(name=name,type_spec=type_spec(kind))
    return {
        "capability.device_solving_native_c":((p("measured","DeviceSolvingFactsC"),),"DeviceRequest"),
        "capability.device_solving_return_c":((p("measured","DeviceSolvingFactsC"),p("returned","Any")),"DeviceSolvingReturnC"),
        "capability.device_join_measure_c":((p("returned","DeviceSolvingReturnC"),),"DeviceJoinFactsC"),
        "capability.device_join_input_c":((p("returned","DeviceSolvingReturnC"),),"FamilyJoinRequest"),
        "capability.device_join_finish_c":((p("returned","DeviceSolvingReturnC"),p("measured","DeviceJoinFactsC"),p("joined","Any")),"DeviceSolvingReturnC"),
        "capability.device_evidence_input_c":((p("returned","DeviceSolvingReturnC"),),"DeviceEvidenceInputC"),
        "capability.device_evidence_measure_c":((p("returned","DeviceSolvingReturnC"),),"DeviceEvidenceRowsC"),
        "capability.device_evidence_start_c":((p("returned","DeviceSolvingReturnC"),),"DeviceEvidenceRowsC"),
        "capability.device_evidence_append_c":((p("prior","List<Any>"),p("meaning","DeclaredMeaningInstantiation")),"DeviceEvidenceRowsC"),
        "capability.device_evidence_seal_c":((p("returned","DeviceSolvingReturnC"),p("measured","DeviceEvidenceRowsC"),p("meanings","List<Any>")),"DeviceSolvingReturnC"),
        "capability.device_execution_join_c":((p("measured","DeviceSolvingFactsC"),p("execution","DeviceExecutionFactsC")),"DeviceSolvingFactsC"),
        "capability.device_stage_cost_query_c":((p("measured","DeviceStageCostFactsC"),p("result","Any")),"FiniteSearchInputC"),
        "capability.device_stage_cost_finish_c":((p("measured","DeviceStageCostFactsC"),p("result","Any")),"DeviceSolvingReturnC"),
        "capability.device_observed_seal_c":((p("returned","DeviceSolvingReturnC"),p("measured","DeviceObservedFactsC"),p("meanings","List<Any>")),"DeviceSolvingReturnC"),
        "capability.device_owner_publication_join_c":((p("returned","DeviceSolvingReturnC"),p("publication","DeviceOwnerPublicationFactsC"),p("published","Any")),"DeviceSolvingReturnC"),
        "capability.device_operator_method_join_c":((p("measured","DeviceOperatorMethodFactsC"),),"DeviceSolvingReturnC"),
        "capability.device_memory_prepare_c":((p("returned","DeviceSolvingReturnC"),),"DeviceMemoryFactsC"),
        "capability.device_memory_input_c":((p("returned","DeviceSolvingReturnC"),p("memory_request","Any"),p("facts","Any"),p("missing_refs","List<String>")),"DeviceMemoryRequestC"),
        "capability.device_memory_seal_c":((p("measured","DeviceMemoryFactsC"),p("captured","Any")),"DeviceSolvingReturnC"),
        "capability.device_checkpoint_request_c":((p("measured","DeviceCheckpointFactsC"),p("checkpoint_return","Any"),p("next_return","Any")),"DeviceRequest"),
        "capability.device_checkpoint_next_measure_c":((p("measured","DeviceCheckpointFactsC"),p("checkpoint_return","Any"),p("next_return","Any")),"DeviceCheckpointNextFactsC"),
        "capability.device_checkpoint_next_request_c":((p("measured","DeviceCheckpointNextFactsC"),p("next_return","Any")),"DeviceRequest"),
        "capability.device_checkpoint_finish_c":((p("measured","DeviceCheckpointNextFactsC"),p("next_return","Any")),"DeviceSolvingReturnC"),
        "capability.device_checkpoint_missing_c":((p("measured","DeviceCheckpointFactsC"),p("checkpoint_return","Any"),p("next_return","Any")),"DeviceSolvingReturnC"),
        "capability.device_edit_compiler_finish_c":((p("measured","DeviceEditCompilerFactsC"),p("meaning","Any")),"DeviceSolvingReturnC"),
        "capability.device_edit_chain_input_c":((p("measured","DeviceEditCompilerFactsC"),p("index","Integer")),"FiniteSearchInputC"),
        "capability.device_edit_chain_append_c":((p("measured","DeviceEditCompilerFactsC"),p("index","Integer"),p("result","FiniteSearchFactsC")),"DeviceEditCompilerFactsC"),
        "capability.device_example_isolation_start_c":((p("measured","DeviceSolvingFactsC"),),"DeviceEvidenceRowsC"),
        "capability.device_example_isolation_join_c":((p("measured","DeviceSolvingFactsC"),p("meanings","List<Any>")),"DeviceSolvingFactsC"),
        "capability.device_strategy_query_c":((p("measured","DeviceCheckpointStrategyFactsC"),p("index","Integer"),p("next_return","Any")),"DeviceRequest"),
        "capability.device_strategy_append_c":((p("measured","DeviceCheckpointStrategyFactsC"),p("index","Integer"),p("next_return","Any")),"DeviceCheckpointStrategyFactsC"),
        "capability.device_strategy_meanings_start_c":((p("measured","DeviceCheckpointStrategyFactsC"),p("index","Integer"),p("next_return","Any")),"DeviceEvidenceRowsC"),
        "capability.device_strategy_question_finish_c":((p("measured","DeviceStrategyQuestionFactsC"),),"DeviceSolvingReturnC"),
        "capability.device_receptacle_join_c":((p("measured","DeviceSolvingFactsC"),p("receptacle","DeviceReceptacleFactsC")),"DeviceSolvingFactsC"),
        "capability.device_hazard_source_join_c":((p("measured","DeviceSolvingFactsC"),p("receptacle","DeviceReceptacleFactsC")),"DeviceSolvingFactsC"),
        "capability.device_checkpoint_trigger_measure_c":((p("returned","DeviceSolvingReturnC"),),"DeviceCheckpointTriggerC"),
        "capability.device_checkpoint_trigger_query_c":((p("measured","DeviceCheckpointTriggerC"),p("child_return","Any")),"DeviceRequest"),
        "capability.device_checkpoint_trigger_finish_c":((p("measured","DeviceCheckpointTriggerC"),p("child_return","Any")),"DeviceSolvingReturnC"),
        "capability.device_temporal_windows_measure_c":((p("returned","DeviceSolvingReturnC"),),"DeviceEvidenceRowsC"),
        "capability.device_temporal_windows_seal_c":((p("returned","DeviceSolvingReturnC"),p("measured","DeviceEvidenceRowsC"),p("meanings","List<Any>")),"DeviceSolvingReturnC"),
        "capability.device_temporal_trigger_measure_c":((p("returned","DeviceSolvingReturnC"),),"DeviceCheckpointTriggerC"),
        "capability.device_temporal_trigger_finish_c":((p("measured","DeviceCheckpointTriggerC"),p("child_return","Any")),"DeviceSolvingReturnC"),
        "capability.device_strategy_finish_c":((p("measured","DeviceCheckpointStrategyFactsC"),p("index","Integer"),p("next_return","Any"),p("meanings","List<Any>")),"DeviceSolvingReturnC")}
