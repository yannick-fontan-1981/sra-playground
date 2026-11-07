"""Typed Source wiring for scoped relative-setting questions."""
from .parameterized_control import (measure_parameterized_control,
    calculate_admitted_parameterized_inverse,append_parameterized_control,
    retained_parameterized_scope, measure_retained_parameterized_control)
from .homologous_interface import InterfaceObservation,InterfaceProposal,InterfaceAdmission
from .contracts import InteractionProbeAgenda, InteractionProbeInput


def parameterized_control_entries(factory):
    return tuple(factory(capability_id=ref,implementation=method,input_model=before,output_model=after,
        source_file='parameterized_control.py',applicability=('source_scoped_relative_setting_question',),
        invariants=('source_owns_roles_models_selection_and_release','unknown_axes_preserved',
                    'only_current_setting_domain','one_primitive_then_reconciliation'),
        falsifiers=('actual_marker_or_population_disagrees',)) for ref,method,before,after in (
            ('capability.parameterized_control_retained_scope',retained_parameterized_scope,InteractionProbeInput,InterfaceProposal),
            ('capability.parameterized_control_retained_geometry',measure_retained_parameterized_control,InterfaceObservation,InterfaceProposal),
            ('capability.parameterized_control_geometry',measure_parameterized_control,InterfaceObservation,InterfaceProposal),
            ('capability.parameterized_control_axis_inverse',calculate_admitted_parameterized_inverse,InterfaceAdmission,InterfaceProposal),
            ('capability.parameterized_control_measurements',append_parameterized_control,InterfaceAdmission,InteractionProbeAgenda)))


def parameterized_control_signatures(type_spec,parameter_spec):
    def p(name,kind):
        return parameter_spec(name=name,type_spec=type_spec('List',type_spec('Any'))if kind=='List<Any>'else type_spec(kind))
    admitted=tuple(p(name,kind)for name,kind in (('proposal','InterfaceProposal'),('source_description_ref','Ref'),('source_alternative_facts','Any')))
    measured=((p('request','InteractionProbeInput'),p('agenda','InteractionProbeAgenda'),p('prior_model_rows','List<Any>'),p('enumerate_current','Boolean')),'InterfaceProposal')
    return {'capability.parameterized_control_geometry':measured,
        'capability.parameterized_control_retained_scope':((p('request','InteractionProbeInput'),),'InterfaceProposal'),
        'capability.parameterized_control_retained_geometry':measured,
        'capability.parameterized_control_axis_inverse':(admitted,'InterfaceProposal'),
        'capability.parameterized_control_measurements':(admitted,'InteractionProbeAgenda')}
