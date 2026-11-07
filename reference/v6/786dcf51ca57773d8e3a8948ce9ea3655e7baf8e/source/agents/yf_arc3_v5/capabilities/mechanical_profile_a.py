"""Goal-owned native A contributions, without a second root or B conversion.

This adapter binds evidence and transports a requested calculation. Family
strategy and composition-policy implementations remain separate obligations.
"""
from typing import Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref, immutable_json_data
from .mechanical_return_a import MechanicalReturnBindingA, mechanical_request_identity_a
from .mechanical_request_contracts import MechanicalNormalizedReturn
from .adversarial_drop_alignment import AdversarialDropRequest
from .chromatic_window_composition import ChromaticWindowRequest
from .consumable_reaction_network import ConsumableReactionRequest
from .feedback_code_identification import FeedbackCodeRequest
from .finite_relation_network import FiniteRelationRequest
from .identity_contact_authentication import IdentityContactRequest
from .oriented_cargo_handoffs import HandoffRequest
from .mechanical_profile_b import FamilyJoinContinuationB
from .family_result_join import FamilyJoinCandidate, FamilyJoinGroup, FamilyJoinRequest, FamilyJoinResult

NativeRequestA=MechanicalReturnBindingA.model_fields['request'].annotation
PROFILE_TYPES={
    'solving.adversarial_drop_alignment':AdversarialDropRequest,
    'solving.chromatic_window_composition':ChromaticWindowRequest,
    'solving.consumable_reaction_network':ConsumableReactionRequest,
    'solving.feedback_code_identification':FeedbackCodeRequest,
    'solving.finite_relation_network':FiniteRelationRequest,
    'solving.identity_contact_authentication':IdentityContactRequest,
    'solving.oriented_cargo_handoffs':HandoffRequest,
}


class NativeProfileBindingA(FrozenModel):
    binding_ref: Ref
    native_path: tuple[Ref | int,...] = Field(min_length=1,max_length=8)
    value: FrozenMap
    status: Literal['OBSERVED','SUPPORTED_HYPOTHESIS','MISSING']
    epoch: int = Field(ge=0)
    evidence_revision_ref: Ref
    model_revision_ref: Ref
    evidence_refs: tuple[Ref,...] = Field(max_length=32)
    model_ref: Ref | None = None
    falsifier_ref: Ref | None = None


class NativeProfileJoinEvidenceA(FrozenModel):
    namespace: Literal['dependency_revisions','assignments','resource_provenance']
    key_ref: Ref
    result_path: tuple[Ref | int,...] = Field(min_length=1,max_length=8)


class NativeProfileRequestA(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.native_profile_request_a.v1'
    profile_ref: Ref
    kernel_request: NativeRequestA
    parent_goal_ref: Ref
    parent_contribution_ref: Ref
    caller_ref: Ref
    episode_ref: Ref
    level_scope_ref: Ref
    question_ref: Ref
    scope_ref: Ref
    next_item_ref: Ref
    sibling_item_refs: tuple[Ref,...] = Field(max_length=128)
    desired_future: FrozenMap
    utility_reason_ref: Ref
    goal_evidence_refs: tuple[Ref,...] = Field(max_length=32)
    goal_epoch: int = Field(ge=0)
    goal_evidence_revision_ref: Ref
    usefulness_premise_refs: tuple[Ref,...] = Field(max_length=64)
    morphology_premise_refs: tuple[Ref,...] = Field(max_length=64)
    and_dependency_refs: tuple[Ref,...] = Field(max_length=128)
    or_dependency_refs: tuple[Ref,...] = Field(max_length=128)
    temporal_scope_ref: Ref
    falsifier_ref: Ref
    preservation_refs: tuple[Ref,...] = Field(max_length=128)
    bindings: tuple[NativeProfileBindingA,...] = Field(max_length=256)
    required_binding_refs: tuple[Ref,...] = Field(max_length=256)
    closure_enumerated: bool
    maximum_binding_checks: int = Field(ge=1,le=4096)
    maximum_join_evidence_checks: int = Field(ge=1,le=4096)
    family_join: FamilyJoinContinuationB | None = None
    join_evidence: tuple[NativeProfileJoinEvidenceA,...] = Field(default=(),max_length=256)
    @model_validator(mode='after')
    def unique_bindings(self):
        if len({r.binding_ref for r in self.bindings})!=len(self.bindings):raise ValueError('profile bindings have unique identities')
        if len(set(self.required_binding_refs))!=len(self.required_binding_refs):raise ValueError('required closure binding identities are distinct')
        if len({(r.namespace,r.key_ref) for r in self.join_evidence})!=len(self.join_evidence):raise ValueError('one result provenance binding per declared join key')
        if any(len(m)>256 for m in (self.desired_future,)):raise ValueError('profile future exceeds declared bound')
        return self


class NativeProfileFactsA(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.native_profile_facts_a.v1'
    descriptive_facts: FrozenMap
    missing_refs: tuple[Ref,...]
    examined_count: int = Field(ge=0)
    frontier: FrozenMap


class NativeProfileContributionA(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.native_profile_contribution_a.v1'
    request: NativeProfileRequestA
    result: MechanicalNormalizedReturn | None = None
    blockers: tuple[Ref,...] = ()
    next_item_ref: Ref
    sibling_item_refs: tuple[Ref,...]
    parent_goal_unchanged: Literal[True] = True
    executable_authority: None = None
    family_join_request: FamilyJoinRequest | None = None
    family_join_result: FamilyJoinResult | None = None
    join_requested: bool
    retained_binding_frontier: FrozenMap = Field(default_factory=FrozenMap)


class NativeProfileCollectionA(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.native_profile_collection_a.v1'
    profile_request: NativeProfileRequestA
    result: MechanicalNormalizedReturn


class NativeProfileBlockedA(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.native_profile_blocked_a.v1'
    profile_request: NativeProfileRequestA
    facts: NativeProfileFactsA


class NativeProfileJoinAssemblyA(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.native_profile_join_assembly_a.v1'
    contribution: NativeProfileContributionA
    joined_result: FamilyJoinResult


def _native_at(value,path):
    for part in path:
        if isinstance(part,str) and isinstance(value,FrozenModel):
            if part not in type(value).model_fields or part not in value.model_fields_set:return False,None
            value=getattr(value,part)
        elif isinstance(part,str) and isinstance(value,FrozenMap):
            if part not in value:return False,None
            value=value[part]
        elif type(part) is int and isinstance(value,tuple) and 0<=part<len(value):value=value[part]
        else:return False,None
    return True,immutable_json_data(value)


def measure_native_profile_a(request: NativeProfileRequestA) -> NativeProfileFactsA:
    native=request.kernel_request;scope=native.scope;missing=[];count=0;frontier={};covered=set();rows={r.binding_ref:r for r in request.bindings}
    for index,row in enumerate(request.bindings):
        work=max(1,len(row.native_path))
        if count+work>request.maximum_binding_checks:frontier={'next_binding_index':index,'pending_binding_refs':tuple(r.binding_ref for r in request.bindings[index:])};break
        count+=work;present,current=_native_at(native,row.native_path)
        supported=(row.status!='MISSING' and row.epoch==scope.epoch and row.evidence_revision_ref==scope.evidence_revision_ref
            and (row.status=='OBSERVED' or row.model_revision_ref==scope.model_revision_ref)
            and (bool(row.evidence_refs) if row.status=='OBSERVED' else row.model_ref is not None and row.falsifier_ref is not None)
            and present and 'value' in row.value and row.value['value']==current)
        if not supported:missing.append(row.binding_ref)
        elif len(row.native_path)==1:covered.add(row.native_path[0])
    # Every actually supplied data field belongs to this requested closure.
    supplied=tuple(sorted(f for f in native.model_fields_set if f not in ('schema_version','scope','operation_ref','mode') and not f.startswith('maximum_')))
    missing.extend('native_field.'+f for f in supplied if f not in covered)
    missing.extend(ref for ref in request.required_binding_refs if ref not in rows)
    scope_current=(scope.parent_goal_ref==request.parent_goal_ref and scope.parent_contribution_ref==request.parent_contribution_ref and scope.caller_ref==request.caller_ref)
    goal_current=(bool(request.desired_future) and bool(request.goal_evidence_refs) and bool(request.usefulness_premise_refs)
        and request.goal_epoch==scope.epoch and request.goal_evidence_revision_ref==scope.evidence_revision_ref)
    if not scope_current:missing.append('profile.actual_caller_parent_scope')
    if not goal_current:missing.append('profile.current_grounded_wanted_future')
    if not request.closure_enumerated:missing.append('profile.requested_closure_enumeration')
    if frontier:missing.append('profile.binding_computation_frontier')
    profile_type=PROFILE_TYPES.get(request.profile_ref);native_type_current=profile_type is not None and isinstance(native,profile_type)
    if not native_type_current:missing.append('profile.exact_declared_native_type')
    facts={'profile_ref':request.profile_ref,'current_scoped_closure':not missing,'native_type_current':native_type_current,
        'wanted_future_current':goal_current,'caller_parent_current':scope_current,'missing_refs':tuple(dict.fromkeys(missing)),
        'next_item_ref':request.next_item_ref,'parent_goal_ref':request.parent_goal_ref,'desired_future':request.desired_future,
        'utility_reason_ref':request.utility_reason_ref,'usefulness_premise_refs':request.usefulness_premise_refs,
        'morphology_premise_refs':request.morphology_premise_refs,'and_dependency_refs':request.and_dependency_refs,
        'or_dependency_refs':request.or_dependency_refs,'temporal_scope_ref':request.temporal_scope_ref,
        'falsifier_ref':request.falsifier_ref,'preservation_refs':request.preservation_refs,'strategy_inferred':False}
    return NativeProfileFactsA(descriptive_facts=immutable_json_data(facts),missing_refs=tuple(dict.fromkeys(missing)),examined_count=count,frontier=immutable_json_data(frontier))


def _exact_result(request,result):
    native=request.kernel_request;kernel='mechanics.'+request.profile_ref.removeprefix('solving.')
    expected=mechanical_request_identity_a(native,kernel,native.scope,native.operation_ref,native.mode)
    if result.request!=expected:raise ValueError('native profile result changes its exact A request identity')
    return expected


def collect_native_profile_a(value: NativeProfileCollectionA) -> NativeProfileContributionA:
    request=value.profile_request;result=value.result;identity=_exact_result(request,result);join=None;blockers=[];frontier={}
    if result.status!='FOUND':blockers.extend((result.cause or 'profile.non_found_native_return',))
    if request.family_join is not None and result.status=='FOUND':
        scope=request.family_join;rationale=scope.rationale
        required={'parent_goal_ref':request.parent_goal_ref,'episode_ref':request.episode_ref,'level_scope_ref':request.level_scope_ref,
            'scope_ref':request.scope_ref,'question_ref':request.question_ref,'consumer_ref':request.question_ref,
            'utility_reason_ref':request.utility_reason_ref,'desired_predicate':request.desired_future,
            'usefulness_premise_refs':request.usefulness_premise_refs,'morphology_premise_refs':request.morphology_premise_refs,
            'and_dependency_refs':request.and_dependency_refs,'or_dependency_refs':request.or_dependency_refs,
            'temporal_scope_ref':request.temporal_scope_ref,'falsifier_ref':request.falsifier_ref}
        if scope.episode_ref!=request.episode_ref or scope.level_scope_ref!=request.level_scope_ref or any(rationale.get(k)!=v for k,v in sorted(required.items())):
            blockers.append('profile.join_current_parent_rationale')
        else:
            rows={(r.namespace,r.key_ref):r for r in request.join_evidence};checks=0
            for namespace in ('dependency_revisions','assignments','resource_provenance'):
                for key in sorted(getattr(scope,namespace)):
                    row=rows.get((namespace,key))
                    if row is None:blockers.append('profile.join_unbound_result_key.'+namespace+'.'+key);continue
                    if checks+len(row.result_path)>request.maximum_join_evidence_checks:
                        frontier={'join_namespace':namespace,'next_key_ref':key,'reason':'profile.join_evidence_bound'};break
                    checks+=len(row.result_path);present,actual=_native_at(result,row.result_path)
                    if not present or actual!=getattr(scope,namespace)[key]:blockers.append('profile.join_result_key_mismatch.'+namespace+'.'+key)
                if frontier:break
            if frontier:blockers.append('profile.join_evidence_frontier')
        if not blockers:
            receipt=result.descriptive_values.get('calculation',FrozenMap())
            complete=scope.current_domain_complete and receipt.get('domain_complete') is True and not result.retained_frontier
            current=FamilyJoinCandidate(candidate_ref=scope.current_candidate_ref,result=result,dependency_revisions=scope.dependency_revisions,
                assignments=scope.assignments,resource_provenance=scope.resource_provenance,rationale=rationale,preservation_refs=request.preservation_refs)
            try:
                join=FamilyJoinRequest(request_ref=scope.request_ref,parent_goal_ref=request.parent_goal_ref,episode_ref=request.episode_ref,
                    level_scope_ref=request.level_scope_ref,epoch=identity.epoch,groups=(FamilyJoinGroup(group_ref=request.profile_ref,candidates=(current,),domain_complete=complete),)+scope.peer_groups,
                    max_pairs=scope.max_pairs,max_candidates=scope.max_candidates)
            except ValueError:
                blockers.append('profile.join_peer_scope_or_candidate_contract')
    return NativeProfileContributionA(request=request,result=result,blockers=tuple(blockers),next_item_ref=request.next_item_ref,
        sibling_item_refs=request.sibling_item_refs,family_join_request=join,join_requested=join is not None,retained_binding_frontier=immutable_json_data(frontier))


def block_native_profile_a(value: NativeProfileBlockedA) -> NativeProfileContributionA:
    request=value.profile_request
    return NativeProfileContributionA(request=request,blockers=value.facts.missing_refs,next_item_ref=request.next_item_ref,
        sibling_item_refs=request.sibling_item_refs,join_requested=False,retained_binding_frontier=value.facts.frontier)


def read_native_profile_join_a(contribution: NativeProfileContributionA) -> FamilyJoinRequest:
    if contribution.family_join_request is None:raise ValueError('SRC must bind the declared join presence before reading it')
    return contribution.family_join_request


def attach_native_profile_join_a(value: NativeProfileJoinAssemblyA) -> NativeProfileContributionA:
    if value.contribution.family_join_request!=value.joined_result.request:raise ValueError('joined return changes the requested parent contribution')
    return value.contribution.model_copy(update={'family_join_result':value.joined_result})


def _extract(request,expected):
    if not isinstance(request.kernel_request,expected):raise ValueError('SRC selected a different exact native request type')
    return request.kernel_request

def extract_adversarial_profile_a(request):return _extract(request,AdversarialDropRequest)
def extract_chromatic_profile_a(request):return _extract(request,ChromaticWindowRequest)
def extract_reaction_profile_a(request):return _extract(request,ConsumableReactionRequest)
def extract_feedback_profile_a(request):return _extract(request,FeedbackCodeRequest)
def extract_relation_profile_a(request):return _extract(request,FiniteRelationRequest)
def extract_identity_profile_a(request):return _extract(request,IdentityContactRequest)
def extract_cargo_profile_a(request):return _extract(request,HandoffRequest)
