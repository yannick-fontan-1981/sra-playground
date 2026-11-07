"""Typed observations and Source-bound component-network calculations."""

from pydantic import Field

from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, stable_digest
from .contracts import InteractionProbeInput, InteractionProbeAgenda
from .frame import materialize_retained_periodic_cell_grid
from .complete_patch_replacement import measure_complete_patch_replacement
from .component_network_mechanics import (
    patch_rows, measure_units, evaluate_profile, calculate_route_words,
)
from .agenda_measurement_transport import append_candidate_measurements


class ComponentNetworkProposal(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.ComponentNetworkProposal.v1"
    request: InteractionProbeInput
    agenda: InteractionProbeAgenda
    measurement_ref: Ref
    prior_model_rows: tuple[FrozenMap, ...] = Field(default=(), max_length=4)
    geometry: tuple = ()
    editable_patch: tuple[tuple[int, ...], ...] = ()
    domain_bounds: tuple[int, ...] = ()
    records: tuple[FrozenMap, ...] = ()
    facts: FrozenMap


class ComponentNetworkMeasurement(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.ComponentNetworkMeasurement.v1"
    request: InteractionProbeInput
    agenda: InteractionProbeAgenda
    prior_model_rows: tuple[FrozenMap, ...] = Field(default=(), max_length=4)


class ComponentNetworkScope(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.ComponentNetworkScope.v1"
    proposal: ComponentNetworkProposal
    source_disposition_ref: Ref
    source_alternative_facts: FrozenMap


class ComponentNetworkModels(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.ComponentNetworkModels.v1"
    proposal: ComponentNetworkProposal
    contract: FrozenMap
    alternative_refs: tuple[Ref, ...]
    model_rows: FrozenMap
    facts: FrozenMap


class ComponentNetworkRouteRequest(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.ComponentNetworkRouteRequest.v1"
    calculation: ComponentNetworkModels
    source_model_ref: Ref
    source_alternative_facts: FrozenMap


class ComponentNetworkRoutes(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.ComponentNetworkRoutes.v1"
    calculation: ComponentNetworkModels
    source_model_ref: Ref
    model: FrozenMap
    alternative_refs: tuple[Ref, ...]
    route_rows: FrozenMap
    facts: FrozenMap
    meaning_facts: FrozenMap
    evidence_refs: tuple[Ref, ...]


class ComponentNetworkAdmission(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.ComponentNetworkAdmission.v1"
    calculation: ComponentNetworkRoutes
    source_route_ref: Ref
    source_alternative_facts: FrozenMap


def measure_component_network(value: ComponentNetworkMeasurement) -> ComponentNetworkProposal:
    v = value.request
    cfg = v.route_generation_policy.get('component_network_measurement_contract', {})
    remaining = v.resource_contact_quantity_measurements.get('remaining_quotient')
    evidence = tuple(v.resource_contact_quantity_measurements.get('source_claim_refs', ()))
    facts = {'network_geometry_scope_unique':False,
        'network_resource_measurement_present':isinstance(remaining, int) and remaining >= 0 and bool(evidence),
        'committed_plan_present':bool(value.agenda.context_facts.get('committed_plan_present')),
        'scope_counter':str(v.observed_level_index), 'prior_model_present':len(value.prior_model_rows) == 1}
    arguments = {'request':v, 'agenda':append_candidate_measurements(value.agenda, FrozenMap(),
            FrozenMap({'component_network_active_plan_present':False})), 'prior_model_rows':value.prior_model_rows,
        'measurement_ref':f'measurement.component_network.{stable_digest((v.current_observation_ref, v.observed_level_index))}',
        'facts':FrozenMap(facts)}
    if cfg.get('retain_loci') is not True or len(value.prior_model_rows) > 1:
        return ComponentNetworkProposal(**arguments)
    geometry, old, bounds, grid = (), (), (), None
    prior_same_instance = (len(value.prior_model_rows) == 1
        and value.prior_model_rows[0].get('level_index', v.observed_level_index) == v.observed_level_index)
    facts['network_prior_instance_scope_matches'] = prior_same_instance
    if len(value.prior_model_rows) == 1:
        retained = value.prior_model_rows[0]['model']
        geometry = tuple(retained['geometry'])
        old = tuple(tuple(row) for row in retained['editable_patch'])
        bounds = tuple(retained['domain_bounds'])
        measured = materialize_retained_periodic_cell_grid(v.frame, geometry)
        if len(measured.candidates) == 1:
            grid = measured.candidates[0]
            if not prior_same_instance:
                if cfg.get('rebind_changed_instance_from_current_signature') is not True:
                    grid = None
                else:
                    support = tuple(c for c in grid.cells if patch_rows(v.frame, c.bbox) == old)
                    if support:
                        bounds = (min(c.row for c in support), min(c.col for c in support),
                            max(c.row for c in support), max(c.col for c in support))
                    else:
                        grid = None
    else:
        descriptors, complete = measure_complete_patch_replacement(v,
            v.route_generation_policy.get('recent_complete_patch_replacement_contract', {}))
        refs = frozenset(key[0] for key in descriptors)
        grids = tuple(g for g in v.periodic_cell_grids.candidates if g.candidate_ref in refs)
        if complete and len(grids) == 1 and v.previous_action_observed_frame is not None:
            grid = grids[0]
            geometry = (grid.candidate_ref, grid.row_offset, grid.col_offset,
                grid.cell_height, grid.cell_width, grid.row_pitch, grid.col_pitch,
                grid.logical_rows, grid.logical_columns)
            cells = tuple(c for c in grid.cells if c.bbox.top <= v.last_point_position[0] <= c.bbox.bottom
                and c.bbox.left <= v.last_point_position[1] <= c.bbox.right)
            if len(cells) == 1:
                old = patch_rows(v.previous_action_observed_frame, cells[0].bbox)
                support = tuple(c for c in grid.cells
                    if patch_rows(v.frame, c.bbox) == old or c == cells[0])
                bounds = (min(c.row for c in support), min(c.col for c in support),
                    max(c.row for c in support), max(c.col for c in support))
    if grid is None or not old or not bounds or len(grid.cells) > int(cfg['maximum_cell_count']):
        return ComponentNetworkProposal(**arguments)
    records = measure_units(v.frame, grid, int(cfg['maximum_marker_radius']))
    facts.update({'network_geometry_scope_unique':True, 'geometry_token':stable_digest(geometry),
        'measurement_ref':arguments['measurement_ref']})
    if value.prior_model_rows and not prior_same_instance:
        prior_row = value.prior_model_rows[0]
        matches = tuple(record for record in records if record['patch'] == old)
        measurements = {}
        for candidate in arguments['agenda'].candidates:
            point = candidate.point
            current = tuple(record for record in matches if point is not None
                and record['bbox'][0] <= point[0] <= record['bbox'][2]
                and record['bbox'][1] <= point[1] <= record['bbox'][3])
            measurements[candidate.candidate_ref] = FrozenMap({
                'component_network_recalled_editable_point_current':len(current) == 1,
                'component_network_recalled_model_ref':prior_row.get('term_ref'),
                'component_network_recalled_acquisition_observation_ref':prior_row.get('acquisition_observation_ref'),
                'component_network_recalled_signature_digest':stable_digest(old),
                'component_network_recalled_signature_current_frame_ref':v.current_observation_ref,
            })
        arguments['agenda'] = append_candidate_measurements(arguments['agenda'],
            FrozenMap(measurements), FrozenMap())
    arguments.update({'geometry':geometry, 'editable_patch':old, 'domain_bounds':bounds,
        'records':records, 'facts':FrozenMap(facts)})
    return ComponentNetworkProposal(**arguments)


def calculate_component_network_models(value: ComponentNetworkScope) -> ComponentNetworkModels:
    p = value.proposal
    if value.source_disposition_ref != 'component_network.calculate_conditional_models':
        raise ValueError('Source has not requested conditional component models')
    declared = value.source_alternative_facts[value.source_disposition_ref]
    contract = declared['network_contract']
    if contract['model_kind'] != 'monotone_component_union_pure_domain':
        raise ValueError('unsupported Source component model')
    prior = p.prior_model_rows[0]['model'] if len(p.prior_model_rows) == 1 else None
    rows, facts = {}, {}
    for profile in contract['role_profiles']:
        ref = profile['alternative_ref']
        if prior is not None and profile != prior['role_profile']:
            result = FrozenMap({'status':'unknown', 'cause':'retained_alternative_not_revalidated_by_this_query'})
        else:
            result = evaluate_profile(p.records, p.geometry, p.editable_patch, p.domain_bounds,
                profile, contract, None if prior is None else prior['empty_value'],
                prior if p.facts.get('network_prior_instance_scope_matches') else None)
            if result['status'] == 'fits' and p.request.previous_action_observed_frame is not None:
                before_grids = materialize_retained_periodic_cell_grid(
                    p.request.previous_action_observed_frame, p.geometry)
                if len(before_grids.candidates) == 1:
                    before_records = measure_units(p.request.previous_action_observed_frame,
                        before_grids.candidates[0], int(contract['maximum_marker_radius']))
                    before_model = evaluate_profile(before_records, p.geometry, p.editable_patch,
                        p.domain_bounds, profile, contract, result['empty_value'], result)
                    cross_instance = (bool(p.prior_model_rows)
                        and p.facts.get('network_prior_instance_scope_matches') is False)
                    if (before_model['status'] != 'fits'
                            and not (cross_instance and contract.get(
                                'previous_scene_is_not_current_transition_across_instance_boundary') is True)):
                        result = FrozenMap({'status':'unknown', 'cause':'prior_scene_not_in_model_domain'})
                    elif before_model['status'] == 'fits' and p.request.last_action_ref == contract['point_action_ref']:
                        point_cells = tuple(row for row in before_records
                            if row['patch'] == p.editable_patch
                            and row['bbox'][0] <= p.request.last_point_position[0] <= row['bbox'][2]
                            and row['bbox'][1] <= p.request.last_point_position[1] <= row['bbox'][3])
                        if point_cells and set(result['opened']) - set(before_model['opened']) != {point_cells[0]['index']}:
                            result = FrozenMap({'status':'contradicted', 'cause':'clicked_preimage_did_not_open_once'})
        rows[ref] = result
    positive_count = sum(rows[key]['status'] == 'fits' for key in sorted(rows))
    for ref in sorted(rows):
        facts[ref] = FrozenMap({'network_model_fits':rows[ref]['status'] == 'fits',
            'network_model_positive_count':positive_count, 'network_model_unknown':False})
    unknown_ref = contract['unknown_model_ref']
    facts[unknown_ref] = FrozenMap({'network_model_fits':False,
        'network_model_positive_count':positive_count, 'network_model_unknown':True})
    return ComponentNetworkModels(proposal=p, contract=contract,
        alternative_refs=tuple(sorted(facts)), model_rows=FrozenMap(rows), facts=FrozenMap(facts))


def calculate_component_network_routes(value: ComponentNetworkRouteRequest) -> ComponentNetworkRoutes:
    q, ref = value.calculation, value.source_model_ref
    declared = value.source_alternative_facts[ref]
    if declared.get('network_model_admitted') is not True or q.model_rows[ref]['status'] != 'fits':
        raise ValueError('Source has not admitted this current model alternative')
    p, model = q.proposal, q.model_rows[ref]
    quantity = int(p.request.resource_contact_quantity_measurements['remaining_quotient'])
    words, status = calculate_route_words(model, q.contract, quantity)
    retained = FrozenMap({key:model[key] for key in ('geometry', 'editable_patch',
        'domain_bounds', 'empty_value', 'role_profile', 'emitter_rows', 'receiver_rows')})
    evidence = tuple(p.request.resource_contact_quantity_measurements.get('source_claim_refs', ()))
    meaning_facts = FrozenMap({'model':retained, 'level_index':p.request.observed_level_index,
        'scope_counter':str(p.request.observed_level_index),
        'geometry_token':stable_digest(p.geometry),
        'model_token':stable_digest((q.contract, tuple((key, retained[key]) for key in
            ('geometry', 'editable_patch', 'domain_bounds', 'empty_value', 'role_profile')),
            tuple((row['index'], row['value'], row['radius']) for row in retained['emitter_rows']),
            tuple((row['index'], row['value'], row['radius']) for row in retained['receiver_rows']))),
        'measurement_ref':p.measurement_ref,
        'frame_ref':p.request.current_observation_ref,
        'frame_token':stable_digest(p.request.current_observation_ref),
        'resource_claim_refs':evidence, 'remaining_quantity':quantity,
        'network_model_positive_count':1,
        'prior_model_present':bool(p.prior_model_rows) and p.facts.get('network_prior_instance_scope_matches') is True})
    rows, facts = {}, {}
    for word in words:
        route_ref = f'measurement.component_network_word.{word["word_digest"]}'
        rows[route_ref] = word
        facts[route_ref] = FrozenMap.overlay({'network_complete_word':True,
            'network_word_primitive_count':word['primitive_count'],
            'network_word_description_ordinal':word['description_ordinal'],
            'word_ref':route_ref, 'word_token':word['word_digest'],
            'word_cells':word['new_cell_indices'],
            'network_all_prefixes_valid':word['all_prefixes_valid'],
            'network_word_unknown':False}, meaning_facts)
    unknown_ref = q.contract['unknown_route_ref']
    facts[unknown_ref] = FrozenMap({'network_complete_word':False,
        'network_word_primitive_count':0, 'network_word_description_ordinal':0,
        'network_word_unknown':True})
    return ComponentNetworkRoutes(calculation=q, source_model_ref=ref, model=model,
        alternative_refs=tuple(sorted(facts)), route_rows=FrozenMap(rows), facts=FrozenMap(facts),
        meaning_facts=meaning_facts, evidence_refs=evidence)


def append_component_network(value: ComponentNetworkAdmission) -> InteractionProbeAgenda:
    q, route_ref = value.calculation, value.source_route_ref
    declared = value.source_alternative_facts[route_ref]
    if declared.get('network_word_admitted') is not True or route_ref not in q.route_rows:
        raise ValueError('Source has not admitted a complete current network witness')
    p = q.calculation.proposal
    word = q.route_rows[route_ref]
    first = int(word['new_cell_indices'][0])
    record = p.records[first]
    if first not in q.model['editable'] or first in q.model['opened']:
        raise ValueError('the admitted first unit is not currently new editable support')
    point = tuple(record['point'])
    word_indices = tuple(int(index) for index in word['new_cell_indices'])
    action_ref = str(q.calculation.contract['point_action_ref'])
    if (len(word_indices) != int(word['primitive_count'])
            or len(set(word_indices)) != len(word_indices)
            or action_ref not in p.request.available_action_refs
            or any(index not in q.model['editable'] or index in q.model['opened']
                for index in word_indices)):
        raise ValueError('the admitted word has inconsistent current payload bindings')
    # Bind the complete already-calculated word mechanically. DRM/SRC decides
    # whether its conditional model authorizes a sealed execution series.
    word_action_refs = tuple(action_ref for _index in word_indices)
    word_action_payloads = tuple(FrozenMap({
        'x':int(p.records[index]['point'][1]),
        'y':int(p.records[index]['point'][0]),
    }) for index in word_indices)
    from .interaction import _point_candidates, _attach_current_open_cavity_measurements
    from .open_cavity import measure_open_cavity_stop_geometry

    added = _point_candidates(p.request, frozenset(p.request.current_context_no_effect_candidate_refs),
        frozenset(p.request.tested_candidate_refs_without_resolution_plan),
        dict(p.agenda.context_facts), {}, {}, {}, requested_points=(point,))
    candidates = {candidate.candidate_ref:candidate for candidate in p.agenda.candidates}
    facts, deltas = dict(p.agenda.alternative_facts), dict(p.agenda.descriptive_delta_facts)
    for candidate, measured in added:
        if candidate.point != point:
            continue
        candidates[candidate.candidate_ref] = candidate
        facts[candidate.candidate_ref] = FrozenMap.overlay(measured, p.agenda.context_facts)
        deltas[candidate.candidate_ref] = measured
    ordered = tuple(candidates[key] for key in sorted(candidates))
    received_refs = frozenset(p.agenda.alternative_refs)
    added_refs = frozenset(candidates) - received_refs
    # Source has already admitted this word. Bound this producer's extension,
    # preserving the received frontier rather than applying its cold-probe
    # budget again to the combined agenda. No sibling or payload is evicted.
    if (len(added_refs) > int(q.calculation.contract['maximum_admitted_point_additions'])
            or not received_refs.issubset(candidates)
            or any(candidates[ref].point != point for ref in sorted(added_refs))):
        raise ValueError('network witness exceeds its declared point-extension contract')
    extended = p.agenda.model_copy(update={'candidates':ordered,
        'alternative_refs':tuple(candidate.candidate_ref for candidate in ordered),
        'alternative_facts':FrozenMap(facts), 'descriptive_delta_facts':FrozenMap(deltas),
        'has_candidates':bool(ordered)})
    measurements = {}
    for candidate in ordered:
        measurements[candidate.candidate_ref] = FrozenMap({
            'component_network_first_word_point':candidate.point == point,
            'component_network_word_primitive_count':word['primitive_count'],
            'component_network_demand_count':len(q.model['demands']),
            'component_network_measurement_ref':p.measurement_ref,
            'component_network_word_ref':route_ref,
            'component_network_model_ref':declared['component_network_model_term_ref'],
            'component_network_hypothesis_ref':q.calculation.contract['model_ref'],
            'component_network_model_claim_ref':declared['component_network_model_claim_ref'],
            'component_network_model_signature':declared['model_token'],
            'component_network_witness_claim_ref':declared['component_network_witness_claim_ref'],
            'component_network_premise_claim_refs':declared['component_network_premise_claim_refs'],
            'component_network_expectation_ref':declared['component_network_expectation_ref'],
            'component_network_experiment_ref':declared['component_network_experiment_ref'],
            'component_network_scope_counter':declared['scope_counter'],
            'component_network_current_frame_ref':declared['frame_ref'],
            'component_network_all_prefixes_valid':word['all_prefixes_valid'],
            'component_network_word_action_refs':(
                word_action_refs if candidate.point == point else ()),
            'component_network_word_action_payloads':(
                word_action_payloads if candidate.point == point else ()),
            'component_network_all_word_payloads_bound':(
                candidate.point == point and not q.model.get('unacquired_origin_sets')),
            'component_network_model_alternative_ref':q.source_model_ref,
        })
    annotated = append_candidate_measurements(extended, FrozenMap(measurements), FrozenMap({
        'component_network_active_plan_present':True,
        'component_network_calculation':{'measurement_ref':p.measurement_ref,
            'model_alternative_ref':q.source_model_ref, 'word_ref':route_ref,
            'word_primitive_count':word['primitive_count'], 'goal_count':len(q.model['demands'])}}))

    return _attach_current_open_cavity_measurements(annotated,
        FrozenMap(measure_open_cavity_stop_geometry(p.request)))
