"""Autonomous capability entries for the family kernels owned by worktree A."""
from .adversarial_drop_alignment import AdversarialDropRequest, measure_adversarial_drop_alignment
from .chromatic_window_composition import ChromaticWindowRequest, measure_chromatic_window_composition
from .consumable_reaction_network import ConsumableReactionRequest, measure_consumable_reaction_network
from .feedback_code_identification import FeedbackCodeRequest, measure_feedback_code_identification
from .finite_relation_network import FiniteRelationRequest, measure_finite_relation_network
from .identity_contact_authentication import IdentityContactRequest, measure_identity_contact_authentication
from .finite_flow_network import FlowRequest, measure_finite_flow_network
from .shared_symbol_automata import SharedSymbolRequest, measure_shared_symbol_automata
from .push_only_logistics import PushRequest, measure_push_only_logistics
from .ordered_support_transfer import OrderedRequest, measure_ordered_support_transfer
from .autonomous_route_intervention import RouteInterventionRequest, measure_autonomous_route_intervention
from .mutable_kit_survival import MutableKitRequest, measure_mutable_kit_survival
from .hidden_motion_reception import HiddenReceptionRequest, measure_hidden_motion_reception
from .ballistic_targeting import BallisticRequest, measure_ballistic_targeting
from .typed_material_workbench import MaterialRequest, measure_typed_material_workbench
from .latent_reference_restoration import RestorationRequest, measure_latent_reference_restoration
from .lineage_production_delivery import LineageRequest, measure_lineage_production_delivery
from .temporal_reference_matching import RecallRequest, measure_temporal_reference_matching
from .recurring_quantity_control import QuantityRequest, measure_recurring_quantity_control
from .editable_actor_programs import ProgramRequest, measure_editable_actor_programs
from .visibility_capacity_navigation import CapacityRoomRequest, measure_visibility_capacity_navigation
from .oriented_cargo_handoffs import HandoffRequest, measure_oriented_cargo_handoffs
from .piercing_rooted_order import PiercingRequest, measure_piercing_rooted_order
from .typed_word_transduction import TypedWordRequest, measure_typed_word
from .local_field_type_production import LocalRequest, measure_local_field_type_production
from .articulated_channel_kinematics import ArtiRequest, measure_articulated_channel_kinematics
from .directed_accretive_flow import DirectedRequest, measure_directed_accretive_flow
from .conservative_quantity_identity import QuantityIdentityRequest, measure_quantity_identity
from .finite_instruction_device import DeviceRequest, measure_finite_instruction_device
from .inverse_anchor_signature import AnchorRequest, measure_inverse_anchor_signature
from .recipe_operator_service_a import RecipeOperatorRequest, measure_recipe_operator
from .contact_shape_repair import ShapeRequest, measure_contact_shape_repair
from .reconfigurable_support import SupportRequest, measure_reconfigurable_support
from .ordered_relief_writing import ReliefRequest, measure_ordered_relief_writing
from .symbolic_navigation_extensions_a import SymbolNavigationRequestA, measure_symbolic_navigation_extensions_a
from .station_gated_cargo import StationCargoRequest, measure_station_gated_cargo
from .patrol_body import PatrolTickRequest, advance_patrol_tick
from .wrap_slide import WrapRequest, measure_wrap_slide
from .rewritable_endpoint_transport import EndpointTransportRequest, OrientedPassageRequest, measure_endpoint_transport
from .inventory_gated_navigation import InventoryNavigationRequest, ChartedNavigationRequest, measure_inventory_navigation
from .mechanical_family_contracts_a import MechanicalFamilyResult, MechanicalSignatureFacts, project_requested_signature, reject_requested_signature
from .mechanical_return_a import MechanicalReturnBindingA, assemble_mechanical_response_a
from .mechanical_request_contracts import MechanicalResponseInput
from .mechanical_profile_registry_a import PROFILE_A_TYPES, native_profile_entries_a, native_profile_signatures_a
from .neighborhood_completion_registry_a import neighborhood_completion_entries_a,neighborhood_completion_signatures_a
from .recipe_composition_registry_a import recipe_composition_entries_a,recipe_composition_signatures_a
from .optical_route_registry_a import optical_route_entries_a,optical_route_signatures_a
from .axial_route_registry_a import axial_route_entries_a,axial_route_signatures_a
from .construction_route_registry_a import construction_route_entries_a,construction_route_signatures_a
from .joystick_source_registry_a import joystick_source_entries_a,joystick_source_signatures_a


FAMILY_A_CAPABILITY_TYPES=("SymbolNavigationRequestA", "ReliefRequest", "SupportRequest", "ShapeRequest", "DeviceRequest", "AnchorRequest", "ArtiRequest", "LocalRequest", "TypedWordRequest", "DirectedRequest", "PiercingRequest", "HandoffRequest", "AdversarialDropRequest", "ChromaticWindowRequest",
                          "ConsumableReactionRequest", "FeedbackCodeRequest", "FiniteRelationRequest", "IdentityContactRequest", "FlowRequest", "SharedSymbolRequest", "PushRequest", "OrderedRequest", "RouteInterventionRequest", "MutableKitRequest", "HiddenReceptionRequest", "BallisticRequest", "MaterialRequest", "RestorationRequest", "InventoryNavigationRequest", "ChartedNavigationRequest", "LineageRequest", "RecallRequest", "QuantityRequest", "ProgramRequest", "CapacityRoomRequest", "StationCargoRequest", "RecipeOperatorRequest", "QuantityIdentityRequest", "PatrolTickRequest", "WrapRequest", "EndpointTransportRequest", "OrientedPassageRequest", "MechanicalFamilyResult", "MechanicalSignatureFacts")
FAMILY_A_ENTRIES=(
    ("capability.symbolic_contact_navigation_calculation",measure_symbolic_navigation_extensions_a,
     SymbolNavigationRequestA,"symbolic_navigation_extensions_a.py"),
    ("capability.ordered_relief_writing_calculation",measure_ordered_relief_writing,
     ReliefRequest,"ordered_relief_writing.py"),
    ("capability.reconfigurable_support_calculation",measure_reconfigurable_support,
     SupportRequest,"reconfigurable_support.py"),
    ("capability.contact_shape_repair_calculation",measure_contact_shape_repair,
     ShapeRequest,"contact_shape_repair.py"),
    ("capability.recipe_operator_compilation_calculation",measure_recipe_operator,
     RecipeOperatorRequest,"recipe_operator_service_a.py"),
    ("capability.finite_instruction_device_calculation",measure_finite_instruction_device,
     DeviceRequest,"finite_instruction_device.py"),
    ("capability.inverse_anchor_signature_calculation",measure_inverse_anchor_signature,
     AnchorRequest,"inverse_anchor_signature.py"),
    ("capability.articulated_channel_kinematics_calculation",measure_articulated_channel_kinematics,
     ArtiRequest,"articulated_channel_kinematics.py"),
    ("capability.conservative_quantity_identity_calculation",measure_quantity_identity,
     QuantityIdentityRequest,"conservative_quantity_identity.py"),
    ("capability.local_field_type_production_calculation",measure_local_field_type_production,
     LocalRequest,"local_field_type_production.py"),
    ("capability.typed_word_transduction_calculation",measure_typed_word,
     TypedWordRequest,"typed_word_transduction.py"),
    ("capability.directed_accretive_flow_calculation",measure_directed_accretive_flow,
     DirectedRequest,"directed_accretive_flow.py"),
    ("capability.piercing_rooted_order_calculation",measure_piercing_rooted_order,
     PiercingRequest,"piercing_rooted_order.py"),
    ("capability.oriented_cargo_handoffs_calculation",measure_oriented_cargo_handoffs,
     HandoffRequest,"oriented_cargo_handoffs.py"),
    ("capability.wrap_slide_calculation",measure_wrap_slide,
     WrapRequest,"wrap_slide.py"),
    ("capability.patrol_body_calculation",advance_patrol_tick,
     PatrolTickRequest,"patrol_body.py"),
    ("capability.station_gated_cargo_calculation",measure_station_gated_cargo,
     StationCargoRequest,"station_gated_cargo.py"),
    ("capability.visibility_capacity_navigation_calculation",measure_visibility_capacity_navigation,
     CapacityRoomRequest,"visibility_capacity_navigation.py"),
    ("capability.editable_actor_programs_calculation",measure_editable_actor_programs,
     ProgramRequest,"editable_actor_programs.py"),
    ("capability.recurring_quantity_control_calculation",measure_recurring_quantity_control,
     QuantityRequest,"recurring_quantity_control.py"),
    ("capability.adversarial_drop_alignment_calculation",measure_adversarial_drop_alignment,
     AdversarialDropRequest,"adversarial_drop_alignment.py"),
    ("capability.chromatic_window_composition_calculation",measure_chromatic_window_composition,
     ChromaticWindowRequest,"chromatic_window_composition.py"),
    ("capability.consumable_reaction_network_calculation",measure_consumable_reaction_network,
     ConsumableReactionRequest,"consumable_reaction_network.py"),
    ("capability.feedback_code_identification_calculation",measure_feedback_code_identification,
     FeedbackCodeRequest,"feedback_code_identification.py"),
    ("capability.finite_relation_network_calculation",measure_finite_relation_network,
     FiniteRelationRequest,"finite_relation_network.py"),
    ("capability.identity_contact_authentication_calculation",measure_identity_contact_authentication,
     IdentityContactRequest,"identity_contact_authentication.py"),
    ("capability.finite_flow_network_calculation",measure_finite_flow_network,
     FlowRequest,"finite_flow_network.py"),
    ("capability.shared_symbol_automata_calculation",measure_shared_symbol_automata,
     SharedSymbolRequest,"shared_symbol_automata.py"),
    ("capability.push_only_logistics_calculation",measure_push_only_logistics,
     PushRequest,"push_only_logistics.py"),
    ("capability.ordered_support_transfer_calculation",measure_ordered_support_transfer,
     OrderedRequest,"ordered_support_transfer.py"),
    ("capability.autonomous_route_intervention_calculation",measure_autonomous_route_intervention,
     RouteInterventionRequest,"autonomous_route_intervention.py"),
    ("capability.mutable_kit_survival_calculation",measure_mutable_kit_survival,
     MutableKitRequest,"mutable_kit_survival.py"),
    ("capability.hidden_motion_reception_calculation",measure_hidden_motion_reception,
     HiddenReceptionRequest,"hidden_motion_reception.py"),
    ("capability.ballistic_targeting_calculation",measure_ballistic_targeting,
     BallisticRequest,"ballistic_targeting.py"),
    ("capability.typed_material_workbench_calculation",measure_typed_material_workbench,
     MaterialRequest,"typed_material_workbench.py"),
    ("capability.latent_reference_restoration_calculation",measure_latent_reference_restoration,
     RestorationRequest,"latent_reference_restoration.py"),
    ("capability.inventory_gated_navigation_calculation",measure_inventory_navigation,
     InventoryNavigationRequest,"inventory_gated_navigation.py"),
    ("capability.charted_room_navigation_calculation",measure_inventory_navigation,
     ChartedNavigationRequest,"inventory_gated_navigation.py"),
    ("capability.lineage_production_delivery_calculation",measure_lineage_production_delivery,
     LineageRequest,"lineage_production_delivery.py"),
    ("capability.temporal_reference_matching_calculation",measure_temporal_reference_matching,
     RecallRequest,"temporal_reference_matching.py"),
    ("capability.rewritable_endpoint_transport_calculation",measure_endpoint_transport,
     EndpointTransportRequest,"rewritable_endpoint_transport.py"),
    ("capability.oriented_passage_calculation",measure_endpoint_transport,
     OrientedPassageRequest,"rewritable_endpoint_transport.py"),
)


def mechanical_family_entries_a(entry_factory):
    calculations=tuple(entry_factory(capability_id=ref,implementation=implementation,input_model=input_model,
        output_model=MechanicalFamilyResult,source_file=source_file,
        applicability=("caller_bound_finite_model","declared_operation_mode_and_bounds"),
        invariants=("no_action_release","immutable_successors","exact_request_identity",
                    "no_goal_or_strategy_selection","explicit_incomplete_domain"),
        falsifiers=("signature_mismatch","missing_model_prerequisite","finite_work_bound"))
        for ref,implementation,input_model,source_file in FAMILY_A_ENTRIES)
    signatures=tuple(entry_factory(capability_id=ref.replace("_calculation","_signature_projection"),
        implementation=project_requested_signature,input_model=input_model,output_model=MechanicalSignatureFacts,
        source_file="mechanical_family_contracts_a.py",applicability=("supplied_signature_fields",),
        invariants=("no_operation_selection","copy_supplied_fields_only"),falsifiers=("inferred_mode",))
        for ref,_,input_model,_ in FAMILY_A_ENTRIES)
    rejections=tuple(entry_factory(capability_id=ref.replace("_calculation","_signature_rejection"),
        implementation=reject_requested_signature,input_model=input_model,output_model=MechanicalFamilyResult,
        source_file="mechanical_family_contracts_a.py",applicability=("src_selected_unmatched_signature",),
        invariants=("no_world_calculation","preserve_request_identity"),falsifiers=("empty_world_claim",))
        for ref,_,input_model,_ in FAMILY_A_ENTRIES)
    return_packets=tuple(entry_factory(capability_id=ref.replace("_calculation","_return_packet"),
        implementation=assemble_mechanical_response_a,input_model=MechanicalReturnBindingA,
        output_model=MechanicalResponseInput,source_file="mechanical_return_a.py",
        applicability=("src_selected_status_and_cause","immutable_native_receipt"),
        invariants=("separate_original_and_returned_identity","no_world_exhaustion_inference",
                    "retain_native_values_and_frontier","no_action_release"),
        falsifiers=("fabricated_no_path_or_optimality","lost_caller_or_sibling_scope"))
        for ref,_,_,_ in FAMILY_A_ENTRIES)
    return calculations+signatures+rejections+return_packets+native_profile_entries_a(entry_factory)+neighborhood_completion_entries_a(entry_factory)+recipe_composition_entries_a(entry_factory)+optical_route_entries_a(entry_factory)+axial_route_entries_a(entry_factory)+construction_route_entries_a(entry_factory)+joystick_source_entries_a(entry_factory)


def mechanical_family_signatures_a(type_spec, parameter_spec):
    signatures={operation_ref:((parameter_spec(name="request",type_spec=type_spec(input_model.__name__)),),output)
        for ref,_,input_model,_ in FAMILY_A_ENTRIES
        for operation_ref,output in ((ref,"MechanicalFamilyResult"),
            (ref.replace("_calculation","_signature_projection"),"MechanicalSignatureFacts"),
            (ref.replace("_calculation","_signature_rejection"),"MechanicalFamilyResult"))}
    for ref,_,input_model,_ in FAMILY_A_ENTRIES:
        signatures[ref.replace("_calculation","_return_packet")]=(tuple(parameter_spec(name=name,type_spec=type_spec(kind))
            for name,kind in (("request",input_model.__name__),("measurement","MechanicalFamilyResult"),
                              ("kernel_ref","String"),("source_status","String"),("missing_cause","String"),
                              ("question_ref","String"))),"MechanicalResponseInput")
    return {**signatures,**native_profile_signatures_a(type_spec,parameter_spec),**neighborhood_completion_signatures_a(type_spec,parameter_spec),**recipe_composition_signatures_a(type_spec,parameter_spec),**optical_route_signatures_a(type_spec,parameter_spec),**axial_route_signatures_a(type_spec,parameter_spec),**construction_route_signatures_a(type_spec,parameter_spec),**joystick_source_signatures_a(type_spec,parameter_spec)}
