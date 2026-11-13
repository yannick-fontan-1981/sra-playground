"""Explicit calibrated display and ordered integer-resource observations."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref


class ResourceIntervalModelD(FrozenModel):
    model_ref: Ref
    evidence_scope_ref: Ref
    calibration_evidence_refs: tuple[Ref,...] = Field(min_length=1,max_length=64)
    capacity: int = Field(ge=1,le=65536)
    render_extent: int = Field(ge=1,le=4096)
    display_measure_ref: Literal['WIDTH','AREA','SEGMENTS']
    display_multiplier: int = Field(ge=1,le=4096)
    rounding_ref: Literal['FLOOR','CEIL','NEAREST_EVEN']
    quantity_minimum: int = Field(ge=0,le=65536)
    quantity_maximum: int = Field(ge=0,le=65536)
    transition_ref: Literal['EXACT_DELTA','CLAMP_ZERO','CLAMP_ZERO_AND_CAPACITY']


class ResourceIntervalSampleD(FrozenModel):
    sample_ref: Ref
    evidence_scope_ref: Ref
    transition_evidence_ref: Ref
    observed_display: int = Field(ge=0,le=16777216)
    gross_input_count: int = Field(ge=0,le=65536)
    internal_event_count: int = Field(ge=0,le=65536)
    known_gross_debit: int = Field(ge=0,le=65536)
    known_receipt_credit: int = Field(ge=0,le=65536)
    transition_order_ref: Literal['DEBIT_THEN_CREDIT','CREDIT_THEN_DEBIT']


class ResourceIntervalLedgerD(FrozenModel):
    evidence_scope_ref: Ref
    models: tuple[ResourceIntervalModelD,...] = Field(min_length=1,max_length=6)
    samples: tuple[ResourceIntervalSampleD,...] = Field(min_length=1,max_length=128)
    maximum_evaluations: int = Field(ge=1,le=65536)


class ResourceIntervalInputD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.resource_interval_input_d.v1'
    ledger: ResourceIntervalLedgerD
    expected_scope_ref: Ref
    observed_current_display: int = Field(ge=0,le=16777216)


class ResourceIntervalResultD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.resource_interval_result_d.v1'
    request: ResourceIntervalInputD
    rows: tuple[FrozenMap,...]
    missing_refs: tuple[Ref,...]
    accounted_evaluations: int
    action_authority: None = None
