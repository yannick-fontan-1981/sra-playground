"""Role-tagged reachability and an actor's defined route policies, not planning."""
from __future__ import annotations
from collections import deque
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .single_visit_residual_d import ResidualEdgeD
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result


class InternalRoutePolicyD(FrozenModel):
    policy_ref: Ref
    metric: Literal['EDGE_COUNT']
    neighbor_order: tuple[Ref,...] | None
    permit_blocked_nodes: bool


class SealedRealizedRouteD(FrozenModel):
    receipt_ref: Ref
    source_ref: Ref
    destination_ref: Ref
    path: tuple[Ref,...] | None
    sealed: bool
    epoch: int = Field(ge=0)


class PolicyConstrainedRoutingRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.policy_constrained_routing_request_d.v1'
    phase_ref: Literal['ROLE_TAGGED_INTERNAL_ROUTE']
    graph_role: Literal['LOGICAL_INFLUENCE','PHYSICAL_PASSAGE']
    node_refs: tuple[Ref,...] = Field(min_length=1,max_length=4096)
    edges: tuple[ResidualEdgeD,...] = Field(default=(),max_length=4096)
    blocked_node_refs: tuple[Ref,...] = Field(default=(),max_length=4096)
    directed: bool
    origin_ref: Ref
    destination_ref: Ref | None
    requested_property: Literal['REACHABILITY_ONLY','REALIZED_ROUTE']
    policies: tuple[InternalRoutePolicyD,...] = Field(default=(),max_length=128)
    observed_routes: tuple[SealedRealizedRouteD,...] = Field(default=(),max_length=4096)
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = (
        ('mechanics.autonomous_route_intervention.policy_constrained_routing','FIT'),
        ('mechanics.autonomous_route_intervention.policy_constrained_routing','DOMAIN'),
    )

    @model_validator(mode='after')
    def graph_domain(self):
        nodes=set(self.node_refs)
        if len(nodes)!=len(self.node_refs) or self.origin_ref not in nodes or self.destination_ref is not None and self.destination_ref not in nodes:
            raise ValueError('origin/destination outside role-tagged graph')
        if not set(self.blocked_node_refs)<=nodes or any(e.first_ref not in nodes or e.second_ref not in nodes for e in self.edges):
            raise ValueError('graph edge/blocking domain invalid')
        if any(p.neighbor_order is not None and (set(p.neighbor_order)!=nodes or len(p.neighbor_order)!=len(nodes)) for p in self.policies):
            raise ValueError('known internal tie order must be exact')
        if self.graph_role=='LOGICAL_INFLUENCE' and self.blocked_node_refs:
            raise ValueError('logical influence cannot silently inherit physical occupancy blocking')
        return self


def _route_graph(request,policy,budget):
    graph={n:[] for n in request.node_refs}
    blocked=(set() if request.graph_role=='LOGICAL_INFLUENCE' or policy is not None and policy.permit_blocked_nodes
        else set(request.blocked_node_refs))
    for edge in request.edges:
        budget.visit({'stage':'role_tagged_graph','edge_ref':edge.edge_ref})
        if edge.first_ref in blocked or edge.second_ref in blocked:continue
        graph[edge.first_ref].append(edge.second_ref)
        if not request.directed:graph[edge.second_ref].append(edge.first_ref)
    return graph


def _policy_route_domain(request,policy,source,destination,budget):
    graph=_route_graph(request,policy,budget)
    distances={source:0}
    predecessors={source:[]}
    queue=deque([source])
    priority={r:i for i,r in enumerate(policy.neighbor_order)} if policy.neighbor_order is not None else None
    while queue:
        ref=queue.popleft()
        budget.visit({'stage':'defined_shortest_route','policy_ref':policy.policy_ref,'node_ref':ref})
        if distances[ref]>=request.depth_bound:
            if destination not in distances and graph[ref]:raise DComputationInterrupted('POLICY_ROUTE_DEPTH_BOUND',{})
            continue
        neighbors=sorted(graph[ref],key=lambda n:priority[n]) if priority is not None else graph[ref]
        for peer in neighbors:
            distance=distances[ref]+1
            if peer not in distances:
                distances[peer]=distance;predecessors[peer]=[ref];queue.append(peer)
            elif distances[peer]==distance and priority is None:predecessors[peer].append(ref)
    if destination not in distances:return []
    paths=[]
    stack=[(destination,(destination,))]
    while stack:
        ref,suffix=stack.pop()
        budget.visit({'stage':'internal_tie_path_domain','policy_ref':policy.policy_ref})
        if ref==source:
            paths.append(tuple(reversed(suffix)))
            if len(paths)>request.domain_bound:raise DComputationInterrupted('INTERNAL_TIE_ROUTE_DOMAIN_BOUND',{})
        else:
            stack.extend((parent,suffix+(parent,)) for parent in predecessors[ref])
    return paths


def measure_policy_constrained_routing_d(request: PolicyConstrainedRoutingRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    if max(len(request.node_refs),len(request.edges),len(request.observed_routes))>request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    if request.resume_frontier:return d_result(request,'NEEDS_EVIDENCE','RESTART_ROLE_TAGGED_ROUTE_DOMAIN')
    budget=DWorkBudget(request)
    try:
        if request.mode_ref=='DOMAIN' and request.requested_property=='REACHABILITY_ONLY':
            graph=_route_graph(request,None,budget)
            reachable={request.origin_ref};queue=deque(reachable)
            while queue:
                ref=queue.popleft();budget.visit({'stage':'reachability_without_policy','node_ref':ref})
                for peer in graph[ref]:
                    if peer not in reachable:reachable.add(peer);queue.append(peer)
            values={'graph_role':request.graph_role,'reachable_node_refs':tuple(r for r in request.node_refs if r in reachable),
                'route_policy_required':False,'actors_moved':False}
        else:
            if not request.policies or request.mode_ref=='DOMAIN' and request.destination_ref is None:
                return d_result(request,'NEEDS_EVIDENCE','REALIZED_ROUTE_POLICY_OR_DESTINATION_NOT_BOUND')
            actual=[r for r in request.observed_routes if r.sealed and r.epoch==request.scope.epoch]
            if request.mode_ref=='FIT' and not actual:return d_result(request,'NEEDS_EVIDENCE','SEALED_REALIZED_ROUTES_REQUIRED')
            rows=[]
            for policy in request.policies:
                if request.mode_ref=='FIT':
                    contradictions=[]
                    for receipt in actual:
                        paths=_policy_route_domain(request,policy,receipt.source_ref,receipt.destination_ref,budget)
                        if (receipt.path is None and paths) or (receipt.path is not None and receipt.path not in paths):contradictions.append(receipt.receipt_ref)
                    rows.append({'policy_ref':policy.policy_ref,'contradicting_receipt_refs':tuple(contradictions)})
                else:
                    paths=_policy_route_domain(request,policy,request.origin_ref,request.destination_ref,budget)
                    rows.append({'policy_ref':policy.policy_ref,'policy_realized_routes':tuple(paths),'route_found':bool(paths),
                        'tie_order_known':policy.neighbor_order is not None})
            values={'graph_role':request.graph_role,'policy_result_rows':tuple(rows),'planner_time_or_hazard_objective_used':False,
                'player_route_chosen':False,'recursive_agent_planner_called':False}
        budget.finish()
        return d_result(request,'COMPLETE','ROLE_AND_POLICY_SCOPED_ROUTE_RESULT',complete=True,examined=budget.examined,values=values)
    except DComputationInterrupted as error:
        return d_result(request,'NEEDS_EVIDENCE',error.cause,examined=budget.examined,
            frontier={'restart_policy_route_domain':True,'unexamined_routes_retained':True,'work':error.frontier})
