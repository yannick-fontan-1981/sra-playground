"""K73 Source reasons from native first-hit facts; no ray simulation or control choice."""
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest, immutable_json_data
from .discrete_relay_optics import DiscreteOpticsRequest
from .mechanical_profile_d import measure_d_native_profile
from .family_agenda_projection import project_family_agenda, demand_signature
from .mechanical_family_contracts_d import d_map
from .optical_solving_contracts_c import (OpticalSolvingFactsC, OpticalSolvingBindInputC,
    OpticalSolvingFinishInputC, OpticalSolvingReturnC)
from .optical_route_a import optical_geometry_projection_digest_a

def measure_optical_solving(request, canonical_rows):
    profile, agenda, demand = request.profile, request.agenda, request.demand
    native = profile.native_request
    missing, reasons = [], []
    if not isinstance(native, DiscreteOpticsRequest):
        return OpticalSolvingFactsC(frozen_input=request, facts=FrozenMap({"current_optical_question": False}),
            preparation_reasons=(), missing_refs=("exact_current_K73_profile",))
    closure = measure_d_native_profile(profile)
    missing.extend(closure.missing_refs)
    if (profile.profile_ref != "solving.discrete_relay_optics" or demand.request != profile.common_identity
            or demand not in agenda.demands or demand.parent_goal_ref != profile.parent_goal_ref
            or demand.consumer_ref != native.scope.parent_consumer_ref or demand.scope_ref != profile.scope_ref
            or demand.episode_ref != profile.episode_ref or demand.level_scope_ref != profile.level_scope_ref):
        missing.append("exact_current_optical_parent_demand")
    if (len(canonical_rows) != 1 or canonical_rows[0].get("family_agenda") != immutable_json_data(agenda)
            or not canonical_rows[0].get("supported_agenda_claim_refs")):
        missing.append("canonical_optical_parent_agenda")
    current = tuple(row for row in project_family_agenda(agenda)["rows"]
        if row["signature_ref"] == demand_signature(demand)
        and row["demand"]["request"]["request_ref"] == demand.request.request_ref)
    if (len(current) != 1 or not current[0]["owner_current"] or not current[0]["current_inputs_bound"]
            or not current[0]["prerequisites_current"] or current[0]["conflicting_current_returns"]
            or current[0]["consumed_current_signature"]):
        missing.append("prerequisite_satisfied_unconsumed_optical_question")
    if (native.operation_ref, native.mode_ref) not in native.signature_pairs:
        missing.append("registered_exact_optical_operation_mode")
    contract = request.terminal_contract
    terminals = FrozenMap({model.model_ref: model.terminal_ref for model in native.models})
    required = FrozenMap({model.model_ref: model.required_activation_refs for model in native.models})
    if (not native.models or len(terminals) != len(native.models)
            or any(model.terminal_ref is None or model.required_activation_refs is None for model in native.models)
            or contract.terminal_by_model != terminals or contract.required_activation_by_model != required
            or not contract.quantifier_evidence_refs or not contract.persistence_evidence_refs
            or not contract.event_evidence_refs or not contract.launch_authentication_evidence_refs
            or contract.evidence_revision_ref != native.scope.evidence_revision_ref
            or profile.desired_future.get("optics_terminal_contract_digest") != stable_digest(immutable_json_data(contract))):
        missing.append("independently_grounded_launched_terminal_chain_contract")
    if contract.all_relays_required:
        if not contract.explicit_all_relays_evidence_refs or any(
                set(model.required_activation_refs or ()) != {body.body_ref for body in model.receivers if body.kind_ref == "RELAY"}
                for model in native.models):
            missing.append("explicit_evidence_for_all_relays_obligation")
    elif any(set(model.required_activation_refs or ()) == {body.body_ref for body in model.receivers if body.kind_ref == "RELAY"}
            and bool(model.required_activation_refs) for model in native.models) and not contract.explicit_all_relays_evidence_refs:
        missing.append("all_relays_requirement_needs_independent_goal_or_geometry_evidence")
    if len({row.model_ref for row in request.source_route_witnesses}) != len(request.source_route_witnesses):
        missing.append("one_current_source_route_per_retained_model")
    work = sum(len(route.first_receiver_chain) * (len(request.first_hit_returns) + 1)
        for route in request.source_route_witnesses)
    if work > native.node_bound:
        return OpticalSolvingFactsC(frozen_input=request,
            facts=FrozenMap({"current_optical_question": False}), preparation_reasons=(),
            missing_refs=tuple(sorted(set((*missing, "optical_strategy_preparation_work_bound")))))
    for route in request.source_route_witnesses:
        models = tuple(model for model in native.models if model.model_ref == route.model_ref)
        if len(models) != 1 or not route.current_selection_evidence_refs or native.state is None:
            missing.append("current_supported_optical_route_witness")
            continue
        model = models[0]
        bodies = {body.body_ref: body for body in model.receivers}
        outputs = dict(route.outgoing_directions)
        chain = route.first_receiver_chain
        if (len(outputs) != len(route.outgoing_directions) or chain[-1] != model.terminal_ref
                or len(set(chain)) != len(chain) or any(ref not in bodies for ref in chain)
                or any(bodies[ref].kind_ref != "RELAY" for ref in chain[:-1])
                or bodies[chain[-1]].kind_ref != "TERMINAL"
                or not set(model.required_activation_refs or ()).issubset(chain[:-1])
                or set(outputs) != {model.emitter_ref, *chain[:-1]}
                or outputs.get(model.emitter_ref) != model.emitter_direction_ref):
            missing.append("first_receiver_chain_reaches_exact_required_terminal")
            continue
        service, supported, source = [], True, model.emitter_ref
        for receiver in chain:
            origin = model.emitter_origin if source == model.emitter_ref else bodies[source].center
            hits = []
            for contribution in request.first_hit_returns:
                result, before = contribution.native_result, contribution.request.native_request
                if (result is None or not isinstance(before, DiscreteOpticsRequest) or before.ray is None
                        or result.status != "OK" or not result.domain_complete
                        or result.operation_ref != "mechanics.discrete_relay_optics.first_hit"
                        or result.scope.epoch != native.scope.epoch
                        or result.scope.evidence_revision_ref != native.scope.evidence_revision_ref
                        or result.scope.model_revision_ref != native.scope.model_revision_ref
                        or not any(candidate == model for candidate in before.models)
                        or before.ray.origin != origin or before.ray.direction_ref != outputs[source]
                        or before.ray.excluded_source_body_ref != source):
                    continue
                hits.extend(row["result"] for row in result.values.get("model_correlated_results", ())
                    if row["model_ref"] == model.model_ref and row["result"].get("complete_first_hit") is True)
            if not hits or any(hit.get("first_receiver_ref") != receiver for hit in hits):
                missing.append("complete_first_impact_evidence_for_route_connection:" + source)
                supported = False
                break
            if source != model.emitter_ref:
                controls = tuple(control for control in model.controls if control.relay_ref == source)
                if len(controls) != 1:
                    missing.append("unique_remote_controller_for_useful_relay:" + source)
                    supported = False
                    break
                control = controls[0]
                setting = tuple(item for item in native.state.settings if item.control_ref == control.control_ref)
                codebook = dict(control.codebook)
                if (len(setting) != 1 or setting[0].drawing_ref not in codebook
                        or outputs[source] not in tuple(codebook[key] for key in sorted(codebook))):
                    missing.append("current_encoded_absolute_output_direction:" + source)
                    supported = False
                    break
                already_correct = codebook[setting[0].drawing_ref] == outputs[source]
                service.append(d_map({"relay_ref": source, "controller_ref": control.control_ref,
                    "required_absolute_direction_ref": outputs[source],
                    "current_drawing_ref": setting[0].drawing_ref,
                    "already_correct_service": already_correct,
                    "no_decorative_selection_or_adjustment": already_correct,
                    "wire_is_binding_not_propagation": True}))
            source = receiver
        if supported:
            reasons.append(d_map({"model_ref": model.model_ref, "ordered_first_receiver_chain": chain,
                "useful_services": tuple(service), "launch_then_authenticate_whole_chain": True,
                "independent_preparation_does_not_reorder_activation": True,
                "ray_crossing_is_not_collision": True,
                "failure_reconcile_must_rebind_physical_settings": True,
                "retained_knowledge_does_not_restore_angles": True}))
    query_case = native.operation_ref == "mechanics.discrete_relay_optics.route_domain" and native.mode_ref == "SEARCH"
    if native.operation_ref.rsplit(".", 1)[-1] in ("cyclic_adjustments", "actuator_compile"):
        if {reason["model_ref"] for reason in reasons} != {model.model_ref for model in native.models}:
            missing.append("useful_preparation_supported_for_every_retained_model")
        actual = dict(native.target_outputs)
        for reason in reasons:
            expected = {service["controller_ref"]: service["required_absolute_direction_ref"]
                for service in reason["useful_services"]}
            if len(actual) != len(native.target_outputs) or actual != expected:
                missing.append("prepare_only_current_route_required_outputs")
            if native.operation_ref.endswith(".actuator_compile"):
                correct = {service["controller_ref"] for service in reason["useful_services"]
                    if service["already_correct_service"]}
                useful = {service["controller_ref"] for service in reason["useful_services"]}
                for word in native.words:
                    active = native.state.active_control_ref if native.state is not None else None
                    for primitive in word:
                        if primitive.kind_ref == "select":
                            active = primitive.control_ref
                            if active in correct:
                                missing.append("already_correct_service_needs_no_decorative_selection")
                            if active not in useful:
                                missing.append("preparation_control_has_no_current_chain_service")
                        elif primitive.kind_ref == "rotate" and active in correct:
                            missing.append("do_not_disturb_an_already_correct_required_service")
                        elif primitive.kind_ref in ("launch", "reset"):
                            # Native K73 owns transition/reset and all following state.
                            break
    if query_case:
        query = request.route_query
        if (query is None or not request.route_query_evidence_refs or request.serving_k03
                or query.request.caller_ref != native.scope.caller_ref
                or query.request.parent_contribution_ref != native.scope.parent_contribution_ref
                or query.request.epoch != native.scope.epoch
                or query.request.input_revision_ref != native.scope.evidence_revision_ref
                or query.request.immutable_inputs.get("parent_goal_ref") != native.scope.parent_goal_ref
                or query.request.immutable_inputs.get("event_owner_ref") != native.scope.event_owner_ref
                or query.request.immutable_inputs.get("model_revision_ref") != native.scope.model_revision_ref
                or query.request.immutable_inputs.get("optics_terminal_contract_digest") != stable_digest(immutable_json_data(contract))
                or set(query.retained_model_refs) != {model.model_ref for model in native.models}):
            missing.append("exact_A_qualified_optical_route_query_to_existing_K09")
        binding = request.route_binding
        if (binding is None or not binding.ready or binding.request != native or binding.query != query
                or native.route_input is None or native.route_input.terminal_contract != immutable_json_data(contract)
                or query is None or binding.projection_digest != optical_geometry_projection_digest_a(native, query)
                or query.request.immutable_inputs.get("optical_geometry_projection_digest") != binding.projection_digest):
            missing.append("exact_K73_first_impact_geometry_projection_receipt")
    return OpticalSolvingFactsC(frozen_input=request,
        facts=FrozenMap({"current_optical_question": not bool(missing), "source_route_query_case": query_case}),
        preparation_reasons=tuple(reasons), missing_refs=tuple(sorted(set(missing))))

def bind_optical_solving_profile(value: OpticalSolvingBindInputC):
    return value.measured.frozen_input.profile

def bind_optical_solving_query(value: OpticalSolvingBindInputC):
    return value.measured.frozen_input.route_query

def finish_optical_solving(value: OpticalSolvingFinishInputC) -> OpticalSolvingReturnC:
    measured = value.measured
    witnesses = ()
    if value.search_return is not None and value.search_return.status == "FOUND":
        search = value.search_return.descriptive_values.get("measurement", FrozenMap())
        witnesses = search.get("witnesses", ())[:3]
    elif (value.profile_return is not None and value.profile_return.native_result is not None
            and value.profile_return.native_result.domain_complete):
        result = value.profile_return.native_result
        rows = result.values.get("model_correlated_results", ())
        retained = {model.model_ref for model in measured.frozen_input.profile.native_request.models}
        if result.operation_ref.endswith(".actuator_compile") and {row["model_ref"] for row in rows} == retained:
            candidates = []
            words = measured.frozen_input.profile.native_request.words
            for index in range(len(words)):
                correlated = tuple((row["model_ref"], row["result"]["compiled_optical_prefixes"][index])
                    for row in rows if index < len(row["result"].get("compiled_optical_prefixes", ())))
                if len(correlated) == len(retained) and all(any(
                        effect.get("event_ledger", FrozenMap()).get("accepted") is True
                        and effect.get("shot_projection", FrozenMap()) is not None
                        and effect["shot_projection"].get("accepted_terminal") is True
                        for effect in candidate["sealed_effects"]) for _, candidate in correlated):
                    candidates.append(d_map({"model_correlated_compiled_prefixes": correlated,
                        "all_retained_models_reach_declared_terminal": True,
                        "physical_launch_authentication_still_required": True}))
                if len(candidates) == 3:
                    break
            witnesses = tuple(candidates)
    return OpticalSolvingReturnC(frozen_measurement=measured, profile_return=value.profile_return,
        search_return=value.search_return, next_item_ref=measured.frozen_input.profile.next_item_ref,
        sibling_item_refs=measured.frozen_input.profile.sibling_item_refs, root_witnesses=witnesses)
