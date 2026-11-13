"""Operational consciousness: continuity of problems and outstanding consequences.

This component belongs to EventStore's canonical projection. Source and DRM
still own interpretation and choice. Preparing a decision never mutates it;
only accepted canonical artifacts advance its retained state.
"""
from types import MappingProxyType
from time import perf_counter_ns
from agents.yf_arc3_v5.operational.continuity import (
    OperationalContinuityContext, OperationalContinuityRuntimeState,
)
from .transaction_index_overlay import TransactionArtifactView, TransactionIndexOverlay
from .post_action_consumption import require_post_action_consumption
from .action_observation import require_action_observation, require_operator_invocation
from .conscious_resume_refusal import require_causal_resume_refusal
from .conscious_dispatch_refusal import require_dispatch_refusal, require_dispatch_retirement
from .conscious_response_reconciliation import require_response_reconciliation
from .conscious_public_return import require_public_reasoning_return
from .conscious_contribution_consumption import require_contribution_consumption, require_consumed_source_boundary
from .continuation_review_publication import require_continuation_review_publication
from .conscious_engagement import retained_engagement_measurement
from .reasoning_context_publication import (
    require_compiled_entry_publication, require_workflow_checkpoint_publication,
)
from agents.yf_arc3_v5.logos.operational_responsibility import (
    OperationalObservedReturn,
    OperationalConsciousnessNativeQuestionResponse,
    OperationalResponsibility,
    bind_declared_action_responsibility,
    bind_observed_return,
    responsibility_identity,
    validate_action_responsibility,
)
from agents.yf_arc3_v5.logos.operations import (ActionIntent, ActionObservedRecord, OperationalConsciousnessConsumptionRecord,
    WorkflowInstanceRecord, OperatorInvocation, OperationalConsciousnessReasoningEntryRecord, ConsciousCompiledRecord,
    OperationalConsciousnessReasoningCallDeferralRecord,
    OperationalConsciousnessReasoningCallRefusalRecord,
    OperationalConsciousnessPublicReturnRecord,
    ContributionConsumptionRecord, OperationalConsciousnessContributionRequestRecord,
    OperationalConsciousnessReevaluationRecord, OperationalConsciousnessGoalWatchRecord,
    OperationalConsciousnessResumeRefusalRecord,
    OperationalConsciousnessDispatchRefusalRecord,
    OperationalConsciousnessDispatchRetirementRecord,
    OperationalConsciousnessResponseReconciliationRecord,
    OperationalConsciousnessInquiryRecord, OperationalUnderstandingAssessmentRecord, OperationalUnderstandingConsumptionRecord,
    OperationalUnderstandingObservationRecord, OperationalConsciousnessContinuationReviewRecord)
from agents.yf_arc3_v5.logos.operational_reevaluation import OperationalConsciousnessReevaluationState
from agents.yf_arc3_v5.logos.operational_reasoning import (
    OperationalConsciousnessReasoningContext, OperationalConsciousnessAdmissionError, reasoning_context_ref,
)
from agents.yf_arc3_v5.logos.operational_branch import (
    OperationalConsciousnessBranchState, OperationalConsciousnessBranchReturnState,
    OperationalConsciousnessContributionState,
)
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, stable_digest, immutable_json_data
from agents.yf_arc3_v5.logos.operations import (
    CompiledSelectionDecisionRecord, CompiledCalculationFailureRecord, CompiledCalculationPublicReturnRecord,
)


def require_calculation_public_return(record, *, consciousness, store):
    producer = store.artifact(record.calculation_record_ref) if store is not None else None
    if (not isinstance(producer, CompiledCalculationFailureRecord)
            or record.run_ref != store.run_id or producer.run_ref != record.run_ref
            or record.source_unit != producer.source_unit or record.source_hash != producer.source_hash
            or record.workflow_definition_id != producer.workflow_definition_id
            or record.workflow_instance_id != producer.workflow_instance_id
            or record.workflow_step_id != producer.workflow_step_id
            or record.timeline_id != producer.timeline_id or record.frame_id != producer.frame_id
            or record.provenance != (producer.id,)):
        raise ValueError('calculation delivery lost its exact canonical producer')
    return record


def require_compiled_calculation_publication(record, *, consciousness, store):
    """Execution scope remains mandatory independently of coordination."""
    run_ref = (record.execution_run_ref if isinstance(record, CompiledSelectionDecisionRecord)
               else record.run_ref)
    if store is None or run_ref != store.run_id:
        raise ValueError('compiled calculation belongs to another execution run')
    if (isinstance(record, CompiledSelectionDecisionRecord)
            and record.operational_consciousness is not None):
        consciousness.require_compiled_transition(record)
    return record


_CANONICAL_TRANSITION_GUARDS = (
    (OperationalUnderstandingAssessmentRecord, 'require_understanding_transition'),
    (OperationalUnderstandingObservationRecord, 'require_understanding_transition'),
    (OperationalUnderstandingConsumptionRecord, 'require_understanding_transition'),
    (OperationalConsciousnessInquiryRecord, 'require_inquiry_transition'),
    (OperationalConsciousnessGoalWatchRecord, 'require_goal_watch_transition'),
    (OperationalConsciousnessReevaluationRecord, 'require_reevaluation_transition'),
    (OperationalConsciousnessContributionRequestRecord, 'require_contribution_request'),
    (ConsciousCompiledRecord, 'require_compiled_transition'),
    (ActionIntent, 'require_intent_publication'),
)
_CANONICAL_STORE_TRANSITION_GUARDS = (
    (CompiledCalculationPublicReturnRecord, require_calculation_public_return),
    (CompiledSelectionDecisionRecord, require_compiled_calculation_publication),
    (CompiledCalculationFailureRecord, require_compiled_calculation_publication),
    (ContributionConsumptionRecord, require_contribution_consumption),
    (OperationalConsciousnessPublicReturnRecord, require_public_reasoning_return),
    (OperationalConsciousnessResponseReconciliationRecord, require_response_reconciliation),
    (OperationalConsciousnessDispatchRetirementRecord, require_dispatch_retirement),
    (OperationalConsciousnessDispatchRefusalRecord, require_dispatch_refusal),
    (OperationalConsciousnessResumeRefusalRecord, require_causal_resume_refusal),
    (OperationalConsciousnessContinuationReviewRecord, require_continuation_review_publication),
    (OperationalConsciousnessConsumptionRecord, require_post_action_consumption),
    (ActionObservedRecord, require_action_observation),
    (OperatorInvocation, require_operator_invocation),
    (OperationalConsciousnessReasoningEntryRecord, require_compiled_entry_publication),
    (WorkflowInstanceRecord, require_workflow_checkpoint_publication),
)
_CANONICAL_TRANSITION_TYPES = tuple(kind for kind, _ in (
    *_CANONICAL_TRANSITION_GUARDS, *_CANONICAL_STORE_TRANSITION_GUARDS))


class OperationalConsciousnessProblem(FrozenModel):
    """An accountable problem, including consequences not yet consumed.

    A new decision may revise the problem but cannot erase its older returns.
    Empty pending returns means no observed debt here, not goal achievement.
    """
    responsibility: OperationalResponsibility
    unconsumed_consequences: tuple[OperationalObservedReturn, ...]


class OperationalConsciousness:
    """Mandatory decision/return boundary backed by the canonical event journal.

    This is not an independent planner or a second journal. In particular,
    recording an observation never implies that its consequence was consumed.
    """

    def __init__(self):
        self._operational_runtime = OperationalContinuityRuntimeState()
        self._problems: dict[tuple[Ref | None, Ref], OperationalResponsibility] = {}
        self._unconsumed_consequences: dict[
            tuple[Ref | None, Ref], dict[Ref, OperationalObservedReturn]
        ] = {}
        self._consequence_records_by_frame: dict[tuple[Ref | None, Ref | None], list[ActionObservedRecord]] = {}
        self._observed_actions_by_observation: dict[Ref, ActionObservedRecord] = {}
        self._observed_actions_by_dispatch: dict[Ref, ActionObservedRecord] = {}
        self._observed_actions_by_intent: dict[Ref, tuple[ActionObservedRecord, ...]] = {}
        self._consumptions_by_consequence: dict[Ref, tuple[OperationalConsciousnessConsumptionRecord, ...]] = {}
        self._engagement_dependency_refs: dict[tuple, FrozenMap] = {}
        self._consumptions: dict[Ref, OperationalConsciousnessConsumptionRecord] = {}
        self._responsibilities_by_intent: dict[Ref, OperationalResponsibility] = {}
        self._question_response_dependencies: dict[tuple, dict[Ref, FrozenMap]] = {}
        self._question_interpretation_dependencies: dict[tuple, dict[Ref, OperationalConsciousnessReevaluationRecord]] = {}
        self._reasoning_contexts: dict[Ref, OperationalConsciousnessReasoningContext] = {}
        self._reasoning_contexts_by_owner: dict[tuple[Ref, Ref], OperationalConsciousnessReasoningContext] = {}
        self._compiled_entries: dict[Ref, OperationalConsciousnessReasoningEntryRecord] = {}
        self._compiled_entries_by_context: dict[Ref, OperationalConsciousnessReasoningEntryRecord] = {}
        self._unreturned_reasoning: dict[Ref, OperationalConsciousnessReasoningEntryRecord] = {}
        self._reasoning_outcomes = {}
        self._reasoning_outcome_consumptions = {}
        self._branches: dict[Ref, OperationalConsciousnessBranchState] = {}
        self._public_reasoning_returns = {}
        self._contribution_requests = {}
        self._contribution_receipts = {}
        self._closed_child_attempts = {}
        self._reevaluation_work = {}
        self._current_goal_consumptions = {}
        self._reevaluation_by_timeline = {}
        self._goal_watches = {}
        self._inquiries = {}
        self._understanding = {}
        self._understanding_by_ref = {}
        self._understanding_consumptions = {}
        self._understanding_consumptions_by_assessment = {}
        self._understanding_observations = {}
        self._understanding_observations_by_question = {}
        self._understanding_observation_versions = {}
        self._understanding_observation_consumers = {}
        self._understanding_by_experiment = {}
        self._understanding_admission_by_scope = {}

    def understanding_assessments(self, timeline_ref, scope_ref, epoch):
        return MappingProxyType(self._understanding.get((timeline_ref, scope_ref, epoch), {}))

    def understanding_admission_assessments(self, timeline_ref, scope_ref):
        """Latest open admission per scoped question, including unexecuted trials."""
        return MappingProxyType(self._understanding_admission_by_scope.get((timeline_ref, scope_ref), {}))

    def understanding_assessment_consumptions(self, assessment_ref):
        """Exact canonical receipts, rebuilt by the same commit/restore projector."""
        return MappingProxyType(self._understanding_consumptions_by_assessment.get(assessment_ref, {}))

    def understanding_observation(self, assessment_ref):
        return self._understanding_observations.get(assessment_ref)

    def understanding_question_observations(self, timeline_ref, scope_ref, epoch, goal_ref, question_ref):
        return MappingProxyType(self._understanding_observations_by_question.get(
            (timeline_ref, scope_ref, epoch, goal_ref, question_ref), {}))

    def understanding_question_observation_version(self, timeline_ref, scope_ref, epoch, goal_ref, question_ref):
        return self._understanding_observation_versions.get((timeline_ref, scope_ref, epoch, goal_ref, question_ref))

    def understanding_observation_consumer(self, observation_ref):
        """Historical model/cost consumption; neither receipt grants ACT authority."""
        return self._understanding_observation_consumers.get(observation_ref)

    def pending_understanding_observation(self, assessment):
        """Carry an unconsumed return across intervening assessments of this question."""
        current = assessment
        for _ in range(256):
            if current is None:
                return None
            observed = self.understanding_observation(current.id)
            if observed is not None:
                consumer = self.understanding_observation_consumer(observed.id)
                if consumer is None or consumer.decision['source_disposition_ref'] == 'experiment.end_cost_limited_trial':
                    # Consuming an exhausted trial does not replenish it. Keep
                    # this boundary bound until a new scoped preparation exists.
                    return observed
            current = self._understanding_by_ref.get(current.previous_record_ref)
        return None

    def understanding_experiment_assessments(self, timeline_ref, experiment_ref):
        return MappingProxyType(self._understanding_by_experiment.get((timeline_ref, experiment_ref), {}))

    def understanding_assessment_is_current_ancestor(self, assessment):
        current = self.understanding_assessments(assessment.timeline_id, assessment.scope_ref, assessment.epoch).get(
            (assessment.goal_ref, assessment.question_ref))
        for _ in range(256):
            if current is None:
                return False
            if current.id == assessment.id:
                return True
            current = self._understanding_by_ref.get(current.previous_record_ref)
        return False

    def require_understanding_transition(self, record):
        if isinstance(record, OperationalUnderstandingAssessmentRecord):
            prior = self.understanding_assessments(record.timeline_id, record.scope_ref, record.epoch).get(
                (record.goal_ref, record.question_ref))
            if record.previous_record_ref != (prior.id if prior else None):
                raise ValueError('operational consciousness: understanding assessment lost its predecessor')
            if record.consumed_observation_ref is not None:
                incoming = record.decision['frozen_request']['observed_return']
                observed = self.understanding_observation(incoming['request']['assessment_ref'])
                cost_stop = record.decision['source_disposition_ref'] == 'experiment.end_cost_limited_trial'
                retained = tuple(ref for ref in record.decision['frozen_request']['model_refs'] if ref in (
                    *incoming['measured']['matching_model_refs'], *incoming['measured']['unassessed_model_refs']))
                if cost_stop and incoming['measured']['missing_refs']:
                    retained = tuple(record.decision['frozen_request']['model_refs'])
                if (observed is None or observed.id != record.consumed_observation_ref
                        or observed.returned != incoming or observed.timeline_id != record.timeline_id
                        or observed.frame_id != record.frame_id or (incoming['measured']['missing_refs'] and not cost_stop)
                        or not set(incoming.get('observed_stop_condition_refs', ())).issubset(
                            record.decision['frozen_request']['observed_stop_condition_refs'])
                        or tuple(record.decision['retained_model_refs']) != retained):
                    raise ValueError('operational consciousness: observation was not actually consumed with its scoped model result')
        elif isinstance(record, OperationalUnderstandingObservationRecord):
            assessment = self._understanding_by_ref.get(record.assessment_ref)
            prior = self.understanding_observation(record.assessment_ref)
            if (assessment is None or assessment.timeline_id != record.timeline_id
                    or record.previous_record_ref != (prior.id if prior else None)):
                raise ValueError('understanding observation lost its canonical assessment or predecessor')
            if not self.understanding_assessment_is_current_ancestor(assessment):
                raise ValueError('understanding observation targets another question lineage')
        elif isinstance(record, OperationalUnderstandingConsumptionRecord):
            assessment = self._understanding_by_ref.get(record.assessment_ref)
            if (assessment is None or assessment.timeline_id != record.timeline_id
                    or assessment.frame_id != record.frame_id or assessment.input_signature != record.input_signature
                    or record.operational_consciousness_context.timeline_ref != record.timeline_id
                    or assessment.source_hash != record.source_hash):
                raise ValueError('operational consciousness: understanding consumption has no exact current assessment')
            latest = self.understanding_assessments(record.timeline_id, assessment.scope_ref, assessment.epoch).get(
                (assessment.goal_ref, assessment.question_ref))
            if latest != assessment:
                raise ValueError('operational consciousness: understanding assessment has been superseded')
            transported = ('source_disposition_ref', 'unavailable_evidence_refs', 'cost_missing_fields')
            if any(name in record.model_fields_set for name in transported):
                decision = assessment.decision
                canonical = decision['frozen_request'].get('canonical_evidence')
                if (record.source_disposition_ref != decision['source_disposition_ref']
                        or canonical is None
                        or record.unavailable_evidence_refs != tuple(canonical['unavailable_refs'])
                        or record.cost_missing_fields != tuple(decision['frozen_measurement']['facts'].get('cost_missing_fields', ()))):
                    raise ValueError('operational consciousness: consumed disposition lost its exact remaining obligations')
            if ('admission_obligations' in assessment.decision
                    or 'admission_obligations' in record.model_fields_set):
                if ('admission_obligations' not in record.model_fields_set
                        or record.admission_obligations is None
                        or immutable_json_data(record.admission_obligations) != assessment.decision.get('admission_obligations')):
                    raise ValueError('operational consciousness: consumed admission work differs from the assessment')
            if ('conscious_reasoning_basis_digest' in assessment.decision
                    or 'conscious_reasoning_basis_digest' in record.model_fields_set):
                from agents.yf_arc3_v5.capabilities.experiment_frontier_contracts_c import ExperimentDecisionC
                decision = ExperimentDecisionC.model_validate(assessment.decision)
                if (decision.conscious_reasoning_basis_digest is None
                        or record.conscious_reasoning_basis_digest != decision.conscious_reasoning_basis_digest):
                    raise ValueError('operational consciousness: recipient did not consume the exact reasoning basis')
            if ('goal_contribution_review' in assessment.decision or 'goal_contribution_review' in record.model_fields_set):
                if ('goal_contribution_review' not in record.model_fields_set
                        or immutable_json_data(record.goal_contribution_review) != assessment.decision.get('goal_contribution_review')):
                    raise ValueError('operational consciousness: recipient lost the conditional goal contribution reasons')
        return record

    def inquiries(self, timeline_ref, scope_kind, inquiry_scope):
        key=(timeline_ref,scope_kind,stable_digest(inquiry_scope))
        return MappingProxyType(self._inquiries.get(key, {}))

    def require_inquiry_transition(self, record):
        prior=self.inquiries(record.timeline_id,record.scope_kind,record.inquiry_scope).get(record.question_ref)
        if record.previous_record_ref != (prior.id if prior else None):
            raise ValueError('operational consciousness: inquiry lost its preceding state')
        if record.phase == 'parent_consumed':
            if (prior is None or prior.phase != 'evaluated' or prior.id != record.producer_record_ref
                    or prior.evaluation != record.evaluation
                    or prior.operational_consciousness_context.parent_context_ref != record.operational_consciousness_context.context_ref):
                raise ValueError('operational consciousness: inquiry consumption lost its exact child return')
        return record

    def goal_watches(self, timeline_ref, execution_scope):
        return MappingProxyType(self._goal_watches.get((timeline_ref, stable_digest(execution_scope)), {}))

    def engagement_dependency_refs(self, timeline_ref, execution_scope, goal_ref):
        rows = self._engagement_dependency_refs.get((timeline_ref, stable_digest(execution_scope), goal_ref), FrozenMap())
        return tuple(sorted({ref for _, refs in sorted(rows.items()) for ref in refs}))

    def question_response_dependencies(self, timeline_ref, execution_scope, goal_ref):
        """Canonical returned evidence, including debts, for explicitly named goals.

        A continuation receipt closes routing, not the question it carries. This
        projection is rebuilt from the same canonical stream during restoration.
        It neither declares a mechanism nor satisfies an unknown prerequisite.
        """
        scope = FrozenMap({key: execution_scope.get(key)
            for key in ('game_ref', 'level_ref', 'session_ref')})
        rows = self._question_response_dependencies.get(
            (timeline_ref, stable_digest(scope), goal_ref), {})
        return FrozenMap(rows)

    def require_goal_watch_transition(self, record):
        prior = self.goal_watches(record.timeline_id, record.execution_scope).get(record.goal_ref)
        if record.previous_record_ref != (prior.id if prior else None):
            raise ValueError('operational consciousness: goal watch lost its prior scoped observation')
        return record

    def question_interpretation_dependencies(self, timeline_ref, execution_scope, goal_ref):
        """Consumed question reviews, indexed on commit and restored identically.

        These are changed inputs for the goal's existing review, never admission
        or a substitute for current Source/DRM qualification of their meaning.
        """
        scope = FrozenMap({key: execution_scope.get(key)
            for key in ('game_ref', 'level_ref', 'session_ref')})
        rows = self._question_interpretation_dependencies.get(
            (timeline_ref, stable_digest(scope), goal_ref), {})
        return FrozenMap({work_ref: FrozenMap({
            'record_ref': record.id, 'question_ref': record.demand.question_ref,
            'response_dependency_ref': record.demand.semantic_inputs['response_dependency_ref'],
            'source_workflow_ref': record.demand.origin_context.source_workflow_ref,
            'source_hash': record.demand.origin_context.source_hash,
            'dependency_versions': record.demand.dependency_versions,
            'interpretation_claim_refs': tuple(sorted(record.demand.dependency_versions['interpretation_claims'])),
            'projection_digest': record.projection_digest,
            'projection_facts': record.projection_facts,
        }) for work_ref, record in sorted(rows.items())})

    def reevaluation_state(self, work_ref):
        return self._reevaluation_work.get(work_ref)

    def require_goal_consumption_use(self, use, *, timeline_ref, execution_scope):
        from agents.yf_arc3_v5.logos.operational_reevaluation import OperationalConsciousnessGoalConsumptionUse
        use = OperationalConsciousnessGoalConsumptionUse.model_validate(use)
        state = self.reevaluation_state(use.work_ref)
        record = self._current_goal_consumptions.get(use.work_ref)
        if (state is None or state.status != 'consumed' or record is None
                or state.latest_record_ref != record.id or state.consumption_ref != use.consumption_ref
                or record.timeline_id != timeline_ref or use.execution_scope != execution_scope
                or use != OperationalConsciousnessGoalConsumptionUse.from_record(record,
                    action_goal_ref=use.action_goal_ref)):
            raise ValueError('operational consciousness: goal use lost its current canonical consumption')
        return use

    def reevaluation_agenda(self, timeline_ref):
        """Only this timeline's current obligations; terminal history stays in the journal."""
        return tuple(self._reevaluation_work[ref]
            for ref in sorted(self._reevaluation_by_timeline.get(timeline_ref, ())))

    def require_reevaluation_transition(self, record):
        previous = self.reevaluation_state(record.demand.work_ref)
        expected = previous.latest_record_ref if previous is not None else None
        if record.previous_record_ref != expected:
            raise ValueError('operational consciousness: reevaluation transition lost its preceding state')
        if previous is not None and previous.demand != record.demand:
            raise ValueError('operational consciousness: reevaluation rewrote its original premises')
        if previous is None and record.status != 'pending':
            raise ValueError('operational consciousness: work must first be admitted as pending')
        if record.status == 'superseded':
            if record.demand.work_ref in record.successor_work_refs:
                raise ValueError('operational consciousness: work cannot supersede itself')
            for ref in record.successor_work_refs:
                successor = self.reevaluation_state(ref)
                if (successor is None or successor.status == 'superseded'
                        or successor.demand.responsibility_identity() != record.demand.responsibility_identity()):
                    raise ValueError('operational consciousness: successor changed the question, work kind, '
                        'problem or execution ownership of its responsibility')
        return record

    def contribution_request_matches(self, request):
        retained = self._contribution_requests.get(request.request_ref)
        return retained is not None and retained.request == immutable_json_data(request)

    def require_contribution_request(self, record):
        from agents.yf_arc3_v5.scheduler.contribution_contract import ContributionRequest
        request = ContributionRequest.model_validate({key: record.request[key]
            for key in ContributionRequest.model_fields if key in record.request})
        operation = request.operational_consciousness.requesting_operation
        context = operation.context
        self.require_reasoning_execution(operation, run_ref=context.run_ref,
            timeline_ref=record.timeline_id, frame_ref=record.frame_id,
            workflow_ref=record.workflow_instance_id, source_workflow_ref=record.workflow_definition_id,
            source_hash=record.source_hash, operation_ref=operation.operation_ref)
        return record

    def index_closed_child_attempt(self, closure):
        """Derived index of a canonical activation, rebuilt from stored artifacts."""
        key = tuple(closure[field] for field in (
            'timeline_ref', 'parent_goal_ref', 'child_goal_ref', 'child_attempt_ref'))
        self._closed_child_attempts.setdefault(key, closure['closure_ref'])

    def closed_child_attempt_ref(self, *, timeline_ref, parent_goal_ref,
                                 child_goal_ref, child_attempt_ref):
        return self._closed_child_attempts.get((
            timeline_ref, parent_goal_ref, child_goal_ref, child_attempt_ref))

    def contribution_state(self, request_ref):
        record = self._contribution_requests.get(request_ref)
        if record is None:
            return None
        request = record.request
        origin = request['operational_consciousness']
        accepted, refused, activated = [], [], []
        for ref, receipt in sorted(self._contribution_receipts.get(request_ref, {}).items()):
            if receipt.prior_consumption_ref is not None:
                activated.append(ref)
            else:
                (accepted if receipt.accepted else refused).append(ref)
        return OperationalConsciousnessContributionState(request_ref=request_ref,
            requester_context_ref=origin['requesting_operation']['context']['context_ref'],
            question_ref=origin['question_ref'], parent_goal_ref=request.get('parent_goal_ref'),
            dependency_refs=tuple(request.get('dependency_refs', ())),
            accepted_receipt_refs=tuple(accepted), refused_receipt_refs=tuple(refused),
            activation_receipt_refs=tuple(activated), awaiting_accepted_return=not accepted,
            awaiting_explicit_activation=not activated)

    def branch_state(self, context_ref):
        return self._branches.get(context_ref)

    def current_public_reasoning_returns(self, *, timeline_ref, frame_ref):
        """Only actual deliveries whose branch still names that exact return."""
        rows = self._public_reasoning_returns.get((timeline_ref, frame_ref), {})
        current = []
        for context_ref, record in sorted(rows.items()):
            branch = self._branches.get(context_ref)
            outcome = record.returned_outcome
            if (branch is not None and branch.current_record_ref == outcome.producer_record_ref
                    and branch.status == outcome.status and branch.current_frame_ref == frame_ref):
                current.append(record)
        return tuple(current)

    def branch_return_state(self, outcome_ref):
        outcome = self._reasoning_outcomes.get(outcome_ref)
        if outcome is None:
            return None
        accepted, refused, inspected = [], [], []
        for ref, record in sorted(self._reasoning_outcome_consumptions.get(outcome_ref, {}).items()):
            binding = record.operational_consciousness
            if binding.returned_outcome_ref == outcome_ref:
                (accepted if record.accepted else refused).append(ref)
            if outcome_ref in binding.examined_outcome_refs:
                inspected.append(ref)
        return OperationalConsciousnessBranchReturnState(outcome=outcome,
            accepted_return_receipt_refs=tuple(accepted), refused_return_receipt_refs=tuple(refused),
            inspection_receipt_refs=tuple(inspected), has_accepted_return_consumer=bool(accepted))

    def require_reasoning_execution(self, operation, *, run_ref, timeline_ref, frame_ref,
                                    workflow_ref, source_workflow_ref, source_hash, operation_ref):
        """Live reasoning needs a currently active branch, not just a valid old context."""
        if operation.context.entry_kind in ('compiled_replay_validation', 'compiled_replay_child'):
            raise OperationalConsciousnessAdmissionError('reasoning_admission.live_entry_required',
                'operational consciousness: replay validation cannot authorize live reasoning or ACT')
        self.require_reasoning_operation(operation, run_ref=run_ref, timeline_ref=timeline_ref,
            frame_ref=frame_ref, workflow_ref=workflow_ref, source_workflow_ref=source_workflow_ref,
            source_hash=source_hash, operation_ref=operation_ref)
        branch = self.branch_state(operation.context.context_ref)
        if (branch is None or branch.context != operation.context
                or branch.status != 'active' or branch.current_frame_ref != frame_ref):
            raise OperationalConsciousnessAdmissionError('reasoning_admission.current_active_branch',
                'operational consciousness: reasoning branch is not active in this frame')
        return operation

    def require_compiled_reasoning_replay(self, returned):
        """Read/recompute a sealed pure return; this never reopens live execution."""
        self.require_reasoning_return(returned)
        self.require_reasoning_outcome(returned.outcome)
        branch = self.branch_state(returned.context.context_ref)
        if (branch is None or branch.current_record_ref != returned.outcome.producer_record_ref
                or branch.latest_return_ref != returned.outcome.producer_record_ref
                or branch.status != 'completed'):
            raise ValueError('operational consciousness: replay has no exact completed branch')
        return returned

    def require_reasoning_operation(self, operation, *, run_ref, timeline_ref, frame_ref,
                                    workflow_ref, source_workflow_ref, source_hash, operation_ref):
        """Every interpreted CALL and operator checks conscious task ownership.

        The compiled variant requires a prior canonical entry with instructions
        extracted from qualified Source. Measurements may have no FOR question.
        Neither variant turns a technical workflow name into a world goal.
        """
        context = operation.context
        expected_ref = reasoning_context_ref(run_ref=run_ref, timeline_ref=timeline_ref,
            owner_workflow_ref=workflow_ref, source_workflow_ref=source_workflow_ref, source_hash=source_hash)
        if (context.context_ref != expected_ref or context.run_ref != run_ref
                or context.timeline_ref != timeline_ref or context.owner_workflow_ref != workflow_ref
                or context.source_workflow_ref != source_workflow_ref or context.source_hash != source_hash
                or operation.current_frame_ref != frame_ref or operation.operation_ref != operation_ref):
            raise OperationalConsciousnessAdmissionError('reasoning_admission.exact_source_context',
                'operational consciousness: reasoning operation lost its Source context')
        retained = self._reasoning_contexts.get(context.context_ref)
        if retained is not None and retained != context:
            raise OperationalConsciousnessAdmissionError('reasoning_admission.unchanged_canonical_context',
                'operational consciousness: reasoning context changed without requalification')
        if retained is None:
            raise OperationalConsciousnessAdmissionError('reasoning_admission.canonical_context_present',
                'operational consciousness: reasoning context is not canonical')
        if context.entry_kind in ('compiled_source_workflow', 'compiled_replay_validation',
                                  'compiled_source_child', 'compiled_replay_child'):
            entry = self._compiled_entries_by_context.get(context.context_ref)
            if entry is None or not any(
                    item.statement_ref == operation.statement_ref and item.operation_ref == operation_ref
                    and item.declared_question_ref == operation.declared_question_ref
                    for item in entry.declared_operations):
                raise OperationalConsciousnessAdmissionError('reasoning_admission.exact_admitted_instruction',
                    'operational consciousness: compiled operation has no exact admitted instruction')
        return operation

    def compiled_entry(self, entry_ref):
        return self._compiled_entries.get(entry_ref)

    def compiled_entry_for_context(self, context_ref):
        return self._compiled_entries_by_context.get(context_ref)

    def reasoning_context(self, context_ref):
        return self._reasoning_contexts.get(context_ref)

    def pending_reasoning_entries(self):
        return tuple(self._unreturned_reasoning.values())

    def reasoning_outcome(self, producer_record_ref):
        return self._reasoning_outcomes.get(producer_record_ref)

    def require_reasoning_outcome(self, outcome):
        if outcome is None or self._reasoning_outcomes.get(outcome.producer_record_ref) != outcome:
            raise ValueError('operational consciousness: reasoning outcome is not canonical')
        return outcome

    def require_outcome_consumption(self, record, *, store):
        binding = record.operational_consciousness
        retained = self._reasoning_contexts.get(binding.consumer_context.context_ref)
        if retained != binding.consumer_context:
            raise ValueError('operational consciousness: outcome consumer has no canonical context')
        if record.prior_consumption_ref is not None:
            prior = self._contribution_receipts.get(record.request_ref, {}).get(record.prior_consumption_ref)
            if (prior is None or prior.id == record.id or prior.state_revision > record.state_revision
                    or not prior.accepted or not record.accepted
                    or any(getattr(prior, field) != getattr(record, field) for field in (
                        'request_ref', 'recipient_workflow_ref', 'return_digest', 'timeline_id', 'frame_id',
                        'examined_product_refs', 'comparison_facts'))
                    or any(getattr(prior.operational_consciousness, field) != getattr(binding, field)
                        for field in ('basis', 'returned_outcome_ref', 'examined_outcome_refs'))):
                raise ValueError('operational consciousness: activation changed its consumed return or recipient')
        if record.accepted and binding.basis == 'source_return':
            request = self._contribution_requests.get(record.request_ref)
            if (request is None or request.request['recipient_workflow_ref'] != record.recipient_workflow_ref
                    or record.comparison_facts.get('return_request_origin_matches') is not True
                    or record.comparison_facts.get('return_request_digest') != stable_digest(request.request)):
                raise ValueError('operational consciousness: accepted contribution lost its original obligation')
        refs = ((binding.returned_outcome_ref,) if binding.returned_outcome_ref else ()) + binding.examined_outcome_refs
        for ref in refs:
            outcome = self._reasoning_outcomes.get(ref)
            if outcome is None:
                raise ValueError('operational consciousness: consumed reasoning outcome is missing')
            if record.accepted and (outcome.context.timeline_ref != record.timeline_id
                                    or outcome.current_frame_ref != record.frame_id):
                raise ValueError('operational consciousness: accepted outcome belongs to another scope')
        require_consumed_source_boundary(record, consciousness=self, store=store)
        return record

    def require_canonical_transition(self, record, *, store=None):
        """One guard dispatch for controlled producers and the journal boundary.

        These guards verify existing declared transitions. They neither choose
        a disposition nor replace the current Source/DRM reasoning contract.
        """
        for kind, guard in _CANONICAL_STORE_TRANSITION_GUARDS:
            if isinstance(record, kind):
                return guard(record, consciousness=self, store=store)
        for kind, guard in _CANONICAL_TRANSITION_GUARDS:
            if isinstance(record, kind):
                getattr(self, guard)(record)
                break
        return record

    def require_compiled_transition(self, record):
        self.require_reasoning_return(record.operational_consciousness)
        if isinstance(record, (OperationalConsciousnessReasoningCallDeferralRecord,
                               OperationalConsciousnessReasoningCallRefusalRecord)):
            deferred = isinstance(record, OperationalConsciousnessReasoningCallDeferralRecord)
            returned = record.operational_consciousness
            call = record.call_deferral if deferred else record.call_refusal
            if not deferred and record.direct_call_operation is not None:
                operation = record.direct_call_operation
                self.require_reasoning_operation(operation,
                    run_ref=returned.context.run_ref, timeline_ref=record.timeline_id,
                    frame_ref=record.frame_id, workflow_ref=returned.context.owner_workflow_ref,
                    source_workflow_ref=returned.context.source_workflow_ref,
                    source_hash=returned.context.source_hash, operation_ref=call.callee_ref)
                # No child exists: the typed contract binds the exact invocation.
                return record
            if not deferred and call.reasoning_entry_refusal is not None:
                # The record validator binds this explicit admission refusal to
                # the actual instruction; no child was admitted in this case.
                return record
            checkpoint_ref = call.child_deferred_checkpoint_ref if deferred else call.child_failure_checkpoint_ref
            child_ref = call.child_reasoning_outcome_ref or checkpoint_ref
            child = self._reasoning_outcomes.get(child_ref)
            expected_boundary = ('compiled_return' if call.child_reasoning_outcome_ref is not None
                else 'workflow_checkpoint')
            statuses = (('deferred',) if deferred else
                ('blocked', 'failed') if expected_boundary == 'workflow_checkpoint' else ('blocked',))
            if (child is None or child.status not in statuses or child.boundary_kind != expected_boundary
                    or child.current_frame_ref != record.frame_id
                    or child.recipient_context_ref != returned.context.context_ref
                    or child.context.parent_context_ref != returned.context.context_ref
                    or child.context.composition_edge_ref != call.statement_ref):
                raise ValueError('operational consciousness: child is not a canonical return to this caller')
            if expected_boundary == 'compiled_return':
                entry = self._compiled_entries_by_context.get(child.context.context_ref)
                origin = entry.initiating_operation if entry is not None else None
                if (origin is None or origin not in returned.operations
                        or origin.operation_ref != call.callee_ref):
                    raise ValueError('operational consciousness: compiled child changed its initiating instruction')
            elif child.context.parent_checkpoint_ref != returned.entry_ref:
                raise ValueError('operational consciousness: interpreted child names another compiled entry')
        return record

    def validate_transaction(self, artifacts, *, store):
        """Validate ordered canonical transitions without changing live indexes.

        Earlier artifacts in this transaction are visible; future artifacts are
        not. The full projection is shared with append/replay, so a branch
        completion, superseded assessment or removed debt in this batch is
        visible to its later guards. No historical index is copied wholesale.
        """
        if not any(isinstance(row, _CANONICAL_TRANSITION_TYPES) for row in artifacts):
            return
        if all(isinstance(row, (CompiledSelectionDecisionRecord, CompiledCalculationFailureRecord,
                               CompiledCalculationPublicReturnRecord))
               and (not isinstance(row, CompiledSelectionDecisionRecord)
                    or row.operational_consciousness is None) for row in artifacts):
            # These receipts neither read nor write continuity indexes. Keep
            # their source/scope and ordered producer guards, without allocating
            # the entire operational frontier for an internal calculation.
            authority = TransactionArtifactView(store, operational_consciousness=self)
            for artifact in artifacts:
                self.require_canonical_transition(artifact, store=authority)
                authority.index_artifact(artifact)
            return
        staged = _TransactionOperationalConsciousness(self)
        for name, index in sorted(vars(self).items()):
            if name == '_operational_runtime':
                # A staging view starts with its own empty runtime cache. No
                # cached validation or timing is canonical evidence to overlay.
                continue
            if not isinstance(index, dict):
                raise TypeError(f'operational consciousness: unprojected transaction index {name}')
        authority = TransactionArtifactView(store, operational_consciousness=staged)
        for artifact in artifacts:
            staged.require_canonical_transition(artifact, store=authority)
            staged.index_canonical_artifact(artifact)
            authority.index_artifact(artifact)

        # A retirement receipt attests an applied consequence, never a promise
        # to interrupt later. Validate the sealed batch after its ordered guards.
        for artifact in artifacts:
            if isinstance(artifact, (OperationalConsciousnessDispatchRetirementRecord,
                                     OperationalConsciousnessResponseReconciliationRecord)):
                retired = authority.artifact(artifact.retired_checkpoint_ref)
                if (not isinstance(retired, WorkflowInstanceRecord)
                        or retired.status.value != 'blocked' or artifact.id not in retired.provenance):
                    raise ValueError('dispatch retirement receipt requires its atomic checkpoint consequence')

    def _index_consumption_prerequisites(self, artifact):
        """Mechanical projection shared by transaction preflight and replay."""
        if isinstance(artifact, OperationalConsciousnessReasoningEntryRecord):
            self._reasoning_contexts[artifact.context.context_ref] = artifact.context
        elif isinstance(artifact, ConsciousCompiledRecord) and artifact.operational_consciousness is not None:
            self._reasoning_outcomes[artifact.id] = artifact.operational_consciousness.outcome
        elif isinstance(artifact, WorkflowInstanceRecord):
            context = artifact.operational_consciousness_context
            self._reasoning_contexts[context.context_ref] = context
            if artifact.operational_consciousness_outcome is not None:
                self._reasoning_outcomes[artifact.id] = artifact.operational_consciousness_outcome
        elif isinstance(artifact, OperatorInvocation):
            context = artifact.operational_consciousness.context
            self._reasoning_contexts[context.context_ref] = context
        elif isinstance(artifact, OperationalConsciousnessContributionRequestRecord):
            self._contribution_requests[artifact.id] = artifact
        elif isinstance(artifact, ContributionConsumptionRecord):
            self._contribution_receipts.setdefault(artifact.request_ref, {})[artifact.id] = artifact

    def require_contribution_activation(self, record, *, continuation_ref, recipient_workflow_ref,
                                        timeline_ref, frame_ref, store):
        """Qualify the exact Source-selected continuation, never release an action."""
        retained = self._contribution_receipts.get(record.request_ref, {}).get(record.id)
        if (retained != record or not record.accepted or record.prior_consumption_ref is None
                or continuation_ref not in record.enabled_continuation_refs
                or record.recipient_workflow_ref != recipient_workflow_ref
                or record.timeline_id != timeline_ref or record.frame_id != frame_ref):
            raise ValueError('operational consciousness: continuation lacks its current activation receipt')
        return self.require_outcome_consumption(record, store=store)

    def require_reasoning_return(self, returned):
        if returned is None:
            raise ValueError('direct calculation has no coordination return to consume')
        entry = self._compiled_entries.get(returned.entry_ref)
        if entry is None or returned.context != entry.context:
            raise ValueError('operational consciousness: reasoning return has no canonical entry')
        origin = entry.initiating_operation
        recipient = origin.context.context_ref if origin is not None else entry.context.context_ref
        if (returned.outcome.recipient_context_ref != recipient
                or returned.outcome.current_frame_ref != entry.frame_id
                or returned.outcome.evidence_refs != (entry.id,)):
            raise ValueError('operational consciousness: compiled outcome lost its actual recipient or evidence')
        for operation in returned.operations:
            context = entry.context
            self.require_reasoning_operation(operation, run_ref=context.run_ref,
                timeline_ref=context.timeline_ref, frame_ref=entry.frame_id,
                workflow_ref=context.owner_workflow_ref, source_workflow_ref=context.source_workflow_ref,
                source_hash=context.source_hash, operation_ref=operation.operation_ref)
        return returned

    def problem_state(self, responsibility_ref: Ref, timeline_ref: Ref | None):
        key = (timeline_ref, responsibility_ref)
        responsibility = self._problems.get(key)
        if responsibility is None:
            return None
        return OperationalConsciousnessProblem(
            responsibility=responsibility,
            unconsumed_consequences=tuple(self._unconsumed_consequences.get(key, {}).values()))

    def prepare_responsible_action(self, *, intent_fields, world_context):
        """Bind declared meaning to the retained problem without changing state."""
        ref = responsibility_identity(intent_fields, world_context)
        previous = self._problems.get((intent_fields.get('timeline_id'), ref))
        reasoning = self._reasoning_contexts_by_owner.get((intent_fields.get('timeline_id'),
                                                          intent_fields.get('workflow_instance_id')))
        if reasoning is None:
            raise ValueError('operational consciousness: action has no retained reasoning context')
        return bind_declared_action_responsibility(intent_fields, world_context, previous,
                                                   reasoning_context_ref=reasoning.context_ref)

    def require_continuity_before_action(self, intent, world_context):
        """Reject a detached or superseded decision; never select a replacement."""
        started_ns = perf_counter_ns()
        runtime = self._operational_runtime
        responsibility = intent.operational_consciousness.responsibility
        context = runtime.context
        if responsibility.return_obligation is not None:
            if context is None or not context.matches(intent):
                context = OperationalContinuityContext.prepare(intent)
                runtime.context = context
                runtime.context_preparations += 1
            else:
                runtime.context_reuses += 1
            context.require_current_scope(world_context)
        else:
            # A direct Source action needs current evidence and execution scope,
            # not a continuity context or a fictitious parent return.
            validate_action_responsibility(intent, world_context)
        for use in intent.operational_goal_consumptions:
            self.require_goal_consumption_use(use, timeline_ref=intent.timeline_id,
                execution_scope=responsibility.execution_scope)
        reasoning = self._reasoning_contexts.get(responsibility.reasoning_context_ref)
        if (reasoning is None or reasoning.timeline_ref != intent.timeline_id
                or reasoning.owner_workflow_ref != responsibility.source_owner_workflow_ref
                or reasoning.source_hash != responsibility.source_hash):
            raise ValueError('operational consciousness: action lost its reasoning origin')
        previous = self._problems.get((intent.timeline_id, responsibility.responsibility_ref))
        current_version = previous.version_ref if previous is not None else None
        if current_version not in (responsibility.previous_version_ref, responsibility.version_ref):
            raise ValueError('operational consciousness: stale problem version')
        elapsed_ns = perf_counter_ns() - started_ns
        runtime.guard_count += 1
        runtime.guard_total_ns += elapsed_ns
        runtime.guard_max_ns = max(runtime.guard_max_ns, elapsed_ns)
        return intent

    def operational_continuity_cost_summary(self):
        """Bounded successful guard costs; excludes planning and failed checks."""
        return FrozenMap({
            'scope': 'successful_action_context_checks_only',
            'context_preparations': self._operational_runtime.context_preparations,
            'context_reuses': self._operational_runtime.context_reuses,
            'guard_count': self._operational_runtime.guard_count,
            'guard_total_ms': self._operational_runtime.guard_total_ns / 1_000_000,
            'guard_max_ms': self._operational_runtime.guard_max_ns / 1_000_000,
        })

    def require_intent_publication(self, intent):
        # Publication checks the predecessor before indexing can replace it.
        # ACT still revalidates the current world and preservation constraints.
        return self.require_continuity_before_action(intent, None)

    def bind_observed_consequence(self, canonical_intent, observation_ref):
        """Address an observed result to its original problem, even after revision."""
        return bind_observed_return(canonical_intent, observation_ref)

    def observed_consequences_at(self, timeline_ref, frame_ref):
        """Exact causal-frame lookup; never use the latest unrelated action."""
        return tuple(self._consequence_records_by_frame.get((timeline_ref, frame_ref), ()))

    def observed_action_for_observation(self, observation_ref):
        return self._observed_actions_by_observation.get(observation_ref)

    def observed_action_for_dispatch(self, dispatch_ref):
        return self._observed_actions_by_dispatch.get(dispatch_ref)

    def observed_actions_for_intent(self, intent_ref):
        return self._observed_actions_by_intent.get(intent_ref, ())

    def consumptions_for_consequence(self, consequence_ref):
        return self._consumptions_by_consequence.get(consequence_ref, ())

    def require_consumed_continuation(self, *, receipt_ref, consumer_workflow_ref,
                                      timeline_ref, frame_ref, assessment, continuation_facts):
        """The dispatch adapter must read the same continuation consumed by Source."""
        receipt = self._consumptions.get(receipt_ref)
        alternatives = immutable_json_data(assessment).get('alternatives', {})
        if (receipt is None or receipt.consumer_workflow_ref != consumer_workflow_ref
                or receipt.timeline_id != timeline_ref or receipt.frame_id != frame_ref
                or receipt.selection_digest != stable_digest(immutable_json_data(assessment))
                or receipt.disposition_ref != alternatives.get('selected')
                or receipt.continuation_facts != immutable_json_data(continuation_facts)):
            raise ValueError('operational consciousness: continuation has no exact canonical consumption')
        return receipt

    def index_canonical_artifact(self, artifact):
        """Project only accepted events, identically during append and replay.

        This projection performs no fallible post-commit semantic decision.
        Transition validation runs before append; replay retains historical
        evidence without treating it as freshly qualified execution authority.
        Consumption needs its own evidenced disposition, not an inferred reset.
        """
        self._index_consumption_prerequisites(artifact)
        if isinstance(artifact, OperationalConsciousnessPublicReturnRecord):
            key = (artifact.timeline_id, artifact.frame_id)
            rows = dict(self._public_reasoning_returns.get(key, {}))
            rows[artifact.returned_outcome.context.context_ref] = artifact
            self._public_reasoning_returns[key] = rows
        elif isinstance(artifact, OperationalConsciousnessReasoningEntryRecord):
            context = artifact.context
            self._compiled_entries[artifact.id] = artifact
            self._compiled_entries_by_context[context.context_ref] = artifact
            self._unreturned_reasoning[artifact.id] = artifact
            origin = artifact.initiating_operation
            self._branches[context.context_ref] = OperationalConsciousnessBranchState(
                context=context, entry_record_ref=artifact.id, current_record_ref=artifact.id,
                caller_context_ref=origin.context.context_ref if origin is not None else None,
                origin_question_ref=origin.declared_question_ref if origin is not None else None,
                status='active', current_frame_ref=artifact.frame_id,
                current_step_ref=artifact.workflow_step_id, current_statement_ref=None)
        elif isinstance(artifact, ConsciousCompiledRecord) and artifact.operational_consciousness is not None:
            self._unreturned_reasoning.pop(artifact.operational_consciousness.entry_ref, None)
            returned = artifact.operational_consciousness
            branch = self._branches.get(returned.context.context_ref)
            if branch is not None:
                entry = self._compiled_entries[returned.entry_ref]
                last = returned.operations[-1] if returned.operations else None
                step_ref = (next((row.step_ref for row in entry.declared_operations
                                 if row.statement_ref == last.statement_ref), None)
                    if last is not None else entry.workflow_step_id)
                self._branches[returned.context.context_ref] = branch.model_copy(update={
                    'current_record_ref': artifact.id, 'status': returned.outcome.status,
                    'current_frame_ref': artifact.frame_id,
                    'current_step_ref': step_ref, 'current_statement_ref': last.statement_ref if last else None,
                    'declared_question_refs': tuple(sorted({op.declared_question_ref for op in returned.operations
                                                           if op.declared_question_ref is not None})),
                    'latest_return_ref': artifact.id})
        elif isinstance(artifact, WorkflowInstanceRecord):
            context = artifact.operational_consciousness_context
            self._reasoning_contexts_by_owner[(context.timeline_ref, context.owner_workflow_ref)] = context
            previous = self._branches.get(context.context_ref)
            self._branches[context.context_ref] = OperationalConsciousnessBranchState(
                context=context, entry_record_ref=previous.entry_record_ref if previous is not None else artifact.id,
                current_record_ref=artifact.id, caller_context_ref=context.parent_context_ref,
                status=artifact.status.value, current_frame_ref=artifact.frame_id,
                current_step_ref=artifact.current_step_id, current_statement_ref=artifact.current_statement_id,
                pending_action_intent_ref=artifact.pending_action_intent_id,
                pending_expectation_refs=artifact.pending_expectation_refs,
                declared_question_refs=previous.declared_question_refs if previous is not None else (),
                responsibility_refs=previous.responsibility_refs if previous is not None else (),
                latest_return_ref=(artifact.id if artifact.operational_consciousness_outcome is not None
                                   else previous.latest_return_ref if previous is not None else None))
        elif isinstance(artifact, OperationalUnderstandingAssessmentRecord):
            key = (artifact.timeline_id, artifact.scope_ref, artifact.epoch)
            self._understanding.setdefault(key, {})[(artifact.goal_ref, artifact.question_ref)] = artifact
            self._understanding_by_ref[artifact.id] = artifact
            if artifact.consumed_observation_ref is not None:
                self._understanding_observation_consumers[artifact.consumed_observation_ref] = artifact
            experiment = artifact.decision['experiment_ref']
            self._understanding_by_experiment.setdefault((artifact.timeline_id, experiment), {})[
                (artifact.scope_ref, artifact.epoch, artifact.goal_ref, artifact.question_ref)] = artifact
            admission = self._understanding_admission_by_scope.setdefault(
                (artifact.timeline_id, artifact.scope_ref), {})
            question = (artifact.goal_ref, artifact.question_ref)
            if artifact.decision.get('admission_obligations'):
                admission[question] = artifact
            else:
                admission.pop(question, None)
        elif isinstance(artifact, OperationalUnderstandingConsumptionRecord):
            self._understanding_consumptions[artifact.id] = artifact
            self._understanding_consumptions_by_assessment.setdefault(artifact.assessment_ref, {})[artifact.id] = artifact
        elif isinstance(artifact, OperationalUnderstandingObservationRecord):
            self._understanding_observations[artifact.assessment_ref] = artifact
            assessment = self._understanding_by_ref.get(artifact.assessment_ref)
            if assessment is not None:
                key = (assessment.timeline_id, assessment.scope_ref, assessment.epoch,
                    assessment.goal_ref, assessment.question_ref)
                scoped = self._understanding_observations_by_question.setdefault(key, {})
                if scoped.get(artifact.assessment_ref) != artifact:
                    self._understanding_observation_versions[key] = stable_digest((
                        self._understanding_observation_versions.get(key), artifact))
                    scoped[artifact.assessment_ref] = artifact
        elif isinstance(artifact, OperationalConsciousnessInquiryRecord):
            key=(artifact.timeline_id,artifact.scope_kind,stable_digest(artifact.inquiry_scope))
            self._inquiries.setdefault(key,{})[artifact.question_ref]=artifact
        elif isinstance(artifact, OperationalConsciousnessContinuationReviewRecord):
            frontier = artifact.selection_frontier
            review = retained_engagement_measurement(artifact)
            dependencies = review.dependency_review if review else None
            if (dependencies is not None and review.incoming_scope_current and review.engagement_refs
                    and frontier.execution_scope == artifact.identity.get('execution_scope')
                    and review.identity_digest == stable_digest(artifact.identity)):
                key = (artifact.timeline_id, stable_digest(frontier.execution_scope), dependencies.goal_ref)
                engagement_ref = stable_digest(review.engagement_refs)
                rows = dict(self._engagement_dependency_refs.get(key, FrozenMap()).items())
                if review.lease_consumption_complete:
                    rows.pop(engagement_ref, None)
                else:
                    rows[engagement_ref] = tuple(sorted(set((*dependencies.declared_premise_refs,
                        *dependencies.preservation_refs,
                        *(ref for _, evidence in sorted(dependencies.contest_evidence_versions.items()) for ref in evidence)))))
                self._engagement_dependency_refs[key] = FrozenMap(rows)
        elif isinstance(artifact, OperationalConsciousnessGoalWatchRecord):
            key = (artifact.timeline_id, stable_digest(artifact.execution_scope))
            self._goal_watches.setdefault(key, {})[artifact.goal_ref] = artifact
        elif isinstance(artifact, OperationalConsciousnessReevaluationRecord):
            if artifact.demand.kind == 'goal_dependency_admission':
                if artifact.status == 'consumed':
                    self._current_goal_consumptions[artifact.demand.work_ref] = artifact
                else:
                    self._current_goal_consumptions.pop(artifact.demand.work_ref, None)
            self._reevaluation_work[artifact.demand.work_ref] = OperationalConsciousnessReevaluationState(
                demand=artifact.demand, latest_record_ref=artifact.id, status=artifact.status,
                consumption_ref=artifact.consumption_ref,
                wake_dependency_versions=artifact.wake_dependency_versions,
                wake_reason_ref=artifact.wake_reason_ref, successor_work_refs=artifact.successor_work_refs)
            self._reevaluation_by_timeline.setdefault(artifact.timeline_id, set()).add(artifact.demand.work_ref)
            if artifact.demand.kind == 'question_interpretation_review':
                scope = FrozenMap({key: artifact.demand.execution_scope.get(key)
                    for key in ('game_ref', 'level_ref', 'session_ref')})
                key = (artifact.timeline_id, stable_digest(scope), artifact.demand.problem_ref)
                rows = self._question_interpretation_dependencies.setdefault(key, {})
                if artifact.status == 'consumed':
                    rows[artifact.demand.work_ref] = artifact
                else:
                    # Supersession or reopening withdraws the consumed input.
                    # Do not retain a once-consumed interpretation as current.
                    rows.pop(artifact.demand.work_ref, None)
        elif isinstance(artifact, ContributionConsumptionRecord):
            binding = artifact.operational_consciousness
            refs = ((binding.returned_outcome_ref,) if binding.returned_outcome_ref else ()) + binding.examined_outcome_refs
            for ref in refs:
                self._reasoning_outcome_consumptions.setdefault(ref, {})[artifact.id] = artifact
        elif isinstance(artifact, OperatorInvocation):
            context = artifact.operational_consciousness.context
            branch = self._branches.get(context.context_ref)
            question = artifact.operational_consciousness.declared_question_ref
            if branch is not None and question is not None and question not in branch.declared_question_refs:
                self._branches[context.context_ref] = branch.model_copy(update={
                    'declared_question_refs': tuple(sorted((*branch.declared_question_refs, question)))})
        elif isinstance(artifact, ActionIntent):
            responsibility = artifact.operational_consciousness.responsibility
            self._responsibilities_by_intent[artifact.id] = responsibility
            self._problems[(artifact.timeline_id, responsibility.responsibility_ref)] = responsibility
            branch = self._branches.get(responsibility.reasoning_context_ref)
            if branch is not None and responsibility.responsibility_ref not in branch.responsibility_refs:
                self._branches[responsibility.reasoning_context_ref] = branch.model_copy(update={
                    'responsibility_refs': tuple(sorted((*branch.responsibility_refs, responsibility.responsibility_ref)))})
        elif isinstance(artifact, ActionObservedRecord):
            self._observed_actions_by_observation[artifact.observation_record_id] = artifact
            self._observed_actions_by_dispatch[artifact.environment_action_event_ref] = artifact
            prior = self._observed_actions_by_intent.get(artifact.action_intent_id, ())
            self._observed_actions_by_intent[artifact.action_intent_id] = (*prior, artifact)
            consequence = artifact.operational_consciousness_return
            key = (artifact.timeline_id, consequence.responsibility_ref)
            self._unconsumed_consequences.setdefault(key, {})[consequence.observation_ref] = consequence
            self._consequence_records_by_frame.setdefault((artifact.timeline_id, artifact.frame_id), []).append(artifact)
        elif isinstance(artifact, OperationalConsciousnessConsumptionRecord):
            self._consumptions[artifact.id] = artifact
            for response in artifact.question_responses or ():
                responsibility = self._responsibilities_by_intent[response.intent_ref]
                scope = FrozenMap({key: responsibility.execution_scope[key]
                    for key in ('game_ref', 'level_ref', 'session_ref')})
                # These are frozen declared recipients, not geometric proximity,
                # an inferred parent or a newly chosen goal.
                native = isinstance(response, OperationalConsciousnessNativeQuestionResponse)
                goals = (response.owner_goal_ref, response.recipient_goal_ref,
                    *(responsibility.problem.possible_beneficiary_goal_refs if not native else ()))
                identity = (response.intent_ref, response.observation_ref)
                if native:
                    identity = (*identity, response.question_binding)
                dependency_ref = 'conscious-question-response:' + stable_digest(identity)
                for goal_ref in dict.fromkeys(goals):
                    if goal_ref is None:
                        continue
                    rows = self._question_response_dependencies.setdefault(
                        (artifact.timeline_id, stable_digest(scope), goal_ref), {})
                    previous = rows.get(dependency_ref)
                    # Repeated consumption of identical information is not a
                    # changed premise. Retain its first canonical carrier.
                    candidate = FrozenMap({
                        'consumption_record_ref': artifact.id, 'response': response})
                    if previous is None or previous['response'] != candidate['response']:
                        rows[dependency_ref] = candidate
            for ref in artifact.consequence_record_refs:
                prior = self._consumptions_by_consequence.get(ref, ())
                self._consumptions_by_consequence[ref] = (*prior, artifact)
            for consequence in artifact.consequences:
                key = (artifact.timeline_id, consequence.responsibility_ref)
                pending = self._unconsumed_consequences.get(key)
                if pending is not None and pending.get(consequence.observation_ref) == consequence:
                    pending.pop(consequence.observation_ref)


class _TransactionOperationalConsciousness(OperationalConsciousness):
    """Speculative indexes allocated only on first use in this transaction.

    Existing projection/guard methods remain the only implementation. A read
    of a mutable bucket always passes through TransactionIndexOverlay before
    it can be modified; no live canonical index is exposed to a staged write.
    The disposable runtime cache is also private and created only on demand.
    """
    def __init__(self, base):
        self._base_indexes = vars(base)

    def __getattr__(self, name):
        if name == '_operational_runtime':
            value = OperationalContinuityRuntimeState()
        else:
            index = self._base_indexes.get(name)
            if index is None:
                raise AttributeError(name)
            if not isinstance(index, dict):
                raise TypeError(f'operational consciousness: unprojected transaction index {name}')
            value = TransactionIndexOverlay(index)
        setattr(self, name, value)
        return value
