"""SRC-facing experimental access through a program fitted from public effects."""
import time,json
from marked_collection_access import MarkedCollectionAccess,collection_scene,measured_controls,rectangular_members,input_candidates
from observed_program_effects import patch,translation_candidates
from program_geometry import decode_stacks,render_layers
from program_compositions import fit_composition_model,surface,search_program
from terminal_composition import identity
from program_respondent_observations import observe_respondent_packet

def editor(rows,model):
    current=measured_controls(rows);old=model['editor_geometry']['controls'];offsets=[]
    for c in old:
        matches=[q for q in current if q['color']==c['color'] and patch(rows,q['bbox'])==c['patch']]
        if len(matches)!=1:return None
        offsets.append([matches[0]['bbox'][i]-c['bbox'][i] for i in (0,1)])
    if not offsets or any(d!=offsets[0] for d in offsets):return None
    dx,dy=offsets[0];g=model['editor_geometry'];x=g['member_column'][0]+dx;w,h=g['member_size'];example={'bbox':[x,0,x+w-1,h-1]};limit=min(c['bbox'][1] for c in current)
    members=rectangular_members(rows,[example],{c['color'] for c in current},limit)
    return {'controls':[{**c,'patch':patch(rows,c['bbox'])} for c in current],'members':members,'member_box':[x,0,x+w-1,limit-1],'member_size':[w,h],'offset':[dx,dy],'limit':limit}

def projected_members(rows,layout,palette):
    x=layout['member_box'][0];w,h=layout['member_size'];return rectangular_members(rows,[{'bbox':[x,0,x+w-1,h-1]}],set(palette),layout['limit'])

def world(rows,model):
    g=model['editor_geometry'];return decode_stacks(rows,model['layer'],{c['color'] for c in g['controls']},[g['member_column'],g['footer']])

def word_at(rows,model,base,word):
    step=model['layer']['step'];anchor=[base[i]-len(word)*step[i] for i in range(2)];image=render_layers(word,model['layer']['shape'],step)
    return bool(word) and all(0<=anchor[1]+y<len(rows) and 0<=anchor[0]+x<len(rows[0]) and rows[anchor[1]+y][anchor[0]+x]==color for (x,y),color in image.items())

class ProgramCompositionAccess(MarkedCollectionAccess):
    def __init__(self):
        super().__init__();self.program_edit_samples=[];self.composition_models=[];self.composition_continuation=None;self.composition_refuted_epochs=set();self.composition_events=[];self.respondent_pending=None;self.requested_stop_reason=None
    def apply_event(self,e):
        kind=e['kind']
        if kind=='program_edit_sample':self.program_edit_samples.append(e);self.composition_events.append(e)
        elif kind=='fitted_program_composition':self.composition_models.append(e['model']);self.composition_events.append(e)
        elif kind=='program_composition_reconciled':
            self.composition_continuation=e.get('continuation')
            if e.get('refuted'):self.composition_refuted_epochs.add(e['epoch'])
            self.composition_events.append(e)
        elif kind=='respondent_probe_pending':self.respondent_pending=e;self.composition_events.append(e)
        elif kind=='respondent_probe_result':self.respondent_pending=None;self.requested_stop_reason='respondent_probe_observed_goal_model_open';self.composition_events.append(e)
        else:super().apply_event(e)
    def retained_digest(self):return identity([super().retained_digest(),self.program_edit_samples,self.composition_models,self.composition_continuation,sorted(self.composition_refuted_epochs),self.composition_events,self.respondent_pending,self.requested_stop_reason])
    def propose(self,episode,obs,rows,inputs,max_prefix,config):
        if config.get('public_program_composition'):
            p=self.program_question(obs,rows,max_prefix,config)
            if p:return p
        return super().propose(episode,obs,rows,inputs,max_prefix,config)
    def program_question(self,obs,rows,max_prefix,config):
        if not self.composition_models or obs['level_epoch'] in self.composition_refuted_epochs:return None
        model=self.composition_models[-1];continuation=self.composition_continuation
        if continuation and continuation['epoch']==obs['level_epoch'] and continuation['frame_digest']==identity(rows):
            turn=continuation['turns'][0];plan={**continuation,'model':model,'mode':'execute','turns':continuation['turns'],'frame_digest':identity(rows),'observation_ref':obs['observation_ref'],'score':obs['levels_completed'],'steps':[{'mode':'execute','before_word':continuation['word'],'after_word':continuation['word'],'action':{'action_ref':model['command_ref']},'turn':turn}]}
            return self.package(obs,plan,'Continue the previously composed program after its entire expected public projection was matched; no new path search.')
        layout=editor(rows,model)
        if not layout:return None
        controls=layout['controls'];members=layout['members'];existing=[e['color'] for e in members]
        if not existing:
            learned=next((o for o in model['moves'] if o['status']=='phase_observed_translation'),None)
            # Preserve phase order, rather than a palette or action-name priority.
            observed=translation_candidates(self.program_events[-1]['alignment']) if self.program_events else []
            label=observed[0]['label'] if observed else learned['label'] if learned else None
            control=next((c for c in controls if c['color']==label),None)
            if control is None:return None
            x,y,r,b=control['bbox'];action={'action_ref':'ACTION6','data':{'x':(x+r)//2,'y':(y+b)//2}}
            plan={'model':model,'mode':'bind_single_member','epoch':obs['level_epoch'],'score':obs['levels_completed'],'frame_digest':identity(rows),'observation_ref':obs['observation_ref'],'layout':layout,'steps':[{'mode':'insert','before_word':[],'after_word':[label],'action':action}],'word':[label],'turns':[],'own_base':None,'targets':[]}
            return self.package(obs,plan,'Insert one phase-observed label to bind the currently empty collection to its visible bearer, before constructing a word. No execution is included in this binding probe.')
        objects=world(rows,model);owners=[o for o in objects if o['word']==existing]
        if len(owners)!=1:return None
        owner=owners[0];targets=[o for o in objects if o is not owner]
        if not targets:return None
        if any(any(label!=model['interaction']['label'] for label in obj['word']) for obj in targets):
            proposal=self.respondent_question(obs,rows,model,layout,owner)
            return proposal if proposal and len(proposal['actions'])<=max_prefix else None
        field=surface(rows,model,objects,owner['base'])
        if not field:return None
        found=search_program(existing,owner['base'],targets,model,field,max_new_actions=config.get('remaining_level_actions',max_prefix),deadline=config.get('level_deadline',time.perf_counter()+360))
        if found['status']!='proposed':return None
        selected=found['plan'];steps=[];current=list(existing)
        for label in selected['edits']:
            matches=[c for c in controls if c['color']==label]
            if len(matches)!=1:return None
            x,y,r,b=matches[0]['bbox'];after=[label,*current];steps.append({'mode':'insert','before_word':current,'after_word':after,'action':{'action_ref':'ACTION6','data':{'x':(x+r)//2,'y':(y+b)//2}}});current=after
        steps.append({'mode':'execute','before_word':current,'after_word':current,'action':{'action_ref':model['command_ref']},'turn':selected['prediction']['turns'][0]})
        if len(steps)>max_prefix:return None
        plan={'model':model,'mode':'construct_and_execute','epoch':obs['level_epoch'],'score':obs['levels_completed'],'frame_digest':identity(rows),'observation_ref':obs['observation_ref'],'layout':layout,'steps':steps,'word':current,'turns':selected['prediction']['turns'],'own_base':owner['base'],'targets':targets,'target_counts':[len(t['word']) for t in targets],'field':field,'search_nodes':found['nodes'],'search_scope':found['scope']}
        return self.package(obs,plan,'Construct a prefix-preserving word whose conditional phase model reaches the earlier score-associated reduction. Verify each edit and the complete returned projection; cancel on discrepancy, including a global collection rewrite.')
    def respondent_question(self,obs,rows,model,layout,owner=None):
        if owner is None or len(owner['word'])!=1:return None
        objects=world(rows,model);motions={o['label']:o['vectors'][0] for o in model['moves'] if o['status']=='phase_observed_translation'};candidates=[]
        for obj in objects:
            if obj['base']==owner['base']:continue
            if sum(q['word']==obj['word'] for q in objects)!=1:continue
            first=next((label for label in reversed(obj['word']) if label in motions),None)
            if first is None:continue
            vector=motions[first];candidates.append({'object':obj,'operator':first,'vector':vector,'expected_first_base':[obj['base'][i]+vector[i] for i in range(2)],'scope':'First matching translation on a different visible bearer, conditional on its preceding operations not interrupting execution.'})
        if not candidates or model['command_ref'] not in obs['available_action_refs']:return None
        own_vector=motions.get(owner['word'][0])
        if own_vector is None:return None
        inverse=[label for label,vector in motions.items() if all(vector[i]==-own_vector[i] for i in range(2))]
        controls=[c for c in layout['controls'] if c['color'] in inverse]
        if len(controls)!=1:return None
        control=controls[0];x,y,r,b=control['bbox'];insert={'action_ref':'ACTION6','data':{'x':(x+r)//2,'y':(y+b)//2}};word=[control['color'],*owner['word']]
        if insert['action_ref'] not in obs['available_action_refs']:return None
        own_prediction={'object':{**owner,'word':word},'operator':owner['word'][0],'vector':own_vector,'expected_first_base':[owner['base'][i]+own_vector[i] for i in range(2)],'scope':'Two phase-observed opposite translations, conditional on traversability. Expected final return to the input-bearing composition; input availability is not guaranteed.'}
        command={'action_ref':model['command_ref']};actions=[insert,command]
        plan={'epoch':obs['level_epoch'],'score':obs['levels_completed'],'observation_ref':obs['observation_ref'],'frame_digest':identity(rows),'model':model,'layout':layout,'candidates':candidates,'own_prediction':own_prediction,'owner_before':owner,'insert_control':control,'prepared_word':word,'actions':actions,'command':command,'own_collection_empty':False,'stop_after_sealed_probe':True,'expected_final_own_base':owner['base']}
        ref='C_respondent_operator_'+identity(plan)[:18];why='Preserve the composition that exposes editing controls while testing another bearer: append a measured opposite operator, verify that edit, then execute the reversible pair. Separate own return, input restoration, and other-bearer translations are falsifiable hypotheses; stop after public reconciliation.';facts={'public_other_word_contains_motion':True,'own_collection_observed_single':True,'opposite_operators_observed':True,'respondent_operator_applicability_unknown':True};evidence=[obs['observation_ref'],model['model_id'],*model['evidence_refs']]
        return {'status':'proposed','kind':'public_program_respondent_probe','proposal_id':ref,'respondent_probe_plan':plan,'actions':actions,'steps':[{'action':insert,'expected_after':{'collection':word}},{'action':command,'expected_after':{'conditional_respondent_translations':candidates,'conditional_own_return':owner['base'],'input_restoration':'hypothesis','other_effects':'unknown'}}],'facts':facts,'compositions':[{'id':ref,'observed':False,'open_question':why,'properties':{'target':'operator_applicability_and_preserved_input_access'},'relations':['contributes_to:G_official_completion']}],'question':{'reason':'discriminate_respondent_operator_applicability','hypothesis_refs':evidence},'route_refs':evidence,'binding':{'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':actions,'purpose':why,'preconditions':facts,'evidence':evidence,'outcome_guard':{'path':['value'],'contains':ref}}}
    def package(self,obs,plan,why):
        actions=[s['action'] for s in plan['steps']]
        if any(a['action_ref'] not in obs['available_action_refs'] for a in actions):return None
        ref='C_program_composition_'+identity(plan)[:18];facts={'public_phase_model_retained':True,'current_collection_bound':True,'experimental_projection_explicit':True};evidence=[obs['observation_ref'],plan['model']['model_id'],*plan['model']['evidence_refs']]
        return {'status':'proposed','kind':'public_program_composition','proposal_id':ref,'program_composition_plan':plan,'actions':actions,'steps':[{'action':s['action'],'expected_after':{'collection':s['after_word'],'scope':'conditional public program projection'}} for s in plan['steps']],'facts':facts,'compositions':[{'id':ref,'observed':False,'open_question':why,'properties':{'mode':plan['mode'],'model_status':'conditional'},'relations':['contributes_to:G_official_completion']}],'question':{'reason':'compose_phase_observed_operators','hypothesis_refs':evidence},'route_refs':evidence,'binding':{'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':actions,'purpose':why,'preconditions':facts,'evidence':evidence,'outcome_guard':{'path':['value'],'contains':ref}}}
    def before(self,p,index,rows,**meta):
        probe=p.get('respondent_probe_plan')
        if probe:
            ok=0<=index<len(probe['actions']) and (meta['epoch'],meta['score'])==(probe['epoch'],probe['score']) and probe['actions'][index]['action_ref'] in meta['available']
            if index==0:ok=ok and meta['observation_ref']==probe['observation_ref'] and identity(rows)==probe['frame_digest']
            else:
                members=projected_members(rows,probe['layout'],{c['color'] for c in probe['layout']['controls']});ok=ok and [e['color'] for e in members]==probe['prepared_word'] and word_at(rows,probe['model'],probe['owner_before']['base'],probe['prepared_word']) and all(patch(rows,c['bbox'])==c['patch'] for c in probe['layout']['controls']) and all(word_at(rows,probe['model'],c['object']['base'],c['object']['word']) for c in probe['candidates'])
            return {'admitted':ok,'reason':'respondent_experiment_bound' if ok else 'respondent_probe_context_changed'}
        plan=p.get('program_composition_plan')
        if not plan:return super().before(p,index,rows,**meta)
        if index>=len(plan['steps']) or (meta['epoch'],meta['score'])!=(plan['epoch'],plan['score']):return {'admitted':False,'reason':'program_scope_changed'}
        step=plan['steps'][index];palette={c['color'] for c in plan['model']['editor_geometry']['controls']};members=projected_members(rows,plan['layout'],palette)
        ok=[e['color'] for e in members]==step['before_word'] and step['action']['action_ref'] in meta['available']
        if index==0:ok=ok and identity(rows)==plan['frame_digest'] and meta['observation_ref']==plan['observation_ref']
        if step['mode']=='insert':
            point=step['action']['data'];matches=[c for c in plan['layout']['controls'] if c['bbox'][0]<=point['x']<=c['bbox'][2] and c['bbox'][1]<=point['y']<=c['bbox'][3]]
            ok=ok and len(matches)==1 and patch(rows,matches[0]['bbox'])==matches[0]['patch']
        if plan.get('own_base') and step['before_word']:ok=ok and word_at(rows,plan['model'],plan['own_base'],step['before_word'])
        ok=ok and all(not count or word_at(rows,plan['model'],t['base'],t['word'][:count]) for t,count in zip(plan.get('targets',[]),plan.get('target_counts',[len(t['word']) for t in plan.get('targets',[])])))
        return {'admitted':ok,'reason':'program_collection_and_operands_bound' if ok else 'program_premise_changed'}
    def after(self,p,index,rows,later,**meta):
        if p.get('respondent_probe_plan'):
            probe=p['respondent_probe_plan']
            if index==0:
                members=projected_members(later,probe['layout'],{c['color'] for c in probe['layout']['controls']});ok=meta['epoch']==probe['epoch'] and meta['score']==probe['score'] and [e['color'] for e in members]==probe['prepared_word'] and word_at(later,probe['model'],probe['owner_before']['base'],probe['prepared_word'])
                return {'matched':ok,'seal_prefix':not ok,'reason':'return_operator_inserted' if ok else 'return_operator_edit_refuted'}
            return {'matched':None,'seal_prefix':True,'reason':'respondent_packet_requires_scoped_reconciliation','official_progress':meta['score']>probe['score']}
        plan=p.get('program_composition_plan')
        if not plan:return super().after(p,index,rows,later,**meta)
        if meta['epoch']!=plan['epoch'] or meta['score']!=plan['score'] or meta['state'] in ('WIN','GAME_OVER'):return {'matched':None,'seal_prefix':True,'reason':'official_boundary_or_terminal'}
        step=plan['steps'][index];model=plan['model'];members=projected_members(later,plan['layout'],{c['color'] for c in model['editor_geometry']['controls']});word=[e['color'] for e in members];ok=word==step['after_word']
        if step['mode']=='insert':
            if plan.get('own_base'):ok=ok and word_at(later,model,plan['own_base'],word)
            return {'matched':ok,'seal_prefix':not ok,'reason':'program_edit_projected' if ok else 'program_edit_refuted','observed_member_count':len(word)}
        turn=step['turn'];objects=world(later,model);owners=[o for o in objects if o['base']==turn['base'] and o['word']==word];ok=ok and len(owners)==1
        for target,count in zip(plan['targets'],turn['remaining']):
            matching=[o for o in objects if o['base']==target['base']]
            ok=ok and (len(matching)==1 and len(matching[0]['word'])==count if count else not matching)
        return {'matched':ok,'seal_prefix':True,'reason':'returned_program_projection_matched' if ok else 'returned_program_projection_refuted','expected_base':turn['base'],'observed_member_count':len(word),'terminal_cause':'unknown_until_official_boundary'}
    def record(self,before,command,after,rows,later,proposal,index):
        events=super().record(before,command,after,rows,later,proposal,index);marked=proposal.get('marked_collection_plan');extra=[]
        if marked and marked['mode'] in ('remove','insert') and after['level_epoch']==before['level_epoch']:
            first=collection_scene(rows);second=collection_scene(later)
            if first and second and abs(len(first['members'])-len(second['members']))==1:
                e={'kind':'program_edit_sample','before_rows':rows,'after_rows':later,'before_members':first['members'],'after_members':second['members'],'epoch':before['level_epoch'],'evidence':[before['observation_ref'],after['observation_ref']]};self.apply_event(e);extra.append(e)
        plan=proposal.get('program_composition_plan')
        if plan:
            outcome=self.after(proposal,index,rows,later,epoch=after['level_epoch'],score=after['levels_completed'],state=after['state']);continuation=None;step=plan['steps'][index]
            if step['mode']=='execute' and outcome['matched'] is True and len(plan['turns'])>1:
                turn=plan['turns'][0];continuation={k:plan[k] for k in ('epoch','layout','word','targets')};continuation.update(frame_digest=identity(later),own_base=turn['base'],turns=plan['turns'][1:],target_counts=turn['remaining'])
            e={'kind':'program_composition_reconciled','epoch':before['level_epoch'],'outcome':outcome,'refuted':outcome['matched'] is False,'continuation':continuation,'evidence':[before['observation_ref'],after['observation_ref']]};self.apply_event(e);extra.append(e)
        probe=proposal.get('respondent_probe_plan')
        if probe and index==len(probe['actions'])-1:
            e={'kind':'respondent_probe_pending','plan':probe,'before_ref':before['observation_ref'],'after_ref':after['observation_ref'],'evidence':[before['observation_ref'],after['observation_ref']]};self.apply_event(e);extra.append(e)
        return events+extra
    def record_packet(self,before,command,after,rows,packet,episode):
        events=super().record_packet(before,command,after,rows,packet,episode)
        pending=self.respondent_pending
        if pending and (pending['before_ref'],pending['after_ref'])==(before['observation_ref'],after['observation_ref']):
            probe=pending['plan'];observation=observe_respondent_packet(probe,rows,packet,same_epoch=after['level_epoch']==before['level_epoch'])
            restored=bool(packet) and word_at(packet[-1],probe['model'],probe['expected_final_own_base'],probe['prepared_word']) and all(patch(packet[-1],c['bbox'])==c['patch'] for c in probe['layout']['controls'])
            e={'kind':'respondent_probe_result','epoch':before['level_epoch'],**observation,'editing_composition_restored':restored,'official_progress':after['levels_completed']>before['levels_completed'],'evidence':[before['observation_ref'],after['observation_ref']]};self.apply_event(e);events.append(e)
        if after['levels_completed']<=before['levels_completed'] or not self.program_events:return events
        alignment=self.program_events[-1]['alignment']
        if alignment['after_ref']!=after['observation_ref']:return events
        for sample in self.program_edit_samples:
            if sample['epoch']!=before['level_epoch']:continue
            model=fit_composition_model(alignment,sample['before_rows'],sample['after_rows'],sample['before_members'],sample['after_members'],rows,packet,official_progress=True)
            if model:
                e={'kind':'fitted_program_composition','model':model,'evidence':[before['observation_ref'],after['observation_ref'],*sample['evidence']]};self.apply_event(e);events.append(e);break
        return events
