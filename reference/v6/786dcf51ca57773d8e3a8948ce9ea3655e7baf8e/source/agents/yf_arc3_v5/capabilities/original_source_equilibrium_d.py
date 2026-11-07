"""Set-based equilibrium from immutable original pigments, never display folds."""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .single_visit_residual_d import ResidualEdgeD
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result


class OriginalPigmentSourceD(FrozenModel):
    source_ref: Ref
    cell_ref: Ref
    pigment_ref: Ref
    evidence_ref: Ref


class SetMixtureRuleD(FrozenModel):
    pigment_refs: tuple[Ref,...] = Field(min_length=1,max_length=128)
    display_ref: Ref
    law_evidence_ref: Ref


class FlowPocketD(FrozenModel):
    pocket_ref: Ref
    required_cell_refs: tuple[Ref,...] = Field(min_length=1,max_length=4096)
    required_display_ref: Ref | None


class OriginalSourceEquilibriumRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.original_source_equilibrium_request_d.v1'
    phase_ref: Literal['OPENED_COMPONENT_EQUILIBRIUM']
    cell_refs: tuple[Ref,...] = Field(min_length=1,max_length=4096)
    edges: tuple[ResidualEdgeD,...] = Field(default=(),max_length=4096)
    opened_cell_refs: tuple[Ref,...] = Field(min_length=1,max_length=4096)
    sources: tuple[OriginalPigmentSourceD,...] = Field(default=(),max_length=128)
    mixture_rules: tuple[SetMixtureRuleD,...] = Field(default=(),max_length=4096)
    pockets: tuple[FlowPocketD,...] = Field(default=(),max_length=128)
    absence_of_pigment_display_ref: Ref | None
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = (
        ('mechanics.finite_flow_network.original_source_equilibrium','EVALUATE'),
    )

    @model_validator(mode='after')
    def graph_and_law(self):
        cells,opened = set(self.cell_refs),set(self.opened_cell_refs)
        if len(cells)!=len(self.cell_refs) or len(opened)!=len(self.opened_cell_refs) or not opened<=cells:
            raise ValueError('opened graph domain invalid')
        if len({s.source_ref for s in self.sources})!=len(self.sources) or any(s.cell_ref not in opened for s in self.sources):
            raise ValueError('original source identities must remain in the opened domain')
        pairs = [tuple(sorted((e.first_ref,e.second_ref))) for e in self.edges]
        if len(set(pairs))!=len(pairs) or len({e.edge_ref for e in self.edges})!=len(self.edges) or any(
                e.first_ref not in cells or e.second_ref not in cells or e.first_ref==e.second_ref for e in self.edges):
            raise ValueError('opened-cell graph edge domain invalid')
        keys = [tuple(sorted(r.pigment_refs)) for r in self.mixture_rules]
        if len(set(keys))!=len(keys) or any(len(set(r.pigment_refs))!=len(r.pigment_refs) for r in self.mixture_rules):
            raise ValueError('mixture law must be a function on distinct original pigment sets')
        if len({p.pocket_ref for p in self.pockets})!=len(self.pockets) or any(
                not set(p.required_cell_refs)<=cells or len(set(p.required_cell_refs))!=len(p.required_cell_refs) for p in self.pockets):
            raise ValueError('pocket membership invalid')
        return self


def measure_original_source_equilibrium_d(request: OriginalSourceEquilibriumRequestD):
    refusal = d_validate_request(request)
    if refusal is not None:
        return refusal
    if max(len(request.cell_refs),len(request.edges),len(request.mixture_rules),sum(len(p.required_cell_refs) for p in request.pockets))>request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    if request.resume_frontier:
        return d_result(request,'NEEDS_EVIDENCE','RESTART_EQUILIBRIUM_FROM_BOUND_INPUT')
    budget = DWorkBudget(request)
    try:
        opened = set(request.opened_cell_refs)
        adjacency = {ref:set() for ref in request.opened_cell_refs}
        for edge in request.edges:
            budget.visit({'stage':'opened_adjacency','edge_ref':edge.edge_ref})
            if edge.first_ref in opened and edge.second_ref in opened:
                adjacency[edge.first_ref].add(edge.second_ref)
                adjacency[edge.second_ref].add(edge.first_ref)
        laws = {tuple(sorted(r.pigment_refs)):r for r in request.mixture_rules}
        seen,components,field,missing = set(),[],{},[]
        for root in request.opened_cell_refs:
            if root in seen:
                continue
            stack,component = [root],set()
            seen.add(root)
            while stack:
                cell = stack.pop()
                budget.visit({'stage':'component','cell_ref':cell})
                component.add(cell)
                for peer in sorted(adjacency[cell]):
                    if peer not in seen:
                        seen.add(peer)
                        stack.append(peer)
            sources = []
            for source in request.sources:
                budget.visit({'stage':'original_provenance','source_ref':source.source_ref})
                if source.cell_ref in component:
                    sources.append(source)
            pigments = tuple(sorted({s.pigment_ref for s in sources}))
            rule = laws.get(pigments)
            known = not pigments or rule is not None
            display = request.absence_of_pigment_display_ref if not pigments else (rule.display_ref if rule else None)
            if not known:
                missing.append(pigments)
            row = {'cell_refs':tuple(sorted(component)),'original_source_refs':tuple(s.source_ref for s in sources),
                'original_pigment_refs':pigments,'display_ref':display,'mixture_law_known':known,
                'unpigmented':not pigments,'mixture_law_evidence_ref':None if rule is None else rule.law_evidence_ref}
            components.append(row)
            for cell in sorted(component):
                field[cell] = {'display_ref':display,'known':known,'unpigmented':not pigments,
                    'original_source_refs':row['original_source_refs'],'original_pigment_refs':pigments}
        pockets = []
        for pocket in request.pockets:
            readings,known = [],True
            for cell in pocket.required_cell_refs:
                budget.visit({'stage':'complete_pocket','pocket_ref':pocket.pocket_ref,'cell_ref':cell})
                value = field.get(cell)
                if value is None or not value['known']:
                    known = False
                readings.append({'cell_ref':cell,'opened':value is not None,'reading':value})
            exact = (all(r['reading']['display_ref']==pocket.required_display_ref for r in readings) if known else None)
            pockets.append({'pocket_ref':pocket.pocket_ref,'cell_readings':tuple(readings),'exact_target_match':exact})
        budget.finish()
        return d_result(request,'NEEDS_EVIDENCE' if missing else 'COMPLETE',
            'SET_MIXTURE_LAW_INCOMPLETE' if missing else 'ORIGINAL_SOURCE_EQUILIBRIUM',complete=not missing,examined=budget.examined,
            values={'components':tuple(components),'field_readings':field,'pocket_readings':tuple(pockets),
                'missing_original_pigment_sets':tuple(missing),'all_pockets_exact':all(p['exact_target_match'] is True for p in pockets)
                    if pockets else None,'quantity_weighted_mixing':False})
    except DComputationInterrupted as error:
        return d_result(request,'NEEDS_EVIDENCE',error.cause,examined=budget.examined,
            frontier={'restart_equilibrium':True,'work':error.frontier})
