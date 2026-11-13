"""A revisable proposed purpose, distinct from its discriminating experiment."""
from typing import Literal
from pydantic import Field, model_validator, model_serializer
from .types import FrozenModel, Ref, stable_digest


class OperationalConsciousnessGoalEvidenceExpectation(FrozenModel):
    """DRM-declared canonical proof query; the query is not an observed proof."""
    evidence_ref: Ref
    predicate_ref: Ref
    goal_argument_index: int = Field(ge=0, le=15)
    event_argument_index: int = Field(ge=0, le=15)
    epistemic_status_refs: tuple[Ref, ...] = Field(min_length=1, max_length=16)
    proof_rule_refs: tuple[Ref, ...] = Field(min_length=1, max_length=16)
    successful_operation_status_ref: Ref
    event_kind_attribute_ref: Ref
    expected_event_kind_ref: Ref
    event_before_measure_field: Ref
    event_after_measure_field: Ref
    minimum_event_delta: int = Field(ge=1)

    @model_validator(mode='after')
    def keep_goal_and_event_distinct(self):
        if self.goal_argument_index == self.event_argument_index:
            raise ValueError('goal evidence must distinguish its owner from its observed event')
        return self


class OperationalConsciousnessGoalHypothesis(FrozenModel):
    schema_version: Literal['operational_consciousness_goal_hypothesis.v1'] = 'operational_consciousness_goal_hypothesis.v1'
    hypothesis_ref: Ref
    origin_activation_ref: Ref | None = None
    origin_claim_ref: Ref | None = None
    goal_ref: Ref
    epistemic_status: Literal['proposed'] = 'proposed'
    utility_reason_refs: tuple[Ref, ...] = Field(min_length=1, max_length=128)
    support_claim_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    support_evidence_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    goal_falsifier_bindings: tuple[tuple[Ref, Ref], ...] = Field(min_length=1, max_length=128)
    expected_goal_evidence_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    expected_goal_evidence: tuple[OperationalConsciousnessGoalEvidenceExpectation, ...] = Field(default=(), max_length=128)
    goal_evidence_status: Literal['not_declared', 'declared']
    experiment_ref: Ref | None = None
    experiment_expected_effect_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    experiment_falsifier_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    grants_action: Literal[False] = False
    establishes_utility: Literal[False] = False
    establishes_goal_success: Literal[False] = False

    @property
    def goal_falsifier_refs(self):
        return tuple(ref for goal, ref in self.goal_falsifier_bindings if goal == self.goal_ref)

    @model_validator(mode='after')
    def preserve_evidence_roles(self):
        if (self.origin_activation_ref is None) == (self.origin_claim_ref is None):
            raise ValueError('goal hypothesis requires exactly one declared activation or claim origin')
        if not self.support_claim_refs and not self.support_evidence_refs:
            raise ValueError('goal hypothesis requires declared claim or observational support')
        if self.origin_claim_ref is not None and self.origin_claim_ref in (*self.support_claim_refs, *self.support_evidence_refs):
            raise ValueError('goal hypothesis cannot use its own origin as supporting evidence')
        if not self.goal_falsifier_refs or len({goal for goal, _ in self.goal_falsifier_bindings}) != len(self.goal_falsifier_bindings):
            raise ValueError('goal hypothesis must retain the exact subject of each falsifier')
        if (self.goal_evidence_status == 'declared') != bool(self.expected_goal_evidence_refs):
            raise ValueError('goal hypothesis evidence status contradicts its declared evidence domain')
        definitions = tuple(row.evidence_ref for row in self.expected_goal_evidence)
        if len(definitions) != len(set(definitions)) or not set(definitions).issubset(self.expected_goal_evidence_refs):
            raise ValueError('goal evidence definitions lost their declared reference domain')
        if self.experiment_ref is None and (self.experiment_expected_effect_refs or self.experiment_falsifier_refs):
            raise ValueError('experiment evidence needs its own declared experiment')
        for name in ('utility_reason_refs', 'support_claim_refs', 'support_evidence_refs', 'goal_falsifier_refs',
                     'expected_goal_evidence_refs', 'experiment_expected_effect_refs', 'experiment_falsifier_refs'):
            refs = getattr(self, name)
            if len(refs) != len(set(refs)):
                raise ValueError('goal hypothesis contains duplicate evidence references')
        return self

    @model_serializer(mode='wrap')
    def preserve_reference_only_expectation_shape(self, handler):
        data = handler(self)
        if not self.expected_goal_evidence:
            data.pop('expected_goal_evidence', None)
        if not self.support_evidence_refs:
            data.pop('support_evidence_refs', None)
        for field in ('origin_activation_ref', 'origin_claim_ref'):
            if getattr(self, field) is None:
                data.pop(field, None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if (name != 'expected_goal_evidence' or self.expected_goal_evidence)
            and (name != 'support_evidence_refs' or self.support_evidence_refs)
            and (name not in ('origin_activation_ref', 'origin_claim_ref') or getattr(self, name) is not None))


def read_goal_hypotheses(values, *, goal_ref):
    """Validate transported records; never infer a hypothesis from a goal name."""
    rows = tuple(OperationalConsciousnessGoalHypothesis.model_validate(value) for value in values)
    if any(row.goal_ref != goal_ref for row in rows):
        raise ValueError('operational goal hypothesis belongs to another goal')
    return rows


def merge_goal_hypotheses(*domains, goal_ref):
    """Preserve every declared variant for its exact owner; never rank them."""
    rows = read_goal_hypotheses(tuple(row for domain in domains for row in domain), goal_ref=goal_ref)
    variants = {stable_digest(row): row for row in rows}
    return tuple(variants[key].model_dump(mode='python') for key in sorted(variants))


def validate_claim_goal_hypotheses(claim):
    """Qualify a claim-origin declaration against its actual canonical carrier."""
    for raw in claim.attributes.get('operational_goal_hypotheses', ()):
        row = OperationalConsciousnessGoalHypothesis.model_validate(raw)
        if row.origin_claim_ref is None:
            continue  # The activation constructor qualifies this other variant.
        if row.origin_claim_ref != claim.id:
            goals = (*claim.attributes.get('terminal_goal_refs', ()),
                *claim.attributes.get('instrumental_subgoal_refs', ()))
            if (not claim.attributes.get('activation_ref') or row.goal_ref not in goals
                    or row.origin_claim_ref not in claim.grounds):
                raise ValueError('carried goal hypothesis requires its explicit frontier and origin premise')
            continue  # Native frontier admission revalidates the canonical origin.
        if (not claim.scope or row.origin_claim_ref != claim.id or row.goal_ref not in claim.arguments
                or claim.attributes.get('goal_ref') != row.goal_ref
                or not set((*row.support_claim_refs, *row.support_evidence_refs)).issubset(claim.grounds)
                or not set(row.utility_reason_refs).issubset(claim.attributes.get('activation_reason_refs', ()))
                or not set(row.goal_falsifier_refs).issubset(claim.attributes.get('falsifier_refs', ()))):
            raise ValueError('claim-origin goal hypothesis lost its canonical owner, support or reasons')


def require_current_claim_hypothesis_origins(values, snapshot, *, current_scope=None):
    """A carried declaration must equal its currently admissible canonical origin."""
    for raw in values:
        row = OperationalConsciousnessGoalHypothesis.model_validate(raw)
        if row.origin_claim_ref is None:
            continue
        claim = snapshot.claim(row.origin_claim_ref)
        if (claim is None or claim.polarity.value != 'positive' or claim.disposition.value != 'active'
                or claim.active_contradictions or claim.defeated_by
                or (claim.valid_through_state_revision is not None
                    and claim.valid_through_state_revision < snapshot.revision)):
            raise ValueError('carried goal hypothesis has no current positive canonical origin')
        validate_claim_goal_hypotheses(claim)
        if current_scope is not None and any(current_scope.get(key) != value
                for key, value in sorted(claim.scope.items())):
            raise ValueError('carried goal hypothesis origin belongs to another execution scope')
        matches = tuple(OperationalConsciousnessGoalHypothesis.model_validate(item)
            for item in claim.attributes.get('operational_goal_hypotheses', ()))
        if row not in matches:
            raise ValueError('carried goal hypothesis differs from its canonical origin')
