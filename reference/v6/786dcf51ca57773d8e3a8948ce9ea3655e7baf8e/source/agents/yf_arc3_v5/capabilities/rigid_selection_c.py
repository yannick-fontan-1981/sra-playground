"""Current indicator-color counts and point incidences for Source control state.

Retained examples are actual Source-bound pose/focus models. Python measures
their render incidences; DRM decides unknown/absent/present and action priority.
"""
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, stable_digest
from .contracts import InteractionProbeInput, InteractionProbeAgenda
from .rigid_scene_geometry_c import RigidSceneGeometryC, RigidSceneGeometryInputC, measure_rigid_scene_geometry
from pydantic import Field
from .agenda_measurement_transport import append_candidate_measurements


def measure_retained_outline_incidence(world, groups):
    examples = world.retained_rigid_control_observations
    values = {row['moving_border_value'] for row in examples}
    cue = next(iter(values)) if len(values) == 1 else None
    # A learned color can occur without a closed frame or a recovered lattice.
    # Frame matches only help localize the selected body; they do not gate presence.
    compatible = bool(examples and len(values) == 1
        and all(row['unique_body_border_occurrence'] for row in examples))
    matched = tuple(row for row in groups if row['border_value'] == cue) if compatible else ()
    pixel_count = sum(value == cue for line in world.frame.rows for value in line) if compatible else 0
    classes = {row['retained_collision_morphology_class_ref'] for row in examples
               if row.get('retained_collision_morphology_class_ref') is not None}
    floors = {row['underlay_value'] for row in examples if row.get('underlay_value') is not None}
    point_actions = {row['selection_action_ref'] for row in examples
                     if row.get('selection_action_ref') is not None}
    return FrozenMap({'retained_control_outline_example_count': len(examples),
        'retained_control_outline_value_count': len(values),
        'retained_control_indicator_examples_agree': compatible,
        'retained_rigid_collision_class_count': len(classes),
        'retained_rigid_underlay_value_count': len(floors),
        'retained_point_selection_action_count': len(point_actions),
        'retained_point_selection_action_available': len(point_actions) == 1
            and next(iter(point_actions)) in world.available_action_refs,
        'current_control_outline_group_count': len(matched),
        'current_control_outline_pixel_count': pixel_count,
        'control_outline_just_submitted_selection': bool(examples and any(
            world.last_action_ref == row.get('selection_action_ref') for row in examples)),
        'control_outline_pixel_work_count': world.frame.height * world.frame.width if compatible else 0,
        'control_outline_enumeration_complete': compatible,
        'control_outline_observation_frame_ref': world.current_observation_frame_ref or '',
        'control_outline_observation_ref': 'measurement.control_outline.' + stable_digest((
            world.current_observation_frame_ref, examples, tuple(row['frame_ref'] for row in matched), pixel_count)),
        'control_outline_model_evidence_refs': tuple(row['source_record_ref'] for row in examples),
        'retained_control_outline_value': cue,
        'current_control_outline_frame_ref': matched[0]['frame_ref'] if len(matched) == 1 else None})


class RigidSelectionAgendaInputC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.rigid_selection_agenda_input_c.v1'
    world: InteractionProbeInput
    agenda: InteractionProbeAgenda
    measured: RigidSceneGeometryC
    source_alternative_facts: FrozenMap


class RigidCurrentGeometryInputC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.rigid_current_geometry_input_c.v1'
    world: InteractionProbeInput
    measured: RigidSceneGeometryC
    source_alternative_facts: FrozenMap
    maximum_work: int = Field(ge=1, le=1048576)


def revalidate_source_selected_rigid_geometry(value: RigidCurrentGeometryInputC) -> RigidSceneGeometryC:
    source = value.source_alternative_facts['selection.current']
    disposition = source['rigid_geometry_revalidation_ref']
    if disposition == 'rigid_geometry.keep_current_measurement':
        return value.measured
    if disposition != 'rigid_geometry.remeasure_selected_anchor':
        raise ValueError('Unknown Source rigid geometry disposition')
    anchor = value.measured.facts['current_control_outline_frame_ref']
    examples = value.world.retained_rigid_control_observations
    floors = {row['underlay_value'] for row in examples if row.get('underlay_value') is not None}
    evidence = tuple(row['source_record_ref'] for row in examples
                     if row.get('retained_collision_morphology_class_ref') is not None)
    if anchor is None or len(floors) != 1 or not evidence:
        raise ValueError('Source-selected recall lacks its current anchor or retained evidence')
    return measure_rigid_scene_geometry(RigidSceneGeometryInputC(world=value.world,
        maximum_work=value.maximum_work, source_bound_anchor_frame_ref=anchor,
        source_bound_underlay_value=next(iter(floors)),
        source_recalled_collision_evidence_refs=evidence))


def annotate_rigid_selection_agenda(value: RigidSelectionAgendaInputC) -> InteractionProbeAgenda:
    source = value.source_alternative_facts.get('selection.current', FrozenMap())
    # The Source projection owns this conditional state; don't reclassify it.
    state = source.get('control_selection_state', 'unknown')
    q = value.measured.quantum
    floors = {row['underlay_value'] for row in value.world.retained_rigid_control_observations
              if row.get('underlay_value') is not None}
    groups = tuple(row for row in value.measured.groups if q is not None
        and (row['frame_bbox'][2]-row['frame_bbox'][0]+1) % q == 0
        and (row['frame_bbox'][3]-row['frame_bbox'][1]+1) % q == 0
        and row['unique_modal_interior_value'] is not None
        and row['unique_modal_interior_value'] not in floors)
    point_actions = {row['selection_action_ref'] for row in value.world.retained_rigid_control_observations
                     if row.get('selection_action_ref') is not None}
    point_action = next(iter(point_actions)) if len(point_actions) == 1 else None
    agenda = value.agenda
    disposition = source['direct_selection_candidates_ref']
    if disposition == 'selection_candidates.enumerate_known_direct_points':
        from .interaction import enumerate_interaction_probes
        expanded = enumerate_interaction_probes(value.world.model_copy(update=dict(
            source['direct_selection_measurement_overrides'])))
        def inside_body(candidate):
            return candidate.action_ref == point_action and candidate.point is not None and any(
                top < candidate.point[0] < bottom and left < candidate.point[1] < right
                for top, left, bottom, right in (row['frame_bbox'] for row in groups))
        offered = tuple(candidate for candidate in expanded.candidates if inside_body(candidate)
                        and candidate.candidate_ref not in agenda.alternative_refs)
        context = FrozenMap.overlay(expanded.context_facts, agenda.context_facts)
        deltas = dict(agenda.descriptive_delta_facts or agenda.alternative_facts)
        deltas.update({candidate.candidate_ref: expanded.descriptive_delta_facts.get(
            candidate.candidate_ref, expanded.alternative_facts[candidate.candidate_ref]) for candidate in offered})
        candidates = agenda.candidates + offered
        agenda = agenda.model_copy(update={'candidates': candidates,
            'alternative_refs': tuple(candidate.candidate_ref for candidate in candidates),
            'context_facts': context, 'descriptive_delta_facts': FrozenMap(deltas),
            'alternative_facts': FrozenMap({ref: FrozenMap.overlay(delta, context) for ref, delta in sorted(deltas.items())}),
            'has_candidates': bool(candidates)})
    elif disposition != 'selection_candidates.preserve_existing':
        raise ValueError('Unknown Source direct selection candidate disposition')
    directional = {row[0] for row in value.world.interface_action_translation_deltas}
    measurements = {}
    for candidate in agenda.candidates:
        data = candidate.action_data
        point = (candidate.point if candidate.point is not None else
                 (data['y'], data['x']) if set(data) == {'x', 'y'} else None)
        hits = tuple(row for row in groups if point is not None and
            row['frame_bbox'][0] < point[0] < row['frame_bbox'][2]
            and row['frame_bbox'][1] < point[1] < row['frame_bbox'][3])
        hit = bool(candidate.action_ref == point_action and point is not None and any(
            top < point[0] < bottom and left < point[1] < right
            for top, left, bottom, right in (row['frame_bbox'] for row in groups)))
        measurements[candidate.candidate_ref] = FrozenMap({
            'control_selection_state': state,
            'control_selection_observation_ref': value.measured.facts['control_outline_observation_ref'],
            'candidate_interface_is_directional': candidate.action_ref in directional,
            'candidate_is_direct_body_selection_point': hit,
            'known_direct_selection_target_present': bool(point_action in value.world.available_action_refs and groups),
            'candidate_body_has_corresponding_palette_peer': any(
                body['frame_ref'] != peer['frame_ref']
                and body['unique_modal_interior_value'] == peer['border_value']
                and body['frame_bbox'][2]-body['frame_bbox'][0] == peer['frame_bbox'][2]-peer['frame_bbox'][0]
                and body['frame_bbox'][3]-body['frame_bbox'][1] == peer['frame_bbox'][3]-peer['frame_bbox'][1]
                for body in hits for peer in value.measured.groups),
            'candidate_hits_measured_rigid_interior': hit})
    return append_candidate_measurements(agenda, FrozenMap(measurements), FrozenMap({
        'control_selection_state': state,
        'rigid_geometry_revalidation_ref': source['rigid_geometry_revalidation_ref'],
        'control_selection_observation_ref': value.measured.facts['control_outline_observation_ref'],
        'control_selection_current_frame_ref': value.world.current_observation_frame_ref,
        'control_selection_selected_frame_ref': value.measured.facts['current_control_outline_frame_ref'],
        'control_selection_model_evidence_refs': value.measured.facts['control_outline_model_evidence_refs'],
        'control_selection_is_conditional_on_retained_model': state != 'unknown'}))
