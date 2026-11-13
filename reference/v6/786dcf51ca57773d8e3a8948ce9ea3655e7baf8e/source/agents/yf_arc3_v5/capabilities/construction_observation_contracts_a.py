"""Source-declared construction layers; fill/markers are separate questions."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .contracts import FrameGrid
from .scene_layer_measurement_d import DSceneCalibration, DSceneLayerQuestion, DSceneOcclusion


class ConstructionSceneFacetA(FrozenModel):
    facet_ref: Ref
    layer_ref: Ref
    kind_ref: Literal['BEAM_FILL', 'SUPPORT_SLOT', 'FIXED_PAD', 'BLOCKER', 'TARGET', 'STOCK', 'CONTROL', 'RESULTANT_MARKER', 'TIPPING_MARKER']
    evidence_ref: Ref
    measured_quantity_ref: Ref | None = None
    quantity_calibration_evidence_ref: Ref | None = None


class ConstructionSceneInputA(FrozenModel):
    frame: FrameGrid
    calibrations: tuple[DSceneCalibration, ...] = Field(min_length=1, max_length=32)
    questions: tuple[DSceneLayerQuestion, ...] = Field(min_length=1, max_length=128)
    occlusions: tuple[DSceneOcclusion, ...] = Field(default=(), max_length=128)
    facets: tuple[ConstructionSceneFacetA, ...] = Field(min_length=1, max_length=128)
    missing_support_refs: tuple[Ref, ...]
