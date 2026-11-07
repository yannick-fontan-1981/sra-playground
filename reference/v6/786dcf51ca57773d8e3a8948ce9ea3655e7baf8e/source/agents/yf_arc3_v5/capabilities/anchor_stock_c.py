"""Bind global stock checks to real K25 receipts and existing quantity simulation."""
from agents.yf_arc3_v5.logos.types import FrozenMap, immutable_json_data
from .anchor_solving_contracts_c import AnchorStockPreparedC, AnchorStockRowsC
from .family_result_join import FamilyJoinCandidate, FamilyJoinGroup, FamilyJoinRequest

def prepare_anchor_stock(value):
    returned, witness = value.returned, value.witness
    request = returned.frozen_measurement.frozen_input
    missing = []
    targets = {target.system_ref:target for target in request.goal_contract.targets}
    supports = {row.system_ref:row for row in request.construction_supports}
    stock = {row.resource_ref:row.available_count for row in request.native_request.inventory}
    if (len(supports) != len(request.construction_supports) or set(supports) != set(targets)
            or set(witness.candidate_by_system) != set(targets) or not witness.evidence_refs):
        missing.append("stock_witness_covers_every_required_beacon")
    expected_debits = {}
    for system_ref in sorted(targets):
        support = supports.get(system_ref)
        if support is None:
            continue
        native, result = support.native_request, support.native_result
        base = request.native_request
        states = base.successor.systems if base.successor is not None else ()
        actual = tuple(state for state in states if state.system_ref == system_ref)
        if (native.operation_ref != "mechanics.inverse_anchor_signature.constructibility" or native.mode != "INVERSE_DOMAIN"
                or result.scope != native.scope or result.operation_ref != native.operation_ref or result.mode != native.mode
                or not result.domain_complete or result.prerequisite_refs or result.computation_bound_reached
                or native.inventory != base.inventory or native.source_identity_ref != base.source_identity_ref
                or len(actual) != 1 or native.signature != actual[0].dependent_signature
                or any(getattr(native.scope,key) != getattr(base.scope,key) for key in (
                    "parent_goal_ref","epoch","evidence_revision_ref","model_revision_ref","event_owner_ref"))):
            missing.append("same_current_global_stock_model_and_complete_K25_constructibility_receipt")
            continue
        candidates = tuple(row for row in native.construction_candidates if row.candidate_ref == witness.candidate_by_system.get(system_ref))
        rows = tuple(row for row in result.values.get("signature_assignment_candidates",())
            if isinstance(row,FrozenMap) and row.get("candidate_ref") == witness.candidate_by_system.get(system_ref))
        if (len(candidates) != 1 or len(rows) != 1 or rows[0].get("stock_feasible") is not True
                or rows[0].get("target_compatible") is not True
                or candidates[0].target_signature != targets[system_ref].spatial_signature):
            missing.append("one_spatially_compatible_native_candidate_per_required_beacon")
            continue
        # Debit identity comes from declared writes verified by the native receipt.
        local_debits = {}
        for write in candidates[0].writes:
            if write.resource_ref not in stock:
                missing.append("known_shared_pickup_resource_identity")
                continue
            key = system_ref+"|"+write.resource_ref
            sink = witness.sink_ref_by_system_resource.get(key)
            if not isinstance(sink,str) or sink in stock:
                missing.append("distinct_declared_system_resource_sink")
                continue
            debit_key = (write.resource_ref,sink)
            expected_debits[debit_key] = expected_debits.get(debit_key,0)+write.consumed_count
            local_debits[write.resource_ref] = local_debits.get(write.resource_ref,0)+write.consumed_count
        remaining = rows[0].get("remaining_inventory")
        if (not isinstance(remaining,tuple) or any(not isinstance(row,FrozenMap) for row in remaining)
                or {row.get("resource_ref"):row.get("available_count") for row in remaining}
                    != {ref:stock[ref]-local_debits.get(ref,0) for ref in sorted(stock)}):
            missing.append("native_remaining_stock_matches_declared_candidate_debits")
    simulation = witness.quantity_simulation
    if not stock and not expected_debits:
        if simulation is not None:
            missing.append("empty_stock_does_not_invent_quantity_entities")
        return AnchorStockPreparedC(returned=returned,witness=witness,bound=not bool(missing),
            simulation_required=False,missing_refs=tuple(sorted(set(missing))))
    if simulation is None:
        return AnchorStockPreparedC(returned=returned,witness=witness,bound=False,
            missing_refs=tuple(sorted(set((*missing,"exact_shared_stock_quantity_simulation_required")))))
    initial = {row.entity_ref:row.quantity for row in simulation.initial}
    sinks = {sink for _,sink in expected_debits}
    if (len(sinks) != len(expected_debits) or set(initial) != set(stock)|sinks
            or any(initial.get(ref) != stock[ref] for ref in sorted(stock))
            or any(initial.get(ref) != 0 for ref in sorted(sinks))):
        missing.append("quantity_simulation_initial_is_exact_shared_stock_and_empty_sinks")
    if any(row.capacity is not None and row.capacity < initial[row.entity_ref]
            + sum(amount for (_,sink),amount in sorted(expected_debits.items()) if sink == row.entity_ref)
            for row in simulation.initial):
        missing.append("quantity_capacity_does_not_invent_extra_stock_constraints")
    resource_groups = tuple({ref}|{sink for (source,sink) in expected_debits if source == ref} for ref in sorted(stock))
    if any(not any(set(group.member_refs) == members for members in resource_groups)
            for group in simulation.conservation_groups):
        missing.append("conservation_groups_match_declared_stock_and_all_its_sinks")
    observed_debits = {}
    for transfer in simulation.transfers:
        key = (transfer.source_ref,transfer.target_ref)
        observed_debits[key] = observed_debits.get(key,0)+transfer.amount
    positive_debits = {key:amount for key,amount in sorted(expected_debits.items()) if amount > 0}
    if observed_debits != positive_debits:
        missing.append("global_quantity_transfers_equal_all_native_candidate_consumptions")
    return AnchorStockPreparedC(returned=returned,witness=witness,bound=not bool(missing),missing_refs=tuple(sorted(set(missing))))

def get_anchor_stock_simulation(value):
    return value.prepared.witness.quantity_simulation

def append_anchor_stock(value):
    prepared = value.prepared
    row = FrozenMap({"witness_ref":prepared.witness.witness_ref,"bound":prepared.bound,
        "candidate_by_system":prepared.witness.candidate_by_system,"quantity_simulation":immutable_json_data(value.measured),
        "stock_feasible":prepared.bound and (not prepared.simulation_required or value.measured is not None and value.measured.all_valid),
        "simulation_required":prepared.simulation_required,
        "missing_refs":prepared.missing_refs})
    return AnchorStockRowsC(rows=(*value.prior_rows,row))

def start_anchor_stock(value):
    return AnchorStockRowsC()

def seal_anchor_stock(value):
    reasons = value.returned.result_reasons
    request = value.returned.frozen_measurement.frozen_input
    join, candidates, missing = None, [], []
    if request.join_request_ref is not None:
        peers = tuple(candidate for group in request.peer_groups for candidate in group.candidates)
        refs = tuple(candidate.candidate_ref for candidate in peers)
        groups = tuple(group.group_ref for group in request.peer_groups)
        if (not value.returned.receipt or value.returned.returned.status != "FOUND"
                or len(set(refs)) != len(refs) or len(set(groups)) != len(groups)
                or any(candidate.result.request.epoch != request.agenda.epoch
                    or candidate.rationale.get("parent_goal_ref") != request.why.parent_goal_ref
                    or candidate.rationale.get("episode_ref") != request.why.episode_ref
                    or candidate.rationale.get("level_scope_ref") != request.why.level_scope_ref
                    or any(ref in request.agenda.invalidated_dependency_refs
                        or request.agenda.current_dependency_revisions.get(ref) != candidate.dependency_revisions[ref]
                        for ref in sorted(candidate.dependency_revisions)) for candidate in peers)):
            missing.append("current_anchor_and_peer_domains_for_scoped_join")
        else:
            for row in value.rows:
                if row.get("stock_feasible") is not True:
                    continue
                if (row["witness_ref"] in refs or row["witness_ref"] in tuple(candidate.candidate_ref for candidate in candidates)
                        or len(peers)+len(candidates) >= 256):
                    missing.append("distinct_bounded_global_stock_witness_identity")
                    break
                simulation = row["quantity_simulation"]
                assignments = FrozenMap({"signature:"+target.system_ref:target.spatial_signature for target in request.goal_contract.targets})
                quantities = FrozenMap(dict(simulation["states"][-1]["quantities"])) if simulation is not None else FrozenMap()
                if len(quantities) > 256:
                    missing.append("anchor_stock_resource_join_projection_bound")
                    break
                why = request.why
                candidates.append(FamilyJoinCandidate(candidate_ref=row["witness_ref"],result=value.returned.returned,
                    dependency_revisions=request.agenda.current_dependency_revisions,assignments=assignments,
                    resource_provenance=quantities,preservation_refs=why.preservation_refs,
                    rationale=FrozenMap({"usefulness_premise_refs":why.usefulness_premise_refs,
                        "morphology_premise_refs":why.morphology_premise_refs,"consumer_ref":why.consumer_ref,
                        "desired_predicate":why.desired_future,"and_dependency_refs":why.and_dependency_refs,
                        "or_dependency_refs":why.or_dependency_refs,"temporal_scope_ref":why.temporal_scope_ref,
                        "evidence_status":"supported","falsifier_ref":why.falsifier_ref,
                        "parent_goal_ref":why.parent_goal_ref,"episode_ref":why.episode_ref,
                        "level_scope_ref":why.level_scope_ref,"stock_witness":row})))
            group_ref = request.join_request_ref+".anchor_stock"
            if group_ref in groups:
                missing.append("distinct_anchor_stock_group_identity")
            if not missing and candidates:
                join = FamilyJoinRequest(request_ref=request.join_request_ref,parent_goal_ref=request.why.parent_goal_ref,
                    episode_ref=request.why.episode_ref,level_scope_ref=request.why.level_scope_ref,epoch=request.agenda.epoch,
                    groups=(FamilyJoinGroup(group_ref=group_ref,candidates=tuple(candidates),domain_complete=False),*request.peer_groups),
                    max_pairs=request.maximum_join_pairs,max_candidates=request.maximum_join_candidates)
    return value.returned.model_copy(update={"result_reasons":FrozenMap({**reasons,
        "global_stock_witness_rows":value.rows,"stock_witness_domain_exhaustive":False,
        "composition_missing_refs":tuple(sorted(set(missing)))}),"family_join_request":join})
