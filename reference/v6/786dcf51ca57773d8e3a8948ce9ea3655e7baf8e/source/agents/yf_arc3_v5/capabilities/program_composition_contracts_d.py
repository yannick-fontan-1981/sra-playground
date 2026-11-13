"""Source-declared paths and peer domains for an exact program result join."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .family_result_join import FamilyJoinGroup


class ProgramJoinSupportD(FrozenModel):
    candidate_ref: Ref
    native_row_path: tuple[Ref | int, ...] = Field(min_length=1,max_length=12)
    assignment_paths: FrozenMap = Field(default_factory=FrozenMap)
    resource_paths: FrozenMap = Field(default_factory=FrozenMap)
    evidence_refs: tuple[Ref,...] = Field(min_length=1,max_length=64)


class ProgramCompositionSpecD(FrozenModel):
    request_ref: Ref
    group_ref: Ref
    supports: tuple[ProgramJoinSupportD,...] = Field(min_length=1,max_length=3)
    peer_groups: tuple[FamilyJoinGroup,...] = Field(min_length=1,max_length=2)
    maximum_pairs: int = Field(ge=1,le=65536)
    maximum_candidates: int = Field(default=3,ge=1,le=3)
    rationale_evidence_status_ref: Ref
