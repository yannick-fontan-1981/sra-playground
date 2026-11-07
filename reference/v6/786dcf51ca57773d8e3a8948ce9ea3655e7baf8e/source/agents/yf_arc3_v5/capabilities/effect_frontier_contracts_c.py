"""Shared acquired frontier envelope; native family calculations remain typed."""
from typing import Literal
from pydantic import Field,model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref
from .reconfigurable_support import SupportRequest
from .coupled_value_contracts_c import CoupledValueRequestC
from .articulated_channel_kinematics import ArtiRequest
from .contact_shape_repair import ShapeRequest
from .coupled_solving_contracts_c import CoupledParentWhyC
from .articulated_solving_contracts_c import ArticulatedAcquiredFieldC
from .family_agenda_projection import FamilyAgendaSnapshot,FamilyAgendaDemand
from .latent_solving_contracts_c import LatentOwnerPublicationBindingC
from .mechanical_request_contracts import MechanicalNormalizedReturn
from .coupled_value_contracts_c import CoupledValueSourceReturnC
from ..drm.meaning import DeclaredMeaningInstantiation
from .mechanical_family_contracts_a import MechanicalFamilyResult
from .family_effect_publication_contracts import FamilyEffectPublicationRequest,FamilyEffectPublicationResult
from .agenda_receipt_contracts_root import AgendaReceiptInputRoot
from .program_effect_contracts_c import ProgramEffectRequestC
from .editable_actor_programs import ProgramRequest
from .shared_symbol_automata import SharedSymbolRequest
from .finite_relation_network import FiniteRelationRequest
from .finite_flow_network import FlowRequest
from .push_only_logistics import PushRequest
from .mutable_kit_survival import MutableKitRequest
from .hidden_motion_reception import HiddenReceptionRequest
from .ballistic_targeting import BallisticRequest
from .feedback_code_identification import FeedbackCodeRequest
from .identity_contact_authentication import IdentityContactRequest
from .ordered_support_transfer import OrderedRequest
from .autonomous_route_intervention import RouteInterventionRequest
from .inventory_gated_navigation import InventoryNavigationRequest,ChartedNavigationRequest
from .visibility_capacity_navigation import CapacityRoomRequest
from .temporal_reference_matching import RecallRequest
from .adversarial_drop_alignment import AdversarialDropRequest
from .chromatic_window_composition import ChromaticWindowRequest
from .rewritable_endpoint_transport import EndpointTransportRequest,OrientedPassageRequest
from .recurring_quantity_control import QuantityRequest
from .oriented_cargo_handoffs import HandoffRequest
from .station_gated_cargo import StationCargoRequest
from .piercing_rooted_order import PiercingRequest
from .local_field_type_production import LocalRequest
from .directed_accretive_flow import DirectedRequest
from .wrap_slide import WrapRequest
from .latent_reference_restoration import RestorationRequest
from .finite_instruction_device import DeviceRequest
from .typed_material_workbench import MaterialRequest
from .cyclic_configuration_coverage import CyclicCoverageRequest
from .fixed_program_origin import FixedProgramRequest
from .temporal_fragment_match import TemporalFragmentRequest
from .visual_sequence import VisualSequenceRequest
from .topological_region_recolor import TopologicalRecolorRequest
from .reactive_capture import ReactiveCaptureRequest
from .neighborhood_pattern_construction import NeighborhoodPatternRequest
from .layered_prefix_construction import LayeredPrefixRequest
from .preview_piece_packing import PreviewPackingRequest
from .station_profile_workbench import StationWorkbenchRequest
from .supported_construction import SupportedConstructionRequest
from .visible_voxel_construction import VisibleVoxelRequest
from .cadenced_rail_transfer import CadencedRailRequest
from .discrete_relay_optics import DiscreteOpticsRequest
from .finite_alignment_game import FiniteAlignmentRequest
from .coupled_member_control import CoupledMemberRequest
from .metric_frontier_contracts_d import MetricFrontierRequestD
from .reactive_graph_contracts_c import ReactiveGraphRequestC,ReactiveGraphSourceReturnC
from .effect_frontier_d_transport import D_FRONTIER_MODELS,D_FRONTIER_KERNELS,EffectFrontierDIdentityInputD,bind_effect_frontier_d_identity,parse_d_frontier_native
from .mechanical_family_contracts_d import DMechanicalResult
from .effect_frontier_d_transport import EffectFrontierDIdentityFactsD

FRONTIER_KERNELS_C={
    'support':'mechanics.reconfigurable_support',
    'coupled':'mechanics.coupled_value_constraints',
    'articulated':'mechanics.articulated_channel_kinematics',
    'shape':'mechanics.contact_shape_repair',
    'program':'mechanics.typed_recursive_program',
    'actor_program':'mechanics.editable_actor_programs',
    'symbol_automata':'mechanics.shared_symbol_automata',
    'relation_network':'mechanics.finite_relation_network',
    'flow_network':'mechanics.finite_flow_network',
    'push_logistics':'mechanics.push_only_logistics',
    'mutable_kit':'mechanics.mutable_kit_survival',
    'hidden_reception':'mechanics.hidden_motion_reception',
    'ballistic':'mechanics.ballistic_targeting',
    'feedback_code':'mechanics.feedback_code_identification',
    'identity_contact':'mechanics.identity_contact_authentication',
    'ordered_transfer':'mechanics.ordered_support_transfer',
    'route_intervention':'mechanics.autonomous_route_intervention',
    'inventory_navigation':'mechanics.inventory_gated_navigation',
    'visibility_capacity':'mechanics.visibility_capacity_navigation',
    'charted_navigation':'mechanics.charted_room_navigation',
    'temporal_recall':'mechanics.temporal_reference_matching',
    'adversarial_drop':'mechanics.adversarial_drop_alignment',
    'chromatic_pane':'mechanics.chromatic_window_composition',
    'endpoint_transport':'mechanics.rewritable_endpoint_transport',
    'oriented_passage':'mechanics.oriented_passage',
    'recurring_quantity':'mechanics.recurring_quantity_control',
    'oriented_handoff':'mechanics.oriented_cargo_handoffs',
    'station_cargo':'mechanics.station_gated_cargo',
    'rooted_piercing':'mechanics.piercing_rooted_order',
    'local_field':'mechanics.local_field_type_production',
    'directed_flow':'mechanics.directed_accretive_flow',
    'wrap_slide':'mechanics.coupled_member_control',
    'reference_restore':'mechanics.latent_reference_restoration',
    'instruction_device':'mechanics.finite_instruction_device',
    'material_workbench':'mechanics.typed_material_workbench',
    **D_FRONTIER_KERNELS,
    'reactive_graph':'mechanics.reactive_graph_navigation',
    'metric_stack':'mechanics.metric_stack_image',
}


class EffectFrontierFacetC(FrozenModel):
    packet_term_ref: Ref
    packet_projection_contract_ref: Ref
    state_projection_contract_ref: Ref
    expected_packet_fields: FrozenMap
    transactions: tuple[FrozenMap,...] = Field(min_length=1,max_length=64)
    transaction_index: int = Field(ge=0,le=63)
    before_field: ArticulatedAcquiredFieldC
    after_field: ArticulatedAcquiredFieldC
    control_field: ArticulatedAcquiredFieldC
    intermediate_fields: tuple[ArticulatedAcquiredFieldC,...] = Field(default=(),max_length=64)
    acceptance_field: ArticulatedAcquiredFieldC | None = None


class EffectFrontierFieldC(FrozenModel):
    native_field_ref: Ref
    acquisition: ArticulatedAcquiredFieldC


class EffectFrontierInputC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.effect_frontier_input_c.v1'
    family: Literal['support','coupled','articulated','shape','program','actor_program','symbol_automata','relation_network','flow_network','push_logistics','mutable_kit','hidden_reception','ballistic','feedback_code','identity_contact','ordered_transfer','route_intervention','inventory_navigation','visibility_capacity','charted_navigation','temporal_recall','adversarial_drop','chromatic_pane','endpoint_transport','oriented_passage','recurring_quantity','oriented_handoff','station_cargo','rooted_piercing','local_field','directed_flow','wrap_slide','reference_restore','instruction_device','material_workbench','cyclic_coverage','fixed_origin','temporal_fragment','visual_sequence','topological_recolor','reactive_capture','neighborhood_pattern','layered_prefix','preview_packing','station_profile','supported_construction','visible_voxel','cadenced_rail','discrete_optics','finite_alignment','reactive_graph','gravity_adhesion','metric_stack']
    why: CoupledParentWhyC
    agenda: FamilyAgendaSnapshot
    demand: FamilyAgendaDemand
    native_request: SupportRequest | CoupledValueRequestC | ArtiRequest | ShapeRequest | ProgramEffectRequestC | ProgramRequest | SharedSymbolRequest | FiniteRelationRequest | FlowRequest | PushRequest | MutableKitRequest | HiddenReceptionRequest | BallisticRequest | FeedbackCodeRequest | IdentityContactRequest | OrderedRequest | RouteInterventionRequest | InventoryNavigationRequest | CapacityRoomRequest | ChartedNavigationRequest | RecallRequest | AdversarialDropRequest | ChromaticWindowRequest | EndpointTransportRequest | OrientedPassageRequest | QuantityRequest | HandoffRequest | StationCargoRequest | PiercingRequest | LocalRequest | DirectedRequest | WrapRequest | RestorationRequest | DeviceRequest | MaterialRequest | CyclicCoverageRequest | FixedProgramRequest | TemporalFragmentRequest | VisualSequenceRequest | TopologicalRecolorRequest | ReactiveCaptureRequest | NeighborhoodPatternRequest | LayeredPrefixRequest | PreviewPackingRequest | StationWorkbenchRequest | SupportedConstructionRequest | VisibleVoxelRequest | CadencedRailRequest | DiscreteOpticsRequest | FiniteAlignmentRequest | ReactiveGraphRequestC | CoupledMemberRequest | MetricFrontierRequestD
    native_scene_side: Literal['BEFORE','AFTER'] = 'BEFORE'
    facet: EffectFrontierFacetC
    native_fields: tuple[EffectFrontierFieldC,...] = Field(min_length=1,max_length=64)
    publication_binding: LatentOwnerPublicationBindingC | None = None
    receipt_claim_ref: Ref
    maximum_evaluations: int = Field(default=65536,ge=1,le=65536)

    @model_validator(mode='before')
    @classmethod
    def parse_native_family(cls,value):
        return parse_d_frontier_native(value)

    @model_validator(mode='after')
    def exact_family(self):
        expected={'support':SupportRequest,'coupled':CoupledValueRequestC,'articulated':ArtiRequest,'shape':ShapeRequest,'program':ProgramEffectRequestC,
            'actor_program':ProgramRequest,'symbol_automata':SharedSymbolRequest,'relation_network':FiniteRelationRequest,'flow_network':FlowRequest,
            'push_logistics':PushRequest,'mutable_kit':MutableKitRequest,'hidden_reception':HiddenReceptionRequest,'ballistic':BallisticRequest,
            'feedback_code':FeedbackCodeRequest,'identity_contact':IdentityContactRequest,
            'ordered_transfer':OrderedRequest,'route_intervention':RouteInterventionRequest,
            'inventory_navigation':InventoryNavigationRequest,'visibility_capacity':CapacityRoomRequest,
            'charted_navigation':ChartedNavigationRequest,'temporal_recall':RecallRequest,
            'adversarial_drop':AdversarialDropRequest,'chromatic_pane':ChromaticWindowRequest,
            'endpoint_transport':EndpointTransportRequest,'oriented_passage':OrientedPassageRequest,
            'recurring_quantity':QuantityRequest,'oriented_handoff':HandoffRequest,
            'station_cargo':StationCargoRequest,'rooted_piercing':PiercingRequest,
            'local_field':LocalRequest,'directed_flow':DirectedRequest,
            'wrap_slide':WrapRequest,
            'reference_restore':RestorationRequest,
            'instruction_device':DeviceRequest,
            'material_workbench':MaterialRequest,'reactive_graph':ReactiveGraphRequestC,'metric_stack':MetricFrontierRequestD,**D_FRONTIER_MODELS}
        if not isinstance(self.native_request,expected[self.family]):
            raise ValueError('frontier family must retain its native typed request')
        return self


class EffectFrontierFactsC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.effect_frontier_facts_c.v1'
    request: EffectFrontierInputC
    facts: FrozenMap
    evidence_refs: tuple[Ref,...] = ()
    missing_refs: tuple[Ref,...] = ()
    accounted_evaluations: int = Field(default=0,ge=0)


class EffectFrontierCalculationC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.effect_frontier_calculation_c.v1'
    measured: EffectFrontierFactsC
    returned: MechanicalNormalizedReturn | CoupledValueSourceReturnC | DMechanicalResult | ReactiveGraphSourceReturnC | None = None


class EffectFrontierReturnC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.effect_frontier_return_c.v1'
    measured: EffectFrontierFactsC
    returned: MechanicalNormalizedReturn | CoupledValueSourceReturnC | DMechanicalResult | ReactiveGraphSourceReturnC | None = None
    parent_return: FrozenMap
    missing_refs: tuple[Ref,...] = ()
    action_authority: None = None


class EffectFrontierInterpretationC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.effect_frontier_interpretation_c.v1'
    calculated: EffectFrontierReturnC
    meaning: DeclaredMeaningInstantiation | None = None


class CoupledMechanicalReturnBindingC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.coupled_mechanical_return_binding_c.v1'
    request: CoupledValueRequestC
    measurement: MechanicalFamilyResult
    kernel_ref: Literal['mechanics.coupled_value_constraints'] = 'mechanics.coupled_value_constraints'
    source_status: Ref
    missing_cause: Literal['NONE','MISSING_OBSERVATION','UNSUPPORTED_MODEL','SIGNATURE_MISMATCH',
        'MISSING_IMPLEMENTATION','DOMAIN_EXHAUSTED','COMPUTATION_BOUND']
    question_ref: Ref


class EffectFrontierPublicationC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.effect_frontier_publication_c.v1'
    returned: EffectFrontierReturnC
    publication_request: FamilyEffectPublicationRequest | None = None
    facts: FrozenMap
    missing_refs: tuple[Ref,...] = ()


class EffectFrontierPublicationJoinC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.effect_frontier_publication_join_c.v1'
    publication: EffectFrontierPublicationC
    published: FamilyEffectPublicationResult | None = None


class EffectFrontierAgendaInputC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.effect_frontier_agenda_input_c.v1'
    returned: EffectFrontierReturnC
    published: FrozenMap | None = None


class EffectFrontierAgendaRequestC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.effect_frontier_agenda_request_c.v1'
    request: AgendaReceiptInputRoot
