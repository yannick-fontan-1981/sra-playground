"""Transport one Source-certified word to ordinary candidate measurements.

This does not search, reselect a route, simulate collision physics, release an
action, or create WHY/permits. Future click coordinates are affine projections
of the exact certified pose/focus word, not unbound placeholders.
"""
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref, stable_digest
from .contracts import InteractionProbeInput, InteractionProbeAgenda
from .mechanical_request_contracts import MechanicalNormalizedReturn
from .rigid_scene_binding_c import RigidSceneQueryC
from .rigid_rearrangement_c import measure_rigid_rearrangement
from .agenda_measurement_transport import append_candidate_measurements


class RigidSceneRouteInputC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.rigid_scene_route_input_c.v1'
    world: InteractionProbeInput
    agenda: InteractionProbeAgenda
    query: RigidSceneQueryC
    result: MechanicalNormalizedReturn


def annotate_rigid_scene_route(value: RigidSceneRouteInputC) -> InteractionProbeAgenda:
    query, result = value.query, value.result
    measurement = result.descriptive_values.get('measurement',FrozenMap())
    facts = measurement.get('facts',FrozenMap())
    witnesses = tuple(measurement.get('witnesses',()))
    if (query.geometry.lattice_phase is None or query.geometry.quantum is None
            or result.status != 'FOUND' or len(witnesses) != 1 or not measurement.get('complete')
            or measurement.get('bounded') or measurement.get('contradictory')
            or not facts.get('first_shortest_witness_settled')
            or result.request.request_ref != query.request.query_identity.request_ref
            or result.request.epoch != query.geometry.epoch
            or result.request.input_revision_ref != query.geometry.frame_ref):
        return value.agenda
    word = tuple(witnesses[0].get('word',()))
    if (not word or len(word) != witnesses[0].get('cost')
            or len(word) > query.request.remaining_primitive_reserve):
        return value.agenda
    measured = measure_rigid_rearrangement(query.request)
    if measured.driver is None or measured.missing_refs:
        return value.agenda
    primitives = {p.primitive_ref:p for p in measured.driver.primitives}
    native = query.request.template.profile.native_request
    poses = {b.body_ref:b.origin for b in native.bodies}
    bodies = {b.body_ref:b for b in native.bodies}
    focus = native.native_focus_ref
    action_refs, payloads = [],[]
    incidences = []
    projection_work = 0
    phase_row,phase_col = query.geometry.lattice_phase
    quantum = query.geometry.quantum
    for ref in word:
        primitive = primitives.get(ref)
        if primitive is None:
            return value.agenda
        data = primitive.data
        vacated,entered = (),()
        if data['channel'] == 'CLICK':
            focus = data['body_ref']
            x,y = poses[focus]
            dx,dy = data['hit_offset']
            payload = FrozenMap({'x':phase_col+quantum*(x+dx)+(quantum-1)//2,
                'y':phase_row+quantum*(y+dy)+(quantum-1)//2})
        elif data['channel'] == 'TRANSLATE' and focus in poses:
            x,y = poses[focus]
            dx,dy = data['translation']
            poses[focus] = (x+dx,y+dy)
            offsets = bodies[focus].solid_offsets
            projection_work += 2*len(offsets)
            if projection_work > query.request.maximum_geometry_checks:
                return value.agenda
            before = frozenset((x+a,y+b) for a,b in offsets)
            after = frozenset((x+dx+a,y+dy+b) for a,b in offsets)
            vacated,entered = tuple(sorted(before-after)),tuple(sorted(after-before))
            payload = FrozenMap()
        else:
            return value.agenda
        action_refs.append(primitive.action_ref)
        payloads.append(payload)
        incidences.append(FrozenMap({'step_index':len(action_refs)-1,'body_ref':focus,
            'vacated_cells':vacated,'entered_cells':entered}))
    links = []
    for incidence in incidences:
        consumers = []
        vacated = frozenset(incidence['vacated_cells'])
        for later in incidences[incidence['step_index']+1:]:
            projection_work += len(vacated)+len(later['entered_cells'])
            if projection_work > query.request.maximum_geometry_checks:
                return value.agenda
            if not vacated.isdisjoint(later['entered_cells']):
                consumers.append((later['step_index'],later['body_ref']))
        links.append(FrozenMap.overlay({'later_entering_steps':tuple(consumers),
            'first_later_entering_step':consumers[0][0] if consumers else None},incidence))
    domains = {}
    model_bodies = []
    for body in native.bodies:
        projection_work += len(body.solid_offsets)+len(body.hit_offsets)+len(body.admitted_solid_cells)
        if projection_work > query.request.maximum_geometry_checks:
            return value.agenda
        domain_ref = 'measurement.rigid_admission.'+stable_digest(body.admitted_solid_cells)
        domains[domain_ref] = body.admitted_solid_cells
        model_bodies.append(FrozenMap({'body_ref':body.body_ref,'origin':body.origin,
            'solid_offsets':body.solid_offsets,'hit_offsets':body.hit_offsets,'admission_domain_ref':domain_ref}))
    # A small deduplicated model, not a full WorldContext or native archive.
    # It remains a conditional calculation contract, never an acquired claim.
    model_contract = FrozenMap({'model_ref':query.request.template.packet_contract.model_ref,
        'model_revision_ref':native.scope.model_revision_ref,'model_status_ref':native.scope.model_status_ref,
        'initial_focus_ref':native.native_focus_ref,'bodies':tuple(model_bodies),'admission_domains':FrozenMap(domains),
        'class_by_body':query.request.collision_gate.class_by_body,
        'observed_contact_measurements':query.geometry.prior_contact_measurements,
        'initial_morphology_only':all(rule.blocking_contact is None for rule in query.request.collision_gate.rules),
        'native_parameters':FrozenMap({key:getattr(native,key) for key in (
            'click_selection_precedes_placement','click_focused_body_rule','absolute_placement_supported',
            'unit_translation_vectors','admission_kind','containment_supported','collision_exclusion_pairs',
            'submitted_cost','accepted_edit_cost','refused_cost')}),
        'source_morphology_premise_refs':query.request.template.profile.morphology_premise_refs,
        'source_usefulness_premise_refs':query.request.template.profile.usefulness_premise_refs})
    agenda = value.agenda
    first_payload = payloads[0]
    if first_payload:
        from .interaction import _point_candidates
        point = (first_payload['y'],first_payload['x'])
        rows = _point_candidates(value.world,frozenset(agenda.current_context_no_effect_candidate_refs),
            frozenset(agenda.tested_candidate_refs_without_resolution_plan),
            dict(agenda.context_facts),{},{},{},requested_points=(point,))
        unique_rows = tuple((candidate,base) for candidate,base in rows
            if candidate.action_ref == action_refs[0] and candidate.point == point)
    else:
        unique_rows = tuple((candidate,agenda.alternative_facts[candidate.candidate_ref]) for candidate in agenda.candidates
            if candidate.action_ref == action_refs[0] and candidate.point is None and not candidate.action_data)
    if len(unique_rows) != 1:
        return agenda
    candidate,base = unique_rows[0]
    if candidate.candidate_ref not in agenda.alternative_refs:
        agenda = agenda.model_copy(update={'candidates':agenda.candidates+(candidate,),
            'alternative_refs':agenda.alternative_refs+(candidate.candidate_ref,),
            'alternative_facts':FrozenMap.overlay({candidate.candidate_ref:base},agenda.alternative_facts),
            'descriptive_delta_facts':FrozenMap.overlay({candidate.candidate_ref:base},agenda.descriptive_delta_facts),
            'has_candidates':True})
    delta = FrozenMap({'rigid_scene_route_present':True,'rigid_scene_route_action_refs':tuple(action_refs),
        'rigid_scene_route_action_payloads':tuple(payloads),'rigid_scene_route_step_count':len(word),
        'rigid_scene_route_parent_goal_ref':query.geometry.parent_goal_ref,
        'rigid_scene_route_source_frame_ref':query.geometry.frame_ref,
        'rigid_scene_route_remaining_reserve':query.request.remaining_primitive_reserve,
        'rigid_scene_route_model_falsifier_refs':(query.request.template.profile.falsifier_ref,),
        'rigid_scene_route_context':FrozenMap({'epoch':query.geometry.epoch,'source_frame_ref':query.geometry.frame_ref,
            'parent_goal_ref':query.geometry.parent_goal_ref,'beneficiary_ref':query.request.beneficiary_ref,
            'destination_origins':query.request.destination_origins,'predicted_final_origins':FrozenMap(poses),
            'quantum':quantum,'lattice_phase':query.geometry.lattice_phase,
            'word_step_incidences':tuple(links),'word_projection_cell_checks':projection_work,
            'conditional_model_contract':model_contract,
            'calculation_parent_ref':native.scope.parent_contribution_ref,
            'canonical_acquisition_attested':query.canonical_acquisition_attested,
            'assumption_refs':native.scope.assumption_refs,'falsifier_ref':query.request.template.profile.falsifier_ref}),
        'rigid_scene_route_is_conditional':True,'rigid_scene_route_first_payload_bound':True})
    # Copy the already dispatched Source goal contract, never infer a new goal
    # from a found word or from a merely prepared sibling. DRM separately owns
    # whether this current conditional word contributes to that preserved goal.
    inherited=value.world.canonical_dispatched_goal_continuity_facts.get(
        'dispatched_composition_goal_contract',FrozenMap())
    owner=inherited.get('active_goal_ref')
    terminal=inherited.get('active_terminal_goal_ref')
    child=inherited.get('subgoal_ref')
    chain=tuple(inherited.get('goal_dependency_chain_refs') or ())
    edges=tuple(inherited.get('goal_graph_edge_refs') or ())
    complete=bool(owner and owner==query.geometry.parent_goal_ref and terminal
        and owner in chain and terminal in chain
        and inherited.get('advances_active_goal_chain') is True
        and ((child is None and owner==terminal and chain==(owner,) and not edges)
            or (child is not None and bool(edges))))
    if complete:
        delta=FrozenMap.overlay({
            'rigid_scene_route_goal_contract_complete':True,
            'rigid_scene_route_context':FrozenMap.overlay({
                'goal_contract_source_intent_ref':value.world.canonical_dispatched_goal_continuity_facts.get(
                    'dispatched_composition_intent_ref')},delta['rigid_scene_route_context']),
            **{'rigid_scene_route_goal_'+key:inherited.get(key) for key in (
                'active_goal_ref','active_terminal_goal_ref','subgoal_ref',
                'goal_graph_edge_refs','goal_dependency_chain_refs',
                'advances_active_goal_chain','inherited_priority_from_terminal_goal')},
        },delta)
    annotated = append_candidate_measurements(agenda,FrozenMap({candidate.candidate_ref:delta}),FrozenMap())
    # Reuse the current common geometry, never invent an empty/default premise
    # merely because this point was added after the general enumeration.
    original_context = value.agenda.context_facts
    if 'open_cavity_nonreturn_first_action_refs' in original_context:
        from .interaction import _attach_current_open_cavity_measurements
        annotated = _attach_current_open_cavity_measurements(annotated,FrozenMap({
            'open_cavity_nonreturn_first_action_refs':original_context['open_cavity_nonreturn_first_action_refs']}))
    coverage = original_context.get('curiosity_frontier_coverage')
    if coverage is not None:
        represented = frozenset(c.action_ref for c in annotated.candidates)
        coverage = FrozenMap.overlay({'candidate_count':len(annotated.candidates),
            'point_candidate_count':sum(c.point is not None for c in annotated.candidates),
            'object_candidate_count':sum(c.component_ref is not None for c in annotated.candidates),
            'represented_command_count':len(represented),
            'unrepresented_command_refs':tuple(ref for ref in value.world.available_action_refs if ref not in represented)},coverage)
        annotated = annotated.model_copy(update={'context_facts':FrozenMap.overlay(
            {'curiosity_frontier_coverage':coverage},annotated.context_facts)})
    return annotated
