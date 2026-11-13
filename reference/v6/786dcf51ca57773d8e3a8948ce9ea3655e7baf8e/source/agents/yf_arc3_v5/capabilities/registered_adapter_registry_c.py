"""Finite Source adapter ports; calculations remain in their owning workflows."""
from .registered_adapter_contracts_c import (RegisteredAdapterInputC, RegisteredAdapterFactsC, RegisteredAdapterFinishInputC, RegisteredAdapterDispatchC)
from .registered_adapter_c import (measure_registered_adapter_ports, finish_registered_adapter,
    registered_wrap_slide_input, registered_guarded_transport_input, registered_queued_alignment_cascade_input, registered_cyclic_configuration_coverage_input, registered_metric_stack_image_input, registered_oriented_passage_input, registered_reactive_capture_input, registered_station_gated_cargo_input, registered_cadenced_rail_transfer_input, registered_fixed_program_origin_input, registered_charted_room_navigation_input, registered_gravity_adhesion_input, registered_topological_region_recolor_input, registered_visible_voxel_construction_input, registered_preview_piece_packing_input, registered_station_profile_workbench_input, registered_axial_field_configuration_input, registered_temporal_fragment_match_input, registered_discrete_relay_optics_input, registered_visual_sequence_input, registered_supported_construction_input, registered_finite_alignment_game_input, registered_bounded_joystick_input, registered_neighborhood_pattern_construction_input, registered_layered_prefix_construction_input)
from .registered_adapter_contracts_c import (WrapPacketStepInputC, APacketStepDispatchC, ExternalStepInputC, ExternalStepDispatchResultC, CycleStepInputC, CycleStepDispatchC, MetricStepInputC, MetricStepDispatchC, OrientedPacketStepInputC, CaptureStepInputC, CaptureStepDispatchC, StationPacketStepInputC, RailStepInputC, RailStepDispatchC, ProgramStepInputC, ProgramStepDispatchC, ChartedPacketStepInputC, GravityStepInputC, GravityStepDispatchC, RecolorStepInputC, RecolorStepDispatchC, VoxelStepInputC, VoxelStepDispatchC, PackingStepInputC, PackingStepDispatchC, WorkshopStepInputC, WorkshopStepDispatchC, AxialStepInputC, AxialStepDispatchC, FragmentStepInputC, FragmentStepDispatchC, OpticalStepInputC, OpticalStepDispatchC, SequenceStepInputC, SequenceStepDispatchC, ConstructionStepInputC, ConstructionStepDispatchC, AlignmentStepInputC, AlignmentStepDispatchC, JoystickStepInputC, JoystickStepDispatchC, NeighborhoodStepInputC, NeighborhoodStepDispatchC, PrefixStepInputC, PrefixStepDispatchC)

REGISTERED_ADAPTER_C_TYPES = ["RegisteredAdapterInputC","RegisteredAdapterFactsC","RegisteredAdapterFinishInputC","RegisteredAdapterDispatchC"]
REGISTERED_ADAPTER_C_ENTRIES = (
    ("capability.registered_adapter_signature_c", measure_registered_adapter_ports, RegisteredAdapterInputC, RegisteredAdapterFactsC),
    ("capability.registered_wrap_slide_input_c", registered_wrap_slide_input, RegisteredAdapterInputC, WrapPacketStepInputC),
    ("capability.registered_wrap_slide_return_c", finish_registered_adapter, RegisteredAdapterFinishInputC, RegisteredAdapterDispatchC),
    ("capability.registered_guarded_transport_input_c", registered_guarded_transport_input, RegisteredAdapterInputC, ExternalStepInputC),
    ("capability.registered_guarded_transport_return_c", finish_registered_adapter, RegisteredAdapterFinishInputC, RegisteredAdapterDispatchC),
    ("capability.registered_queued_alignment_cascade_input_c", registered_queued_alignment_cascade_input, RegisteredAdapterInputC, ExternalStepInputC),
    ("capability.registered_queued_alignment_cascade_return_c", finish_registered_adapter, RegisteredAdapterFinishInputC, RegisteredAdapterDispatchC),
    ("capability.registered_cyclic_configuration_coverage_input_c", registered_cyclic_configuration_coverage_input, RegisteredAdapterInputC, CycleStepInputC),
    ("capability.registered_cyclic_configuration_coverage_return_c", finish_registered_adapter, RegisteredAdapterFinishInputC, RegisteredAdapterDispatchC),
    ("capability.registered_metric_stack_image_input_c", registered_metric_stack_image_input, RegisteredAdapterInputC, MetricStepInputC),
    ("capability.registered_metric_stack_image_return_c", finish_registered_adapter, RegisteredAdapterFinishInputC, RegisteredAdapterDispatchC),
    ("capability.registered_oriented_passage_input_c", registered_oriented_passage_input, RegisteredAdapterInputC, OrientedPacketStepInputC),
    ("capability.registered_oriented_passage_return_c", finish_registered_adapter, RegisteredAdapterFinishInputC, RegisteredAdapterDispatchC),
    ("capability.registered_reactive_capture_input_c", registered_reactive_capture_input, RegisteredAdapterInputC, CaptureStepInputC),
    ("capability.registered_reactive_capture_return_c", finish_registered_adapter, RegisteredAdapterFinishInputC, RegisteredAdapterDispatchC),
    ("capability.registered_station_gated_cargo_input_c", registered_station_gated_cargo_input, RegisteredAdapterInputC, StationPacketStepInputC),
    ("capability.registered_station_gated_cargo_return_c", finish_registered_adapter, RegisteredAdapterFinishInputC, RegisteredAdapterDispatchC),
    ("capability.registered_cadenced_rail_transfer_input_c", registered_cadenced_rail_transfer_input, RegisteredAdapterInputC, RailStepInputC),
    ("capability.registered_cadenced_rail_transfer_return_c", finish_registered_adapter, RegisteredAdapterFinishInputC, RegisteredAdapterDispatchC),
    ("capability.registered_fixed_program_origin_input_c", registered_fixed_program_origin_input, RegisteredAdapterInputC, ProgramStepInputC),
    ("capability.registered_fixed_program_origin_return_c", finish_registered_adapter, RegisteredAdapterFinishInputC, RegisteredAdapterDispatchC),
    ("capability.registered_charted_room_navigation_input_c", registered_charted_room_navigation_input, RegisteredAdapterInputC, ChartedPacketStepInputC),
    ("capability.registered_charted_room_navigation_return_c", finish_registered_adapter, RegisteredAdapterFinishInputC, RegisteredAdapterDispatchC),
    ("capability.registered_gravity_adhesion_input_c", registered_gravity_adhesion_input, RegisteredAdapterInputC, GravityStepInputC),
    ("capability.registered_gravity_adhesion_return_c", finish_registered_adapter, RegisteredAdapterFinishInputC, RegisteredAdapterDispatchC),
    ("capability.registered_topological_region_recolor_input_c", registered_topological_region_recolor_input, RegisteredAdapterInputC, RecolorStepInputC),
    ("capability.registered_topological_region_recolor_return_c", finish_registered_adapter, RegisteredAdapterFinishInputC, RegisteredAdapterDispatchC),
    ("capability.registered_visible_voxel_construction_input_c", registered_visible_voxel_construction_input, RegisteredAdapterInputC, VoxelStepInputC),
    ("capability.registered_visible_voxel_construction_return_c", finish_registered_adapter, RegisteredAdapterFinishInputC, RegisteredAdapterDispatchC),
    ("capability.registered_preview_piece_packing_input_c", registered_preview_piece_packing_input, RegisteredAdapterInputC, PackingStepInputC),
    ("capability.registered_preview_piece_packing_return_c", finish_registered_adapter, RegisteredAdapterFinishInputC, RegisteredAdapterDispatchC),
    ("capability.registered_station_profile_workbench_input_c", registered_station_profile_workbench_input, RegisteredAdapterInputC, WorkshopStepInputC),
    ("capability.registered_station_profile_workbench_return_c", finish_registered_adapter, RegisteredAdapterFinishInputC, RegisteredAdapterDispatchC),
    ("capability.registered_axial_field_configuration_input_c", registered_axial_field_configuration_input, RegisteredAdapterInputC, AxialStepInputC),
    ("capability.registered_axial_field_configuration_return_c", finish_registered_adapter, RegisteredAdapterFinishInputC, RegisteredAdapterDispatchC),
    ("capability.registered_temporal_fragment_match_input_c", registered_temporal_fragment_match_input, RegisteredAdapterInputC, FragmentStepInputC),
    ("capability.registered_temporal_fragment_match_return_c", finish_registered_adapter, RegisteredAdapterFinishInputC, RegisteredAdapterDispatchC),
    ("capability.registered_discrete_relay_optics_input_c", registered_discrete_relay_optics_input, RegisteredAdapterInputC, OpticalStepInputC),
    ("capability.registered_discrete_relay_optics_return_c", finish_registered_adapter, RegisteredAdapterFinishInputC, RegisteredAdapterDispatchC),
    ("capability.registered_visual_sequence_input_c", registered_visual_sequence_input, RegisteredAdapterInputC, SequenceStepInputC),
    ("capability.registered_visual_sequence_return_c", finish_registered_adapter, RegisteredAdapterFinishInputC, RegisteredAdapterDispatchC),
    ("capability.registered_supported_construction_input_c", registered_supported_construction_input, RegisteredAdapterInputC, ConstructionStepInputC),
    ("capability.registered_supported_construction_return_c", finish_registered_adapter, RegisteredAdapterFinishInputC, RegisteredAdapterDispatchC),
    ("capability.registered_finite_alignment_input_c", registered_finite_alignment_game_input, RegisteredAdapterInputC, AlignmentStepInputC),
    ("capability.registered_finite_alignment_return_c", finish_registered_adapter, RegisteredAdapterFinishInputC, RegisteredAdapterDispatchC),
    ("capability.registered_bounded_joystick_input_c", registered_bounded_joystick_input, RegisteredAdapterInputC, JoystickStepInputC),
    ("capability.registered_bounded_joystick_return_c", finish_registered_adapter, RegisteredAdapterFinishInputC, RegisteredAdapterDispatchC),
    ("capability.registered_neighborhood_pattern_construction_input_c", registered_neighborhood_pattern_construction_input, RegisteredAdapterInputC, NeighborhoodStepInputC),
    ("capability.registered_neighborhood_pattern_construction_return_c", finish_registered_adapter, RegisteredAdapterFinishInputC, RegisteredAdapterDispatchC),
    ("capability.registered_layered_prefix_construction_input_c", registered_layered_prefix_construction_input, RegisteredAdapterInputC, PrefixStepInputC),
    ("capability.registered_layered_prefix_construction_return_c", finish_registered_adapter, RegisteredAdapterFinishInputC, RegisteredAdapterDispatchC),
    ("capability.registered_adapter_empty_return_c", finish_registered_adapter, RegisteredAdapterFinishInputC, RegisteredAdapterDispatchC))


def registered_adapter_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file="registered_adapter_c.py", applicability=("source_declared_single_external_adapter",),
        invariants=("one_typed_workflow", "no_native_abi_conversion", "no_second_physics_or_debit", "pending_phases_and_scoped_return_retained"),
        falsifiers=("multiple_ports", "scope_or_operation_mismatch", "missing_bound_inherited_contract"))
        for ref, method, inputs, outputs in REGISTERED_ADAPTER_C_ENTRIES)


def registered_adapter_signatures_c(type_spec, parameter_spec):
    def parameter(name, model, optional=False):
        return parameter_spec(name=name, type_spec=type_spec(model, optional=optional))
    signatures = {ref: ((parameter("request", inputs.__name__),), outputs.__name__)
        for ref, _, inputs, outputs in REGISTERED_ADAPTER_C_ENTRIES}
    prefix = (parameter("request", "RegisteredAdapterInputC"), parameter("measured", "RegisteredAdapterFactsC"),
        parameter("source_policy_ref", "String"), parameter("source_disposition_ref", "String"), parameter("source_reason_ref", "String"))
    signatures["capability.registered_wrap_slide_return_c"] = (prefix + (parameter("native_dispatch", "APacketStepDispatchC"),), "RegisteredAdapterDispatchC")
    signatures["capability.registered_guarded_transport_return_c"] = (prefix + (parameter("native_dispatch", "ExternalStepDispatchResultC"),), "RegisteredAdapterDispatchC")
    signatures["capability.registered_queued_alignment_cascade_return_c"] = (prefix + (parameter("native_dispatch", "ExternalStepDispatchResultC"),), "RegisteredAdapterDispatchC")
    signatures["capability.registered_cyclic_configuration_coverage_return_c"] = (prefix + (parameter("native_dispatch", "CycleStepDispatchC"),), "RegisteredAdapterDispatchC")
    signatures["capability.registered_metric_stack_image_return_c"] = (prefix + (parameter("native_dispatch", "MetricStepDispatchC"),), "RegisteredAdapterDispatchC")
    signatures["capability.registered_oriented_passage_return_c"] = (prefix + (parameter("native_dispatch", "APacketStepDispatchC"),), "RegisteredAdapterDispatchC")
    signatures["capability.registered_reactive_capture_return_c"] = (prefix + (parameter("native_dispatch", "CaptureStepDispatchC"),), "RegisteredAdapterDispatchC")
    signatures["capability.registered_station_gated_cargo_return_c"] = (prefix + (parameter("native_dispatch", "APacketStepDispatchC"),), "RegisteredAdapterDispatchC")
    signatures["capability.registered_cadenced_rail_transfer_return_c"] = (prefix + (parameter("native_dispatch", "RailStepDispatchC"),), "RegisteredAdapterDispatchC")
    signatures["capability.registered_fixed_program_origin_return_c"] = (prefix + (parameter("native_dispatch", "ProgramStepDispatchC"),), "RegisteredAdapterDispatchC")
    signatures["capability.registered_charted_room_navigation_return_c"] = (prefix + (parameter("native_dispatch", "APacketStepDispatchC"),), "RegisteredAdapterDispatchC")
    signatures["capability.registered_gravity_adhesion_return_c"] = (prefix + (parameter("native_dispatch", "GravityStepDispatchC"),), "RegisteredAdapterDispatchC")
    signatures["capability.registered_topological_region_recolor_return_c"] = (prefix + (parameter("native_dispatch", "RecolorStepDispatchC"),), "RegisteredAdapterDispatchC")
    signatures["capability.registered_visible_voxel_construction_return_c"] = (prefix + (parameter("native_dispatch", "VoxelStepDispatchC"),), "RegisteredAdapterDispatchC")
    signatures["capability.registered_preview_piece_packing_return_c"] = (prefix + (parameter("native_dispatch", "PackingStepDispatchC"),), "RegisteredAdapterDispatchC")
    signatures["capability.registered_station_profile_workbench_return_c"] = (prefix + (parameter("native_dispatch", "WorkshopStepDispatchC"),), "RegisteredAdapterDispatchC")
    signatures["capability.registered_axial_field_configuration_return_c"] = (prefix + (parameter("native_dispatch", "AxialStepDispatchC"),), "RegisteredAdapterDispatchC")
    signatures["capability.registered_temporal_fragment_match_return_c"] = (prefix + (parameter("native_dispatch", "FragmentStepDispatchC"),), "RegisteredAdapterDispatchC")
    signatures["capability.registered_discrete_relay_optics_return_c"] = (prefix + (parameter("native_dispatch", "OpticalStepDispatchC"),), "RegisteredAdapterDispatchC")
    signatures["capability.registered_visual_sequence_return_c"] = (prefix + (parameter("native_dispatch", "SequenceStepDispatchC"),), "RegisteredAdapterDispatchC")
    signatures["capability.registered_supported_construction_return_c"] = (prefix + (parameter("native_dispatch", "ConstructionStepDispatchC"),), "RegisteredAdapterDispatchC")
    signatures["capability.registered_finite_alignment_return_c"] = (prefix + (parameter("native_dispatch", "AlignmentStepDispatchC"),), "RegisteredAdapterDispatchC")
    signatures["capability.registered_bounded_joystick_return_c"] = (prefix + (parameter("native_dispatch", "JoystickStepDispatchC"),), "RegisteredAdapterDispatchC")
    signatures["capability.registered_neighborhood_pattern_construction_return_c"] = (prefix + (parameter("native_dispatch", "NeighborhoodStepDispatchC"),), "RegisteredAdapterDispatchC")
    signatures["capability.registered_layered_prefix_construction_return_c"] = (prefix + (parameter("native_dispatch", "PrefixStepDispatchC"),), "RegisteredAdapterDispatchC")
    signatures["capability.registered_adapter_empty_return_c"] = (prefix + (parameter("native_dispatch", "String", True),), "RegisteredAdapterDispatchC")
    return signatures
