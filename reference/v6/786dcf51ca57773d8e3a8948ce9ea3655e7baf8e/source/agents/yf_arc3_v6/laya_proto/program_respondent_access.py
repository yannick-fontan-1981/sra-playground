"""Compose with locally observed respondents, retaining competing word reductions."""
import time
from program_composition_access import ProgramCompositionAccess,world,editor,word_at,input_candidates,projected_members,patch
from program_compositions import surface
from program_respondent_search import search,search_replacement
from program_input_access import learn_input_support,candidate_sites
from terminal_composition import identity


class ProgramRespondentAccess(ProgramCompositionAccess):
    def __init__(self):
        super().__init__();self.respondent_models=[];self.respondent_events=[];self.extension_refusals=[];self.input_supports=[]
    def apply_event(self,e):
        if e['kind']=='observed_respondent_order':
            self.respondent_models.append(e);self.respondent_events.append(e);self.requested_stop_reason=None
        elif e['kind']=='respondent_composition_reconciled':
            self.composition_continuation=e.get('continuation');self.respondent_events.append(e)
            if e.get('stop_reason'):self.requested_stop_reason=e['stop_reason']
        elif e['kind']=='exact_program_extension_refusal':
            self.extension_refusals.append(e);self.respondent_events.append(e);self.composition_refuted_epochs.discard(e['epoch'])
        elif e['kind']=='observed_input_support':self.input_supports.append(e);self.respondent_events.append(e)
        else:super().apply_event(e)
    def retained_digest(self):return identity([super().retained_digest(),self.respondent_models,self.respondent_events,self.extension_refusals,self.input_supports])
    def record_packet(self,before,command,after,rows,packet,episode):
        pending=self.respondent_pending;events=super().record_packet(before,command,after,rows,packet,episode)
        if pending and (pending['before_ref'],pending['after_ref'])==(before['observation_ref'],after['observation_ref']) and before['level_epoch']==after['level_epoch']:
            support=learn_input_support(pending['plan'],rows,packet)
            if support:
                e={'kind':'observed_input_support','epoch':before['level_epoch'],'support':support,'evidence':[before['observation_ref'],after['observation_ref']]};self.apply_event(e);events.append(e)
        for e in list(events):
            if e['kind']!='respondent_probe_result' or not pending or not e.get('editing_composition_restored') or e.get('official_progress'):continue
            if not all(r['matching_packet_indices'] for r in e['results']):continue
            own=pending['plan']['prepared_word'];order=[]
            for r in e['results']:
                word=r['candidate']['object']['word']
                if word!=own:order.append({'word':word,'first_effect':min(r['matching_packet_indices']),'evidence_kind':'prospective_local_translation'})
            for r in e['revealed_candidates']:
                if len(r['compatible_retroprojections'])!=1:break
                order.append({'word':r['object']['word'],'first_effect':r['first_complete_packet_index'],'evidence_kind':'retrospective_revealed_translation'})
            else:
                if order and len({tuple(o['word']) for o in order})==len(order):
                    learned={'kind':'observed_respondent_order','epoch':before['level_epoch'],'order':sorted(order,key=lambda o:o['first_effect']),'evidence':e['evidence'],'model_id':pending['plan']['model']['model_id'],'status':'conditional_order_and_operator_transfer','uncertainties':['Future order persistence','Which end of a heterogeneous word is removed','Whether respondent interactions affect all other bearers','Completeness of visible body inventory']};self.apply_event(learned);events.append(learned)
        return events
    def program_question(self,obs,rows,max_prefix,config):
        continuation=self.composition_continuation
        if continuation and continuation.get('respondent_predictions'):
            if continuation['epoch']!=obs['level_epoch'] or continuation['frame_digest']!=identity(rows):return None
            plan={**continuation,'model':self.composition_models[-1],'mode':'execute','observation_ref':obs['observation_ref'],'score':obs['levels_completed'],'steps':[{'mode':'execute','before_word':continuation['word'],'after_word':continuation['word'],'action':{'action_ref':self.composition_models[-1]['command_ref']}}],'turns':[]}
            return self.package(obs,plan,'Continue the retained composition under the still compatible respondent hypotheses; do not recompute its path after a matched return.')
        models=[m for m in self.respondent_models if m['epoch']==obs['level_epoch']]
        if not models or not self.composition_models:return super().program_question(obs,rows,max_prefix,config)
        model=self.composition_models[-1];learned=models[-1];layout=editor(rows,model)
        if not layout:return None
        word=[m['color'] for m in layout['members']];objects=world(rows,model);owners=[o for o in objects if o['word']==word]
        if len(owners)!=1:return None
        owner=owners[0];targets=[o for o in objects if o is not owner];ordering={tuple(o['word']):o['first_effect'] for o in learned['order']}
        if not targets or len(targets)!=len(ordering) or any(tuple(t['word']) not in ordering for t in targets):return None
        targets.sort(key=lambda t:ordering[tuple(t['word'])]);field=surface(rows,model,objects,owner['base'])
        if not field:return None
        kwargs={'max_new_actions':config.get('remaining_level_actions',max_prefix),'deadline':config.get('level_deadline',time.perf_counter()+360)};refusals=[r for r in self.extension_refusals if r['epoch']==obs['level_epoch']];access=None
        if refusals:
            count=len(refusals[-1]['word']);result=search_replacement(word,owner['base'],targets,model,field,max_members=count,**kwargs)
            if result['status']=='unknown':
                supports=[s for s in self.input_supports if s['epoch']==obs['level_epoch']]
                if supports:
                    sites=candidate_sites(rows,field,supports[-1]['support'],owner['base'])
                    if sites:
                        result=search_replacement(word,owner['base'],targets,model,field,max_members=count,access_sites=sites,**kwargs)
                        if result['status']=='proposed':access={'support':supports[-1]['support'],'sites':sites,'evidence':supports[-1]['evidence'],'scope':'Appearance-matched support; current pattern required and input restoration must be observed after arrival.'}
        else:result=search(word,owner['base'],targets,model,field,**kwargs)
        if result['status']!='proposed':return None
        selected=result['plan'];current=list(word);steps=[]
        for i in range(selected.get('removals',0)):
            member=layout['members'][i];x,y,r,b=member['bbox'];later=current[1:];steps.append({'mode':'remove','before_word':current,'after_word':later,'member_box':member['bbox'],'action':{'action_ref':'ACTION6','data':{'x':(x+r)//2,'y':(y+b)//2}}});current=later
        for label in selected['edits']:
            controls=[c for c in layout['controls'] if c['color']==label]
            if len(controls)!=1:return None
            x,y,r,b=controls[0]['bbox'];later=[label,*current];steps.append({'mode':'insert','before_word':current,'after_word':later,'action':{'action_ref':'ACTION6','data':{'x':(x+r)//2,'y':(y+b)//2}}});current=later
        steps.append({'mode':'execute','before_word':current,'after_word':current,'action':{'action_ref':model['command_ref']}})
        if len(steps)>max_prefix:return None
        plan={'model':model,'mode':'construct_and_execute','epoch':obs['level_epoch'],'score':obs['levels_completed'],'frame_digest':identity(rows),'observation_ref':obs['observation_ref'],'layout':layout,'steps':steps,'word':current,'turns':[],'own_base':owner['base'],'targets':targets,'respondent_predictions':selected['predictions'],'respondent_order_evidence':learned['evidence'],'field':field,'search_nodes':result['nodes'],'search_scope':result['scope'],'input_access':access,'count_hypothesis_evidence':refusals[-1]['evidence'] if refusals else []}
        why='Recompose toward an appearance-matched input-bearing support, then revalidate the actual controls before any later UI payload. A stationary extension refusal applies only to its exact context; member count is a conservative search hypothesis, not a universal capacity.' if access else 'Compose phase-observed operators with publicly ordered respondents. Keep both word-end reductions and both interaction scopes; require the chosen word to achieve the conditional reduction under all four models. Verify edits and every full return; only official score establishes completion.'
        return self.package(obs,plan,why)
    def before(self,p,index,rows,**meta):
        result=super().before(p,index,rows,**meta)
        if not result['admitted']:return result
        action=p['actions'][index]
        if any(r['epoch']==meta['epoch'] and r['frame_digest']==identity(rows) and r['command']==action for r in self.extension_refusals):return {'admitted':False,'reason':'exact_observed_extension_refusal'}
        plan=p.get('program_composition_plan')
        if plan:
            step=plan['steps'][index]
            if step['mode']=='remove' and {v for row in patch(rows,step['member_box']) for v in row}!={step['before_word'][0]}:return {'admitted':False,'reason':'removal_member_support_changed'}
            access=plan.get('input_access')
            if access:
                pattern=access['support']['pattern'];height=len(pattern);width=len(pattern[0]);destinations={tuple(pred['turns'][-1]['base']) for pred in plan['respondent_predictions']}
                if not all(patch(rows,[x,y,x+width-1,y+height-1])==pattern for x,y in destinations):return {'admitted':False,'reason':'input_support_pattern_changed_before_access'}
        return result
    def after(self,p,index,rows,later,**meta):
        plan=p.get('program_composition_plan')
        if plan and plan['steps'][index]['mode']=='remove':
            step=plan['steps'][index];members=projected_members(later,plan['layout'],{c['color'] for c in plan['layout']['controls']});ok=meta['epoch']==plan['epoch'] and meta['score']==plan['score'] and [m['color'] for m in members]==step['after_word'] and (not step['after_word'] or word_at(later,plan['model'],plan['own_base'],step['after_word']))
            return {'matched':ok,'seal_prefix':not ok,'reason':'member_removal_projected' if ok else 'member_removal_refuted','observed_member_count':len(members)}
        if not plan or not plan.get('respondent_predictions') or plan['steps'][index]['mode']!='execute':return super().after(p,index,rows,later,**meta)
        if meta['epoch']!=plan['epoch'] or meta['score']!=plan['score'] or meta['state'] in ('WIN','GAME_OVER'):return {'matched':None,'seal_prefix':True,'reason':'official_boundary_or_terminal'}
        observed=world(later,plan['model']);matching=[]
        for i,prediction in enumerate(plan['respondent_predictions']):
            turn=prediction['turns'][0];expected=[{'base':turn['base'],'word':plan['word']},*[t for t in turn['targets'] if t['word']]]
            if len(expected)==len(observed) and all(any(o['base']==e['base'] and o['word']==e['word'] for o in observed) for e in expected):matching.append(i)
        return {'matched':bool(matching),'seal_prefix':True,'reason':'respondent_projection_matched' if matching else 'respondent_projection_refuted','matching_hypotheses':matching,'unknowns':'Only decoded public word projections are compared; global terminal causality remains unknown.'}
    def record(self,before,command,after,rows,later,proposal,index):
        events=super().record(before,command,after,rows,later,proposal,index);plan=proposal.get('program_composition_plan')
        if plan and plan.get('respondent_predictions') and plan['steps'][index]['mode']=='insert' and rows==later and all(before[k]==after[k] for k in ('level_epoch','state','levels_completed','available_action_refs')):
            step=plan['steps'][index]
            if step['after_word']!=step['before_word'] and self.before(proposal,index,rows,epoch=before['level_epoch'],score=before['levels_completed'],available=before['available_action_refs'],observation_ref=before['observation_ref'])['admitted']:
                event={'kind':'exact_program_extension_refusal','epoch':before['level_epoch'],'frame_digest':identity(rows),'command':command,'word':step['before_word'],'site':plan['own_base'],'evidence':[before['observation_ref'],after['observation_ref']],'scope':'Only this exact prefix/input/public context is refused. Count is a conservative search hypothesis; operator, content, site, and capacity explanations remain open.'};self.apply_event(event);events.append(event)
        if not plan or not plan.get('respondent_predictions') or plan['steps'][index]['mode']!='execute':return events
        outcome=next(e['outcome'] for e in reversed(events) if e['kind']=='program_composition_reconciled');continuation=None;stop=None
        if outcome['matched'] is True:
            selected=[plan['respondent_predictions'][i] for i in outcome['matching_hypotheses']];turn=selected[0]['turns'][0];remaining=[{**p,'turns':p['turns'][1:]} for p in selected if len(p['turns'])>1]
            if remaining:
                continuation={k:plan[k] for k in ('epoch','layout','word','respondent_order_evidence')};continuation.update(frame_digest=identity(later),own_base=turn['base'],targets=turn['targets'],respondent_predictions=remaining,input_access=plan.get('input_access'))
            elif plan.get('input_access'):
                if editor(later,plan['model']) is None:stop='input_access_hypothesis_refuted'
            else:stop='conditional_respondent_projection_complete_without_official_score'
        event={'kind':'respondent_composition_reconciled','epoch':before['level_epoch'],'continuation':continuation,'outcome':outcome,'stop_reason':stop,'evidence':[before['observation_ref'],after['observation_ref']]};self.apply_event(event);events.append(event);return events
