"""Caller-bound endpoint geometry, not capture, teleportation or action release.

The caller supplies glyph alternatives and scoped permission evidence. No
render palette, game identity or solved route enters this finite calculation.
"""
from __future__ import annotations

from typing import Annotated, ClassVar, Literal

from pydantic import Field, model_validator

from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .mechanical_family_contracts_d import (
    DComputationInterrupted, DMechanicalRequest, DResumeMismatch, DWorkBudget,
    d_result, d_resume_rows, d_resumable_frontier, d_validate_request,
)

Coordinate = Annotated[int, Field(strict=True)]
Point = tuple[Coordinate, Coordinate]


class LandingNodeD(FrozenModel):
    node_ref: Ref
    point: Point
    glyph_ref: Ref | None = None


class LandingDirectionD(FrozenModel):
    glyph_ref: Ref
    vector: Point

    @model_validator(mode='after')
    def nonzero(self):
        if self.vector == (0, 0):
            raise ValueError('a supplied ray direction must be nonzero')
        return self


class LandingRelationModelD(FrozenModel):
    model_ref: Ref
    control_side: Literal['SOURCE', 'DESTINATION']
    relation: Literal['POSITIVE_RAY', 'FINITE_OFFSET']
    directions: tuple[LandingDirectionD, ...] = Field(default=(), max_length=128)
    positive_distances: tuple[Coordinate, ...] = Field(default=(), max_length=128)
    offsets: tuple[Point, ...] = Field(default=(), max_length=128)

    @model_validator(mode='after')
    def finite_unique(self):
        if len({row.glyph_ref for row in self.directions}) != len(self.directions):
            raise ValueError('one conditional direction per glyph per model')
        if any(distance <= 0 for distance in self.positive_distances):
            raise ValueError('positive ray distances exclude zero and reversal')
        if len(set(self.positive_distances)) != len(self.positive_distances):
            raise ValueError('distinct supplied ray distances')
        if len(set(self.offsets)) != len(self.offsets):
            raise ValueError('distinct supplied offsets')
        if self.relation == 'POSITIVE_RAY' and (not self.positive_distances or self.offsets):
            raise ValueError('ray model requires its finite distance domain only')
        if self.relation == 'FINITE_OFFSET' and (not self.offsets or self.positive_distances):
            raise ValueError('offset model requires its explicit offset domain only')
        return self


class LandingObservationD(FrozenModel):
    evidence_ref: Ref
    source_node_ref: Ref
    landing_node_ref: Ref
    # A no-motion frame alone is UNKNOWN: selection, budget, restoration or
    # other admission conditions may explain it without refuting geometry.
    relation_outcome: bool | None
    relation_test_complete: bool
    sealed: bool
    epoch: int = Field(ge=0)
    graph_revision_ref: Ref


class LandingAdmissionD(FrozenModel):
    evidence_ref: Ref
    source_node_ref: Ref
    landing_node_ref: Ref
    admitted: bool


class EndpointLandingRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.endpoint_landing_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = tuple(
        ('mechanics.endpoint_navigation.landing_relation.compute', mode)
        for mode in ('FIT', 'DOMAIN', 'PRECONDITION')
    ) + tuple(('mechanics.endpoint_navigation.landing_relation', mode)
              for mode in ('FIT', 'DOMAIN', 'PRECONDITION'))
    phase_ref: Literal['ENDPOINT_RELATION'] | None = None
    nodes: tuple[LandingNodeD, ...] = Field(min_length=1, max_length=4096)
    models: tuple[LandingRelationModelD, ...] = Field(min_length=1, max_length=128)
    graph_revision_ref: Ref
    source_node_ref: Ref | None = None
    landing_node_ref: Ref | None = None
    relation_observations: tuple[LandingObservationD, ...] = Field(default=(), max_length=4096)
    admissions: tuple[LandingAdmissionD, ...] = Field(default=(), max_length=4096)
    command_cost: int | None = Field(default=None, ge=0)
    remaining_resource: int | None = Field(default=None, ge=0)

    @model_validator(mode='after')
    def exact_domain(self):
        if self.operation_ref == 'mechanics.endpoint_navigation.landing_relation' and self.phase_ref is None:
            raise ValueError('V1.5 landing relation requires its explicit endpoint phase')
        refs = {node.node_ref for node in self.nodes}
        if len(refs) != len(self.nodes) or len({node.point for node in self.nodes}) != len(self.nodes):
            raise ValueError('distinct node identities and positions')
        if any(ref is not None and ref not in refs
               for ref in (self.source_node_ref, self.landing_node_ref)):
            raise ValueError('requested endpoints belong to the supplied graph')
        for row in (*self.relation_observations, *self.admissions):
            if row.source_node_ref not in refs or row.landing_node_ref not in refs:
                raise ValueError('evidence endpoints belong to the supplied graph')
        pairs = [(row.source_node_ref, row.landing_node_ref) for row in self.admissions]
        if len(set(pairs)) != len(pairs):
            raise ValueError('conflicting permissions require separate caller alternatives')
        return self


def _relation(model, source, landing, directions, distances, offsets):
    delta = (landing.point[0] - source.point[0], landing.point[1] - source.point[1])
    if model.relation == 'FINITE_OFFSET':
        return delta in offsets, None
    controlled = source if model.control_side == 'SOURCE' else landing
    vector = directions.get(controlled.glyph_ref)
    if vector is None:
        return None, None
    axis = 0 if vector[0] != 0 else 1
    distance, remainder = divmod(delta[axis], vector[axis])
    if (remainder == 0 and distance in distances
            and delta == (distance * vector[0], distance * vector[1])):
        return True, distance
    return False, None


def _calculate_model(request, model, nodes, admissions, budget):
    directions = {row.glyph_ref: row.vector for row in model.directions}
    distances, offsets = set(model.positive_distances), set(model.offsets)
    if request.mode_ref == 'FIT':
        contradictions, unresolved, checked = [], [], []
        for index, observation in enumerate(request.relation_observations):
            budget.visit({'model_ref': model.model_ref, 'observation_index': index})
            if (not observation.sealed or not observation.relation_test_complete
                    or observation.relation_outcome is None
                    or observation.epoch != request.scope.epoch
                    or observation.graph_revision_ref != request.graph_revision_ref):
                unresolved.append(observation.evidence_ref)
                continue
            matched, _ = _relation(model, nodes[observation.source_node_ref],
                                   nodes[observation.landing_node_ref], directions, distances, offsets)
            if matched is None:
                unresolved.append(observation.evidence_ref)
            else:
                checked.append(observation.evidence_ref)
                if matched != observation.relation_outcome:
                    contradictions.append(observation.evidence_ref)
        return {'model_ref': model.model_ref,
                'contradiction_evidence_refs': tuple(contradictions),
                'unresolved_evidence_refs': tuple(unresolved),
                'checked_evidence_refs': tuple(checked)}
    if request.source_node_ref is None:
        raise DResumeMismatch('SOURCE_NODE_NOT_BOUND')
    if request.mode_ref == 'PRECONDITION' and request.landing_node_ref is None:
        raise DResumeMismatch('LANDING_NODE_NOT_BOUND')
    source = nodes[request.source_node_ref]
    domain = (nodes[request.landing_node_ref],) if request.mode_ref == 'PRECONDITION' else request.nodes
    rows = []
    for index, landing in enumerate(domain):
        budget.visit({'model_ref': model.model_ref, 'landing_index': index})
        matched, distance = _relation(model, source, landing, directions, distances, offsets)
        admission = admissions.get((source.node_ref, landing.node_ref))
        funded = None if request.command_cost is None or request.remaining_resource is None else (
            request.command_cost <= request.remaining_resource)
        rows.append({'source_node_ref': source.node_ref, 'landing_node_ref': landing.node_ref,
                     'geometric_relation_matches': matched, 'positive_ray_distance': distance,
                     'current_endpoint_admitted': None if admission is None else admission.admitted,
                     'admission_evidence_ref': None if admission is None else admission.evidence_ref,
                     'command_cost': request.command_cost, 'current_command_funded': funded,
                     # This kernel answers endpoints, not the existence or cost
                     # of a future path. A legal cyan mark never answers both.
                     'funded_continuation': None})
    return {'model_ref': model.model_ref, 'endpoint_rows': tuple(rows)}


def measure_endpoint_landing_d(request: EndpointLandingRequestD):
    rejected = d_validate_request(request)
    if rejected is not None:
        return rejected
    sizes = (len(request.nodes), len(request.relation_observations), len(request.admissions),
             len(request.models), *(len(model.positive_distances) for model in request.models),
             *(len(model.offsets) for model in request.models),
             *(len(model.directions) for model in request.models))
    if max(sizes) > request.domain_bound:
        return d_result(request, 'NEEDS_EVIDENCE', 'INPUT_DOMAIN_BOUND')
    budget = DWorkBudget(request)
    rows, model_ref = [], None
    try:
        nodes = {node.node_ref: node for node in request.nodes}
        admissions = {(row.source_node_ref, row.landing_node_ref): row for row in request.admissions}
        rows = d_resume_rows(request, tuple(model.model_ref for model in request.models))
        for model in request.models[len(rows):]:
            model_ref = model.model_ref
            rows.append(_calculate_model(request, model, nodes, admissions, budget))
        budget.finish()
        return d_result(request, 'COMPLETE', 'REQUESTED_FINITE_CALCULATION_RETURNED',
                        values={'model_correlated_results': tuple(rows),
                            'uncontradicted_model_refs': tuple(row['model_ref'] for row in rows
                                if not row.get('contradiction_evidence_refs')),
                            'model_choice_authorized': False}, complete=True,
                        examined=budget.examined)
    except DResumeMismatch as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined)
    except DComputationInterrupted as error:
        return d_result(request, 'NEEDS_EVIDENCE', error.cause,
                        values={'model_correlated_results': tuple(rows)}, examined=budget.examined,
                        frontier=d_resumable_frontier(request, rows, model_ref, error.frontier))
