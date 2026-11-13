"""Exact integer marginal evaluation and finite-support domain propagation."""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .indexed_prefix_primitive_d import PrefixCellD, PrefixQuotaD
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result, d_input_digest


class PrefixLengthDomainD(FrozenModel):
    chain_ref: Ref
    cells: tuple[PrefixCellD, ...] = Field(min_length=1, max_length=4096)
    length_domain: tuple[int, ...] = Field(min_length=1, max_length=4096)
    evaluated_length: int | None = Field(default=None, ge=0)

    @model_validator(mode='after')
    def domain(self):
        if len(set(self.length_domain)) != len(self.length_domain) or any(n < 0 or n > len(self.cells) for n in self.length_domain):
            raise ValueError('length domain must contain distinct admitted rooted prefixes')
        if self.evaluated_length is not None and self.evaluated_length not in self.length_domain:
            raise ValueError('evaluated length outside admitted domain')
        return self


class RootedPrefixMarginalsRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.rooted_prefix_marginals_request_d.v1'
    phase_ref: Literal['INTEGER_QUOTA_CONSTRAINTS']
    chains: tuple[PrefixLengthDomainD, ...] = Field(min_length=1, max_length=4096)
    quotas: tuple[PrefixQuotaD, ...] = Field(min_length=1, max_length=64)
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = (
        ('mechanics.coupled_value_constraints.rooted_prefix_marginals', 'EVALUATE'),
        ('mechanics.coupled_value_constraints.rooted_prefix_marginals', 'PROPAGATE'),
    )

    @model_validator(mode='after')
    def identities(self):
        ids = [c.chain_ref for c in self.chains]
        cells = [c.cell_ref for ch in self.chains for c in ch.cells]
        if len(set(ids)) != len(ids) or len(set(cells)) != len(cells):
            raise ValueError('rooted chains must partition distinct cell identities')
        if len({q.marginal_ref for q in self.quotas}) != len(self.quotas):
            raise ValueError('quota identities must be distinct')
        if any(len(set(c.marginal_refs)) != len(c.marginal_refs) for ch in self.chains for c in ch.cells):
            raise ValueError('one cell cannot be counted twice in the same marginal')
        return self


def _sum_domain(left, right, request, budget, frontier):
    values = set()
    for a in sorted(left):
        for b in sorted(right):
            budget.visit(frontier)
            values.add(a+b)
            if len(values) > request.domain_bound:
                raise DComputationInterrupted('FINITE_SUM_DOMAIN_BOUND', frontier)
    return values


def measure_rooted_prefix_marginals_d(request: RootedPrefixMarginalsRequestD):
    rejection = d_validate_request(request)
    if rejection is not None:
        return rejection
    if sum(len(c.cells)+len(c.length_domain) for c in request.chains) > request.domain_bound:
        return d_result(request, 'NEEDS_EVIDENCE', 'INPUT_DOMAIN_BOUND')
    budget = DWorkBudget(request)
    domains = [tuple(sorted(ch.length_domain)) for ch in request.chains]
    removals, completed_rounds = [], 0
    if request.resume_frontier:
        frontier = request.resume_frontier
        if frontier.get('input_digest') != d_input_digest(request):
            return d_result(request, 'NEEDS_EVIDENCE', 'RESUME_INPUT_OR_REVISION_MISMATCH')
        saved = tuple(frontier.get('retained_domains', ()))
        if len(saved) != len(domains) or any(not set(s) <= set(d) for s,d in zip(saved,domains)):
            return d_result(request, 'NEEDS_EVIDENCE', 'RESUME_DOMAIN_MISMATCH')
        domains = [tuple(s) for s in saved]
        removals = list(frontier.get('removal_certificates', ()))
        completed_rounds = int(frontier.get('completed_rounds', 0))
    try:
        contributions = []
        for chain in request.chains:
            table, counts = {}, {q.marginal_ref:0 for q in request.quotas}
            table[0] = dict(counts)
            for rank,cell in enumerate(chain.cells, 1):
                budget.visit({'stage': 'prefix_incidence', 'chain_ref': chain.chain_ref, 'length': rank})
                for marginal in cell.marginal_refs:
                    if marginal in counts:
                        counts[marginal] += 1
                table[rank] = dict(counts)
            contributions.append(table)
        if request.mode_ref == 'EVALUATE':
            if any(c.evaluated_length is None for c in request.chains):
                return d_result(request, 'NEEDS_EVIDENCE', 'EVALUATED_LENGTH_VECTOR_MISSING', examined=budget.examined)
            totals = {q.marginal_ref:sum(contributions[i][c.evaluated_length][q.marginal_ref]
                for i,c in enumerate(request.chains)) for q in request.quotas}
            budget.finish()
            return d_result(request, 'COMPLETE', 'INTEGER_MARGINALS_EVALUATED', complete=True, examined=budget.examined,
                values={'marginal_values':totals, 'residual_demands':{q.marginal_ref:q.required_count-totals[q.marginal_ref]
                    for q in request.quotas}, 'all_quotas_equal':all(totals[q.marginal_ref] == q.required_count for q in request.quotas)})
        if any(not d for d in domains):
            return d_result(request, 'COMPLETE', 'EMPTY_DOMAIN_CONTRADICTION', complete=True, examined=budget.examined,
                values={'retained_domains':tuple(domains), 'removal_certificates':tuple(removals)})
        while True:
            if completed_rounds >= request.depth_bound:
                raise DComputationInterrupted('PROPAGATION_ROUND_BOUND', {})
            pending = {}
            for quota in request.quotas:
                ref = quota.marginal_ref
                per_chain = [set(contributions[i][n][ref] for n in domain) for i,domain in enumerate(domains)]
                prefix, suffix = [{0}], [{0} for _ in range(len(domains)+1)]
                for i, values in enumerate(per_chain):
                    prefix.append(_sum_domain(prefix[-1], values, request, budget,
                        {'stage':'forward_support','quota_ref':ref,'chain_index':i}))
                for i in range(len(domains)-1,-1,-1):
                    suffix[i] = _sum_domain(per_chain[i], suffix[i+1], request, budget,
                        {'stage':'backward_support','quota_ref':ref,'chain_index':i})
                for i,domain in enumerate(domains):
                    others = _sum_domain(prefix[i], suffix[i+1], request, budget,
                        {'stage':'other_chain_support','quota_ref':ref,'chain_index':i})
                    for length in domain:
                        budget.visit({'stage':'length_support','quota_ref':ref,'chain_index':i,'length':length})
                        own = contributions[i][length][ref]
                        if quota.required_count-own not in others:
                            pending.setdefault((i,length), {'chain_ref':request.chains[i].chain_ref,'length':length,
                                'quota_ref':ref,'own_contribution':own,'required_other_sum':quota.required_count-own,
                                'reachable_other_sums':tuple(sorted(others)), 'round':completed_rounds})
            if not pending:
                budget.finish()
                return d_result(request, 'COMPLETE', 'QUOTA_LOCAL_FIXED_POINT', complete=True, examined=budget.examined,
                    values={'chain_refs':tuple(c.chain_ref for c in request.chains), 'retained_domains':tuple(domains),
                        'removal_certificates':tuple(removals), 'completed_rounds':completed_rounds,
                        'all_domains_singleton':all(len(d)==1 for d in domains),
                        'joint_assignment_witness_present':False, 'nonsingleton_is_contradiction':False})
            # Commit only a fully checked round; an interrupted round is recomputed.
            next_domains = [tuple(n for n in d if (i,n) not in pending) for i,d in enumerate(domains)]
            removals.extend(pending[k] for k in sorted(pending))
            domains, completed_rounds = next_domains, completed_rounds+1
            if any(not d for d in domains):
                budget.finish()
                return d_result(request, 'COMPLETE', 'EMPTY_DOMAIN_CONTRADICTION', complete=True, examined=budget.examined,
                    values={'chain_refs':tuple(c.chain_ref for c in request.chains), 'retained_domains':tuple(domains),
                        'removal_certificates':tuple(removals), 'completed_rounds':completed_rounds})
    except DComputationInterrupted as interruption:
        return d_result(request, 'NEEDS_EVIDENCE', interruption.cause, examined=budget.examined,
            frontier={'input_digest':d_input_digest(request),'retained_domains':tuple(domains),
                'removal_certificates':tuple(removals),'completed_rounds':completed_rounds,
                'restart_unfinished_round':True,'work':interruption.frontier})
