"""Bind support-preparation experiments to current public point/control evidence."""
import copy
from coupled_pair_access import CoupledPairAccess,input_candidates
from coupled_support_preparation import patch,translate,inside,select_question,parking_route,current_pair,group_control_question,group_control_response
from terminal_composition import identity
from support_continuation import recall,observed_model,prefix,cached_route,retain_suffix

class AuxiliarySupportAccess(CoupledPairAccess):
    def __init__(self):super().__init__();self.support_state=None;self.support_events=[];self.support_models={}
    def retained_digest(self):return identity([super().retained_digest(),self.support_state,self.support_events,self.support_models])
    def apply_event(self,e):
        if e.get('kind')=='coupled_support_control_model':self.support_models[e['model_ref']]=copy.deepcopy(e['model']);self.support_events.append(copy.deepcopy(e));return
        if e.get('kind')=='coupled_support_preparation':self.support_state=copy.deepcopy(e['state']);self.support_events.append(copy.deepcopy(e));return
        super().apply_event(e)
    def propose_graph(self,o,rows,inputs,limit,config):
        cfg=config.get('coupled_pair_question',{});state=self.pair_state;aux=self.support_state
        if not cfg.get('prepare_unmatched_supports')or not state or state['epoch']!=o['level_epoch']:return super().propose_graph(o,rows,inputs,limit,config)
        if aux and aux['epoch']!=o['level_epoch']:aux=None
        if aux and aux['phase']=='unresolved':return {'status':'abstained','reason':'support_control_or_return_requires_evidence','block_unrelated_probe':True,'unknown':aux.get('unknown')}
        parked=aux['parked']if aux else[];remaining=config.get('remaining_level_actions',40);mode=None;motion_steps=None
        if aux and aux['phase']=='verify_group':
            detail=group_control_question(rows,state,aux,o['available_action_refs'])
            if not detail:return {'status':'abstained','reason':'no_decisive_preserved_group_control_test','block_unrelated_probe':True}
            mode='verify_group';action={'action_ref':detail['action_ref']}
        elif not aux or aux['phase']=='group':
            ordinary=super().propose_graph(o,rows,inputs,limit,config)
            if ordinary['status']=='proposed'or ordinary.get('block_unrelated_probe'):return ordinary
            question=select_question(rows,state,o['available_action_refs'],remaining,parked)
            if not question:return ordinary
            mode='select';action={'action_ref':'ACTION6','data':question['item']['point']};detail=question
        else:
            aux=copy.deepcopy(aux);aux['recalled_moves']=recall(self.support_models,aux,o['available_action_refs'])
            route=cached_route(aux,rows)or parking_route(rows,state,aux,o['available_action_refs'],remaining)
            if not route:return {'status':'abstained','reason':'support_parking_context_unresolved','block_unrelated_probe':True}
            if route['path']:
                motion_steps=prefix(route,aux,rows,min(limit,remaining))
                if not motion_steps:return {'status':'abstained','reason':'current_physical_support_not_admitted_for_cached_path','block_unrelated_probe':True}
                mode='move';step=motion_steps[0];action={'action_ref':step['action_ref']};detail={'step':step,'parking':route,'selected_patch':aux['selected_patch'],'box':aux['box'],'floor':aux['floor'],'preserved_pair':current_pair(rows,state['pair']),'control_applications':aux['recalled_moves'],'question':'Continue the same conditional parking path under current measured or structurally recalled control effects. New cells alone do not seal it. The first uncovered mode/action relation is an experimental final primitive; reconcile once after the sealed set.'}
            else:
                mode='return';controls=set(state['samples']);mapped={a for a,ss in state['samples'].items()if any(any(x['deltas'][0])for x in ss)};choices=sorted(a for a in o['available_action_refs']if a not in mapped and a not in ('ACTION6','RESET','ACTION7')and a not in aux.get('return_tried',[]))
                pair=current_pair(rows,state['pair']);point_return=pair and'ACTION6'in o['available_action_refs']and'ACTION6'not in aux.get('return_tried',[])and(aux.get('return_method')or aux.get('return_tried'))
                if point_return:
                    b=pair['boxes'][0];action={'action_ref':'ACTION6','data':{'x':(b[1]+b[3])//2,'y':(b[0]+b[2])//2}};detail={'box':aux['box'],'current_pair':pair,'return_kind':'current_pair_point','question':'Reuse the observed point-selection relation as a hypothesis on this currently visible pair occurrence. Restoration of appearance is checked now; actual paired control still requires the next physical paired movement.'}
                elif choices:
                    action={'action_ref':choices[0]};detail={'box':aux['box'],'return_kind':'non_translation_input','question':'Test an available non-translation input for returning to the previously observed pair-control context. No return meaning is inferred from the input name.'}
                else:return {'status':'abstained','reason':'group_return_control_unknown','block_unrelated_probe':True}
        plan={'epoch':o['level_epoch'],'score':o['levels_completed'],'observation_ref':o['observation_ref'],'frame_digest':identity(rows),'mode':mode,'action':copy.deepcopy(action),'detail':detail,'parked':parked,'pair_before':copy.deepcopy(state['pair']),'evidence':state['evidence'][-24:]};ref='C_support_prepare_'+identity(plan)[:18];why=cfg['support_question']+' '+detail['question'];facts={'current_support_occurrence_bound':True,'conditional_joint_consumer_measured':True,'selection_and_control_remain_experimental':True};evidence=[o['observation_ref']]+plan['evidence']
        actions=[{'action_ref':s['action_ref']}for s in motion_steps]if motion_steps else[action];plan['motion_steps']=motion_steps;plan['commands']=copy.deepcopy(actions)
        return {'status':'proposed','kind':'coupled_support_preparation','proposal_id':ref,'support_preparation_plan':plan,'actions':actions,'steps':[{'action':a,'expected_after':{'selected_occurrence_box':motion_steps[i]['to']}if motion_steps else{'member_boxes':detail['expected'],'auxiliary_preserved':True}if mode=='verify_group'else None}for i,a in enumerate(actions)],'facts':facts,'compositions':[{'id':ref,'observed':False,'open_question':why,'properties':{'roles':['current pair','distinct support occurrence','conditional access path']},'relations':['contributes_to:G_official_completion']}],'question':{'reason':'prepare_conditional_joint_support:'+mode,'hypothesis_refs':evidence},'route_refs':evidence,'binding':{'level_epoch':o['level_epoch'],'observation_ref':o['observation_ref']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':actions,'purpose':why,'preconditions':facts,'evidence':evidence,'outcome_guard':{'path':['value'],'contains':ref}}}
    def before(self,p,index,rows,**meta):
        plan=p.get('support_preparation_plan')
        if not plan:return super().before(p,index,rows,**meta)
        commands=plan.get('commands',[plan['action']]);ok=(meta['epoch'],meta['score'])==(plan['epoch'],plan['score'])and p['actions']==commands and p['bundle_template']['actions']==p['actions']and commands[index]['action_ref']in meta['available']
        if index==0:ok=ok and meta['observation_ref']==plan['observation_ref']and identity(rows)==plan['frame_digest']
        if plan['mode']=='move'and plan.get('motion_steps'):
            d=plan['detail'];step=plan['motion_steps'][index];pair=d['preserved_pair'];ok=ok and patch(rows,step['from'])==d['selected_patch']and all(v==d['floor']for row in patch(rows,step['to'])for v in row)and all(all(v==pair['value']for row in patch(rows,b)for v in row)for b in pair['boxes'])
        elif index:ok=False
        return {'admitted':ok,'reason':'current_point_or_control_bound'if ok else'support_context_or_payload_changed'}
    def after(self,p,index,rows,later,**meta):
        plan=p.get('support_preparation_plan')
        if not plan:return super().after(p,index,rows,later,**meta)
        if (meta['epoch'],meta['score'])!=(plan['epoch'],plan['score'])or meta['state']in ('WIN','GAME_OVER'):return {'matched':None,'seal_prefix':True,'reason':'official_boundary_or_terminal'}
        if plan['mode']=='move':
            d=plan['detail'];step=plan['motion_steps'][index]if plan.get('motion_steps')else d['step'];old,new=step['from'],step['to'];allowed={(y,x)for b in (old,new)for y in range(b[0],b[2]+1)for x in range(b[1],b[3]+1)};extra=sum(rows[y][x]!=later[y][x]for y in range(1,len(rows)-1)for x in range(1,len(rows[0])-1)if(y,x)not in allowed);vacated='floor'not in d or all(v==d['floor']for row in patch(later,old)for v in row);matched=patch(later,new)==d['selected_patch']and not extra and vacated;known=step.get('mapping_covered',step['mapping_observed'])
            return {'matched':matched if known else None,'seal_prefix':not matched or not known,'candidate_prediction_matched':matched,'extra_effect_count':extra,'vacated_support_matches':vacated,'reason':'conditional_selected_occurrence_continuation'if known and matched else'selected_occurrence_response_requires_reconciliation'}
        if plan['mode']=='verify_group':return {'matched':None,'seal_prefix':True,'candidate_prediction':group_control_response(rows,later,plan['detail']),'reason':'physical_group_control_test'}
        return {'matched':None,'seal_prefix':True,'reason':'selection_or_return_effect_unknown'}
    def record(self,before,cmd,after,rows,later,proposal,index):
        events=super().record(before,cmd,after,rows,later,proposal,index);plan=proposal.get('support_preparation_plan')
        if not plan or before['level_epoch']!=after['level_epoch']:
            if not plan and proposal.get('pair_access_plan')and self.support_state and self.support_state.get('return_method')and self.support_state['return_method'].get('status')!='paired_control_revalidated'and before['level_epoch']==after['level_epoch']:
                outcome=super().after(proposal,index,rows,later,epoch=after['level_epoch'],score=after['levels_completed'],state=after['state'])
                if outcome.get('matched')is True:
                    aux=copy.deepcopy(self.support_state);aux['return_method']['status']='paired_control_revalidated';aux['return_method']['actual_paired_control_evidence']=[before['observation_ref'],after['observation_ref']];e={'kind':'coupled_support_preparation','state':aux,'mode':'paired_control_revalidation','evidence':aux['return_method']['actual_paired_control_evidence']};self.apply_event(e);events.append(e)
            return events
        refs=[before['observation_ref'],after['observation_ref']];detail=plan['detail'];aux=copy.deepcopy(self.support_state);mode=plan['mode'];known=plan['pair_before'];pair=current_pair(later,known)
        if mode=='select':
            method=copy.deepcopy(aux.get('return_method'))if aux else None
            b=detail['item']['box'];selected=patch(later,b);changed=sum(a!=b for r,s in zip(rows,later)for a,b in zip(r,s));aux={'epoch':after['level_epoch'],'phase':'selected'if pair and changed else'unresolved','box':b,'selected_patch':selected,'floor':detail['floor'],'parked':copy.deepcopy(plan['parked']),'measured_moves':{},'selection_ref':refs,'return_tried':[],'return_method':method,'unknown':None if pair and changed else'Point selection not evidenced by preserved pair loci and public change.'}
        elif mode=='move':
            b=aux['box'];q=len(aux['selected_patch']);matches=[]
            for dy,dx in ((0,0),(-q,0),(q,0),(0,-q),(0,q)):
                dest=translate(b,(dy,dx))
                if inside(later,dest)and patch(later,dest)==aux['selected_patch']:matches.append(dest)
            outcome=self.after(proposal,index,rows,later,epoch=after['level_epoch'],score=after['levels_completed'],state=after['state'])
            if len(matches)==1 and pair and not outcome['extra_effect_count']and outcome.get('vacated_support_matches',True):
                dest=matches[0];delta=[dest[0]-b[0],dest[1]-b[1]]
                if any(delta):
                    aux['measured_moves'][cmd['action_ref']]=delta;aux['box']=dest;model_event=observed_model(self.support_models,aux,cmd['action_ref'],delta,refs);self.apply_event(model_event);events.append(model_event)
                    retain_suffix(aux,later,plan,index if plan.get('motion_steps')else 0)
                else:aux['phase']='unresolved';aux['unknown']='Selected occurrence stayed under a hypothesized free displacement; current parking premise needs revision.'
            else:
                aux['phase']='unresolved';aux['unknown']='Selected correspondence, vacated support or preserved pair/scene disagrees; effect cause unknown.';aux.pop('continuation',None)
                model_event=observed_model(self.support_models,aux,cmd['action_ref'],[0,0],refs,refutation=outcome);self.apply_event(model_event);events.append(model_event)
        elif mode=='return':
            aux['return_tried'].append(cmd['action_ref'])
            appearance_restored=bool(pair and pair['value']==known['value']);aux['pending_return']={'command':cmd,'kind':detail.get('return_kind'),'evidence':refs,'appearance_restored':appearance_restored}
            if pair and(appearance_restored or detail.get('return_kind')=='current_pair_point'):
                aux['phase']='verify_group';aux['appearance_return_evidence']=refs if appearance_restored else None;aux['unknown']='Actual controlled displacement remains untested after return attempt.'
            else:
                aux.setdefault('return_counterexamples',[]).append({'command':cmd,'evidence':refs,'expected_pair_appearance_restored':False})
                aux['phase']='selected'if cmd['action_ref']!='ACTION6'and'ACTION6'in after['available_action_refs']and pair else'unresolved';aux['unknown']='Proposed return input did not restore the pair appearance; group-control effect unknown.'
        elif mode=='verify_group':
            response=group_control_response(rows,later,detail);aux['group_control_test']=response
            if response['matched']:
                aux['phase']='group';aux['parked'].append(aux['box']);aux['unknown']=None;aux['return_method']={'kind':'point_current_pair_occurrence'if aux['pending_return']['kind']=='current_pair_point'else'discrete_return_input','evidence':aux['pending_return']['evidence'],'actual_paired_control_evidence':refs,'status':'paired_control_revalidated','causal_scope':'Paired control observed after the recorded return attempts; each input contribution remains unisolated. Revalidate in each new selection context.'}
                pair_state=copy.deepcopy(self.pair_state);pair_state['pair']=response['pair_after'];e={'kind':'coupled_pair_evidence','state':pair_state,'evidence':refs};self.apply_event(e);events.append(e)
            else:aux['phase']='unresolved';aux['unknown']='Current mode did not produce the expected paired displacement with auxiliary preservation; actual control remains unresolved.'
        aux['last_evidence']=refs;e={'kind':'coupled_support_preparation','state':aux,'command':cmd,'mode':mode,'evidence':refs,'scope':'Observed selection, displacement or return only; no universal helper semantics.'};self.apply_event(e);events.append(e);return events
