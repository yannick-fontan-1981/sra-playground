"""Current Source-named native word and certified primitive-prefix transport."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref
from .frontier_composition_contracts_d import FrontierCompositionReturnD
from .resource_prefix_contracts_d import ResourcePrefixSpecD
from .macro_expansion_contracts_c import MacroExpansionReturnC
from .articulated_solving_contracts_c import ArticulatedAcquiredFieldC
from .resource_prefix_contracts_d import ResourcePrimitiveBindingD


class FrontierPrimitiveAcquisitionD(FrozenModel):
    operand: ResourcePrimitiveBindingD
    acquired_field: ArticulatedAcquiredFieldC
    value_path: tuple[str|int,...] = Field(default=(),max_length=16)


class FrontierPrefixInputD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.frontier_prefix_input_d.v1'
    composition: FrontierCompositionReturnD
    spec: ResourcePrefixSpecD
    native_row_path: tuple[str|int,...] = Field(min_length=1,max_length=16)
    operand_acquisitions: tuple[FrontierPrimitiveAcquisitionD,...] = Field(default=(),max_length=128)


class FrontierPrefixFactsD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.frontier_prefix_facts_d.v1'
    request: FrontierPrefixInputD
    facts: FrozenMap


class FrontierPrefixCompileInputD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.frontier_prefix_compile_input_d.v1'
    measured: FrontierPrefixFactsD
    macro_return: MacroExpansionReturnC | None = None


class FrontierPrefixReturnD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.frontier_prefix_return_d.v1'
    request: FrontierPrefixInputD
    fields: FrozenMap
    source_disposition_ref: Ref
    action_authority: None = None
