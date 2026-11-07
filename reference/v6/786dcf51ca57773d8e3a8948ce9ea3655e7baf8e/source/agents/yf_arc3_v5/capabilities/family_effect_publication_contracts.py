"""Source-owned publication inputs for any exact native family interpretation."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref
from agents.yf_arc3_v5.capabilities.mechanical_request_contracts import MechanicalRequestIdentity,MechanicalNormalizedReturn


class FamilyEffectPublicationRequest(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.family_effect_publication_request.v1'
    expected_request: MechanicalRequestIdentity
    result: MechanicalNormalizedReturn
    interpretation: FrozenMap
    publication_ref: Ref
    packet_term_ref: Ref
    packet_projection_contract_ref: Ref
    qualification_claim_ref: Ref
    parent_goal_ref: Ref
    scope_ref: Ref
    episode_ref: Ref
    level_scope_ref: Ref
    frame_ref: Ref
    next_item_ref: Ref
    evidence_refs: tuple[Ref,...] = Field(max_length=256)
    affected_dependency_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    sibling_item_refs: tuple[Ref,...] = Field(default=(),max_length=128)


class FamilyEffectPublicationResult(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.family_effect_publication_result.v1'
    request: FamilyEffectPublicationRequest
    source_disposition_ref: Ref
    canonical_payload_equal: bool
    state_revision: int
    missing_refs: tuple[Ref,...]
    parent_goal_unchanged: bool = True
    dispatch_or_action_authority: None = None
