"""Explicit Source-owned mode/evidence contract for the existing native question."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel,Ref


class AdapterModelBindingD(FrozenModel):
    assignment_ref: Ref
    native_path: tuple[str|int,...] = Field(min_length=1,max_length=16)
    model_ref: Ref


class AdapterModeContractD(FrozenModel):
    operation_ref: Ref
    mode_ref: Ref
    evidence_claim_refs: tuple[Ref,...] = Field(min_length=1,max_length=128)
    model_bindings: tuple[AdapterModelBindingD,...] = Field(default=(),max_length=128)
    observed_operand_paths: tuple[tuple[str|int,...],...] = Field(default=(),max_length=256)
    execution_origin_ref: Literal['OUTER_SOURCE','INTERNAL_STEP','INTERNAL_TICK','INTERNAL_CLOSURE']
    return_form_ref: Literal['DESCRIPTIVE_MEASUREMENT','MODEL_ALTERNATIVES',
        'FROZEN_ACTION_DATA','DESCRIPTIVE_COPY','PROPOSED_DELTA','MECHANICAL_RESULT']
    maximum_checks: int = Field(ge=1,le=65536)
