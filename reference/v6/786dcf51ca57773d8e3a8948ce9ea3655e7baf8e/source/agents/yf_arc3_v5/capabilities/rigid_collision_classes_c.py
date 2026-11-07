"""Evidence transport for Source-owned, palette-independent collision classes.

No collision meaning is selected here. Source evaluates each measured evidence
row before the rearrangement workflow may call K09.
"""
from typing import Literal
from collections import Counter
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref, stable_digest


class RigidBlockingContactEvidenceC(FrozenModel):
    mover_ref: Ref
    peer_ref: Ref
    command_ref: Ref
    free_translation_evidence_refs: tuple[Ref, ...] = Field(default=(), max_length=64)
    blocked_translation_evidence_refs: tuple[Ref, ...] = Field(default=(), max_length=64)
    control_evidence_refs: tuple[Ref, ...] = Field(default=(), max_length=64)
    contact_prediction_evidence_refs: tuple[Ref, ...] = Field(default=(), max_length=64)
    excluded_competing_cause_refs: tuple[Ref, ...] = Field(default=(), max_length=64)
    mover_translation_zero: bool
    peer_translation_zero: bool
    command_context_comparable: bool


class RigidCollisionClassRuleC(FrozenModel):
    first_class_ref: Ref
    second_class_ref: Ref
    blocking_contact: RigidBlockingContactEvidenceC | None = None
    # Already acquired Source morphology claims, not RGB/colour equality.
    outlined_solid_morphology_premise_refs: tuple[Ref, ...] = Field(default=(), max_length=64)
    selection_decoration_separated_from_body: bool
    observed_overflight_refs: tuple[Ref, ...] = Field(default=(), max_length=64)
    evidence_refs: tuple[Ref, ...] = Field(min_length=1, max_length=64)
    falsifier_ref: Ref


class RigidCollisionClassGateC(FrozenModel):
    membership_kind: Literal['PALETTE_INDEPENDENT_MORPHOLOGY']
    epoch: int = Field(ge=0)
    evidence_revision_ref: Ref
    model_revision_ref: Ref
    model_ref: Ref
    # Membership is supplied by current DRM morphology claims. No palette
    # field is available as a shortcut for equality or inequality of classes.
    class_by_body: FrozenMap
    membership_evidence_by_body: FrozenMap
    rules: tuple[RigidCollisionClassRuleC, ...] = Field(default=(), max_length=128)


class RigidCollisionRuleFactsC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.rigid_collision_rule_facts_c.v1'
    facts: FrozenMap


def class_pair_ref(first, second):
    return 'measurement.rigid_collision_class_pair.'+stable_digest(tuple(sorted((first,second))))


def measure_collision_class_bindings(gate, native, model_ref):
    scope = native.scope
    bodies = tuple(sorted(b.body_ref for b in native.bodies))
    mapping = gate.class_by_body
    current = (gate.epoch == scope.epoch and gate.evidence_revision_ref == scope.evidence_revision_ref
        and gate.model_revision_ref == scope.model_revision_ref and gate.model_ref == model_ref)
    missing = []
    if not current:
        missing.append('rigid_rearrangement.current_collision_class_scope')
    if (set(mapping) != set(bodies) or set(gate.membership_evidence_by_body) != set(bodies)
            or any(not isinstance(mapping.get(ref),str) or not mapping.get(ref)
                or not isinstance(gate.membership_evidence_by_body.get(ref),tuple)
                or not gate.membership_evidence_by_body.get(ref) for ref in bodies)):
        missing.append('rigid_rearrangement.current_palette_independent_morphology_membership')
    required = set()
    if not missing:
        class_counts = Counter(mapping[ref] for ref in bodies)
        classes = tuple(sorted(class_counts))
        pair_count = len(classes)*(len(classes)-1)//2 + sum(class_counts[ref]>1 for ref in classes)
        if pair_count > len(gate.rules):
            missing.append('rigid_rearrangement.complete_distinct_collision_class_pair_domain')
        else:
            # One class law covers all its members. Do not hash the same rule
            # again for every object pair of different colours/poses.
            for index, first in enumerate(classes):
                if class_counts[first]>1:
                    required.add(class_pair_ref(first,first))
                required.update(class_pair_ref(first,second) for second in classes[index+1:])
    supplied = tuple(class_pair_ref(row.first_class_ref,row.second_class_ref) for row in gate.rules)
    if len(set(supplied)) != len(supplied) or set(supplied) != required:
        missing.append('rigid_rearrangement.complete_distinct_collision_class_pair_domain')
    rows = []
    for row in gate.rules:
        contact = row.blocking_contact
        pair_matches = (contact is not None and contact.mover_ref != contact.peer_ref
            and contact.mover_ref in mapping and contact.peer_ref in mapping
            and class_pair_ref(mapping[contact.mover_ref],mapping[contact.peer_ref])
                == class_pair_ref(row.first_class_ref,row.second_class_ref))
        if contact is not None and not pair_matches:
            missing.append('rigid_rearrangement.contact_observation_class_binding')
        rows.append(RigidCollisionRuleFactsC(facts=FrozenMap({
            'class_pair_ref':class_pair_ref(row.first_class_ref,row.second_class_ref),
            'evidence_scope_current':current and not missing,
            'contact_pair_matches_declared_classes':pair_matches,
            'free_translation_evidence_count':len(contact.free_translation_evidence_refs) if contact else 0,
            'blocked_translation_evidence_count':len(contact.blocked_translation_evidence_refs) if contact else 0,
            'control_evidence_count':len(contact.control_evidence_refs) if contact else 0,
            'contact_prediction_evidence_count':len(contact.contact_prediction_evidence_refs) if contact else 0,
            'excluded_competing_cause_count':len(contact.excluded_competing_cause_refs) if contact else 0,
            'mover_translation_zero':contact.mover_translation_zero if contact else False,
            'peer_translation_zero':contact.peer_translation_zero if contact else False,
            'command_context_comparable':contact.command_context_comparable if contact else False,
            'outlined_solid_morphology_premise_count':len(row.outlined_solid_morphology_premise_refs),
            'selection_decoration_separated_from_body':row.selection_decoration_separated_from_body,
            'overflight_observed':bool(row.observed_overflight_refs),
            'evidence_refs':row.evidence_refs,'falsifier_ref':row.falsifier_ref})))
    return tuple(dict.fromkeys(missing)),tuple(rows)
