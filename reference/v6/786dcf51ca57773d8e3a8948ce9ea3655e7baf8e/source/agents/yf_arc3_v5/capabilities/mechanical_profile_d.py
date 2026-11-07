"""Native D profile binding and immutable common-return transport.

Profile recognition/dispatch and return-status meaning belong to SRC/DRM.
This module does not infer a family, create a goal or release an action.
"""
from __future__ import annotations

from time import monotonic
from typing import Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, immutable_json_data
from .mechanical_family_contracts_d import DMechanicalResult, d_input_digest, d_map
from .mechanical_family_return_adapter_d import DCommonResponseBinding, assemble_d_common_response
from .mechanical_request_contracts import MechanicalRequestIdentity, MechanicalNormalizedReturn, MechanicalResponseInput
from .mechanical_profile_b import FamilyJoinContinuationB
from .family_result_join import FamilyJoinCandidate, FamilyJoinGroup, FamilyJoinRequest, FamilyJoinResult

NativeRequestD = DCommonResponseBinding.model_fields['native_request'].annotation


class DProfileBinding(FrozenModel):
    binding_ref: Ref
    native_path: tuple[Ref | int, ...] = Field(min_length=1, max_length=12)
    value: FrozenMap
    status: Literal['OBSERVED', 'SUPPORTED_HYPOTHESIS', 'MISSING']
    epoch: int = Field(ge=0)
    evidence_revision_ref: Ref
    model_revision_ref: Ref
    evidence_refs: tuple[Ref, ...] = Field(default=(), max_length=64)
    model_ref: Ref | None = None
    falsifier_ref: Ref | None = None


class DProfileJoinEvidence(FrozenModel):
    namespace: Literal['dependency_revisions', 'assignments', 'resource_provenance']
    key_ref: Ref
    result_path: tuple[Ref | int, ...] = Field(min_length=1, max_length=12)


class DNativeProfileRequest(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.d_native_profile_request.v1'
    profile_ref: Ref
    native_request: NativeRequestD
    common_identity: MechanicalRequestIdentity
    parent_goal_ref: Ref
    parent_contribution_ref: Ref
    caller_ref: Ref
    question_ref: Ref
    episode_ref: Ref
    level_scope_ref: Ref
    scope_ref: Ref
    next_item_ref: Ref
    sibling_item_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    desired_future: FrozenMap
    utility_reason_ref: Ref
    goal_evidence_refs: tuple[Ref, ...] = Field(max_length=64)
    goal_epoch: int = Field(ge=0)
    goal_evidence_revision_ref: Ref
    usefulness_premise_refs: tuple[Ref, ...] = Field(max_length=64)
    morphology_premise_refs: tuple[Ref, ...] = Field(default=(), max_length=64)
    and_dependency_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    or_dependency_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    temporal_scope_ref: Ref
    falsifier_ref: Ref
    preservation_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    bindings: tuple[DProfileBinding, ...] = Field(default=(), max_length=256)
    required_binding_refs: tuple[Ref, ...] = Field(default=(), max_length=256)
    required_native_fields: tuple[Ref, ...] = Field(default=(), max_length=64)
    closure_enumerated: bool
    maximum_binding_checks: int = Field(ge=1, le=65536)
    time_bound_ms: int = Field(ge=1, le=65536)
    # The caller supplies the common coarse cause; the exact native cause is
    # retained independently. Neither is guessed by a Python classifier.
    missing_cause: Literal['MISSING_OBSERVATION', 'UNSUPPORTED_MODEL', 'SIGNATURE_MISMATCH',
        'MISSING_IMPLEMENTATION', 'DOMAIN_EXHAUSTED', 'COMPUTATION_BOUND']
    family_join: FamilyJoinContinuationB | None = None
    join_evidence: tuple[DProfileJoinEvidence, ...] = Field(default=(), max_length=256)
    maximum_join_evidence_checks: int = Field(ge=1, le=65536)

    @model_validator(mode='after')
    def unique_binding_identity(self):
        if len({row.binding_ref for row in self.bindings}) != len(self.bindings):
            raise ValueError('duplicate D profile binding identity')
        if len(set(self.required_binding_refs)) != len(self.required_binding_refs):
            raise ValueError('duplicate D profile required binding identity')
        if len(set(self.required_native_fields)) != len(self.required_native_fields):
            raise ValueError('duplicate D profile required native field')
        if len(self.desired_future) > 256:
            raise ValueError('D profile future exceeds declared map bound')
        if len({(row.namespace, row.key_ref) for row in self.join_evidence}) != len(self.join_evidence):
            raise ValueError('duplicate D profile join evidence key')
        return self


class DNativeProfileFacts(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.d_native_profile_facts.v1'
    descriptive_facts: FrozenMap
    missing_refs: tuple[Ref, ...]
    examined_count: int = Field(ge=0)
    frontier: FrozenMap


class DNativeProfileContribution(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.d_native_profile_contribution.v1'
    request: DNativeProfileRequest
    native_result: DMechanicalResult | None = None
    result: MechanicalNormalizedReturn | None = None
    blockers: tuple[Ref, ...] = ()
    next_item_ref: Ref
    sibling_item_refs: tuple[Ref, ...]
    retained_binding_frontier: FrozenMap = Field(default_factory=FrozenMap)
    parent_goal_unchanged: Literal[True] = True
    executable_authority: None = None
    family_join_request: FamilyJoinRequest | None = None
    family_join_result: FamilyJoinResult | None = None


class DProfileResponseAssembly(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.d_profile_response_assembly.v1'
    request: DNativeProfileRequest
    native_result: DMechanicalResult
    source_status: Ref
    missing_cause: Literal['MISSING_OBSERVATION', 'UNSUPPORTED_MODEL', 'SIGNATURE_MISMATCH',
        'MISSING_IMPLEMENTATION', 'DOMAIN_EXHAUSTED', 'COMPUTATION_BOUND'] | None
    retained_alternative_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    eligible_sibling_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    distinguishing_question_ref: Ref | None = None
    domain_receipt: FrozenMap | None = None
    consumed_request_refs: tuple[Ref, ...] = Field(default=(), max_length=256)


class DProfileCollection(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.d_profile_collection.v1'
    request: DNativeProfileRequest
    native_result: DMechanicalResult
    result: MechanicalNormalizedReturn


class DProfileBlocked(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.d_profile_blocked.v1'
    request: DNativeProfileRequest
    facts: DNativeProfileFacts
    source_blocker_ref: Ref


class DProfileExtraction(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.d_profile_extraction.v1'
    request: DNativeProfileRequest
    native_type_ref: Ref


class DProfileJoinAssembly(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.d_profile_join_assembly.v1'
    contribution: DNativeProfileContribution
    result: FamilyJoinResult


class DProfileNativeValue(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.d_profile_native_value.v1'
    native_request: NativeRequestD


class DProfileJoinPresence(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.d_profile_join_presence.v1'
    present: bool


def _native_at(value, path):
    for part in path:
        if isinstance(part, str) and isinstance(value, FrozenModel):
            if part not in type(value).model_fields or part not in value.model_fields_set:
                return False, None
            value = getattr(value, part)
        elif isinstance(part, str) and isinstance(value, FrozenMap):
            if part not in value:
                return False, None
            value = value[part]
        elif type(part) is int and isinstance(value, tuple) and 0 <= part < len(value):
            value = value[part]
        else:
            return False, None
    return True, immutable_json_data(value)


def _identity_matches(request):
    identity, native = request.common_identity, request.native_request
    scope = native.scope
    return (identity.request_ref == scope.request_ref and identity.operation_ref == native.operation_ref
        and identity.mode == native.mode_ref and identity.caller_ref == scope.caller_ref
        and identity.parent_contribution_ref == scope.parent_contribution_ref and identity.epoch == scope.epoch
        and identity.input_revision_ref == scope.evidence_revision_ref
        and identity.immutable_inputs.get('d_native_scope') == d_map(scope.model_dump())
        and identity.immutable_inputs.get('d_input_digest') == d_input_digest(native)
        and identity.actual_bounds == d_map({'node_bound': native.node_bound, 'depth_bound': native.depth_bound,
            'domain_bound': native.domain_bound, 'time_bound_ms': native.time_bound_ms}))


def measure_d_native_profile(request: DNativeProfileRequest) -> DNativeProfileFacts:
    native, scope = request.native_request, request.native_request.scope
    started, examined, missing, covered, supported, frontier = monotonic(), 0, [], set(), set(), {}
    # Compare the requested header before SRC can admit a native call. This is
    # the same registered signature boundary as the native validator, not a
    # declaration that every registered operation is fully implemented.
    if (native.operation_ref, native.mode_ref) not in native.signature_pairs:
        missing.append('profile.exact_registered_native_operation_mode')
    if native.requested_result_type != 'DMechanicalResult':
        missing.append('profile.exact_registered_native_result_type')
    if not scope.input_domain_complete:
        missing.append('profile.complete_source_declared_input_domain')
    if not all((scope.evidence_revision_ref, scope.model_revision_ref,
                scope.event_owner_ref, scope.caller_next_item_ref)):
        missing.append('profile.complete_native_request_scope_header')
    for index, binding in enumerate(request.bindings):
        work = len(binding.native_path)
        if examined + work > request.maximum_binding_checks or (monotonic() - started) * 1000 >= request.time_bound_ms:
            frontier = {'next_binding_index': index, 'pending_binding_refs': tuple(row.binding_ref for row in request.bindings[index:])}
            break
        examined += work
        present, current = _native_at(native, binding.native_path)
        valid = (binding.status != 'MISSING' and binding.epoch == scope.epoch
            and binding.evidence_revision_ref == scope.evidence_revision_ref and present
            and 'value' in binding.value and binding.value['value'] == current
            and (bool(binding.evidence_refs) if binding.status == 'OBSERVED' else
                binding.model_revision_ref == scope.model_revision_ref and binding.model_ref is not None and binding.falsifier_ref is not None))
        if not valid:
            missing.append(binding.binding_ref)
        else:
            supported.add(binding.binding_ref)
            if len(binding.native_path) == 1:
                covered.add(binding.native_path[0])
    transport = {'schema_version', 'scope', 'operation_ref', 'mode_ref', 'requested_result_type',
        'node_bound', 'depth_bound', 'domain_bound', 'time_bound_ms', 'resume_frontier'}
    supplied = native.model_fields_set - transport
    required_fields = supplied | set(request.required_native_fields)
    missing.extend('native_field.' + field for field in sorted(required_fields) if field not in covered)
    missing.extend(ref for ref in request.required_binding_refs if ref not in supported)
    current_scope = (scope.parent_goal_ref == request.parent_goal_ref and scope.parent_contribution_ref == request.parent_contribution_ref
        and scope.caller_ref == request.caller_ref and scope.parent_consumer_ref == request.question_ref
        and scope.caller_next_item_ref == request.next_item_ref and _identity_matches(request))
    current_future = (bool(request.desired_future) and bool(request.goal_evidence_refs) and bool(request.usefulness_premise_refs)
        and bool(request.utility_reason_ref) and bool(request.falsifier_ref) and request.goal_epoch == scope.epoch
        and request.goal_evidence_revision_ref == scope.evidence_revision_ref)
    if not current_scope:
        missing.append('profile.actual_caller_parent_identity')
    if not current_future:
        missing.append('profile.current_grounded_wanted_future')
    if not request.closure_enumerated:
        missing.append('profile.requested_closure_enumeration')
    if frontier:
        missing.append('profile.binding_computation_frontier')
    if (monotonic() - started) * 1000 >= request.time_bound_ms:
        frontier['time_bound_reached'] = True
        missing.append('profile.binding_time_frontier')
    distinct_missing = tuple(dict.fromkeys(missing))
    return DNativeProfileFacts(descriptive_facts=d_map({'profile_ref': request.profile_ref,
        'native_type_ref': type(native).__name__, 'current_scoped_closure': not distinct_missing,
        'native_operation_ref': native.operation_ref, 'native_mode_ref': native.mode_ref,
        'wanted_future_current': current_future, 'caller_parent_current': current_scope,
        'missing_refs': distinct_missing, 'next_item_ref': request.next_item_ref,
        'parent_goal_ref': request.parent_goal_ref, 'desired_future': request.desired_future,
        'utility_reason_ref': request.utility_reason_ref, 'usefulness_premise_refs': request.usefulness_premise_refs,
        'morphology_premise_refs': request.morphology_premise_refs, 'and_dependency_refs': request.and_dependency_refs,
        'or_dependency_refs': request.or_dependency_refs, 'temporal_scope_ref': request.temporal_scope_ref,
        'falsifier_ref': request.falsifier_ref, 'preservation_refs': request.preservation_refs,
        'no_family_strategy_or_goal_inferred': True}), missing_refs=distinct_missing,
        examined_count=examined, frontier=d_map(frontier))


def assemble_d_profile_response(value: DProfileResponseAssembly) -> MechanicalResponseInput:
    request = value.request
    if not _identity_matches(request):
        raise ValueError('D_PROFILE_COMMON_REQUEST_IDENTITY_NOT_ORIGINAL')
    if (value.native_result.scope != request.native_request.scope
            or value.native_result.operation_ref != request.native_request.operation_ref
            or value.native_result.mode_ref != request.native_request.mode_ref):
        raise ValueError('D_PROFILE_NATIVE_RETURN_SCOPE_NOT_ORIGINAL')
    return assemble_d_common_response(DCommonResponseBinding(native_request=request.native_request,
        native_result=value.native_result, request_identity=d_map(request.common_identity.model_dump()),
        source_status=value.source_status, missing_cause=value.missing_cause,
        retained_alternative_refs=value.retained_alternative_refs, eligible_sibling_refs=value.eligible_sibling_refs,
        distinguishing_question_ref=value.distinguishing_question_ref, domain_receipt=value.domain_receipt,
        consumed_request_refs=value.consumed_request_refs))


def collect_d_native_profile(value: DProfileCollection) -> DNativeProfileContribution:
    request = value.request
    if (value.result.request != request.common_identity or value.native_result.scope != request.native_request.scope
            or value.native_result.operation_ref != request.native_request.operation_ref
            or value.native_result.mode_ref != request.native_request.mode_ref):
        raise ValueError('D_PROFILE_RETURN_CHANGES_ORIGINAL_NATIVE_COMMON_IDENTITY')
    values = value.result.descriptive_values
    if (values.get('d_scope') != d_map(value.native_result.scope.model_dump())
            or values.get('values') != value.native_result.values
            or values.get('native_status') != value.native_result.status
            or values.get('native_cause') != value.native_result.cause
            or values.get('descriptive_facts') != value.native_result.descriptive_facts
            or values.get('calculation_domain_complete') != value.native_result.domain_complete
            or values.get('work_visit_count') != value.native_result.examined_count
            or value.result.retained_frontier != value.native_result.frontier):
        raise ValueError('D_PROFILE_NORMALIZED_RETURN_LOSES_NATIVE_VALUES_OR_CAUSE')
    blockers = [] if value.result.status == 'FOUND' else [value.result.cause or value.native_result.cause]
    join, frontier = None, {}
    if value.result.status == 'FOUND' and request.family_join is not None:
        context = request.family_join
        expected = {'parent_goal_ref': request.parent_goal_ref, 'episode_ref': request.episode_ref,
            'level_scope_ref': request.level_scope_ref, 'scope_ref': request.scope_ref,
            'question_ref': request.question_ref, 'consumer_ref': request.question_ref,
            'utility_reason_ref': request.utility_reason_ref, 'desired_predicate': request.desired_future,
            'usefulness_premise_refs': request.usefulness_premise_refs,
            'morphology_premise_refs': request.morphology_premise_refs,
            'and_dependency_refs': request.and_dependency_refs, 'or_dependency_refs': request.or_dependency_refs,
            'temporal_scope_ref': request.temporal_scope_ref, 'falsifier_ref': request.falsifier_ref}
        if (context.episode_ref != request.episode_ref or context.level_scope_ref != request.level_scope_ref
                or context.rationale.get('evidence_status') is None
                or any(context.rationale.get(key) != expected[key] for key in sorted(expected))):
            blockers.append('profile.join_current_parent_rationale')
        else:
            bindings = {(row.namespace, row.key_ref): row for row in request.join_evidence}
            checks, started = 0, monotonic()
            for namespace in ('dependency_revisions', 'assignments', 'resource_provenance'):
                constraints = getattr(context, namespace)
                for key in sorted(constraints):
                    binding = bindings.get((namespace, key))
                    if binding is None:
                        blockers.append('profile.join_unbound_result_key.' + namespace + '.' + key)
                        continue
                    if checks + len(binding.result_path) > request.maximum_join_evidence_checks or (monotonic() - started) * 1000 >= request.time_bound_ms:
                        frontier = {'join_namespace': namespace, 'next_key_ref': key}
                        blockers.append('profile.join_evidence_frontier')
                        break
                    checks += len(binding.result_path)
                    present, actual = _native_at(value.result, binding.result_path)
                    if not present or actual != constraints[key]:
                        blockers.append('profile.join_result_key_mismatch.' + namespace + '.' + key)
                if frontier:
                    break
        if not blockers:
            complete = (context.current_domain_complete and value.native_result.domain_complete
                and request.native_request.scope.input_domain_complete
                and not value.native_result.frontier and not value.result.retained_frontier)
            try:
                candidate = FamilyJoinCandidate(candidate_ref=context.current_candidate_ref, result=value.result,
                    dependency_revisions=context.dependency_revisions, assignments=context.assignments,
                    resource_provenance=context.resource_provenance, rationale=context.rationale,
                    preservation_refs=request.preservation_refs)
                join = FamilyJoinRequest(request_ref=context.request_ref, parent_goal_ref=request.parent_goal_ref,
                    episode_ref=request.episode_ref, level_scope_ref=request.level_scope_ref,
                    epoch=request.common_identity.epoch, groups=(FamilyJoinGroup(group_ref=request.profile_ref,
                        candidates=(candidate,), domain_complete=complete),) + context.peer_groups,
                    max_pairs=context.max_pairs, max_candidates=context.max_candidates)
            except ValueError:
                blockers.append('profile.join_peer_scope_or_candidate_contract')
    return DNativeProfileContribution(request=request, native_result=value.native_result, result=value.result,
        blockers=tuple(blockers), next_item_ref=request.next_item_ref, sibling_item_refs=request.sibling_item_refs,
        family_join_request=join, retained_binding_frontier=d_map(frontier))


def block_d_native_profile(value: DProfileBlocked) -> DNativeProfileContribution:
    return DNativeProfileContribution(request=value.request, blockers=value.facts.missing_refs + (value.source_blocker_ref,),
        next_item_ref=value.request.next_item_ref, sibling_item_refs=value.request.sibling_item_refs,
        retained_binding_frontier=value.facts.frontier)


def extract_d_profile_request(value: DProfileExtraction):
    if type(value.request.native_request).__name__ != value.native_type_ref:
        raise ValueError('D profile SRC requested another exact native type')
    return DProfileNativeValue(native_request=value.request.native_request)


def d_profile_join_presence(contribution: DNativeProfileContribution) -> DProfileJoinPresence:
    return DProfileJoinPresence(present=contribution.family_join_request is not None)


def read_d_profile_join(contribution: DNativeProfileContribution) -> FamilyJoinRequest:
    if contribution.family_join_request is None:
        raise ValueError('SRC must bind D join presence before reading it')
    return contribution.family_join_request


def attach_d_profile_join(value: DProfileJoinAssembly) -> DNativeProfileContribution:
    if value.result.request != value.contribution.family_join_request:
        raise ValueError('D joined return changes the exact requested contribution')
    return value.contribution.model_copy(update={'family_join_result': value.result})
