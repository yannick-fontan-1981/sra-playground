"""Source bridge for K73; K09 executes only from its declared workflow."""
from .discrete_relay_optics import DiscreteOpticsRequest
from .mechanical_common_contracts_c import SearchDomainInputC
from .mechanical_family_contracts_d import DMechanicalResult
from .optical_route_a import (
    OpticalRouteBindingA, OpticalRouteExtractA, OpticalRouteReturnA,
    prepare_optical_route_a, extract_optical_route_a, unavailable_optical_route_a, return_optical_route_a,
)

K73_A_ENTRIES = (
    ('capability.optical_route_prepare_a', prepare_optical_route_a, DiscreteOpticsRequest, OpticalRouteBindingA),
    ('capability.optical_route_extract_a', extract_optical_route_a, OpticalRouteExtractA, SearchDomainInputC),
    ('capability.optical_route_unavailable_a', unavailable_optical_route_a, OpticalRouteExtractA, DMechanicalResult),
    ('capability.optical_route_return_a', return_optical_route_a, OpticalRouteReturnA, DMechanicalResult),
)


def optical_route_entries_a(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=fn, input_model=before,
        output_model=after, source_file='optical_route_a.py', applicability=('source_exact_k73_search_binding',),
        invariants=('existing_first_hit_and_k09', 'no_shot_recursive_search_or_action_release',
            'source_scope_goal_model_revision_geometry_digest_equality'),
        falsifiers=('inconsistent_relay_setting', 'geometry_digest_mismatch', 'unbound_terminal_contract'))
        for ref, fn, before, after in K73_A_ENTRIES)


def optical_route_signatures_a(type_spec, parameter_spec):
    def p(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    return {
        'capability.optical_route_prepare_a': ((p('request', 'DiscreteOpticsRequest'),), 'OpticalRouteBindingA'),
        'capability.optical_route_extract_a': ((p('binding', 'OpticalRouteBindingA'),), 'SearchDomainInputC'),
        'capability.optical_route_unavailable_a': ((p('binding', 'OpticalRouteBindingA'),), 'DMechanicalResult'),
        'capability.optical_route_return_a': ((p('binding', 'OpticalRouteBindingA'),
            p('returned', 'MechanicalNormalizedReturn')), 'DMechanicalResult'),
    }
