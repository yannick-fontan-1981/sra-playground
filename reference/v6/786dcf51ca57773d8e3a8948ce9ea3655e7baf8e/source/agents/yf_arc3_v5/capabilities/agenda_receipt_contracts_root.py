"""Exact computational-return publication; no physical or action authority."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .family_agenda_projection import FamilyAgendaSnapshot, FamilyAgendaReceipt
from .recipe_frontier_contracts_root import RecipeFrontierParentInputRoot, RecipeFrontierReturnRoot
from .recipe_solving_contracts_root import RecipeSolvingInputRoot


class AgendaReceiptInputRoot(FrozenModel):
    agenda: FamilyAgendaSnapshot
    receipt: FamilyAgendaReceipt
    consumer_ref: Ref
    source_return_claim_ref: Ref
    source_return_predicate_ref: Ref
    receipt_claim_ref: Ref
    evidence_refs: tuple[Ref, ...] = Field(min_length=1, max_length=64)
    invalidated_dependency_refs: tuple[Ref, ...] = Field(default=(),max_length=128)


class RecipeAgendaReturnInputRoot(FrozenModel):
    parent_request: RecipeFrontierParentInputRoot
    bound_parent: RecipeSolvingInputRoot
    frontier_return: RecipeFrontierReturnRoot
    receipt_ref: Ref
    receipt_claim_ref: Ref
    source_return_claim_ref: Ref
