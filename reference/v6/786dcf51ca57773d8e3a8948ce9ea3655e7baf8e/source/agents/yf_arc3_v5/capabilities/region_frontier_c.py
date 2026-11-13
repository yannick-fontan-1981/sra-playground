"""Exact layer, visibility and first-seen comparisons; Source owns map binding."""
from .region_frontier_contracts_c import (RegionFrontierInputC, RegionFrontierFactsC,
    RegionDecisionInputC, RegionDecisionC)
from agents.yf_arc3_v5.logos.types import FrozenMap


def measure_region_frontier(value: RegionFrontierInputC) -> RegionFrontierFactsC:
    current, recalled = value.current, value.recalled
    current_fence = (current.actual_sealed_observation and current.epoch == value.current_epoch
        and current.sealed_frame_sequence <= value.current_frame_sequence
        and current.evidence_revision_ref == value.current_evidence_revision_ref)
    recalled_fence = recalled is not None and recalled.actual_sealed_observation and (
        recalled.epoch < value.current_epoch or (recalled.epoch == value.current_epoch
            and recalled.sealed_frame_sequence <= value.current_frame_sequence))
    indicators_present = recalled is not None and bool(current.identity_indicators) and bool(recalled.identity_indicators)
    current_unique = len({cell.cell_ref for cell in current.cells}) == len(current.cells)
    recalled_unique = recalled is None or len({cell.cell_ref for cell in recalled.cells}) == len(recalled.cells)
    return RegionFrontierFactsC(
        admissible_current_cell_refs=tuple(cell.cell_ref for cell in current.cells if cell.actual_visible)
            if current_fence and current_unique else (),
        admissible_recalled_cell_refs=tuple(cell.cell_ref for cell in recalled.cells if cell.actual_visible)
            if recalled_fence and recalled_unique else (),
        retained_region_refs=tuple(dict.fromkeys((current.region_ref,
            *((recalled.region_ref,) if recalled is not None else ())))),
        facts=FrozenMap({"current_observation_fenced": current_fence,
            "recalled_observation_fenced": recalled_fence,
            "current_binding_evidenced": bool(value.current_binding_evidence_refs),
            "current_cell_identity_unique": current_unique,
            "recalled_cell_identity_unique": recalled_unique,
            "identity_indicators_present": indicators_present,
            "identity_indicators_equal": indicators_present and current.identity_indicators == recalled.identity_indicators,
            "explicit_layers_present": recalled is not None and current.layer_ref is not None and recalled.layer_ref is not None,
            "explicit_layers_equal": recalled is not None and current.layer_ref == recalled.layer_ref,
            "image_equal": recalled is not None and current.image_signature_ref == recalled.image_signature_ref,
            "necessary_unknown_region": value.necessary_unknown_region,
            "supported_reveal_present": value.reveal_operation_ref is not None,
            "bounded_local_candidate_present": value.local_sensing_ref is not None or value.traversability_probe_ref is not None,
            "return_route_present": value.return_route_ref is not None,
            "protected_conditions_current": value.protected_conditions_current,
            "recovery_inclusive_budget_fits": value.actual_costs_known
                and value.probe_cost+value.recovery_cost <= value.remaining_resource_budget}))


def assemble_region_decision(value: RegionDecisionInputC) -> RegionDecisionC:
    request, measured = value.request, value.measured
    current, recalled = request.current, request.recalled
    records = {cell.cell_ref: cell for cell in current.cells if cell.cell_ref in measured.admissible_current_cell_refs}
    # A reducer for the explicit Source disposition. An equal raster cannot
    # silently switch this branch or restore inventories/palettes/openings.
    if value.source_binding_disposition_ref == "region.merge_observed_geometry" and recalled is not None:
        records = {cell.cell_ref: cell for cell in recalled.cells
            if cell.cell_ref in measured.admissible_recalled_cell_refs} | records
    current_write_permitted = value.source_binding_disposition_ref != "region.archive_unqualified_current_facet"
    return RegionDecisionC(source_disposition_ref=value.source_disposition_ref,
        source_binding_disposition_ref=value.source_binding_disposition_ref,
        frozen_request=request, frozen_measurement=measured,
        binding_policy_ref=value.binding_policy_ref, frontier_policy_ref=value.frontier_policy_ref,
        parent_goal_ref=request.parent_goal_ref, useful_question_ref=request.useful_question_ref,
        current_facet=current, geometry_records=tuple(records[key] for key in sorted(records)),
        retained_recalled_facet=recalled,
        current_dynamic_state=current.dynamic_state if current_write_permitted else FrozenMap(),
        current_write_permitted=current_write_permitted,
        current_geometry_provenance_ref=current.observation_ref,
        recalled_geometry_provenance_ref=recalled.observation_ref if recalled else None,
        retained_region_refs=measured.retained_region_refs,
        local_experiment_refs=tuple(ref for ref in (request.local_sensing_ref, request.traversability_probe_ref)
            if ref is not None),
        eligible_local_experiment_refs=tuple(ref for ref in (request.local_sensing_ref, request.traversability_probe_ref)
            if ref is not None) if value.source_disposition_ref == "region.retain_bounded_local_experiments" else ())
