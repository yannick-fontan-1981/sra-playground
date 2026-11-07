"""Join declared exploration questions to existing canonical DRM retrospection.

This has no mechanism prerequisite and does not rerun perception or select a
continuation. Missing evidence and unexplained phenomena remain distinct debts.
"""
from agents.yf_arc3_v5.logos.operations import ActionIntent, OperatorInvocation, OperatorResult
from agents.yf_arc3_v5.logos.operational_responsibility import OperationalConsciousnessQuestionResponse, OperationalConsciousnessNativeQuestionResponse
from agents.yf_arc3_v5.logos.operational_information_opportunity import declared_action_question_bindings
from agents.yf_arc3_v5.logos.types import DeclaredCausalClass, FrozenMap, stable_digest
from .released_observation import read_released_observation
from .transaction_index_overlay import TransactionArtifactView


def read_question_response(response):
    """Restore only the two declared immutable response contracts from transport."""
    if isinstance(response, OperationalConsciousnessQuestionResponse):
        return response
    if not isinstance(response, FrozenMap):
        raise TypeError('question response requires its nominal contract or frozen transport')
    schema = response.get('schema_version')
    contracts = {
        'operational_consciousness_question_response.v1': OperationalConsciousnessQuestionResponse,
        'operational_consciousness_native_question_response.v1': OperationalConsciousnessNativeQuestionResponse,
    }
    contract = contracts.get(schema)
    if contract is None:
        raise ValueError('question response has no declared transport schema')
    return contract.model_validate(response.to_dict())


def measure_question_response_physical_evidence(*, store, consciousness, response):
    """Current availability for the exact old trial; never rewrite its receipt.

    A later canonical measurement can wake the declared owner. It is not an
    interpreted answer until Source has actually consumed its meaning.
    """
    response = read_question_response(response)
    observed = consciousness.observed_action_for_observation(response.observation_ref)
    if observed is None:
        return FrozenMap({'physical_effect_record_ref': None,
            'missing_refs': ('observation.actual_action_observed_record',)})
    read = read_released_observation(store, observed.id,
        timeline_ref=observed.timeline_id, frame_ref=observed.frame_id)
    binding = read['binding']
    return FrozenMap({'physical_effect_record_ref': binding.get('physical_effect_record_ref') if binding is not None else None,
        'missing_refs': (*read['missing_refs'], *(binding['physical_effect_missing_refs'] if binding is not None else ()))})


def _interpretation_receipts(store, claim, *, consumer_ref, timeline_ref, frame_ref):
    receipts = []
    for ref in sorted(claim.source_operator_results):
        result = store.artifact(ref)
        invocation = store.artifact(result.invocation_id) if isinstance(result, OperatorResult) else None
        if not isinstance(invocation, OperatorInvocation):
            continue
        if (result.status.value == 'completed' and result.operator.value == 'DERIVE'
                and invocation.operator == result.operator and claim.id in result.output_refs
                and invocation.authority_ref == claim.proof_rule
                and result.workflow_instance_id == consumer_ref
                and result.timeline_id == timeline_ref and result.frame_id == frame_ref
                and result.state_revision >= invocation.state_revision
                and all(getattr(result, field) == getattr(invocation, field) for field in (
                    'source_unit', 'source_hash', 'workflow_definition_id', 'workflow_instance_id',
                    'workflow_step_id', 'timeline_id', 'frame_id'))):
            receipts.append(ref)
    return tuple(receipts)


def _native_question_specs(intent):
    """Join frozen motivations to their own before-action contracts, not another goal's WHY."""
    opportunities = {row.opportunity_ref: row for row in intent.operational_information_opportunities}
    specifications = []
    for binding in declared_action_question_bindings(intent):
        if binding.origin_kind != 'information_opportunity':
            continue
        opportunity = opportunities[binding.origin_ref]
        contracts = {}
        for receipt in intent.operational_experiment_control_returns:
            if (not receipt.current_control_bound or receipt.intent_ref != intent.id
                    or receipt.timeline_ref != intent.timeline_id or receipt.frame_ref != intent.frame_id
                    or any(getattr(receipt, field) != getattr(opportunity, field) for field in (
                        'goal_ref', 'native_review_ref', 'nomination_ref', 'domain_ref',
                        'control_claim_ref', 'control_claim_digest', 'action_ref', 'action_data'))):
                continue
            acquisition = receipt.acquisition_contract
            if (acquisition is not None and acquisition.question_ref == binding.question_ref
                    and acquisition.execution_scope == intent.operational_consciousness.responsibility.execution_scope):
                contracts[acquisition.contract_ref] = acquisition
        expected, falsifiers, missing = (), (), []
        if len(contracts) == 1:
            acquisition = contracts[sorted(contracts)[0]]
            domain = acquisition.open_response_domain
            if domain is not None:
                expected, falsifiers = domain.observable_field_refs, domain.falsifier_refs
            missing.extend(acquisition.before_missing_refs)
        if len(contracts) != 1 or not expected or not falsifiers:
            missing.append('understanding.unique_native_question_observation_contract')
        specifications.append((binding, tuple(sorted(contracts)), expected, falsifiers, tuple(missing)))
    return tuple(specifications)


def measure_question_responses(*, store, consciousness, returns, coverage_claim_refs,
        consumer_ref, timeline_ref, frame_ref, physical_measurement_lookup='exact_observed_interval',
        question_response_scope='all_declared_question_owners'):
    """Read only the provided Source-produced interpretation domain, never a label guess."""
    if question_response_scope not in (None, 'all_declared_questions', 'all_declared_question_owners'):
        raise ValueError('question response has an unsupported declared-question scope')
    # Ownership is checked against the transaction prefix by the caller. A
    # physical/DERIVE proof needs the durable sequence of an earlier commit.
    if isinstance(store, TransactionArtifactView):
        store = store.committed_evidence_store
    claims = tuple(store.snapshot.claim(ref) for ref in coverage_claim_refs)
    rows = []
    for returned in returns:
        intent = store.artifact(returned.action_intent_id)
        if not isinstance(intent, ActionIntent):
            raise ValueError('question response lost its canonical responsible intention')
        responsibility = intent.operational_consciousness.responsibility
        contribution = responsibility.contribution
        # An expected novel/known/no-effect outcome does not erase an explicit
        # question. None replays the historical receipt's narrower domain only;
        # it never upgrades that receipt to coverage of all declared questions.
        if question_response_scope is None and contribution.effect_class is not DeclaredCausalClass.EXPERIMENTAL_UNKNOWN:
            continue
        native_questions = _native_question_specs(intent) if question_response_scope == 'all_declared_question_owners' else ()
        if contribution.experiment_ref is None and not native_questions:
            continue
        observed = consciousness.observed_action_for_observation(returned.observation_record_id)
        read = read_released_observation(store, observed.id if observed is not None else '',
            timeline_ref=timeline_ref, frame_ref=returned.frame_id,
            physical_measurement_lookup=physical_measurement_lookup)
        binding = read['binding']
        physical = binding.get('physical_effect') if binding is not None else None
        missing = list(read['missing_refs'])
        if binding is not None:
            missing.extend(binding['physical_effect_missing_refs'])
        transition = physical['transition_ref'] if physical is not None else None
        matching = tuple(claim for claim in claims if claim is not None
            and claim.predicate == 'records_exhaustive_transition_phenomenon_disposition'
            and claim.proof_rule == 'rule.transition_phenomenon_retrospection_meaning'
            and len(claim.arguments) == 2 and claim.arguments[1] == transition
            and claim.polarity.value == 'positive' and claim.disposition.value == 'active'
            and not claim.active_contradictions and not claim.defeated_by
            and (claim.valid_through_state_revision is None
                or claim.valid_through_state_revision >= store.snapshot.revision))
        claim = matching[0] if len(matching) == 1 else None
        receipts = (_interpretation_receipts(store, claim, consumer_ref=consumer_ref,
            timeline_ref=timeline_ref, frame_ref=frame_ref) if claim is not None else ())
        status = claim.attributes.get('status') if claim is not None else None
        if claim is None:
            missing.append('understanding.exact_canonical_transition_interpretation')
        if not receipts:
            missing.append('understanding.source_owned_interpretation_receipt')
        if not isinstance(status, str) or not status:
            missing.append('understanding.declared_observation_status')
            status = None
        common = dict(
            responsibility_ref=responsibility.responsibility_ref, intent_ref=intent.id,
            observation_ref=returned.observation_record_id,
            physical_effect_record_ref=binding.get('physical_effect_record_ref') if binding is not None else None,
            transition_ref=transition, interpretation_claim_ref=claim.id if claim is not None else None,
            interpretation_claim_digest=stable_digest(claim) if claim is not None else None,
            interpretation_operator_result_refs=receipts, interpretation_status_ref=status,
            unexplained_group_refs=tuple(claim.attributes.get('unexplained_group_refs', ())) if claim is not None else (),
            inventory_complete=claim.attributes.get('inventory_complete') if claim is not None else None)
        if contribution.experiment_ref is not None:
            rows.append(OperationalConsciousnessQuestionResponse(**common,
                question_ref=contribution.experiment_ref, owner_goal_ref=responsibility.problem.local_goal_ref,
                recipient_goal_ref=(responsibility.return_obligation.recipient_goal_ref
                    if responsibility.return_obligation is not None else responsibility.problem.local_goal_ref),
                expected_result_refs=contribution.expected_result_refs, falsifier_refs=contribution.falsifier_refs,
                missing_evidence_refs=tuple(dict.fromkeys(missing)), interpretation_consumed=not missing))
        for question, acquisition_refs, expected, falsifiers, contract_missing in native_questions:
            question_missing = tuple(dict.fromkeys((*missing, *contract_missing)))
            rows.append(OperationalConsciousnessNativeQuestionResponse(**common,
                question_binding=question, native_acquisition_refs=acquisition_refs,
                question_ref=question.question_ref, owner_goal_ref=question.owner_goal_ref,
                recipient_goal_ref=question.owner_goal_ref,
                expected_result_refs=expected, falsifier_refs=falsifiers,
                missing_evidence_refs=question_missing, interpretation_consumed=not question_missing))
    return tuple(rows)
