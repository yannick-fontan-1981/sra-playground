"""Bind contact usefulness to exact K26 rows without recomputing geometry."""
from agents.yf_arc3_v5.logos.types import FrozenMap, immutable_json_data, stable_digest


def project_shape_contact_reasons(request, receipt_current):
    native, why = request.native_request, request.why
    bodies = {body.body_ref: body for body in native.bodies}
    targets = {target.target_ref: target for target in request.goal_contract.targets}
    missing, reasons = [], []
    for support in request.contact_reasons:
        receipt = support.receipt
        operation = ("contact_successor" if support.kind == "RELATIVE_STOP" else "recolour_successor")
        model = receipt.native_request.model
        laws = tuple(law for law in model.laws if law.law_ref == support.law_ref) if model is not None else ()
        body, target = bodies.get(support.body_ref), targets.get(support.target_ref)
        if (not receipt_current(native, receipt) or body is None or target is None
                or receipt.native_request.bodies != native.bodies
                or receipt.native_request.operation_ref != "mechanics.contact_shape_repair." + operation
                or receipt.native_request.focused_body_ref != support.body_ref
                or len(laws) != 1 or laws[0].body_ref != support.body_ref
                or laws[0].control_ref != receipt.native_request.control_ref
                or not support.expected_after_body_digest
                or not set(support.enabling_dependency_refs) <= set(why.and_dependency_refs)):
            missing.append("current_shape_contact_reason_model_law_and_goal")
            continue
        rows = receipt.native_result.values.get("measurements", ())
        row = rows[0] if isinstance(rows, tuple) and len(rows) == 1 and isinstance(rows[0], FrozenMap) else None
        after_rows = row.get("after_bodies", ()) if row is not None else ()
        after = tuple(value for value in after_rows if isinstance(value, FrozenMap) and value.get("body_ref") == support.body_ref)
        events = row.get("events", ()) if row is not None else ()
        if (len(after) != 1 or stable_digest(after[0]) != support.expected_after_body_digest
                or not isinstance(events, tuple) or any(not isinstance(event, FrozenMap) for event in events)):
            missing.append("exact_native_contact_after_body_and_events")
            continue
        preserved = tuple(immutable_json_data(value) for value in native.bodies if value.body_ref != support.body_ref)
        actual_others = tuple(value for value in after_rows if isinstance(value, FrozenMap) and value.get("body_ref") != support.body_ref)
        if (actual_others != preserved or len(after_rows) != len(native.bodies)
                or any(after[0].get(field) != getattr(body, field) for field in ("layer_ref","family_ref"))):
            missing.append("contact_preserves_other_bodies_and_selected_identity")
            continue
        if support.kind == "RELATIVE_STOP":
            blocked = tuple(event for event in events if event.get("contact") is True
                and event.get("before") == event.get("after") and event.get("node_ref") is not None)
            moved = tuple(event for event in events if event.get("node_ref") is not None
                and event.get("before") != event.get("after"))
            if not blocked or not moved or laws[0].endpoint_contact != "KEEP_BEFORE":
                missing.append("native_stop_holds_one_node_while_another_moves")
                continue
        else:
            rules = {rule.rule_ref: rule for rule in model.aspect_rules}
            changed = tuple(event for event in events if event.get("rule_ref") in rules
                and event.get("before") != event.get("after")
                and event.get("before") == rules[event["rule_ref"]].before_aspect_ref
                and event.get("after") == rules[event["rule_ref"]].after_aspect_ref)
            if (not changed or target.required_aspect_ref is None
                    or after[0].get("aspect_ref") != target.required_aspect_ref
                    or after[0].get("aspect_ref") == body.aspect_ref):
                missing.append("native_colour_contact_produces_required_terminal_aspect")
                continue
        reasons.append(FrozenMap({"body_ref":support.body_ref,"target_ref":support.target_ref,
            "kind":support.kind,"after_body":after[0],"events":events,
            "law_ref":support.law_ref,"contact_evidence_refs":support.contact_evidence_refs,
            "enabling_dependency_refs":support.enabling_dependency_refs,
            "actual_observed_effect":False,"control_is_click_actuator":False}))
    for support in request.invariant_reasons:
        receipt = support.receipt
        model = receipt.native_request.model
        invariants = {item.invariant_ref:item for item in model.invariants} if model is not None else {}
        selected = tuple(invariants.get(ref) for ref in support.invariant_refs)
        if (not receipt_current(native, receipt) or receipt.native_request.bodies != native.bodies
                or receipt.native_request.operation_ref != "mechanics.contact_shape_repair.invariant_check"
                or len(set(support.invariant_refs)) != len(support.invariant_refs)
                or any(item is None or item.body_ref != support.body_ref
                    or item.parameter_scope_ref != native.scope.model_revision_ref for item in selected)
                or not support.expected_holds and not support.retained_alternative_mechanism_refs):
            missing.append("contextual_shape_invariants_leave_other_mechanisms_open")
            continue
        rows = receipt.native_result.values.get("measurements", ())
        measured = tuple(row for row in rows if isinstance(row, FrozenMap) and row.get("body_ref") == support.body_ref)
        checks = measured[0].get("invariants", ()) if len(measured) == 1 else ()
        requested_checks = tuple(row for row in checks if isinstance(row, FrozenMap) and row.get("invariant_ref") in support.invariant_refs)
        if (len(requested_checks) != len(support.invariant_refs)
                or any(row.get("holds") is not support.expected_holds
                    or row.get("parameter_scope_ref") != native.scope.model_revision_ref for row in requested_checks)):
            missing.append("exact_native_contextual_invariant_result")
            continue
        reasons.append(FrozenMap({"body_ref":support.body_ref,"invariant_checks":requested_checks,
            "contextual_evidence_refs":support.contextual_evidence_refs,
            "retained_alternative_mechanism_refs":support.retained_alternative_mechanism_refs,
            "rejection_scope":"ONLY_THIS_POSE_IN_THIS_DEMONSTRATED_MODEL"}))
    return tuple(reasons), tuple(sorted(set(missing)))
