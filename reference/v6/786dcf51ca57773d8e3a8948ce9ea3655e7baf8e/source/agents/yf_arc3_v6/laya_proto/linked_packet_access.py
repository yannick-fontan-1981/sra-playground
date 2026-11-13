"""Experimental control binding and dated output acquisition from public packets."""
import copy,math
from trace_field_access import TraceFieldAccess,input_candidates
from linked_support_observation import scene,phase,changed_supports,selection_recipient
from packet_line_observation import measure_packet
from packet_ray_methods import relay_route,estimate_phase
from terminal_composition import identity

def circular(x):return math.atan2(math.sin(x),math.cos(x))
def target_marker(rows,measurement):
    result=[]
    for o in measurement['objects']:
        x,y=o['point'];values=[rows[y+dy][x+dx]for dx,dy in[(0,1),(0,-1),(1,0),(-1,0)]]
        if len(set(values))==1 and values[0]==measurement['background']and rows[y][x]!=values[0]:result.append(o)
    return result[0]if len(result)==1 else None

def segment_for(body,segments):
    x,y=body['point'];size=max(body['bbox'][2]-body['bbox'][0]+1,body['bbox'][3]-body['bbox'][1]+1);candidates=[]
    for seg in segments:
        a,b=seg['first_center'];vx,vy=seg['direction'];dx,dy=a-x,b-y
        if 0<=dx*vx+dy*vy<=2*size and abs(dx*vy-dy*vx)<=1.2:candidates.append(seg)
    return candidates[0]if len(candidates)==1 else None

class LinkedPacketAccess(TraceFieldAccess):
    def __init__(self):super().__init__();self.linked_state=None;self.linked_events=[];self.linked_outputs={};self.linked_input_steps={};self.linked_launch=None
    def retained_digest(self):return identity([super().retained_digest(),self.linked_state,self.linked_events,self.linked_outputs,self.linked_input_steps,self.linked_launch])
    def apply_event(self,e):
        if e['kind']=='linked_packet_evidence':
            self.linked_state=e['state'];self.linked_outputs=e['outputs'];self.linked_input_steps=e['input_steps'];self.linked_launch=e['launch'];self.linked_events.append(e);return
        super().apply_event(e)
    def relay_contribution(self,state,target,obs,rows,inputs,config):
        available={a['action_ref']for a in inputs};launch=self.linked_launch
        if not launch or launch not in available or len(state['bindings'])!=len(state['scene']['controls']):return None
        controls=state['scene']['controls'];selected=next((c for c in controls if c['ref']==state['selected']),None)
        if selected is None:return None
        context=identity([[(c['ref'],phase(rows,c,state['selection_masks'].get(c['ref'],[])))for c in controls],state['selected']]);tried=any(t.get('context')==context and t.get('action')==launch for t in state['trials'])
        if not state.get('received_controls')and any(v['status']=='candidate'for v in self.linked_input_steps.values())and not tried:return {'action':{'action_ref':launch},'control':selected,'reason':'revalidate_recalled_packet_input_on_current_supports','route':None,'scope':'Input role remains a current experiment, not inherited action authority.'}
        route=relay_route(state,target,self.linked_outputs,self.linked_input_steps,obs,config['level_deadline'])
        if not route:return None
        for edge in route['route']:
            control=next(c for c in controls if state['bindings'][c['ref']]['ref']==edge['source']);drawing=phase(rows,control,state['selection_masks'].get(control['ref'],[]));estimate=estimate_phase(drawing,self.linked_outputs,state['edges'],self.linked_input_steps,route['grid'])
            if estimate is None:
                missing=state.get('unobserved_outputs',{}).get(control['ref']+':'+drawing)
                if missing:
                    if state['selected']!=control['ref']:return {'action':{'action_ref':'ACTION6','data':dict(zip(('x','y'),control['point']))},'control':control,'reason':'select_unobserved_provider_of_prepared_composition','route':route,'consumer':edge,'missing_front_witness':missing,'scope':'A dated packet did not expose this provider output. Overlap, inactivity and other causes remain compatible.'}
                    tested={e['action']for e in state['edges']if e['before']==drawing}
                    candidates=sorted(a for a,law in self.linked_input_steps.items()if a in available and law['status']=='candidate'and a not in tested)
                    if candidates:return {'action':{'action_ref':candidates[0]},'control':control,'reason':'contrast_unobserved_provider_with_known_local_transformation','route':route,'consumer':edge,'missing_front_witness':missing,'scope':'Known local drawing transformation serves a new output-observation question; no output direction is assigned to the unseen phase.'}
                    return None
                if tried:return None
                return {'action':{'action_ref':launch},'control':selected,'reason':'observe_unmeasured_output_after_prepared_predecessors','route':route,'consumer':edge,'scope':'Earlier hypothetical links prepared; current output remains unknown.'}
            error=circular(edge['angle']-estimate['angle'])
            if abs(error)<=.06:continue
            if state['selected']!=control['ref']:return {'action':{'action_ref':'ACTION6','data':dict(zip(('x','y'),control['point']))},'control':control,'reason':'select_provider_for_current_relay_contribution','route':route,'consumer':edge,'estimate':estimate}
            choices=[]
            for a,law in self.linked_input_steps.items():
                if a not in available or law['status']!='candidate':continue
                delta=math.copysign(route['grid']['step'],law['delta']);count=round(error/delta)%route['grid']['count']
                if count and count<config['remaining_level_actions']:choices.append((count,a,delta))
            if not choices:return None
            count,a,delta=min(choices)
            return {'action':{'action_ref':a},'control':control,'reason':'prepare_observed_provider_for_intermediate_receiver','route':route,'consumer':edge,'estimate':estimate,'predicted_output_angle':circular(estimate['angle']+delta),'remaining_hypothetical_steps':count,'scope':'One experimental increment; inferred output must be confronted with a later actual packet.'}
        if not tried:return {'action':{'action_ref':launch},'control':selected,'reason':'test_prepared_relay_composition','route':route,'all_angles_conditionally_ready':True}
        return None
    def propose(self,episode,obs,rows,inputs,max_prefix,config):
        cfg=config.get('linked_packet_question');s=scene(rows)if cfg else None
        if not s or not max_prefix or'ACTION6'not in obs['available_action_refs']:return super().propose(episode,obs,rows,inputs,max_prefix,config)
        target=target_marker(rows,s)
        if not target:return super().propose(episode,obs,rows,inputs,max_prefix,config)
        state=copy.deepcopy(self.linked_state)if self.linked_state and self.linked_state['epoch']==obs['level_epoch']else{'epoch':obs['level_epoch'],'scene':s,'bindings':{},'selected':None,'input_tests':[],'edges':[],'trials':[],'selection_masks':{},'evidence':[]}
        controls=state['scene']['controls'];unbound=[c for c in controls if c['ref']not in state['bindings']];reason=None;control=None;purpose=None
        contribution=self.relay_contribution(state,target,obs,rows,inputs,config)if not unbound else None
        if any(e.get('failed_binding')in{c['ref']for c in unbound}and e.get('frame')==identity(rows)for e in state['trials']):return {'status':'abstained','reason':'linked_selection_refuted_or_ambiguous_in_exact_context'}
        if unbound:
            control=unbound[0];action={'action_ref':'ACTION6','data':dict(zip(('x','y'),control['point']))};reason='test_visible_remote_motif_binding';purpose=cfg['selection_question']
        elif contribution:
            action=contribution['action'];control=contribution['control'];reason=contribution['reason'];purpose=cfg['relay_question']
        elif state.get('received_controls')and state['selected']not in state['received_controls']:
            control=next(c for c in controls if c['ref']==state['received_controls'][0]);action={'action_ref':'ACTION6','data':dict(zip(('x','y'),control['point']))};reason='reselect_control_of_actually_observed_front';purpose=cfg['selection_question']
        else:
            selected=next((c for c in controls if c['ref']==state['selected']),None)
            if selected is None:return {'status':'abstained','reason':'linked_current_selection_unknown'}
            control=selected;mask=state['selection_masks'].get(control['ref'],[]);drawing=phase(rows,control,mask);body=state['bindings'][control['ref']]
            available=[a['action_ref']for a in inputs if a['action_ref']not in('ACTION6','ACTION7')]
            unknown=[a for a in available if a not in state['input_tests']]
            if unknown:action={'action_ref':unknown[0]};reason='identify_input_effect_on_selected_public_motif';purpose=cfg['input_question']
            else:
                launch=self.linked_launch
                if not launch or launch not in available:return {'status':'abstained','reason':'linked_packet_trigger_not_acquired'}
                context=identity([[(c['ref'],phase(rows,c,state['selection_masks'].get(c['ref'],[])))for c in controls],state['selected']])
                if drawing not in self.linked_outputs and not any(t.get('context')==context and t.get('action')==launch for t in state['trials']):action={'action_ref':launch};reason='measure_output_for_current_drawing';purpose=cfg['packet_question']
                else:
                    transform=sorted({e['action']for e in state['edges']if e['before']!=e['after']and e['action']in available});choices=[]
                    known=self.linked_outputs.get(drawing);known=known if known and'angle'in known else None;desired=math.atan2(target['point'][1]-body['point'][1],target['point'][0]-body['point'][0])
                    for a in transform:
                        edges=[e for e in state['edges']if e['action']==a and e['before']==drawing];predicted=edges[-1]['after']if edges else None
                        if predicted in self.linked_outputs:continue
                        if predicted is None and any(t.get('context')==context and t.get('action')==a for t in state['trials']):continue
                        delta=self.linked_input_steps.get(a);delta=delta if delta and delta['status']=='candidate'else None;error=abs(circular(known['angle']+delta['delta']-desired))if known and delta else math.pi
                        choices.append((error,a,predicted))
                    if not choices:return {'status':'abstained','reason':'linked_output_requires_new_composition_or_unbound_phase'}
                    error,a,predicted=min(choices);action={'action_ref':a};reason='contrast_current_drawing_output_toward_receiver_hypothesis';purpose=cfg['contrast_question']
        plan={'epoch':obs['level_epoch'],'score':obs['levels_completed'],'observation_ref':obs['observation_ref'],'frame_digest':identity(rows),'scene':state['scene'],'state':state,'control':control,'target_hypothesis':target,'command':copy.deepcopy(action),'reason':reason,'relay_contribution':contribution,'scope':'Selection and output experiments. Remote role, angular law and isolated marker as useful target are hypotheses; no creator optical codebook.'}
        ref='C_linked_'+identity(plan)[:20];facts={'current_public_compact_support':True,'dated_packet_question':True,'terminal_role_hypothesis_only':True}
        return {'status':'proposed','kind':'linked_packet_experiment','linked_packet_plan':plan,'proposal_id':ref,'actions':[action],'steps':[{'action':action,'expected_after':None}],'facts':facts,'compositions':[{'id':ref,'observed':False,'open_question':purpose,'properties':{'roles':cfg['roles']},'relations':['contributes_to:G_official_completion']}],'question':{'reason':reason,'hypothesis_refs':state['evidence'][-16:]},'route_refs':[obs['observation_ref']],'binding':{'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':[action],'purpose':purpose,'preconditions':facts,'evidence':[obs['observation_ref']]+state['evidence'][-16:],'outcome_guard':{'path':['value'],'contains':ref}}}
    def before(self,p,index,rows,**meta):
        plan=p.get('linked_packet_plan')
        if not plan:return super().before(p,index,rows,**meta)
        ok=index==0 and(meta['epoch'],meta['score'],meta['observation_ref'])==(plan['epoch'],plan['score'],plan['observation_ref'])and identity(rows)==plan['frame_digest']and p['actions']==[plan['command']]and p['bundle_template']['actions']==p['actions']and plan['command']['action_ref']in meta['available']
        if plan['command']['action_ref']=='ACTION6':ok=ok and plan['command'].get('data')==dict(zip(('x','y'),plan['control']['point']))
        return {'admitted':ok,'reason':'current_linked_experiment_bound'if ok else'linked_context_or_command_changed'}
    def after(self,p,index,rows,later,**meta):
        if'linked_packet_plan'not in p:return super().after(p,index,rows,later,**meta)
        return {'matched':None,'seal_prefix':True,'official_progress':meta['score']>p['linked_packet_plan']['score'],'reason':'current_control_and_dated_packet_require_reconciliation'}
    def emit(self,state,detail):
        event={'kind':'linked_packet_evidence','state':copy.deepcopy(state),'outputs':copy.deepcopy(self.linked_outputs),'input_steps':copy.deepcopy(self.linked_input_steps),'launch':self.linked_launch,'detail':detail};self.apply_event(event);return event
    def record(self,before,cmd,after,rows,later,proposal,index):
        events=super().record(before,cmd,after,rows,later,proposal,index);plan=proposal.get('linked_packet_plan')
        if not plan:return events
        if cmd!=plan['command']:raise ValueError('Linked receipt differs from committed input')
        state=copy.deepcopy(plan['state']);control=plan['control'];detail={'before_ref':before['observation_ref'],'after_ref':after['observation_ref'],'command':cmd,'reason':plan['reason']}
        contribution=plan.get('relay_contribution')
        if contribution and contribution.get('route')and cmd['action_ref']==self.linked_launch:state['pending_relay_path']={'route':contribution['route']['route'],'all_angles_conditionally_ready':contribution.get('all_angles_conditionally_ready',False),'before_ref':before['observation_ref']}
        boundary=after['level_epoch']!=before['level_epoch']or after['levels_completed']>before['levels_completed']
        if not boundary:
            if cmd['action_ref']=='ACTION6':
                affected=changed_supports(rows,later,state['scene']);x,y=control['point'];radius=control['radius'];mask=[[dx,dy]for dy in range(-radius,radius+1)for dx in range(-radius,radius+1)if rows[y+dy][x+dx]!=later[y+dy][x+dx]]
                known=state['bindings'].get(control['ref']);previous=state['bindings'].get(state['selected']);recipient,witness=selection_recipient(rows,later,affected,previous);detail['selection_witness']=witness
                if recipient and mask and(not known or known['ref']==recipient['ref']):state['bindings'][control['ref']]=recipient;state['selection_masks'].setdefault(control['ref'],mask);state['selected']=control['ref'];detail['binding_status']='current_cochange_with_selection_provenance'
                else:detail['binding_status']='unknown_or_ambiguous';state['trials'].append({'failed_binding':control['ref'],'frame':identity(rows)})
            else:
                mask=state['selection_masks'].get(control['ref'],[]);a=phase(rows,control,mask);b=phase(later,control,mask);state['input_tests'].append(cmd['action_ref']);context=identity([[(c['ref'],phase(rows,c,state['selection_masks'].get(c['ref'],[])))for c in state['scene']['controls']],state['selected']]);state['trials'].append({'context':context,'action':cmd['action_ref']})
                if a!=b:state['edges'].append({'before':a,'after':b,'action':cmd['action_ref'],'evidence':after['observation_ref'],'epoch':before['level_epoch']})
                contribution=plan.get('relay_contribution')
                if contribution and'predicted_output_angle'in contribution:
                    state.setdefault('output_predictions',{})[control['ref']+':'+b]={'angle':contribution['predicted_output_angle'],'action_ref':cmd['action_ref'],'prospective_observation_ref':before['observation_ref'],'observed_drawing_ref':after['observation_ref'],'status':'candidate_pending_dated_output'}
        state['evidence'].append(after['observation_ref']);events.append(self.emit(state,detail));return events
    def record_packet(self,before,cmd,after,rows,frames,episode):
        events=super().record_packet(before,cmd,after,rows,frames,episode)
        if not self.linked_state or self.linked_state['epoch']!=before['level_epoch']or len(frames)<3:return events
        measured=measure_packet(rows,frames,observation_ref=before['observation_ref'],action_ref=cmd['action_ref'])
        if measured['status']!='measured':return events
        state=copy.deepcopy(self.linked_state);self.linked_launch=cmd['action_ref'];received=[];received_order=[];state['received_controls']=[];state['edges']=[e for e in state['edges']if e['action']!=cmd['action_ref']]
        for control in state['scene']['controls']:
            body=state['bindings'].get(control['ref'])
            if not body:continue
            segment=segment_for(body,measured['segments'])
            if not segment:continue
            received_order.append((segment['start_frame'],control['ref']))
            drawing=phase(rows,control,state['selection_masks'].get(control['ref'],[]));angle=math.atan2(segment['direction'][1],segment['direction'][0]);entry={'angle':angle,'direction':segment['direction'],'evidence':before['observation_ref'],'epoch':before['level_epoch'],'frame_interval':[segment['start_frame'],segment['end_frame']],'body_ref':body['ref'],'drawing':drawing,'scope':'Measured local outgoing front; reemission law and exact collision geometry unknown'}
            previous=self.linked_outputs.get(drawing)
            if previous and('angle'not in previous or abs(circular(previous['angle']-angle))>.1):self.linked_outputs[drawing]={'status':'refuted','counterexamples':[previous,entry]}
            else:self.linked_outputs[drawing]=entry
            predicted=state.get('output_predictions',{}).get(control['ref']+':'+drawing)
            if predicted:
                difference=abs(circular(predicted['angle']-angle));predicted['status']='matched_local_prediction'if difference<=.1 else'refuted_local_prediction';predicted['angular_error']=difference;predicted['actual_packet_ref']=before['observation_ref'];entry['prospective_comparison']=copy.deepcopy(predicted)
                if difference>.1:
                    law=self.linked_input_steps.get(predicted['action_ref']);self.linked_input_steps[predicted['action_ref']]={'status':'refuted','counterexamples':[law,copy.deepcopy(predicted),copy.deepcopy(entry)]}
            received.append(entry)
        state['received_controls']=[ref for tick,ref in sorted(received_order)]
        expected=state.pop('pending_relay_path',None)
        if expected:
            actual=[state['bindings'][ref]['ref']for ref in state['received_controls']];wanted=[e['source']for e in expected['route']];expected['actual_front_sources']=actual;expected['expected_front_sources']=wanted;expected['official_progress']=after['levels_completed']>before['levels_completed'];expected['comparison']='matched_observed_front_prefix'if actual==wanted else'unknown_or_missing_expected_front';state['last_relay_comparison']=expected
            if not expected['official_progress']:
                for edge in expected['route']:
                    if edge['source']in actual:continue
                    control=next(c for c in state['scene']['controls']if state['bindings'][c['ref']]['ref']==edge['source']);drawing=phase(rows,control,state['selection_masks'].get(control['ref'],[]))
                    state.setdefault('unobserved_outputs',{})[control['ref']+':'+drawing]={'before_ref':before['observation_ref'],'after_ref':after['observation_ref'],'body_ref':edge['source'],'drawing':drawing,'frame_count':len(frames),'status':'output_not_measured','scope':'No assigned front in this dated packet, not proof of no effect or a direction law.'}
            if expected['all_angles_conditionally_ready']and not expected['official_progress']and actual!=wanted:state.pop('geometric_route_cache',None)
        for e in state['edges']:
            a=self.linked_outputs.get(e['before']);b=self.linked_outputs.get(e['after'])
            if a and b and'angle'in a and'angle'in b:
                delta=circular(b['angle']-a['angle']);prior=self.linked_input_steps.get(e['action']);entry={'delta':delta,'evidence':[e['evidence'],a['evidence'],b['evidence']],'status':'candidate','scope':'Conditional angular increment, not universal law'}
                if prior and(prior['status']=='refuted'or abs(circular(prior['delta']-delta))>.1):entry={'status':'refuted','counterexamples':[prior,entry]}
                self.linked_input_steps[e['action']]=entry
        detail={'before_ref':before['observation_ref'],'after_ref':after['observation_ref'],'command':cmd,'packet_measurement':measured,'outputs_received':received,'relay_comparison':expected,'canonical_return_equals_initial':bool(frames and frames[-1]==rows),'reset_semantics':'unknown_beyond_observed_view'};events.append(self.emit(state,detail));return events
