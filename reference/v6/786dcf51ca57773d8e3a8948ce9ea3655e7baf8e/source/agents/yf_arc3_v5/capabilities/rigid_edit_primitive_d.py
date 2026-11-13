"""One supported rigid edit, including containment closure and hit precedence."""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result


class RigidBodyD(FrozenModel):
    body_ref: Ref
    origin: tuple[int, int]
    parent_ref: Ref | None
    solid_offsets: tuple[tuple[int, int], ...] = Field(default=(), max_length=4096)
    hit_offsets: tuple[tuple[int, int], ...] = Field(default=(), max_length=4096)
    marker_offsets: tuple[tuple[int, int], ...] = Field(default=(), max_length=4096)
    # Exhaustive admitted solid positions, not a color-derived walkability guess.
    admitted_solid_cells: tuple[tuple[int, int], ...] = Field(default=(), max_length=4096)


class RigidPlacementCheckD(FrozenModel):
    event_ref: Ref
    placements: tuple[tuple[Ref, int, int], ...] = Field(min_length=1, max_length=4096)
    terminal: bool
    restore: bool


class RigidEditPrimitiveRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.rigid_edit_primitive_request_d.v1'
    phase_ref: Literal['EXTERNAL_COMMAND']
    bodies: tuple[RigidBodyD, ...] = Field(min_length=1, max_length=4096)
    native_focus_ref: Ref | None
    overlap_priority: tuple[Ref, ...] = Field(min_length=1, max_length=4096)
    channel: Literal['CLICK', 'TRANSLATE', 'ABSOLUTE', 'RESET']
    click_point: tuple[int, int] | None
    translation: tuple[int, int] | None
    unit_translation_vectors: tuple[tuple[int, int], ...] = Field(min_length=1, max_length=64)
    absolute_origin: tuple[int, int] | None
    click_selection_precedes_placement: bool
    click_focused_body_rule: Literal['SELECT_ONLY', 'DESELECT', 'PLACE']
    absolute_placement_supported: bool
    quantizer_pitch: tuple[int, int]
    quantizer_offset: tuple[int, int]
    quantizer_rule: Literal['EXACT', 'FLOOR', 'NEAREST_TIES_UP']
    admission_kind: Literal['FINAL_ONLY', 'SWEPT_UNIT']
    containment_supported: bool
    collision_exclusion_pairs: tuple[tuple[Ref, Ref], ...] = Field(default=(), max_length=4096)
    checkpoints: tuple[RigidPlacementCheckD, ...] = Field(default=(), max_length=64)
    restore_origins: tuple[tuple[Ref, int, int], ...] = Field(default=(), max_length=4096)
    restore_native_focus_ref: Ref | None
    submitted_cost: int = Field(ge=0)
    accepted_edit_cost: int = Field(ge=0)
    refused_cost: int = Field(ge=0)
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = (
        ('mechanics.editable_configuration_graph.rigid_edit_external_primitive', 'STEP'),
    )

    @model_validator(mode='after')
    def exact_forest(self):
        ids = {b.body_ref for b in self.bodies}
        if len(ids) != len(self.bodies) or set(self.overlap_priority) != ids or len(self.overlap_priority) != len(ids):
            raise ValueError('body identity/overlap order is incomplete or duplicated')
        if self.native_focus_ref is not None and self.native_focus_ref not in ids:
            raise ValueError('selected identity absent')
        parents = {b.body_ref: b.parent_ref for b in self.bodies}
        for body in self.bodies:
            seen, parent = {body.body_ref}, body.parent_ref
            while parent is not None:
                if parent not in ids or parent in seen:
                    raise ValueError('containment is not a rooted forest')
                seen.add(parent)
                parent = parents[parent]
        if any(p <= 0 for p in self.quantizer_pitch):
            raise ValueError('quantizer pitch must be positive')
        if len(set(self.unit_translation_vectors)) != len(self.unit_translation_vectors) or any(
                (x == 0) == (y == 0) for x,y in self.unit_translation_vectors):
            raise ValueError('licensed unit translations must be distinct nonzero axial vectors')
        for rows in (self.restore_origins, *(c.placements for c in self.checkpoints)):
            refs = [r[0] for r in rows]
            if len(set(refs)) != len(refs) or not set(refs) <= ids:
                raise ValueError('placement predicate has unknown or duplicate body')
        if self.restore_origins and {r[0] for r in self.restore_origins} != ids:
            raise ValueError('restoration must specify the whole configuration')
        if self.restore_native_focus_ref is not None and self.restore_native_focus_ref not in ids:
            raise ValueError('restore selection absent')
        if any(a not in ids or b not in ids for a,b in self.collision_exclusion_pairs):
            raise ValueError('collision exception outside body domain')
        return self


def measure_rigid_edit_primitive_d(request: RigidEditPrimitiveRequestD):
    rejection = d_validate_request(request)
    if rejection is not None:
        return rejection
    if sum(len(b.solid_offsets)+len(b.hit_offsets)+len(b.admitted_solid_cells)+len(b.marker_offsets) for b in request.bodies) > request.domain_bound:
        return d_result(request, 'NEEDS_EVIDENCE', 'INPUT_DOMAIN_BOUND')
    if request.resume_frontier:
        return d_result(request, 'NEEDS_EVIDENCE', 'ATOMIC_COMMAND_REQUIRES_RESTART_FROM_BOUND_INPUT')
    budget = DWorkBudget(request)
    poses = {b.body_ref: b.origin for b in request.bodies}
    original = dict(poses)
    bodies = {b.body_ref: b for b in request.bodies}
    selected, cause, accepted, event = request.native_focus_ref, 'UNCHANGED', False, None
    moving = set()
    try:
        budget.visit({'stage': 'decode_one_input'})
        delta = request.translation if request.channel == 'TRANSLATE' else None
        target_origin = request.absolute_origin if request.channel == 'ABSOLUTE' else None
        if request.channel == 'TRANSLATE' and delta is None:
            return d_result(request, 'NEEDS_EVIDENCE', 'TRANSLATION_PAYLOAD_MISSING', examined=budget.examined)
        if request.channel == 'ABSOLUTE' and target_origin is None:
            return d_result(request, 'NEEDS_EVIDENCE', 'ABSOLUTE_PAYLOAD_MISSING', examined=budget.examined)
        if request.channel == 'RESET':
            if not request.restore_origins:
                return d_result(request, 'NEEDS_EVIDENCE', 'RESET_LAW_MISSING', examined=budget.examined)
            poses = {r:(x,y) for r,x,y in request.restore_origins}
            selected, cause, accepted = request.restore_native_focus_ref, 'RESTORED_CONFIGURATION', True
        elif request.channel == 'CLICK':
            if request.click_point is None:
                return d_result(request, 'NEEDS_EVIDENCE', 'CLICK_PAYLOAD_MISSING', examined=budget.examined)
            hit = None
            for ref in request.overlap_priority:
                body = bodies[ref]
                for x,y in body.hit_offsets:
                    budget.visit({'stage': 'hit_mask', 'body_ref': ref})
                    if (body.origin[0]+x,body.origin[1]+y) == request.click_point:
                        hit = ref
                        break
                if hit is not None:
                    break
            if hit is not None and (request.click_selection_precedes_placement or selected is None):
                if hit == selected and request.click_focused_body_rule == 'DESELECT':
                    selected = None
                elif hit != selected or request.click_focused_body_rule == 'SELECT_ONLY':
                    selected = hit
                else:
                    target_origin = request.click_point
                cause = 'HIT_SELECTION'
            else:
                target_origin = request.click_point
        if request.channel != 'RESET' and (delta is not None or target_origin is not None):
            if selected is None:
                cause = 'NO_SELECTED_BODY'
            else:
                if delta is None:
                    if not request.absolute_placement_supported:
                        return d_result(request, 'NEEDS_EVIDENCE', 'ABSOLUTE_PLACEMENT_LAW_MISSING', examined=budget.examined)
                    snapped = []
                    for value,pitch,offset in zip(target_origin,request.quantizer_pitch,request.quantizer_offset):
                        quotient,remainder = divmod(value-offset,pitch)
                        if request.quantizer_rule == 'EXACT' and remainder:
                            return d_result(request, 'COMPLETE', 'OFF_LATTICE_REFUSAL', complete=True, examined=budget.examined,
                                values={'poses': original, 'native_focus_ref': selected, 'submitted_cost': request.submitted_cost,
                                    'refused_cost': request.refused_cost, 'complete_response_boundary_count': 1})
                        if request.quantizer_rule == 'NEAREST_TIES_UP' and remainder*2 >= pitch:
                            quotient += 1
                        snapped.append(offset+quotient*pitch)
                    delta = (snapped[0]-poses[selected][0],snapped[1]-poses[selected][1])
                    stages = (delta,)  # Absolute edit has no invented physical transit.
                else:
                    if delta not in request.unit_translation_vectors:
                        return d_result(request, 'NEEDS_EVIDENCE', 'UNIT_TRANSLATION_SIGNATURE_MISMATCH', examined=budget.examined)
                    distance = sum(abs(v) for v in delta)
                    if request.admission_kind == 'SWEPT_UNIT':
                        if distance > request.depth_bound:
                            return d_result(request, 'NEEDS_EVIDENCE', 'SWEEP_DEPTH_BOUND', examined=budget.examined)
                        dx,dy = (0 if value == 0 else (1 if value > 0 else -1) for value in delta)
                        stages = tuple((dx*i,dy*i) for i in range(1,distance+1))
                    else:
                        stages = (delta,)
                moving = {selected}
                if request.containment_supported:
                    for _ in range(len(bodies)):
                        before = len(moving)
                        moving.update(b.body_ref for b in request.bodies if b.parent_ref in moving)
                        if len(moving) == before:
                            break
                elif any(b.parent_ref in moving for b in request.bodies):
                    return d_result(request, 'NEEDS_EVIDENCE', 'CONTAINMENT_CARRY_LAW_MISSING', examined=budget.examined)
                exclusions = {frozenset(p) for p in request.collision_exclusion_pairs}
                admitted = True
                for dx,dy in stages:
                    occupied = {}
                    for body in request.bodies:
                        shift = (dx,dy) if body.body_ref in moving else (0,0)
                        ox,oy = poses[body.body_ref]
                        allowed = set(body.admitted_solid_cells)
                        for x,y in body.solid_offsets:
                            budget.visit({'stage': 'admission', 'body_ref': body.body_ref})
                            cell = (ox+x+shift[0],oy+y+shift[1])
                            if body.body_ref in moving and cell not in allowed:
                                admitted = False
                            for peer in occupied.get(cell, ()):
                                if (peer in moving or body.body_ref in moving) and frozenset((peer,body.body_ref)) not in exclusions:
                                    admitted = False
                            occupied.setdefault(cell, []).append(body.body_ref)
                if admitted:
                    for ref in moving:
                        poses[ref] = (poses[ref][0]+delta[0],poses[ref][1]+delta[1])
                    cause, accepted = 'RIGID_EDIT', True
                else:
                    cause = 'PLACEMENT_REFUSAL'
        pre_restore = dict(poses)
        for check in request.checkpoints:
            budget.visit({'stage': 'ordered_checkpoint', 'event_ref': check.event_ref})
            if all(poses[ref] == (x,y) for ref,x,y in check.placements):
                event = check.event_ref
                if check.restore:
                    if not request.restore_origins:
                        return d_result(request, 'NEEDS_EVIDENCE', 'CHECKPOINT_RESTORE_LAW_MISSING', examined=budget.examined)
                    poses = {r:(x,y) for r,x,y in request.restore_origins}
                    selected = request.restore_native_focus_ref
                if check.terminal or check.restore:
                    break
        budget.finish()
        return d_result(request, 'COMPLETE', cause, complete=True, examined=budget.examined, values={
            'poses': poses, 'native_focus_ref': selected, 'pre_restore_poses': pre_restore,
            'translated_closure_refs': tuple(sorted(moving)) if accepted else (),
            'changed_body_refs': tuple(sorted(r for r in poses if poses[r] != original[r])),
            'marker_positions': {b.body_ref: tuple((poses[b.body_ref][0]+x,poses[b.body_ref][1]+y)
                for x,y in b.marker_offsets) for b in request.bodies},
            'event_ref': event, 'submitted_cost': request.submitted_cost,
            'accepted_edit_cost': request.accepted_edit_cost if accepted else 0,
            'refused_cost': request.refused_cost if cause in ('PLACEMENT_REFUSAL','NO_SELECTED_BODY') else 0,
            'complete_response_boundary_count': 1,
        })
    except DComputationInterrupted as interruption:
        return d_result(request, 'NEEDS_EVIDENCE', interruption.cause, examined=budget.examined,
            frontier={'restart_atomic_command': True, 'work': interruption.frontier})
