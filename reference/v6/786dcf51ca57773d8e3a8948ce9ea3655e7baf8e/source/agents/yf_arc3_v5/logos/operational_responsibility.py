"""Typed responsibility carried by a decision, not a second action authority.

These records transport already declared meaning. They never choose a goal,
infer a capability, or mark a returned result as consumed.
"""
from collections.abc import Mapping
from typing import Literal

from pydantic import Field, model_validator

from .types import DeclaredCausalClass, FrozenMap, FrozenModel, Ref, stable_digest
from .operational_information_opportunity import OperationalConsciousnessDeclaredQuestionBinding


class OperationalProblemBinding(FrozenModel):
    # A Source-declared exploratory action need not have an operational goal.
    # Its question, premises, effect, falsifiers and scope remain mandatory.
    local_goal_ref: Ref | None
    terminal_goal_ref: Ref | None
    declared_terminal_goal_ref: Ref | None
    subgoal_ref: Ref | None
    dependency_chain_refs: tuple[Ref, ...]
    declared_dependency_chain_refs: tuple[Ref, ...]
    possible_beneficiary_goal_refs: tuple[Ref, ...]
    # A missing terminal interpretation is uncertainty, not a fabricated win law.
    terminal_interpretation: Literal['declared', 'unresolved']


class OperationalContribution(FrozenModel):
    selection_principle_ref: Ref
    premise_claim_refs: tuple[Ref, ...] = Field(min_length=1)
    effect_class: DeclaredCausalClass
    expected_result_refs: tuple[Ref, ...] = Field(min_length=1)
    falsifier_refs: tuple[Ref, ...] = Field(min_length=1)
    preserve_constraint_refs: tuple[Ref, ...]
    overshoot_constraint_refs: tuple[Ref, ...]
    experiment_ref: Ref | None
    plan_ref: Ref | None
    capability_inventory_status: Literal['not_attested_by_this_binding'] = 'not_attested_by_this_binding'

    @model_validator(mode='after')
    def explicit_information_question(self):
        if self.effect_class is DeclaredCausalClass.EXPERIMENTAL_UNKNOWN and not self.experiment_ref:
            raise ValueError('operational responsibility: experiment has no declared question')
        return self


class OperationalReturnObligation(FrozenModel):
    recipient_workflow_ref: Ref
    recipient_goal_ref: Ref
    source_owner_workflow_ref: Ref
    parent_question_ref: Ref | None
    reconciliation_checkpoint_ref: Ref
    consumption_required: Literal[True] = True
    # Dispatch, observation and storage cannot close this obligation.
    consumption_state: Literal['pending'] = 'pending'


class OperationalResponsibility(FrozenModel):
    responsibility_ref: Ref
    reasoning_context_ref: Ref
    version_ref: Ref
    previous_version_ref: Ref | None
    origin_intent_ref: Ref
    origin_frame_ref: Ref
    source_owner_workflow_ref: Ref
    timeline_ref: Ref
    execution_scope: FrozenMap
    source_unit: Ref
    source_hash: Ref
    problem: OperationalProblemBinding
    contribution: OperationalContribution
    return_obligation: OperationalReturnObligation | None
    frozen_why: FrozenMap
    schema_version: Literal['operational_responsibility.v2'] = 'operational_responsibility.v2'

    @model_validator(mode='after')
    def complete_scope(self):
        if any(not self.execution_scope.get(key) for key in ('game_ref', 'level_ref', 'session_ref')):
            raise ValueError('operational responsibility: incomplete execution scope')
        problem_fields = {
            'local_goal_ref': 'active_goal_ref', 'terminal_goal_ref': 'active_terminal_goal_ref',
            'declared_terminal_goal_ref': 'declared_terminal_goal_ref', 'subgoal_ref': 'subgoal_ref',
            'dependency_chain_refs': 'goal_dependency_chain_refs',
            'declared_dependency_chain_refs': 'declared_dependency_chain_refs',
        }
        for own, original in sorted(problem_fields.items()):
            if getattr(self.problem, own) != self.frozen_why.get(original):
                raise ValueError('operational responsibility: problem disagrees with declared WHY: ' + own)
        for field in ('selection_principle_ref', 'premise_claim_refs', 'falsifier_refs'):
            if getattr(self.contribution, field) != self.frozen_why.get(field):
                raise ValueError('operational responsibility: contribution disagrees with declared WHY: ' + field)
        if (self.contribution.effect_class.value != self.frozen_why.get('expected_effect_class')
                or self.contribution.experiment_ref != self.frozen_why.get('discriminating_experiment_ref')
                or self.contribution.plan_ref != self.frozen_why.get('committed_plan_ref')):
            raise ValueError('operational responsibility: changed contribution interpretation')
        expected = tuple(dict.fromkeys((*self.frozen_why.get('expectation_refs', ()),
            *((self.frozen_why['expected_configuration_or_goal_delta_ref'],)
              if self.frozen_why.get('expected_configuration_or_goal_delta_ref') else ()))))
        if expected != self.contribution.expected_result_refs:
            raise ValueError('operational responsibility: changed expected contribution')
        parent = self.frozen_why.get('parent_question_binding')
        if parent is not None and self.problem.local_goal_ref is None:
            raise ValueError('operational responsibility: parent return requires its declared local goal')
        frontier = self.frozen_why.get('goal_acquisition_frontier')
        branches = frontier.get('branches', ()) if frontier is not None else ()
        if self.problem.possible_beneficiary_goal_refs != tuple(row['goal_ref'] for row in branches):
            raise ValueError('operational responsibility: changed potential beneficiaries')
        receiver = self.return_obligation
        if receiver is not None and receiver.source_owner_workflow_ref != self.source_owner_workflow_ref:
            raise ValueError('operational responsibility: return changed its Source owner')
        if receiver is None:
            if parent is not None:
                raise ValueError('operational responsibility: declared parent return has no recipient')
            return self
        if (receiver.recipient_goal_ref != (parent['parent_goal_ref'] if parent is not None else self.problem.local_goal_ref)
                or receiver.recipient_workflow_ref != (parent['continuation_workflow_ref'] if parent is not None else receiver.source_owner_workflow_ref)
                or receiver.parent_question_ref != (parent['question_goal_ref'] if parent is not None else None)
                or receiver.reconciliation_checkpoint_ref != self.frozen_why.get('reconciliation_checkpoint_ref')):
            raise ValueError('operational responsibility: changed result recipient or checkpoint')
        return self


class OperationalConsciousnessActionBinding(FrozenModel):
    responsibility: OperationalResponsibility
    intent_ref: Ref
    execution_owner_ref: Ref
    action_ref: Ref
    action_data: FrozenMap
    series_ref: Ref | None
    series_index: int | None
    schema_version: Literal['operational_consciousness_action_binding.v1'] = 'operational_consciousness_action_binding.v1'


class OperationalObservedReturn(FrozenModel):
    responsibility_ref: Ref
    execution_binding_digest: Ref
    intent_ref: Ref
    observation_ref: Ref
    recipient_workflow_ref: Ref
    recipient_goal_ref: Ref | None
    reconciliation_checkpoint_ref: Ref
    consumption_state: Literal['pending'] = 'pending'
    schema_version: Literal['operational_observed_return.v1'] = 'operational_observed_return.v1'


class OperationalConsciousnessReceiverBinding(FrozenModel):
    """Exact authority to handle a consequence without replacing its owner."""
    kind: Literal['canonical_parent_chain', 'declared_series_executor']
    recipient_workflow_ref: Ref
    consumer_workflow_ref: Ref
    execution_workflow_ref: Ref
    authority_refs: tuple[Ref, ...] = Field(min_length=1)
    schema_version: Literal['operational_consciousness_receiver_binding.v1'] = 'operational_consciousness_receiver_binding.v1'


class OperationalConsciousnessQuestionResponse(FrozenModel):
    """Consume an observed answer without promoting it to a reusable causal law."""
    responsibility_ref: Ref
    intent_ref: Ref
    question_ref: Ref
    owner_goal_ref: Ref | None
    recipient_goal_ref: Ref | None
    observation_ref: Ref
    expected_result_refs: tuple[Ref, ...] = Field(min_length=1)
    falsifier_refs: tuple[Ref, ...] = Field(min_length=1)
    physical_effect_record_ref: Ref | None
    transition_ref: Ref | None
    interpretation_claim_ref: Ref | None
    interpretation_claim_digest: Ref | None
    interpretation_operator_result_refs: tuple[Ref, ...]
    interpretation_status_ref: Ref | None
    unexplained_group_refs: tuple[Ref, ...]
    inventory_complete: bool | None
    missing_evidence_refs: tuple[Ref, ...]
    interpretation_consumed: bool
    general_mechanism_established: Literal[False] = False
    grants_action: Literal[False] = False
    schema_version: Literal['operational_consciousness_question_response.v1'] = 'operational_consciousness_question_response.v1'

    @model_validator(mode='after')
    def exact_interpretation_or_explicit_debt(self):
        complete = bool(self.physical_effect_record_ref and self.transition_ref
            and self.interpretation_claim_ref and self.interpretation_claim_digest
            and self.interpretation_operator_result_refs and self.interpretation_status_ref
            and not self.missing_evidence_refs)
        if self.interpretation_consumed != complete:
            raise ValueError('question response cannot consume an unbound observation interpretation')
        if not complete and not self.missing_evidence_refs:
            raise ValueError('question response requires an explicit missing-evidence disposition')
        return self


class OperationalConsciousnessNativeQuestionResponse(OperationalConsciousnessQuestionResponse):
    """Deliver one selected native question's observation without claiming its answer."""
    question_binding: OperationalConsciousnessDeclaredQuestionBinding
    native_acquisition_refs: tuple[Ref, ...]
    expected_result_refs: tuple[Ref, ...] = ()
    falsifier_refs: tuple[Ref, ...] = ()
    question_resolved: Literal[False] = False
    schema_version: Literal['operational_consciousness_native_question_response.v1'] = 'operational_consciousness_native_question_response.v1'

    @model_validator(mode='after')
    def preserve_native_question_owner_and_debt(self):
        binding = self.question_binding
        if (binding.origin_kind != 'information_opportunity' or binding.question_ref != self.question_ref
                or binding.owner_goal_ref != self.owner_goal_ref or self.recipient_goal_ref != self.owner_goal_ref):
            raise ValueError('native question response changed its declared owner or origin')
        if (len(self.native_acquisition_refs) != 1 or not self.expected_result_refs or not self.falsifier_refs):
            if 'understanding.unique_native_question_observation_contract' not in self.missing_evidence_refs:
                raise ValueError('native question response omitted its missing or ambiguous observation contract')
        return self


WHY_FIELDS = (
    'active_goal_ref', 'active_terminal_goal_ref', 'declared_terminal_goal_ref', 'subgoal_ref',
    'goal_graph_edge_refs', 'goal_dependency_chain_refs', 'declared_dependency_chain_refs',
    'advances_active_goal_chain', 'inherited_priority_from_terminal_goal', 'priority_class_ref',
    'selection_principle_ref', 'premise_claim_refs', 'expected_effect_class',
    'expected_configuration_or_goal_delta_ref', 'expectation_refs', 'falsifier_refs',
    'committed_plan_ref', 'discriminating_experiment_ref', 'lifecycle_engagement_ref',
    'declared_plan_ref', 'declared_plan_stage_refs', 'declared_plan_ordered_member_refs',
    'declared_plan_ordered_member_values', 'declared_plan_current_stage_ref',
    'declared_plan_cursor_ordinal', 'declared_plan_member_count', 'remaining_action_bound',
    'reconciliation_checkpoint_ref', 'contribution_contracts', 'contribution_target_context',
    'parent_question_binding', 'goal_acquisition_frontier',
)


def _get(value, name, default=None):
    return value.get(name, default) if isinstance(value, Mapping) else getattr(value, name, default)


def why_projection(intent):
    from .types import immutable_json_data
    fields = {key: immutable_json_data(_get(intent, key)) for key in WHY_FIELDS}
    opportunities = _get(intent, 'operational_information_opportunities', ())
    if opportunities:
        # An original reason stays frozen through a declared series. It does
        # not replace any member's current release/control proof. Historical
        # unannotated WHYs keep their original canonical shape.
        fields['operational_information_opportunities'] = immutable_json_data(opportunities)
    consumptions = _get(intent, 'operational_goal_consumptions', ())
    if consumptions:
        fields['operational_goal_consumptions'] = immutable_json_data(consumptions)
    return FrozenMap(fields)


def responsibility_identity(intent_fields, world_context):
    scope = FrozenMap({key: world_context.get(key) for key in ('game_ref', 'level_ref', 'session_ref')})
    return 'responsibility:' + stable_digest((_get(intent_fields, 'timeline_id'), scope,
        _get(intent_fields, 'active_goal_ref'), _get(intent_fields, 'active_terminal_goal_ref'),
        _get(intent_fields, 'declared_terminal_goal_ref')))


def responsibility_version(responsibility):
    return 'responsibility-version:' + stable_digest(
        responsibility.model_dump(mode='python', exclude={'version_ref'}))


def declared_action_constraints(intent_fields, world_context):
    """Transport constraints only from the explicitly named goal chain."""
    parent = _get(intent_fields, 'parent_question_binding')
    linked = {_get(intent_fields, name) for name in ('active_goal_ref', 'active_terminal_goal_ref', 'declared_terminal_goal_ref')}
    linked.update(_get(intent_fields, 'goal_dependency_chain_refs', ()) or ())
    linked.update(_get(intent_fields, 'declared_dependency_chain_refs', ()) or ())
    if parent is not None:
        linked.add(_get(parent, 'parent_goal_ref'))
    frontier = _get(intent_fields, 'goal_acquisition_frontier')
    declared = []
    for branch in _get(frontier, 'branches', ()) if frontier is not None else ():
        goal = _get(branch, 'goal_ref')
        intent = _get(branch, 'operational_goal_intent')
        if goal not in linked or intent is None:
            continue
        if _get(intent, 'goal_ref') != goal:
            raise ValueError('operational responsibility: goal constraint binding changed owner')
        declared.append(_get(intent, 'declarations', {}))
    constraints = {}
    for field in ('preserve_constraint_refs', 'overshoot_constraint_refs'):
        refs = list(world_context.get(field) or ())
        if field == 'overshoot_constraint_refs':
            refs.extend(world_context.get('forbidden_overshoot_refs') or ())
        for declaration in declared:
            refs.extend(declaration.get(field) or ())
        constraints[field] = tuple(dict.fromkeys(refs))
    return FrozenMap(constraints)


def bind_declared_action_responsibility(intent_fields, world_context, previous=None, *, reasoning_context_ref):
    """Copy Source/DRM fields exactly; absent obligations are structural refusals."""
    from .operations import ActionIntent
    # Apply model defaults without constructing a valid runtime intent early.
    defaults = {name: field.get_default(call_default_factory=True)
                for name, field in sorted(ActionIntent.model_fields.items()) if not field.is_required()}
    values = {**defaults, **intent_fields}
    get = lambda key: values.get(key)
    parent = get('parent_question_binding')
    frontier = get('goal_acquisition_frontier')
    branches = _get(frontier, 'branches', ()) if frontier is not None else ()
    local = get('active_goal_ref')
    expected = tuple(dict.fromkeys((*get('expectation_refs'),
        *((get('expected_configuration_or_goal_delta_ref'),) if get('expected_configuration_or_goal_delta_ref') else ()))))
    scope = FrozenMap({key: world_context.get(key) for key in ('game_ref', 'level_ref', 'session_ref')})
    responsibility_ref = responsibility_identity(values, world_context)
    if previous is not None and (previous.responsibility_ref != responsibility_ref
            or previous.timeline_ref != get('timeline_id') or previous.execution_scope != scope):
        raise ValueError('operational responsibility: foreign predecessor')
    previous_ref = previous.version_ref if previous is not None else None
    frozen_why = why_projection(values)
    constraints = declared_action_constraints(values, world_context)
    obligation = OperationalReturnObligation(
        recipient_workflow_ref=_get(parent, 'continuation_workflow_ref') if parent is not None else get('workflow_instance_id'),
        recipient_goal_ref=_get(parent, 'parent_goal_ref') if parent is not None else local,
        source_owner_workflow_ref=get('workflow_instance_id'),
        parent_question_ref=_get(parent, 'question_goal_ref') if parent is not None else None,
        reconciliation_checkpoint_ref=get('reconciliation_checkpoint_ref')) if parent is not None else None
    responsibility = OperationalResponsibility(
        responsibility_ref=responsibility_ref,
        reasoning_context_ref=reasoning_context_ref,
        version_ref='unsealed', previous_version_ref=previous_ref,
        origin_intent_ref=get('id'), origin_frame_ref=get('frame_id'),
        source_owner_workflow_ref=get('workflow_instance_id'), timeline_ref=get('timeline_id'),
        execution_scope=scope, source_unit=get('source_unit'), source_hash=get('source_hash'),
        problem=OperationalProblemBinding(local_goal_ref=local,
            terminal_goal_ref=get('active_terminal_goal_ref'), declared_terminal_goal_ref=get('declared_terminal_goal_ref'),
            subgoal_ref=get('subgoal_ref'), dependency_chain_refs=get('goal_dependency_chain_refs'),
            declared_dependency_chain_refs=get('declared_dependency_chain_refs'),
            possible_beneficiary_goal_refs=tuple(_get(row, 'goal_ref') for row in branches),
            terminal_interpretation='declared' if get('active_terminal_goal_ref') or get('declared_terminal_goal_ref') else 'unresolved'),
        contribution=OperationalContribution(selection_principle_ref=get('selection_principle_ref'),
            premise_claim_refs=get('premise_claim_refs'), effect_class=get('expected_effect_class'),
            expected_result_refs=expected, falsifier_refs=get('falsifier_refs'),
            preserve_constraint_refs=constraints['preserve_constraint_refs'],
            overshoot_constraint_refs=constraints['overshoot_constraint_refs'],
            experiment_ref=get('discriminating_experiment_ref'), plan_ref=get('committed_plan_ref')),
        return_obligation=obligation, frozen_why=frozen_why)
    # Seal the complete packet, including its recipient and constraints, before
    # constructing an intent. An unsealed packet cannot pass the runtime guard.
    responsibility = responsibility.model_copy(update={'version_ref': responsibility_version(responsibility)})
    binding = OperationalConsciousnessActionBinding(responsibility=responsibility, intent_ref=get('id'),
        execution_owner_ref=get('workflow_instance_id'), action_ref=get('action_ref'),
        action_data=get('action_data'), series_ref=get('declared_series_ref'), series_index=get('declared_series_index'))
    return ActionIntent(**intent_fields, operational_consciousness=binding)


def validate_action_responsibility(intent, world_context=None):
    binding = intent.operational_consciousness
    responsibility = binding.responsibility
    if responsibility.version_ref != responsibility_version(responsibility):
        raise ValueError('operational responsibility: packet changed without a new version')
    if responsibility.timeline_ref != intent.timeline_id or responsibility.frozen_why != why_projection(intent):
        raise ValueError('operational responsibility: changed scope or frozen WHY')
    if (binding.intent_ref, binding.execution_owner_ref, binding.action_ref, binding.action_data,
            binding.series_ref, binding.series_index) != (intent.id, intent.workflow_instance_id,
            intent.action_ref, intent.action_data, intent.declared_series_ref, intent.declared_series_index):
        raise ValueError('operational responsibility: changed action execution binding')
    goal_constraints = declared_action_constraints(intent, {})
    if any(not set(goal_constraints[field]).issubset(getattr(responsibility.contribution, field)) for field in goal_constraints):
        raise ValueError('operational responsibility: frozen goal constraints were lost')
    from agents.yf_arc3_v5.operational.continuity_scope import validate_current_action_responsibility_scope
    return validate_current_action_responsibility_scope(intent, world_context)


class DeclaredSeriesContributionBinding(FrozenModel):
    """Keep the producer receipt while binding its authorized route's member."""
    source_intent_ref: Ref
    source_action_ref: Ref
    source_contribution_digest: Ref
    series_ref: Ref
    action_refs: tuple[Ref, ...] = Field(min_length=1)


def bind_declared_series_member(base_intent, member, *, declared_action_refs):
    """Rebind execution only; a declared series cannot reconstruct its WHY."""
    validate_action_responsibility(base_intent)
    if not member.declared_series_ref or member.declared_series_index is None:
        raise ValueError('operational responsibility: series member has no exact ordinal')
    actions = tuple(declared_action_refs)
    if (not actions or actions[0] != base_intent.action_ref
            or member.declared_series_index >= len(actions)
            or actions[member.declared_series_index] != member.action_ref):
        raise ValueError('operational responsibility: member differs from declared route')
    contribution_binding = DeclaredSeriesContributionBinding(
        source_intent_ref=base_intent.id, source_action_ref=base_intent.action_ref,
        source_contribution_digest=stable_digest(base_intent.contribution_contracts),
        series_ref=member.declared_series_ref, action_refs=actions,
    ) if base_intent.contribution_contracts else None
    binding = OperationalConsciousnessActionBinding(responsibility=base_intent.operational_consciousness.responsibility,
        intent_ref=member.id, execution_owner_ref=member.workflow_instance_id, action_ref=member.action_ref,
        action_data=member.action_data, series_ref=member.declared_series_ref, series_index=member.declared_series_index)
    inherited = {row.return_ref: row for row in (*base_intent.inherited_experiment_control_returns,
        *base_intent.operational_experiment_control_returns)}
    return validate_action_responsibility(member.model_copy(update={'operational_consciousness': binding,
        'series_contribution_binding': contribution_binding,
        **({'operational_goal_consumptions': base_intent.operational_goal_consumptions}
           if base_intent.operational_goal_consumptions else {}),
        'operational_experiment_control_returns': (),
        'inherited_experiment_control_returns': tuple(row for _, row in sorted(inherited.items()))}))


def bind_observed_return(intent, observation_ref):
    validate_action_responsibility(intent)
    binding = intent.operational_consciousness
    responsibility = binding.responsibility
    obligation = responsibility.return_obligation
    return OperationalObservedReturn(responsibility_ref=responsibility.responsibility_ref,
        execution_binding_digest=stable_digest(binding), intent_ref=intent.id,
        observation_ref=observation_ref,
        recipient_workflow_ref=(obligation.recipient_workflow_ref if obligation is not None else responsibility.source_owner_workflow_ref),
        recipient_goal_ref=(obligation.recipient_goal_ref if obligation is not None else intent.active_goal_ref),
        reconciliation_checkpoint_ref=(obligation.reconciliation_checkpoint_ref if obligation is not None else intent.reconciliation_checkpoint_ref))
