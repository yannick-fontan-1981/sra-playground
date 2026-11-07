"""Explicit typed ports for the existing K30 frontier acquisition and return."""
from .word_frontier_contracts_c import WordFrontierCalculationC,WordFrontierReturnC,WordFrontierInterpretationC,WordFrontierPublicationJoinC,WordFrontierAgendaInputC,WordFrontierAgendaRequestC,WordFrontierCanonicalInputC
from .word_frontier_c import bind_word_frontier_native,finish_word_frontier_calculation,seal_word_frontier_interpretation,join_word_frontier_publication,bind_word_frontier_agenda,finish_word_frontier_agenda
from .agenda_receipt_contracts_root import AgendaReceiptInputRoot
from .typed_word_transduction import TypedWordRequest
from .word_frontier_c import finish_word_frontier_canonical

WORD_FRONTIER_C_TYPES=('WordFrontierFieldC','WordObservedFacetC','WordFrontierInputC',
    'WordFrontierFactsC','WordFrontierCalculationC','WordFrontierReturnC','WordFrontierInterpretationC',
    'WordFrontierPublicationC','WordFrontierPublicationJoinC','WordFrontierAgendaInputC','WordFrontierAgendaRequestC','WordFrontierCanonicalInputC')
WORD_FRONTIER_C_ENTRIES=(
    ('capability.word_frontier_canonical_c',finish_word_frontier_canonical,WordFrontierCanonicalInputC,WordFrontierReturnC),
    ('capability.word_frontier_native_c',bind_word_frontier_native,WordFrontierCalculationC,TypedWordRequest),
    ('capability.word_frontier_calculation_c',finish_word_frontier_calculation,WordFrontierCalculationC,WordFrontierReturnC),
    ('capability.word_frontier_seal_c',seal_word_frontier_interpretation,WordFrontierInterpretationC,WordFrontierReturnC),
    ('capability.word_frontier_publication_join_c',join_word_frontier_publication,WordFrontierPublicationJoinC,WordFrontierReturnC),
    ('capability.word_frontier_agenda_input_c',bind_word_frontier_agenda,WordFrontierAgendaInputC,WordFrontierAgendaRequestC),
    ('capability.word_frontier_agenda_finish_c',finish_word_frontier_agenda,WordFrontierAgendaInputC,WordFrontierReturnC))

def word_frontier_entries_c(factory):
    return tuple(factory(capability_id=ref,implementation=method,input_model=inputs,output_model=outputs,
        source_file='word_frontier_c.py',applicability=('current_sealed_word_facet',),
        invariants=('current_acquisition','same_native_K30','declared_meaning','parent_why','no_act'),
        falsifiers=('changed_packet','wrong_native_return','unsupported_application_ownership'))
        for ref,method,inputs,outputs in WORD_FRONTIER_C_ENTRIES)

def word_frontier_signatures_c(type_spec,parameter_spec):
    def p(name,kind):return parameter_spec(name=name,type_spec=type_spec(kind))
    return {'capability.word_frontier_canonical_c':((p('returned','WordFrontierReturnC'),p('before_return','Any'),p('after_return','Any'),p('derivation_return','Any')),'WordFrontierReturnC'),
        'capability.word_frontier_native_c':((p('measured','WordFrontierFactsC'),),'TypedWordRequest'),
        'capability.word_frontier_calculation_c':((p('measured','WordFrontierFactsC'),p('returned','Any')),'WordFrontierReturnC'),
        'capability.word_frontier_seal_c':((p('calculated','WordFrontierReturnC'),p('meaning','DeclaredMeaningInstantiation')),'WordFrontierReturnC'),
        'capability.word_frontier_publication_join_c':((p('publication','WordFrontierPublicationC'),p('published','Any')),'WordFrontierReturnC'),
        'capability.word_frontier_agenda_input_c':((p('returned','WordFrontierReturnC'),),'WordFrontierAgendaRequestC'),
        'capability.word_frontier_agenda_finish_c':((p('returned','WordFrontierReturnC'),p('published','Any')),'WordFrontierReturnC')}
