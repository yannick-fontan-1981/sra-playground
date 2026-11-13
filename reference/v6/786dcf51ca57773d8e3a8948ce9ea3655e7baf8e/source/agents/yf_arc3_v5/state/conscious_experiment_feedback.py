"""Current canonical commitment outcomes returned to their native questions."""
from agents.yf_arc3_v5.logos.operations import CommitmentDecision, ViabilityAssessment, ControlEvidenceSignature
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


def experiment_dependency_version(store, ref):
    claim = store.snapshot.claim(ref)
    expired = claim is not None and claim.valid_through_state_revision is not None \
        and claim.valid_through_state_revision < store.snapshot.revision
    return stable_digest((store.snapshot.term(ref), claim, store.artifact(ref), expired))


def index_experiment_commitment(index, store, decision):
    if not isinstance(decision, CommitmentDecision):
        return
    viability = store.artifact(decision.viability_assessment_id)
    if not isinstance(viability, ViabilityAssessment) or decision.change_ref != viability.change_ref:
        return
    returned = viability.resource_consequences.get('operational_consciousness_experiment_commitment')
    if not isinstance(returned, FrozenMap):
        return
    facts = returned['measured']['descriptive_by_ref']['experiment.commitment']
    signature = facts.get('control_signature')
    if signature is None or 'native_question_bindings' not in facts:
        return  # Historical unannotated decisions are not retroactively attested.
    control = ControlEvidenceSignature.model_validate(signature)
    command = stable_digest((facts['action_ref'], facts['action_data'], control.response_recall_key()))
    disposition = returned['projection']['alternative_facts']['experiment.commitment']
    semantic = stable_digest((command, decision.decision.value, returned['policy_hash'], decision.source_hash,
        facts['frame_ref'], facts['prepared_binding_current'], facts['original_status'],
        facts['required_constraint_refs'], facts['declared_preserved_refs'], facts['declared_violated_refs'],
        facts['unexamined_constraint_refs'], facts['unresolved_condition_refs'], facts['missing_evidence_refs'],
        facts['declared_reversibility'], facts['protection_dependency_versions'],
        returned['resource_return']['measured']['descriptive_by_ref'],
        tuple((key, disposition.get(key)) for key in ('disposition_ref', 'viability_status_override',
            'preservation_condition_refs', 'additional_unresolved_condition_refs', 'additional_missing_evidence_refs',
            'goal_constraint_condition_refs'))))
    for binding in facts['native_question_bindings']:
        key = (decision.timeline_id, stable_digest(facts['execution_scope']), binding['goal_ref'], binding['mechanism_ref'])
        bucket = index.setdefault(key, {})
        previous = bucket.get(command)
        if previous is None or previous[0] != semantic:
            bucket[command] = (semantic, decision.id, binding)


def read_experiment_commitment_feedback(owner, context, scope, goal_ref, mechanism_ref, configuration):
    store = owner._store
    complete, count, entries = store.native_experiment_commitment_refs(context.timeline_id, scope, goal_ref,
        mechanism_ref, configuration['maximum_feedback_commands'])
    rows = {}
    for semantic, decision_ref, binding in entries:
        decision = store.artifact(decision_ref)
        viability = store.artifact(decision.viability_assessment_id)
        returned = viability.resource_consequences['operational_consciousness_experiment_commitment']
        facts = returned['measured']['descriptive_by_ref']['experiment.commitment']
        entry = owner._entries.get(decision.workflow_definition_id)
        viability_entry = owner._entries.get(viability.workflow_definition_id)
        _, loaded_policy = owner._drm.resolve('policy.conscious_experiment_commitment')
        policy_hash = loaded_policy.source_hash
        dependencies_current = all(experiment_dependency_version(store, ref) == digest
            for ref, digest in sorted(facts['protection_dependency_versions'].items()))
        resources_current = True
        for _, resource in sorted(returned['resource_return']['measured']['descriptive_by_ref'].items()):
            ref = resource.get('measurement_ref')
            if ref is not None and stable_digest(store.snapshot.term(ref)) != resource['measurement_digest']:
                resources_current = False
            for ref, digest in sorted(resource.get('proof_digests', {}).items()):
                claim = store.snapshot.claim(ref)
                if stable_digest(claim) != digest or claim is None or (
                        claim.valid_through_state_revision is not None
                        and claim.valid_through_state_revision < store.snapshot.revision):
                    resources_current = False
        current = (facts['execution_scope'] == scope and facts['frame_ref'] == context.frame_id
            and decision.frame_id == viability.frame_id == context.frame_id
            and decision.timeline_id == viability.timeline_id == context.timeline_id
            and entry is not None and entry.transitive_source_hash == decision.source_hash
            and viability_entry is not None and viability_entry.transitive_source_hash == viability.source_hash
            and returned['policy_ref'] == 'policy.conscious_experiment_commitment'
            and returned['policy_hash'] == policy_hash and dependencies_current and resources_current)
        rows[semantic] = FrozenMap({'decision_ref': decision.id, 'decision_digest': stable_digest(decision),
            'viability_ref': viability.id, 'viability_digest': stable_digest(viability),
            'native_question_binding': binding, 'action_ref': facts['action_ref'], 'action_data': facts['action_data'],
            'control_signature': facts['control_signature'], 'decision_kind': decision.decision.value,
            'current_noncommitted': current and decision.decision.value in configuration['noncommitted_decisions'],
            'current': current, 'dependencies_current': dependencies_current, 'resources_current': resources_current,
            'disposition_ref': returned['projection']['alternative_facts']['experiment.commitment']['disposition_ref'],
            'unexamined_constraint_refs': facts['unexamined_constraint_refs'],
            'unresolved_condition_refs': viability.unresolved_conditions, 'missing_evidence_refs': viability.missing_evidence,
            'resource_overrun_refs': facts['resource_overrun_refs']})
    return FrozenMap({'complete': complete, 'command_count': count, 'rows': FrozenMap(rows),
        'current_noncommitted_count': sum(row['current'] and row['decision_kind'] in
            configuration['noncommitted_decisions'] for _, row in sorted(rows.items())),
        'missing_refs': () if complete else ('experiment.commitment_feedback_domain_exceeds_bound',)})
