"""Source-declared objective order and finite exact scalar/lexicographic costs."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref


class SearchCostComponentD(FrozenModel):
    component_ref: Ref
    maximum_per_primitive: int = Field(ge=0,le=65536)
    maximum_path_total: int = Field(ge=0,le=65536)


class SearchObjectiveSpecD(FrozenModel):
    objective_ref: Ref
    cost_metric_ref: Ref
    components: tuple[SearchCostComponentD,...] = Field(min_length=1,max_length=16)
    packet_cost_vectors: FrozenMap
    evidence_refs: tuple[Ref,...] = Field(min_length=1,max_length=128)


class SearchObjectiveFactsD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.search_objective_facts_d.v1'
    facts: FrozenMap
    missing_refs: tuple[Ref,...]
    scalar_multipliers: tuple[int,...]
