"""Read actual experiment evidence without deriving meaning from predictions."""
from agents.yf_arc3_v5.capabilities.experiment_frontier_contracts_c import OperationalExperimentEvidence
from agents.yf_arc3_v5.logos.operations import (
    ActionIntent, ActionObservedRecord, ActionReleasePermit, EnvironmentActionDispatchedRecord, ObservationAcquiredRecord,
)
from agents.yf_arc3_v5.logos.types import Disposition, EpistemicStatus, FrozenMap, stable_digest
from agents.yf_arc3_v5.logos.operational_acquisition import OperationalExperimentParticipantObservable
from .conscious_acquisition_observables import read_participant_observables


def current_experiment_claim(claim, revision, *, timeline_ref, frame_ref, scope_ref, epoch):
    if claim is None:
        return False
    expiry = claim.valid_through_state_revision
    return (claim.disposition is Disposition.ACTIVE
        and claim.epistemic_status in (EpistemicStatus.SUPPORTED, EpistemicStatus.ESTABLISHED)
        and not claim.active_contradictions and not claim.defeated_by
        and (expiry is None or expiry >= revision)
        and all(claim.scope.get(key, expected) == expected for key, expected in (
            ('timeline_ref', timeline_ref), ('timeline_id', timeline_ref),
            ('frame_ref', frame_ref), ('frame_id', frame_ref), ('scope_ref', scope_ref), ('epoch', epoch))))


def measure_experiment_evidence(store, request, *, timeline_ref, frame_ref, owner=None):
    versions = {}
    missing = []
    measured_supports = set()
    domain = request.open_response_domain
    if domain is not None and request.execution_contract is not None:
        tracked = tuple(item for item in request.execution_contract.observables
            if isinstance(item, OperationalExperimentParticipantObservable))
        if tracked:
            observed = read_participant_observables(owner, tracked, timeline_ref=timeline_ref, frame_ref=frame_ref,
                frozen_record_refs=domain.support_evidence_refs)
            expected = domain.context_signature.get('before_signature', FrozenMap())
            if (observed['missing_refs'] or not isinstance(expected, FrozenMap)
                    or any(item.field_ref not in expected
                        or observed['observed_signature'].get(item.field_ref) != expected[item.field_ref] for item in tracked)):
                missing.extend(observed['missing_refs'])
                missing.append('experiment.current_open_response_context_measurement')
            else:
                measured_supports.update(observed['evidence_refs'])

    def resolve(ref):
        value = store.snapshot.claim(ref)
        if value is None:
            value = store.snapshot.term(ref)
        if value is None:
            value = store.artifact(ref)
        versions[ref] = stable_digest(value) if value is not None else None
        return value

    preparation = None
    if request.native_preparation_evidence is not None:
        from .conscious_native_preparation import read_current
        preparation = read_current(owner, request, timeline_ref=timeline_ref, frame_ref=frame_ref)
        resolve(request.native_preparation_evidence.source_viability_ref)
        for ref in request.native_preparation_evidence.premise_versions:
            resolve(ref)
        if preparation is None:
            missing.append('experiment.current_native_preparation_evidence')

    budget = None
    if request.command_budget_interval is not None:
        from .conscious_command_budget import read_current as read_budget
        budget = read_budget(owner, request, timeline_ref=timeline_ref, frame_ref=frame_ref)
        resolve(request.command_budget_interval.measurement_ref)
        for ref in request.command_budget_interval.proof_versions:
            resolve(ref)
        if budget is None:
            missing.append('experiment.current_command_budget_interval')

    if request.native_question_evidence is not None:
        from .conscious_native_question import read_current as read_question
        question = read_question(owner, request, timeline_ref=timeline_ref, frame_ref=frame_ref)
        key = request.native_question_evidence.identity
        versions['native_response_question_domain'] = store.operational_consciousness.understanding_question_observation_version(
            key['timeline_ref'], key['scope_ref'], key['epoch'], key['goal_ref'], key['question_ref'])
        for ref, row in sorted(request.native_question_evidence.observations.items()):
            resolve(ref)
            resolve(row['assessment_ref'])
        if question is None:
            missing.append('experiment.current_native_response_question')

    if request.native_goal_contribution_evidence is not None:
        from .conscious_native_goal_contribution import read_current as read_goal_contribution
        contribution = read_goal_contribution(owner, request, timeline_ref=timeline_ref, frame_ref=frame_ref)
        resolve(request.native_goal_contribution_evidence.native_review_ref)
        if contribution is None:
            missing.append('experiment.current_native_goal_contribution_evidence')

    if request.native_recovery_evidence is not None:
        from .conscious_native_recovery import read_current as read_recovery
        recovery = read_recovery(owner, request, timeline_ref=timeline_ref, frame_ref=frame_ref)
        resolve(request.native_recovery_evidence.native_review_ref)
        if recovery is None:
            missing.append('experiment.current_native_recovery_evidence')

    def current_support(ref):
        value = resolve(ref)
        if budget is not None and ref in budget.proof_versions:
            # The current resource policy qualifies these quantity proofs only
            # for this primitive-budget interval, not a future mechanism effect.
            return True
        if preparation is not None and ref == preparation.source_viability_ref:
            # This packet qualifies only the explicitly mapped constraints of
            # this preparation, never an unrelated prediction or cost claim.
            return request.protected_conditions_current
        if ref == request.native_continuation_review_ref:
            from .conscious_continuation_review import read_continuation_review
            return read_continuation_review(owner, request, current=True,
                timeline_ref=timeline_ref, frame_ref=frame_ref) is not None
        if ref in measured_supports:
            # Only the explicitly requested current field values were qualified.
            # This does not certify a causal law, future effect or preservation.
            return True
        claim = store.snapshot.claim(ref)
        if claim is not None:
            # Negative supported observations are evidence too; polarity is not a quality score.
            return current_experiment_claim(claim, store.snapshot.revision,
                timeline_ref=timeline_ref, frame_ref=frame_ref, scope_ref=request.scope_ref, epoch=request.epoch)
        # A raw acquisition proves an observation occurred, never the predicted semantic effect.
        return (isinstance(value, ObservationAcquiredRecord)
            and value.timeline_id == timeline_ref and value.frame_id == frame_ref)

    for ref in request.model_refs:
        if resolve(ref) is None:
            missing.append(ref)
    for ref in request.support_evidence_refs:
        if not current_support(ref):
            missing.append(ref)

    admitted = []
    rejected = []
    for recalled in request.recalled_evidence:
        observed = resolve(recalled.evidence_ref)
        method = resolve(recalled.method_ref)
        outcome = resolve(recalled.outcome_ref)
        outcome_claim = store.snapshot.claim(recalled.outcome_ref)
        supports = tuple(current_support(ref) for ref in recalled.current_support_evidence_refs)
        valid = (isinstance(observed, ActionObservedRecord) and bool(supports) and all(supports)
            and method is not None and outcome is not None and outcome_claim is not None
            and current_support(recalled.outcome_ref)
            and recalled.question_ref in outcome_claim.arguments
            and recalled.evidence_ref in outcome_claim.grounds
            and (outcome_claim.proof_rule == recalled.method_ref or recalled.method_ref in outcome_claim.grounds))
        if valid:
            intent = resolve(observed.action_intent_id)
            dispatch = resolve(observed.environment_action_event_ref)
            acquisition = resolve(observed.observation_record_id)
            permit = resolve(observed.action_release_permit_id)
            valid = (isinstance(intent, ActionIntent)
                and isinstance(dispatch, EnvironmentActionDispatchedRecord)
                and isinstance(acquisition, ObservationAcquiredRecord)
                and isinstance(permit, ActionReleasePermit)
                and observed.timeline_id == intent.timeline_id == dispatch.timeline_id == acquisition.timeline_id == timeline_ref
                and permit.timeline_id == timeline_ref
                and observed.frame_id == acquisition.frame_id
                and dispatch.action_intent_id == intent.id
                and dispatch.action_release_permit_id == observed.action_release_permit_id
                and (permit.action_intent_id == intent.id or intent.id in permit.declared_series_intent_ids)
                and dispatch.action_ref == intent.action_ref == recalled.operation_ref
                and dispatch.frame_id == intent.frame_id
                and (acquisition.raw_input_ref == dispatch.raw_input_ref or dispatch.id in acquisition.provenance))
        (admitted if valid else rejected).append(recalled.evidence_ref)
    return OperationalExperimentEvidence(
        request_digest=stable_digest(request.model_copy(update={'canonical_evidence': None})),
        timeline_ref=timeline_ref, frame_ref=frame_ref, dependency_versions=FrozenMap(versions),
        unavailable_refs=tuple(sorted(set(missing))), admitted_recall_refs=tuple(admitted),
        rejected_recall_refs=tuple(rejected))
