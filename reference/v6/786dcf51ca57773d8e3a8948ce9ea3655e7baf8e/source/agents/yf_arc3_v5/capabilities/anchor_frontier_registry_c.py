"""Explicit typed ports for the existing K25 frontier acquisition and return."""
from .anchor_frontier_contracts_c import AnchorFrontierCalculationC,AnchorFrontierReturnC,AnchorFrontierInterpretationC,AnchorFrontierPublicationJoinC,AnchorFrontierAgendaInputC,AnchorFrontierAgendaRequestC
from .anchor_frontier_c import bind_anchor_frontier_native,finish_anchor_frontier_calculation,seal_anchor_frontier_interpretation,join_anchor_frontier_publication,bind_anchor_frontier_agenda,finish_anchor_frontier_agenda
from .agenda_receipt_contracts_root import AgendaReceiptInputRoot
from .inverse_anchor_signature import AnchorRequest

ANCHOR_FRONTIER_C_TYPES=('AnchorFrontierFieldC','AnchorObservedFacetC','AnchorFrontierInputC',
    'AnchorFrontierFactsC','AnchorFrontierCalculationC','AnchorFrontierReturnC','AnchorFrontierInterpretationC',
    'AnchorFrontierPublicationC','AnchorFrontierPublicationJoinC','AnchorFrontierAgendaInputC','AnchorFrontierAgendaRequestC')
ANCHOR_FRONTIER_C_ENTRIES=(
    ('capability.anchor_frontier_native_c',bind_anchor_frontier_native,AnchorFrontierCalculationC,AnchorRequest),
    ('capability.anchor_frontier_calculation_c',finish_anchor_frontier_calculation,AnchorFrontierCalculationC,AnchorFrontierReturnC),
    ('capability.anchor_frontier_seal_c',seal_anchor_frontier_interpretation,AnchorFrontierInterpretationC,AnchorFrontierReturnC),
    ('capability.anchor_frontier_publication_join_c',join_anchor_frontier_publication,AnchorFrontierPublicationJoinC,AnchorFrontierReturnC),
    ('capability.anchor_frontier_agenda_input_c',bind_anchor_frontier_agenda,AnchorFrontierAgendaInputC,AnchorFrontierAgendaRequestC),
    ('capability.anchor_frontier_agenda_finish_c',finish_anchor_frontier_agenda,AnchorFrontierAgendaInputC,AnchorFrontierReturnC))

def anchor_frontier_entries_c(factory):
    return tuple(factory(capability_id=ref,implementation=method,input_model=inputs,output_model=outputs,
        source_file='anchor_frontier_c.py',applicability=('current_sealed_anchor_facet',),
        invariants=('current_acquisition','same_native_K25','declared_meaning','parent_why','no_act'),
        falsifiers=('changed_packet','wrong_native_return','unsupported_application_ownership'))
        for ref,method,inputs,outputs in ANCHOR_FRONTIER_C_ENTRIES)

def anchor_frontier_signatures_c(type_spec,parameter_spec):
    def p(name,kind):return parameter_spec(name=name,type_spec=type_spec(kind))
    return {'capability.anchor_frontier_native_c':((p('measured','AnchorFrontierFactsC'),),'AnchorRequest'),
        'capability.anchor_frontier_calculation_c':((p('measured','AnchorFrontierFactsC'),p('returned','Any')),'AnchorFrontierReturnC'),
        'capability.anchor_frontier_seal_c':((p('calculated','AnchorFrontierReturnC'),p('meaning','DeclaredMeaningInstantiation')),'AnchorFrontierReturnC'),
        'capability.anchor_frontier_publication_join_c':((p('publication','AnchorFrontierPublicationC'),p('published','Any')),'AnchorFrontierReturnC'),
        'capability.anchor_frontier_agenda_input_c':((p('returned','AnchorFrontierReturnC'),),'AnchorFrontierAgendaRequestC'),
        'capability.anchor_frontier_agenda_finish_c':((p('returned','AnchorFrontierReturnC'),p('published','Any')),'AnchorFrontierReturnC')}
