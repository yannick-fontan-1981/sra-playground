"""Bounded, unadopted STEP mathematics for a Source-selected fixed rigid model.

No search, role choice, action release or per-node reasoning normalization.
The existing D kernel and C packet projection revalidate each hypothetical
state. Source alone admits the aggregate and appends it to the existing K09.
"""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref, stable_digest, immutable_json_data
from .mechanical_search_driver_contracts_c import SearchDriverSessionC, SearchNextStepInputC
from .mechanical_search_driver_c import prepare_requested_search_step, _session_facts
from .mechanical_step_contracts_c import ExternalStepInputC, ExternalStepMeasurementC
from .mechanical_family_contracts_d import DMechanicalResult
from .mechanical_profile_d import measure_d_native_profile
from .rigid_edit_primitive_d import measure_rigid_edit_primitive_d
from .rigid_edit_search_contracts_c import RigidEditSearchTemplateC
from .rigid_edit_search_transport_c import project_rigid_step_math
from .mechanical_transport_c import packet_payload


class RigidSearchBatchInputC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.rigid_search_batch_input_c.v1'
    session: SearchDriverSessionC
    maximum_rows: int = Field(ge=1, le=64)
    maximum_native_nodes: int = Field(ge=1, le=6400000)


class RigidSearchBatchPreparedC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.rigid_search_batch_prepared_c.v1'
    request: RigidSearchBatchInputC
    rows: tuple[ExternalStepInputC, ...] = Field(default=(), max_length=64)
    missing_refs: tuple[Ref, ...] = ()
    input_digest: Ref
    facts: FrozenMap


class RigidSearchBatchMeasuredC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.rigid_search_batch_measured_c.v1'
    prepared: RigidSearchBatchPreparedC
    native_results: tuple[DMechanicalResult, ...] = Field(max_length=64)
    measurements: tuple[ExternalStepMeasurementC, ...] = Field(max_length=64)
    missing_refs: tuple[Ref, ...]
    facts: FrozenMap


class RigidSearchBatchFinishC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.rigid_search_batch_finish_c.v1'
    prepared: RigidSearchBatchPreparedC
    measured: RigidSearchBatchMeasuredC | None
    source_append: bool
    used_batch: bool
    source_status: Ref
    missing_cause: Ref | None


class RigidSearchBatchDispatchC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.rigid_search_batch_dispatch_c.v1'
    session: SearchDriverSessionC
    used_batch: bool
    source_status: Ref
    missing_cause: Ref | None


class RigidSearchBatchLegacyInputC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.rigid_search_batch_legacy_input_c.v1'
    batch_flag: bool
    dispatched: RigidSearchBatchDispatchC | None


class RigidSearchBatchLegacyFlagC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.rigid_search_batch_legacy_flag_c.v1'
    legacy_required: bool


class RigidSearchBatchReadC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.rigid_search_batch_read_c.v1'
    dispatched: RigidSearchBatchDispatchC | None


def transport_rigid_search_batch_flag(value: RigidSearchBatchLegacyInputC) -> RigidSearchBatchLegacyFlagC:
    if value.batch_flag and value.dispatched is None:
        raise ValueError('Source batch routing lost its exact dispatch')
    return RigidSearchBatchLegacyFlagC(legacy_required=not value.batch_flag or not value.dispatched.used_batch)


def prepare_rigid_search_batch(value: RigidSearchBatchInputC) -> RigidSearchBatchPreparedC:
    session, query = value.session, value.session.request.query
    enabled = session.request.pure_rigid_batch
    providers = session.request.providers
    rigid_count = sum(isinstance(row.template,RigidEditSearchTemplateC) for row in providers)
    fixed = (len(providers) == 1 and rigid_count == 1
        and query.retained_model_refs == (providers[0].model_ref,))
    bound = query.request.immutable_inputs.get('pure_rigid_batch') is True
    remaining = max(0,query.request.actual_bounds.get('max_candidates',0)-session.actual_step_call_count)
    count = min(value.maximum_rows,remaining,len(session.result.requested_steps))
    rows, missing, binding_work = [], [], 0
    if enabled and fixed and not bound:
        missing.append('measurement.rigid_batch.current_source_contract_binding')
    if enabled and fixed and bound:
        for needed in session.result.requested_steps[:count]:
            try:
                row = prepare_requested_search_step(SearchNextStepInputC(session=session,needed=needed))
            except (ValueError,StopIteration):
                missing.append('measurement.rigid_batch.current_row_binding.'+stable_digest(needed))
                continue
            profile = measure_d_native_profile(row.d_profile)
            missing.extend(profile.missing_refs)
            if profile.frontier:
                missing.append('measurement.rigid_batch.profile_binding_frontier')
            binding_work += profile.examined_count
            rows.append(row)
    node_upper = sum(row.d_profile.native_request.node_bound for row in rows)
    profile_header = providers[0].template.profile if fixed else None
    native_header = profile_header.native_request if profile_header is not None else None
    digest = stable_digest((query.request,session.actual_step_call_count,tuple(rows)))
    return RigidSearchBatchPreparedC(request=value,rows=tuple(rows),
        missing_refs=tuple(dict.fromkeys(missing)),input_digest=digest,facts=FrozenMap({
            'source_opt_in':enabled,'fixed_rigid_provider':fixed,'source_opt_in_bound':bound,
            'profile_ref':profile_header.profile_ref if profile_header is not None else None,
            'native_type_ref':type(native_header).__name__ if native_header is not None else None,
            'native_operation_ref':native_header.operation_ref if native_header is not None else None,
            'native_mode_ref':native_header.mode_ref if native_header is not None else None,
            'native_phase_ref':native_header.phase_ref if native_header is not None else None,
            'requested_row_count':count,'bound_row_count':len(rows),'missing_binding_count':len(missing),
            'all_rows_bound':len(rows)==count,
            'native_node_bound_within_limit':node_upper <= value.maximum_native_nodes,
            'native_node_upper_bound':node_upper,'binding_check_count':binding_work,
            'step_budget_remaining':remaining>0}))


def calculate_rigid_search_batch(value: RigidSearchBatchPreparedC) -> RigidSearchBatchMeasuredC:
    # Validation is mechanical. The Source admission policy supplies permission;
    # neither this function nor the D kernel chooses another family or strategy.
    if (not value.rows or value.missing_refs or len(value.rows) != value.facts['requested_row_count']
            or value.input_digest != stable_digest((value.request.session.request.query.request,
                value.request.session.actual_step_call_count,value.rows))
            or sum(row.d_profile.native_request.node_bound for row in value.rows) > value.request.maximum_native_nodes):
        raise ValueError('Source rigid batch requires every bounded current row')
    results, measurements, missing = [], [], []
    for row in value.rows:
        result = measure_rigid_edit_primitive_d(row.d_profile.native_request)
        measured = project_rigid_step_math(row,result)
        results.append(result)
        measurements.append(measured)
        missing.extend(measured.missing_refs)
    incomplete = tuple(row for row in results if not row.domain_complete or row.frontier)
    packets = tuple(row.packet for row in measurements if row.packet is not None)
    return RigidSearchBatchMeasuredC(prepared=value,native_results=tuple(results),
        measurements=tuple(measurements),missing_refs=tuple(dict.fromkeys(missing)),facts=FrozenMap({
            'row_count':len(value.rows),'packet_count':len(packets),
            'all_packets_present':len(packets)==len(value.rows),
            'all_native_complete':not incomplete,
            'all_native_statuses_complete':all(row.status=='COMPLETE' for row in results),
            'all_packet_identities_equal':all(row.facts['identity_equal'] for row in measurements),
            'missing_packet_count':len(missing),
            'first_incomplete_native_cause':incomplete[0].cause if incomplete else None,
            'native_node_count':sum(row.examined_count for row in results)}))


def finish_rigid_search_batch(value: RigidSearchBatchFinishC) -> RigidSearchBatchDispatchC:
    prepared, measured = value.prepared, value.measured
    session = prepared.request.session
    query = session.request.query
    calls = len(measured.native_results) if measured is not None else 0
    nodes = sum(row.examined_count for row in measured.native_results) if measured is not None else 0
    if measured is not None and measured.prepared != prepared:
        raise ValueError('batch return changes its exact prepared input')
    if value.source_append:
        if (measured is None or not measured.measurements or measured.missing_refs
                or calls != len(prepared.rows) or any(row.packet is None for row in measured.measurements)
                or any(not row.domain_complete or row.frontier for row in measured.native_results)):
            raise ValueError('Source append requires all exact complete mathematical packets')
        packets = tuple(row.packet for row in measured.measurements)
        if any(packet.parent_request != query.request for packet in packets):
            raise ValueError('batch packet changes the parent query')
        query = query.model_copy(update={'packets':(*query.packets,*packets),
            'route_checkpoint':session.result.route_checkpoint,'continuation':session.result.continuation})
    count = session.actual_step_call_count+calls
    frontier = session.rigid_batch_frontier
    if value.used_batch and not value.source_append:
        frontier = FrozenMap({'batch_input_digest':prepared.input_digest,
            'missing_binding_refs':prepared.missing_refs,
            'missing_packet_refs':measured.missing_refs if measured is not None else (),
            'native_results':tuple(immutable_json_data(row) for row in measured.native_results) if measured is not None else (),
            'partial_packets':tuple(packet_payload(row.packet) for row in measured.measurements
                if row.packet is not None) if measured is not None else ()})
    request = session.request.model_copy(update={'query':query})
    session = session.model_copy(update={'request':request,'actual_step_call_count':count,
        'step_budget_remaining':count<query.request.actual_bounds.get('max_candidates',0),
        'failed_return':value.source_status if value.used_batch and not value.source_append else session.failed_return,
        'rigid_batch_frontier':frontier,
        'pure_rigid_kernel_call_count':session.pure_rigid_kernel_call_count+calls,
        'pure_rigid_native_node_count':session.pure_rigid_native_node_count+nodes,
        'pure_rigid_batch_count':session.pure_rigid_batch_count+(1 if measured is not None else 0),
        'facts':_session_facts(request,session.result,count)})
    return RigidSearchBatchDispatchC(session=session,used_batch=value.used_batch,
        source_status=value.source_status,missing_cause=value.missing_cause)


def read_rigid_search_batch_session(value: RigidSearchBatchReadC) -> SearchDriverSessionC:
    if value.dispatched is None:
        raise ValueError('Source must bind a completed dispatch before reading its session')
    return value.dispatched.session
