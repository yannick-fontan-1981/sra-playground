"""Bounded prerequisite agenda; Source/DRM selects the next exact question."""
from pydantic import Field, model_validator
from typing import Literal
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref
from .solving_question_contracts_d import SolvingQuestionInputD,SolvingQuestionReturnD


class PrerequisiteAgendaInputD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.prerequisite_agenda_input_d.v1'
    questions: tuple[SolvingQuestionInputD,...] = Field(min_length=1,max_length=128)
    requested_work_order: tuple[Ref,...] = Field(min_length=1,max_length=128)
    root_request_ref: Ref
    declaration_basis: Literal['parent_desired_future', 'canonical_measurement_needs'] = 'parent_desired_future'
    validated_continuation_request_ref: Ref | None = None
    maximum_graph_visits: int = Field(default=65536,ge=1,le=65536)


class PrerequisiteAgendaFactsD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.prerequisite_agenda_facts_d.v1'
    request: PrerequisiteAgendaInputD
    facts: FrozenMap
    rows: tuple[FrozenMap,...]
    missing_refs: tuple[Ref,...]


class PrerequisiteAgendaReturnD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.prerequisite_agenda_return_d.v1'
    measured: PrerequisiteAgendaFactsD
    answered: SolvingQuestionReturnD | None = None
    source_request_ref: Ref | None = None
    source_disposition_ref: Ref
    current_request: PrerequisiteAgendaInputD | None = None
    answers: tuple[SolvingQuestionReturnD,...] = Field(default=(),max_length=128)
    refresh_missing_refs: tuple[Ref,...] = ()
    cycle_end_ref: Ref | None = None
    action_authority: None = None


class PrerequisiteAgendaCycleD(FrozenModel):
    """Finite Source iteration state; an answer is not a world-goal achievement."""
    request: PrerequisiteAgendaInputD
    visited_request_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    answers: tuple[SolvingQuestionReturnD,...] = Field(default=(),max_length=128)
    missing_refs: tuple[Ref,...] = ()
    refresh_current: bool = True
    root_answer_returned: bool = False
    has_unvisited: bool = True

    @model_validator(mode='after')
    def exact_iteration_history(self):
        refs = self.visited_request_refs
        if (len(set(refs)) != len(refs) or not set(refs) <= set(self.request.requested_work_order)
                or len(refs) != len(self.answers)
                or any(answer.request.frontier.demand.request.request_ref != ref for ref, answer in zip(refs, self.answers))
                or self.has_unvisited != (len(refs) < len(self.request.requested_work_order))
                or self.root_answer_returned != bool(refs and refs[-1] == self.request.root_request_ref)
                or self.refresh_current != (not self.missing_refs)):
            raise ValueError('prerequisite cycle changed its finite question history or refresh evidence')
        return self
