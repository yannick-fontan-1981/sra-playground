"""Human-selected information objective: approach observed view boundaries.

Coordinates are provisional registered screen coordinates. No map, roles,
palette, input direction, scroll direction, or terminal cue is supplied.
"""
from collections import Counter,defaultdict
import hashlib,json,math
import numpy as np
from common_mechanisms import apply_empirical_rule
from common_point_contrasts import support


def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()


def unique(obs):
    counts=Counter(e['signature'] for e in obs['entities'])
    return {e['signature']:e for e in obs['entities'] if counts[e['signature']]==1}


def global_registration(before,after,first,second):
    a=np.asarray(first);b=np.asarray(second)
    if a.ndim!=2 or a.shape!=b.shape:return {'status':'unknown_dimensions','offset':None}
    height,width=a.shape;one,two=unique(before),unique(after)
    offsets={(two[k]['position'][0]-one[k]['position'][0],two[k]['position'][1]-one[k]['position'][1])
             for k in one.keys() & two.keys()}
    candidates=[]
    for dx,dy in offsets-{(0,0)}:
        left=max(0,-dx);top=max(0,-dy);right=min(width,width-dx);bottom=min(height,height-dy)
        count=(right-left)*(bottom-top)
        if count<height*width/2 or min(right-left,bottom-top)<2:continue
        old=a[top:bottom,left:right];zero=b[top:bottom,left:right];shift=b[top+dy:bottom+dy,left+dx:right+dx]
        gains=[];h,w=old.shape
        for ys in (slice(0,h//2),slice(h//2,h)):
            for xs in (slice(0,w//2),slice(w//2,w)):
                region=old[ys,xs]
                if np.unique(region).size<2:break
                gains.append(int(np.count_nonzero(region==shift[ys,xs])-np.count_nonzero(region==zero[ys,xs])))
        if len(gains)==4 and min(gains)>0:
            candidates.append((sum(gains)/count,dx,dy,count,gains))
    candidates.sort(reverse=True)
    if candidates and (len(candidates)==1 or candidates[0][0]>candidates[1][0]):
        ratio,dx,dy,count,gains=candidates[0]
        return {'status':'supported_bulk_offset','offset':[dx,dy],'overlap_pixels':count,'quadrant_gains':gains,
                'other_supported_offsets':[[c[1],c[2]] for c in candidates[1:]],'frame_identity_not_world_identity':True}
    changed=int(np.count_nonzero(a!=b))
    if not candidates and changed*8<=a.size:
        return {'status':'locally_stable_projection','offset':[0,0],'changed_pixels':changed}
    return {'status':'ambiguous_or_unregistered_scene','offset':None,'changed_pixels':changed}


def rectangle(origin,w,h):
    return {(origin[0]+x,origin[1]+y) for y in range(h) for x in range(w)}


def shifted(cells,vector):
    dx,dy=vector;return {(x+dx,y+dy) for x,y in cells}


def motion_key(action_ref,sigs,vector,cells):
    x0=min(x for x,y in cells);y0=min(y for x,y in cells)
    return (action_ref,tuple(sorted(sigs)),vector,tuple(sorted((x-x0,y-y0) for x,y in cells)))


class ViewFrontier:
    def __init__(self):
        self.epoch=None;self.origin=(0,0);self.segment=0;self.coverage=set();self.offsets=defaultdict(set);self.offset_source={}
        self.footprints=defaultdict(set);self.pass_refs=defaultdict(list);self.block=None;self.followup=None;self.tested=set();self.access_trials=Counter()
        self.known_signatures=set();self.reveals=[];self.engaged=False;self.visible_hypotheses={}

    def initialize(self,obs,rows):
        if self.epoch==obs['level_epoch']:return
        self.__init__();self.epoch=obs['level_epoch'];self.coverage=rectangle(self.origin,len(rows[0]),len(rows))
        self.known_signatures={e['signature'] for e in obs['entities']}

    def has_observed_view_question(self):
        return bool(self.block or self.reveals)

    @staticmethod
    def _movement(rule,obs):
        action=rule.get('conditions',{}).get('action',{})
        if not action.get('action_ref') or action.get('data'):return None
        command={'action_ref':action['action_ref']};p=apply_empirical_rule(rule,obs,command)
        if p.get('status')!='prediction':return None
        refs=unique(obs);actors=[];vectors=set();cells=set()
        for variable in p['predicted_entities']:
            sig=variable['entity']['signature'];prev=p['position_context'][variable['variable']]
            dst=variable['entity']['position'];v=(dst[0]-prev[0],dst[1]-prev[1])
            if v==(0,0):continue
            if sig not in refs:return None
            vectors.add(v);actors.append({'signature':sig,'position':prev});cells|=support(refs[sig])
        if len(vectors)!=1 or not actors:return None
        step=next(iter(vectors))
        if step[0] and step[1]:return None
        return command,actors,step,cells

    def _form(self,obs,kind,actions,steps,details,reason):
        key='C_view_'+digest([obs['observation_ref'],kind,actions,reason])[:16]
        preservation='C_current_view';facts={'current_observed_view':True,'input_bound':all(a['action_ref'] in obs['available_action_refs'] for a in actions)}
        comp={'id':key,'role':'information_question','observed':False,'open_question':reason,
            'relations':['contributes_to:G_official_completion'],'properties':details}
        bundle={'operation_key':'OP18','composition_ref':key,'objective_ref':'G_official_completion','preserve_refs':[preservation],
            'purpose':reason,'preconditions':facts,'evidence':[obs['observation_ref']]+details.get('evidence_refs',[]),
            'preservation_evidence':{preservation:'Current epoch, occurrence and bound step; seal on changed response or view.'},
            'actions':actions,'outcome_guard':{'path':['value'],'contains':key}}
        return {'status':'proposed','kind':'public_view_frontier','view_plan':{'kind':kind,'steps':steps,'details':details},
            'actions':actions,'steps':steps,'facts':facts,'compositions':[{'id':preservation,'observed':True,'role':'observed_screen','properties':{'origin':list(self.origin)}},comp],
            'question':{'reason':reason,'hypothesis_refs':details.get('evidence_refs',[]),'terminal_role':'unknown'},
            'binding':{'level_epoch':obs['level_epoch'],'levels_completed':obs['levels_completed'],'observation_ref':obs['observation_ref']},
            'bundle_template':bundle,'route_refs':details.get('evidence_refs',[])}

    def propose(self,obs,rows,inputs,rules,remaining):
        self.initialize(obs,rows);height,width=len(rows),len(rows[0]);current=unique(obs)
        if self.followup:
            f=self.followup
            if f['source']==obs['observation_ref'] and all(k in current and current[k]['position']==v for k,v in f['poses'].items()):
                step={'action':f['command'],'expected_poses_before':f['poses'],'expected_after':f['expected'],
                      'expected_before':{'level_epoch':self.epoch,'frame_hash':obs['frame_hash']}}
                return self._form(obs,'test_reopened_access',[f['command']],[step],{'evidence_refs':f['refs'],
                    'exclusive_cause_established':False},'test_access_after_measured_support_change')
            self.followup=None
        if self.block:
            block=self.block
            witness=next((e for e in obs['entities'] if e['signature']==block['signature'] and e['position']==block['position']),None)
            poses_ok=all(k in current and current[k]['position']==v for k,v in block['poses'].items())
            if witness and poses_ok and self.origin==block['origin'] and block['key'] not in self.tested:
                if block['fail_count']==1:
                    command=block['command'];kind='confirm_access_obstruction'
                else:
                    candidates=[a for a in inputs if a.get('data') and (a['data'].get('x'),a['data'].get('y')) in support(witness)]
                    if len(candidates)!=1:return None
                    command=candidates[0];kind='test_change_of_witnessed_obstruction'
                step={'action':command,'expected_before':{'level_epoch':self.epoch,'frame_hash':obs['frame_hash']},'expected_after':None}
                return self._form(obs,kind,[command],[step],{'evidence_refs':block['refs'],'obstruction_key':block['key'],
                    'carrier':{'signature':block['signature'],'position':block['position']},'previous_clear_entry':True,
                    'stationary_trials':block['fail_count'],'exclusive_blocking_cause':False},kind)
            self.block=None
        candidates=[]
        for rule in rules:
            if rule.get('status')!='mechanism_acquired':continue
            move=self._movement(rule,obs)
            if not move:continue
            cmd,actors,vector,cells=move;dx,dy=vector
            if cmd['action_ref'] not in obs['available_action_refs']:continue
            axis=0 if dx else 1;sign=1 if vector[axis]>0 else -1;limit=width if axis==0 else height
            front=max(p[axis] for p in cells) if sign>0 else min(p[axis] for p in cells)
            gap=limit-1-front if sign>0 else front
            steps_to_edge=1+gap//abs(vector[axis])
            # A past camera response may be orthogonal to the input displacement.
            # With no prior camera motion, the projection is only a hypothesis.
            offsets=self.offsets[cmd['action_ref']] or {(-dx,-dy)}
            alternatives=[]
            for sx,sy in sorted(offsets):
                origin=(self.origin[0]-sx,self.origin[1]-sy)
                area=len(rectangle(origin,width,height)-self.coverage)
                alternatives.append({'hypothetical_bulk_offset':[sx,sy],'unseen_viewport_pixels_if_realized':area})
            area=max(x['unseen_viewport_pixels_if_realized'] for x in alternatives)
            if area<=0:continue
            # Keep at least one moving primitive before hypothesizing further
            # steps. More can be bundled only across matching measured entry texture.
            path_key=motion_key(cmd['action_ref'],[a['signature'] for a in actors],vector,cells)
            if self.access_trials[(path_key,self.origin,tuple(sorted(cells)))]>=2:continue
            steps=[]
            for k in range(min(16,remaining,steps_to_edge)):
                current_cells=shifted(cells,(k*dx,k*dy));destination=shifted(current_cells,vector)
                entry=destination-current_cells
                if not entry or any(x<0 or x>=width or y<0 or y>=height for x,y in entry):
                    if steps:break
                    known=False
                else:
                    signature=tuple(rows[y][x] for x,y in sorted(entry))
                    known=signature in self.footprints[path_key]
                prior={a['signature']:[a['position'][0]+k*dx,a['position'][1]+k*dy] for a in actors}
                after={s:[p[0]+dx,p[1]+dy] for s,p in prior.items()}
                steps.append({'action':cmd,'expected_before':{'level_epoch':self.epoch,'frame_hash':obs['frame_hash'] if k==0 else None},
                    'expected_poses_before':prior,'expected_after':after,'entry_texture_witnessed':known})
                if not known:break
            if steps:candidates.append((area,steps_to_edge,cmd,actors,vector,steps,alternatives,rule['rule_id'],bool(self.offsets[cmd['action_ref']]),
                                        rule.get('evidence_refs',[])[-3:]))
        if not candidates:return None
        self.engaged=True
        candidates.sort(key=lambda x:(-x[0],x[1],x[2]['action_ref'],x[7]));area,cost,cmd,actors,vector,steps,alt,rid,seen,rule_refs=candidates[0]
        ties=[{'action_ref':c[2]['action_ref'],'vector':list(c[4]),'rule':c[7]} for c in candidates if c[:2]==(area,cost)]
        return self._form(obs,'approach_view_edge',[cmd for _ in steps],steps,
            {'evidence_refs':[rid]+rule_refs+[self.offset_source[cmd['action_ref'],t] for t in sorted(self.offsets[cmd['action_ref']])],
             'receiver_poses':actors,'access_vector':list(vector),'steps_to_projected_screen_edge':cost,
             'conditional_new_viewport_pixels':area,'view_shift_previously_seen_for_input':seen,'camera_hypotheses':alt,
             'tied_accesses':ties,'other_accesses':[{'input':x[2]['action_ref'],'area':x[0],'steps':x[1]} for x in candidates[1:]],
             'unmodeled_inputs':[a for a in obs['available_action_refs'] if a not in {c[2]['action_ref'] for c in candidates}],
             'newest_visible_candidates':self.reveals[-1]['new_signature_count'] if self.reveals else 0,
             'retained_visible_hypotheses':[{'source_ref':ref,'signature':sig,'current_entity_ref':current[sig]['id'],
                 'terminal_role':'unestablished'} for sig,ref in self.visible_hypotheses.items() if sig in current][:8],
             'qualification':'projected access and potential screen area; unknown terrain, physical traversability and terminal role'},
            'approach_accessible_border_with_largest_conditional_unseen_view')

    def before(self,proposal,index,public,observation):
        bound=proposal['binding'];step=proposal['steps'][index]
        ok=public.level==bound['level_epoch'] and public.levels_completed==bound['levels_completed'] and step['action']['action_ref'] in public.available_action_refs
        if index==0:ok=ok and observation['observation_ref']==bound['observation_ref']
        us=unique(observation)
        ok=ok and all(k in us and us[k]['position']==pos for k,pos in step.get('expected_poses_before',{}).items())
        return {'admitted':bool(ok),'reason':'bound_view_step' if ok else 'view_or_receiver_changed'}

    def after(self,proposal,index,before,after,first,second):
        if before['level_epoch']!=after['level_epoch'] or before['state']!=after['state'] or before['levels_completed']!=after['levels_completed']:
            return {'matched':None,'seal_prefix':True,'reason':'official_boundary'}
        reg=global_registration(before,after,first,second);expect=proposal['steps'][index]['expected_after']
        if reg['offset']!=[0,0] or expect is None:return {'matched':None,'seal_prefix':True,'reason':reg['status'] if expect else 'probe_outcome_observed'}
        us=unique(after);ok=all(k in us and us[k]['position']==v for k,v in expect.items())
        return {'matched':ok,'seal_prefix':not ok or index+1==len(proposal['steps']),'reason':'screen_pose_matched' if ok else 'screen_pose_diverged'}

    def record(self,before,after,command,first,second,proposal,index):
        self.initialize(before,first)
        if after['level_epoch']!=before['level_epoch'] or after['state']!=before['state']:
            self.initialize(after,second);return {'status':'official_boundary','new_viewport_pixels':None}
        reg=global_registration(before,after,first,second);offset=reg['offset'];w,h=len(second[0]),len(second)
        prior_origin=self.origin;oldsignatures=self.known_signatures.copy();found=[]
        if offset is None:
            self.segment+=1;self.origin=(0,0);self.coverage=rectangle(self.origin,w,h);self.block=None;fresh=None
        else:
            self.origin=(self.origin[0]-offset[0],self.origin[1]-offset[1]);window=rectangle(self.origin,w,h);new=window-self.coverage
            self.coverage.update(window);fresh=len(new)
            if offset!=[0,0]:
                self.offsets[command['action_ref']].add(tuple(offset));self.block=None
                self.offset_source[command['action_ref'],tuple(offset)]=after['observation_ref']
                found=[{'entity_ref':e['id'],'signature':e['signature'],'position':e['position']} for e in after['entities']
                       if e['signature'] not in oldsignatures and any((x+self.origin[0],y+self.origin[1]) in new for x,y in support(e))]
                self.reveals.append({'source':after['observation_ref'],'new_signature_count':len({e['signature'] for e in found})})
                self.visible_hypotheses.update({e['signature']:after['observation_ref'] for e in found})
        self.known_signatures.update(e['signature'] for e in after['entities'])
        b,a=unique(before),unique(after);motions=defaultdict(list)
        for sig in b.keys() & a.keys():
            v=tuple(z-y for z,y in zip(a[sig]['position'],b[sig]['position']))
            if v!=(0,0):motions[v].append(sig)
        if offset==[0,0] and not command.get('data'):
            for v,sigs in motions.items():
                cells=set().union(*(support(b[s]) for s in sigs));entry=shifted(cells,v)-cells
                if entry and all(0<=x<w and 0<=y<h for x,y in entry):
                    key=motion_key(command['action_ref'],sigs,v,cells)
                    self.footprints[key].add(tuple(first[y][x] for x,y in sorted(entry)))
                    self.pass_refs[key]=(self.pass_refs[key]+[after['observation_ref']])[-3:]
        view=proposal.get('view_plan',{});kind=view.get('kind')
        if kind=='test_change_of_witnessed_obstruction':
            self.tested.add(view['details']['obstruction_key'])
            if self.block and offset==[0,0]:
                block=self.block
                carrier=next((e for e in before['entities'] if e['signature']==block['signature'] and e['position']==block['position']),None)
                if carrier and any(first[y][x]!=second[y][x] for x,y in support(carrier)):
                    self.followup={'source':after['observation_ref'],'command':block['command'],'poses':block['poses'],
                        'expected':block['expected'],'refs':block['refs']+[after['observation_ref']]}
            self.block=None
        elif kind=='test_reopened_access':self.followup=None
        elif kind=='confirm_access_obstruction' and self.block:
            stopped=offset==[0,0] and all(k in a and a[k]['position']==p for k,p in self.block['poses'].items())
            if stopped:self.block['fail_count']+=1;self.block['refs'].append(after['observation_ref'])
            else:self.block=None
        elif kind=='approach_view_edge' and offset==[0,0]:
            step=view['steps'][index];poses=step['expected_poses_before'];v=tuple(view['details']['access_vector'])
            cells=set().union(*(support(b[s]) for s in poses if s in b));entry=shifted(cells,v)-cells
            key=motion_key(command['action_ref'],poses,v,cells)
            self.access_trials[(key,prior_origin,tuple(sorted(cells)))]+=1
            stopped=all(s in a and a[s]['position']==pos for s,pos in poses.items())
            if stopped and entry and self.footprints[key] and all(0<=x<w and 0<=y<h for x,y in entry):
                texture=tuple(first[y][x] for x,y in sorted(entry))
                if texture not in self.footprints[key]:
                    contacts={(x+dx,y+dy) for x,y in cells for dx,dy in ((0,1),(0,-1),(1,0),(-1,0))}
                    unlike={p for i,p in enumerate(sorted(entry)) if all(old[i]!=texture[i] for old in self.footprints[key])}
                    witnesses=[e for e in before['entities'] if e['signature'] not in poses and bool(unlike&contacts)
                               and unlike<=support(e)]
                    if len(witnesses)==1:
                        carrier=witnesses[0];blockkey=digest([self.epoch,self.segment,prior_origin,command,carrier['signature'],carrier['position'],poses])
                        if blockkey not in self.tested:self.block={'signature':carrier['signature'],'position':carrier['position'],'origin':prior_origin,
                            'command':command,'poses':poses,'expected':step['expected_after'],'fail_count':1,
                            'refs':self.pass_refs[key]+[before['observation_ref'],after['observation_ref']],
                            'key':blockkey}
        return {'status':reg['status'],'registration':reg,'source_ref':before['observation_ref'],'after_ref':after['observation_ref'],
            'segment':self.segment,'previous_origin':list(prior_origin),'registered_origin':list(self.origin),
            'new_viewport_pixels':fresh,'coverage_pixels':len(self.coverage),'newly_visible_distinct_occurrences':found,
            'blockage_question':None if not self.block else {'key':self.block['key'],'stationary_trials':self.block['fail_count']},
            'qualification':'screen-coverage estimate; foreground and fixed overlays can contribute'}
