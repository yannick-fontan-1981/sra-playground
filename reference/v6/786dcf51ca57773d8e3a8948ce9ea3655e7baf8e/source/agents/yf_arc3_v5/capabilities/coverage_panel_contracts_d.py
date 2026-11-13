"""Source partition and marker signatures for finite configuration displays."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .indexed_panel_measurement_d import DPanelLayout


class CoverageMarkerSamples(FrozenModel):
    marker_ref: Ref
    region_ref: Ref
    evidence_ref: Ref
    native_samples: tuple[tuple[int, int, int], ...] = Field(min_length=1, max_length=4096)


class CoverageCataloguePanelEntry(FrozenModel):
    entry_ref: Ref
    tuple_region_refs: tuple[Ref, ...] = Field(min_length=1, max_length=16)
    evidence_ref: Ref
    active_underline: CoverageMarkerSamples | None = None
    visit_border: CoverageMarkerSamples | None = None


class CoverageControlLegend(FrozenModel):
    control_ref: Ref
    primary_region_ref: Ref
    legend_region_refs: tuple[Ref, ...] = Field(min_length=1, max_length=128)
    evidence_ref: Ref


class CoveragePanelLayout(FrozenModel):
    layout_ref: Ref
    evidence_ref: Ref
    panel: DPanelLayout
    controls: tuple[CoverageControlLegend, ...] = Field(min_length=1, max_length=16)
    entries: tuple[CoverageCataloguePanelEntry, ...] = Field(default=(), max_length=256)
    resource_region_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
