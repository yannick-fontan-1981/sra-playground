"""Rebind observed field-service relations by current geometry; retain uncertain fullness."""
from copy import deepcopy
from field_service_access import FieldServiceAccess,paired_controls,linked_control,input_candidates
from envelope_fill_observation import groups
from geometric_observer import components
from terminal_composition import identity

def crop(rows,box):
    l,t,r,b=box;return [row[l:r+1]for row in rows[t:b+1]]
def same_shape(component,template):
    l,t,r,b=component['bbox'];return [r-l+1,b-t+1]==template['extent']and component['area']==template['area']and component['color']==template['background']
def shape(component):
    l,t,r,b=component['bbox'];return {'extent':[r-l+1,b-t+1],'area':component['area'],'background':component['color']}
def current_control(rows,prior):
    point=prior['point'];l,t,r,b=prior['bbox'];half=max(r-l,b-t)//2;x,y=point;L,T,R,B=x-half,y-half,x+half,y+half
    if L<0 or T<0 or R>=len(rows[0])or B>=len(rows):return None
    local=paired_controls(crop(rows,[L,T,R,B]));matches=[]
    for c in local:
        if[c['point'][0]+L,c['point'][1]+T]!=point:continue
        z=deepcopy(c);z['point']=point;z['bbox']=[c['bbox'][0]+L,c['bbox'][1]+T,c['bbox'][2]+L,c['bbox'][3]+T];z['measurement_scope']='current crop rebound from prior measured control extent; no global component identity';matches.append(z)
    return matches[0]if len(matches)==1 else None

class ServiceTransferAccess(FieldServiceAccess):
    def __init__(self):super().__init__();self.transfer_events=[];self.transfer_model=None;self.transfer_context=None
    def retained_digest(self):return identity([super().retained_digest(),self.transfer_events,self.transfer_model,self.transfer_context])
    def apply_event(self,e):
        if e['kind']=='field_service_transfer':self.transfer_events.append(e);self.transfer_model=e['model'];self.transfer_context=e['context'];self.requested_stop_reason=e['stop_reason'];return
        super().apply_event(e)
    def transfer_event(self,model,ctx,stop,refs):
        e={'kind':'field_service_transfer','model':model,'context':ctx,'stop_reason':stop,'evidence':refs,'scope':'Rebound geometric roles and conditional service observations; full-looking field and contribution to terminal remain hypotheses until current effects.'};self.apply_event(e);return e
    def bind_transfer(self,obs,rows,config):
        m=self.transfer_model
        if not m or not m.get('official_boundary_witness')or not m.get('receiver'):return None
        parts=components(rows);relays=[p for p in parts if same_shape(p,m['relay'])];targets=[p for p in parts if same_shape(p,m['receiver'])]
        if len(relays)>1 or not targets:return None
        controls=paired_controls(rows);relay=relays[0]if relays else None;gate=linked_control(relay,controls)if relay else None;q=self.nested_question(obs,rows,config['nested_control_question'])
        if (relay and gate is None)or not q:return None
        destinations=[]
        for p in targets:
            g=linked_control(p,controls)
            if g is None:return None
            destinations.append({'bbox':p['bbox'],'gate_point':g['point'],'gate_scope':g,'initial_digest':identity(crop(rows,p['bbox']))})
        return {'epoch':obs['level_epoch'],'relay_bbox':relay['bbox']if relay else None,'relay_gate':gate['point']if gate else None,'relay_gate_scope':gate,'unknown_intermediate':relay is None,'forward':q['nested_control_plan']['selected'],'targets':destinations,'source_revalidated':False,'evidence':[obs['observation_ref']]+m['evidence'],'attempted_controls':[],'service_count':0,'new_field_observations':[]}
    def transfer_question(self,obs,rows,target,ctx,phase,config):
        action={'action_ref':'ACTION6','data':dict(zip(('x','y'),target['point']))};plan={'epoch':obs['level_epoch'],'score':obs['levels_completed'],'observation_ref':obs['observation_ref'],'frame_digest':identity(rows),'selected':target,'action':action,'phase':phase,'transfer_context':deepcopy(ctx),'expected_effect':'unknown'};ref='C_transfer_'+identity(plan)[:20];why=config['field_service_transfer']['question']+' Current experiment: '+phase;facts={'current_shapes_rebound':True,'acquisition_epoch_retained':True,'current_point_bound':True};ev=ctx['evidence']+[obs['observation_ref']]
        return {'status':'proposed','kind':'field_service_transfer_experiment','proposal_id':ref,'nested_control_plan':plan,'field_transfer_plan':plan,'actions':[action],'steps':[{'action':action,'expected_after':None}],'facts':facts,'compositions':[{'id':ref,'observed':False,'open_question':why,'properties':{'roles':config['field_service_transfer']['roles']},'relations':['contributes_to:G_official_completion']}],'question':{'reason':phase,'hypothesis_refs':ev},'route_refs':ev,'binding':{'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':[action],'purpose':why,'preconditions':facts,'evidence':ev,'outcome_guard':{'path':['value'],'contains':ref}}}
    def propose(self,episode,obs,rows,inputs,max_prefix,config):
        if not config.get('field_service_transfer'):return super().propose(episode,obs,rows,inputs,max_prefix,config)
        m=self.transfer_model
        if m and m.get('official_boundary_witness')and obs['level_epoch']!=m['acquisition_epoch']:
            ctx=self.transfer_context
            if not ctx or ctx['epoch']!=obs['level_epoch']:ctx=self.bind_transfer(obs,rows,config)
            if ctx is None:return {'status':'abstained','reason':'service_transfer_current_shape_not_bound'}
            controls=paired_controls(rows)
            def gate(point,prior):return current_control(rows,prior)or next((p for p in controls if p['point']==point),None)
            rg=gate(ctx['relay_gate'],ctx['relay_gate_scope'])if ctx['relay_gate']else None
            if ctx['relay_gate']and rg is None:return {'status':'abstained','reason':'service_relay_control_unknown'}
            if rg and rg['orientation']!=m['conducting_orientation']:
                return self.transfer_question(obs,rows,rg,ctx,'revalidate_source_access',config)
            target_states=[]
            for t in ctx['targets']:
                values=[v for row in crop(rows,t['bbox'])for v in row];full=m['receiver']['background']not in values;g=gate(t['gate_point'],t['gate_scope'])
                if g is None:return {'status':'abstained','reason':'service_destination_control_unknown'}
                target_states.append((t,g,full))
            if ctx['unknown_intermediate']:
                # Partial applicability: prepare each recognized receiver, retaining the unrecognized intermediate as a question.
                closed=[(t,g)for t,g,full in target_states if not full and g['orientation']!=m['conducting_orientation']]
                if closed:return self.transfer_question(obs,rows,closed[0][1],ctx,'prepare_receiver_before_unknown_service',config)
                return self.transfer_question(obs,rows,ctx['forward'],ctx,'test_unknown_service_intermediate',config)
            # Protect a fully changed receiver before serving a still unchanged one.
            for t,g,full in target_states:
                if full and g['orientation']==m['conducting_orientation']and any(not x[2]for x in target_states):return self.transfer_question(obs,rows,g,ctx,'protect_changed_receiver',config)
            opened=[(t,g)for t,g,full in target_states if not full and g['orientation']==m['conducting_orientation']]
            if not opened:
                remaining=[(t,g)for t,g,full in target_states if not full]
                if not remaining:return {'status':'abstained','reason':'all_receiver_appearances_changed_without_official_boundary'}
                return self.transfer_question(obs,rows,remaining[0][1],ctx,'enable_remaining_receiver',config)
            return self.transfer_question(obs,rows,ctx['forward'],ctx,'revalidate_conditional_service',config)
        return super().propose(episode,obs,rows,inputs,max_prefix,config)
    def record(self,before,command,after,rows,later,proposal,index):
        p=proposal.get('field_transfer_plan');refs=[before['observation_ref'],after['observation_ref']]
        if p:
            from nested_control_access import NestedControlAccess
            events=NestedControlAccess.record(self,before,command,after,rows,later,proposal,index);ctx=deepcopy(p['transfer_context']);ctx['evidence']+=refs;stop=None
            if before['level_epoch']!=after['level_epoch']:ctx=None
            elif rows==later:stop='transferred_service_no_effect'
            elif p['phase']in('revalidate_conditional_service','test_unknown_service_intermediate'):
                from envelope_fill_observation import acquire_fields
                ctx['service_count']+=1;ctx['source_revalidated']=True
                observed=acquire_fields(rows,later,refs);ctx['new_field_observations'].append({'evidence':refs,'fields':observed,'changed_pixels':sum(v!=later[y][x]for y,row in enumerate(rows)for x,v in enumerate(row)),'service_dependency':'Current input followed this change; passage, duration and release relation unconfirmed.'})
            else:
                point=p['selected']['point'];measured=current_control(later,p['selected']);new=[measured]if measured else[c for c in paired_controls(later)if c['point']==point];oldorientation=p['selected']['orientation'];valid=len(new)==1 and new[0]['orientation']!=oldorientation
                if not valid:stop='transferred_control_response_refuted'
                ctx['attempted_controls'].append({'point':point,'from':oldorientation,'to':new[0]['orientation']if new else None,'evidence':refs})
            events.append(self.transfer_event(self.transfer_model,ctx,stop,refs));return events
        events=super().record(before,command,after,rows,later,proposal,index);service=proposal.get('field_service_plan');model=deepcopy(self.transfer_model)
        if service:
            sc=service['service_context']
            if model is None:
                field=sc['selected_field'];l,t,r,b=field['bbox'];model={'acquisition_epoch':before['level_epoch'],'relay':{'extent':[r-l+1,b-t+1],'area':(r-l+1)*(b-t+1),'background':field['alternative_fill_palette']},'conducting_orientation':sc['control']['orientation'],'receiver':None,'evidence':[]}
            if before['level_epoch']==after['level_epoch']and service['phase']=='serve'and model['receiver']is None:
                excluded=[f['bbox']for f in self.fill_context['fields']];parts=components(rows)
                for g in groups(rows,later):
                    if g['palette_pair'][0]!=model['relay']['background']:continue
                    l,t,r,b=g['bbox'];matches=[a for a in parts if a['bbox']not in excluded and a['color']==g['palette_pair'][0]and a['bbox'][0]<=l<=r<=a['bbox'][2]and a['bbox'][1]<=t<=b<=a['bbox'][3]]
                    if len(matches)==1:model['receiver']=shape(matches[0]);model['receiver_fill']=g['palette_pair'][1]
            if before['level_epoch']!=after['level_epoch']:model['official_boundary_witness']=refs
            model['evidence']+=refs;events.append(self.transfer_event(model,None,None if model.get('official_boundary_witness')else self.requested_stop_reason,refs))
        return events
