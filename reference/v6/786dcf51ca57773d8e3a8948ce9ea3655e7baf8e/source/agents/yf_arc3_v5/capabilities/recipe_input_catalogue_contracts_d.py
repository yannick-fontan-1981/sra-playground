"""Source-requested spatial catalogue, not an input-role or active-slot law."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from agents.yf_arc3_v5.state.observed_scene_reader import ObservedSceneReadRequest


class RecipeInputCellQueryD(FrozenModel):
    slot_ref: Ref
    cell_index: tuple[int, int]


class RecipeInputCatalogueRequestD(FrozenModel):
    scene: ObservedSceneReadRequest
    layer_ref: Ref
    calibration_ref: Ref
    input_lattice_ref: Ref
    catalogue_term_ref: Ref
    catalogue_support_claim_ref: Ref
    expected_claim_scope: FrozenMap
    cells: tuple[RecipeInputCellQueryD, ...] = Field(min_length=1, max_length=64)
    node_bound: int = Field(ge=1, le=1000000)
    domain_bound: int = Field(ge=1, le=4096)
    time_bound_ms: int = Field(ge=1, le=60000)


class RecipeInputCatalogueFactsD(FrozenModel):
    request: RecipeInputCatalogueRequestD
    descriptive_facts: FrozenMap
    evidence_refs: tuple[Ref, ...]
    missing_refs: tuple[Ref, ...]
    canonical_catalogue_current: bool = False
