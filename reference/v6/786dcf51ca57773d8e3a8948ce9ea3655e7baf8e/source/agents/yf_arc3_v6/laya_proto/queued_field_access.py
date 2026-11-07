"""Activate existing queue/cascade mechanics through observed control effects."""
from occluded_catalogue_access import OccludedCatalogueAccess,input_candidates
from queued_field_observation import measure,board
from queued_field_models import acquire,active_member_count,portable_hypothesis
from queued_field_search import choose
from queued_field_methods import receipt
from terminal_composition import identity


def grid(rows,geometry):
    x0,y0=geometry['origin'];nx,ny=geometry['shape'];w,h=geometry['size'];dx,dy=geometry['pitch'];out=[]
    for j in range(ny):
        line=[]
        for i in range(nx):
            values={rows[y][x]for y in range(y0+j*dy,y0+j*dy+h)for x in range(x0+i*dx,x0+i*dx+w)}
            if len(values)!=1:return None
            line.append(next(iter(values)))
        out.append(line)
    return out


class QueuedFieldAccess(OccludedCatalogueAccess):
    def __init__(self):super().__init__();self.queue_state=None;self.queue_events=[];self.queue_pending=None
    def retained_digest(self):return identity([super().retained_digest(),self.queue_state,self.queue_events])
    def apply_event(self,e):
        if e['kind']=='observed_queue_field_model':self.queue_state=e['state'];self.queue_events.append(e);return
        super().apply_event(e)
    def propose(self,episode,obs,rows,inputs,max_prefix,config):
        cfg=config.get('queued_field_question');prior=self.queue_state if self.queue_state and self.queue_state.get('epoch')==obs['level_epoch']else None
        scene=measure(rows,prior['geometry']if prior else None,active_member_count(prior))if cfg else None
        if not scene or not scene['mark']or not max_prefix:return super().propose(episode,obs,rows,inputs,max_prefix,config)
        key=identity([obs['level_epoch'],scene['geometry']]);state=self.queue_state if self.queue_state and self.queue_state['key']==key else None
        portable=portable_hypothesis(self.queue_state,scene,obs)if state is None and cfg.get('reuse_prior_relations')else None
        if portable:state=portable
        if not state and not scene['preview_alternatives']:return super().propose(episode,obs,rows,inputs,max_prefix,config)
        controls=state.get('controls',{})if state else {};available=sorted({a['action_ref']for a in inputs if not a.get('data')})
        moves={v['delta']for v in controls.values()if v['kind']=='translate'}
        cycles=[v for v in controls.values()if v['kind']=='reorder'and len(v['permutations'])==1]
        complete=state and'empty'in state and'gravity'in state and any(v['kind']=='receive'for v in controls.values())and(cycles or len(set(scene['mark']['values']))==1)and any(x<0 for x in moves)and any(x>0 for x in moves)
        estimate=None
        if complete:
            estimate=choose(scene,state,min(config['remaining_level_actions'],max_prefix if max_prefix<16 else config['remaining_level_actions']),config['level_deadline'],cfg['node_bound'],cfg['depth_bound'])
            if estimate:
                actions=estimate['actions'];why=cfg['transfer_question']if portable else cfg['composition_question'];mode='prepare_and_receive'
                estimate['mechanical_receipt']=receipt(obs,estimate['placed'],estimate['model_alternatives'][0],state['evidence'])
            else:return {'status':'abstained','reason':'queue_domain_or_bound_has_no_admitted_composition'}
        else:
            ambiguous=[a for a,v in controls.items()if v['kind']=='reorder'and len(v['permutations'])>1 and a in available]
            untried=[a for a in available if a not in controls]
            choices=[a for a in(ambiguous or untried)if not state or identity([scene['grid'],scene['mark']['column'],{'action_ref':a}])not in state.get('attempts',[])]
            if not choices:return {'status':'abstained','reason':'queue_control_applicability_unknown'}
            actions=[{'action_ref':choices[0]}];why=cfg['acquisition_question'];mode='control_experiment'
        expected=[list(r)for r in scene['grid']];values=list(scene['mark']['values']);column=scene['mark']['column'];steps=[]
        for command in actions:
            before_grid=[list(r)for r in expected];before_column=column;law=controls.get(command['action_ref']);after_grid=None
            if law and law['kind']in('translate','reorder')and'empty'in state:
                for y in scene['mark']['rows']:expected[y][column]=state['empty']
                if law['kind']=='translate':column+=law['delta']
                elif len(law['permutations'])==1:values=[values[i]for i in law['permutations'][0]]
                else:law=None
                if law:
                    for y,value in zip(scene['mark']['rows'],values):expected[y][column]=value
                    after_grid=[list(r)for r in expected]
            steps.append({'action':command,'controlled_column_before':before_column,'expected_before_grid':before_grid,'expected_after_grid':after_grid,'expected_after':None})
        plan={'epoch':obs['level_epoch'],'score':obs['levels_completed'],'observation_ref':obs['observation_ref'],'frame_digest':identity(rows),'geometry':scene['geometry'],'mode':mode,'scene':scene,'commands':[dict(a)for a in actions],'estimate':estimate,'model_digest':identity(state),'scope':'Current control effects and received phases support conditional queue compositions; terminal quota and unseen line relations remain unknown.'}
        plan['portable_model']=portable
        plan['active_control_model']={k:state[k]for k in('controls','empty','key')if state and k in state}
        ref='C_queue_'+identity(plan)[:20];facts={'public_repeated_cells_and_active_envelope':True,'current_available_inputs':all(a['action_ref']in obs['available_action_refs']for a in actions),'bounded_conditional_composition':True}
        return {'status':'proposed','kind':'queued_field_experiment','queued_field_plan':plan,'proposal_id':ref,'actions':actions,'steps':steps,'facts':facts,'compositions':[{'id':ref,'observed':False,'open_question':why,'properties':{'roles':cfg['roles']},'relations':['contributes_to:G_official_completion']}],'question':{'reason':why,'hypothesis_refs':[]},'route_refs':[obs['observation_ref']],'binding':{'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':actions,'purpose':why,'preconditions':facts,'evidence':[obs['observation_ref']]+(state['evidence'][-16:]if state else[]),'outcome_guard':{'path':['value'],'contains':ref}}}
    def before(self,p,index,rows,**meta):
        plan=p.get('queued_field_plan')
        if not plan:return super().before(p,index,rows,**meta)
        ok=(meta['epoch'],meta['score'])==(plan['epoch'],plan['score'])and p['actions']==plan['commands']and p['bundle_template']['actions']==plan['commands']and 0<=index<len(p['steps'])
        ok=ok and p['actions'][index]['action_ref']in meta['available']and grid(rows,plan['geometry'])==p['steps'][index]['expected_before_grid']
        current=plan.get('active_control_model',self.queue_state or{});law=current.get('controls',{}).get(p['actions'][index]['action_ref'])
        if ok and law and law['kind']=='translate'and'empty'in current:
            column=p['steps'][index].get('controlled_column_before',plan['scene']['mark']['column']);dest=column+law['delta'];g=grid(rows,plan['geometry'])
            ok=0<=dest<len(g[0])and all(g[y][dest]==current['empty']for y in plan['scene']['mark']['rows'])
        if index==0:ok=ok and meta['observation_ref']==plan['observation_ref']and identity(rows)==plan['frame_digest']
        return {'admitted':bool(ok),'reason':'current_queue_composition_bound'if ok else'queue_premise_or_payload_changed'}
    def after(self,p,index,rows,later,**meta):
        plan=p.get('queued_field_plan')
        if not plan:return super().after(p,index,rows,later,**meta)
        progressed=meta['score']>plan['score'];expected=p['steps'][index]['expected_after_grid'];actual=grid(later,plan['geometry'])if meta['epoch']==plan['epoch']else None;matched=None if expected is None else actual==expected
        # Preparation must not change a distant UI/field outside the measured lattice.
        x,y=plan['geometry']['origin'];nx,ny=plan['geometry']['shape'];dx,dy=plan['geometry']['pitch'];w,h=plan['geometry']['size']
        outside=any(rows[j][i]!=later[j][i]for j in range(len(rows))for i in range(len(rows[j]))if not(x-(dx-w)<=i<x+nx*dx and y-(dy-h)<=j<y+ny*dy))
        if expected is not None and outside:matched=False
        return {'matched':matched,'seal_prefix':progressed or meta['epoch']!=plan['epoch']or expected is None or matched is False,'reason':'queue_preparation_matched'if matched else'queue_receipt_or_divergence_requires_reconciliation','official_progress':progressed}
    def record(self,before,command,after,rows,later,proposal,index):
        portable=proposal.get('queued_field_plan',{}).get('portable_model')
        if self.queue_state and self.queue_state.get('epoch')==before['level_epoch']:portable=None
        self.queue_pending=(before,after,command,rows,later,portable)
        return super().record(before,command,after,rows,later,proposal,index)
    def record_packet(self,before,command,after,rows,frames,episode):
        events=super().record_packet(before,command,after,rows,frames,episode)
        if self.queue_pending and self.queue_pending[0]['observation_ref']==before['observation_ref']:
            b,a,c,r,l,portable=self.queue_pending;state=acquire(portable or self.queue_state,b,a,c,r,l,frames)
            if state is not None:
                e={'kind':'observed_queue_field_model','state':state,'evidence':[b['observation_ref'],a['observation_ref']],'packet_images_consumed':len(frames),'scope':'Public reception and preparation measured; retained closure alternatives are conditional, not a universal law.'};self.apply_event(e);events.append(e)
        self.queue_pending=None
        return events
