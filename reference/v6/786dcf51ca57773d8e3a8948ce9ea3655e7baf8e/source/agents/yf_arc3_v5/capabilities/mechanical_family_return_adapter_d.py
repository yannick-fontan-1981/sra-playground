"""Copy D data into Grok's common response, never normalize or select a status.

The common dependency is loaded only at assembly after central consolidation.
The autonomous family kernels remain importable on their origin/main baseline.
"""

from __future__ import annotations

from typing import Literal, TYPE_CHECKING
from pydantic import Field

from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref
from .cyclic_configuration_coverage import CyclicCoverageRequest
from .fixed_program_origin import FixedProgramRequest
from .bounded_joystick import BoundedJoystickRequest
from .temporal_fragment_match import TemporalFragmentRequest
from .visual_sequence import VisualSequenceRequest
from .topological_region_recolor import TopologicalRecolorRequest
from .coupled_member_control import CoupledMemberRequest
from .reactive_capture import ReactiveCaptureRequest
from .neighborhood_pattern_construction import NeighborhoodPatternRequest
from .layered_prefix_construction import LayeredPrefixRequest
from .preview_piece_packing import PreviewPackingRequest
from .station_profile_workbench import StationWorkbenchRequest
from .axial_field_configuration import AxialFieldRequest
from .supported_construction import SupportedConstructionRequest
from .finite_alignment_game import FiniteAlignmentRequest
from .visible_voxel_construction import VisibleVoxelRequest
from .discrete_relay_optics import DiscreteOpticsRequest
from .cadenced_rail_transfer import CadencedRailRequest
from .endpoint_navigation_d import EndpointLandingRequestD
from .single_visit_residual_d import SingleVisitResidualRequestD
from .ordered_path_primitive_d import OrderedPathPrimitiveRequestD
from .finite_alignment_evidence_scope_d import FiniteAlignmentEvidenceRequestD
from .remaining_scope_metric_audit_d import GuaranteeProbabilityRequestD
from .remaining_scope_metric_audit_d import ExtensionScopeRequestD
from .remaining_scope_metric_audit_d import MetricWhyRequestD
from .remaining_scope_metric_audit_d import MetricGoalRequestD
from .remaining_d_solving_d import VisualSequenceEvidenceRequestD
from .remaining_d_solving_d import StationProfileEvidenceRequestD
from .remaining_d_solving_d import TopologicalRecolorEvidenceRequestD
from .remaining_d_solving_d import ReactiveCaptureEvidenceRequestD
from .remaining_d_solving_d import NeighborhoodConstructionWhyRequestD
from .remaining_d_solving_d import FiniteAlignmentWhyRequestD
from .remaining_d_solving_d import SupportedConstructionWhyRequestD
from .remaining_d_solving_d import SequencePredictionWhyRequestD
from .remaining_d_solving_d import TemporalFragmentWhyRequestD
from .remaining_d_solving_d import StationProfileWhyRequestD
from .remaining_d_solving_d import PreviewPackingWhyRequestD
from .remaining_d_solving_d import VoxelConstructionWhyRequestD
from .remaining_d_solving_d import TopologicalSurfaceWhyRequestD
from .remaining_d_solving_d import AdhesionWhyRequestD
from .remaining_d_solving_d import AdhesionGoalRequestD
from .remaining_d_solving_d import FixedOriginWhyRequestD
from .remaining_d_solving_d import RailTransferWhyRequestD
from .remaining_d_solving_d import ReactiveCaptureWhyRequestD
from .remaining_d_solving_d import CyclicResidualWhyRequestD
from .remaining_d_solving_d import WrapJointCallScopeD
from .remaining_d_solving_d import WrapJointRequestScopeD
from .remaining_native_solving_d import ChartedPermissionWhyRequestD
from .remaining_native_solving_d import ChartedRouteGoalRequestD
from .remaining_native_solving_d import StationCargoWhyRequestD
from .remaining_native_solving_d import StationCargoGoalRequestD
from .remaining_native_solving_d import PassageEntryWhyRequestD
from .remaining_native_solving_d import PassageGoalRequestD
from .remaining_native_solving_d import PatrolCallScopeD
from .remaining_native_solving_d import PatrolRequestScopeD
from .remaining_native_solving_d import WrapSeatingWhyRequestD
from .remaining_native_solving_d import WrapSeatingGoalRequestD
from .remaining_native_solving_d import FlowProfileRevalidationRequestD
from .remaining_native_solving_d import FlowOrderAlternativesRequestD
from .remaining_native_solving_d import FlowNetworkGoalRequestD
from .remaining_native_solving_d import RefillContinuationRequestD
from .remaining_native_solving_d import RememberedDarkExplorationRequestD
from .remaining_native_solving_d import VisibilityCapacityReleaseRequestD
from .remaining_native_solving_d import VisibilityServiceWhyRequestD
from .remaining_native_solving_d import VisibilityNavigationGoalRequestD
from .remaining_native_solving_d import ActorResultPreimagesRequestD
from .remaining_native_solving_d import ActorProgramGoalRequestD
from .remaining_native_solving_d import PushAssignmentRequestD
from .remaining_native_solving_d import PushGoalRequestD
from .remaining_native_solving_d import AuthenticationModeAccessRequestD
from .remaining_native_solving_d import AuthenticationCalibrationRequestD
from .remaining_native_solving_d import SharedAutomataGoalRequestD
from .native_solving_contributions_d import QuantityHorizonGoalRequestD
from .native_solving_contributions_d import EndpointTransportGoalRequestD
from .native_solving_contributions_d import TemporalMatchGoalRequestD
from .native_solving_contributions_d import InventoryNavigationGoalRequestD
from .native_solving_contributions_d import OrderedTransferGoalRequestD
from .native_solving_contributions_d import BallisticContactGoalRequestD
from .native_solving_contributions_d import HiddenReceptionGoalRequestD
from .native_solving_contributions_d import FiniteSurvivalGoalRequestD
from .native_solving_contributions_d import AutonomousArrivalGoalRequestD
from .native_solving_contributions_d import ReferenceRestoreDamageRequestD
from .native_solving_contributions_d import ReferenceGoalRequestD
from .native_solving_contributions_d import MaterialDeliveryOrderRequestD
from .native_solving_contributions_d import MaterialRecycleRequestD
from .native_solving_contributions_d import MaterialWhyRequestD
from .native_solving_contributions_d import MaterialGoalRequestD
from .native_solving_contributions_d import DropPolicyPrefixRequestD
from .native_solving_contributions_d import DropWinFirstRequestD
from .native_solving_contributions_d import PiercingStockRequestD
from .native_solving_contributions_d import PiercingGoalRequestD
from .native_solving_contributions_d import CargoParallelRequestD
from .native_solving_contributions_d import CargoGoalRequestD
from .native_solving_contributions_d import LocalFieldClockRequestD
from .native_solving_contributions_d import LocalFieldInterferenceRequestD
from .native_solving_contributions_d import LocalFieldWindowRequestD
from .native_solving_contributions_d import LocalFieldWhyRequestD
from .native_solving_contributions_d import LocalFieldGoalRequestD
from .flow_goal_audit_d import FlowRiskRequestD
from .flow_goal_audit_d import FlowTimingRequestD
from .flow_goal_audit_d import FlowTraceRequestD
from .flow_goal_audit_d import FlowCascadeRequestD
from .flow_goal_audit_d import FlowColliderRequestD
from .flow_goal_audit_d import FlowWhyRequestD
from .flow_goal_audit_d import FlowGoalRequestD
from .symbol_coupling_support_audit_d import SupportRecoveryRequestD
from .symbol_coupling_support_audit_d import SupportCodeRequestD
from .symbol_coupling_support_audit_d import SupportGripRequestD
from .symbol_coupling_support_audit_d import SupportPivotRequestD
from .symbol_coupling_support_audit_d import HelperPauseScopeRequestD
from .symbol_coupling_support_audit_d import KeeperTravellerRequestD
from .symbol_coupling_support_audit_d import MemberMapsNotSidesRequestD
from .symbol_coupling_support_audit_d import UnseenProviderFrontierRequestD
from .symbol_coupling_support_audit_d import ConsumerSpecificSignatureRequestD
from .symbol_coupling_support_audit_d import JointSymbolOrderRequestD
from .symbol_coupling_support_audit_d import VisibilityResourceContractRequestD
from .symbol_coupling_support_audit_d import StationRendezvousRequestD
from .symbol_coupling_support_audit_d import LatchedTargetSequenceRequestD
from .program_recipe_goal_audit_d import RecipeOperatorGoalRequestD
from .program_recipe_goal_audit_d import FiniteInstructionDifferenceRequestD
from .program_recipe_goal_audit_d import FiniteInstructionPhaseRequestD
from .program_recipe_goal_audit_d import FiniteInstructionGoalRequestD
from .temporal_service_audit_d import GuardedRecordingCallRequestD
from .temporal_service_audit_d import TemporalProviderSelectionRequestD
from .temporal_service_audit_d import BoundedCommandClockRequestD
from .temporal_service_audit_d import RecordingObligationRequestD
from .temporal_service_audit_d import TemporalRecordingKernelRequestD
from .typed_transport_reduction_audit_d import ContinuedSolvabilityRequestD
from .typed_transport_reduction_audit_d import PersistentHelperClearanceRequestD
from .typed_transport_reduction_audit_d import SelectedJumpReconfigurationRequestD
from .typed_transport_reduction_audit_d import OrderedReductionTypesRequestD
from .typed_transport_reduction_audit_d import VariableTransportStopRequestD
from .typed_transport_reduction_audit_d import ForceVsMotionDomainRequestD
from .geometry_obligation_audit_d import OrientedIdentityRequestD
from .geometry_obligation_audit_d import JointNotAttachedRequestD
from .geometry_obligation_audit_d import EditableLocalTopologyRequestD
from .geometry_obligation_audit_d import MarkerBodyExclusionRequestD
from .geometry_obligation_audit_d import MarkerVectorsDegreeRequestD
from .geometry_obligation_audit_d import CoveredIdentityContextRequestD
from .geometry_obligation_audit_d import DiscriminatingPieceRequestD
from .geometry_obligation_audit_d import ReflectionParameterFirstRequestD
from .geometry_obligation_audit_d import ProjectionHiddenObligationsRequestD
from .service_composition_audit_d import UnfinishedProviderServiceRequestD
from .service_composition_audit_d import CostMarginTradeoffRequestD
from .service_composition_audit_d import ParallelEffectsRequestD
from .service_composition_audit_d import AssignmentCompositionRequestD
from .service_composition_audit_d import GuideAuthorityRequestD
from .service_composition_audit_d import GoalReassignmentRequestD
from .service_composition_audit_d import ConsumerReachabilityRequestD
from .service_composition_audit_d import AmplitudePrerequisiteRequestD
from .service_composition_audit_d import NonmonotoneFullStateRequestD
from .service_composition_audit_d import RequiredAlternativeServicesRequestD
from .service_composition_audit_d import ProviderBeneficiaryPartitionRequestD
from .incremental_domain_budget_d import IncrementalDomainBudgetRequestD
from .terminal_evidence_audit_d import UnobservedLevelsRequestD
from .terminal_evidence_audit_d import SameConditionCounterexamplesRequestD
from .terminal_evidence_audit_d import QuantifierCounterexamplesRequestD
from .terminal_evidence_audit_d import ConsumerChainAuditRequestD
from .terminal_evidence_audit_d import PendingOldEpochFacetsRequestD
from .persistent_body_primitive_d import PersistentBodyPrimitiveRequestD
from .sensing_transaction_d import SensingTransactionRequestD
from .destination_macro_d import DestinationMacroRequestD
from .autonomous_consumption_d import ConsumptionExternalPrimitiveRequestD
from .autonomous_consumption_d import QuotaScopedJourneysRequestD
from .autonomous_consumption_d import OpportunityConditionedModesRequestD
from .staged_replenishment_d import StagedReplenishmentRequestD
from .capture_external_primitive_d import CaptureExternalPrimitiveRequestD
from .relay_wave_arrivals_d import RelayWaveArrivalsRequestD
from .boundary_connectivity_d import BoundaryConnectivityRequestD
from .discriminating_exposure_d import DiscriminatingExposureRequestD
from .quantized_orbit_d import StaticOrbitPreimagesRequestD
from .quantized_orbit_d import OrbitExternalPrimitiveRequestD
from .quantized_orbit_d import QuantizedOrbitStepRequestD
from .quantized_orbit_d import LateralOrbitEngagementRequestD
from .configured_transit_d import ConfiguredTransitRequestD
from .policy_constrained_routing_d import PolicyConstrainedRoutingRequestD
from .photosensitive_transaction_d import PhotosensitiveTransactionRequestD
from .stateful_photo_contact_d import StatefulPhotoContactRequestD
from .endpoint_primitive_d import EndpointPrimitiveRequestD
from .occluded_catalogue_projection_d import OccludedCatalogueProjectionRequestD
from .seeded_partial_push_d import SeededPartialPushRequestD
from .occupancy_deferred_permission_d import OccupancyDeferredPermissionRequestD
from .window_processing_primitive_d import WindowProcessingPrimitiveRequestD
from .window_processing_d import SameBeatActivationClosureRequestD
from .window_processing_d import HomogeneousWindowEligibilityRequestD
from .labeled_predicate_induction_d import LabeledPredicateInductionRequestD
from .ordered_predicate_features_d import OrderedPredicateFeaturesRequestD
from .perishable_compartment_d import PerishableCompartmentRequestD
from .shared_work_primitive_d import SharedWorkPrimitiveRequestD
from .shared_work_snapshot_d import PrioritySnapshotReservationRequestD
from .shared_work_snapshot_d import SharedSnapshotOpportunitiesRequestD
from .compatible_source_residual_d import CompatibleSourceResidualRequestD
from .occluding_cone_d import OccludingConeRequestD
from .source_locked_pursuit_d import SourceLockedPursuitRequestD
from .inventory_release_domain_d import InventoryReleaseDomainRequestD
from .state_conditioned_attachment_d import StateConditionedAttachmentRequestD
from .ordered_front_reduction_d import OrderedFrontReductionRequestD
from .monotone_excavation_d import MonotoneExcavationRequestD
from .container_admission_d import ContainerAdmissionRequestD
from .ray_capture_domain_d import RayCaptureDomainRequestD
from .prescribed_transit_coincidence_d import PrescribedTransitCoincidenceRequestD
from .quantized_pair_equilibrium_d import QuantizedPairEquilibriumRequestD
from .periodic_profile_preimages_d import PeriodicProfilePreimagesRequestD
from .modular_phase_channels_d import ModularPhaseChannelsRequestD
from .hierarchical_probe_d import HierarchicalProbeRequestD
from .subset_observation_d import SubsetObservationRequestD
from .original_source_equilibrium_d import OriginalSourceEquilibriumRequestD
from .reciprocal_port_graph_d import ReciprocalPortGraphRequestD
from .catalogue_primitive_d import CataloguePrimitiveRequestD
from .identity_scoped_support_d import IdentityScopedSupportRequestD
from .rooted_prefix_marginals_d import RootedPrefixMarginalsRequestD
from .rigid_edit_primitive_d import RigidEditPrimitiveRequestD
from .indexed_prefix_primitive_d import IndexedPrefixPrimitiveRequestD
from .mechanical_family_contracts_d import DMechanicalResult, d_input_digest, d_map

if TYPE_CHECKING:
    from .mechanical_request_contracts import MechanicalResponseInput


class DCommonResponseBinding(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.d_common_response_binding.v1'
    native_request: CyclicCoverageRequest | FixedProgramRequest | BoundedJoystickRequest | TemporalFragmentRequest | VisualSequenceRequest | TopologicalRecolorRequest | CoupledMemberRequest | ReactiveCaptureRequest | NeighborhoodPatternRequest | LayeredPrefixRequest | PreviewPackingRequest | StationWorkbenchRequest | AxialFieldRequest | SupportedConstructionRequest | FiniteAlignmentRequest | VisibleVoxelRequest | DiscreteOpticsRequest | CadencedRailRequest | EndpointLandingRequestD | SingleVisitResidualRequestD | OrderedPathPrimitiveRequestD | FiniteAlignmentEvidenceRequestD | GuaranteeProbabilityRequestD | ExtensionScopeRequestD | MetricWhyRequestD | MetricGoalRequestD | VisualSequenceEvidenceRequestD | StationProfileEvidenceRequestD | TopologicalRecolorEvidenceRequestD | ReactiveCaptureEvidenceRequestD | NeighborhoodConstructionWhyRequestD | FiniteAlignmentWhyRequestD | SupportedConstructionWhyRequestD | SequencePredictionWhyRequestD | TemporalFragmentWhyRequestD | StationProfileWhyRequestD | PreviewPackingWhyRequestD | VoxelConstructionWhyRequestD | TopologicalSurfaceWhyRequestD | AdhesionWhyRequestD | AdhesionGoalRequestD | FixedOriginWhyRequestD | RailTransferWhyRequestD | ReactiveCaptureWhyRequestD | CyclicResidualWhyRequestD | WrapJointCallScopeD | WrapJointRequestScopeD | ChartedPermissionWhyRequestD | ChartedRouteGoalRequestD | StationCargoWhyRequestD | StationCargoGoalRequestD | PassageEntryWhyRequestD | PassageGoalRequestD | PatrolCallScopeD | PatrolRequestScopeD | WrapSeatingWhyRequestD | WrapSeatingGoalRequestD | FlowProfileRevalidationRequestD | FlowOrderAlternativesRequestD | FlowNetworkGoalRequestD | RefillContinuationRequestD | RememberedDarkExplorationRequestD | VisibilityCapacityReleaseRequestD | VisibilityServiceWhyRequestD | VisibilityNavigationGoalRequestD | ActorResultPreimagesRequestD | ActorProgramGoalRequestD | PushAssignmentRequestD | PushGoalRequestD | AuthenticationModeAccessRequestD | AuthenticationCalibrationRequestD | SharedAutomataGoalRequestD | QuantityHorizonGoalRequestD | EndpointTransportGoalRequestD | TemporalMatchGoalRequestD | InventoryNavigationGoalRequestD | OrderedTransferGoalRequestD | BallisticContactGoalRequestD | HiddenReceptionGoalRequestD | FiniteSurvivalGoalRequestD | AutonomousArrivalGoalRequestD | ReferenceRestoreDamageRequestD | ReferenceGoalRequestD | MaterialDeliveryOrderRequestD | MaterialRecycleRequestD | MaterialWhyRequestD | MaterialGoalRequestD | DropPolicyPrefixRequestD | DropWinFirstRequestD | PiercingStockRequestD | PiercingGoalRequestD | CargoParallelRequestD | CargoGoalRequestD | LocalFieldClockRequestD | LocalFieldInterferenceRequestD | LocalFieldWindowRequestD | LocalFieldWhyRequestD | LocalFieldGoalRequestD | FlowRiskRequestD | FlowTimingRequestD | FlowTraceRequestD | FlowCascadeRequestD | FlowColliderRequestD | FlowWhyRequestD | FlowGoalRequestD | SupportRecoveryRequestD | SupportCodeRequestD | SupportGripRequestD | SupportPivotRequestD | HelperPauseScopeRequestD | KeeperTravellerRequestD | MemberMapsNotSidesRequestD | UnseenProviderFrontierRequestD | ConsumerSpecificSignatureRequestD | JointSymbolOrderRequestD | VisibilityResourceContractRequestD | StationRendezvousRequestD | LatchedTargetSequenceRequestD | RecipeOperatorGoalRequestD | FiniteInstructionDifferenceRequestD | FiniteInstructionPhaseRequestD | FiniteInstructionGoalRequestD | GuardedRecordingCallRequestD | TemporalProviderSelectionRequestD | BoundedCommandClockRequestD | RecordingObligationRequestD | TemporalRecordingKernelRequestD | ContinuedSolvabilityRequestD | PersistentHelperClearanceRequestD | SelectedJumpReconfigurationRequestD | OrderedReductionTypesRequestD | VariableTransportStopRequestD | ForceVsMotionDomainRequestD | OrientedIdentityRequestD | JointNotAttachedRequestD | EditableLocalTopologyRequestD | MarkerBodyExclusionRequestD | MarkerVectorsDegreeRequestD | CoveredIdentityContextRequestD | DiscriminatingPieceRequestD | ReflectionParameterFirstRequestD | ProjectionHiddenObligationsRequestD | UnfinishedProviderServiceRequestD | CostMarginTradeoffRequestD | ParallelEffectsRequestD | AssignmentCompositionRequestD | GuideAuthorityRequestD | GoalReassignmentRequestD | ConsumerReachabilityRequestD | AmplitudePrerequisiteRequestD | NonmonotoneFullStateRequestD | RequiredAlternativeServicesRequestD | ProviderBeneficiaryPartitionRequestD | IncrementalDomainBudgetRequestD | UnobservedLevelsRequestD | SameConditionCounterexamplesRequestD | QuantifierCounterexamplesRequestD | ConsumerChainAuditRequestD | PendingOldEpochFacetsRequestD | PersistentBodyPrimitiveRequestD | SensingTransactionRequestD | DestinationMacroRequestD | ConsumptionExternalPrimitiveRequestD | QuotaScopedJourneysRequestD | OpportunityConditionedModesRequestD | StagedReplenishmentRequestD | CaptureExternalPrimitiveRequestD | RelayWaveArrivalsRequestD | BoundaryConnectivityRequestD | DiscriminatingExposureRequestD | StaticOrbitPreimagesRequestD | OrbitExternalPrimitiveRequestD | QuantizedOrbitStepRequestD | LateralOrbitEngagementRequestD | ConfiguredTransitRequestD | PolicyConstrainedRoutingRequestD | PhotosensitiveTransactionRequestD | StatefulPhotoContactRequestD | EndpointPrimitiveRequestD | OccludedCatalogueProjectionRequestD | SeededPartialPushRequestD | OccupancyDeferredPermissionRequestD | WindowProcessingPrimitiveRequestD | SameBeatActivationClosureRequestD | HomogeneousWindowEligibilityRequestD | LabeledPredicateInductionRequestD | OrderedPredicateFeaturesRequestD | PerishableCompartmentRequestD | SharedWorkPrimitiveRequestD | PrioritySnapshotReservationRequestD | SharedSnapshotOpportunitiesRequestD | CompatibleSourceResidualRequestD | OccludingConeRequestD | SourceLockedPursuitRequestD | InventoryReleaseDomainRequestD | StateConditionedAttachmentRequestD | OrderedFrontReductionRequestD | MonotoneExcavationRequestD | ContainerAdmissionRequestD | RayCaptureDomainRequestD | PrescribedTransitCoincidenceRequestD | QuantizedPairEquilibriumRequestD | PeriodicProfilePreimagesRequestD | ModularPhaseChannelsRequestD | HierarchicalProbeRequestD | SubsetObservationRequestD | OriginalSourceEquilibriumRequestD | ReciprocalPortGraphRequestD | CataloguePrimitiveRequestD | IdentityScopedSupportRequestD | RootedPrefixMarginalsRequestD | RigidEditPrimitiveRequestD | IndexedPrefixPrimitiveRequestD
    native_result: DMechanicalResult
    # SRC supplies the exact common identity and its status/cause constants.
    request_identity: FrozenMap
    source_status: Ref
    missing_cause: Literal['MISSING_OBSERVATION', 'UNSUPPORTED_MODEL', 'SIGNATURE_MISMATCH',
        'MISSING_IMPLEMENTATION', 'DOMAIN_EXHAUSTED', 'COMPUTATION_BOUND'] | None
    retained_alternative_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    eligible_sibling_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    distinguishing_question_ref: Ref | None = None
    # Distinct-domain coverage is Source-bound. Work-budget visits are NOT a
    # distinct-domain receipt; this adapter never equates the two counts.
    domain_receipt: FrozenMap | None = None
    consumed_request_refs: tuple[Ref, ...] = Field(default=(), max_length=256)


def assemble_d_common_response(binding: DCommonResponseBinding) -> 'MechanicalResponseInput':
    from .mechanical_request_contracts import (
        MechanicalRequestIdentity, MechanicalResponseInput, MechanicalDomainReceipt,
    )

    identity = MechanicalRequestIdentity.model_validate(dict(binding.request_identity))
    original, result = binding.native_request, binding.native_result
    scope = original.scope
    expected = (scope.request_ref, original.operation_ref, original.mode_ref,
                scope.caller_ref, scope.parent_contribution_ref, scope.epoch)
    actual = (identity.request_ref, identity.operation_ref, identity.mode,
              identity.caller_ref, identity.parent_contribution_ref, identity.epoch)
    if actual != expected:
        raise ValueError('D_COMMON_CALLER_SIGNATURE_MISMATCH')
    if identity.immutable_inputs.get('d_native_scope') != d_map(scope.model_dump()):
        raise ValueError('D_COMMON_SCOPE_NOT_PRESERVED')
    if identity.immutable_inputs.get('d_input_digest') != d_input_digest(original):
        raise ValueError('D_COMMON_IMMUTABLE_INPUT_NOT_BOUND')
    actual_bounds = d_map({'node_bound': original.node_bound, 'depth_bound': original.depth_bound,
        'domain_bound': original.domain_bound, 'time_bound_ms': original.time_bound_ms})
    if identity.actual_bounds != actual_bounds:
        raise ValueError('D_COMMON_ACTUAL_BOUNDS_MISMATCH')
    # Common max-bound validation is explicit: a larger D request is rejected,
    # never clamped or converted to invented time units.
    returned = identity.model_copy(update={
        'request_ref': result.scope.request_ref, 'caller_ref': result.scope.caller_ref,
        'parent_contribution_ref': result.scope.parent_contribution_ref, 'epoch': result.scope.epoch,
        'operation_ref': result.operation_ref, 'mode': result.mode_ref,
        'immutable_inputs': FrozenMap.overlay(
            {'d_native_scope': d_map(result.scope.model_dump())}, identity.immutable_inputs),
    })
    receipt = None if binding.domain_receipt is None else MechanicalDomainReceipt.model_validate(dict(binding.domain_receipt))
    return MechanicalResponseInput(request=identity, returned_identity=returned,
        source_status=binding.source_status, returned_type=result.schema_version,
        descriptive_values=d_map({'d_scope': result.scope, 'native_status': result.status,
            'native_cause': result.cause, 'values': result.values, 'descriptive_facts': result.descriptive_facts,
            'calculation_domain_complete': result.domain_complete, 'work_visit_count': result.examined_count}),
        retained_alternative_refs=binding.retained_alternative_refs,
        eligible_sibling_refs=binding.eligible_sibling_refs,
        distinguishing_question_ref=binding.distinguishing_question_ref,
        missing_cause=binding.missing_cause, domain_receipt=receipt,
        consumed_request_refs=binding.consumed_request_refs, retained_frontier=result.frontier)


def mechanical_family_return_entries_d(entry_factory, common_response_model):
    """Central owner supplies the existing common output type, not a clone."""
    return (entry_factory(capability_id='capability.d_common_response_assembly',
        implementation=assemble_d_common_response, input_model=DCommonResponseBinding,
        output_model=common_response_model, source_file='mechanical_family_return_adapter_d.py',
        applicability=('source_bound_common_identity_and_status_constants',),
        invariants=('no_normalizer_or_status_selection', 'full_parent_and_model_correlation_preserved',
                    'actual_work_count_not_distinct_domain_coverage', 'no_act'),
        falsifiers=('scope_or_revision_mismatch', 'bounds_silently_clamped', 'global_feasibility_invented')),)
