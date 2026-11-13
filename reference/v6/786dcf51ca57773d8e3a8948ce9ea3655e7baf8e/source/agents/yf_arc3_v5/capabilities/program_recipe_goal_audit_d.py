"""Connect finite-program/recipe mechanics to caller-owned world-goal questions."""
from __future__ import annotations
from typing import ClassVar,Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import Ref
from .finite_instruction_device import DeviceRequest,DeviceSlot,measure_finite_instruction_device
from .recipe_operator_service_a import RecipeOperatorRequest,measure_recipe_operator
from .recipe_composition_a import RecipeCompositionInput
from .mechanical_family_contracts_d import DMechanicalRequest,DWorkBudget,DComputationInterrupted,d_validate_request,d_result


def _goal_child_current(parent,child):
    return all(getattr(parent.scope,key)==getattr(child.scope,key) for key in (
        'parent_goal_ref','parent_contribution_ref','epoch','evidence_revision_ref','model_revision_ref'))


class ProgramGoalAuditBaseD(DMechanicalRequest):
    phase_ref: Literal['CURRENT_FINITE_PROGRAM_WORLD_GOAL']
    device_request: DeviceRequest
    desired_program: tuple[DeviceSlot,...]=Field(default=(),max_length=16)
    obsolete_suffix_erase_value_refs: tuple[Ref,...]=Field(default=(),max_length=16)
    grounded_start_trial_refs: tuple[Ref,...]=Field(default=(),max_length=128)
    grounded_start_evidence_refs: tuple[Ref,...]=Field(default=(),max_length=128)
    retain_checkpoint_evidence_ref: Ref|None


class FiniteInstructionGoalRequestD(ProgramGoalAuditBaseD):
    schema_version: Ref='yf_arc3_v5.finite_instruction_goal_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.finite_instruction_device','AUDIT'),)


class FiniteInstructionPhaseRequestD(ProgramGoalAuditBaseD):
    schema_version: Ref='yf_arc3_v5.finite_instruction_phase_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.finite_instruction_device.phase','AUDIT'),)


class FiniteInstructionDifferenceRequestD(ProgramGoalAuditBaseD):
    schema_version: Ref='yf_arc3_v5.finite_instruction_difference_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.finite_instruction_device.differential_edit','AUDIT'),)


def measure_program_goal_audit_d(request: ProgramGoalAuditBaseD):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    budget=DWorkBudget(request)
    try:
        child=request.device_request
        if not _goal_child_current(request,child) or child.state is None or child.model is None:
            return d_result(request,'NEEDS_EVIDENCE','CURRENT_DEVICE_STATE_MODEL_AND_PARENT_REQUIRED')
        if child.operation_ref!='mechanics.finite_instruction_device.stage_domains' or child.mode!='INVERSE_DOMAIN':
            return d_result(request,'NOT_APPLICABLE','SOURCE_BOUND_DEVICE_STAGE_DOMAIN_REQUIRED')
        budget.visit({'stage':'finite_program_goal_domain'})
        if request.node_bound <= budget.examined:
            return d_result(request,'BUDGET_REACHED','DEVICE_CHILD_WORK_BUDGET_REQUIRED',examined=budget.examined,frontier={'restart_scoped_program_request':True})
        result=measure_finite_instruction_device(child.model_copy(update={'maximum_evaluations':min(child.maximum_evaluations,request.node_bound-budget.examined),
            'maximum_states':min(child.maximum_states,request.domain_bound)}))
        budget.examined+=result.examined_count
        if not result.domain_complete:
            return d_result(request,'BUDGET_REACHED' if result.computation_bound_reached else 'NEEDS_EVIDENCE','DEVICE_STAGE_DOMAIN_INCOMPLETE',
                examined=budget.examined,values={'device_result':result.values,'missing_refs':result.prerequisite_refs},frontier={'device_frontier':result.frontier})
        fragments=result.values.get('stage_fragments',())
        valid=[]
        for fragment in fragments:
            if (fragment.get('typed_target_compatible') is True and fragment.get('program_validation_boundary_reached') is True and
                    not fragment.get('missing_refs') and fragment.get('full_program_status')!='FAILED' and
                    (fragment.get('trial_start_is_current_physical_state') is True or fragment.get('trial_ref') in request.grounded_start_trial_refs and request.grounded_start_evidence_refs)):
                valid.append(fragment)
        current=child.state.program
        desired={slot.slot_ref:slot for slot in request.desired_program}
        edits,unresolved=[],[]
        for slot in current:
            target=desired.get(slot.slot_ref)
            if target is not None and target.trait_refs!=slot.trait_refs:
                unresolved.append(slot.slot_ref);continue
            values=target.values if target is not None else request.obsolete_suffix_erase_value_refs
            if len(values)!=len(slot.values):unresolved.append(slot.slot_ref);continue
            for index,(before,after) in enumerate(zip(slot.values,values)):
                budget.visit({'stage':'current_bit_or_trait_difference','slot_ref':slot.slot_ref,'trait_index':index})
                if before is None or after is None or not slot.loaded[index]:unresolved.append((slot.slot_ref,index));continue
                if before!=after:
                    edits.append({'slot_ref':slot.slot_ref,'trait_ref':slot.trait_refs[index],'before_value_ref':before,'after_value_ref':after,
                        'native_hit_regions':slot.hit_regions[index],'obsolete_suffix_erasure':target is None})
        for slot in request.desired_program:
            if slot.slot_ref not in {s.slot_ref for s in current}:unresolved.append((slot.slot_ref,'NEW_SLOT_INPUT_BINDING_REQUIRED'))
        budget.finish()
        return d_result(request,'NEEDS_EVIDENCE' if unresolved else 'COMPLETE','DEVICE_PROGRAM_TIMING_AND_DIFFERENTIAL_EDITS',complete=not unresolved,
            examined=budget.examined,values={'device_stage_fragments':fragments,'grounded_world_goal_fragments':tuple(valid),
                'differential_edits':tuple(edits),'unresolved_edit_bindings':tuple(unresolved),'checkpoint_retention_evidence_ref':request.retain_checkpoint_evidence_ref,
                'neutral_instruction_clock_ignored':False,'current_bits_replaced_without_diff':False},descriptive_delta={
                'has_grounded_program_goal_fragment':bool(valid),'has_demonstrated_program_clock':child.model.clock_step is not None and child.model.clock_evidence_ref is not None,
                'complete_differential_program_edit':not unresolved})
    except DComputationInterrupted as error:
        return d_result(request,'BUDGET_REACHED',error.cause,examined=budget.examined,frontier={'restart_program_goal_audit':True,'work':error.frontier})


class RecipeOperatorGoalRequestD(DMechanicalRequest):
    schema_version: Ref='yf_arc3_v5.recipe_operator_goal_request_d.v1'
    phase_ref: Literal['LEARNED_RECIPE_TO_WORLD_OPERATION']
    recipe_request: RecipeOperatorRequest
    required_world_variable_values: tuple[tuple[Ref,Ref|int|bool],...]=Field(min_length=1,max_length=128)
    candidate_recipe_evidence_ref: Ref|None
    pattern_input_control_evidence_ref: Ref|None
    operation_effect_evidence_ref: Ref|None
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.recipe_operator_compilation','AUDIT'),)


def measure_recipe_operator_goal_d(request: RecipeOperatorGoalRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    budget=DWorkBudget(request)
    try:
        child=request.recipe_request
        if not _goal_child_current(request,child) or child.operation_ref!='mechanics.recipe_operator_compilation.compose' or child.mode!='SUCCESSOR':
            return d_result(request,'NEEDS_EVIDENCE','CURRENT_SOURCE_BOUND_COMPOSED_RECIPE_REQUEST_REQUIRED')
        if not all((request.candidate_recipe_evidence_ref,request.pattern_input_control_evidence_ref,request.operation_effect_evidence_ref)):
            return d_result(request,'NEEDS_EVIDENCE','RECIPE_CONTROL_AND_LEARNED_EFFECT_EVIDENCE_REQUIRED')
        budget.visit({'stage':'learned_recipe_world_composition'})
        if request.node_bound <= budget.examined:
            return d_result(request,'BUDGET_REACHED','RECIPE_CHILD_WORK_BUDGET_REQUIRED',examined=budget.examined,frontier={'restart_scoped_recipe_request':True})
        result=measure_recipe_operator(child.model_copy(update={'maximum_examined':min(child.maximum_examined,request.node_bound-budget.examined)}))
        budget.examined+=result.examined_count
        relevant=[]
        if result.domain_complete and child.composition is not None:
            composition=RecipeCompositionInput.model_validate(child.composition)
            for edge in composition.edges:
                budget.visit({'stage':'actual_recipe_world_goal_values','response_ref':edge.packet.response_ref})
                world=edge.packet.after.get('world',{}).get('values',())
                variables=dict(world)
                if all(ref in variables and type(variables[ref]) is type(value) and variables[ref]==value for ref,value in request.required_world_variable_values):
                    relevant.append(edge.packet.response_ref)
        budget.finish()
        return d_result(request,'COMPLETE' if result.domain_complete else 'BUDGET_REACHED' if result.computation_bound_reached else 'NEEDS_EVIDENCE',
            'LEARNED_RECIPE_WORLD_OPERATOR_RETURN',complete=result.domain_complete,examined=budget.examined,
            values={'composed_recipe_result':result.values,'required_world_variable_values':request.required_world_variable_values,
                'missing_refs':result.prerequisite_refs,'effect_evidence_ref':request.operation_effect_evidence_ref,
                'goal_relevant_measured_successor_refs':tuple(relevant)},frontier=result.frontier,
            descriptive_delta={'has_qualified_recipe_composition':result.domain_complete and not result.prerequisite_refs and bool(relevant)})
    except DComputationInterrupted as error:
        return d_result(request,'BUDGET_REACHED',error.cause,examined=budget.examined,frontier={'restart_recipe_goal_composition':True,'work':error.frontier})
