"""K79 parent WHY and operation admissibility; native calculation stays shared."""
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest, immutable_json_data
from .layered_prefix_construction import LayeredPrefixRequest
from .mechanical_family_contracts_d import d_map
from .mechanical_profile_d import measure_d_native_profile
from .family_agenda_projection import project_family_agenda, demand_signature
from .prefix_solving_contracts_c import (PrefixSolvingFactsC, PrefixSolvingBindInputC,
    PrefixSolvingFinishInputC, PrefixSolvingReturnC)

def measure_prefix_one_step_domain(model, commitments, inverse_solutions, current_colors, node_bound):
    """Project every supported next layer/color, without selecting a construction.

    This is a finite projection of an already returned K79 domain. It neither
    orders threads nor binds native commands, and asserts no resource reserve.
    """
    threads = {t.thread_ref:t for t in model.threads}
    present = {p.thread_ref:p.layers for p in commitments}
    incomplete = FrozenMap({'complete':False,'layer_rows':(),'color_rows':()})
    if (set(present)!=set(threads) or len(present)!=len(commitments)
            or set(current_colors)!=set(threads)
            or any(len(present[ref])>len(threads[ref].crossings) for ref in sorted(threads))):
        return incomplete
    layers, colors, examined = {}, {}, 0
    differences = []
    for world in inverse_solutions:
        palette = dict(world['global_thread_colors'])
        crossings = {row['cell']:row for row in world['crossing_domains']}
        if set(palette)!=set(threads):
            return incomplete
        difference = sum(palette[ref]!=current_colors[ref] for ref in sorted(threads))
        differences.append(difference)
        for ref in sorted(threads):
            examined += 1
            if examined > node_bound:
                return incomplete
            color_key = (ref,palette[ref])
            colors.setdefault(color_key,[]).append(difference)
            length = len(present[ref])
            if length==len(threads[ref].crossings):
                continue
            cell = threads[ref].crossings[length]
            if cell not in crossings:
                return incomplete
            bits = {bit for option in crossings[cell]['complementary_layer_domain']
                for owner,bit in option if owner==ref}
            for bit in sorted(bits):
                layers.setdefault((ref,palette[ref],bit),[]).append(difference)
    def rows(values, layer):
        return tuple(d_map({'thread_ref':key[0],'color':key[1],
            **({'layer':key[2]} if layer else {}),
            'supporting_world_count':len(values[key]),
            'minimum_current_color_difference_count':min(values[key])})
            for key in sorted(values))
    return d_map({'complete':True,'layer_rows':rows(layers,True),
        'color_rows':rows(colors,False),'examined':examined,
        'minimum_current_color_difference_count':min(differences) if differences else None,
        'inserted_layer_count':sum(len(present[ref]) for ref in sorted(present)),
        'required_layer_count':sum(len(threads[ref].crossings) for ref in sorted(threads))})

def measure_prefix_native_word_domain(model, commitments, inverse_solutions,
        current_colors, active_ref, direction_bindings, maximum_color_difference,
        node_bound, maximum_word_primitives, minimum_prefix_primitives=2):
    """First deterministic complete-prefix witness for each supplied first input.

    The returned K79 worlds already fix global colors and independent crossing
    domains. This is a finite projection of those worlds, not another solver.
    No palette click, clock, reserve or terminal-acceptance law is inferred.
    Admission and release of any returned witness belong to DRM/SRC.
    """
    incomplete = d_map({'complete': False, 'words': (), 'examined': 0})
    threads = {t.thread_ref: t for t in model.threads}
    present = {p.thread_ref: p.layers for p in commitments}
    if (model.layer_law_ref != 'binary_complementary_layers_top_is_one'
            or active_ref not in threads or set(present) != set(threads)
            or len(present) != len(commitments) or set(current_colors) != set(threads)
            or maximum_color_difference is None):
        return incomplete
    remaining = threads[active_ref].crossings[len(present[active_ref]):]
    if not minimum_prefix_primitives <= len(remaining) <= maximum_word_primitives:
        return d_map({'complete': True, 'words': (), 'examined': 0})
    # Bindings are current measured native directions supplied by the caller.
    # An ambiguous or missing binding is not resolved by choosing an action.
    by_bit = {}
    for action_ref, delta in direction_bindings:
        bits = tuple(bit for axis, direction, bit in model.direction_layers
            if axis == threads[active_ref].axis_ref and direction == delta)
        if len(bits) == 1:
            by_bit.setdefault(bits[0], set()).add(action_ref)
    bound = {bit: tuple(sorted(refs))[0] for bit, refs in sorted(by_bit.items()) if len(refs) == 1}
    words, examined = {}, 0
    for world in inverse_solutions:
        palette = dict(world['global_thread_colors'])
        if set(palette) != set(threads):
            return incomplete
        if (palette[active_ref] != current_colors[active_ref]
                or sum(palette[ref] != current_colors[ref] for ref in sorted(threads))
                    != maximum_color_difference):
            continue
        crossings = {row['cell']: row for row in world['crossing_domains']}
        domains = []
        for cell in remaining:
            examined += 1
            if examined > node_bound or cell not in crossings:
                return incomplete
            bits = tuple(sorted({bit
                for option in crossings[cell]['complementary_layer_domain']
                for owner, bit in option if owner == active_ref and bit in bound}))
            if not bits:
                break
            domains.append(bits)
        if len(domains) != len(remaining):
            continue
        world_digest = None
        for first in domains[0]:
            action_ref = bound[first]
            if action_ref in words:
                continue
            layers = (first,) + tuple(bits[0] for bits in domains[1:])
            actions = tuple(bound[bit] for bit in layers)
            if world_digest is None:
                world_digest = stable_digest(world)
            words[action_ref] = d_map({
                'action_refs': actions, 'layers': layers,
                'before_layers': present[active_ref],
                'after_layers': present[active_ref] + layers,
                'thread_ref': active_ref, 'color': current_colors[active_ref],
                'supporting_world_digest': world_digest,
                'all_prefixes_preserve_current_inverse_world': True,
                'clock_or_resource_model_claimed': False})
    return d_map({'complete': True, 'words': tuple(words[ref] for ref in sorted(words)),
        'examined': examined})


def measure_multi_prefix_native_paths(model, commitments, inverse_solutions,
        current_colors, active_ref, direction_bindings, point_bindings,
        minimum_color_difference, node_bound, maximum_path_primitives):
    """Project bounded mixed words from existing correlated K79 worlds.

    Each crossing receives one complementary assignment shared by both owners.
    Future selections must already have an exact measured native point binding.
    This constructs witnesses; DRM admits them and Source releases the series.
    No clock, resource, interface persistence or terminal law is invented here.
    """
    incomplete = d_map({'complete': False, 'paths': (), 'examined': 0})
    threads = {t.thread_ref: t for t in model.threads}
    present = {p.thread_ref: p.layers for p in commitments}
    if (model.layer_law_ref != 'binary_complementary_layers_top_is_one'
            or active_ref not in threads or set(present) != set(threads)
            or len(present) != len(commitments) or set(current_colors) != set(threads)
            or minimum_color_difference is None):
        return incomplete
    native = {}
    for axis in sorted({t.axis_ref for t in model.threads}):
        options = {}
        for action_ref, delta in direction_bindings:
            for bound_axis, direction, bit in model.direction_layers:
                if bound_axis == axis and direction == delta:
                    options.setdefault(bit, set()).add(action_ref)
        if set(options) != {0, 1} or any(len(v) != 1 for _bit, v in sorted(options.items())):
            return incomplete
        native[axis] = {bit: next(iter(refs)) for bit, refs in sorted(options.items())}
    owners, fixed = {}, {}
    for ref, thread in sorted(threads.items()):
        if len(present[ref]) > len(thread.crossings):
            return incomplete
        for index, cell in enumerate(thread.crossings):
            owners.setdefault(cell, set()).add(ref)
            if index < len(present[ref]):
                fixed.setdefault(cell, {})[ref] = present[ref][index]
    if any(len(v) != 2 for _cell, v in sorted(owners.items())):
        return incomplete
    # A first direction remains tied to the currently active measured owner.
    first_inputs = [(action, action, None, active_ref, None)
                    for action, _delta in direction_bindings]
    first_inputs.extend(point_bindings)
    paths, examined = {}, 0
    for world in inverse_solutions:
        palette = dict(world['global_thread_colors'])
        if (set(palette) != set(threads)
                or sum(palette[ref] != current_colors[ref] for ref in sorted(threads))
                    != minimum_color_difference):
            continue
        crossings = {row['cell']: row for row in world['crossing_domains']}
        if set(crossings) != set(owners):
            return incomplete
        # Only the first crossing constraint varies between first inputs.
        # Keep these measurements local to this exact returned world; no
        # result is reused across frames, models or caller invocations.
        ordered_crossings = tuple(sorted(crossings.items()))
        fixed_options, world_digest = {}, None
        for first_key, first_action, first_point, first_ref, first_color in first_inputs:
            if first_point is not None and palette[first_ref] != first_color:
                continue
            forced = {}
            if first_point is None:
                remaining = threads[first_ref].crossings[len(present[first_ref]):]
                if not remaining or palette[first_ref] != current_colors[first_ref]:
                    continue
                bits = [bit for bit, action in sorted(native[threads[first_ref].axis_ref].items())
                        if action == first_action]
                if len(bits) != 1:
                    continue
                forced[remaining[0]] = {first_ref: bits[0]}
            assignment = {}
            for cell, row in ordered_crossings:
                examined += 1
                if examined > node_bound:
                    return d_map({'complete': False, 'paths': (), 'examined': examined})
                if cell not in fixed_options:
                    options = []
                    for option in row['complementary_layer_domain']:
                        values = dict(option)
                        if (set(values) == owners[cell] and set(values.values()) == {0, 1}
                                and all(values[ref] == bit for ref, bit in sorted(fixed.get(cell, {}).items()))):
                            options.append(tuple(sorted(values.items())))
                    fixed_options[cell] = tuple(options)
                allowed = tuple(option for option in fixed_options[cell]
                    if all((ref, bit) in option for ref, bit in sorted(forced.get(cell, {}).items())))
                if not allowed:
                    break
                assignment[cell] = dict(min(allowed))
            if set(assignment) != set(crossings):
                continue
            after = {ref: tuple(assignment[cell][ref] for cell in thread.crossings)
                     for ref, thread in sorted(threads.items())}
            if any(after[ref][:len(present[ref])] != present[ref] for ref in sorted(threads)):
                continue
            outstanding = tuple(ref for ref in sorted(threads)
                if len(present[ref]) < len(after[ref]) or palette[ref] != current_colors[ref])
            if len(outstanding) < 2 or first_ref not in outstanding:
                continue
            order = (first_ref,) + tuple(ref for ref in outstanding if ref != first_ref)
            actions, payloads, control_refs = [], [], []
            bound = True
            for index, ref in enumerate(order):
                if index == 0 and first_point is None:
                    pass
                else:
                    points = [p for p in point_bindings if p[3] == ref and p[4] == palette[ref]]
                    if index == 0:
                        points = [p for p in points if p[0] == first_key]
                    if not points:
                        bound = False
                        break
                    key, action, (r, c), _ref, _color = min(points)
                    actions.append(action)
                    payloads.append(d_map({'x': c, 'y': r}))
                    control_refs.append(key)
                for bit in after[ref][len(present[ref]):]:
                    actions.append(native[threads[ref].axis_ref][bit])
                    payloads.append(d_map({}))
            if (not bound or not actions or actions[0] != first_action
                    or not 2 <= len(actions) <= maximum_path_primitives):
                continue
            if first_key in paths and len(paths[first_key]['action_refs']) <= len(actions):
                continue
            if world_digest is None:
                world_digest = stable_digest(world)
            paths[first_key] = d_map({'first_input_ref': first_key,
                'action_refs': tuple(actions), 'action_payloads': tuple(payloads),
                'thread_order': order, 'control_candidate_refs': tuple(control_refs),
                'before_prefixes': tuple(sorted(present.items())),
                'after_prefixes': tuple(sorted(after.items())),
                'after_colors': tuple(sorted(palette.items())),
                'supporting_world_digest': world_digest,
                'all_prefixes_preserve_current_inverse_world': True,
                'clock_or_resource_model_claimed': False})
    return d_map({'complete': True, 'paths': tuple(paths[k] for k in sorted(paths)),
                 'examined': examined})


def measure_prefix_solving(request, canonical_rows):
    profile, agenda, demand = request.profile, request.agenda, request.demand
    native = profile.native_request
    missing, reasons = [], []
    if not isinstance(native, LayeredPrefixRequest):
        return PrefixSolvingFactsC(frozen_input=request, facts=FrozenMap({"current_prefix_question": False,
            "query_bridge_case": False}), construction_reasons=(), missing_refs=("exact_K79_native_profile",))
    closure = measure_d_native_profile(profile)
    missing.extend(closure.missing_refs)
    if (native.operation_ref, native.mode_ref) not in native.signature_pairs:
        missing.append("registered_exact_prefix_operation_mode")
    if (profile.profile_ref != "solving.layered_prefix_construction" or demand.request != profile.common_identity
            or demand not in agenda.demands or demand.parent_goal_ref != profile.parent_goal_ref
            or demand.consumer_ref != native.scope.parent_consumer_ref or demand.scope_ref != profile.scope_ref
            or demand.episode_ref != profile.episode_ref or demand.level_scope_ref != profile.level_scope_ref):
        missing.append("exact_current_prefix_parent_demand")
    if (len(canonical_rows) != 1 or canonical_rows[0].get("family_agenda") != immutable_json_data(agenda)
            or not canonical_rows[0].get("supported_agenda_claim_refs")):
        missing.append("canonical_prefix_parent_agenda")
    matching = tuple(row for row in project_family_agenda(agenda)["rows"]
        if row["signature_ref"] == demand_signature(demand)
        and row["demand"]["request"]["request_ref"] == demand.request.request_ref)
    if (len(matching) != 1 or not matching[0]["owner_current"] or not matching[0]["current_inputs_bound"]
            or not matching[0]["prerequisites_current"] or matching[0]["conflicting_current_returns"]
            or matching[0]["consumed_current_signature"]):
        missing.append("next_prerequisite_satisfied_unconsumed_prefix_question")
    contract = request.terminal_contract
    targets = FrozenMap({model.model_ref: stable_digest((model.target_origin, model.target)) for model in native.models})
    lengths = FrozenMap({model.model_ref: tuple((thread.thread_ref, len(thread.crossings)) for thread in model.threads)
        for model in native.models})
    if (not native.models or len({model.model_ref for model in native.models}) != len(native.models)
            or not contract.quantifier_evidence_refs or not contract.persistence_evidence_refs or not contract.event_evidence_refs
            or contract.evidence_revision_ref != native.scope.evidence_revision_ref
            or contract.model_target_digests != targets or contract.required_prefix_lengths != lengths
            or profile.desired_future.get("terminal_contract_digest") != stable_digest(contract)):
        missing.append("independently_grounded_all_prefixes_AND_projection_contract")
    if len({item.model_ref for item in request.construction_witnesses}) != len(request.construction_witnesses):
        missing.append("one_source_selected_construction_per_retained_model")
    work = sum(len(thread.crossings) for model in native.models for thread in model.threads)
    work += sum(len(row["result"].get("coherent_global_solutions", ()))
        for contribution in request.inverse_returns if contribution.native_result is not None
        for row in contribution.native_result.values.get("model_correlated_results", ())
        if isinstance(row.get("result"), FrozenMap))
    if work > native.node_bound:
        return PrefixSolvingFactsC(frozen_input=request, facts=FrozenMap({"current_prefix_question": False,
            "query_bridge_case": False}), construction_reasons=(),
            missing_refs=tuple(sorted(set((*missing, "prefix_strategy_preparation_work_bound")))))
    for selection in request.construction_witnesses:
        models = tuple(model for model in native.models if model.model_ref == selection.model_ref)
        if len(models) != 1 or not selection.current_selection_evidence_refs or native.state is None:
            missing.append("current_supported_construction_selection")
            continue
        model = models[0]
        colors = dict(selection.global_thread_colors)
        owners = dict(selection.crossing_owners)
        supports = []
        for contribution in request.inverse_returns:
            result = contribution.native_result
            if (result is not None and result.status == "OK" and result.domain_complete
                    and isinstance(contribution.request.native_request, LayeredPrefixRequest)
                    and result.scope.epoch == native.scope.epoch
                    and result.scope.model_revision_ref == native.scope.model_revision_ref
                    and result.scope.evidence_revision_ref == native.scope.evidence_revision_ref
                    and result.operation_ref in ("mechanics.layered_prefix_construction.occlusion_preimages",
                        "mechanics.layered_prefix_construction.fixed_layer_repair")
                    and (not result.operation_ref.endswith(".fixed_layer_repair")
                        or contribution.request.native_request.state == native.state)
                    and contribution.request.native_request.models == native.models):
                supports.extend(solution for row in result.values.get("model_correlated_results", ())
                    if row["model_ref"] == model.model_ref
                    for solution in row["result"].get("coherent_global_solutions", ())
                    if solution["global_thread_colors"] == selection.global_thread_colors)
        if (not supports or len(colors) != len(selection.global_thread_colors)
                or len(owners) != len(selection.crossing_owners)):
            missing.append("current_complete_inverse_domain_support")
            continue
        solution = supports[0]
        domains = {row["cell"]: row for row in solution["crossing_domains"]}
        if set(owners) != set(domains) or any(owners[cell] not in domains[cell]["top_owner_domain"] for cell in sorted(owners)):
            missing.append("each_current_crossing_owner_in_supported_joint_color_domain")
            continue
        material = {item.thread_ref: item for item in native.state.threads}
        layers, reservations = [], []
        for thread in model.threads:
            required = tuple(1 if owners[cell] == thread.thread_ref else 0 for cell in thread.crossings)
            present = material.get(thread.thread_ref)
            if (thread.thread_ref not in colors or present is None or colors[thread.thread_ref] not in thread.color_domain
                    or present.layers != required[:len(present.layers)]):
                missing.append("preserve_inserted_prefix_or_request_fixed_layer_color_repair")
                break
            layers.append((thread.thread_ref, colors[thread.thread_ref], required))
            for index, cell in enumerate(thread.crossings):
                if index >= len(present.layers):
                    reservations.append((thread.thread_ref, index, cell, required[index], 1-required[index]))
        else:
            reasons.append(d_map({"model_ref": model.model_ref, "global_thread_colors": selection.global_thread_colors,
                "crossing_owners": selection.crossing_owners, "thread_prefix_requirements": tuple(layers),
                "opposite_partner_reservations": tuple(reservations), "existing_prefix_irreversible": True,
                "goal_requires_coverage_AND_projection": True, "hidden_author_decomposition_not_required": True,
                "palette_binding_must_follow_current_selected_color": True}))
    bridge_case = native.operation_ref.rsplit(".", 1)[-1] in ("layout_measure", "prefix_schedule", "construction_focus")
    if bridge_case and (request.query_bridge is None or request.query_bridge.request != native):
        missing.append("exact_existing_prefix_query_source_bridge")
    if native.operation_ref.endswith(".prefix_schedule"):
        if native.mode_ref == "SEARCH" and (native.schedule_query is None
                or native.schedule_query.request.immutable_inputs.get("prefix_terminal_contract_digest") != stable_digest(contract)):
            missing.append("same_grounded_terminal_contract_in_source_search_query")
        if not reasons or {row["model_ref"] for row in reasons} != {model.model_ref for model in native.models}:
            missing.append("compatible_construction_reason_for_every_retained_model")
        for reason in reasons:
            actual = {item.thread_ref: (item.final_color, item.required_layers) for item in native.schedule_threads}
            expected = {ref: (color, layers) for ref, color, layers in reason["thread_prefix_requirements"]}
            if len(actual) != len(native.schedule_threads) or actual != expected:
                missing.append("schedule_bound_to_derived_irreversible_prefix_requirements")
    return PrefixSolvingFactsC(frozen_input=request,
        facts=FrozenMap({"current_prefix_question": not bool(missing), "query_bridge_case": bridge_case}),
        construction_reasons=tuple(reasons), missing_refs=tuple(sorted(set(missing))))

def bind_prefix_solving_profile(value: PrefixSolvingBindInputC):
    return value.measured.frozen_input.profile

def bind_prefix_solving_query(value: PrefixSolvingBindInputC):
    return value.measured.frozen_input.query_bridge

def finish_prefix_solving(value: PrefixSolvingFinishInputC) -> PrefixSolvingReturnC:
    measured = value.measured
    witnesses = []
    query = value.query_return
    if query is not None and query.search is not None and query.search.status == "FOUND":
        search = query.search.descriptive_values.get("measurement", FrozenMap())
        witnesses.extend(search.get("witnesses", ())[:3])
    elif query is not None and query.native is not None and query.native.domain_complete:
        rows = query.native.values.get("model_correlated_results", ())
        retained = {model.model_ref for model in measured.frozen_input.profile.native_request.models}
        if {row["model_ref"] for row in rows} == retained:
            words = measured.frozen_input.profile.native_request.words
            for index, word in enumerate(words):
                correlated = tuple((row["model_ref"], candidate) for row in rows
                    for candidate in row["result"].get("legal_word_domain", ()) if candidate["word_index"] == index)
                if len(correlated) == len(retained) and all(candidate["requirements_satisfied"] for _, candidate in correlated):
                    witnesses.append(d_map({"primitive_word": word, "model_correlated_effects": correlated,
                        "coverage_and_goal_supported_in_all_retained_models": True, "minimum_claimed": False}))
                if len(witnesses) == 3:
                    break
    return PrefixSolvingReturnC(frozen_measurement=measured, profile_return=value.profile_return,
        query_return=value.query_return, next_item_ref=measured.frozen_input.profile.next_item_ref,
        sibling_item_refs=measured.frozen_input.profile.sibling_item_refs, root_witnesses=tuple(witnesses))
