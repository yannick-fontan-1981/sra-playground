"""Finite residual graph necessities and exact degree propagation, no route choice."""
from __future__ import annotations

from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref, stable_digest
from .mechanical_family_contracts_d import (
    DMechanicalRequest, DWorkBudget, DComputationInterrupted,
    d_result, d_map, d_validate_request, d_input_digest,
)


class ResidualEdgeD(FrozenModel):
    edge_ref: Ref
    first_ref: Ref
    second_ref: Ref


class SingleVisitResidualRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.single_visit_residual_request_d.v1'
    phase_ref: Literal['RESIDUAL_GRAPH']
    graph_revision_ref: Ref
    node_refs: tuple[Ref, ...] = Field(min_length=1, max_length=4096)
    edges: tuple[ResidualEdgeD, ...] = Field(default=(), max_length=4096)
    head_ref: Ref
    endpoint_ref: Ref
    visited_node_refs: tuple[Ref, ...] = Field(min_length=1, max_length=4096)
    remaining_node_refs: tuple[Ref, ...] = Field(default=(), max_length=4096)
    ordered_prefix: tuple[Ref, ...] = Field(default=(), max_length=4096)
    append_only_projection_certified: bool
    simple_path_law_supported: bool
    endpoint_last_visit_law_supported: bool
    licensed_bipartite_parity: bool
    forced_edge_refs: tuple[Ref, ...] = Field(default=(), max_length=4096)
    forbidden_edge_refs: tuple[Ref, ...] = Field(default=(), max_length=4096)
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = (
        ('mechanics.coverage_partition.single_visit_residual', 'EVALUATE'),
        ('mechanics.coverage_partition.single_visit_residual', 'PROPAGATE'),
    )

    @model_validator(mode='after')
    def exact_graph_and_prefix(self):
        nodes, visited = set(self.node_refs), set(self.visited_node_refs)
        if len(nodes) != len(self.node_refs) or len(visited) != len(self.visited_node_refs):
            raise ValueError('duplicate residual vertex or visited identity')
        if self.head_ref not in visited or self.endpoint_ref not in nodes or not visited <= nodes:
            raise ValueError('head, endpoint or visited identities outside graph')
        if set(self.remaining_node_refs) != nodes - visited or len(set(self.remaining_node_refs)) != len(self.remaining_node_refs):
            raise ValueError('remaining domain differs from the exact visited complement')
        edge_refs, pairs = set(), set()
        for edge in self.edges:
            pair = tuple(sorted((edge.first_ref, edge.second_ref)))
            if edge.first_ref not in nodes or edge.second_ref not in nodes or edge.first_ref == edge.second_ref:
                raise ValueError('invalid residual edge endpoints')
            if edge.edge_ref in edge_refs or pair in pairs:
                raise ValueError('duplicate edge identity or undirected pair')
            edge_refs.add(edge.edge_ref)
            pairs.add(pair)
        if not set(self.forced_edge_refs) <= edge_refs or not set(self.forbidden_edge_refs) <= edge_refs:
            raise ValueError('edge constraint outside supplied graph')
        if self.ordered_prefix:
            if (self.ordered_prefix[-1] != self.head_ref
                    or len(set(self.ordered_prefix)) != len(self.ordered_prefix)
                    or set(self.ordered_prefix) != visited):
                raise ValueError('ordered prefix differs from head/visited projection')
            if any(tuple(sorted(pair)) not in pairs for pair in zip(self.ordered_prefix, self.ordered_prefix[1:])):
                raise ValueError('ordered prefix includes an absent physical edge')
        return self


def _components(vertices, adjacency, budget):
    unseen, components = set(vertices), []
    while unseen:
        root = min(unseen)
        pending, component = [root], []
        unseen.remove(root)
        while pending:
            vertex = pending.pop()
            budget.visit({'stage': 'components', 'vertex_ref': vertex})
            component.append(vertex)
            for neighbor, _edge_ref in adjacency.get(vertex, ()):
                if neighbor in unseen:
                    unseen.remove(neighbor)
                    pending.append(neighbor)
        components.append(tuple(sorted(component)))
    return tuple(components)


def _cut_counts(vertices, adjacency, budget, depth_bound):
    """Iterative undirected articulation counts; no recursive interpreter limit."""
    discovered, low, parent, children, separated = {}, {}, {}, {}, {}
    component_count, clock = 0, 0
    for root in sorted(vertices):
        if root in discovered:
            continue
        component_count += 1
        discovered[root] = low[root] = clock
        clock += 1
        parent[root], children[root], separated[root] = None, 0, 0
        stack = [(root, iter(adjacency.get(root, ())))]
        while stack:
            if len(stack) > depth_bound:
                raise DComputationInterrupted('DEPTH_BOUND', d_map({'stage': 'cuts', 'vertex_ref': stack[-1][0]}))
            vertex, neighbors = stack[-1]
            budget.visit({'stage': 'cuts', 'vertex_ref': vertex})
            try:
                neighbor, _edge_ref = next(neighbors)
            except StopIteration:
                stack.pop()
                predecessor = parent[vertex]
                if predecessor is not None:
                    low[predecessor] = min(low[predecessor], low[vertex])
                    if low[vertex] >= discovered[predecessor]:
                        separated[predecessor] += 1
                continue
            if neighbor not in discovered:
                parent[neighbor], children[neighbor], separated[neighbor] = vertex, 0, 0
                children[vertex] += 1
                discovered[neighbor] = low[neighbor] = clock
                clock += 1
                stack.append((neighbor, iter(adjacency.get(neighbor, ()))))
            elif neighbor != parent[vertex]:
                low[vertex] = min(low[vertex], discovered[neighbor])
    return {vertex: component_count - 1 + (
        children[vertex] if parent[vertex] is None else separated[vertex] + 1
    ) for vertex in sorted(vertices)}


def _parity(vertices, adjacency, head, endpoint, budget):
    colors = {}
    for root in sorted(vertices):
        if root in colors:
            continue
        colors[root] = 0
        pending = [root]
        while pending:
            vertex = pending.pop()
            budget.visit({'stage': 'bipartition', 'vertex_ref': vertex})
            for neighbor, _edge_ref in adjacency.get(vertex, ()):
                if neighbor not in colors:
                    colors[neighbor] = 1 - colors[vertex]
                    pending.append(neighbor)
                elif colors[neighbor] == colors[vertex]:
                    return {'bipartite': False, 'count_condition': None}
    counts = (sum(value == 0 for value in sorted(colors.values())), sum(value == 1 for value in sorted(colors.values())))
    same = colors[head] == colors[endpoint]
    valid = counts[colors[head]] == counts[1 - colors[head]] + 1 if same else counts[0] == counts[1]
    return {'bipartite': True, 'partition_counts': counts, 'same_endpoint_partition': same, 'count_condition': valid}


def measure_single_visit_residual_d(request: SingleVisitResidualRequestD):
    rejected = d_validate_request(request)
    if rejected is not None:
        return rejected
    if max(len(request.node_refs), len(request.edges)) > request.domain_bound:
        return d_result(request, 'NEEDS_EVIDENCE', 'INPUT_DOMAIN_BOUND')
    if not request.simple_path_law_supported or (not request.ordered_prefix and not request.append_only_projection_certified):
        return d_result(request, 'NEEDS_EVIDENCE', 'PATH_OR_PROJECTED_STATE_LAW_UNQUALIFIED')
    if request.head_ref == request.endpoint_ref and request.remaining_node_refs and not request.endpoint_last_visit_law_supported:
        return d_result(request, 'NEEDS_EVIDENCE', 'ENDPOINT_REENTRY_LAW_UNQUALIFIED')
    vertices = set(request.remaining_node_refs) | {request.head_ref}
    all_edges = {edge.edge_ref: edge for edge in request.edges}
    relevant = {ref for ref, edge in sorted(all_edges.items()) if edge.first_ref in vertices and edge.second_ref in vertices}
    forced, forbidden = set(request.forced_edge_refs), set(request.forbidden_edge_refs)
    witnesses, round_index = [], 0
    input_digest = d_input_digest(request)
    if request.resume_frontier:
        resume = request.resume_frontier
        if (resume.get('input_digest') != input_digest or resume.get('request_ref') != request.scope.request_ref
                or resume.get('graph_revision_ref') != request.graph_revision_ref):
            return d_result(request, 'NEEDS_EVIDENCE', 'RESUME_SCOPE_MISMATCH')
        forced = set(resume.get('forced_edge_refs', ()))
        forbidden = set(resume.get('forbidden_edge_refs', ()))
        witnesses = list(resume.get('reduction_witnesses', ()))
        round_index = int(resume.get('completed_rounds', 0))
        if not forced <= relevant or not forbidden <= set(all_edges) or not set(request.forced_edge_refs) <= forced or not set(request.forbidden_edge_refs) <= forbidden:
            return d_result(request, 'NEEDS_EVIDENCE', 'RESUME_EDGE_DOMAIN_MISMATCH')
    budget = DWorkBudget(request)
    contradictions = []
    try:
        if not request.remaining_node_refs and request.head_ref == request.endpoint_ref:
            budget.visit({'stage': 'empty_suffix'})
            return d_result(request, 'COMPLETE', 'EMPTY_SUFFIX_CALCULATED', complete=True, examined=budget.examined,
                values={'empty_suffix': True, 'degree_requirements': {request.head_ref: 0}, 'contradiction_certificates': ()})
        if request.endpoint_ref not in vertices or request.head_ref == request.endpoint_ref:
            contradictions.append({'code': 'ENDPOINT_ALREADY_VISITED_WITH_REMAINDER', 'node_refs': (request.endpoint_ref,)})
        if forced - relevant:
            contradictions.append({'code': 'FORCED_EDGE_OUTSIDE_RESIDUAL', 'edge_refs': tuple(sorted(forced - relevant))})
        if forced & forbidden:
            contradictions.append({'code': 'FORCED_AND_FORBIDDEN', 'edge_refs': tuple(sorted(forced & forbidden))})
        requirements = {vertex: 1 if vertex in (request.head_ref, request.endpoint_ref) else 2 for vertex in sorted(vertices)}
        components, cuts, parity = (), {}, None
        while not contradictions:
            adjacency = {vertex: [] for vertex in sorted(vertices)}
            for ref in sorted(relevant - forbidden):
                budget.visit({'stage': 'edges', 'edge_ref': ref})
                edge = all_edges[ref]
                adjacency[edge.first_ref].append((edge.second_ref, ref))
                adjacency[edge.second_ref].append((edge.first_ref, ref))
            components = _components(vertices, adjacency, budget)
            if len(components) > 1:
                contradictions.append({'code': 'UNFINISHED_SUFFIX_DISCONNECTED', 'components': components})
            cuts = _cut_counts(vertices, adjacency, budget, request.depth_bound)
            for vertex in sorted(vertices):
                budget.visit({'stage': 'degrees', 'vertex_ref': vertex})
                incident = {ref for _neighbor, ref in adjacency[vertex]}
                fixed = incident & forced
                if len(incident) < requirements[vertex] or len(fixed) > requirements[vertex]:
                    contradictions.append({'code': 'UNFINISHED_SUFFIX_DEGREE_CONTRADICTION', 'node_ref': vertex,
                        'available_degree': len(incident), 'forced_degree': len(fixed), 'required_degree': requirements[vertex]})
                if cuts[vertex] > requirements[vertex]:
                    contradictions.append({'code': 'UNFINISHED_SUFFIX_CUT_CONTRADICTION', 'node_ref': vertex, 'components_after_removal': cuts[vertex]})
            if request.licensed_bipartite_parity:
                parity = _parity(vertices, adjacency, request.head_ref, request.endpoint_ref, budget)
                if parity['bipartite'] and parity['count_condition'] is False:
                    contradictions.append({'code': 'UNFINISHED_SUFFIX_PARITY_CONTRADICTION'})
            # Initial or resumed forced constraints also require these checks;
            # do not wait for this invocation to discover another forced edge.
            forced_adjacency = {vertex: [] for vertex in sorted(vertices)}
            for ref in sorted(forced & relevant):
                edge = all_edges[ref]
                forced_adjacency[edge.first_ref].append((edge.second_ref, ref))
                forced_adjacency[edge.second_ref].append((edge.first_ref, ref))
            for component in _components(vertices, forced_adjacency, budget):
                if len(component) > 1 and all(len(forced_adjacency[vertex]) == 2 for vertex in component):
                    contradictions.append({'code': 'FORCED_CLOSED_SUBTOUR', 'node_refs': component})
                if (request.head_ref in component and request.endpoint_ref in component
                        and len(component) < len(vertices)
                        and all(len(forced_adjacency[vertex]) == requirements[vertex] for vertex in component)):
                    contradictions.append({'code': 'SATURATED_HEAD_ENDPOINT_CHAIN_LEAVES_REMAINDER', 'node_refs': component})
            if contradictions or request.mode_ref == 'EVALUATE':
                break
            additions, removals = set(), set()
            for vertex in sorted(vertices):
                budget.visit({'stage': 'propagation', 'vertex_ref': vertex})
                incident = {ref for _neighbor, ref in adjacency[vertex]}
                fixed = incident & forced
                if len(fixed) == requirements[vertex]:
                    removals.update(incident - fixed)
                if len(incident) == requirements[vertex]:
                    additions.update(incident - forced)
            if additions & removals:
                contradictions.append({'code': 'SIMULTANEOUS_FORCE_REMOVE', 'edge_refs': tuple(sorted(additions & removals))})
                break
            if not additions and not removals:
                break
            forced.update(additions)
            forbidden.update(removals)
            witnesses.append({'round': round_index, 'forced_edges': tuple(sorted(additions)), 'removed_edges': tuple(sorted(removals))})
            round_index += 1
            forced_adjacency = {vertex: [] for vertex in sorted(vertices)}
            for ref in sorted(forced & relevant):
                edge = all_edges[ref]
                forced_adjacency[edge.first_ref].append((edge.second_ref, ref))
                forced_adjacency[edge.second_ref].append((edge.first_ref, ref))
            for component in _components(vertices, forced_adjacency, budget):
                if len(component) > 1 and all(len(forced_adjacency[vertex]) == 2 for vertex in component):
                    contradictions.append({'code': 'FORCED_CLOSED_SUBTOUR', 'node_refs': component})
                if (request.head_ref in component and request.endpoint_ref in component
                        and len(component) < len(vertices)
                        and all(len(forced_adjacency[vertex]) == requirements[vertex] for vertex in component)):
                    contradictions.append({'code': 'SATURATED_HEAD_ENDPOINT_CHAIN_LEAVES_REMAINDER', 'node_refs': component})
            if round_index >= request.depth_bound:
                raise DComputationInterrupted('PROPAGATION_ROUND_BOUND', d_map({'stage': 'next_round'}))
        budget.finish()
        return d_result(request, 'COMPLETE', 'RESIDUAL_CONSTRAINTS_CALCULATED', complete=True, examined=budget.examined,
            values={'empty_suffix': False, 'degree_requirements': requirements, 'components': components,
                'components_after_vertex_removal': cuts, 'parity': parity,
                'forced_edge_refs': tuple(sorted(forced)), 'forbidden_edge_refs': tuple(sorted(forbidden)),
                'reduction_witnesses': tuple(witnesses), 'contradiction_certificates': tuple(contradictions),
                'covering_suffix_witness_present': False})
    except DComputationInterrupted as error:
        return d_result(request, 'NEEDS_EVIDENCE', error.cause, examined=budget.examined,
            frontier={'request_ref': request.scope.request_ref, 'input_digest': input_digest,
                'graph_revision_ref': request.graph_revision_ref, 'completed_rounds': round_index,
                'forced_edge_refs': tuple(sorted(forced)), 'forbidden_edge_refs': tuple(sorted(forbidden)),
                'reduction_witnesses': tuple(witnesses), 'restart_current_round': True, 'interrupted_stage': error.frontier})
