"""Activate finite coverage as an experiment over measured public factors."""
import copy
from queued_field_access import QueuedFieldAccess,input_candidates
from product_panel_observation import measure
from product_panel_methods import compile_routes
from terminal_composition import identity

def current(rows,geometry):
    return [rows[(t+b)//2][(l+r)//2]for l,t,r,b in geometry['controls']]

def command_for(control):return {'action_ref':'ACTION6','data':dict(zip(('x','y'),control['point']))}

class ProductPanelAccess(QueuedFieldAccess):
    def __init__(self):super().__init__();self.product_state=None;self.product_events=[]
    def retained_digest(self):return identity([super().retained_digest(),self.product_state,self.product_events])
    def apply_event(self,e):
        if e['kind']=='observed_factor_product':self.product_state=e['state'];self.product_events.append(e);return
        super().apply_event(e)
    def propose(self,episode,obs,rows,inputs,max_prefix,config):
        cfg=config.get('factor_product_question');scene=measure(rows)if cfg else None
        if not scene or not max_prefix or 'ACTION6'not in obs['available_action_refs']:return super().propose(episode,obs,rows,inputs,max_prefix,config)
        state=self.product_state if self.product_state and self.product_state['epoch']==obs['level_epoch']and self.product_state['geometry_ref']==scene['geometry_ref']else {'epoch':obs['level_epoch'],'geometry_ref':scene['geometry_ref'],'visited':[scene['current']],'edges':[],'evidence':[],'counterexamples':[]}
        unknown=[i for i in range(len(scene['controls']))if not any(e['factor']==i for e in state['edges'])]
        estimate=None
        if unknown:indices=[unknown[0]];why=cfg['control_question']
        else:
            estimate=compile_routes(scene,state,obs,config['remaining_level_actions'],config['level_deadline'],cfg['max_factors'])
            if not estimate or not estimate['indices']:return {'status':'abstained','reason':'factor_product_has_no_supported_bounded_route'}
            indices=estimate['indices'][:max_prefix];why=cfg['coverage_question']
        actions=[];steps=[];values=list(scene['current'])
        for i in indices:
            action=command_for(scene['controls'][i]);expected=None
            if estimate:
                cycle=[int(v)for v in estimate['factors'][i]];expected=list(values);expected[i]=cycle[(cycle.index(values[i])+1)%len(cycle)]
            acquired=expected is not None and any(e['factor']==i and e['from']==values[i]and e['to']==expected[i]for e in state['edges'])
            actions.append(action);steps.append({'action':action,'factor':i,'before_values':list(values),'after_values':expected,'relation_observed':acquired,'expected_after':None})
            if not acquired:break
            values=expected
        plan={'epoch':obs['level_epoch'],'score':obs['levels_completed'],'observation_ref':obs['observation_ref'],'frame_digest':identity(rows),'scene':scene,'commands':copy.deepcopy(actions),'state_digest':identity(state),'estimate':estimate,'scope':'Experimental coverage of measured catalogue; cycle order and independence conditional. Abstract emitted-command reserve and experimental acceptance do not assert game resource or terminal ordering.'}
        ref='C_product_'+identity(plan)[:20];facts={'measured_catalogue_is_complete_factor_product':True,'current_point_controls_bound':True,'conditional_model_not_official_terminal_law':True}
        return {'status':'proposed','kind':'factor_product_experiment','product_panel_plan':plan,'proposal_id':ref,'actions':actions,'steps':steps,'facts':facts,'compositions':[{'id':ref,'observed':False,'open_question':why,'properties':{'roles':cfg['roles']},'relations':['contributes_to:G_official_completion']}],'question':{'reason':why,'hypothesis_refs':state['evidence'][-16:]},'route_refs':[obs['observation_ref']],'binding':{'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':actions,'purpose':why,'preconditions':facts,'evidence':[obs['observation_ref']]+state['evidence'][-16:],'outcome_guard':{'path':['value'],'contains':ref}}}
    def before(self,p,index,rows,**meta):
        plan=p.get('product_panel_plan')
        if not plan:return super().before(p,index,rows,**meta)
        ok=(meta['epoch'],meta['score'])==(plan['epoch'],plan['score'])and p['actions']==plan['commands']and p['bundle_template']['actions']==plan['commands']and 0<=index<len(p['steps'])
        if ok:
            step=p['steps'][index];control=plan['scene']['controls'][step['factor']];ok=p['actions'][index]==command_for(control)and current(rows,plan['scene']['geometry'])==step['before_values']and'ACTION6'in meta['available']
        if index==0:ok=ok and meta['observation_ref']==plan['observation_ref']and identity(rows)==plan['frame_digest']
        return {'admitted':bool(ok),'reason':'current_factor_point_and_values_bound'if ok else'factor_binding_or_payload_changed'}
    def after(self,p,index,rows,later,**meta):
        plan=p.get('product_panel_plan')
        if not plan:return super().after(p,index,rows,later,**meta)
        step=p['steps'][index];progress=meta['score']>plan['score'];boundary=meta['epoch']!=plan['epoch'];values=current(later,plan['scene']['geometry'])if not boundary else None;matched=None if step['after_values']is None else values==step['after_values']
        return {'matched':matched,'seal_prefix':progress or boundary or not step['relation_observed']or matched is not True,'reason':'conditional_factor_projection_matched'if matched else'factor_effect_requires_reconciliation','official_progress':progress,'scope':'Local factor projection; official terminal cause remains unasserted.'}
    def record(self,before,command,after,rows,later,proposal,index):
        events=super().record(before,command,after,rows,later,proposal,index);a=measure(rows)
        if not a:return events
        state=copy.deepcopy(self.product_state)if self.product_state and self.product_state['epoch']==before['level_epoch']and self.product_state['geometry_ref']==a['geometry_ref']else {'epoch':before['level_epoch'],'geometry_ref':a['geometry_ref'],'visited':[a['current']],'edges':[],'evidence':[],'counterexamples':[]}
        if before['level_epoch']==after['level_epoch']:
            b=measure(later)
            if b and b['geometry_ref']==a['geometry_ref']:
                changed=[i for i,(x,y)in enumerate(zip(a['current'],b['current']))if x!=y]
                if b['current']not in state['visited']:state['visited'].append(b['current'])
                if len(changed)==1:
                    i=changed[0];expected_control=command_for(a['controls'][i]);targeted=command==expected_control
                    if targeted:
                        edge={'factor':i,'from':a['current'][i],'to':b['current'][i],'before':a['current'],'after':b['current'],'evidence':[before['observation_ref'],after['observation_ref']]}
                        state['edges'].append(edge)
                elif changed:state['counterexamples'].append({'command':command,'changed_factors':changed,'evidence':[before['observation_ref'],after['observation_ref']]})
        else:state['boundary_witness']={'before':before['observation_ref'],'after':after['observation_ref'],'official_score':after['levels_completed'],'catalogue_goal_causal_status':'compatible_not_universal'}
        state['evidence'].extend([before['observation_ref'],after['observation_ref']]);event={'kind':'observed_factor_product','state':state};self.apply_event(event);events.append(event);return events
