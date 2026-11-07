"""Append-only event authority with atomic reducer-validated commits."""

from __future__ import annotations

from collections import ChainMap
from bisect import bisect_right
from collections.abc import Sequence
from itertools import groupby
from threading import RLock
from typing import Generic, TypeVar, overload

from agents.yf_arc3_v5.logos.types import Ref
from agents.yf_arc3_v5.logos.claims import Claim
from agents.yf_arc3_v5.logos.operations import (
    ActionIntent, ActionObservedRecord, ContributionConsumptionRecord,
    OperationalConsciousnessConsumptionRecord,
    OperationalConsciousnessContinuationReviewRecord,
    EnvironmentActionDispatchedRecord, GoalFrontierReviewRecord, CompiledTemporalTrackingRecord,
    CompiledInteractionEffectRecord, OperatorResult, PropagationReport,
    ConcentrationActionAccountingRecord, ConcentrationGovernanceRecord,
    ConcentrationLease, ConcentrationLeaseState, ConcentrationLeaseTransition,
    ConcentrationOutcome, ReasoningContextStack, WorkflowInstanceRecord,
)
from agents.yf_arc3_v5.performance import begin_profile, finish_profile
from agents.yf_arc3_v5.state.events import (
    CognitiveArtifact,
    CognitiveEvent,
    PutClaim,
    PutTerm,
    RecordArtifact,
    StateMutation,
)
from agents.yf_arc3_v5.state.reducer import (
    ReductionError,
    reduce_event_delta,
)
from agents.yf_arc3_v5.state.snapshot import CognitiveSnapshot
from agents.yf_arc3_v5.state.operational_consciousness import OperationalConsciousness
from agents.yf_arc3_v5.state.transactions import (
    DuplicateTransactionError,
    StateConflictError,
    TransactionReceipt,
    TransactionRequest,
)


_T = TypeVar("_T")
_TERMINAL_CONCENTRATION_STATES = frozenset((
    ConcentrationLeaseState.RECONCILED, ConcentrationLeaseState.INTERRUPTED,
    ConcentrationLeaseState.INVALIDATED, ConcentrationLeaseState.EXPIRED,
))


class _ReadOnlyListView(Sequence[_T], Generic[_T]):
    """Zero-copy sequence view over one append-only canonical list."""

    __slots__ = ("_values",)

    def __init__(self, values: list[_T]) -> None:
        self._values = values

    @overload
    def __getitem__(self, index: int) -> _T: ...

    @overload
    def __getitem__(self, index: slice) -> list[_T]: ...

    def __getitem__(self, index: int | slice) -> _T | list[_T]:
        return self._values[index]

    def __len__(self) -> int:
        return len(self._values)


class EventStore:
    """The only mutable container in the M1 state path.

    Mutation is append-only and occurs only after reducing the complete
    candidate event sequence succeeds.  A failed transaction leaves both the
    journal and snapshot unchanged.
    """

    def __init__(self, run_id: Ref, *, snapshot_schema_version: Ref = "yf_arc3_v5.cognitive_snapshot.v2") -> None:
        if snapshot_schema_version not in (
            "yf_arc3_v5.cognitive_snapshot.v2", "yf_arc3_v5.cognitive_snapshot.v3",
            "yf_arc3_v5.cognitive_snapshot.v4",
        ):
            raise ValueError("unsupported event-store snapshot hash version")
        self._run_id = run_id
        self._events: list[CognitiveEvent] = []
        self._event_view = _ReadOnlyListView(self._events)
        self._artifacts: list[CognitiveArtifact] = []
        self._artifact_view = _ReadOnlyListView(self._artifacts)
        self._artifact_by_id: dict[str, CognitiveArtifact] = {}
        self._artifact_sequence: dict[str, int] = {}
        self._source_invalidations: dict[Ref, Ref] = {}
        self._experiment_observations = {}
        self._native_application_returns = {}
        self._native_symbolic_edges = {}
        self._native_recovery_edges = {}
        self._native_experiment_commitments = {}
        self._tracking_observations_by_scope = {}
        self._physical_measurements_by_interval = {}
        self._activated_understanding_by_scope = {}
        self._dispatches_by_observation: dict[Ref, list[EnvironmentActionDispatchedRecord]] = {}
        self._dispatches_by_intent: dict[Ref, list[EnvironmentActionDispatchedRecord]] = {}
        self._consumption_by_request: dict[tuple[Ref | None, Ref], ContributionConsumptionRecord] = {}
        self._operational_consciousness = OperationalConsciousness()
        self._latest_workflow_by_instance: dict[str, WorkflowInstanceRecord] = {}
        self._workflows_by_scope: dict[
            tuple[Ref, Ref, Ref | None], dict[Ref, WorkflowInstanceRecord]
        ] = {}
        self._operator_trial_contexts: dict[tuple[str, int], set[str]] = {}
        self._artifacts_by_type: dict[type[object], list[CognitiveArtifact]] = {}
        self._artifact_type_views: dict[
            type[object], _ReadOnlyListView[CognitiveArtifact]
        ] = {}
        self._event_ids: set[str] = set()
        self._artifact_ids: set[str] = set()
        self._transaction_ids: set[str] = set()
        # Archive identity index, deliberately absent from the operational
        # snapshot. No lookup falls back from current meaning to old evidence.
        self._claim_evidence_by_id: dict[Ref, Claim] = {}
        # Immutable objects already retained by accepted journal events. These
        # indexes are historical provenance only, never operational snapshots.
        self._claim_versions_by_id: dict[Ref, list[tuple[int, Claim]]] = {}
        self._term_versions_by_id: dict[Ref, list[tuple[int, object]]] = {}
        # Mechanical projections of accepted records, never a second decision
        # authority. Validation reads these current values plus its own delta.
        self._concentration_states: dict[Ref, ConcentrationLeaseState] = {}
        self._reasoning_context_stacks_by_owner: dict[Ref, ReasoningContextStack] = {}
        self._reasoning_context_stacks_by_intent: dict[tuple[Ref, Ref], ReasoningContextStack] = {}
        self._concentration_owner_by_timeline: dict[Ref, Ref] = {}
        self._concentration_obstination: dict[Ref, int] = {}
        self._concentration_accounted_actions: set[tuple[Ref, Ref]] = set()
        self._concentration_credited_results: set[Ref] = set()
        self._snapshot = CognitiveSnapshot.empty(run_id, schema_version=snapshot_schema_version)
        self._commit_lock = RLock()

    @property
    def run_id(self) -> Ref:
        return self._run_id

    @property
    def events(self) -> tuple[CognitiveEvent, ...]:
        return tuple(self._events)

    @property
    def event_view(self) -> Sequence[CognitiveEvent]:
        """Expose the append-only journal without copying its growing history."""

        return self._event_view

    @property
    def artifacts(self) -> Sequence[CognitiveArtifact]:
        """Expose artifacts directly, without rescanning the growing journal."""

        return self._artifact_view

    def artifact(self, artifact_id: Ref) -> CognitiveArtifact | None:
        """Return one hot canonical artefact without rescanning the cold journal."""

        return self._artifact_by_id.get(artifact_id)

    def artifact_sequence(self, artifact_id: Ref) -> int | None:
        """Canonical publication order; cognitive revisions need not advance per event."""
        return self._artifact_sequence.get(artifact_id)

    def source_invalidation_sources(self, refs=None) -> dict[Ref, Ref]:
        """Project accepted explicit withdrawals, including Source UPDATE results."""
        if refs is None:
            return dict(self._source_invalidations)
        return {ref: self._source_invalidations[ref] for ref in refs
                if ref in self._source_invalidations}

    def _index_source_invalidations(self, artifact) -> None:
        if isinstance(artifact, PropagationReport):
            refs = artifact.invalidated_refs
        elif (isinstance(artifact, OperatorResult)
              and artifact.operator.value == "UPDATE"
              and artifact.status.value == "completed"):
            output = artifact.attributes.get("output")
            if not hasattr(output, "get") or output.get("output_kind") != "update":
                return
            refs = output.get("invalidated_refs", ())
        else:
            return
        self._source_invalidations.update((ref, artifact.id) for ref in refs)

    def experiment_observation_window(self, timeline_ref, experiment_ref, after_sequence, maximum):
        """Bounded canonical interval lookup, without scanning the journal."""
        from bisect import bisect_right
        rows = self._experiment_observations.get((timeline_ref, experiment_ref), ())
        start = bisect_right(rows, after_sequence, key=lambda row: row[0])
        return tuple(row[1] for row in rows[start:start + maximum]), len(rows) - start > maximum

    def activated_understanding_assessments(self, timeline_ref, scope):
        key = (timeline_ref, *(scope.get(name) for name in ('game_ref', 'level_ref', 'session_ref')))
        return tuple(self._artifact_by_id[ref] for ref in sorted(self._activated_understanding_by_scope.get(key, ())))

    def _index_experiment_observation(self, artifact):
        if isinstance(artifact, ActionObservedRecord):
            intent = self._artifact_by_id.get(artifact.action_intent_id)
            if isinstance(intent, ActionIntent):
                from .conscious_native_experiment import native_assessment_candidates
                refs = {record.decision['frozen_request']['experiment_ref'] for record in
                    native_assessment_candidates(self, intent, artifact.timeline_id)}
                if intent.discriminating_experiment_ref is not None:
                    refs.add(intent.discriminating_experiment_ref)
                for ref in sorted(refs):
                    key = (artifact.timeline_id, ref)
                    self._experiment_observations.setdefault(key, []).append((self._artifact_sequence[artifact.id], artifact))

    def _index_native_application_return(self, artifact):
        from .conscious_experiment_feedback import index_experiment_commitment
        index_experiment_commitment(self._native_experiment_commitments, self, artifact)
        from .conscious_symbolic_memory import index_consumed_symbolic_edges
        index_consumed_symbolic_edges(self._native_symbolic_edges, artifact)
        index_consumed_symbolic_edges(self._native_recovery_edges, artifact, field_name='recovery_observation_fields')
        if not isinstance(artifact, GoalFrontierReviewRecord):
            return
        intent = self._artifact_by_id.get(artifact.action_intent_ref)
        frontier = intent.goal_acquisition_frontier if isinstance(intent, ActionIntent) else None
        if frontier is None:
            return
        scope = tuple(frontier.execution_scope.get(name) for name in ('game_ref', 'level_ref', 'session_ref'))
        for branch in artifact.branches:
            for association in branch.application_associations:
                if association.mechanism_ref is None:
                    continue  # Legacy unidentified associations are not promoted on restore.
                key = (artifact.timeline_id, *scope, branch.goal_ref, association.mechanism_ref)
                row = self._native_application_returns.setdefault(key, {})
                row['latest_inspected_ref'] = artifact.id
                if association.candidate_refs:
                    row['latest_associated_ref'] = artifact.id

    def native_application_return_refs(self, timeline_ref, scope, goal_ref, mechanism_ref):
        """Most recent inspection and association; neither is execution authority."""
        key = (timeline_ref, *(scope.get(name) for name in ('game_ref', 'level_ref', 'session_ref')),
            goal_ref, mechanism_ref)
        return dict(self._native_application_returns.get(key, {}))

    def native_experiment_commitment_refs(self, timeline_ref, scope, goal_ref, mechanism_ref, maximum):
        from agents.yf_arc3_v5.logos.types import stable_digest
        key = (timeline_ref, stable_digest(scope), goal_ref, mechanism_ref)
        bucket = self._native_experiment_commitments.get(key, {})
        complete = len(bucket) <= maximum
        return complete, len(bucket), tuple(row for _, row in sorted(bucket.items())) if complete else ()

    def native_symbolic_transition_refs(self, timeline_ref, scope, goal_ref, mechanism_ref, maximum):
        """Bounded reference lookup, rebuilt from canonical consumption on restore."""
        key = (timeline_ref, *(scope.get(name) for name in ('game_ref', 'level_ref', 'session_ref')),
            goal_ref, mechanism_ref)
        bucket = self._native_symbolic_edges.get(key, {})
        complete = len(bucket) <= maximum
        return {'complete': complete, 'edge_count': len(bucket),
            'rows': tuple(bucket[ref] for ref in sorted(bucket)) if complete else ()}

    def native_recovery_transition_refs(self, timeline_ref, scope, goal_ref, mechanism_ref, maximum):
        key = (timeline_ref, *(scope.get(name) for name in ('game_ref', 'level_ref', 'session_ref')),
            goal_ref, mechanism_ref)
        bucket = self._native_recovery_edges.get(key, {})
        complete = len(bucket) <= maximum
        return {'complete': complete, 'edge_count': len(bucket),
            'rows': tuple(bucket[ref] for ref in sorted(bucket)) if complete else ()}

    def current_tracking_observations(self, timeline_ref, frame_ref):
        rows = self._tracking_observations_by_scope.get((timeline_ref, frame_ref), {})
        return tuple(rows[ref] for ref in sorted(rows))

    def _index_tracking_observation(self, artifact):
        if isinstance(artifact, CompiledTemporalTrackingRecord):
            self._tracking_observations_by_scope.setdefault(
                (artifact.timeline_id, artifact.frame_id), {})[artifact.id] = artifact

    def physical_measurements_for_interval(self, *, timeline_ref, before_frame_ref,
            after_frame_ref, after_raw_input_ref, action_ref, action_data_digest):
        """Exact historical candidates; callers still validate lineage and order."""
        key = (timeline_ref, before_frame_ref, after_frame_ref, after_raw_input_ref,
            action_ref, action_data_digest)
        rows = self._physical_measurements_by_interval.get(key, {})
        return tuple(rows.values())

    def _index_physical_measurement(self, artifact):
        if isinstance(artifact, CompiledInteractionEffectRecord):
            effect = artifact.operational_physical_effect
            if effect is not None:
                key = (artifact.timeline_id, effect.before_frame_ref, effect.after_frame_ref,
                    effect.after_raw_input_ref, effect.action_ref, effect.action_data_digest)
                self._physical_measurements_by_interval.setdefault(key, {})[artifact.id] = artifact

    def artifacts_of_type(
        self,
        artifact_type: type[object],
    ) -> Sequence[CognitiveArtifact]:
        """Expose one append-only typed hot index without copying history."""

        view = self._artifact_type_views.get(artifact_type)
        return () if view is None else view

    def latest_artifact(
        self,
        artifact_type: type[object],
    ) -> CognitiveArtifact | None:
        """Return the latest typed artifact in constant time."""

        values = self._artifacts_by_type.get(artifact_type)
        return None if not values else values[-1]

    def latest_contribution_consumption(self, request_ref: Ref, timeline_ref: Ref | None):
        """Last recorded disposition, including refusal; never infer acceptance."""
        return self._consumption_by_request.get((timeline_ref, request_ref))

    @property
    def operational_consciousness(self) -> OperationalConsciousness:
        """Canonical consciousness projection; no separate mutable journal."""
        return self._operational_consciousness

    def dispatches_for_observation(self, raw_input_ref: Ref) -> tuple[EnvironmentActionDispatchedRecord, ...]:
        """Exact historical dispatch candidates; no latest-action fallback or selection."""
        return tuple(self._dispatches_by_observation.get(raw_input_ref, ()))

    def _index_action_dispatch(self, artifact: CognitiveArtifact) -> None:
        if isinstance(artifact, EnvironmentActionDispatchedRecord):
            self._dispatches_by_observation.setdefault(artifact.raw_input_ref, []).append(artifact)
            self._dispatches_by_intent.setdefault(artifact.action_intent_id, []).append(artifact)
            intent = self._artifact_by_id.get(artifact.action_intent_id)
            if isinstance(intent, ActionIntent) and intent.operational_consciousness is not None:
                from .conscious_native_experiment import native_assessment_candidates
                scope = intent.operational_consciousness.responsibility.execution_scope
                key = (artifact.timeline_id, *(scope.get(name) for name in ('game_ref', 'level_ref', 'session_ref')))
                ordinary = self._operational_consciousness.understanding_experiment_assessments(
                    artifact.timeline_id, intent.discriminating_experiment_ref) if intent.discriminating_experiment_ref else {}
                assessments = {record.id: record for _, record in sorted(ordinary.items())}
                for assessment in native_assessment_candidates(self, intent, artifact.timeline_id):
                    assessments[assessment.id] = assessment
                for _, assessment in sorted(assessments.items()):
                    execution = assessment.decision['frozen_request'].get('execution_contract')
                    if execution is not None and assessment.frame_id == intent.frame_id:
                        first = execution['actions'][0]
                        if first['action_ref'] == intent.action_ref and first['action_data'] == intent.action_data:
                            self._activated_understanding_by_scope.setdefault(key, set()).add(assessment.id)

    def dispatches_for_intent(self, intent_ref: Ref) -> tuple[EnvironmentActionDispatchedRecord, ...]:
        """All canonical dispatches of this exact intent, including repeated attempts."""
        return tuple(self._dispatches_by_intent.get(intent_ref, ()))

    def _index_contribution_consumption(self, artifact: CognitiveArtifact) -> None:
        if isinstance(artifact, ContributionConsumptionRecord):
            self._consumption_by_request[(artifact.timeline_id, artifact.request_ref)] = artifact
            from agents.yf_arc3_v5.operational.parent_return import canonical_closed_child_attempt
            closure = canonical_closed_child_attempt(self, artifact)
            if closure is not None:
                self._operational_consciousness.index_closed_child_attempt(closure)
        self._operational_consciousness.index_canonical_artifact(artifact)

    def latest_workflow_instance(self, instance_id: Ref) -> WorkflowInstanceRecord | None:
        """Read the latest accepted checkpoint for one instance, without a journal scan."""

        return self._latest_workflow_by_instance.get(instance_id)

    def current_workflows_in_scope(
        self, workflow_definition_id: Ref, timeline_id: Ref, frame_id: Ref | None,
    ) -> tuple[WorkflowInstanceRecord, ...]:
        """Read current checkpoints in one exact scope, without a global scan."""
        return tuple(self._workflows_by_scope.get(
            (workflow_definition_id, timeline_id, frame_id), {}
        ).values())

    def _index_workflow_artifact(self, artifact: WorkflowInstanceRecord) -> None:
        prior = self._latest_workflow_by_instance.get(artifact.workflow_instance_id)
        key = (artifact.workflow_definition_id, artifact.timeline_id, artifact.frame_id)
        if prior is not None:
            old_key = (prior.workflow_definition_id, prior.timeline_id, prior.frame_id)
            if old_key != key:
                previous_scope = self._workflows_by_scope[old_key]
                previous_scope.pop(artifact.workflow_instance_id)
                if not previous_scope:
                    del self._workflows_by_scope[old_key]
        self._latest_workflow_by_instance[artifact.workflow_instance_id] = artifact
        self._workflows_by_scope.setdefault(key, {})[artifact.workflow_instance_id] = artifact

    def concentration_state(self, lease_id: Ref):
        """Return the last canonical lifecycle state, or None for an unknown lease."""
        lease = self.artifact(lease_id)
        if not isinstance(lease, ConcentrationLease):
            return None
        return self._concentration_states.get(lease_id, lease.state)

    def concentration_accounting_state(self, pursuit_ref: Ref, action_intent_id: Ref):
        """Read exact canonical accounting without scanning historical actions."""
        return (self._concentration_obstination.get(pursuit_ref, 0),
                (pursuit_ref, action_intent_id) in self._concentration_accounted_actions)

    def reasoning_context_stack(self, owner_workflow_instance_ref: Ref, intent_ref: Ref | None = None):
        """Read the last accepted context delta for one execution owner."""
        if intent_ref is not None:
            return self._reasoning_context_stacks_by_intent.get((owner_workflow_instance_ref, intent_ref))
        return self._reasoning_context_stacks_by_owner.get(owner_workflow_instance_ref)

    def operator_trial_context_count(self, timeline_ref: Ref, context_epoch: int) -> int:
        return len(self._operator_trial_contexts.get((timeline_ref, context_epoch), ()))

    def observed_operator_trial_contexts(self, timeline_ref: Ref, context_epoch: int) -> tuple[Ref, ...]:
        """Exact contexts of canonically dispatched actions with an observed return."""
        values = self._operator_trial_contexts.get((timeline_ref, context_epoch), ())
        return tuple(sorted(values)) if len(values) <= 4096 else ()

    def _index_concentration_artifact(self, artifact: CognitiveArtifact) -> None:
        """Apply one accepted delta; replay calls this once per archived record."""
        if isinstance(artifact, ActionObservedRecord):
            intent = self._artifact_by_id.get(artifact.action_intent_id)
            if isinstance(intent, ActionIntent):
                context = intent.operator_trial_context
                ref, epoch = context.get('context_ref'), context.get('context_epoch')
                if ref and isinstance(epoch, int) and intent.timeline_id:
                    self._operator_trial_contexts.setdefault((intent.timeline_id, epoch), set()).add(ref)
        elif isinstance(artifact, ReasoningContextStack):
            self._reasoning_context_stacks_by_owner[artifact.owner_workflow_instance_ref] = artifact
            for intent_ref in artifact.local_execution_intent_refs:
                self._reasoning_context_stacks_by_intent[(artifact.owner_workflow_instance_ref, intent_ref)] = artifact
        elif isinstance(artifact, ConcentrationLease):
            self._concentration_states[artifact.id] = artifact.state
            if artifact.state not in _TERMINAL_CONCENTRATION_STATES:
                self._concentration_owner_by_timeline[artifact.timeline_id] = artifact.id
        elif isinstance(artifact, ConcentrationLeaseTransition):
            self._concentration_states[artifact.concentration_lease_id] = artifact.to_state
            if artifact.to_state in _TERMINAL_CONCENTRATION_STATES:
                if self._concentration_owner_by_timeline.get(artifact.timeline_id) == artifact.concentration_lease_id:
                    self._concentration_owner_by_timeline.pop(artifact.timeline_id)
            else:
                self._concentration_owner_by_timeline[artifact.timeline_id] = artifact.concentration_lease_id
        elif isinstance(artifact, ConcentrationActionAccountingRecord):
            self._concentration_obstination[artifact.pursuit_ref] = artifact.obstination_count
            self._concentration_accounted_actions.add((artifact.pursuit_ref, artifact.action_intent_id))
        elif isinstance(artifact, ConcentrationGovernanceRecord):
            if artifact.outcome is ConcentrationOutcome.SATISFIED and artifact.result_ref is not None:
                self._concentration_credited_results.add(artifact.result_ref)

    @property
    def snapshot(self) -> CognitiveSnapshot:
        return self._snapshot

    def archived_claim_evidence(self, claim_id: Ref) -> Claim | None:
        """Explicit exact proof lookup, not a current-meaning query.

        Presence here establishes neither current validity nor authorization.
        Retention of this migration journal is separate from future opt-in
        diagnostics; it must not be interpreted as bounded total memory yet.
        """
        if self._snapshot.schema_version != "yf_arc3_v5.cognitive_snapshot.v4":
            return self._snapshot.claim(claim_id)
        return self._claim_evidence_by_id.get(claim_id)

    def _historical_value_at_revision(self, versions, item_ref, revision):
        if type(revision) is not int or revision < 0 or revision > self._snapshot.revision:
            return None
        rows = versions.get(item_ref, ())
        index = bisect_right(rows, revision, key=lambda row: row[0]) - 1
        return None if index < 0 else rows[index][1]

    def archived_claim_evidence_at_revision(self, claim_id: Ref, revision: int) -> Claim | None:
        """Exact accepted historical value; never fall back to current meaning."""
        return self._historical_value_at_revision(self._claim_versions_by_id, claim_id, revision)

    def archived_term_evidence_at_revision(self, term_id: Ref, revision: int):
        """Explicit historical TERM lookup, without action eligibility authority."""
        return self._historical_value_at_revision(self._term_versions_by_id, term_id, revision)

    def _index_historical_mutation(self, event: CognitiveEvent) -> None:
        mutation = event.mutation
        if isinstance(mutation, PutClaim):
            self._claim_versions_by_id.setdefault(mutation.after.id, []).append(
                (event.state_revision_after, mutation.after))
        elif isinstance(mutation, PutTerm):
            self._term_versions_by_id.setdefault(mutation.after.id, []).append(
                (event.state_revision_after, mutation.after))

    def _normalize_mutation(
        self,
        mutation: StateMutation,
        next_revision: int,
    ) -> StateMutation:
        if not isinstance(mutation, PutTerm):
            return mutation
        after = mutation.after
        if mutation.before is None:
            if after.created_at_state_revision not in (0, next_revision):
                raise StateConflictError("new term has an invalid creation revision")
            if after.last_changed_state_revision not in (0, next_revision):
                raise StateConflictError("new term has an invalid change revision")
            normalized = after.model_copy(
                update={
                    "created_at_state_revision": next_revision,
                    "last_changed_state_revision": next_revision,
                }
            )
        else:
            if (
                after.created_at_state_revision
                != mutation.before.created_at_state_revision
            ):
                raise StateConflictError(
                    "term revision cannot change creation revision"
                )
            if after.last_changed_state_revision not in (
                mutation.before.last_changed_state_revision,
                next_revision,
            ):
                raise StateConflictError("term revision has an invalid change revision")
            normalized = after.model_copy(
                update={"last_changed_state_revision": next_revision}
            )
        return PutTerm(before=mutation.before, after=normalized)

    def prepare_mutations(
        self,
        mutations: tuple[StateMutation, ...],
    ) -> tuple[StateMutation, ...]:
        """Preview the exact immutable mutations the next commit would reduce."""

        next_revision = self._snapshot.revision + (
            1
            if any(isinstance(mutation, (PutTerm, PutClaim)) for mutation in mutations)
            else 0
        )
        return tuple(
            self._normalize_mutation(mutation, next_revision) for mutation in mutations
        )

    def commit(self, request: TransactionRequest) -> TransactionReceipt:
        started = begin_profile()
        succeeded = False
        try:
            with self._commit_lock:
                before_sequence = len(self._events)
                receipt = self._commit(request)
                succeeded = True
                return receipt
        finally:
            # Profiling is opt-in.  Avoid constructing even the compact event
            # suffix when no recorder is active: commit is a hot delta path and
            # one reasoning turn can contain hundreds of tiny transactions.
            if started is not None:
                finish_profile(
                    started,
                    kind="state",
                    name="event_store.commit",
                    metadata={
                        "committed": succeeded,
                        "event_sequences": (
                            tuple(range(before_sequence + 1, len(self._events) + 1))
                            if succeeded
                            else ()
                        ),
                    },
                )

    def _commit(self, request: TransactionRequest) -> TransactionReceipt:
        if request.run_id != self._run_id:
            raise StateConflictError(
                "transaction run identity does not match event store"
            )
        if request.expected_revision != self._snapshot.revision:
            raise StateConflictError(
                f"stale transaction revision: expected {request.expected_revision}, "
                f"current {self._snapshot.revision}"
            )
        if request.transaction_id in self._transaction_ids:
            raise DuplicateTransactionError(request.transaction_id)

        has_state_mutation = any(
            isinstance(mutation, (PutTerm, PutClaim)) for mutation in request.mutations
        )
        next_revision = self._snapshot.revision + (1 if has_state_mutation else 0)
        start_sequence = len(self._events) + 1
        normalized = self.prepare_mutations(request.mutations)
        self._validate_canonical_mutations(normalized)
        new_events = tuple(
            CognitiveEvent.create(
                event_id=f"{self._run_id}:event:{start_sequence + index:08d}",
                sequence=start_sequence + index,
                transaction_id=request.transaction_id,
                run_id=self._run_id,
                timeline_id=request.timeline_id,
                frame_id=request.frame_id,
                state_revision_before=self._snapshot.revision,
                state_revision_after=next_revision,
                source_hash=request.source_hash,
                mutation=mutation,
                schema_version=("yf_arc3_v5.cognitive_event.v4"
                    if self._snapshot.schema_version == "yf_arc3_v5.cognitive_snapshot.v4"
                    else "yf_arc3_v5.cognitive_event.v3"
                    if self._snapshot.schema_version == "yf_arc3_v5.cognitive_snapshot.v3"
                    else "yf_arc3_v5.cognitive_event.v2"),
            )
            for index, mutation in enumerate(normalized)
        )

        try:
            candidate_snapshot = reduce_event_delta(
                self._snapshot,
                new_events,
                existing_event_ids=self._event_ids,
                existing_artifact_ids=self._artifact_ids,
                existing_claim_ids=self._claim_evidence_by_id.keys(),
            )
        except ReductionError as exc:
            raise StateConflictError(str(exc)) from exc

        self._append_validated_events(new_events, candidate_snapshot)
        # The events and snapshot were just reducer-validated above.  Building
        # the local receipt without recursive Pydantic validation avoids
        # recomputing every event content hash once more per transaction.
        return TransactionReceipt.model_construct(
            transaction_id=request.transaction_id,
            committed_events=new_events,
            snapshot=candidate_snapshot,
            schema_version="yf_arc3_v5.transaction_receipt.v1",
        )

    def _validate_canonical_mutations(self, mutations: Sequence[StateMutation]) -> None:
        """Apply the same durable responsibility guards on commit and restore.

        Only the accepted prefix is visible here. Restoring a journal is not
        permission to accept an orphan return, erase an unconsumed debt or
        derive a review from semantic evidence in that same transaction.
        """
        self._validate_concentration_mutations(mutations)
        has_state_mutation = any(isinstance(mutation, (PutTerm, PutClaim)) for mutation in mutations)
        if has_state_mutation and any(isinstance(mutation, RecordArtifact)
                and isinstance(mutation.artifact, OperationalConsciousnessContinuationReviewRecord) for mutation in mutations):
            raise StateConflictError('continuation review must follow committed dependency evidence, '
                'not share a transaction that changes that evidence')
        if has_state_mutation and any(isinstance(mutation, RecordArtifact)
                and isinstance(mutation.artifact, OperationalConsciousnessConsumptionRecord)
                and mutation.artifact.question_responses is not None for mutation in mutations):
            raise StateConflictError('question response consumption must follow the committed interpretation, '
                'not share a transaction that changes its semantic evidence')
        try:
            self._operational_consciousness.validate_transaction(tuple(
                mutation.artifact for mutation in mutations
                if isinstance(mutation, RecordArtifact)), store=self)
        except ValueError as exc:
            raise StateConflictError(str(exc)) from exc

    def _append_validated_events(
        self, new_events: tuple[CognitiveEvent, ...], candidate_snapshot: CognitiveSnapshot,
    ) -> None:
        """Project one accepted transaction identically during commit and restore.

        Call only after structural reduction and canonical transition validation.
        Keep the original events, identities and hashes; no synthetic receipts or
        fresh action authority are produced by this mechanical reconstruction.
        """
        self._events.extend(new_events)
        for event in new_events:
            self._index_historical_mutation(event)
        if candidate_snapshot.schema_version == "yf_arc3_v5.cognitive_snapshot.v4":
            self._claim_evidence_by_id.update((event.mutation.after.id, event.mutation.after)
                for event in new_events if isinstance(event.mutation, PutClaim))
        new_artifacts = tuple(
            event.mutation.artifact
            for event in new_events
            if isinstance(event.mutation, RecordArtifact)
        )
        self._artifacts.extend(new_artifacts)
        self._event_ids.update(event.event_id for event in new_events)
        self._artifact_ids.update(
            artifact.id for artifact in new_artifacts
        )
        self._artifact_by_id.update(
            (artifact.id, artifact) for artifact in new_artifacts
        )
        self._artifact_sequence.update((event.mutation.artifact.id, event.sequence)
            for event in new_events if isinstance(event.mutation, RecordArtifact))
        for artifact in new_artifacts:
            artifact_type = type(artifact)
            if isinstance(artifact, WorkflowInstanceRecord):
                self._index_workflow_artifact(artifact)
            typed = self._artifacts_by_type.get(artifact_type)
            if typed is None:
                typed = []
                self._artifacts_by_type[artifact_type] = typed
                self._artifact_type_views[artifact_type] = _ReadOnlyListView(typed)
            typed.append(artifact)
            self._index_source_invalidations(artifact)
            self._index_concentration_artifact(artifact)
            self._index_contribution_consumption(artifact)
            self._index_action_dispatch(artifact)
            self._index_experiment_observation(artifact)
            self._index_native_application_return(artifact)
            self._index_tracking_observation(artifact)
            self._index_physical_measurement(artifact)
        self._transaction_ids.add(new_events[0].transaction_id)
        self._snapshot = candidate_snapshot

    def _validate_concentration_mutations(self, mutations: Sequence[StateMutation]) -> None:
        """Enforce exclusive focus at the same atomic boundary as journal append.

        Artifact-only transactions do not advance the snapshot revision, so a
        revision check alone cannot serialize competing action leases.
        """
        from agents.yf_arc3_v5.logos.operations import (
            ConcentrationActionAccountingRecord,
            ConcentrationGovernanceRecord,
            ConcentrationLease, ConcentrationLeaseState,
            ConcentrationLeaseTransition,
            ConcentrationOperation,
            ConcentrationOutcome,
        )

        if not any(
            isinstance(mutation, RecordArtifact)
            and isinstance(
                mutation.artifact,
                (
                    ConcentrationLease,
                    ConcentrationLeaseTransition,
                    ConcentrationGovernanceRecord,
                    ConcentrationActionAccountingRecord,
                ),
            )
            for mutation in mutations
        ):
            return

        terminal = _TERMINAL_CONCENTRATION_STATES
        allowed = {
            ConcentrationLeaseState.ACQUIRED: {
                ConcentrationLeaseState.VALIDATED,
                ConcentrationLeaseState.INVALIDATED,
                ConcentrationLeaseState.EXPIRED,
            },
            ConcentrationLeaseState.VALIDATED: {
                ConcentrationLeaseState.RELEASED,
                ConcentrationLeaseState.SUSPENDED,
                ConcentrationLeaseState.INTERRUPTED,
                ConcentrationLeaseState.INVALIDATED,
                ConcentrationLeaseState.EXPIRED,
            },
            ConcentrationLeaseState.RELEASED: {
                ConcentrationLeaseState.OBSERVED,
                ConcentrationLeaseState.INTERRUPTED,
            },
            ConcentrationLeaseState.OBSERVED: {
                ConcentrationLeaseState.RELEASED,
                ConcentrationLeaseState.RECONCILED,
                ConcentrationLeaseState.SUSPENDED,
                ConcentrationLeaseState.INTERRUPTED,
                ConcentrationLeaseState.INVALIDATED,
                ConcentrationLeaseState.EXPIRED,
            },
            ConcentrationLeaseState.SUSPENDED: {
                ConcentrationLeaseState.VALIDATED,
                ConcentrationLeaseState.INTERRUPTED,
                ConcentrationLeaseState.INVALIDATED,
                ConcentrationLeaseState.EXPIRED,
            },
        }
        # Overlay only this transaction. No historical scan, full index copy or
        # mutation of accepted state before the reducer validates the whole batch.
        states = ChainMap({}, self._concentration_states)
        leases = ChainMap({}, self._artifact_by_id)
        owners = ChainMap({}, self._concentration_owner_by_timeline)
        pursuit_obstination = ChainMap({}, self._concentration_obstination)
        accounted_actions: set[tuple[Ref, Ref]] = set()
        credited_results: set[Ref] = set()
        transaction_closures = {
            mutation.artifact.concentration_lease_id
            for mutation in mutations
            if isinstance(mutation, RecordArtifact)
            and isinstance(mutation.artifact, ConcentrationLeaseTransition)
            and mutation.artifact.to_state is ConcentrationLeaseState.RECONCILED
        }
        for mutation in mutations:
            if not isinstance(mutation, RecordArtifact):
                continue
            artifact = mutation.artifact
            if isinstance(artifact, ConcentrationLease):
                if owners.get(artifact.timeline_id) is not None:
                    raise StateConflictError("another concentration lease owns this timeline")
                leases[artifact.id] = artifact
                states[artifact.id] = artifact.state
                if artifact.state not in terminal:
                    owners[artifact.timeline_id] = artifact.id
            elif isinstance(artifact, ConcentrationLeaseTransition):
                lease = leases.get(artifact.concentration_lease_id)
                if not isinstance(lease, ConcentrationLease):
                    raise StateConflictError("concentration transition has no canonical lease")
                if (
                    artifact.timeline_id != lease.timeline_id
                    or artifact.workflow_instance_id != lease.workflow_instance_id
                ):
                    raise StateConflictError("concentration transition is outside its owning workflow")
                current = states[lease.id]
                if current != artifact.from_state:
                    raise StateConflictError("concentration transition is out of order")
                if artifact.to_state not in allowed.get(current, set()):
                    raise StateConflictError("concentration transition is not allowed")
                if artifact.action_intent_id not in lease.extension_intent_ids:
                    raise StateConflictError("concentration transition intent is outside lease")
                states[lease.id] = artifact.to_state
                owners[lease.timeline_id] = None if artifact.to_state in terminal else lease.id
            elif isinstance(artifact, ConcentrationGovernanceRecord):
                lease = leases.get(artifact.concentration_lease_id)
                if not isinstance(lease, ConcentrationLease):
                    raise StateConflictError("concentration governance has no canonical lease")
                if artifact.timeline_id != lease.timeline_id:
                    raise StateConflictError("concentration governance timeline mismatch")
                if artifact.why_contract_ref != lease.id:
                    raise StateConflictError("concentration governance lost its frozen why")
                if artifact.operation is not None and (
                    artifact.workflow_instance_id != lease.workflow_instance_id
                ):
                    raise StateConflictError("concentration operation is outside its owning workflow")
                if states[lease.id] in terminal and (
                    artifact.operation is not None or artifact.outcome is not None
                ) and not (
                    artifact.operation is ConcentrationOperation.CLOSE
                    and lease.id in transaction_closures
                    and states[lease.id] is ConcentrationLeaseState.RECONCILED
                ):
                    raise StateConflictError("revoked or closed focus cannot issue a late operation or outcome")
                required = set(lease.preserve_constraint_refs) | set(
                    lease.overshoot_constraint_refs
                )
                if artifact.operation is not None and not required.issubset(
                    artifact.carried_obligation_refs
                ):
                    raise StateConflictError("concentration governance dropped obligations")
                if (
                    artifact.inherited_action_budget is not None
                    and lease.remaining_action_bound is not None
                    and artifact.inherited_action_budget > lease.remaining_action_bound
                ):
                    raise StateConflictError("concentration governance enlarged inherited budget")
                if artifact.outcome is ConcentrationOutcome.SATISFIED and artifact.result_ref:
                    if artifact.result_ref in credited_results or artifact.result_ref in self._concentration_credited_results:
                        raise StateConflictError("shared result was already credited")
                    credited_results.add(artifact.result_ref)
            elif isinstance(artifact, ConcentrationActionAccountingRecord):
                lease = leases.get(artifact.concentration_lease_id)
                if not isinstance(lease, ConcentrationLease):
                    raise StateConflictError("concentration accounting has no canonical lease")
                if artifact.timeline_id != lease.timeline_id:
                    raise StateConflictError("concentration accounting timeline mismatch")
                if artifact.action_intent_id not in lease.extension_intent_ids:
                    raise StateConflictError("concentration accounting intent is outside lease")
                key = (artifact.pursuit_ref, artifact.action_intent_id)
                if key in accounted_actions or key in self._concentration_accounted_actions:
                    raise StateConflictError("concentration action was already counted")
                expected = pursuit_obstination.get(artifact.pursuit_ref, 0) + (
                    0 if artifact.relevant_to_pursuit else 1
                )
                if artifact.obstination_count != expected:
                    raise StateConflictError("obstination counter must advance by exactly one per irrelevant action")
                pursuit_obstination[artifact.pursuit_ref] = expected
                accounted_actions.add(key)

    def to_jsonl(self) -> str:
        return "\n".join(event.model_dump_json() for event in self._events)

    @classmethod
    def from_jsonl(cls, text: str) -> "EventStore":
        """Restore the accepted prefix through the ordinary transaction guards.

        Source qualification remains the archive loader's responsibility. This
        reducer checks historical coherence; it never treats a historical
        action lease or premise as revalidated for the current world.
        """
        lines = tuple(line for line in text.splitlines() if line.strip())
        if not lines:
            raise ValueError("cannot restore an empty event store without run identity")
        events = tuple(CognitiveEvent.model_validate_json(line) for line in lines)
        snapshot_schema = {
            'yf_arc3_v5.cognitive_event.v1': 'yf_arc3_v5.cognitive_snapshot.v2',
            'yf_arc3_v5.cognitive_event.v2': 'yf_arc3_v5.cognitive_snapshot.v2',
            'yf_arc3_v5.cognitive_event.v3': 'yf_arc3_v5.cognitive_snapshot.v3',
            'yf_arc3_v5.cognitive_event.v4': 'yf_arc3_v5.cognitive_snapshot.v4',
        }[events[0].schema_version]
        store = cls(events[0].run_id, snapshot_schema_version=snapshot_schema)
        for transaction_id, group in groupby(events, key=lambda event: event.transaction_id):
            if transaction_id in store._transaction_ids:
                raise ReductionError(f'transaction is not contiguous: {transaction_id}')
            batch = tuple(group)
            candidate_snapshot = reduce_event_delta(
                store._snapshot, batch, existing_event_ids=store._event_ids,
                existing_artifact_ids=store._artifact_ids,
                existing_claim_ids=store._claim_evidence_by_id.keys(),
            )
            store._validate_canonical_mutations(tuple(event.mutation for event in batch))
            store._append_validated_events(batch, candidate_snapshot)
        return store
