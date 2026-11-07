"""Source-bound layout, schedule and focus input slices for the existing K79."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref


class PrefixLayoutElementC(FrozenModel):
    element_ref: Ref
    kind_ref: Literal["LOOM_CELL", "GUTTER", "THREAD_STUB", "PALETTE_BUTTON", "END_INDICATOR", "PROGRESS", "MINIATURE", "NEXT_INSERTION_CURSOR"]
    pixels: tuple[tuple[int, int], ...] = Field(min_length=1, max_length=4096)
    scale: tuple[int, int]
    origin: tuple[int, int]
    pitch: tuple[int, int] | None
    thread_ref: Ref | None
    role_evidence_refs: tuple[Ref, ...]
    evidence_revision_ref: Ref
    next_crossing_index: int | None = Field(default=None, ge=0)


class PrefixScheduleThreadC(FrozenModel):
    thread_ref: Ref
    final_color: int = Field(ge=0, le=255)
    required_layers: tuple[int, ...] = Field(max_length=128)
    preparation_evidence_refs: tuple[Ref, ...]


class PrefixFocusQuestionC(FrozenModel):
    question_ref: Ref
    kind_ref: Literal["LAYER_FEASIBILITY", "COLOR_AMBIGUITY", "CONTROL_ACCESS", "COVERAGE", "OBSERVATION"]
    thread_refs: tuple[Ref, ...]
    crossing_refs: tuple[tuple[int, int], ...]
    evidence_refs: tuple[Ref, ...]
    restoration_debt_refs: tuple[Ref, ...]
    action_ref: Ref | None
    before_values: FrozenMap
    after_values: FrozenMap


class PrefixQueryCheckpointC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.prefix_query_checkpoint_c.v1"
    context_digest: str
    model_index: int = Field(ge=0)
    stage: Ref
    item_index: int = Field(ge=0)
    candidate_index: int = Field(ge=0)
    state: FrozenMap
    rows: tuple[FrozenMap, ...]
    algorithm_state: FrozenMap
    examined_count: int = Field(ge=0)


# Native request is imported by the bridge contract to avoid a cycle.
