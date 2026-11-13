"""Source-bound capacity cause and conditional episode-possession retention."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel,Ref


class NavigationStorageNeedD(FrozenModel):
    parent_goal_ref: Ref
    consumer_ref: Ref
    missing_capacity_claim_ref: Ref
    blocked_acquisition_key_refs: tuple[Ref,...] = Field(min_length=1,max_length=64)
    required_free_slots: int = Field(ge=1,le=64)


class NavigationOwnershipClaimD(FrozenModel):
    key_ref: Ref
    claim_ref: Ref


class NavigationMaskRetentionD(FrozenModel):
    parent_goal_ref: Ref
    parent_contribution_ref: Ref
    event_owner_ref: Ref
    epoch: int = Field(ge=0)
    evidence_revision_ref: Ref
    level_scope_ref: Ref
    restore_epoch: int = Field(ge=0)
    retention_law_claim_ref: Ref
    previous_held_claims: tuple[NavigationOwnershipClaimD,...] = Field(max_length=64)
    current_ownership_claims: tuple[NavigationOwnershipClaimD,...] = Field(default=(),max_length=128)
    inventory_order_claim_ref: Ref
    logical_inventory_order: tuple[Ref,...] = Field(max_length=64)
