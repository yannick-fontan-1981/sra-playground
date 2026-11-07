"""Source-selected K63 schedules use the existing K09 return, never a second search."""
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .metric_stack_contracts import MetricStackRequest
from .mechanical_request_contracts import MechanicalNormalizedReturn


class MetricScheduleAssemblyInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.metric_schedule_assembly_input_c.v1"
    request: MetricStackRequest
    search_return: MechanicalNormalizedReturn
