"""Explicit Source owner join for an acquired canonical field; no role licence."""
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from agents.yf_arc3_v5.state.observed_scene_reader import ObservedInputReadRequest
from agents.yf_arc3_v5.state.observed_canonical_field_reader_b import ObservedCanonicalFieldBindingB, ObservedCanonicalFieldScopeB


class ObservedFieldOwnerScopeProofD(FrozenModel):
    claim_ref: Ref
    predicate_ref: Ref
    agenda_ref: Ref
    agenda_claim_ref: Ref
    consumer_ref: Ref
    parent_request_ref: Ref


class ObservedFieldOwnerRequestD(FrozenModel):
    observation: ObservedInputReadRequest
    binding: ObservedCanonicalFieldBindingB
    scope: ObservedCanonicalFieldScopeB
    proof: ObservedFieldOwnerScopeProofD
    expected_claim_scope: FrozenMap


class ObservedFieldOwnerFactsD(FrozenModel):
    request: ObservedFieldOwnerRequestD
    descriptive_facts: FrozenMap
    missing_refs: tuple[Ref, ...]
    canonical_owner_proof_current: bool = False
