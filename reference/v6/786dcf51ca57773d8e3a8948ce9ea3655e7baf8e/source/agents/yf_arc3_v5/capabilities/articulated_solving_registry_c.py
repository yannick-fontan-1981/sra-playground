"""K24 parent ports, reusing the common native calculation registry."""
from .articulated_channel_kinematics import ArtiRequest
from .articulated_solving_contracts_c import (
    ArticulatedSolvingBindInputC,ArticulatedSolvingFinishInputC,ArticulatedSolvingReturnC,
    ArticulatedJoinInputC,ArticulatedJoinFactsC,ArticulatedJoinReturnInputC,ArticulatedJoinBlockedInputC)
from .articulated_solving_c import bind_articulated_solving,finish_articulated_solving
from .articulated_solving_c import measure_articulated_join,get_articulated_join,return_articulated_join,return_articulated_unjoined
from .family_result_join import FamilyJoinRequest
from .articulated_solving_contracts_c import (ArticulatedTerminalStartInputC,ArticulatedTerminalAppendInputC,
    ArticulatedTerminalSealInputC,ArticulatedTerminalRowsC)
from .articulated_terminal_c import prepare_articulated_terminal,append_articulated_terminal,seal_articulated_terminal
from .articulated_solving_contracts_c import (ArticulatedClearanceStartInputC,ArticulatedClearanceAppendInputC,
    ArticulatedClearanceSealInputC,ArticulatedClearanceRowsC)
from .articulated_clearance_c import prepare_articulated_clearance,append_articulated_clearance,seal_articulated_clearance
from .articulated_solving_contracts_c import ArticulatedParentReturnInputC
from .articulated_parent_return_c import assemble_articulated_parent_return
from .articulated_solving_contracts_c import ArticulatedRouteParentInputC,ArticulatedRouteParentFactsC,ArticulatedRouteParentSealInputC
from .articulated_route_contracts_c import ArticulatedRouteBridgeInputC
from .articulated_route_parent_c import measure_articulated_route_parent,get_articulated_parent_route,seal_articulated_parent_route
from .articulated_solving_contracts_c import (ArticulatedPassiveGoalInputC,ArticulatedPassiveGoalRowsC,
    ArticulatedPassiveMeaningInputC,ArticulatedPassiveMeaningAppendC,ArticulatedPassiveMeaningRowsC,ArticulatedSolvingFactsC)
from .articulated_passive_blocker_c import prepare_articulated_passive_goals,attach_articulated_passive_meanings,append_articulated_passive_meaning
from .articulated_passive_blocker_c import initialize_articulated_passive_meanings
from .articulated_passive_blocker_c import bind_articulated_passive_goal_input
from .articulated_transition_domain_c import ArticulatedTransitionStartInputC,ArticulatedTransitionAppendInputC,ArticulatedTransitionSessionC
from .articulated_transition_session_c import initialize_articulated_transition_session,append_articulated_transition_return
from .articulated_solving_contracts_c import ArticulatedTransitionParentInputC,ArticulatedTransitionParentFactsC,ArticulatedTransitionParentSealInputC
from .articulated_transition_domain_c import ArticulatedTransitionDomainInputC
from .articulated_transition_parent_c import measure_articulated_transition_parent,get_articulated_transition_domain,seal_articulated_transition_parent
from .articulated_solving_contracts_c import ArticulatedDependencyInputC,ArticulatedDependencyRowsC,ArticulatedDependencyAppendC,ArticulatedDependencySealC
from .articulated_dependency_measurement_c import (bind_articulated_dependency_input,measure_articulated_dependency_effects,
    initialize_articulated_dependency_meanings,append_articulated_dependency_meaning,seal_articulated_dependency_meanings)
from .articulated_useful_prefix_c import measure_articulated_useful_prefixes,append_articulated_prefix_meaning,seal_articulated_useful_prefixes
from .articulated_solving_contracts_c import (ArticulatedAcquisitionAppendC,ArticulatedAcquisitionReturnC,ArticulatedAcquisitionJoinC,
    ArticulatedGeometryPublicationReturnC)
from .articulated_acquisition_transport_c import append_articulated_field_acquisition,join_articulated_acquisition_publication
from .articulated_dynamic_contracts_c import (ArticulatedDynamicSessionC,ArticulatedDynamicSessionInputC,
    ArticulatedDynamicNextInputC,ArticulatedDynamicNextC,ArticulatedDynamicBindInputC,ArticulatedDynamicBoundC,ArticulatedDynamicAppendInputC)
from .articulated_dynamic_c import (measure_articulated_dynamic_requested,initialize_articulated_dynamic,recalculate_articulated_dynamic,
    next_articulated_dynamic_question,bind_articulated_dynamic_question,append_articulated_dynamic,seal_articulated_dynamic,
    measure_articulated_dynamic_closure,close_articulated_dynamic_domain)
from .mechanical_common_contracts_c import CommonSignatureFactsC
from .articulated_pose_question_c import prepare_articulated_pose_questions,attach_articulated_pose_questions
from .articulated_restoration_target_c import prepare_articulated_restoration_targets,attach_articulated_restoration_targets
from .articulated_solving_contracts_c import ArticulatedPoseMeaningInputC
from agents.yf_arc3_v5.logos.types import FrozenMap

ARTICULATED_SOLVING_C_TYPES = ("ArticulatedAcquiredFieldC","ArticulatedFieldBindingC",
    "ArticulatedComponentFieldC","ArticulatedStateAssemblyC",
    "ArticulatedObservedBodyC","ArticulatedGeometryAcquisitionC",
    "ArticulatedRouteControlC","ArticulatedRouteControlDomainC",
    "ArticulatedRelationC","ArticulatedLawBindingC","ArticulatedMarkerTargetC","ArticulatedRestorationC","ArticulatedDependencyEffectC",
    "ArticulatedDependencyQuestionC",
    "ArticulatedObservedAngleC","ArticulatedOperatorScopeC","ArticulatedSolvingInputC","ArticulatedSolvingFactsC",
    "ArticulatedSolvingBindInputC","ArticulatedSolvingFinishInputC","ArticulatedSolvingReturnC",
    "ArticulatedJoinInputC","ArticulatedJoinFactsC","ArticulatedJoinReturnInputC","ArticulatedJoinBlockedInputC",
    "ArticulatedTerminalPreparedC","ArticulatedTerminalRowsC","ArticulatedTerminalStartInputC",
    "ArticulatedTerminalAppendInputC","ArticulatedTerminalSealInputC",
    "ArticulatedClearanceWitnessC","ArticulatedClearancePreparedC","ArticulatedClearanceRowsC",
    "ArticulatedBlockedEditC",
    "ArticulatedClearanceStartInputC","ArticulatedClearanceAppendInputC","ArticulatedClearanceSealInputC",
    "ArticulatedParentReturnInputC")
ARTICULATED_SOLVING_C_TYPES += ("ArticulatedGeometryPublicationC","ArticulatedGeometryPublicationReturnC","ArticulatedParentMeasureInputC")
ARTICULATED_SOLVING_C_TYPES += ("ArticulatedRouteParentInputC","ArticulatedRouteParentFactsC","ArticulatedRouteParentSealInputC")
ARTICULATED_SOLVING_C_TYPES += ("ArticulatedPassiveGoalInputC","ArticulatedPassiveGoalRowsC","ArticulatedPassiveMeaningInputC","ArticulatedPassiveMeaningAppendC","ArticulatedPassiveMeaningRowsC")
ARTICULATED_SOLVING_C_TYPES += ("ArticulatedOperatorTemplateC","ArticulatedTransitionDomainInputC","ArticulatedTransitionQuestionC","ArticulatedTransitionDomainFactsC")
ARTICULATED_SOLVING_C_TYPES += ("ArticulatedMaskExtentCaseC","ArticulatedControlLawC")
ARTICULATED_SOLVING_C_TYPES += ("ArticulatedTransitionSessionC","ArticulatedTransitionStartInputC","ArticulatedTransitionAppendInputC")
ARTICULATED_SOLVING_C_TYPES += ("ArticulatedTransitionParentInputC","ArticulatedTransitionParentFactsC","ArticulatedTransitionParentSealInputC")
ARTICULATED_SOLVING_C_TYPES += ("ArticulatedDependencyInputC","ArticulatedDependencyRowsC","ArticulatedDependencyAppendC","ArticulatedDependencySealC")
ARTICULATED_SOLVING_C_TYPES += ("ArticulatedFieldAcquisitionC","ArticulatedAcquisitionReturnC","ArticulatedAcquisitionAppendC","ArticulatedAcquisitionJoinC",
    "CargoScalarAcquisitionInputB","ObservedFieldOwnerScopeProofD","ObservedFieldOwnerRequestD","ObservedFieldOwnerFactsD")
ARTICULATED_SOLVING_C_TYPES += ("ArticulatedDynamicSessionC","ArticulatedDynamicSessionInputC","ArticulatedDynamicNextInputC",
    "ArticulatedDynamicNextC","ArticulatedDynamicBindInputC","ArticulatedDynamicBoundC","ArticulatedDynamicAppendInputC")
ARTICULATED_SOLVING_C_TYPES += ("ArticulatedPoseMeaningInputC",)


def articulated_solving_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref,implementation=method,input_model=inputs,
        output_model=outputs,source_file=method.__module__.rsplit(".",1)[-1]+".py",
        applicability=("current_parent_articulated_question",),
        invariants=("exact_acquired_fields","distinct_graphs","same_K24","no_ACT"),
        falsifiers=("stale_scope","wrong_return_identity"))
        for ref,method,inputs,outputs in (
            ("capability.articulated_solving_native_c",bind_articulated_solving,ArticulatedSolvingBindInputC,ArtiRequest),
            ("capability.articulated_solving_return_c",finish_articulated_solving,ArticulatedSolvingFinishInputC,ArticulatedSolvingReturnC),
            ("capability.articulated_join_measure_c",measure_articulated_join,ArticulatedJoinInputC,ArticulatedJoinFactsC),
            ("capability.articulated_join_input_c",get_articulated_join,ArticulatedJoinInputC,FamilyJoinRequest),
            ("capability.articulated_join_return_c",return_articulated_join,ArticulatedJoinReturnInputC,ArticulatedSolvingReturnC),
            ("capability.articulated_unjoined_c",return_articulated_unjoined,ArticulatedJoinBlockedInputC,ArticulatedSolvingReturnC),
            ("capability.articulated_terminal_prepare_c",prepare_articulated_terminal,ArticulatedTerminalStartInputC,ArticulatedTerminalRowsC),
            ("capability.articulated_terminal_append_c",append_articulated_terminal,ArticulatedTerminalAppendInputC,ArticulatedTerminalRowsC),
            ("capability.articulated_terminal_seal_c",seal_articulated_terminal,ArticulatedTerminalSealInputC,ArticulatedSolvingReturnC),
            ("capability.articulated_clearance_prepare_c",prepare_articulated_clearance,ArticulatedClearanceStartInputC,ArticulatedClearanceRowsC),
            ("capability.articulated_clearance_append_c",append_articulated_clearance,ArticulatedClearanceAppendInputC,ArticulatedClearanceRowsC),
            ("capability.articulated_clearance_seal_c",seal_articulated_clearance,ArticulatedClearanceSealInputC,ArticulatedSolvingReturnC),
            ("capability.articulated_parent_return_c",assemble_articulated_parent_return,ArticulatedParentReturnInputC,ArticulatedSolvingReturnC),
            ("capability.articulated_route_parent_measure_c",measure_articulated_route_parent,ArticulatedRouteParentInputC,ArticulatedRouteParentFactsC),
            ("capability.articulated_route_parent_input_c",get_articulated_parent_route,ArticulatedRouteParentInputC,ArticulatedRouteBridgeInputC),
            ("capability.articulated_route_parent_seal_c",seal_articulated_parent_route,ArticulatedRouteParentSealInputC,ArticulatedSolvingReturnC),
            ("capability.articulated_passive_goal_rows_c",prepare_articulated_passive_goals,ArticulatedPassiveGoalInputC,ArticulatedPassiveGoalRowsC),
            ("capability.articulated_passive_goal_attach_c",attach_articulated_passive_meanings,ArticulatedPassiveMeaningInputC,ArticulatedSolvingFactsC),
            ("capability.articulated_passive_goal_append_c",append_articulated_passive_meaning,ArticulatedPassiveMeaningAppendC,ArticulatedPassiveMeaningRowsC),
            ("capability.articulated_passive_goal_start_c",initialize_articulated_passive_meanings,ArticulatedPassiveGoalInputC,ArticulatedPassiveMeaningRowsC),
            ("capability.articulated_passive_goal_input_c",bind_articulated_passive_goal_input,ArticulatedPassiveGoalInputC,ArticulatedPassiveGoalInputC),
            ("capability.articulated_transition_start_c",initialize_articulated_transition_session,ArticulatedTransitionStartInputC,ArticulatedTransitionSessionC),
            ("capability.articulated_transition_append_c",append_articulated_transition_return,ArticulatedTransitionAppendInputC,ArticulatedTransitionSessionC),
            ("capability.articulated_transition_parent_measure_c",measure_articulated_transition_parent,ArticulatedTransitionParentInputC,ArticulatedTransitionParentFactsC),
            ("capability.articulated_transition_parent_input_c",get_articulated_transition_domain,ArticulatedTransitionParentInputC,ArticulatedTransitionDomainInputC),
            ("capability.articulated_transition_parent_seal_c",seal_articulated_transition_parent,ArticulatedTransitionParentSealInputC,ArticulatedSolvingReturnC),
            ("capability.articulated_dependency_input_c",bind_articulated_dependency_input,ArticulatedDependencyInputC,ArticulatedDependencyInputC),
            ("capability.articulated_dependency_measure_c",measure_articulated_dependency_effects,ArticulatedDependencyInputC,ArticulatedDependencyRowsC),
            ("capability.articulated_dependency_start_c",initialize_articulated_dependency_meanings,ArticulatedDependencyInputC,ArticulatedDependencyRowsC),
            ("capability.articulated_dependency_append_c",append_articulated_dependency_meaning,ArticulatedDependencyAppendC,ArticulatedDependencyRowsC),
            ("capability.articulated_dependency_seal_c",seal_articulated_dependency_meanings,ArticulatedDependencySealC,ArticulatedSolvingReturnC),
            ("capability.articulated_prefix_measure_c",measure_articulated_useful_prefixes,ArticulatedDependencyInputC,ArticulatedDependencyRowsC),
            ("capability.articulated_prefix_append_c",append_articulated_prefix_meaning,ArticulatedDependencyAppendC,ArticulatedDependencyRowsC),
            ("capability.articulated_prefix_seal_c",seal_articulated_useful_prefixes,ArticulatedDependencySealC,ArticulatedSolvingReturnC),
            ("capability.articulated_acquisition_append_c",append_articulated_field_acquisition,ArticulatedAcquisitionAppendC,ArticulatedAcquisitionReturnC),
            ("capability.articulated_acquisition_join_c",join_articulated_acquisition_publication,ArticulatedAcquisitionJoinC,ArticulatedGeometryPublicationReturnC),
            ("capability.articulated_dynamic_requested_c",measure_articulated_dynamic_requested,ArticulatedDependencyInputC,ArticulatedTransitionParentFactsC),
            ("capability.articulated_dynamic_initialize_c",initialize_articulated_dynamic,ArticulatedDependencyInputC,ArticulatedDynamicSessionC),
            ("capability.articulated_dynamic_recalculate_c",recalculate_articulated_dynamic,ArticulatedDynamicSessionInputC,ArticulatedDynamicSessionC),
            ("capability.articulated_dynamic_next_c",next_articulated_dynamic_question,ArticulatedDynamicNextInputC,ArticulatedDynamicNextC),
            ("capability.articulated_dynamic_bind_c",bind_articulated_dynamic_question,ArticulatedDynamicBindInputC,ArticulatedDynamicBoundC),
            ("capability.articulated_dynamic_append_c",append_articulated_dynamic,ArticulatedDynamicAppendInputC,ArticulatedDynamicSessionC),
            ("capability.articulated_dynamic_seal_c",seal_articulated_dynamic,ArticulatedDynamicSessionInputC,ArticulatedSolvingReturnC),
            ("capability.articulated_dynamic_closure_c",measure_articulated_dynamic_closure,ArticulatedDynamicSessionInputC,CommonSignatureFactsC),
            ("capability.articulated_dynamic_close_c",close_articulated_dynamic_domain,ArticulatedDynamicSessionInputC,ArticulatedDynamicSessionC),
            ("capability.articulated_pose_question_rows_c",prepare_articulated_pose_questions,ArticulatedPassiveGoalInputC,ArticulatedPassiveGoalRowsC),
            ("capability.articulated_pose_question_attach_c",attach_articulated_pose_questions,ArticulatedPoseMeaningInputC,ArticulatedSolvingFactsC),
            ("capability.articulated_restoration_target_rows_c",prepare_articulated_restoration_targets,ArticulatedPassiveGoalInputC,ArticulatedPassiveGoalRowsC),
            ("capability.articulated_restoration_target_attach_c",attach_articulated_restoration_targets,ArticulatedPoseMeaningInputC,ArticulatedSolvingFactsC)))


def articulated_solving_signatures_c(type_spec,parameter_spec):
    def p(name,kind): return parameter_spec(name=name,type_spec=type_spec(kind))
    return {"capability.articulated_solving_native_c":((p("measured","ArticulatedSolvingFactsC"),),"ArtiRequest"),
        "capability.articulated_solving_return_c":((p("measured","ArticulatedSolvingFactsC"),p("returned","Any")),"ArticulatedSolvingReturnC"),
        "capability.articulated_join_measure_c":((p("returned","ArticulatedSolvingReturnC"),),"ArticulatedJoinFactsC"),
        "capability.articulated_join_input_c":((p("returned","ArticulatedSolvingReturnC"),),"FamilyJoinRequest"),
        "capability.articulated_join_return_c":((p("returned","ArticulatedSolvingReturnC"),p("joined","FamilyJoinResult")),"ArticulatedSolvingReturnC"),
        "capability.articulated_unjoined_c":((p("returned","ArticulatedSolvingReturnC"),p("measured","ArticulatedJoinFactsC")),"ArticulatedSolvingReturnC"),
        "capability.articulated_terminal_prepare_c":((p("returned","ArticulatedSolvingReturnC"),),"ArticulatedTerminalRowsC"),
        "capability.articulated_terminal_append_c":((p("returned","ArticulatedSolvingReturnC"),p("prepared","ArticulatedTerminalPreparedC"),p("measured","ArticulatedKinematicsMeasurements"),p("prior","ArticulatedTerminalRowsC")),"ArticulatedTerminalRowsC"),
        "capability.articulated_terminal_seal_c":((p("returned","ArticulatedSolvingReturnC"),p("terminal","ArticulatedTerminalRowsC")),"ArticulatedSolvingReturnC"),
        "capability.articulated_clearance_prepare_c":((p("returned","ArticulatedSolvingReturnC"),),"ArticulatedClearanceRowsC"),
        "capability.articulated_clearance_append_c":((p("prepared","ArticulatedClearancePreparedC"),p("returned","MechanicalNormalizedReturn"),p("prior","ArticulatedClearanceRowsC")),"ArticulatedClearanceRowsC"),
        "capability.articulated_clearance_seal_c":((p("returned","ArticulatedSolvingReturnC"),p("clearance","ArticulatedClearanceRowsC")),"ArticulatedSolvingReturnC"),
        "capability.articulated_parent_return_c":((p("returned","ArticulatedSolvingReturnC"),),"ArticulatedSolvingReturnC"),
        "capability.articulated_route_parent_measure_c":((p("returned","ArticulatedSolvingReturnC"),),"ArticulatedRouteParentFactsC"),
        "capability.articulated_route_parent_input_c":((p("returned","ArticulatedSolvingReturnC"),),"ArticulatedRouteBridgeInputC"),
        "capability.articulated_route_parent_seal_c":((p("returned","ArticulatedSolvingReturnC"),p("measured","ArticulatedRouteParentFactsC"),p("route","Any")),"ArticulatedSolvingReturnC"),
        "capability.articulated_passive_goal_rows_c":((p("measured","ArticulatedSolvingFactsC"),),"ArticulatedPassiveGoalRowsC"),
        "capability.articulated_passive_goal_attach_c":((p("measured","ArticulatedSolvingFactsC"),p("meanings","List<Any>")),"ArticulatedSolvingFactsC"),
        "capability.articulated_passive_goal_append_c":((p("prior","List<Any>"),p("meaning","DeclaredMeaningInstantiation")),"ArticulatedPassiveMeaningRowsC"),
        "capability.articulated_passive_goal_start_c":((p("measured","ArticulatedSolvingFactsC"),),"ArticulatedPassiveMeaningRowsC"),
        "capability.articulated_passive_goal_input_c":((p("measured","ArticulatedSolvingFactsC"),),"ArticulatedPassiveGoalInputC"),
        "capability.articulated_transition_start_c":((p("request","ArticulatedTransitionDomainInputC"),p("measured","ArticulatedTransitionDomainFactsC")),"ArticulatedTransitionSessionC"),
        "capability.articulated_transition_append_c":((p("session","ArticulatedTransitionSessionC"),p("question","ArticulatedTransitionQuestionC"),p("returned","MechanicalNormalizedReturn")),"ArticulatedTransitionSessionC"),
        "capability.articulated_transition_parent_measure_c":((p("returned","ArticulatedSolvingReturnC"),),"ArticulatedTransitionParentFactsC"),
        "capability.articulated_transition_parent_input_c":((p("returned","ArticulatedSolvingReturnC"),),"ArticulatedTransitionDomainInputC"),
        "capability.articulated_transition_parent_seal_c":((p("returned","ArticulatedSolvingReturnC"),p("measured","ArticulatedTransitionParentFactsC"),p("session","Any")),"ArticulatedSolvingReturnC"),
        "capability.articulated_dependency_input_c":((p("returned","ArticulatedSolvingReturnC"),),"ArticulatedDependencyInputC"),
        "capability.articulated_dependency_measure_c":((p("returned","ArticulatedSolvingReturnC"),),"ArticulatedDependencyRowsC"),
        "capability.articulated_dependency_start_c":((p("returned","ArticulatedSolvingReturnC"),),"ArticulatedDependencyRowsC"),
        "capability.articulated_dependency_append_c":((p("prior","ArticulatedDependencyRowsC"),p("row","Any"),p("meaning","DeclaredMeaningInstantiation")),"ArticulatedDependencyRowsC"),
        "capability.articulated_dependency_seal_c":((p("returned","ArticulatedSolvingReturnC"),p("measured","ArticulatedDependencyRowsC"),p("interpreted","ArticulatedDependencyRowsC")),"ArticulatedSolvingReturnC"),
        "capability.articulated_prefix_measure_c":((p("returned","ArticulatedSolvingReturnC"),),"ArticulatedDependencyRowsC"),
        "capability.articulated_prefix_append_c":((p("prior","ArticulatedDependencyRowsC"),p("row","Any"),p("meaning","DeclaredMeaningInstantiation")),"ArticulatedDependencyRowsC"),
        "capability.articulated_prefix_seal_c":((p("returned","ArticulatedSolvingReturnC"),p("measured","ArticulatedDependencyRowsC"),p("interpreted","ArticulatedDependencyRowsC")),"ArticulatedSolvingReturnC"),
        "capability.articulated_acquisition_append_c":((p("prior","ArticulatedAcquisitionReturnC"),p("item","Any"),p("decoded","Any"),p("owner","Any")),"ArticulatedAcquisitionReturnC"),
        "capability.articulated_acquisition_join_c":((p("publication","ArticulatedGeometryPublicationReturnC"),p("acquisition","ArticulatedAcquisitionReturnC")),"ArticulatedGeometryPublicationReturnC"),
        "capability.articulated_dynamic_requested_c":((p("returned","ArticulatedSolvingReturnC"),),"ArticulatedTransitionParentFactsC"),
        "capability.articulated_dynamic_initialize_c":((p("returned","ArticulatedSolvingReturnC"),),"ArticulatedDynamicSessionC"),
        "capability.articulated_dynamic_recalculate_c":((p("session","ArticulatedDynamicSessionC"),),"ArticulatedDynamicSessionC"),
        "capability.articulated_dynamic_next_c":((p("session","ArticulatedDynamicSessionC"),p("needed","Any")),"ArticulatedDynamicNextC"),
        "capability.articulated_dynamic_bind_c":((p("session","ArticulatedDynamicSessionC"),p("next_request","ArticulatedDynamicNextC"),p("qualified","ArticulatedTransitionDomainFactsC")),"ArticulatedDynamicBoundC"),
        "capability.articulated_dynamic_append_c":((p("session","ArticulatedDynamicSessionC"),p("bound","ArticulatedDynamicBoundC"),p("native_return","Any")),"ArticulatedDynamicSessionC"),
        "capability.articulated_dynamic_seal_c":((p("session","ArticulatedDynamicSessionC"),),"ArticulatedSolvingReturnC"),
        "capability.articulated_dynamic_closure_c":((p("session","ArticulatedDynamicSessionC"),),"CommonSignatureFactsC"),
        "capability.articulated_dynamic_close_c":((p("session","ArticulatedDynamicSessionC"),),"ArticulatedDynamicSessionC"),
        "capability.articulated_pose_question_rows_c":((p("measured","ArticulatedSolvingFactsC"),),"ArticulatedPassiveGoalRowsC"),
        "capability.articulated_pose_question_attach_c":((p("measured","ArticulatedSolvingFactsC"),p("rows","ArticulatedPassiveGoalRowsC"),p("meanings","List<Any>")),"ArticulatedSolvingFactsC"),
        "capability.articulated_restoration_target_rows_c":((p("measured","ArticulatedSolvingFactsC"),),"ArticulatedPassiveGoalRowsC"),
        "capability.articulated_restoration_target_attach_c":((p("measured","ArticulatedSolvingFactsC"),p("rows","ArticulatedPassiveGoalRowsC"),p("meanings","List<Any>")),"ArticulatedSolvingFactsC")}
