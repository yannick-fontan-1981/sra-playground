"""Autonomous D entries; central registry consolidation belongs to Grok."""

from .cyclic_configuration_coverage import CyclicCoverageRequest, measure_cyclic_configuration_coverage
from .fixed_program_origin import FixedProgramRequest, measure_fixed_program_origin
from .bounded_joystick import BoundedJoystickRequest, measure_bounded_joystick
from .temporal_fragment_match import TemporalFragmentRequest, measure_temporal_fragment_match
from .visual_sequence import VisualSequenceRequest, measure_visual_sequence
from .topological_region_recolor import TopologicalRecolorRequest, measure_topological_region_recolor
from .coupled_member_control import CoupledMemberRequest, measure_coupled_member_control
from .reactive_capture import ReactiveCaptureRequest, measure_reactive_capture
from .neighborhood_pattern_construction import NeighborhoodPatternRequest, measure_neighborhood_pattern_construction
from .layered_prefix_construction import LayeredPrefixRequest, measure_layered_prefix_construction
from .preview_piece_packing import PreviewPackingRequest, measure_preview_piece_packing
from .station_profile_workbench import StationWorkbenchRequest, measure_station_profile_workbench
from .axial_field_configuration import AxialFieldRequest, measure_axial_field_configuration
from .supported_construction import SupportedConstructionRequest, measure_supported_construction
from .finite_alignment_game import FiniteAlignmentRequest, measure_finite_alignment_game
from .visible_voxel_construction import VisibleVoxelRequest, measure_visible_voxel_construction
from .discrete_relay_optics import DiscreteOpticsRequest, measure_discrete_relay_optics
from .cadenced_rail_transfer import CadencedRailRequest, measure_cadenced_rail_transfer
from .endpoint_navigation_d import EndpointLandingRequestD, measure_endpoint_landing_d
from .single_visit_residual_d import SingleVisitResidualRequestD, measure_single_visit_residual_d
from .ordered_path_primitive_d import OrderedPathPrimitiveRequestD, measure_ordered_path_primitive_d
from .finite_alignment_evidence_scope_d import FiniteAlignmentEvidenceRequestD, measure_finite_alignment_evidence_scope_d
from .remaining_scope_metric_audit_d import GuaranteeProbabilityRequestD, measure_guarantee_probability_d
from .remaining_scope_metric_audit_d import ExtensionScopeRequestD, measure_extension_scope_d
from .remaining_scope_metric_audit_d import MetricWhyRequestD, measure_metric_why_d
from .remaining_scope_metric_audit_d import MetricGoalRequestD, measure_metric_goal_d
from .remaining_d_solving_d import VisualSequenceEvidenceRequestD, measure_visual_sequence_evidence_d
from .remaining_d_solving_d import StationProfileEvidenceRequestD, measure_station_profile_evidence_d
from .remaining_d_solving_d import TopologicalRecolorEvidenceRequestD, measure_topological_recolor_evidence_d
from .remaining_d_solving_d import ReactiveCaptureEvidenceRequestD, measure_reactive_capture_evidence_d
from .remaining_d_solving_d import NeighborhoodConstructionWhyRequestD, measure_neighborhood_construction_why_d
from .remaining_d_solving_d import FiniteAlignmentWhyRequestD, measure_finite_alignment_why_d
from .remaining_d_solving_d import SupportedConstructionWhyRequestD, measure_supported_construction_why_d
from .remaining_d_solving_d import SequencePredictionWhyRequestD, measure_sequence_prediction_why_d
from .remaining_d_solving_d import TemporalFragmentWhyRequestD, measure_temporal_fragment_why_d
from .remaining_d_solving_d import StationProfileWhyRequestD, measure_station_profile_why_d
from .remaining_d_solving_d import PreviewPackingWhyRequestD, measure_preview_packing_why_d
from .remaining_d_solving_d import VoxelConstructionWhyRequestD, measure_voxel_construction_why_d
from .remaining_d_solving_d import TopologicalSurfaceWhyRequestD, measure_topological_surface_why_d
from .remaining_d_solving_d import AdhesionWhyRequestD, measure_adhesion_why_d
from .remaining_d_solving_d import AdhesionGoalRequestD, measure_adhesion_goal_d
from .remaining_d_solving_d import FixedOriginWhyRequestD, measure_fixed_origin_why_d
from .remaining_d_solving_d import RailTransferWhyRequestD, measure_rail_transfer_why_d
from .remaining_d_solving_d import ReactiveCaptureWhyRequestD, measure_reactive_capture_why_d
from .remaining_d_solving_d import CyclicResidualWhyRequestD, measure_cyclic_residual_why_d
from .remaining_d_solving_d import WrapJointCallScopeD, measure_wrap_joint_call_d
from .remaining_d_solving_d import WrapJointRequestScopeD, measure_wrap_joint_request_d
from .remaining_native_solving_d import ChartedPermissionWhyRequestD, measure_charted_permission_why_d
from .remaining_native_solving_d import ChartedRouteGoalRequestD, measure_charted_route_goal_d
from .remaining_native_solving_d import StationCargoWhyRequestD, measure_station_cargo_why_d
from .remaining_native_solving_d import StationCargoGoalRequestD, measure_station_cargo_goal_d
from .remaining_native_solving_d import PassageEntryWhyRequestD, measure_passage_entry_why_d
from .remaining_native_solving_d import PassageGoalRequestD, measure_passage_goal_d
from .remaining_native_solving_d import PatrolCallScopeD, measure_patrol_call_d
from .remaining_native_solving_d import PatrolRequestScopeD, measure_patrol_request_d
from .remaining_native_solving_d import WrapSeatingWhyRequestD, measure_wrap_seating_why_d
from .remaining_native_solving_d import WrapSeatingGoalRequestD, measure_wrap_seating_goal_d
from .remaining_native_solving_d import FlowProfileRevalidationRequestD, measure_flow_profile_revalidation_d
from .remaining_native_solving_d import FlowOrderAlternativesRequestD, measure_flow_order_alternatives_d
from .remaining_native_solving_d import FlowNetworkGoalRequestD, measure_flow_network_goal_d
from .remaining_native_solving_d import RefillContinuationRequestD, measure_refill_continuation_d
from .remaining_native_solving_d import RememberedDarkExplorationRequestD, measure_remembered_dark_exploration_d
from .remaining_native_solving_d import VisibilityCapacityReleaseRequestD, measure_visibility_capacity_release_d
from .remaining_native_solving_d import VisibilityServiceWhyRequestD, measure_visibility_service_why_d
from .remaining_native_solving_d import VisibilityNavigationGoalRequestD, measure_visibility_navigation_goal_d
from .remaining_native_solving_d import ActorResultPreimagesRequestD, measure_actor_result_preimages_d
from .remaining_native_solving_d import ActorProgramGoalRequestD, measure_actor_program_goal_d
from .remaining_native_solving_d import PushAssignmentRequestD, measure_push_assignment_d
from .remaining_native_solving_d import PushGoalRequestD, measure_push_goal_d
from .remaining_native_solving_d import AuthenticationModeAccessRequestD, measure_authentication_mode_access_d
from .remaining_native_solving_d import AuthenticationCalibrationRequestD, measure_authentication_calibration_d
from .remaining_native_solving_d import SharedAutomataGoalRequestD, measure_shared_automata_goal_d
from .native_solving_contributions_d import QuantityHorizonGoalRequestD, measure_quantity_horizon_goal_d
from .native_solving_contributions_d import EndpointTransportGoalRequestD, measure_endpoint_transport_goal_d
from .native_solving_contributions_d import TemporalMatchGoalRequestD, measure_temporal_match_goal_d
from .native_solving_contributions_d import InventoryNavigationGoalRequestD, measure_inventory_navigation_goal_d
from .native_solving_contributions_d import OrderedTransferGoalRequestD, measure_ordered_transfer_goal_d
from .native_solving_contributions_d import BallisticContactGoalRequestD, measure_ballistic_contact_goal_d
from .native_solving_contributions_d import HiddenReceptionGoalRequestD, measure_hidden_reception_goal_d
from .native_solving_contributions_d import FiniteSurvivalGoalRequestD, measure_finite_survival_goal_d
from .native_solving_contributions_d import AutonomousArrivalGoalRequestD, measure_autonomous_arrival_goal_d
from .native_solving_contributions_d import ReferenceRestoreDamageRequestD, measure_reference_restore_damage_d
from .native_solving_contributions_d import ReferenceGoalRequestD, measure_reference_goal_d
from .native_solving_contributions_d import MaterialDeliveryOrderRequestD, measure_material_delivery_order_d
from .native_solving_contributions_d import MaterialRecycleRequestD, measure_material_recycle_d
from .native_solving_contributions_d import MaterialWhyRequestD, measure_material_why_d
from .native_solving_contributions_d import MaterialGoalRequestD, measure_material_goal_d
from .native_solving_contributions_d import DropPolicyPrefixRequestD, measure_drop_policy_prefix_d
from .native_solving_contributions_d import DropWinFirstRequestD, measure_drop_win_first_d
from .native_solving_contributions_d import PiercingStockRequestD, measure_piercing_stock_d
from .native_solving_contributions_d import PiercingGoalRequestD, measure_piercing_goal_d
from .native_solving_contributions_d import CargoParallelRequestD, measure_cargo_parallel_d
from .native_solving_contributions_d import CargoGoalRequestD, measure_cargo_goal_d
from .native_solving_contributions_d import LocalFieldClockRequestD, measure_local_field_clock_d
from .native_solving_contributions_d import LocalFieldInterferenceRequestD, measure_local_field_interference_d
from .native_solving_contributions_d import LocalFieldWindowRequestD, measure_local_field_window_d
from .native_solving_contributions_d import LocalFieldWhyRequestD, measure_local_field_why_d
from .native_solving_contributions_d import LocalFieldGoalRequestD, measure_local_field_goal_d
from .flow_goal_audit_d import FlowRiskRequestD, measure_flow_goal_audit_d
from .flow_goal_audit_d import FlowTimingRequestD, measure_flow_goal_audit_d
from .flow_goal_audit_d import FlowTraceRequestD, measure_flow_goal_audit_d
from .flow_goal_audit_d import FlowCascadeRequestD, measure_flow_goal_audit_d
from .flow_goal_audit_d import FlowColliderRequestD, measure_flow_goal_audit_d
from .flow_goal_audit_d import FlowWhyRequestD, measure_flow_goal_audit_d
from .flow_goal_audit_d import FlowGoalRequestD, measure_flow_goal_audit_d
from .symbol_coupling_support_audit_d import SupportRecoveryRequestD, measure_reconfigurable_support_audit_d
from .symbol_coupling_support_audit_d import SupportCodeRequestD, measure_reconfigurable_support_audit_d
from .symbol_coupling_support_audit_d import SupportGripRequestD, measure_reconfigurable_support_audit_d
from .symbol_coupling_support_audit_d import SupportPivotRequestD, measure_reconfigurable_support_audit_d
from .symbol_coupling_support_audit_d import HelperPauseScopeRequestD, measure_coupled_support_audit_d
from .symbol_coupling_support_audit_d import KeeperTravellerRequestD, measure_coupled_support_audit_d
from .symbol_coupling_support_audit_d import MemberMapsNotSidesRequestD, measure_coupled_support_audit_d
from .symbol_coupling_support_audit_d import UnseenProviderFrontierRequestD, measure_symbol_route_audit_d
from .symbol_coupling_support_audit_d import ConsumerSpecificSignatureRequestD, measure_symbol_route_audit_d
from .symbol_coupling_support_audit_d import JointSymbolOrderRequestD, measure_symbol_route_audit_d
from .symbol_coupling_support_audit_d import VisibilityResourceContractRequestD, measure_symbol_route_audit_d
from .symbol_coupling_support_audit_d import StationRendezvousRequestD, measure_symbol_route_audit_d
from .symbol_coupling_support_audit_d import LatchedTargetSequenceRequestD, measure_symbol_route_audit_d
from .program_recipe_goal_audit_d import RecipeOperatorGoalRequestD, measure_recipe_operator_goal_d
from .program_recipe_goal_audit_d import FiniteInstructionDifferenceRequestD, measure_program_goal_audit_d
from .program_recipe_goal_audit_d import FiniteInstructionPhaseRequestD, measure_program_goal_audit_d
from .program_recipe_goal_audit_d import FiniteInstructionGoalRequestD, measure_program_goal_audit_d
from .temporal_service_audit_d import GuardedRecordingCallRequestD, measure_temporal_service_audit_d
from .temporal_service_audit_d import TemporalProviderSelectionRequestD, measure_temporal_service_audit_d
from .temporal_service_audit_d import BoundedCommandClockRequestD, measure_temporal_service_audit_d
from .temporal_service_audit_d import RecordingObligationRequestD, measure_temporal_service_audit_d
from .temporal_service_audit_d import TemporalRecordingKernelRequestD, measure_temporal_recording_kernel_d
from .temporal_service_audit_d import TemporalRecordingJoinInputD,TemporalBoundRecordingInputD,temporal_recording_bound_request,temporal_recording_join_d
from .typed_transport_reduction_audit_d import ContinuedSolvabilityRequestD, measure_typed_reduction_audit_d
from .typed_transport_reduction_audit_d import PersistentHelperClearanceRequestD, measure_typed_reduction_audit_d
from .typed_transport_reduction_audit_d import SelectedJumpReconfigurationRequestD, measure_typed_reduction_audit_d
from .typed_transport_reduction_audit_d import OrderedReductionTypesRequestD, measure_typed_reduction_audit_d
from .typed_transport_reduction_audit_d import VariableTransportStopRequestD, measure_force_transport_audit_d
from .typed_transport_reduction_audit_d import ForceVsMotionDomainRequestD, measure_force_transport_audit_d
from .geometry_obligation_audit_d import OrientedIdentityRequestD, measure_geometry_obligation_audit_d
from .geometry_obligation_audit_d import JointNotAttachedRequestD, measure_geometry_obligation_audit_d
from .geometry_obligation_audit_d import EditableLocalTopologyRequestD, measure_geometry_obligation_audit_d
from .geometry_obligation_audit_d import MarkerBodyExclusionRequestD, measure_geometry_obligation_audit_d
from .geometry_obligation_audit_d import MarkerVectorsDegreeRequestD, measure_geometry_obligation_audit_d
from .geometry_obligation_audit_d import CoveredIdentityContextRequestD, measure_geometry_obligation_audit_d
from .geometry_obligation_audit_d import DiscriminatingPieceRequestD, measure_geometry_obligation_audit_d
from .geometry_obligation_audit_d import ReflectionParameterFirstRequestD, measure_geometry_obligation_audit_d
from .geometry_obligation_audit_d import ProjectionHiddenObligationsRequestD, measure_geometry_obligation_audit_d
from .service_composition_audit_d import UnfinishedProviderServiceRequestD, measure_service_composition_audit_d
from .service_composition_audit_d import CostMarginTradeoffRequestD, measure_service_composition_audit_d
from .service_composition_audit_d import ParallelEffectsRequestD, measure_service_composition_audit_d
from .service_composition_audit_d import AssignmentCompositionRequestD, measure_service_composition_audit_d
from .service_composition_audit_d import GuideAuthorityRequestD, measure_service_composition_audit_d
from .service_composition_audit_d import GoalReassignmentRequestD, measure_service_composition_audit_d
from .service_composition_audit_d import ConsumerReachabilityRequestD, measure_service_composition_audit_d
from .service_composition_audit_d import AmplitudePrerequisiteRequestD, measure_service_composition_audit_d
from .service_composition_audit_d import NonmonotoneFullStateRequestD, measure_service_composition_audit_d
from .service_composition_audit_d import RequiredAlternativeServicesRequestD, measure_service_composition_audit_d
from .service_composition_audit_d import ProviderBeneficiaryPartitionRequestD, measure_service_composition_audit_d
from .incremental_domain_budget_d import IncrementalDomainBudgetRequestD, measure_incremental_domain_budget_d
from .terminal_evidence_audit_d import UnobservedLevelsRequestD, measure_terminal_evidence_audit_d
from .terminal_evidence_audit_d import SameConditionCounterexamplesRequestD, measure_terminal_evidence_audit_d
from .terminal_evidence_audit_d import QuantifierCounterexamplesRequestD, measure_terminal_evidence_audit_d
from .terminal_evidence_audit_d import ConsumerChainAuditRequestD, measure_terminal_evidence_audit_d
from .terminal_evidence_audit_d import PendingOldEpochFacetsRequestD, measure_terminal_evidence_audit_d
from .persistent_body_primitive_d import PersistentBodyPrimitiveRequestD, measure_persistent_body_primitive_d
from .sensing_transaction_d import SensingTransactionRequestD, measure_sensing_transaction_d
from .destination_macro_d import DestinationMacroRequestD, measure_destination_macro_d
from .autonomous_consumption_d import ConsumptionExternalPrimitiveRequestD, measure_consumption_external_primitive_d
from .autonomous_consumption_d import QuotaScopedJourneysRequestD, measure_quota_scoped_journeys_d
from .autonomous_consumption_d import OpportunityConditionedModesRequestD, measure_opportunity_conditioned_modes_d
from .staged_replenishment_d import StagedReplenishmentRequestD, measure_staged_replenishment_d
from .staged_replenishment_continuation_d import StagedReplenishmentContinuationRequestD, measure_staged_replenishment_continuation_d
from .capture_external_primitive_d import CaptureExternalPrimitiveRequestD, measure_capture_external_primitive_d
from .relay_wave_arrivals_d import RelayWaveArrivalsRequestD, measure_relay_wave_arrivals_d
from .boundary_connectivity_d import BoundaryConnectivityRequestD, measure_boundary_connectivity_d
from .discriminating_exposure_d import DiscriminatingExposureRequestD, measure_discriminating_exposure_d
from .quantized_orbit_d import StaticOrbitPreimagesRequestD, measure_static_orbit_preimages_d
from .quantized_orbit_d import OrbitExternalPrimitiveRequestD, measure_orbit_external_primitive_d
from .quantized_orbit_d import QuantizedOrbitStepRequestD, measure_quantized_orbit_step_d
from .quantized_orbit_d import LateralOrbitEngagementRequestD, measure_lateral_orbit_engagement_d
from .configured_transit_d import ConfiguredTransitRequestD, measure_configured_transit_d
from .policy_constrained_routing_d import PolicyConstrainedRoutingRequestD, measure_policy_constrained_routing_d
from .photosensitive_transaction_d import PhotosensitiveTransactionRequestD, measure_photosensitive_transaction_d
from .stateful_photo_contact_d import StatefulPhotoContactRequestD, measure_stateful_photo_contact_d
from .endpoint_primitive_d import EndpointPrimitiveRequestD, measure_endpoint_primitive_d
from .occluded_catalogue_projection_d import OccludedCatalogueProjectionRequestD, measure_occluded_catalogue_projection_d
from .seeded_partial_push_d import SeededPartialPushRequestD, measure_seeded_partial_push_d
from .occupancy_deferred_permission_d import OccupancyDeferredPermissionRequestD, measure_occupancy_deferred_permission_d
from .window_processing_primitive_d import WindowProcessingPrimitiveRequestD, measure_window_processing_primitive_d
from .window_processing_d import SameBeatActivationClosureRequestD, measure_same_beat_activation_closure_d
from .window_processing_d import HomogeneousWindowEligibilityRequestD, measure_homogeneous_window_eligibility_d
from .labeled_predicate_induction_d import LabeledPredicateInductionRequestD, measure_labeled_predicate_induction_d
from .ordered_predicate_features_d import OrderedPredicateFeaturesRequestD, measure_ordered_predicate_features_d
from .perishable_compartment_d import PerishableCompartmentRequestD, measure_perishable_compartment_d
from .shared_work_primitive_d import SharedWorkPrimitiveRequestD, measure_shared_work_primitive_d
from .shared_work_snapshot_d import PrioritySnapshotReservationRequestD, measure_priority_snapshot_reservation_d
from .shared_work_snapshot_d import SharedSnapshotOpportunitiesRequestD, measure_shared_snapshot_opportunities_d
from .compatible_source_residual_d import CompatibleSourceResidualRequestD, measure_compatible_source_residual_d
from .occluding_cone_d import OccludingConeRequestD, measure_occluding_cone_d
from .source_locked_pursuit_d import SourceLockedPursuitRequestD, measure_source_locked_pursuit_d
from .inventory_release_domain_d import InventoryReleaseDomainRequestD, measure_inventory_release_domain_d
from .state_conditioned_attachment_d import StateConditionedAttachmentRequestD, measure_state_conditioned_attachment_d
from .ordered_front_reduction_d import OrderedFrontReductionRequestD, measure_ordered_front_reduction_d
from .monotone_excavation_d import MonotoneExcavationRequestD, measure_monotone_excavation_d
from .container_admission_d import ContainerAdmissionRequestD, measure_container_admission_d
from .ray_capture_domain_d import RayCaptureDomainRequestD, measure_ray_capture_domain_d
from .prescribed_transit_coincidence_d import PrescribedTransitCoincidenceRequestD, measure_prescribed_transit_coincidence_d
from .quantized_pair_equilibrium_d import QuantizedPairEquilibriumRequestD, measure_quantized_pair_equilibrium_d
from .periodic_profile_preimages_d import PeriodicProfilePreimagesRequestD, measure_periodic_profile_preimages_d
from .modular_phase_channels_d import ModularPhaseChannelsRequestD, measure_modular_phase_channels_d
from .hierarchical_probe_d import HierarchicalProbeRequestD, measure_hierarchical_probe_d
from .subset_observation_d import SubsetObservationRequestD, measure_subset_observation_d
from .original_source_equilibrium_d import OriginalSourceEquilibriumRequestD, measure_original_source_equilibrium_d
from .reciprocal_port_graph_d import ReciprocalPortGraphRequestD, measure_reciprocal_port_graph_d
from .catalogue_primitive_d import CataloguePrimitiveRequestD, measure_catalogue_primitive_d
from .endpoint_navigation_d import EndpointLandingRequestD, measure_endpoint_landing_d
from .identity_scoped_support_d import IdentityScopedSupportRequestD, measure_identity_scoped_support_d
from .rooted_prefix_marginals_d import RootedPrefixMarginalsRequestD, measure_rooted_prefix_marginals_d
from .rigid_edit_primitive_d import RigidEditPrimitiveRequestD, measure_rigid_edit_primitive_d
from .indexed_prefix_primitive_d import IndexedPrefixPrimitiveRequestD, measure_indexed_prefix_primitive_d
from .mechanical_family_contracts_d import (
    DMechanicalResult, DMechanicalSignatureFacts, d_signature_projection, d_signature_rejection,
    DSourceAuditReturnInput, d_source_audit_return,
)
from .mechanical_profile_registry_d import (
    D_PROFILE_TYPES, D_PROFILE_ENTRIES, mechanical_profile_entries_d,
    mechanical_profile_signatures_d, mechanical_profile_payload_d,
)


FAMILY_D_CAPABILITY_TYPES = (
    'CyclicCoverageRequest', 'FixedProgramRequest', 'BoundedJoystickRequest',
    'TemporalFragmentRequest', 'VisualSequenceRequest', 'TopologicalRecolorRequest', 'CoupledMemberRequest',
    'ReactiveCaptureRequest',
    'NeighborhoodPatternRequest',
    'LayeredPrefixRequest',
    'PreviewPackingRequest',
    'StationWorkbenchRequest',
    'AxialFieldRequest',
    'SupportedConstructionRequest',
    'FiniteAlignmentRequest',
    'VisibleVoxelRequest',
    'DiscreteOpticsRequest',
    'CadencedRailRequest',
    'EndpointLandingRequestD',
    'SingleVisitResidualRequestD',
    'OrderedPathPrimitiveRequestD', 'FiniteAlignmentEvidenceRequestD', 'GuaranteeProbabilityRequestD', 'ExtensionScopeRequestD', 'MetricWhyRequestD', 'MetricGoalRequestD', 'VisualSequenceEvidenceRequestD', 'StationProfileEvidenceRequestD', 'TopologicalRecolorEvidenceRequestD', 'ReactiveCaptureEvidenceRequestD', 'NeighborhoodConstructionWhyRequestD', 'FiniteAlignmentWhyRequestD', 'SupportedConstructionWhyRequestD', 'SequencePredictionWhyRequestD', 'TemporalFragmentWhyRequestD', 'StationProfileWhyRequestD', 'PreviewPackingWhyRequestD', 'VoxelConstructionWhyRequestD', 'TopologicalSurfaceWhyRequestD', 'AdhesionWhyRequestD', 'AdhesionGoalRequestD', 'FixedOriginWhyRequestD', 'RailTransferWhyRequestD', 'ReactiveCaptureWhyRequestD', 'CyclicResidualWhyRequestD', 'WrapJointCallScopeD', 'WrapJointRequestScopeD', 'ChartedPermissionWhyRequestD', 'ChartedRouteGoalRequestD', 'StationCargoWhyRequestD', 'StationCargoGoalRequestD', 'PassageEntryWhyRequestD', 'PassageGoalRequestD', 'PatrolCallScopeD', 'PatrolRequestScopeD', 'WrapSeatingWhyRequestD', 'WrapSeatingGoalRequestD', 'FlowProfileRevalidationRequestD', 'FlowOrderAlternativesRequestD', 'FlowNetworkGoalRequestD', 'RefillContinuationRequestD', 'RememberedDarkExplorationRequestD', 'VisibilityCapacityReleaseRequestD', 'VisibilityServiceWhyRequestD', 'VisibilityNavigationGoalRequestD', 'ActorResultPreimagesRequestD', 'ActorProgramGoalRequestD', 'PushAssignmentRequestD', 'PushGoalRequestD', 'AuthenticationModeAccessRequestD', 'AuthenticationCalibrationRequestD', 'SharedAutomataGoalRequestD', 'QuantityHorizonGoalRequestD', 'EndpointTransportGoalRequestD', 'TemporalMatchGoalRequestD', 'InventoryNavigationGoalRequestD', 'OrderedTransferGoalRequestD', 'BallisticContactGoalRequestD', 'HiddenReceptionGoalRequestD', 'FiniteSurvivalGoalRequestD', 'AutonomousArrivalGoalRequestD', 'ReferenceRestoreDamageRequestD', 'ReferenceGoalRequestD', 'MaterialDeliveryOrderRequestD', 'MaterialRecycleRequestD', 'MaterialWhyRequestD', 'MaterialGoalRequestD', 'DropPolicyPrefixRequestD', 'DropWinFirstRequestD', 'PiercingStockRequestD', 'PiercingGoalRequestD', 'CargoParallelRequestD', 'CargoGoalRequestD', 'LocalFieldClockRequestD', 'LocalFieldInterferenceRequestD', 'LocalFieldWindowRequestD', 'LocalFieldWhyRequestD', 'LocalFieldGoalRequestD', 'FlowRiskRequestD', 'FlowTimingRequestD', 'FlowTraceRequestD', 'FlowCascadeRequestD', 'FlowColliderRequestD', 'FlowWhyRequestD', 'FlowGoalRequestD', 'SupportRecoveryRequestD', 'SupportCodeRequestD', 'SupportGripRequestD', 'SupportPivotRequestD', 'HelperPauseScopeRequestD', 'KeeperTravellerRequestD', 'MemberMapsNotSidesRequestD', 'UnseenProviderFrontierRequestD', 'ConsumerSpecificSignatureRequestD', 'JointSymbolOrderRequestD', 'VisibilityResourceContractRequestD', 'StationRendezvousRequestD', 'LatchedTargetSequenceRequestD', 'RecipeOperatorGoalRequestD', 'FiniteInstructionDifferenceRequestD', 'FiniteInstructionPhaseRequestD', 'FiniteInstructionGoalRequestD', 'GuardedRecordingCallRequestD', 'TemporalProviderSelectionRequestD', 'BoundedCommandClockRequestD', 'RecordingObligationRequestD', 'TemporalRecordingKernelRequestD', 'ContinuedSolvabilityRequestD', 'PersistentHelperClearanceRequestD', 'SelectedJumpReconfigurationRequestD', 'OrderedReductionTypesRequestD', 'VariableTransportStopRequestD', 'ForceVsMotionDomainRequestD', 'OrientedIdentityRequestD', 'JointNotAttachedRequestD', 'EditableLocalTopologyRequestD', 'MarkerBodyExclusionRequestD', 'MarkerVectorsDegreeRequestD', 'CoveredIdentityContextRequestD', 'DiscriminatingPieceRequestD', 'ReflectionParameterFirstRequestD', 'ProjectionHiddenObligationsRequestD', 'UnfinishedProviderServiceRequestD', 'CostMarginTradeoffRequestD', 'ParallelEffectsRequestD', 'AssignmentCompositionRequestD', 'GuideAuthorityRequestD', 'GoalReassignmentRequestD', 'ConsumerReachabilityRequestD', 'AmplitudePrerequisiteRequestD', 'NonmonotoneFullStateRequestD', 'RequiredAlternativeServicesRequestD', 'ProviderBeneficiaryPartitionRequestD', 'IncrementalDomainBudgetRequestD', 'UnobservedLevelsRequestD', 'SameConditionCounterexamplesRequestD', 'QuantifierCounterexamplesRequestD', 'ConsumerChainAuditRequestD', 'PendingOldEpochFacetsRequestD', 'PersistentBodyPrimitiveRequestD', 'SensingTransactionRequestD', 'DestinationMacroRequestD', 'ConsumptionExternalPrimitiveRequestD', 'QuotaScopedJourneysRequestD', 'OpportunityConditionedModesRequestD', 'StagedReplenishmentRequestD', 'StagedReplenishmentContinuationRequestD', 'CaptureExternalPrimitiveRequestD', 'RelayWaveArrivalsRequestD', 'BoundaryConnectivityRequestD', 'DiscriminatingExposureRequestD', 'StaticOrbitPreimagesRequestD', 'OrbitExternalPrimitiveRequestD', 'QuantizedOrbitStepRequestD', 'LateralOrbitEngagementRequestD', 'ConfiguredTransitRequestD', 'PolicyConstrainedRoutingRequestD', 'PhotosensitiveTransactionRequestD', 'StatefulPhotoContactRequestD', 'EndpointPrimitiveRequestD', 'OccludedCatalogueProjectionRequestD', 'SeededPartialPushRequestD', 'OccupancyDeferredPermissionRequestD', 'WindowProcessingPrimitiveRequestD', 'SameBeatActivationClosureRequestD', 'HomogeneousWindowEligibilityRequestD', 'LabeledPredicateInductionRequestD', 'OrderedPredicateFeaturesRequestD', 'PerishableCompartmentRequestD', 'SharedWorkPrimitiveRequestD', 'PrioritySnapshotReservationRequestD', 'SharedSnapshotOpportunitiesRequestD', 'CompatibleSourceResidualRequestD', 'OccludingConeRequestD', 'SourceLockedPursuitRequestD', 'InventoryReleaseDomainRequestD', 'StateConditionedAttachmentRequestD', 'OrderedFrontReductionRequestD', 'MonotoneExcavationRequestD', 'ContainerAdmissionRequestD', 'RayCaptureDomainRequestD', 'PrescribedTransitCoincidenceRequestD', 'QuantizedPairEquilibriumRequestD', 'PeriodicProfilePreimagesRequestD', 'ModularPhaseChannelsRequestD', 'HierarchicalProbeRequestD', 'SubsetObservationRequestD', 'OriginalSourceEquilibriumRequestD', 'ReciprocalPortGraphRequestD', 'CataloguePrimitiveRequestD', 'IdentityScopedSupportRequestD', 'RootedPrefixMarginalsRequestD', 'RigidEditPrimitiveRequestD', 'IndexedPrefixPrimitiveRequestD',
    'DMechanicalResult', 'DMechanicalSignatureFacts', 'DSourceAuditReturnInput', 'TemporalRecordingJoinInputD', 'TemporalBoundRecordingInputD', *D_PROFILE_TYPES,
)
FAMILY_D_ENTRIES = (
    ('capability.cyclic_configuration_coverage_calculation', measure_cyclic_configuration_coverage,
     CyclicCoverageRequest, 'cyclic_configuration_coverage.py'),
    ('capability.fixed_program_origin_calculation', measure_fixed_program_origin,
     FixedProgramRequest, 'fixed_program_origin.py'),
    ('capability.bounded_joystick_calculation', measure_bounded_joystick,
     BoundedJoystickRequest, 'bounded_joystick.py'),
    ('capability.temporal_fragment_match_calculation', measure_temporal_fragment_match,
     TemporalFragmentRequest, 'temporal_fragment_match.py'),
    ('capability.visual_sequence_calculation', measure_visual_sequence,
     VisualSequenceRequest, 'visual_sequence.py'),
    ('capability.topological_region_recolor_calculation', measure_topological_region_recolor,
     TopologicalRecolorRequest, 'topological_region_recolor.py'),
    ('capability.coupled_member_control_calculation', measure_coupled_member_control,
     CoupledMemberRequest, 'coupled_member_control.py'),
    ('capability.reactive_capture_calculation', measure_reactive_capture,
     ReactiveCaptureRequest, 'reactive_capture.py'),
    ('capability.neighborhood_pattern_construction_calculation', measure_neighborhood_pattern_construction,
     NeighborhoodPatternRequest, 'neighborhood_pattern_construction.py'),
    ('capability.layered_prefix_construction_calculation', measure_layered_prefix_construction,
     LayeredPrefixRequest, 'layered_prefix_construction.py'),
    ('capability.preview_piece_packing_calculation', measure_preview_piece_packing,
     PreviewPackingRequest, 'preview_piece_packing.py'),
    ('capability.station_profile_workbench_calculation', measure_station_profile_workbench,
     StationWorkbenchRequest, 'station_profile_workbench.py'),
    ('capability.axial_field_configuration_calculation', measure_axial_field_configuration,
     AxialFieldRequest, 'axial_field_configuration.py'),
    ('capability.supported_construction_calculation', measure_supported_construction,
     SupportedConstructionRequest, 'supported_construction.py'),
    ('capability.finite_alignment_calculation', measure_finite_alignment_game,
     FiniteAlignmentRequest, 'finite_alignment_game.py'),
    ('capability.visible_voxel_construction_calculation', measure_visible_voxel_construction,
     VisibleVoxelRequest, 'visible_voxel_construction.py'),
    ('capability.discrete_relay_optics_calculation', measure_discrete_relay_optics,
     DiscreteOpticsRequest, 'discrete_relay_optics.py'),
    ('capability.cadenced_rail_transfer_calculation', measure_cadenced_rail_transfer,
     CadencedRailRequest, 'cadenced_rail_transfer.py'),
    ('capability.endpoint_landing_d_calculation', measure_endpoint_landing_d,
     EndpointLandingRequestD, 'endpoint_navigation_d.py'),
    ('capability.single_visit_residual_d_calculation', measure_single_visit_residual_d,
     SingleVisitResidualRequestD, 'single_visit_residual_d.py'),
    ('capability.ordered_path_primitive_d_calculation', measure_ordered_path_primitive_d,
     OrderedPathPrimitiveRequestD, 'ordered_path_primitive_d.py'),
    ('capability.finite_alignment_evidence_d_calculation', measure_finite_alignment_evidence_scope_d,
     FiniteAlignmentEvidenceRequestD, 'finite_alignment_evidence_scope_d.py'),
    ('capability.guarantee_probability_d_calculation', measure_guarantee_probability_d,
     GuaranteeProbabilityRequestD, 'remaining_scope_metric_audit_d.py'),
    ('capability.extension_scope_d_calculation', measure_extension_scope_d,
     ExtensionScopeRequestD, 'remaining_scope_metric_audit_d.py'),
    ('capability.metric_why_d_calculation', measure_metric_why_d,
     MetricWhyRequestD, 'remaining_scope_metric_audit_d.py'),
    ('capability.metric_goal_d_calculation', measure_metric_goal_d,
     MetricGoalRequestD, 'remaining_scope_metric_audit_d.py'),
    ('capability.visual_sequence_evidence_d_calculation', measure_visual_sequence_evidence_d,
     VisualSequenceEvidenceRequestD, 'remaining_d_solving_d.py'),
    ('capability.station_profile_evidence_d_calculation', measure_station_profile_evidence_d,
     StationProfileEvidenceRequestD, 'remaining_d_solving_d.py'),
    ('capability.topological_recolor_evidence_d_calculation', measure_topological_recolor_evidence_d,
     TopologicalRecolorEvidenceRequestD, 'remaining_d_solving_d.py'),
    ('capability.reactive_capture_evidence_d_calculation', measure_reactive_capture_evidence_d,
     ReactiveCaptureEvidenceRequestD, 'remaining_d_solving_d.py'),
    ('capability.neighborhood_construction_why_d_calculation', measure_neighborhood_construction_why_d,
     NeighborhoodConstructionWhyRequestD, 'remaining_d_solving_d.py'),
    ('capability.finite_alignment_why_d_calculation', measure_finite_alignment_why_d,
     FiniteAlignmentWhyRequestD, 'remaining_d_solving_d.py'),
    ('capability.supported_construction_why_d_calculation', measure_supported_construction_why_d,
     SupportedConstructionWhyRequestD, 'remaining_d_solving_d.py'),
    ('capability.sequence_prediction_why_d_calculation', measure_sequence_prediction_why_d,
     SequencePredictionWhyRequestD, 'remaining_d_solving_d.py'),
    ('capability.temporal_fragment_why_d_calculation', measure_temporal_fragment_why_d,
     TemporalFragmentWhyRequestD, 'remaining_d_solving_d.py'),
    ('capability.station_profile_why_d_calculation', measure_station_profile_why_d,
     StationProfileWhyRequestD, 'remaining_d_solving_d.py'),
    ('capability.preview_packing_why_d_calculation', measure_preview_packing_why_d,
     PreviewPackingWhyRequestD, 'remaining_d_solving_d.py'),
    ('capability.voxel_construction_why_d_calculation', measure_voxel_construction_why_d,
     VoxelConstructionWhyRequestD, 'remaining_d_solving_d.py'),
    ('capability.topological_surface_why_d_calculation', measure_topological_surface_why_d,
     TopologicalSurfaceWhyRequestD, 'remaining_d_solving_d.py'),
    ('capability.adhesion_why_d_calculation', measure_adhesion_why_d,
     AdhesionWhyRequestD, 'remaining_d_solving_d.py'),
    ('capability.adhesion_goal_d_calculation', measure_adhesion_goal_d,
     AdhesionGoalRequestD, 'remaining_d_solving_d.py'),
    ('capability.fixed_origin_why_d_calculation', measure_fixed_origin_why_d,
     FixedOriginWhyRequestD, 'remaining_d_solving_d.py'),
    ('capability.rail_transfer_why_d_calculation', measure_rail_transfer_why_d,
     RailTransferWhyRequestD, 'remaining_d_solving_d.py'),
    ('capability.reactive_capture_why_d_calculation', measure_reactive_capture_why_d,
     ReactiveCaptureWhyRequestD, 'remaining_d_solving_d.py'),
    ('capability.cyclic_residual_why_d_calculation', measure_cyclic_residual_why_d,
     CyclicResidualWhyRequestD, 'remaining_d_solving_d.py'),
    ('capability.wrap_joint_call_d_calculation', measure_wrap_joint_call_d,
     WrapJointCallScopeD, 'remaining_d_solving_d.py'),
    ('capability.wrap_joint_request_d_calculation', measure_wrap_joint_request_d,
     WrapJointRequestScopeD, 'remaining_d_solving_d.py'),
    ('capability.charted_permission_why_d_calculation', measure_charted_permission_why_d,
     ChartedPermissionWhyRequestD, 'remaining_native_solving_d.py'),
    ('capability.charted_route_goal_d_calculation', measure_charted_route_goal_d,
     ChartedRouteGoalRequestD, 'remaining_native_solving_d.py'),
    ('capability.station_cargo_why_d_calculation', measure_station_cargo_why_d,
     StationCargoWhyRequestD, 'remaining_native_solving_d.py'),
    ('capability.station_cargo_goal_d_calculation', measure_station_cargo_goal_d,
     StationCargoGoalRequestD, 'remaining_native_solving_d.py'),
    ('capability.passage_entry_why_d_calculation', measure_passage_entry_why_d,
     PassageEntryWhyRequestD, 'remaining_native_solving_d.py'),
    ('capability.passage_goal_d_calculation', measure_passage_goal_d,
     PassageGoalRequestD, 'remaining_native_solving_d.py'),
    ('capability.patrol_call_d_calculation', measure_patrol_call_d,
     PatrolCallScopeD, 'remaining_native_solving_d.py'),
    ('capability.patrol_request_d_calculation', measure_patrol_request_d,
     PatrolRequestScopeD, 'remaining_native_solving_d.py'),
    ('capability.wrap_seating_why_d_calculation', measure_wrap_seating_why_d,
     WrapSeatingWhyRequestD, 'remaining_native_solving_d.py'),
    ('capability.wrap_seating_goal_d_calculation', measure_wrap_seating_goal_d,
     WrapSeatingGoalRequestD, 'remaining_native_solving_d.py'),
    ('capability.flow_profile_revalidation_d_calculation', measure_flow_profile_revalidation_d,
     FlowProfileRevalidationRequestD, 'remaining_native_solving_d.py'),
    ('capability.flow_order_alternatives_d_calculation', measure_flow_order_alternatives_d,
     FlowOrderAlternativesRequestD, 'remaining_native_solving_d.py'),
    ('capability.flow_network_goal_d_calculation', measure_flow_network_goal_d,
     FlowNetworkGoalRequestD, 'remaining_native_solving_d.py'),
    ('capability.refill_continuation_d_calculation', measure_refill_continuation_d,
     RefillContinuationRequestD, 'remaining_native_solving_d.py'),
    ('capability.remembered_dark_exploration_d_calculation', measure_remembered_dark_exploration_d,
     RememberedDarkExplorationRequestD, 'remaining_native_solving_d.py'),
    ('capability.visibility_capacity_release_d_calculation', measure_visibility_capacity_release_d,
     VisibilityCapacityReleaseRequestD, 'remaining_native_solving_d.py'),
    ('capability.visibility_service_why_d_calculation', measure_visibility_service_why_d,
     VisibilityServiceWhyRequestD, 'remaining_native_solving_d.py'),
    ('capability.visibility_navigation_goal_d_calculation', measure_visibility_navigation_goal_d,
     VisibilityNavigationGoalRequestD, 'remaining_native_solving_d.py'),
    ('capability.actor_result_preimages_d_calculation', measure_actor_result_preimages_d,
     ActorResultPreimagesRequestD, 'remaining_native_solving_d.py'),
    ('capability.actor_program_goal_d_calculation', measure_actor_program_goal_d,
     ActorProgramGoalRequestD, 'remaining_native_solving_d.py'),
    ('capability.push_assignment_d_calculation', measure_push_assignment_d,
     PushAssignmentRequestD, 'remaining_native_solving_d.py'),
    ('capability.push_goal_d_calculation', measure_push_goal_d,
     PushGoalRequestD, 'remaining_native_solving_d.py'),
    ('capability.authentication_mode_access_d_calculation', measure_authentication_mode_access_d,
     AuthenticationModeAccessRequestD, 'remaining_native_solving_d.py'),
    ('capability.authentication_calibration_d_calculation', measure_authentication_calibration_d,
     AuthenticationCalibrationRequestD, 'remaining_native_solving_d.py'),
    ('capability.shared_automata_goal_d_calculation', measure_shared_automata_goal_d,
     SharedAutomataGoalRequestD, 'remaining_native_solving_d.py'),
    ('capability.quantity_horizon_goal_d_calculation', measure_quantity_horizon_goal_d,
     QuantityHorizonGoalRequestD, 'native_solving_contributions_d.py'),
    ('capability.endpoint_transport_goal_d_calculation', measure_endpoint_transport_goal_d,
     EndpointTransportGoalRequestD, 'native_solving_contributions_d.py'),
    ('capability.temporal_match_goal_d_calculation', measure_temporal_match_goal_d,
     TemporalMatchGoalRequestD, 'native_solving_contributions_d.py'),
    ('capability.inventory_navigation_goal_d_calculation', measure_inventory_navigation_goal_d,
     InventoryNavigationGoalRequestD, 'native_solving_contributions_d.py'),
    ('capability.ordered_transfer_goal_d_calculation', measure_ordered_transfer_goal_d,
     OrderedTransferGoalRequestD, 'native_solving_contributions_d.py'),
    ('capability.ballistic_contact_goal_d_calculation', measure_ballistic_contact_goal_d,
     BallisticContactGoalRequestD, 'native_solving_contributions_d.py'),
    ('capability.hidden_reception_goal_d_calculation', measure_hidden_reception_goal_d,
     HiddenReceptionGoalRequestD, 'native_solving_contributions_d.py'),
    ('capability.finite_survival_goal_d_calculation', measure_finite_survival_goal_d,
     FiniteSurvivalGoalRequestD, 'native_solving_contributions_d.py'),
    ('capability.autonomous_arrival_goal_d_calculation', measure_autonomous_arrival_goal_d,
     AutonomousArrivalGoalRequestD, 'native_solving_contributions_d.py'),
    ('capability.reference_restore_damage_d_calculation', measure_reference_restore_damage_d,
     ReferenceRestoreDamageRequestD, 'native_solving_contributions_d.py'),
    ('capability.reference_goal_d_calculation', measure_reference_goal_d,
     ReferenceGoalRequestD, 'native_solving_contributions_d.py'),
    ('capability.material_delivery_order_d_calculation', measure_material_delivery_order_d,
     MaterialDeliveryOrderRequestD, 'native_solving_contributions_d.py'),
    ('capability.material_recycle_d_calculation', measure_material_recycle_d,
     MaterialRecycleRequestD, 'native_solving_contributions_d.py'),
    ('capability.material_why_d_calculation', measure_material_why_d,
     MaterialWhyRequestD, 'native_solving_contributions_d.py'),
    ('capability.material_goal_d_calculation', measure_material_goal_d,
     MaterialGoalRequestD, 'native_solving_contributions_d.py'),
    ('capability.drop_policy_prefix_d_calculation', measure_drop_policy_prefix_d,
     DropPolicyPrefixRequestD, 'native_solving_contributions_d.py'),
    ('capability.drop_win_first_d_calculation', measure_drop_win_first_d,
     DropWinFirstRequestD, 'native_solving_contributions_d.py'),
    ('capability.piercing_stock_d_calculation', measure_piercing_stock_d,
     PiercingStockRequestD, 'native_solving_contributions_d.py'),
    ('capability.piercing_goal_d_calculation', measure_piercing_goal_d,
     PiercingGoalRequestD, 'native_solving_contributions_d.py'),
    ('capability.cargo_parallel_d_calculation', measure_cargo_parallel_d,
     CargoParallelRequestD, 'native_solving_contributions_d.py'),
    ('capability.cargo_goal_d_calculation', measure_cargo_goal_d,
     CargoGoalRequestD, 'native_solving_contributions_d.py'),
    ('capability.local_field_clock_d_calculation', measure_local_field_clock_d,
     LocalFieldClockRequestD, 'native_solving_contributions_d.py'),
    ('capability.local_field_interference_d_calculation', measure_local_field_interference_d,
     LocalFieldInterferenceRequestD, 'native_solving_contributions_d.py'),
    ('capability.local_field_window_d_calculation', measure_local_field_window_d,
     LocalFieldWindowRequestD, 'native_solving_contributions_d.py'),
    ('capability.local_field_why_d_calculation', measure_local_field_why_d,
     LocalFieldWhyRequestD, 'native_solving_contributions_d.py'),
    ('capability.local_field_goal_d_calculation', measure_local_field_goal_d,
     LocalFieldGoalRequestD, 'native_solving_contributions_d.py'),
    ('capability.flow_risk_d_calculation', measure_flow_goal_audit_d,
     FlowRiskRequestD, 'flow_goal_audit_d.py'),
    ('capability.flow_timing_d_calculation', measure_flow_goal_audit_d,
     FlowTimingRequestD, 'flow_goal_audit_d.py'),
    ('capability.flow_trace_d_calculation', measure_flow_goal_audit_d,
     FlowTraceRequestD, 'flow_goal_audit_d.py'),
    ('capability.flow_cascade_d_calculation', measure_flow_goal_audit_d,
     FlowCascadeRequestD, 'flow_goal_audit_d.py'),
    ('capability.flow_collider_d_calculation', measure_flow_goal_audit_d,
     FlowColliderRequestD, 'flow_goal_audit_d.py'),
    ('capability.flow_why_d_calculation', measure_flow_goal_audit_d,
     FlowWhyRequestD, 'flow_goal_audit_d.py'),
    ('capability.flow_goal_d_calculation', measure_flow_goal_audit_d,
     FlowGoalRequestD, 'flow_goal_audit_d.py'),
    ('capability.support_recovery_d_calculation', measure_reconfigurable_support_audit_d,
     SupportRecoveryRequestD, 'symbol_coupling_support_audit_d.py'),
    ('capability.support_code_d_calculation', measure_reconfigurable_support_audit_d,
     SupportCodeRequestD, 'symbol_coupling_support_audit_d.py'),
    ('capability.support_grip_d_calculation', measure_reconfigurable_support_audit_d,
     SupportGripRequestD, 'symbol_coupling_support_audit_d.py'),
    ('capability.support_pivot_d_calculation', measure_reconfigurable_support_audit_d,
     SupportPivotRequestD, 'symbol_coupling_support_audit_d.py'),
    ('capability.helper_pause_scope_d_calculation', measure_coupled_support_audit_d,
     HelperPauseScopeRequestD, 'symbol_coupling_support_audit_d.py'),
    ('capability.keeper_traveller_d_calculation', measure_coupled_support_audit_d,
     KeeperTravellerRequestD, 'symbol_coupling_support_audit_d.py'),
    ('capability.member_maps_not_sides_d_calculation', measure_coupled_support_audit_d,
     MemberMapsNotSidesRequestD, 'symbol_coupling_support_audit_d.py'),
    ('capability.unseen_provider_frontier_d_calculation', measure_symbol_route_audit_d,
     UnseenProviderFrontierRequestD, 'symbol_coupling_support_audit_d.py'),
    ('capability.consumer_specific_signature_d_calculation', measure_symbol_route_audit_d,
     ConsumerSpecificSignatureRequestD, 'symbol_coupling_support_audit_d.py'),
    ('capability.joint_symbol_order_d_calculation', measure_symbol_route_audit_d,
     JointSymbolOrderRequestD, 'symbol_coupling_support_audit_d.py'),
    ('capability.visibility_resource_contract_d_calculation', measure_symbol_route_audit_d,
     VisibilityResourceContractRequestD, 'symbol_coupling_support_audit_d.py'),
    ('capability.station_rendezvous_d_calculation', measure_symbol_route_audit_d,
     StationRendezvousRequestD, 'symbol_coupling_support_audit_d.py'),
    ('capability.latched_target_sequence_d_calculation', measure_symbol_route_audit_d,
     LatchedTargetSequenceRequestD, 'symbol_coupling_support_audit_d.py'),
    ('capability.recipe_operator_goal_d_calculation', measure_recipe_operator_goal_d,
     RecipeOperatorGoalRequestD, 'program_recipe_goal_audit_d.py'),
    ('capability.finite_instruction_difference_d_calculation', measure_program_goal_audit_d,
     FiniteInstructionDifferenceRequestD, 'program_recipe_goal_audit_d.py'),
    ('capability.finite_instruction_phase_d_calculation', measure_program_goal_audit_d,
     FiniteInstructionPhaseRequestD, 'program_recipe_goal_audit_d.py'),
    ('capability.finite_instruction_goal_d_calculation', measure_program_goal_audit_d,
     FiniteInstructionGoalRequestD, 'program_recipe_goal_audit_d.py'),
    ('capability.guarded_recording_call_d_calculation', measure_temporal_service_audit_d,
     GuardedRecordingCallRequestD, 'temporal_service_audit_d.py'),
    ('capability.temporal_provider_selection_d_calculation', measure_temporal_service_audit_d,
     TemporalProviderSelectionRequestD, 'temporal_service_audit_d.py'),
    ('capability.bounded_command_clock_d_calculation', measure_temporal_service_audit_d,
     BoundedCommandClockRequestD, 'temporal_service_audit_d.py'),
    ('capability.recording_obligation_d_calculation', measure_temporal_service_audit_d,
     RecordingObligationRequestD, 'temporal_service_audit_d.py'),
    ('capability.temporal_recording_kernel_d_calculation', measure_temporal_recording_kernel_d,
     TemporalRecordingKernelRequestD, 'temporal_service_audit_d.py'),
    ('capability.continued_solvability_d_calculation', measure_typed_reduction_audit_d,
     ContinuedSolvabilityRequestD, 'typed_transport_reduction_audit_d.py'),
    ('capability.persistent_helper_clearance_d_calculation', measure_typed_reduction_audit_d,
     PersistentHelperClearanceRequestD, 'typed_transport_reduction_audit_d.py'),
    ('capability.selected_jump_reconfiguration_d_calculation', measure_typed_reduction_audit_d,
     SelectedJumpReconfigurationRequestD, 'typed_transport_reduction_audit_d.py'),
    ('capability.ordered_reduction_types_d_calculation', measure_typed_reduction_audit_d,
     OrderedReductionTypesRequestD, 'typed_transport_reduction_audit_d.py'),
    ('capability.variable_transport_stop_d_calculation', measure_force_transport_audit_d,
     VariableTransportStopRequestD, 'typed_transport_reduction_audit_d.py'),
    ('capability.force_vs_motion_domain_d_calculation', measure_force_transport_audit_d,
     ForceVsMotionDomainRequestD, 'typed_transport_reduction_audit_d.py'),
    ('capability.oriented_identity_d_calculation', measure_geometry_obligation_audit_d,
     OrientedIdentityRequestD, 'geometry_obligation_audit_d.py'),
    ('capability.joint_not_attached_d_calculation', measure_geometry_obligation_audit_d,
     JointNotAttachedRequestD, 'geometry_obligation_audit_d.py'),
    ('capability.editable_local_topology_d_calculation', measure_geometry_obligation_audit_d,
     EditableLocalTopologyRequestD, 'geometry_obligation_audit_d.py'),
    ('capability.marker_body_exclusion_d_calculation', measure_geometry_obligation_audit_d,
     MarkerBodyExclusionRequestD, 'geometry_obligation_audit_d.py'),
    ('capability.marker_vectors_degree_d_calculation', measure_geometry_obligation_audit_d,
     MarkerVectorsDegreeRequestD, 'geometry_obligation_audit_d.py'),
    ('capability.covered_identity_context_d_calculation', measure_geometry_obligation_audit_d,
     CoveredIdentityContextRequestD, 'geometry_obligation_audit_d.py'),
    ('capability.discriminating_piece_d_calculation', measure_geometry_obligation_audit_d,
     DiscriminatingPieceRequestD, 'geometry_obligation_audit_d.py'),
    ('capability.reflection_parameter_first_d_calculation', measure_geometry_obligation_audit_d,
     ReflectionParameterFirstRequestD, 'geometry_obligation_audit_d.py'),
    ('capability.projection_hidden_obligations_d_calculation', measure_geometry_obligation_audit_d,
     ProjectionHiddenObligationsRequestD, 'geometry_obligation_audit_d.py'),
    ('capability.unfinished_provider_service_d_calculation', measure_service_composition_audit_d,
     UnfinishedProviderServiceRequestD, 'service_composition_audit_d.py'),
    ('capability.cost_margin_tradeoff_d_calculation', measure_service_composition_audit_d,
     CostMarginTradeoffRequestD, 'service_composition_audit_d.py'),
    ('capability.parallel_effects_d_calculation', measure_service_composition_audit_d,
     ParallelEffectsRequestD, 'service_composition_audit_d.py'),
    ('capability.assignment_composition_d_calculation', measure_service_composition_audit_d,
     AssignmentCompositionRequestD, 'service_composition_audit_d.py'),
    ('capability.guide_authority_d_calculation', measure_service_composition_audit_d,
     GuideAuthorityRequestD, 'service_composition_audit_d.py'),
    ('capability.goal_reassignment_d_calculation', measure_service_composition_audit_d,
     GoalReassignmentRequestD, 'service_composition_audit_d.py'),
    ('capability.consumer_reachability_d_calculation', measure_service_composition_audit_d,
     ConsumerReachabilityRequestD, 'service_composition_audit_d.py'),
    ('capability.amplitude_prerequisite_d_calculation', measure_service_composition_audit_d,
     AmplitudePrerequisiteRequestD, 'service_composition_audit_d.py'),
    ('capability.nonmonotone_full_state_d_calculation', measure_service_composition_audit_d,
     NonmonotoneFullStateRequestD, 'service_composition_audit_d.py'),
    ('capability.required_alternative_services_d_calculation', measure_service_composition_audit_d,
     RequiredAlternativeServicesRequestD, 'service_composition_audit_d.py'),
    ('capability.provider_beneficiary_partition_d_calculation', measure_service_composition_audit_d,
     ProviderBeneficiaryPartitionRequestD, 'service_composition_audit_d.py'),
    ('capability.incremental_domain_budget_d_calculation', measure_incremental_domain_budget_d,
     IncrementalDomainBudgetRequestD, 'incremental_domain_budget_d.py'),
    ('capability.unobserved_levels_d_calculation', measure_terminal_evidence_audit_d,
     UnobservedLevelsRequestD, 'terminal_evidence_audit_d.py'),
    ('capability.same_condition_counterexamples_d_calculation', measure_terminal_evidence_audit_d,
     SameConditionCounterexamplesRequestD, 'terminal_evidence_audit_d.py'),
    ('capability.quantifier_counterexamples_d_calculation', measure_terminal_evidence_audit_d,
     QuantifierCounterexamplesRequestD, 'terminal_evidence_audit_d.py'),
    ('capability.consumer_chain_audit_d_calculation', measure_terminal_evidence_audit_d,
     ConsumerChainAuditRequestD, 'terminal_evidence_audit_d.py'),
    ('capability.pending_old_epoch_facets_d_calculation', measure_terminal_evidence_audit_d,
     PendingOldEpochFacetsRequestD, 'terminal_evidence_audit_d.py'),
    ('capability.persistent_body_primitive_d_calculation', measure_persistent_body_primitive_d,
     PersistentBodyPrimitiveRequestD, 'persistent_body_primitive_d.py'),
    ('capability.sensing_transaction_d_calculation', measure_sensing_transaction_d,
     SensingTransactionRequestD, 'sensing_transaction_d.py'),
    ('capability.destination_macro_d_calculation', measure_destination_macro_d,
     DestinationMacroRequestD, 'destination_macro_d.py'),
    ('capability.consumption_external_primitive_d_calculation', measure_consumption_external_primitive_d,
     ConsumptionExternalPrimitiveRequestD, 'autonomous_consumption_d.py'),
    ('capability.quota_scoped_journeys_d_calculation', measure_quota_scoped_journeys_d,
     QuotaScopedJourneysRequestD, 'autonomous_consumption_d.py'),
    ('capability.opportunity_conditioned_modes_d_calculation', measure_opportunity_conditioned_modes_d,
     OpportunityConditionedModesRequestD, 'autonomous_consumption_d.py'),
    ('capability.staged_replenishment_d_calculation', measure_staged_replenishment_d,
     StagedReplenishmentRequestD, 'staged_replenishment_d.py'),
    ('capability.staged_replenishment_continuation_d_calculation', measure_staged_replenishment_continuation_d,
     StagedReplenishmentContinuationRequestD, 'staged_replenishment_continuation_d.py'),
    ('capability.capture_external_primitive_d_calculation', measure_capture_external_primitive_d,
     CaptureExternalPrimitiveRequestD, 'capture_external_primitive_d.py'),
    ('capability.relay_wave_arrivals_d_calculation', measure_relay_wave_arrivals_d,
     RelayWaveArrivalsRequestD, 'relay_wave_arrivals_d.py'),
    ('capability.boundary_connectivity_d_calculation', measure_boundary_connectivity_d,
     BoundaryConnectivityRequestD, 'boundary_connectivity_d.py'),
    ('capability.discriminating_exposure_d_calculation', measure_discriminating_exposure_d,
     DiscriminatingExposureRequestD, 'discriminating_exposure_d.py'),
    ('capability.static_orbit_preimages_d_calculation', measure_static_orbit_preimages_d,
     StaticOrbitPreimagesRequestD, 'quantized_orbit_d.py'),
    ('capability.orbit_external_primitive_d_calculation', measure_orbit_external_primitive_d,
     OrbitExternalPrimitiveRequestD, 'quantized_orbit_d.py'),
    ('capability.quantized_orbit_step_d_calculation', measure_quantized_orbit_step_d,
     QuantizedOrbitStepRequestD, 'quantized_orbit_d.py'),
    ('capability.lateral_orbit_engagement_d_calculation', measure_lateral_orbit_engagement_d,
     LateralOrbitEngagementRequestD, 'quantized_orbit_d.py'),
    ('capability.configured_transit_d_calculation', measure_configured_transit_d,
     ConfiguredTransitRequestD, 'configured_transit_d.py'),
    ('capability.policy_constrained_routing_d_calculation', measure_policy_constrained_routing_d,
     PolicyConstrainedRoutingRequestD, 'policy_constrained_routing_d.py'),
    ('capability.photosensitive_transaction_d_calculation', measure_photosensitive_transaction_d,
     PhotosensitiveTransactionRequestD, 'photosensitive_transaction_d.py'),
    ('capability.stateful_photo_contact_d_calculation', measure_stateful_photo_contact_d,
     StatefulPhotoContactRequestD, 'stateful_photo_contact_d.py'),
    ('capability.endpoint_primitive_d_calculation', measure_endpoint_primitive_d,
     EndpointPrimitiveRequestD, 'endpoint_primitive_d.py'),
    ('capability.occluded_catalogue_projection_d_calculation', measure_occluded_catalogue_projection_d,
     OccludedCatalogueProjectionRequestD, 'occluded_catalogue_projection_d.py'),
    ('capability.seeded_partial_push_d_calculation', measure_seeded_partial_push_d,
     SeededPartialPushRequestD, 'seeded_partial_push_d.py'),
    ('capability.occupancy_deferred_permission_d_calculation', measure_occupancy_deferred_permission_d,
     OccupancyDeferredPermissionRequestD, 'occupancy_deferred_permission_d.py'),
    ('capability.window_processing_primitive_d_calculation', measure_window_processing_primitive_d,
     WindowProcessingPrimitiveRequestD, 'window_processing_primitive_d.py'),
    ('capability.same_beat_activation_closure_d_calculation', measure_same_beat_activation_closure_d,
     SameBeatActivationClosureRequestD, 'window_processing_d.py'),
    ('capability.homogeneous_window_eligibility_d_calculation', measure_homogeneous_window_eligibility_d,
     HomogeneousWindowEligibilityRequestD, 'window_processing_d.py'),
    ('capability.labeled_predicate_induction_d_calculation', measure_labeled_predicate_induction_d,
     LabeledPredicateInductionRequestD, 'labeled_predicate_induction_d.py'),
    ('capability.ordered_predicate_features_d_calculation', measure_ordered_predicate_features_d,
     OrderedPredicateFeaturesRequestD, 'ordered_predicate_features_d.py'),
    ('capability.perishable_compartment_d_calculation', measure_perishable_compartment_d,
     PerishableCompartmentRequestD, 'perishable_compartment_d.py'),
    ('capability.shared_work_primitive_d_calculation', measure_shared_work_primitive_d,
     SharedWorkPrimitiveRequestD, 'shared_work_primitive_d.py'),
    ('capability.priority_snapshot_reservation_d_calculation', measure_priority_snapshot_reservation_d,
     PrioritySnapshotReservationRequestD, 'shared_work_snapshot_d.py'),
    ('capability.shared_snapshot_opportunities_d_calculation', measure_shared_snapshot_opportunities_d,
     SharedSnapshotOpportunitiesRequestD, 'shared_work_snapshot_d.py'),
    ('capability.compatible_source_residual_d_calculation', measure_compatible_source_residual_d,
     CompatibleSourceResidualRequestD, 'compatible_source_residual_d.py'),
    ('capability.occluding_cone_d_calculation', measure_occluding_cone_d,
     OccludingConeRequestD, 'occluding_cone_d.py'),
    ('capability.source_locked_pursuit_d_calculation', measure_source_locked_pursuit_d,
     SourceLockedPursuitRequestD, 'source_locked_pursuit_d.py'),
    ('capability.inventory_release_domain_d_calculation', measure_inventory_release_domain_d,
     InventoryReleaseDomainRequestD, 'inventory_release_domain_d.py'),
    ('capability.state_conditioned_attachment_d_calculation', measure_state_conditioned_attachment_d,
     StateConditionedAttachmentRequestD, 'state_conditioned_attachment_d.py'),
    ('capability.ordered_front_reduction_d_calculation', measure_ordered_front_reduction_d,
     OrderedFrontReductionRequestD, 'ordered_front_reduction_d.py'),
    ('capability.monotone_excavation_d_calculation', measure_monotone_excavation_d,
     MonotoneExcavationRequestD, 'monotone_excavation_d.py'),
    ('capability.container_admission_d_calculation', measure_container_admission_d,
     ContainerAdmissionRequestD, 'container_admission_d.py'),
    ('capability.ray_capture_domain_d_calculation', measure_ray_capture_domain_d,
     RayCaptureDomainRequestD, 'ray_capture_domain_d.py'),
    ('capability.prescribed_transit_coincidence_d_calculation', measure_prescribed_transit_coincidence_d,
     PrescribedTransitCoincidenceRequestD, 'prescribed_transit_coincidence_d.py'),
    ('capability.quantized_pair_equilibrium_d_calculation', measure_quantized_pair_equilibrium_d,
     QuantizedPairEquilibriumRequestD, 'quantized_pair_equilibrium_d.py'),
    ('capability.periodic_profile_preimages_d_calculation', measure_periodic_profile_preimages_d,
     PeriodicProfilePreimagesRequestD, 'periodic_profile_preimages_d.py'),
    ('capability.modular_phase_channels_d_calculation', measure_modular_phase_channels_d,
     ModularPhaseChannelsRequestD, 'modular_phase_channels_d.py'),
    ('capability.hierarchical_probe_d_calculation', measure_hierarchical_probe_d,
     HierarchicalProbeRequestD, 'hierarchical_probe_d.py'),
    ('capability.subset_observation_d_calculation', measure_subset_observation_d,
     SubsetObservationRequestD, 'subset_observation_d.py'),
    ('capability.original_source_equilibrium_d_calculation', measure_original_source_equilibrium_d,
     OriginalSourceEquilibriumRequestD, 'original_source_equilibrium_d.py'),
    ('capability.reciprocal_port_graph_d_calculation', measure_reciprocal_port_graph_d,
     ReciprocalPortGraphRequestD, 'reciprocal_port_graph_d.py'),
    ('capability.catalogue_primitive_d_calculation', measure_catalogue_primitive_d,
     CataloguePrimitiveRequestD, 'catalogue_primitive_d.py'),
    ('capability.endpoint_landing_v15_d_calculation', measure_endpoint_landing_d,
     EndpointLandingRequestD, 'endpoint_navigation_d.py'),
    ('capability.identity_scoped_support_d_calculation', measure_identity_scoped_support_d,
     IdentityScopedSupportRequestD, 'identity_scoped_support_d.py'),
    ('capability.rooted_prefix_marginals_d_calculation', measure_rooted_prefix_marginals_d,
     RootedPrefixMarginalsRequestD, 'rooted_prefix_marginals_d.py'),
    ('capability.rigid_edit_primitive_d_calculation', measure_rigid_edit_primitive_d,
     RigidEditPrimitiveRequestD, 'rigid_edit_primitive_d.py'),
    ('capability.indexed_prefix_primitive_d_calculation', measure_indexed_prefix_primitive_d,
     IndexedPrefixPrimitiveRequestD, 'indexed_prefix_primitive_d.py'),
)


def mechanical_family_entries_d(entry_factory):
    entries = []
    for ref, implementation, input_model, source_file in FAMILY_D_ENTRIES:
        entries.append(entry_factory(capability_id=ref, implementation=implementation,
            input_model=input_model, output_model=DMechanicalResult, source_file=source_file,
            applicability=('exact_source_requested_operation_and_mode', 'caller_bound_finite_model'),
            invariants=('no_act', 'immutable_parent_scope', 'actual_time_node_and_domain_bounds',
                        'all_retained_models_correlated', 'successor_never_recursively_searches'),
            falsifiers=('unsupported_signature', 'missing_law_or_state', 'bound_reached')))
        for suffix, function, output in (
            ('signature_projection', d_signature_projection, DMechanicalSignatureFacts),
            ('signature_rejection', d_signature_rejection, DMechanicalResult),
        ):
            entries.append(entry_factory(capability_id=ref.replace('calculation', suffix),
                implementation=function, input_model=input_model, output_model=output,
                source_file='mechanical_family_contracts_d.py',
                applicability=('caller_supplied_signature_fields',),
                invariants=('no_world_calculation_or_operation_selection', 'parent_and_siblings_preserved'),
                falsifiers=('mode_inferred_from_name',)))
    entries.append(entry_factory(capability_id='capability.d_source_audit_return',implementation=d_source_audit_return,
        input_model=DSourceAuditReturnInput,output_model=DMechanicalResult,source_file='mechanical_family_contracts_d.py',
        applicability=('source_supplied_actual_disposition',),invariants=('no_selection','unchanged_parent_measurement_and_why'),
        falsifiers=('python_created_disposition',)))
    entries.append(entry_factory(capability_id='capability.temporal_recording_bound_request_d',implementation=temporal_recording_bound_request,
        input_model=TemporalBoundRecordingInputD,output_model=TemporalRecordingKernelRequestD,source_file='temporal_service_audit_d.py',
        applicability=('src_recording_guard_selected',),invariants=('exact_parent_owned_request','no_call_or_choice_in_python'),falsifiers=('missing_bound_request',)))
    entries.append(entry_factory(capability_id='capability.temporal_recording_join_d',implementation=temporal_recording_join_d,
        input_model=TemporalRecordingJoinInputD,output_model=DMechanicalResult,source_file='temporal_service_audit_d.py',
        applicability=('actual_src_invoked_k14_result',),invariants=('same_parent_scope','propagate_incomplete_kernel_status'),falsifiers=('foreign_parent_result',)))
    return tuple(entries) + mechanical_profile_entries_d(entry_factory)


def mechanical_family_signatures_d(type_spec, parameter_spec):
    signatures = {operation: ((parameter_spec(name='request', type_spec=type_spec(model.__name__)),), output)
        for ref, _, model, _ in FAMILY_D_ENTRIES
        for operation, output in ((ref, 'DMechanicalResult'),
            (ref.replace('calculation', 'signature_projection'), 'DMechanicalSignatureFacts'),
            (ref.replace('calculation', 'signature_rejection'), 'DMechanicalResult'))}
    signatures.update(mechanical_profile_signatures_d(type_spec, parameter_spec))
    signatures['capability.d_source_audit_return']=((
        parameter_spec(name='measurement',type_spec=type_spec('DMechanicalResult')),
        parameter_spec(name='source_disposition_ref',type_spec=type_spec('Any')),
        parameter_spec(name='source_policy_ref',type_spec=type_spec('String'))),'DMechanicalResult')
    signatures['capability.temporal_recording_bound_request_d']=((parameter_spec(name='request',type_spec=type_spec('GuardedRecordingCallRequestD')),
        parameter_spec(name='audit',type_spec=type_spec('DMechanicalResult'))),'TemporalRecordingKernelRequestD')
    signatures['capability.temporal_recording_join_d']=((parameter_spec(name='audit',type_spec=type_spec('DMechanicalResult')),
        parameter_spec(name='kernel',type_spec=type_spec('DMechanicalResult'))),'DMechanicalResult')
    return signatures


def mechanical_family_payload_d(capability_ref, arguments):
    """Only a Source-selected family is decoded; no alternative fallback."""
    if any(capability_ref == ref for ref, *_ in D_PROFILE_ENTRIES):
        return mechanical_profile_payload_d(capability_ref, arguments)
    for ref, _, model, _ in FAMILY_D_ENTRIES:
        if capability_ref in (ref, ref.replace('calculation', 'signature_projection'),
                             ref.replace('calculation', 'signature_rejection')):
            return model.model_validate(arguments['request'])
    raise ValueError('unknown D mechanical capability identity')
