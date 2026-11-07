"""Exact carrier projection and conjunction; no purpose or repair is chosen here."""
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest, immutable_json_data
from .mechanical_family_contracts_a import family_result
from .coupled_value_contracts_c import (CoupledValueRequestC, CoupledValueResultC, CoupledValueCheckpointC,
    CoupledValueSourceReturnInputC, CoupledValueSourceReturnC)
from .coupled_permutation_d import permutation_work_d,measure_permutation_map_d,permutation_image_d


def coupled_context_digest(request):
    return stable_digest((request.scope, request.operation_ref, request.mode, request.carriers,
        request.correspondences, request.correspondence_domain_complete, request.demands, request.correlations,
        request.actions, request.action_domain_complete, request.action_ref, request.current_values,
        request.target_values, request.binary_value_domains, request.affine_certificate, request.output_projection_rows,
        request.output_projection_domain_complete, request.influence_order, request.directional_action_refs,
        request.supplied_word, request.observations, request.inverse_candidates, request.inverse_domain_complete,request.inverse_form_ref,request.parking_query,
        request.finite_query, request.finite_query_evidence_refs, request.path_state_values,
        request.path_state_variable_refs, request.path_action_variable_refs, request.path_stop_ref,
        request.serving_k03, request.maximum_evaluations, request.maximum_states, request.maximum_depth))


def coupled_input_missing(request):
    missing = []
    refs = tuple(carrier.carrier_ref for carrier in request.carriers)
    if len(set(refs)) != len(refs): missing.append("distinct_current_carrier_identities")
    if len({action.action_ref for action in request.actions})!=len(request.actions):
        missing.append("distinct_current_coupled_operator_identities")
    if not request.correspondence_domain_complete: missing.append("closed_normalized_lattice_correspondences")
    if any(row.carrier_ref not in refs or not row.geometry_evidence_refs for row in request.correspondences):
        missing.append("bound_k01_k02_carrier_geometry_evidence")
    if len({row.correlation_ref for row in request.correlations}) != len(request.correlations):
        missing.append("distinct_current_correlation_identities")
    for relation in request.correlations:
        if (len(set(relation.carrier_refs)) != len(relation.carrier_refs)
                or any(ref not in refs for ref in relation.carrier_refs)
                or any(len(row) != len(relation.carrier_refs) for row in relation.allowed_rows)):
            missing.append("well_bound_complete_correlation_row_dimensions")
    if request.resume is not None and (request.resume.context_digest != coupled_context_digest(request)
            or request.resume.operation_ref != request.operation_ref): missing.append("current_coupled_value_checkpoint")
    if request.scope.request_ref in request.scope.consumed_request_refs: missing.append("unconsumed_coupled_value_request")
    return tuple(sorted(set(missing)))


def coupled_return(request, rows=(), values=None, missing=(), examined=0, bounded=False, checkpoint=None, details=None):
    current = request.current_values if values is None else values
    payload = dict(details or {})
    payload.update({"rows": tuple(rows), "current_values": current,
        "total_examined_count": (request.resume.examined_count if request.resume else 0) + examined,
        "actual_bounds": {"maximum_evaluations": request.maximum_evaluations,
            "maximum_states": request.maximum_states, "maximum_depth": request.maximum_depth}})
    return CoupledValueResultC(native=family_result(request, values=payload,
        prerequisite_refs=missing, examined_count=examined, domain_complete=not missing and not bounded,
        computation_bound_reached=bounded, frontier={"checkpoint": checkpoint} if checkpoint else {}),
        rows=tuple(rows), current_values=current, checkpoint=checkpoint)


def coupled_checkpoint(request, item, rows, examined, *, inner=0, values=None, algorithm=None):
    return CoupledValueCheckpointC(context_digest=coupled_context_digest(request), operation_ref=request.operation_ref,
        item_index=item, inner_index=inner, rows=tuple(rows), current_values=request.current_values if values is None else values,
        algorithm_state=FrozenMap(algorithm or {}), examined_count=(request.resume.examined_count if request.resume else 0) + examined)


def calculate_coupled_projection(request: CoupledValueRequestC) -> CoupledValueResultC:
    missing = coupled_input_missing(request)
    if missing: return coupled_return(request, missing=missing)
    rows = list(request.resume.rows) if request.resume else []
    start, examined = request.resume.item_index if request.resume else 0, 0
    for index in range(start, len(request.demands)):
        demand = request.demands[index]
        work = len(request.correspondences) + 1
        if examined + work > request.maximum_evaluations or len(rows) >= request.maximum_states:
            cp = coupled_checkpoint(request, index, rows, examined)
            return coupled_return(request, rows, examined=examined, bounded=True, checkpoint=cp)
        matches = tuple(row for row in request.correspondences if row.anchor_ref == demand.anchor_ref and row.offset == demand.offset)
        identities = tuple(dict.fromkeys(row.carrier_ref for row in matches))
        examined += work
        if len(identities) != 1 or not demand.support_refs:
            return coupled_return(request, rows, missing=("unique_actual_carrier_and_constraint_support",), examined=examined)
        projected = immutable_json_data({"carrier_ref": identities[0], "constraint_ref": demand.constraint_ref,
            "predicate_kind": demand.predicate_kind, "allowed_values": demand.allowed_values,
            "support_refs": demand.support_refs, "correlation_ref": demand.correlation_ref,
            "geometry_evidence_refs": tuple(dict.fromkeys(ref for row in matches for ref in row.geometry_evidence_refs))})
        prior_index = next((i for i, row in enumerate(rows) if row["carrier_ref"] == identities[0]), None)
        if prior_index is None:
            rows.append(FrozenMap({"carrier_ref": identities[0], "requests": (projected,),
                "constraint_refs": (demand.constraint_ref,)}))
        else:
            prior = rows[prior_index]
            rows[prior_index] = FrozenMap({"carrier_ref": identities[0], "requests": (*prior["requests"], projected),
                "constraint_refs": tuple(dict.fromkeys((*prior["constraint_refs"], demand.constraint_ref)))})
    return coupled_return(request, rows, examined=examined,
        details={"coincident_carrier_identities": tuple(dict.fromkeys(row["carrier_ref"] for row in rows)),
            "all_contributing_constraints_retained": True})


def calculate_coupled_intersection(request: CoupledValueRequestC) -> CoupledValueResultC:
    # Projection and intersection share one staged checkpoint; projection rows are not recomputed.
    stage = request.resume.algorithm_state.get("stage", "projection") if request.resume else "projection"
    if stage == "projection":
        projected = calculate_coupled_projection(request)
        if not projected.native.domain_complete: return projected
        source_rows = tuple(demand for carrier in projected.rows for demand in carrier["requests"])
        rows, start = [], 0
        examined = projected.native.examined_count
    else:
        missing = coupled_input_missing(request)
        if missing: return coupled_return(request, missing=missing)
        source_rows = request.resume.algorithm_state.get("projected_rows")
        if not isinstance(source_rows, tuple): return coupled_return(request, missing=("preserved_projection_rows",))
        rows, start, examined = list(request.resume.rows), request.resume.item_index, 0
    for index in range(start, len(request.carriers)):
        carrier = request.carriers[index]
        work = len(source_rows) + len(carrier.allowed_domain)
        if examined + work > request.maximum_evaluations or len(rows) >= request.maximum_states:
            cp = coupled_checkpoint(request, index, rows, examined,
                algorithm={"stage": "intersection", "projected_rows": source_rows})
            return coupled_return(request, rows, examined=examined, bounded=True, checkpoint=cp)
        demands = tuple(row for row in source_rows if row["carrier_ref"] == carrier.carrier_ref)
        allowed = set(carrier.allowed_domain)
        value_rows = tuple(row for row in demands if row["predicate_kind"] == "VALUE")
        for row in value_rows: allowed.intersection_update(row["allowed_values"])
        existence = tuple(row for row in demands if row["predicate_kind"] in ("EXISTS", "ABSENT"))
        requested_existence = {row["predicate_kind"] == "EXISTS" for row in existence}
        existence_conflict = len(requested_existence) > 1 or bool(requested_existence) and carrier.exists is not None and carrier.exists not in requested_existence
        unknown = bool(value_rows or existence) and carrier.exists is None
        value_on_absent = bool(value_rows) and carrier.exists is False
        examined += work
        rows.append(immutable_json_data({"carrier_ref": carrier.carrier_ref,
            "allowed_values": tuple(value for value in carrier.allowed_domain if value in allowed),
            "constraint_refs": tuple(dict.fromkeys(row["constraint_ref"] for row in demands)),
            "support_refs": tuple(dict.fromkeys(ref for row in demands for ref in row["support_refs"])),
            "correlation_refs": tuple(dict.fromkeys(row["correlation_ref"] for row in demands if row["correlation_ref"] is not None)),
            "empty_value_intersection": bool(value_rows) and not allowed, "existence_conflict": existence_conflict,
            "existence_unknown": unknown, "value_request_on_absent_carrier": value_on_absent,
            "protected": carrier.protected, "instruction_mark_refs": carrier.instruction_mark_refs}))
    return coupled_return(request, rows, examined=examined,
        missing=("current_requested_carrier_existence",) if any(row["existence_unknown"] for row in rows) else (),
        details={"conflicting_carrier_refs": tuple(row["carrier_ref"] for row in rows
            if row["empty_value_intersection"] or row["existence_conflict"] or row["value_request_on_absent_carrier"]),
            "correlated_constraints_are_not_independent_variables": True, "majority_vote_not_used": True})


def effect_column(request, action):
    carriers = {carrier.carrier_ref: carrier for carrier in request.carriers}
    mapped, supports, excluded = [], [], []
    if not action.support_evidence_refs:
        return None, ("current_declared_action_mask_support",)
    for offset in action.supported_offsets:
        matches = tuple(row for row in request.correspondences
            if row.anchor_ref == action.centre_anchor_ref and row.offset == offset)
        identities = tuple(dict.fromkeys(row.carrier_ref for row in matches))
        if len(identities) != 1:
            return None, ("unique_action_mask_carrier_correspondence",)
        carrier = carriers[identities[0]]
        if carrier.exists is None:
            return None, ("current_action_mask_carrier_existence",)
        supports.extend(ref for row in matches for ref in row.geometry_evidence_refs)
        if carrier.exists and carrier.mutable and not carrier.protected:
            mapped.append(carrier.carrier_ref)
        else:
            excluded.append(carrier.carrier_ref)
    column=FrozenMap({"action_ref": action.action_ref,
        "carrier_refs": tuple(dict.fromkeys(mapped)), "excluded_carrier_refs": tuple(dict.fromkeys(excluded)),
        "support_refs": tuple(dict.fromkeys((*action.support_evidence_refs, *supports))),
        "weight": action.weight, "existence_and_protected_are_not_value_variables": True})
    if action.permutation_cycles:
        forward,cycles,debt=measure_permutation_map_d(request,action,column)
        if debt:return None,debt
        column=FrozenMap.overlay({'supported_cycle_rows':cycles,'forward_carrier_map':forward,
            'mathematical_inverse_is_available_input':False},column)
    return column,()


def calculate_coupled_effect_columns(request: CoupledValueRequestC) -> CoupledValueResultC:
    missing = coupled_input_missing(request)
    if missing: return coupled_return(request, missing=missing)
    if len({action.action_ref for action in request.actions}) != len(request.actions):
        return coupled_return(request, missing=("distinct_action_column_identities",))
    rows = list(request.resume.rows) if request.resume else []
    start, examined = request.resume.item_index if request.resume else 0, 0
    for index in range(start, len(request.actions)):
        action = request.actions[index]
        work = len(action.supported_offsets) * len(request.correspondences) + len(request.carriers)+permutation_work_d(action,request)
        if examined + work > request.maximum_evaluations or len(rows) >= request.maximum_states:
            cp = coupled_checkpoint(request, index, rows, examined)
            return coupled_return(request, rows, bounded=True, checkpoint=cp, examined=examined)
        row, missing = effect_column(request, action)
        examined += work
        if missing: return coupled_return(request, rows, missing=missing, examined=examined)
        rows.append(row)
    return coupled_return(request, rows, examined=examined,
        missing=() if request.action_domain_complete else ("closed_action_column_domain",))


def apply_coupled_action(request, action, before):
    column, missing = effect_column(request, action)
    if missing: return before, missing
    if not action.domain_complete:
        return before, ("closed_current_value_transition_relation",)
    matches = tuple(after for first, after in action.transition_rows if first == before)
    if action.permutation_cycles:
        after,_,debt=permutation_image_d(request,action,column,before)
        if debt:return before,debt
        if action.transition_rows and (len(matches)!=1 or matches[0]!=after):
            return before,('permutation.current_relation_and_phase_model_contradiction',)
    else:
        if len(matches) != 1:
            return before, ("unique_supported_transition_for_full_pre_state",)
        after = matches[0]
    if set(after) != set(before):
        return before, ("all_untouched_carriers_and_marks_retained",)
    active = set(column["carrier_refs"])
    carriers = {carrier.carrier_ref: carrier for carrier in request.carriers}
    for ref in before:
        if ref not in active and before[ref] != after[ref]:
            return before, ("unaffected_structure_or_protected_carrier_changed",)
        if ref in active and after[ref] not in carriers[ref].allowed_domain:
            return before, ("value_transition_outside_declared_domain",)
    return after, ()


def calculate_coupled_successor(request: CoupledValueRequestC) -> CoupledValueResultC:
    missing = coupled_input_missing(request)
    if missing: return coupled_return(request, missing=missing)
    actions = tuple(action for action in request.actions if action.action_ref == request.action_ref)
    if len(actions) != 1:
        return coupled_return(request, missing=("one_source_requested_current_action",))
    action = actions[0]
    work = len(action.transition_rows) + len(action.supported_offsets) * len(request.correspondences) + len(request.current_values)+permutation_work_d(action,request)
    if work > request.maximum_evaluations:
        cp = coupled_checkpoint(request, 0, (), 0)
        return coupled_return(request, bounded=True, checkpoint=cp)
    after, missing = apply_coupled_action(request, action, request.current_values)
    return coupled_return(request, values=after, missing=missing, examined=work,
        details={"before_values": request.current_values, "actual_action_ref": request.action_ref,
            "instruction_marks": tuple((carrier.carrier_ref, carrier.instruction_mark_refs) for carrier in request.carriers),
            "protected_loci": tuple(carrier.carrier_ref for carrier in request.carriers if carrier.protected),
            "all_effects_use_one_pre_state": True})


def affine_binding_missing(request):
    cert = request.affine_certificate
    if cert is None: return ("current_scoped_affine_certificate",)
    if cert.kind == "EXHAUSTIVE_DOMAIN" and request.current_values not in cert.relevant_states:
        return ("current_state_inside_certified_relevant_domain",)
    actions = {action.action_ref: action for action in request.actions}
    if (len(actions) != len(request.actions) or len(set(cert.variable_refs)) != len(cert.variable_refs)
            or len(set(cert.action_refs)) != len(cert.action_refs) or set(cert.action_refs) != set(actions)):
        return ("exact_unique_certificate_variables_and_operators",)
    support = tuple((action.action_ref, action.centre_anchor_ref, action.supported_offsets,
        action.support_evidence_refs, action.involution_law_ref) for action in request.actions)
    constraints = (request.demands, request.correlations, request.target_values)
    projection = (request.output_projection_rows, request.output_projection_domain_complete, request.binary_value_domains)
    if (cert.model_revision_ref != request.scope.model_revision_ref or not cert.evidence_refs
            or cert.operator_support_digest != stable_digest(support)
            or cert.constraint_digest != stable_digest(constraints)
            or cert.output_projection_digest != stable_digest(projection)):
        return ("current_affine_model_support_constraints_and_projection_binding",)
    if set(cert.fixed_effect_columns) != set(cert.action_refs):
        return ("complete_scoped_affine_effect_columns",)
    for ref in cert.variable_refs:
        values = request.binary_value_domains.get(ref)
        if not isinstance(values, tuple) or len(values) != 2 or values[0] == values[1]:
            return ("explicit_binary_value_basis_for_each_certificate_variable",)
    for ref in cert.action_refs:
        column = cert.fixed_effect_columns[ref]
        if (not isinstance(column, tuple) or len(column) != len(cert.variable_refs)
                or any(type(bit) is not int or bit not in (0, 1) for bit in column)):
            return ("exact_binary_certificate_column_dimensions",)
    return ()


def project_binary_values(request, state):
    if request.output_projection_rows:
        matches = tuple(after for before, after in request.output_projection_rows if before == state)
        if len(matches) != 1:
            return None, ("current_full_state_output_projection",)
        output = matches[0]
    else:
        output = state
    cert = request.affine_certificate
    bits = []
    for ref in cert.variable_refs:
        if ref not in output or output[ref] not in request.binary_value_domains[ref]:
            return None, ("current_output_in_declared_binary_basis",)
        bits.append(request.binary_value_domains[ref].index(output[ref]))
    return tuple(bits), ()


def calculate_coupled_affine_certificate(request: CoupledValueRequestC) -> CoupledValueResultC:
    missing = tuple(sorted(set(coupled_input_missing(request) + affine_binding_missing(request))))
    if missing: return coupled_return(request, missing=missing)
    cert = request.affine_certificate
    if cert.kind == "SAMPLES_ONLY":
        return coupled_return(request, details={"certificate_qualified": False, "provisional_sample_agreement": True,
            "shortcut_rejected_only": True, "goal_and_direct_toggle_subdomain_retained": True})
    actions = {action.action_ref: action for action in request.actions}
    if cert.kind == "FIXED_MASK_INVOLUTION":
        if request.output_projection_rows:
            return coupled_return(request, missing=("derived_output_requires_its_own_exhaustive_affine_projection_certificate",))
        carriers = {carrier.carrier_ref: carrier for carrier in request.carriers}
        if any(ref not in carriers or tuple(carriers[ref].allowed_domain) != request.binary_value_domains[ref]
                for ref in cert.variable_refs):
            return coupled_return(request, missing=("direct_input_binary_variables_bound_to_actual_carriers",))
        rows = list(request.resume.rows) if request.resume else []
        start, examined = request.resume.item_index if request.resume else 0, 0
        for index in range(start, len(cert.action_refs)):
            action = actions[cert.action_refs[index]]
            work = len(request.correspondences) * len(action.supported_offsets) + len(cert.variable_refs)
            if examined + work > request.maximum_evaluations or len(rows) >= request.maximum_states:
                cp = coupled_checkpoint(request, index, rows, examined)
                return coupled_return(request, rows, bounded=True, checkpoint=cp, examined=examined)
            column, debt = effect_column(request, action)
            examined += work
            if debt: return coupled_return(request, rows, missing=debt, examined=examined)
            if action.involution_law_ref is None or action.involution_law_ref not in cert.evidence_refs:
                return coupled_return(request, rows, missing=("established_current_fixed_mask_involution_law",), examined=examined)
            actual = tuple(int(ref in column["carrier_refs"]) for ref in cert.variable_refs)
            if set(column["carrier_refs"]) - set(cert.variable_refs) or actual != cert.fixed_effect_columns[action.action_ref]:
                return coupled_return(request, rows, examined=examined,
                    details={"certificate_qualified": False, "counterexample_action_ref": action.action_ref,
                        "shortcut_rejected_only": True, "goal_and_direct_toggle_subdomain_retained": True})
            rows.append(FrozenMap({"action_ref": action.action_ref, "verified_column": actual,
                "involution_law_ref": action.involution_law_ref}))
        return coupled_return(request, rows, examined=examined,
            details={"certificate_qualified": True, "fixed_mask_law_scope_only": True, "derived_projection_not_inherited": True})
    if not cert.relevant_state_domain_complete or not cert.relevant_states:
        return coupled_return(request, missing=("complete_declared_relevant_state_domain_for_affine_comparison",))
    if request.output_projection_rows and not request.output_projection_domain_complete:
        return coupled_return(request, missing=("complete_current_derived_output_projection_domain",))
    rows = list(request.resume.rows) if request.resume else []
    start, examined = request.resume.item_index if request.resume else 0, 0
    total = len(cert.relevant_states) * len(cert.action_refs)
    for index in range(start, total):
        state = cert.relevant_states[index // len(cert.action_refs)]
        action_ref = cert.action_refs[index % len(cert.action_refs)]
        action = actions[action_ref]
        work = len(action.transition_rows) + 2 * len(request.output_projection_rows) + len(cert.variable_refs)
        if examined + work > request.maximum_evaluations or len(rows) >= request.maximum_states:
            cp = coupled_checkpoint(request, index, rows, examined)
            return coupled_return(request, rows, bounded=True, checkpoint=cp, examined=examined)
        before, debt = project_binary_values(request, state)
        if debt: return coupled_return(request, rows, missing=debt, examined=examined)
        following, debt = apply_coupled_action(request, action, state)
        if debt: return coupled_return(request, rows, missing=debt, examined=examined)
        if following not in cert.relevant_states:
            return coupled_return(request, rows, missing=("relevant_affine_state_domain_closed_under_requested_operators",), examined=examined)
        after, debt = project_binary_values(request, following)
        if debt: return coupled_return(request, rows, missing=debt, examined=examined)
        examined += work
        delta = tuple(first ^ last for first, last in zip(before, after))
        if delta != cert.fixed_effect_columns[action_ref]:
            return coupled_return(request, rows, examined=examined,
                details={"certificate_qualified": False, "counterexample_state": state,
                    "counterexample_action_ref": action_ref, "actual_output_delta": delta,
                    "shortcut_rejected_only": True, "goal_and_direct_toggle_subdomain_retained": True})
        rows.append(FrozenMap({"state_index": index // len(cert.action_refs), "action_ref": action_ref, "verified_output_delta": delta}))
    return coupled_return(request, rows, examined=examined,
        details={"certificate_qualified": True, "exhaustive_in_declared_relevant_domain": True,
            "input_certificate_not_silently_imported_into_outputs": True})


def calculate_coupled_binary_solver(request: CoupledValueRequestC) -> CoupledValueResultC:
    missing = tuple(sorted(set(coupled_input_missing(request) + affine_binding_missing(request))))
    if missing: return coupled_return(request, missing=missing)
    cp = request.resume
    algorithm = dict(cp.algorithm_state) if cp else {}
    stage = algorithm.get("stage", "AFFINE")
    examined = 0
    cert = request.affine_certificate
    if stage == "AFFINE":
        nested = algorithm.get("certificate_checkpoint")
        certificate_view = request.model_copy(update={"resume": CoupledValueCheckpointC.model_validate(nested) if nested is not None else None})
        validated = calculate_coupled_affine_certificate(certificate_view)
        examined += validated.native.examined_count
        if not validated.native.domain_complete:
            outer = coupled_checkpoint(request, 0, (), examined, algorithm={"stage": "AFFINE",
                "certificate_checkpoint": immutable_json_data(validated.checkpoint) if validated.checkpoint else None})
            return coupled_return(request, validated.rows, missing=validated.native.prerequisite_refs,
                bounded=validated.native.computation_bound_reached, checkpoint=outer, examined=examined)
        if validated.native.values.get("certificate_qualified") is not True:
            return coupled_return(request, validated.rows, examined=examined,
                details={"affine_shortcut_qualified": False, "goal_not_rejected": True, "binary_solver_not_used": True})
        before, debt = project_binary_values(request, request.current_values)
        if debt: return coupled_return(request, missing=debt, examined=examined)
        matrix = []
        for position, ref in enumerate(cert.variable_refs):
            if ref not in request.target_values: continue
            basis = request.binary_value_domains[ref]
            if request.target_values[ref] not in basis:
                return coupled_return(request, missing=("target_value_in_current_binary_basis",), examined=examined)
            coefficients = tuple(cert.fixed_effect_columns[action][position] for action in cert.action_refs)
            matrix.append(FrozenMap({"bits": coefficients, "rhs": before[position] ^ basis.index(request.target_values[ref])}))
        if set(request.target_values) - set(cert.variable_refs):
            return coupled_return(request, missing=("all_binary_target_variables_in_certificate_scope",), examined=examined)
        algorithm = {"stage": "REDUCE", "matrix": tuple(matrix), "column": 0, "pivot_row": 0,
            "scan_row": 0, "elimination_row": 0, "substage": "FIND", "pivot_columns": ()}
        stage = "REDUCE"
    n = len(cert.action_refs)
    if stage == "REDUCE":
        matrix = list(algorithm["matrix"])
        column, pivot = algorithm["column"], algorithm["pivot_row"]
        scan, eliminate = algorithm["scan_row"], algorithm["elimination_row"]
        bit_index = algorithm.get("elimination_bit_index", 0)
        partial_bits = list(algorithm.get("partial_row_bits", ()))
        substage, pivot_columns = algorithm["substage"], list(algorithm["pivot_columns"])
        while column < n and pivot < len(matrix):
            if substage == "FIND":
                found = False
                while scan < len(matrix):
                    if examined >= request.maximum_evaluations: break
                    examined += 1
                    if matrix[scan]["bits"][column]:
                        found = True
                        break
                    scan += 1
                if not found and examined >= request.maximum_evaluations and scan < len(matrix):
                    break
                if scan == len(matrix):
                    column += 1
                    scan = pivot
                    continue
                matrix[pivot], matrix[scan] = matrix[scan], matrix[pivot]
                pivot_columns.append(column)
                eliminate, bit_index, partial_bits, substage = 0, 0, [], "ELIMINATE"
            while eliminate < len(matrix):
                if examined >= request.maximum_evaluations: break
                if eliminate != pivot and matrix[eliminate]["bits"][column]:
                    row, basis_row = matrix[eliminate], matrix[pivot]
                    while bit_index < n and examined < request.maximum_evaluations:
                        partial_bits.append(row["bits"][bit_index] ^ basis_row["bits"][bit_index])
                        bit_index += 1
                        examined += 1
                    if bit_index < n or examined >= request.maximum_evaluations: break
                    matrix[eliminate] = FrozenMap({"bits": tuple(partial_bits),
                        "rhs": row["rhs"] ^ basis_row["rhs"]})
                examined += 1
                eliminate += 1
                bit_index, partial_bits = 0, []
            if eliminate < len(matrix): break
            pivot, column = pivot + 1, column + 1
            scan, substage = pivot, "FIND"
        if column < n and pivot < len(matrix):
            outer = coupled_checkpoint(request, column, (), examined, algorithm={"stage": "REDUCE",
                "matrix": tuple(matrix), "column": column, "pivot_row": pivot, "scan_row": scan,
                "elimination_row": eliminate, "elimination_bit_index": bit_index,
                "partial_row_bits": tuple(partial_bits), "substage": substage, "pivot_columns": tuple(pivot_columns)})
            return coupled_return(request, bounded=True, checkpoint=outer, examined=examined)
        inconsistent = any(not any(row["bits"]) and row["rhs"] for row in matrix)
        if inconsistent:
            return coupled_return(request, examined=examined,
                details={"affine_shortcut_qualified": True, "linear_system_inconsistent": True,
                    "inconsistency_in_supplied_linear_domain_only": True, "goal_not_universally_rejected": True})
        particular = [0] * n
        for index, col in enumerate(pivot_columns): particular[col] = matrix[index]["rhs"]
        free = tuple(col for col in range(n) if col not in pivot_columns)
        nullspace = []
        for col in free:
            vector = [0] * n
            vector[col] = 1
            for index, pivot_col in enumerate(pivot_columns): vector[pivot_col] = matrix[index]["bits"][col]
            nullspace.append(tuple(vector))
        algorithm = {"stage": "NULLSPACE", "particular": tuple(particular), "nullspace": tuple(nullspace),
            "next_vector_index": 0, "best_bits": None, "best_cost": None}
        stage = "NULLSPACE"
    if stage == "VERIFY_WORD":
        return verify_binary_word(request, algorithm["word"], algorithm["particular"], algorithm["nullspace"],
            algorithm["minimum_cost"], cp.current_values, cp.item_index, cp.rows, examined)
    if stage != "NULLSPACE":
        return coupled_return(request, missing=("valid_current_binary_solver_stage",))
    particular, nullspace = algorithm["particular"], algorithm["nullspace"]
    vector_index, best_bits, best_cost = algorithm["next_vector_index"], algorithm.get("best_bits"), algorithm.get("best_cost")
    total = 1 << len(nullspace)
    actions = {action.action_ref: action for action in request.actions}
    while vector_index < total:
        work = max(1, n * (len(nullspace) + 1))
        if examined + work > request.maximum_evaluations or vector_index >= request.maximum_states:
            outer = coupled_checkpoint(request, vector_index, (), examined, algorithm={"stage": "NULLSPACE",
                "particular": particular, "nullspace": nullspace, "next_vector_index": vector_index,
                "best_bits": best_bits, "best_cost": best_cost})
            return coupled_return(request, bounded=True, checkpoint=outer, examined=examined,
                details={"particular_solution": particular, "nullspace": nullspace, "bounded_best_bits": best_bits,
                    "bounded_best_cost": best_cost, "minimum_proven": False})
        bits = list(particular)
        for index, vector in enumerate(nullspace):
            if vector_index & (1 << index): bits = [a ^ b for a, b in zip(bits, vector)]
        initial, debt = project_binary_values(request, request.current_values)
        if debt: return coupled_return(request, missing=debt, examined=examined)
        predicted = tuple(bit ^ sum(cert.fixed_effect_columns[ref][position]
            for ref, active in zip(cert.action_refs, bits) if active) % 2 for position, bit in enumerate(initial))
        goal_ok, debt = binary_goal_compatible(request, predicted)
        if debt: return coupled_return(request, missing=debt, examined=examined)
        cost = sum(actions[ref].weight for ref, bit in zip(cert.action_refs, bits) if bit)
        if goal_ok and sum(bits) <= request.maximum_depth and (best_cost is None or cost < best_cost):
            best_bits, best_cost = tuple(bits), cost
        examined += work
        vector_index += 1
    if best_bits is None:
        return coupled_return(request, examined=examined,
            details={"no_goal_satisfying_vector_in_declared_affine_domain": True,
                "goal_not_universally_rejected": True, "minimum_proven": False})
    word = tuple(ref for ref, bit in zip(cert.action_refs, best_bits) if bit)
    return verify_binary_word(request, word, particular, nullspace, best_cost, request.current_values, 0, (), examined)


def verify_binary_word(request, word, particular, nullspace, best_cost, values, start, rows, examined):
    if len(word) > request.maximum_depth:
        return coupled_return(request, rows, values=values, missing=("compiled_binary_word_inside_primitive_bound",), examined=examined)
    cert = request.affine_certificate
    actions = {action.action_ref: action for action in request.actions}
    verified = list(rows)
    for index in range(start, len(word)):
        ref = word[index]
        action = actions[ref]
        work = len(action.transition_rows) + len(action.supported_offsets) * len(request.correspondences) + len(values)+permutation_work_d(action,request)
        if examined + work > request.maximum_evaluations:
            outer = coupled_checkpoint(request, index, verified, examined, values=values,
                algorithm={"stage": "VERIFY_WORD", "word": word, "particular": particular, "nullspace": nullspace, "minimum_cost": best_cost})
            return coupled_return(request, verified, values=values, bounded=True, checkpoint=outer, examined=examined,
                details={"minimum_proven": False, "compiled_word_not_yet_verified": True})
        following, debt = apply_coupled_action(request, action, values)
        examined += work
        if debt: return coupled_return(request, verified, values=values, missing=debt, examined=examined)
        verified.append(FrozenMap({"action_ref": ref, "before": values, "after": following}))
        values = following
    output, debt = project_binary_values(request, values)
    if debt: return coupled_return(request, verified, values=values, missing=debt, examined=examined)
    target_ok = all(output[cert.variable_refs.index(ref)] == request.binary_value_domains[ref].index(target)
        for ref, target in sorted(request.target_values.items()))
    goal_ok, debt = binary_goal_compatible(request, output)
    if debt: return coupled_return(request, verified, values=values, missing=debt, examined=examined)
    target_ok = target_ok and goal_ok
    return coupled_return(request, verified, values=values, examined=examined,
        details={"particular_solution": particular, "nullspace": nullspace, "actual_action_word": word,
            "word_verified_under_same_successor": target_ok, "minimum_proven": target_ok,
            "minimum_scope": "complete_enumerated_nullspace_under_current_affine_certificate_and_primitive_bound", "weighted_action_cost": best_cost})


def binary_goal_compatible(request, bits):
    cert = request.affine_certificate
    output = {ref: request.binary_value_domains[ref][bit] for ref, bit in zip(cert.variable_refs, bits)}
    carriers = {carrier.carrier_ref: carrier for carrier in request.carriers}
    for demand in request.demands:
        refs = tuple(dict.fromkeys(row.carrier_ref for row in request.correspondences
            if row.anchor_ref == demand.anchor_ref and row.offset == demand.offset))
        if len(refs) != 1 or not demand.support_refs:
            return False, ("current_goal_carrier_correspondence_and_support",)
        ref = refs[0]
        carrier = carriers[ref]
        if carrier.exists is None:
            return False, ("current_goal_carrier_existence",)
        if demand.predicate_kind == "VALUE":
            if ref not in output: return False, ("all_goal_value_variables_in_affine_certificate_scope",)
            if not carrier.exists or output[ref] not in demand.allowed_values: return False, ()
        elif demand.predicate_kind == "EXISTS" and not carrier.exists: return False, ()
        elif demand.predicate_kind == "ABSENT" and carrier.exists: return False, ()
        elif demand.predicate_kind == "PROTECTED":
            if ref in output and carrier.value_ref is not None and output[ref] != carrier.value_ref:
                return False, ()
    for relation in request.correlations:
        if not relation.domain_complete or not relation.evidence_refs:
            return False, ("closed_current_goal_correlation_relation",)
        if any(ref not in output for ref in relation.carrier_refs):
            return False, ("all_goal_correlation_variables_in_affine_certificate_scope",)
        actual = tuple(output[ref] for ref in relation.carrier_refs)
        if actual not in relation.allowed_rows: return False, ()
    return True, ()


def full_goal_compatible(request, values):
    if request.output_projection_rows:
        matches = tuple(after for before, after in request.output_projection_rows if before == values)
        if len(matches) != 1: return False, ("current_complete_goal_output_projection",)
        visible = matches[0]
    else:
        visible = values
    carriers = {carrier.carrier_ref: carrier for carrier in request.carriers}
    for demand in request.demands:
        identities = tuple(dict.fromkeys(row.carrier_ref for row in request.correspondences
            if row.anchor_ref == demand.anchor_ref and row.offset == demand.offset))
        if len(identities) != 1 or not demand.support_refs:
            return False, ("current_goal_carrier_correspondence_and_support",)
        ref = identities[0]
        carrier = carriers[ref]
        if carrier.exists is None: return False, ("current_goal_carrier_existence",)
        if demand.predicate_kind == "VALUE":
            if ref not in visible: return False, ("current_full_goal_value_view",)
            if not carrier.exists or visible[ref] not in demand.allowed_values: return False, ()
        elif demand.predicate_kind == "EXISTS" and not carrier.exists: return False, ()
        elif demand.predicate_kind == "ABSENT" and carrier.exists: return False, ()
        elif demand.predicate_kind == "PROTECTED" and ref in values and values[ref] != request.current_values.get(ref):
            return False, ()
    for relation in request.correlations:
        if not relation.domain_complete or not relation.evidence_refs:
            return False, ("closed_current_goal_correlation_relation",)
        if any(ref not in visible for ref in relation.carrier_refs): return False, ("full_correlated_goal_value_view",)
        if tuple(visible[ref] for ref in relation.carrier_refs) not in relation.allowed_rows: return False, ()
    if any(ref not in visible or visible[ref] != target for ref, target in sorted(request.target_values.items())): return False, ()
    return True, ()


def calculate_coupled_directional_solver(request: CoupledValueRequestC) -> CoupledValueResultC:
    missing = coupled_input_missing(request)
    if missing: return coupled_return(request, missing=missing)
    order, refs = request.influence_order, request.directional_action_refs
    if len(order) != len(refs) or len(set(order)) != len(order) or set(order) != set(request.target_values):
        return coupled_return(request, missing=("exact_supplied_triangular_variables_and_actions",))
    actions = {action.action_ref: action for action in request.actions}
    carriers = {carrier.carrier_ref: carrier for carrier in request.carriers}
    if any(ref not in actions for ref in refs) or any(ref not in carriers for ref in order):
        return coupled_return(request, missing=("bound_directional_operator_and_carrier",))
    for index, ref in enumerate(refs):
        column, debt = effect_column(request, actions[ref])
        if debt: return coupled_return(request, missing=debt)
        if order[index] not in column["carrier_refs"] or set(column["carrier_refs"]).intersection(order[:index]):
            return coupled_return(request, missing=("acyclic_triangular_influence_order_compatible_with_effect_graph",))
    cp = request.resume
    values = cp.current_values if cp else request.current_values
    rows = list(cp.rows) if cp else []
    start, examined = cp.item_index if cp else 0, 0
    for index in range(start, len(order)):
        carrier_ref, action_ref = order[index], refs[index]
        if values.get(carrier_ref) == request.target_values[carrier_ref]:
            rows.append(FrozenMap({"carrier_ref": carrier_ref, "action_ref": None, "already_satisfied": True}))
            continue
        action = actions[action_ref]
        work = len(action.transition_rows) + len(action.supported_offsets) * len(request.correspondences) + len(values)+permutation_work_d(action,request)
        primitive_count = sum(row.get("action_ref") is not None for row in rows)
        if (examined + work > request.maximum_evaluations or len(rows) >= request.maximum_states
                or primitive_count >= request.maximum_depth):
            cp = coupled_checkpoint(request, index, rows, examined, values=values)
            return coupled_return(request, rows, values=values, bounded=True, checkpoint=cp, examined=examined)
        following, debt = apply_coupled_action(request, action, values)
        examined += work
        if debt: return coupled_return(request, rows, values=values, missing=debt, examined=examined)
        if following.get(carrier_ref) != request.target_values[carrier_ref]:
            return coupled_return(request, rows, values=values,
                missing=("supported_directional_substitution_reaches_pivot_target",), examined=examined)
        rows.append(FrozenMap({"carrier_ref": carrier_ref, "action_ref": action_ref, "before": values, "after": following}))
        values = following
    goal, debt = full_goal_compatible(request, values)
    return coupled_return(request, rows, values=values, missing=debt, examined=examined,
        details={"actual_action_word": tuple(row["action_ref"] for row in rows if row["action_ref"] is not None),
            "full_forward_verification": goal, "triangular_shortcut_only": True, "minimum_proven": False})


def finite_path_binding_missing(request):
    query = request.finite_query
    if request.serving_k03:
        return ("nonrecursive_planning_scope_outside_k03_required",)
    if query is None or not request.finite_query_evidence_refs:
        return ("explicit_current_finite_path_encoding",)
    identity, scope = query.request, request.scope
    if (identity.actual_bounds.get("max_candidates", 0) > request.maximum_evaluations
            or identity.actual_bounds.get("max_states", 0) > request.maximum_states):
        return ("finite_work_slice_inside_declared_parent_bounds",)
    if (identity.caller_ref != scope.caller_ref or identity.parent_contribution_ref != scope.parent_contribution_ref
            or identity.epoch != scope.epoch or identity.input_revision_ref != scope.evidence_revision_ref
            or identity.immutable_inputs.get("coupled_value_request_ref") != scope.request_ref
            or identity.immutable_inputs.get("coupled_value_model_revision_ref") != scope.model_revision_ref
            or identity.immutable_inputs.get("coupled_value_path_binding_digest") != stable_digest((
                request.path_state_values, request.path_state_variable_refs, request.path_action_variable_refs,
                request.path_stop_ref, request.actions, request.demands, request.correlations, request.target_values,
                request.finite_query_evidence_refs))):
        return ("current_source_bound_relational_path_scope",)
    if (len(request.path_state_variable_refs) != len(request.path_action_variable_refs) + 1
            or not request.path_state_variable_refs or request.path_stop_ref is None
            or len(request.path_action_variable_refs) > request.maximum_depth):
        return ("finite_state_action_layer_encoding_and_explicit_stop_marker",)
    variables = {variable.variable_ref: variable for variable in query.variables}
    if set(variables) != set((*request.path_state_variable_refs, *request.path_action_variable_refs)):
        return ("exact_supplied_path_variable_domain",)
    actions = {action.action_ref: action for action in request.actions}
    if request.path_stop_ref in actions: return ("stop_marker_distinct_from_physical_actions",)
    for ref in request.path_state_variable_refs:
        variable = variables[ref]
        if any(value not in request.path_state_values or variable.costs.get(value) != 0 for value in variable.values):
            return ("exact_zero_cost_full_joint_state_domains",)
    for ref in request.path_action_variable_refs:
        variable = variables[ref]
        if any(value != request.path_stop_ref and value not in actions for value in variable.values):
            return ("actual_action_refs_in_path_command_domains",)
        for value in variable.values:
            expected = 0 if value == request.path_stop_ref else actions[value].weight
            if variable.costs.get(value) != expected:
                return ("supported_action_costs_not_semantic_path_preferences",)
    return ()


def _calculate_coupled_finite_paths(request, solver):
    from .finite_search_contracts_c import FiniteSearchCheckpointC, FiniteSearchFactsC
    missing = tuple(sorted(set(coupled_input_missing(request) + finite_path_binding_missing(request))))
    if missing: return coupled_return(request, missing=missing)
    algorithm = request.resume.algorithm_state if request.resume else FrozenMap()
    if algorithm.get("stage") == "FINITE_VERIFY":
        facts = FiniteSearchFactsC.model_validate(algorithm["finite_result"])
        return verify_finite_path_words(request, facts, 0)
    validation = validate_finite_path_encoding(request)
    if not validation.native.domain_complete: return validation
    if validation.native.examined_count + request.finite_query.request.actual_bounds.get("max_candidates", 0) > request.maximum_evaluations:
        cp = coupled_checkpoint(request, 0, (), validation.native.examined_count,
            algorithm={"stage": "FINITE_SEARCH", "finite_checkpoint": None})
        return coupled_return(request, bounded=True, checkpoint=cp, examined=validation.native.examined_count,
            details={"encoding_verified_next_stage_pending": True})
    nested = algorithm.get("finite_checkpoint")
    query = request.finite_query.model_copy(update={"resume": FiniteSearchCheckpointC.model_validate(nested) if nested is not None else None})
    facts = solver(query)
    examined = validation.native.examined_count + facts.examined_count
    if not facts.complete:
        cp = coupled_checkpoint(request, 0, (), examined,
            algorithm={"stage": "FINITE_SEARCH", "finite_checkpoint": immutable_json_data(facts.checkpoint) if facts.checkpoint else None})
        return coupled_return(request, missing=facts.missing_refs, bounded=facts.bounded,
            checkpoint=cp, examined=examined, details={"finite_result": facts, "minimum_proven": False})
    return verify_finite_path_words(request, facts, examined)


def verify_finite_path_words(request, facts, examined):
    cp = request.resume
    algorithm = cp.algorithm_state if cp else FrozenMap()
    verifying = algorithm.get("stage") == "FINITE_VERIFY"
    assignment_index = cp.item_index if verifying else 0
    step_index = cp.inner_index if verifying else 0
    verified = list(cp.rows) if verifying else []
    values = cp.current_values if verifying else request.current_values
    word = list(algorithm.get("word", ())) if verifying else []
    stopped = algorithm.get("stopped", False) if verifying else False
    actions = {action.action_ref: action for action in request.actions}
    for index in range(assignment_index, len(facts.assignments)):
        assignment = facts.assignments[index]
        if step_index == 0 and not word and not stopped:
            initial_ref = assignment[request.path_state_variable_refs[0]]
            if request.path_state_values[initial_ref] != request.current_values:
                return coupled_return(request, missing=("finite_path_starts_at_current_full_state",))
            values = request.current_values
        while step_index <= len(request.path_action_variable_refs):
            final = step_index == len(request.path_action_variable_refs)
            action_ref = None if final else assignment[request.path_action_variable_refs[step_index]]
            work = len(request.demands) * len(request.correspondences) + len(request.correlations) + 1
            if action_ref is not None and action_ref != request.path_stop_ref:
                action = actions[action_ref]
                work += len(action.transition_rows) + len(action.supported_offsets) * len(request.correspondences) + len(values)+permutation_work_d(action,request)
            if examined + work > request.maximum_evaluations or len(verified) >= request.maximum_states:
                continuation = coupled_checkpoint(request, index, verified, examined, inner=step_index, values=values,
                    algorithm={"stage": "FINITE_VERIFY", "finite_result": immutable_json_data(facts),
                        "word": tuple(word), "stopped": stopped})
                return coupled_return(request, verified, values=values, bounded=True, checkpoint=continuation,
                    examined=examined, details={"compiled_word_prefix_retained": True, "minimum_proven": False})
            examined += work
            if final:
                goal, debt = full_goal_compatible(request, values)
                if debt: return coupled_return(request, verified, values=values, missing=debt, examined=examined)
                if not goal: return coupled_return(request, verified, values=values,
                    missing=("full_final_allowed_set_and_correlations_satisfied",), examined=examined)
                verified.append(immutable_json_data({"actual_action_word": tuple(word), "final_values": values,
                    "word_cost": sum(actions[ref].weight for ref in word), "full_forward_verified": True}))
                break
            following = request.path_state_values[assignment[request.path_state_variable_refs[step_index + 1]]]
            if action_ref == request.path_stop_ref:
                goal, debt = full_goal_compatible(request, values)
                if debt: return coupled_return(request, verified, values=values, missing=debt, examined=examined)
                if not goal or following != values:
                    return coupled_return(request, verified, values=values,
                        missing=("stop_marker_only_after_goal_with_identical_full_state",), examined=examined)
                stopped = True
            else:
                if stopped: return coupled_return(request, verified, values=values,
                    missing=("no_physical_action_after_path_stop_marker",), examined=examined)
                actual, debt = apply_coupled_action(request, actions[action_ref], values)
                if debt: return coupled_return(request, verified, values=values, missing=debt, examined=examined)
                if actual != following: return coupled_return(request, verified, values=values,
                    missing=("all_joint_path_layers_match_actual_successor",), examined=examined)
                word.append(action_ref)
            values = following
            step_index += 1
        step_index, word, stopped = 0, [], False
    return coupled_return(request, verified, examined=examined,
        details={"finite_result": facts, "minimum_proven": bool(verified), "minimum_cost": facts.minimum_cost,
            "minimum_scope": "supplied_complete_relational_encoding_and_horizon",
            "joint_state_not_independent_carrier_paths": True})


def calculate_coupled_nonbinary_dp(request: CoupledValueRequestC) -> CoupledValueResultC:
    from .finite_search_c import dynamic_program_finite_relations
    return _calculate_coupled_finite_paths(request, dynamic_program_finite_relations)


def calculate_coupled_nonbinary_csp(request: CoupledValueRequestC) -> CoupledValueResultC:
    from .finite_search_c import enumerate_finite_relations
    return _calculate_coupled_finite_paths(request, enumerate_finite_relations)


def validate_finite_path_encoding(request):
    query = request.finite_query
    variables = {variable.variable_ref: variable for variable in query.variables}
    states, command_vars = request.path_state_variable_refs, request.path_action_variable_refs
    groups = ((states[0],),) + tuple((states[index], command_vars[index], states[index + 1])
        for index in range(len(command_vars))) + ((states[-1],),)
    if len(states) == 1:
        # The zero-length path has one unary relation satisfying both initial and goal.
        groups = ((states[0],),)
    relation_map = {}
    for relation in query.relations:
        if relation.variable_refs in relation_map or relation.variable_refs not in groups or not relation.domain_complete:
            return coupled_return(request, missing=("exact_complete_path_relation_groups",))
        relation_map[relation.variable_refs] = relation
    if set(relation_map) != set(groups):
        return coupled_return(request, missing=("every_current_path_layer_relation_present",))
    algorithm = request.resume.algorithm_state if request.resume else FrozenMap()
    if algorithm.get("stage") == "FINITE_SEARCH":
        return coupled_return(request, details={"path_encoding_revalidated_under_same_scope": True})
    layer = request.resume.item_index if request.resume else 0
    cursor = request.resume.inner_index if request.resume else 0
    expected = list(algorithm.get("expected_rows", ()))
    examined = 0
    actions = {action.action_ref: action for action in request.actions}
    while layer < len(groups):
        group = groups[layer]
        if len(group) == 1:
            values = variables[group[0]].values
            total = len(values)
        else:
            sources = variables[group[0]].values
            controls = variables[group[1]].values
            total = len(sources) * len(controls)
        while cursor < total:
            if len(group) == 1:
                state_ref = values[cursor]
                world = request.path_state_values[state_ref]
                work = len(request.demands) * len(request.correspondences) + len(request.correlations) + 1
                if examined + work > request.maximum_evaluations: break
                initial = layer == 0
                terminal = layer == len(groups) - 1
                allowed = not initial or world == request.current_values
                if terminal:
                    goal, debt = full_goal_compatible(request, world)
                    if debt: return coupled_return(request, missing=debt, examined=examined)
                    allowed = allowed and goal
                if allowed: expected.append((state_ref,))
            else:
                state_ref = sources[cursor // len(controls)]
                action_ref = controls[cursor % len(controls)]
                world = request.path_state_values[state_ref]
                work = len(request.path_state_values) + len(request.demands) * len(request.correspondences) + 1
                if action_ref != request.path_stop_ref:
                    action = actions[action_ref]
                    work += len(action.transition_rows) + len(action.supported_offsets) * len(request.correspondences)+permutation_work_d(action,request)
                if examined + work > request.maximum_evaluations: break
                if action_ref == request.path_stop_ref:
                    goal, debt = full_goal_compatible(request, world)
                    if debt: return coupled_return(request, missing=debt, examined=examined)
                    following = world
                    allowed = goal
                else:
                    following, debt = apply_coupled_action(request, actions[action_ref], world)
                    if debt: return coupled_return(request, missing=debt, examined=examined)
                    allowed = True
                if allowed:
                    for following_ref in variables[group[2]].values:
                        if request.path_state_values[following_ref] == following:
                            expected.append((state_ref, action_ref, following_ref))
            examined += work
            cursor += 1
            if len(expected) > request.maximum_states:
                break
        if cursor < total or len(expected) > request.maximum_states:
            cp = coupled_checkpoint(request, layer, (), examined, inner=cursor,
                algorithm={"stage": "VALIDATE_ENCODING", "expected_rows": tuple(expected)})
            return coupled_return(request, bounded=True, checkpoint=cp, examined=examined)
        actual = relation_map[group].allowed_rows
        if len(set(actual)) != len(actual) or set(actual) != set(expected):
            return coupled_return(request, missing=("relational_encoding_matches_every_actual_successor_and_goal",), examined=examined)
        layer, cursor, expected = layer + 1, 0, []
    return coupled_return(request, examined=examined,
        details={"full_relational_path_encoding_verified": True})


def calculate_coupled_measure(request: CoupledValueRequestC) -> CoupledValueResultC:
    missing = coupled_input_missing(request)
    if missing: return coupled_return(request, missing=missing)
    return coupled_return(request, details={"carrier_count": len(request.carriers),
        "constraint_count": len(request.demands), "correlation_count": len(request.correlations),
        "action_count": len(request.actions), "full_carriers": request.carriers,
        "normalized_correspondences": request.correspondences,
        "unknown_existence_refs": tuple(carrier.carrier_ref for carrier in request.carriers if carrier.exists is None),
        "k10_k11_purpose_not_inferred": True})


def calculate_coupled_precondition(request: CoupledValueRequestC) -> CoupledValueResultC:
    missing = coupled_input_missing(request)
    if missing: return coupled_return(request, missing=missing)
    if request.parking_query is not None:
        from .coupled_parking_d import calculate_coupled_parking_d
        return calculate_coupled_parking_d(request)
    actions = tuple(action for action in request.actions if action.action_ref == request.action_ref)
    if len(actions) != 1: return coupled_return(request, missing=("one_current_requested_action",))
    action = actions[0]
    if action.permutation_cycles:
        work=len(action.supported_offsets)*len(request.correspondences)+len(request.current_values)+permutation_work_d(action,request)
        if work>request.maximum_evaluations:
            return coupled_return(request,bounded=True,checkpoint=coupled_checkpoint(request,0,(),0))
        after,debt=apply_coupled_action(request,action,request.current_values)
        return coupled_return(request,missing=debt,examined=work,
            details={'current_precondition_supported':not debt,'permutation_after_values':after,
                'action_release_not_authorized':True})
    column, debt = effect_column(request, action)
    if debt: return coupled_return(request, missing=debt)
    matches = tuple(after for before, after in action.transition_rows if before == request.current_values)
    return coupled_return(request, missing=() if action.domain_complete else ("closed_operator_precondition_domain",),
        details={"effect_column": column, "full_prestate_transition_count": len(matches),
            "current_precondition_supported": action.domain_complete and len(matches) == 1,
            "action_release_not_authorized": True})


def calculate_coupled_fit(request: CoupledValueRequestC) -> CoupledValueResultC:
    missing = coupled_input_missing(request)
    if missing: return coupled_return(request, missing=missing)
    if not request.observations: return coupled_return(request, missing=("revalidated_before_after_value_observations",))
    rows = list(request.resume.rows) if request.resume else []
    start, examined = request.resume.item_index if request.resume else 0, 0
    actions = {action.action_ref: action for action in request.actions}
    for index in range(start, len(request.observations)):
        observation = request.observations[index]
        if not observation.evidence_refs or observation.current_revalidation_ref is None:
            return coupled_return(request, rows, missing=("current_observation_effect_revalidation",), examined=examined)
        action = actions.get(observation.action_ref)
        if action is None: return coupled_return(request, rows, missing=("observation_operator_in_current_model",), examined=examined)
        work = len(action.transition_rows) + len(action.supported_offsets) * len(request.correspondences) + len(observation.before_values)+permutation_work_d(action,request)
        if examined + work > request.maximum_evaluations or len(rows) >= request.maximum_states:
            cp = coupled_checkpoint(request, index, rows, examined)
            return coupled_return(request, rows, bounded=True, checkpoint=cp, examined=examined)
        after, debt = apply_coupled_action(request, action, observation.before_values)
        examined += work
        if debt: return coupled_return(request, rows, missing=debt, examined=examined)
        rows.append(immutable_json_data({"observation_index": index, "action_ref": action.action_ref,
            "observed_before": observation.before_values, "observed_after": observation.after_values,
            "predicted_after": after, "consistent_in_current_evidence_scope": after == observation.after_values,
            "evidence_refs": observation.evidence_refs}))
    return coupled_return(request, rows, examined=examined,
        details={"consistent_in_observed_scope": all(row["consistent_in_current_evidence_scope"] for row in rows),
            "sample_concordance_is_provisional_not_affine_certificate": True})


def calculate_coupled_inverse(request: CoupledValueRequestC) -> CoupledValueResultC:
    missing = coupled_input_missing(request)
    if missing: return coupled_return(request, missing=missing)
    if request.inverse_form_ref=='PERMUTATION_IMAGE':
        return calculate_coupled_permutation_inverse_d(request)
    if not request.inverse_domain_complete:
        return coupled_return(request, missing=("closed_supplied_inverse_value_domain",))
    actions = tuple(action for action in request.actions if action.action_ref == request.action_ref)
    if len(actions) != 1: return coupled_return(request, missing=("one_inverse_operator_in_current_model",))
    action = actions[0]
    rows = list(request.resume.rows) if request.resume else []
    start, examined = request.resume.item_index if request.resume else 0, 0
    for index in range(start, len(request.inverse_candidates)):
        before = request.inverse_candidates[index]
        work = len(action.transition_rows) + len(action.supported_offsets) * len(request.correspondences) + len(before)+permutation_work_d(action,request)
        if examined + work > request.maximum_evaluations or len(rows) >= request.maximum_states:
            cp = coupled_checkpoint(request, index, rows, examined)
            return coupled_return(request, rows, bounded=True, checkpoint=cp, examined=examined)
        after, debt = apply_coupled_action(request, action, before)
        examined += work
        if debt: return coupled_return(request, rows, missing=debt, examined=examined)
        matches = all(after.get(ref) == value for ref, value in sorted(request.target_values.items()))
        rows.append(immutable_json_data({"candidate_index": index, "before_values": before,
            "after_values": after, "matches_declared_target": matches}))
    return coupled_return(request, rows, examined=examined,
        details={"exhaustive_in_declared_inverse_domain": True,
            "matching_candidate_indices": tuple(row["candidate_index"] for row in rows if row["matches_declared_target"]),
            "no_unlisted_inverse_candidate_or_goal_invented": True})


def calculate_coupled_permutation_inverse_d(request):
    actions=tuple(action for action in request.actions if action.action_ref==request.action_ref)
    if len(actions)!=1:return coupled_return(request,missing=('permutation.one_current_forward_control',))
    action=actions[0]
    work=(len(action.transition_rows)+len(action.supported_offsets)*len(request.correspondences)
        +3*len(request.carriers)+2*permutation_work_d(action,request))
    if work>request.maximum_evaluations:
        return coupled_return(request,bounded=True,checkpoint=coupled_checkpoint(request,0,(),0))
    column,debt=effect_column(request,action)
    if debt:return coupled_return(request,missing=debt,examined=work)
    before,cycles,debt=permutation_image_d(request,action,column,request.target_values,inverse=True)
    if debt:return coupled_return(request,missing=debt,examined=work)
    for relation in request.correlations:
        work+=len(relation.carrier_refs)*len(relation.allowed_rows)
        if work>request.maximum_evaluations:
            return coupled_return(request,bounded=True,checkpoint=coupled_checkpoint(request,0,(),0))
        if not relation.domain_complete or not relation.evidence_refs:
            return coupled_return(request,missing=('permutation.closed_predecessor_correlation_domain',),examined=work)
        if tuple(before[ref] for ref in relation.carrier_refs) not in relation.allowed_rows:
            return coupled_return(request,missing=('permutation.predecessor_outside_supported_correlations',),examined=work)
    after,debt=apply_coupled_action(request,action,before)
    if debt:return coupled_return(request,missing=debt,examined=work)
    if after!=request.target_values:
        return coupled_return(request,missing=('permutation.exact_forward_revalidation_of_inverse_image',),examined=work)
    row=FrozenMap({'forward_action_ref':action.action_ref,'predecessor_values':before,
        'target_values':request.target_values,'supported_cycle_rows':cycles,
        'forward_revalidation_matches':True,'inverse_command_invented':False})
    return coupled_return(request,rows=(row,),examined=work,
        details={'mathematical_predecessor_image_only':True,'executable_inverse_action_ref':None,
            'forward_available_action_refs':tuple(action.action_ref for action in request.actions),
            'predecessor_state_is_current_observation':False})


def calculate_coupled_word_certificate(request: CoupledValueRequestC) -> CoupledValueResultC:
    missing = coupled_input_missing(request)
    if missing: return coupled_return(request, missing=missing)
    if len(request.supplied_word) > request.maximum_depth:
        return coupled_return(request, missing=("supplied_word_inside_declared_primitive_bound",))
    rows = list(request.resume.rows) if request.resume else []
    values = request.resume.current_values if request.resume else request.current_values
    start, examined = request.resume.item_index if request.resume else 0, 0
    actions = {action.action_ref: action for action in request.actions}
    for index in range(start, len(request.supplied_word)):
        action = actions.get(request.supplied_word[index])
        if action is None: return coupled_return(request, rows, values=values, missing=("supplied_word_operator_supported",), examined=examined)
        work = len(action.transition_rows) + len(action.supported_offsets) * len(request.correspondences) + len(values)+permutation_work_d(action,request)
        if examined + work > request.maximum_evaluations or len(rows) >= request.maximum_states:
            cp = coupled_checkpoint(request, index, rows, examined, values=values)
            return coupled_return(request, rows, values=values, bounded=True, checkpoint=cp, examined=examined)
        after, debt = apply_coupled_action(request, action, values)
        examined += work
        if debt: return coupled_return(request, rows, values=values, missing=debt, examined=examined)
        rows.append(FrozenMap({"action_ref": action.action_ref, "before": values, "after": after}))
        values = after
    goal, debt = full_goal_compatible(request, values)
    protected = tuple(carrier.carrier_ref for carrier in request.carriers if carrier.protected)
    untouched = all(values.get(ref) == request.current_values.get(ref) for ref in protected)
    return coupled_return(request, rows, values=values, missing=debt, examined=examined,
        details={"actual_action_word": request.supplied_word, "primitive_count": len(request.supplied_word),
            "full_forward_goal_verified": goal, "protected_loci": protected, "protected_untouched": untouched,
            "instruction_marks": tuple((carrier.carrier_ref, carrier.instruction_mark_refs) for carrier in request.carriers),
            "witness_supported": goal and untouched, "minimum_proven": False, "exhaustive_world_claim": False})


def unsupported_coupled_operation(request: CoupledValueRequestC) -> CoupledValueResultC:
    return CoupledValueResultC(native=family_result(request, signature_supported=False,
        prerequisite_refs=("exact_source_coupled_operation_and_mode",), domain_complete=False),
        rows=(), current_values=request.current_values, checkpoint=None)


def finish_coupled_source_return(value: CoupledValueSourceReturnInputC) -> CoupledValueSourceReturnC:
    return CoupledValueSourceReturnC(frozen_request=value.request, calculation=value.calculation,
        source_policy_ref=value.source_policy_ref, source_disposition_ref=value.source_disposition_ref,
        source_reason_ref=value.source_reason_ref)
