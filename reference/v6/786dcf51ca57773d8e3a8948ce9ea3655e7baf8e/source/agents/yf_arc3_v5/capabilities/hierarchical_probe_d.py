"""Realizable hierarchical queries and one read-only predicted input successor."""
from __future__ import annotations
from collections import deque
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .subset_observation_d import FaultAssignmentD, SubsetLawD, _predict_subset
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result


class HierarchyNodeD(FrozenModel):
    node_ref: Ref
    parent_ref: Ref | None
    member_refs: tuple[Ref,...] = Field(min_length=1,max_length=4096)
    native_query_input_ref: Ref | None


class HierarchyNavigationD(FrozenModel):
    source_ref: Ref
    destination_ref: Ref
    native_input_ref: Ref
    debit: int = Field(ge=0)


class HierarchicalProbeRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.hierarchical_probe_request_d.v1'
    phase_ref: Literal['QUERY_DOMAIN','EXTERNAL_INPUT_PREDICTION']
    nodes: tuple[HierarchyNodeD,...] = Field(min_length=1,max_length=4096)
    navigation: tuple[HierarchyNavigationD,...] = Field(default=(),max_length=4096)
    root_ref: Ref
    native_focus_ref: Ref
    assignments: tuple[FaultAssignmentD,...] = Field(min_length=1,max_length=4096)
    laws: tuple[SubsetLawD,...] = Field(min_length=1,max_length=128)
    bound_native_input_ref: Ref | None
    remaining_resource: int = Field(ge=0)
    query_debit: int = Field(ge=0)
    submitted_debit: int = Field(ge=0)
    refusal_debit: int = Field(ge=0)
    positive_singleton_confirmation_required: bool
    transient_display_rule: Literal['HOLD_UNTIL_NEXT_INPUT','RELEASE_AT_RESPONSE']
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = (
        ('mechanics.feedback_code_identification.hierarchical_probe','DOMAIN'),
        ('mechanics.feedback_code_identification.hierarchical_probe','STEP'),
    )

    @model_validator(mode='after')
    def hierarchy(self):
        nodes = {n.node_ref:n for n in self.nodes}
        if len(nodes)!=len(self.nodes) or self.root_ref not in nodes or self.native_focus_ref not in nodes:
            raise ValueError('hierarchy/focus identity invalid')
        roots = [n.node_ref for n in self.nodes if n.parent_ref is None]
        if roots != [self.root_ref]:
            raise ValueError('hierarchy must have the declared unique root')
        closed = {self.root_ref}
        for node in self.nodes:
            if len(set(node.member_refs))!=len(node.member_refs):
                raise ValueError('query subset contains duplicated members')
            if node.parent_ref is not None and (node.parent_ref not in nodes or
                    not set(node.member_refs)<=set(nodes[node.parent_ref].member_refs)):
                raise ValueError('child query is not a subset of its parent')
            trail,ref = set(),node.node_ref
            while ref not in closed:
                if ref in trail or ref not in nodes:
                    raise ValueError('hierarchy contains a cycle or missing ancestor')
                trail.add(ref)
                ref = nodes[ref].parent_ref
            closed.update(trail)
        bindings = set()
        for edge in self.navigation:
            if edge.source_ref not in nodes or edge.destination_ref not in nodes or (
                    nodes[edge.source_ref].parent_ref!=edge.destination_ref and nodes[edge.destination_ref].parent_ref!=edge.source_ref):
                raise ValueError('native navigation is not a declared hierarchy edge')
            pair = (edge.source_ref,edge.native_input_ref)
            if pair in bindings or nodes[edge.source_ref].native_query_input_ref==edge.native_input_ref:
                raise ValueError('native input channel has ambiguous meanings at this focus')
            bindings.add(pair)
        laws = {l.law_ref for l in self.laws}
        members = set(nodes[self.root_ref].member_refs)
        if len(laws)!=len(self.laws) or len({a.assignment_ref for a in self.assignments})!=len(self.assignments) or any(
                a.law_ref not in laws or not set(a.fault_member_refs)<=members for a in self.assignments):
            raise ValueError('frozen fault/law assignments outside hierarchy')
        if self.mode_ref=='DOMAIN' and self.phase_ref!='QUERY_DOMAIN' or self.mode_ref=='STEP' and self.phase_ref!='EXTERNAL_INPUT_PREDICTION':
            raise ValueError('mode and physical query phase differ')
        return self


def measure_hierarchical_probe_d(request: HierarchicalProbeRequestD):
    refusal = d_validate_request(request)
    if refusal is not None:
        return refusal
    if max(len(request.nodes),len(request.navigation),len(request.assignments),sum(len(n.member_refs) for n in request.nodes))>request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    if request.resume_frontier:
        return d_result(request,'NEEDS_EVIDENCE','RESTART_QUERY_FROM_BOUND_INPUT')
    budget = DWorkBudget(request)
    try:
        nodes = {n.node_ref:n for n in request.nodes}
        laws = {l.law_ref:l for l in request.laws}
        edges = {n.node_ref:[] for n in request.nodes}
        for edge in request.navigation:
            budget.visit({'stage':'native_navigation','source_ref':edge.source_ref})
            edges[edge.source_ref].append(edge)
        candidates,focus = [],request.native_focus_ref
        debit,kind = request.submitted_debit,'UNCHANGED'
        if request.mode_ref=='DOMAIN':
            queue = deque([(focus,(),0)])
            visited = {focus}
            while queue:
                ref,word,cost = queue.popleft()
                budget.visit({'stage':'realizable_query','node_ref':ref})
                if len(word)>request.depth_bound:
                    raise DComputationInterrupted('NAVIGATION_DEPTH_BOUND',{})
                node = nodes[ref]
                if node.native_query_input_ref is not None:
                    candidates.append((node,word+(node.native_query_input_ref,),cost+request.query_debit+request.submitted_debit))
                for edge in edges[ref]:
                    if edge.destination_ref not in visited:
                        visited.add(edge.destination_ref)
                        queue.append((edge.destination_ref,word+(edge.native_input_ref,),cost+edge.debit+request.submitted_debit))
        else:
            if request.bound_native_input_ref is None:
                return d_result(request,'NEEDS_EVIDENCE','NATIVE_INPUT_NOT_BOUND')
            edge = next((e for e in edges[focus] if e.native_input_ref==request.bound_native_input_ref),None)
            if edge is not None:
                if debit+edge.debit<=request.remaining_resource:
                    focus,debit,kind = edge.destination_ref,debit+edge.debit,'FOCUS_CHANGE'
                else:
                    debit,kind = debit+request.refusal_debit,'RESOURCE_REFUSAL'
            elif nodes[focus].native_query_input_ref==request.bound_native_input_ref:
                if debit+request.query_debit<=request.remaining_resource:
                    debit,kind = debit+request.query_debit,'PAID_QUERY'
                    candidates.append((nodes[focus],(request.bound_native_input_ref,),debit))
                else:
                    debit,kind = debit+request.refusal_debit,'RESOURCE_REFUSAL'
            else:
                debit,kind = debit+request.refusal_debit,'NATIVE_INPUT_REFUSAL'
        rows,unresolved = [],False
        for node,word,cost in candidates:
            predictions = []
            for assignment in request.assignments:
                budget.visit({'stage':'read_only_evaluate','node_ref':node.node_ref,'assignment_ref':assignment.assignment_ref})
                feedback = _predict_subset(assignment,laws[assignment.law_ref],node.member_refs)
                unresolved = unresolved or feedback is None
                predictions.append({'assignment_ref':assignment.assignment_ref,'predicted_ordered_feedback':feedback,
                    'actual_receipt':False,'singleton_query':len(node.member_refs)==1})
            rows.append({'node_ref':node.node_ref,'tested_member_refs':node.member_refs,'native_input_word':word,
                'word_debit':cost,'word_is_funded':cost<=request.remaining_resource,'predictions':tuple(predictions),
                'action_release_authorized':False})
        budget.finish()
        return d_result(request,'NEEDS_EVIDENCE' if unresolved else 'COMPLETE',
            'FEEDBACK_LAW_INCOMPLETE' if unresolved else 'HIERARCHICAL_QUERY_RESULT',complete=not unresolved,examined=budget.examined,
            values={'query_candidates':tuple(rows),'native_focus_ref':focus,'input_result':kind,
                'all_navigation_words_enumerated':False,
                'debit':debit if request.mode_ref=='STEP' else None,
                'remaining_resource':max(0,request.remaining_resource-debit) if request.mode_ref=='STEP' else request.remaining_resource,
                'retained_assignment_refs':tuple(a.assignment_ref for a in request.assignments),
                'posterior_filtered':False,'actual_feedback_receipts':(),
                'display_phase_after_response':request.transient_display_rule if kind=='PAID_QUERY' else None,
                'positive_confirmation_is_predicted_not_observed':kind=='PAID_QUERY' and request.positive_singleton_confirmation_required,
                'complete_response_boundary_count':int(request.mode_ref=='STEP' and not unresolved)})
    except DComputationInterrupted as error:
        return d_result(request,'NEEDS_EVIDENCE',error.cause,examined=budget.examined,
            frontier={'restart_query':True,'work':error.frontier})
