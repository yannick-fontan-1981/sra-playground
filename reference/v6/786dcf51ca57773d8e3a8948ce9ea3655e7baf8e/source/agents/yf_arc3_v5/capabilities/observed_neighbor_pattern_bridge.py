"""Measured partial correlations transported to the existing layout/BFS services.

Source admits the model, declares its laws and remembers its evidence. This
adapter never promotes a partial table to a complete mechanic, fabricates a
resource, chooses an action or grants a permit.
"""
from itertools import permutations
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, stable_digest
from .contracts import (InteractionProbeInput, InteractionProbeAgenda, InteractionProbeCandidate,
    FrameGrid, ReachabilityInput, StepVector)
from .mechanical_family_contracts_d import DMechanicalScope, DMechanicalResult, d_map
from .neighborhood_pattern_construction import (NeighborhoodPatternRequest, NeighborhoodModel,
    NeighborhoodState, NeighborhoodOccurrence, NeighborhoodSite, NeighborhoodLayout)
from .observed_neighbor_color_geometry import (measure_observed_neighbor_color_geometry,
    snapshot_neighbor_color_geometry, revalidate_neighbor_color_geometry)
from .routing import finite_grid_reachability
from .agenda_measurement_transport import append_candidate_measurements


class ObservedNeighborProposal(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.observed_neighbor_proposal.v1'
    world: InteractionProbeInput
    agenda: InteractionProbeAgenda
    measurement: FrozenMap = Field(default_factory=FrozenMap)
    facts: FrozenMap
    evidence_refs: tuple[Ref, ...] = ()
    actions: tuple[Ref, ...] = ()
    parent_goal_ref: Ref | None = None
    epoch: int = 0


class ObservedNeighborMeasurementInput(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.observed_neighbor_measurement_input.v1'
    world: InteractionProbeInput
    agenda: InteractionProbeAgenda


class ObservedNeighborBindingInput(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.observed_neighbor_binding_input.v1'
    proposal: ObservedNeighborProposal
    source_disposition_ref: Ref
    source_alternative_facts: FrozenMap


class ObservedNeighborReturnInput(ObservedNeighborBindingInput):
    schema_version: Ref = 'yf_arc3_v5.observed_neighbor_return_input.v1'
    result: DMechanicalResult


def measure_observed_neighbor_proposal(value):
    world, agenda = value.world, value.agenda
    contract = world.neighbor_color_measurement_contract
    empty = {'geometry_complete': False, 'new_sample_record_present': False}
    if not contract:
        return ObservedNeighborProposal(world=world, agenda=agenda, facts=d_map(empty))
    records = tuple(row for row in world.canonical_neighbor_color_method_facts
        if row.get('level_epoch') == world.rigid_marker_epoch)
    recalled_claims = ()
    if len(records) == 1:
        measured = revalidate_neighbor_color_geometry(world, records[0]['measurement'], contract)
        payload = records[0]['measurement']
        digest = records[0]['method_digest']
        parent_terminal = records[0].get('parent_terminal_goal_ref')
        fresh = bool(measured.get('geometry_complete') and
            measured['functional_sample_table'] != payload['functional_sample_table'])
        if fresh:
            payload = {**payload, 'functional_sample_table': measured['functional_sample_table'],
                'sample_claim_digest':stable_digest((digest,measured['functional_sample_table']))}
        recalled_claims = tuple(records[0].get('role_premise_claim_refs', ()))
    elif records:
        measured, payload, digest, fresh = {'geometry_complete': False}, {}, None, False
        parent_terminal = None
    else:
        previous = tuple(row for row in world.canonical_neighbor_color_method_facts
            if row.get('level_epoch') != world.rigid_marker_epoch)
        prior = previous[0] if len(previous) == 1 and contract.get('allow_revalidated_partial_table_recall') else None
        measured = measure_observed_neighbor_color_geometry(world, contract,
            prior['measurement'] if prior is not None else None)
        complete = measured.get('geometry_complete') and len(measured['frame_pair_candidates']) == 1
        payload = snapshot_neighbor_color_geometry(world, measured) if complete else {}
        digest, fresh = stable_digest((world.rigid_marker_epoch, payload)), bool(complete)
        parent_terminal = world.incoming_declared_action_lifecycle_facts.get('previous_action_lifecycle_terminal_goal_ref') or None
        recalled_claims = tuple(prior.get('role_premise_claim_refs', ())) if prior is not None and complete else ()
    complete = bool(measured.get('geometry_complete') and len(measured.get('frame_pair_candidates', ())) == 1)
    return ObservedNeighborProposal(world=world, agenda=agenda, measurement=d_map(measured) if complete else FrozenMap(),
        actions=world.available_action_refs, parent_goal_ref=parent_terminal or world.active_subgoal_ref,
        epoch=world.current_context_epoch,
        evidence_refs=(world.current_observation_frame_ref,) if world.current_observation_frame_ref else (),
        facts=d_map({'geometry_complete': complete,
            'new_sample_record_present': fresh, 'method_digest': digest,
            'method_claim_digest': payload.get('sample_claim_digest', digest),
            'level_epoch': world.rigid_marker_epoch, 'measurement': payload,
            'recalled_method_claim_refs': recalled_claims,
            'parent_terminal_goal_ref': parent_terminal,
            'parent_terminal_goal_ref_present': parent_terminal is not None,
            'member_count': len(measured.get('current_non_support_cells', ())),
            'current_known_neighbor_samples_consistent': complete,
            'current_unmapped_neighbor_sample_count': len(
                measured.get('current_unmapped_neighbor_samples', ())),
            'current_sample_revalidation_cause': measured.get('cause'),
            'reference_empty_margins_preserved': complete}))


def bind_observed_neighbor_request(value):
    p = value.proposal
    facts = value.source_alternative_facts.get(value.source_disposition_ref, FrozenMap())
    spec = facts.get('neighbor_model_contract')
    if not facts.get('applicable') or not spec or not p.measurement or not p.evidence_refs:
        raise ValueError('Source must admit the measured partial neighbor model')
    g = p.measurement
    pair, = g['frame_pair_candidates']
    digest = p.facts['method_digest']
    ref = 'measurement.neighbor_pattern.' + digest
    current = tuple((tuple(cell), pigment) for cell, pigment in g['current_non_support_cells'])
    active = tuple(g['current_proxy_cell'])
    occurrences = tuple(NeighborhoodOccurrence(occurrence_ref=ref + '.cell.' + str(i), cell=cell)
        for i, (cell, _) in enumerate(current))
    model = NeighborhoodModel(model_ref=ref, movement_cells=tuple(tuple(c) for c in g['sampled_cells']),
        neighborhood_offsets=tuple(tuple(c) for c in g['offset_domain']), neighborhood_evidence_ref=ref,
        color_key_law_ref=spec['color_key_law_ref'], color_map=tuple(tuple(x) for x in g['functional_sample_table']),
        empty_value=pair['empty_value_candidate'], sites=(NeighborhoodSite(site_ref=pair['field']['frame_ref'],
            origin=tuple(pair['field_origin']), height=pair['field']['cell_rows'], width=pair['field']['cell_columns'],
            comparison_mask=tuple((r,c) for r in range(pair['field']['cell_rows']) for c in range(pair['field']['cell_columns'])),
            crop_law_ref=spec['crop_law_ref'], evidence_ref=pair['field']['frame_ref']),),
        reference=FrameGrid(rows=tuple(tuple(row) for row in pair['reference']['rows'])),
        reference_evidence_ref=pair['reference']['frame_ref'])
    parent = p.parent_goal_ref or facts['goal_ref']
    scope = DMechanicalScope(request_ref=ref, caller_ref='arc3.interaction_probe_enumeration',
        parent_consumer_ref=parent, parent_goal_ref=parent, parent_contribution_ref=ref,
        caller_next_item_ref=facts['caller_next_item_ref'], epoch=p.epoch,
        evidence_revision_ref=p.evidence_refs[0], model_revision_ref=stable_digest(model),
        model_status_ref=facts['model_status_ref'], event_owner_ref=ref, input_domain_complete=True,
        assumption_refs=tuple(facts['assumption_refs']))
    return NeighborhoodPatternRequest(scope=scope, operation_ref=spec['operation_ref'], mode_ref='DOMAIN',
        requested_result_type='DMechanicalResult', node_bound=100000, depth_bound=32,
        domain_bound=4096, time_bound_ms=2000, models=(model,),
        state=NeighborhoodState(occurrences=occurrences,
            active_occurrence_ref=next(x.occurrence_ref for x in occurrences if x.cell==active),
            reserve=None, terminated=False),
        layouts=(NeighborhoodLayout(layout_ref=ref + '.reference_occupancy',
            occupied_cells=tuple(tuple(c) for c in pair['nonempty_reference_positions'])),))


def _route(start, end, blocker, cells, geometry, steps, other_blockers=()):
    blocked = frozenset((blocker, *other_blockers))
    if end in blocked:
        return None
    if other_blockers:
        # Reuse the existing goal-only BFS for a multi-member witness. The
        # legacy pair retains its full reachability result and traversal order.
        from .interaction import _bfs_residual_path
        allowed = frozenset(cells)-blocked
        if start not in allowed or end not in allowed:
            return None
        path = _bfs_residual_path(residual_row=2*(end[0]-start[0]),
            residual_col=2*(end[1]-start[1]),
            action_deltas={s.label:(s.delta_row,s.delta_col) for s in steps},
            couple=(1,1),max_depth=max(1,len(allowed)-1),max_states=len(allowed),
            legal_step=lambda before,after: (
                end[0]-after[0]//2,end[1]-after[1]//2) in allowed)
        return path if path or start==end else None
    result = finite_grid_reachability(ReachabilityInput(rows=geometry[6],columns=geometry[7],
        start=start,traversable=tuple(c for c in cells if c not in blocked),goals=(end,),steps=steps))
    goal, = result.goals
    return goal.first_shortest_step_labels if goal.reachable else None


def append_observed_neighbor_options(value):
    binding, result = value, value.result
    p = binding.proposal
    facts = binding.source_alternative_facts[binding.source_disposition_ref]
    rows = result.values.get('model_correlated_results', ())
    if not result.domain_complete or len(rows)!=1:
        return p.agenda
    layouts = rows[0]['result'].get('site_layout_results', ())
    if len(layouts)!=1 or not layouts[0]['matching_site_refs']:
        return p.agenda
    g = p.measurement
    pair, = g['frame_pair_candidates']
    cells = tuple(tuple(c) for c in g['sampled_cells'])
    occupied = tuple(tuple(cell) for cell,_ in g['current_non_support_cells'])
    if len(occupied)<2:
        return p.agenda
    active = tuple(g['current_proxy_cell'])
    geometry = tuple(g['grid_geometry'])
    steps = tuple(StepVector(label=a,delta_row=r,delta_col=c)
        for a,r,c in facts['neighbor_model_contract']['action_steps'] if a in p.actions)
    slots = tuple(tuple(c) for c in pair['nonempty_reference_positions'])
    options = []
    transport_bounds = {}
    if len(occupied)==2:
        for order in permutations(occupied):
            first, second = order
            for goals in permutations(slots):
                a,b = goals
                path_a = _route(first,a,second,cells,geometry,steps)
                path_b = _route(second,b,a,cells,geometry,steps) if path_a is not None else None
                if path_a is None or path_b is None:
                    continue
                next_body = first if path_a else second
                word = path_a or path_b
                if not word:
                    continue
                select = next_body!=active
                # Exact command count for this staged two-member witness. It is
                # not an optimality certificate over all interleaved schedules.
                switches = int(first!=active) if path_a else 0
                switches += int(bool(path_b) and (bool(path_a) or second!=active))
                options.append((next_body,word,len(path_a)+len(path_b)+switches,select))
    else:
        contract = p.world.neighbor_color_measurement_contract
        witness_limit = contract['maximum_transport_witnesses']
        if (not 1 <= witness_limit <= 3 or active not in occupied
                or len(slots)!=len(occupied) or len(set(slots))!=len(slots)
                or len(occupied)>contract['maximum_member_count']):
            return p.agenda
        # Retain at most three SUCCESSFUL witnesses. Failed schedules continue
        # through the lazy domain under the same shared construction allowance.
        remaining_work = (contract['maximum_work']
            - g['enclosed_frame_work_count'] - result.examined_count)
        setup_work = 16*(len(cells)+len(occupied)+len(steps)+1)
        if remaining_work < setup_work:
            return append_candidate_measurements(p.agenda,FrozenMap(),d_map({
                'observed_neighbor_pattern_return':{'status':result.status,
                    'domain_complete':result.domain_complete,'method_digest':p.facts['method_digest'],
                    'option_count':0,'partial_model_only':True,
                    'staged_route_witness_domain_complete':False,
                    'staged_route_search_work_bound_reached':True,
                    'staged_route_pending_frontier':{'cause':'setup_work_not_available',
                        'executable':False,'remaining_work':remaining_work}}}))
        remaining_work -= setup_work
        # Domain/blocker scans, action sorting, all node/edge visits and legal
        # callbacks, then one linear predecessor reconstruction. No all-target
        # ancestry phase is called in this branch. Include per-order setup too.
        route_work = (4*max(1,len(cells))*(len(steps)+1)
            + 4*(len(cells)+len(occupied)+len(steps)**2+1))
        schedule_work = 8*len(occupied)+8
        work_bound_reached = False
        attempted_schedules = 0
        pending_frontier = None
        last_rejection = None
        input_digest = stable_digest((occupied,slots,active,cells,
            tuple((s.label,s.delta_row,s.delta_col) for s in steps),p.facts['method_digest']))
        for goals in permutations(slots):
            for order in permutations(range(len(occupied))):
                if remaining_work < schedule_work:
                    work_bound_reached = True
                    pending_frontier = {'input_digest':input_digest,'goals':goals,
                        'order':order,'next_stage':0,'cause':'schedule_work_not_available',
                        'executable':False,'remaining_work':remaining_work}
                    break
                remaining_work -= schedule_work
                attempted_schedules += 1
                positions = list(occupied)
                selected = occupied.index(active)
                first_command = None
                distance = 0
                for stage,index in enumerate(order):
                    if remaining_work < route_work:
                        work_bound_reached = True
                        pending_frontier = {'input_digest':input_digest,'goals':goals,
                            'order':order,'next_stage':stage,'positions':tuple(positions),
                            'selected_index':selected,'first_command':first_command,
                            'distance':distance,'cause':'complete_route_work_not_available',
                            'executable':False,'remaining_work':remaining_work}
                        break
                    remaining_work -= route_work
                    blockers = tuple(cell for i,cell in enumerate(positions) if i!=index)
                    path = _route(positions[index],goals[index],blockers[0],cells,
                        geometry,steps,other_blockers=blockers[1:])
                    if path is None:
                        last_rejection = {'goals':goals,'order':order,'stage':stage,
                            'cause':'destination_occupied' if goals[index] in blockers
                                else 'no_route_in_current_joint_occupancy'}
                        break
                    if path:
                        select = selected!=index
                        if first_command is None:
                            first_command = (occupied[index],path,select)
                        distance += len(path)+int(select)
                        selected = index
                    positions[index] = goals[index]
                else:
                    if first_command is not None:
                        body,word,select = first_command
                        options.append((body,word,distance,select))
                if work_bound_reached or len(options)>=witness_limit:
                    break
            if work_bound_reached or len(options)>=witness_limit:
                break
        # Only the current member's measured word is transported. Source owns
        # whether to release that word or a singleton; later members are not
        # pre-authorized. Missing witnesses do not rule out temporary moves.
        transport_bounds = {'staged_route_witness_domain_complete':False,
            'staged_route_search_work_bound_reached':work_bound_reached,
            'staged_route_witness_limit_reached':len(options)>=witness_limit,
            'staged_route_schedule_count':attempted_schedules,
            'staged_route_remaining_work':remaining_work,
            'staged_route_pending_frontier':pending_frontier,
            'staged_route_last_rejection':last_rejection,
            'full_population_occupancy_preserved':bool(options)}
    if not options:
        if transport_bounds:
            return append_candidate_measurements(p.agenda,FrozenMap(),d_map({
                'observed_neighbor_pattern_return':{'status':result.status,
                    'domain_complete':result.domain_complete,'method_digest':p.facts['method_digest'],
                    'option_count':0,'partial_model_only':True,**transport_bounds}}))
        return p.agenda
    candidates = {c.candidate_ref:c for c in p.agenda.candidates}
    alternatives, deltas = dict(p.agenda.alternative_facts), dict(p.agenda.descriptive_delta_facts)
    measured = {}
    directional_refs = {a:tuple(ref for ref in sorted(candidates)
        if candidates[ref].action_ref==a and candidates[ref].point is None)
        for a in p.actions}
    known_steps = {a:(r,c) for a,r,c in p.world.known_action_translation_deltas}
    expected_steps = {s.label:(s.delta_row*geometry[4],s.delta_col*geometry[5]) for s in steps}
    empty_payload = FrozenMap()
    minimum_count = min(option[2] for option in options)
    for body,word,distance,select in options:
        if select:
            action = facts['neighbor_model_contract']['point_action_ref']
            if action not in p.actions:
                continue
            y = geometry[0] + body[0]*geometry[4] + (geometry[2]-1)//2
            x = geometry[1] + body[1]*geometry[5] + (geometry[3]-1)//2
            from .interaction import _point_candidates
            added = _point_candidates(p.world, frozenset(p.world.current_context_no_effect_candidate_refs),
                frozenset(p.world.tested_candidate_refs_without_resolution_plan), dict(p.agenda.context_facts),
                {}, {}, {}, requested_points=((y,x),))
            refs = []
            for candidate, point_measurement in added:
                if candidate.point!=(y,x) or candidate.action_ref!=action:
                    continue
                ref=candidate.candidate_ref
                if ref not in candidates:
                    candidates[ref]=candidate
                    alternatives[ref]=FrozenMap.overlay(point_measurement,p.agenda.context_facts)
                    deltas[ref]=point_measurement
                refs.append(ref)
        else:
            refs = tuple(ref for ref in sorted(candidates) if candidates[ref].action_ref==word[0] and candidates[ref].point is None)
        for ref in refs:
            prior = measured.get(ref)
            if prior is None or distance < prior['neighbor_staged_primitive_count']:
                full_word = len(occupied)>2 and not select and all(
                    len(directional_refs.get(a,()))==1 and known_steps.get(a)==expected_steps[a]
                    and not candidates[directional_refs[a][0]].action_data
                    for a in word)
                word_refs = tuple(directional_refs[a][0] for a in word) if full_word else ()
                measured[ref] = FrozenMap({'neighbor_reference_placement_step_measured':True,
                    'neighbor_member_count':len(occupied),
                    'neighbor_current_member_path_complete':full_word,
                    'neighbor_current_member_path_action_refs':word if full_word else (),
                    'neighbor_current_member_path_candidate_refs':word_refs,
                    'neighbor_current_member_path_payloads':tuple(empty_payload for _ in word) if full_word else (),
                    'neighbor_current_member_path_step_count':len(word) if full_word else 1,
                    'neighbor_staged_primitive_count':distance,'neighbor_selection_probe':select,
                    'neighbor_staged_primitive_count_equals_minimum':distance==minimum_count,
                    'neighbor_method_digest':p.facts['method_digest'],
                    'neighbor_current_calculation_evidence_ref':p.evidence_refs[0],
                    'incoming_declared_route_engagement_present':p.world.incoming_declared_route_engagement_present,
                    'neighbor_incoming_goal_matches_placement':(
                        p.world.incoming_declared_action_lifecycle_facts.get('previous_action_lifecycle_goal_ref')==facts['goal_ref']
                        and p.world.incoming_declared_action_lifecycle_facts.get('previous_action_lifecycle_terminal_goal_ref')==facts['effective_terminal_goal_ref']),
                    'neighbor_partial_table_currently_revalidated':True,
                    'neighbor_method_assumption_refs':result.scope.assumption_refs,
                    'neighbor_source_method_claim_refs':tuple(facts['neighbor_method_claim_refs']),
                    'neighbor_calculation_parent_goal_ref':result.scope.parent_goal_ref,
                    'neighbor_terminal_goal_ref':facts['effective_terminal_goal_ref'],
                    'neighbor_current_occurrences':occupied,'neighbor_comparison_site_ref':pair['field']['frame_ref']})
    ordered = tuple(candidates[ref] for ref in sorted(candidates))
    agenda = p.agenda.model_copy(update={'candidates':ordered,'alternative_refs':tuple(c.candidate_ref for c in ordered),
        'alternative_facts':FrozenMap(alternatives),'descriptive_delta_facts':FrozenMap(deltas),
        'has_candidates':bool(ordered)})
    agenda = append_candidate_measurements(agenda,FrozenMap(measured),d_map({
        'observed_neighbor_pattern_return':{'status':result.status,'domain_complete':result.domain_complete,
            'method_digest':p.facts['method_digest'],'option_count':len(options),
            'partial_model_only':True,'source_parent_goal_ref':result.scope.parent_goal_ref,
            **transport_bounds}}))
    # Late-added point candidates must pass through the same current geometry
    # projection as the original inventory before SRC reads its total Boolean.
    from .interaction import _attach_current_open_cavity_measurements
    return _attach_current_open_cavity_measurements(agenda, p.agenda.context_facts)
