"""Exact typed wiring for Source-owned homologous-field experiments."""
from .homologous_interface import (
    InterfaceObservation, InterfaceProposal, InterfaceAdmission,
    measure_homologous_interface, append_homologous_interface,
)
from .contracts import InteractionProbeAgenda
from .reference_goal_admission import measure_reference_goal_admission, append_reference_goal_admission

HOMOLOGOUS_INTERFACE_TYPES = ('InterfaceObservation', 'InterfaceProposal', 'InterfaceAdmission')


def homologous_interface_entries(factory):
    rows = (
        ('capability.homologous_interface_geometry', measure_homologous_interface,
         InterfaceObservation, InterfaceProposal),
        ('capability.homologous_interface_measurements', append_homologous_interface,
         InterfaceAdmission, InteractionProbeAgenda),
    )
    return tuple(factory(capability_id=ref, implementation=method,
        input_model=before, output_model=after, source_file='homologous_interface.py',
        applicability=('source_admitted_revisable_homologous_field_question',),
        invariants=('source_owns_roles_goal_and_release', 'no_independence_or_work_law_inferred',
                    'one_primitive_then_current_response', 'preserve_unknowns_and_conflicts'),
        falsifiers=('current_geometry_or_sealed_response_disagrees',))
        for ref, method, before, after in rows) + tuple(factory(
        capability_id=ref, implementation=method, input_model=before, output_model=after,
        source_file='reference_goal_admission.py',
        applicability=('source_derived_current_reference_goal_means_receipt',),
        invariants=('raw_goal_count_is_only_inventory', 'source_owns_admission_and_exclusivity',
                    'indirect_question_is_not_established_control'),
        falsifiers=('current_means_or_frame_binding_missing',))
        for ref, method, before, after in (
            ('capability.reference_goal_admission_measurement', measure_reference_goal_admission, InterfaceObservation, InterfaceProposal),
            ('capability.reference_goal_admission_transport', append_reference_goal_admission, InterfaceAdmission, InteractionProbeAgenda)))


def homologous_interface_signatures(type_spec, parameter_spec):
    def p(name, kind):
        return parameter_spec(name=name, type_spec=type_spec('List', type_spec('Any'))
                              if kind == 'List<Any>' else type_spec(kind))
    return {
        'capability.reference_goal_admission_measurement': ((p('request', 'InteractionProbeInput'), p('agenda', 'InteractionProbeAgenda')), 'InterfaceProposal'),
        'capability.reference_goal_admission_transport': ((p('proposal', 'InterfaceProposal'), p('source_description_ref', 'Ref'), p('source_alternative_facts', 'Any')), 'InteractionProbeAgenda'),
        'capability.homologous_interface_geometry': ((p('request', 'InteractionProbeInput'),
            p('agenda', 'InteractionProbeAgenda'), p('prior_model_rows', 'List<Any>'),
            p('enumerate_current', 'Boolean')), 'InterfaceProposal'),
        'capability.homologous_interface_measurements': ((p('proposal', 'InterfaceProposal'),
            p('source_description_ref', 'Ref'), p('source_alternative_facts', 'Any')), 'InteractionProbeAgenda'),
    }
