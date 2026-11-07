"""Measured shared control activates joint access, with conditional collision guards."""
import copy
from collections import defaultdict
from alternating_graph_access import AlternatingGraphAccess,input_candidates
from coupled_pair_observation import pairs,match_pair,joint_route
from terminal_composition import identity

def pixels(box):return {(y,x)for y in range(box[0],box[2]+1)for x in range(box[1],box[3]+1)}
def present(rows,box,value):return all(rows[y][x]==value for y,x in pixels(box))

class CoupledPairAccess(AlternatingGraphAccess):
    def __init__(self):super().__init__();self.pair_state=None;self.pair_events=[];self.pair_initials={}
    def retained_digest(self):return identity([super().retained_digest(),self.pair_state,self.pair_events,self.pair_initials])
    def apply_event(self,event):
        if event.get('kind')=='coupled_pair_epoch_anchor':self.pair_initials[str(event['epoch'])]=copy.deepcopy(event);self.pair_events.append(copy.deepcopy(event));return
        if event.get('kind')=='coupled_pair_evidence':self.pair_state=copy.deepcopy(event['state']);self.pair_events.append(copy.deepcopy(event));return
        super().apply_event(event)
    def propose_graph(self,obs,rows,inputs,max_prefix,config):
        cfg=config.get('coupled_pair_question');s=self.pair_state
        if cfg and s and s['epoch']==obs['level_epoch']and max_prefix>0:
            if s.get('unresolved'):return {'status':'abstained','reason':'joint_projection_refuted_requires_new_causal_question','block_unrelated_probe':True,'unknown':s['unresolved']}
            pair=s['pair'];current=[p for p in pairs(rows)if p['value']==pair['value']and p['size']==pair['size']and sorted(p['boxes'])==sorted(pair['boxes'])]
            controls={};signs=[set(),set()]
            for a,ss in s['samples'].items():
                ds={tuple(x['deltas'][0])for x in ss if any(x['deltas'][0])}
                if len(ds)==1 and a in obs['available_action_refs']:controls[a]=next(iter(ds))
                for sample in ss:
                    for axis in (0,1):
                        a1,a2=sample['deltas'][0][axis],sample['deltas'][1][axis]
                        if a1 and a2 and abs(a1)==abs(a2):signs[axis].add(1 if a1*a2>0 else -1)
            if current and all(len(x)==1 for x in signs):
                route=joint_route(rows,pair,controls,s['floors'],[next(iter(x))for x in signs],config.get('remaining_level_actions',40),s['evidence'],cfg.get('exclude_unmatched_floor_mixtures',False))
                if route:
                    actions=[{'action_ref':a}for a in route['actions'][:max_prefix]];expected=route['expected'][:len(actions)]
                    trial=identity([obs['level_epoch'],rows,actions])
                    if trial not in s['refused']:
                        plan={'epoch':obs['level_epoch'],'score':obs['levels_completed'],'observation_ref':obs['observation_ref'],'initial_digest':identity(rows),'pair':copy.deepcopy(pair),'commands':copy.deepcopy(actions),'expected':expected,'trial':trial,'route':route,'hypotheses':cfg,'evidence':s['evidence'][-24:]}
                        ref='C_joint_pair_'+identity(plan)[:18];facts={'two_current_occurrences_bound':True,'shared_control_signs_measured':True,'passable_support_observed':True,'collision_and_meeting_are_conditional_hypotheses':True};why=cfg['question'];evidence=[obs['observation_ref']]+plan['evidence']
                        return {'status':'proposed','kind':'coupled_pair_access','proposal_id':ref,'pair_access_plan':plan,'actions':actions,'steps':[{'action':a,'expected_after':{'member_boxes':bs}}for a,bs in zip(actions,expected)],'facts':facts,'compositions':[{'id':ref,'observed':False,'open_question':why,'properties':{'roles':cfg['roles']},'relations':['contributes_to:G_official_completion']}],'question':{'reason':'activate_existing_joint_collision_search','hypothesis_refs':evidence},'route_refs':evidence,'binding':{'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':actions,'purpose':why,'preconditions':facts,'evidence':evidence,'outcome_guard':{'path':['value'],'contains':ref}}}
        return super().propose_graph(obs,rows,inputs,max_prefix,config)
    def before(self,p,index,rows,**meta):
        plan=p.get('pair_access_plan')
        if not plan:return super().before(p,index,rows,**meta)
        boxes=plan['pair']['boxes']if index==0 else plan['expected'][index-1]
        ok=(meta['epoch'],meta['score'])==(plan['epoch'],plan['score'])and p['actions']==plan['commands']and p['bundle_template']['actions']==p['actions']and p['actions'][index]['action_ref']in meta['available']and all(present(rows,b,plan['pair']['value'])for b in boxes)
        if index==0:ok=ok and identity(rows)==plan['initial_digest']and meta['observation_ref']==plan['observation_ref']
        return {'admitted':ok,'reason':'joint_members_and_command_bound'if ok else'joint_context_or_payload_changed'}
    def after(self,p,index,rows,later,**meta):
        plan=p.get('pair_access_plan')
        if not plan:return super().after(p,index,rows,later,**meta)
        if (meta['epoch'],meta['score'])!=(plan['epoch'],plan['score'])or meta['state']in ('WIN','GAME_OVER'):return {'matched':None,'seal_prefix':True,'reason':'official_boundary_or_terminal'}
        before=plan['pair']['boxes']if index==0 else plan['expected'][index-1];after=plan['expected'][index];allowed=set().union(*(pixels(b)for b in before+after));extra=sum(rows[y][x]!=later[y][x]for y in range(1,len(rows)-1)for x in range(1,len(rows[0])-1)if(y,x)not in allowed)
        matched=all(present(later,b,plan['pair']['value'])for b in after)and not extra
        return {'matched':matched,'seal_prefix':not matched,'reason':'conditional_joint_displacement'if matched else'joint_displacement_or_extra_effect_diverged','extra_effect_count':extra}
    def record(self,before,cmd,after,rows,later,proposal,index):
        events=super().record(before,cmd,after,rows,later,proposal,index)
        if str(before['level_epoch'])not in self.pair_initials:
            e={'kind':'coupled_pair_epoch_anchor','epoch':before['level_epoch'],'score':before['levels_completed'],'observation_ref':before['observation_ref'],'frame_digest':identity(rows),'interior_digest':identity([row[1:-1]for row in rows[1:-1]])};self.apply_event(e);events.append(e)
        if before['level_epoch']!=after['level_epoch']:return events
        bp=pairs(rows);ap=pairs(later);s=copy.deepcopy(self.pair_state)
        if s and s['epoch']==before['level_epoch']and proposal.get('pair_access_plan'):
            outcome=self.after(proposal,index,rows,later,epoch=after['level_epoch'],score=after['levels_completed'],state=after['state'])
            if outcome['matched']is False:
                anchor=self.pair_initials[str(before['level_epoch'])]
                s['refused'].append(proposal['pair_access_plan']['trial'])
                s['unresolved']={'kind':'joint_projection_refuted','evidence':[before['observation_ref'],after['observation_ref']],'whole_scene_initial_equal':identity(later)==anchor['frame_digest'],'interior_initial_equal':identity([row[1:-1]for row in later[1:-1]])==anchor['interior_digest'],'initial_observation_ref':anchor['observation_ref'],'scope':'No teleport/reset law or arbitrary member reassignment. Exact full-scene return and interior-only return remain distinct; supplied collision projection is unavailable pending a discriminating causal question.'}
                e={'kind':'coupled_pair_evidence','state':s,'evidence':s['unresolved']['evidence']};self.apply_event(e);events.append(e);return events
        if not s or s['epoch']!=before['level_epoch']:
            candidates=[p for p in bp if any(q['value']==p['value']and q['size']==p['size']and (m:=match_pair(p,q))and any(any(d)for d in m['deltas'])for q in ap)]
            if len(candidates)!=1:return events
            s={'epoch':before['level_epoch'],'pair':candidates[0],'samples':{},'floors':[],'evidence':[],'refused':[]}
        pair=s['pair'];candidates=[q for q in ap if q['value']==pair['value']and q['size']==pair['size']]
        if len(candidates)!=1:return events
        m=match_pair(pair,candidates[0])
        if not m:return events
        refs=[before['observation_ref'],after['observation_ref']];sample={'deltas':m['deltas'],'evidence':refs}
        if sample not in s['samples'].setdefault(cmd['action_ref'],[]):s['samples'][cmd['action_ref']].append(sample)
        occupied=set().union(*(pixels(b)for b in m['boxes']))
        for old,new in zip(pair['boxes'],m['boxes']):
            if old!=new:
                revealed={later[y][x]for y,x in pixels(old)-occupied}
                if len(revealed)==1 and next(iter(revealed))not in s['floors']:s['floors']+=list(revealed)
        s['pair']['boxes']=m['boxes'];s['evidence']+=refs
        if proposal.get('pair_access_plan'):
            outcome=self.after(proposal,index,rows,later,epoch=after['level_epoch'],score=after['levels_completed'],state=after['state'])
            if outcome['matched']is False:s['refused'].append(proposal['pair_access_plan']['trial'])
        e={'kind':'coupled_pair_evidence','state':s,'evidence':refs};self.apply_event(e);events.append(e);return events
