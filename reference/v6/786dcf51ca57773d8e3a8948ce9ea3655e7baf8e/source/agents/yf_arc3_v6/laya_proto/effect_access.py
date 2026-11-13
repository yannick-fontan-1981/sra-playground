"""Pre-score experiments grounded in correlated remote changes of this episode."""
import math
from collections import Counter,defaultdict,deque
from terminal_composition import Snapshot,identity,relative_motion,motion_models,registered,repeated_changes,local_patch,equality_pattern,orientation_patterns,add,check_access_before,check_access_after


def support_box(origin,size):
    return {(x,y) for x in range(origin[0]-1,origin[0]+size[0]+1) for y in range(origin[1]-1,origin[1]+size[1]+1)}


class EffectAccess:
    def __init__(self):
        self.tried=set();self.interventions={};self.failed=set();self._changes={}

    def apply_event(self,e):
        if e['kind']=='pre_score_effect_contact':self.tried.add(e['trial_key']);self.interventions[e['before_ref']]=e
        elif e['kind']=='pre_score_displacement_refuted':self.failed.add(e['premise_ref'])
        else:raise ValueError('Unexpected pre-score evidence')

    def retained_digest(self):return identity([sorted(self.tried),self.interventions,sorted(self.failed)])

    def _patterns(self,b,a):
        key=b.ref,a.ref
        if key not in self._changes:self._changes[key]=repeated_changes(b,a)
        return self._changes[key]

    def propose(self,episode,obs,rows,inputs,max_prefix,config):
        if len(episode)<3:return {'status':'abstained','reason':'no_measured_contact_effect'}
        current=Snapshot.from_public(obs,rows);available={a['action_ref'] for a in inputs if not a.get('data')};offers=[]
        for sig,measured in motion_models(episode,current):
            moves={k:tuple(v) for k,v in measured.items() if k in available}
            if len(set(moves.values()))<2:continue
            box=current.roles[sig];size=box[2]-box[0]+1,box[3]-box[1]+1;start=box[:2]
            dx=math.gcd(*(abs(v[0]) for v in moves.values()));dy=math.gcd(*(abs(v[1]) for v in moves.values()))
            if not dx or not dy:continue
            # An unpaired reverse displacement is a candidate experiment. Its
            # physical effect is never installed as a measured control mapping.
            missing=available-moves.keys();reverse={(-v[0],-v[1]) for v in moves.values()}-set(moves.values());hyp=None
            if len(missing)==len(reverse)==1:hyp=next(iter(missing));moves[hyp]=next(iter(reverse))
            visible=[e for e in obs['entities'] if e['signature']==sig and not e.get('identity_ambiguous')]
            if len(visible)!=1:continue
            cells={(x,y):local_patch(current,(x,y),size) for x in range(start[0]%dx,len(rows[0]),dx) for y in range(start[1]%dy,len(rows),dy)}
            cells={k:v for k,v in cells.items() if v is not None};passages=defaultdict(set);contradicted=set();contacts=[];edges=defaultdict(set);remote_changes={}
            for b,action,a in episode:
                if b.epoch!=current.epoch or a.epoch!=current.epoch or sig not in b.roles or sig not in a.roles or not registered(b,current) or not registered(a,current):continue
                saved=self.interventions.get(b.ref);v=measured.get(action)
                if v is None and saved and saved['role']==sig:v=tuple(saved['provisional_vector'])
                if v is None:continue
                origin=b.roles[sig][:2];dest=add(origin,v);land=a.roles[sig][:2];surface=local_patch(b,dest,size)
                if surface is None:continue
                if land==dest:
                    if action in measured:passages[surface].add(origin)
                    continue
                contradicted.add(surface)
                if land==origin:continue
                edges[origin,action,dest,surface].add(land)
                ignored=support_box(origin,size)|support_box(dest,size)|support_box(land,size)
                groups={key:regs for key,regs in self._patterns(b,a).items() if all(not (reg&ignored) for reg in regs)}
                if not groups:continue
                contacts.append({'site':dest,'surface':surface,'families':sorted(groups),'source':b.ref,'response':a.ref,'action':action})
                family_points={point for regs in groups.values() for region in regs for point in region}
                unexplained={(x,y) for y,(old,new) in enumerate(zip(b.rows,a.rows)) for x,(v1,v2) in enumerate(zip(old,new)) if v1!=v2}-(ignored|family_points)
                for point in cells:
                    pixels=support_box(point,size)
                    if not pixels&unexplained or pixels&(ignored|family_points):continue
                    old=local_patch(b,point,size);new=local_patch(a,point,size)
                    if old is not None and new is not None and old!=new:
                        remote_changes[point]={'from_pattern':old,'to_pattern':new,'source':b.ref,'response':a.ref,'changed_pixel_count':len(pixels&unexplained)}
            initial=not contacts
            if initial and not config.get('initial_contact_question',{}).get('enabled'):continue
            seen_sites={e['site'] for e in contacts};observed={e['surface'] for e in contacts};shapes=set().union(*(orientation_patterns(p,size) for p in observed))
            passages={surface for surface,sources in passages.items() if len(sources)>=config['minimum_passage_positions'] and surface not in contradicted}
            changed={loc:val for loc,val in remote_changes.items() if cells.get(loc)==val['to_pattern']}
            context=identity([current.epoch,sig,sorted((p,c['to_pattern']) for p,c in changed.items()),sorted(seen_sites)])
            targets={p:'test_remote_appearance_change' for p in changed}
            exploratory={p:'test_related_contact_occurrence' for p,s in cells.items() if (s in observed or equality_pattern(s) in shapes) and p not in seen_sites}
            if config['test_alternative_part_arrangements']:
                # Same part multiplicities are a weaker, rival description of
                # the exemplar. They justify a bounded discriminating contact,
                # never an equivalence of objects or an acquired physical law.
                part_counts={tuple(sorted(Counter(s).values())) for s in observed if len(set(s))>1}
                for p,s in cells.items():
                    if p not in seen_sites and p not in exploratory and s not in passages and tuple(sorted(Counter(s).values())) in part_counts:
                        exploratory[p]='discriminate_contact_part_arrangement'
            if initial:
                # Visible contrast justifies a question, not an acquired physical service.
                exploratory={p:'acquire_visible_contact_response' for p,s in cells.items()
                    if p!=start and s not in passages and len(set(s))>1}
            # If a new appearance is present, the first objective is its guarded
            # physical test. Previously observed nonlocal edges remain access.
            query_sets=[targets,exploratory] if targets else [exploratory]
            for targets_now in query_sets:
                if not targets_now:continue
                parent={start:None};queue=deque([start]);experiments=[]
                while queue:
                    pos=queue.popleft()
                    for action,v in sorted(moves.items()):
                        dest=add(pos,v);surface=cells.get(dest)
                        if surface is None:continue
                        key=identity([current.epoch,sig,pos,action,dest,surface,context]);trial=identity([current.epoch,sig,dest,surface,context])
                        if key in self.failed:continue
                        possible=edges.get((pos,action,dest,surface),set())
                        if possible:
                            if len(possible)==1:
                                landing=next(iter(possible))
                                if landing in cells and landing not in parent:parent[landing]=(pos,action,'conditional_observed_access',dest,key);queue.append(landing)
                            continue
                        if dest in targets_now:
                            if trial not in self.tried:experiments.append((pos,action,dest,key,trial))
                            continue
                        if dest not in parent and surface in passages:
                            parent[dest]=(pos,action,'test_unpaired_inverse' if action==hyp else 'conditional_translation',None,key);queue.append(dest)
                if not experiments:continue
                pos,action,dest,key,trial=experiments[0];path=[{'action_ref':action,'from':list(pos),'to':list(dest),'effect':'unknown_then_observe','premise_ref':key,'input_status':'inverse_hypothesis' if action==hyp else 'measured'}]
                while parent[pos] is not None:
                    origin,act,effect,contact,premise=parent[pos];path.append({'action_ref':act,'from':list(origin),'to':list(pos),'effect':effect,'contact':list(contact) if contact else None,'premise_ref':premise,'input_status':'inverse_hypothesis' if act==hyp else 'measured'});pos=origin
                path.reverse();prefix=path[:max_prefix]
                for i,step in enumerate(prefix):
                    if step['effect'] in {'conditional_observed_access','test_unpaired_inverse'}:prefix=prefix[:i+1];break
                for step in prefix:step['surface_before']=list(cells[tuple(step.get('contact') or step['to'])])
                plan={'status':'proposed','kind':targets_now[dest],'epoch':current.epoch,'score':current.score,'observation_ref':current.ref,'role':sig,'role_size':list(size),'role_mask':visible[0]['mask'],'role_value':visible[0]['palette_value'],
                    'site':list(dest),'condition_digest':context,'trial_key':trial,'prefix':prefix,'planned_steps':len(path),'known_controls':{a:list(v) for a,v in measured.items()},
                    'inverse_candidate':{'action_ref':hyp,'vector':list(moves[hyp]),'status':'unconfirmed input association; experimental step only'} if hyp else None,
                    'initial_contact_acquisition':initial,'observed_nonlocal_contact_count':len(contacts),'contact_evidence':[e['source'] for e in contacts],
                    'remote_effect_families':sorted({k for e in contacts for k in e['families']}),'remote_change_evidence':changed.get(dest),
                    'control_surface_evidence':list(dict.fromkeys(ref for b,aftkey,aft in episode if b.epoch==aft.epoch==current.epoch and sig in b.roles and sig in aft.roles and registered(b,current) and registered(aft,current) and aftkey in measured and relative_motion(b,aft,sig)==tuple(measured[aftkey]) for ref in (b.ref,aft.ref))),'reachable_contact_alternatives':[{'site':list(e[2]),'action_ref':e[1]} for e in experiments] if initial else [],'reachable_positions':len(parent),'candidate_sites':len(targets_now),'scope':('current measured motion and visible contact question; outcome and terminal role unknown' if initial else 'current-episode measured joint change; role, utility and terminal action remain hypotheses')}
                offers.append(plan);break
        if not offers:return {'status':'abstained','reason':'no_reachable_bound_effect_question'}
        if len({identity([p['role'],p['site'],p['prefix']]) for p in offers})!=1:return {'status':'abstained','reason':'competing_effect_role_models'}
        route=offers[0];commands=[{'action_ref':s['action_ref']} for s in route['prefix']];op='OP18' if route['prefix'][-1]['effect'] in {'unknown_then_observe','test_unpaired_inverse'} else 'OP28';ref='C_public_effect_'+identity(route)[:20]
        why='Approach a separately changed public site and observe the outcome.' if route['kind']=='test_remote_appearance_change' else 'Test a fresh occurrence related to a contact that produced a nonlocal displacement and a repeated remote change.'
        initial=route.get('initial_contact_acquisition',False)
        if initial:why=config['initial_contact_question']['purpose']
        facts={'role_and_local_surface_bound':True,**({'distinct_current_material_contact_question':True} if initial else {'effect_observed_this_epoch':True})};comp={'id':ref,'observed':False,'role':'material_effect_experiment','properties':{'role_signature':route['role'],'site':route['site'],'remote_effect_families':route['remote_effect_families'],'terminal_role':'unknown'},'relations':['contributes_to:G_official_completion']}
        if op=='OP18':comp['open_question']=why
        evidence=[route['observation_ref'],*route['control_surface_evidence'],*route['contact_evidence'],'effect_plan:'+identity(route)]
        return {'status':'proposed','kind':'observed_effect_access','proposal_id':'effect:'+identity(route),'effect_plan':route,'actions':commands,'steps':[{'action':a,'expected_after':None if s['effect']=='unknown_then_observe' else {'kind':'conditional_local_geometry','from':s['from'],'to':s['to'],'effect':s['effect']}} for a,s in zip(commands,route['prefix'])],
            'question':{'reason':route['kind'],'hypothesis_refs':route['contact_evidence']},'facts':facts,'compositions':[comp],'route_refs':evidence,'binding':{'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref']},
            'bundle_template':{'operation_key':op,'composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':commands,'purpose':why,'preconditions':facts,'evidence':evidence,'outcome_guard':{'path':['value'],'contains':ref if op=='OP18' else 'B0'}}}

    def before(self,p,index,rows,**metadata):return check_access_before(p['effect_plan'],index,rows,**metadata)
    def after(self,p,index,first,last,**metadata):
        observed=check_access_after(p['effect_plan'],index,first,last,**metadata)
        if p['effect_plan']['prefix'][index]['effect']=='test_unpaired_inverse':observed={**observed,'seal_prefix':True}
        return observed

    def record(self,before,action,after,first,last,p,index):
        if 'effect_plan' not in p:return []
        plan=p['effect_plan'];step=plan['prefix'][index];events=[]
        if step['effect']=='unknown_then_observe':
            groups=self._patterns(Snapshot.from_public(before,first),Snapshot.from_public(after,last)) if before['level_epoch']==after['level_epoch'] else {}
            e={'kind':'pre_score_effect_contact','trial_key':plan['trial_key'],'before_ref':before['observation_ref'],'after_ref':after['observation_ref'],'role':plan['role'],'action':action['action_ref'],'provisional_vector':list((v-u for u,v in zip(step['from'],step['to']))),'input_status':step['input_status'],'expected_families':plan['remote_effect_families'],'matched_families':sorted(set(groups)&set(plan['remote_effect_families'])),'score_delta':after['levels_completed']-before['levels_completed']};self.apply_event(e);events.append(e)
        elif before['level_epoch']==after['level_epoch'] and not self.after(p,index,first,last,epoch=after['level_epoch'],score=after['levels_completed'],state=after['state'])['matched']:
            e={'kind':'pre_score_displacement_refuted','premise_ref':step['premise_ref'],'before_ref':before['observation_ref'],'after_ref':after['observation_ref']};self.apply_event(e);events.append(e)
        return events
