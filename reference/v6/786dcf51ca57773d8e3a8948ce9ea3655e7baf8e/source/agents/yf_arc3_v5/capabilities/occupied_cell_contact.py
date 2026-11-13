"""Exact entered-cell raster contrasts; DRM owns the local operator question."""
from ..logos.types import FrozenMap, stable_digest


def measure_occupied_cell_contact(value, contract):
    if (not contract or value.current_context_epoch is None
            or not value.current_observation_frame_ref
            or not value.action_conditioned_grid_evidence):
        return FrozenMap()
    frame = value.current_observed_frame or value.frame
    before = value.previous_action_observed_frame
    if (frame != value.frame or before is None
            or frame.height * frame.width > contract['maximum_frame_pixels']
            or (before.height, before.width) != (frame.height, frame.width)):
        return FrozenMap()
    directions = {ref for ref, row, col in value.interface_action_translation_deltas
                  if bool(row) != bool(col)}
    if value.last_action_ref not in directions:
        return FrozenMap()
    boxes = tuple(value.input_aligned_entity_bboxes)
    canonical = tuple(value.canonical_provisional_control_geometry_bboxes)
    if len(boxes) != 1 or (canonical and canonical != boxes):
        return FrozenMap()
    body = boxes[0]
    from .interaction import (_unique_primitive_action_translation_quantum,
                              _unique_action_conditioned_control_centered_grid_candidate,
                              _action_quantized_route_grid_evidence_is_current)
    quantum = _unique_primitive_action_translation_quantum(value)
    if quantum is None or quantum < 3 or not _action_quantized_route_grid_evidence_is_current(value):
        return FrozenMap()
    grid = _unique_action_conditioned_control_centered_grid_candidate(value, quantum=quantum)
    if grid is None:
        return FrozenMap()
    containing = tuple(c.bbox for c in grid.cells
        if c.bbox.top <= body.top <= body.bottom <= c.bbox.bottom
        and c.bbox.left <= body.left <= body.right <= c.bbox.right)
    cell = containing[0] if len(containing) == 1 else None
    if (cell is None or cell.height * cell.width > contract['maximum_cell_pixels']
            or body.height * body.width > contract['maximum_control_pixels']
            or cell.top < 0 or cell.left < 0
            or cell.bottom >= frame.height or cell.right >= frame.width
            or not (cell.top <= body.top <= body.bottom <= cell.bottom
                    and cell.left <= body.left <= body.right <= cell.right)):
        return FrozenMap()
    border = tuple((r, c) for r in range(cell.top, cell.bottom + 1)
                   for c in range(cell.left, cell.right + 1)
                   if r in (cell.top, cell.bottom) or c in (cell.left, cell.right))
    border_values = {before.rows[r][c] for r, c in border}
    if len(border_values) != 1:
        return FrozenMap()
    exterior = next(iter(border_values))
    old = tuple(before.rows[r][c] for r in range(cell.top, cell.bottom + 1)
                for c in range(cell.left, cell.right + 1))
    inset_count = sum(before.rows[r][c] != exterior
                      for r in range(cell.top + 1, cell.bottom)
                      for c in range(cell.left + 1, cell.right))
    if not inset_count or len(set(old)) < 2:
        return FrozenMap()
    control_values = {frame.rows[r][c] for r in range(body.top, body.bottom + 1)
                      for c in range(body.left, body.right + 1)}
    if any(color in old for color in control_values):
        # The current control signature already existed here: entry is not
        # discriminated by this contrast, so do not manufacture an invitation.
        return FrozenMap()
    underlay = tuple(frame.rows[r][c] for r in range(cell.top, cell.bottom + 1)
                     for c in range(cell.left, cell.right + 1)
                     if not (body.top <= r <= body.bottom and body.left <= c <= body.right))
    if not underlay or len(set(underlay)) != 1 or underlay[0] == exterior:
        return FrozenMap()
    refs = tuple(c.component_id for c in value.components.components
        if c.value == underlay[0] and c.pixels
        and all(cell.top <= r <= cell.bottom and cell.left <= col <= cell.right
                for r, col in c.pixels))
    if len(refs) != 1:
        return FrozenMap()
    actors = tuple(c for c in value.components.components
                   if c.bbox == body and c.pixels
                   and c.value in control_values)
    subjects = tuple(c for c in value.components.components if c.component_id == refs[0])
    if len(actors) != 1 or len(subjects) != 1:
        return FrozenMap()
    actor, subject = actors[0], subjects[0]
    subject_pixels = set(subject.pixels)
    contacts = tuple((p, (p[0] + dr, p[1] + dc))
                     for p in sorted(actor.pixels)
                     for dr, dc in ((-1, 0), (0, -1), (0, 1), (1, 0))
                     if (p[0] + dr, p[1] + dc) in subject_pixels)
    if not contacts:
        return FrozenMap()
    witness = FrozenMap({'frame_ref': value.current_observation_frame_ref,
        'actor_component_ref': actor.component_id, 'subject_component_ref': subject.component_id,
        'actor_bbox': (body.top, body.left, body.bottom, body.right),
        'subject_bbox': (subject.bbox.top, subject.bbox.left, subject.bbox.bottom, subject.bbox.right),
        'cell_pitch': quantum, 'contact_geometry_kind': 'observed_pixel_boundary',
        'pixel_contact_pair': contacts[0]})
    bounds = (cell.top, cell.left, cell.bottom, cell.right)
    context = FrozenMap({'epoch': value.current_context_epoch,
        'source_frame_ref': value.current_observation_frame_ref,
        'source_frame_digest': stable_digest(frame), 'cell_bbox': bounds,
        'control_bbox': (body.top, body.left, body.bottom, body.right),
        'quantum': quantum, 'prior_patch_digest': stable_digest(old),
        'current_underlay_digest': stable_digest(underlay), 'prior_inset_pixel_count': inset_count})
    return FrozenMap({'occupied_cell_contact_observed': True,
        'occupied_cell_contact_token': stable_digest(context),
        'occupied_cell_contact_context': context,
        'occupied_cell_contact_witnesses': (witness,),
        'occupied_cell_contact_component_refs': refs,
        'occupied_cell_contact_prior_inset_pixel_count': inset_count,
        'occupied_cell_contact_underlay_pixel_count': len(underlay)})


def measure_occupied_cell_contact_candidates(value, agenda, contract):
    measured = measure_occupied_cell_contact(value, contract)
    if not measured:
        return FrozenMap()
    directions = {ref for ref, row, col in value.interface_action_translation_deltas
                  if bool(row) != bool(col)}
    return FrozenMap({candidate.candidate_ref: measured for candidate in agenda.candidates
        if candidate.point is None and candidate.action_ref not in directions
        and candidate.action_ref != value.level_start_checkpoint_action_ref})
