"""Irreversible source-set necessities and bounded joint excavation candidates."""
from __future__ import annotations
from collections import deque
from time import monotonic
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref, FrozenMap
from .original_source_equilibrium_d import OriginalSourceEquilibriumRequestD, measure_original_source_equilibrium_d
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result, d_input_digest


class ExcavationJoinCandidateD(FrozenModel):
    candidate_ref: Ref
    candidate_simulation_context_ref: Ref
    excavated_cell_refs: tuple[Ref,...] = Field(default=(),max_length=4096)


class CompatibleSourceResidualRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.compatible_source_residual_request_d.v1'
    phase_ref: Literal['IRREVERSIBLE_SOURCE_RESIDUAL']
    equilibrium: OriginalSourceEquilibriumRequestD
    remaining_diggable_refs: tuple[Ref,...] = Field(default=(),max_length=4096)
    available_source_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    mixture_preimage_domain_complete: bool
    candidate_domain_complete: bool
    candidates: tuple[ExcavationJoinCandidateD,...] = Field(default=(),max_length=4096)
    excavation_debits: tuple[tuple[Ref,int],...] = Field(default=(),max_length=4096)
    remaining_budget: int | None = Field(default=None,ge=0)
    budget_relaxed: bool
    retained_other_constraint_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    relaxed_other_constraint_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = (
        ('mechanics.finite_flow_network.compatible_source_residual','EVALUATE'),
        ('mechanics.finite_flow_network.compatible_source_residual','INVERSE_DOMAIN'),
    )

    @model_validator(mode='after')
    def irreversible_domain(self):
        cells=set(self.equilibrium.cell_refs)
        opened=set(self.equilibrium.opened_cell_refs)
        diggable=set(self.remaining_diggable_refs)
        if self.equilibrium.scope!=self.scope or self.equilibrium.mode_ref!='EVALUATE' or not diggable<=cells or opened&diggable:
            raise ValueError('residual must preserve current immutable source/opened scope')
        if not set(self.available_source_refs)<={s.source_ref for s in self.equilibrium.sources}:
            raise ValueError('available original source identity absent')
        if len({c.candidate_ref for c in self.candidates})!=len(self.candidates) or len({c.candidate_simulation_context_ref for c in self.candidates})!=len(self.candidates):
            raise ValueError('counterfactual candidates require distinct identities/contexts')
        if any(not set(c.excavated_cell_refs)<=diggable or len(set(c.excavated_cell_refs))!=len(c.excavated_cell_refs) or
                c.candidate_simulation_context_ref==self.scope.event_owner_ref for c in self.candidates):
            raise ValueError('candidate cannot reclose cells, reuse actual event owner or excavate an unavailable cell')
        debits=dict(self.excavation_debits)
        if len(debits)!=len(self.excavation_debits) or set(debits)!=diggable or any(n<0 for n in sorted(debits.values())):
            raise ValueError('each remaining excavation needs its exact nonnegative debit')
        return self


def _residual_components(nodes,edges,budget):
    graph={ref:[] for ref in sorted(nodes)}
    for edge in edges:
        budget.visit({'stage':'residual_adjacency','edge_ref':edge.edge_ref})
        if edge.first_ref in nodes and edge.second_ref in nodes:
            graph[edge.first_ref].append(edge.second_ref)
            graph[edge.second_ref].append(edge.first_ref)
    components,by_cell=[],{}
    for root in sorted(nodes):
        if root in by_cell:
            continue
        index=len(components)
        queue=deque([root])
        by_cell[root]=index
        members=[]
        while queue:
            ref=queue.popleft()
            budget.visit({'stage':'residual_component','cell_ref':ref})
            members.append(ref)
            for peer in graph[ref]:
                if peer not in by_cell:
                    by_cell[peer]=index
                    queue.append(peer)
        components.append(tuple(members))
    return components,by_cell


def measure_compatible_source_residual_d(request: CompatibleSourceResidualRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:
        return refusal
    if max(len(request.remaining_diggable_refs),len(request.candidates),len(request.equilibrium.cell_refs),len(request.equilibrium.edges))>request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    if not request.mixture_preimage_domain_complete:
        return d_result(request,'NEEDS_EVIDENCE','MIXTURE_PREIMAGE_DOMAIN_INCOMPLETE')
    if request.retained_other_constraint_refs:
        return d_result(request,'NEEDS_EVIDENCE','RETAINED_OTHER_CONSTRAINT_CALCULATIONS_NOT_BOUND',
            values={'retained_other_constraint_refs':request.retained_other_constraint_refs})
    if not request.budget_relaxed and request.remaining_budget is None:
        return d_result(request,'NEEDS_EVIDENCE','RETAINED_BUDGET_NOT_BOUND')
    budget=DWorkBudget(request)
    rows=[]
    try:
        opened=set(request.equilibrium.opened_cell_refs)
        future=opened|set(request.remaining_diggable_refs)
        current_components,current_by=_residual_components(opened,request.equilibrium.edges,budget)
        optimistic_components,optimistic_by=_residual_components(future,request.equilibrium.edges,budget)
        actual_pigments=[set() for _ in current_components]
        available_pigments=[set() for _ in optimistic_components]
        for source in request.equilibrium.sources:
            budget.visit({'stage':'immutable_source_provenance','source_ref':source.source_ref})
            actual_pigments[current_by[source.cell_ref]].add(source.pigment_ref)
            if source.source_ref in request.available_source_refs:
                available_pigments[optimistic_by[source.cell_ref]].add(source.pigment_ref)
        requirements,impossibilities=[],[]
        for pocket in request.equilibrium.pockets:
            preimages=[set(rule.pigment_refs) for rule in request.equilibrium.mixture_rules if rule.display_ref==pocket.required_display_ref]
            if request.equilibrium.absence_of_pigment_display_ref==pocket.required_display_ref:
                preimages.append(set())
            cell_rows=[]
            for cell in pocket.required_cell_refs:
                budget.visit({'stage':'pocket_source_necessity','pocket_ref':pocket.pocket_ref,'cell_ref':cell})
                must=actual_pigments[current_by[cell]] if cell in current_by else set()
                reachable=(available_pigments[optimistic_by[cell]]|must) if cell in optimistic_by else set()
                compatible=[p for p in preimages if must<=p and p<=reachable and cell in optimistic_by]
                cell_rows.append({'cell_ref':cell,'already_joined_pigments':tuple(sorted(must)),
                    'optimistically_available_pigments':tuple(sorted(reachable)),
                    'compatible_original_source_sets':tuple(tuple(sorted(p)) for p in compatible)})
                if not compatible:
                    impossibilities.append({'pocket_ref':pocket.pocket_ref,'cell_ref':cell,
                        'code':'IMMUTABLE_PIGMENT_OR_RESIDUAL_SOURCE_CUT','already_joined_pigments':tuple(sorted(must)),
                        'reachable_pigments':tuple(sorted(reachable)),'complete_target_preimages':tuple(tuple(sorted(p)) for p in preimages),
                        'cell_outside_remaining_openable_graph':cell not in optimistic_by})
            requirements.append({'pocket_ref':pocket.pocket_ref,'required_cell_source_sets':tuple(cell_rows)})
        rows=[]
        if request.resume_frontier:
            f=request.resume_frontier
            if f.get('input_digest')!=d_input_digest(request):
                return d_result(request,'NEEDS_EVIDENCE','RESUME_INPUT_OR_REVISION_MISMATCH')
            rows=list(f.get('completed_candidate_rows',()))
            if len(rows)>len(request.candidates) or any(r['candidate_ref']!=c.candidate_ref for r,c in zip(rows,request.candidates)):
                return d_result(request,'NEEDS_EVIDENCE','RESUME_CANDIDATE_PREFIX_MISMATCH')
        if request.mode_ref=='INVERSE_DOMAIN':
            if not request.candidate_domain_complete:
                return d_result(request,'NEEDS_EVIDENCE','JOIN_SEPARATOR_CANDIDATE_DOMAIN_INCOMPLETE',examined=budget.examined,
                    values={'source_requirements':tuple(requirements),'scoped_impossibility_certificates':tuple(impossibilities)})
            debits=dict(request.excavation_debits)
            for candidate in request.candidates[len(rows):]:
                budget.visit({'stage':'counterfactual_join_candidate','candidate_ref':candidate.candidate_ref})
                cost=sum(debits[r] for r in candidate.excavated_cell_refs)
                if not request.budget_relaxed and cost>request.remaining_budget:
                    rows.append({'candidate_ref':candidate.candidate_ref,'excavation_debit':cost,'all_pockets_exact':False,
                        'rejection':'RETAINED_EXCAVATION_BUDGET','candidate_simulation_context_ref':candidate.candidate_simulation_context_ref})
                    continue
                remaining_nodes=request.node_bound-budget.examined
                remaining_ms=int(request.time_bound_ms-(monotonic()-budget.started)*1000)
                if remaining_nodes<1 or remaining_ms<1:
                    raise DComputationInterrupted('AGGREGATE_CANDIDATE_COMPUTATION_BOUND',{})
                joined=opened|set(candidate.excavated_cell_refs)
                geometry=request.equilibrium.model_copy(update={'opened_cell_refs':tuple(r for r in request.equilibrium.cell_refs if r in joined),
                    'node_bound':remaining_nodes,'time_bound_ms':remaining_ms,'domain_bound':request.domain_bound,
                    'depth_bound':request.depth_bound,'resume_frontier':FrozenMap()})
                result=measure_original_source_equilibrium_d(geometry)
                budget.examined+=result.examined_count
                if result.status!='COMPLETE':
                    raise DComputationInterrupted(result.cause,{'unfinished_candidate_ref':candidate.candidate_ref})
                rows.append({'candidate_ref':candidate.candidate_ref,'candidate_simulation_context_ref':candidate.candidate_simulation_context_ref,
                    'excavated_cell_refs':candidate.excavated_cell_refs,'preserved_separator_refs':tuple(r for r in request.remaining_diggable_refs if r not in joined),
                    'excavation_debit':cost,'all_pockets_exact':result.values.get('all_pockets_exact'),
                    'joint_pocket_readings':result.values.get('pocket_readings'),'rejection':None if result.values.get('all_pockets_exact') is True else 'JOINT_POCKET_READINGS'})
        budget.finish()
        return d_result(request,'COMPLETE','COMPATIBLE_ORIGINAL_SOURCE_RESIDUAL',complete=True,examined=budget.examined,
            values={'source_requirements':tuple(requirements),'scoped_impossibility_certificates':tuple(impossibilities),
                'candidate_rows':tuple(rows),'compatible_candidate_refs':tuple(r['candidate_ref'] for r in rows if r['all_pockets_exact'] is True),
                'positive_residual_reachability_is_joint_affordability_proof':False,'budget_relaxed':request.budget_relaxed,
                'relaxed_other_constraint_refs':request.relaxed_other_constraint_refs,'parent_actual_command_ledger_modified':False})
    except DComputationInterrupted as error:
        return d_result(request,'NEEDS_EVIDENCE',error.cause,examined=budget.examined,
            frontier={'input_digest':d_input_digest(request),'completed_candidate_rows':tuple(rows),
                'restart_unfinished_candidate':True,'work':error.frontier,'parent_actual_command_ledger_modified':False})
