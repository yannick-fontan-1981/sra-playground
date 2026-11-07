"""Source-declared graph/word display partition, not a directed-port model."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .indexed_panel_measurement_d import DPanelLayout


class ProgramNodeLayer(FrozenModel):
    node_ref: Ref
    region_ref: Ref
    evidence_ref: Ref


class ProgramLinkLayer(FrozenModel):
    link_ref: Ref
    region_ref: Ref
    endpoint_node_alternatives: tuple[Ref, ...] = Field(default=(), max_length=128)
    evidence_ref: Ref


class ProgramDisplayLayout(FrozenModel):
    layout_ref: Ref
    evidence_ref: Ref
    panel: DPanelLayout
    nodes: tuple[ProgramNodeLayer, ...] = Field(min_length=1, max_length=4096)
    links: tuple[ProgramLinkLayer, ...] = Field(default=(), max_length=4096)
    marker_region_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    target_region_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    progress_region_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    occluded_region_refs: tuple[Ref, ...] = Field(default=(), max_length=4096)
    word_empty_evidence_ref: Ref | None = None
