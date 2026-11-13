"""Calibrated pole-edge measurements distinct from texture and selection marks."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref
from .contracts import FrameGrid
from .scene_layer_measurement_d import DSceneCalibration, DSceneLayerQuestion, DSceneOcclusion, measure_scene_layers_d
from .mechanical_family_contracts_d import DWorkBudget, DResumeMismatch, DComputationInterrupted, d_input_digest, d_map, d_result, d_resumable_frontier


class AxialPoleQuestionA(FrozenModel):
    candidate_ref: Ref
    calibration_ref: Ref
    row_index: int
    column_index: int
    edge_thickness: int = Field(ge=1, le=128)
    positive_palette: tuple[int, ...] = Field(min_length=1, max_length=256)
    negative_palette: tuple[int, ...] = Field(min_length=1, max_length=256)
    neutral_edge_palette: tuple[int, ...] = Field(default=(), max_length=256)
    positive_pole_ref: Ref | None = None
    negative_pole_ref: Ref | None = None
    pole_semantics_evidence_ref: Ref | None = None
    selection_marker_points: tuple[tuple[int, int], ...] = Field(default=(), max_length=256)
    selection_evidence_ref: Ref | None = None


class AxialUnderlayerA(FrozenModel):
    point: tuple[int, int]
    palette_value: int
    evidence_ref: Ref
    evidence_revision_ref: Ref


class AxialSceneInputA(FrozenModel):
    frame: FrameGrid
    calibrations: tuple[DSceneCalibration, ...] = Field(min_length=1, max_length=32)
    questions: tuple[DSceneLayerQuestion, ...] = Field(min_length=1, max_length=128)
    occlusions: tuple[DSceneOcclusion, ...] = Field(default=(), max_length=128)
    pole_questions: tuple[AxialPoleQuestionA, ...] = Field(default=(), max_length=128)
    target_layer_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    control_layer_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    underlayers: tuple[AxialUnderlayerA, ...] = Field(default=(), max_length=4096)
    missing_support_refs: tuple[Ref, ...]


def _pole_edges(scene, question, calibration, budget):
    if (question.row_index not in calibration.row_indices or question.column_index not in calibration.column_indices
            or len(set(question.positive_palette)) != len(question.positive_palette)
            or len(set(question.negative_palette)) != len(question.negative_palette)
            or set(question.positive_palette) & set(question.negative_palette)
            or set(question.neutral_edge_palette) & set((*question.positive_palette, *question.negative_palette))
            or question.selection_marker_points and not question.selection_evidence_ref):
        raise DResumeMismatch('CURRENT_DISTINCT_POLE_PALETTES_CELL_AND_SELECTION_MASK_REQUIRED')
    height, width = calibration.content_extent
    thickness = question.edge_thickness
    if thickness * 2 > min(height, width):
        raise DResumeMismatch('DISJOINT_OPPOSITE_EDGE_SUPPORTS_REQUIRED')
    top = calibration.origin[0] + question.row_index * calibration.pitch[0]
    left = calibration.origin[1] + question.column_index * calibration.pitch[1]
    bottom, right = top + height - 1, left + width - 1
    bounds = ((top, left, top + thickness - 1, right),
        (bottom - thickness + 1, left, bottom, right),
        (top, left, bottom, left + thickness - 1),
        (top, right - thickness + 1, bottom, right))
    masked = set(question.selection_marker_points)
    measured = []
    for area in bounds:
        values, unknown = [], []
        for row in range(area[0], area[2] + 1):
            for column in range(area[1], area[3] + 1):
                point = (row, column)
                budget.visit({'candidate_ref': question.candidate_ref, 'edge_pixel': point})
                occluded = any(o.bounds[0] <= row <= o.bounds[2] and o.bounds[1] <= column <= o.bounds[3] for o in scene.occlusions)
                if (point in masked or occluded or row < 0 or column < 0
                        or row >= len(scene.frame.rows) or column >= len(scene.frame.rows[row])):
                    unknown.append(point)
                else:
                    values.append((point, scene.frame.rows[row][column]))
        measured.append(d_map({'bounds': area, 'visible_values': tuple(values), 'unknown_points': tuple(unknown)}))
    candidates = []
    for axis, positive, negative in (((-1, 0), 0, 1), ((1, 0), 1, 0), ((0, -1), 2, 3), ((0, 1), 3, 2)):
        p, n = measured[positive], measured[negative]
        if (all(value in (*question.positive_palette, *question.neutral_edge_palette) for _, value in p['visible_values'])
                and all(value in (*question.negative_palette, *question.neutral_edge_palette) for _, value in n['visible_values'])):
            candidates.append(d_map({'positive_axis': axis, 'positive_edge': p, 'negative_edge': n,
                'both_pole_edges_observed': any(value in question.positive_palette for _, value in p['visible_values'])
                    and any(value in question.negative_palette for _, value in n['visible_values']),
                'complete_edge_visibility': not p['unknown_points'] and not n['unknown_points']}))
    semantics_bound = bool(question.positive_pole_ref and question.negative_pole_ref and question.pole_semantics_evidence_ref)
    if any((question.positive_pole_ref, question.negative_pole_ref, question.pole_semantics_evidence_ref)) and not semantics_bound:
        raise DResumeMismatch('COMPLETE_POLE_SEMANTICS_BINDING_OR_EXPLICIT_ABSENCE_REQUIRED')
    return d_map({'candidate_ref': question.candidate_ref, 'calibration_ref': question.calibration_ref,
        'cell': (question.row_index, question.column_index), 'content_bounds': (top, left, bottom, right),
        'pitch': calibration.pitch, 'internal_texture_not_used_for_axis': True,
        'orientation_candidates': tuple(candidates), 'pole_semantics_bound': semantics_bound,
        'positive_pole_ref': question.positive_pole_ref, 'negative_pole_ref': question.negative_pole_ref,
        'selection_marker_points': question.selection_marker_points, 'selection_point_not_another_body': True})


def measure_axial_scene_a(request):
    budget, layers, bodies = DWorkBudget(request), [], []
    try:
        scene = request.scene_input
        if scene is None or not request.source_identity_ref:
            raise DResumeMismatch('CURRENT_SOURCE_IDENTITY_AND_CALIBRATED_SCENE_REQUIRED')
        calibrations = {c.calibration_ref: c for c in scene.calibrations}
        layer_refs = tuple(q.layer_ref for q in scene.questions)
        body_refs = tuple(q.candidate_ref for q in scene.pole_questions)
        if (len(calibrations) != len(scene.calibrations) or len(set(layer_refs)) != len(layer_refs)
                or len(set(body_refs)) != len(body_refs) or any(q.calibration_ref not in calibrations for q in scene.pole_questions)
                or not set((*scene.target_layer_refs, *scene.control_layer_refs)) <= set(layer_refs)
                or len({u.point for u in scene.underlayers}) != len(scene.underlayers)
                or any(u.evidence_revision_ref != request.scope.evidence_revision_ref for u in scene.underlayers)):
            raise DResumeMismatch('EXACT_CURRENT_CALIBRATION_LAYER_CANDIDATE_UNDERLAYER_DOMAIN_REQUIRED')
        if request.resume_frontier:
            if request.resume_frontier.get('input_digest') != d_input_digest(request):
                raise DResumeMismatch('SCENE_RESUME_SOURCE_INPUT_OR_REVISION_MISMATCH')
            saved = request.resume_frontier.get('work_frontier', {})
            if saved.get('phase') != 'AXIAL_SCENE':
                raise DResumeMismatch('AXIAL_SCENE_RESUME_PHASE_REQUIRED')
            layers, bodies = list(saved.get('layers', ())), list(saved.get('bodies', ()))
            if (len(layers) > len(layer_refs) or len(bodies) > len(body_refs)
                    or tuple(r.get('layer_ref') for r in layers) != layer_refs[:len(layers)]
                    or tuple(r.get('candidate_ref') for r in bodies) != body_refs[:len(bodies)]):
                raise DResumeMismatch('EXACT_COMPLETED_SCENE_PREFIX_REQUIRED')
        for question in scene.questions[len(layers):]:
            row, = measure_scene_layers_d(scene.frame, scene.calibrations, (question,), scene.occlusions, budget)
            layers.append(row)
        for question in scene.pole_questions[len(bodies):]:
            bodies.append(_pole_edges(scene, question, calibrations[question.calibration_ref], budget))
        budget.finish()
        return d_result(request, 'OK', 'CALIBRATED_AXIAL_POLE_EDGES_AND_SUPPORTS',
            values={'candidate_bodies': tuple(bodies), 'layers': tuple(layers),
                'source_target_layer_refs': scene.target_layer_refs, 'source_control_layer_refs': scene.control_layer_refs,
                'evidenced_underlayers': scene.underlayers, 'missing_support_refs': scene.missing_support_refs,
                'hidden_target_pixels_not_reconstructed_from_body_texture': True,
                'roles_body_identity_or_calibration_selected': False}, complete=True, examined=budget.examined)
    except DResumeMismatch as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined)
    except DComputationInterrupted as error:
        return d_result(request, 'BOUND_REACHED', error.cause, examined=budget.examined,
            frontier=d_resumable_frontier(request, (), None,
                {'phase': 'AXIAL_SCENE', 'layers': tuple(layers), 'bodies': tuple(bodies)}))
