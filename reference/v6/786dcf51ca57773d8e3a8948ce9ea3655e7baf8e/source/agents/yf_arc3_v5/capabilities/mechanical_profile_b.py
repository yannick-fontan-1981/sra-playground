"""Bounded descriptive support for goal-owned mechanical profile requests.

The caller supplies the wanted future, utility, relevant closure and next item.
No family recognition, goal selection or environment command occurs here.
"""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.capabilities.mechanical_contracts_b import MechanicalRequestB
from agents.yf_arc3_v5.capabilities.mechanical_request_contracts import MechanicalNormalizedReturn
from agents.yf_arc3_v5.capabilities.family_result_join import (
    FamilyJoinCandidate, FamilyJoinGroup, FamilyJoinRequest, FamilyJoinResult,
)
from agents.yf_arc3_v5.capabilities.family_agenda_projection import (
    FamilyAgendaSnapshot,FamilyAgendaReceipt,project_family_agenda,demand_signature,return_equivalence_signature,
)
from agents.yf_arc3_v5.capabilities.mechanical_transport_b import request_identity_payload,binding_payload
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref, stable_digest


class MechanicalProfileBindingB(FrozenModel):
    ref: Ref
    status: Literal['OBSERVED','SUPPORTED_HYPOTHESIS','MISSING']
    value: FrozenMap = Field(default_factory=FrozenMap)
    epoch: int = Field(ge=0)
    input_revision_ref: Ref
    evidence_refs: tuple[Ref,...] = Field(default=(),max_length=32)
    model_ref: Ref | None = None
    falsifier_ref: Ref | None = None


class FamilyJoinContinuationB(FrozenModel):
    request_ref: Ref
    current_candidate_ref: Ref
    episode_ref: Ref
    level_scope_ref: Ref
    dependency_revisions: FrozenMap
    assignments: FrozenMap
    resource_provenance: FrozenMap
    rationale: FrozenMap
    peer_groups: tuple[FamilyJoinGroup,...] = Field(default=(),max_length=127)
    current_domain_complete: bool
    max_pairs: int = Field(ge=0,le=65536)
    max_candidates: int = Field(ge=0,le=4096)


class MechanicalProfileRequestB(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.mechanical_profile_request_b.v1'
    profile_ref: Ref
    phase: Literal['SOLVING','SEALED_EFFECT']
    kernel_request: MechanicalRequestB
    parent_goal_ref: Ref
    question_ref: Ref
    utility_reason_ref: Ref
    desired_future: FrozenMap
    goal_contract: FrozenMap
    goal_binding_refs: FrozenMap = Field(default_factory=FrozenMap)
    preservation_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    required_binding_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    bindings: tuple[MechanicalProfileBindingB,...] = Field(default=(),max_length=128)
    closure_enumerated: bool
    scope_ref: Ref
    next_item_ref: Ref
    sibling_item_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    sealed_packet_term_ref: Ref | None = None
    sealed_interval_production_request: FrozenMap | None = None
    facet_ref: Ref | None = None
    affected_dependency_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    family_join: FamilyJoinContinuationB | None = None
    agenda_snapshot: FamilyAgendaSnapshot | None = None
    current_episode_ref: Ref | None = None
    current_level_scope_ref: Ref | None = None
    composition_jobs: tuple[FrozenMap,...] = Field(default=(),max_length=128)
    handoff_sequence_specs: tuple[FrozenMap,...] = Field(default=(),max_length=128)


class MechanicalProfileContributionB(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.mechanical_profile_contribution_b.v1'
    request: MechanicalProfileRequestB
    result: MechanicalNormalizedReturn | None = None
    blockers: tuple[Ref,...] = ()
    next_item_ref: Ref
    sibling_item_refs: tuple[Ref,...]
    parent_goal_unchanged: Literal[True] = True
    executable_authority: None = None
    composition_request_ref: Ref | None = None
    root_witnesses: tuple[FrozenMap,...] = Field(default=(),max_length=3)
    family_join_request: FamilyJoinRequest | None = None
    family_join_result: FamilyJoinResult | None = None
    sealed_effect_publication: FrozenMap | None = None
    common_effect_publication: FrozenMap | None = None
    reused_receipts: tuple[FamilyAgendaReceipt,...] = Field(default=(),max_length=256)
    reuse_signature_ref: Ref | None = None
    question_dependency_qualification: FrozenMap | None = None
    composition_returns: tuple[FrozenMap,...] = Field(default=(),max_length=128)
    derived_composition_jobs: tuple[FrozenMap,...] = Field(default=(),max_length=128)
    derived_policy_replay_groups: tuple[FrozenMap,...] = Field(default=(),max_length=3)
    composition_dispositions: tuple[FrozenMap,...] = Field(default=(),max_length=128)
    composition_group_dispositions: tuple[FrozenMap,...] = Field(default=(),max_length=128)
    validated_continuations: tuple[FrozenMap,...] = Field(default=(),max_length=128)
    composition_owned_blocker_refs: tuple[Ref,...] = ()
    causal_trace_measurements: tuple[FrozenMap,...] = Field(default=(),max_length=128)
    queued_causal_receipts: tuple[FrozenMap,...] = Field(default=(),max_length=128)
    guarded_causal_receipts: tuple[FrozenMap,...] = Field(default=(),max_length=128)
    causal_reasons: tuple[FrozenMap,...] = ()
    handoff_sequences: tuple[FrozenMap,...] = Field(default=(),max_length=128)


def coerce_profile(value):
    return value if isinstance(value,MechanicalProfileRequestB) else MechanicalProfileRequestB.model_validate(value)


def _binding_missing(row, native, expected):
    if row is None or row.status=='MISSING':return True
    if row.epoch!=native.epoch or row.input_revision_ref!=native.input_revision_ref:return True
    if row.status=='OBSERVED' and not row.evidence_refs:return True
    if row.status=='SUPPORTED_HYPOTHESIS' and (row.model_ref is None or row.falsifier_ref is None):return True
    return 'value' not in row.value or row.value['value']!=expected


def measure_profile(value, configuration, case_configuration):
    request=coerce_profile(value);native=request.kernel_request
    rows={};duplicates=[]
    for binding in request.bindings:
        if binding.ref in rows:duplicates.append(binding.ref)
        rows[binding.ref]=binding
    matching_cases=tuple(c for c in case_configuration['cases'] if native.operation_ref==case_configuration['family_ref']+'.'+c['operation'] and native.mode==c['mode'])
    required=set(request.required_binding_refs)
    for case in matching_cases:
        for namespace in ('state','model','data'):
            required.update(f'{namespace}.{field}' for field in case[f'{namespace}_fields'])
    missing=[]
    for ref in sorted(required):
        row=rows.get(ref)
        if row is None or row.status=='MISSING':missing.append(ref);continue
        if row.epoch!=native.epoch or row.input_revision_ref!=native.input_revision_ref:
            missing.append(ref);continue
        if row.status=='OBSERVED' and not row.evidence_refs:missing.append(ref)
        if row.status=='SUPPORTED_HYPOTHESIS' and (row.model_ref is None or row.falsifier_ref is None):missing.append(ref)
        namespace,_,field=ref.partition('.')
        if namespace in ('state','model','data'):
            if row.value.get('value')!=getattr(native,namespace).get(field):missing.append(ref)
    missing.extend(duplicates)
    goal_fields=configuration['goal_contract_fields']
    absent_goal=[]
    for field in goal_fields:
        expected=request.goal_contract.get(field)
        binding_ref=request.goal_binding_refs.get(field)
        if expected is None or expected in ((), [], {}) or not isinstance(binding_ref,str):
            absent_goal.append('goal_contract.'+field);continue
        if _binding_missing(rows.get(binding_ref),native,expected) or binding_ref in duplicates:
            absent_goal.append('goal_contract.'+field)
    missing.extend(absent_goal)
    # The owner's wanted future and the kernel's acceptance clauses must agree.
    # A correctly grounded goal cannot validate a route to a different goal.
    for model_field,future_field in sorted(configuration['native_goal_fields'].items()):
        expected=request.desired_future.get(future_field)
        ref=request.goal_binding_refs.get('future.'+future_field)
        if future_field not in request.desired_future or model_field not in native.model:
            missing.append('future.'+future_field);continue
        if native.model[model_field]!=expected or not isinstance(ref,str) or _binding_missing(rows.get(ref),native,expected):
            missing.append('future.'+future_field)
    missing.extend(('closure.enumeration',) if not request.closure_enumerated else ())
    agenda_facts=FrozenMap({'agenda_owner_current':True,'agenda_demand_consumed':False,
        'agenda_prerequisites_current':True,'agenda_current_inputs_bound':True,
        'agenda_returns_consistent':True,'agenda_receipts':()})
    if request.agenda_snapshot is not None:
        from agents.yf_arc3_v5.capabilities.mechanical_response_transport_b import request_identity
        snapshot=request.agenda_snapshot
        projection=project_family_agenda(snapshot)
        identity=request_identity(native,native.operation_ref.rsplit('.',1)[0])
        rows=tuple(row for row in projection['rows'] if row['demand']['request']==request_identity_payload(identity))
        row=rows[0] if len(rows)==1 else None
        owner=(row is not None and row['owner_current'] and snapshot.parent_goal_ref==request.parent_goal_ref
            and snapshot.episode_ref==request.current_episode_ref and snapshot.level_scope_ref==request.current_level_scope_ref
            and row['demand']['parent_goal_ref']==request.parent_goal_ref
            and row['demand']['consumer_ref']==request.question_ref and row['demand']['scope_ref']==request.scope_ref
            and (native.requested_domain_ref is None or row['demand']['descriptive_domain_ref']==native.requested_domain_ref))
        agenda_facts=FrozenMap({'agenda_owner_current':owner,
            'agenda_demand_consumed':bool(row and row['consumed_current_signature']),
            'agenda_prerequisites_current':bool(row and row['prerequisites_current']),
            'agenda_current_inputs_bound':bool(row and row['current_inputs_bound']),
            'agenda_returns_consistent':bool(row and not row['conflicting_current_returns']),
            'agenda_receipts':row['retained_receipts'] if row else ()})
        if not owner:missing.append('agenda.current_goal_consumer_scope')
        if row is not None:
            missing.extend(row['missing_dependency_refs']);missing.extend(row['invalidated_dependency_refs'])
            missing.extend(row['pending_prerequisite_refs'])
            if row['conflicting_current_returns']:missing.append('agenda.conflicting_exact_returns')
    return FrozenMap({'profile_ref':request.profile_ref,'phase_ref':request.phase,'parent_goal_ref':request.parent_goal_ref,
        **agenda_facts,
        'request_ref':native.request_ref,'scope_ref':request.scope_ref,'question_ref':request.question_ref,
        'utility_reason_ref':request.utility_reason_ref,'desired_future':request.desired_future,
        'is_measurement_or_fit':native.mode in ('MEASURE','FIT'),
        'phase_is_solving':request.phase=='SOLVING','wanted_future_supplied':bool(request.desired_future),
        'phase_supported':request.phase==configuration.get('phase_ref','SOLVING'),
        'wanted_future_required_and_missing':request.phase=='SOLVING' and not request.desired_future,
        'closure_current_complete':not missing,'goal_contract_bound':not absent_goal,
        'missing_refs':tuple(missing),'binding_rows':tuple(binding_payload(row) for row in request.bindings),
        'profile_token':stable_digest((request.profile_ref,request.phase,native.request_ref,native.epoch,request.scope_ref)),
        'next_item_ref':request.next_item_ref,'sibling_item_refs':request.sibling_item_refs,
        'evidence_refs':native.evidence_refs})


def collect_profile(value, result=None, blockers=(),reused_receipts=()):
    request=coerce_profile(value)
    normalized=(result if isinstance(result,MechanicalNormalizedReturn) else MechanicalNormalizedReturn.model_validate(result)) if result is not None else None
    if normalized is not None:
        from agents.yf_arc3_v5.capabilities.mechanical_response_transport_b import request_identity
        family_ref=request.kernel_request.operation_ref.rsplit('.',1)[0]
        if reused_receipts:
            snapshot=request.agenda_snapshot
            identity=request_identity(request.kernel_request,family_ref)
            demands=tuple(d for d in snapshot.demands if d.request==identity) if snapshot is not None else ()
            if len(demands)!=1 or normalized!=reused_receipts[0].result:
                raise ValueError('reuse must bind this demand to an original receipt result')
            demand=demands[0]
            if (demand.parent_goal_ref!=request.parent_goal_ref or snapshot.parent_goal_ref!=request.parent_goal_ref
                or demand.consumer_ref!=request.question_ref or demand.scope_ref!=request.scope_ref
                or demand.episode_ref!=request.current_episode_ref or snapshot.episode_ref!=request.current_episode_ref
                or demand.level_scope_ref!=request.current_level_scope_ref or snapshot.level_scope_ref!=request.current_level_scope_ref):
                raise ValueError('reuse cannot change this current parent, consumer, episode or level')
            signature=demand_signature(demands[0])
            rows=tuple(row for row in project_family_agenda(snapshot)['rows']
                if row['demand']['request']==request_identity_payload(identity))
            if len(rows)!=1 or not rows[0]['owner_current'] or not rows[0]['current_inputs_bound'] or not rows[0]['prerequisites_current'] or rows[0]['conflicting_current_returns']:
                raise ValueError('reuse requires current ownership, inputs and satisfied prerequisites')
            retained={raw['receipt_ref'] for raw in rows[0]['retained_receipts']}
            if any(r not in snapshot.receipts or demand_signature(r.demand)!=signature
                   or r.receipt_ref not in retained
                   or r.demand.request.request_ref not in r.result.consumed_request_delta
                   or return_equivalence_signature(r.result)!=return_equivalence_signature(normalized)
                   for r in reused_receipts):
                raise ValueError('reuse cannot admit a foreign or contradictory receipt')
        if not reused_receipts and normalized.request!=request_identity(request.kernel_request,family_ref):
            raise ValueError('the result is not this exact profile contribution')
    witness_rows=[]
    if normalized is not None:
        values=normalized.descriptive_values
        if 'path' in values:
            witness_rows.append(FrozenMap({'path':values['path'],'request_ref':normalized.request.request_ref}))
        for witness in values.get('root_witnesses',()):
            if len(witness_rows)==3:break
            witness_rows.append(FrozenMap(witness))
    join_request=None
    if request.family_join is not None and normalized is not None and normalized.status=='FOUND':
        scope=request.family_join
        for field,expected in (('scope_ref',request.scope_ref),('question_ref',request.question_ref),
                ('utility_reason_ref',request.utility_reason_ref),('desired_predicate',request.desired_future)):
            if scope.rationale.get(field)!=expected:
                raise ValueError('family join rationale is not this current profile contribution')
        current=FamilyJoinCandidate(candidate_ref=scope.current_candidate_ref,result=normalized,
            dependency_revisions=scope.dependency_revisions,assignments=scope.assignments,
            resource_provenance=scope.resource_provenance,rationale=scope.rationale,
            preservation_refs=request.preservation_refs)
        join_request=FamilyJoinRequest(request_ref=scope.request_ref,parent_goal_ref=request.parent_goal_ref,
            episode_ref=scope.episode_ref,level_scope_ref=scope.level_scope_ref,epoch=request.kernel_request.epoch,
            groups=(FamilyJoinGroup(group_ref=request.profile_ref,candidates=(current,),
                domain_complete=scope.current_domain_complete),)+scope.peer_groups,
            max_pairs=scope.max_pairs,max_candidates=scope.max_candidates)
    return MechanicalProfileContributionB(request=request,result=normalized,blockers=tuple(blockers),
        next_item_ref=request.next_item_ref,sibling_item_refs=request.sibling_item_refs,
        root_witnesses=tuple(witness_rows),
        composition_request_ref=request.kernel_request.request_ref if normalized is not None else None,
        family_join_request=join_request)


def collect_reused_profile(value):
    """Bind a current equivalent receipt without rewriting its native identity."""
    from agents.yf_arc3_v5.capabilities.mechanical_response_transport_b import request_identity
    request=coerce_profile(value);snapshot=request.agenda_snapshot
    if snapshot is None:raise ValueError('receipt reuse requires the exact current agenda')
    identity=request_identity(request.kernel_request,request.kernel_request.operation_ref.rsplit('.',1)[0])
    demands=tuple(d for d in snapshot.demands if d.request==identity)
    if len(demands)!=1:raise ValueError('reuse requires one exact current demand')
    demand=demands[0];signature=demand_signature(demand)
    projected=project_family_agenda(snapshot)
    rows=tuple(row for row in projected['rows'] if row['demand']['request']==request_identity_payload(identity))
    if len(rows)!=1:raise ValueError('reuse requires one exact projected demand')
    row=rows[0]
    if not row['owner_current'] or not row['current_inputs_bound'] or not row['prerequisites_current'] or row['conflicting_current_returns']:
        raise ValueError('a stale, pending or conflicting receipt cannot be reused')
    receipts=tuple(sorted((r for r in snapshot.receipts if demand_signature(r.demand)==signature
        and r.demand.request.request_ref in r.result.consumed_request_delta
        and any(raw['receipt_ref']==r.receipt_ref for raw in row['retained_receipts'])),key=lambda r:r.receipt_ref))
    if not receipts or len({return_equivalence_signature(r.result) for r in receipts})!=1:
        raise ValueError('reuse needs one semantically consistent consumed response set')
    # These are equivalent computational responses. The deterministic transport
    # representative is retained with every original receipt; Source selected
    # reuse before this binding, and no model or action is selected here.
    representative=receipts[0].result
    contribution=collect_profile(request,result=representative,reused_receipts=receipts)
    return contribution.model_copy(update={'reused_receipts':receipts,'reuse_signature_ref':signature})


def attach_family_join(contribution,result):
    contribution=contribution if isinstance(contribution,MechanicalProfileContributionB) else MechanicalProfileContributionB.model_validate(contribution)
    result=result if isinstance(result,FamilyJoinResult) else FamilyJoinResult.model_validate(result)
    if contribution.family_join_request is None or result.request!=contribution.family_join_request:
        raise ValueError('family join does not belong to this exact contribution')
    return contribution.model_copy(update={'family_join_result':result})
