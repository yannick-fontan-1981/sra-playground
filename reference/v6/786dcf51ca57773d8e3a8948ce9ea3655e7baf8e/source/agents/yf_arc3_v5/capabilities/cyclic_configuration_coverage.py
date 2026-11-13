"""Bounded finite-factor evidence, coverage domains and owned press successors."""

from __future__ import annotations

from itertools import product
from math import prod
from typing import ClassVar, Literal

from pydantic import Field

from agents.yf_arc3_v5.capabilities.contracts import FrameGrid
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, stable_digest
from .coverage_panel_contracts_d import CoveragePanelLayout
from .coverage_panel_measurement_d import measure_coverage_panels_d
from .mechanical_family_contracts_d import (
    DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_result, d_validate_request,
    d_resume_rows, d_resumable_frontier, DResumeMismatch, d_measure_layers, d_map,
)


class CoverageState(FrozenModel):
    current: tuple[Ref, ...] = Field(min_length=1, max_length=16)
    visited: tuple[tuple[Ref, ...], ...] = Field(max_length=4096)
    reserve: int = Field(ge=0)


class CoverageModel(FrozenModel):
    model_ref: Ref
    factors: tuple[tuple[Ref, ...], ...] = Field(min_length=1, max_length=16)
    bindings: tuple[tuple[Ref, int], ...] = Field(default=(), max_length=64)
    costs: tuple[tuple[Ref, int], ...] = Field(default=(), max_length=64)
    independent: bool | None = None
    initial_credited: bool | None = None
    terminal_order: tuple[Ref, ...] = Field(default=(), max_length=2)
    catalogue: tuple[tuple[Ref, ...], ...] = Field(default=(), max_length=4096)
    debit_rule: Ref | None = None
    sweep_actions: tuple[Ref, ...] = Field(default=(), max_length=16)
    reset_action_ref: Ref | None = None
    reset_state: CoverageState | None = None
    reset_cost: int | None = Field(default=None, ge=0)
    reset_lifecycle_ref: Literal['active', 'accepted', 'exhausted'] | None = None
    reset_contract_ref: Ref | None = None
    reset_evidence_refs: tuple[Ref, ...] = Field(default=(), max_length=64)


_CASES = (
    ('control_catalogue_measure', ('MEASURE',)), ('press_binding_fit', ('FIT',)),
    ('factor_model', ('FIT',)), ('catalogue_ledger', ('MEASURE', 'COMPARE')),
    ('product_domain', ('DOMAIN',)), ('press_successor', ('STEP',)),
    ('product_sweep', ('COMPILE',)), ('residual_route', ('DOMAIN',)),
    ('path_certificate', ('PRECONDITION',)), ('reset_transfer_compare', ('COMPARE',)),
    ('external_primitive', ('STEP',)),
)


class CyclicCoverageRequest(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.cyclic_coverage_request.v1'
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = tuple((f'mechanics.cyclic_configuration_coverage.{op}', mode)
                                     for op, modes in _CASES for mode in modes)
    models: tuple[CoverageModel, ...] = Field(default=(), max_length=32)
    state: CoverageState | None = None
    prior_state: CoverageState | None = None
    action_ref: Ref | None = None
    primitive_word: tuple[Ref, ...] = Field(default=(), max_length=4096)
    comparison_word: tuple[Ref, ...] | None = Field(default=None, max_length=4096)
    factor_order: tuple[int, ...] = Field(default=(), max_length=16)
    observed_catalogue: tuple[tuple[Ref, ...], ...] = Field(default=(), max_length=4096)
    factor_vocabularies: tuple[tuple[Ref, ...], ...] = Field(default=(), max_length=16)
    reset_boundary_ref: Ref | None = None
    frame: FrameGrid | None = None
    layer_regions: tuple[FrozenMap, ...] = Field(default=(), max_length=256)
    frame_ref: Ref | None = None
    frame_epoch: int | None = Field(default=None, ge=0)
    control_layouts: tuple[CoveragePanelLayout, ...] = Field(default=(), max_length=32)


class CoveragePrerequisite(Exception):
    pass


def _product_domain(model, request, budget):
    if model.independent is not True:
        raise CoveragePrerequisite('INDEPENDENCE_NOT_SUPPLIED')
    if any(not values or len(set(values)) != len(values) for values in model.factors):
        raise CoveragePrerequisite('FACTOR_VOCABULARY_NOT_BIJECTIVE')
    count = prod(len(values) for values in model.factors)
    if count > request.domain_bound:
        raise DComputationInterrupted('FACTOR_PRODUCT_DOMAIN_BOUND', d_map({'product_count': count}))
    tuples = []
    for values in product(*model.factors):
        budget.visit()
        tuples.append(values)
    return tuple(tuples)


def _press(model, state, action, budget):
    budget.visit()
    if ((model.initial_credited is None and state.current not in state.visited)
            or model.debit_rule not in ('saturating', 'reject_if_insufficient')):
        raise CoveragePrerequisite('INITIAL_CREDIT_OR_DEBIT_LAW_MISSING')
    if len(state.current) != len(model.factors) or any(value not in vocabulary
        for value, vocabulary in zip(state.current, model.factors)):
        raise CoveragePrerequisite('CURRENT_TUPLE_OUTSIDE_MODEL')
    if any(len(values) != len(model.factors) or any(value not in vocabulary
        for value, vocabulary in zip(values, model.factors)) for values in (*state.visited, *model.catalogue)):
        raise CoveragePrerequisite('VISIT_OR_CATALOGUE_TUPLE_OUTSIDE_MODEL')
    if len(set(model.catalogue)) != len(model.catalogue):
        raise CoveragePrerequisite('CATALOGUE_TUPLE_IDENTITY_AMBIGUOUS')
    bindings = tuple(index for ref, index in model.bindings if ref == action)
    costs = tuple(cost for ref, cost in model.costs if ref == action)
    if len(bindings) != 1 or len(costs) != 1 or costs[0] < 0:
        raise CoveragePrerequisite('PRESS_BINDING_OR_COST_NOT_UNIQUE')
    index = bindings[0]
    if not 0 <= index < len(model.factors):
        raise CoveragePrerequisite('PRESS_FACTOR_OUTSIDE_MODEL')
    if state.reserve == 0 or (model.debit_rule == 'reject_if_insufficient' and costs[0] > state.reserve):
        raise CoveragePrerequisite('INPUT_RESOURCE_PRECONDITION_FAILED')
    if not model.catalogue:
        raise CoveragePrerequisite('ACCEPTANCE_CATALOGUE_MISSING')
    if len(model.terminal_order) != 2 or set(model.terminal_order) != {'acceptance', 'exhaustion'}:
        raise CoveragePrerequisite('TERMINAL_EVENT_ORDER_MISSING')
    current = list(state.current)
    cycle = model.factors[index]
    current[index] = cycle[(cycle.index(current[index]) + 1) % len(cycle)]
    current = tuple(current)
    before = frozenset((*state.visited, *((state.current,) if model.initial_credited else ())))
    visited = before | {current}
    reserve = max(0, state.reserve - costs[0])
    lifecycle = 'active'
    for event in model.terminal_order:
        if event == 'acceptance' and frozenset(model.catalogue) <= visited:
            lifecycle = 'accepted'
            break
        if event == 'exhaustion' and reserve == 0:
            lifecycle = 'exhausted'
            break
    after = CoverageState(current=current, visited=tuple(sorted(visited)), reserve=reserve)
    return after, d_map({'owner_ref': budget.request.scope.event_owner_ref,
        'action_ref': action, 'factor_index': index, 'before_tuple': state.current,
        'after_tuple': current, 'new_visit': current not in before, 'debit': costs[0],
        'reserve_before': state.reserve, 'reserve_after': reserve, 'lifecycle': lifecycle,
        'automatic_pass_already_owned': True, 'cost_already_owned': True})


def _image(model, state, word, budget):
    state = _seed_current_credit(model, state)
    trace = []
    for index, action in enumerate(word):
        if index >= budget.request.depth_bound:
            raise DComputationInterrupted('WORD_DEPTH_BOUND', d_map({'word_index': index}))
        state, event = _press(model, state, action, budget)
        trace.append(event)
        if event['lifecycle'] != 'active':
            return state, tuple(trace), index + 1 == len(word)
    return state, tuple(trace), True


def _paired_word_measurement(model, request, budget):
    """Full history/resource comparison, never a commutation rewrite rule."""
    first, first_trace, first_complete = _image(model,request.prior_state,
        request.primitive_word,budget)
    second, second_trace, second_complete = _image(model,request.state,
        request.comparison_word,budget)
    budget.visit()
    return d_map({'model_ref':model.model_ref,
        'first_start_state':request.prior_state,'second_start_state':request.state,
        'first_complete_state':first,'second_complete_state':second,
        'first_event_trace':first_trace,'second_event_trace':second_trace,
        'first_word_complete':first_complete,'second_word_complete':second_complete,
        'current_tuple_equal':first.current==second.current,
        'coverage_history_equal':first.visited==second.visited,
        'resource_reserve_equal':first.reserve==second.reserve,
        'complete_state_equal':first==second,
        'command_words_equal':request.primitive_word==request.comparison_word,
        'event_traces_equal':first_trace==second_trace,
        'first_actual_debit':sum(event['debit'] for event in first_trace),
        'second_actual_debit':sum(event['debit'] for event in second_trace),
        'no_word_rewrite_or_executable_witness_created':True})


def _fit_observations(request, budget):
    transitions = {}
    bindings = {}
    coupled = []
    context_outcomes = {}
    alias_samples = {}
    for observation in request.observations:
        budget.visit()
        if observation.get('sealed') is not True:
            raise CoveragePrerequisite('SEALED_TRANSITION_MISSING')
        before, after = observation.get('before_tuple'), observation.get('after_tuple')
        action = observation.get('action_ref')
        if not action or before is None or after is None or len(before) != len(after):
            raise CoveragePrerequisite('TRANSITION_TUPLE_OR_INPUT_MISSING')
        changed = tuple(index for index, (first, second) in enumerate(zip(before, after)) if first != second)
        bindings.setdefault(action, set()).add(changed)
        context_outcomes.setdefault(action, {}).setdefault(tuple(before), set()).add(tuple(after))
        if observation.get('input_cost') is not None and observation.get('new_visit') is not None:
            alias_samples.setdefault(action, {}).setdefault(tuple(before), set()).add((
                tuple(after), observation['input_cost'], observation['new_visit']))
        if len(changed) > 1:
            coupled.append((action, tuple(before), tuple(after)))
        for index in changed:
            key = (index, before[index])
            transitions.setdefault(key, set()).add(after[index])
    unknown = tuple((index, value) for index, vocabulary in enumerate(request.factor_vocabularies)
                    for value in vocabulary if (index, value) not in transitions)
    cycles = []
    for factor in sorted(set(index for index, _ in transitions)):
        values = sorted(set(value for index, value in transitions if index == factor))
        seen_cycles = set()
        for origin in values:
            path = []
            positions = {}
            current = origin
            stop = 'unknown_successor'
            while current not in positions:
                budget.visit()
                positions[current] = len(path)
                path.append(current)
                outgoing = transitions.get((factor, current), set())
                if len(outgoing) != 1:
                    stop = 'ambiguous_successor' if outgoing else 'unknown_successor'
                    break
                current = next(iter(outgoing))
            else:
                ring = tuple(path[positions[current]:])
                normalized = min(ring[index:] + ring[:index] for index in range(len(ring)))
                if normalized not in seen_cycles:
                    seen_cycles.add(normalized)
                    cycles.append((factor, normalized, 'observed_closed_cycle'))
                continue
            cycles.append((factor, tuple(path), stop))
    independence = []
    if request.factor_vocabularies:
        domain_count = prod(len(values) for values in request.factor_vocabularies)
        if domain_count > request.domain_bound:
            raise DComputationInterrupted('FACTOR_PRODUCT_DOMAIN_BOUND', d_map({'product_count': domain_count}))
        domain = frozenset(product(*request.factor_vocabularies))
        for action, outcomes in sorted(context_outcomes.items()):
            budget.visit()
            changed_domains = bindings[action]
            indices = set(index for changed in changed_domains for index in changed)
            complete = domain <= frozenset(outcomes)
            consistent = len(indices) == 1
            by_local_value = {}
            if consistent:
                index = next(iter(indices))
                for before, alternatives in sorted(outcomes.items()):
                    budget.visit()
                    if len(alternatives) != 1:
                        consistent = False
                        continue
                    after = next(iter(alternatives))
                    if any(after[other] != before[other] for other in range(len(before)) if other != index):
                        consistent = False
                    by_local_value.setdefault(before[index], set()).add(after[index])
            consistent = consistent and all(len(ends) == 1 for _, ends in sorted(by_local_value.items()))
            independence.append((action, complete, consistent, domain_count))
    aliases = []
    actions = tuple(sorted(alias_samples))
    for offset, first in enumerate(actions):
        for second in actions[offset + 1:]:
            common = tuple(sorted(set(alias_samples[first]) & set(alias_samples[second])))
            if not common:
                continue
            budget.visit()
            agrees = all(len(alias_samples[first][context]) == 1
                and alias_samples[first][context] == alias_samples[second][context] for context in common)
            aliases.append((first, second, common, agrees))
    model_fits = []
    for model in request.models:
        contradictions = []
        unknowns = []
        for offset, sample in enumerate(request.observations):
            budget.visit()
            before, after = tuple(sample['before_tuple']), tuple(sample['after_tuple'])
            binding = tuple(index for action, index in model.bindings if action == sample['action_ref'])
            if len(binding) != 1 or not 0 <= binding[0] < len(model.factors):
                unknowns.append((offset, 'BINDING_NOT_UNIQUE'))
                continue
            index = binding[0]
            if len(before) != len(model.factors) or any(value not in vocabulary
                for value, vocabulary in zip(before, model.factors)):
                contradictions.append((offset, 'OBSERVATION_OUTSIDE_FACTOR_DOMAIN'))
                continue
            expected = list(before)
            cycle = model.factors[index]
            expected[index] = cycle[(cycle.index(before[index]) + 1) % len(cycle)]
            if tuple(expected) != after:
                contradictions.append((offset, 'CYCLIC_SINGLE_FACTOR_SUCCESSOR_MISMATCH'))
        model_fits.append(d_map({'model_ref': model.model_ref,
            'observed_contradictions': tuple(contradictions), 'unknown_laws': tuple(unknowns),
            'fit_complete_for_observation_domain': not unknowns,
            'supports_observed_domain': not contradictions and not unknowns}))
    return {'press_change_domains': tuple((action, tuple(sorted(rows))) for action, rows in sorted(bindings.items())),
        'successor_domains': tuple((index, value, tuple(sorted(next_values)))
                                  for (index, value), next_values in sorted(transitions.items())),
        'coupled_observations': tuple(coupled), 'unknown_successor_edges': unknown,
        'local_cycle_observations': tuple(cycles), 'conditional_independence_domain_checks': tuple(independence),
        'observed_alias_domains': tuple(aliases), 'alias_identity_beyond_observed_domain_not_claimed': True,
        'model_correlated_fit_results': tuple(model_fits),
        'independence_not_inferred_from_a_single_context': True}


def _residual_domain(model, state, request, budget):
    """Exact K09 problem encoding; the successor never recursively starts search."""
    domain = _product_domain(model, request, budget)
    if len(set(model.catalogue)) != len(model.catalogue) or set(model.catalogue) != set(domain):
        raise CoveragePrerequisite('CATALOGUE_PRODUCT_MISMATCH')
    indices = {values: index for index, values in enumerate(domain)}
    if state.current not in indices or any(values not in indices for values in state.visited):
        raise CoveragePrerequisite('CURRENT_STATE_OR_VISITS_OUTSIDE_FACTOR_DOMAIN')
    state = _seed_current_credit(model, state)
    mask = sum(1 << indices[values] for values in sorted(frozenset(state.visited)))
    successors = []
    if state.reserve and mask != (1 << len(domain)) - 1:
        for action, _ in model.bindings:
            after, event = _press(model, state, action, budget)
            after_mask = sum(1 << indices[values] for values in sorted(frozenset(after.visited)))
            successors.append((action, (indices[after.current], after_mask, after.reserve), event))
    return {'initial_state': state, 'initial_key': (indices[state.current], mask, state.reserve),
        'tuple_indexing': tuple(enumerate(domain)), 'complete_required_visit_mask': (1 << len(domain)) - 1,
        'current_successor_domain': tuple(successors), 'immutable_transition_model': model,
        'successor_operation_ref': 'mechanics.cyclic_configuration_coverage.external_primitive',
        'successor_mode_ref': 'STEP', 'node_bound': request.node_bound, 'depth_bound': request.depth_bound,
        'domain_bound': request.domain_bound, 'time_bound_ms': request.time_bound_ms,
        'necessary_revisits_preserved': True, 'search_not_launched_from_successor': True}


def _seed_current_credit(model, state):
    if model.initial_credited is None and state.current not in state.visited:
        raise CoveragePrerequisite('INITIAL_CREDIT_LAW_MISSING')
    if model.initial_credited is True and state.current not in state.visited:
        return state.model_copy(update={'visited': tuple(sorted((*state.visited, state.current)))})
    return state


def measure_cyclic_configuration_coverage(request: CyclicCoverageRequest):
    rejected = d_validate_request(request)
    if rejected is not None:
        return rejected
    budget = DWorkBudget(request)
    operation = request.operation_ref.rsplit('.', 1)[-1]
    compiled_descriptors = set()
    rows = []
    current_model_ref = None
    try:
        if operation == 'control_catalogue_measure':
            d_resume_rows(request, ())
            if request.control_layouts:
                values = {'control_panel_alternatives': measure_coverage_panels_d(request, budget),
                    'frame_ref': request.frame_ref, 'role_assignment_is_source_owned': True,
                    'highlight_is_not_subtracted_from_visit_evidence': True}
            else:
                values = {'layers': d_measure_layers(request, budget), 'role_assignment_is_source_owned': True,
                          'highlight_is_not_subtracted_from_visit_evidence': True}
        elif operation in ('press_binding_fit', 'factor_model'):
            if not request.observations:
                raise CoveragePrerequisite('TRANSITION_OBSERVATIONS_MISSING')
            values = _fit_observations(request, budget)
        elif operation == 'catalogue_ledger':
            decoded = []
            for sample in request.observations:
                budget.visit()
                if sample.get('visit_border_observed') is True and sample.get('tuple_values') is not None:
                    decoded.append(tuple(sample['tuple_values']))
            observed = frozenset((*request.observed_catalogue, *decoded))
            prior = frozenset(request.prior_state.visited) if request.prior_state else frozenset()
            values = {'observed_visited': tuple(sorted(observed)), 'additions': tuple(sorted(observed - prior)),
                'retained_previous': tuple(sorted(prior)), 'reset_boundary_ref': request.reset_boundary_ref,
                'proposed_ledger': tuple(sorted(observed if request.reset_boundary_ref else observed | prior)),
                'epoch_ambiguous': request.prior_state is not None and request.reset_boundary_ref is None and not prior <= observed}
        elif operation == 'reset_transfer_compare':
            if request.state is None or request.prior_state is None:
                raise CoveragePrerequisite('PAIRED_SNAPSHOTS_MISSING')
            values = {'current_changed': request.state.current != request.prior_state.current,
                'lost_visits': tuple(sorted(set(request.prior_state.visited) - set(request.state.visited))),
                'reserve_change': request.state.reserve - request.prior_state.reserve,
                'retained_factor_models': request.models, 'local_state_fields': ('current', 'visited', 'reserve')}
            if request.comparison_word is not None:
                if not request.models:
                    raise CoveragePrerequisite('PAIRED_WORD_SCOPED_MODEL_MISSING')
                if len({model.model_ref for model in request.models})!=len(request.models):
                    raise CoveragePrerequisite('PAIRED_WORD_MODEL_IDENTITY_NOT_UNIQUE')
                comparisons=[]
                for model in request.models:
                    budget.visit()
                    comparisons.append(_paired_word_measurement(model,request,budget))
                values['paired_word_measurements']=tuple(comparisons)
        else:
            if not request.models:
                raise CoveragePrerequisite('SCOPED_FACTOR_MODELS_MISSING')
            rows = d_resume_rows(request, tuple(model.model_ref for model in request.models))
            compiled_descriptors = set(row['result']['compiled_word_descriptor'] for row in rows
                if row['result'].get('compiled_word_descriptor') is not None)
            for model in request.models[len(rows):]:
                current_model_ref = model.model_ref
                budget.visit()
                if operation == 'product_domain':
                    domain = _product_domain(model, request, budget)
                    row = {'tuples': domain, 'indices': tuple(enumerate(domain)),
                        'catalogue_only': tuple(sorted(set(model.catalogue) - set(domain))),
                        'product_only': tuple(sorted(set(domain) - set(model.catalogue)))}
                elif operation in ('press_successor', 'external_primitive'):
                    if request.state is None or request.action_ref is None:
                        raise CoveragePrerequisite('CURRENT_STATE_OR_INPUT_MISSING')
                    if operation == 'external_primitive' and request.action_ref == model.reset_action_ref:
                        if (model.reset_state is None or model.reset_cost is None
                                or model.reset_lifecycle_ref is None or not model.reset_contract_ref
                                or not model.reset_evidence_refs):
                            raise CoveragePrerequisite('RESET_STATE_COST_LIFECYCLE_AND_EVIDENCED_CONTRACT_REQUIRED')
                        row = {'state': model.reset_state, 'event_owner_ref': request.scope.event_owner_ref,
                            'restoration_contract_ref': model.reset_contract_ref, 'press_debit_not_appended': True,
                            'before_state': request.state, 'primitive_complete': True,
                            'phase_snapshots': d_map({'before': request.state,
                                'independent_reset': model.reset_state, 'after_cost_and_verdict': model.reset_state}),
                            'debit': model.reset_cost, 'lifecycle': model.reset_lifecycle_ref,
                            'accepted': model.reset_lifecycle_ref == 'accepted',
                            'event_ledger': (d_map({'owner_ref': request.scope.event_owner_ref,
                                'action_ref': request.action_ref, 'debit': model.reset_cost,
                                'lifecycle': model.reset_lifecycle_ref, 'accepted': model.reset_lifecycle_ref == 'accepted',
                                'restoration_contract_ref': model.reset_contract_ref,
                                'restoration_evidence_refs': model.reset_evidence_refs,
                                'final_reserve_supplied_by_restoration_contract': True,
                                'automatic_pass_already_owned': True, 'cost_already_owned': True,
                                'press_debit_not_appended': True}),)}
                    else:
                        after, event = _press(model, request.state, request.action_ref, budget)
                        row = {'state': after, 'event_ledger': (event,)}
                        if operation == 'external_primitive':
                            row.update({'before_state': request.state, 'event_owner_ref': request.scope.event_owner_ref,
                                'primitive_complete': True, 'debit': event['debit'], 'lifecycle': event['lifecycle'],
                                'accepted': event['lifecycle'] == 'accepted',
                                'phase_snapshots': d_map({'before': request.state, 'after_press_transaction': after,
                                    'after_cost_and_verdict': after}),
                                'press_visit_cost_and_verdict_snapshot_is_composed': True})
                elif operation in ('product_sweep', 'path_certificate'):
                    if request.state is None:
                        raise CoveragePrerequisite('CURRENT_COVERAGE_STATE_MISSING')
                    word = request.primitive_word
                    if operation == 'product_sweep':
                        _product_domain(model, request, budget)
                        if (set(request.factor_order) != set(range(len(model.factors)))
                            or len(request.factor_order) != len(model.factors)
                            or len(model.sweep_actions) != len(model.factors)):
                            raise CoveragePrerequisite('DECLARED_FACTOR_ORDER_OR_SWEEP_BINDINGS_MISSING')
                        descriptor = stable_digest((tuple((len(model.factors[index]), model.sweep_actions[index])
                            for index in request.factor_order if len(model.factors[index]) > 1),
                            model.initial_credited is False and request.state.current not in request.state.visited))
                        if descriptor not in compiled_descriptors and len(compiled_descriptors) >= 3:
                            raise CoveragePrerequisite('GLOBAL_ROOT_WITNESS_BOUND_REQUIRES_SOURCE_RESTRICTION')
                        compiled_descriptors.add(descriptor)
                        word = ()
                        for index in request.factor_order:
                            pieces = []
                            for slice_index in range(len(model.factors[index])):
                                pieces.extend(word)
                                if slice_index + 1 < len(model.factors[index]):
                                    pieces.append(model.sweep_actions[index])
                            word = tuple(pieces)
                            if len(word) > request.depth_bound:
                                raise DComputationInterrupted('WORD_DEPTH_BOUND', d_map({'factor_index': index}))
                        if model.initial_credited is False and request.state.current not in request.state.visited:
                            # Return using supported forward increments, never a guessed inverse.
                            prefix = list(word)
                            for index in request.factor_order:
                                advances = sum(action == model.sweep_actions[index] for action in word)
                                prefix.extend((model.sweep_actions[index],) * ((-advances) % len(model.factors[index])))
                            word = tuple(prefix)
                    after, trace, word_complete = _image(model, request.state, word, budget)
                    row = {'primitive_word': word, 'state': after, 'event_trace': trace,
                        'word_complete': word_complete, 'actual_cost': sum(event['debit'] for event in trace),
                        'coverage_complete': set(model.catalogue) <= set(after.visited),
                        'fresh_product_bound_is_not_a_residual_minimum': True}
                    if operation == 'product_sweep':
                        row['compiled_word_descriptor'] = descriptor
                elif operation == 'residual_route':
                    if request.state is None:
                        raise CoveragePrerequisite('CURRENT_COVERAGE_STATE_MISSING')
                    row = _residual_domain(model, request.state, request, budget)
                else:
                    return d_result(request, 'NEEDS_EVIDENCE', 'MISSING_IMPLEMENTATION', examined=budget.examined)
                rows.append(d_map({'model_ref': model.model_ref, 'result': d_map(row)}))
            if operation in ('product_sweep', 'path_certificate') and len(set(
                tuple(row['result']['primitive_word']) for row in rows)) > 3:
                raise CoveragePrerequisite('GLOBAL_ROOT_WITNESS_BOUND_REQUIRES_SOURCE_RESTRICTION')
            values = {'model_correlated_results': tuple(rows)}
        budget.finish()
        return d_result(request, 'COMPLETE', 'REQUESTED_FINITE_CALCULATION_RETURNED',
            values=values, complete=True, examined=budget.examined)
    except (CoveragePrerequisite, DResumeMismatch) as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref))
    except DComputationInterrupted as error:
        return d_result(request, 'NEEDS_EVIDENCE', error.cause, examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref, error.frontier))
