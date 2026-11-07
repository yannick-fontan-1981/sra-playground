"""One bounded CSP/DP engine with operational, revision-keyed continuation."""
from agents.yf_arc3_v5.logos.types import FrozenMap, immutable_json_data, stable_digest
from .finite_search_contracts_c import FiniteSearchInputC, FiniteSearchFactsC, FiniteSearchCheckpointC


def finite_context_digest(value):
    return stable_digest((value.request, value.variables, value.relations, value.variable_order,
        value.cost_metric_ref, value.domain_complete, value.evidence_refs))


def _finite_relation_search(value: FiniteSearchInputC, frontier_dp: bool) -> FiniteSearchFactsC:
    missing, examined, bounded = set(), 0, False
    bounds = value.request.actual_bounds
    missing.update(key for key in ("max_candidates", "max_states", "max_depth") if key not in bounds)
    descriptor = (value.variables, value.relations, value.variable_order, value.cost_metric_ref,
        value.domain_complete, value.evidence_refs)
    expected_mode = "DP" if frontier_dp else "CSP"
    if (value.request.kernel_ref != "mechanics.bounded_route_search"
            or value.request.operation_ref != "mechanics.bounded_route_search.finite_relations"
            or value.request.expected_return_type != "FiniteSearchFactsC" or value.request.mode != expected_mode
            or not value.domain_complete or not value.evidence_refs
            or value.request.immutable_inputs.get("finite_relation_digest") != stable_digest(immutable_json_data(descriptor))
            or value.request.immutable_inputs.get("cost_metric_ref") != value.cost_metric_ref):
        missing.add("current_complete_finite_relation_contract")
    variables = {row.variable_ref: row for row in value.variables}
    if (len(variables) != len(value.variables) or len(set(value.variable_order)) != len(value.variable_order)
            or set(value.variable_order) != set(variables)):
        missing.add("exact_unique_finite_variable_order")
    for variable in value.variables:
        if len(set(variable.values)) != len(variable.values) or set(variable.costs) != set(variable.values):
            missing.add("complete_unique_variable_cost_domain")
        if any(type(variable.costs[key]) is not int or variable.costs[key] < 0 for key in variable.costs):
            missing.add("exact_nonnegative_additive_costs")
    if len({row.relation_ref for row in value.relations}) != len(value.relations):
        missing.add("unique_relation_refs")
    for relation in value.relations:
        if (not relation.domain_complete or any(ref not in variables for ref in relation.variable_refs)
                or len(set(relation.variable_refs)) != len(relation.variable_refs)):
            missing.add("complete_bound_relation_variables")
    cp = value.resume
    digest = finite_context_digest(value)
    if cp is not None and (cp.context_digest != digest or cp.stage not in ("VALIDATE_RELATIONS", "ENUMERATE", "DONE")):
        missing.add("current_finite_relation_checkpoint")
    usable = cp is not None and not missing
    stage = cp.stage if usable else "VALIDATE_RELATIONS"
    index, frontier_index, value_index = (cp.variable_index, cp.frontier_index, cp.value_index) if usable else (0, 0, 0)
    relation_index, row_index = (cp.relation_index, cp.relation_row_index) if usable else (0, 0)
    frontier = list(cp.frontier) if usable else [FrozenMap({"assignment": FrozenMap(), "cost": 0})]
    following = list(cp.following) if usable else []
    candidate = cp.candidate if usable else None
    candidate_cost = cp.candidate_cost if usable else None
    previous_examined = cp.examined_count if usable else 0
    if usable and (index > len(value.variable_order) or relation_index > len(value.relations)
            or frontier_index > len(frontier)):
        missing.add("valid_finite_checkpoint_cursor")
    while stage == "VALIDATE_RELATIONS" and not missing:
        if relation_index == len(value.relations):
            stage, relation_index, row_index = "ENUMERATE", 0, 0
            break
        relation = value.relations[relation_index]
        if row_index == len(relation.allowed_rows):
            relation_index, row_index = relation_index + 1, 0
            continue
        if row_index > len(relation.allowed_rows):
            missing.add("valid_relation_validation_cursor")
            break
        if examined >= bounds.get("max_candidates", 0):
            bounded = True
            break
        row = relation.allowed_rows[row_index]
        examined += 1
        if len(row) != len(relation.variable_refs) or any(
                item not in variables[ref].values for ref, item in zip(relation.variable_refs, row)):
            missing.add("relation_row_outside_declared_domain")
            break
        row_index += 1
    while stage == "ENUMERATE" and not missing and not bounded:
        if index == len(value.variable_order):
            stage = "DONE"
            break
        if index >= bounds.get("max_depth", 0):
            bounded = True
            break
        variable_ref = value.variable_order[index]
        variable = variables[variable_ref]
        future = set(value.variable_order[index + 1:])
        boundary = tuple(ref for ref in value.variable_order[:index + 1] if any(
            ref in relation.variable_refs and future.intersection(relation.variable_refs) for relation in value.relations))
        layer_index = {tuple(row["assignment"][ref] for ref in boundary): i for i, row in enumerate(following)}
        if frontier_index == len(frontier):
            frontier, following = following, []
            index, frontier_index, value_index, relation_index, row_index = index + 1, 0, 0, 0, 0
            continue
        assignment, cost = frontier[frontier_index]["assignment"], frontier[frontier_index]["cost"]
        if value_index == len(variable.values):
            frontier_index, value_index = frontier_index + 1, 0
            continue
        if value_index > len(variable.values):
            missing.add("valid_finite_value_cursor")
            break
        if candidate is None:
            if examined >= bounds.get("max_candidates", 0):
                bounded = True
                break
            item = variable.values[value_index]
            candidate = FrozenMap.overlay({variable_ref: item}, assignment)
            candidate_cost = cost + variable.costs[item]
            relation_index, row_index = 0, 0
            examined += 1
        legal = True
        while relation_index < len(value.relations):
            relation = value.relations[relation_index]
            match = False
            while row_index < len(relation.allowed_rows):
                if examined >= bounds.get("max_candidates", 0):
                    bounded = True
                    break
                row = relation.allowed_rows[row_index]
                examined += 1
                row_index += 1
                if all(ref not in candidate or candidate[ref] == row[position]
                        for position, ref in enumerate(relation.variable_refs)):
                    match = True
                    break
            if bounded: break
            if not match:
                legal = False
                break
            relation_index, row_index = relation_index + 1, 0
        if bounded: break
        if legal:
            key = tuple(candidate[ref] for ref in boundary)
            if frontier_dp and key in layer_index:
                prior_index = layer_index[key]
                if candidate_cost < following[prior_index]["cost"]:
                    following[prior_index] = FrozenMap({"assignment": candidate, "cost": candidate_cost})
            else:
                if len(following) >= bounds.get("max_states", 0):
                    bounded = True
                    break
                following.append(FrozenMap({"assignment": candidate, "cost": candidate_cost}))
        candidate, candidate_cost = None, None
        value_index, relation_index, row_index = value_index + 1, 0, 0
    complete = stage == "DONE" and not missing and not bounded
    minimum = min((row["cost"] for row in frontier), default=None) if complete else None
    assignments = tuple(row["assignment"] for row in frontier if row["cost"] == minimum)[:3] if complete else ()
    checkpoint = FiniteSearchCheckpointC(context_digest=digest, stage=stage, variable_index=index,
        frontier_index=frontier_index, value_index=value_index, relation_index=relation_index,
        relation_row_index=row_index, frontier=tuple(frontier), following=tuple(following), candidate=candidate,
        candidate_cost=candidate_cost, examined_count=previous_examined + examined) if bounded else None
    return FiniteSearchFactsC(request=value, assignments=assignments, minimum_cost=minimum,
        complete=complete, bounded=bounded, missing_refs=tuple(sorted(missing)), examined_count=examined,
        retained_frontier=tuple(frontier), unfinished_layer=tuple(following) if bounded else (),
        variable_index=index, frontier_index=frontier_index, value_index=value_index, checkpoint=checkpoint,
        facts=FrozenMap({"complete": complete, "bounded": bounded, "missing": bool(missing),
            "domain_empty": complete and not frontier, "frontier_dynamic_programming": frontier_dp,
            "total_examined_count": previous_examined + examined, "operational_resume": usable}))


def enumerate_finite_relations(value: FiniteSearchInputC) -> FiniteSearchFactsC:
    return _finite_relation_search(value, False)


def dynamic_program_finite_relations(value: FiniteSearchInputC) -> FiniteSearchFactsC:
    return _finite_relation_search(value, True)
