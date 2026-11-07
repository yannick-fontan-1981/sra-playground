"""Source-owned native word projection and bound physical primitive operands."""
from pydantic import Field,model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref
from .macro_expansion_contracts_c import MacroExpansionInputC


class ResourcePrimitiveBindingD(FrozenModel):
    token_ref: Ref
    primitive_ref: Ref
    action_ref: Ref
    payload: FrozenMap
    support_claim_refs: tuple[Ref,...] = Field(min_length=1,max_length=16)
    requires_observation_before: bool


class ResourcePrefixSpecD(FrozenModel):
    native_candidate_ref: Ref
    native_word_path: tuple[Ref|int,...] = Field(min_length=1,max_length=12)
    native_final_path: tuple[Ref|int,...] = Field(min_length=1,max_length=12)
    native_initial_path: tuple[Ref|int,...] = Field(min_length=1,max_length=12)
    observed_current_initial_path: tuple[Ref|int,...] = Field(default=(),max_length=12)
    token_field_ref: Ref | None = None
    primitive_bindings: tuple[ResourcePrimitiveBindingD,...] = Field(default=(),max_length=128)
    macro_expansion: MacroExpansionInputC | None = None
    maximum_primitives: int = Field(ge=1,le=1024)
    maximum_evaluations: int = Field(ge=1,le=65536)
    @model_validator(mode='after')
    def exact_projection(self):
        if len({row.token_ref for row in self.primitive_bindings})!=len(self.primitive_bindings):
            raise ValueError('one declared primitive payload binding per token')
        if self.macro_expansion is not None and self.primitive_bindings:
            raise ValueError('native primitive bindings and certified macro expansion are distinct')
