"""Return bounded question-publication scope without action authority."""
from agents.yf_arc3_v5.logos.types import FrozenMap,FrozenModel,Ref
from .device_solving_contracts_c import DeviceStrategyQuestionFactsC


class DeviceStrategyQuestionFinishC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.device_strategy_question_finish_c.v1'
    measured: DeviceStrategyQuestionFactsC


def finish_device_strategy_question(value):
    measured=value.measured;returned=measured.returned
    missing=tuple(sorted(set((*returned.missing_refs,*measured.missing_refs))))
    work=returned.parent_return.get('accounted_evaluations',0)+measured.accounted_evaluations
    parent=FrozenMap({**dict(returned.parent_return),'missing_refs':missing,'accounted_evaluations':work,'execution_authority':False})
    return returned.model_copy(update={'parent_return':parent,'missing_refs':missing})
