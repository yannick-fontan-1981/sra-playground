"""Discover a possible scoring composition from an observed level boundary.

Inputs are public rasters, uniquely measured component occurrences, commands and
the public score. No game registry, goal sprite, palette or lattice is supplied.
"""
from collections import Counter, defaultdict, deque
from dataclasses import dataclass
import hashlib
import json
import math


def identity(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


@dataclass(frozen=True)
class Snapshot:
    rows: tuple
    roles: dict
    epoch: int
    score: int
    ref: str
    frame_hash: str

    @classmethod
    def from_public(cls, observation, rows):
        roles = {entity['signature']: tuple(entity['bbox']) for entity in observation['entities']
                 if not entity['identity_ambiguous']}
        return cls(tuple(bytes(row) for row in rows), roles, observation['level_epoch'],
                   observation['levels_completed'], observation['observation_ref'], observation['frame_hash'])


def local_patch(scene, origin, size):
    """One pixel around the role's bounding box includes its immediate neighbours."""
    x, y = origin
    width, height = size
    if min(x, y) < 1 or y + height >= len(scene.rows) or x + width >= len(scene.rows[0]):
        return None
    return tuple(v for row in scene.rows[y-1:y+height+1] for v in row[x-1:x+width+1])


def equality_pattern(patch):
    labels = {}
    return tuple(labels.setdefault(value, len(labels)) for value in patch)


def orientation_patterns(patch, size):
    """Unverified orientations of a measured motif. Preserve its dimensions."""
    width,height=size[0]+2,size[1]+2
    matrix=[patch[i*width:(i+1)*width] for i in range(height)]
    forms=set()
    for _ in range(4):
        if len(matrix)==height and len(matrix[0])==width:
            for variant in (matrix,[r[::-1] for r in matrix]):
                forms.add(equality_pattern([v for row in variant for v in row]))
        matrix=[list(r) for r in zip(*matrix[::-1])]
    return forms


def add(point, displacement):
    return point[0] + displacement[0], point[1] + displacement[1]


def relative_motion(before, after, signature):
    first = before.roles.get(signature)
    last = after.roles.get(signature)
    if first is not None and last is not None:
        return (last[0] - first[0], last[1] - first[1])


def registered(first, last):
    """Three stationary non-collinear unique public landmarks support registration."""
    stable = {box[:2] for sig, box in first.roles.items() if last.roles.get(sig) == box}
    if len(stable) < 3:
        return False
    a, b, *others = sorted(stable)
    return any((b[0]-a[0])*(y-a[1]) != (b[1]-a[1])*(x-a[0]) for x, y in others)


def motion_models(transitions, terminal):
    # Count movement and stationarity, preserve competing outcomes. Membership
    # in a model needs support at two distinct source positions per action.
    counts = defaultdict(lambda: defaultdict(Counter))
    positions = defaultdict(set)
    for before, action, after in transitions:
        for sig in before.roles.keys() & after.roles.keys():
            delta = relative_motion(before, after, sig)
            counts[sig][action][delta] += 1
            positions[sig, action, delta].add(before.roles[sig][:2])
    for sig in sorted(terminal.roles):
        moves = {}
        for action, effects in counts[sig].items():
            best = effects.most_common(2)
            delta, n = best[0]
            if delta != (0, 0) and (len(best) == 1 or best[1][1] < n) and len(positions[sig, action, delta]) >= 2:
                moves[action] = delta
        if len(set(moves.values())) >= 2:
            yield sig, moves


def repeated_changes(before, after):
    """Families of two or more independently located, identically rewritten patches."""
    remaining = {(x, y) for y, row in enumerate(after.rows) for x, value in enumerate(row)
                 if value != before.rows[y][x]}
    families = defaultdict(list)
    while remaining:
        region = {remaining.pop()}
        queue = list(region)
        while queue:
            x, y = queue.pop()
            for cell in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
                if cell in remaining:
                    remaining.remove(cell)
                    region.add(cell)
                    queue.append(cell)
        x0 = min(x for x, y in region)
        y0 = min(y for x, y in region)
        key = identity(sorted((x-x0,y-y0,before.rows[y][x],after.rows[y][x]) for x, y in region))
        families[key].append(region)
    return {k: v for k,v in families.items() if len(v) >= 2}


def scoring_contact_direction(episode, sig, moves, contact):
    """Recover a prospective contact as a falsifiable, sparsely sampled control."""
    if not contact:
        return None
    terminal, action, _ = episode[-1]
    route, index = contact
    step = route['prefix'][index]
    if (route['role'] != sig or route['epoch'] != terminal.epoch or route['score'] != terminal.score
            or step['action_ref'] != action or step['input_status'] != 'inverse_hypothesis'
            or step['effect'] != 'unknown_then_observe' or tuple(step['from']) != terminal.roles[sig][:2]
            or step['to'] != route['site'] or not route['remote_change_evidence']):
        return None
    delta = tuple(b-a for a,b in zip(step['from'],step['to']))
    vectors = set(moves.values())
    missing = {(-x,-y) for x,y in vectors} - vectors
    if missing != {delta} or len({x*j-y*i for x,y in vectors for i,j in vectors} - {0}) == 0:
        return None
    alternatives = set(vectors) | missing
    local = [(b.ref,relative_motion(b,a,sig)) for b,key,a in episode[:-1]
             if key == action and sig in b.roles and sig in a.roles and registered(b,terminal) and registered(a,terminal)]
    witnesses = [ref for ref,v in local if v == delta]
    if not witnesses or any(v in alternatives and v != delta for _,v in local):
        return None
    return {'action_ref':action,'delta':list(delta),'local_witnesses':witnesses,'contact_ref':terminal.ref,
            'qualification':'One-step geometric hypothesis from committed scoring contact; test before further use'}


def fit_boundary(episode, contact=None):
    """The last transition must be the first observed score increase of this epoch."""
    terminal, scoring_action, entered = episode[-1]
    if entered.score <= terminal.score or any(b.epoch != terminal.epoch or a.epoch != b.epoch for b, _, a in episode[:-1]):
        raise ValueError('A continuous public prefix ending in a scoring boundary is required')
    changes = [repeated_changes(b,a) for b,_,a in episode[:-1]]
    models = []
    for sig, moves in motion_models(episode[:-1], terminal):
        tentative = None
        if scoring_action not in moves:
            tentative = scoring_contact_direction(episode,sig,moves,contact)
            if tentative is None:
                continue
            moves = {**moves, scoring_action:tuple(tentative['delta'])}
        left,top,right,bottom = terminal.roles[sig]
        size = right-left+1, bottom-top+1
        goal_site = add((left,top), moves[scoring_action])
        final_pattern = local_patch(terminal, goal_site, size)
        if not final_pattern or len(set(final_pattern)) < 2:
            continue
        versions = defaultdict(set)
        enabling_families = set()
        passable = defaultdict(set)
        contradicted = set()
        for (b,action,a), groups in zip(episode[:-1], changes):
            if not registered(b,terminal) or not registered(a,terminal):
                continue
            original, resulting = (local_patch(s,goal_site,size) for s in (b,a))
            if original is None or resulting is None:
                continue
            versions[original].add(b.frame_hash)
            # Locate other, separated changes that accompany the change at the
            # possible goal. Co-occurrence makes a question, not a causal law.
            if original != resulting and resulting == final_pattern:
                x,y=goal_site
                target_area={(u,v) for u in range(x-1,x+size[0]+1) for v in range(y-1,y+size[1]+1)}
                enabling_families.update(k for k, regions in groups.items() if all(not (target_area & region) for region in regions))
            if sig not in b.roles or action not in moves:
                continue
            dest=add(b.roles[sig][:2],moves[action])
            patch=local_patch(b,dest,size)
            if patch is None: continue
            if relative_motion(b,a,sig)==moves[action]:
                passable[patch].add(b.roles[sig][:2])
            else:
                contradicted.add(patch)
        terminal_variants=[list(p) for p, frames in versions.items() if p != final_pattern and len(frames)>=2]
        probes=[]
        for (b,action,a), groups in zip(episode[:-1],changes):
            shared = enabling_families & groups.keys()
            if not shared or sig not in b.roles or action not in moves:
                continue
            patch = local_patch(b,add(b.roles[sig][:2],moves[action]),size)
            if patch is not None:
                probes.append({'pattern':list(patch),'topology':list(equality_pattern(patch)),
                    'observed_command':action,'event_families':sorted(shared),'source_ref':b.ref,'result_ref':a.ref})
        models.append({'role':sig,'size':list(size),'moves':{k:list(v) for k,v in moves.items()},
                       'scoring_pattern':list(final_pattern),'earlier_site_patterns':terminal_variants,
                       'observed_passages':[list(p) for p,sources in sorted(passable.items()) if len(sources)>=2 and p not in contradicted],
                       'possible_prerequisites':probes,'boundary_before':terminal.ref,'boundary_after':entered.ref,
                       'score_before':terminal.score,'score_after':entered.score,
                       'qualification':'Observed scoring approach and correlated changes. Goal role and prerequisite necessity are hypotheses.'})
        if tentative:
            models[-1]['tentative_scoring_control'] = tentative
    return models


def occurrence_at(epoch, role, site):
    return {'epoch':epoch,'role':role,'site':list(site)}


def propose_access(model, current, tried=(), max_prefix=16, transfers=(), observed_context=(), refuted=(), occurrences=()):
    """Compute a conditional access to a scoring or information composition.

    Predictions concern the moving role on a known surface. Entering a putative
    trigger or goal is the last step and has an unknown effect until observed.
    This function supplies alternatives and a plan, never an execution permit.
    """
    sig=model['role']
    if sig not in current.roles: return {'status':'role_unbound'}
    start=current.roles[sig][:2]
    size=model['size']
    moves={k:tuple(v) for k,v in model['moves'].items()}
    dx=math.gcd(*(abs(v[0]) for v in moves.values()))
    dy=math.gcd(*(abs(v[1]) for v in moves.values()))
    if not dx or not dy: return {'status':'insufficient_translation_basis'}
    surfaces={tuple(v) for v in model['observed_passages']}
    earlier={tuple(v) for v in model['earlier_site_patterns']}
    terminal=tuple(model['scoring_pattern'])
    probes={tuple(p['pattern']) for p in model['possible_prerequisites']}
    topologies={tuple(p['topology']) for p in model['possible_prerequisites']}
    rotated=set().union(*(orientation_patterns(p,size) for p in probes))
    cells={}
    for y in range(start[1]%dy,len(current.rows),dy):
        for x in range(start[0]%dx,len(current.rows[0]),dx):
            value=local_patch(current,(x,y),size)
            if value is not None: cells[x,y]=value
    goals=[k for k,p in cells.items() if p==terminal]
    earlier_sites=[k for k,p in cells.items() if p in earlier]
    precursors={k:('literal_precursor' if p in probes else 'relocated_shape_precursor'
                    if equality_pattern(p) in topologies else 'oriented_shape_precursor')
                for k,p in cells.items() if p in probes or equality_pattern(p) in rotated}
    if len(goals)==1:
        targets={goals[0]:'possible_scoring_contact'}
    elif len(earlier_sites)==1 and not goals:
        targets=precursors
    else: return {'status':'ambiguous_or_missing_goal_site','goal_matches':len(goals),'earlier_matches':len(earlier_sites)}
    def trial_key(dest, action):
        return identity([current.epoch,sig,list(dest),action,list(cells[dest]),
                         bool(goals),observed_context])
    def premise(pos, action, dest):
        return identity([current.epoch,sig,pos,action,cells[dest],bool(goals),observed_context])
    known_edges=defaultdict(list)
    for e in transfers:
        if e['epoch']!=current.epoch or e['role']!=sig: continue
        src,contact,landing=(tuple(e[k]) for k in ('origin','contact','landing'))
        if cells.get(contact)==tuple(e['surface']) and landing in cells:
            known_edges[src,e['action_ref']].append((landing,e))
    queue=deque([start]); parent={start:None}; experiments=[]
    while queue:
        pos=queue.popleft()
        for action,delta in sorted(moves.items()):
            dest=add(pos,delta)
            if dest not in cells: continue
            if premise(pos,action,dest) in refuted: continue
            edges=known_edges.get((pos,action),[])
            if edges:
                landings={landing for landing,_ in edges}
                if len(landings)==1:
                    landing,e=edges[0]
                    if landing not in parent:
                        parent[landing]=(pos,action,'conditional_observed_access',e['contact'])
                        queue.append(landing)
                continue
            if dest in targets:
                if trial_key(dest,action) not in tried:
                    experiments.append((pos,action,dest,targets[dest]))
                continue
            if dest not in parent and cells[dest] in surfaces:
                parent[dest]=(pos,action,'conditional_translation',None);queue.append(dest)
    if not experiments and len(goals)==1 and transfers:
        # The scoring composition is present but unreachable through known
        # access edges. Probe an untried entrance only if a measured motif of
        # the same structural family has actually accompanied a nonlocal move.
        observed_families=set()
        for e in transfers:
            if e['epoch']==current.epoch and e['role']==sig:
                observed_families.add(equality_pattern(tuple(e['surface'])))
        supported=set()
        for p in probes:
            family=orientation_patterns(p,size)
            if family & observed_families: supported.update(family)
        for pos in parent:  # breadth-first insertion order
            for action,delta in sorted(moves.items()):
                dest=add(pos,delta)
                if (dest in precursors and equality_pattern(cells[dest]) in supported and
                        not known_edges.get((pos,action)) and trial_key(dest,action) not in tried and
                        premise(pos,action,dest) not in refuted):
                    experiments.append((pos,action,dest,'probe_access_to_unreachable_scoring_composition'))
    if not experiments:
        return {'status':'no_observed_surface_access','target_count':len(targets),'reachable':len(parent)}
    # Queue order gives minimum conditional path length. A nonlocal observed
    # access closes its prefix so the new local context can be reconciled.
    # Preserve measured access edges in the search above. Only rank the final
    # experimental contact by spatial occurrence while the goal is in its
    # earlier appearance. The full condition-specific trial keys still apply.
    first_visits=[e for e in experiments if identity(occurrence_at(current.epoch,sig,e[2])) not in occurrences]
    prefer_new=not goals and bool(first_visits)
    pos,action,dest,kind=(first_visits if prefer_new else experiments)[0]
    steps=[{'action_ref':action,'from':pos,'to':dest,'effect':'unknown_then_observe'}]
    while parent[pos] is not None:
        prev,act,effect,contact=parent[pos]
        steps.append({'action_ref':act,'from':prev,'to':pos,'effect':effect,'contact':contact});pos=prev
    steps.reverse()
    prefix=steps[:max_prefix]
    for i,step in enumerate(prefix):
        nominal=add(step['from'],moves[step['action_ref']])
        step['premise_ref']=premise(step['from'],step['action_ref'],nominal)
        if step['effect']=='conditional_observed_access':
            prefix=prefix[:i+1]
            break
    predicted_families=set()
    if kind!='possible_scoring_contact':
        for example in model['possible_prerequisites']:
            if equality_pattern(cells[dest]) in orientation_patterns(example['pattern'],size):
                predicted_families.update(example['event_families'])
    return {'status':'proposed','kind':kind,'origin':start,'site':dest,'reachable':len(parent),
            'terminal_site':goals[0] if goals else earlier_sites[0],
            'terminal_appearance':'scoring_appearance' if goals else 'earlier_appearance',
            'possible_effect_families':sorted(predicted_families),
            'eligible_approaches':len(experiments),'earlier_site_matches':len(earlier_sites),'scoring_site_matches':len(goals),
            'trial_key':trial_key(dest,action),'prefix':prefix,'planned_steps':len(steps),'role':sig,'role_size':size,
            'experimental_occurrence':occurrence_at(current.epoch,sig,dest),'prefers_untried_occurrence':prefer_new,
            'reachable_experimental_sites':len({e[2] for e in experiments}),'reachable_untried_sites':len({e[2] for e in first_visits}),
            'epoch':current.epoch,'observation_ref':current.ref,'release_authority':False,
            'falsifiers':['observed role outside expected local support','unexpected change outside swept supports','boundary or input unavailable']}


def _occurs(rows, position, mask, value):
    x,y=position
    support={(x+u,y+v) for u,v in mask}
    if not support or any(v<0 or u<0 or v>=len(rows) or u>=len(rows[v]) or rows[v][u]!=value for u,v in support):
        return False
    for u,v in support:
        for a,b in ((u-1,v),(u+1,v),(u,v-1),(u,v+1)):
            if (a,b) not in support and 0<=b<len(rows) and 0<=a<len(rows[b]) and rows[b][a]==value:
                return False
    return True


def check_access_before(plan,index,rows,*,epoch,score,available,observation_ref=None):
    if plan.get('status')!='proposed' or not 0<=index<len(plan['prefix']):
        return {'admitted':False,'reason':'outside_committed_set'}
    if epoch!=plan['epoch'] or score!=plan['score']:
        return {'admitted':False,'reason':'scope_changed'}
    if index==0 and observation_ref!=plan['observation_ref']:
        return {'admitted':False,'reason':'initial_observation_changed'}
    step=plan['prefix'][index]
    if step['action_ref'] not in available:
        return {'admitted':False,'reason':'command_unavailable'}
    if not _occurs(rows,step['from'],plan['role_mask'],plan['role_value']):
        return {'admitted':False,'reason':'role_position_or_shape_changed'}
    # Check the visible destination from the sealed decision, including the last
    # unknown contact. Overlapping role/target halos need fresh reasoning.
    expected=step['surface_before']
    actual=local_patch(Snapshot(rows,{},epoch,score,'',''),step.get('contact') or step['to'],plan['role_size'])
    if actual is None or tuple(expected)!=actual:
        return {'admitted':False,'reason':'destination_premise_changed'}
    return {'admitted':True,'reason':'bound_role_and_destination_match'}


def check_access_after(plan,index,before_rows,after_rows,*,epoch,score,state):
    if plan.get('status')!='proposed' or not 0<=index<len(plan['prefix']):
        return {'matched':False,'seal_prefix':True,'reason':'outside_committed_set'}
    if epoch!=plan['epoch'] or score!=plan['score'] or state in ('WIN','GAME_OVER'):
        return {'matched':None,'seal_prefix':True,'reason':'official_boundary_or_terminal'}
    step=plan['prefix'][index]
    if step['effect']=='unknown_then_observe':
        return {'matched':None,'seal_prefix':True,'reason':'experimental_contact_observed'}
    if len(before_rows)!=len(after_rows) or any(len(a)!=len(b) for a,b in zip(before_rows,after_rows)):
        return {'matched':False,'seal_prefix':True,'reason':'viewport_changed'}
    reached=_occurs(after_rows,step['to'],plan['role_mask'],plan['role_value'])
    left=not _occurs(after_rows,step['from'],plan['role_mask'],plan['role_value'])
    if not reached or not left:
        return {'matched':False,'seal_prefix':True,'reason':'displacement_prediction_refuted'}
    if step['effect']=='conditional_observed_access':
        return {'matched':True,'seal_prefix':True,'reason':'observed_access_arrival_reconcile'}
    w,h=plan['role_size']
    possible={(u,v) for x,y in (step['from'],step['to'])
              for u in range(x-1,x+w+1) for v in range(y-1,y+h+1)}
    for y,(old,new) in enumerate(zip(before_rows,after_rows)):
        if old!=new and any(a!=b and (x,y) not in possible for x,(a,b) in enumerate(zip(old,new))):
            return {'matched':False,'seal_prefix':True,'reason':'unexpected_remote_effect'}
    return {'matched':True,'seal_prefix':index+1==len(plan['prefix']),'reason':'observed_local_translation'}


class GoalAccessMemory:
    """One active public epoch plus reusable scoring hypotheses and local trials."""
    def __init__(self):
        self.episode=[]
        self.models=[]
        self.tried=set()
        self.transfers=[]
        self.effect_points=set()
        self.refuted=set()
        self.occurrences={}
        self.last=None
        self.unresolved_returns=[]

    def retained_state(self):
        return {'models':self.models,'tried':sorted(self.tried),'transfers':self.transfers,
                'effect_points':[list(p) for p in sorted(self.effect_points)],'refuted':sorted(self.refuted),'occurrences':self.occurrences,'unresolved_returns':self.unresolved_returns}

    def _retain_occurrence(self,event):
        occurrence=event.get('occurrence')
        if occurrence is None:return
        site=self.occurrences.setdefault(identity(occurrence),{'occurrence':occurrence,'conditions':{}})
        outcomes=site['conditions'].setdefault(event['key'],{})
        outcomes[event['after']]={'before':event['before'],'after':event['after'],'surface':event['contact_surface'],
            'command':event['command'],'terminal_appearance':event['terminal_appearance_before'],'score_delta':event['score_delta'],
            'terminal_site_changed':event['terminal_site_changed'],'matched_effect_families':event['matched_effect_families'],
            'matched_effect_points':event['matched_effect_points'],'landing':event['landing']}

    def apply_event(self,event):
        """Restore retained knowledge at a boundary from verified persisted events."""
        kind=event['kind']
        if kind=='goal_approach_retrospective':
            if event['models']: self.models=event['models']
            self.episode=[]; self.tried.clear(); self.transfers=[]; self.effect_points.clear(); self.refuted.clear(); self.last=None; self.unresolved_returns=[]
        elif kind=='goal_contact_trial':
            self.tried.add(event['key'])
            self.effect_points.update(tuple(point) for point in event.get('matched_effect_points',[]))
            self._retain_occurrence(event)
        elif kind=='observed_nonlocal_access':
            self.transfers.append(event['edge'])
        elif kind=='unresolved_whole_scene_return':
            self.unresolved_returns.append(event)
        elif kind=='displacement_refuted_in_context':
            self.refuted.add(event['premise_ref'])
        else: raise ValueError('Unknown public goal-memory event')

    def snapshot(self,observation,rows):
        if self.last is not None and self.last.ref==observation['observation_ref']:
            return self.last
        return Snapshot.from_public(observation,rows)

    def propose(self,observation,rows,actions,max_prefix=16):
        current=self.snapshot(observation,rows)
        context=[(x,y,current.rows[y][x]) for x,y in sorted(self.effect_points)
                 if 0<=y<len(current.rows) and 0<=x<len(current.rows[y])]
        offered={a['action_ref'] for a in actions if not a.get('data')}
        results=[]
        for model in self.models:
            # Keep only controls currently exposed by the transport.
            active={**model,'moves':{key:v for key,v in model['moves'].items() if key in offered}}
            if not active['moves']: continue
            route=propose_access(active,current,self.tried,max_prefix,self.transfers,context,self.refuted,self.occurrences)
            if route['status']!='proposed': continue
            role=next((e for e in observation['entities'] if e['signature']==model['role'] and not e['identity_ambiguous']),None)
            if not role: continue
            tentative = model.get('tentative_scoring_control')
            if tentative:
                route['tentative_scoring_control'] = tentative
                for index,step in enumerate(route['prefix']):
                    if step['action_ref'] == tentative['action_ref']:
                        route['prefix'] = route['prefix'][:index+1]
                        route['test_tentative_control'] = True
                        break
            route.update(role_mask=[list(p) for p in role['mask']],role_value=role['palette_value'],score=current.score,
                         source_model_ref=identity(model),source_boundary=model['boundary_before'],
                         qualification='Conditional route toward a hypothesized scoring or enabling composition')
            for step in route['prefix']:
                site=step.get('contact') or step['to']
                step['surface_before']=list(local_patch(current,site,model['size']))
            results.append(route)
        if not results: return {'status':'unbound_or_no_access'}
        if len({identity([r['role'],r['site'],r['prefix']]) for r in results})!=1:
            return {'status':'competing_scoring_approaches'}
        return results[0]

    def record(self,before_obs,before_rows,command,after_obs,after_rows,*,plan=None,action_index=None,scoring_contact=None):
        before=self.snapshot(before_obs,before_rows)
        after=Snapshot.from_public(after_obs,after_rows)
        self.last=after
        key=command['action_ref']
        if command.get('data'):
            # This learner covers translation by coordinate-free commands.
            key='addressed:'+identity(command)
        self.episode.append((before,key,after))
        events=[]
        if plan is not None and action_index is not None and after.epoch==before.epoch and after.score==before.score:
            step=plan['prefix'][action_index]
            role=plan['role']
            b=before.roles.get(role); a=after.roles.get(role)
            if (step['effect']!='unknown_then_observe' and key==step['action_ref'] and b is not None and a is not None
                    and b[:2]==tuple(step['from']) and a[:2]==b[:2] and tuple(step['to'])!=a[:2]):
                self.refuted.add(step['premise_ref'])
                events.append({'kind':'displacement_refuted_in_context','premise_ref':step['premise_ref'],
                               'before':before.ref,'after':after.ref,'scope':'same epoch, role, origin, command, destination appearance and measured progress context'})
        if plan is not None and action_index is not None and plan['prefix'][action_index]['effect']=='unknown_then_observe':
            self.tried.add(plan['trial_key'])
            groups=repeated_changes(before,after) if before.epoch==after.epoch else {}
            matched=set(groups)&set(plan['possible_effect_families'])
            points={point for k in matched for region in groups[k] for point in region}
            self.effect_points.update(points)
            mode_comparison=None
            if after.epoch==before.epoch:
                mode_comparison=(local_patch(before,plan['terminal_site'],plan['role_size']) !=
                                 local_patch(after,plan['terminal_site'],plan['role_size']))
            contact=plan['prefix'][action_index]['to'];arrival=after.roles.get(plan['role']) if before.epoch==after.epoch else None
            events.append({'kind':'goal_contact_trial','key':plan['trial_key'],'before':before.ref,'after':after.ref,
                           'occurrence':occurrence_at(before.epoch,plan['role'],contact),'command':key,
                           'contact_surface':list(local_patch(before,contact,plan['role_size']) or ()),
                           'landing':list(arrival[:2]) if arrival is not None else None,
                           'terminal_appearance_before':plan['terminal_appearance'],'terminal_site_changed':mode_comparison,
                           'matched_effect_families':sorted(matched),'matched_effect_points':sorted(points),
                           'score_delta':after.score-before.score})
            self._retain_occurrence(events[-1])
        if after.epoch!=before.epoch or after.score>before.score:
            learned=fit_boundary(self.episode,scoring_contact) if after.score>before.score else []
            # The response already belongs to the newly entered viewport.
            if learned: self.models=learned
            events.append({'kind':'goal_approach_retrospective','models':learned,'before':before.ref,'after':after.ref})
            self.episode=[];self.tried.clear();self.transfers=[];self.effect_points.clear();self.refuted.clear();self.unresolved_returns=[]
            return events
        for model in self.models:
            sig=model['role']
            if sig not in before.roles or sig not in after.roles or key not in model['moves']:continue
            origin=before.roles[sig][:2]; landing=after.roles[sig][:2]
            contact=add(origin,model['moves'][key])
            surface=local_patch(before,contact,model['size'])
            if surface is None:continue
            previous=[e for e in self.transfers if e['epoch']==before.epoch and e['role']==sig and
                      e['origin']==list(origin) and e['action_ref']==key and e['surface']==list(surface)]
            if not previous and landing in (origin,contact):continue
            if any(e['landing']==list(landing) for e in previous):continue
            edge={'epoch':before.epoch,'role':sig,'origin':list(origin),'landing':list(landing),
                  'contact':list(contact),'surface':list(surface),'action_ref':key,
                  'before':before.ref,'after':after.ref}
            initial=self.episode[0][0]
            if (initial.epoch==after.epoch and initial.score==after.score and
                    initial.rows==after.rows and before.rows!=after.rows):
                # Full scene equality does not isolate a local transport law.
                event={'kind':'unresolved_whole_scene_return','edge':edge,
                       'initial_observation':initial.ref,'before':before.ref,'after':after.ref,
                       'qualification':'Exact public scene returned; local transport and scene restoration remain unresolved.'}
                self.unresolved_returns.append(event);events.append(event)
                continue
            self.transfers.append(edge);events.append({'kind':'observed_nonlocal_access','edge':edge})
        return events
