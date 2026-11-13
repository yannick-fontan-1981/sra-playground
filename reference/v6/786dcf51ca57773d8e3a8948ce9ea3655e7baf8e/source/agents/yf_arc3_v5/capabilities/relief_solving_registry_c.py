"""Typed K21 Source ports; native helpers and common return transport reused."""
from .relief_solving_contracts_c import (ReliefSolvingBindInputC, ReliefSolvingFinishInputC,
    ReliefSolvingReturnC, ReliefMechanicalReturnInputC, ReliefJoinFactsC, ReliefJoinInputC, ReliefJoinReturnInputC)
from .relief_solving_c import bind_relief_solving_native, finish_relief_solving, measure_relief_join, get_relief_join, return_relief_join
from .family_result_join import FamilyJoinRequest
from .ordered_relief_writing import ReliefRequest, measure_ordered_relief_writing
from .mechanical_family_contracts_a import (MechanicalFamilyResult, MechanicalSignatureFacts,
    project_requested_signature, reject_requested_signature)
from .mechanical_return_a import assemble_mechanical_response_a
from .mechanical_request_contracts import MechanicalResponseInput

RELIEF_FRONTIER_C_TYPES=('ReliefFrontierFieldC','ReliefObservedFacetC','ReliefFrontierInputC',
    'ReliefFrontierFactsC','ReliefFrontierCalculationC','ReliefFrontierReturnC','ReliefFrontierInterpretationC',
    'ReliefFrontierPublicationC','ReliefFrontierPublicationJoinC','ReliefFrontierAgendaInputC','ReliefFrontierAgendaRequestC')

RELIEF_SOLVING_C_TYPES = ("ReliefReferenceContractC", "ReliefContributionSupportC", "ReliefSolvingInputC",
    "ReliefSolvingFactsC", "ReliefSolvingBindInputC", "ReliefSolvingFinishInputC", "ReliefSolvingReturnC",
    "ReliefMechanicalReturnInputC", "ReliefSurface", "ReliefWrite", "ReliefLayer", "ReliefMaskEvidence",
    "ReliefStep", "ReliefCandidate", "ReliefContinuation", "ReliefRequest",
    "ReliefJoinFactsC", "ReliefJoinInputC", "ReliefJoinReturnInputC",*RELIEF_FRONTIER_C_TYPES)
RELIEF_SOLVING_C_ENTRIES = (
    ("capability.relief_solving_native_c", bind_relief_solving_native, ReliefSolvingBindInputC, ReliefRequest),
    ("capability.relief_solving_return_c", finish_relief_solving, ReliefSolvingFinishInputC, ReliefSolvingReturnC),
    ("capability.relief_solving_join_measure_c", measure_relief_join, ReliefJoinInputC, ReliefJoinFactsC),
    ("capability.relief_solving_join_input_c", get_relief_join, ReliefJoinInputC, FamilyJoinRequest),
    ("capability.relief_solving_join_return_c", return_relief_join, ReliefJoinReturnInputC, ReliefSolvingReturnC))
RELIEF_NATIVE_C_ENTRIES = (
    ("capability.ordered_relief_writing_signature_projection", project_requested_signature, ReliefRequest, MechanicalSignatureFacts),
    ("capability.ordered_relief_writing_signature_rejection", reject_requested_signature, ReliefRequest, MechanicalFamilyResult),
    ("capability.ordered_relief_writing_calculation", measure_ordered_relief_writing, ReliefRequest, MechanicalFamilyResult),
    ("capability.ordered_relief_writing_return_packet", assemble_mechanical_response_a, ReliefMechanicalReturnInputC, MechanicalResponseInput))

def relief_solving_entries_c(entry_factory):
    from .relief_frontier_registry_c import relief_frontier_entries_c
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file=method.__module__.rsplit(".",1)[-1]+".py",
        applicability=("current_ordered_paint_question",), invariants=("current_canvas", "future_cover",
            "real_pose_graph", "same_K21", "parent_why", "no_act"),
        falsifiers=("wrong_native_receipt", "incorrect_exposed_contribution", "unfunded_plan"))
        for ref, method, inputs, outputs in RELIEF_SOLVING_C_ENTRIES)+relief_frontier_entries_c(entry_factory)

def relief_native_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file=method.__module__.rsplit(".",1)[-1]+".py",
        applicability=("exact_K21_operation",), invariants=("native_helpers_unchanged", "common_return_unchanged"),
        falsifiers=("wrong_kernel_ref",)) for ref, method, inputs, outputs in RELIEF_NATIVE_C_ENTRIES)

def relief_solving_signatures_c(type_spec, parameter_spec):
    from .relief_frontier_registry_c import relief_frontier_signatures_c
    def p(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    result={}
    result["capability.relief_solving_native_c"]=((p("measured","ReliefSolvingFactsC"),),"ReliefRequest")
    result["capability.relief_solving_return_c"]=((p("measured","ReliefSolvingFactsC"),
        p("returned","Any")),"ReliefSolvingReturnC")
    result["capability.relief_solving_join_measure_c"]=((p("returned","ReliefSolvingReturnC"),),"ReliefJoinFactsC")
    result["capability.relief_solving_join_input_c"]=((p("returned","ReliefSolvingReturnC"),),"FamilyJoinRequest")
    result["capability.relief_solving_join_return_c"]=((p("returned","ReliefSolvingReturnC"),p("joined","FamilyJoinResult")),"ReliefSolvingReturnC")
    result.update(relief_frontier_signatures_c(type_spec,parameter_spec))
    return result
