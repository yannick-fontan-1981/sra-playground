"""Exact K75 Source-session bridge; physical STEP remains C/D-owned."""
from .supported_construction import SupportedConstructionRequest
from .construction_step_contracts_c import ConstructionStepInputC
from .mechanical_common_contracts_c import SearchDomainInputC
from .mechanical_family_contracts_d import DMechanicalResult
from .construction_route_a import (
    ConstructionRouteSessionA, ConstructionRouteSessionInputA, ConstructionRouteAbsorbA, ConstructionRouteNextA,
    ConstructionRouteStepBindingA, ConstructionRouteStepExtractA, ConstructionRouteAppendA, ConstructionRouteRefuseA,
    initialize_construction_route_a, extract_construction_route_query_a, absorb_construction_route_a,
    bind_construction_route_step_a, extract_construction_route_step_a, append_construction_route_step_a,
    refuse_construction_route_step_a, finish_construction_route_a,
)

K75_A_ENTRIES = (
    ('capability.construction_route_initialize_a', initialize_construction_route_a, SupportedConstructionRequest, ConstructionRouteSessionA),
    ('capability.construction_route_query_a', extract_construction_route_query_a, ConstructionRouteSessionInputA, SearchDomainInputC),
    ('capability.construction_route_absorb_a', absorb_construction_route_a, ConstructionRouteAbsorbA, ConstructionRouteSessionA),
    ('capability.construction_route_next_a', bind_construction_route_step_a, ConstructionRouteNextA, ConstructionRouteStepBindingA),
    ('capability.construction_route_step_a', extract_construction_route_step_a, ConstructionRouteStepExtractA, ConstructionStepInputC),
    ('capability.construction_route_append_a', append_construction_route_step_a, ConstructionRouteAppendA, ConstructionRouteSessionA),
    ('capability.construction_route_refuse_a', refuse_construction_route_step_a, ConstructionRouteRefuseA, ConstructionRouteSessionA),
    ('capability.construction_route_finish_a', finish_construction_route_a, ConstructionRouteSessionInputA, DMechanicalResult),
)


def construction_route_entries_a(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=fn, input_model=before,
        output_model=after, source_file='construction_route_a.py', applicability=('source_exact_k75_search_binding',),
        invariants=('existing_k09_and_construction_c_stepper', 'full_joint_stock_selection_state_and_external_costs',
            'no_second_mechanics_pass_debit_or_action_release'),
        falsifiers=('rotation_cost_claimed_command_cost', 'macro_not_expanded', 'scope_model_or_packet_mismatch'))
        for ref, fn, before, after in K75_A_ENTRIES)


def construction_route_signatures_a(type_spec, parameter_spec):
    def p(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    return {
        'capability.construction_route_initialize_a': ((p('request', 'SupportedConstructionRequest'),), 'ConstructionRouteSessionA'),
        'capability.construction_route_query_a': ((p('session', 'ConstructionRouteSessionA'),), 'SearchDomainInputC'),
        'capability.construction_route_absorb_a': ((p('session', 'ConstructionRouteSessionA'), p('returned', 'MechanicalNormalizedReturn')), 'ConstructionRouteSessionA'),
        'capability.construction_route_next_a': ((p('session', 'ConstructionRouteSessionA'), p('needed', 'Any')), 'ConstructionRouteStepBindingA'),
        'capability.construction_route_step_a': ((p('binding', 'ConstructionRouteStepBindingA'),), 'ConstructionStepInputC'),
        'capability.construction_route_append_a': ((p('session', 'ConstructionRouteSessionA'), p('binding', 'ConstructionRouteStepBindingA'),
            p('dispatched', 'ConstructionStepDispatchC')), 'ConstructionRouteSessionA'),
        'capability.construction_route_refuse_a': ((p('session', 'ConstructionRouteSessionA'), p('binding', 'ConstructionRouteStepBindingA')), 'ConstructionRouteSessionA'),
        'capability.construction_route_finish_a': ((p('session', 'ConstructionRouteSessionA'),), 'DMechanicalResult'),
    }
