"""Current exact rasters/correspondences; never infer visits from noncurrent markers."""
from .indexed_panel_measurement_d import measure_panel_regions_d
from .mechanical_family_contracts_d import d_map, DResumeMismatch, DComputationInterrupted
from agents.yf_arc3_v5.logos.types import stable_digest


def coverage_panel_evidence_refs(layout):
    return tuple(dict.fromkeys((layout.evidence_ref, layout.panel.evidence_ref,
        *(x.evidence_ref for x in layout.panel.regions), *(x.evidence_ref for x in layout.controls),
        *(x.evidence_ref for x in layout.entries),
        *(m.evidence_ref for x in layout.entries for m in (x.active_underline, x.visit_border) if m is not None))))


def _marker(frame, marker, regions, budget):
    if marker is None:
        return None
    if not marker.marker_ref or not marker.evidence_ref or marker.region_ref not in regions:
        raise DResumeMismatch('COVERAGE_MARKER_CURRENT_REGION_EVIDENCE_REQUIRED')
    if len(marker.native_samples) > budget.request.domain_bound:
        raise DComputationInterrupted('COVERAGE_MARKER_SAMPLE_DOMAIN_BOUND', d_map({'marker_ref': marker.marker_ref}))
    bounds = regions[marker.region_ref]['panel_bounds']
    samples, known, matches = [], True, True
    for row, column, expected in marker.native_samples:
        budget.visit({'marker_ref': marker.marker_ref, 'pixel': (row, column)})
        if not bounds[0] <= row <= bounds[2] or not bounds[1] <= column <= bounds[3]:
            raise DResumeMismatch('COVERAGE_MARKER_SAMPLE_OUTSIDE_DECLARED_REGION')
        pixel = frame.rows[row][column] if 0 <= row < frame.height and 0 <= column < frame.width else None
        samples.append((row, column, pixel, expected))
        known = known and pixel is not None
        matches = matches and pixel == expected
    return d_map({'marker_ref': marker.marker_ref, 'region_ref': marker.region_ref,
        'evidence_ref': marker.evidence_ref, 'actual_samples': tuple(samples),
        'signature_matches': matches if known else None, 'support_complete': known})


def measure_coverage_panels_d(request, budget):
    if request.frame is None or not request.frame_ref or request.frame_epoch != request.scope.epoch or not request.control_layouts:
        raise DResumeMismatch('CURRENT_COVERAGE_FRAME_AND_SOURCE_PANEL_LAYOUTS_REQUIRED')
    layouts = request.control_layouts
    if len(layouts) > request.domain_bound or len({x.layout_ref for x in layouts}) != len(layouts):
        raise DResumeMismatch('BOUNDED_UNIQUE_COVERAGE_PANEL_ALTERNATIVES_REQUIRED')
    results = []
    for layout in layouts:
        budget.visit({'layout_ref': layout.layout_ref})
        if (not layout.layout_ref or not layout.evidence_ref
                or len({x.control_ref for x in layout.controls}) != len(layout.controls)
                or len({x.entry_ref for x in layout.entries}) != len(layout.entries)):
            raise DResumeMismatch('UNIQUE_COVERAGE_CONTROL_AND_ENTRY_IDENTITIES_REQUIRED')
        if max(len(layout.controls), len(layout.entries)) > request.domain_bound:
            raise DComputationInterrupted('COVERAGE_PANEL_ENTITY_DOMAIN_BOUND', d_map())
        panel = measure_panel_regions_d(request.frame, (layout.panel,), budget)[0]
        regions = {x['region_ref']: x for x in panel['regions']}
        controls, entries, unknown_markers = [], [], 0
        for control in layout.controls:
            budget.visit({'control_ref': control.control_ref})
            if (not control.control_ref or not control.evidence_ref or control.primary_region_ref not in regions
                    or len(set(control.legend_region_refs)) != len(control.legend_region_refs)
                    or any(ref not in regions for ref in control.legend_region_refs)):
                raise DResumeMismatch('EXACT_COVERAGE_PRIMARY_CONTROL_AND_LEGEND_BINDINGS_REQUIRED')
            primary = regions[control.primary_region_ref]
            correspondence = []
            for ref in control.legend_region_refs:
                budget.visit({'control_ref': control.control_ref, 'legend_region_ref': ref})
                legend = regions[ref]
                comparable = primary['sampling_compatible'] and legend['sampling_compatible']
                correspondence.append(d_map({'legend_region_ref': ref,
                    'local_content_dimensions_equal': primary['local_content_dimensions'] == legend['local_content_dimensions'] if comparable else None,
                    'exact_local_raster_equal': primary['local_raster'] == legend['local_raster'] if comparable else None}))
            controls.append(d_map({'control_ref': control.control_ref, 'primary_region_ref': control.primary_region_ref,
                'legend_correspondences': tuple(correspondence), 'factor_law_confirmed': False}))
        for entry in layout.entries:
            budget.visit({'entry_ref': entry.entry_ref})
            if not entry.entry_ref or not entry.evidence_ref or any(ref not in regions for ref in entry.tuple_region_refs):
                raise DResumeMismatch('CURRENT_COVERAGE_TUPLE_REGION_BINDINGS_REQUIRED')
            underline = _marker(request.frame, entry.active_underline, regions, budget)
            border = _marker(request.frame, entry.visit_border, regions, budget)
            unknown_markers += sum(m is None or m['signature_matches'] is None for m in (underline, border))
            entries.append(d_map({'entry_ref': entry.entry_ref, 'tuple_region_refs': entry.tuple_region_refs,
                'tuple_samples': tuple(d_map({'region_ref': ref, 'sampling_compatible': regions[ref]['sampling_compatible'],
                    'local_raster_digest': stable_digest(regions[ref]['local_raster'])}) for ref in entry.tuple_region_refs),
                'active_underline_samples': underline, 'visit_border_samples': border,
                'active_marker_not_subtracted_from_visit_evidence': True, 'tuple_values_not_decoded': True}))
        for ref in layout.resource_region_refs:
            budget.visit({'resource_region_ref': ref})
            if ref not in regions:
                raise DResumeMismatch('CURRENT_COVERAGE_RESOURCE_DISPLAY_REGION_REQUIRED')
        results.append(d_map({'layout_ref': layout.layout_ref, 'panel_measurement': panel,
            'evidence_refs': coverage_panel_evidence_refs(layout), 'controls': tuple(controls),
            'catalogue_entries': tuple(entries), 'resource_region_refs': layout.resource_region_refs,
            'unknown_pixel_count': sum(len(regions[ref]['unknown_native_pixels']) for ref in sorted(regions)),
            'unknown_marker_count': unknown_markers,
            'unprovided_catalogue_or_resource_count': int(not layout.entries) + int(not layout.resource_region_refs),
            'incompatible_sampling_count': sum(regions[ref]['sampling_compatible'] is not True for ref in sorted(regions)),
            'highlight_is_not_subtracted_from_visit_evidence': True, 'canonical_state_mutated': False}))
    return tuple(results)
