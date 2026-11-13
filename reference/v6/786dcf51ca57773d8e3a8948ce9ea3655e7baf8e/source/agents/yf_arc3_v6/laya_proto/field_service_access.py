"""Conditional service experiment over public persistent fields and paired controls."""
from copy import deepcopy
from envelope_fill_access import EnvelopeFillAccess,input_candidates
from geometric_observer import components
from terminal_composition import identity

def paired_controls(rows):
    parts=components(rows);result=[]
    for i,a in enumerate(parts):
        l,t,r,b=a['bbox'];w,h=r-l+1,b-t+1
        if a['area']<2 or a['area']>=w*h:continue
        for z in parts[i+1:]:
            L,T,R,B=z['bbox']
            if z['color']!=a['color']or z['area']!=a['area']:continue
            vertical=L==l and R==r and T-b==2 and B-T+1==h and {(x,h-1-y)for x,y in a['mask']}==z['mask']
            horizontal=T==t and B==b and L-r==2 and R-L+1==w and {(w-1-x,y)for x,y in a['mask']}==z['mask']
            if not(vertical or horizontal):continue
            box=[l,t,R,B];result.append({'bbox':box,'point':[(l+R)//2,(t+B)//2],'orientation':'vertical'if vertical else'horizontal','evidence_components':[a['id'],z['id']]})
    return result

def linked_control(field,controls):
    l,t,r,b=field['bbox'];cx,cy=(l+r)//2,(t+b)//2;matches=[]
    for c in controls:
        x,y=c['point']
        if x==cx and (y<t or y>b):matches.append((min(abs(y-t),abs(y-b)),c))
        elif y==cy and(x<l or x>r):matches.append((min(abs(x-l),abs(x-r)),c))
    matches.sort(key=lambda z:z[0])
    return matches[0][1]if matches and(len(matches)==1 or matches[0][0]<matches[1][0])else None

class FieldServiceAccess(EnvelopeFillAccess):
    def __init__(self):super().__init__();self.service_events=[];self.service_context=None
    def retained_digest(self):return identity([super().retained_digest(),self.service_events,self.service_context])
    def apply_event(self,e):
        if e['kind']=='field_service_context':self.service_events.append(e);self.service_context=e['context'];self.requested_stop_reason=e['stop_reason'];return
        super().apply_event(e)
    def initialize_service(self,rows):
        ctx=self.fill_context
        if not ctx or not ctx.get('restored_measured_fields'):return None
        novel=[f for f in ctx['fields']if any(s[f['id']]['opaque_replacement']for s in ctx['history'])]
        if len(novel)!=1:return None
        useful=novel[0];others=[f for f in ctx['fields']if f['id']!=useful['id']and ctx['directions'][f['id']]==ctx['directions'][useful['id']]]
        if len(others)!=1:return None
        gate=linked_control(others[0],paired_controls(rows))
        if gate is None:return None
        return {'epoch':ctx['epoch'],'phase':'isolate','selected_field':useful,'other_field':others[0],'control':gate,'forward':ctx['forward'],'evidence':ctx['evidence'],'hypothesis':'Isolate the correlated branch without the novel observed content replacement, then measure the previously observed input. Spatial association and usefulness are unconfirmed.','attempts':0}
    def propose(self,episode,obs,rows,inputs,max_prefix,config):
        if not config.get('field_service_question'):return super().propose(episode,obs,rows,inputs,max_prefix,config)
        ctx=self.service_context
        if not ctx and self.fill_context and self.fill_context['phase']=='service_choice_required':ctx=self.initialize_service(rows)
        if ctx and ctx['epoch']==obs['level_epoch']and ctx['phase']in('isolate','serve'):
            target=ctx['control']if ctx['phase']=='isolate'else ctx['forward'];action={'action_ref':'ACTION6','data':dict(zip(('x','y'),target['point']))}
            if'ACTION6'not in obs['available_action_refs']or max_prefix<1:return None
            plan={'epoch':obs['level_epoch'],'score':obs['levels_completed'],'observation_ref':obs['observation_ref'],'frame_digest':identity(rows),'selected':target,'action':action,'phase':ctx['phase'],'service_context':deepcopy(ctx),'expected_effect':'unknown'};ref='C_service_'+identity(plan)[:20];why=config['field_service_question']['question']+' '+ctx['hypothesis'];facts={'current_public_field_and_control_bound':True,'previous_field_restoration_observed':True};ev=ctx['evidence']+[obs['observation_ref']]
            return {'status':'proposed','kind':'field_service_experiment','proposal_id':ref,'nested_control_plan':plan,'field_service_plan':plan,'actions':[action],'steps':[{'action':action,'expected_after':None}],'facts':facts,'compositions':[{'id':ref,'observed':False,'open_question':why,'properties':{'roles':config['field_service_question']['roles']},'relations':['contributes_to:G_official_completion']}],'question':{'reason':'conditional_field_'+ctx['phase'],'hypothesis_refs':ev},'route_refs':ev,'binding':{'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':[action],'purpose':why,'preconditions':facts,'evidence':ev,'outcome_guard':{'path':['value'],'contains':ref}}}
        return super().propose(episode,obs,rows,inputs,max_prefix,config)
    def record(self,before,command,after,rows,later,proposal,index):
        p=proposal.get('field_service_plan')
        if not p:
            events=super().record(before,command,after,rows,later,proposal,index)
            if self.fill_context and self.fill_context['phase']=='service_choice_required':
                ctx=self.initialize_service(later)
                if ctx:
                    e={'kind':'field_service_context','context':ctx,'stop_reason':None,'evidence':[before['observation_ref'],after['observation_ref']]};self.apply_event(e);events.append(e)
            return events
        # Keep the exact control response and all upstream public acquisition; avoid treating a gate as another fill pulse.
        from nested_control_access import NestedControlAccess
        events=NestedControlAccess.record(self,before,command,after,rows,later,proposal,index);ctx=deepcopy(p['service_context']);changed=[(x,y)for y,row in enumerate(rows)for x,v in enumerate(row)if v!=later[y][x]];stop=None
        if before['level_epoch']!=after['level_epoch']:
            ctx['phase']='boundary_revalidation_required';stop='field_service_next_epoch_requires_revalidation'
        elif not changed:ctx['phase']='unknown';stop='field_service_no_effect'
        elif p['phase']=='isolate':
            from envelope_fill_observation import state
            l,t,r,b=p['selected']['bbox'];local=all(l<=x<=r and t<=y<=b for x,y in changed);ctx['local_control_effect']=local
            fields=[ctx['selected_field'],ctx['other_field']];old=state(rows,fields);new=state(later,fields);preserved=all(old[k]['appearance_digest']==new[k]['appearance_digest']for k in old);matching=[c for c in paired_controls(later)if c['point']==p['selected']['point']];changed_orientation=len(matching)==1 and matching[0]['orientation']!=p['selected']['orientation']
            ctx['field_contents_preserved']=preserved;ctx['paired_control_orientation_changed']=changed_orientation;ctx['nonlocal_appearance_effect_unknown']=not local;ctx['phase']='serve'if preserved and changed_orientation else'unknown'
            if ctx['phase']=='unknown':stop='field_control_nonlocal_effect_requires_reconciliation'
            else:ctx['isolated_field_before']=new[ctx['other_field']['id']]['appearance_digest']
        else:
            ctx['attempts']+=1
            # An observed reset of all acquired fields refutes continued accumulation in this context.
            from envelope_fill_observation import state
            current=state(later,self.fill_context['fields']);initial=self.fill_context['initial'];restored=all(current[k]['appearance_digest']==v['appearance_digest']for k,v in initial.items());ctx['latest_fields']=current
            if restored:ctx['phase']='unknown';stop='field_service_returned_initial_fields'
            elif current[ctx['other_field']['id']]['appearance_digest']!=ctx['isolated_field_before']:ctx['phase']='unknown';stop='field_isolation_hypothesis_refuted'
        ctx['evidence'] +=[before['observation_ref'],after['observation_ref']]
        e={'kind':'field_service_context','context':ctx,'stop_reason':stop,'changed_pixels':len(changed),'evidence':[before['observation_ref'],after['observation_ref']],'scope':'Observed responses and conditional service experiment; no physical units, capacity, relay or terminal law.'};self.apply_event(e);return events+[e]
