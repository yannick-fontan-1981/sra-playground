"""Join a published Source pose to actual pixels; keep its original role status."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from agents.yf_arc3_v5.state.observed_scene_reader import ObservedSceneReadRequest


class RecipePoseCorrespondenceRequestD(FrozenModel):
    scene: ObservedSceneReadRequest
    pose_term_ref: Ref
    pose_claim_ref: Ref
    expected_pose_predicate_ref: Ref
    layer_ref: Ref
    calibration_ref: Ref
    seed_point: tuple[int, int]
    role_field_ref: Ref
    role_support_claim_ref: Ref
    expected_claim_scope: FrozenMap
    expected_source_scope: FrozenMap
    node_bound: int = Field(ge=1, le=100000)
    domain_bound: int = Field(ge=1, le=4096)
    time_bound_ms: int = Field(ge=1, le=300000)


class RecipePoseCorrespondenceFactsD(FrozenModel):
    request: RecipePoseCorrespondenceRequestD
    descriptive_facts: FrozenMap
    missing_refs: tuple[Ref, ...]
    canonical_query_current: bool = False
