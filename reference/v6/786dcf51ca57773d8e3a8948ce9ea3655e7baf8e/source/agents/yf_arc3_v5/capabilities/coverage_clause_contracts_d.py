"""Source-declared coverage relation, quantified occurrences and transform group."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel,Ref


class CoverageInventoryD(FrozenModel):
    inventory_path: tuple[str|int,...] = Field(min_length=1,max_length=16)
    occurrence_ref_path: tuple[str|int,...] = Field(min_length=1,max_length=16)
    support_path: tuple[str|int,...] = Field(min_length=1,max_length=16)
    required_occurrence_refs: tuple[Ref,...] = Field(min_length=1,max_length=4096)
    orbit_application_ref: Literal['ACTUAL_SUPPORT_ONLY','SUPPORTED_LOGICAL_ORBIT_IMAGES']


class CoverageAffineD(FrozenModel):
    transform_ref: Ref
    matrix: tuple[int,int,int,int]
    offset: tuple[int,int]


class CoverageTransformGroupD(FrozenModel):
    model_ref: Ref
    support_claim_ref: Ref
    support_predicate_ref: Ref
    transform_scope_field_ref: Ref
    transforms: tuple[CoverageAffineD,...] = Field(min_length=1,max_length=64)


class CoverageClauseD(FrozenModel):
    relation_ref: Literal['ONE_WAY_COVER','PERMITTED_EXCESS','STRICT_ALL_PIECE_PARTITION']
    multiplicity_ref: Literal['CELL_SET','LOGICAL_COUNTS']
    source: CoverageInventoryD
    target: CoverageInventoryD
    permitted_excess_path: tuple[str|int,...] | None = Field(default=None,max_length=16)
    transform_group: CoverageTransformGroupD | None = None
