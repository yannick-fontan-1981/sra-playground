"""Reuse exact panel sampling; return graph support and word geometry only."""
from .indexed_panel_measurement_d import measure_panel_regions_d
from .mechanical_family_contracts_d import d_map, DResumeMismatch, DComputationInterrupted


def program_layer_evidence_refs(layout):
    return tuple(dict.fromkeys((layout.evidence_ref, layout.panel.evidence_ref,
        *(x.evidence_ref for x in layout.panel.regions),
        *(x.evidence_ref for x in layout.nodes), *(x.evidence_ref for x in layout.links),
        *(x.marker_evidence_ref for x in layout.panel.slots if x.marker_evidence_ref),
        *((layout.word_empty_evidence_ref,) if layout.word_empty_evidence_ref else ()))))


def _intersection(first, second):
    top, left = max(first[0], second[0]), max(first[1], second[1])
    bottom, right = min(first[2], second[2]), min(first[3], second[3])
    return (top, left, bottom, right) if top <= bottom and left <= right else None


def measure_program_display_layers_d(request, budget):
    layouts = request.display_layouts
    if (request.frame is None or not request.frame_ref or request.frame_epoch != request.scope.epoch or not layouts):
        raise DResumeMismatch('CURRENT_FIXED_PROGRAM_FRAME_AND_DECLARED_LAYOUTS_REQUIRED')
    if len(layouts) > request.domain_bound or len({x.layout_ref for x in layouts}) != len(layouts):
        raise DResumeMismatch('BOUNDED_UNIQUE_PROGRAM_DISPLAY_ALTERNATIVES_REQUIRED')
    results = []
    for layout in layouts:
        budget.visit({'layout_ref': layout.layout_ref})
        if not layout.layout_ref or not layout.evidence_ref:
            raise DResumeMismatch('CURRENT_PROGRAM_DISPLAY_LAYOUT_EVIDENCE_REQUIRED')
        if max(len(layout.nodes), len(layout.links), len(layout.occluded_region_refs)) > request.domain_bound:
            raise DComputationInterrupted('PROGRAM_DISPLAY_ENTITY_DOMAIN_BOUND', d_map({'layout_ref': layout.layout_ref}))
        node_refs = frozenset(x.node_ref for x in layout.nodes)
        if len(node_refs) != len(layout.nodes) or len({x.link_ref for x in layout.links}) != len(layout.links):
            raise DResumeMismatch('UNIQUE_PROGRAM_NODE_AND_LINK_OCCURRENCES_REQUIRED')
        measured = measure_panel_regions_d(request.frame, (layout.panel,), budget)[0]
        regions = {x['region_ref']: x for x in measured['regions']}
        declared_refs = (*layout.marker_region_refs, *layout.target_region_refs, *layout.progress_region_refs,
            *layout.occluded_region_refs, *(x.region_ref for x in layout.nodes), *(x.region_ref for x in layout.links))
        for ref in declared_refs:
            budget.visit({'program_region_ref': ref})
            if ref not in regions:
                raise DResumeMismatch('PROGRAM_LAYER_REFERENCES_UNDECLARED_CURRENT_REGION')
        occluded = frozenset(layout.occluded_region_refs)
        nodes = []
        for node in layout.nodes:
            budget.visit({'node_ref': node.node_ref})
            if not node.node_ref or not node.evidence_ref:
                raise DResumeMismatch('PROGRAM_NODE_OCCURRENCE_EVIDENCE_REQUIRED')
            nodes.append(d_map({'node_ref': node.node_ref, 'region_ref': node.region_ref,
                'evidence_ref': node.evidence_ref, 'support_bounds': regions[node.region_ref]['content_bounds'],
                'content_occluded': node.region_ref in occluded}))
        links = []
        node_regions = {x.node_ref: x.region_ref for x in layout.nodes}
        for link in layout.links:
            budget.visit({'link_ref': link.link_ref})
            if (not link.link_ref or not link.evidence_ref
                    or len(set(link.endpoint_node_alternatives)) != len(link.endpoint_node_alternatives)
                    or any(ref not in node_refs for ref in link.endpoint_node_alternatives)):
                raise DResumeMismatch('CURRENT_PROGRAM_LINK_ENDPOINT_ALTERNATIVES_REQUIRED')
            endpoints = []
            for ref in link.endpoint_node_alternatives:
                budget.visit({'link_ref': link.link_ref, 'endpoint_node_ref': ref})
                endpoints.append(d_map({'node_ref': ref, 'support_intersection': _intersection(
                    regions[link.region_ref]['content_bounds'], regions[node_regions[ref]]['content_bounds'])}))
            links.append(d_map({'link_ref': link.link_ref, 'region_ref': link.region_ref,
                'evidence_ref': link.evidence_ref, 'endpoint_support_alternatives': tuple(endpoints),
                'content_occluded': link.region_ref in occluded, 'directed_port_created': False}))
        word = []
        for slot in measured['ordered_slots']:
            budget.visit({'instruction_slot_ref': slot['slot_ref']})
            region = regions[slot['region_ref']]
            word.append(d_map({'slot_ref': slot['slot_ref'], 'index': slot['index'], 'region_ref': slot['region_ref'],
                'source_content_status_ref': slot['content_status_ref'],
                'content_occluded': slot['region_ref'] in occluded,
                'sampling_compatible': region['sampling_compatible'],
                'content_decoded_as_instruction': False}))
        overlaps = []
        for target in layout.target_region_refs:
            for overlay in layout.marker_region_refs:
                budget.visit({'target_region_ref': target, 'marker_region_ref': overlay})
                overlaps.append(d_map({'target_region_ref': target, 'marker_region_ref': overlay,
                    'support_intersection': _intersection(regions[target]['content_bounds'], regions[overlay]['content_bounds'])}))
        unknown = sum(len(regions[ref]['unknown_native_pixels']) for ref in sorted(regions))
        results.append(d_map({'layout_ref': layout.layout_ref, 'panel_measurement': measured,
            'evidence_refs': program_layer_evidence_refs(layout), 'nodes': tuple(nodes), 'links': tuple(links),
            'ordered_instruction_supports': tuple(word), 'marker_region_refs': layout.marker_region_refs,
            'target_region_refs': layout.target_region_refs, 'progress_region_refs': layout.progress_region_refs,
            'target_marker_support_overlaps': tuple(overlaps), 'occluded_region_refs': layout.occluded_region_refs,
            'unknown_pixel_count': unknown, 'unresolved_content_count': len(occluded) + sum(
                x['source_content_status_ref'] != 'VISIBLE' for x in word)
                + int(not word and not layout.word_empty_evidence_ref),
            'incompatible_sampling_count': sum(regions[ref]['sampling_compatible'] is not True for ref in sorted(regions)),
            'directed_ports_not_inferred_from_centers': True, 'canonical_state_mutated': False}))
    return tuple(results)
