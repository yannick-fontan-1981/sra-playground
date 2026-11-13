"""Current point invitation and existing measured transient contact calculus."""
import json
from pathlib import Path
from common_animated_contact_base import AnimationBase
from terminal_composition import identity
from src_bridge import plain
from agents.yf_arc3_v5.capabilities.contracts import FrameGrid,SceneTransitionMeasurementInput
from agents.yf_arc3_v5.capabilities.transition import _ordered_transient_component_path_facts,measure_scalar_fill_display
from transient_contact_memory import acquire as acquire_curve,project as project_curve,calibration,source_role_probe

import agents.yf_arc3_v5 as v5_package
RULE_PATH=Path(v5_package.__file__).resolve().parent/'drm/interaction.drm'
CONSUMED_SOURCE_FILES=(RULE_PATH,)
def rules(value):
    if isinstance(value,dict):
        if value.get('id')in ('projection.exploration.ballistic_contact_solution','projection.exploration.ballistic_curve_disclosure'):yield value
        for v in value.values():yield from rules(v)
    elif isinstance(value,list):
        for v in value:yield from rules(v)
RULES={r['id']:r for r in rules(json.loads(RULE_PATH.read_text()))}

def cross_invitation(o):
    candidates=[]
    for e in o['entities']:
        left,top,right,bottom=e['bbox'];width=right-left;height=bottom-top
        if width!=height or width<2 or width%2 or e['area']!=width+height+1:continue
        half=width//2;actual={tuple(p)for p in e['mask']};expected={(half,y)for y in range(height+1)}|{(x,half)for x in range(width+1)}
        if actual==expected:candidates.append({'point':{'x':left+half,'y':top+half},'entity_ref':e['id'],'signature':e['signature']})
    return candidates[0]if len(candidates)==1 else None

class AnimatedContactAccess(AnimationBase):
    def __init__(self):super().__init__();self.arc_events=[];self.arc_pending=None
    def retained_digest(self):return identity([super().retained_digest(),self.arc_events])
    def apply_event(self,e):
        if e.get('kind')=='measured_animated_contact':self.arc_events.append(e);return
        return super().apply_event(e)
    def propose_graph(self,o,rows,inputs,limit,config):
        cfg=config.get('animated_contact_question');available=set(o['available_action_refs'])
        if not cfg or 'ACTION6'not in available:return super().propose_graph(o,rows,inputs,limit,config)
        current=[e for e in self.arc_events if e['epoch']==o['level_epoch']]
        point=None;scalar_action=None;evidence=[o['observation_ref']];facts={};mode='invitation';why=cfg['invitation_question']
        if current and current[-1]['after_rows_digest']==identity(rows):
            last=current[-1];measured=last['measurement'];evidence+=last['evidence']
            for mode in ('contact_solution','curve_disclosure'):
                key='ballistic_'+mode
                if not measured.get(key+'_present'):continue
                point={'x':measured[key+'_column'],'y':measured[key+'_row']};command={'action_ref':'ACTION6','data':point}
                used=sum(e['command']==command for e in current)
                facts={**measured,'candidate_is_'+key:True,'interaction_measurement_kind':'point','attempted_without_effect_in_current_context':False,'tested_before_without_resolution_plan':used>0,'candidate_execution_count':used}
                rule=RULES['projection.exploration.'+key]
                if all(c['operator']=='equals'and facts.get(c['field'])==c['expected']for c in rule['all_conditions']):why=cfg[mode+'_question'];evidence.append(rule['id']);break
                point=None
        elif not current:
            invitation=cross_invitation(o)
            if invitation:point=invitation['point'];facts={'unique_symmetric_cross_invitation':True,'current_occurrence':invitation['entity_ref'],'physical_role':'unknown'}
            else:
                for event in reversed(self.arc_events):
                    if not event.get('model'):continue
                    projected=plain(project_curve(event['model'],rows))
                    if projected['status']!='measured':continue
                    for mode in ('contact_solution','curve_disclosure'):
                        target=projected.get(mode)
                        if target is None:continue
                        point={'x':target[1],'y':target[0]};why=cfg['recall_question'];facts={'current_relocated_curve_hypothesis':projected};evidence+=event['evidence'];break
                    break
        models=[e['model']for e in reversed(self.arc_events)if e.get('model')]
        if point is None and current:
            fill=measure_scalar_fill_display(FrameGrid(rows=tuple(map(tuple,rows))))
            for model in models:
                projected=plain(project_curve(model,rows))
                if projected.get('status')!='measured'or not projected.get('contact_solution'):continue
                target=projected['contact_solution'];candidate={'action_ref':'ACTION6','data':{'x':target[1],'y':target[0]}}
                if any(e['command']==candidate and e.get('scalar_before',{}).get('scalar_fill_count')==fill.get('scalar_fill_count')for e in current):continue
                point=candidate['data'];mode='contact_solution';why=cfg['recall_question'];facts={'current_relocated_curve_hypothesis':projected,'retained_peer_binding':model.get('peer_binding','current_measured_peer')};evidence+=model['evidence'];break
        if models and (point is None or mode=='curve_disclosure'):
            compatible=next((m for m in models if calibration(m,rows)is not None),None)
            if compatible:
                fill=measure_scalar_fill_display(FrameGrid(rows=tuple(map(tuple,rows))));count=fill.get('scalar_fill_count');base=compatible['fill'].get('scalar_fill_count')
                scalar=[e for e in self.arc_events if e.get('scalar_change')is not None];known_increases=[e for e in scalar if e['scalar_change']>0 and e['command']['action_ref']in available]
                if isinstance(count,int)and isinstance(base,int)and fill.get('scalar_fill_display_present'):
                    if current and current[-1].get('mode')=='scalar_experiment'and count>base:
                        point=calibration(compatible,rows);mode='parameter_contrast';why=cfg['parameter_contrast_question'];facts={'current_scalar_fill':count,'previous_measured_fill':base,'retained_model_ref':compatible['model_ref'],'same_relative_aim_revalidated':True};evidence+=compatible['evidence']
                    elif mode!='contact_solution':
                        tried={e['command']['action_ref']for e in scalar};unknown=sorted(available-{'ACTION6'}-tried)
                        scalar_action=known_increases[-1]['command']['action_ref']if known_increases else(unknown[0]if unknown else None)
                        if scalar_action:
                            point=None;mode='scalar_experiment';why=cfg['parameter_question'];facts={'current_scalar_fill':count,'no_current_fitted_contact':True,'control_status':'conditionally_recalled_increase'if known_increases else'unknown_input_effect','retained_model_ref':compatible['model_ref'],'alternatives_remaining':unknown};evidence+=compatible['evidence']
            elif not any(e.get('mode')=='relocated_source_question'for e in current):
                hypotheses=[(m,source_role_probe(m,rows))for m in models]
                hypotheses=[(m,h)for m,h in hypotheses if h]
                if hypotheses:
                    model,hypothesis=hypotheses[0];point=hypothesis['point'];mode='relocated_source_question';why=cfg['source_role_question'];facts={'current_source_role_hypothesis':hypothesis,'role_confirmed':False};evidence+=model['evidence']
        if point is None and scalar_action is None:
            if self.arc_events:return {'status':'unknown','block_unrelated_probe':True,'reason':'measured_contact_continuation_requires_current_evidence'}
            return super().propose_graph(o,rows,inputs,limit,config)
        command={'action_ref':scalar_action}if scalar_action else{'action_ref':'ACTION6','data':point};ref='animated-contact:'+identity([o['observation_ref'],mode,command]);plan={'epoch':o['level_epoch'],'score':o['levels_completed'],'observation_ref':o['observation_ref'],'frame_digest':identity(rows),'command':command,'mode':mode}
        return {'status':'proposed','kind':'measured_animated_contact','proposal_id':ref,'animated_contact_plan':plan,'actions':[command],'steps':[{'action':command,'expected_after':None}],'facts':facts,'compositions':[{'id':ref,'observed':False,'open_question':why,'properties':{'roles':['current point invitation'if mode=='invitation'else'conditionally fitted transient contact']},'relations':['contributes_to:G_official_completion']}],'question':{'reason':why,'hypothesis_refs':evidence},'route_refs':evidence,'binding':{'level_epoch':o['level_epoch'],'observation_ref':o['observation_ref']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':[command],'purpose':why,'preconditions':facts,'evidence':evidence,'outcome_guard':{'path':['value'],'contains':ref}}}
    def before(self,p,index,rows,**meta):
        if'animated_contact_plan'not in p:return super().before(p,index,rows,**meta)
        plan=p['animated_contact_plan'];ok=index==0 and(meta['epoch'],meta['score'],meta['observation_ref'])==(plan['epoch'],plan['score'],plan['observation_ref'])and identity(rows)==plan['frame_digest']and p['actions']==[plan['command']]==p['bundle_template']['actions']and plan['command']['action_ref']in meta['available']
        ok=ok and p['proposal_id']=='animated-contact:'+identity([plan['observation_ref'],plan['mode'],plan['command']])
        return {'admitted':ok,'reason':'current_animation_question_bound'if ok else'animation_question_context_changed'}
    def after(self,p,index,rows,later,**meta):
        if'animated_contact_plan'not in p:return super().after(p,index,rows,later,**meta)
        return {'matched':None,'seal_prefix':True,'reason':'public_animation_requires_reconciliation'}
    def record(self,before,cmd,after,rows,later,proposal,index):
        events=super().record(before,cmd,after,rows,later,proposal,index)
        if'animated_contact_plan'in proposal:self.arc_pending={'before':before,'after':after,'command':cmd,'rows':rows,'later':later,'mode':proposal['animated_contact_plan']['mode']}
        return events
    def record_packet(self,before,cmd,after,rows,frames,episode):
        events=super().record_packet(before,cmd,after,rows,frames,episode);pending=self.arc_pending
        if not pending or pending['before']['observation_ref']!=before['observation_ref']:return events
        self.arc_pending=None;measurement={}
        if before['level_epoch']==after['level_epoch']:
            intermediate=frames[:-1]if frames and tuple(map(tuple,frames[-1]))==tuple(map(tuple,pending['later']))else frames
            measurement=_ordered_transient_component_path_facts(SceneTransitionMeasurementInput(before=FrameGrid(rows=tuple(map(tuple,rows))),intermediate_frames=tuple(FrameGrid(rows=tuple(map(tuple,f)))for f in intermediate),after=FrameGrid(rows=tuple(map(tuple,pending['later']))),transition_ref=identity([before['observation_ref'],after['observation_ref']]),action_ref=cmd['action_ref'],action_data=cmd.get('data',{}),context_epoch=before['level_epoch']))
        evidence=[before['observation_ref'],after['observation_ref']];model=acquire_curve(rows,intermediate,measurement,before['level_epoch'],evidence,cmd,[e['model']for e in self.arc_events if e.get('model')])if measurement else None
        first_fill=measure_scalar_fill_display(FrameGrid(rows=tuple(map(tuple,rows))));last_fill=measure_scalar_fill_display(FrameGrid(rows=tuple(map(tuple,pending['later']))));scalar_change=None
        if pending['mode']=='scalar_experiment'and before['level_epoch']==after['level_epoch']and first_fill.get('scalar_fill_display_present')and last_fill.get('scalar_fill_display_present'):scalar_change=last_fill['scalar_fill_count']-first_fill['scalar_fill_count']
        e={'kind':'measured_animated_contact','epoch':before['level_epoch'],'command':cmd,'mode':pending['mode'],'evidence':evidence,'packet_frames':len(frames),'measurement':measurement,'model':model,'scalar_before':first_fill,'scalar_after':last_fill,'scalar_change':scalar_change,'after_rows_digest':identity(pending['later']),'boundary':before['level_epoch']!=after['level_epoch'],'scope':'Ordered public raster measurement and provisional contact/disclosure calculus; no complete or universal physics asserted.'};self.arc_events.append(e);return events+[e]
