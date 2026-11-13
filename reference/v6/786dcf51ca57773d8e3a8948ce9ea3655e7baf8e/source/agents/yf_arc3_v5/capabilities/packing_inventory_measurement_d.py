"""Exact Source cell/mask samples; no notch fill, identity guessing or packing search."""
from .indexed_panel_measurement_d import measure_panel_regions_d, _sample
from .mechanical_family_contracts_d import d_map, DResumeMismatch, DComputationInterrupted


def packing_inventory_evidence_refs(layout):
    return tuple(dict.fromkeys((layout.evidence_ref, layout.lattice_evidence_ref, layout.panel.evidence_ref,
        *(x.evidence_ref for x in layout.panel.regions), *(x.evidence_ref for x in layout.cell_cores),
        *(x.identity_claim_ref for x in layout.occurrences),
        *(d.full_mask_claim_ref for x in layout.occurrences for d in x.drawings),
        *(s.evidence_ref for x in layout.occurrences for d in x.drawings for s in d.filled_samples))))


def measure_packing_inventory_d(request, budget):
    if (request.observed_frame is None or not request.frame_ref or request.frame_epoch != request.scope.epoch
            or not request.inventory_layouts):
        raise DResumeMismatch('CURRENT_PACKING_FRAME_AND_SOURCE_INVENTORY_REQUIRED')
    layouts = request.inventory_layouts
    if len(layouts) > request.domain_bound or len({x.layout_ref for x in layouts}) != len(layouts):
        raise DResumeMismatch('BOUNDED_UNIQUE_PACKING_INVENTORY_ALTERNATIVES_REQUIRED')
    results = []
    for layout in layouts:
        budget.visit({'layout_ref': layout.layout_ref})
        if max(len(layout.cell_cores), len(layout.board_cells)) > request.domain_bound:
            raise DComputationInterrupted('PACKING_INVENTORY_CELL_DOMAIN_BOUND', d_map({'layout_ref': layout.layout_ref}))
        if (not layout.layout_ref or not layout.evidence_ref or not layout.lattice_evidence_ref
                or len({x.cell for x in layout.cell_cores}) != len(layout.cell_cores)
                or len(set(layout.board_cells)) != len(layout.board_cells)
                or len({x.piece_ref for x in layout.occurrences}) != len(layout.occurrences)):
            raise DResumeMismatch('UNIQUE_CURRENT_PACKING_CELL_AND_OCCURRENCE_IDENTITIES_REQUIRED')
        panel = measure_panel_regions_d(request.observed_frame, (layout.panel,), budget)[0]
        region_refs = frozenset(x['region_ref'] for x in panel['regions'])
        decoration_groups = (layout.grid_texture_region_refs, layout.fixed_decoration_region_refs,
            layout.pin_decoration_region_refs, layout.control_region_refs, layout.hud_region_refs, layout.reserve_region_refs)
        for group in decoration_groups:
            for ref in group:
                budget.visit({'partition_region_ref': ref})
                if ref not in region_refs:
                    raise DResumeMismatch('PACKING_PARTITION_REFERENCES_UNDECLARED_REGION')
        cores = {x.cell: x for x in layout.cell_cores}
        for core in layout.cell_cores:
            budget.visit({'cell_core': core.cell})
            if not core.evidence_ref or core.bounds[2] < core.bounds[0] or core.bounds[3] < core.bounds[1]:
                raise DResumeMismatch('CURRENT_PACKING_CELL_CORE_GEOMETRY_EVIDENCE_REQUIRED')
        for cell in layout.board_cells:
            budget.visit({'board_cell': cell})
            if cell not in cores:
                raise DResumeMismatch('CURRENT_BOARD_CELL_CORE_MISSING')
        drawings_seen, occurrences, missing_count, mismatch_count = set(), [], 0, 0
        for occurrence in layout.occurrences:
            budget.visit({'piece_ref': occurrence.piece_ref})
            if not occurrence.piece_ref or not occurrence.identity_claim_ref:
                raise DResumeMismatch('PACKING_OCCURRENCE_IDENTITY_BINDING_REQUIRED')
            drawings = []
            for drawing in occurrence.drawings:
                budget.visit({'drawing_ref': drawing.drawing_ref})
                mask = frozenset(drawing.full_mask)
                occluded = frozenset(drawing.occluded_local_cells)
                samples = {s.local_cell: s for s in drawing.filled_samples}
                if (not drawing.drawing_ref or drawing.drawing_ref in drawings_seen or not drawing.full_mask_claim_ref
                        or len(mask) != len(drawing.full_mask) or len(occluded) != len(drawing.occluded_local_cells)
                        or not occluded.issubset(mask) or len(samples) != len(drawing.filled_samples)
                        or any(cell not in mask for cell in samples)):
                    raise DResumeMismatch('PACKING_DRAWING_OR_FULL_MASK_BINDING_NOT_EXACT')
                drawings_seen.add(drawing.drawing_ref)
                cells = []
                for cell in drawing.full_mask:
                    budget.visit({'drawing_ref': drawing.drawing_ref, 'local_cell': cell})
                    native_cell = drawing.anchor[0] + cell[0], drawing.anchor[1] + cell[1]
                    core = cores.get(native_cell)
                    observed, unknown, comparison, actual_samples = None, (), None, []
                    sample = samples.get(cell)
                    if core is not None and cell not in occluded:
                        observed, unknown = _sample(request.observed_frame, core.bounds, budget, drawing.drawing_ref)
                        if sample is not None:
                            known, matches = True, True
                            for row, column, expected in sample.native_samples:
                                budget.visit({'drawing_ref': drawing.drawing_ref, 'fill_sample': (row, column)})
                                if not (core.bounds[0] <= row <= core.bounds[2] and core.bounds[1] <= column <= core.bounds[3]):
                                    raise DResumeMismatch('PACKING_FILLED_SAMPLE_OUTSIDE_DECLARED_CELL_CORE')
                                pixel = request.observed_frame.rows[row][column] if 0 <= row < request.observed_frame.height and 0 <= column < request.observed_frame.width else None
                                known = known and pixel is not None
                                matches = matches and pixel == expected
                                actual_samples.append((row, column, pixel, expected))
                            comparison = matches if known else None
                    missing = core is None or cell in occluded or sample is None or bool(unknown) or comparison is None
                    missing_count += int(missing)
                    mismatch_count += int(comparison is False)
                    cells.append(d_map({'local_cell': cell, 'scene_cell': native_cell,
                        'core_bounds': core.bounds if core else None, 'core_raster': observed,
                        'unknown_native_pixels': unknown, 'occluded': cell in occluded,
                        'filled_sample_evidence_ref': sample.evidence_ref if sample else None,
                        'actual_filled_samples': tuple(actual_samples), 'filled_signature_matches': comparison,
                        'current_cell_content_unresolved': missing}))
                drawings.append(d_map({'drawing_ref': drawing.drawing_ref, 'source_partition_ref': drawing.source_partition_ref,
                    'anchor': drawing.anchor, 'complete_local_mask': drawing.full_mask,
                    'full_mask_claim_ref': drawing.full_mask_claim_ref, 'cell_observations': tuple(cells),
                    'notch_cells_not_added': True}))
            occurrences.append(d_map({'piece_ref': occurrence.piece_ref,
                'identity_claim_ref': occurrence.identity_claim_ref, 'drawings': tuple(drawings),
                'held_preview_is_separate_occurrence': False}))
        results.append(d_map({'layout_ref': layout.layout_ref, 'panel_measurement': panel,
            'evidence_refs': packing_inventory_evidence_refs(layout), 'board_cells': layout.board_cells,
            'occurrences': tuple(occurrences), 'declared_occurrence_count': len(occurrences),
            'grid_texture_region_refs': layout.grid_texture_region_refs,
            'fixed_decoration_region_refs': layout.fixed_decoration_region_refs,
            'pin_decoration_region_refs': layout.pin_decoration_region_refs,
            'control_region_refs': layout.control_region_refs, 'hud_region_refs': layout.hud_region_refs,
            'reserve_region_refs': layout.reserve_region_refs, 'missing_cell_count': missing_count,
            'filled_sample_mismatch_count': mismatch_count,
            'notch_cells_not_added': True, 'held_preview_does_not_increment_occurrence_count': True,
            'canonical_state_mutated': False}))
    return tuple(results)
