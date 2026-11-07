"""A single bounded control question on a measured nested compact motif."""
from radial_ports_access import RadialPortsAccess,input_candidates
from geometric_observer import components,framed_patterns
from terminal_composition import identity
class NestedControlAccess(RadialPortsAccess):
    def __init__(self):super().__init__();self.nested_events=[]
    def retained_digest(self):return identity([super().retained_digest(),self.nested_events])
    def apply_event(self,e):
        if e['kind']=='nested_control_response':
            self.nested_events.append(e)
            if e.get('disposition')!='local_no_visible_effect':self.requested_stop_reason='nested_control_effect_requires_composition'
            return
        super().apply_event(e)
    def propose(self,episode,obs,rows,inputs,max_prefix,config):
        previous=super().propose(episode,obs,rows,inputs,max_prefix,config)
        if previous and previous.get('status')=='proposed':return previous
        cfg=config.get('nested_control_question')
        if not cfg or max_prefix<1 or'ACTION6'not in obs['available_action_refs']:return previous
        proposal=self.nested_question(obs,rows,cfg)
        if proposal:
            plan=proposal['nested_control_plan'];plan['no_visible_effect_contract']=cfg.get('no_visible_effect_contract')
            refusal=self.nested_refusal(obs,rows)
            if refusal and identity(refusal['selected'])==identity(plan['selected']) and refusal['command']==plan['action']:return previous
        return proposal or previous
    def nested_refusal(self,obs,rows):
        for event in reversed(self.nested_events):
            if event.get('disposition')=='local_no_visible_effect' and (event['epoch'],event['score'],event['frame_digest'])==(obs['level_epoch'],obs['levels_completed'],identity(rows)):
                return event
        return None
    def nested_question(self,obs,rows,cfg):
        if cfg.get('selection_order')!='unique_minimum_measured_enclosure_area':return None
        matches=[]
        for p in framed_patterns(rows,components(rows)):
            l,t,r,b=p['bbox'];w,h=r-l+1,b-t+1
            if w!=h or w>min(len(rows),len(rows[0]))*cfg['maximum_extent_fraction']or len(p['mask'])!=1 or p['foreground_area']<cfg['minimum_core_area']:continue
            if p['foreground_area']!=p['scale']**2:continue
            x,y=p['center']
            if rows[y][x]!=p['color']:continue
            matches.append({'frame_ref':p['id'],'bbox':p['bbox'],'point':p['center'],'core_area':p['foreground_area'],'core_scale':p['scale'],'core_palette':p['color']})
        if not matches:return None
        minimum=min((p['bbox'][2]-p['bbox'][0]+1)**2 for p in matches);smallest=[p for p in matches if(p['bbox'][2]-p['bbox'][0]+1)**2==minimum]
        if len(smallest)!=1:return None
        selected=smallest[0];action={'action_ref':'ACTION6','data':dict(zip(('x','y'),selected['point']))};plan={'epoch':obs['level_epoch'],'score':obs['levels_completed'],'observation_ref':obs['observation_ref'],'frame_digest':identity(rows),'selected':selected,'alternative_enclosures':[p for p in matches if p!=selected],'action':action,'expected_effect':'unknown','scope':'Unique smallest measured compact two-value enclosure; other enclosures retain unknown roles. Action semantics and distant effects unconfirmed.'};ref='C_nested_'+identity(plan)[:20];facts={'unique_smallest_measured_nested_compact_motif':True,'point_on_current_core':True};why=cfg['question']
        return {'status':'proposed','kind':'nested_control_experiment','proposal_id':ref,'nested_control_plan':plan,'actions':[action],'steps':[{'action':action,'expected_after':None}],'facts':facts,'compositions':[{'id':ref,'observed':False,'open_question':why,'properties':{'roles':cfg['roles']},'relations':['contributes_to:G_official_completion']}],'question':{'reason':'test_unique_nested_compact_motif','hypothesis_refs':[]},'route_refs':[obs['observation_ref']],'binding':{'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':[action],'purpose':why,'preconditions':facts,'evidence':[obs['observation_ref']],'outcome_guard':{'path':['value'],'contains':ref}}}
    def before(self,p,index,rows,**meta):
        plan=p.get('nested_control_plan')
        if not plan:return super().before(p,index,rows,**meta)
        point=plan['selected']['point'];ok=index==0 and(meta['epoch'],meta['score'],meta['observation_ref'])==(plan['epoch'],plan['score'],plan['observation_ref'])and identity(rows)==plan['frame_digest']and'ACTION6'in meta['available']and p['actions'][0]=={'action_ref':'ACTION6','data':dict(zip(('x','y'),point))}
        return {'admitted':ok,'reason':'current_nested_core_exact_point'if ok else'nested_context_or_payload_changed'}
    def after(self,p,index,rows,later,**meta):
        plan=p.get('nested_control_plan')
        if not plan:return super().after(p,index,rows,later,**meta)
        return {'matched':None,'seal_prefix':True,'reason':'unknown_control_response_observed','official_progress':meta['score']>plan['score']}
    def record(self,before,command,after,rows,later,proposal,index):
        events=super().record(before,command,after,rows,later,proposal,index);plan=proposal.get('nested_control_plan')
        if not plan:return events
        diff=[(x,y)for y in range(len(rows))for x in range(len(rows[0]))if rows[y][x]!=later[y][x]];l,t,r,b=plan['selected']['bbox'];inside=sum(l<=x<=r and t<=y<=b for x,y in diff);bounds=[min(x for x,y in diff),min(y for x,y in diff),max(x for x,y in diff),max(y for x,y in diff)]if diff else None
        event={'kind':'nested_control_response','evidence':[before['observation_ref'],after['observation_ref']],'selected':plan['selected'],'command':command,'changed_pixels':len(diff),'changed_inside_control':inside,'changed_outside_control':len(diff)-inside,'changed_bbox':bounds,'same_epoch':before['level_epoch']==after['level_epoch'],'official_progress':after['levels_completed']>before['levels_completed'],'interpretation':'unknown; local and distant effects are measured separately; no law or quantity inferred'}
        contract=plan.get('no_visible_effect_contract')
        if contract and contract.get('disposition')=='local_no_visible_effect' and not diff and event['same_epoch'] and not event['official_progress']:
            event.update(disposition='local_no_visible_effect',epoch=after['level_epoch'],score=after['levels_completed'],frame_digest=identity(later),origin_observation_ref=before['observation_ref'],reply_observation_ref=after['observation_ref'],contract=contract,selection_acquired=False,impossibility_acquired=False)
        self.apply_event(event);return events+[event]
