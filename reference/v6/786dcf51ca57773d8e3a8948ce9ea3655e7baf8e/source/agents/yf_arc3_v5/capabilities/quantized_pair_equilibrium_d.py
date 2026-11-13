"""Shared integer relations, signed incidences and view-specific quantizers."""
from __future__ import annotations
from itertools import product
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result, d_input_digest


class PairVariableD(FrozenModel):
    variable_ref: Ref
    unordered_typed_pair: tuple[Ref,Ref]
    value_domain: tuple[int,...] = Field(min_length=1,max_length=4096)


class PairIncidenceD(FrozenModel):
    variable_ref: Ref
    view_ref: Ref
    axis: Literal[0,1]
    coefficient: int


class AxisQuantizerD(FrozenModel):
    numerator: int
    denominator: int = Field(ge=1)
    offset: int
    rule: Literal['FLOOR','TRUNCATE','NEAREST_TIES_UP']


class PairViewD(FrozenModel):
    view_ref: Ref
    origin: tuple[int,int]
    quantizers: tuple[AxisQuantizerD,AxisQuantizerD]
    target_positions: tuple[tuple[int,int],...] = Field(default=(),max_length=4096)
    target_predicate_bound: bool


class QuantizedPairEquilibriumRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.quantized_pair_equilibrium_request_d.v1'
    phase_ref: Literal['SETTLED_INTEGER_RELATIONS']
    variables: tuple[PairVariableD,...] = Field(min_length=1,max_length=128)
    incidences: tuple[PairIncidenceD,...] = Field(default=(),max_length=4096)
    views: tuple[PairViewD,...] = Field(min_length=1,max_length=128)
    evaluated_values: tuple[tuple[Ref,int],...] = Field(default=(),max_length=128)
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = (
        ('mechanics.coupled_value_constraints.quantized_pair_equilibrium','EVALUATE'),
        ('mechanics.coupled_value_constraints.quantized_pair_equilibrium','INVERSE_DOMAIN'),
    )

    @model_validator(mode='after')
    def shared_domain(self):
        variables={v.variable_ref:v for v in self.variables}
        views={v.view_ref for v in self.views}
        pairs=[tuple(sorted(v.unordered_typed_pair)) for v in self.variables]
        if len(variables)!=len(self.variables) or len(views)!=len(self.views) or len(set(pairs))!=len(pairs):
            raise ValueError('shared unordered pair/view identities duplicated')
        if any(len(set(v.value_domain))!=len(v.value_domain) for v in self.variables):
            raise ValueError('relation domain contains duplicate values')
        if any(i.variable_ref not in variables or i.view_ref not in views for i in self.incidences):
            raise ValueError('incidence refers to an absent relation/view')
        if self.evaluated_values and (len(self.evaluated_values)!=len(variables) or
                {r for r,_ in self.evaluated_values}!=set(variables) or any(v not in variables[r].value_domain for r,v in self.evaluated_values)):
            raise ValueError('evaluated vector must bind each shared variable exactly once')
        return self


def _quantize_axis(value,quantizer):
    scaled=value*quantizer.numerator
    quotient,remainder=divmod(scaled,quantizer.denominator)
    if quantizer.rule=='TRUNCATE':
        quotient=abs(scaled)//quantizer.denominator*(1 if scaled>=0 else -1)
    elif quantizer.rule=='NEAREST_TIES_UP' and remainder*2>=quantizer.denominator:
        quotient+=1
    return quotient+quantizer.offset


def measure_quantized_pair_equilibrium_d(request: QuantizedPairEquilibriumRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:
        return refusal
    if max(len(request.incidences),sum(len(v.value_domain) for v in request.variables),sum(len(v.target_positions) for v in request.views))>request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    if request.mode_ref=='EVALUATE' and not request.evaluated_values:
        return d_result(request,'NEEDS_EVIDENCE','EVALUATED_RELATION_VECTOR_MISSING')
    if request.mode_ref=='INVERSE_DOMAIN' and any(not v.target_predicate_bound for v in request.views):
        return d_result(request,'NEEDS_EVIDENCE','JOINT_TARGET_PREDICATES_MISSING')
    cardinality=1
    for variable in request.variables:
        cardinality*=len(variable.value_domain)
        if cardinality>request.domain_bound and request.mode_ref=='INVERSE_DOMAIN':
            return d_result(request,'NEEDS_EVIDENCE','CORRELATED_ASSIGNMENT_DOMAIN_BOUND',
                frontier={'input_digest':d_input_digest(request),'assignment_index':0,'explored_assignments':0})
    budget=DWorkBudget(request)
    rows=[]
    if request.resume_frontier:
        frontier=request.resume_frontier
        if frontier.get('input_digest')!=d_input_digest(request):
            return d_result(request,'NEEDS_EVIDENCE','RESUME_INPUT_OR_REVISION_MISMATCH')
        rows=list(frontier.get('completed_assignment_rows',()))
    try:
        domain=([tuple(dict(request.evaluated_values)[v.variable_ref] for v in request.variables)] if request.mode_ref=='EVALUATE'
            else product(*(v.value_domain for v in request.variables)))
        expected_count=1 if request.mode_ref=='EVALUATE' else cardinality
        if len(rows)>expected_count:
            return d_result(request,'NEEDS_EVIDENCE','RESUME_ASSIGNMENT_PREFIX_MISMATCH')
        for index,vector in enumerate(domain):
            if index<len(rows):
                if tuple(rows[index]['relation_values'])!=tuple(vector):
                    return d_result(request,'NEEDS_EVIDENCE','RESUME_ASSIGNMENT_PREFIX_MISMATCH')
                continue
            assignment={v.variable_ref:n for v,n in zip(request.variables,vector)}
            sums={v.view_ref:[0,0] for v in request.views}
            for incidence in request.incidences:
                budget.visit({'stage':'shared_incidence','assignment_index':index,'variable_ref':incidence.variable_ref})
                sums[incidence.view_ref][incidence.axis]+=assignment[incidence.variable_ref]*incidence.coefficient
            view_rows=[]
            for view in request.views:
                budget.visit({'stage':'view_quantization','assignment_index':index,'view_ref':view.view_ref})
                force=sums[view.view_ref]
                position=tuple(view.origin[a]+_quantize_axis(force[a],view.quantizers[a]) for a in (0,1))
                view_rows.append({'view_ref':view.view_ref,'signed_force_sum':tuple(force),'quantized_position':position,
                    'target_hit':position in view.target_positions if view.target_predicate_bound else None})
            rows.append({'assignment_index':index,'relation_values':tuple(vector),'view_results':tuple(view_rows),
                'all_target_hits':all(v['target_hit'] is True for v in view_rows)})
        budget.finish()
        return d_result(request,'COMPLETE','QUANTIZED_SHARED_RELATION_RESULT',complete=True,examined=budget.examined,
            values={'variable_refs':tuple(v.variable_ref for v in request.variables),'correlated_assignment_rows':tuple(rows),
                'joint_preimage_indices':tuple(r['assignment_index'] for r in rows if r['all_target_hits']),
                'relaxation_trajectory_added':False,'gf2_equivalence_assumed':False})
    except DComputationInterrupted as error:
        return d_result(request,'NEEDS_EVIDENCE',error.cause,examined=budget.examined,
            frontier={'input_digest':d_input_digest(request),'completed_assignment_rows':tuple(rows),
                'restart_unfinished_assignment':True,'work':error.frontier})
