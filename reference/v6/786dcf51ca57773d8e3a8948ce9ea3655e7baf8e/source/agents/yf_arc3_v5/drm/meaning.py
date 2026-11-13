"""Generic instantiation of declarative DRM meaning templates."""

from __future__ import annotations

from collections import ChainMap
from collections.abc import Mapping, Sequence
from functools import lru_cache
import re

from pydantic import Field, model_serializer, model_validator

from agents.yf_arc3_v5.drm.contracts import (
    DrmFactCondition,
    DrmFactProjection,
    DrmFactOperator,
    DrmTemplateIteration,
)
from agents.yf_arc3_v5.capabilities.contracts import DynamicGoalFrontierActivation
from agents.yf_arc3_v5.drm.registry import DrmRegistry
from agents.yf_arc3_v5.drm.fact_conditions import condition_input_fields, fact_condition_holds
from agents.yf_arc3_v5.drm.fact_contracts import capture_fact_contracts, reconcile_fact_contracts
from agents.yf_arc3_v5.drm.runtime import declared_eligibility_matches
from agents.yf_arc3_v5.logos.claims import Claim
from agents.yf_arc3_v5.logos.terms import Term
from agents.yf_arc3_v5.logos.types import Disposition, EpistemicStatus, FrozenMap, FrozenModel, Ref
from agents.yf_arc3_v5.operators.contracts import ClaimSeed, UpdateItem
from agents.yf_arc3_v5.state import CognitiveSnapshot, PutClaim, PutTerm


class NoApplicableDeclaredMeaning(ValueError):
    """Exact DRM templates matched no conclusion; not malformed evidence."""


class DeclaredMeaningInstantiation(FrozenModel):
    rule_ref: Ref
    terms: tuple[Term, ...]
    conclusions: tuple[ClaimSeed, ...] = Field(min_length=1)
    evidence_refs: tuple[Ref, ...] = Field(min_length=1)
    # Retain the exact DRM-projected facts so a later SRC workflow can pass
    # the selected declarative payload to a typed capability without
    # reconstructing semantic fields in Python.
    facts: FrozenMap = Field(default_factory=FrozenMap)
    template_iteration_complete: bool = True
    iterated_source_item_counts: FrozenMap = Field(default_factory=FrozenMap)
    schema_version: Ref = "yf_arc3_v5.declared_meaning_instantiation.v1"


class PreparedMeaningUpdates(FrozenModel):
    update_items: tuple[UpdateItem, ...] = Field(min_length=1)
    schema_version: Ref = "yf_arc3_v5.prepared_meaning_updates.v1"


class PreparedCommittedProposal(FrozenModel):
    """Exact delta envelope for one declaratively selected proposal."""

    canonical_claim_ref: Ref
    canonical_delta_required: bool
    update_items: tuple[UpdateItem, ...] = ()
    schema_version: Ref = "yf_arc3_v5.prepared_committed_proposal.v1"

    @model_validator(mode="after")
    def validate_delta_status(self) -> "PreparedCommittedProposal":
        if self.canonical_delta_required != bool(self.update_items):
            raise ValueError("canonical delta status must match exact update items")
        return self


class PreparedCommittedDerivation(FrozenModel):
    """Exact canonical delta envelope for one SRC-requested derivation."""

    canonical_claim_refs: tuple[Ref, ...] = Field(min_length=1)
    canonical_delta_required: bool
    update_items: tuple[UpdateItem, ...] = ()
    schema_version: Ref = "yf_arc3_v5.prepared_committed_derivation.v1"

    @model_validator(mode="after")
    def validate_delta_status(self) -> "PreparedCommittedDerivation":
        if self.canonical_delta_required != bool(self.update_items):
            raise ValueError("canonical delta status must match exact update items")
        return self


class DeclaredAlternativeFacts(FrozenModel):
    """Descriptive facts enriched only by source-hashed DRM projections."""

    alternative_refs: tuple[Ref, ...]
    alternative_facts: FrozenMap
    projection_refs: tuple[Ref, ...] = ()
    empty_inventory_projection_ref: Ref | None = None
    # Unknown for a manually constructed projection; producers measure the
    # exact DRM gate while retaining every original alternative as evidence.
    declared_eligibility_match_count: int | None = Field(default=None, ge=0)
    has_declared_eligibility_matches: bool | None = None
    schema_version: Ref = "yf_arc3_v5.declared_alternative_facts.v1"

    @model_validator(mode="after")
    def validate_declared_domain_measurement(self) -> "DeclaredAlternativeFacts":
        count = self.declared_eligibility_match_count
        expected = None if count is None else count > 0
        if self.has_declared_eligibility_matches is not expected:
            raise ValueError("declared domain presence must match its measured count")
        if not self.alternative_refs:
            if (self.empty_inventory_projection_ref is None or self.alternative_facts
                    or self.projection_refs != (self.empty_inventory_projection_ref,) or count != 0):
                raise ValueError('empty alternative inventory requires its exact declared projection')
        elif self.empty_inventory_projection_ref is not None:
            raise ValueError('nonempty alternative inventory cannot carry an empty projection')
        return self

    @model_serializer(mode='wrap')
    def preserve_nonempty_archive_shape(self, handler):
        data = handler(self)
        if self.empty_inventory_projection_ref is None:
            data.pop('empty_inventory_projection_ref', None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if name != 'empty_inventory_projection_ref' or self.empty_inventory_projection_ref is not None)


def _declared_empty_inventory(policy, candidate_facts):
    """Transport only an explicit DRM empty-domain contract, never select."""
    projection_ref = policy.configuration.get('empty_inventory_projection_ref')
    if not candidate_facts and isinstance(projection_ref, str) and projection_ref:
        return DeclaredAlternativeFacts(alternative_refs=(), alternative_facts=FrozenMap(),
            projection_refs=(projection_ref,), empty_inventory_projection_ref=projection_ref,
            declared_eligibility_match_count=0, has_declared_eligibility_matches=False)
    return None


def compose_declared_fact_sequences(
    projection: DrmFactProjection, facts: Mapping[str, object],
) -> dict[str, tuple[object, ...]]:
    """Execute source-declared sequence composition, not semantic selection."""
    output: dict[str, tuple[object, ...]] = {}
    current: Mapping[str, object] = ChainMap(output, facts)
    for composition in projection.sequence_compositions:
        values: list[object] = []
        for field in composition.source_fields:
            if field not in current:
                raise ValueError("declared sequence composition source is absent: " + field)
            sequence = current[field]
            if not isinstance(sequence, Sequence) or isinstance(sequence, (str, bytes)):
                raise ValueError("declared sequence composition source is not a sequence: " + field)
            if len(values) + len(sequence) > composition.max_items:
                raise ValueError("declared sequence composition bound exceeded; no items truncated")
            if composition.item_arity == 1:
                if any(not isinstance(item, str) or not item.strip() for item in sequence):
                    raise ValueError("declared Ref sequence contains a non-reference item: " + field)
                values.extend(sequence)
            else:
                for item in sequence:
                    if (not isinstance(item, Sequence) or isinstance(item, (str, bytes))
                            or len(item) != composition.item_arity
                            or any(not isinstance(ref, str) or not ref.strip() for ref in item)):
                        raise ValueError("declared Ref pair sequence contains a malformed item: " + field)
                    values.append(tuple(item))
        if composition.unique_items:
            values = list(dict.fromkeys(values))
        output[composition.output_field] = tuple(values)
    return output


def evaluate_declared_affine_expressions(
    projection: DrmFactProjection, facts: Mapping[str, object],
) -> dict[str, int]:
    """Mechanically evaluate source equations without selecting their meaning."""
    output: dict[str, int] = {}
    current: Mapping[str, object] = ChainMap(output, facts)
    for expression in projection.affine_expressions:
        numerator = expression.constant
        for term in expression.terms:
            if term.field not in current:
                raise ValueError("declared affine input is absent: " + term.field)
            value = current[term.field]
            if type(value) is not int:
                raise ValueError("declared affine input is not an exact integer: " + term.field)
            if abs(value) > expression.max_abs_value:
                raise ValueError("declared affine input bound exceeded: " + term.field)
            numerator += term.coefficient * value
            if abs(numerator) > expression.max_abs_value:
                raise ValueError("declared affine intermediate bound exceeded")
        quotient, remainder = divmod(numerator, expression.divisor)
        if remainder:
            raise ValueError("declared affine result is not exactly divisible")
        output[expression.output_field] = quotient
    return output


def project_declared_alternatives(
    *,
    drm: DrmRegistry,
    selection_policy_ref: str,
    alternative_refs: tuple[str, ...],
    descriptive_facts: Mapping[str, object],
) -> DeclaredAlternativeFacts:
    """Apply only the named DRM policy's explicit fact projections.

    An empty ``alternative_refs`` collection asks the policy to materialize its
    own declared classification alternatives from one common evidence mapping.
    Python performs template substitution and condition evaluation only; the
    semantic vocabulary and every added value remain in DRM source.
    """

    policy, _loaded = drm.resolve(selection_policy_ref)
    refs = alternative_refs or policy.declared_alternative_refs
    if not refs:
        empty = _declared_empty_inventory(policy, descriptive_facts)
        if empty is not None:
            return empty
        raise ValueError(
            f"{selection_policy_ref} declares no alternatives to project"
        )
    keyed = set(descriptive_facts) == set(refs) and all(
        isinstance(descriptive_facts.get(ref), Mapping) for ref in refs
    )
    contracts = {item.id: item for item in policy.fact_contracts}
    projected: dict[str, FrozenMap] = {}
    used_projection_refs: list[str] = []
    for alternative_ref in refs:
        raw = descriptive_facts.get(alternative_ref) if keyed else descriptive_facts
        if not isinstance(raw, Mapping):
            raise ValueError(f"descriptive facts missing for {alternative_ref}")
        facts: dict[str, object] = {**dict(raw), "alternative_ref": alternative_ref}
        contract_receipts = []
        for projection in drm.fact_projections_for(
            selection_policy_ref, alternative_ref, facts
        ):
            if not _projection_matches(
                projection.all_conditions,
                projection.any_conditions,
                facts,
            ):
                continue
            facts.update(projection.static_facts.to_dict())
            facts.update(
                {
                    str(field): facts[str(source_field)]
                    for field, source_field in projection.bound_facts.canonical_items()
                    if str(source_field) in facts
                }
            )
            facts.update(
                {
                    str(field): _render_fact_value(value, facts)
                    for field, value in projection.templated_facts.canonical_items()
                }
            )
            used_projection_refs.append(projection.id)
            facts.update(compose_declared_fact_sequences(projection, facts))
            if projection.affine_expressions:
                facts.update(evaluate_declared_affine_expressions(projection, facts))
            contract_receipts.extend(capture_fact_contracts(
                projection=projection, contracts=contracts, facts=facts,
                alternative_ref=alternative_ref,
            ))
        facts.update(reconcile_fact_contracts(contract_receipts, facts))
        if isinstance(raw, FrozenMap):
            # Projections change only their declared fields. Preserve the exact
            # immutable children of the evidence mapping instead of freezing
            # all unchanged tuple bindings again for each alternative.
            projected[alternative_ref] = FrozenMap.overlay(
                {key: value for key, value in sorted(facts.items())
                 if key not in raw or raw[key] is not value},
                raw,
            )
        else:
            projected[alternative_ref] = FrozenMap(facts)
    eligibility_count = sum(
        declared_eligibility_matches(projected[ref], policy) for ref in refs
    )
    return DeclaredAlternativeFacts(
        alternative_refs=refs,
        alternative_facts=FrozenMap(projected),
        projection_refs=tuple(dict.fromkeys(used_projection_refs)),
        declared_eligibility_match_count=eligibility_count,
        has_declared_eligibility_matches=eligibility_count > 0,
    )


def project_declared_alternative_deltas(
    *,
    drm: DrmRegistry,
    selection_policy_ref: str,
    alternative_refs: tuple[str, ...],
    alternative_facts: Mapping[str, object],
    context_facts: Mapping[str, object],
) -> DeclaredAlternativeFacts:
    """Project candidate deltas while retaining shared immutable context once."""

    policy, _loaded = drm.resolve(selection_policy_ref)
    refs = alternative_refs or policy.declared_alternative_refs
    if not refs:
        empty = _declared_empty_inventory(policy, alternative_facts)
        if empty is not None:
            return empty
        raise ValueError(
            f"{selection_policy_ref} declares no alternatives to project"
        )
    condition_plans, stable_conditions = drm.projection_condition_plan(
        selection_policy_ref
    )
    candidate_fields: set[str] = {"alternative_ref"}
    for alternative_ref in refs:
        raw = alternative_facts.get(alternative_ref)
        if isinstance(raw, Mapping):
            candidate_fields.update(str(field) for field in raw)
    shared_condition_results = bytearray([2]) * len(stable_conditions)
    shared_condition_slots = bytes(
        all(field not in candidate_fields for field in condition_input_fields(condition))
        for condition in stable_conditions)
    contracts = {item.id: item for item in policy.fact_contracts}
    projected: dict[str, FrozenMap] = {}
    used_projection_refs: list[str] = []
    for alternative_ref in refs:
        raw = alternative_facts.get(alternative_ref)
        if not isinstance(raw, Mapping):
            raise ValueError(f"descriptive facts missing for {alternative_ref}")
        # The delta entry is already separated from shared context by the
        # capability contract. Re-comparing every nested context value for
        # every alternative is both redundant and quadratic in scene size.
        delta: dict[str, object] = {
            **dict(raw),
            "alternative_ref": alternative_ref,
        }
        # These control fields are selected after capability measurement by
        # SRC.  A candidate's earlier snapshot must not shadow the declared
        # current context during delta projection.
        for current_context_field in (
            "active_priority_node_ref",
            "reasoning_strategy_ref",
            "dynamic_goal_selection_present",
            "selected_dynamic_goal_ref",
            "frozen_pre_reaction_click_frontier_exhausted",
        ):
            if current_context_field in context_facts:
                delta.pop(current_context_field, None)
        facts: Mapping[str, object] = ChainMap(delta, context_facts)
        contract_receipts = []
        stable_condition_results = shared_condition_results.copy()
        for projection in drm.fact_projections_for(
            selection_policy_ref, alternative_ref, facts
        ):
            all_plan, any_plan = condition_plans[id(projection)]
            if not _delta_projection_matches_indexed(
                all_plan,
                any_plan,
                delta,
                context_facts,
                stable_condition_results,
                shared_condition_results,
                shared_condition_slots,
            ):
                continue
            delta.update(projection.static_facts.to_shallow_dict())
            delta.update(
                {
                    str(field): facts[str(source_field)]
                    for field, source_field in sorted(projection.bound_facts.items())
                    if str(source_field) in facts
                }
            )
            delta.update(
                {
                    str(field): _render_fact_value(value, facts)
                    for field, value in sorted(projection.templated_facts.items())
                }
            )
            used_projection_refs.append(projection.id)
            delta.update(compose_declared_fact_sequences(projection, facts))
            if projection.affine_expressions:
                delta.update(evaluate_declared_affine_expressions(projection, facts))
            contract_receipts.extend(capture_fact_contracts(
                projection=projection, contracts=contracts, facts=facts,
                alternative_ref=alternative_ref,
            ))
        delta.update(reconcile_fact_contracts(contract_receipts, facts))
        projected[alternative_ref] = FrozenMap(delta)
    eligibility_count = sum(
        declared_eligibility_matches(ChainMap(projected[ref], context_facts), policy)
        for ref in refs
    )
    return DeclaredAlternativeFacts(
        alternative_refs=refs,
        alternative_facts=FrozenMap(projected),
        projection_refs=tuple(dict.fromkeys(used_projection_refs)),
        declared_eligibility_match_count=eligibility_count,
        has_declared_eligibility_matches=eligibility_count > 0,
    )


def project_declared_shared_alternative_deltas(
    *,
    drm: DrmRegistry,
    selection_policy_ref: str,
    descriptive_facts: FrozenMap,
) -> DeclaredAlternativeFacts:
    """Apply the existing delta evaluator to one shared classification context.

    Every declared alternative starts with an empty delta; eligibility still
    sees the complete context. The caller retains that immutable context and
    materializes a full mapping only for a consumer that actually needs one.
    Keyed candidate inputs use their existing projection ABI instead.
    """
    policy, _loaded = drm.resolve(selection_policy_ref)
    refs = policy.declared_alternative_refs
    if not refs:
        return project_declared_alternatives(
            drm=drm, selection_policy_ref=selection_policy_ref,
            alternative_refs=(), descriptive_facts=descriptive_facts)
    empty = FrozenMap()
    return project_declared_alternative_deltas(
        drm=drm, selection_policy_ref=selection_policy_ref,
        alternative_refs=refs,
        alternative_facts=FrozenMap({ref: empty for ref in refs}),
        context_facts=descriptive_facts)


def project_declared_delta(
    *,
    drm: DrmRegistry,
    selection_policy_ref: str,
    alternative_refs: tuple[str, ...],
    context_facts: Mapping[str, object],
    descriptive_delta: Mapping[str, object],
) -> DeclaredAlternativeFacts:
    """Project one immutable delta without repackaging its prior context."""

    return project_declared_alternatives(
        drm=drm,
        selection_policy_ref=selection_policy_ref,
        alternative_refs=alternative_refs,
        descriptive_facts=ChainMap(descriptive_delta, context_facts),
    )


def instantiate_declared_meaning(
    *,
    drm: DrmRegistry,
    selection_policy_ref: str,
    selected_ref: str,
    alternative_facts: Mapping[str, object],
    evidence_refs: tuple[str, ...],
    state_revision: int,
    rule_ref_override: str | None = None,
    existing_term_refs: tuple[str, ...] = (),
) -> DeclaredMeaningInstantiation:
    """Instantiate only templates named by the selected DRM alternative."""

    normalized_evidence_refs = tuple(dict.fromkeys(evidence_refs))
    policy, _loaded = drm.resolve(selection_policy_ref)
    rule_ref = rule_ref_override or (
        policy.meaning_template_ref_by_alternative.get(selected_ref)
        or policy.meaning_template_ref_by_alternative.get("*")
    )
    if not isinstance(rule_ref, str) or not rule_ref:
        raise ValueError(
            f"{selection_policy_ref} declares no meaning template for {selected_ref}"
        )
    rule, _rule_loaded = drm.resolve(rule_ref)
    raw_facts = alternative_facts.get(selected_ref)
    if not isinstance(raw_facts, Mapping):
        raise ValueError("selected meaning alternative has no exact fact mapping")
    evidence_field = policy.configuration.get("meaning_evidence_refs_field")
    if evidence_field is not None and evidence_field in raw_facts:
        declared_refs = raw_facts[evidence_field]
        if not isinstance(declared_refs, (tuple, list)) or not frozenset(normalized_evidence_refs).issubset(declared_refs):
            raise ValueError("declared meaning evidence must preserve the caller basis")
        normalized_evidence_refs = tuple(dict.fromkeys(declared_refs))
    normalized_evidence_basis = frozenset(normalized_evidence_refs)
    facts = dict(raw_facts)
    iterated_source_item_counts = _validate_declared_template_iterations(rule, facts)
    term_items: list[Term] = []
    if len(existing_term_refs) > 64:
        raise ValueError("existing canonical term reference bound exceeded")
    term_ids: set[str] = set(existing_term_refs)
    for template in rule.term_templates:
        for template_facts in _template_fact_contexts(template.iteration, facts):
            if not _projection_matches(
                template.all_conditions,
                template.any_conditions,
                template_facts,
            ):
                continue
            if not _required_fields_present(template.required_fields, template_facts):
                if template.iteration is not None:
                    raise ValueError(
                        f"{rule_ref} iterated TERM template has missing required fields"
                    )
                continue
            if any(
                _render(pattern, template_facts) not in term_ids
                for pattern in template.required_term_patterns
            ):
                continue
            term = Term(
                    id=_render(template.id_pattern, template_facts),
                    kind=template.kind,
                    label=template.label,
                    attributes=FrozenMap(
                        {
                            **template.static_attributes.to_dict(),
                            **_bound_attributes(
                                template.attribute_bindings, template_facts
                            ),
                        }
                    ),
                    provenance=_declared_template_evidence_refs(
                        rule.configuration, template.iteration, template_facts,
                        normalized_evidence_basis,
                    ) or normalized_evidence_refs,
                    created_at_state_revision=state_revision,
                    last_changed_state_revision=state_revision,
                )
            term_items.append(term)
            term_ids.add(term.id)
    terms = tuple(term_items)
    frozen_term_ids = frozenset(term_ids)
    conclusion_items: list[ClaimSeed] = []
    for template in rule.claim_templates:
        for template_facts in _template_fact_contexts(template.iteration, facts):
            if not _projection_matches(
                template.all_conditions,
                template.any_conditions,
                template_facts,
            ):
                continue
            if not _required_fields_present(template.required_fields, template_facts):
                if template.iteration is not None:
                    raise ValueError(
                        f"{rule_ref} iterated CLAIM template has missing required fields"
                    )
                continue
            if any(
                _render(pattern, template_facts) not in frozen_term_ids
                for pattern in template.required_term_patterns
            ):
                continue
            conclusion_items.append(
                ClaimSeed(
                    id=_render(template.id_pattern, template_facts),
                    predicate=template.predicate,
                    family=template.family,
                    scope=_declared_claim_scope(template,template_facts),
                    derivation_premise_refs=(
                        tuple(template_facts[template.derivation_premise_refs_field])
                        if template.derivation_premise_refs_field is not None else
                        _declared_template_evidence_refs(
                            rule.configuration, template.iteration, template_facts,
                            normalized_evidence_basis,
                        )
                    ),
                    arguments=tuple(
                        _render(pattern, template_facts)
                        for pattern in template.argument_patterns
                    ),
                    attributes=FrozenMap(
                        {
                            **template.static_attributes.to_dict(),
                            **_bound_attributes(
                                template.attribute_bindings, template_facts
                            ),
                            "declared_epistemic_status": (
                                template.epistemic_status.value
                            ),
                        }
                    ),
                )
            )
    conclusions = tuple(conclusion_items)
    if not conclusions:
        raise NoApplicableDeclaredMeaning(f"{rule_ref} produced no claim from selected exact facts")
    from .activation_transport import ACTIVATION_RULE_REF, require_activation_payload_conservation
    if rule_ref == ACTIVATION_RULE_REF:
        require_activation_payload_conservation(rule.configuration, facts, terms, conclusions)
    return DeclaredMeaningInstantiation(
        rule_ref=rule_ref,
        terms=terms,
        conclusions=conclusions,
        evidence_refs=normalized_evidence_refs,
        facts=FrozenMap(facts),
        template_iteration_complete=True,
        iterated_source_item_counts=FrozenMap(iterated_source_item_counts),
    )


def instantiate_dynamic_goal_frontier_activation(
    *, facts: Mapping[str, object]
) -> DynamicGoalFrontierActivation:
    """Materialize a DRM-selected frontier payload mechanically.

    The caller supplies only facts already projected by a DRM declaration;
    this function performs shape conversion and contract validation.  It does
    not choose goals, priorities, or activation reasons.
    """

    def refs(name: str, *, required: bool = False) -> tuple[str, ...]:
        raw = facts.get(name, ())
        if isinstance(raw, str):
            values = (raw,)
        elif isinstance(raw, (tuple, list)):
            values = tuple(str(item) for item in raw)
        else:
            values = ()
        if required and not values:
            raise ValueError(f"frontier activation fact {name} is required")
        return values

    raw_parent_mappings = facts.get("instrumental_parent_goal_refs", ())
    parent_mappings = (
        tuple((str(pair[0]), str(pair[1])) for pair in raw_parent_mappings)
        if isinstance(raw_parent_mappings, (tuple, list))
        else ()
    )
    raw_falsifier_mappings = facts.get("goal_falsifier_refs", ())
    falsifier_mappings = (
        tuple((str(pair[0]), str(pair[1])) for pair in raw_falsifier_mappings)
        if isinstance(raw_falsifier_mappings, (tuple, list))
        else ()
    )
    instrumental_refs = refs("instrumental_subgoal_refs")
    if facts.get("collapse_exact_consecutive_goal_aliases") is True:
        chain = refs("goal_dependency_chain_refs")
        aliases = frozenset(right for left, right in zip(chain, chain[1:])
                            if left == right)
        # The DRM declaration licenses only exact consecutive identity aliases.
        # Conflicting parents and nonconsecutive cycles remain contract errors.
        collapsed = []
        for ref in instrumental_refs:
            if collapsed and collapsed[-1] == ref and ref in aliases:
                continue
            collapsed.append(ref)
        instrumental_refs = tuple(collapsed)
        parent_mappings = tuple(pair for pair in parent_mappings
                                if pair[0] != pair[1] or pair[0] not in aliases)
    try:
        payload = {key: value for key, value in sorted(facts.items())
            if key in DynamicGoalFrontierActivation.model_fields}
        payload.update({
            'activation_ref': str(facts["activation_ref"]),
            'static_knowledge_graph_ref': str(facts["static_knowledge_graph_ref"]),
            'guiding_principle_ref': str(facts["guiding_principle_ref"]),
            'scene_support_claim_refs': refs("scene_support_claim_refs", required=True),
            'terminal_goal_refs': refs("terminal_goal_refs", required=True),
            'instrumental_subgoal_refs': instrumental_refs,
            'instrumental_parent_goal_refs': parent_mappings,
            'instrumental_node_kind_ref': facts.get("instrumental_node_kind_ref", "required_prerequisite"),
            'goal_falsifier_refs': falsifier_mappings,
            'operational_goal_hypotheses': facts.get('operational_goal_hypotheses', ()),
            'goal_target_bindings': facts.get("goal_target_bindings", ()),
            'active_goal_ref': str(facts["active_goal_ref"])
                if facts.get("active_goal_ref")
                else None,
            'active_priority_node_ref': str(facts["active_priority_node_ref"])
                if facts.get("active_priority_node_ref")
                else None,
            'source_static_priority_ref': str(facts["source_static_priority_ref"])
                if facts.get("source_static_priority_ref")
                else None,
            'consolidated_priority_ref': str(facts["consolidated_priority_ref"])
                if facts.get("consolidated_priority_ref")
                else None,
            'consolidation_reason_refs': refs("consolidation_reason_refs"),
            'activation_reason_refs': refs("activation_reason_refs", required=True),
            'disable_reason_refs': refs("disable_reason_refs"),
            'alternative_goal_refs': refs("alternative_goal_refs"),
            'conflicting_goal_refs': refs("conflicting_goal_refs"),
            'best_credible_outcome_refs': refs("best_credible_outcome_refs"),
            'worst_credible_outcome_refs': refs("worst_credible_outcome_refs"),
            'specialized_measurement_requirements': tuple(
                FrozenMap(row) for row in (facts.get("specialized_measurement_requirements") or ())
            )
        })
        return DynamicGoalFrontierActivation.model_validate(payload)
    except (KeyError, TypeError, ValueError) as error:
        raise ValueError(f"invalid DRM frontier activation facts: {error}") from error


def prepare_meaning_updates(
    *,
    snapshot: CognitiveSnapshot,
    terms: tuple[Term, ...],
    claims: tuple[Claim, ...],
    allow_empty: bool = False,
) -> PreparedMeaningUpdates | None:
    """Mechanically wrap declared meaning in exact canonical mutations."""

    updates: list[UpdateItem] = []
    next_revision = snapshot.revision + 1
    for term in terms:
        before = snapshot.term(term.id)
        after = term.model_copy(
            update={
                "created_at_state_revision": (
                    before.created_at_state_revision if before else next_revision
                ),
                "last_changed_state_revision": next_revision,
            }
        )
        if before is not None and before.attributes == after.attributes and before.label == after.label:
            continue
        updates.append(UpdateItem(mutation=PutTerm(before=before, after=after)))
    for claim in claims:
        if snapshot.claim(claim.id) is not None:
            continue
        declared_status = claim.attributes.get("declared_epistemic_status")
        attributes = claim.attributes.to_dict()
        attributes.pop("declared_epistemic_status", None)
        after = claim.model_copy(
            update={
                "epistemic_status": (
                    EpistemicStatus(
                        str(declared_status or claim.epistemic_status.value)
                    )
                ),
                "attributes": FrozenMap(attributes),
            }
        )
        updates.append(UpdateItem(mutation=PutClaim(after=after)))
    if not updates:
        if allow_empty:
            return None
        raise ValueError("declared meaning contains no new canonical delta")
    return PreparedMeaningUpdates(update_items=tuple(updates))


def prepare_revisable_meaning_updates(
    *,
    snapshot: CognitiveSnapshot,
    terms: tuple[Term, ...],
    claims: tuple[Claim, ...],
    allow_empty: bool = False,
) -> PreparedMeaningUpdates | None:
    """Prepare immutable revisions for DRM-declared current-state claims.

    A declaration may attach ``revision_family_ref`` to claims whose attributes
    describe the current observation while their predicate and arguments remain
    stable.  This reducer performs only exact family lookup and immutable
    supersession; DRM still owns every predicate, argument, status and value.
    """

    updates: list[UpdateItem] = []
    next_revision = snapshot.revision + 1
    for term in terms:
        before = snapshot.term(term.id)
        merged_attributes = (
            FrozenMap(
                {
                    **before.attributes.to_shallow_dict(),
                    **term.attributes.to_shallow_dict(),
                }
            )
            if before is not None
            else term.attributes
        )
        after = term.model_copy(
            update={
                "attributes": merged_attributes,
                "created_at_state_revision": (
                    before.created_at_state_revision if before else next_revision
                ),
                "last_changed_state_revision": next_revision,
            }
        )
        if (
            before is not None
            and before.attributes == after.attributes
            and before.label == after.label
        ):
            continue
        updates.append(UpdateItem(mutation=PutTerm(before=before, after=after)))

    # A TERM-only delta cannot revise a CLAIM. Preserve the exact no-op error,
    # without scanning unrelated canonical claims or adding another index.
    if not claims:
        if not updates:
            if allow_empty:
                return None
            raise ValueError("revisable declared meaning contains no canonical delta")
        return PreparedMeaningUpdates(update_items=tuple(updates))

    families = snapshot.current_claims_by_revision_family
    current_by_family: dict[str, Claim] = {}
    emitted_claim_refs: dict[str, str] = {}
    existing_ids = snapshot.claim_index
    new_ids: set[str] = set()

    def comparable(item: Claim) -> dict[str, object]:
        data = item.model_dump(mode="python")
        data.pop("id", None)
        data.pop("supersedes", None)
        return data

    for claim in claims:
        declared_status = claim.attributes.get("declared_epistemic_status")
        declared_disposition = claim.attributes.get("declared_disposition")
        attributes = claim.attributes.to_dict()
        attributes.pop("declared_epistemic_status", None)
        attributes.pop("declared_disposition", None)
        if attributes.get("revision_identity_policy") not in (None, "declared_content_address"):
            raise ValueError("unsupported declared revision identity policy")
        family_ref = str(attributes.get("revision_family_ref") or claim.id)
        attributes["revision_family_ref"] = family_ref
        desired = claim.model_copy(
            update={
                "epistemic_status": EpistemicStatus(
                    str(declared_status or claim.epistemic_status.value)
                ),
                "disposition": Disposition(str(declared_disposition or claim.disposition.value)),
                "attributes": FrozenMap(attributes),
            }
        )
        before = current_by_family.get(family_ref)
        if before is None:
            family_members = families.get(family_ref, ())
            before = family_members[-1] if family_members else None
        if before is not None:
            if (
                before.predicate != desired.predicate
                or before.family != desired.family
                or before.arguments != desired.arguments
            ):
                raise ValueError(
                    "revisable claim family cannot change predicate or arguments"
                )
            if comparable(before) == comparable(desired):
                emitted_claim_refs[claim.id] = before.id
                continue
            exact_identity = attributes.get("revision_identity_policy") == "declared_content_address"
            if exact_identity and (claim.id in existing_ids or claim.id in new_ids):
                raise ValueError("declared revision identity already exists with different content")
            base_id = claim.id if exact_identity else f"{claim.id}:r{next_revision}"
            after_id = base_id
            suffix = 1
            while after_id in existing_ids or after_id in new_ids:
                after_id = f"{base_id}:{suffix}"
                suffix += 1
            desired = desired.model_copy(
                update={"id": after_id, "supersedes": before.id}
            )
            mutation = PutClaim(before=before, after=desired)
        else:
            mutation = PutClaim(after=desired)
        updates.append(UpdateItem(mutation=mutation))
        new_ids.add(desired.id)
        current_by_family[family_ref] = desired
        emitted_claim_refs[claim.id] = desired.id

    # A source TERM may refer to a CLAIM emitted in this same transaction.
    # Supersession changes its immutable id; preserve the declared link to
    # that exact emitted proof, not to its now historical template id.
    term_update_offsets = {
        item.mutation.after.id: offset for offset, item in enumerate(updates)
        if isinstance(item.mutation, PutTerm)
    }
    for term in terms:
        refs = term.attributes.get("role_premise_claim_refs", ())
        rebound = tuple(emitted_claim_refs.get(ref, ref) for ref in refs)
        if rebound == refs:
            continue
        offset = term_update_offsets.get(term.id)
        before = snapshot.term(term.id)
        current = updates[offset].mutation.after if offset is not None else before
        if current is None:
            current = term
        after = current.model_copy(update={
            "attributes": FrozenMap({**current.attributes, "role_premise_claim_refs": rebound}),
            "last_changed_state_revision": next_revision,
        })
        item = UpdateItem(mutation=PutTerm(before=before, after=after))
        if offset is None:
            term_update_offsets[term.id] = len(updates)
            updates.append(item)
        else:
            updates[offset] = item

    if not updates:
        if allow_empty:
            return None
        raise ValueError("revisable declared meaning contains no canonical delta")
    return PreparedMeaningUpdates(update_items=tuple(updates))


def _required_fields_present(
    fields: tuple[str, ...],
    facts: Mapping[str, object],
) -> bool:
    return all(facts.get(field) not in (None, "", ()) for field in fields)


def _declared_template_evidence_refs(
    configuration: Mapping[str, object],
    iteration: DrmTemplateIteration | None,
    facts: Mapping[str, object],
    evidence_refs: frozenset[str],
) -> tuple[str, ...] | None:
    """Render only the dependency scope explicitly declared by the DRM rule.

    The full invocation basis remains recorded. This projection never invents
    a dependency or silently falls back when a declared scope is incomplete.
    Rules without a declaration retain their historical provenance contract.
    """
    field_scopes = configuration.get("template_evidence_ref_fields")
    if "template_evidence_ref_fields" in configuration:
        if "template_evidence_ref_patterns" in configuration:
            raise ValueError("declared template evidence scopes are ambiguous")
        if not isinstance(field_scopes, Mapping):
            raise ValueError("declared template evidence fields must be a mapping")
        source = iteration.source_field if iteration is not None else "non_iterated"
        field = field_scopes.get(source)
        if not isinstance(field, str) or not field:
            raise ValueError("declared template evidence field is missing or empty")
        values = facts.get(field)
        if not isinstance(values, (tuple, list)) or not values:
            raise ValueError("declared template evidence refs are missing or empty")
        if any(not isinstance(value, str) or not value for value in values):
            raise ValueError("declared template evidence refs must be nonempty strings")
        refs = tuple(dict.fromkeys(values))
        if not frozenset(refs).issubset(evidence_refs):
            raise ValueError("declared template evidence is absent from the invocation basis")
        return refs
    if "template_evidence_ref_patterns" not in configuration:
        return None
    scopes = configuration["template_evidence_ref_patterns"]
    if not isinstance(scopes, Mapping):
        raise ValueError("declared template evidence scopes must be a mapping")
    source = iteration.source_field if iteration is not None else "non_iterated"
    patterns = scopes.get(source)
    if not isinstance(patterns, (tuple, list)) or not patterns:
        raise ValueError("declared template evidence scope is missing or empty")
    if any(not isinstance(pattern, str) or not pattern for pattern in patterns):
        raise ValueError("declared template evidence patterns must be nonempty strings")
    refs = tuple(dict.fromkeys(_render(pattern, facts) for pattern in patterns))
    if not frozenset(refs).issubset(evidence_refs):
        raise ValueError("declared template evidence is absent from the invocation basis")
    return refs


def _template_fact_contexts(
    iteration: DrmTemplateIteration | None,
    facts: Mapping[str, object],
) -> tuple[Mapping[str, object], ...]:
    if iteration is None:
        return (facts,)
    source = facts.get(iteration.source_field)
    if not isinstance(source, (list, tuple)):
        raise ValueError(
            f"DRM template iteration source is missing or not a list: "
            f"{iteration.source_field}"
        )
    if len(source) > iteration.max_items:
        raise ValueError(
            f"DRM template iteration source {iteration.source_field} exceeds "
            f"declared max_items={iteration.max_items}"
        )
    contexts: list[Mapping[str, object]] = []
    for index, item in enumerate(source):
        if not isinstance(item, Mapping):
            raise ValueError(
                f"DRM template iteration item {index} is not a fact mapping"
            )
        local_bindings: dict[str, object] = {}
        for local_field, item_field in iteration.item_bindings.canonical_items():
            source_key = str(item_field)
            if source_key not in item:
                raise ValueError(
                    f"DRM template iteration item {index} is missing {source_key}"
                )
            local_bindings[str(local_field)] = item[source_key]
        if iteration.index_binding is not None:
            local_bindings[iteration.index_binding] = index
        context = ChainMap(local_bindings, facts)
        if _projection_matches(
            iteration.all_conditions,
            iteration.any_conditions,
            context,
        ) and all(
            any(_fact_condition_holds(condition, context) for condition in group)
            for group in iteration.any_condition_groups
        ):
            contexts.append(context)
    return tuple(contexts)


def _validate_declared_template_iterations(
    rule: object,
    facts: Mapping[str, object],
) -> dict[str, int]:
    counts: dict[str, int] = {}
    templates = (*rule.term_templates, *rule.claim_templates)
    for template in templates:
        iteration = template.iteration
        if iteration is None:
            continue
        _template_fact_contexts(iteration, facts)
        source = facts.get(iteration.source_field)
        assert isinstance(source, (list, tuple))
        counts[iteration.source_field] = len(source)
    return counts


def _declared_claim_scope(template, facts: Mapping[str, object]) -> FrozenMap:
    """Transport every declared scope field, preserving explicit absence values.

    Attribute projections may be partial; an explicitly requested scope binding
    may not silently disappear or override an incompatible static identity.
    """
    bindings=template.scope_bindings
    missing=tuple(str(field) for _key,field in sorted(bindings.items()) if str(field) not in facts)
    if missing:raise ValueError('declared claim scope sources absent: '+', '.join(missing))
    bound=_bound_attributes(bindings,facts)
    conflicts=tuple(key for key in sorted(bound)
        if key in template.static_scope and template.static_scope[key]!=bound[key])
    if conflicts:raise ValueError('declared claim scope identity conflict: '+', '.join(conflicts))
    return FrozenMap({**template.static_scope,**bound})


def _bound_attributes(
    bindings: FrozenMap,
    facts: Mapping[str, object],
) -> dict[str, object]:
    return {
        attribute: facts[str(fact_field)]
        for attribute, fact_field in sorted(bindings.items())
        if str(fact_field) in facts
    }


@lru_cache(maxsize=8192)
def _template_fields(pattern: str) -> tuple[str, ...]:
    return tuple(dict.fromkeys(re.findall(r"\{([^{}]+)\}", pattern)))


def _render(pattern: str, facts: Mapping[str, object]) -> str:
    rendered = pattern
    for _depth in range(8):
        previous = rendered
        for field in _template_fields(rendered):
            raw_value = facts.get(field)
            if isinstance(raw_value, (str, int, bool)):
                rendered = rendered.replace("{" + field + "}", str(raw_value))
        if "{" not in rendered and "}" not in rendered:
            return rendered
        if rendered == previous:
            break
    raise ValueError(f"unbound DRM meaning template: {pattern}")


def _render_fact_value(value: object, facts: Mapping[str, object]) -> object:
    if isinstance(value, str):
        return _render(value, facts)
    if isinstance(value, tuple):
        return tuple(_render_fact_value(item, facts) for item in value)
    if isinstance(value, list):
        return tuple(_render_fact_value(item, facts) for item in value)
    if isinstance(value, Mapping):
        if set(value) == {"$fact"}:
            source = str(value["$fact"])
            if source not in facts:
                raise ValueError(f"unbound DRM fact projection: {source}")
            return facts[source]
        return FrozenMap(
            {
                str(key): _render_fact_value(item, facts)
                for key, item in sorted(value.items())
            }
        )
    return value


def _projection_matches(
    all_conditions: tuple[DrmFactCondition, ...],
    any_conditions: tuple[DrmFactCondition, ...],
    facts: Mapping[str, object],
) -> bool:
    return all(_fact_condition_holds(item, facts) for item in all_conditions) and (
        not any_conditions
        or any(_fact_condition_holds(item, facts) for item in any_conditions)
    )


def _delta_projection_matches(
    all_conditions: tuple[DrmFactCondition, ...],
    any_conditions: tuple[DrmFactCondition, ...],
    delta: Mapping[str, object],
    context: Mapping[str, object],
) -> bool:
    """Match one candidate delta without generic ChainMap traversal per fact."""

    return all(
        _delta_fact_condition_holds(item, delta, context)
        for item in all_conditions
    ) and (
        not any_conditions
        or any(
            _delta_fact_condition_holds(item, delta, context)
            for item in any_conditions
        )
    )


def _delta_projection_matches_indexed(
    all_plan: tuple[tuple[DrmFactCondition, int], ...],
    any_plan: tuple[tuple[DrmFactCondition, int], ...],
    delta: Mapping[str, object],
    context: Mapping[str, object],
    stable_results: bytearray,
    shared_results: bytearray,
    shared_slots: bytes,
) -> bool:
    """Evaluate conditions on demand; share only candidate-independent inputs.

    Source-authored outputs have no stable slot. A candidate-dependent slot is
    private to its alternative; all other results can be shared in this one
    projection call. Unvisited conditions remain unknown, never false.
    """

    for condition, slot in all_plan:
        result = stable_results[slot] if slot >= 0 else 2
        if result == 2:
            result = int(_delta_fact_condition_holds(condition, delta, context))
            if slot >= 0:
                stable_results[slot] = result
                if shared_slots[slot]:
                    shared_results[slot] = result
        if result == 0:
            return False
    if not any_plan:
        return True
    for condition, slot in any_plan:
        result = stable_results[slot] if slot >= 0 else 2
        if result == 2:
            result = int(_delta_fact_condition_holds(condition, delta, context))
            if slot >= 0:
                stable_results[slot] = result
                if shared_slots[slot]:
                    shared_results[slot] = result
        if result == 1:
            return True
    return False


def _delta_fact_condition_holds(
    condition: DrmFactCondition,
    delta: Mapping[str, object],
    context: Mapping[str, object],
) -> bool:
    return fact_condition_holds(condition, delta, context)


def _fact_condition_holds(
    condition: DrmFactCondition,
    facts: Mapping[str, object],
) -> bool:
    return fact_condition_holds(condition, facts)


__all__ = (
    "DeclaredAlternativeFacts",
    "DeclaredMeaningInstantiation",
    "PreparedCommittedProposal",
    "PreparedMeaningUpdates",
    "instantiate_declared_meaning",
    "project_declared_alternatives",
    "prepare_meaning_updates",
)
