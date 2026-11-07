"""Typed wiring for Source-owned contextual compartment experiments."""
from .contextual_compartment import (
    CompartmentObservation, CompartmentProposal, CompartmentDescriptionRequest,
    CompartmentDescriptions, CompartmentAdmission, measure_contextual_compartment,
    describe_contextual_compartment, append_contextual_compartment,
)
from .contracts import InteractionProbeAgenda

CONTEXTUAL_COMPARTMENT_TYPES=tuple(c.__name__ for c in (
    CompartmentObservation,CompartmentProposal,CompartmentDescriptionRequest,
    CompartmentDescriptions,CompartmentAdmission))


def contextual_compartment_entries(factory):
    rows=(('capability.contextual_compartment_geometry',measure_contextual_compartment,CompartmentObservation,CompartmentProposal),
        ('capability.contextual_compartment_descriptions',describe_contextual_compartment,CompartmentDescriptionRequest,CompartmentDescriptions),
        ('capability.contextual_compartment_measurements',append_contextual_compartment,CompartmentAdmission,InteractionProbeAgenda))
    return tuple(factory(capability_id=ref,implementation=method,input_model=before,output_model=after,
        source_file='contextual_compartment.py',applicability=('source_admitted_conditional_compartment_question',),
        invariants=('source_owns_roles_goal_and_release','retain_occlusion_displacement_transformation_alternatives','no_unacquired_temporal_laws','current_witness_required'),
        falsifiers=('current_geometry_or_sealed_response_disagrees','bounded_query_failure_is_not_world_impossibility'))
        for ref,method,before,after in rows)


def contextual_compartment_signatures(type_spec,parameter_spec):
    def p(name,kind):
        return parameter_spec(name=name,type_spec=type_spec('List',type_spec('Any')) if kind=='List<Any>' else type_spec(kind))
    return {
        'capability.contextual_compartment_geometry':((p('request','InteractionProbeInput'),p('agenda','InteractionProbeAgenda'),p('prior_model_rows','List<Any>'),p('enumerate_current','Boolean')),'CompartmentProposal'),
        'capability.contextual_compartment_descriptions':((p('proposal','CompartmentProposal'),p('source_disposition_ref','Ref'),p('source_alternative_facts','Any')),'CompartmentDescriptions'),
        'capability.contextual_compartment_measurements':((p('calculation','CompartmentDescriptions'),p('source_description_ref','Ref'),p('source_alternative_facts','Any')),'InteractionProbeAgenda'),
    }
