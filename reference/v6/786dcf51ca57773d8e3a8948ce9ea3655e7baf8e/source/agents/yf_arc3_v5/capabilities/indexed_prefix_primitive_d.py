"""Exact caller-bound rooted-prefix input; no quota choice or action release."""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_result, d_validate_request


class PrefixCellD(FrozenModel):
    cell_ref: Ref
    marginal_refs: tuple[Ref, ...] = Field(default=(), max_length=64)


class RootedPrefixD(FrozenModel):
    chain_ref: Ref
    cells: tuple[PrefixCellD, ...] = Field(min_length=1, max_length=4096)
    filled_length: int = Field(ge=0)

    @model_validator(mode='after')
    def valid_length(self):
        if self.filled_length > len(self.cells):
            raise ValueError('filled prefix exceeds rooted chain')
        return self


class PrefixQuotaD(FrozenModel):
    marginal_ref: Ref
    required_count: int = Field(ge=0)


class IndexedPrefixPrimitiveRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.indexed_prefix_primitive_request_d.v1'
    phase_ref: Literal['EXTERNAL_COMMAND']
    chains: tuple[RootedPrefixD, ...] = Field(min_length=1, max_length=4096)
    quotas: tuple[PrefixQuotaD, ...] = Field(default=(), max_length=64)
    channel: Literal['CLICK', 'FOCUS', 'ACTIVATE', 'RESET']
    bound_chain_ref: Ref | None
    bound_rank: int | None = Field(default=None, ge=0)
    native_focus_chain_ref: Ref | None
    native_focus_rank: int | None = Field(default=None, ge=0)
    inclusive_fill_exclusive_cut_supported: bool
    focus_initial_selection_supported: bool
    focus_boundary_rule: Literal['REFUSE', 'CLAMP', 'WRAP']
    focus_delta: int
    reset_lengths: tuple[int, ...] = Field(default=(), max_length=4096)
    submitted_cost: int = Field(ge=0)
    selection_cost: int = Field(ge=0)
    mutation_cost: int = Field(ge=0)
    quota_acceptance_supported: bool
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = (
        ('mechanics.editable_configuration_graph.indexed_prefix_external_primitive', 'STEP'),
    )

    @model_validator(mode='after')
    def domain(self):
        ids = [x.chain_ref for x in self.chains]
        cells = [c.cell_ref for x in self.chains for c in x.cells]
        if len(set(ids)) != len(ids) or len(set(cells)) != len(cells):
            raise ValueError('chain/rank identity is not unique')
        if len({q.marginal_ref for q in self.quotas}) != len(self.quotas):
            raise ValueError('quota marginal identities are not unique')
        for ref, rank in ((self.bound_chain_ref, self.bound_rank), (self.native_focus_chain_ref, self.native_focus_rank)):
            if (ref is None) != (rank is None):
                raise ValueError('chain and rank must be jointly bound')
            if ref is not None and (ref not in ids or rank >= len(self.chains[ids.index(ref)].cells)):
                raise ValueError('bound chain/rank outside input domain')
        if self.reset_lengths and (len(self.reset_lengths) != len(ids) or any(
                n < 0 or n > len(c.cells) for n, c in zip(self.reset_lengths, self.chains))):
            raise ValueError('reset vector outside rooted chain domain')
        if any(len(set(c.marginal_refs)) != len(c.marginal_refs) for x in self.chains for c in x.cells):
            raise ValueError('duplicate cell marginal')
        return self


def measure_indexed_prefix_primitive_d(request: IndexedPrefixPrimitiveRequestD):
    refused = d_validate_request(request)
    if refused is not None:
        return refused
    count = sum(len(c.cells) for c in request.chains)
    if count > request.domain_bound:
        return d_result(request, 'NEEDS_EVIDENCE', 'INPUT_DOMAIN_BOUND')
    if request.resume_frontier:
        return d_result(request, 'NEEDS_EVIDENCE', 'ATOMIC_COMMAND_REQUIRES_RESTART_FROM_BOUND_INPUT')
    budget = DWorkBudget(request)
    lengths = [c.filled_length for c in request.chains]
    original = tuple(lengths)
    selected = (request.native_focus_chain_ref, request.native_focus_rank)
    target = (request.bound_chain_ref, request.bound_rank)
    cause = 'UNCHANGED'
    try:
        budget.visit({'stage': 'decode_bound_input'})
        chain_index = {c.chain_ref: i for i, c in enumerate(request.chains)}
        if request.channel == 'RESET':
            if not request.reset_lengths:
                return d_result(request, 'NEEDS_EVIDENCE', 'RESET_LAW_MISSING', examined=budget.examined)
            lengths = list(request.reset_lengths)
            cause = 'RESTORED_LENGTH_VECTOR'
        elif request.channel == 'FOCUS':
            if selected[0] is None:
                if not request.focus_initial_selection_supported or target[0] is None:
                    return d_result(request, 'NEEDS_EVIDENCE', 'INITIAL_FOCUS_BINDING_MISSING', examined=budget.examined)
                selected = target
            else:
                chain = request.chains[chain_index[selected[0]]]
                rank = selected[1] + request.focus_delta
                if 0 <= rank < len(chain.cells):
                    selected = (selected[0], rank)
                elif request.focus_boundary_rule == 'CLAMP':
                    selected = (selected[0], min(max(rank, 0), len(chain.cells) - 1))
                elif request.focus_boundary_rule == 'WRAP':
                    selected = (selected[0], rank % len(chain.cells))
                else:
                    cause = 'FOCUS_BOUNDARY_REFUSAL'
        else:
            if request.channel == 'ACTIVATE':
                target = selected
            if target[0] is None:
                cause = 'NO_BOUND_PREFIX_CELL'
            elif not request.inclusive_fill_exclusive_cut_supported:
                return d_result(request, 'NEEDS_EVIDENCE', 'PREFIX_EDIT_LAW_MISSING', examined=budget.examined)
            else:
                i, rank = chain_index[target[0]], target[1]
                lengths[i] = rank + 1 if rank >= lengths[i] else rank
                selected = target
                cause = 'PREFIX_MUTATION'
        before_counts, after_counts = {}, {}
        for i, chain in enumerate(request.chains):
            for rank, cell in enumerate(chain.cells):
                budget.visit({'stage': 'marginals', 'chain_ref': chain.chain_ref, 'rank': rank})
                for marginal in cell.marginal_refs:
                    before_counts[marginal] = before_counts.get(marginal, 0) + (rank < original[i])
                    after_counts[marginal] = after_counts.get(marginal, 0) + (rank < lengths[i])
        changed = tuple(lengths) != original
        selection_changed = selected != (request.native_focus_chain_ref, request.native_focus_rank)
        acceptance = (all(after_counts.get(q.marginal_ref, 0) == q.required_count for q in request.quotas)
            if request.quota_acceptance_supported else None)
        budget.finish()
        return d_result(request, 'COMPLETE', cause, complete=True, examined=budget.examined, values={
            'chain_refs': tuple(c.chain_ref for c in request.chains), 'filled_lengths': tuple(lengths),
            'native_focus_chain_ref': selected[0], 'native_focus_rank': selected[1],
            'prefix_mutation_count': int(changed), 'accepted_selection_count': int(selection_changed),
            'changed_cell_count': sum(abs(a-b) for a,b in zip(original, lengths)),
            'submitted_command_count': 1, 'submitted_cost': request.submitted_cost,
            'selection_cost': request.selection_cost if selection_changed else 0,
            'mutation_cost': request.mutation_cost if changed else 0,
            'marginal_counts': after_counts,
            'marginal_deltas': {k: after_counts.get(k, 0)-before_counts.get(k, 0)
                for k in sorted(set(before_counts) | set(after_counts))},
            'quota_predicate_satisfied': acceptance, 'complete_response_boundary_count': 1,
            'quota_overshoot_causes_reset': False,
        })
    except DComputationInterrupted as interruption:
        return d_result(request, 'NEEDS_EVIDENCE', interruption.cause, examined=budget.examined,
            frontier={'restart_atomic_command': True, 'work': interruption.frontier})
