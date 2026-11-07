"""Discriminate repeatable field changes and an alternative framed control."""
from nested_control_access import NestedControlAccess,input_candidates
from geometric_observer import components,framed_patterns
from envelope_fill_observation import acquire_fields,state,directions
from terminal_composition import identity
class EnvelopeFillAccess(NestedControlAccess):
    def __init__(self):super().__init__();self.fill_events=[];self.fill_context=None
    def retained_digest(self):return identity([super().retained_digest(),self.fill_events,self.fill_context])
    def apply_event(self,e):
        if e['kind']=='envelope_fill_context':self.fill_events.append(e);self.fill_context=e['context'];self.requested_stop_reason=e['stop_reason'];return
        super().apply_event(e)
    def propose(self,episode,obs,rows,inputs,max_prefix,config):
        cfg=config.get('envelope_fill_question');ctx=self.fill_context
        if cfg and ctx and ctx['epoch']==obs['level_epoch']and ctx['phase']in('repeat','contrast','repeat_contrast'):
            target=ctx['forward']if ctx['phase']=='repeat'else ctx.get('contrast')
            if ctx['phase']=='contrast':
                old=ctx['forward'];w=old['bbox'][2]-old['bbox'][0]+1;h=old['bbox'][3]-old['bbox'][1]+1;matches=[]
                for p in framed_patterns(rows,components(rows)):
                    l,t,r,b=p['bbox']
                    if[r-l+1,b-t+1]!=[w,h]or p['bbox']==old['bbox']or len(p['mask'])<=1:continue
                    matches.append({'frame_ref':p['id'],'bbox':p['bbox'],'point':p['center'],'core_area':p['foreground_area'],'core_scale':p['scale'],'core_palette':p['color']})
                if len(matches)!=1:return {'status':'abstained','reason':'alternative_control_ambiguous'}
                target=matches[0]
            if target:return self.fill_question(obs,rows,target,cfg,ctx['phase'])
        return super().propose(episode,obs,rows,inputs,max_prefix,config)
    def fill_question(self,obs,rows,target,cfg,phase):
        x,y=target['point'];l,t,r,b=target['bbox']
        if not(0<=l<=x<=r<len(rows[0])and 0<=t<=y<=b<len(rows)):return None
        current=[p for p in framed_patterns(rows,components(rows))if p['bbox']==target['bbox']and p['center']==target['point']]
        if len(current)!=1:return None
        action={'action_ref':'ACTION6','data':{'x':x,'y':y}};plan={'epoch':obs['level_epoch'],'score':obs['levels_completed'],'observation_ref':obs['observation_ref'],'frame_digest':identity(rows),'selected':target,'action':action,'phase':phase,'expected_effect':'unknown','field_state_before':state(rows,self.fill_context['fields'])};ref='C_fill_'+identity(plan)[:20];facts={'current_framed_control_bound':True,'persistent_fields_measured':True};why=cfg['question']+' Current discriminant: '+phase+'.';evidence=[obs['observation_ref']]+self.fill_context['evidence']
        return {'status':'proposed','kind':'envelope_fill_experiment','proposal_id':ref,'nested_control_plan':plan,'envelope_fill_plan':plan,'actions':[action],'steps':[{'action':action,'expected_after':None}],'facts':facts,'compositions':[{'id':ref,'observed':False,'open_question':why,'properties':{'roles':cfg['roles']},'relations':['contributes_to:G_official_completion']}],'question':{'reason':'measure_envelope_'+phase,'hypothesis_refs':[]},'route_refs':evidence,'binding':{'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':[action],'purpose':why,'preconditions':facts,'evidence':evidence,'outcome_guard':{'path':['value'],'contains':ref}}}
    def record(self,before,command,after,rows,later,proposal,index):
        events=super().record(before,command,after,rows,later,proposal,index);plan=proposal.get('nested_control_plan')
        if not plan or before['level_epoch']!=after['level_epoch']:return events
        refs=[before['observation_ref'],after['observation_ref']];ctx=self.fill_context;stop=None
        if ctx is None:
            fields=acquire_fields(rows,later,refs)
            if len(fields)<2:return events
            initial={f['id']:f['initial_state']for f in fields};present=state(later,fields);ctx={'epoch':after['level_epoch'],'fields':fields,'initial':initial,'present':present,'history':[initial,present],'directions':directions(initial,present),'forward':plan['selected'],'phase':'repeat','evidence':refs}
        else:
            present=state(later,ctx['fields']);delta=directions(ctx['present'],present);phase=plan.get('phase');ctx={**ctx,'present':present,'evidence':ctx['evidence']+refs}
            if phase=='repeat':
                compatible=all(delta[k]in(0,v)for k,v in ctx['directions'].items())and any(delta.values());ctx['repeatable_extent_change']=compatible;ctx['phase']='contrast'
            elif phase=='contrast':
                previous=ctx['history'][-2];opposed=all(present[k]['appearance_digest']==v['appearance_digest']for k,v in previous.items());ctx['contrast']=plan['selected'];ctx['observed_previous_field_state_restored']=opposed;ctx['phase']='repeat_contrast'if opposed else'unknown'
                if not opposed:stop='alternative_control_effect_requires_composition'
            elif phase=='repeat_contrast':
                restored=all(present[k]['appearance_digest']==v['appearance_digest']for k,v in ctx['initial'].items());ctx['restored_measured_fields']=restored;ctx['phase']='service_choice_required'if restored else'unknown';stop='envelope_restoration_requires_service_choice'if restored else'field_restoration_unconfirmed'
            ctx['last_directions']=delta
            ctx['history']=ctx['history']+[present]
        event={'kind':'envelope_fill_context','context':ctx,'stop_reason':stop,'evidence':refs,'scope':'Pixel extents and conditional response direction only. Physical volumes/capacities/thresholds and global inverse law remain unknown.'};self.apply_event(event);return events+[event]
