"""Source-declared quantity terminal conjunction and deterministic controls."""
from typing import Literal
from pydantic import Field,model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref


class QuantityTagGoalD(FrozenModel):
    tag_ref: Ref
    compartment_ref: Ref
    quantity_interval: tuple[int,int]
    target_pose: tuple[int,int] | None = None

    @model_validator(mode='after')
    def finite_interval(self):
        if not 0<=self.quantity_interval[0]<=self.quantity_interval[1]:raise ValueError('invalid target quantity interval')
        return self


class QuantityPlanControlD(FrozenModel):
    control_ref: Ref
    kind: Literal['TRANSFER','DOOR']
    operation_ref: Ref
    transported_tag_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    evidence_refs: tuple[Ref,...] = Field(min_length=1,max_length=64)


class QuantityPlanningSpecD(FrozenModel):
    goals: tuple[QuantityTagGoalD,...] = Field(min_length=1,max_length=128)
    controls: tuple[QuantityPlanControlD,...] = Field(min_length=1,max_length=64)
    traversal_order: tuple[Ref,...] = Field(min_length=1,max_length=64)
    preserved_intervals: FrozenMap = Field(default_factory=FrozenMap)
    goal_evidence_refs: tuple[Ref,...] = Field(min_length=1,max_length=64)
    maximum_states: int = Field(default=1024,ge=1,le=4096)
    maximum_depth: int = Field(default=64,ge=1,le=64)

    @model_validator(mode='after')
    def exact_finite_order(self):
        refs=tuple(control.control_ref for control in self.controls)
        if len(refs)!=len(set(refs)) or len(self.traversal_order)!=len(set(self.traversal_order)) or set(refs)!=set(self.traversal_order):
            raise ValueError('Source must declare one complete unique control order')
        if len({goal.tag_ref for goal in self.goals})!=len(self.goals):raise ValueError('tag goals must be unique')
        return self
