"""Exact accounting of Source-returned work, not a receipt of semantic success."""
from typing import Literal
from pydantic import Field, model_validator
from .types import FrozenModel, Ref, stable_digest


class OperationalConsciousnessPropagationAttempt(FrozenModel):
    phase_ref: Literal['understanding_observation', 'understanding_review',
        'native_nomination', 'goal_watch', 'dependency_reevaluation']
    returned_digest: Ref


class OperationalConsciousnessPropagationBudget(FrozenModel):
    maximum_work_items: int = Field(ge=1, le=65536)
    used_work_items: int = Field(ge=0)
    remaining_work_items: int = Field(ge=0)
    exhausted: bool
    has_capacity: bool
    attempts: tuple[OperationalConsciousnessPropagationAttempt, ...] = Field(max_length=65536)
    grants_action: Literal[False] = False

    @model_validator(mode='after')
    def exact_accounting(self):
        if (self.used_work_items != len(self.attempts)
                or self.used_work_items > self.maximum_work_items
                or self.remaining_work_items != self.maximum_work_items - self.used_work_items
                or self.exhausted != (self.remaining_work_items == 0)
                or self.has_capacity != (self.remaining_work_items > 0)):
            raise ValueError('operational propagation budget differs from its returned work count')
        return self

    @classmethod
    def start(cls, maximum):
        if isinstance(maximum, bool) or not isinstance(maximum, int):
            raise ValueError('operational propagation needs an integer work bound')
        return cls(maximum_work_items=maximum, used_work_items=0,
            remaining_work_items=maximum, exhausted=False, has_capacity=True, attempts=())

    def after_return(self, phase_ref, returned):
        if self.exhausted:
            raise ValueError('operational propagation exceeded its declared work bound')
        attempts = (*self.attempts, OperationalConsciousnessPropagationAttempt(
            phase_ref=phase_ref, returned_digest=stable_digest(returned)))
        remaining = self.maximum_work_items - len(attempts)
        return self.__class__(maximum_work_items=self.maximum_work_items,
            used_work_items=len(attempts), remaining_work_items=remaining,
            exhausted=remaining == 0, has_capacity=remaining > 0, attempts=attempts)
