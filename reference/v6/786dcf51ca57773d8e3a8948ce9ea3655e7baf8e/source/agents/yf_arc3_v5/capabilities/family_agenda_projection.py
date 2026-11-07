"""Current scoped request/receipt facts for a DRM-declared family agenda.

This projection never selects a family or invokes it. Receipts remain attached
to their exact semantic input signature, so an old refusal cannot consume a new
operation, revision, model alternative, parent or consumer.
"""
from collections import deque

from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenMap,FrozenModel,Ref,stable_digest,require_unique,immutable_json_data
from agents.yf_arc3_v5.capabilities.mechanical_request_contracts import MechanicalRequestIdentity,MechanicalNormalizedReturn
from agents.yf_arc3_v5.capabilities.mechanical_transport_b import demand_payload,receipt_payload


class FamilyAgendaDemand(FrozenModel):
    request: MechanicalRequestIdentity
    parent_goal_ref: Ref
    descriptive_domain_ref: Ref
    consumer_ref: Ref
    scope_ref: Ref
    episode_ref: Ref
    level_scope_ref: Ref
    dependency_revisions: FrozenMap
    prerequisite_request_refs: tuple[Ref,...] = Field(default=(),max_length=128)

class FamilyAgendaReceipt(FrozenModel):
    receipt_ref: Ref
    demand: FamilyAgendaDemand
    result: MechanicalNormalizedReturn

    @model_validator(mode='after')
    def exact_return(self):
        if self.result.request!=self.demand.request:
            raise ValueError('agenda receipt is not its exact requested return')
        return self


class FamilyAgendaSnapshot(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.family_agenda_snapshot.v1'
    agenda_ref: Ref
    parent_goal_ref: Ref
    epoch: int = Field(ge=0)
    episode_ref: Ref
    level_scope_ref: Ref
    current_dependency_revisions: FrozenMap
    invalidated_dependency_refs: tuple[Ref,...] = Field(default=(),max_length=256)
    demands: tuple[FamilyAgendaDemand,...] = Field(default=(),max_length=128)
    receipts: tuple[FamilyAgendaReceipt,...] = Field(default=(),max_length=256)

    @model_validator(mode='after')
    def unique_demands(self):
        require_unique(tuple(d.request.request_ref for d in self.demands),'agenda request refs')
        require_unique(tuple(r.receipt_ref for r in self.receipts),'agenda receipt refs')
        if len(self.current_dependency_revisions)>256 or any(len(d.dependency_revisions)>256 for d in self.demands):
            raise ValueError('agenda dependency projection exceeds its declared bound')
        return self


def demand_signature(demand: FamilyAgendaDemand):
    request=demand.request
    # Only the receipt's request instance name may differ. All computation,
    # ownership, scope, bounds and retained model alternatives stay exact.
    return stable_digest((demand.parent_goal_ref,demand.descriptive_domain_ref,
        demand.consumer_ref,demand.scope_ref,demand.episode_ref,demand.level_scope_ref,demand.dependency_revisions,
        demand.prerequisite_request_refs,request.kernel_ref,request.operation_ref,
        request.mode,request.caller_ref,request.parent_contribution_ref,request.epoch,
        request.input_revision_ref,request.model_assignments,request.immutable_inputs,
        request.actual_bounds,request.expected_return_type,request.requested_domain_ref))


def _current(demand,snapshot):
    return (demand.parent_goal_ref==snapshot.parent_goal_ref and demand.request.epoch==snapshot.epoch
        and demand.episode_ref==snapshot.episode_ref and demand.level_scope_ref==snapshot.level_scope_ref
        and not set(demand.dependency_revisions)&set(snapshot.invalidated_dependency_refs)
        and all(key in snapshot.current_dependency_revisions and
            snapshot.current_dependency_revisions[key]==demand.dependency_revisions[key]
            for key in sorted(demand.dependency_revisions)))


def project_family_agenda(snapshot: FamilyAgendaSnapshot):
    receipts={};signature_by_ref={}
    for demand in snapshot.demands:
        signature_by_ref[demand.request.request_ref]=demand_signature(demand)
    for receipt in snapshot.receipts:
        if not _current(receipt.demand,snapshot):continue
        signature=demand_signature(receipt.demand)
        receipts.setdefault(signature,[]).append(receipt)

    # Index the current parent's dependency graph once. A historical FOUND is
    # not enough: its current return domain and all upstream prerequisites
    # must qualify. This computes readiness, never a family or action choice.
    measured={};dependents={};unresolved_counts={};ready=deque()
    for demand in snapshot.demands:
        ref=demand.request.request_ref
        matching=tuple(receipts.get(signature_by_ref[ref],()))
        consumed=tuple(r for r in matching if r.demand.request.request_ref in r.result.consumed_request_delta)
        conflicting=len({return_equivalence_signature(r.result) for r in matching})>1
        local_satisfaction=(_current(demand,snapshot) and not conflicting
            and any(r.result.status=='FOUND' for r in consumed))
        measured[ref]=(matching,consumed,conflicting,local_satisfaction)
        unresolved_counts[ref]=len(demand.prerequisite_request_refs)
        for prerequisite_ref in demand.prerequisite_request_refs:
            dependents.setdefault(prerequisite_ref,[]).append(ref)
        if local_satisfaction and not demand.prerequisite_request_refs:
            ready.append(ref)

    satisfied=set()
    while ready:
        ref=ready.popleft()
        satisfied.add(ref)
        for dependent_ref in dependents.get(ref,()):
            unresolved_counts[dependent_ref]-=1
            if not unresolved_counts[dependent_ref] and measured[dependent_ref][3]:
                ready.append(dependent_ref)
    # Missing references and cycles never enter the ready queue. Their exact
    # pending edges remain in the returned rows, including downstream effects.
    rows=[]
    for demand in snapshot.demands:
        ref=demand.request.request_ref
        signature=signature_by_ref[ref]
        matching,consumed,conflicting,_=measured[ref]
        missing=tuple(key for key in sorted(demand.dependency_revisions)
            if key not in snapshot.current_dependency_revisions or
               snapshot.current_dependency_revisions[key]!=demand.dependency_revisions[key])
        invalidated=tuple(sorted(set(demand.dependency_revisions)&set(snapshot.invalidated_dependency_refs)))
        pending=tuple(prerequisite_ref for prerequisite_ref in demand.prerequisite_request_refs
            if prerequisite_ref not in satisfied)
        rows.append(FrozenMap({'demand':demand_payload(demand),'signature_ref':signature,
            'owner_current':demand.parent_goal_ref==snapshot.parent_goal_ref and demand.request.epoch==snapshot.epoch
                and demand.episode_ref==snapshot.episode_ref and demand.level_scope_ref==snapshot.level_scope_ref,
            'conflicting_current_returns':conflicting,
            'current_inputs_bound':not missing and not invalidated,
            'consumed_current_signature':bool(consumed),'retained_receipts':tuple(receipt_payload(r) for r in matching),
            'pending_prerequisite_refs':pending,'missing_dependency_refs':missing,
            'invalidated_dependency_refs':invalidated,'prerequisites_current':not pending,
            'satisfied_current_signature':ref in satisfied,
            'satisfaction_receipt_refs':tuple(r.receipt_ref for r in consumed) if ref in satisfied else (),
            'prerequisite_receipt_refs':FrozenMap({prerequisite_ref:
                tuple(r.receipt_ref for r in measured[prerequisite_ref][1])
                for prerequisite_ref in demand.prerequisite_request_refs if prerequisite_ref in satisfied}),
            'nonapplicable_is_local':any(r.result.status=='NOT_APPLICABLE' for r in consumed)}))
    return FrozenMap({'agenda_ref':snapshot.agenda_ref,'rows':tuple(rows),
        'parent_goal_ref':snapshot.parent_goal_ref,'epoch':snapshot.epoch,
        'dispatch_or_action_authority':None})


def return_equivalence_signature(result):
    """Compare all semantic response fields, preserving instance provenance."""
    payload=immutable_json_data(result)
    return stable_digest(FrozenMap({key:payload[key] for key in sorted(payload)
        if key not in ('request','consumed_request_delta','contribution_consumption_ref')}))
