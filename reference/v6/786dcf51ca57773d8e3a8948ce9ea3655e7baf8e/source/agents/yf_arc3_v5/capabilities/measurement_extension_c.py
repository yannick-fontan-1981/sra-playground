"""Scoped agenda comparison and reducers; Source chooses whether to add a demand."""
from .measurement_extension_contracts_c import (MeasurementExtensionInputC, MeasurementExtensionFactsC,
    MeasurementExtensionDecisionInputC, MeasurementExtensionDecisionC)
from .family_agenda_projection import demand_signature, project_family_agenda
from agents.yf_arc3_v5.logos.types import FrozenMap


def measure_measurement_extension(value: MeasurementExtensionInputC) -> MeasurementExtensionFactsC:
    agenda, demand = value.agenda, value.exact_demand
    signature = demand_signature(demand)
    projection = project_family_agenda(agenda)
    rows = projection["rows"]
    equivalent = tuple(row["demand"]["request"]["request_ref"] for row in rows
        if row["signature_ref"] == signature and row["owner_current"] and row["current_inputs_bound"])
    collisions = tuple(existing.request.request_ref for existing in agenda.demands
        if existing.request.request_ref == demand.request.request_ref
        and demand_signature(existing) != signature)
    owner_current = (demand.parent_goal_ref == agenda.parent_goal_ref and demand.request.epoch == agenda.epoch
        and demand.episode_ref == agenda.episode_ref and demand.level_scope_ref == agenda.level_scope_ref
        and demand.scope_ref == value.current_scope_ref)
    current_inputs = (demand.request.input_revision_ref == value.current_input_revision_ref
        and not set(demand.dependency_revisions).intersection(agenda.invalidated_dependency_refs)
        and all(key in agenda.current_dependency_revisions
            and demand.dependency_revisions[key] == agenda.current_dependency_revisions[key]
            for key in sorted(demand.dependency_revisions)))
    consumer_current = (demand.consumer_ref == value.current_consumer_ref
        and bool(value.current_consumer_evidence_refs) and value.necessary_for_consumer)
    premise_current = (value.premise_epoch == agenda.epoch
        and value.premise_revision_ref == value.current_input_revision_ref
        and value.premise_scope_ref == value.current_scope_ref and bool(value.premise_evidence_refs))
    return MeasurementExtensionFactsC(exact_signature_ref=signature,
        equivalent_current_request_refs=equivalent, conflicting_request_refs=collisions,
        current_agenda_projection=projection,
        facts=FrozenMap({"owner_current": owner_current, "inputs_current": current_inputs,
            "consumer_current": consumer_current, "premise_current": premise_current,
            "premise_revisable_or_supported": value.premise_status in ("PROVISIONAL", "SUPPORTED"),
            "request_identity_collision": bool(collisions), "equivalent_current_request_present": bool(equivalent),
            "agenda_capacity_available": len(agenda.demands) < 128,
            "generic_geometry_dependency_present": value.generic_geometry_request_ref is not None}))


def assemble_measurement_extension(value: MeasurementExtensionDecisionInputC) -> MeasurementExtensionDecisionC:
    request, measured = value.request, value.measured
    agenda, active = request.agenda, ()
    if value.source_disposition_ref == "measurement_extension.append_exact_request":
        agenda = agenda.model_copy(update={"demands": (*agenda.demands, request.exact_demand)})
        active = (request.exact_demand.request.request_ref,)
    elif value.source_disposition_ref == "measurement_extension.reuse_existing_request":
        active = measured.equivalent_current_request_refs
    return MeasurementExtensionDecisionC(source_disposition_ref=value.source_disposition_ref,
        source_policy_ref=value.source_policy_ref, frozen_request=request, frozen_measurement=measured,
        proposed_agenda=agenda, active_request_refs=active, retained_exact_demand=request.exact_demand)
