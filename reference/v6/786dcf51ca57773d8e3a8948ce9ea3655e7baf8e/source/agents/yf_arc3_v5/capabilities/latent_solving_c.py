"""K41 parent transport and existing collector composition, with no action release."""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data,stable_digest
from .latent_reference_restoration import OPERATION_MODES
from .latent_solving_contracts_c import LatentSolvingFactsC,LatentSolvingReturnC,LatentJoinFactsC
from .mechanical_return_a import mechanical_request_identity_a
from .family_agenda_projection import project_family_agenda,demand_signature,FamilyAgendaReceipt
from .mechanical_family_contracts_a import MechanicalFamilyResult


def measure_latent_solving(request,agenda_rows,reasons,missing_refs):
    native,why,demand=request.native_request,request.why,request.demand
    missing=list(missing_refs)
    identity=mechanical_request_identity_a(native,"mechanics.latent_reference_restoration",native.scope,native.operation_ref,native.mode)
    if (demand.request!=identity or demand not in request.agenda.demands or native.scope.parent_goal_ref!=why.parent_goal_ref
            or demand.parent_goal_ref!=why.parent_goal_ref or demand.consumer_ref!=why.consumer_ref
            or demand.episode_ref!=why.episode_ref or demand.level_scope_ref!=why.level_scope_ref
            or not why.desired_future or not why.usefulness_premise_refs or not why.morphology_premise_refs
            or not why.falsifier_ref):missing.append("latent.exact_goal_owned_question_and_why")
    if (len(agenda_rows)!=1 or agenda_rows[0].get("family_agenda")!=immutable_json_data(request.agenda)
            or not agenda_rows[0].get("supported_agenda_claim_refs")):missing.append("latent.current_canonical_agenda")
    rows=tuple(row for row in project_family_agenda(request.agenda)["rows"]
        if row["signature_ref"]==demand_signature(demand) and row["demand"]["request"]["request_ref"]==identity.request_ref)
    if (len(rows)!=1 or not rows[0]["owner_current"] or not rows[0]["current_inputs_bound"]
            or not rows[0]["prerequisites_current"] or rows[0]["conflicting_current_returns"]
            or rows[0]["consumed_current_signature"]):missing.append("latent.next_prerequisite_satisfied_unconsumed_question")
    if native.mode is None or OPERATION_MODES.get(native.operation_ref)!=native.mode:
        missing.append("latent.exact_registered_K41_operation_and_mode")
    if native.state is not None and native.state.level_scope_ref!=why.level_scope_ref:
        missing.append("latent.current_field_level_scope")
    if native.maximum_evaluations>request.parent_maximum_evaluations:
        missing.append("latent.parent_reserves_requested_native_bound")
    return LatentSolvingFactsC(frozen_input=request,facts=FrozenMap({"current_latent_question":not bool(missing)}),
        reasons=(*reasons,FrozenMap({"frozen_why":immutable_json_data(why),"exact_demand":immutable_json_data(demand),
            "unknowns_preserved":True,"uniformity_is_goal":False,"physical_action_release":False})),
        missing_refs=tuple(sorted(set(missing))))


def bind_latent_solving(value):
    if value.measured.missing_refs:raise ValueError("Source must select the information branch before binding K41")
    return value.measured.frozen_input.native_request


def finish_latent_solving(value):
    measured=value.measured
    request=measured.frozen_input
    missing=list(measured.missing_refs)
    result=None
    receipt=FrozenMap()
    if value.returned is not None:
        if value.returned.request!=request.demand.request:missing.append("latent.exact_native_return_identity")
        else:
            try:result=MechanicalFamilyResult.model_validate(value.returned.descriptive_values.get("calculation"))
            except (ValidationError,TypeError,ValueError):missing.append("latent.actual_typed_K41_calculation")
            if result is not None and (result.scope!=request.native_request.scope or result.operation_ref!=request.native_request.operation_ref
                    or result.mode!=request.native_request.mode):
                missing.append("latent.actual_native_scope_operation_mode");result=None
            if result is not None and not missing:
                receipt=immutable_json_data(FamilyAgendaReceipt(receipt_ref="receipt.latent_solving."+stable_digest((request.demand,value.returned)),
                    demand=request.demand,result=value.returned))
                missing.extend(result.prerequisite_refs)
                missing.extend(result.implementation_debt_refs)
                if not result.signature_supported:missing.append("latent.unsupported_native_signature")
    elif not missing:missing.append("latent.requested_K41_result_absent")
    parent=FrozenMap({"parent_goal_ref":request.why.parent_goal_ref,"consumer_ref":request.why.consumer_ref,
        "next_item_ref":request.why.next_item_ref,"frozen_why":immutable_json_data(request.why),
        "exact_demand":immutable_json_data(request.demand),"receipt":receipt,
        "calculation":immutable_json_data(result) if result is not None else None,
        "missing_refs":tuple(sorted(set(missing))),"preservation_refs":request.why.preservation_refs,
        "principal_goal_changed":False,"physical_satisfaction":False,"execution_authority":False})
    return LatentSolvingReturnC(frozen_measurement=measured,returned=value.returned,missing_refs=tuple(sorted(set(missing))),
        receipt=receipt,parent_return=parent,accounted_evaluations=measured.acquisition_work+(result.examined_count if result is not None else 0))


def measure_latent_join(value):
    returned=value.returned
    request=returned.frozen_measurement.frozen_input
    join=request.join_request
    missing=list(returned.missing_refs)
    packet=returned.parent_return.get("calculation")
    if join is not None:
        if (not isinstance(packet,FrozenMap) or packet.get("domain_complete") is not True
                or packet.get("signature_supported") is not True or packet.get("computation_bound_reached") is True):
            missing.append("latent.complete_supported_native_domain_for_composition")
        own=tuple(candidate for group in join.groups for candidate in group.candidates
            if candidate.result.request==request.demand.request)
        if (returned.returned is None or returned.returned.status!="FOUND" or join.parent_goal_ref!=request.why.parent_goal_ref
                or join.epoch!=request.native_request.scope.epoch or join.episode_ref!=request.why.episode_ref
                or join.level_scope_ref!=request.why.level_scope_ref or len(own)!=1 or own[0].result!=returned.returned
                or not set(request.why.preservation_refs)<=set(own[0].preservation_refs)
                or own[0].rationale.get("desired_predicate")!=request.why.desired_future
                or own[0].rationale.get("consumer_ref")!=request.why.consumer_ref
                or own[0].rationale.get("and_dependency_refs")!=request.why.and_dependency_refs
                or own[0].rationale.get("or_dependency_refs")!=request.why.or_dependency_refs
                or own[0].rationale.get("falsifier_ref")!=request.why.falsifier_ref):
            missing.append("latent.exact_current_complete_composition_question")
    return LatentJoinFactsC(facts=FrozenMap({"join_bound":join is not None and not bool(missing)}),missing_refs=tuple(sorted(set(missing))))


def get_latent_join(value):return value.returned.frozen_measurement.frozen_input.join_request


def finish_latent_join(value):
    missing=list((*value.returned.missing_refs,*value.measured.missing_refs))
    joined=value.joined
    if joined is not None and joined.request!=value.returned.frozen_measurement.frozen_input.join_request:
        missing.append("latent.exact_current_join_return");joined=None
    parent=FrozenMap({**dict(value.returned.parent_return),"joined":immutable_json_data(joined) if joined is not None else None,
        "missing_refs":tuple(sorted(set(missing))),"execution_authority":False})
    return value.returned.model_copy(update={"joined":joined,"missing_refs":tuple(sorted(set(missing))),"parent_return":parent})
