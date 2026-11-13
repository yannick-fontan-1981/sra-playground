"""Recall a public rotation method, then test a constrained port composition."""
import json,hashlib
from pathlib import Path
from typed_pose_access import TypedPoseAccess,input_candidates
from radial_ports_observation import measure,at_geometry,assembly_model,selected_occurrence,rotate
from common_port_assembly import assembly
from terminal_composition import identity
class RadialPortsAccess(TypedPoseAccess):
    def __init__(self):
        super().__init__();self.port_events=[];self.port_prior=None;self.port_point_rule=None;self.port_pending=[];self.port_rejected=[]
    def retained_digest(self):return identity([super().retained_digest(),self.port_events,self.port_prior,self.port_point_rule,self.port_rejected])
    def apply_event(self,e):
        if e['kind']=='radial_method_recall':self.port_prior=e['method'];self.port_events.append(e);return
        if e['kind']=='radial_port_effect':
            self.port_events.append(e)
            if e.get('rule'):self.port_point_rule=e['rule']
            if e.get('refuted'):self.port_point_rule=None;self.port_rejected.append(e['context'])
            return
        super().apply_event(e)
    def propose(self,episode,obs,rows,inputs,max_prefix,config):
        prior=super().propose(episode,obs,rows,inputs,max_prefix,config)
        if prior and prior.get('status')=='proposed':return prior
        cfg=config.get('radial_port_composition')
        if not cfg or max_prefix<1 or 'ACTION6'not in obs['available_action_refs']:return prior
        scene=measure(rows)
        if not scene:return prior
        if self.port_prior is None and cfg.get('use_prior_method',True):
            p=Path(cfg['method_memory_path']);raw=p.read_bytes()
            if hashlib.sha256(raw).hexdigest()!=cfg['method_memory_sha256']:raise ValueError('Radial method memory bytes changed')
            method=json.loads(raw)
            if method.get('status')!='public_relation_observed' or len(method.get('evidence',[]))<2:return prior
            e={'kind':'radial_method_recall','method':method,'current_ref':obs['observation_ref'],'status':'conditional_structural_recall_no_action_authority'};self.apply_event(e);self.port_pending.append(e)
        if self.port_prior is None and not cfg.get('allow_initial_experiment'):return prior
        sign=self.port_point_rule['turn']if self.port_point_rule else self.port_prior['turn']if self.port_prior else 0
        m,current=assembly_model(scene);target=assembly(m,current,None,sign)
        if target is None:return prior
        context=identity([obs['level_epoch'],scene])
        if context in self.port_rejected:return prior
        known=self.port_point_rule and self.port_point_rule['epoch']==obs['level_epoch'] and self.port_point_rule['geometry_ref']==scene['geometry_ref']
        steps=[];expected=[c['ports']for c in scene['cells']];limit=max_prefix if known else 1
        for i,pose in enumerate(target):
            count=(pose[0]*sign)%4 if sign else min(pose[0],(-pose[0])%4)
            for _ in range(count):
                if len(steps)>=limit:break
                cell=scene['cells'][i];command={'action_ref':'ACTION6','data':dict(zip(('x','y'),cell['point']))};before=[list(p)for p in expected];expected[i]=rotate(expected[i],sign or 1)
                steps.append({'action':command,'cell':i,'ports_before':before,'ports_after':[list(p)for p in expected]if sign else None,'candidate_turns':[sign]if sign else [0,1,2,3],'expected_after':None,'prediction_status':'conditional_point_method'if known else 'unconfirmed_point_binding_to_recalled_rotation'if sign else 'unknown_point_effect_rotation_candidates_only'})
            if len(steps)>=limit:break
        if not steps:return prior
        prior_evidence=self.port_prior['evidence']if self.port_prior else []
        plan={'epoch':obs['level_epoch'],'score':obs['levels_completed'],'observation_ref':obs['observation_ref'],'frame_digest':identity(rows),'scene':scene,'steps':steps,'context':context,'sign':sign,'point_method_revalidated':bool(known),'search_nodes':m['search_nodes'],'prior_evidence':prior_evidence,'goal_status':'closed_connected_acyclic_composition_hypothesis_official_terminal_unknown'}
        ref='C_ports_'+identity(plan)[:20];actions=[s['action']for s in steps];facts={'measured_repeated_radial_supports':True,'finite_pose_domains':True,'unresolved_point_method_or_current_conditional_method':True};why=cfg['question'];evidence=[obs['observation_ref']]+[x['after_ref']for x in prior_evidence]
        return {'status':'proposed','kind':'radial_port_composition','proposal_id':ref,'radial_port_plan':plan,'actions':actions,'steps':steps,'facts':facts,'compositions':[{'id':ref,'observed':False,'open_question':why,'properties':{'roles':cfg['roles']},'relations':['contributes_to:G_official_completion']}],'question':{'reason':'conditional_port_assembly'if known else 'test_point_binding_of_recalled_rotation' if sign else 'initial_radial_interface_experiment','hypothesis_refs':[identity(self.port_prior)] if self.port_prior else []},'route_refs':evidence,'binding':{'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':actions,'purpose':why,'preconditions':facts,'evidence':evidence,'outcome_guard':{'path':['value'],'contains':ref}}}
    def before(self,p,index,rows,**meta):
        plan=p.get('radial_port_plan')
        if not plan:return super().before(p,index,rows,**meta)
        scene=at_geometry(rows,plan['scene']);step=plan['steps'][index]
        ok=bool(scene)and(meta['epoch'],meta['score'])==(plan['epoch'],plan['score'])and'ACTION6'in meta['available']and p['actions'][index]==step['action']and[c['ports']for c in scene['cells']]==step['ports_before']
        point=plan['scene']['cells'][step['cell']]['point'];ok=ok and p['actions'][index]=={'action_ref':'ACTION6','data':dict(zip(('x','y'),point))}
        if index==0:ok=ok and identity(rows)==plan['frame_digest']and meta['observation_ref']==plan['observation_ref']
        return {'admitted':bool(ok),'reason':'bound_observed_support_and_conditional_ports'if ok else 'port_context_or_payload_changed'}
    def after(self,p,index,rows,later,**meta):
        plan=p.get('radial_port_plan')
        if not plan:return super().after(p,index,rows,later,**meta)
        if meta['epoch']!=plan['epoch']or meta['score']>plan['score']:return {'matched':None,'seal_prefix':True,'reason':'official_boundary_terminal_cause_not_inferred','official_progress':True}
        scene=at_geometry(later,plan['scene']);step=plan['steps'][index]
        if step['ports_after']is None:return {'matched':None,'seal_prefix':True,'reason':'unknown_point_effect_observed_for_acquisition','official_progress':False}
        matched=bool(scene)and[c['ports']for c in scene['cells']]==step['ports_after'];cell=plan['scene']['cells'][step['cell']];l,t,r,b=cell['bbox'];outside=sum(rows[y][x]!=later[y][x]for y in range(len(rows))for x in range(len(rows[0]))if not(l<=x<=r and t<=y<=b))
        return {'matched':matched,'seal_prefix':not matched or not plan['point_method_revalidated']or outside>0,'reason':'ports_matched_extra_pixels_unexplained'if matched and outside else 'conditional_ports_matched'if matched else 'conditional_ports_refuted','outside_changed_pixels':outside,'official_progress':False}
    def record(self,before,command,after,rows,later,proposal,index):
        plan=proposal.get('radial_port_plan')
        events=super().record(before,command,after,rows,later,proposal,index)
        if not plan:return events
        events+=self.port_pending;self.port_pending=[]
        if after['level_epoch']!=before['level_epoch']:return events
        scene=at_geometry(later,plan['scene']);step=plan['steps'][index];selected=selected_occurrence(later,scene)if scene else None;i=step['cell']
        unchanged=bool(scene)and all(c['ports']==step['ports_before'][j]for j,c in enumerate(scene['cells'])if j!=i)
        turns=[k for k in (1,2,3)if rotate(step['ports_before'][i],k)==scene['cells'][i]['ports']]if unchanged else []
        matched=bool(scene)and[c['ports']for c in scene['cells']]==step['ports_after']if step['ports_after']is not None else None
        rule={'action_ref':command['action_ref'],'turn':turns[0],'geometry_ref':plan['scene']['geometry_ref'],'epoch':after['level_epoch'],'status':'conditional_observed_point_method','evidence':[before['observation_ref'],after['observation_ref']]}if len(turns)==1 and selected and selected['index']==i else None
        event={'kind':'radial_port_effect','rule':rule,'refuted':matched is False or (matched is None and rule is None),'context':plan['context'],'evidence':[before['observation_ref'],after['observation_ref']],'ports_prediction_matched':matched,'selection_observed':selected is not None,'goal_terminal_status':'unknown'};self.apply_event(event);return events+[event]
