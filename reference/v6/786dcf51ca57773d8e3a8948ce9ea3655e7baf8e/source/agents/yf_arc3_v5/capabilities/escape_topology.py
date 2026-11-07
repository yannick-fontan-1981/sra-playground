"""Finite actor-configuration topology; DRM owns dead-end/trap interpretation.

Nodes may denote cell anchors, free-geometry configurations or machine states.
The caller must include the actor's whole footprint and every admitted kind of
transition. Staying put is never counted as a relocation. Unknown edges and
incomplete successor domains cannot prove confinement.
"""
from collections import deque
from typing import Literal

from pydantic import Field, model_validator

from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref


class EscapeTransition(FrozenModel):
    origin_ref: Ref
    destination_ref: Ref
    availability: Literal["free", "blocked", "unknown"]
    evidence_refs: tuple[Ref, ...] = ()


class EscapeTopologyDomain(FrozenModel):
    model_ref: Ref
    actor_ref: Ref
    current_node_ref: Ref
    node_refs: tuple[Ref, ...] = Field(min_length=1, max_length=4096)
    transitions: tuple[EscapeTransition, ...] = Field(default=(), max_length=65536)
    region_node_refs: tuple[Ref, ...] = Field(min_length=1, max_length=4096)
    complete_successor_node_refs: tuple[Ref, ...] = ()
    completeness_evidence_refs: tuple[Ref, ...] = ()
    occupancy_scope: Literal["terrain_only", "current_occupancy"]

    @model_validator(mode="after")
    def validate_domain(self):
        nodes, region = set(self.node_refs), set(self.region_node_refs)
        if len(nodes) != len(self.node_refs) or len(region) != len(self.region_node_refs):
            raise ValueError("escape topology repeats a node")
        if self.current_node_ref not in region or not region <= nodes:
            raise ValueError("escape region must contain the actor and lie in the node domain")
        if not set(self.complete_successor_node_refs) <= nodes:
            raise ValueError("successor completeness refers outside the node domain")
        if self.complete_successor_node_refs and not self.completeness_evidence_refs:
            raise ValueError("closed successor domains require explicit completeness evidence")
        pairs = set()
        for edge in self.transitions:
            pair = (edge.origin_ref, edge.destination_ref)
            if not set(pair) <= nodes or pair in pairs:
                raise ValueError("transition domain is contradictory or has an unbound endpoint")
            pairs.add(pair)
            if edge.availability != "unknown" and not edge.evidence_refs:
                raise ValueError("free/blocked transitions require evidence")
        return self


def measure_escape_topology(domain: EscapeTopologyDomain, budget) -> FrozenMap:
    outgoing = {ref: [] for ref in domain.node_refs}
    for edge in domain.transitions:
        budget.visit({"escape_actor_ref": domain.actor_ref, "origin_ref": edge.origin_ref})
        outgoing[edge.origin_ref].append(edge)
    region = set(domain.region_node_refs)
    complete = set(domain.complete_successor_node_refs)
    reached, queue, gateways, boundary = {domain.current_node_ref}, deque((domain.current_node_ref,)), set(), []
    unknown_origins = set()
    while queue:
        origin = queue.popleft()
        budget.visit({"escape_actor_ref": domain.actor_ref, "region_origin_ref": origin})
        for edge in outgoing[origin]:
            if edge.availability == "unknown":
                unknown_origins.add(origin)
            if edge.availability != "free" or edge.destination_ref == origin:
                continue
            destination = edge.destination_ref
            if destination not in region:
                gateways.add(destination)
                boundary.append((origin, destination))
            elif destination not in reached:
                reached.add(destination)
                queue.append(destination)
    current = outgoing[domain.current_node_ref]
    current_free = tuple(sorted(edge.destination_ref for edge in current
        if edge.availability == "free" and edge.destination_ref != domain.current_node_ref))
    unknown_current = sum(edge.availability == "unknown" for edge in current)
    return FrozenMap({
        "model_ref": domain.model_ref, "actor_ref": domain.actor_ref,
        "current_node_ref": domain.current_node_ref, "occupancy_scope": domain.occupancy_scope,
        "current_free_relocation_refs": current_free, "current_free_relocation_count": len(current_free),
        "current_unknown_transition_count": unknown_current,
        "current_successor_domain_complete": domain.current_node_ref in complete and unknown_current == 0,
        "reachable_region_node_refs": tuple(sorted(reached)),
        "boundary_transition_refs": tuple(sorted(boundary)),
        "egress_gateway_refs": tuple(sorted(gateways)), "egress_gateway_count": len(gateways),
        "reachable_region_domain_complete": reached <= complete and not unknown_origins,
        "completeness_evidence_refs": domain.completeness_evidence_refs,
        "stationary_responses_excluded_from_relocations": True,
        "capture_observation_established": False,
        "primitive_release_authorized": False,
    })
