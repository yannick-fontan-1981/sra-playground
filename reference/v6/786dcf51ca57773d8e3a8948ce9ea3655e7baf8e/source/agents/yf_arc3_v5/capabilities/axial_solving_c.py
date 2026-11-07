"""Exact Source joins over K71 evidence; no field dynamics or route search."""
from agents.yf_arc3_v5.logos.types import FrozenMap, immutable_json_data, stable_digest
from .axial_field_configuration import AxialFieldRequest
from .axial_route_a import AxialRouteInputA
from pydantic import ValidationError
from .mechanical_profile_d import measure_d_native_profile
from .mechanical_family_contracts_d import d_map
from .family_agenda_projection import project_family_agenda, demand_signature, FamilyAgendaReceipt
from .axial_solving_contracts_c import AxialSolvingFactsC, AxialSolvingReturnC

def measure_axial_solving(request, canonical_rows):
    profile, agenda, demand = request.profile, request.agenda, request.demand
    native = profile.native_request
    missing, reasons = [], []
    if not isinstance(native, AxialFieldRequest):
        return AxialSolvingFactsC(frozen_input=request, facts=FrozenMap({"current_axial_question": False}),
            service_reasons=(), missing_refs=("exact_current_K71_profile",))
    missing.extend(measure_d_native_profile(profile).missing_refs)
    if (profile.profile_ref != "solving.axial_field_configuration" or demand.request != profile.common_identity
            or demand not in agenda.demands or demand.parent_goal_ref != profile.parent_goal_ref
            or demand.consumer_ref != native.scope.parent_consumer_ref or demand.scope_ref != profile.scope_ref
            or demand.episode_ref != profile.episode_ref or demand.level_scope_ref != profile.level_scope_ref):
        missing.append("exact_current_axial_parent_demand")
    if (len(canonical_rows) != 1 or canonical_rows[0].get("family_agenda") != immutable_json_data(agenda)
            or not canonical_rows[0].get("supported_agenda_claim_refs")):
        missing.append("canonical_axial_parent_agenda")
    rows = tuple(row for row in project_family_agenda(agenda)["rows"]
        if row["signature_ref"] == demand_signature(demand)
        and row["demand"]["request"]["request_ref"] == demand.request.request_ref)
    if (len(rows) != 1 or not rows[0]["owner_current"] or not rows[0]["current_inputs_bound"]
            or not rows[0]["prerequisites_current"] or rows[0]["conflicting_current_returns"]
            or rows[0]["consumed_current_signature"]):
        missing.append("next_prerequisite_satisfied_unconsumed_axial_question")
    if (native.operation_ref, native.mode_ref) not in native.signature_pairs:
        missing.append("registered_exact_axial_operation_mode")
    contract = request.terminal_contract
    targets = FrozenMap({model.model_ref: model.target_cell for model in native.models})
    admissible = FrozenMap({model.model_ref: model.admissible_body_refs for model in native.models})
    if (not native.models or len(targets) != len(native.models) or contract.target_by_model != targets
            or contract.admissible_bodies_by_model != admissible
            or any(model.target_cell is None or model.admissible_body_refs is None
                or model.goal_law_ref != "any_admissible_body_at_target_after_normal_closure" for model in native.models)
            or not contract.quantifier_evidence_refs or not contract.persistence_evidence_refs
            or not contract.event_evidence_refs or not contract.acceptance_evidence_refs
            or contract.event_scope_ref != native.event_scope_ref
            or contract.persistence_scope_ref != profile.temporal_scope_ref
            or contract.evidence_revision_ref != native.scope.evidence_revision_ref
            or profile.desired_future.get("axial_arrival_contract_digest") != stable_digest(immutable_json_data(contract))):
        missing.append("independently_grounded_normal_global_stable_arrival_contract")
    if native.operation_ref == "mechanics.axial_field_configuration.costed_route":
        if request.serving_k03 or native.route_input is None:
            missing.append("explicit_existing_K09_route_request_not_internal_successor_recursion")
        else:
            try:
                route = AxialRouteInputA.model_validate(native.route_input)
            except ValidationError:
                missing.append("typed_current_axial_K09_route_input")
            else:
                query = route.query
                if (query.packet_acceptance_contract_ref != contract.contract_ref
                        or set(query.packet_acceptance_model_refs) != set(targets)
                        or set(query.retained_model_refs) != set(targets)
                        or query.request.immutable_inputs.get("axial_arrival_contract_digest")
                            != stable_digest(immutable_json_data(contract))
                        or any(provider.template.source_goal_acceptance_contract_ref != contract.contract_ref
                            or not provider.template.source_goal_evidence_refs for provider in route.providers)):
                    missing.append("exact_independently_grounded_stable_arrival_query_and_packet_goal")
    work = sum(len(support.preparation_dependency_refs) + len(support.inverse_return.request.native_request.models)
        for support in request.service_supports)
    if work > profile.maximum_binding_checks:
        missing.append("bounded_axial_service_support_preparation")
    else:
        for support in request.service_supports:
            receipt, inverse = support.inverse_return, support.inverse_return.request.native_request
            result = receipt.native_result
            if not isinstance(inverse, AxialFieldRequest):
                missing.append("exact_K71_service_preimage_receipt")
                continue
            if (inverse.operation_ref != "mechanics.axial_field_configuration.service_preimages"
                    or inverse.mode_ref != "INVERSE_DOMAIN" or inverse.state != native.state
                    or inverse.models != native.models or inverse.source_identity_ref != native.source_identity_ref
                    or inverse.event_scope_ref != native.event_scope_ref
                    or inverse.consumer_body_ref != support.consumer_body_ref
                    or receipt.blockers or receipt.result is None or receipt.result.status != "FOUND"
                    or receipt.result.request != receipt.request.common_identity
                    or result is None or result.scope != inverse.scope or result.operation_ref != inverse.operation_ref
                    or result.mode_ref != inverse.mode_ref or result.status != "OK" or not result.domain_complete
                    or any(getattr(inverse.scope, name) != getattr(native.scope, name) for name in (
                        "parent_goal_ref", "parent_consumer_ref", "parent_contribution_ref", "caller_ref",
                        "epoch", "evidence_revision_ref", "model_revision_ref", "model_status_ref", "event_owner_ref"))):
                missing.append("current_complete_same_model_stable_arrival_service_return")
                continue
            correlated = tuple(row for row in result.values.get("model_correlated_results", ())
                if isinstance(row, FrozenMap) and row.get("model_ref") == support.model_ref)
            domain = correlated[0].get("result") if len(correlated) == 1 else None
            services = domain.get("joint_conditional_service_domain") if isinstance(domain, FrozenMap) else None
            if not isinstance(services, tuple) or support.service_row_index >= len(services):
                missing.append("exact_model_correlated_conditional_service_row")
                continue
            service = services[support.service_row_index]
            closure = service.get("closure") if isinstance(service, FrozenMap) else None
            assignment = service.get("conditional_service_assignments") if isinstance(service, FrozenMap) else None
            if (not isinstance(closure, FrozenMap) or closure.get("termination_ref") != "normal_no_admissible_move"
                    or service.get("consumer_stable_arrival") is not True
                    or service.get("preserved_body_constraints_hold") is not True
                    or not isinstance(assignment, tuple)
                    or support.provider_body_ref not in tuple(ref for ref, _ in assignment)
                    or not support.alignment_evidence_refs or not support.polarity_evidence_refs
                    or not support.usefulness_evidence_refs or not support.preparation_dependency_refs
                    or any(ref not in profile.and_dependency_refs for ref in support.preparation_dependency_refs)):
                missing.append("grounded_provider_service_with_explicit_preparation_dependencies")
                continue
            rotation = support.provider_rotation_return
            pivot = rotation.request.native_request
            pivot_result = rotation.native_result
            if (not isinstance(pivot, AxialFieldRequest)
                    or pivot.operation_ref != "mechanics.axial_field_configuration.external_primitive"
                    or pivot.mode_ref != "STEP" or pivot.state != native.state or pivot.models != native.models
                    or pivot.state is None or pivot.state.active_body_ref != support.provider_body_ref
                    or pivot.primitive is None or pivot.primitive.kind_ref != "pivot"
                    or pivot.source_identity_ref != native.source_identity_ref or pivot.event_scope_ref != native.event_scope_ref
                    or rotation.blockers or rotation.result is None or rotation.result.status != "FOUND"
                    or rotation.result.request != rotation.request.common_identity
                    or pivot_result is None or pivot_result.scope != pivot.scope
                    or pivot_result.operation_ref != pivot.operation_ref or pivot_result.mode_ref != pivot.mode_ref
                    or pivot_result.status != "OK" or not pivot_result.domain_complete
                    or any(getattr(pivot.scope, name) != getattr(native.scope, name) for name in (
                        "parent_goal_ref", "parent_consumer_ref", "parent_contribution_ref", "caller_ref",
                        "epoch", "evidence_revision_ref", "model_revision_ref", "model_status_ref", "event_owner_ref"))):
                missing.append("same_current_provider_pivot_complete_native_return")
                continue
            pivots = tuple(row for row in pivot_result.values.get("model_correlated_results", ())
                if isinstance(row, FrozenMap) and row.get("model_ref") == support.model_ref)
            effect = pivots[0].get("result") if len(pivots) == 1 else None
            snapshots = effect.get("phase_snapshots") if isinstance(effect, FrozenMap) else None
            facts = effect.get("closure_facts") if isinstance(effect, FrozenMap) else None
            ledger = effect.get("event_ledger") if isinstance(effect, FrozenMap) else None
            if (not isinstance(snapshots, FrozenMap) or snapshots.get("before") != d_map(native.state)
                    or snapshots.get("after_direct") != service.get("context_state")
                    or not isinstance(facts, FrozenMap) or facts.get("normal_global_closure") is not True
                    or facts.get("physical_cap_rejects_acceptance") is not False
                    or not isinstance(ledger, FrozenMap) or ledger.get("accepted") is not True
                    or ledger.get("automatic_pass_count") != 1):
                missing.append("provider_rotation_really_supplies_stable_service_after_one_closure")
                continue
            reasons.append(FrozenMap({"model_ref": support.model_ref, "provider_body_ref": support.provider_body_ref,
                "consumer_body_ref": support.consumer_body_ref, "conditional_service_assignments": assignment,
                "stable_arrival_service": service, "preparation_dependency_refs": support.preparation_dependency_refs,
                "alignment_evidence_refs": support.alignment_evidence_refs, "polarity_evidence_refs": support.polarity_evidence_refs,
                "contact_stop_evidence_refs": support.contact_stop_evidence_refs,
                "deactivation_evidence_refs": support.deactivation_evidence_refs,
                "complete_provider_rotation": effect,
                "conditional_context_is_not_preparation_route": True, "selected_body_is_not_assumed_winner": True}))
    if request.service_supports and {reason["model_ref"] for reason in reasons} != set(targets):
        missing.append("provider_service_support_covers_all_unrejected_models")
    return AxialSolvingFactsC(frozen_input=request, facts=FrozenMap({"current_axial_question": not bool(missing)}),
        service_reasons=tuple(reasons), missing_refs=tuple(sorted(set(missing))))

def bind_axial_solving(value):
    return value.measured.frozen_input.profile

def finish_axial_solving(value):
    request = value.measured.frozen_input
    returned, receipt = value.profile_return, FrozenMap()
    if (returned is not None and returned.request == request.profile and returned.result is not None
            and returned.result.request == request.demand.request and not value.measured.missing_refs):
        receipt = immutable_json_data(FamilyAgendaReceipt(
            receipt_ref="receipt.axial_solving." + stable_digest((request.demand, returned.result)),
            demand=request.demand, result=returned.result))
    return AxialSolvingReturnC(frozen_measurement=value.measured, profile_return=returned,
        receipt=receipt, next_item_ref=request.profile.next_item_ref, sibling_item_refs=request.profile.sibling_item_refs)
