"""Source-bound pose/focus STEP transport to the existing K09 search driver.

This narrow model has no hidden clock, refill or cost-dependent physics. Source
must license cost dominance explicitly; other state spaces need another typed
binding, not silent field loss or a cast into MechanicalRequestB.
"""
from typing import Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .mechanical_profile_d import DNativeProfileRequest
from .mechanical_common_contracts_c import MechanicalEventC
from .rigid_edit_primitive_d import RigidEditPrimitiveRequestD


class RigidEditPacketContractC(FrozenModel):
    model_ref: Ref
    poses_field: Ref
    focus_field: Ref
    event_template: MechanicalEventC
    closure_domain_ref: Ref
    closure_stop_ref: Ref
    cost_dominance_premise_refs: tuple[Ref, ...] = Field(min_length=1, max_length=64)
    cost_state_independent: Literal[True]
    acceptance_checkpoint_refs: tuple[Ref, ...] = Field(default=(), max_length=64)

    @model_validator(mode='after')
    def distinct_state_fields(self):
        if self.poses_field == self.focus_field:
            raise ValueError('rigid pose/focus fields must be distinct')
        if (self.event_template.interruption_ref is not None or self.event_template.predicate_values
                or self.event_template.deleted_state_refs):
            raise ValueError('checkpoint occurrence, not the event template, owns terminal/acceptance')
        return self


class RigidEditSearchTemplateC(FrozenModel):
    profile: DNativeProfileRequest
    packet_contract: RigidEditPacketContractC

    @model_validator(mode='after')
    def exact_supported_profile(self):
        native = self.profile.native_request
        if not isinstance(native, RigidEditPrimitiveRequestD) or native.mode_ref != 'STEP':
            raise ValueError('rigid search template requires its exact native STEP type')
        if self.profile.family_join is not None:
            raise ValueError('a prebound family join cannot be reused for counterfactual children')
        if native.channel == 'RESET':
            raise ValueError('RESET is outside the rigid movement search domain')
        if (not native.click_selection_precedes_placement or native.click_focused_body_rule != 'SELECT_ONLY'
                or native.absolute_placement_supported):
            raise ValueError('this library variant requires persistent selection-only clicks')
        if native.submitted_cost != 1 or native.accepted_edit_cost or native.refused_cost:
            raise ValueError('this pose/focus projection requires one constant submitted cost')
        if any(c.restore for c in native.checkpoints):
            raise ValueError('restoring checkpoints require an ordered multi-state projection')
        if not set(self.packet_contract.acceptance_checkpoint_refs) <= {c.event_ref for c in native.checkpoints}:
            raise ValueError('acceptance checkpoint absent from the declared native model')
        return self


class RigidEditSearchCommandC(FrozenModel):
    channel: Literal['CLICK', 'TRANSLATE']
    body_ref: Ref | None = None
    hit_offset: tuple[int, int] | None = None
    translation: tuple[int, int] | None = None

    @model_validator(mode='after')
    def complete_payload(self):
        if self.channel == 'CLICK':
            if self.body_ref is None or self.hit_offset is None or self.translation is not None:
                raise ValueError('selection requires an explicit body and occupied hit offset')
        elif self.translation is None or self.body_ref is not None or self.hit_offset is not None:
            raise ValueError('translation requires only an explicit vector')
        return self


class RigidEditStepContextC(FrozenModel):
    contract: RigidEditPacketContractC
    before: FrozenMap
    action_ref: Ref
