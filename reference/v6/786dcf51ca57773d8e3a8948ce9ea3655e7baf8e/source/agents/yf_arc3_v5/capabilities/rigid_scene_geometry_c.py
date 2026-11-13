"""Bounded current frame groups and lattice incidences, without object roles.

Colour values are compared only as current render measurements. Source owns
whether a group is a body, a receiver, a floor, or merely a visual frame.
"""
from collections import Counter
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, stable_digest
from .contracts import InteractionProbeInput, InteractionProbeAgenda
from .framed_masks import measure_enclosed_frame_groups


class RigidSceneGeometryInputC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.rigid_scene_geometry_input_c.v1'
    world: InteractionProbeInput
    source_bound_anchor_frame_ref: Ref | None = None
    source_bound_underlay_value: int | None = None
    source_recalled_collision_evidence_refs: tuple[Ref, ...] = ()
    maximum_work: int = Field(ge=1, le=1048576)
    maximum_frame_pixels: int = Field(default=4096, ge=1, le=65536)
    maximum_component_count: int = Field(default=256, ge=1, le=4096)
    maximum_framed_occurrences: int = Field(default=64, ge=1, le=256)
    minimum_mask_extent: int = Field(default=2, ge=1, le=64)
    maximum_mask_extent: int = Field(default=64, ge=1, le=256)
    minimum_mask_area: int = Field(default=4, ge=1, le=65536)


class RigidSceneGeometryC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.rigid_scene_geometry_c.v1'
    epoch: int
    frame_ref: Ref | None
    groups: tuple[FrozenMap, ...]
    aligned_groups: tuple[FrozenMap, ...]
    quantum: int | None
    lattice_phase: tuple[int, int] | None
    unique_motion_frame_ref: Ref | None
    source_revalidated_control_frame_ref: Ref | None = None
    equal_extent_palette_peer_refs: tuple[Ref, ...]
    uniform_core_cells: tuple[tuple[int, int, int], ...]
    unique_modal_underlay_core_value: int | None
    edge_patch_measurements: tuple[FrozenMap, ...] = ()
    common_cell_domain: tuple[tuple[int, int], ...] = ()
    palette_peer_cells: tuple[tuple[int, int], ...] = ()
    facts: FrozenMap
    parent_goal_ref: Ref | None = None
    prior_intent_ref: Ref | None = None
    interface_vectors: tuple[tuple[Ref, int, int], ...] = ()
    prior_contact_measurements: tuple[FrozenMap, ...] = Field(default=(), max_length=64)


class RigidSceneProposalInputC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.rigid_scene_proposal_input_c.v1'
    world: InteractionProbeInput
    agenda: InteractionProbeAgenda
    maximum_work: int = Field(ge=1, le=1048576)


class RigidSceneProposalC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.rigid_scene_proposal_c.v1'
    world: InteractionProbeInput
    agenda: InteractionProbeAgenda
    measured: RigidSceneGeometryC


def measure_rigid_scene_proposal(value: RigidSceneProposalInputC) -> RigidSceneProposalC:
    return RigidSceneProposalC(world=value.world,agenda=value.agenda,
        measured=measure_rigid_scene_geometry(RigidSceneGeometryInputC(world=value.world,maximum_work=value.maximum_work)))


def _edge_patch_changes(world, maximum_work):
    """Arithmetic progressions of equal edge patches; no resource role."""
    before = world.previous_action_observed_frame
    if before is None or (before.height,before.width) != (world.frame.height,world.frame.width):
        return (), 0, True
    groups = {}
    work = 0
    for component in world.components.components:
        work += 1
        box = component.bbox
        if component.area != box.height*box.width:
            continue
        for axis in ('row','column'):
            if axis == 'row':
                distance = min(box.top,world.frame.height-1-box.bottom)
                fixed,position,extent = (box.top,box.bottom),box.left,box.width
            else:
                distance = min(box.left,world.frame.width-1-box.right)
                fixed,position,extent = (box.left,box.right),box.top,box.height
            if distance <= world.boundary_search_band_px:
                key = (axis,fixed,box.height,box.width)
                groups.setdefault(key,[]).append((position,extent,component))
    rows = []
    for key, group in sorted(groups.items()):
        ordered = sorted(group,key=lambda row:row[0])
        work += len(ordered)
        if work > maximum_work:
            return (),work,False
        if len(ordered) < 3:
            continue
        steps = {b[0]-a[0] for a,b in zip(ordered,ordered[1:])}
        if len(steps) != 1 or next(iter(steps)) <= ordered[0][1]:
            continue
        after_values = []
        before_values = []
        for _,_,component in ordered:
            box = component.bbox
            work += component.area
            if work > maximum_work:
                return (),work,False
            values = {before.rows[r][c] for r in range(box.top,box.bottom+1)
                for c in range(box.left,box.right+1)}
            if len(values) != 1:
                break
            before_values.append(next(iter(values)))
            after_values.append(component.value)
        if len(before_values) != len(ordered) or len(set(before_values+after_values)) != 2:
            continue
        changed = tuple((a,b) for a,b in zip(before_values,after_values) if a != b)
        if len(changed) != 1:
            continue
        from_value,to_value = changed[0]
        remaining = after_values.count(from_value)
        converted = after_values.count(to_value)
        rows.append(FrozenMap({'axis':key[0],'fixed_interval':key[1],
            'patch_extent':(key[2],key[3]),'pitch':next(iter(steps)),
            'patch_count':len(ordered),'converted_from_value':from_value,
            'converted_to_value':to_value,'before_from_value_count':before_values.count(from_value),
            'after_from_value_count':remaining,'after_to_value_count':converted,
            'changed_patch_count':len(changed),'submitted_command_count':world.current_level_primitive_count,
            'converted_count_equals_submitted_count':world.current_level_primitive_count is not None
                and converted == world.current_level_primitive_count,
            'source_frame_ref':world.current_observation_frame_ref}))
    return tuple(rows),work,True


def _measure_immediately_prior_contacts(world, moving, aligned, peers, quantum, phase,
        common_cells, current_delta, maximum_work):
    """A refused direction immediately before the current free translation.

    The prior command must belong to the same non-directional control epoch.
    Its unchanged pose is the before-image of the successful current command;
    no older pose or colour-based identity is reconstructed here. Source alone
    interprets an internal destination intersecting an unchanged frame.
    """
    before = world.previous_action_observed_frame
    directions = {ref:(dr,dc) for ref,dr,dc in world.interface_action_translation_deltas}
    prior = world.previous_action_ref
    if (before is None or moving is None or not quantum or phase is None or not current_delta
            or prior not in world.control_epoch_no_effect_directional_action_refs
            or prior not in directions or world.last_action_ref not in directions
            or (before.height,before.width) != (world.frame.height,world.frame.width)):
        return (),0,True
    top,left,bottom,right = moving['frame_bbox']
    dr,dc = current_delta
    old_top,old_left,old_bottom,old_right = top-dr,left-dc,bottom-dr,right-dc
    vr,vc = directions[prior]
    target = (old_top+vr*quantum,old_left+vc*quantum,
        old_bottom+vr*quantum,old_right+vc*quantum)
    pt,pl,pb,pr = target
    phase_row,phase_col = phase
    destination = {(x,y) for x in range((pl-phase_col)//quantum,(pr+1-phase_col)//quantum)
        for y in range((pt-phase_row)//quantum,(pb+1-phase_row)//quantum)}
    work = len(destination)
    if work > maximum_work:
        return (),work,False
    # Excludes an external wall/receiver-boundary explanation, without calling
    # the measured common cells "floor" or declaring a collision in Python.
    if not destination or not destination.issubset(common_cells):
        return (),work,True
    rows = []
    for row in aligned:
        if row['frame_ref'] == moving['frame_ref'] or row['frame_ref'] in peers:
            continue
        rt,rl,rb,rr = row['frame_bbox']
        work += 1
        if pt > rb or pb < rt or pl > rr or pr < rl:
            continue
        area = (rb-rt+1)*(rr-rl+1)
        work += area
        if work > maximum_work:
            return (),work,False
        unchanged = all(before.rows[r][c] == world.frame.rows[r][c]
            for r in range(rt,rb+1) for c in range(rl,rr+1))
        if unchanged:
            rows.append(FrozenMap({'measurement_ref':'measurement.rigid_contact.'+stable_digest((
                world.current_observation_frame_ref,prior,moving['frame_ref'],row['frame_ref'],target)),
                'mover_frame_ref':moving['frame_ref'],'peer_frame_ref':row['frame_ref'],
                'command_ref':prior,'free_command_ref':world.last_action_ref,
                'before_free_bbox':(old_top,old_left,old_bottom,old_right),
                'predicted_destination_bbox':target,'peer_bbox':row['frame_bbox'],
                'same_control_epoch':True,'prior_direction_no_scene_translation':True,
                'current_nonzero_input_aligned_translation':current_delta,
                'peer_unchanged_during_free_translation':True,
                'destination_inside_common_cell_domain':True}))
    return tuple(rows),work,True


def measure_aligned_modal_cells(frame, groups, quantum, maximum_work):
    """Measure palette membership of cell cores; no body or collision role."""
    measured = []
    work = 0
    for group in groups:
        top, left, bottom, right = group['frame_bbox']
        modal = group['unique_modal_interior_value']
        offsets = []
        cells = []
        complete = modal is not None
        for x in range((right-left+1)//quantum):
            for y in range((bottom-top+1)//quantum):
                work += (quantum-2)**2
                if work > maximum_work:
                    return (), work, False
                counts = Counter(frame.rows[r][c]
                    for r in range(top+y*quantum+1, top+(y+1)*quantum-1)
                    for c in range(left+x*quantum+1, left+(x+1)*quantum-1))
                greatest = max(counts.values())
                modes = tuple(v for v, n in sorted(counts.items()) if n == greatest)
                complete = complete and len(modes) == 1
                cells.append((x, y, modes))
                if len(modes) == 1 and modes[0] == modal:
                    offsets.append((x, y))
        measured.append(FrozenMap.overlay({
            'modal_interior_cell_offsets': tuple(offsets),
            'modal_interior_cell_modes': tuple(cells),
            'modal_interior_cell_enumeration_complete': complete}, group))
    return tuple(measured), work, True


def measure_rigid_scene_geometry(value: RigidSceneGeometryInputC) -> RigidSceneGeometryC:
    world = value.world
    contract = {name:getattr(value, name) for name in (
        'maximum_work','maximum_frame_pixels','maximum_component_count',
        'maximum_framed_occurrences','minimum_mask_extent','maximum_mask_extent','minimum_mask_area')}
    measured = measure_enclosed_frame_groups(world.frame, world.components.components, contract)
    work = measured['work_count']
    complete = measured['enclosed_frame_groups_complete']
    groups = tuple(FrozenMap(row) for row in measured['enclosed_frame_groups'])
    translated = {ref:(dr,dc) for ref,dr,dc in world.current_exact_component_translations}
    aligned_delta = world.observed_input_aligned_action_translation
    current_delta = (tuple(aligned_delta[1:]) if aligned_delta
        and aligned_delta[0] == world.last_action_ref else None)
    motion_rows = []
    annotated = []
    for row in groups:
        parts = row['enclosed_component_refs']
        work += len(parts)
        co_moving = tuple(ref for ref in parts if ref in translated and translated[ref] == current_delta)
        delta = FrozenMap.overlay({'current_aligned_translated_component_refs':co_moving,
            'current_aligned_translated_component_count':len(co_moving)}, row)
        annotated.append(delta)
        if co_moving and current_delta is not None and current_delta != (0,0):
            motion_rows.append(delta)
    groups = tuple(annotated)
    unique_motion = motion_rows[0] if complete and len(motion_rows) == 1 else None
    scalar_steps = set()
    interface = {ref:(dr,dc) for ref,dr,dc in world.interface_action_translation_deltas}
    for ref,dr,dc in world.known_action_translation_deltas:
        work += 1
        axis = interface.get(ref)
        if axis and ((axis[0] and dr*axis[0] > 0 and dc == 0)
                or (axis[1] and dc*axis[1] > 0 and dr == 0)):
            scalar_steps.add(abs(dr or dc))
    quantum = next(iter(scalar_steps)) if len(scalar_steps) == 1 else None
    phase = None
    aligned = ()
    peers = ()
    core_cells = []
    underlay = Counter()
    anchor = unique_motion
    if value.source_bound_anchor_frame_ref is not None:
        anchors = tuple(row for row in groups if row['frame_ref'] == value.source_bound_anchor_frame_ref)
        if len(anchors) != 1:
            raise ValueError('Source-bound current control anchor is not a unique measured frame')
        anchor = anchors[0]
    if quantum is not None and quantum >= 3 and anchor is not None:
        top,left,_,_ = anchor['frame_bbox']
        phase = (top % quantum, left % quantum)
        aligned = tuple(row for row in groups if (
            (row['frame_bbox'][0]-phase[0]) % quantum == 0
            and (row['frame_bbox'][1]-phase[1]) % quantum == 0
            and (row['frame_bbox'][2]-row['frame_bbox'][0]+1) % quantum == 0
            and (row['frame_bbox'][3]-row['frame_bbox'][1]+1) % quantum == 0))
        aligned, mask_work, masks_bounded = measure_aligned_modal_cells(
            world.frame, aligned, quantum, max(0, value.maximum_work-work))
        work += mask_work
        complete = complete and masks_bounded
        top,left,bottom,right = anchor['frame_bbox']
        modal = anchor['unique_modal_interior_value']
        peers = tuple(row['frame_ref'] for row in aligned
            if row['frame_ref'] != anchor['frame_ref']
            and row['frame_bbox'][2]-row['frame_bbox'][0] == bottom-top
            and row['frame_bbox'][3]-row['frame_bbox'][1] == right-left
            and modal is not None and row['border_value'] == modal)
        for row in world.current_translation_underlay_rows:
            for r,c,palette_value in row.get('observed_underlay_pixels',()):
                work += 1
                if work > value.maximum_work:
                    complete = False
                    break
                if (0 < (r-phase[0]) % quantum < quantum-1
                        and 0 < (c-phase[1]) % quantum < quantum-1):
                    underlay[palette_value] += 1
            if not complete:
                break
        for r in range(phase[0],world.frame.height-quantum+1,quantum):
            for c in range(phase[1],world.frame.width-quantum+1,quantum):
                work += (quantum-2)**2
                if work > value.maximum_work:
                    complete = False
                    break
                values = {world.frame.rows[y][x] for y in range(r+1,r+quantum-1)
                    for x in range(c+1,c+quantum-1)}
                if len(values) == 1:
                    core_cells.append(((c-phase[1])//quantum,(r-phase[0])//quantum,next(iter(values))))
            if not complete:
                break
    complete = complete and work <= value.maximum_work
    edge_rows,edge_work,edge_complete = _edge_patch_changes(world,value.maximum_work-work) if complete else ((),0,False)
    work += edge_work
    complete = complete and edge_complete
    modes = tuple(v for v,n in sorted(underlay.items()) if n == max(underlay.values())) if underlay else ()
    if value.source_bound_underlay_value is not None:
        modes = (value.source_bound_underlay_value,)
    common_cells = set()
    peer_cells = set()
    rectangular = False
    peer_core_matches = False
    if complete and phase is not None and len(peers) == 1 and len(modes) == 1:
        for group in aligned:
            top,left,bottom,right = group['frame_bbox']
            cells = {(x,y) for x in range((left-phase[1])//quantum,(right+1-phase[1])//quantum)
                for y in range((top-phase[0])//quantum,(bottom+1-phase[0])//quantum)}
            work += len(cells)
            if group['frame_ref'] == peers[0]:
                peer_cells = cells
                peer_core_matches = group['unique_modal_interior_value'] == modes[0]
            else:
                common_cells.update(cells)
        common_cells.update((x,y) for x,y,v in core_cells if v == modes[0])
        common_cells.difference_update(peer_cells)
        work += len(core_cells)+len(common_cells)+len(peer_cells)
        if common_cells:
            xs,ys = tuple(x for x,_ in common_cells),tuple(y for _,y in common_cells)
            rectangular = len(common_cells) == (max(xs)-min(xs)+1)*(max(ys)-min(ys)+1)
    contacts,contact_work,contact_complete = _measure_immediately_prior_contacts(
        world,unique_motion,aligned,peers,quantum,phase,common_cells,current_delta,
        value.maximum_work-work) if complete and work < value.maximum_work else ((),0,False)
    work += contact_work
    complete = complete and contact_complete and work <= value.maximum_work
    from .rigid_selection_c import measure_retained_outline_incidence
    selection_measurements = measure_retained_outline_incidence(world, groups)
    work += selection_measurements['control_outline_pixel_work_count']
    complete = complete and work <= value.maximum_work
    if work > value.maximum_work:
        selection_measurements = FrozenMap.overlay({'control_outline_enumeration_complete': False}, selection_measurements)
    return RigidSceneGeometryC(epoch=world.current_context_epoch, frame_ref=world.current_observation_frame_ref,
        groups=groups if complete else (), aligned_groups=aligned if complete else (),
        quantum=quantum, lattice_phase=phase,
        unique_motion_frame_ref=unique_motion['frame_ref'] if complete and unique_motion else None,
        source_revalidated_control_frame_ref=value.source_bound_anchor_frame_ref if complete else None,
        equal_extent_palette_peer_refs=peers if complete else (),
        uniform_core_cells=tuple(core_cells) if complete else (),
        unique_modal_underlay_core_value=modes[0] if complete and len(modes) == 1 else None,
        edge_patch_measurements=edge_rows if complete else (),
        common_cell_domain=tuple(sorted(common_cells)) if complete else (),
        palette_peer_cells=tuple(sorted(peer_cells)) if complete else (),
        facts=FrozenMap({**dict(selection_measurements),
            'current_motion_agrees_with_control_indicator': unique_motion is None
                or unique_motion['frame_ref'] == selection_measurements['current_control_outline_frame_ref'],
            'source_revalidated_control_anchor_present':value.source_bound_anchor_frame_ref is not None,
            'source_recalled_collision_evidence_refs':value.source_recalled_collision_evidence_refs,
            'source_recalled_collision_evidence_count':len(value.source_recalled_collision_evidence_refs),
            'source_bound_floor_value_is_recalled':value.source_bound_underlay_value is not None,
            'geometry_enumeration_complete':complete,'geometry_work_count':work,
            'frame_group_count':len(groups),'aligned_frame_group_count':len(aligned),
            'aligned_modal_cell_masks_complete':bool(aligned) and all(
                row['modal_interior_cell_enumeration_complete']
                and row['modal_interior_cell_offsets'] for row in aligned),
            'current_aligned_motion_frame_count':len(motion_rows),
            'current_aligned_motion_component_count':unique_motion['current_aligned_translated_component_count'] if unique_motion else 0,
            'immediately_prior_internal_contact_pair_count':len(contacts) if complete else 0,
            'equal_extent_palette_peer_count':len(peers),'translation_scalar_count':len(scalar_steps),
            'marked_motion_interior_value_count':len(unique_motion['interior_value_counts']) if unique_motion else 0,
            'modal_underlay_core_value_count':len(modes),'uniform_core_cell_count':len(core_cells),
            'current_frame_ref_present':world.current_observation_frame_ref is not None,
            'changing_edge_patch_array_count':len(edge_rows),
            'edge_converted_count_matches_commands':len(edge_rows) == 1
                and edge_rows[0]['converted_count_equals_submitted_count'],
            'common_cell_domain_count':len(common_cells),
            'common_cell_domain_rectangular':rectangular,
            'peer_interior_matches_underlay_mode':peer_core_matches,
            'parent_goal_ref_present':bool(world.canonical_dispatched_goal_continuity_facts.get('dispatched_composition_active_goal_ref')),
            'incoming_declared_route_present':world.incoming_declared_route_remaining_step_count > 0,
            'interface_direction_count':len(world.interface_action_translation_deltas),
            'converted_from_remaining_count':edge_rows[0]['after_from_value_count'] if len(edge_rows) == 1 else 0,
            'no_role_or_action_authority':True}),
        parent_goal_ref=world.canonical_dispatched_goal_continuity_facts.get('dispatched_composition_active_goal_ref'),
        prior_intent_ref=world.canonical_dispatched_goal_continuity_facts.get('dispatched_composition_intent_ref'),
        interface_vectors=world.interface_action_translation_deltas,
        prior_contact_measurements=contacts if complete else ())
