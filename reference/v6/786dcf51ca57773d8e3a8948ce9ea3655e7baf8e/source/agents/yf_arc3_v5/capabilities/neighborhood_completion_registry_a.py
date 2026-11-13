"""Exact Source bridge entries for the three remaining K78 operations."""
from .neighborhood_pattern_construction import NeighborhoodPatternRequest
from .neighborhood_search_contracts_c import NeighborhoodSearchInputC
from .mechanical_family_contracts_d import DMechanicalResult
from .neighborhood_transport_a import (NeighborhoodTransportBindingA,NeighborhoodTransportExtractA,NeighborhoodTransportReturnA,
    prepare_neighborhood_transport_a,extract_neighborhood_transport_a,unavailable_neighborhood_transport_a,return_neighborhood_transport_a)

K78_A_ENTRIES=(
 ('capability.neighborhood_transport_prepare_a',prepare_neighborhood_transport_a,NeighborhoodPatternRequest,NeighborhoodTransportBindingA),
 ('capability.neighborhood_transport_extract_a',extract_neighborhood_transport_a,NeighborhoodTransportExtractA,NeighborhoodSearchInputC),
 ('capability.neighborhood_transport_unavailable_a',unavailable_neighborhood_transport_a,NeighborhoodTransportExtractA,DMechanicalResult),
 ('capability.neighborhood_transport_return_a',return_neighborhood_transport_a,NeighborhoodTransportReturnA,DMechanicalResult),)
K78_A_TYPES=('NeighborhoodTransportBindingA','NeighborhoodTransportExtractA','NeighborhoodTransportReturnA')

def neighborhood_completion_entries_a(entry_factory):
 return tuple(entry_factory(capability_id=ref,implementation=fn,input_model=before,output_model=after,source_file='neighborhood_transport_a.py',
  applicability=('source_exact_k78_search_binding',),invariants=('one_existing_k09','no_native_search_or_action_release','scope_source_goal_bounds_and_revision_equality'),
  falsifiers=('mismatched_provider_or_source','contradictory_retained_step','unbound_parent_goal')) for ref,fn,before,after in K78_A_ENTRIES)

def neighborhood_completion_signatures_a(type_spec,parameter_spec):
 def p(name,kind):return parameter_spec(name=name,type_spec=type_spec(kind))
 return {
  'capability.neighborhood_transport_prepare_a':((p('request','NeighborhoodPatternRequest'),),'NeighborhoodTransportBindingA'),
  'capability.neighborhood_transport_extract_a':((p('binding','NeighborhoodTransportBindingA'),),'NeighborhoodSearchInputC'),
  'capability.neighborhood_transport_unavailable_a':((p('binding','NeighborhoodTransportBindingA'),),'DMechanicalResult'),
  'capability.neighborhood_transport_return_a':((p('binding','NeighborhoodTransportBindingA'),p('returned','MechanicalNormalizedReturn')),'DMechanicalResult')}
