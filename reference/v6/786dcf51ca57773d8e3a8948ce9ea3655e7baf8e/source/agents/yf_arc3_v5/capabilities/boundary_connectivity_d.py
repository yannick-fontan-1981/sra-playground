"""Cell-level components and checked region interface composition."""
from __future__ import annotations
from collections import deque
from itertools import product
from typing import ClassVar, Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result


class PassageCellD(FrozenModel):
    cell_ref: Ref
    embedding: tuple[int, int]
    mask_role: Literal['FREE', 'OCCUPIED']


class PassageEdgeD(FrozenModel):
    endpoints: tuple[Ref, Ref]
    adjacency_role: Literal['PASSAGE', 'OCCUPANCY_ONLY']
    directed: bool


class PassageGraphD(FrozenModel):
    cells: tuple[PassageCellD, ...] = Field(min_length=1, max_length=4096)
    edges: tuple[PassageEdgeD, ...] = Field(default=(), max_length=8192)
    ports: tuple[tuple[Ref, Ref], ...] = Field(default=(), max_length=128)


class RegionPoseD(FrozenModel):
    pose_ref: Ref
    graph: PassageGraphD
    shared_assignments: tuple[tuple[Ref, Ref], ...]
    control_cost: int = Field(ge=0)


class RegionDomainD(FrozenModel):
    region_ref: Ref
    initial_pose_ref: Ref
    poses: tuple[RegionPoseD, ...] = Field(min_length=1, max_length=128)
    legal_pose_transitions: tuple[tuple[Ref, Ref], ...] = Field(default=(), max_length=4096)


class BoundaryConnectivityRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.boundary_connectivity_request_d.v1'
    phase_ref: Literal['PRESENT_PASSAGE', 'LOCAL_POSE_COMPOSITION']
    graph: PassageGraphD | None
    start_cell_ref: Ref
    goal_cell_ref: Ref
    regions: tuple[RegionDomainD, ...] = Field(default=(), max_length=128)
    interfaces: tuple[tuple[Ref, Ref, Ref, Ref], ...] = Field(default=(), max_length=4096)
    interface_information_complete: bool
    shared_variables_complete: bool
    selection_cost_independence_proved: bool
    factorization_evidence_ref: Ref | None
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = (
        ('mechanics.articulated_channel_kinematics.boundary_connectivity_quotient', 'EVALUATE'),
        ('mechanics.articulated_channel_kinematics.boundary_connectivity_quotient', 'DOMAIN'))


def _passage_adjacency(graph, budget):
    cells = {c.cell_ref: c for c in graph.cells}
    if len(cells) != len(graph.cells) or len({p for p, _ in graph.ports}) != len(graph.ports):
        raise ValueError('cell/port identities duplicated')
    if any(c not in cells for _, c in graph.ports): raise ValueError('port cell absent')
    free = {c.cell_ref for c in graph.cells if c.mask_role == 'FREE'}
    adjacency = {c: [] for c in sorted(free)}
    for edge in graph.edges:
        budget.visit({'stage': 'passage_edge', 'endpoints': edge.endpoints})
        a, b = edge.endpoints
        if a not in cells or b not in cells: raise ValueError('edge cell absent')
        if edge.adjacency_role != 'PASSAGE' or a not in free or b not in free: continue
        adjacency[a].append(b)
        if not edge.directed: adjacency[b].append(a)
    return {k: tuple(sorted(set(v))) for k, v in sorted(adjacency.items())}


def _passage_reach(adjacency, start, budget):
    parents = {start: None} if start in adjacency else {}
    queue = deque(parents)
    while queue:
        current = queue.popleft()
        budget.visit({'stage': 'cell_reachability', 'cell_ref': current})
        for neighbor in adjacency[current]:
            if neighbor not in parents:
                parents[neighbor] = current
                queue.append(neighbor)
    return parents


def _passage_summary(graph, start, goal, budget):
    adjacency = _passage_adjacency(graph, budget)
    reachable = _passage_reach(adjacency, start, budget)
    path = []
    if goal in reachable:
        cursor = goal
        while cursor is not None:
            path.append(cursor); cursor = reachable[cursor]
        path.reverse()
    # Directed reachability is not an equivalence relation: retain each port's set.
    port_sets = tuple((port, tuple(sorted(_passage_reach(adjacency, cell, budget)))) for port, cell in graph.ports)
    unseen = set(adjacency)
    components = []
    undirected = {c: set(neighbors) for c, neighbors in sorted(adjacency.items())}
    for c, neighbors in sorted(adjacency.items()):
        for n in neighbors: undirected[n].add(c)
    while unseen:
        seed = min(unseen)
        component = tuple(sorted(_passage_reach(undirected, seed, budget)))
        components.append(component); unseen.difference_update(component)
    return {'free_components': tuple(components), 'reachable_cell_refs': tuple(sorted(reachable)),
        'start_goal_reachable': goal in reachable, 'cell_passage_witness': tuple(path), 'port_reachable_cell_sets': port_sets}


def measure_boundary_connectivity_d(request: BoundaryConnectivityRequestD):
    refusal = d_validate_request(request)
    if refusal is not None: return refusal
    budget = DWorkBudget(request)
    try:
        if request.mode_ref == 'EVALUATE':
            if request.phase_ref != 'PRESENT_PASSAGE' or request.graph is None:
                return d_result(request, 'NEEDS_EVIDENCE', 'PRESENT_GRAPH_REQUIRED')
            summary = _passage_summary(request.graph, request.start_cell_ref, request.goal_cell_ref, budget)
            budget.finish()
            return d_result(request, 'COMPLETE', 'CELL_LEVEL_PASSAGE', complete=True, examined=budget.examined, values=summary)
        if request.phase_ref != 'LOCAL_POSE_COMPOSITION' or not request.regions:
            return d_result(request, 'NEEDS_EVIDENCE', 'LOCAL_DOMAINS_REQUIRED')
        if len({r.region_ref for r in request.regions}) != len(request.regions): raise ValueError('duplicate region')
        domains, local_signatures = [], []
        for region in request.regions:
            poses = {p.pose_ref: p for p in region.poses}
            if len(poses) != len(region.poses) or region.initial_pose_ref not in poses: raise ValueError('pose domain invalid')
            adjacency = {p: [] for p in sorted(poses)}
            for a, b in region.legal_pose_transitions:
                if a not in poses or b not in poses: raise ValueError('pose transition outside domain')
                adjacency[a].append(b)
            reachable = _passage_reach(adjacency, region.initial_pose_ref, budget)
            admitted = tuple(poses[p] for p in sorted(reachable))
            domains.append(admitted)
            for pose in admitted:
                summary = _passage_summary(pose.graph, request.start_cell_ref, request.goal_cell_ref, budget)
                local_signatures.append({'region_ref': region.region_ref, 'pose_ref': pose.pose_ref, 'signature': summary,
                    'shared_assignments': pose.shared_assignments, 'control_cost': pose.control_cost})
        size = 1
        for d in domains: size *= len(d)
        if size > request.domain_bound:
            return d_result(request, 'BUDGET_REACHED', 'CORRELATED_CONFIGURATION_DOMAIN_BOUND', examined=budget.examined,
                frontier={'restart_joint_domain': True, 'domain_size': size})
        certified = bool(request.interface_information_complete and request.shared_variables_complete and
            request.selection_cost_independence_proved and request.factorization_evidence_ref)
        rows, witnesses = [], []
        for assignment in product(*domains):
            budget.visit({'stage': 'joint_local_assignment'})
            shared, compatible = {}, True
            for pose in assignment:
                if len(dict(pose.shared_assignments)) != len(pose.shared_assignments): raise ValueError('duplicate shared variable')
                for key, value in pose.shared_assignments:
                    if key in shared and shared[key] != value: compatible = False
                    shared[key] = value
            if not compatible: continue
            region_poses = {r.region_ref: p for r, p in zip(request.regions, assignment)}
            cells, edges = {}, []
            for pose in assignment:
                for cell in pose.graph.cells:
                    if cell.cell_ref in cells and cell != cells[cell.cell_ref]: compatible = False
                    cells[cell.cell_ref] = cell
                edges.extend(pose.graph.edges)
            if not compatible: continue
            for ra, pa, rb, pb in request.interfaces:
                if ra not in region_poses or rb not in region_poses: raise ValueError('interface region absent')
                a, b = dict(region_poses[ra].graph.ports).get(pa), dict(region_poses[rb].graph.ports).get(pb)
                if a is None or b is None: raise ValueError('interface port embedding incomplete')
                edges.append(PassageEdgeD(endpoints=(a, b), adjacency_role='PASSAGE', directed=False))
            graph = PassageGraphD(cells=tuple(c for _, c in sorted(cells.items())), edges=tuple(edges))
            summary = _passage_summary(graph, request.start_cell_ref, request.goal_cell_ref, budget)
            refs = tuple((r.region_ref, p.pose_ref) for r, p in zip(request.regions, assignment))
            rows.append({'assignment': refs, 'shared_assignments': tuple(sorted(shared.items())),
                'reachability': summary['start_goal_reachable'], 'additive_component_cost': sum(p.control_cost for p in assignment),
                'control_cost': sum(p.control_cost for p in assignment) if certified else None})
            if summary['start_goal_reachable'] and len(witnesses) < 3:
                witnesses.append({'assignment': refs, 'expanded_cell_path': summary['cell_passage_witness'],
                    'control_cost': sum(p.control_cost for p in assignment) if certified else None})
        budget.finish()
        return d_result(request, 'COMPLETE', 'CERTIFIED_INTERFACE_COMPOSITION' if certified else 'CORRELATED_JOINT_DOMAIN_REQUIRED',
            complete=True, examined=budget.examined, values={'local_signatures': tuple(local_signatures),
            'joint_assignment_rows': tuple(rows), 'passage_witnesses': tuple(witnesses),
            'factorization_certified': certified, 'player_movement_command_sequence': False,
            'selection_cost_independence_proved': request.selection_cost_independence_proved})
    except (ValueError, KeyError) as error:
        return d_result(request, 'NEEDS_EVIDENCE', 'INVALID_INTERFACE_DOMAIN', values={'error': str(error)})
    except DComputationInterrupted as error:
        return d_result(request, 'BUDGET_REACHED', error.cause, examined=budget.examined,
            frontier={'restart_connectivity_domain': True, 'work': error.frontier})
