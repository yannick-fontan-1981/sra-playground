"""Reciprocal undirected port graph; leaks and cycles remain independent."""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result


class GraphPortD(FrozenModel):
    port_ref: Ref
    opposite_ref: Ref
    vector: tuple[int,int]


class PortCellD(FrozenModel):
    cell_ref: Ref
    position: tuple[int,int]
    opening_refs: tuple[Ref,...] = Field(default=(),max_length=64)
    opening_mask_complete: bool


class ReciprocalPortGraphRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.reciprocal_port_graph_request_d.v1'
    phase_ref: Literal['RECIPROCAL_CONNECTIVITY']
    ports: tuple[GraphPortD,...] = Field(min_length=1,max_length=64)
    cells: tuple[PortCellD,...] = Field(min_length=1,max_length=4096)
    source_refs: tuple[Ref,...] = Field(default=(),max_length=4096)
    source_connectivity_rule: Literal['ANY_SOURCE_REACHABLE','ONE_COMMON_COMPONENT']
    cell_domain_complete: bool
    require_all_source_connected: bool
    require_no_unmatched_ports: bool
    require_no_cycles: bool
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = (
        ('mechanics.finite_flow_network.reciprocal_port_graph','EVALUATE'),
    )

    @model_validator(mode='after')
    def reciprocal_domain(self):
        ports = {p.port_ref:p for p in self.ports}
        ids = {c.cell_ref for c in self.cells}
        if len(ports)!=len(self.ports) or len(ids)!=len(self.cells) or len({c.position for c in self.cells})!=len(ids):
            raise ValueError('port/cell identity or location duplicated')
        for p in self.ports:
            peer = ports.get(p.opposite_ref)
            if peer is None or peer.opposite_ref!=p.port_ref or peer.vector!=(-p.vector[0],-p.vector[1]) or p.vector==(0,0):
                raise ValueError('port relation must be an exact reciprocal geometric involution')
        if any(not set(c.opening_refs)<=set(ports) or len(set(c.opening_refs))!=len(c.opening_refs) for c in self.cells):
            raise ValueError('opening masks contain unknown/duplicate ports')
        if not set(self.source_refs)<=ids:
            raise ValueError('source outside graph')
        return self


def measure_reciprocal_port_graph_d(request: ReciprocalPortGraphRequestD):
    rejection = d_validate_request(request)
    if rejection is not None:
        return rejection
    if len(request.cells)+sum(len(c.opening_refs) for c in request.cells)>request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    if request.resume_frontier:
        return d_result(request,'NEEDS_EVIDENCE','RESTART_GRAPH_FROM_BOUND_INPUT')
    budget = DWorkBudget(request)
    try:
        positions = {c.position:c for c in request.cells}
        ports = {p.port_ref:p for p in request.ports}
        adjacency = {c.cell_ref:set() for c in request.cells}
        edges,unmatched,uncertain = set(),[],[]
        for cell in request.cells:
            for ref in cell.opening_refs:
                budget.visit({'stage':'reciprocal_port','cell_ref':cell.cell_ref,'port_ref':ref})
                port = ports[ref]
                neighbor = positions.get((cell.position[0]+port.vector[0],cell.position[1]+port.vector[1]))
                incidence = {'cell_ref':cell.cell_ref,'port_ref':ref,'neighbor_ref':None if neighbor is None else neighbor.cell_ref}
                if neighbor is not None and port.opposite_ref in neighbor.opening_refs:
                    edge = tuple(sorted((cell.cell_ref,neighbor.cell_ref)))
                    edges.add(edge)
                    adjacency[cell.cell_ref].add(neighbor.cell_ref)
                    adjacency[neighbor.cell_ref].add(cell.cell_ref)
                elif (neighbor is None and request.cell_domain_complete) or (neighbor is not None and neighbor.opening_mask_complete):
                    unmatched.append(incidence)
                else:
                    uncertain.append(incidence)
        components,source_reachable = [],set()
        seen = set()
        for cell in request.cells:
            if cell.cell_ref in seen:
                continue
            stack,component = [cell.cell_ref],set()
            seen.add(cell.cell_ref)
            while stack:
                ref = stack.pop()
                budget.visit({'stage':'component','cell_ref':ref})
                component.add(ref)
                for peer in sorted(adjacency[ref]):
                    if peer not in seen:
                        seen.add(peer)
                        stack.append(peer)
            components.append(tuple(sorted(component)))
            if component&set(request.source_refs):
                source_reachable.update(component)
        cycle_count = len(edges)-len(request.cells)+len(components)
        complete = request.cell_domain_complete and all(c.opening_mask_complete for c in request.cells)
        connected = (len(source_reachable)==len(request.cells) if request.source_connectivity_rule=='ANY_SOURCE_REACHABLE'
            else bool(request.source_refs) and len(components)==1)
        disproved = ((request.require_no_unmatched_ports and bool(unmatched)) or
            (request.require_no_cycles and cycle_count>0) or
            (request.require_all_source_connected and complete and not connected))
        terminal = False if disproved else (True if complete else None)
        budget.finish()
        return d_result(request,'COMPLETE','RECIPROCAL_GRAPH_MEASURED',complete=True,examined=budget.examined,
            values={'edges':tuple(sorted(edges)),'components':tuple(components),'source_reachable_refs':tuple(sorted(source_reachable)),
                'unmatched_incidences':tuple(unmatched),'uncertain_incidences':tuple(uncertain),
                'independent_cycle_count':cycle_count,'cycle_count_is_lower_bound':not complete,
                'graph_complete':complete,'all_source_connected':connected,
                'source_connectivity_rule':request.source_connectivity_rule,'terminal_predicate_result':terminal})
    except DComputationInterrupted as error:
        return d_result(request,'NEEDS_EVIDENCE',error.cause,examined=budget.examined,
            frontier={'restart_graph':True,'work':error.frontier})
