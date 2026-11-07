"""Reuse measured graph access under an explicit conditional library hypothesis."""
import copy
from collections import defaultdict
from cell_placement_access import CellPlacementAccess,input_candidates
from alternating_graph_observation import overlays,histogram,measure
from alternating_graph_questions import instrumental_contact,topology
from terminal_composition import identity

def signature(actor):return identity([actor['size'],actor['histogram']])
def box_at(position,q):return [position[0],position[1],position[0]+q-1,position[1]+q-1]
def points(box):return {(y,x)for y in range(box[0],box[2]+1)for x in range(box[1],box[3]+1)}

class AlternatingGraphAccess(CellPlacementAccess):
    def __init__(self):super().__init__();self.graph_samples=[];self.graph_refused=set();self.graph_terminal=[];self.graph_events=[];self.graph_calibration=None;self.graph_contacts=[];self.graph_removals=[]
    def retained_digest(self):return identity([super().retained_digest(),self.graph_samples,sorted(self.graph_refused),self.graph_terminal,self.graph_events,self.graph_calibration,self.graph_contacts,self.graph_removals])
    def apply_event(self,event):
        if event.get('kind')=='alternating_graph_evidence':
            self.graph_samples=copy.deepcopy(event['samples']);self.graph_refused=set(event['refused']);self.graph_terminal=copy.deepcopy(event['terminal']);self.graph_calibration=copy.deepcopy(event.get('calibration'));self.graph_contacts=copy.deepcopy(event.get('contacts',[]));self.graph_removals=copy.deepcopy(event.get('removals',[]));self.graph_events.append(copy.deepcopy(event));return
        super().apply_event(event)
    def emit_graph(self,detail):
        e={'kind':'alternating_graph_evidence','samples':copy.deepcopy(self.graph_samples),'refused':sorted(self.graph_refused),'terminal':copy.deepcopy(self.graph_terminal),'calibration':copy.deepcopy(self.graph_calibration),'contacts':copy.deepcopy(self.graph_contacts),'removals':copy.deepcopy(self.graph_removals),'detail':detail};self.apply_event(e);return e
    def propose_graph(self,obs,rows,inputs,max_prefix,config):
        cfg=config.get('alternating_graph_question')
        if not cfg or max_prefix<1:return {'status':'abstained','reason':'graph_question_not_enabled'}
        current=overlays(rows);offers=[];unresolved=False
        for actor in current:
            sig=signature(actor);samples=[s for s in self.graph_samples if s['signature']==sig];by=defaultdict(set)
            for s in samples:by[s['action']].add(tuple(s['delta']))
            controls={a:next(iter(ds))for a,ds in by.items()if len(ds)==1 and a in obs['available_action_refs']}
            if len(controls)<2 or len(set(controls.values()))<2:continue
            evidence=[r for s in samples for r in s['evidence']];last=next((s['action']for s in reversed(samples)if s['action']in controls),None)
            m=measure(rows,obs,actor,controls,evidence,last,marker_precaution=cfg.get('marker_precaution_hypothesis',False))
            route=m.get('alternating_material_first_shortest_action_refs',());instrumental=None
            pending=next((c for c in reversed(self.graph_contacts)if c['epoch']==obs['level_epoch']and c['status']=='occlusion_or_removal_unknown'and c.get('requires_revalidation')and c['bbox']==actor['bbox']and c['actor_signature']==sig),None)
            if pending and self.graph_calibration:
                delta=(pending['entry_from'][0]-actor['bbox'][0],pending['entry_from'][1]-actor['bbox'][1]);reverse=[a for a,d in controls.items()if tuple(d)==delta]
                if len(reverse)==1:
                    route=reverse;m=copy.deepcopy(self.graph_calibration);m['alternating_material_measurement_frame_ref']=obs['observation_ref'];instrumental={'validation_departure':True,'evidence':pending['evidence'],'scope':'Return once to the observed entry support and inspect the previously covered occurrence before depending on its absence.'};evidence+=pending['evidence']
                else:unresolved=True;continue
            if (not route or not m.get('translated_overlay_matches_alternating_pitch_and_edge'))and self.graph_calibration:
                if topology(rows,actor,self.graph_calibration):
                    unresolved=True
                    instrumental=instrumental_contact(rows,actor,controls,self.graph_calibration,self.graph_removals,config.get('remaining_level_actions',40))
                    if instrumental:
                        raw=m;m=copy.deepcopy(self.graph_calibration);m.update(alternating_material_measurement_frame_ref=obs['observation_ref'],alternating_material_graph_node_count=instrumental['node_count'],alternating_material_graph_edge_count=instrumental['edge_count'],static_current_measurement=raw);route=[s['action_ref']for s in instrumental['prefix']];evidence+=instrumental['evidence']
            if not route:continue
            q=actor['size'];pos=actor['bbox'][:2];steps=[];trial=identity([obs['level_epoch'],sig,pos,rows,route[0]])
            if trial in self.graph_refused:continue
            for action in route[:max_prefix]:
                delta=controls[action];dest=[pos[0]+delta[0],pos[1]+delta[1]];b=box_at(dest,q);h=histogram(rows,b)
                ordinary=h==[[m['alternating_material_first_value'],q*q]]
                steps.append({'action_ref':action,'from':pos,'to':dest,'destination_histogram':h,'ordinary_support':ordinary});pos=dest
                if not ordinary:break
            if not steps:continue
            plan={'epoch':obs['level_epoch'],'score':obs['levels_completed'],'observation_ref':obs['observation_ref'],'initial_digest':identity(rows),'actor':actor,'signature':sig,'steps':steps,'measurement':m,'evidence':evidence,'trial':trial,'instrumental_contact':instrumental,'scope':'Conditional measured lattice access. Exceptional uniform overlay is a possible objective; directional-marker exclusion is a supplied precaution hypothesis, not acquired reaction physics. Contact closes the set. Border signal changes are observed but do not certify resource semantics.'}
            offers.append((len(route),plan))
        if len(offers)!=1:return {'status':'abstained','reason':'graph_change_question_unresolved'if unresolved else'graph_access_absent_or_ambiguous','block_unrelated_probe':unresolved}
        _,plan=offers[0];actions=[{'action_ref':s['action_ref']}for s in plan['steps']];ref='C_graph_access_'+identity(plan)[:18];why=cfg.get('instrumental_question',cfg['question'])if plan['instrumental_contact']else cfg['question'];facts={'current_alternating_graph_measured':True,'action_conditioned_overlay_bound':True,'reaction_and_terminal_roles_remain_conditional':True};evidence=[obs['observation_ref']]+plan['evidence']
        plan['commands']=copy.deepcopy(actions)
        return {'status':'proposed','kind':'alternating_graph_access','proposal_id':ref,'graph_access_plan':plan,'actions':actions,'steps':[{'action':a,'expected_after':{'actor_position':s['to'],'contact_effect':'unknown'if not s['ordinary_support']else'conditional_support_arrival'}}for a,s in zip(actions,plan['steps'])], 'facts':facts,'compositions':[{'id':ref,'observed':False,'open_question':why,'properties':{'roles':cfg['roles']},'relations':['contributes_to:G_official_completion']}],'question':{'reason':'reuse_measured_multimaterial_graph_access','hypothesis_refs':evidence},'route_refs':evidence,'binding':{'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':actions,'purpose':why,'preconditions':facts,'evidence':evidence,'outcome_guard':{'path':['value'],'contains':ref}}}
    def before(self,p,index,rows,**meta):
        plan=p.get('graph_access_plan')
        if not plan:return super().before(p,index,rows,**meta)
        s=plan['steps'][index];b=box_at(s['from'],plan['actor']['size']);ok=(meta['epoch'],meta['score'])==(plan['epoch'],plan['score'])and p['actions']==plan['commands']and p['bundle_template']['actions']==p['actions']and s['action_ref']in meta['available']and histogram(rows,b)==plan['actor']['histogram']
        if index==0:ok=ok and identity(rows)==plan['initial_digest']and meta['observation_ref']==plan['observation_ref']
        return {'admitted':ok,'reason':'current_graph_actor_and_command_bound'if ok else'graph_context_or_payload_changed'}
    def after(self,p,index,rows,later,**meta):
        plan=p.get('graph_access_plan')
        if not plan:return super().after(p,index,rows,later,**meta)
        if meta['epoch']!=plan['epoch']or meta['score']!=plan['score']or meta.get('state')in ('WIN','GAME_OVER'):return {'matched':None,'seal_prefix':True,'reason':'official_boundary_or_terminal'}
        s=plan['steps'][index];q=plan['actor']['size'];old=box_at(s['from'],q);new=box_at(s['to'],q);allowed=points(old)|points(new);h=len(rows);w=len(rows[0]);extra=[(y,x)for y in range(1,h-1)for x in range(1,w-1)if rows[y][x]!=later[y][x]and(y,x)not in allowed]
        moved=histogram(later,new)==plan['actor']['histogram'];vacated=histogram(later,old)==[[plan['measurement']['alternating_material_first_value'],q*q]]
        matched=bool(moved and vacated and not extra)
        return {'matched':matched if s['ordinary_support']else None,'seal_prefix':not matched or not s['ordinary_support'],'reason':'conditional_graph_displacement'if matched else'graph_displacement_or_extra_effect_diverged','extra_effect_count':len(extra),'contact_effect_unknown':not s['ordinary_support']}
    def record(self,before,cmd,after,rows,later,proposal,index):
        events=super().record(before,cmd,after,rows,later,proposal,index);plan=proposal.get('graph_access_plan');detail={'before':before['observation_ref'],'after':after['observation_ref'],'action':cmd['action_ref']};changed=False
        if plan and plan['measurement'].get('unique_alternating_material_graph_description_present'):
            self.graph_calibration=copy.deepcopy(plan['measurement']);self.graph_calibration.pop('static_current_measurement',None);changed=True
        if before['level_epoch']==after['level_epoch']and before['levels_completed']==after['levels_completed']:
            a=overlays(rows);b=overlays(later);pairs=[]
            for x in a:
                matches=[y for y in b if signature(y)==signature(x)]
                if len(matches)==1 and sum(signature(z)==signature(x)for z in a)==1:
                    y=matches[0];d=[y['bbox'][0]-x['bbox'][0],y['bbox'][1]-x['bbox'][1]]
                    if (d[0]==0)!=(d[1]==0):pairs.append((x,y,d))
            if len(pairs)==1:
                x,y,d=pairs[0];self.graph_samples.append({'signature':signature(x),'histogram':x['histogram'],'size':x['size'],'action':cmd['action_ref'],'delta':d,'epoch':before['level_epoch'],'from':x['bbox'][:2],'to':y['bbox'][:2],'evidence':[before['observation_ref'],after['observation_ref']]});changed=True;detail['observed_translation']=d
                if self.graph_calibration:
                    for guard in a:
                        if guard['bbox']==y['bbox']and signature(guard)!=signature(x):
                            self.graph_contacts.append({'epoch':before['level_epoch'],'guard_histogram':guard['histogram'],'size':guard['size'],'bbox':guard['bbox'],'actor_signature':signature(x),'entry_from':x['bbox'][:2],'evidence':[before['observation_ref'],after['observation_ref']],'status':'occlusion_or_removal_unknown','requires_revalidation':bool(plan and plan.get('instrumental_contact'))})
                    for contact in self.graph_contacts:
                        if contact['epoch']==after['level_epoch']and contact['status']=='occlusion_or_removal_unknown'and contact['bbox']!=y['bbox']:
                            if histogram(later,contact['bbox'])==[[self.graph_calibration['alternating_material_first_value'],contact['size']**2]]:
                                contact['status']='ordinary_support_revealed_after_departure';contact['evidence'].append(after['observation_ref']);self.graph_removals.append(copy.deepcopy(contact));detail['revealed_contact_support']=contact['bbox']
                            elif histogram(later,contact['bbox'])==contact['guard_histogram']:contact['status']='occlusion_confirmed_no_removal'
            if plan:
                outcome=self.after(proposal,index,rows,later,epoch=after['level_epoch'],score=after['levels_completed'],state=after['state']);detail['outcome']=outcome
                if outcome['matched']is False:self.graph_refused.add(plan['trial']);changed=True
        elif plan and after['levels_completed']>before['levels_completed']:
            self.graph_terminal.append({'epoch':before['level_epoch'],'destination_histogram':plan['steps'][index]['destination_histogram'],'evidence':[before['observation_ref'],after['observation_ref']],'scope':'observed completion witness; no universal terminal predicate'});changed=True
        if changed:events.append(self.emit_graph(detail))
        return events
