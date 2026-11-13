"""An initial question about a measured marked carrier, preserving all uncertainty."""
from occurrence_recall_access import OccurrenceRecallAccess,input_candidates
from typed_carrier_scene import measure,replacement_candidate
from terminal_composition import identity
from collections import Counter

class TypedCarrierAccess(OccurrenceRecallAccess):
    def __init__(self):super().__init__();self.carrier_events=[];self.carrier_context=None;self.carrier_calibration=[]
    def retained_digest(self):return identity([super().retained_digest(),self.carrier_events,self.carrier_context,self.carrier_calibration])
    def apply_event(self,event):
        if event['kind']=='typed_carrier_response':
            self.carrier_events.append(event);self.carrier_context=event.get('contact_context')
            c=event['selected'];x,y,r,b=c['bbox'];size=[r-x+1,b-y+1]
            if c['marks'] and c.get('support_source','component')=='component' and not any(v['size']==size for v in self.carrier_calibration):self.carrier_calibration.append({'size':size,'evidence':event['evidence'],'status':'observed_body_extent'})
            if not self.carrier_context:self.requested_stop_reason='typed_carrier_effect_requires_reconciliation'
            return
        super().apply_event(event)
    def propose(self,episode,obs,rows,inputs,max_prefix,config):
        cfg=config.get('typed_carrier')
        if cfg and max_prefix and 'ACTION6' in obs['available_action_refs']:
            p=self.carrier_question(obs,rows,cfg)
            if p:return p
        return super().propose(episode,obs,rows,inputs,max_prefix,config)
    def carrier_question(self,obs,rows,cfg):
        cfg={**cfg,'observed_body_shapes':list(self.carrier_calibration)}
        reason='test_current_marked_carrier';context=self.carrier_context
        scene=measure(rows,obs,cfg)
        if not scene:
            if context and context.get('kind')=='produced_support':scene={'carriers':[],'source_ref':obs['observation_ref'],'frame_digest':identity(rows)}
            else:return None
        if context:
            if context['epoch']!=obs['level_epoch'] or context['frame_digest']!=identity(rows):return None
            if context.get('kind')=='produced_support':selected=context['selected'];reason='test_activation_of_observed_replacement'
            else:
                reference=context['selected'];profile=Counter(p[2] for p in reference['fringe']);matches=[c for c in scene['carriers'] if c['bbox']!=reference['bbox'] and Counter(p[2] for p in c['fringe'])==profile]
                if len(matches)!=1:return None
                selected=matches[0];reason='test_shared_outer_material_profile_after_local_marking'
        elif self.carrier_events:return None
        else:selected=min(scene['carriers'],key=lambda c:(c['center'][1],c['center'][0],c['signature']))
        action={'action_ref':'ACTION6','data':dict(zip(('x','y'),selected['point']))}
        plan={'epoch':obs['level_epoch'],'score':obs['levels_completed'],'observation_ref':obs['observation_ref'],'frame_digest':identity(rows),'scene':scene,'selected':selected,'action':action,'question':cfg['question'],'configuration':cfg,'contact_context':context,'reason':reason,'expected':'Unknown: local marking may represent selection. A shared outer pattern is a compatibility hypothesis, not a proven production law.'};ref='C_typed_carrier_'+identity(plan)[:20];facts={'marked_carriers_observed':True,'one_current_support_bound':True}
        detail='The new material support contains translated matches of removed typed substructures. Its activation effect is unknown.' if reason=='test_activation_of_observed_replacement' else 'Shared outer material counts leave connector geometry differences explicit; this is a compatibility experiment, not a pattern equality or production law.'
        why=cfg['question']+' Current experiment: '+reason+'. '+detail;evidence=[obs['observation_ref']]+(context['evidence'] if context else [])
        return {'status':'proposed','kind':'typed_carrier_experiment','proposal_id':ref,'typed_carrier_plan':plan,'actions':[action],'steps':[{'action':action,'expected_after':None}],'facts':facts,'compositions':[{'id':ref,'observed':False,'open_question':why,'properties':{'roles':cfg['roles']},'relations':['contributes_to:G_official_completion']}],'question':{'reason':reason,'hypothesis_refs':[]},'route_refs':evidence,'binding':{'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':[action],'purpose':why,'preconditions':facts,'evidence':evidence,'outcome_guard':{'path':['value'],'contains':ref}}}
    def before(self,p,index,rows,**meta):
        plan=p.get('typed_carrier_plan')
        if not plan:return super().before(p,index,rows,**meta)
        ok=index==0 and (meta['epoch'],meta['score'],meta['observation_ref'])==(plan['epoch'],plan['score'],plan['observation_ref']) and identity(rows)==plan['frame_digest'] and 'ACTION6' in meta['available'] and p['actions'][0]==plan['action'] and [plan['action']['data']['x'],plan['action']['data']['y']]==plan['selected']['point']
        return {'admitted':ok,'reason':'current_carrier_and_exact_point' if ok else 'carrier_context_or_payload_changed'}
    def after(self,p,index,rows,later,**meta):
        if not p.get('typed_carrier_plan'):return super().after(p,index,rows,later,**meta)
        return {'matched':None,'seal_prefix':True,'reason':'uncharacterized_carrier_response','official_progress':meta['score']>p['typed_carrier_plan']['score']}
    def record(self,before,command,after,rows,later,proposal,index):
        events=super().record(before,command,after,rows,later,proposal,index);plan=proposal.get('typed_carrier_plan')
        if not plan:return events
        changed=[[x,y,a,later[y][x]] for y,row in enumerate(rows) for x,a in enumerate(row) if a!=later[y][x]]
        next_scene=measure(later,after,plan['configuration']);x,y,r,b=plan['selected']['bbox'];margin=max(r-x+1,b-y+1)/2;preserved=next_scene and len(next_scene['carriers'])==len(plan['scene']['carriers']) and all(any(c['bbox']==q['bbox'] and c['signature']==q['signature'] and c['body_palette']==q['body_palette'] for c in next_scene['carriers']) for q in plan['scene']['carriers']);local=changed and all(x-margin<=u<=r+margin and y-margin<=v<=b+margin and not(x<=u<=r and y<=v<=b) for u,v,_,_ in changed);context=None
        if preserved and local and before['level_epoch']==after['level_epoch'] and not plan['contact_context']:
            context={'kind':'local_marking','selected':plan['selected'],'epoch':after['level_epoch'],'frame_digest':identity(later),'evidence':[before['observation_ref'],after['observation_ref']],'status':'local_marking_selection_hypothesis'}
        replacement=None
        if plan['contact_context'] and plan['contact_context'].get('kind')=='local_marking' and before['level_epoch']==after['level_epoch']:
            replacement=replacement_candidate(plan['scene'],later,after,plan['configuration'])
            if replacement:context={**replacement,'kind':'produced_support','epoch':after['level_epoch'],'frame_digest':identity(later)}
        event={'kind':'typed_carrier_response','selected':plan['selected'],'command':command,'changed_public_pixels':changed,'before_epoch':before['level_epoch'],'after_epoch':after['level_epoch'],'official_progress':after['levels_completed']>before['levels_completed'],'evidence':[before['observation_ref'],after['observation_ref']],'contact_context':context,'measured_core_bodies_preserved':bool(preserved),'local_external_marking':bool(local),'scope':'Local marking leaves selection hypothetical; the next shared-pattern contact is a discriminating experiment. Any other material effect remains uncharacterized.'};self.apply_event(event);return events+[event]
