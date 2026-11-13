"""Exact cell deltas and rigid fits from observed navigation transitions.

No palette, role, support permission or transfer decision is inferred here.
All candidate persistent component centres are tested; ambiguous fits remain.
"""
from collections import defaultdict

from agents.yf_arc3_v5.capabilities.contracts import (
    ReconfigurablePivotCandidate, ReconfigurableRigidGeometryInput,
    ReconfigurableSupportLayer,
)
from agents.yf_arc3_v5.capabilities.reconfigurable_support import measure_reconfigurable_rigid_geometry
from agents.yf_arc3_v5.logos.types import FrozenMap


def measure_current_translation_underlays(*, before, after):
    """Bind prior pixels to unique exact translated components in this pair.

    No controlled role or interface pitch is selected. Retained geometry is
    deliberately absent: only the supplied consecutive observations contribute.
    """
    from agents.yf_arc3_v5.capabilities import ComponentExtractionInput, FrameGrid, detect_components
    if before is None:return ()
    before=getattr(before,'rows',before);after=getattr(after,'rows',after)
    if not before or not after or len(before)!=len(after):return ()
    width=len(after[0])
    if len(after)*width>4096 or any(len(row)!=width for row in (*before,*after)):return ()
    groups=[]
    for frame in (before,after):
        components=detect_components(ComponentExtractionInput(frame=FrameGrid(rows=frame),connectivity=4)).components
        if len(components)>256:return ()
        grouped=defaultdict(list)
        for c in components:
            signature=(c.value,tuple(sorted((r-c.bbox.top,s-c.bbox.left) for r,s in c.pixels)))
            grouped[signature].append(c)
        groups.append(grouped)
    from .sprite_occlusion import enclosed_rendering_pixels
    translated = []
    for signature, current in sorted(groups[1].items()):
        prior = groups[0].get(signature, ())
        if len(current) != 1 or len(prior) != 1:
            continue
        a, b = prior[0], current[0]
        dr, dc = b.bbox.top-a.bbox.top, b.bbox.left-a.bbox.left
        if (dr, dc) == (0, 0):
            continue
        interior = enclosed_rendering_pixels(frozenset(a.pixels))
        # Retain only an interior texture observed unchanged with this exact
        # translated component. This is conditional occlusion evidence, not
        # proof that a hole is solid or an internal part is controllable.
        follows = all(before[r][c] == after[r+dr][c+dc] for r,c in interior)
        old_mask = frozenset(a.pixels) | (interior if follows else frozenset())
        new_mask = frozenset((r+dr,c+dc) for r,c in old_mask)
        translated.append((a,b,(dr,dc),old_mask,new_mask))
    moving_prior_pixels = frozenset(p for _,_,_,mask,_ in translated for p in mask)
    rows=[]
    for a,b,delta,old_mask,new_mask in translated:
        box=b.bbox
        rows.append(FrozenMap({'component_ref':b.component_id,
            'bbox':(box.top,box.left,box.bottom,box.right),'translation_delta':delta,
            'observed_underlay_pixels': tuple((r,c,before[r][c]) for r,c in sorted(new_mask)
                if (r,c) not in moving_prior_pixels),
            'underlay_values':tuple(sorted({before[r][c] for r in range(box.top,box.bottom+1)
                for c in range(box.left,box.right+1)}))}))
    return tuple(rows) if len(rows)<=64 else ()


def measure_remote_navigation_transition(*, before, after, before_components,
        after_components, control, actor, maximum_pixels=4096, maximum_pivots=32):
    height, width = len(before), len(before[0])
    if height * width > maximum_pixels or len(after) != height or any(
            len(row) != width for row in (*before, *after)):
        raise ValueError("navigation transition frame bound/shape mismatch")
    h, w = actor.bbox.height, actor.bbox.width
    phase_r, phase_c = actor.bbox.top % h, actor.bbox.left % w
    excluded = frozenset(actor.pixels) | frozenset(
        (r, c) for r in range(control.bbox.top, control.bbox.bottom + 1)
        for c in range(control.bbox.left, control.bbox.right + 1))
    groups = defaultdict(list)
    for r in range(phase_r, height-h+1, h):
        for c in range(phase_c, width-w+1, w):
            pixels = tuple((r+dr, c+dc) for dr in range(h) for dc in range(w))
            if any(p in excluded for p in pixels):
                continue
            a = tuple(before[rr][cc] for rr, cc in pixels)
            b = tuple(after[rr][cc] for rr, cc in pixels)
            if a != b:
                groups[a, b].append((r, c))
    cell_rows = tuple(FrozenMap({"before_pattern": a, "after_pattern": b,
        "cell_height": h, "cell_width": w, "cell_positions": tuple(groups[a, b]),
        "cell_count": len(groups[a, b])}) for a, b in sorted(groups))

    changed = frozenset((r, c) for r in range(height) for c in range(width)
        if before[r][c] != after[r][c] and (r, c) not in excluded)
    after_keys = {(c.value, tuple(c.pixels)) for c in after_components}
    actor_pixels = frozenset(actor.pixels)
    persistent = tuple(c for c in before_components
        if (c.value, tuple(c.pixels)) in after_keys and c.area > 1
        and not set(c.pixels) & excluded
        and c.area + sum(c.bbox.top <= r <= c.bbox.bottom and
            c.bbox.left <= col <= c.bbox.right for r, col in actor_pixels)
            == c.bbox.height*c.bbox.width)
    # Oversized domains are explicitly incomplete, never silently truncated.
    fits_complete = len(persistent) <= maximum_pivots
    fit_rows = []
    if persistent and fits_complete:
        candidates = tuple(ReconfigurablePivotCandidate(
            candidate_ref=f"component:{i}",
            position=(c.bbox.top+c.bbox.bottom, c.bbox.left+c.bbox.right),
            staging_actor_positions=tuple((2*r, 2*s) for r, s in actor.pixels))
            for i, c in enumerate(persistent))
        # No support ownership is established by these appearance measurements.
        # Keep the geometry API's support checks false rather than assuming
        # the actor's visible pixels constitute their own supporting layer.
        layers = (ReconfigurableSupportLayer(owner_ref="unbound.support", positions=()),)
        values = sorted({before[r][c] for r, c in changed} | {after[r][c] for r, c in changed})
        for value in values:
            masks = []
            for components in (before_components, after_components):
                masks.append(frozenset(p for c in components if c.value == value
                    and set(c.pixels) & changed and not set(c.pixels) & excluded
                    for p in c.pixels))
            a, b = masks
            if not a or not b or a == b or len(a) != len(b):
                continue
            result = measure_reconfigurable_rigid_geometry(ReconfigurableRigidGeometryInput(
                before_positions=tuple(sorted((2*r, 2*c) for r, c in a)),
                after_positions=tuple(sorted((2*r, 2*c) for r, c in b)),
                pivot_candidates=candidates, before_support_layers=layers, after_support_layers=layers))
            for fit in result.exact_quarter_turn_fits:
                index = int(fit.candidate_ref.split(":")[1])
                landmark = persistent[index]
                centre = candidates[index].position
                fit_rows.append(FrozenMap({"changed_value": value,
                    "control_value_equals_changed_value": value == control.value,
                    "quarter_turns_clockwise": fit.quarter_turns_clockwise,
                    "pivot_centre_twice": centre,
                    "pivot_value": landmark.value,
                    "pivot_height": landmark.bbox.height, "pivot_width": landmark.bbox.width,
                    "pivot_occluded_pixel_count": landmark.bbox.height*landmark.bbox.width-landmark.area,
                    "pivot_outside_transformed_masks": fit.pivot_outside_transformed_masks,
                    "before_relative_pixels_twice": tuple(sorted((2*r-centre[0], 2*c-centre[1]) for r, c in a)),
                    "after_relative_pixels_twice": tuple(sorted((2*r-centre[0], 2*c-centre[1]) for r, c in b))}))
    return FrozenMap({"cell_transition_rows": cell_rows,
        "rigid_fit_rows": tuple(fit_rows), "rigid_fit_enumeration_complete": fits_complete,
        "persistent_component_count": len(persistent), "coordinate_scale": 2})


def measure_retained_translation_underlays(*, before_frame, after_frame,
        before_frame_ref, after_frame_ref, before_context_epoch, previous_rows, context_epoch,
        candidate_ref, timeline_ref, action_ref, retention_contract, maximum_pixels,
        observed_transition_packet=(), maximum_transition_pairs=512,
        previous_metadata_rows=()):
    """Reduce captured consecutive observations once after a sealed burst.

    No Source/DRM selection, state commit or reflection occurs per primitive.
    The terminal pair remains the sprite baseline; support retention consumes
    the actual packet so its first observation can match the prior carrier.
    """
    if len(previous_rows) != len(previous_metadata_rows) or len(previous_rows) > 1:
        raise ValueError('retained support and metadata projections have different cardinalities')
    if previous_rows:
        primary, metadata = previous_rows[0], previous_metadata_rows[0]
        common = ('term_ref', 'before_frame_ref', 'operational_scene_ref', 'transition_ref')
        if any(not primary.get(key) or primary.get(key) != metadata.get(key) for key in common):
            raise ValueError('retained support and metadata projections have different publication identities')
        previous_rows = (FrozenMap.overlay(metadata, primary),)
    if not observed_transition_packet:
        return _measure_retained_translation_underlay_pair(
            before_frame=before_frame, after_frame=after_frame,
            before_frame_ref=before_frame_ref, after_frame_ref=after_frame_ref,
            before_context_epoch=before_context_epoch, previous_rows=previous_rows,
            context_epoch=context_epoch, candidate_ref=candidate_ref, timeline_ref=timeline_ref,
            action_ref=action_ref, retention_contract=retention_contract, maximum_pixels=maximum_pixels)
    if not 1 <= maximum_transition_pairs <= 512 or len(observed_transition_packet) > maximum_transition_pairs:
        raise ValueError('retained observed transition packet domain bound exceeded')
    terminal = observed_transition_packet[-1]
    if (terminal['after_frame_ref'] != after_frame_ref
            or terminal['before_frame_ref'] != before_frame_ref
            or terminal['before_frame'] != before_frame
            or terminal['after_frame'] != after_frame
            or terminal['action_ref'] != action_ref
            or terminal['context_epoch'] != context_epoch
            or terminal['before_context_epoch'] != before_context_epoch):
        raise ValueError('retained observed transition packet differs from terminal pair')
    previous = None
    retained = previous_rows
    initial_continuity = False
    for pair in observed_transition_packet:
        if previous is not None and (
                previous['after_frame_ref'] != pair['before_frame_ref']
                or previous['after_frame'] != pair['before_frame']
                or previous['context_epoch'] != pair['before_context_epoch']):
            raise ValueError('retained observed transition packet lineage interrupted')
        measured = _measure_retained_translation_underlay_pair(
            **{name: pair[name] for name in ('before_frame', 'after_frame',
                'before_frame_ref', 'after_frame_ref', 'before_context_epoch', 'context_epoch', 'action_ref')},
            previous_rows=retained, candidate_ref=candidate_ref, timeline_ref=timeline_ref,
            retention_contract=retention_contract, maximum_pixels=maximum_pixels)
        if previous is None:
            initial_continuity = measured['frame_lineage_continuous']
        retained = (measured,)
        previous = pair
    return FrozenMap.overlay({'observed_transition_pair_count': len(observed_transition_packet),
        'packet_initial_frame_lineage_continuous': initial_continuity}, measured)


def _measure_retained_translation_underlay_pair(*, before_frame, after_frame,
        before_frame_ref, after_frame_ref, before_context_epoch, previous_rows, context_epoch,
        candidate_ref, timeline_ref, action_ref, retention_contract, maximum_pixels):
    """Transport observed samples; unchanged hidden samples stay conditional.

    Source owns persistence. No visible body colour is converted into terrain.
    A broken frame lineage or a changed epoch discards the previous carrier.
    """
    from collections.abc import Mapping
    from agents.yf_arc3_v5.logos.types import stable_digest
    def field(value, name):
        return value[name] if isinstance(value, Mapping) else getattr(value, name)
    before = field(before_frame, 'rows')
    after = field(after_frame, 'rows')
    before_ref, after_ref = before_frame_ref, after_frame_ref
    scope_unchanged = before_context_epoch == context_epoch
    transition_ref = 'observation-pair:' + stable_digest((before_ref, after_ref, candidate_ref))
    if not 1 <= maximum_pixels <= 4096 or len(previous_rows) > 1:
        raise ValueError('retained underlay domain bound exceeded')
    height, width = len(after), len(after[0])
    if height * width > maximum_pixels or len(before) != height or any(len(row) != width for row in (*before, *after)):
        raise ValueError('retained underlay frame domain mismatch')
    prior = previous_rows[0] if previous_rows else FrozenMap()
    scope_invalidation = action_ref in retention_contract['scope_invalidation_action_refs']
    reprocessed = (scope_unchanged and not scope_invalidation
        and prior.get('before_frame_ref') == before_ref
        and prior.get('operational_scene_ref') == after_ref
        and prior.get('transition_ref') == transition_ref
        and prior.get('context_epoch') == context_epoch
        and prior.get('timeline_ref') == timeline_ref)
    continuous = (scope_unchanged and not scope_invalidation and prior.get('operational_scene_ref') == before_ref
        and prior.get('context_epoch') == context_epoch
        and prior.get('timeline_ref') == timeline_ref)
    remembered = {}
    if continuous or reprocessed:
        raw = prior.get('support_samples', ())
        if len(raw) > maximum_pixels:
            raise ValueError('retained underlay sample bound exceeded')
        for r, c, color, observation_ref in raw:
            if not (0 <= r < height and 0 <= c < width and isinstance(color, int) and observation_ref):
                raise ValueError('invalid retained observed underlay sample')
            if (r, c) in remembered:
                raise ValueError('duplicate retained observed underlay position')
            remembered[r, c] = (color, observation_ref)
    if reprocessed:
        # Exact observation publication identity, not an inferred repeated
        # action effect. Dispatch and reflection may read this same pair.
        # Preserve the original packet witness and its conditional validity.
        return FrozenMap.overlay({'underlay_observation_domain_valid': True,
            'observation_pair_reprocessed': True}, prior)
    changed = {(r, c) for r in range(height) for c in range(width) if before[r][c] != after[r][c]}
    invalidated = sum(p in changed for p in remembered)
    remembered = {p: row for p, row in sorted(remembered.items()) if p not in changed}
    current = measure_current_translation_underlays(before=before, after=after) if scope_unchanged and not scope_invalidation else ()
    acquired = 0
    for row in current:
        for r, c, color in row['observed_underlay_pixels']:
            remembered[r, c] = (color, before_ref)
            acquired += 1
    samples = tuple((r, c, color, ref) for (r, c), (color, ref) in sorted(remembered.items()))
    return FrozenMap({'underlay_observation_domain_valid': True,
        'carrier_token': stable_digest((timeline_ref, context_epoch, height, width)),
        'timeline_ref': timeline_ref, 'context_epoch': context_epoch,
        'before_frame_ref': before_ref, 'operational_scene_ref': after_ref,
        'transition_ref': transition_ref, 'support_samples': samples,
        'retained_sample_count': len(samples), 'new_observed_sample_count': acquired,
        'invalidated_sample_count': invalidated, 'frame_lineage_continuous': continuous,
        'visible_configuration_unchanged': not changed,
        'scope_epoch_unchanged': scope_unchanged,
        'scope_invalidation_requested': scope_invalidation,
        'scope_discarded_sample_count': len(prior.get('support_samples', ())) if not continuous else 0,
        'observed_transition_pair_count': 1,
        'packet_initial_frame_lineage_continuous': continuous,
        'observation_pair_reprocessed': False,
        'hidden_mutation_absence_proven': False,
        'support_validity_kind': 'conditional_observation_retained_without_visible_contradiction'})
