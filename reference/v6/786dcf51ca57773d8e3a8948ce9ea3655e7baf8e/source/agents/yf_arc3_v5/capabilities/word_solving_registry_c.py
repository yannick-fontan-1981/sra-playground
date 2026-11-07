"""Source word strategy ports; existing K30 owns the parser and edit costs."""
from .word_solving_contracts_c import (WordSolvingBindInputC, WordSolvingFinishInputC, WordSolvingReturnC,
    WordJoinInputC, WordJoinFactsC, WordJoinReturnInputC, WordDependencyBindInputC, WordSolvingFactsC)
from .typed_word_transduction import TypedWordRequest
from .word_solving_c import bind_word_solving, finish_word_solving, measure_word_join, get_word_join, return_word_join, bind_word_dependency_return
from .family_result_join import FamilyJoinRequest

WORD_FRONTIER_C_TYPES=('WordObservedSceneC','WordFrontierFieldC','WordObservedFacetC','WordFrontierInputC',
    'WordFrontierFactsC','WordFrontierCalculationC','WordFrontierReturnC','WordFrontierInterpretationC',
    'WordFrontierPublicationC','WordFrontierPublicationJoinC','WordFrontierAgendaInputC','WordFrontierAgendaRequestC','WordFrontierCanonicalInputC')

WORD_SOLVING_C_TYPES = ("WordRelationContractC", "WordSideBindingC", "WordSolvingInputC", "WordEditEvidenceC", "WordDerivationUseC",
    "WordSolvingFactsC", "WordSolvingBindInputC", "WordSolvingFinishInputC", "WordSolvingReturnC",
    "WordJoinSupportC", "WordPreservedUnitC", "WordJoinInputC", "WordJoinFactsC", "WordJoinReturnInputC",
    "WordDependencyBindInputC", "WordDependencyPublicationC", "WordDependencyReturnC",*WORD_FRONTIER_C_TYPES)
WORD_SOLVING_C_ENTRIES = (
    ("capability.word_solving_native_c", bind_word_solving, WordSolvingBindInputC, TypedWordRequest),
    ("capability.word_solving_return_c", finish_word_solving, WordSolvingFinishInputC, WordSolvingReturnC),
    ("capability.word_solving_join_measure_c", measure_word_join, WordJoinInputC, WordJoinFactsC),
    ("capability.word_solving_join_input_c", get_word_join, WordJoinInputC, FamilyJoinRequest),
    ("capability.word_solving_join_return_c", return_word_join, WordJoinReturnInputC, WordSolvingReturnC),
    ("capability.word_dependency_return_c", bind_word_dependency_return, WordDependencyBindInputC, WordSolvingFactsC))

def word_solving_entries_c(entry_factory):
    from .word_frontier_registry_c import word_frontier_entries_c
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file="word_solving_c.py", applicability=("goal_owned_typed_word_relation",),
        invariants=("current_parent", "fixed_word_relation", "shared_edit_units", "same_K30", "all_parses", "no_act"),
        falsifiers=("stale_agenda", "wrong_type_relation", "independent_shared_glyph_edit", "unobserved_inverse"))
        for ref, method, inputs, outputs in WORD_SOLVING_C_ENTRIES)+word_frontier_entries_c(entry_factory)

def word_solving_signatures_c(type_spec, parameter_spec):
    def p(name, model):
        return parameter_spec(name=name, type_spec=type_spec(model))
    from .word_frontier_registry_c import word_frontier_signatures_c
    return {**word_frontier_signatures_c(type_spec,parameter_spec),"capability.word_solving_native_c": ((p("measured", "WordSolvingFactsC"),), "TypedWordRequest"),
        "capability.word_solving_return_c": ((p("measured", "WordSolvingFactsC"),
            p("returned", "Any")), "WordSolvingReturnC"),
        "capability.word_solving_join_measure_c": ((p("returned", "WordSolvingReturnC"),), "WordJoinFactsC"),
        "capability.word_solving_join_input_c": ((p("returned", "WordSolvingReturnC"),), "FamilyJoinRequest"),
        "capability.word_solving_join_return_c": ((p("returned", "WordSolvingReturnC"),
            p("joined", "FamilyJoinResult")), "WordSolvingReturnC"),
        "capability.word_dependency_return_c": ((p("returned", "WordDependencyReturnC"),), "WordSolvingFactsC")}
