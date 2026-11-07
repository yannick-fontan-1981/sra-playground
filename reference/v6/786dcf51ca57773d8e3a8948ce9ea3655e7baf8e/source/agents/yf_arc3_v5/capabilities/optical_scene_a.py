"""Separate Source-declared optical layers; raster size is not analytic radius."""
from __future__ import annotations

from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref
from .contracts import FrameGrid
from .scene_layer_measurement_d import (
    DSceneCalibration, DSceneLayerQuestion, DSceneOcclusion, measure_scene_layers_d,
)
from .mechanical_family_contracts_d import (
    DWorkBudget, DResumeMismatch, DComputationInterrupted, d_input_digest,
    d_result, d_map, d_resumable_frontier,
)


class OpticalSceneFacetA(FrozenModel):
    facet_ref: Ref
    layer_ref: Ref
    declared_kind_ref: Literal['EMITTER', 'RECEIVER', 'TERMINAL', 'WIRE', 'CONTROL']
    evidence_ref: Ref
    possible_body_refs: tuple[Ref, ...] = Field(default=(), max_length=128)


class OpticalSceneInputA(FrozenModel):
    frame: FrameGrid
    calibrations: tuple[DSceneCalibration, ...] = Field(min_length=1, max_length=32)
    questions: tuple[DSceneLayerQuestion, ...] = Field(min_length=1, max_length=128)
    occlusions: tuple[DSceneOcclusion, ...] = Field(default=(), max_length=128)
    facets: tuple[OpticalSceneFacetA, ...] = Field(min_length=1, max_length=128)
    absent_facets: FrozenMap
    geometry_uncertainties: FrozenMap


def measure_optical_scene_a(request):
    budget = DWorkBudget(request)
    rows = []
    try:
        scene = request.scene_input
        if scene is None or not request.source_identity_ref:
            raise DResumeMismatch('SOURCE_IDENTITY_CURRENT_FRAME_AND_OPTICAL_LAYER_QUESTIONS_REQUIRED')
        question_refs = tuple(q.layer_ref for q in scene.questions)
        if (len(set(question_refs)) != len(question_refs)
                or len({f.facet_ref for f in scene.facets}) != len(scene.facets)
                or {f.layer_ref for f in scene.facets} != set(question_refs)):
            raise DResumeMismatch('UNIQUE_EXACT_SOURCE_LAYER_FACET_DOMAIN_REQUIRED')
        present = {f.declared_kind_ref for f in scene.facets}
        absent = set(scene.absent_facets)
        if (present & absent or present | absent != {'EMITTER', 'RECEIVER', 'TERMINAL', 'WIRE', 'CONTROL'}
                or any(not isinstance(scene.absent_facets[k], str) or not scene.absent_facets[k] for k in sorted(absent))):
            raise DResumeMismatch('SEPARATE_OPTICAL_FACETS_OR_EVIDENCED_ABSENCE_REQUIRED')
        if not request.models and not scene.geometry_uncertainties:
            raise DResumeMismatch('MISSING_ANALYTIC_GEOMETRY_MUST_REMAIN_EXPLICIT')
        if request.resume_frontier:
            if request.resume_frontier.get('input_digest') != d_input_digest(request):
                raise DResumeMismatch('SCENE_RESUME_SOURCE_INPUT_OR_REVISION_MISMATCH')
            work = request.resume_frontier.get('work_frontier', {})
            if work.get('phase') != 'OPTICAL_SCENE_LAYERS':
                raise DResumeMismatch('OPTICAL_SCENE_LAYER_RESUME_PHASE_REQUIRED')
            rows = list(work.get('completed_layers', ()))
            if tuple(r.get('layer_ref') for r in rows) != question_refs[:len(rows)] or len(rows) > len(question_refs):
                raise DResumeMismatch('EXACT_COMPLETED_LAYER_PREFIX_REQUIRED')
        for question in scene.questions[len(rows):]:
            # A layer is atomic; only the interrupted layer is measured again.
            row, = measure_scene_layers_d(scene.frame, scene.calibrations,
                (question,), scene.occlusions, budget)
            rows.append(row)
        budget.finish()
        return d_result(request, 'OK', 'SEPARATE_SCOPED_OPTICAL_SCENE_LAYERS',
            values={'layers': tuple(rows), 'source_declared_facets': scene.facets,
                'analytic_geometry_models': request.models,
                'analytic_geometry_uncertainties': scene.geometry_uncertainties,
                'evidenced_absent_facets': scene.absent_facets,
                'raster_diameter_is_not_analytic_radius': True,
                'wire_crossings_are_not_receiver_evidence': True,
                'occluded_geometry_remains_unknown': True,
                'roles_or_calibration_selected': False},
            complete=True, examined=budget.examined)
    except DResumeMismatch as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined)
    except DComputationInterrupted as error:
        return d_result(request, 'BOUND_REACHED', error.cause, examined=budget.examined,
            frontier=d_resumable_frontier(request, (), None,
                {'phase': 'OPTICAL_SCENE_LAYERS', 'completed_layers': tuple(rows)}))
