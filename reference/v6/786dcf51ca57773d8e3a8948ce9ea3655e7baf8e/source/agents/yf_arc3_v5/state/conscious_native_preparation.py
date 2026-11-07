"""Requalify existing Source preparation evidence without inventing experiment effects."""
from agents.yf_arc3_v5.drm.meaning import project_declared_alternatives
from agents.yf_arc3_v5.logos.operations import ViabilityAssessment
from agents.yf_arc3_v5.logos.operational_experiment_admission import OperationalConsciousnessNativePreparationEvidence
from agents.yf_arc3_v5.logos.types import FrozenMap, immutable_json_data, stable_digest
from .conscious_selection_frontier import selection_identity
from .experiment_evidence import current_experiment_claim

POLICY = 'policy.conscious_native_preparation_evidence'


def measure(owner, evidence):
    identity = evidence.identity
    viable = owner._store.artifact(evidence.source_viability_ref)
    entry = owner._entries.get(evidence.source_workflow_ref)
    producer_current = entry is not None and entry.transitive_source_hash == evidence.source_hash
    viability_entry = owner._entries.get(viable.workflow_definition_id) if isinstance(viable, ViabilityAssessment) else None
    viability_current = (isinstance(viable, ViabilityAssessment)
        and stable_digest(viable) == evidence.source_viability_digest
        and viability_entry is not None and viability_entry.transitive_source_hash == viable.source_hash
        and viable.timeline_id == identity['timeline_ref'] and viable.frame_id == identity['frame_ref']
        and viable.change_ref == identity['selected_candidate_ref'])
    invalid = []
    for ref, version in sorted(evidence.premise_versions.items()):
        claim = owner._store.snapshot.claim(ref)
        if (claim is None or stable_digest(claim) != version or not current_experiment_claim(
                claim, owner._store.snapshot.revision, timeline_ref=identity['timeline_ref'],
                frame_ref=identity['frame_ref'], scope_ref=evidence.scope_ref, epoch=evidence.epoch)):
            invalid.append(ref)
    required = set(evidence.required_constraint_refs)
    preserved = set(viable.principles_preserved) if viability_current else set()
    violated = set(viable.principles_violated) if viability_current else set()
    acquisition = evidence.acquisition_contract
    domain = acquisition.open_response_domain if acquisition is not None else None
    execution = acquisition.execution if acquisition is not None else None
    # The question concerns this exact action, not an arbitrary unresolved premise.
    question_bound = (evidence.control_bound and acquisition is not None and domain is not None
        and acquisition.timeline_ref == identity['timeline_ref']
        and acquisition.before_frame_ref == identity['frame_ref']
        and acquisition.execution_scope == identity['execution_scope']
        and not acquisition.before_missing_refs and bool(execution.observables)
        and len(execution.actions) == 1
        and execution.actions[0].action_ref == identity['action_ref']
        and execution.actions[0].action_data == identity['action_data'])
    policy, _ = owner._drm.resolve(POLICY)
    response_conditions = set(policy.configuration.get('response_uncertainty_condition_refs') or ())
    unresolved = tuple(viable.unresolved_conditions) if viability_current else ()
    response_unknowns = tuple(ref for ref in unresolved if question_bound and ref in response_conditions)
    other_unknowns = tuple(ref for ref in unresolved if ref not in response_unknowns)
    return FrozenMap({'producer_current': producer_current, 'control_bound': evidence.control_bound,
        'premise_count': len(evidence.premise_versions), 'invalid_premise_refs': tuple(sorted(invalid)),
        'invalid_premise_count': len(invalid), 'source_viability_current': bool(viability_current),
        'source_viability_status': viable.status.value if viability_current else None,
        'required_constraint_count': len(required),
        'uncovered_constraint_refs': tuple(sorted(required - preserved)),
        'uncovered_constraint_count': len(required - preserved),
        'violated_constraint_count': len(violated),
        'response_question_bound': bool(question_bound),
        'response_question_ref': acquisition.question_ref if question_bound else None,
        'response_acquisition_contract_ref': acquisition.contract_ref if question_bound else None,
        'response_uncertainty_refs': response_unknowns,
        'response_uncertainty_count': len(response_unknowns),
        'other_unresolved_condition_refs': other_unknowns,
        'other_unresolved_condition_count': len(other_unknowns) if viability_current else None,
        'declared_constraint_refs': tuple(sorted(required)),
        'source_unresolved_count': len(viable.unresolved_conditions) if viability_current else None,
        'source_missing_evidence_count': len(viable.missing_evidence) if viability_current else None})


def project(owner, measured):
    return project_declared_alternatives(drm=owner._drm, selection_policy_ref=POLICY,
        alternative_refs=(), descriptive_facts=measured)


def facts(evidence):
    rows = evidence.projection_facts['alternative_facts']
    if len(rows) != 1:
        raise ValueError('native preparation evidence lost its single scoped review')
    return rows[tuple(rows)[0]]


def capture(owner, context, prepared, native, control_bound, acquisition_contract=None):
    intent = prepared.intent
    viability = prepared.viability
    contribution = intent.operational_consciousness.responsibility.contribution
    identity = selection_identity(prepared)
    evidence = OperationalConsciousnessNativePreparationEvidence(
        source_workflow_ref=context.workflow_definition_id,
        source_hash=context.operational_consciousness.context.source_hash,
        identity=identity, epoch=native.state_revision,
        scope_ref='native-experiment-scope:' + stable_digest(identity['execution_scope']),
        premise_versions=FrozenMap({ref: stable_digest(owner._store.snapshot.claim(ref))
            if owner._store.snapshot.claim(ref) is not None else None for ref in sorted(set(intent.canonical_premise_claim_refs))}),
        required_constraint_refs=tuple(dict.fromkeys((*contribution.preserve_constraint_refs, *contribution.overshoot_constraint_refs))),
        source_viability_ref=viability.id, source_viability_digest=stable_digest(viability),
        acquisition_contract=acquisition_contract,
        control_bound=control_bound, measured_facts=FrozenMap(), projection_facts=FrozenMap(),
        policy_hash=owner._drm.resolve(POLICY)[1].source_hash)
    measured = measure(owner, evidence)
    return evidence.model_copy(update={'measured_facts': measured,
        'projection_facts': immutable_json_data(project(owner, measured))})


def preservation_bindings(evidence):
    return FrozenMap({ref: (evidence.source_viability_ref,) for ref in evidence.required_constraint_refs}) if (
        facts(evidence)['protected_conditions_current'] is True) else FrozenMap()


def read_current(owner, request, *, timeline_ref, frame_ref):
    evidence = request.native_preparation_evidence
    if evidence is None or owner is None:
        return None
    from .conscious_continuation_review import read_continuation_review
    review = read_continuation_review(owner, request, current=True, timeline_ref=timeline_ref, frame_ref=frame_ref)
    if (request.understanding_goal is not None
            and set(evidence.required_constraint_refs) != set(request.understanding_goal.preserve_constraint_refs)):
        return None
    acquisition = evidence.acquisition_contract
    if acquisition is not None and (acquisition.question_ref != request.question_ref
            or acquisition.contract_ref != request.observation_contract_ref
            or acquisition.execution != request.execution_contract
            or acquisition.open_response_domain != request.open_response_domain
            or request.understanding_goal is None
            or acquisition.goal_ref != request.understanding_goal.responsibility_owner_goal_ref):
        return None
    if (review is None or evidence.identity != review.identity
            or evidence.scope_ref != request.scope_ref or evidence.epoch != request.epoch
            or evidence.policy_hash != owner._drm.resolve(POLICY)[1].source_hash
            or evidence.measured_facts != measure(owner, evidence)
            or evidence.projection_facts != immutable_json_data(project(owner, evidence.measured_facts))
            or request.preconditions_current != facts(evidence)['preconditions_current']
            or request.protected_conditions_current != facts(evidence)['protected_conditions_current']
            or request.preservation_evidence_by_constraint != preservation_bindings(evidence)):
        return None
    return evidence
