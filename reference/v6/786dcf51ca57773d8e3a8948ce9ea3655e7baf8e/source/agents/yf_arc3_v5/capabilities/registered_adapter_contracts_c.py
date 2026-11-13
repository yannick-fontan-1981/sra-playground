"""Typed ports for one Source-declared adapter; no native ABI conversion."""
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .mechanical_request_contracts import MechanicalRequestIdentity
from .complete_owner_contracts_c import CompleteOwnerBindingC
from .a_packet_step_contracts_c import WrapPacketStepInputC, APacketStepDispatchC
from .mechanical_step_contracts_c import ExternalStepInputC, ExternalStepDispatchResultC
from .cycle_step_contracts_c import CycleStepInputC, CycleStepDispatchC
from .metric_step_contracts_c import MetricStepInputC, MetricStepDispatchC
from .a_packet_step_contracts_c import OrientedPacketStepInputC, APacketStepDispatchC
from .capture_step_contracts_c import CaptureStepInputC, CaptureStepDispatchC
from .a_packet_step_contracts_c import StationPacketStepInputC, APacketStepDispatchC
from .rail_step_contracts_c import RailStepInputC, RailStepDispatchC
from .program_step_contracts_c import ProgramStepInputC, ProgramStepDispatchC
from .a_packet_step_contracts_c import ChartedPacketStepInputC, APacketStepDispatchC
from .gravity_step_contracts_c import GravityStepInputC, GravityStepDispatchC
from .recolor_step_contracts_c import RecolorStepInputC, RecolorStepDispatchC
from .voxel_step_contracts_c import VoxelStepInputC, VoxelStepDispatchC
from .packing_step_contracts_c import PackingStepInputC, PackingStepDispatchC
from .workshop_step_contracts_c import WorkshopStepInputC, WorkshopStepDispatchC
from .axial_step_contracts_c import AxialStepInputC, AxialStepDispatchC
from .fragment_step_contracts_c import FragmentStepInputC, FragmentStepDispatchC
from .optical_step_contracts_c import OpticalStepInputC, OpticalStepDispatchC
from .sequence_step_contracts_c import SequenceStepInputC, SequenceStepDispatchC
from .construction_step_contracts_c import ConstructionStepInputC, ConstructionStepDispatchC
from .alignment_step_contracts_c import AlignmentStepInputC, AlignmentStepDispatchC
from .joystick_step_contracts_c import JoystickStepInputC, JoystickStepDispatchC
from .neighborhood_step_contracts_c import NeighborhoodStepInputC, NeighborhoodStepDispatchC
from .prefix_step_contracts_c import PrefixStepInputC, PrefixStepDispatchC


class RegisteredAdapterInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.registered_adapter_input_c.v1"
    request: MechanicalRequestIdentity
    parent_request: MechanicalRequestIdentity
    owner_binding: CompleteOwnerBindingC
    source_adapter_operation_ref: Ref | None
    source_model_ref: Ref
    source_binding_evidence_refs: tuple[Ref, ...]
    source_inherited_evidence_refs: tuple[Ref, ...] = ()
    other_adapter_case_refs: tuple[Ref, ...] = ()
    wrap_slide: WrapPacketStepInputC | None = None
    guarded_transport: ExternalStepInputC | None = None
    queued_alignment_cascade: ExternalStepInputC | None = None
    cyclic_configuration_coverage: CycleStepInputC | None = None
    metric_stack_image: MetricStepInputC | None = None
    oriented_passage: OrientedPacketStepInputC | None = None
    reactive_capture: CaptureStepInputC | None = None
    station_gated_cargo: StationPacketStepInputC | None = None
    cadenced_rail_transfer: RailStepInputC | None = None
    fixed_program_origin: ProgramStepInputC | None = None
    charted_room_navigation: ChartedPacketStepInputC | None = None
    gravity_adhesion: GravityStepInputC | None = None
    topological_region_recolor: RecolorStepInputC | None = None
    visible_voxel_construction: VoxelStepInputC | None = None
    preview_piece_packing: PackingStepInputC | None = None
    station_profile_workbench: WorkshopStepInputC | None = None
    axial_field_configuration: AxialStepInputC | None = None
    temporal_fragment_match: FragmentStepInputC | None = None
    discrete_relay_optics: OpticalStepInputC | None = None
    visual_sequence: SequenceStepInputC | None = None
    supported_construction: ConstructionStepInputC | None = None
    finite_alignment_game: AlignmentStepInputC | None = None
    bounded_joystick: JoystickStepInputC | None = None
    neighborhood_pattern_construction: NeighborhoodStepInputC | None = None
    layered_prefix_construction: PrefixStepInputC | None = None


class RegisteredAdapterFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.registered_adapter_facts_c.v1"
    facts: FrozenMap


class RegisteredAdapterFinishInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.registered_adapter_finish_input_c.v1"
    request: RegisteredAdapterInputC
    measured: RegisteredAdapterFactsC
    source_policy_ref: Ref
    source_disposition_ref: Ref
    source_reason_ref: Ref
    native_dispatch: APacketStepDispatchC | ExternalStepDispatchResultC | CycleStepDispatchC | MetricStepDispatchC | CaptureStepDispatchC | RailStepDispatchC | ProgramStepDispatchC | GravityStepDispatchC | RecolorStepDispatchC | VoxelStepDispatchC | PackingStepDispatchC | WorkshopStepDispatchC | AxialStepDispatchC | FragmentStepDispatchC | OpticalStepDispatchC | SequenceStepDispatchC | ConstructionStepDispatchC | AlignmentStepDispatchC | JoystickStepDispatchC | NeighborhoodStepDispatchC | PrefixStepDispatchC | None = None


class RegisteredAdapterDispatchC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.registered_adapter_dispatch_c.v1"
    frozen_request: RegisteredAdapterInputC
    frozen_facts: RegisteredAdapterFactsC
    source_policy_ref: Ref
    source_disposition_ref: Ref
    source_reason_ref: Ref
    native_dispatch: APacketStepDispatchC | ExternalStepDispatchResultC | CycleStepDispatchC | MetricStepDispatchC | CaptureStepDispatchC | RailStepDispatchC | ProgramStepDispatchC | GravityStepDispatchC | RecolorStepDispatchC | VoxelStepDispatchC | PackingStepDispatchC | WorkshopStepDispatchC | AxialStepDispatchC | FragmentStepDispatchC | OpticalStepDispatchC | SequenceStepDispatchC | ConstructionStepDispatchC | AlignmentStepDispatchC | JoystickStepDispatchC | NeighborhoodStepDispatchC | PrefixStepDispatchC | None
    proposed_action: None = None
