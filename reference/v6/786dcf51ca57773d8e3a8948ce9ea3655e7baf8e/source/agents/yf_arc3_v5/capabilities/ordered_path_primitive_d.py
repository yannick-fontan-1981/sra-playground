"""One caller-described ordered-prefix command; no route search or action release."""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import Ref
from .single_visit_residual_d import ResidualEdgeD
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_result, d_validate_request


class OrderedPathPrimitiveRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.ordered_path_primitive_request_d.v1'
    phase_ref: Literal['EXTERNAL_COMMAND']
    node_refs: tuple[Ref, ...] = Field(min_length=1, max_length=4096)
    edges: tuple[ResidualEdgeD, ...] = Field(default=(), max_length=4096)
    wall_edge_refs: tuple[Ref, ...] = Field(default=(), max_length=4096)
    required_node_refs: tuple[Ref, ...] = Field(min_length=1, max_length=4096)
    ordered_prefix: tuple[Ref, ...] = Field(min_length=1, max_length=4096)
    start_ref: Ref
    endpoint_ref: Ref
    channel: Literal['CLICK', 'DIRECTION', 'UNDO', 'RESET']
    bound_target_ref: Ref | None
    ancestor_inclusive: bool
    click_ancestor_before_edge_guard: bool
    distant_click_ancestor_retraction_supported: bool
    direction_ancestor_retraction_supported: bool
    endpoint_reserved_for_last: bool
    submitted_command_cost: int = Field(ge=0)
    accepted_edit_cost: int = Field(ge=0)
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = (
        ('mechanics.editable_configuration_graph.ordered_path_external_primitive', 'STEP'),
    )

    @model_validator(mode='after')
    def exact_domain(self):
        nodes, prefix = set(self.node_refs), set(self.ordered_prefix)
        if len(nodes) != len(self.node_refs) or len(prefix) != len(self.ordered_prefix):
            raise ValueError('duplicate graph vertex or non-simple prefix')
        if self.ordered_prefix[0] != self.start_ref or not prefix <= nodes:
            raise ValueError('prefix/start outside supplied domain')
        if self.endpoint_ref not in nodes or not set(self.required_node_refs) <= nodes:
            raise ValueError('endpoint/coverage domain outside graph')
        refs, pairs = set(), set()
        for edge in self.edges:
            pair = tuple(sorted((edge.first_ref, edge.second_ref)))
            if edge.first_ref not in nodes or edge.second_ref not in nodes or edge.first_ref == edge.second_ref:
                raise ValueError('edge endpoints outside graph')
            if edge.edge_ref in refs or pair in pairs:
                raise ValueError('duplicate physical edge')
            refs.add(edge.edge_ref)
            pairs.add(pair)
        if not set(self.wall_edge_refs) <= refs:
            raise ValueError('wall outside supplied physical edge domain')
        if self.bound_target_ref is not None and self.bound_target_ref not in nodes:
            raise ValueError('bound native target outside graph')
        return self


def measure_ordered_path_primitive_d(request: OrderedPathPrimitiveRequestD):
    rejected = d_validate_request(request)
    if rejected is not None:
        return rejected
    if max(len(request.node_refs), len(request.edges), len(request.ordered_prefix)) > request.domain_bound:
        return d_result(request, 'NEEDS_EVIDENCE', 'INPUT_DOMAIN_BOUND')
    if request.resume_frontier:
        return d_result(request, 'NEEDS_EVIDENCE', 'ATOMIC_COMMAND_REQUIRES_RESTART_FROM_BOUND_INPUT')
    budget = DWorkBudget(request)
    prefix = request.ordered_prefix
    before, cause = prefix, 'UNCHANGED'
    target = request.bound_target_ref
    try:
        edge_by_pair = {}
        for edge in request.edges:
            budget.visit({'stage': 'edges', 'edge_ref': edge.edge_ref})
            edge_by_pair[tuple(sorted((edge.first_ref, edge.second_ref)))] = edge.edge_ref
        budget.visit({'stage': 'one_external_command'})
        if request.channel == 'RESET':
            prefix, cause = (request.start_ref,), 'RESET_PREFIX'
        elif request.channel == 'UNDO':
            if len(prefix) > 1:
                prefix, cause = prefix[:-1], 'UNDO_ONE'
        elif target is None:
            return d_result(request, 'NEEDS_EVIDENCE', 'NATIVE_TARGET_NOT_BOUND', examined=budget.examined)
        else:
            ancestor = target in prefix
            edge_ref = edge_by_pair.get(tuple(sorted((prefix[-1], target))))
            edge_open = edge_ref is not None and edge_ref not in request.wall_edge_refs
            early_click_ancestor = (
                request.channel == 'CLICK' and ancestor
                and request.click_ancestor_before_edge_guard
                and (request.distant_click_ancestor_retraction_supported or edge_open)
            )
            if early_click_ancestor:
                stop = prefix.index(target) + int(request.ancestor_inclusive)
                if stop:
                    prefix, cause = prefix[:stop], 'RETRACT_TO_CLICKED_ANCESTOR'
                else:
                    cause = 'START_REMOVAL_REFUSED'
            elif not edge_open:
                cause = 'EDGE_REFUSED'
            elif ancestor:
                if request.channel == 'DIRECTION' and not request.direction_ancestor_retraction_supported:
                    cause = 'ANCESTOR_REENTRY_REFUSED'
                else:
                    stop = prefix.index(target) + int(request.ancestor_inclusive)
                    if stop:
                        prefix, cause = prefix[:stop], 'RETRACT_TO_EDGE_REACHABLE_ANCESTOR'
                    else:
                        cause = 'START_REMOVAL_REFUSED'
            elif (target == request.endpoint_ref and request.endpoint_reserved_for_last
                    and not set(request.required_node_refs) <= set(prefix) | {target}):
                cause = 'PREMATURE_ENDPOINT_REFUSED'
            else:
                prefix, cause = (*prefix, target), 'APPEND_ONE_NEIGHBOR'
        budget.finish()
        changed = prefix != before
        return d_result(request, 'COMPLETE', 'ONE_BOUND_EXTERNAL_COMMAND_CALCULATED', complete=True, examined=budget.examined,
            values={'ordered_prefix': prefix, 'head_ref': prefix[-1], 'visited_node_refs': tuple(sorted(prefix)),
                'removed_node_count': len(set(before) - set(prefix)),
                'appended_node_count': len(set(prefix) - set(before)),
                'configuration_changed': changed, 'command_result_code': cause,
                'submitted_command_cost': request.submitted_command_cost,
                'accepted_edit_cost': request.accepted_edit_cost if changed else 0,
                'required_nodes_present': set(request.required_node_refs) <= set(prefix),
                'head_matches_endpoint': prefix[-1] == request.endpoint_ref,
                'complete_response_boundary_count': 1})
    except DComputationInterrupted as error:
        return d_result(request, 'NEEDS_EVIDENCE', error.cause, examined=budget.examined,
            frontier={'restart_from_bound_input': True, 'interrupted_stage': error.frontier})
