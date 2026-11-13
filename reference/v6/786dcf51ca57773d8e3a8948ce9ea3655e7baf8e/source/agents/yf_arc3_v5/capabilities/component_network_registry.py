"""Typed wiring for Source-owned revisable component-network questions."""
from .component_network import (
    ComponentNetworkProposal, ComponentNetworkMeasurement, ComponentNetworkScope,
    ComponentNetworkModels, ComponentNetworkRouteRequest, ComponentNetworkRoutes,
    ComponentNetworkAdmission, measure_component_network,
    calculate_component_network_models, calculate_component_network_routes,
    append_component_network,
)
from .contracts import InteractionProbeAgenda

COMPONENT_NETWORK_TYPES = tuple(x.__name__ for x in (
    ComponentNetworkProposal, ComponentNetworkMeasurement, ComponentNetworkScope,
    ComponentNetworkModels, ComponentNetworkRouteRequest, ComponentNetworkRoutes,
    ComponentNetworkAdmission))


def component_network_entries(factory):
    rows = (
        ('capability.component_network_geometry', measure_component_network, ComponentNetworkMeasurement, ComponentNetworkProposal),
        ('capability.component_network_models', calculate_component_network_models, ComponentNetworkScope, ComponentNetworkModels),
        ('capability.component_network_routes', calculate_component_network_routes, ComponentNetworkRouteRequest, ComponentNetworkRoutes),
        ('capability.component_network_measurements', append_component_network, ComponentNetworkAdmission, InteractionProbeAgenda),
    )
    return tuple(factory(capability_id=ref, implementation=method, input_model=before, output_model=after,
        source_file='component_network.py', applicability=('source_declared_conditional_component_model',),
        invariants=('source_owns_roles_goal_model_selection_and_release', 'original_values_preserved',
            'all_induced_contacts_simulated', 'all_demands_and_resource_preserved', 'unknown_mixtures_fail_closed'),
        falsifiers=('current_scene_or_transition_contradicts_model', 'bounded_query_is_not_world_impossibility'))
        for ref, method, before, after in rows)


def component_network_signatures(type_spec, parameter_spec):
    def p(name, kind):
        return parameter_spec(name=name, type_spec=type_spec("List", type_spec("Any"))
            if kind == "List<Any>" else type_spec(kind))
    return {
        'capability.component_network_geometry': ((p('request','InteractionProbeInput'), p('agenda','InteractionProbeAgenda'), p('prior_model_rows','List<Any>')), 'ComponentNetworkProposal'),
        'capability.component_network_models': ((p('proposal','ComponentNetworkProposal'), p('source_disposition_ref','Ref'), p('source_alternative_facts','Any')), 'ComponentNetworkModels'),
        'capability.component_network_routes': ((p('calculation','ComponentNetworkModels'), p('source_model_ref','Ref'), p('source_alternative_facts','Any')), 'ComponentNetworkRoutes'),
        'capability.component_network_measurements': ((p('calculation','ComponentNetworkRoutes'), p('source_route_ref','Ref'), p('source_alternative_facts','Any')), 'InteractionProbeAgenda'),
    }
