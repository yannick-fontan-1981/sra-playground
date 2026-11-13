"""Whole-footprint and independent control projections of an acquired K22 return."""
from agents.yf_arc3_v5.logos.types import FrozenMap, immutable_json_data
from .mechanical_family_contracts_a import MechanicalFamilyResult
from .mechanical_request_contracts import MechanicalNormalizedReturn
from .reconfigurable_support import SupportRequest, SupportState
from .support_solving_contracts_d import (SupportSolvingReturnMeasureInputD,
    SupportSolvingReturnFactsD, SupportSolvingReturnSealInputD)


def measure_support_solving_return_d(value: SupportSolvingReturnMeasureInputD) -> SupportSolvingReturnFactsD:
    answer=value.answer
    request=answer.request.frontier.native_request
    returned=answer.returned
    missing=list(answer.missing_refs)
    native=None
    if not isinstance(request,SupportRequest) or returned is None or returned.measured.request!=answer.request.frontier:
        missing.append('exact_acquired_support_return')
    elif not isinstance(returned.returned,MechanicalNormalizedReturn):
        missing.append('normalized_support_calculation')
    else:
        packet=returned.returned
        raw=packet.descriptive_values.get('calculation')
        if raw is not None:
            native=MechanicalFamilyResult.model_validate(raw)
        if (native is None or packet.status!='FOUND' or not native.domain_complete
                or native.computation_bound_reached or native.prerequisite_refs
                or native.scope!=request.scope or native.operation_ref!=request.operation_ref
                or native.mode!=request.mode or not native.signature_supported or native.frontier):
            missing.append('complete_same_scope_support_calculation')
    stages=[]
    permissions=[]
    controls=[]
    if not missing:
        scenes=returned.measured.facts.get('observed_family_delta',FrozenMap()).get('ordered_support_stage_relations',())
        for row in scenes:
            stages.append(row)
        if request.state is not None:
            stages.append(_footprint_row(request.state,'native_before',0))
            for tool in request.state.tools:
                controls.append(FrozenMap({'tool_ref':tool.tool_ref,'tool_positions':tool.positions,
                    'loaded_ref':tool.loaded_ref,'loaded_positions':tool.loaded_positions,
                    'support_owner_ref':tool.support_owner_ref,
                    'command_refs':tuple((request.command.command_ref,)) if request.command is not None
                        and request.command.tool_ref==tool.tool_ref else (),
                    'mode_law_refs':tuple(law.law_ref for law in request.move_laws
                        if request.command is not None and request.command.tool_ref==tool.tool_ref
                        and law.command_ref==request.command.command_ref
                        and law.mode==('EMPTY' if tool.loaded_ref is None else 'LOADED')),
                    'actor_ref':request.state.actor_ref,'actor_positions':request.state.actor_positions,
                    'attachment_command_refs':tuple((request.command.command_ref,)) if request.command is not None
                        and request.command.tool_ref==tool.tool_ref and request.command.kind in ('ATTACH','DETACH') else ()}))
            for grant in request.grants:
                holds=(grant.grant_ref in request.state.acquired_grant_refs) if grant.kind=='ACQUIRED' else (
                    None if grant.actor_allowed_positions is None else
                    set(request.state.actor_positions)<=set(grant.actor_allowed_positions))
                permissions.append(FrozenMap({'grant_ref':grant.grant_ref,'kind':grant.kind,
                    'maintaining_body_ref':request.state.actor_ref if grant.kind=='MAINTAINED' else None,
                    'region_positions':grant.actor_allowed_positions,'holds_before_use':holds,
                    'command_ref':grant.command_ref,'scope_ref':grant.scope_ref,'evidence_refs':grant.evidence_refs}))
        after=native.values.get('after_state')
        if after is not None:
            stages.append(_footprint_row(SupportState.model_validate(after),'native_after',0))
    facts=FrozenMap({'complete_same_parent_return':not bool(missing),
        'whole_footprint_support_rows':tuple(stages),'independent_control_maps':tuple(controls),
        'permission_maintainer_rows':tuple(permissions),
        'hit_mask_positions':request.obstacles if isinstance(request,SupportRequest) else None,
        'support_snapshot_rows':() if native is None else native.values.get('support_snapshots',()),
        'support_masks_are_explicit_layers':True,'ui_background_used_as_support':False,
        'shadow_used_as_support':False,'empty_tool_motion_is_future_loaded_motion':False,
        'temporary_enablement_is_acquired_control':False})
    return SupportSolvingReturnFactsD(answer=answer,facts=facts,missing_refs=tuple(sorted(set(missing))))


def _footprint_row(state: SupportState, provenance: str, index: int) -> FrozenMap:
    union=frozenset(p for layer in state.platforms for p in layer.positions)
    return FrozenMap({'provenance':provenance,'stage_index':index,'actor_ref':state.actor_ref,
        'actor_positions':state.actor_positions,'support_layers':immutable_json_data(state.platforms),
        'support_union':tuple(sorted(union)),
        'unsupported_actor_positions':tuple(sorted(set(state.actor_positions)-union)),
        'full_footprint_covered':bool(state.actor_positions) and set(state.actor_positions)<=union})


def seal_support_solving_return_d(value: SupportSolvingReturnSealInputD):
    return value.measured.answer.model_copy(update={'descriptive_facts':value.measured.facts,
        'missing_refs':value.measured.missing_refs,'source_disposition_ref':value.source_disposition_ref})
