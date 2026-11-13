"""Shared acquired inputs for quantity, reaction and lineage calculations."""
from typing import Literal
from pydantic import Field,model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref
from agents.yf_arc3_v5.state.observed_scene_reader import ObservedInputReadRequest
from agents.yf_arc3_v5.state.observed_canonical_field_reader_b import ObservedCanonicalFieldBindingB,ObservedCanonicalFieldScopeB
from .coupled_solving_contracts_c import CoupledParentWhyC
from .conservative_quantity_identity import QuantityIdentityRequest
from .consumable_reaction_network import ConsumableReactionRequest
from .lineage_production_delivery import LineageRequest,LineageEventTrace
from agents.yf_arc3_v5.state.sealed_interval_production import SealedIntervalProductionRequest
from .family_agenda_projection import FamilyAgendaSnapshot,FamilyAgendaDemand
from .mechanical_request_contracts import MechanicalNormalizedReturn
from .quantity_control_contracts_d import QuantityControlBindingD
from .program_composition_contracts_d import ProgramCompositionSpecD
from .family_result_join import FamilyJoinRequest,FamilyJoinResult
from .quantity_planning_contracts_d import QuantityPlanningSpecD,QuantityTagGoalD
from .resource_prefix_contracts_d import ResourcePrefixSpecD


class QuantityRestorationSpecD(FrozenModel):
    commitment_claim_ref: Ref
    revision_claim_ref: Ref
    restoration_term_ref: Ref
    restoration_goal: QuantityTagGoalD
    replacement_planning: QuantityPlanningSpecD
    expected_commitment_digest: Ref


class ReactionControlBindingD(FrozenModel):
    command_ref: Ref
    control_ref: Ref
    action_ref: Ref
    action_payload: FrozenMap
    support_claim_refs: tuple[Ref,...] = Field(min_length=1,max_length=16)


class ResourcePhysicalInputBindingA(FrozenModel):
    input_field_ref: Ref
    observation_side: Literal['BEFORE','AFTER']
    value_path: tuple[str | int,...] = Field(default=(),max_length=12)


class LineagePrimitiveFrameD(FrozenModel):
    primitive_ref: Ref
    frame_ref: Ref
    sequence_index: int = Field(ge=0)
    restore_epoch: int = Field(ge=0)
    trace: LineageEventTrace


class AcquiredResourceRequestA(FrozenModel):
    why: CoupledParentWhyC
    agenda: FamilyAgendaSnapshot
    demand: FamilyAgendaDemand
    owner_claim_ref: Ref
    before_observation: ObservedInputReadRequest
    after_observation: ObservedInputReadRequest
    before_binding: ObservedCanonicalFieldBindingB
    after_binding: ObservedCanonicalFieldBindingB
    before_scope: ObservedCanonicalFieldScopeB
    after_scope: ObservedCanonicalFieldScopeB
    interval_request: SealedIntervalProductionRequest
    native_request: QuantityIdentityRequest | ConsumableReactionRequest | LineageRequest
    physical_input_bindings: tuple[ResourcePhysicalInputBindingA,...] = Field(min_length=1,max_length=16)
    current_parameter_claim_ref: Ref
    source_return_claim_ref: Ref
    receipt_ref: Ref
    receipt_claim_ref: Ref
    maximum_transactions: int = Field(ge=1,le=128)
    owned_trace_binding: ObservedCanonicalFieldBindingB | None = None
    owned_trace_scope: ObservedCanonicalFieldScopeB | None = None
    requested_relation_refs: tuple[Ref,...] = Field(default=(),max_length=32)
    maximum_relation_evaluations: int = Field(default=65536,ge=1,le=65536)
    quantity_control_bindings: tuple[QuantityControlBindingD,...] = Field(default=(),max_length=128)
    composition: ProgramCompositionSpecD | None = None
    maximum_composition_evaluations: int = Field(default=65536,ge=1,le=65536)
    quantity_restoration: QuantityRestorationSpecD | None = None
    reaction_control_bindings: tuple[ReactionControlBindingD,...] = Field(default=(),max_length=32)
    affected_dependency_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    preserved_sibling_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    expected_relation_dispositions: FrozenMap = Field(default_factory=FrozenMap)
    primitive_prefix: ResourcePrefixSpecD | None = None
    lineage_primitive_frames: tuple[LineagePrimitiveFrameD,...] = Field(default=(),max_length=128)
    lineage_association_claim_refs: FrozenMap = Field(default_factory=FrozenMap)

    @model_validator(mode='after')
    def declared_adapter(self):
        if (len(self.lineage_association_claim_refs)>128
                or any(not isinstance(value,str) or not value.strip() for _,value in sorted(self.lineage_association_claim_refs.items()))
                or self.lineage_association_claim_refs and not isinstance(self.native_request,LineageRequest)):
            raise ValueError('bounded exact Source claim bindings for recalled lineage associations')
        if self.lineage_primitive_frames and not isinstance(self.native_request,LineageRequest):
            raise ValueError('lineage primitive frames require the exact lineage request type')
        if (len(self.expected_relation_dispositions)>32
                or len(set(self.affected_dependency_refs))!=len(self.affected_dependency_refs)
                or set(self.affected_dependency_refs)&set(self.preserved_sibling_refs)):
            raise ValueError('bounded distinct affected dependencies must not overlap preserved siblings')
        if self.affected_dependency_refs and not self.expected_relation_dispositions:
            raise ValueError('dependency refresh requires an exact owner-declared interpretation binding')
        if any(not isinstance(value,str) or not value.strip()
                for _,value in sorted(self.expected_relation_dispositions.items())):
            raise ValueError('expected relation dispositions must be non-empty text references')
        if self.reaction_control_bindings and not isinstance(self.native_request,ConsumableReactionRequest):
            raise ValueError('reaction controls require the exact reaction request type')
        if self.quantity_restoration is not None and not isinstance(self.native_request,QuantityIdentityRequest):
            raise ValueError('quantity restoration requires the exact quantity request type')
        if self.primitive_prefix is not None and self.composition is None:
            raise ValueError('a resource prefix must retain its exact bounded composition')
        if self.quantity_restoration is not None and (self.native_request.maintained_intervals is None
                or self.native_request.operation_ref!='mechanics.conservative_quantity_identity.resource_conflict'
                or self.native_request.planning is not None or 'quantity.reserve_use' not in self.requested_relation_refs):
            raise ValueError('restoration requires the explicit current preservation-conflict question')
        if self.quantity_control_bindings and not isinstance(self.native_request,QuantityIdentityRequest):
            raise ValueError('quantity controls require the exact quantity request type')
        if self.demand.request.kernel_ref not in ('mechanics.conservative_quantity_identity','mechanics.consumable_reaction_network','mechanics.lineage_production_delivery'):
            raise ValueError('unsupported acquired resource adapter')
        return self


class AcquiredResourceFactsA(FrozenModel):
    request: AcquiredResourceRequestA
    binding_current: bool
    evidence_refs: tuple[Ref,...]
    support_digests: FrozenMap
    physical_endpoints: FrozenMap = Field(default_factory=FrozenMap)
    physical_transactions: tuple[FrozenMap,...] = Field(default=(),max_length=128)
    owned_trace_value: FrozenMap | None = None
    missing_refs: tuple[Ref,...]


class AcquiredResourceReturnA(FrozenModel):
    measured: AcquiredResourceFactsA
    native_return: MechanicalNormalizedReturn | None = None
    parent_return: FrozenMap
    missing_refs: tuple[Ref,...]
    action_release: None = None
    family_join_request: FamilyJoinRequest | None = None
    family_join_result: FamilyJoinResult | None = None
    composition_missing_refs: tuple[Ref,...] = ()
