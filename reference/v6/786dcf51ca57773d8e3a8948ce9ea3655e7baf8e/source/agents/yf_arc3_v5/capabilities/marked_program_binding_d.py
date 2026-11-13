"""Bind measured words to caller-declared K57 models and bounded word domains.

Meaning, grammar, roles and comparison order are supplied by DRM. No new game
simulator, executable witness catalog or action-release path is introduced.
"""
from itertools import product
from agents.yf_arc3_v5.logos.types import stable_digest
from .editable_actor_programs import (
    ProgramCell, ProgramActor, ProgramCard, ProgramModel, ProgramInstruction,
    ProgramState, ProgramRequest, ProgramAddition, ProgramEdit,
    measure_editable_actor_programs,
)
from .mechanical_family_contracts_a import MechanicalFamilyScope
from .marked_program_geometry_d import measure_marked_program_scene
from .marked_program_temporal_d import fit_retained_word
from .agenda_measurement_transport import append_candidate_measurements
from agents.yf_arc3_v5.logos.types import FrozenMap, immutable_json_data


def _instruction(paint):
    return 'measurement.marked_instruction.'+str(paint)


def _cards(word, actor):
    return tuple(ProgramCard(occurrence_ref='measurement.marked_card.'+actor+'.'+str(i),
        instruction_ref=_instruction(p))for i,p in enumerate(word))


def _packet(scene):
    return tuple((b['ring'],tuple(b['cell']),tuple(b['cards']))
        for b in sorted(scene['bodies'],key=lambda b:b['ring']))


def _model_packet(state, rings):
    return tuple(sorted((rings[a.actor_ref],(a.y,a.x),tuple(
        int(c.instruction_ref.rsplit('.',1)[1])for c in a.program))
        for a in state.actors if a.alive))


def _bind(value,scene,contract):
    h,w=scene['half_extent'];instructions=[];additions=[]
    for c in scene['carriers']:
        dy,dx=c['vector']
        instructions.append(ProgramInstruction(instruction_ref=_instruction(c['paint']),
            kind=contract['singleton_instruction_kind']if c['singleton']else contract['uniform_instruction_kind'],
            dx=(dy//h+dx//w)//2,dy=(dy//h-dx//w)//2,
            recipient_offsets=contract['recipient_offsets'],recipient_roles=contract['recipient_roles'],
            evidence_ref=contract['conditional_instruction_evidence_ref']))
        y,x=c['point'];additions.append(ProgramAddition(instruction_ref=_instruction(c['paint']),
            input_ref='measurement.current_marked_palette.'+str(c['paint']),
            action_ref=contract['point_action_ref'],payload=FrozenMap({'x':x,'y':y}),
            available=scene['palette_visible']))
    model=ProgramModel(**dict(contract['model_parameters']),model_ref=contract['model_ref'],
        instructions=tuple(instructions),additions=tuple(additions),capacity=scene['capacity'])
    linked=next(b for b in scene['bodies']if b['ring']==scene['collection_body_ring'])
    ordered=(linked,)+tuple(b for b in scene['bodies']if b is not linked)
    actors=tuple(ProgramActor(actor_ref='measurement.marked_actor.'+str(i),
        role=contract['linked_actor_role']if i==0 else contract['other_actor_role'],
        x=b['cell'][1],y=b['cell'][0],alive=True,program=_cards(b['cards'],str(i)))
        for i,b in enumerate(ordered))
    rings={a.actor_ref:b['ring']for a,b in zip(actors,ordered)}
    board=tuple(ProgramCell(cell_ref='measurement.marked_cell.'+str(c['cell']),
        x=c['cell'][1],y=c['cell'][0],terrain=contract['linked_origin_terrain']
        if c['cell']==linked['cell']else contract['nonuniform_cell_terrain']
        if len(c['uncovered_interior_paints'])>1 else contract['uniform_cell_terrain'])
        for c in scene['cells'])
    # This is a supplied finite calculation horizon, never an observed gauge.
    state=ProgramState(board=board,actors=actors,beneficiary_ref=actors[0].actor_ref,
        initiative=tuple(a.actor_ref for a in actors),remaining_budget=contract['calculation_command_horizon'],
        level_scope_ref=contract['scope_ref'],restore_epoch=value.current_context_epoch,status='ACTIVE')
    scope=MechanicalFamilyScope(request_ref=contract['request_ref'],caller_ref=contract['caller_ref'],
        parent_goal_ref=contract['parent_goal_ref'],parent_contribution_ref=contract['contribution_ref'],
        epoch=value.current_context_epoch,evidence_revision_ref=value.current_observation_frame_ref,
        model_revision_ref=model.model_ref,model_status_ref=contract['model_status_ref'],
        event_owner_ref=actors[0].actor_ref,input_domain_complete=True)
    request=ProgramRequest(scope=scope,operation_ref='program_launch',mode='STEP',
        maximum_evaluations=contract['maximum_kernel_evaluations'],
        maximum_states=contract['maximum_states'],maximum_depth=contract['maximum_launches'],
        maximum_witnesses=1,state=state,models=(model,),bound_model_ref=model.model_ref)
    return request,model,rings


def _domain(request,scene,fit,contract):
    uniform=tuple(c['paint']for c in scene['carriers']if not c['singleton'])
    linked=scene['collection_body_ring'];others=tuple(b for b in scene['bodies']if b['ring']!=linked)
    if len(uniform)!=1 or len(others)!=contract['other_stack_count']:return None
    if not others[0]['cards']or set(others[0]['cards'])!=set(uniform):return None
    suffix=uniform*len(others[0]['cards'])
    alphabet=tuple(sorted(set(fit['word_observed'])&{c['paint']for c in scene['carriers']if c['singleton']}))
    if not alphabet or len(suffix)>scene['capacity']:return None
    if contract['word_grammar']!='measured_movement_prefix_then_other_card_count_reductions':return None
    if tuple(contract['comparison_order'])!=('external_command_count','launch_count','word_length'):return None
    best=None;witness=None;words=0;evaluations=0;unknown=0
    initial=request.state;actor=initial.actors[0]
    for size in range(scene['capacity']-len(suffix)+1):
        for prefix in product(alphabet,repeat=size):
            words+=1
            if words>contract['maximum_words']:return None
            word=prefix+suffix
            current=initial.model_copy(update={'actors':(actor.model_copy(update={
                'program':_cards(word,'proposed')}),*initial.actors[1:]),
                'remaining_budget':initial.remaining_budget-len(word)})
            for n in range(1,contract['maximum_launches']+1):
                result=measure_editable_actor_programs(request.model_copy(update={'state':current}));evaluations+=1
                if not result.domain_complete:unknown+=1;break
                after=ProgramState.model_validate(dict(result.values['after_state']))
                if after.status==contract['required_terminal_status']:
                    metric=(len(word)+n,n,len(word))
                    if best is None or metric<best:
                        best=metric;witness={'word':word,'remaining_launches':n,'comparison_tuple':metric}
                    break
                if after.status!='ACTIVE':break
                current=after
    if witness is None:return None
    return {**witness,'enumerated_word_count':words,'launch_evaluation_count':evaluations,
        'unknown_branch_count':unknown,'domain_complete':unknown==0,'root_witness_count':1}


def measure_marked_program_input(value,contract):
    if not contract or type(value.current_context_epoch)is not int or type(value.observed_level_index)is not int:
        return None
    if type(value.current_level_primitive_count)is not int:return None
    signature=(value.current_context_epoch,value.observed_level_index)
    digest=stable_digest(immutable_json_data(contract))
    old=value.canonical_dispatched_goal_continuity_facts.get('dispatched_composition_target_context')or{}
    same=(old.get('schema_ref')==contract['schema_ref']and old.get('contract_digest')==digest
        and tuple(old.get('scope_signature',()))==signature)
    scene=measure_marked_program_scene(value,old['scene']if same else None)
    if scene is None or scene['capacity']>contract['maximum_capacity']:return None
    if scene['unmatched_base_candidates']:
        if contract.get('unmatched_base_binding')!='empty_at_revalidated_collection_origin':return None
        if any(b['cards']or tuple(b['cell'])!=tuple(scene['collection_origin_cell'])
                for b in scene['unmatched_base_candidates']):return None
    if same:
        if value.current_level_primitive_count!=old['level_primitive_count']+1:return None
        if value.last_action_ref!=old['next_action_ref']:return None
        point=old.get('next_point')
        if point is not None and tuple(value.last_point_position or())!=tuple(point):return None
        if _packet(scene)!=tuple((a,tuple(b),tuple(c))for a,b,c in old['expected_next_packet']):return None
        if (tuple(scene['half_extent']),tuple(scene['origin']),tuple(scene['shape']))!=(
                tuple(old['scene']['half_extent']),tuple(old['scene']['origin']),tuple(old['scene']['shape'])):return None
        fit=old['retained_word_fit'];domain=old['word_domain']
    else:
        if scene['collection_word']:return None
        fit=fit_retained_word(value,scene,measure_marked_program_scene,contract['maximum_retained_frames'])
        if not fit or not fit['forward_matches']or fit['reverse_matches']or not fit['other_stack_disappeared']:
            return None
        domain=None
    request,model,rings=_bind(value,scene,contract)
    if same:
        # Preserve the original supplied terrain classification; moving bodies
        # do not turn their new cells into newly discovered editing supports.
        board=tuple(ProgramCell.model_validate(dict(c))for c in old['initial_board'])
        request=request.model_copy(update={'state':request.state.model_copy(update={'board':board})})
    if domain is None:domain=_domain(request,scene,fit,contract)
    if not domain:return None
    word=tuple(domain['word']);current=tuple(scene['collection_word'])
    if word[:len(current)]!=current:return None
    if len(current)<len(word):
        if not scene['palette_visible']:return None
        paint=word[len(current)];addition=next(a for a in model.additions if a.instruction_ref==_instruction(paint))
        card=ProgramCard(occurrence_ref='measurement.marked_card.0.'+str(len(current)),instruction_ref=addition.instruction_ref)
        edit=ProgramEdit(actor_ref=request.state.beneficiary_ref,kind='ADD',card=card,
            input_ref=addition.input_ref,action_ref=addition.action_ref,payload=addition.payload)
        result=measure_editable_actor_programs(request.model_copy(update={
            'operation_ref':'local_program_edit','edit':edit}))
        action=contract['point_action_ref'];payload=addition.payload;point=(payload['y'],payload['x'])
        stage=contract['append_stage_ref']
    else:
        if domain['remaining_launches']<1:return None
        result=measure_editable_actor_programs(request)
        action=contract['launch_action_ref'];payload=FrozenMap();point=None;stage=contract['launch_stage_ref']
    if not result.domain_complete:return None
    after=ProgramState.model_validate(dict(result.values['after_state']))
    if after.status not in ('ACTIVE',contract['required_terminal_status']):return None
    remaining=domain['remaining_launches']-int(action==contract['launch_action_ref'])
    if action==contract['launch_action_ref']and remaining==0 and after.status!=contract['required_terminal_status']:return None
    if action not in value.available_action_refs:return None
    common=FrozenMap({'schema_ref':contract['schema_ref'],'contract_digest':digest,'scope_signature':signature,
        'source_frame_ref':value.current_observation_frame_ref,'scene':scene,'retained_word_fit':fit,
        'word_domain':{**dict(domain),'remaining_launches':remaining},'level_primitive_count':value.current_level_primitive_count,
        'initial_board':tuple(c.model_dump(mode='json')for c in request.state.board),
        'expected_next_packet':_model_packet(after,rings),'next_action_ref':action,'next_point':point,
        'model_parameters':contract['model_parameters'],'conditional_model_assignments':contract['conditional_model_assignments'],
        'calculation_budget_is_observed_game_resource':False,'current_prediction_status':after.status,
        'current_input_kind':stage,'current_after_state':after.model_dump(mode='json'),
        'current_kernel_return':result.model_dump(mode='json'),'prior_input_effect_matched':same})
    return {'action_ref':action,'point':point,'payload':payload,'facts':FrozenMap({
        'marked_program_current_input_measured':True,'marked_program_current_measurement':common,
        'marked_program_current_input_stage':stage,'marked_program_current_remaining_launches':remaining,
        'marked_program_current_predicted_terminal':after.status==contract['required_terminal_status'],
        'marked_program_incoming_route_remaining_step_count':value.incoming_declared_route_remaining_step_count})}


def append_marked_program_candidates(value,agenda,contract,point_producer):
    row=measure_marked_program_input(value,contract)
    if not row:return agenda
    action=row['action_ref'];point=row['point']
    represented=any(c.action_ref==action and c.point==point for c in agenda.candidates)
    additions=tuple((c,f)for c,f in point_producer(value,
        frozenset(agenda.current_context_no_effect_candidate_refs),
        frozenset(agenda.tested_candidate_refs_without_resolution_plan),{},{},{},{},requested_points=(point,))
        if c.point==point)if point is not None and not represented else ()
    if len(agenda.candidates)+len(additions)>contract['maximum_frontier_candidates']:return agenda
    candidates=list(agenda.candidates);facts=dict(agenda.alternative_facts)
    deltas=dict(agenda.descriptive_delta_facts or agenda.alternative_facts);refs=set(agenda.alternative_refs)
    for candidate,base in additions:
        if candidate.candidate_ref not in refs:
            candidates.append(candidate);refs.add(candidate.candidate_ref)
            facts[candidate.candidate_ref]=base;deltas[candidate.candidate_ref]=base
    agenda=agenda.model_copy(update={'candidates':tuple(candidates),
        'alternative_refs':tuple(c.candidate_ref for c in candidates),
        'alternative_facts':FrozenMap(facts),'descriptive_delta_facts':FrozenMap(deltas),
        'has_candidates':bool(candidates)})
    measured={c.candidate_ref:row['facts']for c in agenda.candidates if c.action_ref==action and c.point==point}
    return append_candidate_measurements(agenda,FrozenMap(measured),FrozenMap())
