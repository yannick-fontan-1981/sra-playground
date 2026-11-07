"""Exact K71 Source-session bridge; physical STEP remains C/D-owned."""
from .axial_field_configuration import AxialFieldRequest
from .axial_step_contracts_c import AxialStepInputC
from .mechanical_common_contracts_c import SearchDomainInputC
from .mechanical_family_contracts_d import DMechanicalResult
from .axial_route_a import (
    AxialRouteSessionA, AxialRouteSessionInputA, AxialRouteAbsorbA, AxialRouteNextA,
    AxialRouteStepBindingA, AxialRouteStepExtractA, AxialRouteAppendA, AxialRouteRefuseA,
    initialize_axial_route_a, extract_axial_route_query_a, absorb_axial_route_a,
    bind_axial_route_step_a, extract_axial_route_step_a, append_axial_route_step_a,
    refuse_axial_route_step_a, finish_axial_route_a,
)

K71_A_ENTRIES = (
    ('capability.axial_route_initialize_a', initialize_axial_route_a, AxialFieldRequest, AxialRouteSessionA),
    ('capability.axial_route_query_a', extract_axial_route_query_a, AxialRouteSessionInputA, SearchDomainInputC),
    ('capability.axial_route_absorb_a', absorb_axial_route_a, AxialRouteAbsorbA, AxialRouteSessionA),
    ('capability.axial_route_next_a', bind_axial_route_step_a, AxialRouteNextA, AxialRouteStepBindingA),
    ('capability.axial_route_step_a', extract_axial_route_step_a, AxialRouteStepExtractA, AxialStepInputC),
    ('capability.axial_route_append_a', append_axial_route_step_a, AxialRouteAppendA, AxialRouteSessionA),
    ('capability.axial_route_refuse_a', refuse_axial_route_step_a, AxialRouteRefuseA, AxialRouteSessionA),
    ('capability.axial_route_finish_a', finish_axial_route_a, AxialRouteSessionInputA, DMechanicalResult),
)


def axial_route_entries_a(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=fn, input_model=before,
        output_model=after, source_file='axial_route_a.py', applicability=('source_exact_k71_search_binding',),
        invariants=('existing_k09_and_axial_c_stepper', 'full_joint_selection_state_and_external_costs',
            'no_second_field_tick_debit_or_action_release'),
        falsifiers=('rotation_cost_claimed_command_cost', 'macro_not_expanded', 'scope_model_or_packet_mismatch'))
        for ref, fn, before, after in K71_A_ENTRIES)


def axial_route_signatures_a(type_spec, parameter_spec):
    def p(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    return {
        'capability.axial_route_initialize_a': ((p('request', 'AxialFieldRequest'),), 'AxialRouteSessionA'),
        'capability.axial_route_query_a': ((p('session', 'AxialRouteSessionA'),), 'SearchDomainInputC'),
        'capability.axial_route_absorb_a': ((p('session', 'AxialRouteSessionA'), p('returned', 'MechanicalNormalizedReturn')), 'AxialRouteSessionA'),
        'capability.axial_route_next_a': ((p('session', 'AxialRouteSessionA'), p('needed', 'Any')), 'AxialRouteStepBindingA'),
        'capability.axial_route_step_a': ((p('binding', 'AxialRouteStepBindingA'),), 'AxialStepInputC'),
        'capability.axial_route_append_a': ((p('session', 'AxialRouteSessionA'), p('binding', 'AxialRouteStepBindingA'),
            p('dispatched', 'AxialStepDispatchC')), 'AxialRouteSessionA'),
        'capability.axial_route_refuse_a': ((p('session', 'AxialRouteSessionA'), p('binding', 'AxialRouteStepBindingA')), 'AxialRouteSessionA'),
        'capability.axial_route_finish_a': ((p('session', 'AxialRouteSessionA'),), 'DMechanicalResult'),
    }
