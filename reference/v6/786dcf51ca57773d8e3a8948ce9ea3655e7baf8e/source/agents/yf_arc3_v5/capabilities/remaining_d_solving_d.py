"""Current goal questions and non-mutating evidence over existing D kernels.
No source computation grants action authority or rewrites the caller's goal.
"""
from typing import ClassVar
from agents.yf_arc3_v5.logos.types import Ref
from .native_goal_domain_audit_d import NativeGoalDomainBaseD
from .d_native_goal_domain_audit_d import measure_bound_d_native_goal_domain_d
from .coupled_member_control import CoupledMemberRequest,measure_coupled_member_control
from .cyclic_configuration_coverage import CyclicCoverageRequest,measure_cyclic_configuration_coverage
from .reactive_capture import ReactiveCaptureRequest,measure_reactive_capture
from .cadenced_rail_transfer import CadencedRailRequest,measure_cadenced_rail_transfer
from .fixed_program_origin import FixedProgramRequest,measure_fixed_program_origin
from .topological_region_recolor import TopologicalRecolorRequest,measure_topological_region_recolor
from .visible_voxel_construction import VisibleVoxelRequest,measure_visible_voxel_construction
from .preview_piece_packing import PreviewPackingRequest,measure_preview_piece_packing
from .station_profile_workbench import StationWorkbenchRequest,measure_station_profile_workbench
from .temporal_fragment_match import TemporalFragmentRequest,measure_temporal_fragment_match
from .visual_sequence import VisualSequenceRequest,measure_visual_sequence
from .supported_construction import SupportedConstructionRequest,measure_supported_construction
from .finite_alignment_game import FiniteAlignmentRequest,measure_finite_alignment_game
from .neighborhood_pattern_construction import NeighborhoodPatternRequest,measure_neighborhood_pattern_construction

class WrapJointRequestScopeD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.wrap_joint_request_d_request_d.v1'
    native_request: CoupledMemberRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.wrap_slide.request.joint','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=CoupledMemberRequest.signature_pairs


def measure_wrap_joint_request_d(request: WrapJointRequestScopeD):
    return measure_bound_d_native_goal_domain_d(request,measure_coupled_member_control)


class WrapJointCallScopeD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.wrap_joint_call_d_request_d.v1'
    native_request: CoupledMemberRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.wrap_slide.request.joint.call','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=CoupledMemberRequest.signature_pairs


def measure_wrap_joint_call_d(request: WrapJointCallScopeD):
    return measure_bound_d_native_goal_domain_d(request,measure_coupled_member_control)


class CyclicResidualWhyRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.cyclic_residual_why_d_request_d.v1'
    native_request: CyclicCoverageRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.cyclic_configuration_coverage.why','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.cyclic_configuration_coverage.product_sweep','COMPILE'),('mechanics.cyclic_configuration_coverage.residual_route','DOMAIN'),)


def measure_cyclic_residual_why_d(request: CyclicResidualWhyRequestD):
    return measure_bound_d_native_goal_domain_d(request,measure_cyclic_configuration_coverage)


class ReactiveCaptureWhyRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.reactive_capture_why_d_request_d.v1'
    native_request: ReactiveCaptureRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.reactive_capture.why','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.reactive_capture.capture_preimages','INVERSE_DOMAIN'),('mechanics.reactive_capture.barrier_services','INVERSE_DOMAIN'),)


def measure_reactive_capture_why_d(request: ReactiveCaptureWhyRequestD):
    return measure_bound_d_native_goal_domain_d(request,measure_reactive_capture)


class RailTransferWhyRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.rail_transfer_why_d_request_d.v1'
    native_request: CadencedRailRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.cadenced_rail_transfer.why','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.cadenced_rail_transfer.bay_alignment_preimages','INVERSE_DOMAIN'),('mechanics.cadenced_rail_transfer.buffer_repair_domains','INVERSE_DOMAIN'),('mechanics.cadenced_rail_transfer.word_certificate','COMPILE'),)


def measure_rail_transfer_why_d(request: RailTransferWhyRequestD):
    return measure_bound_d_native_goal_domain_d(request,measure_cadenced_rail_transfer)


class FixedOriginWhyRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.fixed_origin_why_d_request_d.v1'
    native_request: FixedProgramRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.fixed_program_origin.why','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.fixed_program_origin.safe_origin_preimages','INVERSE_DOMAIN'),('mechanics.fixed_program_origin.robust_origin_domain','DOMAIN'),)


def measure_fixed_origin_why_d(request: FixedOriginWhyRequestD):
    return measure_bound_d_native_goal_domain_d(request,measure_fixed_program_origin)


class AdhesionGoalRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.adhesion_goal_d_request_d.v1'
    native_request: CoupledMemberRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.gravity_adhesion','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.coupled_member_control.adhesion_viability_domain','DOMAIN'),)


def measure_adhesion_goal_d(request: AdhesionGoalRequestD):
    return measure_bound_d_native_goal_domain_d(request,measure_coupled_member_control)


class AdhesionWhyRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.adhesion_why_d_request_d.v1'
    native_request: CoupledMemberRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.gravity_adhesion.why','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.coupled_member_control.adhesion_staging_preimages','INVERSE_DOMAIN'),)


def measure_adhesion_why_d(request: AdhesionWhyRequestD):
    return measure_bound_d_native_goal_domain_d(request,measure_coupled_member_control)


class TopologicalSurfaceWhyRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.topological_surface_why_d_request_d.v1'
    native_request: TopologicalRecolorRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.topological_region_recolor.why','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.topological_region_recolor.target_surface_derive','DOMAIN'),('mechanics.topological_region_recolor.palette_plan','COMPILE'),)


def measure_topological_surface_why_d(request: TopologicalSurfaceWhyRequestD):
    return measure_bound_d_native_goal_domain_d(request,measure_topological_region_recolor)


class VoxelConstructionWhyRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.voxel_construction_why_d_request_d.v1'
    native_request: VisibleVoxelRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.visible_voxel_construction.why','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.visible_voxel_construction.legend_reconstruction_domain','INVERSE_DOMAIN'),('mechanics.visible_voxel_construction.construction_port_dependencies','PRECONDITION'),)


def measure_voxel_construction_why_d(request: VoxelConstructionWhyRequestD):
    return measure_bound_d_native_goal_domain_d(request,measure_visible_voxel_construction)


class PreviewPackingWhyRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.preview_packing_why_d_request_d.v1'
    native_request: PreviewPackingRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.preview_piece_packing.why','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.preview_piece_packing.residual_partition_domain','INVERSE_DOMAIN'),('mechanics.preview_piece_packing.costed_packing_paths','DOMAIN'),)


def measure_preview_packing_why_d(request: PreviewPackingWhyRequestD):
    return measure_bound_d_native_goal_domain_d(request,measure_preview_piece_packing)


class StationProfileWhyRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.station_profile_why_d_request_d.v1'
    native_request: StationWorkbenchRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.station_profile_workbench.why','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.station_profile_workbench.provider_preimage_domain','INVERSE_DOMAIN'),('mechanics.station_profile_workbench.costed_workshop_domain','DOMAIN'),)


def measure_station_profile_why_d(request: StationProfileWhyRequestD):
    return measure_bound_d_native_goal_domain_d(request,measure_station_profile_workbench)


class TemporalFragmentWhyRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.temporal_fragment_why_d_request_d.v1'
    native_request: TemporalFragmentRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.temporal_fragment_match.why','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.temporal_fragment_match.exact_candidates','MATCH'),('mechanics.temporal_fragment_match.compile_proposal','COMPILE'),)


def measure_temporal_fragment_why_d(request: TemporalFragmentWhyRequestD):
    return measure_bound_d_native_goal_domain_d(request,measure_temporal_fragment_match)


class SequencePredictionWhyRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.sequence_prediction_why_d_request_d.v1'
    native_request: VisualSequenceRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.visual_sequence.why','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.visual_sequence.missing_term_composition','COMPOSE'),('mechanics.visual_sequence.proposal_match','MATCH'),('mechanics.visual_sequence.answer_commitment','COMPILE'),)


def measure_sequence_prediction_why_d(request: SequencePredictionWhyRequestD):
    return measure_bound_d_native_goal_domain_d(request,measure_visual_sequence)


class SupportedConstructionWhyRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.supported_construction_why_d_request_d.v1'
    native_request: SupportedConstructionRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.supported_construction.why','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.supported_construction.prefix_plan','SEARCH'),('mechanics.supported_construction.resource_reservation','DOMAIN'),)


def measure_supported_construction_why_d(request: SupportedConstructionWhyRequestD):
    return measure_bound_d_native_goal_domain_d(request,measure_supported_construction)


class FiniteAlignmentWhyRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.finite_alignment_why_d_request_d.v1'
    native_request: FiniteAlignmentRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.finite_alignment_game.why','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.finite_alignment_game.tactical_domain','DOMAIN'),('mechanics.finite_alignment_game.position_value','SEARCH'),('mechanics.finite_alignment_game.sequential_objective','DOMAIN'),)


def measure_finite_alignment_why_d(request: FiniteAlignmentWhyRequestD):
    return measure_bound_d_native_goal_domain_d(request,measure_finite_alignment_game)


class NeighborhoodConstructionWhyRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.neighborhood_construction_why_d_request_d.v1'
    native_request: NeighborhoodPatternRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.neighborhood_pattern_construction.why','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.neighborhood_pattern_construction.color_preimages','INVERSE_DOMAIN'),('mechanics.neighborhood_pattern_construction.occurrence_assignment','DOMAIN'),('mechanics.neighborhood_pattern_construction.transport_schedule','SEARCH'),)


def measure_neighborhood_construction_why_d(request: NeighborhoodConstructionWhyRequestD):
    return measure_bound_d_native_goal_domain_d(request,measure_neighborhood_pattern_construction)


class ReactiveCaptureEvidenceRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.reactive_capture_evidence_d_request_d.v1'
    native_request: ReactiveCaptureRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.reactive_capture','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=tuple(pair for pair in ReactiveCaptureRequest.signature_pairs if pair[1] in ('MEASURE','FIT','CORRESPOND','COMPARE','RECONCILE','OBSERVE','RETAIN','UPDATE'))
    pure_evidence_purpose_ref: Ref
    pure_evidence_purpose_evidence_ref: Ref


def measure_reactive_capture_evidence_d(request: ReactiveCaptureEvidenceRequestD):
    return measure_bound_d_native_goal_domain_d(request,measure_reactive_capture)


class TopologicalRecolorEvidenceRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.topological_recolor_evidence_d_request_d.v1'
    native_request: TopologicalRecolorRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.topological_region_recolor','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=tuple(pair for pair in TopologicalRecolorRequest.signature_pairs if pair[1] in ('MEASURE','FIT','CORRESPOND','COMPARE','RECONCILE','OBSERVE','RETAIN','UPDATE'))
    pure_evidence_purpose_ref: Ref
    pure_evidence_purpose_evidence_ref: Ref


def measure_topological_recolor_evidence_d(request: TopologicalRecolorEvidenceRequestD):
    return measure_bound_d_native_goal_domain_d(request,measure_topological_region_recolor)


class StationProfileEvidenceRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.station_profile_evidence_d_request_d.v1'
    native_request: StationWorkbenchRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.station_profile_workbench','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=tuple(pair for pair in StationWorkbenchRequest.signature_pairs if pair[1] in ('MEASURE','FIT','CORRESPOND','COMPARE','RECONCILE','OBSERVE','RETAIN','UPDATE'))
    pure_evidence_purpose_ref: Ref
    pure_evidence_purpose_evidence_ref: Ref


def measure_station_profile_evidence_d(request: StationProfileEvidenceRequestD):
    return measure_bound_d_native_goal_domain_d(request,measure_station_profile_workbench)


class VisualSequenceEvidenceRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.visual_sequence_evidence_d_request_d.v1'
    native_request: VisualSequenceRequest
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.visual_sequence','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=tuple(pair for pair in VisualSequenceRequest.signature_pairs if pair[1] in ('MEASURE','FIT','CORRESPOND','COMPARE','RECONCILE','OBSERVE','RETAIN','UPDATE'))
    pure_evidence_purpose_ref: Ref
    pure_evidence_purpose_evidence_ref: Ref


def measure_visual_sequence_evidence_d(request: VisualSequenceEvidenceRequestD):
    return measure_bound_d_native_goal_domain_d(request,measure_visual_sequence)



