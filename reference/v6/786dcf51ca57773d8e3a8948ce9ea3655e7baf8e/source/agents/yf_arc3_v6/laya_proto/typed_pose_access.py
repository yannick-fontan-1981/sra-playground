"""Selected-role pose dependency experiments from public scope changes."""
from typed_material_flow import MaterialFlowAccess,input_candidates
from typed_material_observations import requests,child_present,local_child_mark
from typed_pose_observations import small_parts,novel_controls,rotated,current_marks,outside_digest,control_matches
from terminal_composition import identity

class TypedPoseAccess(MaterialFlowAccess):
    def __init__(self):
        super().__init__();self.pose_epoch=None;self.pose_initial_parts=[];self.pose_controls=[];self.pose_models={};self.pose_context=None;self.pose_rule=None;self.pose_events=[];self.pose_cfg=None;self.pose_limit=1
    def retained_digest(self):return identity([super().retained_digest(),self.pose_epoch,self.pose_initial_parts,self.pose_controls,self.pose_models,self.pose_context,self.pose_rule,self.pose_events])
    def apply_event(self,e):
        if e['kind']=='typed_pose_scope':
            self.pose_epoch=e['epoch'];self.pose_initial_parts=e['initial_parts'];self.pose_controls=e['controls'];self.pose_context=None;self.pose_rule=None;self.pose_events.append(e);return
        if e['kind']=='typed_pose_model':self.pose_models[e['core_signature']]=e;self.pose_events.append(e);return
        if e['kind']=='typed_pose_response':
            self.pose_events.append(e);self.pose_rule=e.get('rule',self.pose_rule);self.requested_stop_reason=e.get('stop_reason')
            if e.get('child'):
                c=e['child'];self.flow_children=[c if x['id']==c['id'] else x for x in self.flow_children]
                if e.get('ready_for_request'):self.flow_context={'child':c,'evidence':e['evidence']};self.pose_context=None
                else:self.pose_context={'child':c,'evidence':e['evidence']};self.flow_context=None
            if e.get('control'):self.pose_controls=[e['control'] if c['bbox']==e['control']['bbox'] else c for c in self.pose_controls]
            return
        super().apply_event(e)
    def propose(self,episode,obs,rows,inputs,max_prefix,config):
        self.pose_limit=max_prefix;return super().propose(episode,obs,rows,inputs,max_prefix,config)
    def carrier_question(self,obs,rows,cfg):
        self.pose_cfg=cfg;return super().carrier_question(obs,rows,cfg)
    def matching_pose_targets(self,child,rows,obs):
        known={(b[2]-b[0],b[3]-b[1])for b in self.flow_filled};targets=[q for q in requests(rows,obs,known)if q['bbox']not in self.flow_filled];out=[]
        for turns in range(4):
            marks=rotated(child['marks'],turns)
            for key,model in self.pose_models.items():
                if marks!=sorted(model['marks']):continue
                for target in targets:
                    if target['descriptor']==model['descriptor']:out.append({'turns':turns,'model_ref':key,'model':model,'target':target,'marks':marks})
        return out
    def flow_question(self,obs,rows,cfg):
        if self.pose_context:return self.pose_question(obs,rows,cfg,self.pose_context['child'],'control')
        ready=super().flow_question(obs,rows,cfg)
        if ready:return ready
        candidates=[c for c in self.flow_children if child_present(c,rows)and self.matching_pose_targets(c,rows,obs)]
        if not candidates:return None
        child=min(candidates,key=lambda c:(min(p['turns']for p in self.matching_pose_targets(c,rows,obs)),c['center'][1],c['center'][0]));return self.pose_question(obs,rows,cfg,child,'select')
    def pose_question(self,obs,rows,cfg,child,mode):
        controls=[c for c in self.pose_controls if control_matches(c,rows,obs['level_epoch'])]
        if len(controls)!=1:return None
        options=self.matching_pose_targets(child,rows,obs)
        if not options:return None
        option=min(options,key=lambda p:(p['turns'],p['model_ref']));control=controls[0];count=1;expected=[];before=[];rule=self.pose_rule
        if mode=='control' and rule and rule['status']=='conditional_observed_pose_change':
            possible=[n for n in range(1,4)if rotated(child['marks'],rule['turns']*n)==option['marks']]
            if not possible:return None
            count=min(min(possible),max(1,self.pose_limit));expected=[rotated(child['marks'],rule['turns']*(i+1))for i in range(count)];before=[rotated(child['marks'],rule['turns']*i)for i in range(count)]
        point=child['point'] if mode=='select' else control['point'];action={'action_ref':'ACTION6','data':dict(zip(('x','y'),point))};actions=[dict(action,data=dict(action['data']))for _ in range(count)];reason='select_role_for_unresolved_pose' if mode=='select' else ('conditional_typed_pose_path' if expected else 'probe_new_control_with_selected_role');evidence=[obs['observation_ref'],child['source_ref'],control['source_ref'],option['model']['source_ref']]
        plan={'epoch':obs['level_epoch'],'score':obs['levels_completed'],'observation_ref':obs['observation_ref'],'frame_digest':identity(rows),'child':child,'control':control,'mode':mode,'option':option,'rule':rule,'actions':actions,'expected_before':before,'expected_after':expected,'outside_digest':outside_digest(rows,child['bbox'],control['bbox']),'reason':reason,'scope':'Typed-mark rotation is a comparison hypothesis. No action effect is inferred until measured; subsequent conditional prefixes preserve the selected scope and cancel on mismatch.'};ref='C_typed_pose_'+identity(plan)[:20];facts={'current_role_and_control_measured':True,'retained_request_comparison_available':True};why=cfg['pose_question']+' Current experiment: '+reason+'.'
        return {'status':'proposed','kind':'typed_pose_dependency','proposal_id':ref,'material_pose_plan':plan,'actions':actions,'steps':[{'action':a,'expected_after':{'typed_marks':expected[i],'outside_selected_scopes_preserved':True}if expected else None}for i,a in enumerate(actions)],'facts':facts,'compositions':[{'id':ref,'observed':False,'open_question':why,'properties':{'roles':cfg['pose_roles']},'relations':['contributes_to:G_official_completion']}],'question':{'reason':reason,'hypothesis_refs':[option['model_ref']]},'route_refs':evidence,'binding':{'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':actions,'purpose':why,'preconditions':facts,'evidence':evidence,'outcome_guard':{'path':['value'],'contains':ref}}}
    def before(self,p,index,rows,**meta):
        plan=p.get('material_pose_plan')
        if not plan:return super().before(p,index,rows,**meta)
        bound=(meta['epoch'],meta['score'])==(plan['epoch'],plan['score'])and 'ACTION6'in meta['available']and p['actions']==plan['actions'];point=plan['child']['point']if plan['mode']=='select'else plan['control']['point'];bound=bound and all([a['data']['x'],a['data']['y']]==point for a in p['actions'])
        if index==0:bound=bound and meta['observation_ref']==plan['observation_ref'] and identity(rows)==plan['frame_digest']
        else:bound=bound and bool(plan['expected_before'])and current_marks(plan['child'],rows)==plan['expected_before'][index]and outside_digest(rows,plan['child']['bbox'],plan['control']['bbox'])==plan['outside_digest']and control_matches(plan['control'],rows,meta['epoch'])
        return {'admitted':bool(bound),'reason':'current_selected_pose_path'if bound else'typed_pose_context_changed'}
    def after(self,p,index,rows,later,**meta):
        plan=p.get('material_pose_plan')
        if not plan:return super().after(p,index,rows,later,**meta)
        if meta['epoch']!=plan['epoch']or meta['score']!=plan['score']:return {'matched':None,'seal_prefix':True,'reason':'scope_changed','official_progress':meta['score']>plan['score']}
        if not plan['expected_after']:return {'matched':None,'seal_prefix':True,'reason':'first_pose_effect_uncharacterized','official_progress':False}
        matched=current_marks(plan['child'],later)==plan['expected_after'][index]and outside_digest(later,plan['child']['bbox'],plan['control']['bbox'])==plan['outside_digest']and control_matches(plan['control'],later,meta['epoch'])
        return {'matched':matched,'seal_prefix':not matched,'reason':'conditional_typed_pose_matched'if matched else'typed_pose_prediction_refuted','official_progress':False}
    def record(self,before,command,after,rows,later,proposal,index):
        events=super().record(before,command,after,rows,later,proposal,index);extra=[];cfg=self.pose_cfg
        if cfg and self.carrier_calibration:
            if self.pose_epoch is None:extra.append({'kind':'typed_pose_scope','epoch':before['level_epoch'],'initial_parts':small_parts(rows),'controls':[],'evidence':[before['observation_ref']]})
            if before['level_epoch']!=after['level_epoch']:
                controls,parts=novel_controls(self.pose_initial_parts,later,after,{**cfg,'observed_body_shapes':self.carrier_calibration});extra.append({'kind':'typed_pose_scope','epoch':after['level_epoch'],'initial_parts':parts,'controls':controls,'evidence':[before['observation_ref'],after['observation_ref']],'scope':'New-scope appearance novelty only, not an action-effect law.'})
        flow=proposal.get('material_flow_plan')
        for event in events:
            if event['kind']=='typed_material_flow'and event.get('model')and flow:
                extra.append({'kind':'typed_pose_model',**event['model'],'marks':flow['child']['marks']})
        plan=proposal.get('material_pose_plan')
        if plan:
            child=next((c for c in self.flow_children if c['id']==plan['child']['id']),plan['child']);e={'kind':'typed_pose_response','evidence':[before['observation_ref'],after['observation_ref']],'stop_reason':'typed_pose_effect_unexplained'}
            if before['level_epoch']==after['level_epoch']and plan['mode']=='select'and local_child_mark(child,rows,later):e.update(child=child,stop_reason=None)
            elif before['level_epoch']==after['level_epoch']and plan['mode']=='control':
                old=current_marks(child,rows);new=current_marks(child,later);turns=[t for t in range(1,4)if old and new and rotated(old,t)==new];outside=outside_digest(rows,child['bbox'],plan['control']['bbox'])==outside_digest(later,child['bbox'],plan['control']['bbox'])
                consistent=not self.pose_rule or (len(turns)==1 and self.pose_rule['turns']==turns[0])
                if len(turns)==1 and outside and consistent:
                    matches=[k for k,m in self.pose_models.items()if sorted(m['marks'])==new];updated={**child,'marks':new,'core_signature':matches[0]if len(matches)==1 else identity(['unbound_observed_pose',new])};control=dict(plan['control']);x,y,r,b=control['bbox'];control['projection']=[[later[v][u]for u in range(x,r+1)]for v in range(y,b+1)];rule={'status':'conditional_observed_pose_change','turns':turns[0],'epoch':after['level_epoch'],'control_bbox':control['bbox'],'evidence':(self.pose_rule or {}).get('evidence',[])+[e['evidence']]};ready=any(o['turns']==0 for o in self.matching_pose_targets(updated,later,after));e.update(child=updated,control=control,rule=rule,ready_for_request=ready,stop_reason=None)
                elif self.pose_rule:e['rule']={**self.pose_rule,'status':'refuted','counterexample':e['evidence']}
            extra.append(e)
        for event in extra:self.apply_event(event)
        return events+extra
