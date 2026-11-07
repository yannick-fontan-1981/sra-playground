"""Autonomous pursuit of the heard source, not the current player position."""
from __future__ import annotations
from collections import deque
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .single_visit_residual_d import ResidualEdgeD
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result


class HeardSourceReceiptD(FrozenModel):
    receipt_ref: Ref
    source_node_ref: Ref
    tick: int = Field(ge=0)
    epoch: int = Field(ge=0)
    order_index: int | None = Field(default=None,ge=0)
    qualifying: bool


class SourceLockedPursuitRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.source_locked_pursuit_request_d.v1'
    phase_ref: Literal['INTERNAL_LISTENER_OPPORTUNITY']
    listener_ref: Ref
    node_refs: tuple[Ref,...] = Field(min_length=1,max_length=4096)
    edges: tuple[ResidualEdgeD,...] = Field(default=(),max_length=4096)
    blocked_node_refs: tuple[Ref,...] = Field(default=(),max_length=4096)
    listener_node_ref: Ref
    remembered_source_node_ref: Ref | None
    remembered_receipt_ref: Ref | None
    remaining_alert_opportunities: int = Field(ge=0)
    alert_opportunities_per_receipt: int = Field(ge=0)
    period: int = Field(ge=1)
    clock_phase: int = Field(ge=0)
    movement_phase: int = Field(ge=0)
    opportunity_tick: int = Field(ge=0)
    clock_advanced: bool
    receipts: tuple[HeardSourceReceiptD,...] = Field(default=(),max_length=128)
    simultaneous_sound_rule: Literal['FIRST_DECLARED_ORDER','RETAIN_ALTERNATIVES']
    lock_source_while_alert: bool
    neighbor_priority: tuple[Ref,...] = Field(min_length=1,max_length=4096)
    pursuit_path_rule: Literal['SHORTEST_GRAPH']
    decrement_alert_on_blocked: bool
    preserve_phase_on_blocked: bool
    preserve_source_on_blocked: bool
    clear_source_on_expiry: bool
    contact_node_refs: tuple[Ref,...] = Field(default=(),max_length=4096)
    contact_event_ref: Ref
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = (
        ('mechanics.reactive_graph_navigation.source_locked_pursuit','STEP_INTERNAL'),
    )

    @model_validator(mode='after')
    def graph(self):
        nodes=set(self.node_refs)
        if len(nodes)!=len(self.node_refs) or set(self.neighbor_priority)!=nodes or len(self.neighbor_priority)!=len(nodes):
            raise ValueError('graph domain and deterministic neighbor order must be exact')
        refs=(self.listener_node_ref,)+(tuple([self.remembered_source_node_ref]) if self.remembered_source_node_ref is not None else ())
        if not set(refs)<=nodes or not set(self.blocked_node_refs+self.contact_node_refs)<=nodes or any(r.source_node_ref not in nodes for r in self.receipts):
            raise ValueError('listener/source/blocking node outside graph')
        if any(e.first_ref not in nodes or e.second_ref not in nodes or e.first_ref==e.second_ref for e in self.edges):
            raise ValueError('pursuit edge domain invalid')
        if self.clock_phase>=self.period or self.movement_phase>=self.period:
            raise ValueError('opportunity phase outside its own period')
        if self.remaining_alert_opportunities and self.remembered_source_node_ref is None:
            raise ValueError('active pursuit requires a remembered source location')
        return self


def measure_source_locked_pursuit_d(request: SourceLockedPursuitRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:
        return refusal
    if max(len(request.node_refs),len(request.edges))>request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    if request.resume_frontier:
        return d_result(request,'NEEDS_EVIDENCE','RESTART_LISTENER_OPPORTUNITY_FROM_BOUND_STATE')
    budget=DWorkBudget(request)
    try:
        heard=[r for r in request.receipts if r.qualifying and r.epoch==request.scope.epoch and r.tick==request.opportunity_tick]
        if request.lock_source_while_alert and request.remaining_alert_opportunities>0:
            candidates=[(request.remembered_source_node_ref,request.remembered_receipt_ref,request.remaining_alert_opportunities)]
        elif heard:
            if request.simultaneous_sound_rule=='FIRST_DECLARED_ORDER':
                if any(r.order_index is None for r in heard) or len({r.order_index for r in heard})!=len(heard):
                    return d_result(request,'NEEDS_EVIDENCE','SIMULTANEOUS_RECEIPT_ORDER_NOT_BOUND')
                first=min(heard,key=lambda r:r.order_index)
                heard=[first]
            candidates=[(r.source_node_ref,r.receipt_ref,request.alert_opportunities_per_receipt) for r in heard]
        else:
            candidates=[(request.remembered_source_node_ref,request.remembered_receipt_ref,request.remaining_alert_opportunities)]
        graph={r:[] for r in request.node_refs}
        blocked=set(request.blocked_node_refs)
        priority={r:i for i,r in enumerate(request.neighbor_priority)}
        for edge in request.edges:
            budget.visit({'stage':'current_blocking_graph','edge_ref':edge.edge_ref})
            if edge.first_ref not in blocked and edge.second_ref not in blocked:
                graph[edge.first_ref].append(edge.second_ref)
                graph[edge.second_ref].append(edge.first_ref)
        rows=[]
        for target,receipt,alert in candidates:
            phase=(request.clock_phase+int(request.clock_advanced))%request.period
            opportunity=request.clock_advanced and phase==request.movement_phase and alert>0 and target is not None
            position=request.listener_node_ref
            next_step=None
            blocked_step=False
            if opportunity:
                distances={target:0} if target not in blocked else {}
                queue=deque(distances)
                while queue:
                    if position in distances:
                        break
                    ref=queue.popleft()
                    budget.visit({'stage':'path_to_remembered_source','node_ref':ref})
                    if distances[ref]>=request.depth_bound:
                        if any(peer not in distances for peer in graph[ref]):
                            raise DComputationInterrupted('PURSUIT_PATH_DEPTH_BOUND',{'node_ref':ref})
                    else:
                        for peer in graph[ref]:
                            if peer not in distances:
                                distances[peer]=distances[ref]+1
                                queue.append(peer)
                choices=[peer for peer in graph[position] if peer in distances and position in distances and distances[peer]<distances[position]]
                if position==target:
                    next_step=position
                elif choices:
                    next_step=min(choices,key=lambda ref:(distances[ref],priority[ref]))
                    position=next_step
                else:
                    blocked_step=True
                if not blocked_step or request.decrement_alert_on_blocked:
                    alert=max(0,alert-1)
                if blocked_step and request.preserve_phase_on_blocked:
                    phase=request.clock_phase
                if blocked_step and not request.preserve_source_on_blocked or alert==0 and request.clear_source_on_expiry:
                    target,receipt=None,None
            rows.append({'listener_ref':request.listener_ref,'listener_node_ref':position,'remembered_source_node_ref':target,
                'remembered_receipt_ref':receipt,'remaining_alert_opportunities':alert,'clock_phase':phase,
                'movement_opportunity':opportunity,'next_step':next_step,'blocked_step':blocked_step,
                'contact_event_ref':request.contact_event_ref if position in request.contact_node_refs else None})
        budget.finish()
        return d_result(request,'COMPLETE','SOURCE_LOCKED_PURSUIT_RESULT',complete=True,examined=budget.examined,
            values={'listener_alternative_successors':tuple(rows),'qualifying_receipt_refs':tuple(r.receipt_ref for r in heard),
                'current_emitter_position_used_as_target':False,'silent_input_creates_receipt':False,'future_route_used':False,
                'new_external_inputs':0})
    except DComputationInterrupted as error:
        return d_result(request,'NEEDS_EVIDENCE',error.cause,examined=budget.examined,
            frontier={'restart_listener_opportunity':True,'work':error.frontier})
