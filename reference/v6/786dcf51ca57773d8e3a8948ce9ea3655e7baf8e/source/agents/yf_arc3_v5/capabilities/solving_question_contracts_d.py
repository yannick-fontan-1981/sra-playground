"""One explicitly tagged goal-owned question through the existing native frontier."""
from typing import Literal
from pydantic import Field,model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref
from .effect_frontier_contracts_c import EffectFrontierInputC,EffectFrontierReturnC
from .solving_state_contracts_d import SolvingStateInputD
from .family_agenda_projection import FamilyAgendaReceipt
from .family_return_collector_contracts_d import FamilyCollectionPlanD,FamilyCollectorReturnD
from .terminal_scope_contracts_d import TerminalScopeInputD
from .adapter_mode_contracts_d import AdapterModeContractD
from .restoration_ledger_contracts_d import RestorationLedgerInputD,RestorationLedgerReturnD
from .goal_derivation_contracts_d import GoalDerivationInputD,GoalDerivationReturnD,OperationalConsciousnessMeansEvaluation


class SolvingQuestionInputD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.solving_question_input_d.v1'
    frontier: EffectFrontierInputC
    requested_operation_ref: Ref
    requested_mode_ref: Ref
    calculation_class: Literal['DESCRIPTIVE','CONDITIONAL','DETERMINISTIC']
    source_question_need_claim_ref: Ref | None = None
    model_evidence_claim_refs: tuple[Ref,...] = Field(default=(),max_length=64)
    required_operation_request_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    state_closure: SolvingStateInputD | None = None
    collection_plan: FamilyCollectionPlanD | None = None
    terminal_scope: TerminalScopeInputD | None = None
    adapter_mode: AdapterModeContractD | None = None
    restoration_review: RestorationLedgerInputD | None = None
    goal_review: GoalDerivationInputD | None = None


class SolvingQuestionFactsD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.solving_question_facts_d.v1'
    request: SolvingQuestionInputD
    facts: FrozenMap
    missing_refs: tuple[Ref,...]
    equivalent_receipt: FamilyAgendaReceipt | None = None


class SolvingQuestionReturnD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.solving_question_return_d.v1'
    contribution_consumption_ref: Ref | None = None
    request: SolvingQuestionInputD
    returned: EffectFrontierReturnC | None = None
    equivalent_receipt: FamilyAgendaReceipt | None = None
    missing_refs: tuple[Ref,...]
    collection: FamilyCollectorReturnD | None = None
    restoration: RestorationLedgerReturnD | None = None
    goal_review: GoalDerivationReturnD | None = None
    pending_means_evaluations: tuple[OperationalConsciousnessMeansEvaluation,...] = ()
    next_item_ref: Ref
    source_disposition_ref: Ref
    action_authority: None = None

    @model_validator(mode='after')
    def preserve_pending_means_questions(self):
        expected=tuple(item for item in self.goal_review.prospective_means_evaluations
            if item.requires_application_evidence) if self.goal_review is not None else ()
        if (self.pending_means_evaluations!=expected
                or any(item.question_ref not in self.missing_refs for item in expected)):
            raise ValueError('conscious means questions disappeared between goal review and parent return')
        return self
