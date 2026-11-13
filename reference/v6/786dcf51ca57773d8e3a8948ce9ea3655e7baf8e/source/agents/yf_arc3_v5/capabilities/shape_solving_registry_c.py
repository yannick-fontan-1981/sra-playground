"""K26 Source strategy ports; native physics remains in the shared registry."""
from .shape_solving_contracts_c import (ShapeSolvingBindInputC,ShapeSolvingFinishInputC,ShapeSolvingReturnC,
    ShapeBindingBlockedInputC,ShapeSolvingFactsC)
from .contact_shape_repair import ShapeRequest
from .shape_solving_c import bind_shape_solving,finish_shape_solving,blocked_shape_publication
from .shape_solving_c import measure_shape_join,get_shape_join,return_shape_join
from .shape_solving_contracts_c import ShapeJoinInputC,ShapeJoinFactsC,ShapeJoinReturnInputC
from .family_result_join import FamilyJoinRequest

SHAPE_SOLVING_C_TYPES = ("ShapeObservedCellC","ShapeObservedSegmentC","ShapeObservedObjectC","ShapeObservedGeometryPlanC","ShapeObservedPopulationC","ShapeObservedPlanSourceC",
    "ShapeCoreRoleBindingC","ShapeAssociationDestinationC","ShapeAssociationAcquisitionC","ShapeGeometryAcquisitionC",
    "ShapeGoalContractC","ShapeCanonicalBindingC","ShapeReasonGroundC","ShapeReasonReceiptC","ShapeContactReasonC","ShapeInvariantReasonC","ShapeTransitSupportC",
    "ShapeReassignmentSupportC","ShapeLoopSupportC","ShapeObservabilityC","ShapeSolvingInputC","ShapeSolvingFactsC",
    "ShapeSolvingBindInputC","ShapeSolvingFinishInputC","ShapeSolvingReturnC","ShapeBindingPublicationC",
    "ShapeBindingReturnC","ShapeBindingBlockedInputC","ShapeJoinSupportC","ShapeJoinInputC","ShapeJoinFactsC","ShapeJoinReturnInputC",
    "ShapeRetainedGeometryInputC","ShapeRetainedGeometryFactsC","ShapeGeometryRetentionC",
    "ShapeRetentionParentFactsC","ShapeRetentionAttachInputC","ShapeConditionalInputC","ShapeConditionalFactsC","ShapeConditionalReturnC")
SHAPE_SOLVING_C_ENTRIES = (
    ("capability.shape_solving_native_c",bind_shape_solving,ShapeSolvingBindInputC,ShapeRequest),
    ("capability.shape_solving_return_c",finish_shape_solving,ShapeSolvingFinishInputC,ShapeSolvingReturnC),
    ("capability.shape_binding_blocked_c",blocked_shape_publication,ShapeBindingBlockedInputC,ShapeSolvingFactsC),
    ("capability.shape_join_measure_c",measure_shape_join,ShapeJoinInputC,ShapeJoinFactsC),
    ("capability.shape_join_input_c",get_shape_join,ShapeJoinInputC,FamilyJoinRequest),
    ("capability.shape_join_return_c",return_shape_join,ShapeJoinReturnInputC,ShapeSolvingReturnC))

def shape_solving_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref,implementation=method,input_model=inputs,output_model=outputs,
        source_file=method.__module__.rsplit(".",1)[-1]+".py",applicability=("goal_owned_complete_contour",),
        invariants=("current_parent","internal_geometry","same_K26","explicit_restoration","no_act"),
        falsifiers=("stale_source","bbox_as_shape","clipping_as_deletion","missing_restoration"))
        for ref,method,inputs,outputs in SHAPE_SOLVING_C_ENTRIES)

def shape_solving_signatures_c(type_spec,parameter_spec):
    def p(name,kind):
        return parameter_spec(name=name,type_spec=type_spec(kind))
    return {"capability.shape_solving_native_c":((p("measured","ShapeSolvingFactsC"),),"ShapeRequest"),
        "capability.shape_solving_return_c":((p("measured","ShapeSolvingFactsC"),p("returned","Any")),"ShapeSolvingReturnC"),
        "capability.shape_binding_blocked_c":((p("returned","ShapeBindingReturnC"),),"ShapeSolvingFactsC"),
        "capability.shape_join_measure_c":((p("returned","ShapeSolvingReturnC"),),"ShapeJoinFactsC"),
        "capability.shape_join_input_c":((p("returned","ShapeSolvingReturnC"),),"FamilyJoinRequest"),
        "capability.shape_join_return_c":((p("returned","ShapeSolvingReturnC"),p("joined","FamilyJoinResult")),"ShapeSolvingReturnC")}
