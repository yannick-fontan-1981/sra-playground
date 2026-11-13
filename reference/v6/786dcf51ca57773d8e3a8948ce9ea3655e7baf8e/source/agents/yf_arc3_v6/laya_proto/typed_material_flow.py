"""Observed material replacement, typed descendants and conditional request matching."""
from typed_carrier_access import TypedCarrierAccess,input_candidates
from typed_carrier_scene import measure
from typed_material_observations import descendants,requests,child_present,local_child_mark
from terminal_composition import identity

class MaterialFlowAccess(TypedCarrierAccess):
    def __init__(self):super().__init__();self.flow_epoch=None;self.flow_children=[];self.flow_context=None;self.flow_models={};self.flow_filled=[];self.flow_events=[]
    def retained_digest(self):return identity([super().retained_digest(),self.flow_epoch,self.flow_children,self.flow_context,self.flow_models,self.flow_filled,self.flow_events])
    def apply_event(self,e):
        if e['kind']!='typed_material_flow':return super().apply_event(e)
        self.flow_events.append(e)
        if e['boundary'] or self.flow_epoch!=e['epoch']:self.flow_children=[];self.flow_filled=[];self.flow_context=None
        self.flow_epoch=e['epoch'];self.flow_children=[c for c in self.flow_children if c['id'] not in e.get('removed_children',[])];self.flow_children.extend(e.get('added_children',[]));self.flow_context=e.get('context');self.flow_filled.extend(e.get('filled',[]))
        if e.get('model'):self.flow_models[e['model']['core_signature']]=e['model']
        self.carrier_context=None;self.requested_stop_reason=e.get('stop_reason')
    def carrier_question(self,obs,rows,cfg):
        if self.flow_epoch==obs['level_epoch'] and self.flow_children:
            return self.flow_question(obs,rows,cfg)
        if self.carrier_context:return super().carrier_question(obs,rows,cfg)
        if self.flow_events and not self.requested_stop_reason:
            fresh=TypedCarrierAccess();fresh.carrier_calibration=list(self.carrier_calibration);return fresh.carrier_question(obs,rows,cfg)
        return super().carrier_question(obs,rows,cfg)
    def flow_question(self,obs,rows,cfg):
        available=[c for c in self.flow_children if child_present(c,rows)]
        if not available:return None
        known_shapes={(b[2]-b[0],b[3]-b[1])for b in self.flow_filled};targets=[q for q in requests(rows,obs,known_shapes) if q['bbox'] not in self.flow_filled]
        def matching(c):
            prior=self.flow_models.get(c['core_signature']);return [q for q in targets if (q['descriptor']==prior['descriptor'] if prior else q['descriptor']['palette']==c['body_palette'])]
        ready=[c for c in available if len(matching(c))==1]
        if not self.flow_context and not ready:return None
        child=self.flow_context['child'] if self.flow_context else min(ready,key=lambda c:(c['center'][1],c['center'][0],c['core_signature']))
        if not any(c['id']==child['id'] for c in available):return None
        model=self.flow_models.get(child['core_signature']);matches=[q for q in targets if (q['descriptor']==model['descriptor'] if model else q['descriptor']['palette']==child['body_palette'])]
        if len(matches)!=1:return None
        target=matches[0];mode='deliver' if self.flow_context else 'select';selected=target if mode=='deliver' else child;reason='test_typed_descendant_at_current_request' if mode=='deliver' else 'test_selection_of_new_descendant';action={'action_ref':'ACTION6','data':dict(zip(('x','y'),selected['point']))};evidence=[obs['observation_ref'],child['source_ref']]+(model['evidence'] if model else [])
        plan={'epoch':obs['level_epoch'],'score':obs['levels_completed'],'observation_ref':obs['observation_ref'],'frame_digest':identity(rows),'child':child,'target':target,'selected':selected,'mode':mode,'action':action,'source_model':model,'reason':reason,'scope':'Matching current material appearance proposes the first request; a prior accepted core-to-request association proposes later ones under fresh guards. Acceptance remains unconfirmed until the real response.'};ref='C_material_flow_'+identity(plan)[:20];facts={'descendant_substructure_observed':True,'current_request_unique_under_hypothesis':True};why=cfg['flow_question']+' Experiment: '+reason+'.'
        return {'status':'proposed','kind':'typed_material_flow','proposal_id':ref,'material_flow_plan':plan,'actions':[action],'steps':[{'action':action,'expected_after':None}],'facts':facts,'compositions':[{'id':ref,'observed':False,'open_question':why,'properties':{'roles':cfg['flow_roles']},'relations':['contributes_to:G_official_completion']}],'question':{'reason':reason,'hypothesis_refs':[model['source_ref']] if model else []},'route_refs':evidence,'binding':{'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':[action],'purpose':why,'preconditions':facts,'evidence':evidence,'outcome_guard':{'path':['value'],'contains':ref}}}
    def before(self,p,index,rows,**meta):
        plan=p.get('material_flow_plan')
        if not plan:return super().before(p,index,rows,**meta)
        ok=index==0 and (meta['epoch'],meta['score'],meta['observation_ref'])==(plan['epoch'],plan['score'],plan['observation_ref']) and identity(rows)==plan['frame_digest'] and 'ACTION6' in meta['available'] and p['actions'][0]==plan['action'] and [plan['action']['data']['x'],plan['action']['data']['y']]==plan['selected']['point']
        return {'admitted':ok,'reason':'current_descendant_request_and_point' if ok else 'material_flow_context_changed'}
    def after(self,p,index,rows,later,**meta):
        if not p.get('material_flow_plan'):return super().after(p,index,rows,later,**meta)
        return {'matched':None,'seal_prefix':True,'reason':'material_flow_response_requires_reconciliation','official_progress':meta['score']>p['material_flow_plan']['score']}
    def record(self,before,command,after,rows,later,proposal,index):
        events=super().record(before,command,after,rows,later,proposal,index);plan=proposal.get('typed_carrier_plan');flow=proposal.get('material_flow_plan');boundary=after['level_epoch']!=before['level_epoch'] or after['levels_completed']>before['levels_completed'];e=None
        if plan and (plan.get('contact_context') or {}).get('kind')=='produced_support' and not boundary:
            found=descendants(plan['contact_context'],rows,later,after)
            if found:e={'kind':'typed_material_flow','epoch':after['level_epoch'],'boundary':False,'added_children':found,'context':None,'effect':'replacement_activated_into_typed_occurrences','evidence':[before['observation_ref'],after['observation_ref']]}
        if flow:
            child=flow['child'];e={'kind':'typed_material_flow','epoch':after['level_epoch'],'boundary':boundary,'context':None,'effect':'unknown','evidence':[before['observation_ref'],after['observation_ref']],'stop_reason':'typed_material_response_unexplained'}
            if flow['mode']=='select' and not boundary and local_child_mark(child,rows,later):e.update(context={'child':child,'evidence':e['evidence']},effect='local_child_marking',stop_reason=None)
            elif flow['mode']=='deliver':
                x,y,r,b=flow['target']['bbox'];changed=any(rows[v][u]!=later[v][u]for v in range(y,b+1)for u in range(x,r+1))
                if boundary or (not child_present(child,later) and changed):
                    prior=self.flow_models.get(child['core_signature']);same=prior and prior['descriptor']==flow['target']['descriptor'];model={'core_signature':child['core_signature'],'descriptor':flow['target']['descriptor'],'acquired_epoch':prior['acquired_epoch']if same else before['level_epoch'],'validated_epoch':before['level_epoch'],'evidence':(prior['evidence']if same else [])+e['evidence'],'source_ref':prior['source_ref']if same else before['observation_ref'],'last_validation_ref':before['observation_ref'],'status':'conditional_material_to_request_association'};e.update(effect='material_consumed_and_request_changed' if not boundary else 'official_boundary_after_request',removed_children=[child['id']],filled=[] if boundary else [flow['target']['bbox']],model=model,stop_reason=None)
        if e:self.apply_event(e);events.append(e)
        return events
