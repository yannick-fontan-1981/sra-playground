"""Pixel witnesses for possession and complementary access, without role decisions.

The caller supplies the canonical lattice and observed control bounds. No
game state, game name, palette convention or cursor centering is consulted.
"""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, stable_digest
from .contracts import BoundingBox, ComponentExtractionInput, FrameGrid
from .components import detect_components
from .frame import materialize_retained_periodic_cell_grid


class InventoryAccessPixelPair(FrozenModel):
    before_frame: FrameGrid
    after_frame: FrameGrid
    before_frame_ref: Ref
    after_frame_ref: Ref
    canonical_typed_cell_lattice_facts: tuple[FrozenMap, ...] = Field(max_length=3)
    canonical_inventory_access_method_facts: tuple[FrozenMap, ...] = Field(default=(), max_length=64)
    pre_action_input_aligned_entity_bboxes: tuple[BoundingBox, ...] = Field(max_length=64)
    post_action_input_aligned_entity_bboxes: tuple[BoundingBox, ...] = Field(max_length=64)
    action_ref: Ref
    transition_ref: Ref
    context_epoch: int = Field(ge=0)


def _contains(outer, inner):
    return (outer.top <= inner.top <= inner.bottom <= outer.bottom
            and outer.left <= inner.left <= inner.right <= outer.right)


def _overlaps(a, b):
    return not (a.bottom < b.top or b.bottom < a.top
                or a.right < b.left or b.right < a.left)


def _patch(frame, box):
    if (box.top < 0 or box.left < 0 or box.bottom >= frame.height
            or box.right >= frame.width):
        return None
    return tuple(tuple(int(x) for x in row[box.left:box.right + 1])
                 for row in frame.rows[box.top:box.bottom + 1])


def measure_inventory_access_observations(value: InventoryAccessPixelPair):
    """Return bounded coupled observations; DRM decides their meaning.

    A disappearing display component alone supplies no ownership result. An
    entry sample also requires actual control translation into its exact
    complementary cell and an observed change outside the control rectangle.
    Acquisition samples require stationary control, a newly populated display
    patch, and removal of the matching visible world mask at that contact.
    """
    bindings = value.canonical_typed_cell_lattice_facts
    if len(bindings) != 1:
        return ()
    geometry = tuple(bindings[0].get('grid_geometry', ()))
    before, after = value.before_frame, value.after_frame
    if (before.height, before.width) != (after.height, after.width):
        return ()
    before_grids = materialize_retained_periodic_cell_grid(before, geometry).candidates
    after_grids = materialize_retained_periodic_cell_grid(after, geometry).candidates
    if len(before_grids) != 1 or len(after_grids) != 1:
        return ()
    if (len(value.pre_action_input_aligned_entity_bboxes) != 1
            or len(value.post_action_input_aligned_entity_bboxes) != 1):
        return ()
    old_body = value.pre_action_input_aligned_entity_bboxes[0]
    new_body = value.post_action_input_aligned_entity_bboxes[0]
    body_parts = []
    for frame, box in ((before, old_body), (after, new_body)):
        body_parts.append({(int(part.value), tuple(part.relative_pixels))
            for part in detect_components(ComponentExtractionInput(frame=frame, connectivity=4)).components
            if part.bbox == box})
    persistent_body_parts = body_parts[0].intersection(body_parts[1])
    # A retained control component can enclose feedback or changing material.
    # Its exact mask must persist; its whole bounding rectangle need not.
    if len(persistent_body_parts) != 1:
        return ()
    grid = after_grids[0]
    world = BoundingBox(
        top=geometry[1], left=geometry[2],
        bottom=geometry[1]+(geometry[7]-1)*geometry[5]+geometry[3]-1,
        right=geometry[2]+(geometry[8]-1)*geometry[6]+geometry[4]-1)
    # Import only at measurement time: transition analysis and interaction
    # enumeration share the existing exact shape-complement implementation.
    from .interaction import measure_edge_display_shape_complements
    relations = [
        ('BEFORE', before, before_grids,
         measure_edge_display_shape_complements(before, before_grids)),
        ('AFTER', after, after_grids,
         measure_edge_display_shape_complements(after, after_grids)),
    ]
    before_parts = detect_components(ComponentExtractionInput(frame=before, connectivity=8)).components
    after_parts = detect_components(ComponentExtractionInput(frame=after, connectivity=8)).components
    # An already acquired empty display slot lets a new shape be measured
    # without inventing an unseen compatible access. Only current pixel
    # replacement and the coupled local world change qualify the sample.
    slots = {}
    for method in value.canonical_inventory_access_method_facts:
        if method.get('observation_kind') != 'local_shape_transfer_to_edge_display':
            continue
        coordinates = tuple(method.get('display_slot_bbox', ()))
        if len(coordinates) != 4:
            continue
        slot = BoundingBox(top=coordinates[0], left=coordinates[1], bottom=coordinates[2], right=coordinates[3])
        old, new = _patch(before, slot), _patch(after, slot)
        if old != method.get('display_patch_before') or old is None or new is None:
            continue
        cells = [cell for cell in grid.cells if _contains(cell.bbox, new_body)]
        if len(cells) != 1 or (slot.height, slot.width) != (cells[0].bbox.height, cells[0].bbox.width):
            continue
        changed = frozenset((r, c) for r in range(slot.height) for c in range(slot.width) if old[r][c] != new[r][c])
        colors = {new[r][c] for r, c in changed}
        if len(colors) != 1:
            continue
        color = next(iter(colors))
        if color in {pixel for row in old for pixel in row}:
            continue
        top, left = min(r for r, c in changed), min(c for r, c in changed)
        bottom, right = max(r for r, c in changed), max(c for r, c in changed)
        target = cells[0].bbox
        token = (coordinates, tuple(sorted(changed)), color)
        sample = slots.setdefault(token, {
            'target_bbox': (target.top, target.left, target.bottom, target.right),
            'display_bbox': (slot.top+top, slot.left+left, slot.top+bottom, slot.left+right),
            'display_cell_offset': (top, left),
            'display_relative_pixels': tuple(sorted((r-top, c-left) for r, c in changed)),
            'inserted_cell_pixels': tuple(sorted(changed)), 'shared_value': color,
            'acquired_slot_projection': True, 'slot_acquisition_support_refs': []})
        if method.get('source_claim_ref'):
            sample['slot_acquisition_support_refs'].append(method['source_claim_ref'])
    if slots:
        relations.append(('AFTER', after, after_grids, tuple(FrozenMap(slots[key]) for key in sorted(slots))))

    def count(parts, shape, color):
        return sum(not _overlaps(world, part.bbox)
                   and int(part.value) == color
                   and tuple(sorted(part.relative_pixels)) == shape
                   for part in parts)

    rows = {}
    for side, frame, _grids, matches in relations:
        for match in matches:
            target = BoundingBox(top=match['target_bbox'][0], left=match['target_bbox'][1],
                                 bottom=match['target_bbox'][2], right=match['target_bbox'][3])
            shape = tuple(match['display_relative_pixels'])
            mask = frozenset(match['inserted_cell_pixels'])
            color = int(match['shared_value'])
            display = match['display_bbox']
            dy, dx = match['display_cell_offset']
            slot = BoundingBox(top=display[0]-dy, left=display[1]-dx,
                               bottom=display[0]-dy+target.height-1,
                               right=display[1]-dx+target.width-1)
            old_slot, new_slot = _patch(before, slot), _patch(after, slot)
            if old_slot is None or new_slot is None or _overlaps(world, slot):
                continue
            old_count, new_count = count(before_parts, shape, color), count(after_parts, shape, color)
            slot_projection = match.get('acquired_slot_projection', False)
            if slot_projection:
                old_count, new_count = 0, 1
            if old_count > 1 or new_count > 1:
                continue
            old_uniform = len({pixel for row in old_slot for pixel in row}) == 1
            new_uniform = len({pixel for row in new_slot for pixel in row}) == 1
            kind = None
            contact = None
            if side == 'BEFORE' and old_count == 1 and _contains(target, new_body) and not _overlaps(target, old_body):
                dr, dc = new_body.top-old_body.top, new_body.left-old_body.left
                if (new_body.height, new_body.width) != (old_body.height, old_body.width):
                    continue
                if not ((abs(dr) == grid.row_pitch and dc == 0)
                        or (dr == 0 and abs(dc) == grid.col_pitch)):
                    continue
                visible = [(r, c) for r in range(target.top, target.bottom+1)
                           for c in range(target.left, target.right+1)
                           if not(new_body.top <= r <= new_body.bottom
                                  and new_body.left <= c <= new_body.right)]
                if not visible or not any(before.rows[r][c] != after.rows[r][c] for r, c in visible):
                    continue
                kind = 'display_conditioned_adjacent_entry'
                contact = target
            elif side == 'AFTER' and old_count == 0 and new_count == 1 and old_body == new_body:
                changed = {(r, c) for r in range(target.height)
                           for c in range(target.width) if old_slot[r][c] != new_slot[r][c]}
                if changed != mask or any(new_slot[r][c] != color for r, c in mask):
                    continue
                cells = [cell for cell in grid.cells if _contains(cell.bbox, new_body)]
                if len(cells) != 1:
                    continue
                contact = cells[0].bbox
                if (contact.height, contact.width) != (target.height, target.width):
                    continue
                visible = [(r, c) for r in range(contact.top, contact.bottom+1)
                           for c in range(contact.left, contact.right+1)
                           if not(new_body.top <= r <= new_body.bottom
                                  and new_body.left <= c <= new_body.right)]
                expected = {(contact.top+r, contact.left+c) for r, c in mask}
                observed = {(r, c) for r, c in visible if int(before.rows[r][c]) == color}
                expected_visible = expected.intersection(visible)
                if (not expected_visible or observed != expected_visible
                        or any(int(after.rows[r][c]) == color for r, c in expected_visible)):
                    continue
                kind = 'local_shape_transfer_to_edge_display'
            if kind is None:
                continue
            shape_ref = 'shape.inventory_part.'+stable_digest((shape, color))[:24]
            if slot_projection and any(row['observation_kind'] == kind and row['part_shape_ref'] == shape_ref
                    and row['display_slot_bbox'] == (slot.top, slot.left, slot.bottom, slot.right)
                    for row in (rows[key] for key in sorted(rows))):
                continue
            hole_ref = (None if slot_projection else
                'shape.complementary_cell.'+stable_digest((target.height, target.width, tuple(sorted(mask))))[:24])
            token = stable_digest((value.transition_ref, kind, shape_ref, hole_ref, slot.top, slot.left))[:24]
            row = FrozenMap({
                'observation_token': token, 'observation_kind': kind,
                'transition_ref': value.transition_ref, 'action_ref': value.action_ref,
                'context_epoch': getattr(value, 'context_epoch', 0),
                'before_frame_ref': value.before_frame_ref,
                'after_frame_ref': value.after_frame_ref,
                'part_shape_ref': shape_ref, 'complementary_shape_ref': hole_ref,
                'part_relative_pixels': shape, 'inserted_cell_pixels': tuple(sorted(mask)),
                'part_value': color, 'display_slot_bbox': (slot.top, slot.left, slot.bottom, slot.right),
                'display_patch_before': old_slot, 'display_patch_after': new_slot,
                'display_part_count_before': old_count, 'display_part_count_after': new_count,
                'display_count_scope': 'acquired_slot_pattern' if slot_projection else 'off_grid_components',
                'compatible_access_relation_observed': not slot_projection,
                'slot_acquisition_support_refs': tuple(dict.fromkeys(match.get('slot_acquisition_support_refs', ()))),
                'slot_acquisition_support_ref_count': len(set(match.get('slot_acquisition_support_refs', ()))),
                'display_patch_uniform_before': old_uniform, 'display_patch_uniform_after': new_uniform,
                'world_contact_bbox': (contact.top, contact.left, contact.bottom, contact.right),
                'world_contact_patch_before': _patch(before, contact),
                'world_contact_patch_after': _patch(after, contact),
                'matched_access_bbox': None if slot_projection else (target.top, target.left, target.bottom, target.right),
                'matched_access_patch_before': None if slot_projection else _patch(before, target),
                'matched_access_patch_after': None if slot_projection else _patch(after, target),
                'body_before_bbox': (old_body.top, old_body.left, old_body.bottom, old_body.right),
                'body_after_bbox': (new_body.top, new_body.left, new_body.bottom, new_body.right),
                'canonical_grid_geometry': geometry,
                'canonical_grid_support_refs': tuple(dict.fromkeys((
                    *((bindings[0]['term_ref'],) if bindings[0].get('term_ref') else ()),
                    *bindings[0].get('lattice_measurement_support_refs', ()),
                    *bindings[0].get('role_premise_claim_refs', ())))),
                'hidden_ownership_absence_proven': False,
                'universal_mechanism_law_proven': False,
            })
            rows[token] = row
    return tuple(rows[key] for key in sorted(rows))[:16]


def _current_role_shape_boxes(frame, canonical_rows):
    """Rebind only exact acquired control shapes; stationary is admissible."""
    parts = detect_components(ComponentExtractionInput(frame=frame, connectivity=4)).components
    boxes, supports = set(), set()
    for row in canonical_rows:
        digest = row.get('shape_digest')
        if not isinstance(digest, str) or not digest:
            continue
        for part in parts:
            if (part.bbox.height == row.get('bbox_height')
                    and part.bbox.width == row.get('bbox_width')
                    and part.value == row.get('observed_value')
                    and stable_digest(part.relative_pixels).startswith(digest)):
                boxes.add(part.bbox)
                if row.get('term_ref'):
                    supports.add(row['term_ref'])
                supports.update(row.get('role_premise_claim_refs', ()))
    return tuple(sorted(boxes, key=lambda b: (b.top, b.left, b.bottom, b.right))), tuple(sorted(supports))


def measure_boundary_display_deltas(request):
    """Compare an acquired display sample across two different scene epochs.

    This records pixels and provenance, never the hidden contents of a slot.
    DRM alone decides whether they support a revisable episode supposition.
    """
    if request['before_context_epoch'] == request['after_context_epoch']:
        return ()
    acquisitions = tuple(sample for sample in request.get('canonical_inventory_access_method_facts', ())
                         if sample.get('observation_kind') == 'local_shape_transfer_to_edge_display')
    if not acquisitions:
        return ()
    packet = tuple(request.get('observed_transition_packet', ()))
    if packet:
        last = packet[-1]
        if (last['before_frame_ref'] != request['before_frame_ref']
                or last['after_frame_ref'] != request['after_frame_ref']
                or last['before_frame'] != request['before'] or last['after_frame'] != request['after']):
            raise ValueError('boundary display differs from the sealed terminal observation pair')
    before = FrameGrid.model_validate(request['before'])
    after = FrameGrid.model_validate(request['after'])
    groups = {}
    for sample in acquisitions:
        coordinates = tuple(sample.get('display_slot_bbox', ()))
        if len(coordinates) != 4:
            continue
        box = BoundingBox(**dict(zip(('top', 'left', 'bottom', 'right'), coordinates)))
        old, new = _patch(before, box), _patch(after, box)
        if old is None or new is None or old != sample.get('display_patch_after'):
            continue
        key = (coordinates, sample['part_shape_ref'], old, new,
               sample['display_patch_before'], sample['inserted_cell_pixels'], sample['part_value'])
        groups.setdefault(key, []).append(sample)
    rows = []
    for (coordinates, shape_ref, old, new, _empty, _pixels, _value), samples in sorted(groups.items()):
        sample = samples[0]
        refs = tuple(sorted({row['source_claim_ref'] for row in samples}))
        empty = sample['display_patch_before']
        differences = frozenset((r, c) for r, line in enumerate(new)
                                for c, pixel in enumerate(line) if pixel != empty[r][c])
        old_values = {pixel for line in empty for pixel in line}
        difference_values = {new[r][c] for r, c in differences}
        one_support = any(differences == frozenset(
            (r, c) for r, line in enumerate(empty) for c, pixel in enumerate(line) if pixel == colour)
            for colour in old_values)
        if (not differences or not one_support or len(difference_values) != 1
                or difference_values.intersection(old_values) or new == old):
            continue
        token = stable_digest((request['before_frame_ref'], request['after_frame_ref'],
                               coordinates, shape_ref, old, new, refs))[:24]
        rows.append(FrozenMap({
            'observation_token': token,
            'observation_kind': 'boundary_display_patch_change',
            'transition_ref': token,
            'action_ref': request['action_ref'],
            'before_frame_ref': request['before_frame_ref'],
            'after_frame_ref': request['after_frame_ref'],
            'before_context_epoch': request['before_context_epoch'],
            'context_epoch': request['after_context_epoch'],
            'display_slot_bbox': coordinates,
            'display_patch_before': old, 'display_patch_after': new,
            'display_empty_patch': empty,
            'display_before_equals_acquired_sample': True,
            'display_after_equals_empty_sample': new == sample.get('display_patch_before'),
            'display_after_equals_acquired_sample': new == old,
            'display_after_palette_count': len({pixel for line in new for pixel in line}),
            'display_after_empty_delta_is_single_palette_support': bool(differences) and one_support,
            'display_after_empty_delta_value_count': len(difference_values),
            'display_after_empty_delta_value_is_new': not difference_values.intersection(old_values),
            'part_shape_ref': shape_ref,
            'part_relative_pixels': sample['part_relative_pixels'],
            'inserted_cell_pixels': sample['inserted_cell_pixels'],
            'part_value': sample['part_value'],
            'acquisition_support_refs': refs,
            'inventory_evidence_refs': (*refs, request['before_frame_ref'], request['after_frame_ref']),
        }))
        if len(rows) > 16:
            raise ValueError('boundary display comparison exceeds its event bound')
    return tuple(rows)


def measure_episode_display_basis_changes(request):
    """Record each observed change of a canonical display basis, including a
    change followed by an identical later image in the same primitive packet.
    No conclusion about hidden ownership is supplied by this measurement.
    """
    bases = tuple(request.get('canonical_episode_inventory_facts', ()))
    if not bases:
        return ()
    pairs = tuple(request.get('observed_transition_packet', ())) or (FrozenMap({
        'before_frame': request['before'], 'after_frame': request['after'],
        'before_frame_ref': request['before_frame_ref'], 'after_frame_ref': request['after_frame_ref'],
        'before_context_epoch': request['before_context_epoch'],
        'context_epoch': request['after_context_epoch'], 'action_ref': request['action_ref'],
    }),)
    if len(pairs) > 512:
        raise ValueError('episode display packet exceeds its observation bound')
    last = pairs[-1]
    if (last['before_frame_ref'] != request['before_frame_ref']
            or last['after_frame_ref'] != request['after_frame_ref']
            or last['before_frame'] != request['before'] or last['after_frame'] != request['after']):
        raise ValueError('episode display differs from the sealed terminal observation pair')
    rows = []
    previous = None
    for pair in pairs:
        if previous is not None and (
                previous['after_frame_ref'] != pair['before_frame_ref']
                or previous['after_frame'] != pair['before_frame']
                or previous['context_epoch'] != pair['before_context_epoch']):
            raise ValueError('episode display observation packet lineage interrupted')
        previous = pair
        before = FrameGrid.model_validate(pair['before_frame'])
        after = FrameGrid.model_validate(pair['after_frame'])
        for basis in bases:
            if basis['context_epoch'] != pair['before_context_epoch']:
                continue
            box = BoundingBox(**dict(zip(('top', 'left', 'bottom', 'right'), basis['display_slot_bbox'])))
            old, new = _patch(before, box), _patch(after, box)
            if old != basis['display_patch_after'] or old == new:
                continue
            token = stable_digest((basis['source_claim_ref'], pair['before_frame_ref'],
                                   pair['after_frame_ref'], old, new))[:24]
            rows.append(FrozenMap({
                'observation_token': token, 'observation_kind': 'episode_display_basis_change',
                'transition_ref': token, 'action_ref': pair['action_ref'],
                'before_frame_ref': pair['before_frame_ref'], 'after_frame_ref': pair['after_frame_ref'],
                'context_epoch': pair['before_context_epoch'],
                'basis_claim_ref': basis['source_claim_ref'], 'observed_basis_patch_changed': True,
                'inventory_evidence_refs': (basis['source_claim_ref'], pair['before_frame_ref'], pair['after_frame_ref']),
            }))
            if len(rows) > 16:
                raise ValueError('episode display changes exceed their event bound')
    return tuple(rows)


def measure_inventory_access_packet(*, request, canonical_grid_rows):
    """One bounded acquisition pass over an already sealed observation packet.

    No actions, perception calls, selections or reconciliations occur here.
    Intermediate pairs are actual transport observations, not a replay model.
    The pre-word canonical lattice and acquired body shapes are revalidated
    against every supplied pair. Conflicting body matches remain ambiguous.
    """
    extra_rows = (*measure_boundary_display_deltas(request), *measure_episode_display_basis_changes(request))
    if len(extra_rows) > 16:
        raise ValueError('inventory observation event domain bound exceeded')
    if len(canonical_grid_rows) != 1:
        return extra_rows
    pairs = tuple(request.get('observed_transition_packet', ()))
    if not pairs:
        pairs = (FrozenMap({
            'before_frame': request['before'], 'after_frame': request['after'],
            'before_frame_ref': request['before_frame_ref'], 'after_frame_ref': request['after_frame_ref'],
            'before_context_epoch': request['before_context_epoch'], 'context_epoch': request['after_context_epoch'],
            'action_ref': request['action_ref'],
        }),)
    if len(pairs) > 512:
        raise ValueError('inventory observation packet bound exceeded')
    last = pairs[-1]
    if (last['before_frame_ref'] != request['before_frame_ref']
            or last['after_frame_ref'] != request['after_frame_ref']
            or last['before_frame'] != request['before'] or last['after_frame'] != request['after']):
        raise ValueError('inventory observation packet differs from the sealed terminal pair')
    previous, rows, rebound = None, [], {}
    for pair in pairs:
        before, after = (FrameGrid.model_validate(pair[name]) for name in ('before_frame', 'after_frame'))
        if (before.height * before.width > 4096 or after.height * after.width > 4096
                or pair['before_context_epoch'] != pair['context_epoch']):
            continue
        if previous is not None and (
                previous['after_frame_ref'] != pair['before_frame_ref']
                or previous['after_frame'] != pair['before_frame']
                or previous['context_epoch'] != pair['before_context_epoch']):
            raise ValueError('inventory observation packet lineage interrupted')
        previous = pair
        for name, frame in (('before_frame_ref', before), ('after_frame_ref', after)):
            ref = pair[name]
            if ref not in rebound:
                rebound[ref] = _current_role_shape_boxes(frame, request['canonical_control_term_facts'])
        old_boxes, old_supports = rebound[pair['before_frame_ref']]
        new_boxes, new_supports = rebound[pair['after_frame_ref']]
        pixel_pair = InventoryAccessPixelPair(
            before_frame=before, after_frame=after,
            before_frame_ref=pair['before_frame_ref'], after_frame_ref=pair['after_frame_ref'],
            canonical_typed_cell_lattice_facts=canonical_grid_rows,
            canonical_inventory_access_method_facts=tuple(request.get('canonical_inventory_access_method_facts', ())),
            pre_action_input_aligned_entity_bboxes=old_boxes,
            post_action_input_aligned_entity_bboxes=new_boxes,
            action_ref=pair['action_ref'], context_epoch=pair['context_epoch'],
            transition_ref='observed.inventory.pair.'+stable_digest((
                pair['before_frame_ref'], pair['after_frame_ref'], pair['action_ref']))[:24])
        for row in measure_inventory_access_observations(pixel_pair):
            rows.append(FrozenMap.overlay({
                'inventory_evidence_refs': tuple(dict.fromkeys((
                    request['before_frame_ref'], request['after_frame_ref'],
                    pair['before_frame_ref'], pair['after_frame_ref'],
                    *row['canonical_grid_support_refs'], *row['slot_acquisition_support_refs'], *old_supports, *new_supports))),
                'observed_packet_pair_count': len(pairs),
            }, row))
            if len(rows) + len(extra_rows) > 16:
                raise ValueError('inventory observation event domain bound exceeded')
    return (*rows, *extra_rows)


def revalidate_inventory_display_samples(value):
    """Return only acquisition samples whose display is currently recognized."""
    frame = value.current_observed_frame or value.frame
    memories = value.canonical_inventory_access_method_facts
    known = [row for row in memories if row.get('observation_kind')
             == 'local_shape_transfer_to_edge_display']
    matched = []
    for row in known:
        geometry = tuple(row.get('canonical_grid_geometry', ()))
        current_geometry = value.retained_grid_geometry
        if (not current_geometry or len(geometry) != 9
                or geometry[1:] != tuple(current_geometry)):
            continue
        coordinates = row.get('display_slot_bbox', ())
        if len(coordinates) != 4:
            continue
        box = BoundingBox(top=coordinates[0], left=coordinates[1],
                          bottom=coordinates[2], right=coordinates[3])
        patch = _patch(frame, box)
        present = patch == row.get('display_patch_after')
        absent = patch == row.get('display_patch_before')
        if not present and not absent:
            continue
        matched.append((row, present, absent))
    return tuple(matched)


def _current_acquired_part_patch_matches(frame, endpoint, acquisition):
    patch = _patch(frame, endpoint)
    mask = frozenset(tuple(p) for p in acquisition.get('inserted_cell_pixels', ()))
    if not patch or not mask:
        return False
    observed = frozenset((r, c) for r, row in enumerate(patch)
                         for c, v in enumerate(row) if v == acquisition.get('part_value'))
    if observed != mask:
        return False
    prior = acquisition.get('world_contact_patch_before', ())
    old_body, old_cell = acquisition.get('body_before_bbox', ()), acquisition.get('world_contact_bbox', ())
    if (len(prior) != len(patch) or any(len(a) != len(b) for a, b in zip(prior, patch))
            or len(old_body) != 4 or len(old_cell) != 4):
        return False
    return all(patch[r][c] == prior[r][c] for r in range(len(patch)) for c in range(len(patch[r]))
               if not(old_body[0] <= old_cell[0]+r <= old_body[2]
                      and old_body[1] <= old_cell[1]+c <= old_body[3]))


def _current_observed_access_samples(frame, acquisition, memories):
    _, top, left, height, width, pitch_r, pitch_c, rows, cols = acquisition['canonical_grid_geometry']
    found = []
    for entry in memories:
        if (entry.get('observation_kind') != 'display_conditioned_adjacent_entry'
                or entry.get('part_shape_ref') != acquisition.get('part_shape_ref')):
            continue
        pattern = entry.get('matched_access_patch_before', ())
        if not pattern:
            continue
        for r in range(rows):
            for c in range(cols):
                cell = BoundingBox(top=top+r*pitch_r, left=left+c*pitch_c,
                                   bottom=top+r*pitch_r+height-1, right=left+c*pitch_c+width-1)
                if _patch(frame, cell) == pattern:
                    found.append((entry, cell))
                    if len(found) >= 16:
                        return tuple(found)
    return tuple(found)


def measure_current_acquisition_endpoint_boxes(value):
    """All current whole-cell matches paired with an observed access sample.

    This supplies endpoints to the ordinary route service. It does not rank
    them, infer a necessary key, simulate an effect, or authorize an action.
    """
    frame = value.current_observed_frame or value.frame
    boxes = set()
    for row, present, absent in revalidate_inventory_display_samples(value):
        if (not absent or row.get('observation_kind') != 'local_shape_transfer_to_edge_display'
                or not _current_observed_access_samples(frame, row, value.canonical_inventory_access_method_facts)):
            continue
        _, top, left, height, width, pitch_r, pitch_c, rows, cols = row['canonical_grid_geometry']
        for r in range(rows):
            for c in range(cols):
                box = BoundingBox(top=top+r*pitch_r, left=left+c*pitch_c,
                                  bottom=top+r*pitch_r+height-1, right=left+c*pitch_c+width-1)
                if _current_acquired_part_patch_matches(frame, box, row):
                    boxes.add((box.top, box.left, box.bottom, box.right))
                    if len(boxes) >= 16:
                        return tuple(BoundingBox(top=a,left=b,bottom=c,right=d) for a,b,c,d in sorted(boxes))
    return tuple(BoundingBox(top=a,left=b,bottom=c,right=d) for a,b,c,d in sorted(boxes))


def _acquisition_route_access_samples(frame, route, acquisition, memories):
    """Compare a supplied endpoint and access with witnessed pixel masks."""
    names = tuple('provisional_object_terminating_aligned_entry_region_'+axis
                  for axis in ('top', 'left', 'bottom', 'right'))
    if (route.get('candidate_is_provisional_object_terminating_route_first_action') is not True
            or route.get('provisional_object_terminating_aligned_entry_region_present') is not True
            or any(route.get(name) is None for name in names)):
        return ()
    endpoint = BoundingBox(**dict(zip(('top', 'left', 'bottom', 'right'),
        (int(route[name]) for name in names))))
    if not _current_acquired_part_patch_matches(frame, endpoint, acquisition):
        return ()
    return tuple(FrozenMap({
        'acquisition_support_ref': acquisition['source_claim_ref'],
        'entry_support_ref': entry['source_claim_ref'],
        'part_shape_ref': acquisition['part_shape_ref'],
        'transfer_action_ref': acquisition['action_ref'],
        'acquisition_route_ref': route['provisional_object_terminating_route_ref'],
        'acquisition_route_length': route['provisional_object_terminating_route_length'],
        'matched_access_bbox': (cell.top, cell.left, cell.bottom, cell.right),
    }) for entry, cell in _current_observed_access_samples(frame, acquisition, memories))


def measure_current_inventory_methods(value, agenda):
    """Match durable samples against current pixels without assigning a goal.

    Empty and filled display patches are learned from the same witnessed
    transfer. A screen reset does not erase that method; it also does not
    retain the preceding possession state. Unknown patches stay unknown.
    """
    frame = value.current_observed_frame or value.frame
    memories = value.canonical_inventory_access_method_facts
    matched = revalidate_inventory_display_samples(value)
    held, empty, supports = set(), set(), set()
    for row, present, absent in matched:
        if present:
            held.add(row['part_shape_ref'])
        if absent:
            empty.add(tuple(row['display_slot_bbox']))
        if row.get('source_claim_ref'):
            supports.add(row['source_claim_ref'])
    bodies = value.canonical_provisional_control_geometry_bboxes
    body = bodies[0] if len(bodies) == 1 else None
    by_ref = {}
    for candidate in agenda.candidates:
        reuse_transfer, reuse_entry, reuse_route, acquisition_dependencies = [], [], [], []
        for row, present, absent in matched:
            if body is None:
                continue
            geometry = row['canonical_grid_geometry']
            _, top, left, height, width, pitch_r, pitch_c, rows, cols = geometry
            cells = [(top+r*pitch_r, left+c*pitch_c)
                     for r in range(rows) for c in range(cols)
                     if top+r*pitch_r <= body.top <= body.bottom < top+r*pitch_r+height
                     and left+c*pitch_c <= body.left <= body.right < left+c*pitch_c+width]
            if len(cells) != 1:
                continue
            y, x = cells[0]
            contact = BoundingBox(top=y, left=x, bottom=y+height-1, right=x+width-1)
            visible = [(r, c) for r in range(height) for c in range(width)
                       if not(body.top <= y+r <= body.bottom and body.left <= x+c <= body.right)]
            prior_contact = row.get('world_contact_patch_before', ())
            prior_body, prior_cell = row.get('body_before_bbox', ()), row.get('world_contact_bbox', ())
            part_mask = frozenset(tuple(point) for point in row.get('inserted_cell_pixels', ()))
            expected_visible = part_mask.intersection(visible)
            observed_visible = {(r, c) for r, c in visible if frame.rows[y+r][x+c] == row.get('part_value')}
            if (absent and candidate.action_ref == row.get('action_ref') and visible
                    and len(prior_contact) == height
                    and len(prior_body) == len(prior_cell) == 4
                    and expected_visible and observed_visible == expected_visible
                    and all(frame.rows[y+r][x+c] == prior_contact[r][c] for r, c in visible
                        if not(prior_body[0] <= prior_cell[0]+r <= prior_body[2]
                               and prior_body[1] <= prior_cell[1]+c <= prior_body[3]))):
                reuse_transfer.append(row['source_claim_ref'])
            if absent and row.get('observation_kind') == 'local_shape_transfer_to_edge_display':
                acquisition_dependencies.extend(_acquisition_route_access_samples(
                    frame, agenda.alternative_facts.get(candidate.candidate_ref, {}), row, memories))
            if not present:
                continue
            for entry in memories:
                if (entry.get('observation_kind') != 'display_conditioned_adjacent_entry'
                        or entry.get('part_shape_ref') != row['part_shape_ref']):
                    continue
                old, new = entry.get('body_before_bbox', ()), entry.get('body_after_bbox', ())
                if len(old) != 4 or len(new) != 4:
                    continue
                deltas = [delta for ref, *delta in value.known_action_translation_deltas
                          if ref == candidate.action_ref]
                # A direction is recalled only through currently acquired motor
                # evidence. The witnessed entry is not tied to its old heading.
                target_pattern = entry.get('matched_access_patch_before', ())
                route = agenda.alternative_facts.get(candidate.candidate_ref, {})
                endpoint_names = tuple('provisional_object_terminating_aligned_entry_region_'+axis
                                       for axis in ('top', 'left', 'bottom', 'right'))
                if (route.get('candidate_is_provisional_object_terminating_route_first_action') is True
                        and route.get('provisional_object_terminating_aligned_entry_region_present') is True
                        and all(route.get(name) is not None for name in endpoint_names)):
                    endpoint = BoundingBox(**dict(zip(('top', 'left', 'bottom', 'right'),
                        (int(route[name]) for name in endpoint_names))))
                    if _patch(frame, endpoint) == target_pattern:
                        reuse_route.extend((row['source_claim_ref'], entry['source_claim_ref']))
                for dr, dc in deltas:
                    if not ((abs(dr) == pitch_r and dc == 0) or (dr == 0 and abs(dc) == pitch_c)):
                        continue
                    destination = BoundingBox(top=y+dr, left=x+dc,
                        bottom=y+dr+height-1, right=x+dc+width-1)
                    if _patch(frame, destination) == target_pattern:
                        reuse_entry.extend((row['source_claim_ref'], entry['source_claim_ref']))
        acquisition_refs = [ref for dependency in acquisition_dependencies
                            for ref in (dependency['acquisition_support_ref'], dependency['entry_support_ref'])]
        refs = tuple(sorted(set(reuse_transfer+reuse_entry+reuse_route+acquisition_refs)))
        by_ref[candidate.candidate_ref] = FrozenMap({
            'inventory_current_revalidated_held_part_refs': tuple(sorted(held)),
            'inventory_current_revalidated_empty_display_count': len(empty),
            'inventory_current_revalidated_sample_support_refs': tuple(sorted(supports)),
            'inventory_current_transfer_method_match': bool(reuse_transfer),
            'inventory_current_adjacent_entry_method_match': bool(reuse_entry),
            'inventory_current_measured_route_to_access_method_match': bool(reuse_route),
            'inventory_current_measured_route_to_acquisition_for_access_method_match': bool(acquisition_dependencies),
            'inventory_current_acquisition_access_dependency_rows': tuple(acquisition_dependencies[:16]),
            'inventory_current_matched_method_support_refs': refs,
            'inventory_hidden_contents_complete': False,
            'inventory_exact_capacity_known': False,
        })
    return FrozenMap(by_ref), FrozenMap({
        'inventory_current_revalidated_held_part_refs': tuple(sorted(held)),
        'inventory_current_revalidated_empty_display_count': len(empty),
        'inventory_current_revalidated_sample_support_refs': tuple(sorted(supports)),
        'inventory_durable_observation_count': len(memories),
    })


def _current_episode_display_rows(value):
    frame = value.current_observed_frame or value.frame
    current = []
    for row in value.canonical_episode_inventory_facts:
        coordinates = tuple(row.get('display_slot_bbox', ()))
        if len(coordinates) != 4 or row.get('context_epoch') != value.current_context_epoch:
            continue
        box = BoundingBox(**dict(zip(('top', 'left', 'bottom', 'right'), coordinates)))
        if _patch(frame, box) == row.get('display_patch_after'):
            current.append(row)
    return tuple(current)


def _episode_endpoint_has_exact_complement(frame, box, row):
    old = row['display_patch_before']
    if len(old) != box.height or any(len(line) != box.width for line in old):
        return False
    patch = _patch(frame, box)
    if patch is None:
        return False
    full = frozenset((r, c) for r in range(box.height) for c in range(box.width))
    part = frozenset(tuple(point) for point in row['inserted_cell_pixels'])
    fill = frozenset((r, c) for r, line in enumerate(patch)
                     for c, pixel in enumerate(line) if pixel == row['part_value'])
    return bool(part and fill and not part.intersection(fill) and part.union(fill) == full)


def measure_current_episode_endpoint_boxes(value):
    """Enumerate current-grid complements of Source-retained observed masks.

    These are alternative geometric endpoints for the ordinary route service.
    No hidden ownership, successful access, ranking or action is inferred.
    Current geometry replaces every coordinate from the acquisition sample.
    """
    current = _current_episode_display_rows(value)
    geometry = value.retained_grid_geometry
    if not current or not geometry:
        return ()
    top, left, height, width, pitch_r, pitch_c, rows, cols = geometry
    if rows * cols > 1024:
        return ()
    frame = value.current_observed_frame or value.frame
    boxes = set()
    for r in range(rows):
        for c in range(cols):
            box = BoundingBox(top=top+r*pitch_r, left=left+c*pitch_c,
                              bottom=top+r*pitch_r+height-1, right=left+c*pitch_c+width-1)
            if any(_episode_endpoint_has_exact_complement(frame, box, row) for row in current):
                boxes.add((box.top, box.left, box.bottom, box.right))
                if len(boxes) >= 16:
                    return tuple(BoundingBox(top=a,left=b,bottom=c,right=d)
                                 for a,b,c,d in sorted(boxes))
    return tuple(BoundingBox(top=a,left=b,bottom=c,right=d) for a,b,c,d in sorted(boxes))


def measure_episode_inventory_access(value, agenda):
    """Compare Source-retained episode candidates with current display/endpoints.

    An observed entry sample and a new complementary endpoint are separate
    measurements. No hidden possession or universal access law is asserted.
    """
    if not value.canonical_episode_inventory_facts:
        return FrozenMap(), FrozenMap()
    frame = value.current_observed_frame or value.frame
    entries = tuple(row for row in value.canonical_inventory_access_method_facts
                    if row.get('observation_kind') == 'display_conditioned_adjacent_entry')
    current = _current_episode_display_rows(value)
    by_ref = {}
    endpoint_names = tuple('provisional_object_terminating_aligned_entry_region_' + name
                           for name in ('top', 'left', 'bottom', 'right'))
    for candidate in agenda.candidates:
        facts = agenda.alternative_facts.get(candidate.candidate_ref, {})
        matches, method_refs = [], set()
        if all(isinstance(facts.get(name), int) for name in endpoint_names):
            box = BoundingBox(**dict(zip(('top', 'left', 'bottom', 'right'),
                                           (facts[name] for name in endpoint_names))))
            full = frozenset((r, c) for r in range(box.height) for c in range(box.width))
            for row in current:
                if _episode_endpoint_has_exact_complement(frame, box, row):
                    for entry in entries:
                        prior = entry.get('matched_access_patch_before', ())
                        prior_part = frozenset(tuple(point) for point in entry.get('inserted_cell_pixels', ()))
                        if len(prior) != box.height or any(len(line) != box.width for line in prior):
                            continue
                        prior_fill = frozenset((r, c) for r, line in enumerate(prior)
                                               for c, pixel in enumerate(line) if pixel == entry.get('part_value'))
                        if (prior_part and prior_fill and not prior_part.intersection(prior_fill)
                                and prior_part.union(prior_fill) == full):
                            method_refs.add(entry['source_claim_ref'])
                    matches.append(row)
        supports = tuple(sorted({ref for row in matches
                         for ref in (row['source_claim_ref'], *row['acquisition_support_refs'])}
                         | method_refs))
        basis_changes = tuple(change for change in value.canonical_episode_display_basis_change_facts
                              if any(change.get('basis_claim_ref') == row['source_claim_ref'] for row in matches))
        by_ref[candidate.candidate_ref] = FrozenMap({
            'inventory_episode_current_mask_match_count': len(current),
            'inventory_episode_endpoint_complement_match_count': len(matches),
            'inventory_episode_complementary_entry_sample_count': len(method_refs),
            'inventory_episode_matched_basis_change_count': len(basis_changes),
            'inventory_episode_part_refs': tuple(sorted({row['part_shape_ref'] for row in matches})),
            'inventory_episode_support_refs': supports,
            'inventory_episode_observed_control_frame_ref': value.current_observation_frame_ref,
            'inventory_episode_observed_control_bbox_tuples': tuple(
                (box.top, box.left, box.bottom, box.right)
                for box in value.canonical_provisional_control_geometry_bboxes),
            'inventory_episode_observed_control_patch_rows': (
                _patch(frame, value.canonical_provisional_control_geometry_bboxes[0])
                if len(value.canonical_provisional_control_geometry_bboxes) == 1
                and value.canonical_provisional_control_geometry_bboxes
                    == value.current_action_conditioned_control_outline_bboxes
                and value.canonical_provisional_control_geometry_bboxes[0].height
                    * value.canonical_provisional_control_geometry_bboxes[0].width <= 64
                else ()),
        })
    return FrozenMap(by_ref), FrozenMap({
        'inventory_episode_current_mask_match_count': len(current),
        'inventory_episode_boundary_candidate_count': len(value.canonical_episode_inventory_facts),
    })


def measure_current_scene_complement_pairs(value):
    """Exact complementary shared-colour masks on the supplied current grid.

    Counts and ordered endpoints are pixel measurements. No role, inventory,
    mechanical necessity, goal, interaction or selection is inferred here.
    """
    geometry = value.retained_grid_geometry
    if not geometry:
        return ()
    top, left, height, width, pitch_r, pitch_c, rows, cols = geometry
    if rows*cols > 1024:
        return ()
    frame = value.current_observed_frame or value.frame
    supports = {}
    for r in range(rows):
        for c in range(cols):
            box = BoundingBox(top=top+r*pitch_r, left=left+c*pitch_c,
                              bottom=top+r*pitch_r+height-1, right=left+c*pitch_c+width-1)
            patch = _patch(frame, box)
            if len(patch) != height or any(len(line) != width for line in patch):
                continue
            for colour in sorted({v for line in patch for v in line}):
                mask = frozenset((y,x)for y,line in enumerate(patch)for x,v in enumerate(line)if v==colour)
                supports.setdefault(colour, []).append((box,mask,len({v for line in patch for v in line})))
    full = frozenset((r,c)for r in range(height)for c in range(width))
    pairs = []
    for colour in sorted(supports):
        rows_for_colour = supports[colour]
        # Repeated shared material remains ambiguous; it is not matched by
        # distance or an arbitrary choice of one compatible pair.
        if len(rows_for_colour) != 2:
            continue
        a,b = sorted(rows_for_colour,key=lambda item:(len(item[1]),item[0].top,item[0].left))
        if (not a[1] or len(a[1]) >= len(b[1]) or a[1].intersection(b[1])
                or a[1].union(b[1]) != full):
            continue
        pairs.append(FrozenMap({
            'relation_ref':'measurement.scene_exact_complement.'+stable_digest((geometry,colour,a[0],b[0],tuple(sorted(a[1])),tuple(sorted(b[1]))))[:24],
            'smaller_support_bbox':(a[0].top,a[0].left,a[0].bottom,a[0].right),
            'larger_support_bbox':(b[0].top,b[0].left,b[0].bottom,b[0].right),
            'smaller_support_relative_pixels':tuple(sorted(a[1])),
            'larger_support_relative_pixels':tuple(sorted(b[1])),
            'shared_value':colour,
            'smaller_cell_palette_count':a[2],
            'larger_cell_palette_count':b[2],
            'shared_value_cell_occurrence_count':2,
            'cell_area':height*width,
        }))
    return tuple(pairs[:16])


def measure_scene_complement_route_rows(agenda, pairs):
    """Attach exact endpoint incidence and palette counts, without roles."""
    result = {}
    names = tuple('provisional_object_terminating_aligned_entry_region_'+axis
                  for axis in ('top','left','bottom','right'))
    for candidate in agenda.candidates:
        facts = agenda.alternative_facts[candidate.candidate_ref]
        endpoint = tuple(facts.get(name) for name in names)
        smaller = tuple(pair for pair in pairs if pair['smaller_support_bbox'] == endpoint)
        larger = tuple(pair for pair in pairs if pair['larger_support_bbox'] == endpoint)
        result[candidate.candidate_ref] = FrozenMap({
            'scene_complement_route_matches_smaller_support': bool(smaller),
            'scene_complement_route_matches_larger_support': bool(larger),
            'scene_complement_current_route_pair_rows': smaller,
            'scene_complement_current_route_pair_count': len(smaller),
            'scene_complement_smaller_cell_has_additional_palette_values': bool(
                len(smaller) == 1 and smaller[0]['smaller_cell_palette_count'] > smaller[0]['larger_cell_palette_count']),
        })
    return FrozenMap(result), FrozenMap({
        'scene_exact_complement_pair_rows': pairs,
        'scene_exact_complement_pair_count': len(pairs),
    })
