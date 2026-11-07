"""Explicit Source scope for the pre-existing metric identity/result protocol."""
from pydantic import Field,model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel,Ref
from .mechanical_family_contracts_a import MechanicalFamilyScope
from .metric_stack_contracts import MetricStackRequest


class MetricFrontierRequestD(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.metric_frontier_request.v1'
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None
    maximum_evaluations: int = Field(ge=1,le=65536)
    calculation_request: MetricStackRequest

    @model_validator(mode='after')
    def exact_declared_metric_scope(self):
        metric=self.calculation_request;identity=metric.identity;scope=self.scope
        if (identity.kernel_ref!='mechanics.metric_stack_image' or identity.operation_ref!=self.operation_ref
                or identity.mode!=self.mode or identity.request_ref!=scope.request_ref or identity.caller_ref!=scope.caller_ref
                or identity.parent_contribution_ref!=scope.parent_contribution_ref or identity.epoch!=scope.epoch
                or identity.input_revision_ref!=scope.evidence_revision_ref or metric.evidence_revision_ref!=scope.evidence_revision_ref
                or identity.immutable_inputs.get('source_parent_goal_ref')!=scope.parent_goal_ref
                or identity.actual_bounds['nodes']>self.maximum_evaluations):
            raise ValueError('metric frontier keeps its exact caller-declared identity, parent and bounds')
        return self
