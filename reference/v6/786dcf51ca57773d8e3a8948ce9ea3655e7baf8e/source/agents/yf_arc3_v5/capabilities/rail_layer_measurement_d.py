"""Exact supplied mask samples and axial coordinates, without schema inference."""
from collections import Counter
from agents.yf_arc3_v5.logos.types import stable_digest
from .mechanical_family_contracts_d import d_map, DResumeMismatch, DComputationInterrupted


def rail_layer_parts(layout):
    yield layout.rail
    for train in layout.trains:
        yield train.body
        yield from train.noses
        for bay in train.bays:
            for part in (bay.positive_motif, bay.negative_motif, bay.content):
                if part is not None:
                    yield part
    for arm in layout.arms:
        yield arm.body
        if arm.held_content is not None:
            yield arm.held_content
    yield from layout.unattached_content


def rail_layer_evidence_refs(layout):
    return tuple(dict.fromkeys((layout.evidence_ref,
        *(part.evidence_ref for part in rail_layer_parts(layout)),
        *(bay.evidence_ref for train in layout.trains for bay in train.bays),
        *(arm.phase_evidence_ref for arm in layout.arms if arm.phase_evidence_ref))))


def _sample(frame, part, budget):
    if not part.part_ref or not part.evidence_ref:
        raise DResumeMismatch('RAIL_LAYER_PART_AND_CURRENT_EVIDENCE_REQUIRED')
    if len(part.cells) > budget.request.domain_bound:
        raise DComputationInterrupted('RAIL_LAYER_PIXEL_DOMAIN_BOUND', d_map({'part_ref': part.part_ref}))
    if len(set(part.cells)) != len(part.cells) or len(set(part.occluded_cells)) != len(part.occluded_cells):
        raise DResumeMismatch('RAIL_LAYER_MASK_HAS_DUPLICATE_COORDINATES')
    cells, occluded = frozenset(part.cells), frozenset(part.occluded_cells)
    if not occluded.issubset(cells):
        raise DResumeMismatch('RAIL_LAYER_OCCLUSION_OUTSIDE_ITS_DECLARED_SUPPORT')
    rows, unknown = [], []
    for row, column in part.cells:
        budget.visit({'part_ref': part.part_ref, 'pixel': (row, column)})
        pixel = frame.rows[row][column] if (row, column) not in occluded and 0 <= row < frame.height and 0 <= column < frame.width else None
        rows.append((row, column, pixel))
        if pixel is None:
            unknown.append((row, column))
    return d_map({'part_ref': part.part_ref, 'evidence_ref': part.evidence_ref,
        'sampled_pixels': tuple(rows), 'unknown_pixels': tuple(unknown),
        'signature': stable_digest(tuple(rows)), 'support_complete': not unknown})


def measure_rail_layers_d(request, budget):
    if (request.observed_frame is None or not request.frame_ref or request.frame_epoch != request.scope.epoch
            or not request.layer_layouts):
        raise DResumeMismatch('CURRENT_RAIL_FRAME_AND_SOURCE_BOUND_LAYOUTS_REQUIRED')
    if len(request.layer_layouts) > request.domain_bound or len({x.layout_ref for x in request.layer_layouts}) != len(request.layer_layouts):
        raise DResumeMismatch('BOUNDED_UNIQUE_RAIL_LAYOUT_ALTERNATIVES_REQUIRED')
    results = []
    for layout in request.layer_layouts:
        parts = tuple(rail_layer_parts(layout))
        if len(parts) > request.domain_bound:
            raise DComputationInterrupted('RAIL_LAYER_PART_DOMAIN_BOUND', d_map({'layout_ref': layout.layout_ref}))
        if (not layout.layout_ref or not layout.evidence_ref or len({x.part_ref for x in parts}) != len(parts)
                or len({x.train_ref for x in layout.trains}) != len(layout.trains)
                or len({x.arm_ref for x in layout.arms}) != len(layout.arms)
                or len({x.bay_ref for t in layout.trains for x in t.bays}) != sum(len(t.bays) for t in layout.trains)):
            raise DResumeMismatch('UNIQUE_SOURCE_BOUND_RAIL_LAYER_IDENTITIES_REQUIRED')
        sampled = {part.part_ref: _sample(request.observed_frame, part, budget) for part in parts}
        trains = []
        rail_cells = frozenset(layout.rail.cells)
        for train in layout.trains:
            budget.visit({'train_ref': train.train_ref})
            if train.axis not in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                raise DResumeMismatch('EXPLICIT_UNIT_AXIAL_RAIL_COORDINATES_REQUIRED')
            bays = []
            body_cells = frozenset(train.body.cells)
            coordinate_counts = Counter()
            for bay in train.bays:
                budget.visit({'bay_rank_ref': bay.bay_ref})
                coordinate_counts[bay.offset[0] * train.axis[0] + bay.offset[1] * train.axis[1]] += 1
            coordinate_ranks = {coordinate: index for index, coordinate in enumerate(sorted(coordinate_counts))}
            for bay in train.bays:
                budget.visit({'bay_ref': bay.bay_ref})
                rank = bay.offset[0] * train.axis[0] + bay.offset[1] * train.axis[1]
                perpendicular = bay.offset[0] * train.axis[1] - bay.offset[1] * train.axis[0]
                anchor = (train.origin[0] + bay.offset[0], train.origin[1] + bay.offset[1])
                bays.append(d_map({'bay_ref': bay.bay_ref, 'evidence_ref': bay.evidence_ref,
                    'axial_coordinate': rank, 'axial_rank_index': coordinate_ranks[rank],
                    'same_rank_occurrence_count': coordinate_counts[rank],
                    'perpendicular_coordinate': perpendicular, 'anchor': anchor,
                    'anchor_in_full_body': anchor in body_cells,
                    'positive_requirement_signature': sampled[bay.positive_motif.part_ref] if bay.positive_motif else None,
                    'negative_hole_signature': sampled[bay.negative_motif.part_ref] if bay.negative_motif else None,
                    'content_occurrence': sampled[bay.content.part_ref] if bay.content else None,
                    'schema_type_inferred_from_content': False}))
            trains.append(d_map({'train_ref': train.train_ref, 'origin': train.origin, 'axis': train.axis,
                'full_body': sampled[train.body.part_ref], 'both_noses': tuple(sampled[n.part_ref] for n in train.noses),
                'nose_offsets': train.nose_offsets,
                'nose_anchors': tuple((train.origin[0] + n[0], train.origin[1] + n[1]) for n in train.nose_offsets),
                'nose_anchor_in_declared_nose': tuple((train.origin[0] + n[0], train.origin[1] + n[1]) in p.cells
                    for n, p in zip(train.nose_offsets, train.noses)),
                'full_body_on_declared_rail': all(c in rail_cells for c in train.body.cells), 'bays': tuple(bays)}))
        arms = []
        for arm in layout.arms:
            budget.visit({'arm_ref': arm.arm_ref})
            arms.append(d_map({'arm_ref': arm.arm_ref, 'body': sampled[arm.body.part_ref],
                'donor_endpoint': arm.donor_endpoint, 'receiver_endpoint': arm.receiver_endpoint,
                'held_content_occurrence': sampled[arm.held_content.part_ref] if arm.held_content else None,
                'phase_evidence_ref': arm.phase_evidence_ref, 'transfer_reapplied': False}))
        results.append(d_map({'layout_ref': layout.layout_ref, 'evidence_refs': rail_layer_evidence_refs(layout),
            'rail': sampled[layout.rail.part_ref], 'trains': tuple(trains), 'arms': tuple(arms),
            'unattached_content': tuple(sampled[x.part_ref] for x in layout.unattached_content),
            'unknown_pixel_count': sum(len(sampled[ref]['unknown_pixels']) for ref in sorted(sampled)),
            'unprovided_motif_count': sum(int(b.positive_motif is None) + int(b.negative_motif is None)
                for t in layout.trains for b in t.bays),
            'schema_content_separated': True, 'canonical_state_mutated': False}))
    return tuple(results)
