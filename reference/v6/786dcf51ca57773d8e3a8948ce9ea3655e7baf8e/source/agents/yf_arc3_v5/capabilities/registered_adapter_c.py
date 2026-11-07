"""Exact typed-port comparisons and transport; Source owns adapter selection."""
from agents.yf_arc3_v5.logos.types import FrozenMap
from .mechanical_event_composition_c import packet_context_equal
from .complete_owner_c import measure_complete_owner
from .registered_adapter_contracts_c import (RegisteredAdapterInputC, RegisteredAdapterFactsC,
    RegisteredAdapterFinishInputC, RegisteredAdapterDispatchC,
    WrapPacketStepInputC, ExternalStepInputC, CycleStepInputC, MetricStepInputC, OrientedPacketStepInputC, CaptureStepInputC, StationPacketStepInputC, RailStepInputC, ProgramStepInputC, ChartedPacketStepInputC, GravityStepInputC, RecolorStepInputC, VoxelStepInputC, PackingStepInputC, WorkshopStepInputC, AxialStepInputC, FragmentStepInputC, OpticalStepInputC, SequenceStepInputC, ConstructionStepInputC, AlignmentStepInputC, JoystickStepInputC, NeighborhoodStepInputC, PrefixStepInputC)

# Descriptors for finite measurement only; no ordered fallback or native call.
REGISTERED_ADAPTER_PORTS_C = (
    ("wrap_slide", "mechanics.wrap_slide.external_primitive"),
    ("guarded_transport", "mechanics.guarded_transport.external_primitive"),
    ("queued_alignment_cascade", "mechanics.queued_alignment_cascade.external_primitive"),
    ("cyclic_configuration_coverage", "mechanics.cyclic_configuration_coverage.external_primitive"),
    ("metric_stack_image", "mechanics.metric_stack_image.external_primitive"),
    ("oriented_passage", "mechanics.oriented_passage.external_primitive"),
    ("reactive_capture", "mechanics.reactive_capture.external_primitive"),
    ("station_gated_cargo", "mechanics.station_gated_cargo.external_primitive"),
    ("cadenced_rail_transfer", "mechanics.cadenced_rail_transfer.external_primitive"),
    ("fixed_program_origin", "mechanics.fixed_program_origin.external_primitive"),
    ("charted_room_navigation", "mechanics.charted_room_navigation.external_primitive"),
    ("gravity_adhesion", "mechanics.gravity_adhesion.external_primitive"),
    ("topological_region_recolor", "mechanics.topological_region_recolor.external_primitive"),
    ("visible_voxel_construction", "mechanics.visible_voxel_construction.external_primitive"),
    ("preview_piece_packing", "mechanics.preview_piece_packing.external_primitive"),
    ("station_profile_workbench", "mechanics.station_profile_workbench.external_primitive"),
    ("axial_field_configuration", "mechanics.axial_field_configuration.external_primitive"),
    ("temporal_fragment_match", "mechanics.temporal_fragment_match.external_primitive"),
    ("discrete_relay_optics", "mechanics.discrete_relay_optics.external_primitive"),
    ("visual_sequence", "mechanics.visual_sequence.external_primitive"),
    ("supported_construction", "mechanics.supported_construction.external_primitive"),
    ("finite_alignment_game", "mechanics.finite_alignment_game.external_primitive"),
    ("bounded_joystick", "mechanics.bounded_joystick.external_primitive"),
    ("neighborhood_pattern_construction", "mechanics.neighborhood_pattern_construction.external_primitive"),
    ("layered_prefix_construction", "mechanics.layered_prefix_construction.external_primitive"),
)


def measure_registered_adapter_ports(value: RegisteredAdapterInputC) -> RegisteredAdapterFactsC:
    ports = tuple((name, operation, getattr(value, name)) for name, operation in REGISTERED_ADAPTER_PORTS_C)
    present_count = sum(port is not None for _, _, port in ports)
    immutable = value.request.immutable_inputs
    owner = value.owner_binding
    owner_contract = owner.frozen_request
    owner_facts = measure_complete_owner(owner_contract).facts
    binding = (bool(value.source_binding_evidence_refs)
        and owner_contract.request == value.request and owner_contract.parent_request == value.parent_request
        and owner_contract.model_ref == value.source_model_ref
        and owner_contract.adapter_operation_ref == value.source_adapter_operation_ref
        and owner.frozen_measurement.facts == owner_facts
        and immutable.get("registered_adapter_binding_evidence_refs") == value.source_binding_evidence_refs
        and "complete_external_adapter_operation_ref" in immutable
        and immutable["complete_external_adapter_operation_ref"] == value.source_adapter_operation_ref
        and immutable.get("registered_adapter_model_ref") == value.source_model_ref
        and not value.other_adapter_case_refs
        and immutable.get("other_adapter_case_refs") == ()
        and packet_context_equal(value.parent_request, value.request, value.source_model_ref))
    delegated_owner = (owner_facts.get("delegated_licensed") is True
        and owner.source_disposition_ref == "complete_owner.delegated_pending"
        and not owner.active_inherited_phase_refs
        and owner.suppressed_inherited_phase_refs == owner_contract.inherited_phase_refs)
    inherited_owner = (owner_facts.get("inherited_licensed") is True
        and owner.source_disposition_ref == "complete_owner.inherited"
        and owner.active_inherited_phase_refs == owner_contract.inherited_phase_refs
        and not owner.suppressed_inherited_phase_refs)
    facts = {}
    for name, operation, port in ports:
        facts["exact_port_" + name] = (binding and delegated_owner and present_count == 1 and port is not None
            and value.source_adapter_operation_ref == operation and value.request.operation_ref == operation
            and value.request.mode == "STEP" and port.request == value.request
            and port.parent_request == value.parent_request
            and (not hasattr(port, "owner_binding") or port.owner_binding == owner))
    facts["exact_inherited_k03"] = (binding and inherited_owner and present_count == 0
        and value.source_adapter_operation_ref is None and bool(value.source_inherited_evidence_refs)
        and immutable.get("registered_adapter_inherited_evidence_refs") == value.source_inherited_evidence_refs)
    facts["no_exact_registered_port"] = not (facts["exact_inherited_k03"]
        or any(facts["exact_port_" + name] for name, _ in REGISTERED_ADAPTER_PORTS_C))
    return RegisteredAdapterFactsC(facts=FrozenMap(facts))


def registered_wrap_slide_input(value: RegisteredAdapterInputC) -> WrapPacketStepInputC:
    return value.wrap_slide


def registered_guarded_transport_input(value: RegisteredAdapterInputC) -> ExternalStepInputC:
    return value.guarded_transport


def registered_queued_alignment_cascade_input(value: RegisteredAdapterInputC) -> ExternalStepInputC:
    return value.queued_alignment_cascade


def registered_cyclic_configuration_coverage_input(value: RegisteredAdapterInputC) -> CycleStepInputC:
    return value.cyclic_configuration_coverage


def registered_metric_stack_image_input(value: RegisteredAdapterInputC) -> MetricStepInputC:
    return value.metric_stack_image


def registered_oriented_passage_input(value: RegisteredAdapterInputC) -> OrientedPacketStepInputC:
    return value.oriented_passage


def registered_reactive_capture_input(value: RegisteredAdapterInputC) -> CaptureStepInputC:
    return value.reactive_capture


def registered_station_gated_cargo_input(value: RegisteredAdapterInputC) -> StationPacketStepInputC:
    return value.station_gated_cargo


def registered_cadenced_rail_transfer_input(value: RegisteredAdapterInputC) -> RailStepInputC:
    return value.cadenced_rail_transfer


def registered_fixed_program_origin_input(value: RegisteredAdapterInputC) -> ProgramStepInputC:
    return value.fixed_program_origin


def registered_charted_room_navigation_input(value: RegisteredAdapterInputC) -> ChartedPacketStepInputC:
    return value.charted_room_navigation


def registered_gravity_adhesion_input(value: RegisteredAdapterInputC) -> GravityStepInputC:
    return value.gravity_adhesion


def registered_topological_region_recolor_input(value: RegisteredAdapterInputC) -> RecolorStepInputC:
    return value.topological_region_recolor


def registered_visible_voxel_construction_input(value: RegisteredAdapterInputC) -> VoxelStepInputC:
    return value.visible_voxel_construction


def registered_preview_piece_packing_input(value: RegisteredAdapterInputC) -> PackingStepInputC:
    return value.preview_piece_packing


def registered_station_profile_workbench_input(value: RegisteredAdapterInputC) -> WorkshopStepInputC:
    return value.station_profile_workbench


def registered_axial_field_configuration_input(value: RegisteredAdapterInputC) -> AxialStepInputC:
    return value.axial_field_configuration


def registered_temporal_fragment_match_input(value: RegisteredAdapterInputC) -> FragmentStepInputC:
    return value.temporal_fragment_match


def registered_discrete_relay_optics_input(value: RegisteredAdapterInputC) -> OpticalStepInputC:
    return value.discrete_relay_optics


def registered_visual_sequence_input(value: RegisteredAdapterInputC) -> SequenceStepInputC:
    return value.visual_sequence


def registered_supported_construction_input(value: RegisteredAdapterInputC) -> ConstructionStepInputC:
    return value.supported_construction


def registered_finite_alignment_game_input(value: RegisteredAdapterInputC) -> AlignmentStepInputC:
    return value.finite_alignment_game


def registered_bounded_joystick_input(value: RegisteredAdapterInputC) -> JoystickStepInputC:
    return value.bounded_joystick


def registered_neighborhood_pattern_construction_input(value: RegisteredAdapterInputC) -> NeighborhoodStepInputC:
    return value.neighborhood_pattern_construction


def registered_layered_prefix_construction_input(value: RegisteredAdapterInputC) -> PrefixStepInputC:
    return value.layered_prefix_construction


def finish_registered_adapter(value: RegisteredAdapterFinishInputC) -> RegisteredAdapterDispatchC:
    return RegisteredAdapterDispatchC(frozen_request=value.request,
        frozen_facts=value.measured, source_policy_ref=value.source_policy_ref,
        source_disposition_ref=value.source_disposition_ref, source_reason_ref=value.source_reason_ref,
        native_dispatch=value.native_dispatch)
