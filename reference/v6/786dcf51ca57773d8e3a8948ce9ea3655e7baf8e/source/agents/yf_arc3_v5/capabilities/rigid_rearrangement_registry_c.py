"""Typed Source solving facade; it never claims to be a single native STEP."""
from .rigid_rearrangement_c import (RigidRearrangementInputC, RigidRearrangementPreparationC,
    RigidRearrangementUnresolvedInputC, RigidRearrangementSearchBindingC, measure_rigid_rearrangement,
    bound_rigid_rearrangement_request, unresolved_rigid_rearrangement,
    RigidVacancyScopeC, measure_rigid_vacancy_scope)
from .mechanical_search_driver_contracts_c import SearchDriverInputC
from .mechanical_request_contracts import MechanicalResponseInput
from .rigid_scene_geometry_c import RigidSceneGeometryInputC, RigidSceneGeometryC, measure_rigid_scene_geometry
from .rigid_scene_geometry_c import RigidSceneProposalInputC, RigidSceneProposalC, measure_rigid_scene_proposal
from .rigid_scene_binding_c import RigidSceneBindingInputC, RigidSceneQueryC, bind_rigid_scene_query
from .rigid_scene_route_c import RigidSceneRouteInputC, annotate_rigid_scene_route
from .rigid_selection_c import (RigidSelectionAgendaInputC, annotate_rigid_selection_agenda,
    RigidCurrentGeometryInputC, revalidate_source_selected_rigid_geometry)
from .contracts import InteractionProbeAgenda
from .rigid_indexed_search_c import (RigidIndexedSearchInputC, RigidIndexedSearchPreparationC,
    RigidIndexedSearchResultC, prepare_rigid_indexed_search, calculate_rigid_indexed_search)

RIGID_REARRANGEMENT_ENTRIES_C = (
    ('capability.rigid_indexed_prepare_c', prepare_rigid_indexed_search,
        RigidIndexedSearchInputC, RigidIndexedSearchPreparationC),
    ('capability.rigid_indexed_calculate_c', calculate_rigid_indexed_search,
        RigidIndexedSearchPreparationC, RigidIndexedSearchResultC),
    ('capability.rigid_current_geometry_c', revalidate_source_selected_rigid_geometry,
        RigidCurrentGeometryInputC, RigidSceneGeometryC),
    ('capability.rigid_selection_agenda_c', annotate_rigid_selection_agenda,
        RigidSelectionAgendaInputC, InteractionProbeAgenda),
    ('capability.rigid_rearrangement_prepare_c', measure_rigid_rearrangement,
        RigidRearrangementInputC, RigidRearrangementPreparationC),
    ('capability.rigid_rearrangement_bound_request_c', bound_rigid_rearrangement_request,
        RigidRearrangementSearchBindingC, SearchDriverInputC),
    ('capability.rigid_rearrangement_unresolved_c', unresolved_rigid_rearrangement,
        RigidRearrangementUnresolvedInputC, MechanicalResponseInput),
    ('capability.rigid_rearrangement_vacancy_scope_c', measure_rigid_vacancy_scope,
        RigidRearrangementPreparationC, RigidVacancyScopeC),
    ('capability.rigid_scene_geometry_c', measure_rigid_scene_geometry,
        RigidSceneGeometryInputC, RigidSceneGeometryC),
    ('capability.rigid_scene_proposal_c', measure_rigid_scene_proposal,
        RigidSceneProposalInputC, RigidSceneProposalC),
    ('capability.rigid_scene_bind_query_c', bind_rigid_scene_query,
        RigidSceneBindingInputC, RigidSceneQueryC),
    ('capability.rigid_scene_route_c', annotate_rigid_scene_route,
        RigidSceneRouteInputC, InteractionProbeAgenda),
)
RIGID_REARRANGEMENT_TYPES_C = tuple(sorted({model.__name__
    for _,_,before,after in RIGID_REARRANGEMENT_ENTRIES_C for model in (before,after)}
    | {'RigidCollisionRuleFactsC'}))


def rigid_rearrangement_entries_c(factory):
    return tuple(factory(capability_id=ref, implementation=implementation,
        input_model=before, output_model=after, source_file=implementation.__module__.rsplit('.',1)[-1]+'.py',
        applicability=('source_bound_rigid_masks_control_cost_goal_and_current_class_evidence',),
        invariants=('reuse_rigid_step_and_k09', 'no_action_authority', 'source_qualified_indexed_backend_or_step_ledger',
            'palette_independent_class_transfer_is_source_owned', 'bounded_configuration_domain'),
        falsifiers=('model_scope_or_class_evidence_mismatch', 'incomplete_masks', 'explicit_bound_reached'))
        for ref,implementation,before,after in RIGID_REARRANGEMENT_ENTRIES_C)


def rigid_rearrangement_signatures_c(type_spec, parameter_spec):
    def p(name,kind,optional=False):
        return parameter_spec(name=name,type_spec=type_spec(kind,optional=optional))
    signatures = {ref: ((p('request',before.__name__),),after.__name__)
        for ref,_,before,after in RIGID_REARRANGEMENT_ENTRIES_C}
    signatures['capability.rigid_indexed_prepare_c'] = ((p('measured','RigidRearrangementPreparationC'),
        p('route_witness_policy_ref','String'),p('evidence_refs','Any'),
        p('maximum_states','Integer'),p('maximum_candidates','Integer'),p('time_bound_ms','Integer')),
        'RigidIndexedSearchPreparationC')
    signatures['capability.rigid_rearrangement_unresolved_c'] = ((p('measured','RigidRearrangementPreparationC'),
        p('source_status','String'),p('missing_cause','String'),p('unresolved_question_ref','String',True)),
        'MechanicalResponseInput')
    signatures['capability.rigid_rearrangement_bound_request_c'] = ((p('measured','RigidRearrangementPreparationC'),
        p('route_witness_policy_ref','String'),p('evidence_refs','Any'),p('pure_rigid_batch','Boolean'),
        p('operator_scope_ref','String'),p('vacancy_scope','RigidVacancyScopeC')),'SearchDriverInputC')
    signatures['capability.rigid_scene_geometry_c'] = ((p('world','Any'),p('maximum_work','Integer')),'RigidSceneGeometryC')
    signatures['capability.rigid_scene_proposal_c'] = ((p('world','Any'),p('agenda','InteractionProbeAgenda'),
        p('maximum_work','Integer')),'RigidSceneProposalC')
    signatures['capability.rigid_scene_bind_query_c'] = ((p('measured','RigidSceneGeometryC'),
        p('source_disposition_ref','String'),p('source_alternative_facts','Any')),'RigidSceneQueryC')
    signatures['capability.rigid_scene_route_c'] = ((p('world','Any'),p('agenda','InteractionProbeAgenda'),
        p('query','RigidSceneQueryC'),p('result','MechanicalNormalizedReturn')),'InteractionProbeAgenda')
    signatures['capability.rigid_selection_agenda_c'] = ((p('world','Any'),p('agenda','InteractionProbeAgenda'),
        p('measured','RigidSceneGeometryC'),p('source_alternative_facts','Any')),'InteractionProbeAgenda')
    signatures['capability.rigid_current_geometry_c'] = ((p('world','Any'),p('measured','RigidSceneGeometryC'),
        p('source_alternative_facts','Any'),p('maximum_work','Integer')),'RigidSceneGeometryC')
    return signatures
