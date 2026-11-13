"""Information access using measured, repeated components that translate together."""
from collections import defaultdict, deque
from portable_recall import digest, normalized_action
from temporal_questions import unique_shapes


def add(p,q):return tuple(x+y for x,y in zip(p,q))
def sub(p,q):return tuple(x-y for x,y in zip(p,q))
def measured_groups(obs):
    result=defaultdict(list)
    for entity in obs['entities']:result[entity['signature']].append(entity)
    return result


def anchors(positions,offsets):
    positions=set(positions);offsets=[tuple(p) for p in offsets]
    candidates=[sub(p,offsets[0]) for p in positions]
    return sorted(a for a in candidates if all(add(a,d) in positions for d in offsets))


def covers(rows,anchor,mask,value):
    points={add(anchor,p) for p in mask};h=len(rows);w=len(rows[0])
    if not points or any(not 0<=x<w or not 0<=y<h or rows[y][x]!=value for x,y in points):return False
    perimeter={add(p,d) for p in points for d in ((1,0),(-1,0),(0,1),(0,-1))}-points
    return all(not (0<=x<w and 0<=y<h) or rows[y][x]!=value for x,y in perimeter)


def visible_anchors(rows,mask,value):
    first=tuple(mask[0]);candidates=(sub((x,y),first) for y,row in enumerate(rows) for x,v in enumerate(row) if v==value)
    return sorted(a for a in candidates if covers(rows,a,mask,value))


def entry(rows,origin,target,mask):
    old={add(origin,p) for p in mask};coords=sorted({add(target,p) for p in mask}-old)
    if not coords or any(x<0 or y<0 or y>=len(rows) or x>=len(rows[0]) for x,y in coords):return None
    return tuple(rows[y][x] for x,y in coords)


class ResidualAccess:
    def __init__(self):
        self.roles={};self.controls=defaultdict(list);self.visited=defaultdict(set);self.failed=set()

    def apply_event(self,event):
        kind=event['kind']
        if kind=='residual_role_shape':self.roles[event['role_ref']]=event['role']
        elif kind=='residual_role_transition':
            role=event['role_ref'];self.controls[role].append(event);self.visited[role].add(tuple(event['origin']))
            if len(event['arrivals'])==1:self.visited[role].add(tuple(event['arrivals'][0]))
        elif kind=='residual_access_result' and event['reached'] is not True:self.failed.add(event['premise_ref'])

    def retained_digest(self):
        return digest({'roles':self.roles,'controls':dict(self.controls),'visited':{k:sorted(v) for k,v in self.visited.items()},'failed':sorted(self.failed)})

    def record(self,before,command,after,first,last,proposal,index):
        if command.get('data'):return []
        if before['level_epoch']!=after['level_epoch'] or before['state']!=after['state']:
            if 'residual_plan' not in proposal:return []
            step=proposal['residual_plan']['prefix'][index]
            return [{'kind':'residual_boundary_witness','role_ref':proposal['residual_plan']['role_ref'],'premise_ref':step['premise_ref'],
                'before_ref':before['observation_ref'],'after_ref':after['observation_ref'],'score_delta':after['levels_completed']-before['levels_completed']}]
        old=measured_groups(before);new=measured_groups(after);events=[];epoch=before['level_epoch']
        for sig in sorted(old.keys()|new.keys()):
            a={tuple(e['position']) for e in old[sig]};b={tuple(e['position']) for e in new[sig]}
            removed=sorted(a-b);appeared=sorted(b-a)
            if max(len(a),len(b))<=1 or not (removed or appeared):continue
            # This exact factored representation retains every admissible atom pair.
            event={'kind':'residual_correspondence_set','epoch':epoch,'signature':sig,'removed':removed,'appeared':appeared,
                'pairing':'cartesian_product_unassigned','candidate_pair_count':len(removed)*len(appeared),
                'stationary_occurrences_cancelled':len(a&b),'before_ref':before['observation_ref'],'after_ref':after['observation_ref']}
            events.append(event)
            if len(removed)<2 or len(removed)!=len(appeared):continue
            v=sub(appeared[0],removed[0]);
            if {add(p,v) for p in removed}!=set(appeared):continue
            origin=(min(x for x,y in removed),min(y for x,y in removed));offsets=sorted(sub(p,origin) for p in removed)
            sample=old[sig][0];mask=sorted({add(d,m) for d in offsets for m in sample['mask']})
            shape={'epoch':epoch,'signature':sig,'offsets':[list(p) for p in offsets],'mask':[list(p) for p in mask],'value':sample['palette_value']}
            identifier='residual:'+digest(shape)
            if identifier not in self.roles:
                definition={'kind':'residual_role_shape','role_ref':identifier,'role':shape,'before_ref':before['observation_ref'],'after_ref':after['observation_ref']};self.apply_event(definition);events.append(definition)
        for identifier,role in self.roles.items():
            if role['epoch']!=epoch:continue
            source=anchors((tuple(e['position']) for e in old[role['signature']]),role['offsets']);arrivals=anchors((tuple(e['position']) for e in new[role['signature']]),role['offsets'])
            if len(source)!=1:continue
            origin=source[0];surface=entry(first,origin,arrivals[0],role['mask']) if len(arrivals)==1 and arrivals[0]!=origin else None
            change={'kind':'residual_role_transition','role_ref':identifier,'origin':list(origin),'arrivals':[list(a) for a in arrivals],'action':command['action_ref'],
                'entry_surface':list(surface) if surface is not None else None,'before_ref':before['observation_ref'],'after_ref':after['observation_ref']}
            self.apply_event(change);events.append(change)
        if 'residual_plan' in proposal:
            route=proposal['residual_plan'];step=route['prefix'][index];role=self.roles[route['role_ref']];locations=anchors((tuple(e['position']) for e in new[role['signature']]),role['offsets'])
            changed={'kind':'residual_access_result','role_ref':route['role_ref'],'premise_ref':step['premise_ref'],'from':step['from'],'expected':step['to'],
                'actual_candidates':[list(p) for p in locations],'reached':(locations==[tuple(step['to'])]) if len(locations)==1 else None,
                'before_ref':before['observation_ref'],'after_ref':after['observation_ref']};self.apply_event(changed);events.append(changed)
        return events

    def controls_for(self,identifier,minimum_positions):
        observed=defaultdict(lambda:defaultdict(list));edges=defaultdict(set)
        for e in self.controls.get(identifier,()):
            if len(e['arrivals'])!=1:continue
            origin=tuple(e['origin']);dest=tuple(e['arrivals'][0]);key=e['action'];edges[origin,key].add(dest)
            if dest!=origin and e['entry_surface'] is not None:observed[key][sub(dest,origin)].append(e)
        moves={};sources={}
        for key,variants in observed.items():
            ranked=sorted(((len({tuple(e['origin']) for e in rows}),delta,rows) for delta,rows in variants.items()),key=lambda x:-x[0]);n,move,rows=ranked[0]
            if n>=minimum_positions and (len(ranked)==1 or n>ranked[1][0]):moves[key]=move;sources[key]=rows
        # A time-correlated translation under multiple keys is insufficient. Require
        # a measured origin with different native inputs and incompatible arrivals.
        contrast=[]
        for (origin,k),outcomes in edges.items():
            if k not in moves or outcomes!={add(origin,moves[k])}:continue
            for other in moves:
                if other<=k or moves[other]==moves[k] or edges.get((origin,other))!={add(origin,moves[other])}:continue
                contrast.append({'origin':origin,'first':k,'second':other,'first_destination':add(origin,moves[k]),'second_destination':add(origin,moves[other])})
        return moves,sources,edges,contrast

    def propose(self,obs,rows,available,temporal,config,max_prefix):
        epoch=obs['level_epoch'];groups=measured_groups(obs);allowed={a['action_ref'] for a in available if not a.get('data')};offers=[]
        for identifier,role in self.roles.items():
            if role['epoch']!=epoch:continue
            starts=anchors((tuple(e['position']) for e in groups[role['signature']]),role['offsets'])
            if len(starts)!=1:continue
            start=starts[0];moves,sources,edges,contrast=self.controls_for(identifier,config['minimum_source_positions'])
            if not contrast:continue
            phase=choose_clock_witness(temporal,obs,role['signature'],1)
            phase_context=[phase['signature'],phase['origin']] if phase else None
            endpoints={k:{tuple(e['entry_surface']) for e in samples} for k,samples in sources.items()}
            initial_support={add(start,p) for p in role['mask']};parents={start:None};queue=deque([start]);targets=[]
            while queue:
                pos=queue.popleft()
                for key in sorted(allowed & moves.keys()):
                    dest=add(pos,moves[key]);surface=entry(rows,pos,dest,role['mask']);
                    if surface is None or (pos!=start and {add(dest,p) for p in role['mask']}&initial_support):continue
                    premise=digest([epoch,identifier,pos,key,dest,surface,phase_context]);outcomes=edges.get((pos,key),set());familiar=surface in endpoints[key]
                    if premise in self.failed:continue
                    step={'action_ref':key,'from':list(pos),'to':list(dest),'entry_surface':list(surface),'premise_ref':premise,'surface_previously_traversed':familiar}
                    if dest not in self.visited[identifier]:
                        targets.append((not familiar or bool(outcomes and outcomes!={dest}),pos,step));continue
                    if familiar and outcomes=={dest} and dest not in parents:
                        parents[dest]=(pos,step);queue.append(dest)
            if not targets:continue
            # BFS preserves shortest measured return path within each surface class.
            uncertain,pos,final=min(targets,key=lambda item:item[0]);path=[final]
            while parents[pos] is not None:
                pos,step=parents[pos];path.append(step)
            path.reverse();prefix=path[:max_prefix];final_included=len(prefix)==len(path)
            clock=choose_clock_witness(temporal,obs,role['signature'],len(prefix))
            for i,step in enumerate(prefix):step['experiment']=final_included and i==len(prefix)-1
            offers.append({'epoch':epoch,'score':obs['levels_completed'],'observation_ref':obs['observation_ref'],'role_ref':identifier,'role':role,
                'start':list(start),'unvisited_target':final['to'],'prefix':prefix,'planned_length':len(path),'reachable_measured_positions':len(parents),
                'distinct_unvisited_targets':len({tuple(s['to']) for _,_,s in targets}),'final_surface_uncertain':uncertain,'input_contrast':contrast[0],
                'motion_evidence':{k:[e['before_ref'] for e in s[:3]] for k,s in sources.items()},'temporal_contrast':clock,
                'qualification':'unique constellation binding, provisional local command association, empirical spatial information objective; no terminal or general control claim'})
        if not offers:return {'status':'abstained','reason':'no_bound_residual_role_or_new_access'}
        offers.sort(key=lambda p:(p['final_surface_uncertain'],p['planned_length'],p['role_ref']))
        if len(offers)>1 and offers[0]['final_surface_uncertain']==offers[1]['final_surface_uncertain'] and offers[0]['planned_length']==offers[1]['planned_length']:
            return {'status':'abstained','reason':'competing_residual_control_roles'}
        route=offers[0];ref='C_residual_access_'+digest(route)[:20];commands=[{'action_ref':s['action_ref']} for s in route['prefix']];op='OP18' if route['prefix'][-1]['experiment'] else 'OP28'
        why='Move the bound repeated-component constellation along measured access and test its support at a new position; compare any separately predicted temporal shape.'
        comp={'id':ref,'observed':False,'role':'spatial_information_composition','things':[route['role_ref']],
            'properties':{'position':route['unvisited_target'],'clock':route['temporal_contrast'],'command_contrast':route['input_contrast']},'relations':['contributes_to:G_official_completion']}
        if op=='OP18':comp['open_question']=why
        evidence=[obs['observation_ref'],'residual_access:'+digest(route)];facts={'residual_role_bound':True,'new_position_requested':True}
        return {'status':'proposed','kind':'residual_spatial_access','proposal_id':'residual_access:'+digest(route),'residual_plan':route,'actions':commands,
            'steps':[{'action':a,'expected_after':{'kind':'residual_shape_and_phase','predicted_anchor':s['to']}} for a,s in zip(commands,route['prefix'])],
            'compositions':[comp],'facts':facts,'question':{'reason':'reach_unvisited_composition_with_bound_residual_role','hypothesis_refs':[route['role_ref']]},'route_refs':evidence,
            'binding':{'observation_ref':obs['observation_ref'],'level_epoch':epoch,'levels_completed':obs['levels_completed']},
            'bundle_template':{'operation_key':op,'composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':commands,'purpose':why,'preconditions':facts,'evidence':evidence,'outcome_guard':{'path':['value'],'contains':ref if op=='OP18' else 'B0'}}}

    @staticmethod
    def before(proposal,index,rows,*,epoch,score,available,observation_ref):
        plan=proposal['residual_plan'];step=plan['prefix'][index];role=plan['role'];ok=(epoch==plan['epoch'] and score==plan['score'] and step['action_ref'] in available and
            (index>0 or observation_ref==plan['observation_ref']) and visible_anchors(rows,role['mask'],role['value'])==[tuple(step['from'])] and entry(rows,step['from'],step['to'],role['mask'])==tuple(step['entry_surface']))
        return {'admitted':ok,'reason':'residual_support_and_destination_match' if ok else 'residual_premise_changed'}

    @staticmethod
    def after(proposal,index,first,last,*,epoch,score,state):
        plan=proposal['residual_plan'];step=plan['prefix'][index];role=plan['role']
        if epoch!=plan['epoch'] or score!=plan['score'] or state in {'WIN','GAME_OVER'}:return {'matched':None,'seal_prefix':True,'reason':'official_boundary_or_terminal'}
        reached=visible_anchors(last,role['mask'],role['value'])==[tuple(step['to'])]
        if not reached:return {'matched':False,'seal_prefix':True,'reason':'residual_displacement_refuted_or_ambiguous'}
        clock=plan['temporal_contrast'];clock_steps=clock['positions'] if clock else []
        if index<len(clock_steps) and not covers(last,clock_steps[index],clock['mask'],clock['value']):return {'matched':False,'seal_prefix':True,'reason':'separate_temporal_forecast_refuted'}
        return {'matched':True,'seal_prefix':step['experiment'],'reason':'new_spatial_composition_observed' if step['experiment'] else 'conditional_residual_translation_matched'}


def choose_clock_witness(temporal,obs,excluded_sig,length):
    unique=unique_shapes(obs);offers=[]
    for (epoch,sig),places in temporal.samples.items():
        entity=unique.get(sig)
        if epoch!=obs['level_epoch'] or sig==excluded_sig or entity is None:continue
        current=tuple(entity['position']);positions=[];refs=[]
        for _ in range(length):
            records=places.get(current,{});ends={dest for choices in records.values() for dest in choices}
            if len(records)<2 or len(ends)!=1 or None in ends:break
            nxt=next(iter(ends))
            if nxt==current:break
            positions.append(list(nxt));refs.append([next(iter(v.values()))[0] for v in records.values()]);current=nxt
        if positions:offers.append({'signature':sig,'origin':entity['position'],'positions':positions,'mask':entity['mask'],'value':entity['palette_value'],'evidence':refs,'scope':'separate shape; conditional successor observed across different commands'})
    return max(offers,key=lambda c:len(c['positions'])) if offers else None
