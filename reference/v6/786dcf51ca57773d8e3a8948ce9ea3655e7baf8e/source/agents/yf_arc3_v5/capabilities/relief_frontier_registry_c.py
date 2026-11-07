"""Explicit typed ports for the existing K21 frontier acquisition and return."""
from .relief_frontier_contracts_c import ReliefFrontierCalculationC,ReliefFrontierReturnC,ReliefFrontierInterpretationC,ReliefFrontierPublicationJoinC,ReliefFrontierAgendaInputC,ReliefFrontierAgendaRequestC
from .relief_frontier_c import bind_relief_frontier_native,finish_relief_frontier_calculation,seal_relief_frontier_interpretation,join_relief_frontier_publication,bind_relief_frontier_agenda,finish_relief_frontier_agenda
from .agenda_receipt_contracts_root import AgendaReceiptInputRoot
from .ordered_relief_writing import ReliefRequest

RELIEF_FRONTIER_C_TYPES=('ReliefFrontierFieldC','ReliefObservedFacetC','ReliefFrontierInputC',
    'ReliefFrontierFactsC','ReliefFrontierCalculationC','ReliefFrontierReturnC','ReliefFrontierInterpretationC',
    'ReliefFrontierPublicationC','ReliefFrontierPublicationJoinC','ReliefFrontierAgendaInputC','ReliefFrontierAgendaRequestC')
RELIEF_FRONTIER_C_ENTRIES=(
    ('capability.relief_frontier_native_c',bind_relief_frontier_native,ReliefFrontierCalculationC,ReliefRequest),
    ('capability.relief_frontier_calculation_c',finish_relief_frontier_calculation,ReliefFrontierCalculationC,ReliefFrontierReturnC),
    ('capability.relief_frontier_seal_c',seal_relief_frontier_interpretation,ReliefFrontierInterpretationC,ReliefFrontierReturnC),
    ('capability.relief_frontier_publication_join_c',join_relief_frontier_publication,ReliefFrontierPublicationJoinC,ReliefFrontierReturnC),
    ('capability.relief_frontier_agenda_input_c',bind_relief_frontier_agenda,ReliefFrontierAgendaInputC,ReliefFrontierAgendaRequestC),
    ('capability.relief_frontier_agenda_finish_c',finish_relief_frontier_agenda,ReliefFrontierAgendaInputC,ReliefFrontierReturnC))

def relief_frontier_entries_c(factory):
    return tuple(factory(capability_id=ref,implementation=method,input_model=inputs,output_model=outputs,
        source_file='relief_frontier_c.py',applicability=('current_sealed_relief_facet',),
        invariants=('current_acquisition','same_native_K21','declared_meaning','parent_why','no_act'),
        falsifiers=('changed_packet','wrong_native_return','unsupported_application_ownership'))
        for ref,method,inputs,outputs in RELIEF_FRONTIER_C_ENTRIES)

def relief_frontier_signatures_c(type_spec,parameter_spec):
    def p(name,kind):return parameter_spec(name=name,type_spec=type_spec(kind))
    return {'capability.relief_frontier_native_c':((p('measured','ReliefFrontierFactsC'),),'ReliefRequest'),
        'capability.relief_frontier_calculation_c':((p('measured','ReliefFrontierFactsC'),p('returned','Any')),'ReliefFrontierReturnC'),
        'capability.relief_frontier_seal_c':((p('calculated','ReliefFrontierReturnC'),p('meaning','DeclaredMeaningInstantiation')),'ReliefFrontierReturnC'),
        'capability.relief_frontier_publication_join_c':((p('publication','ReliefFrontierPublicationC'),p('published','Any')),'ReliefFrontierReturnC'),
        'capability.relief_frontier_agenda_input_c':((p('returned','ReliefFrontierReturnC'),),'ReliefFrontierAgendaRequestC'),
        'capability.relief_frontier_agenda_finish_c':((p('returned','ReliefFrontierReturnC'),p('published','Any')),'ReliefFrontierReturnC')}
