"""Finite licensed edits and correlated visible-evidence partitions, not adoption."""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref, stable_digest
from .occluded_catalogue_projection_d import CatalogueMaskD, CataloguePoseD
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result


class ExposureModelD(FrozenModel):
    model_ref: Ref
    poses: tuple[CataloguePoseD, ...] = Field(min_length=1, max_length=128)
    unknown_mask_object_refs: tuple[Ref, ...] = Field(default=(), max_length=128)


class ExposureEditD(FrozenModel):
    input_ref: Ref
    object_ref: Ref
    translation_delta: tuple[int, int]
    new_scale: int | None = Field(default=None, ge=1)
    new_layer_order: tuple[Ref, ...] | None
    legal_translation_destinations: tuple[tuple[int, int], ...] = Field(min_length=1, max_length=4096)
    prerequisite_input_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    movement_cost: int = Field(ge=0)
    control_revision_ref: Ref


class ExposureWordD(FrozenModel):
    configuration_ref: Ref
    edit_refs: tuple[Ref, ...] = Field(default=(), max_length=4096)


class DiscriminatingExposureRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.discriminating_exposure_request_d.v1'
    phase_ref: Literal['LICENSED_VIEW_PREIMAGES']
    models: tuple[ExposureModelD, ...] = Field(min_length=2, max_length=128)
    masks: tuple[CatalogueMaskD, ...] = Field(min_length=1, max_length=128)
    requested_identity_ref: Ref
    requested_aspect_ref: Ref
    queried_pixels: tuple[tuple[int, int], ...] = Field(min_length=1, max_length=4096)
    viewport_pixels: tuple[tuple[int, int], ...] = Field(min_length=1, max_length=4096)
    identified_occluder_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    top_to_bottom_order: tuple[Ref, ...] = Field(min_length=1, max_length=128)
    edits: tuple[ExposureEditD, ...] = Field(default=(), max_length=128)
    words: tuple[ExposureWordD, ...] = Field(min_length=1, max_length=4096)
    movement_budget: int = Field(ge=0)
    control_revision_ref: Ref
    restoration_required_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = (('mechanics.resource_visibility_feasibility.discriminating_exposure', 'INVERSE_DOMAIN'),)

    @model_validator(mode='after')
    def finite_domains(self):
        ids = set(self.top_to_bottom_order)
        masks = {m.candidate_ref: m for m in self.masks}
        edit_refs = {e.input_ref for e in self.edits}
        if len(ids) != len(self.top_to_bottom_order) or self.requested_identity_ref not in ids:
            raise ValueError('complete persistent layer order required')
        if len(masks) != len(self.masks) or len(edit_refs) != len(self.edits):
            raise ValueError('mask/edit identities duplicated')
        if not set(self.restoration_required_refs) <= ids:
            raise ValueError('restoration identity unavailable')
        if any(not set(w.edit_refs) <= edit_refs for w in self.words):
            raise ValueError('word uses unlicensed input')
        for model in self.models:
            if {p.object_ref for p in model.poses} != ids or len(model.poses) != len(ids):
                raise ValueError('correlated model must bind each object once')
            if any(p.candidate_ref not in masks or p.scale not in masks[p.candidate_ref].supported_integer_scales for p in model.poses):
                raise ValueError('unlicensed candidate or scale')
        return self


def measure_discriminating_exposure_d(request: DiscriminatingExposureRequestD):
    refusal = d_validate_request(request)
    if refusal is not None: return refusal
    budget = DWorkBudget(request)
    try:
        if max(len(request.words), len(request.queried_pixels), len(request.viewport_pixels)) > request.domain_bound:
            return d_result(request, 'NEEDS_EVIDENCE', 'EXPOSURE_DOMAIN_BOUND')
        masks = {m.candidate_ref: m for m in request.masks}
        edits = {e.input_ref: e for e in request.edits}
        viewport = set(request.viewport_pixels)
        rows, witnesses = [], []
        unresolved = False
        for word in request.words:
            budget.visit({'stage': 'exposure_configuration', 'configuration_ref': word.configuration_ref})
            cost = sum(edits[e].movement_cost for e in word.edit_refs)
            if cost > request.movement_budget or len(word.edit_refs) > request.depth_bound: continue
            partitions, predictions, invalid = {}, [], None
            for model in request.models:
                poses = {p.object_ref: p for p in model.poses}
                initial = dict(poses)
                order = request.top_to_bottom_order
                completed = set()
                for ref in word.edit_refs:
                    edit = edits[ref]
                    budget.visit({'stage': 'licensed_edit', 'input_ref': ref, 'model_ref': model.model_ref})
                    if (edit.control_revision_ref != request.control_revision_ref or
                            edit.object_ref not in {request.requested_identity_ref, *request.identified_occluder_refs} or
                            not set(edit.prerequisite_input_refs) <= completed):
                        invalid = 'CONTROL_DEPENDENCY_UNBOUND'; break
                    pose = poses[edit.object_ref]
                    destination = tuple(pose.translation[i]+edit.translation_delta[i] for i in (0, 1))
                    scale = pose.scale if edit.new_scale is None else edit.new_scale
                    if destination not in edit.legal_translation_destinations or scale not in masks[pose.candidate_ref].supported_integer_scales:
                        invalid = 'EDIT_OUTSIDE_LICENSED_DOMAIN'; break
                    if edit.new_layer_order is not None:
                        if len(edit.new_layer_order) != len(poses) or set(edit.new_layer_order) != set(poses):
                            invalid = 'INCOMPLETE_LAYER_EDIT'; break
                        order = edit.new_layer_order
                    poses[edit.object_ref] = pose.model_copy(update={'translation': destination, 'scale': scale})
                    completed.add(ref)
                if invalid: break
                rendered, unknown = {}, set()
                for object_ref in reversed(order):
                    pose = poses[object_ref]
                    if object_ref in model.unknown_mask_object_refs:
                        # Unknown silhouette can occupy any query pixel; never use a hidden true mask.
                        unknown.update(request.queried_pixels)
                        continue
                    for pixel in masks[pose.candidate_ref].pixels:
                        for dx in range(pose.scale):
                            for dy in range(pose.scale):
                                budget.visit({'stage': 'conditional_visible_projection', 'model_ref': model.model_ref})
                                point = (pose.translation[0]+pixel.point[0]*pose.scale+dx, pose.translation[1]+pixel.point[1]*pose.scale+dy)
                                if point not in viewport: continue
                                if pose.opaque or point not in rendered:
                                    rendered[point] = (pixel.value_ref, object_ref)
                                if pose.opaque: unknown.discard(point)
                visible = tuple((p, rendered.get(p)) for p in request.queried_pixels if p in viewport and p not in unknown)
                unknown_query = tuple(p for p in request.queried_pixels if p not in viewport or p in unknown)
                unresolved = unresolved or bool(unknown_query)
                key = stable_digest(visible)
                partitions.setdefault(key, []).append(model.model_ref)
                predictions.append({'model_ref': model.model_ref, 'visible_evidence': visible, 'unknown_query_pixels': unknown_query,
                    'altered_layer_order': order, 'restoration_remaining_refs': tuple(ref for ref in request.restoration_required_refs if poses[ref] != initial[ref]),
                    'target_returned_to_initial_pose': poses[request.requested_identity_ref] == initial[request.requested_identity_ref]})
            if invalid:
                rows.append({'configuration_ref': word.configuration_ref, 'rejection': invalid}); continue
            complete_prediction = all(not p['unknown_query_pixels'] for p in predictions)
            informative = complete_prediction and len(partitions) > 1
            row = {'configuration_ref': word.configuration_ref, 'cost': cost, 'partitions': tuple(tuple(v) for _, v in sorted(partitions.items())),
                'predictions': tuple(predictions), 'discriminating': informative}
            rows.append(row)
            if informative and len(witnesses) < 3:
                witnesses.append({'configuration_ref': word.configuration_ref, 'dependency_word': word.edit_refs, 'movement_cost': cost})
        budget.finish()
        return d_result(request, 'NEEDS_EVIDENCE' if unresolved else 'COMPLETE', 'FINITE_EXPOSURE_PARTITIONS',
            complete=not unresolved, examined=budget.examined, values={'configuration_rows': tuple(rows),
            'dependency_witnesses': tuple(witnesses), 'requested_identity_ref': request.requested_identity_ref,
            'requested_aspect_ref': request.requested_aspect_ref, 'experiment_committed': False})
    except DComputationInterrupted as error:
        return d_result(request, 'BUDGET_REACHED', error.cause, examined=budget.examined,
            frontier={'restart_exposure_domain': True, 'work': error.frontier})
