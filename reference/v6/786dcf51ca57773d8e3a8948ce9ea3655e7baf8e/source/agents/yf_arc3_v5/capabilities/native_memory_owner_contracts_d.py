"""Canonical native-content acquisition references, not a second memory store."""
from typing import Literal, Any
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .mechanical_family_contracts_d import DMechanicalScope
from .family_effect_publication_contracts import FamilyEffectPublicationRequest, FamilyEffectPublicationResult


class DNativeMemoryContext(FrozenModel):
    scope: DMechanicalScope
    parent_goal_ref: Ref
    context_owner_workflow_ref: Ref
    context_stack_record_ref: Ref
    context_ref: Ref
    context_game_ref: Ref
    context_level_ref: Ref
    context_session_ref: Ref
    maximum_context_frames: int = Field(ge=1, le=256)
    timeline_ref: Ref
    frame_ref: Ref


class DNativeMemoryOwnerRequest(DNativeMemoryContext):
    publication_request: FamilyEffectPublicationRequest
    memory_term_ref: Ref
    memory_claim_ref: Ref
    kind_ref: Literal['RAW_PHOTO', 'REFERENCE_CANDIDATE', 'MODEL_EVIDENCE', 'COUNTEREXAMPLE_EVIDENCE', 'RECOVERY_EVIDENCE']
    content_path: tuple[str | int, ...] = Field(min_length=1, max_length=12)
    dependency_contract_ref: Ref
    dependency_values: FrozenMap


class DNativeMemoryOwnerFacts(FrozenModel):
    request: DNativeMemoryOwnerRequest
    publication: FamilyEffectPublicationResult
    descriptive_facts: FrozenMap
    missing_refs: tuple[Ref, ...]
    dispatch_or_action_authority: None = None


class DNativeMemoryOwnerReturn(FrozenModel):
    request: DNativeMemoryOwnerRequest
    publication: FamilyEffectPublicationResult
    measured: DNativeMemoryOwnerFacts
    source_disposition_ref: Ref
    canonical_memory_current: bool
    dispatch_or_action_authority: None = None


class DNativeMemoryReadRequest(FrozenModel):
    context: DNativeMemoryContext
    memory_term_ref: Ref
    memory_claim_ref: Ref


class DNativeMemoryReadFacts(FrozenModel):
    request: DNativeMemoryReadRequest
    descriptive_facts: FrozenMap
    content: Any = None
    missing_refs: tuple[Ref, ...]
    dispatch_or_action_authority: None = None
