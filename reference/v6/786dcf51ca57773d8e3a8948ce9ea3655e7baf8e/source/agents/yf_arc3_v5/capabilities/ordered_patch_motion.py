"""Exact striped-patch tracks, including disappearance and later return.

Raster identity and trajectories only. Source declares the interpretation of
the measured return and eligibility of a different point experiment.
"""
from collections import Counter

from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from .shadow_light_fields import measure_gray_field_contrast


def striped_patches(frame, components, contract):
    if not contract or frame.height * frame.width > contract['maximum_pixels']:
        return ()
    patches = {}
    for component in components:
        box = component.bbox
        height, width = box.bottom-box.top+1, box.right-box.left+1
        if component.area != height*width or height == width:
            continue
        long, short = max(height, width), min(height, width)
        if long % short or not contract['minimum_stripes'] <= long//short <= contract['maximum_stripes']:
            continue
        bottom, right = box.top+long, box.left+long
        if bottom > frame.height or right > frame.width:
            continue
        pattern = tuple(tuple(row[box.left:right]) for row in frame.rows[box.top:bottom])
        values = []
        for i in range(long):
            line = pattern[i] if width > height else tuple(row[i] for row in pattern)
            if len(set(line)) != 1:
                break
            values.append(line[0])
        if len(values) != long or len(set(values)) != 2:
            continue
        if any(values[i] != values[(i//short % 2)*short] for i in range(long)):
            continue
        bounds = (box.top, box.left, bottom-1, right-1)
        patches[bounds] = FrozenMap({'bounds': bounds, 'pattern': pattern,
            'axis': int(height > width), 'extent': long,
            'histogram': tuple(sorted(Counter(v for row in pattern for v in row).items())),
            'anchor_component_ref': component.component_id})
    return tuple(patches[k] for k in sorted(patches)) if len(patches) <= contract['maximum_patches'] else ()


def patch_occurrences(frame, pattern):
    height, width = len(pattern), len(pattern[0])
    return tuple((r, c) for r in range(frame.height-height+1)
        for c in range(frame.width-width+1)
        if tuple(frame.rows[r][c:c+width]) == pattern[0]
        and all(tuple(frame.rows[r+i][c:c+width]) == pattern[i] for i in range(1,height)))


def patch_packet_tracks(before, packet, patches):
    if not packet or any((f.height,f.width) != (before.height,before.width) for f in packet):
        return ()
    tracks = []
    for patch in patches:
        pattern = patch['pattern']
        initial = patch_occurrences(before,pattern)
        if len(initial) != 1:
            continue
        start = initial[0]
        occurrences = tuple(patch_occurrences(f,pattern) for f in packet)
        prefix = [start]
        first_absent = None
        for index, positions in enumerate(occurrences):
            if len(positions) != 1:
                first_absent = index
                break
            prefix.append(positions[0])
        deltas = tuple((b[0]-a[0],b[1]-a[1]) for a,b in zip(prefix,prefix[1:]) if a!=b)
        cardinal = bool(deltas) and all((dr==0) != (dc==0) for dr,dc in deltas)
        tracks.append(FrozenMap({'bounds':patch['bounds'],'initial_position':start,'pattern':pattern,
            'prefix_positions':tuple(prefix), 'moving_sample_count':len(deltas),
            'cardinal_prefix':cardinal,'first_absent_index':first_absent,
            'terminal_occurrences':occurrences[-1],
            'returned_after_absence':first_absent is not None and occurrences[-1]==(start,),
            'initial_nonzero_delta':deltas[0] if deltas else None,
            'maximum_sample_step':max((abs(dr)+abs(dc) for dr,dc in deltas),default=0)}))
    return tuple(tracks)


def annotate_ordered_patch_motion(value, agenda, *, point_measurements):
    contract = value.route_generation_policy.get('ordered_patch_motion_contract')
    if (not contract or value.last_action_ref != contract['point_action_ref']
            or value.previous_action_observed_frame is None
            or value.last_point_position is None):
        return agenda
    frame = value.frame
    patches = striped_patches(frame,value.components.components,contract)
    tracks = patch_packet_tracks(value.previous_action_observed_frame,
                                value.latest_ordered_action_frames,patches)
    moving = tuple(t for t in tracks if t['cardinal_prefix']
                   and t['moving_sample_count'] >= contract['minimum_moving_samples'])
    # Singleton is a measured uniqueness condition, not semantic selection.
    if len(moving) != 1 or not moving[0]['returned_after_absence']:
        return agenda
    track = moving[0]
    body = next(p for p in patches if p['bounds']==track['bounds'])
    peers = tuple(p for p in patches if p['bounds']!=body['bounds']
                  and p['histogram']==body['histogram'] and p['axis']!=body['axis'])
    if len(peers)!=1:
        return agenda
    peer = peers[0]
    r,c,bottom,right=body['bounds']; extent=body['extent']
    surfaces = []
    for patch in (body,peer):
        top,left,bot,end=patch['bounds']
        ring = tuple((y,x) for y in range(top-1,bot+2) for x in range(left-1,end+2)
                     if 0<=y<frame.height and 0<=x<frame.width
                     and not(top<=y<=bot and left<=x<=end))
        surfaces.append({frame.rows[y][x] for y,x in ring})
    common = surfaces[0]&surfaces[1]-{v for v,_ in body['histogram']}
    if len(common)!=1:
        return agenda
    common_value = next(iter(common))
    # Equal-sized adjacent patches, not an asserted playable grid or safe route.
    points=[]
    first_dr,first_dc=track['initial_nonzero_delta']
    for dr,dc in contract['adjacent_offsets']:
        nr,nc=r+dr*extent,c+dc*extent
        if not(0<=nr and nr+extent<=frame.height and 0<=nc and nc+extent<=frame.width):
            continue
        if not all(frame.rows[y][x]==common_value for y in range(nr,nr+extent) for x in range(nc,nc+extent)):
            continue
        point=(nr+extent//2,nc+extent//2)
        old_gap=abs(r-peer['bounds'][0])+abs(c-peer['bounds'][1])
        new_gap=abs(nr-peer['bounds'][0])+abs(nc-peer['bounds'][1])
        points.append((point,dr*first_dr+dc*first_dc>0,old_gap-new_gap))
    token=stable_digest((value.current_context_epoch,body['bounds'],body['pattern'],
                         value.current_observation_frame_ref,value.last_point_position,track))
    additions=[]; alternatives={}; deltas={}; old_refs=set(agenda.alternative_refs)
    context=FrozenMap({'projection_contract':contract['projection_contract'],
        'epoch':value.current_context_epoch,'frame_ref':value.current_observation_frame_ref,
        'body_bounds':body['bounds'],'body_pattern':body['pattern'],
        'response_track':track,'previous_point':value.last_point_position})
    radiometry=measure_gray_field_contrast(frame,value.components.components,(body,peer),
        contract['radiometry'],before=value.previous_action_observed_frame,
        packet=value.latest_ordered_action_frames,track=track) if contract.get('radiometry') else FrozenMap()
    measured_points=point_measurements(value,
        frozenset(agenda.current_context_no_effect_candidate_refs),
        frozenset(agenda.tested_candidate_refs_without_resolution_plan),
        dict(agenda.context_facts),{},{},{},requested_points=tuple(p for p,_,_ in points)) if points else ()
    by_point={p:(repeat,gap) for p,repeat,gap in points}
    for candidate,base_facts in measured_points:
        if candidate.point not in by_point:
            continue
        repeats_direction,gap_reduction=by_point[candidate.point]
        ref=candidate.candidate_ref
        facts=FrozenMap.overlay({'patch_packet_return_present':True,
            'patch_packet_track_token':token,'patch_packet_moving_samples':track['moving_sample_count'],
            'patch_packet_missing_index':track['first_absent_index'],
            'patch_neighbor_repeats_initial_direction':repeats_direction,
            'patch_neighbor_peer_distance_reduction':gap_reduction,
            'patch_neighbor_context':context},FrozenMap.overlay(radiometry,base_facts))
        if ref not in old_refs:
            additions.append(candidate)
            old_refs.add(ref)
        alternatives[ref]=FrozenMap.overlay(facts,agenda.alternative_facts.get(ref,agenda.context_facts))
        deltas[ref]=facts
    return agenda.model_copy(update={'candidates':agenda.candidates+tuple(additions),
        'alternative_refs':agenda.alternative_refs+tuple(c.candidate_ref for c in additions),
        'alternative_facts':FrozenMap.overlay(alternatives,agenda.alternative_facts),
        'descriptive_delta_facts':FrozenMap.overlay(deltas,agenda.descriptive_delta_facts),
        'has_candidates':bool(agenda.candidates or additions)})


def annotate_initial_shadow_neighbors(value, agenda, *, point_measurements):
    contract=value.route_generation_policy.get('ordered_patch_motion_contract')
    if (not contract or not contract.get('radiometry')
            or contract['point_action_ref'] not in value.available_action_refs):
        return agenda
    frame=value.frame
    patches=striped_patches(frame,value.components.components,contract)
    if len(patches)!=2 or patches[0]['histogram']!=patches[1]['histogram']:
        return agenda
    rotated=patches[0]['pattern']; rotations=[]
    for _ in range(3):
        rotated=tuple(tuple(row) for row in zip(*reversed(rotated)))
        rotations.append(rotated)
    equivalent=patches[1]['pattern'] in rotations
    tracks=patch_packet_tracks(value.previous_action_observed_frame,
        value.latest_ordered_action_frames,patches) if value.previous_action_observed_frame is not None else ()
    moving=tuple(t for t in tracks if t['cardinal_prefix']
        and t['moving_sample_count']>=contract['minimum_moving_samples'])
    unique_track=moving[0] if len(moving)==1 else None
    radiometry=measure_gray_field_contrast(frame,value.components.components,patches,contract['radiometry'],
        before=value.previous_action_observed_frame,packet=value.latest_ordered_action_frames,track=unique_track)
    common_value=radiometry.get('gray_common_perimeter_value')
    if common_value is None:
        return agenda
    pair_signature=stable_digest((value.current_context_epoch,
                                  tuple(sorted(p['pattern'] for p in patches))))
    previous=value.canonical_dispatched_goal_continuity_facts.get('dispatched_composition_target_context') or FrozenMap()
    previous_pattern=previous.get('body_pattern')
    previous_pattern=tuple(tuple(row) for row in previous_pattern) if previous_pattern else ()
    prior_projection=previous.get('projection_contract')
    prior_epoch_matches=previous.get('epoch')==value.current_context_epoch
    # Global input history survives a level boundary; this fact is level-local.
    unacted=(value.current_level_primitive_count==0
        if value.current_level_primitive_count is not None else not value.action_execution_counts)
    measurements=[]
    for body,peer in ((patches[0],patches[1]),(patches[1],patches[0])):
        measured_translation=bool(unique_track and unique_track['bounds']==body['bounds']
            and unique_track['first_absent_index'] is None
            and unique_track['terminal_occurrences']==(body['bounds'][:2],))
        if not unacted and not measured_translation:
            continue
        r,c,_,_=body['bounds'];extent=body['extent']
        token=stable_digest((value.current_observation_frame_ref,body['bounds'],peer['bounds'],radiometry))
        context=FrozenMap({'projection_contract':contract['initial_projection_contract'],
            'epoch':value.current_context_epoch,'frame_ref':value.current_observation_frame_ref,
            'body_bounds':body['bounds'],'body_pattern':body['pattern'],
            'peer_bounds':peer['bounds'],'pair_signature':pair_signature,
            'relative_gray_measurements':radiometry,
            'response_track':unique_track or FrozenMap()})
        identity_facts=FrozenMap.overlay({
            'striped_pair_before_any_input':unacted,
            'striped_pair_rotation_equivalent':equivalent,
            'striped_pair_unique_ordered_translation':measured_translation,
            'striped_pair_point_gap_reduction':(
                sum(abs(unique_track['initial_position'][i]+extent//2-value.last_point_position[i]) for i in (0,1))
                -sum(abs(body['bounds'][i]+extent//2-value.last_point_position[i]) for i in (0,1))
                if measured_translation and value.last_point_position is not None else 0),
            'striped_pair_point_terminal_gap':(
                sum(abs(body['bounds'][i]+extent//2-value.last_point_position[i]) for i in (0,1))
                if measured_translation and value.last_point_position is not None else -1),
            'striped_pair_prior_projection_ref':prior_projection,
            'striped_pair_prior_epoch_matches':prior_epoch_matches,
            'striped_pair_prior_pattern_matches':previous_pattern==body['pattern'],
            'striped_pair_prior_signature_matches':previous.get('pair_signature')==pair_signature,
            'shadow_pair_signature':pair_signature,'patch_neighbor_track_token':token,
            'initial_patch_neighbor_context':context},radiometry)
        for dr,dc in contract['adjacent_offsets']:
            nr,nc=r+dr*extent,c+dc*extent
            if not(0<=nr and nr+extent<=frame.height and 0<=nc and nc+extent<=frame.width):
                continue
            if not all(frame.rows[y][x]==common_value for y in range(nr,nr+extent) for x in range(nc,nc+extent)):
                continue
            point=(nr+extent//2,nc+extent//2)
            measurements.append((point,FrozenMap.overlay({
                'patch_neighbor_peer_distance_reduction':abs(r-peer['bounds'][0])+abs(c-peer['bounds'][1])
                    -abs(nr-peer['bounds'][0])-abs(nc-peer['bounds'][1]),
                'patch_neighbor_uniform_common_extent':True,
                'patch_neighbor_track_token':token,
                'initial_patch_neighbor_context':context},identity_facts)))
        if measured_translation:
            from .shadow_surface_routes import measure_surface_route_questions
            for point,facts in measure_surface_route_questions(value,body,peer,radiometry,context,contract):
                measurements.append((point,FrozenMap.overlay(facts,identity_facts)))
    if not measurements:
        return agenda
    # A point with multiple distinct origin explanations stays ambiguous; no
    # single origin is silently chosen for the frozen WHY.
    origins={point:{facts['initial_patch_neighbor_context']['body_bounds']
        for p,facts in measurements if p==point} for point,_ in measurements}
    descriptions={}
    for point,facts in measurements:
        if len(origins[point])==1:
            descriptions[point]=FrozenMap.overlay(facts,descriptions.get(point,FrozenMap()))
    if not descriptions:
        return agenda
    point_rows=point_measurements(value,frozenset(agenda.current_context_no_effect_candidate_refs),
        frozenset(agenda.tested_candidate_refs_without_resolution_plan),
        dict(agenda.context_facts),{},{},{},requested_points=tuple(descriptions))
    additions=[];alternatives={};deltas={};existing=set(agenda.alternative_refs)
    for candidate,base_facts in point_rows:
        if candidate.point not in descriptions:
            continue
        ref=candidate.candidate_ref
        facts=FrozenMap.overlay(descriptions[candidate.point],base_facts)
        if ref not in existing:
            additions.append(candidate);existing.add(ref)
        alternatives[ref]=FrozenMap.overlay(facts,agenda.alternative_facts.get(ref,agenda.context_facts))
        deltas[ref]=facts
    return agenda.model_copy(update={'candidates':agenda.candidates+tuple(additions),
        'alternative_refs':agenda.alternative_refs+tuple(c.candidate_ref for c in additions),
        'alternative_facts':FrozenMap.overlay(alternatives,agenda.alternative_facts),
        'descriptive_delta_facts':FrozenMap.overlay(deltas,agenda.descriptive_delta_facts),
        'has_candidates':bool(agenda.candidates or additions)})
