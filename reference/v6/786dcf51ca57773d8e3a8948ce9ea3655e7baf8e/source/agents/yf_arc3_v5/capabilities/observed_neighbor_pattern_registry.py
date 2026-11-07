"""Typed measured-pair ingress; existing neighborhood calculation and motor."""
from .observed_neighbor_pattern_bridge import (ObservedNeighborProposal, ObservedNeighborMeasurementInput,
    ObservedNeighborBindingInput, ObservedNeighborReturnInput,measure_observed_neighbor_proposal,
    bind_observed_neighbor_request,append_observed_neighbor_options)
from .contracts import InteractionProbeAgenda
from .neighborhood_pattern_construction import NeighborhoodPatternRequest

OBSERVED_NEIGHBOR_MODELS=(ObservedNeighborProposal,ObservedNeighborMeasurementInput,
    ObservedNeighborBindingInput,ObservedNeighborReturnInput)
OBSERVED_NEIGHBOR_TYPES=tuple(t.__name__ for t in OBSERVED_NEIGHBOR_MODELS)

def observed_neighbor_entries(factory):
    rows=(('capability.observed_neighbor_proposal',measure_observed_neighbor_proposal,ObservedNeighborMeasurementInput,ObservedNeighborProposal),
        ('capability.observed_neighbor_request',bind_observed_neighbor_request,ObservedNeighborBindingInput,NeighborhoodPatternRequest),
        ('capability.observed_neighbor_options',append_observed_neighbor_options,ObservedNeighborReturnInput,InteractionProbeAgenda))
    return tuple(factory(capability_id=ref,implementation=method,input_model=before,output_model=after,
        source_file='observed_neighbor_pattern_bridge.py',
        applicability=('current_revalidated_partial_neighbor_table_and_complete_reference',),
        invariants=('source_admits_revisable_model','existing_layout_and_bfs_services',
            'no_fabricated_resource','independent_why_and_action_permits'),
        falsifiers=('reference_or_epoch_changed','sample_contradicted_or_unknown','incomplete_geometry_or_layout'))
        for ref,method,before,after in rows)

def observed_neighbor_signatures(type_spec,parameter_spec):
    def p(name,kind):return parameter_spec(name=name,type_spec=type_spec(kind))
    binding=(p('proposal','ObservedNeighborProposal'),p('source_disposition_ref','Ref'),p('source_alternative_facts','Any'))
    return {'capability.observed_neighbor_proposal':((p('world','InteractionProbeInput'),p('agenda','InteractionProbeAgenda')),'ObservedNeighborProposal'),
        'capability.observed_neighbor_request':(binding,'NeighborhoodPatternRequest'),
        'capability.observed_neighbor_options':((*binding,p('result','DMechanicalResult')),'InteractionProbeAgenda')}
