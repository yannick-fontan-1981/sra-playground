"""One paid excavation, equilibrium and explicitly ordered terminal/reset laws."""
from __future__ import annotations
from time import monotonic
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import Ref, FrozenMap
from .original_source_equilibrium_d import OriginalSourceEquilibriumRequestD, measure_original_source_equilibrium_d
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, d_validate_request, d_result


class MonotoneExcavationRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.monotone_excavation_request_d.v1'
    phase_ref: Literal['EXTERNAL_EXCAVATION_INPUT']
    equilibrium: OriginalSourceEquilibriumRequestD
    soft_cell_refs: tuple[Ref,...] = Field(default=(),max_length=4096)
    hard_cell_refs: tuple[Ref,...] = Field(default=(),max_length=4096)
    channel: Literal['CLICK','RESET']
    bound_cell_ref: Ref | None
    remaining_resource: int = Field(ge=0)
    input_command_count: int = Field(ge=0)
    excavation_count: int = Field(ge=0)
    submitted_debit: int = Field(ge=0)
    fresh_excavation_debit: int = Field(ge=0)
    already_open_debit: int = Field(ge=0)
    refused_debit: int = Field(ge=0)
    checkpoint_order: Literal['GOAL_THEN_DEPLETION','DEPLETION_THEN_GOAL']
    depletion_rule: Literal['NEGATIVE','NONPOSITIVE']
    depletion_restores_supported: bool
    reset_opened_cell_refs: tuple[Ref,...] = Field(default=(),max_length=4096)
    reset_resource: int = Field(ge=0)
    reset_counter_rule: Literal['RESET_BOTH','KEEP_INPUT_RESET_EXCAVATIONS','PRESERVE_BOTH']
    goal_boundary_ref: Ref
    depletion_boundary_ref: Ref
    restore_event_ref: Ref
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = (
        ('mechanics.finite_flow_network.monotone_excavation_external_primitive','STEP'),
    )

    @model_validator(mode='after')
    def support_partition(self):
        opened=set(self.equilibrium.opened_cell_refs)
        soft,hard=set(self.soft_cell_refs),set(self.hard_cell_refs)
        cells=set(self.equilibrium.cell_refs)
        if opened&soft or opened&hard or soft&hard or opened|soft|hard!=cells:
            raise ValueError('open/soft/hard supports must be an exact disjoint current partition')
        if self.equilibrium.scope!=self.scope or self.equilibrium.mode_ref!='EVALUATE':
            raise ValueError('equilibrium helper must retain actual caller scope and read-only mode')
        if self.reset_opened_cell_refs and (not set(self.reset_opened_cell_refs)<=cells or
                not {s.cell_ref for s in self.equilibrium.sources}<=set(self.reset_opened_cell_refs)):
            raise ValueError('reset must preserve all original source identities')
        return self


def measure_monotone_excavation_d(request: MonotoneExcavationRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:
        return refusal
    if request.resume_frontier:
        return d_result(request,'NEEDS_EVIDENCE','RESTART_EXCAVATION_FROM_BOUND_INPUT')
    budget=DWorkBudget(request)
    opened=set(request.equilibrium.opened_cell_refs)
    debit=request.submitted_debit
    inputs,excavations=request.input_command_count+1,request.excavation_count
    resource=request.remaining_resource
    cause='UNCHANGED'
    changed=()
    if request.channel=='RESET':
        if not request.reset_opened_cell_refs:
            return d_result(request,'NEEDS_EVIDENCE','RESET_STATE_NOT_BOUND')
        opened=set(request.reset_opened_cell_refs)
        resource=request.reset_resource
        cause='AUTHORIZED_RESET'
        if request.reset_counter_rule=='RESET_BOTH':
            inputs,excavations=0,0
        elif request.reset_counter_rule=='KEEP_INPUT_RESET_EXCAVATIONS':
            excavations=0
    elif request.bound_cell_ref in opened:
        debit+=request.already_open_debit
        cause='ALREADY_OPEN_INPUT'
    elif request.bound_cell_ref in request.soft_cell_refs:
        opened.add(request.bound_cell_ref)
        excavations+=1
        changed=(request.bound_cell_ref,)
        debit+=request.fresh_excavation_debit
        cause='ONE_IRREVERSIBLE_EXCAVATION'
    else:
        debit+=request.refused_debit
        cause='HARD_OR_OUTSIDE_INPUT_REFUSAL'
    if request.channel!='RESET':
        resource-=debit
    geometry=request.equilibrium.model_copy(update={'opened_cell_refs':tuple(ref for ref in request.equilibrium.cell_refs if ref in opened),
        'node_bound':request.node_bound,'depth_bound':request.depth_bound,'domain_bound':request.domain_bound,
        'time_bound_ms':max(1,int(request.time_bound_ms-(monotonic()-budget.started)*1000)),
        'resume_frontier':FrozenMap()})
    equilibrium=measure_original_source_equilibrium_d(geometry)
    examined=equilibrium.examined_count
    if equilibrium.status!='COMPLETE':
        return d_result(request,'NEEDS_EVIDENCE',equilibrium.cause,examined=equilibrium.examined_count,
            values={'predicted_opened_cell_refs':geometry.opened_cell_refs,'equilibrium_values':equilibrium.values,
                'input_command_count':inputs,'excavation_count':excavations,'remaining_resource':resource},
            frontier={'restart_atomic_excavation':True,'equilibrium_frontier':equilibrium.frontier})
    exact=equilibrium.values.get('all_pockets_exact') is True
    depleted=resource<0 if request.depletion_rule=='NEGATIVE' else resource<=0
    boundary=None
    event=None
    before_restore={'opened_cell_refs':geometry.opened_cell_refs,'remaining_resource':resource,
        'input_command_count':inputs,'excavation_count':excavations,'equilibrium_values':equilibrium.values}
    checks=('GOAL','DEPLETION') if request.checkpoint_order=='GOAL_THEN_DEPLETION' else ('DEPLETION','GOAL')
    for checkpoint in checks:
        if checkpoint=='GOAL' and exact:
            boundary=request.goal_boundary_ref
            break
        if checkpoint=='DEPLETION' and depleted:
            boundary=request.depletion_boundary_ref
            if request.depletion_restores_supported:
                if not request.reset_opened_cell_refs:
                    return d_result(request,'NEEDS_EVIDENCE','DEPLETION_RESTORE_STATE_NOT_BOUND',
                        examined=equilibrium.examined_count,values={'pre_restore':before_restore})
                opened=set(request.reset_opened_cell_refs)
                resource=request.reset_resource
                event=request.restore_event_ref
                if request.reset_counter_rule=='RESET_BOTH':
                    inputs,excavations=0,0
                elif request.reset_counter_rule=='KEEP_INPUT_RESET_EXCAVATIONS':
                    excavations=0
            break
    final_equilibrium=equilibrium
    if event is not None:
        remaining_nodes=request.node_bound-examined
        remaining_ms=int(request.time_bound_ms-(monotonic()-budget.started)*1000)
        if remaining_nodes<1 or remaining_ms<1:
            return d_result(request,'NEEDS_EVIDENCE','AGGREGATE_RESTORE_COMPUTATION_BOUND',examined=examined,
                values={'pre_restore':before_restore},frontier={'restart_atomic_excavation':True})
        restored=geometry.model_copy(update={'opened_cell_refs':tuple(r for r in geometry.cell_refs if r in opened),
            'node_bound':remaining_nodes,'time_bound_ms':remaining_ms})
        final_equilibrium=measure_original_source_equilibrium_d(restored)
        examined+=final_equilibrium.examined_count
        if final_equilibrium.status!='COMPLETE':
            return d_result(request,'NEEDS_EVIDENCE',final_equilibrium.cause,examined=examined,
                values={'pre_restore':before_restore},frontier={'restart_atomic_excavation':True,'restore_frontier':final_equilibrium.frontier})
    return d_result(request,'COMPLETE',cause,complete=True,examined=examined,
        values={'opened_cell_refs':tuple(ref for ref in request.equilibrium.cell_refs if ref in opened),
            'new_excavated_cell_refs':changed,'remaining_resource':resource,'input_command_count':inputs,
            'excavation_count':excavations,'primitive_debit':debit,'boundary_ref':boundary,'restore_event_ref':event,
            'pre_restore':before_restore,'equilibrium_values':final_equilibrium.values,
            'render_propagation_adds_physical_ticks':False,'intermediate_wrong_mixture_causes_failure':False,
            'complete_response_boundary_count':1,'extra_primitives_executed':0})
