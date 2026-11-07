"""Measured layers and bounded supplied words through existing D mechanics."""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import stable_digest
from .supported_construction import ConstructionState, ConstructionPrerequisite, _external
from .scene_layer_measurement_d import measure_scene_layers_d
from .mechanical_family_contracts_d import DWorkBudget, DComputationInterrupted, DResumeMismatch, d_input_digest, d_result, d_map, d_resumable_frontier


def measure_construction_extension_a(request):
    budget, work = DWorkBudget(request), {}
    try:
        operation = request.operation_ref.rsplit('.', 1)[-1]
        if not request.source_identity_ref:
            raise ConstructionPrerequisite('CURRENT_SOURCE_IDENTITY_REQUIRED')
        phase = 'CONSTRUCTION_SCENE' if operation == 'layout_measure' else 'CONSTRUCTION_WORDS'
        work['phase'] = phase
        saved = {}
        if request.resume_frontier:
            if request.resume_frontier.get('input_digest') != d_input_digest(request):
                raise DResumeMismatch('CONSTRUCTION_SOURCE_INPUT_OR_REVISION_RESUME_MISMATCH')
            saved = request.resume_frontier.get('work_frontier', {})
            if saved.get('phase') != phase:
                raise DResumeMismatch('EXACT_CONSTRUCTION_EXTENSION_RESUME_PHASE_REQUIRED')
        if operation == 'layout_measure':
            scene = request.scene_input
            if scene is None:
                raise ConstructionPrerequisite('CURRENT_CALIBRATED_CONSTRUCTION_SCENE_QUESTIONS_REQUIRED')
            refs = tuple(q.layer_ref for q in scene.questions)
            if (len(set(refs)) != len(refs) or {f.layer_ref for f in scene.facets} != set(refs)
                    or len({f.facet_ref for f in scene.facets}) != len(scene.facets)
                    or any(bool(f.measured_quantity_ref) != bool(f.quantity_calibration_evidence_ref) for f in scene.facets)):
                raise ConstructionPrerequisite('SEPARATE_LAYER_AND_EXPLICIT_QUANTITY_CALIBRATION_DOMAINS_REQUIRED')
            layers = list(saved.get('layers', ()))
            if len(layers) > len(refs) or tuple(r.get('layer_ref') for r in layers) != refs[:len(layers)]:
                raise DResumeMismatch('EXACT_COMPLETED_CONSTRUCTION_LAYER_PREFIX_REQUIRED')
            work['layers'] = layers
            for question in scene.questions[len(layers):]:
                row, = measure_scene_layers_d(scene.frame, scene.calibrations, (question,), scene.occlusions, budget)
                layers.append(row)
            values = {'layers': tuple(layers), 'source_declared_facets': scene.facets,
                'missing_support_refs': scene.missing_support_refs,
                'beam_fill_distinct_from_resultant_and_tipping_markers': True,
                'external_load_stress_not_implicitly_total_utilization': True,
                'quantity_not_read_from_decorative_color': True,
                'support_stock_control_roles_not_selected': True}
        elif operation == 'prefix_plan' and request.mode_ref == 'DOMAIN':
            if request.state is None or not request.models or not request.words:
                raise ConstructionPrerequisite('CURRENT_JOINT_STOCK_STATE_MODELS_AND_SUPPLIED_WORD_DOMAIN_REQUIRED')
            model_refs = tuple(m.model_ref for m in request.models)
            if len(set(model_refs)) != len(model_refs):
                raise ConstructionPrerequisite('UNIQUE_CURRENT_CONSTRUCTION_MODEL_DOMAIN_REQUIRED')
            rows = list(saved.get('rows', ()))
            if len(rows) > len(model_refs) or tuple(r.get('model_ref') for r in rows) != model_refs[:len(rows)]:
                raise DResumeMismatch('EXACT_COMPLETED_CONSTRUCTION_MODEL_PREFIX_REQUIRED')
            work['rows'] = rows
            partial = saved.get('partial', {})
            for model in request.models[len(rows):]:
                word_rows = list(partial.get('word_rows', ())) if partial.get('model_ref') == model.model_ref else []
                if len(word_rows) > len(request.words) or any(r.get('word_digest') != stable_digest(w) for r, w in zip(word_rows, request.words)):
                    raise DResumeMismatch('EXACT_COMPLETED_CONSTRUCTION_WORD_PREFIX_REQUIRED')
                for word in request.words[len(word_rows):]:
                    digest = stable_digest(word)
                    resumed = partial.get('model_ref') == model.model_ref and partial.get('word_digest') == digest
                    state = ConstructionState.model_validate(partial['state']) if resumed else request.state
                    index = partial.get('next_primitive_index', 0) if resumed else 0
                    native = list(partial.get('native_word', ())) if resumed else []
                    effects = list(partial.get('sealed_effects', ())) if resumed else []
                    cost = partial.get('expanded_input_cost', 0) if resumed else 0
                    first_unstable = partial.get('first_unstable_prefix_index') if resumed else None
                    if type(index) is not int or not 0 <= index <= len(word) or len(native) != index or len(effects) != index:
                        raise DResumeMismatch('EXACT_CONSTRUCTION_WORD_INDEX_AND_PREFIX_RECEIPTS_REQUIRED')
                    while index < len(word) and not state.terminated:
                        work['partial'] = {'model_ref': model.model_ref, 'word_digest': digest,
                            'word_rows': tuple(word_rows), 'state': state, 'next_primitive_index': index,
                            'native_word': tuple(native), 'sealed_effects': tuple(effects),
                            'expanded_input_cost': cost, 'first_unstable_prefix_index': first_unstable}
                        if index >= request.depth_bound or len(effects) >= request.domain_bound:
                            raise DComputationInterrupted('CONSTRUCTION_PREFIX_DEPTH_OR_EFFECT_DOMAIN_BOUND', d_map())
                        budget.visit({'model_ref': model.model_ref, 'word_digest': digest, 'primitive_index': index})
                        primitive = word[index]
                        matches = tuple(b for b in request.bindings if b.primitive == primitive
                            and b.evidence_revision_ref == request.scope.evidence_revision_ref)
                        if len(matches) != 1 or primitive.kind_ref in ('point', 'select_width') and not matches[0].support_ref:
                            raise ConstructionPrerequisite('CURRENT_NATIVE_PREFIX_CONTROL_OR_SUPPORT_BINDING_REQUIRED')
                        result = _external(model, state, primitive, request, budget)
                        state = result['state']
                        if result.get('closure_facts', {}).get('actual_failure_adapter_applied') is True and first_unstable is None:
                            first_unstable = index
                        native.append(d_map({'action_ref': matches[0].action_ref, 'payload': matches[0].payload,
                            'support_ref': matches[0].support_ref}))
                        effects.append(d_map(result)); cost += result['event_ledger']['debit']; index += 1
                    word_rows.append(d_map({'word_digest': digest, 'native_word': tuple(native), 'sealed_effects': tuple(effects),
                        'state': state, 'expanded_input_cost': cost, 'word_complete': index == len(word),
                        'archive_only_suffix_count': len(word) - index, 'first_unstable_prefix_index': first_unstable,
                        'constructible_without_failure_adapter': first_unstable is None,
                        'native_word_is_not_build_order_optimality': True, 'primitive_release_authorized': False}))
                    partial = {}; work['partial'] = {'model_ref': model.model_ref, 'word_rows': tuple(word_rows)}
                rows.append(d_map({'model_ref': model.model_ref, 'checked_prefix_words': tuple(word_rows)}))
                partial = {}; work['partial'] = {}
            values = {'model_correlated_prefix_domains': tuple(rows),
                'examined_supplied_word_domain_complete': True,
                'global_build_order_domain_complete': False,
                'safer_alternatives_not_pruned_for_shorter_ones': True,
                'global_optimality_or_infeasibility_not_claimed': True,
                'single_existing_mechanics_pass_and_debit': True}
        else:
            raise ConstructionPrerequisite('SOURCE_CONSTRUCTION_K09_SEARCH_OR_EXACT_DOMAIN_SIGNATURE_REQUIRED')
        budget.finish()
        return d_result(request, 'COMPLETE', 'EXACT_SCOPED_CONSTRUCTION_LAYERS_OR_PREFIX_WORD_DOMAIN',
            values=values, complete=True, examined=budget.examined)
    except (ConstructionPrerequisite, DResumeMismatch, ValidationError) as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), values={'partial_domain': d_map(work)},
            examined=budget.examined, frontier=d_resumable_frontier(request, (), None, work) if len(work) > 1 else ())
    except DComputationInterrupted as error:
        return d_result(request, 'BOUND_REACHED', error.cause, examined=budget.examined,
            frontier=d_resumable_frontier(request, (), None, work))
