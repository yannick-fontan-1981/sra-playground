"""Five checkpoint questions; exact request scope and proofs remain frozen."""
from .checkpoint_supposition_contracts_c import (CadencedRailSuppositionInputC, FixedOriginSuppositionInputC, ChartedRoomSuppositionInputC, GravityAdhesionSuppositionInputC, TopologicalRecolorSuppositionInputC,
    CheckpointSuppositionFactsC, CheckpointSuppositionDecisionInputC, CheckpointSuppositionDecisionC)
from .checkpoint_supposition_c import (measure_cadenced_rail_supposition, measure_fixed_origin_supposition, measure_charted_room_supposition, measure_gravity_adhesion_supposition, measure_topological_recolor_supposition, assemble_checkpoint_supposition)

CHECKPOINT_SUPPOSITION_C_TYPES = ("RailBayAssignmentC", "CadencedRailSuppositionInputC", "FixedOriginSuppositionInputC", "ChartObjectEvidenceC", "RoomTransitionExampleC", "ChartedRoomSuppositionInputC", "AdhesionAssignmentC", "GravityAdhesionSuppositionInputC", "TopologicalRecolorSuppositionInputC", "CheckpointSuppositionFactsC", "CheckpointSuppositionDecisionInputC", "CheckpointSuppositionDecisionC")
CHECKPOINT_ROWS_C = (
    ("capability.cadenced_rail_supposition_facts_c", measure_cadenced_rail_supposition, CadencedRailSuppositionInputC),
    ("capability.fixed_origin_supposition_facts_c", measure_fixed_origin_supposition, FixedOriginSuppositionInputC),
    ("capability.charted_room_supposition_facts_c", measure_charted_room_supposition, ChartedRoomSuppositionInputC),
    ("capability.gravity_adhesion_supposition_facts_c", measure_gravity_adhesion_supposition, GravityAdhesionSuppositionInputC),
    ("capability.topological_recolor_supposition_facts_c", measure_topological_recolor_supposition, TopologicalRecolorSuppositionInputC),
)


def checkpoint_supposition_entries_c(entry_factory):
    rows = tuple((ref, method, before, CheckpointSuppositionFactsC) for ref, method, before in CHECKPOINT_ROWS_C)
    rows += (("capability.checkpoint_supposition_assembly_c", assemble_checkpoint_supposition,
        CheckpointSuppositionDecisionInputC, CheckpointSuppositionDecisionC),)
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=before, output_model=after,
        source_file="checkpoint_supposition_c.py", applicability=("current_consumer_and_explicit_checkpoint_evidence",),
        invariants=("existing_mask_and_ordinal_methods", "full_requested_scope", "known_false_and_unknown_distinct",
            "no_new_physics_or_route", "no_act_or_confirmed_terminal"),
        falsifiers=("foreign_scope_or_semantics", "unqualified_identity", "incomplete_checkpoint_or_inventory"))
        for ref, method, before, after in rows)


def checkpoint_supposition_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    result = {ref: ((parameter("request", before.__name__),), "CheckpointSuppositionFactsC")
        for ref, _, before in CHECKPOINT_ROWS_C}
    result["capability.checkpoint_supposition_assembly_c"] = ((parameter("request", "Any"),
        parameter("measured", "CheckpointSuppositionFactsC"), parameter("source_disposition_ref", "Any"),
        parameter("source_policy_ref", "String")), "CheckpointSuppositionDecisionC")
    return result
