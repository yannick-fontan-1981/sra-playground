"""Compare access options on surfaces actually traversed by a recurrent scored-episode role."""
from collections import defaultdict,deque
from scored_local_rewrite import ScoredRewriteAccess
from terminal_composition import identity,registered,Snapshot


def patch(rows,pos,size):
    x,y=pos;w,h=size
    if min(x,y)<0 or y+h>len(rows) or x+w>len(rows[0]):return None
    return identity([list(row[x:x+w]) for row in rows[y:y+h]])


def calibrated(samples):
    by_input=defaultdict(lambda:defaultdict(set));surfaces=defaultdict(set)
    for s in samples:
        key=s['role'],s['action'];delta=tuple(s['delta'])
        by_input[key][delta].add(tuple(s['origin']));surfaces[s['role'],s['surface']].add(tuple(s['origin']))
    roles=defaultdict(dict)
    for (role,action),deltas in by_input.items():
        if len(deltas)==1:
            v,positions=next(iter(deltas.items()))
            if len(positions)>=2:roles[role][action]=v
    return {role:moves for role,moves in roles.items() if any(x*j!=y*i for x,y in moves.values() for i,j in moves.values())},surfaces


class PassageOptions(ScoredRewriteAccess):
    def __init__(self):
        super().__init__();self.motion_samples=[];self.scores=[];self.refuted_positions=set()

    def apply_event(self,e):
        if e['kind']=='measured_lattice_steps':self.motion_samples.extend(e['samples'])
        elif e['kind']=='scored_passage_observation':self.scores.append(e)
        elif e['kind']=='passage_option_result' and e['result']=='refuted':self.refuted_positions.add(e['trial'])
        elif e['kind']!='passage_option_result':super().apply_event(e)

    def retained_digest(self):
        return identity([super().retained_digest(),self.motion_samples,self.scores,sorted(self.refuted_positions)])

    def record(self,before,command,after,rows,later,proposal,index):
        events=super().record(before,command,after,rows,later,proposal,index);extra=[]
        lookup=lambda o:{e['signature']:e for e in o['entities'] if not e['identity_ambiguous']}
        old,new=lookup(before),lookup(after);action=command['action_ref']
        if after['levels_completed']>before['levels_completed']:
            roles,surfaces=calibrated(self.motion_samples);observed=[]
            for sig,moves in roles.items():
                if sig not in old:continue
                sparse=[s for s in self.motion_samples if s['role']==sig and s['action']==action]
                deltas={tuple(s['delta']) for s in sparse}
                if action not in moves and len(deltas)!=1:continue
                box=old[sig]['bbox'];w,h=box[2]-box[0]+1,box[3]-box[1]+1
                dx,dy=moves[action] if action in moves else next(iter(deltas))
                surface=patch(rows,(box[0]+dx,box[1]+dy),(w,h))
                if len(surfaces[sig,surface])>=2:
                    witness={'role':sig,'action':action,'surface':surface}
                    if action not in moves:
                        witness.update(status='sparse_scored_contact_hypothesis',movement_evidence=[s['ref'] for s in sparse],
                            uncertainty='The scored step has no same-epoch destination observation; its contact surface is a hypothesis, not a calibrated movement.')
                    observed.append(witness)
            if observed:extra.append({'kind':'scored_passage_observation','epoch':before['level_epoch'],'source':before['observation_ref'],'roles':observed})
        elif before['frame_hash']!=after['frame_hash'] and before['level_epoch']==after['level_epoch'] and registered(Snapshot.from_public(before,rows),Snapshot.from_public(after,later)):
            samples=[]
            for sig in sorted(old.keys()&new.keys()):
                a,b=old[sig]['bbox'],new[sig]['bbox'];w,h=a[2]-a[0]+1,a[3]-a[1]+1
                dx,dy=b[0]-a[0],b[1]-a[1]
                if min(w,h)<2 or (dx,dy) not in {(w,0),(-w,0),(0,h),(0,-h)}:continue
                samples.append({'role':sig,'action':action,'origin':a[:2],'dest':b[:2],'delta':[dx,dy],'surface':patch(rows,b[:2],(w,h)),'epoch':before['level_epoch'],'ref':before['observation_ref']})
            if samples:extra.append({'kind':'measured_lattice_steps','samples':samples})
        if 'passage_plan' in proposal:
            outcome=self.after(proposal,index,rows,later,epoch=after['level_epoch'],score=after['levels_completed'],state=after['state'])
            extra.append({'kind':'passage_option_result','trial':proposal['passage_plan']['trial'],'result':'progress' if after['levels_completed']>before['levels_completed'] else 'matched' if outcome['matched'] else 'refuted','after':after['observation_ref']})
        for e in extra:self.apply_event(e)
        return events+extra

    def propose(self,episode,obs,rows,inputs,max_prefix,config):
        base=super().propose(episode,obs,rows,inputs,max_prefix,config)
        if base['status']=='proposed' or not config.get('compare_scored_passage_options') or len(self.scores)<2:return base
        prior=self.scores[-2:];shared=set((r['role'],r['surface']) for r in prior[0]['roles'])&set((r['role'],r['surface']) for r in prior[1]['roles'])
        if len(shared)!=1 or prior[0]['epoch']==prior[1]['epoch'] or prior[-1]['epoch']>=obs['level_epoch']:return base
        sig,surface=next(iter(shared))
        witnesses=[r for p in prior for r in p['roles'] if (r['role'],r['surface'])==(sig,surface)]
        commands={r['action'] for r in witnesses};scoring_command=next(iter(commands)) if len(commands)==1 else None
        entity=next((e for e in obs['entities'] if e['signature']==sig and not e['identity_ambiguous']),None)
        if not entity:return base
        roles,surfaces=calibrated(self.motion_samples);available={a['action_ref'] for a in inputs if not a.get('data')};moves={k:v for k,v in roles.get(sig,{}).items() if k in available}
        start=tuple(entity['bbox'][:2]);w=entity['bbox'][2]-start[0]+1;h=entity['bbox'][3]-start[1]+1
        valid={s for (role,s),origins in surfaces.items() if role==sig and len(origins)>=2}
        observed=[e for e in self.motion_samples if e['epoch']==obs['level_epoch'] and e['role']==sig]
        visited={tuple(x) for e in observed for x in (e['origin'],e['dest'])}|{start}
        def walk(pos,delta):return pos[0]+delta[0],pos[1]+delta[1]
        choices=[]
        for action,v in moves.items():
            target=walk(start,v);target_surface=patch(rows,target,(w,h))
            trial=identity([obs['level_epoch'],sig,start,action,target_surface])
            if target_surface not in valid or trial in self.refuted_positions or target in visited:continue
            reach={start,target};queue=deque([(target,0)]);exits=0
            while queue:
                pos,d=queue.popleft()
                if d>=config['passage_lookahead']:continue
                for delta in moves.values():
                    nxt=walk(pos,delta)
                    if nxt not in reach and patch(rows,nxt,(w,h)) in valid:
                        reach.add(nxt);queue.append((nxt,d+1));exits+=d==0
            choices.append(((len(reach-visited),exits,int(action==scoring_command)),action,target,target_surface,trial))
        if not choices:return base
        rank,action,target,target_surface,trial=max(choices,key=lambda z:(z[0],z[1]));cmd={'action_ref':action}
        plan={'epoch':obs['level_epoch'],'score':obs['levels_completed'],'observation_ref':obs['observation_ref'],'role':sig,'origin':start,'target':target,'size':[w,h],
              'role_mask':entity['mask'],'palette':entity['palette_value'],'surface':target_surface,'action':action,'trial':trial,'options':[(a,list(r[:2])) for r,a,*rest in choices],
              'scoring_surface_hypothesis':surface,'scored_command':scoring_command,'scope':'Observed moves can also remain stationary; a new site and its continuation options are experimental.'}
        if scoring_command is None or any(r.get('status') for r in witnesses):
            plan['scored_contact_witnesses']=witnesses
            plan['contact_scope']='Recurrent role/surface hypothesis; scored command identity is contingent. Access uses only separately calibrated movements.'
        ref='C_scored_passage_'+identity(plan)[:18];why='Test a conditional translation onto a previously traversed surface that opens the greatest number of unvisited comparable positions.'
        facts={'conditional_lattice_attested':True,'two_scored_episodes':True,'current_surface_bound':True};evidence=[obs['observation_ref'],*[p['source'] for p in prior]]
        return {'status':'proposed','kind':'public_passage_options','proposal_id':ref,'passage_plan':plan,'actions':[cmd],'steps':[{'action':cmd,'expected_after':{'role':sig,'origin':list(target)}}],
            'facts':facts,'compositions':[{'id':ref,'observed':False,'open_question':why,'role':'conditional_exploration_access','properties':{'options':plan['options']},'relations':['contributes_to:G_official_completion']}],
            'question':{'reason':'reach_an_unvisited_site_with_observed_continuation_options','hypothesis_refs':evidence},'route_refs':evidence,'binding':{'level_epoch':plan['epoch'],'observation_ref':plan['observation_ref']},
            'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':[cmd],'purpose':why,'preconditions':facts,'evidence':evidence,'outcome_guard':{'path':['value'],'contains':ref}}}

    @staticmethod
    def located(plan,rows,point):
        return all(rows[point[1]+dy][point[0]+dx]==plan['palette'] for dx,dy in plan['role_mask'])

    def before(self,p,index,rows,**meta):
        plan=p.get('passage_plan')
        if not plan:return super().before(p,index,rows,**meta)
        bound=(index==0 and (meta['epoch'],meta['score'],meta['observation_ref'])==(plan['epoch'],plan['score'],plan['observation_ref']) and
               plan['action'] in meta['available'] and self.located(plan,rows,plan['origin']) and patch(rows,plan['target'],plan['size'])==plan['surface'])
        return {'admitted':bound,'reason':'local_passage_and_origin_bound' if bound else 'passage_or_scope_changed'}

    def after(self,p,index,before_rows,after_rows,**meta):
        plan=p.get('passage_plan')
        if not plan:return super().after(p,index,before_rows,after_rows,**meta)
        if meta['epoch']!=plan['epoch'] or meta['score']!=plan['score'] or meta['state'] in ('WIN','GAME_OVER'):return {'matched':None,'seal_prefix':True,'reason':'official_boundary_or_terminal'}
        matched=self.located(plan,after_rows,plan['target']) and not self.located(plan,after_rows,plan['origin'])
        return {'matched':matched,'seal_prefix':True,'reason':'new_local_position_observed' if matched else 'conditional_translation_refuted'}
