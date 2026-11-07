"""Exact D-native identity and receipt transport, without status selection."""
from pydantic import model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref,immutable_json_data
from .mechanical_family_contracts_d import DMechanicalRequest,DMechanicalResult
from .mechanical_request_contracts import MechanicalRequestIdentity
from .mechanical_return_a import mechanical_request_identity_a
from .articulated_dependency_measurement_c import _nodes
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

D_FRONTIER_MODELS={
    'cyclic_coverage':CyclicCoverageRequest,'fixed_origin':FixedProgramRequest,
    'temporal_fragment':TemporalFragmentRequest,'visual_sequence':VisualSequenceRequest,
    'topological_recolor':TopologicalRecolorRequest,'reactive_capture':ReactiveCaptureRequest,
    'neighborhood_pattern':NeighborhoodPatternRequest,'layered_prefix':LayeredPrefixRequest,
    'preview_packing':PreviewPackingRequest,'station_profile':StationWorkbenchRequest,
    'supported_construction':SupportedConstructionRequest,'visible_voxel':VisibleVoxelRequest,
    'cadenced_rail':CadencedRailRequest,'discrete_optics':DiscreteOpticsRequest,'finite_alignment':FiniteAlignmentRequest,
    'gravity_adhesion':CoupledMemberRequest}
D_FRONTIER_KERNELS={
    'cyclic_coverage':'mechanics.cyclic_configuration_coverage','fixed_origin':'mechanics.fixed_program_origin',
    'temporal_fragment':'mechanics.temporal_fragment_match','visual_sequence':'mechanics.visual_sequence',
    'topological_recolor':'mechanics.topological_region_recolor','reactive_capture':'mechanics.reactive_capture',
    'neighborhood_pattern':'mechanics.neighborhood_pattern_construction','layered_prefix':'mechanics.layered_prefix_construction',
    'preview_packing':'mechanics.preview_piece_packing','station_profile':'mechanics.station_profile_workbench',
    'supported_construction':'mechanics.supported_construction','visible_voxel':'mechanics.visible_voxel_construction',
    'cadenced_rail':'mechanics.cadenced_rail_transfer','discrete_optics':'mechanics.discrete_relay_optics','finite_alignment':'mechanics.finite_alignment_game',
    'gravity_adhesion':'mechanics.coupled_member_control'}


class EffectFrontierDIdentityInputD(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.effect_frontier_d_identity_input.v1'
    family: Ref
    expected_identity: MechanicalRequestIdentity
    native_request: CyclicCoverageRequest | FixedProgramRequest | TemporalFragmentRequest | VisualSequenceRequest | TopologicalRecolorRequest | ReactiveCaptureRequest | NeighborhoodPatternRequest | LayeredPrefixRequest | PreviewPackingRequest | StationWorkbenchRequest | SupportedConstructionRequest | VisibleVoxelRequest | CadencedRailRequest | DiscreteOpticsRequest | FiniteAlignmentRequest | CoupledMemberRequest

    @model_validator(mode='before')
    @classmethod
    def parse_declared_family(cls,value):
        return parse_d_frontier_native(value)

    @model_validator(mode='after')
    def exact_native_family(self):
        if self.family not in D_FRONTIER_MODELS or not isinstance(self.native_request,D_FRONTIER_MODELS[self.family]):
            raise ValueError('one explicit Source family with its complete native request')
        return self


def parse_d_frontier_native(value):
    if not isinstance(value,(dict,FrozenMap)):return value
    family=value.get('family');raw=value.get('native_request')
    if isinstance(family,str) and family in D_FRONTIER_MODELS and isinstance(raw,(dict,FrozenMap)):
        model=D_FRONTIER_MODELS[family]
        if raw.get('schema_version',model.model_fields['schema_version'].default)!=model.model_fields['schema_version'].default:
            raise ValueError('native schema identity must match the explicit family')
        return {**dict(value),'native_request':model.model_validate(raw)}
    return value


def frontier_native_mode_d(native):
    return native.mode_ref if isinstance(native,DMechanicalRequest) else native.mode


class EffectFrontierDIdentityFactsD(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.effect_frontier_d_identity_facts.v1'
    identity: MechanicalRequestIdentity
    matches_expected: bool


def frontier_native_work_bound_d(native):
    return native.node_bound if isinstance(native,DMechanicalRequest) else native.maximum_evaluations


def frontier_native_identity_d(native,kernel):
    if isinstance(native,MetricFrontierRequestD):return native.calculation_request.identity
    if not isinstance(native,DMechanicalRequest):
        return mechanical_request_identity_a(native,kernel,native.scope,native.operation_ref,native.mode)
    bounds=FrozenMap({name:getattr(native,name) for name in ('node_bound','depth_bound','domain_bound','time_bound_ms')})
    # The common identity's numeric bound is retained, never silently clamped.
    return mechanical_request_identity_a(native,kernel,native.scope,native.operation_ref,native.mode_ref,bounds).model_copy(
        update={'expected_return_type':'yf_arc3_v5.d_mechanical_result.v1'})


def bind_effect_frontier_d_identity(value):
    identity=frontier_native_identity_d(value.native_request,D_FRONTIER_KERNELS[value.family])
    return EffectFrontierDIdentityFactsD(identity=identity,matches_expected=identity==value.expected_identity)


def qualify_d_frontier_return(measured,returned):
    native=measured.request.native_request;missing=list(measured.missing_refs);result=None
    if not isinstance(returned,DMechanicalResult):missing.append('effect.frontier_exact_typed_d_return')
    elif (returned.scope!=native.scope or returned.operation_ref!=native.operation_ref or returned.mode_ref!=native.mode_ref):
        missing.append('effect.frontier_exact_d_scope_operation_mode')
    else:
        result=returned
        if (native.operation_ref,native.mode_ref) not in native.signature_pairs:
            missing.append('effect.frontier_d_signature_is_declared')
        if returned.status!='COMPLETE' or not returned.domain_complete or returned.frontier:
            missing.append('effect.frontier_incomplete_d_native_domain')
        if returned.descriptive_facts.get('primitive_release_authorized') is not False:
            missing.append('effect.frontier_d_result_has_no_execution_authority')
        for name in ('request_ref','caller_ref','parent_consumer_ref','parent_goal_ref','parent_contribution_ref','caller_next_item_ref','epoch','evidence_revision_ref','model_revision_ref','event_owner_ref'):
            if returned.descriptive_facts.get(name)!=getattr(native.scope,name):
                missing.append('effect.frontier_d_return_preserves_declared_owner_and_continuation')
        for name in ('operation_ref','mode_ref','status','cause','domain_complete','examined_count'):
            if returned.descriptive_facts.get(name)!=getattr(returned,name):
                missing.append('effect.frontier_d_receipt_facts_match_typed_return')
    work=measured.accounted_evaluations+(returned.examined_count if isinstance(returned,DMechanicalResult) else 0)
    values=result.values if result is not None else FrozenMap()
    projection=_nodes(values,max(0,measured.request.maximum_evaluations-work))
    if projection is None:missing.append('effect.frontier_complete_d_result_projection_bound');values=FrozenMap()
    else:work+=projection
    return result,values,missing,work
