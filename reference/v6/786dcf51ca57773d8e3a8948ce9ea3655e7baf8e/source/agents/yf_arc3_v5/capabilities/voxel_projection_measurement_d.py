"""Exact contour pixels, shared edges and rational span measures; no renderer or choice."""
from fractions import Fraction
from collections import Counter
from math import gcd
from .mechanical_family_contracts_d import d_map, DResumeMismatch, DComputationInterrupted


def voxel_projection_evidence_refs(calibration):
    return tuple(dict.fromkeys((calibration.evidence_ref,
        *(x.evidence_ref for x in calibration.vertices), *(x.evidence_ref for x in calibration.edges),
        *(x.evidence_ref for x in calibration.faces), *(x.evidence_ref for x in calibration.spans))))


def _pixels(frame, points, budget, owner):
    if len(points) > budget.request.domain_bound:
        raise DComputationInterrupted('VOXEL_CONTOUR_PIXEL_DOMAIN_BOUND', d_map({'owner_ref': owner}))
    if len(set(points)) != len(points):
        raise DResumeMismatch('VOXEL_CONTOUR_PIXEL_SUPPORT_HAS_DUPLICATES')
    measured = []
    for row, column in points:
        budget.visit({'contour_owner_ref': owner, 'pixel': (row, column)})
        pixel = frame.rows[row][column] if 0 <= row < frame.height and 0 <= column < frame.width else None
        measured.append((row, column, pixel))
    return tuple(measured)


def _vector(first, second):
    return second[0] - first[0], second[1] - first[1]


def measure_voxel_projection_d(request, budget):
    if (request.observed_frame is None or not request.frame_ref or request.frame_epoch != request.scope.epoch
            or not request.calibration_candidates):
        raise DResumeMismatch('CURRENT_VOXEL_FRAME_AND_SOURCE_CALIBRATION_CANDIDATES_REQUIRED')
    candidates = request.calibration_candidates
    if len(candidates) > request.domain_bound or len({x.calibration_ref for x in candidates}) != len(candidates):
        raise DResumeMismatch('BOUNDED_UNIQUE_VOXEL_CALIBRATION_CANDIDATES_REQUIRED')
    results = []
    for calibration in candidates:
        budget.visit({'calibration_ref': calibration.calibration_ref})
        if not calibration.calibration_ref or not calibration.evidence_ref:
            raise DResumeMismatch('VOXEL_CALIBRATION_CURRENT_EVIDENCE_REQUIRED')
        if max(len(calibration.vertices), len(calibration.edges), len(calibration.spans)) > request.domain_bound:
            raise DComputationInterrupted('VOXEL_PROJECTION_GEOMETRY_DOMAIN_BOUND', d_map())
        vertices = {x.vertex_ref: x for x in calibration.vertices}
        edges = {x.edge_ref: x for x in calibration.edges}
        if (len(vertices) != len(calibration.vertices) or len(edges) != len(calibration.edges)
                or len({x.face_ref for x in calibration.faces}) != len(calibration.faces)
                or len({x.span_ref for x in calibration.spans}) != len(calibration.spans)):
            raise DResumeMismatch('UNIQUE_VOXEL_CONTOUR_IDENTITIES_REQUIRED')
        measured_vertices, observed, unknown_pixels = [], {}, 0
        for vertex in calibration.vertices:
            if not vertex.vertex_ref or not vertex.evidence_ref:
                raise DResumeMismatch('SOURCE_BOUND_VERTEX_IDENTITY_AND_SUPPORT_REQUIRED')
            pixels = _pixels(request.observed_frame, vertex.support_pixels, budget, vertex.vertex_ref)
            known = vertex.source_observed and vertex.point in vertex.support_pixels and all(x[2] is not None for x in pixels)
            observed[vertex.vertex_ref] = known
            unknown_pixels += sum(x[2] is None for x in pixels)
            measured_vertices.append(d_map({'vertex_ref': vertex.vertex_ref, 'point': vertex.point,
                'evidence_ref': vertex.evidence_ref, 'sampled_support_pixels': pixels,
                'current_observed_support_complete': known, 'hidden_candidate_preserved': not known}))
        measured_edges, axis_rows, edge_observed = [], {}, {}
        for edge in calibration.edges:
            budget.visit({'edge_ref': edge.edge_ref})
            if (not edge.edge_ref or not edge.evidence_ref or not edge.axis_family_ref
                    or edge.first_vertex_ref not in vertices or edge.second_vertex_ref not in vertices):
                raise DResumeMismatch('EXACT_VOXEL_EDGE_VERTEX_BINDINGS_REQUIRED')
            vector = _vector(vertices[edge.first_vertex_ref].point, vertices[edge.second_vertex_ref].point)
            divisor = gcd(abs(vector[0]), abs(vector[1]))
            direction = (vector[0] // divisor, vector[1] // divisor) if divisor else None
            pixels = _pixels(request.observed_frame, edge.support_pixels, budget, edge.edge_ref)
            unknown_pixels += sum(x[2] is None for x in pixels)
            known = observed[edge.first_vertex_ref] and observed[edge.second_vertex_ref] and bool(pixels) and all(x[2] is not None for x in pixels)
            row = d_map({'edge_ref': edge.edge_ref, 'axis_family_ref': edge.axis_family_ref,
                'first_vertex_ref': edge.first_vertex_ref, 'second_vertex_ref': edge.second_vertex_ref,
                'projected_vector': vector, 'primitive_signed_direction': direction,
                'sampled_support_pixels': pixels, 'current_edge_support_complete': known})
            measured_edges.append(row)
            edge_observed[edge.edge_ref] = known
            axis_rows.setdefault(edge.axis_family_ref, []).append(row)
        spans = []
        for span in calibration.spans:
            budget.visit({'span_ref': span.span_ref})
            if (not span.span_ref or not span.evidence_ref or span.axis_family_ref not in axis_rows
                    or span.first_vertex_ref not in vertices or span.second_vertex_ref not in vertices):
                raise DResumeMismatch('EXACT_VOXEL_METRIC_SPAN_BINDINGS_REQUIRED')
            vector = _vector(vertices[span.first_vertex_ref].point, vertices[span.second_vertex_ref].point)
            rational = tuple(Fraction(x, span.repeated_units) for x in vector)
            spans.append(d_map({'span_ref': span.span_ref, 'axis_family_ref': span.axis_family_ref,
                'source_metric_ref': span.metric_ref, 'native_vector': vector, 'repeated_units': span.repeated_units,
                'unit_vector_rational': tuple((x.numerator, x.denominator) for x in rational),
                'endpoints_currently_observed': observed[span.first_vertex_ref] and observed[span.second_vertex_ref]}))
        faces = []
        for face in calibration.faces:
            budget.visit({'face_ref': face.face_ref})
            if (not face.face_ref or not face.evidence_ref or len(set(face.edge_refs)) != len(face.edge_refs)
                    or any(ref not in edges for ref in face.edge_refs)):
                raise DResumeMismatch('EXACT_VOXEL_FACE_EDGE_BINDINGS_REQUIRED')
            face_vertices = tuple(dict.fromkeys(ref for edge_ref in face.edge_refs
                for ref in (edges[edge_ref].first_vertex_ref, edges[edge_ref].second_vertex_ref)))
            degrees, neighbors = Counter(), {}
            for ref in face.edge_refs:
                budget.visit({'face_edge_ref': ref})
                edge = edges[ref]
                for first, second in ((edge.first_vertex_ref, edge.second_vertex_ref), (edge.second_vertex_ref, edge.first_vertex_ref)):
                    degrees[first] += 1
                    neighbors.setdefault(first, set()).add(second)
            pending, visited = [face_vertices[0]], set()
            while pending:
                ref = pending.pop()
                if ref not in visited:
                    budget.visit({'face_connected_vertex_ref': ref})
                    visited.add(ref)
                    pending.extend(sorted(neighbors[ref] - visited, reverse=True))
            closed = len(face_vertices) >= 3 and len(visited) == len(face_vertices) and all(degrees[ref] == 2 for ref in sorted(degrees))
            complete = face.contour_complete and closed and all(observed[ref] for ref in face_vertices) and all(edge_observed[ref] for ref in face.edge_refs)
            faces.append(d_map({'face_ref': face.face_ref, 'edge_refs': face.edge_refs,
                'vertex_refs': face_vertices, 'source_contour_complete': face.contour_complete,
                'declared_edge_cycle_closed': closed, 'current_face_support_complete': complete,
                'hidden_vertex_refs': tuple(ref for ref in face_vertices if not observed[ref]),
                'partial_face_alternative_preserved': not complete}))
        pair_count = len(faces) * (len(faces) - 1) // 2
        if pair_count > request.domain_bound:
            raise DComputationInterrupted('VOXEL_FACE_ADJACENCY_PAIR_DOMAIN_BOUND', d_map({'required_pairs': pair_count}))
        adjacency = []
        for index, first in enumerate(faces):
            for second in faces[index + 1:]:
                budget.visit({'first_face_ref': first['face_ref'], 'second_face_ref': second['face_ref']})
                shared = tuple(sorted(set(first['edge_refs']).intersection(second['edge_refs'])))
                adjacency.append(d_map({'first_face_ref': first['face_ref'], 'second_face_ref': second['face_ref'],
                    'shared_edge_refs': shared, 'partial_support': first['partial_face_alternative_preserved'] or second['partial_face_alternative_preserved']}))
        results.append(d_map({'calibration_ref': calibration.calibration_ref,
            'evidence_refs': voxel_projection_evidence_refs(calibration), 'vertices': tuple(measured_vertices),
            'axis_families': tuple(d_map({'axis_family_ref': ref, 'edge_measurements': tuple(axis_rows[ref])}) for ref in sorted(axis_rows)),
            'face_supports': tuple(faces), 'face_adjacency': tuple(adjacency),
            'base_pitch_measurements': tuple(x for x in spans if x['source_metric_ref'] == 'BASE_PITCH'),
            'complete_cube_extent_measurements': tuple(x for x in spans if x['source_metric_ref'] == 'COMPLETE_CUBE_EXTENT'),
            'extrusion_increment_measurements': tuple(x for x in spans if x['source_metric_ref'] == 'EXTRUSION_INCREMENT'),
            'unknown_pixel_count': unknown_pixels,
            'partial_face_count': sum(x['partial_face_alternative_preserved'] for x in faces),
            'unobserved_vertex_count': sum(not observed[ref] for ref in sorted(observed)),
            'unprovided_metric_count': sum(not any(x['source_metric_ref'] == metric for x in spans)
                for metric in ('BASE_PITCH', 'COMPLETE_CUBE_EXTENT', 'EXTRUSION_INCREMENT')),
            'hidden_contours_not_promoted_to_observation': True,
            'creator_indices_not_observed_identities': True, 'canonical_state_mutated': False}))
    return tuple(results)
