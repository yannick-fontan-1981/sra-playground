"""Experimental access to a covering trace on a measured cell support."""
import copy
from labeled_sequence_access import LabeledSequenceAccess,input_candidates
from trace_field_observation import measure,center,ring_matches
from trace_field_methods import construct
from terminal_composition import identity

def command(g,cell):return {'action_ref':'ACTION6','data':dict(zip(('x','y'),center(g,cell)))}

def local_effect(scene,source,target,before,after):
    g=scene['geometry'];mark=scene['head']
    if not ring_matches(after,g,mark,target):return False
    a=center(g,source);b=center(g,target);half=(g['pitch']-2)//2
    bounds=[min(a[0],b[0])-half,min(a[1],b[1])-half,max(a[0],b[0])+half,max(a[1],b[1])+half]
    l,t,r,bottom=g['bbox']
    if any(before[y][x]!=after[y][x]and not(bounds[0]<=x<=bounds[2]and bounds[1]<=y<=bounds[3])for y in range(t,bottom+1)for x in range(l,r+1)):return False
    if ring_matches(after,g,mark,source):return False
    return True

class TraceFieldAccess(LabeledSequenceAccess):
    def __init__(self):super().__init__();self.trace_state=None;self.trace_events=[]
    def retained_digest(self):return identity([super().retained_digest(),self.trace_state,self.trace_events])
    def apply_event(self,e):
        if e['kind']=='observed_trace_extension':self.trace_state=e['state'];self.trace_events.append(e);return
        super().apply_event(e)
    def propose(self,episode,obs,rows,inputs,max_prefix,config):
        cfg=config.get('trace_field_question')
        old=self.trace_state if self.trace_state and self.trace_state['epoch']==obs['level_epoch']else None
        scene=measure(rows,old['geometry']if old else None)if cfg else None
        if not scene or not max_prefix or'ACTION6'not in obs['available_action_refs']:return super().propose(episode,obs,rows,inputs,max_prefix,config)
        state=old if old and old['geometry_ref']==scene['geometry_ref']else {'epoch':obs['level_epoch'],'geometry':scene['geometry'],'geometry_ref':scene['geometry_ref'],'successes':[],'failures':[],'evidence':[]}
        estimate=construct(scene,obs,config['remaining_level_actions'],config['level_deadline'])
        if not estimate:return {'status':'abstained','reason':'experimental_trace_has_no_bounded_cover_in_measured_graph'}
        suffix=estimate['path'][len(scene['prefix']):]
        if not suffix:return {'status':'abstained','reason':'experimental_trace_complete_official_terminal_unknown'}
        learned=not state['failures']and len({tuple(e['source']+e['target'])for e in state['successes']})>=2
        actions=[];steps=[];source=scene['head']['cell'];prefix=copy.deepcopy(scene['prefix'])
        for target in suffix[:max_prefix if learned else 1]:
            cmd=command(scene['geometry'],target)
            if any(e['frame_digest']==identity(rows)and e['command']==cmd for e in state['failures']):break
            actions.append(cmd);steps.append({'action':cmd,'source':source,'target':target,'prefix_before':copy.deepcopy(prefix),'relation_observed':learned,'expected_after':None});prefix.append(target);source=target
        if not actions:return {'status':'abstained','reason':'trace_command_refuted_in_exact_context'}
        plan={'epoch':obs['level_epoch'],'score':obs['levels_completed'],'observation_ref':obs['observation_ref'],'frame_digest':identity(rows),'scene':scene,'state':copy.deepcopy(state),'commands':copy.deepcopy(actions),'estimate':estimate,'scope':'A simple covering trace ending at the other mark is an experimental target. Geometry, point effect and terminal role remain independently falsifiable.'}
        ref='C_trace_'+identity(plan)[:20];why=cfg['question'];facts={'measured_cell_domain':True,'simple_cover_is_declared_experimental_target':True,'official_terminal_law_unknown':True}
        return {'status':'proposed','kind':'trace_field_experiment','trace_field_plan':plan,'proposal_id':ref,'actions':actions,'steps':steps,'facts':facts,'compositions':[{'id':ref,'observed':False,'open_question':why,'properties':{'roles':cfg['roles']},'relations':['contributes_to:G_official_completion']}],'question':{'reason':why,'hypothesis_refs':state['evidence'][-16:]},'route_refs':[obs['observation_ref']],'binding':{'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':actions,'purpose':why,'preconditions':facts,'evidence':[obs['observation_ref']]+state['evidence'][-16:],'outcome_guard':{'path':['value'],'contains':ref}}}
    def before(self,p,index,rows,**meta):
        plan=p.get('trace_field_plan')
        if not plan:return super().before(p,index,rows,**meta)
        ok=(meta['epoch'],meta['score'])==(plan['epoch'],plan['score'])and p['actions']==plan['commands']and p['bundle_template']['actions']==plan['commands']and 0<=index<len(p['steps'])and'ACTION6'in meta['available']
        if ok:
            step=p['steps'][index];ok=p['actions'][index]==command(plan['scene']['geometry'],step['target'])and ring_matches(rows,plan['scene']['geometry'],plan['scene']['head'],step['source'])
        if index==0:ok=ok and meta['observation_ref']==plan['observation_ref']and identity(rows)==plan['frame_digest']
        return {'admitted':bool(ok),'reason':'trace_current_head_and_point_bound'if ok else'trace_binding_or_payload_changed'}
    def after(self,p,index,rows,later,**meta):
        plan=p.get('trace_field_plan')
        if not plan:return super().after(p,index,rows,later,**meta)
        step=p['steps'][index];progress=meta['score']>plan['score'];boundary=meta['epoch']!=plan['epoch']
        matched=None if boundary else local_effect(plan['scene'],step['source'],step['target'],rows,later)
        if matched and plan['scene']['trace_value']is not None:
            a=center(plan['scene']['geometry'],step['source']);b=center(plan['scene']['geometry'],step['target'])
            matched=later[(a[1]+b[1])//2][(a[0]+b[0])//2]==plan['scene']['trace_value']
        return {'matched':matched,'seal_prefix':progress or boundary or matched is not True or not step['relation_observed'],'official_progress':progress,'reason':'trace_local_extension_projection_matched'if matched else'trace_effect_requires_reconciliation','scope':'Ring relocation and locality inside the measured support. Changes outside this support remain unknown, not certified inert.'}
    def record(self,before,cmd,after,rows,later,proposal,index):
        events=super().record(before,cmd,after,rows,later,proposal,index)
        plan=proposal.get('trace_field_plan')
        if not plan:return events
        if cmd!=plan['commands'][index]:raise ValueError('trace receipt differs from committed command')
        state=copy.deepcopy(self.trace_state if self.trace_state and self.trace_state['epoch']==plan['epoch']else plan['state']);step=proposal['steps'][index]
        boundary=after['level_epoch']!=before['level_epoch']or after['levels_completed']>before['levels_completed']
        outcome='official_boundary'if boundary else'local_extension_observed'if local_effect(plan['scene'],step['source'],step['target'],rows,later)else'projection_refuted'
        if outcome=='local_extension_observed':
            projected=measure(later,state['geometry'])
            if not projected or projected['prefix']!=step['prefix_before']+[step['target']]:outcome='ordered_trace_projection_refuted'
        l,t,r,b=plan['scene']['geometry']['bbox'];outside=sum(rows[y][x]!=later[y][x]for y in range(len(rows))for x in range(len(rows[y]))if not(l<=x<=r and t<=y<=b))
        evidence={'source':step['source'],'target':step['target'],'command':cmd,'before_ref':before['observation_ref'],'after_ref':after['observation_ref'],'frame_digest':identity(rows),'outcome':outcome,'outside_support_changed_pixels':outside,'outside_support_effect_role':'unknown'}
        if outcome=='local_extension_observed':state['successes'].append(evidence)
        elif not boundary:state['failures'].append(evidence)
        state['evidence'].append(after['observation_ref']);event={'kind':'observed_trace_extension','state':state,'transition':evidence,'scope':'Current epoch only; prior geometry or point law grants no authority in a new epoch.'};self.apply_event(event);return events+[event]
