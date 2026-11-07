"""Typed return transport and exact comparisons; no semantic disposition or ACT."""
from collections.abc import Mapping
from typing import Literal

from pydantic import Field, model_validator

from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, stable_digest, immutable_json_data
from agents.yf_arc3_v5.logos.operational_reevaluation import OperationalConsciousnessDeliberationOutcome
from agents.yf_arc3_v5.logos.operational_reasoning import OperationalConsciousnessContributionOrigin
from agents.yf_arc3_v5.capabilities.mechanical_request_contracts import MechanicalNormalizedReturn
from agents.yf_arc3_v5.capabilities.contracts import GoalParentContinuityMeasurements
from agents.yf_arc3_v5.scheduler.source_return import SourceCallRefusal
from agents.yf_arc3_v5.logos.source_completion import SourceFailureEvidence, SourceDeferralEvidence, CompositionParentContext


class ContributionRequest(FrozenModel):
    operational_consciousness: OperationalConsciousnessContributionOrigin
    request_ref: Ref
    recipient_workflow_ref: Ref
    timeline_ref: Ref
    requested_at_revision: int = Field(ge=0)
    expected_producer_definition_ref: Ref
    expected_producer_source_hash: Ref
    scope_refs: tuple[Ref, ...] = Field(min_length=1)
    parent_goal_ref: Ref | None = None
    dependency_refs: tuple[Ref, ...] = ()

    @model_validator(mode="after")
    def preserve_requesting_context(self):
        origin = self.operational_consciousness.requesting_operation
        if (origin.context.owner_workflow_ref != self.recipient_workflow_ref
                or origin.context.timeline_ref != self.timeline_ref
                or self.scope_refs != tuple(ref for ref in (self.timeline_ref, origin.current_frame_ref) if ref)):
            raise ValueError("operational consciousness: contribution request lost its origin scope")
        return self


class ContributionReturnHeader(FrozenModel):
    request: ContributionRequest
    producer_workflow_ref: Ref
    producer_definition_ref: Ref
    producer_source_hash: Ref
    returned_at_revision: int = Field(ge=0)
    disposition_ref: Ref
    product_refs: tuple[Ref, ...]
    evidence_refs: tuple[Ref, ...]
    requires_current_revalidation: bool

    @model_validator(mode="after")
    def validate_production_identity(self):
        if self.returned_at_revision < self.request.requested_at_revision:
            raise ValueError("return precedes its acquisition request")
        if self.producer_definition_ref != self.request.expected_producer_definition_ref:
            raise ValueError("return producer differs from the requested definition")
        if self.producer_source_hash != self.request.expected_producer_source_hash:
            raise ValueError("return producer differs from the requested source")
        if len(set(self.product_refs)) != len(self.product_refs):
            raise ValueError("return contains duplicate product identities")
        return self


class FailureInspectionReturn(ContributionReturnHeader):
    """Requested inspection of a real child failure, never child-goal completion."""

    schema_version: Literal["yf_arc3_v5.failure_inspection_return.v1"] = "yf_arc3_v5.failure_inspection_return.v1"
    failure_evidence: SourceFailureEvidence
    root_execution_record_ref: Ref
    parent_context: CompositionParentContext | None = None
    domain_payload: FrozenMap

    @model_validator(mode="after")
    def validate_failure_transport(self):
        from agents.yf_arc3_v5.scheduler.evaluator import runtime_value
        if self.product_refs or not self.requires_current_revalidation:
            raise ValueError("failure inspection cannot fulfill a dependency or remove revalidation")
        if self.domain_payload.get("source_failure_evidence") != runtime_value(self.failure_evidence):
            raise ValueError("failure inspection payload differs from its canonical evidence")
        if (self.failure_evidence.selection_refusal is not None
                and self.domain_payload.get('source_selection_refusal') != self.failure_evidence.selection_refusal):
            raise ValueError('failure inspection changed the transported selection refusal')
        if self.domain_payload.get("source_parent_context") != runtime_value(self.parent_context):
            raise ValueError("failure inspection lost its captured parent context")
        return self


class DeferralInspectionReturn(ContributionReturnHeader):
    """Inspection of a wait; no completed dependency or permission to resume."""

    schema_version: Literal["yf_arc3_v5.deferral_inspection_return.v1"] = "yf_arc3_v5.deferral_inspection_return.v1"
    deferral_evidence: SourceDeferralEvidence
    root_execution_record_ref: Ref
    parent_context: CompositionParentContext | None = None
    domain_payload: FrozenMap

    @model_validator(mode="after")
    def validate_deferral_transport(self):
        from agents.yf_arc3_v5.scheduler.evaluator import runtime_value
        if self.product_refs or not self.requires_current_revalidation:
            raise ValueError("wait inspection cannot fulfill a dependency or authorize resumption")
        if (self.domain_payload.get("source_deferral_evidence") != runtime_value(self.deferral_evidence)
                or self.domain_payload.get("source_parent_context") != runtime_value(self.parent_context)):
            raise ValueError("wait inspection differs from its canonical evidence or parent")
        return self


class ParentContextContributionReturn(ContributionReturnHeader):
    """Parent lineage examined without a candidate; never an action permission."""

    schema_version: Literal["yf_arc3_v5.parent_context_contribution_return.v1"] = "yf_arc3_v5.parent_context_contribution_return.v1"
    parent_context: CompositionParentContext
    root_execution_record_ref: Ref
    trigger_consumption_ref: Ref
    lineage_measurements: GoalParentContinuityMeasurements
    qualification_ref: Literal["parent_lineage.unknown", "parent_lineage.absent", "parent_lineage.bound"]
    domain_payload: FrozenMap

    @model_validator(mode="after")
    def validate_context(self):
        from agents.yf_arc3_v5.logos.types import immutable_json_data
        if self.product_refs or not self.requires_current_revalidation:
            raise ValueError("parent lineage inspection cannot satisfy a physical dependency")
        if (self.domain_payload.get("parent_lineage_qualification_ref") != self.qualification_ref
                or self.domain_payload.get("parent_lineage_allows_act") is not False
                or self.domain_payload.get("candidate_intent_present") is not False):
            raise ValueError("parent lineage inspection lost its candidate-free meaning")
        if any(self.domain_payload.get(key) != value
               for key, value in sorted(immutable_json_data(self.lineage_measurements).items())):
            raise ValueError("parent lineage projection differs from its typed measurements")
        return self


class ContinuationContributionReturn(ContributionReturnHeader):
    schema_version: Literal["yf_arc3_v5.continuation_contribution_return.v1"] = "yf_arc3_v5.continuation_contribution_return.v1"
    frozen_contract_ref: Ref | None
    frozen_contract_digest: Ref | None
    dependency_comparisons: tuple[FrozenMap, ...]
    primitive_word: tuple[FrozenMap, ...]
    preservation_domains: tuple[FrozenMap, ...]
    domain_payload: FrozenMap


class ParentQuestionFrontierOutcome(FrozenModel):
    """Source-declared absence or non-admission, without collapsing unknown to false."""

    schema_version: Literal["yf_arc3_v5.parent_question_frontier_outcome.v1"] = "yf_arc3_v5.parent_question_frontier_outcome.v1"
    outcome_ref: Literal["question_frontier_contains_no_current_question", "question_frontier_not_admissible"]
    parent_question_present: bool | None
    question_domain_proves_absence: bool
    alternative_refs: tuple[Ref, ...]

    @model_validator(mode="after")
    def validate_disposition(self):
        absent = self.outcome_ref == "question_frontier_contains_no_current_question"
        if self.question_domain_proves_absence != absent:
            raise ValueError("question disposition differs from its declared absence proof")
        if (absent and self.parent_question_present is not False
                or not absent and self.parent_question_present is not None):
            raise ValueError("non-admission must preserve uncertainty; proved absence is false")
        return self


class QuestionFrontierReturn(ContributionReturnHeader):
    """Constructing a question is not answering it or satisfying its condition."""

    schema_version: Literal["yf_arc3_v5.question_frontier_return.v1"] = "yf_arc3_v5.question_frontier_return.v1"
    question_selected: bool | None
    selected_question_ref: Ref | None
    selected_question_goal_ref: Ref | None
    selected_parent_goal_ref: Ref | None
    retained_alternative_refs: tuple[Ref, ...]
    reconciliation_checkpoint_ref: Ref
    domain_payload: FrozenMap
    call_refusal: SourceCallRefusal | None = None
    native_source_return_digest: Ref | None = None

    @model_validator(mode="after")
    def validate_question_identity(self):
        if len(set(self.retained_alternative_refs)) != len(self.retained_alternative_refs):
            raise ValueError("question frontier contains duplicate alternative identities")
        selected = (self.selected_question_ref, self.selected_question_goal_ref, self.selected_parent_goal_ref)
        if self.question_selected is True:
            if not all(selected) or len(self.product_refs) != 1:
                raise ValueError("selected question requires its exact goal, parent and canonical product")
            if self.selected_question_goal_ref in (self.producer_workflow_ref, self.producer_definition_ref):
                raise ValueError("question goal cannot be replaced by its producing workflow")
        elif any(ref is not None for ref in selected) or self.product_refs:
            raise ValueError("unselected question cannot carry a selected goal or product")
        rows = self.domain_payload.get("alternative_facts", {})
        packet = rows.get(self.disposition_ref) if isinstance(rows, Mapping) else None
        if not isinstance(packet, Mapping) or packet.get("native_question_selected_present") != self.question_selected:
            raise ValueError("question transport differs from its native selection")
        if packet.get("parent_question_present") != self.question_selected:
            raise ValueError("question selection differs from the transported native answer")
        if self.question_selected is True and selected != tuple(packet.get(key) for key in (
                "question_ref", "question_goal_ref", "parent_goal_ref")):
            raise ValueError("question transport changes the native question identity")
        if packet.get("observed_effect_refs") or packet.get("affected_dependency_refs"):
            raise ValueError("a question return cannot attest observed physical dependency effects")
        if self.call_refusal is not None and self.call_refusal.workflow_instance_ref != self.producer_workflow_ref:
            raise ValueError("question refusal differs from its return producer")
        return self


class DeliberationContributionReturn(ContributionReturnHeader):
    """A scoped local closure, including unresolved work; never world success."""
    schema_version: Literal['yf_arc3_v5.deliberation_return.v1'] = 'yf_arc3_v5.deliberation_return.v1'
    deliberation_ref: Ref
    outcome: OperationalConsciousnessDeliberationOutcome
    domain_payload: FrozenMap

    @model_validator(mode='after')
    def preserve_deliberation(self):
        if (self.product_refs or not self.requires_current_revalidation
                or self.evidence_refs != (self.deliberation_ref,)
                or self.domain_payload.get('deliberation_ref') != self.deliberation_ref
                or self.domain_payload.get('outcome') != immutable_json_data(self.outcome)):
            raise ValueError('deliberation return differs from its canonical outcome')
        return self


class ObservedParentAnswersContributionReturn(ContributionReturnHeader):
    """Exact examined answer domain, including an empty domain; not parent success."""
    schema_version: Literal['yf_arc3_v5.observed_parent_answers_return.v1'] = 'yf_arc3_v5.observed_parent_answers_return.v1'
    intent_ref: Ref
    answer_domain_digest: Ref
    answer_count: int = Field(ge=0)
    answer_receipt_refs: tuple[Ref, ...]
    domain_payload: FrozenMap

    @model_validator(mode='after')
    def preserve_answer_domain(self):
        if (self.product_refs or not self.requires_current_revalidation
                or self.answer_count != len(self.answer_receipt_refs)
                or len(set(self.answer_receipt_refs)) != self.answer_count
                or self.evidence_refs != self.answer_receipt_refs
                or any(self.domain_payload.get(key) != getattr(self, key) for key in
                    ('intent_ref', 'answer_domain_digest', 'answer_count', 'answer_receipt_refs'))):
            raise ValueError('observed answer return differs from its examined domain')
        return self


class ChildContributionReturn(ContributionReturnHeader):
    schema_version: Literal["yf_arc3_v5.child_contribution_return.v1"] = "yf_arc3_v5.child_contribution_return.v1"
    child_goal_ref: Ref
    observed_effect_refs: tuple[Ref, ...]
    affected_dependency_refs: tuple[Ref, ...]
    unresolved_alternative_refs: tuple[Ref, ...]
    reconciliation_checkpoint_ref: Ref
    domain_payload: FrozenMap
    call_refusal: SourceCallRefusal | None = None

    @model_validator(mode="after")
    def validate_refusal_owner(self):
        if self.call_refusal is not None and self.call_refusal.workflow_instance_ref != self.producer_workflow_ref:
            raise ValueError("child call refusal differs from its return producer")
        return self


class MechanicalContributionReturn(ContributionReturnHeader):
    """A bounded calculation: modes, resources and hidden states need no grid."""

    schema_version: Literal["yf_arc3_v5.mechanical_contribution_return.v1"] = "yf_arc3_v5.mechanical_contribution_return.v1"
    normalized: MechanicalNormalizedReturn


class ParentContinuationDispatch(FrozenModel):
    """Source-selected continuation, never a primitive release permit."""

    schema_version: Literal["yf_arc3_v5.parent_continuation_dispatch.v1"] = "yf_arc3_v5.parent_continuation_dispatch.v1"
    producer_workflow_instance_ref: Ref
    continuation_ref: Literal[
        "continuation.resume_parent_question",
        "continuation.reenter_parent_root",
        "continuation.reenter_reserved_reasoning",
        "continuation.reasoning_reserves_exhausted",
        "continuation.preserve_current_frontier",
    ]
    native_return: FrozenMap
    consumption_receipt_ref: Ref | None
    reasoning_strategy_ref: Ref | None

    @property
    def requires_activation_receipt(self):
        return self.continuation_ref in ('continuation.resume_parent_question', 'continuation.reenter_parent_root')

    @model_validator(mode="after")
    def validate_local_return_binding(self):
        if self.requires_activation_receipt and not self.consumption_receipt_ref:
            raise ValueError('parent resumption requires its explicit contribution activation')
        if self.continuation_ref == "continuation.resume_parent_question":
            if (not self.consumption_receipt_ref or not self.reasoning_strategy_ref
                    or not self.native_return.get("parent_goal_ref")
                    or not self.native_return.get("question_goal_ref")
                    or not self.native_return.get("native_question_checkpoint_ref")):
                raise ValueError("local parent continuation requires its consumed native question")
        elif self.reasoning_strategy_ref is not None:
            raise ValueError("only a local question continuation binds a question strategy")
        return self


def qualify_parent_continuation_dispatch(returned, *, store, consumer_context, frame_ref, maximum_revision):
    """Compare the declared continuation with its canonical consumer consequence."""
    from agents.yf_arc3_v5.logos.operations import ContributionConsumptionRecord
    if returned.producer_workflow_instance_ref != consumer_context.owner_workflow_ref:
        raise ValueError('parent continuation has another Source producer')
    if returned.consumption_receipt_ref is None:
        return returned
    receipt = store.artifact(returned.consumption_receipt_ref)
    if (not isinstance(receipt, ContributionConsumptionRecord)
            or receipt.recipient_workflow_ref != consumer_context.owner_workflow_ref
            or receipt.timeline_id != consumer_context.timeline_ref or receipt.frame_id != frame_ref
            or receipt.state_revision > maximum_revision):
        raise ValueError('parent continuation lost its scoped canonical consumption')
    store.operational_consciousness.require_outcome_consumption(receipt, store=store)
    if returned.requires_activation_receipt:
        store.operational_consciousness.require_contribution_activation(receipt,
            store=store,
            continuation_ref=returned.continuation_ref,
            recipient_workflow_ref=consumer_context.owner_workflow_ref,
            timeline_ref=consumer_context.timeline_ref, frame_ref=frame_ref)
        if (receipt.source_hash != consumer_context.source_hash
                or receipt.workflow_definition_id != consumer_context.source_workflow_ref):
            raise ValueError('parent continuation activation belongs to another Source')
    return returned


def read_parent_continuation_dispatch(checkpoint, *, store):
    """Every continuation reader consumes the retained activation, not just a label."""
    from agents.yf_arc3_v5.scheduler.source_return import read_source_return
    returned = ParentContinuationDispatch.model_validate(read_source_return(checkpoint, store=store))
    return qualify_parent_continuation_dispatch(returned, store=store,
        consumer_context=checkpoint.operational_consciousness_context, frame_ref=checkpoint.frame_id,
        maximum_revision=checkpoint.state_revision)


class ContributionConsumptionRefusal(ValueError):
    """Named transport failure; the caller retains it without choosing a repair."""
    def __init__(self, reason_ref, detail):
        super().__init__(detail)
        self.reason_ref = reason_ref


def require_consumed_child_projection(*, store, workflow_registry, parent_operation,
                                      timeline_ref, frame_ref, receipt_ref, projection):
    """Bind a consumed domain projection to the exact child STOP that delivered it."""
    from agents.yf_arc3_v5.logos.operations import ContributionConsumptionRecord, WorkflowStatus
    from agents.yf_arc3_v5.scheduler.source_return import read_source_return, SourceReturnContractError
    from agents.yf_arc3_v5.logos.operational_reasoning import OperationalConsciousnessAdmissionError
    from agents.yf_arc3_v5.src.registry import RegistryResolutionError
    if parent_operation is None or workflow_registry is None:
        raise ContributionConsumptionRefusal('consumption.parent_admission_missing',
            'consumed child projection lacks its current parent admission')
    parent = parent_operation.context
    try:
        store.operational_consciousness.require_reasoning_execution(parent_operation,
            run_ref=store.run_id, timeline_ref=timeline_ref, frame_ref=frame_ref,
            workflow_ref=parent.owner_workflow_ref, source_workflow_ref=parent.source_workflow_ref,
            source_hash=parent.source_hash, operation_ref=parent_operation.operation_ref)
    except OperationalConsciousnessAdmissionError as error:
        raise ContributionConsumptionRefusal(error.guard_ref, str(error)) from error
    try:
        workflow_registry.resolve_workflow(parent.source_workflow_ref, expected_transitive_source_hash=parent.source_hash)
    except RegistryResolutionError as error:
        raise ContributionConsumptionRefusal('consumption.parent_source_changed', str(error)) from error
    receipt = store.artifact(receipt_ref) if receipt_ref is not None else None
    if (not isinstance(receipt, ContributionConsumptionRecord) or not receipt.accepted
            or receipt.operational_consciousness.basis != 'source_return'
            or receipt.comparison_facts.get('return_source_terminal_matches') is not True
            or receipt.timeline_id != timeline_ref or receipt.frame_id != frame_ref):
        raise ContributionConsumptionRefusal('consumption.current_accepted_child_receipt',
            'consumed child projection lacks its current accepted Source receipt')
    try:
        store.operational_consciousness.require_outcome_consumption(receipt, store=store)
    except ValueError as error:
        raise ContributionConsumptionRefusal('consumption.canonical_outcome_current', str(error)) from error
    try:
        workflow_registry.resolve_workflow(receipt.workflow_definition_id,
            expected_transitive_source_hash=receipt.source_hash)
    except RegistryResolutionError as error:
        raise ContributionConsumptionRefusal('consumption.child_consumer_source_changed', str(error)) from error
    child = store.latest_workflow_instance(receipt.recipient_workflow_ref)
    if (child is None or child.status is not WorkflowStatus.COMPLETED
            or child.timeline_id != timeline_ref or child.frame_id != frame_ref
            or child.state_revision < receipt.state_revision or child.state_revision > store.snapshot.revision
            or child.operational_consciousness_context.parent_context_ref != parent.context_ref
            or child.operational_consciousness_context.root_context_ref != parent.root_context_ref):
        raise ContributionConsumptionRefusal('consumption.exact_completed_child_lineage',
            'consumed child projection has no completed child of this parent')
    try:
        workflow_registry.resolve_workflow(child.workflow_definition_id, expected_transitive_source_hash=child.source_hash)
    except RegistryResolutionError as error:
        raise ContributionConsumptionRefusal('consumption.child_source_changed', str(error)) from error
    try:
        returned = read_source_return(child, store=store)
    except SourceReturnContractError as error:
        raise ContributionConsumptionRefusal('consumption.canonical_child_stop_required', str(error)) from error
    if stable_digest(returned) != stable_digest(projection):
        raise ContributionConsumptionRefusal('consumption.child_projection_changed',
            'consumed child projection differs from its actual Source STOP')
    return receipt


def measure_return_identity(*, request, receipt, consumer_ref, timeline_ref, current_scope_refs,
                            current_revision, product_revisions, product_digests=None,
                            producer_matches=False, source_return_evidence=None, shape_errors=(),
                            request_origin_matches=False):
    """Compare only supplied identity/revision operands; preserve rejected payloads."""
    raw_request = request.model_dump(mode="python") if isinstance(request, FrozenModel) else request
    raw_return = receipt.model_dump(mode="python") if isinstance(receipt, FrozenModel) else receipt
    raw_request = raw_request if isinstance(raw_request, Mapping) else FrozenMap()
    raw_return = raw_return if isinstance(raw_return, Mapping) else FrozenMap()
    returned_request = raw_return.get("request")
    requested_revision = raw_request.get("requested_at_revision")
    returned_revision = raw_return.get("returned_at_revision")
    chronology_matches = (isinstance(requested_revision, int) and not isinstance(requested_revision, bool)
        and isinstance(returned_revision, int) and not isinstance(returned_revision, bool)
        and 0 <= requested_revision <= returned_revision <= current_revision)
    refs = tuple(raw_return.get("product_refs", ())) if not shape_errors else ()
    missing = tuple(ref for ref in refs if ref not in product_revisions)
    digest = stable_digest(raw_return)
    comparisons = FrozenMap({
        "return_shape_valid": not shape_errors,
        "return_shape_error_fields": tuple(shape_errors),
        "return_request_matches": returned_request == raw_request,
        "return_request_origin_matches": request_origin_matches,
        "return_request_digest": stable_digest(raw_request),
        "return_recipient_matches": raw_request.get("recipient_workflow_ref") == consumer_ref,
        "return_producer_matches": producer_matches,
        "return_source_terminal_matches": bool(source_return_evidence is not None
            and source_return_evidence.get('source_terminal_matches') is True),
        "return_source_terminal_evidence": source_return_evidence or FrozenMap(),
        "return_timeline_matches": raw_request.get("timeline_ref") == timeline_ref,
        "return_scope_matches": tuple(raw_request.get("scope_refs", ())) == tuple(current_scope_refs),
        "return_chronology_matches": chronology_matches,
        "return_products_present": not missing,
        "return_missing_product_refs": missing,
        # Seal the exact canonical versions examined, not just their names.
        # Missing legacy seals remain visible; they cannot bind a new release.
        "return_product_digests": FrozenMap({ref: product_digests[ref]
            for ref in refs if product_digests is not None and ref in product_digests}),
    })
    # A receipt is idempotent only for the same measured boundary. Unrelated
    # revisions do not create a new receipt, but a changed scope or comparison
    # cannot reuse a previously accepted disposition.
    identity = (raw_request.get("request_ref"), consumer_ref, digest,
                timeline_ref, tuple(current_scope_refs), comparisons,
                tuple((ref, product_revisions.get(ref)) for ref in refs))
    domain = raw_return.get("domain_payload", raw_return)
    domain = domain if isinstance(domain, Mapping) else FrozenMap()
    return FrozenMap({
        "request_ref": raw_request.get("request_ref"),
        "recipient_workflow_ref": consumer_ref,
        "return_digest": digest,
        "consumption_ref": "contribution-consumption:" + stable_digest(identity),
        **comparisons,
        "returned_requires_current_revalidation": raw_return.get("requires_current_revalidation") is True,
        "returned_tracking_present": domain.get("tracking_present") is True,
        "returned_binding_exact": domain.get("binding_exact") is True,
        "product_refs": refs,
        "evidence_refs": tuple(raw_return.get("evidence_refs", ())) if not shape_errors else (),
        "returned_payload": FrozenMap(raw_return),
        "comparison_revision": current_revision,
    })
