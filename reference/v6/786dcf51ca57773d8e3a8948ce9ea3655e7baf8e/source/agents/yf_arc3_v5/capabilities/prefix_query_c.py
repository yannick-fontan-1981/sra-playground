"""Missing K79 descriptive operations reuse the established physical prefix core."""
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from .mechanical_family_contracts_d import (d_map, d_result, d_validate_request, DWorkBudget,
    DComputationInterrupted)
from .prefix_query_contracts_c import PrefixQueryCheckpointC
from .layered_prefix_construction import _topology, _material, _external, PrefixState, PrefixPrerequisite


def prefix_query_context_digest(request):
    return stable_digest((request.scope, request.operation_ref, request.mode_ref, request.requested_result_type,
        request.models, request.state, request.primitive, request.words, request.bindings,
        request.layout_elements, request.schedule_threads, request.schedule_clock_contract_ref,
        request.schedule_commutation_evidence_refs, request.focus_questions,
        request.schedule_query,
        request.node_bound, request.depth_bound, request.domain_bound, request.time_bound_ms))


def prepared_prefix_model(model, request, budget, need_material):
    cp = request.query_checkpoint
    if cp and cp.stage == "LAYOUT" and (cp.item_index > len(request.layout_elements) or len(cp.rows) != cp.item_index):
        raise PrefixPrerequisite("CURRENT_LAYOUT_CHECKPOINT_CURSOR_REQUIRED")
    work = cp.algorithm_state.get("work_frontier", FrozenMap()) if cp else FrozenMap()
    if (cp is not None and cp.stage in ("LAYOUT", "FOCUS", "SCHEDULE")
            and work.get("validated_model_ref") == model.model_ref and work.get("topology_cells") is not None):
        threads = {thread.thread_ref: thread for thread in model.threads}
        cells = {tuple(cell): tuple(parts) for cell, parts in work["topology_cells"]}
        material = {item.thread_ref: item for item in request.state.threads} if need_material else None
        return threads, cells, material
    if need_material:
        if request.state is None: raise PrefixPrerequisite("CURRENT_FULL_PREFIX_MATERIAL_REQUIRED")
        return _material(model, request.state, budget)
    threads, cells = _topology(model, budget)
    return threads, cells, None


def measure_prefix_layout(model, request, budget):
    if not request.layout_elements:
        raise PrefixPrerequisite("DECLARED_MULTI_SCALE_LAYOUT_ELEMENTS_MISSING")
    threads, cells, material = prepared_prefix_model(model, request, budget, request.state is not None)
    cp = request.query_checkpoint
    rows = list(cp.rows) if cp and cp.stage == "LAYOUT" else []
    start = cp.item_index if cp and cp.stage == "LAYOUT" else 0
    required = {"LOOM_CELL", "GUTTER", "THREAD_STUB", "PALETTE_BUTTON", "END_INDICATOR", "PROGRESS", "MINIATURE", "NEXT_INSERTION_CURSOR"}
    seen = {row["declared_kind_ref"] for row in rows}
    for index in range(start, len(request.layout_elements)):
        element = request.layout_elements[index]
        budget.visit({"query_stage": "LAYOUT", "query_item_index": index, "query_rows": tuple(rows),
            "validated_model_ref": model.model_ref, "topology_cells": tuple((cell, cells[cell]) for cell in sorted(cells)),
            "layout_element_ref": element.element_ref})
        if not element.role_evidence_refs or element.evidence_revision_ref != request.scope.evidence_revision_ref:
            raise PrefixPrerequisite("CURRENT_DECLARED_LAYOUT_ROLE_AND_REVISION_MISSING")
        if any(value <= 0 for value in element.scale) or element.pitch is not None and any(value <= 0 for value in element.pitch):
            raise PrefixPrerequisite("MEASURED_POSITIVE_LAYOUT_SCALE_AND_PITCH_REQUIRED")
        if element.thread_ref is not None and element.thread_ref not in threads:
            raise PrefixPrerequisite("CURRENT_LAYOUT_THREAD_IDENTITY_MISMATCH")
        if element.kind_ref == "NEXT_INSERTION_CURSOR":
            if material is None or element.thread_ref is None:
                raise PrefixPrerequisite("CURRENT_NEXT_INSERTION_THREAD_AND_PREFIX_REQUIRED")
            expected = len(material[element.thread_ref].layers)
            if element.next_crossing_index != expected:
                raise PrefixPrerequisite("CURSOR_IS_NEXT_PREFIX_CROSSING_NOT_OCCUPIED_MATERIAL")
        seen.add(element.kind_ref)
        x = tuple(pixel[0] for pixel in element.pixels)
        y = tuple(pixel[1] for pixel in element.pixels)
        rows.append(d_map({"element_ref": element.element_ref, "declared_kind_ref": element.kind_ref,
            "measured_bbox": (min(x), min(y), max(x), max(y)), "pixel_count": len(element.pixels),
            "scale": element.scale, "origin": element.origin, "pitch": element.pitch,
            "thread_ref": element.thread_ref, "next_crossing_index": element.next_crossing_index,
            "role_evidence_refs": element.role_evidence_refs}))
    if seen != required:
        raise PrefixPrerequisite("ALL_SEPARATELY_SCOPED_LOOM_PALETTE_PROGRESS_MINIATURE_CURSOR_COMPONENTS_REQUIRED")
    return {"layout_elements": tuple(rows), "thread_topology": tuple((ref, threads[ref].crossings) for ref in sorted(threads)),
        "crossing_identities": tuple(sorted(cells)), "target_projection": model.target,
        "native_control_supports": request.bindings, "cursor_is_not_movable_material": True}


def measure_prefix_focus(model, request, budget):
    if not request.focus_questions:
        raise PrefixPrerequisite("CURRENT_SOURCE_UNRESOLVED_CONSTRUCTION_QUESTION_REQUIRED")
    threads, cells, _ = prepared_prefix_model(model, request, budget, False)
    cp = request.query_checkpoint
    if cp and cp.stage == "FOCUS" and (cp.item_index > len(request.focus_questions) or len(cp.rows) != cp.item_index):
        raise PrefixPrerequisite("CURRENT_FOCUS_CHECKPOINT_CURSOR_REQUIRED")
    rows = list(cp.rows) if cp and cp.stage == "FOCUS" else []
    start = cp.item_index if cp and cp.stage == "FOCUS" else 0
    for index in range(start, len(request.focus_questions)):
        question = request.focus_questions[index]
        budget.visit({"query_stage": "FOCUS", "query_item_index": index, "query_rows": tuple(rows),
            "validated_model_ref": model.model_ref, "topology_cells": tuple((cell, cells[cell]) for cell in sorted(cells)),
            "question_ref": question.question_ref})
        if (not question.evidence_refs or any(ref not in threads for ref in question.thread_refs)
                or any(cell not in cells for cell in question.crossing_refs)):
            raise PrefixPrerequisite("CURRENT_FOCUS_QUESTION_TOPOLOGY_AND_EVIDENCE_REQUIRED")
        changed = tuple(key for key in sorted(set(question.before_values) | set(question.after_values))
            if question.before_values.get(key) != question.after_values.get(key))
        rows.append(d_map({"question_ref": question.question_ref, "kind_ref": question.kind_ref,
            "thread_refs": question.thread_refs, "crossing_refs": question.crossing_refs,
            "action_ref": question.action_ref, "changed_descriptive_fields": changed,
            "before_values": question.before_values, "after_values": question.after_values,
            "restoration_debt_refs": question.restoration_debt_refs, "evidence_refs": question.evidence_refs,
            "score_absence_is_not_absence_of_information": True}))
    return {"focus_question_facts": tuple(rows), "only_drm_judges_action_relevance": True,
        "only_src_changes_focus_counter_once": True, "kernel_does_not_control_execution_lease": True}


def dispatch_prefix_queries(request):
    rejected = d_validate_request(request)
    if rejected is not None: return rejected
    pair = (request.operation_ref, request.mode_ref)
    if pair == ("mechanics.layered_prefix_construction.prefix_schedule", "SEARCH"):
        return d_result(request, "NEEDS_EVIDENCE", "SOURCE_OWNED_EXISTING_SEARCH_QUERY_REQUIRED")
    if pair not in (("mechanics.layered_prefix_construction.layout_measure", "MEASURE"),
            ("mechanics.layered_prefix_construction.prefix_schedule", "DOMAIN"),
            ("mechanics.layered_prefix_construction.construction_focus", "RETAIN"),
            ("mechanics.layered_prefix_construction.construction_focus", "PROBE")):
        return d_result(request, "NOT_APPLICABLE", "SIGNATURE_MISMATCH")
    budget = DWorkBudget(request)
    digest = prefix_query_context_digest(request)
    cp = request.query_checkpoint
    if cp is not None and cp.context_digest != digest:
        return d_result(request, "NEEDS_EVIDENCE", "CURRENT_PREFIX_QUERY_CHECKPOINT_REQUIRED")
    expected_stage = {"layout_measure": "LAYOUT", "prefix_schedule": "SCHEDULE", "construction_focus": "FOCUS"}[request.operation_ref.rsplit(".", 1)[-1]]
    if cp is not None and cp.stage not in ("PREPARE", expected_stage):
        return d_result(request, "NEEDS_EVIDENCE", "CURRENT_PREFIX_QUERY_CHECKPOINT_STAGE_REQUIRED")
    if not request.models:
        return d_result(request, "NEEDS_EVIDENCE", "SCOPED_PREFIX_MODELS_MISSING")
    completed = list(cp.algorithm_state.get("completed_models", ())) if cp else []
    model_index = cp.model_index if cp else 0
    if model_index > len(request.models) or len(completed) != model_index:
        return d_result(request, "NEEDS_EVIDENCE", "PREFIX_QUERY_MODEL_CURSOR_MISMATCH")
    if tuple(row["model_ref"] for row in completed) != tuple(model.model_ref for model in request.models[:model_index]):
        return d_result(request, "NEEDS_EVIDENCE", "PREFIX_QUERY_COMPLETED_MODEL_SCOPE_MISMATCH")
    try:
        active_cp = cp
        for index in range(model_index, len(request.models)):
            model = request.models[index]
            active_cp = cp if index == (cp.model_index if cp else 0) else None
            operation = request.operation_ref.rsplit(".", 1)[-1]
            view = request if index == model_index else request.model_copy(update={"query_checkpoint": None})
            if operation == "layout_measure":
                result = measure_prefix_layout(model, view, budget)
            elif operation == "construction_focus":
                result = measure_prefix_focus(model, view, budget)
            elif operation == "prefix_schedule":
                result = measure_prefix_schedule(model, view, budget)
            else:
                return d_result(request, "NOT_APPLICABLE", "SIGNATURE_MISMATCH")
            completed.append(d_map({"model_ref": model.model_ref, "result": d_map(result)}))
            model_index = index + 1
        budget.finish()
        return d_result(request, "OK", "EXACT_PREFIX_QUERY_RESULT",
            values={"model_correlated_results": tuple(completed), "primitive_release_authorized": False,
                "total_examined_count": (cp.examined_count if cp else 0) + budget.examined},
            complete=request.scope.input_domain_complete, examined=budget.examined)
    except PrefixPrerequisite as error:
        return d_result(request, "NEEDS_EVIDENCE", str(error), examined=budget.examined,
            values={"completed_model_results": tuple(completed)})
    except DComputationInterrupted as error:
        frontier = error.frontier
        checkpoint = PrefixQueryCheckpointC(context_digest=digest, model_index=model_index,
            stage=frontier.get("query_stage", active_cp.stage if active_cp else "PREPARE"),
            item_index=frontier.get("query_item_index", active_cp.item_index if active_cp else 0),
            candidate_index=frontier.get("candidate_index", active_cp.candidate_index if active_cp else 0),
            state=frontier.get("query_state", active_cp.state if active_cp else d_map(request.state) if request.state is not None else FrozenMap()),
            rows=frontier.get("query_rows", active_cp.rows if active_cp else ()),
            algorithm_state=d_map({"completed_models": tuple(completed), "work_frontier": frontier
                if "query_stage" in frontier else active_cp.algorithm_state.get("work_frontier", frontier) if active_cp else frontier}),
            examined_count=(cp.examined_count if cp else 0) + budget.examined)
        return d_result(request, "BOUND_REACHED", error.cause, examined=budget.examined,
            values={"completed_model_results": tuple(completed)},
            frontier={"query_checkpoint": d_map(checkpoint), "caller_next_item_ref": request.scope.caller_next_item_ref})


def measure_prefix_schedule(model, request, budget):
    if request.state is None or not request.words:
        raise PrefixPrerequisite("CURRENT_FULL_PREFIX_STATE_AND_SOURCE_WORD_DOMAIN_REQUIRED")
    if request.schedule_clock_contract_ref is None:
        raise PrefixPrerequisite("CURRENT_SCHEDULE_EFFECT_AND_CLOCK_CONTRACT_REQUIRED")
    threads, topology_cells, initial = prepared_prefix_model(model, request, budget, True)
    required = {item.thread_ref: item for item in request.schedule_threads}
    if len(required) != len(request.schedule_threads) or set(required) != set(threads):
        raise PrefixPrerequisite("EXACT_CURRENT_THREAD_PREFIX_COLOR_REQUIREMENTS")
    for ref in sorted(required):
        item = required[ref]
        if (not item.preparation_evidence_refs or item.final_color not in threads[ref].color_domain
                or len(item.required_layers) != len(threads[ref].crossings)
                or any(layer not in (0, 1) for layer in item.required_layers)
                or item.required_layers[:len(initial[ref].layers)] != initial[ref].layers):
            raise PrefixPrerequisite("SUPPORTED_FULL_THREAD_TARGET_WITH_EXISTING_PREFIX_PRESERVED")
    cp = request.query_checkpoint
    work = cp.algorithm_state.get("work_frontier", FrozenMap()) if cp and cp.stage == "SCHEDULE" else FrozenMap()
    if cp and cp.stage == "SCHEDULE" and (cp.candidate_index > len(request.words)
            or len(cp.rows) != cp.candidate_index
            or cp.candidate_index < len(request.words) and cp.item_index > len(request.words[cp.candidate_index])):
        raise PrefixPrerequisite("CURRENT_SCHEDULE_CHECKPOINT_CURSOR_REQUIRED")
    candidate_index = cp.candidate_index if cp and cp.stage == "SCHEDULE" else 0
    step_index = cp.item_index if cp and cp.stage == "SCHEDULE" else 0
    rows = list(cp.rows) if cp and cp.stage == "SCHEDULE" else []
    state = PrefixState.model_validate(cp.state) if cp and cp.stage == "SCHEDULE" and cp.state else request.state
    events = list(work.get("word_events", ()))
    word_cost = work.get("word_cost", 0)
    def frontier(index, step):
        return {"query_stage": "SCHEDULE", "candidate_index": index, "query_item_index": step,
            "validated_model_ref": model.model_ref, "topology_cells": tuple((cell, topology_cells[cell]) for cell in sorted(topology_cells)),
            "query_rows": tuple(rows), "query_state": d_map(state), "word_events": tuple(events),
            "word_cost": word_cost}
    for index in range(candidate_index, len(request.words)):
        word = request.words[index]
        if len(word) > request.depth_bound:
            raise DComputationInterrupted("SCHEDULE_PRIMITIVE_DEPTH_BOUND", d_map(frontier(index, step_index)))
        for step in range(step_index, len(word)):
            primitive = word[step]
            budget.visit(frontier(index, step))
            if primitive.kind_ref == "click" and primitive.thread_ref in required:
                material = {item.thread_ref: item for item in state.threads}
                current = material[primitive.thread_ref]
                if (state.active_thread_ref == primitive.thread_ref and primitive.palette_index is not None
                        and primitive.palette_index < len(current.palette)
                        and current.palette[primitive.palette_index] == current.color):
                    raise PrefixPrerequisite("DECORATIVE_PRESELECTED_ALREADY_CORRECT_CLICK_NOT_PART_OF_SCHEDULE")
            # Unsealed primitive may restart only from this immutable before.
            before = state
            try:
                expansion = _external(model, before, primitive, request, budget)
            except DComputationInterrupted as error:
                raise DComputationInterrupted(error.cause, d_map(frontier(index, step))) from error
            state = expansion["state"]
            actual = {item.thread_ref: item for item in state.threads}
            if any(actual[ref].layers != required[ref].required_layers[:len(actual[ref].layers)] for ref in sorted(required)):
                raise PrefixPrerequisite("SCHEDULE_INSERTION_MUST_PRESERVE_EACH_THREAD_REQUIRED_ORDER")
            word_cost += expansion["event_ledger"]["debit"]
            events.append(d_map({"primitive_index": step, "primitive": d_map(primitive),
                "before_state": d_map(before), "after_state": d_map(state), "native_expansion": d_map(expansion)}))
            step_index = step + 1
            if state.terminated and step_index < len(word):
                raise PrefixPrerequisite("NO_SCHEDULE_INPUT_AFTER_NATIVE_TERMINATION")
        actual = {item.thread_ref: item for item in state.threads}
        satisfies = all(actual[ref].color == required[ref].final_color
            and actual[ref].layers == required[ref].required_layers for ref in sorted(required))
        rows.append(d_map({"word_index": index, "word": word, "state": state,
            "exact_expanded_cost": word_cost, "primitive_count": len(word), "native_events": tuple(events),
            "whole_thread_or_interleaved_order_preserved": True, "requirements_satisfied": satisfies,
            "selectable_colors": tuple((ref, actual[ref].palette) for ref in sorted(actual)),
            "commutation_not_inferred": not bool(request.schedule_commutation_evidence_refs)}))
        state, step_index, events, word_cost = request.state, 0, [], 0
    return {"legal_word_domain": tuple(rows), "minimum_cost_claimed": False,
        "domain_scope": "supplied_complete_words_only", "clock_contract_ref": request.schedule_clock_contract_ref,
        "commutation_evidence_refs": request.schedule_commutation_evidence_refs,
        "search_query": request.schedule_query if request.mode_ref == "SEARCH" else None,
        "search_is_source_owned": request.mode_ref == "SEARCH"}
