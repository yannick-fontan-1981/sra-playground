"""Reuse the existing contour/order measurement and preserve its incompleteness."""
from .relief_supposition_contracts_c import (ReliefSuppositionInputC, ReliefSuppositionFactsC,
    ReliefSuppositionDecisionInputC, ReliefSuppositionDecisionC)
from .structural_supposition_c import _scope_current
from .layered_relief import measure_truncated_relief_request
from agents.yf_arc3_v5.logos.types import FrozenMap


def measure_relief_supposition(value: ReliefSuppositionInputC) -> ReliefSuppositionFactsC:
    refs = tuple(layer.layer_ref for layer in value.measurement.layers)
    cells = sum(len(layer.visible_cells)+len(layer.reconstructed_cells) for layer in value.measurement.layers)
    completed = all(ref in value.layer_completion_evidence_by_ref
        and isinstance(value.layer_completion_evidence_by_ref[ref], FrozenMap)
        and value.layer_completion_evidence_by_ref[ref].get("epoch") == value.scope.epoch
        and value.layer_completion_evidence_by_ref[ref].get("revision_ref") == value.scope.revision_ref
        and value.layer_completion_evidence_by_ref[ref].get("scope_ref") == value.scope.scope_ref
        and bool(value.layer_completion_evidence_by_ref[ref].get("evidence_refs")) for ref in refs)
    current = _scope_current(value.scope)
    unique = len(set(refs)) == len(refs)
    bounded = cells > value.max_input_cells
    measured, missing = None, []
    if not current:
        missing.append("current_relief_consumer_scope")
    if not completed:
        missing.append("independent_layer_completion_support")
    if not unique:
        missing.append("unique_layer_identity")
    if bounded:
        missing.append("input_cell_bound")
    if current and completed and unique and not bounded:
        measured = measure_truncated_relief_request(value.measurement)
    # The legacy helper stops collecting relations at its cap. Its order
    # witnesses cannot close the relation domain merely because an order exists.
    relation_domain_open = measured is not None and len(measured.relations) >= value.measurement.maximum_relations
    order_domain_open = measured is not None and measured.order_enumeration_truncated
    return ReliefSuppositionFactsC(measured=measured, missing_refs=tuple(missing),
        actual_input_cell_visits=cells if measured is not None else 0,
        facts=FrozenMap({"scope_current": current, "completion_support_current": completed,
            "unique_layer_refs": unique, "budget_reached": bounded,
            "separated_reference_supported": bool(value.separated_reference_evidence_refs),
            "mutable_surface_supported": bool(value.mutable_surface_evidence_refs),
            "homologous_surface_supported": bool(value.homologous_surface_evidence_refs),
            "measured_occlusion_relations_present": measured is not None and bool(measured.relations),
            "layer_order_candidates_present": measured is not None and bool(measured.order_candidates),
            "relation_domain_open": relation_domain_open, "order_domain_open": order_domain_open,
            "cycle_detected": measured is not None and measured.cycle_detected,
            "physical_depth_from_relief": False, "missing_measurement": bool(missing)}))


def assemble_relief_supposition(value: ReliefSuppositionDecisionInputC) -> ReliefSuppositionDecisionC:
    return ReliefSuppositionDecisionC(frozen_request=value.request, frozen_measurement=value.measured,
        source_disposition_ref=value.source_disposition_ref, source_policy_ref=value.source_policy_ref)
