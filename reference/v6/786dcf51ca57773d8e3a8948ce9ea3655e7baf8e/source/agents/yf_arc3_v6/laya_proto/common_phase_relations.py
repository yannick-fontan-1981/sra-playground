"""Local hypotheses about a path repeated by a second visible occurrence.

All signatures, poses, phase markers, input references and affected pixels are
learned from the current episode. Coordinates refer only to the measured display.
An occluded or ambiguous identity is unknown, never an invented motion.
"""
from collections import Counter,defaultdict,deque
import hashlib,json
import numpy as np
from common_linked_contact import LinkedContact


def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()


def compressed(values):
    result=[]
    for v in values:
        if v is not None and (not result or result[-1]!=v):result.append(v)
    return result


class PhaseRelations:
    def __init__(self):
        self.epoch=None;self.states=[];self.commands=[];self.geometry={};self.size={};self.masks={};self.portable=None
        self.model=None;self.trial=None;self.supported=None;self.remote=None;self.checked=set()
        self.events=[];self.attempts=Counter();self.missed=set()
        self.linked_contact=LinkedContact()

    def snapshot(self,obs,rows):
        unique={e['signature']:e for e in obs['entities'] if not e['identity_ambiguous']}
        for sig,e in unique.items():
            if sig not in self.geometry:
                self.geometry[sig]=digest(e['mask'])
                self.masks[sig]=np.asarray(e['mask'],dtype=int)
                l,t,r,b=e['bbox'];self.size[sig]=(r-l+1,b-t+1)
        return {'ref':obs['observation_ref'],'frame':obs['frame_hash'],'poses':{s:tuple(e['position']) for s,e in unique.items()},
                'occurrences':[{'signature':e['signature'],'position':e['position'],'geometry':digest(e['mask'])}for e in obs['entities']],
                'rows':np.asarray(rows,dtype=np.uint8)}

    def preservation_obligations(self,obs,rows):
        return self.linked_contact.preservation_obligations(obs,rows)

    def switches(self,marker):
        m=[s['poses'].get(marker) for s in self.states]
        return [i for i in range(1,len(m)) if m[i]!=m[i-1]]

    def _fit(self):
        if len(self.states)<6:return
        candidates=[];first=self.states[0]['poses']
        for marker in first:
            modes=[s['poses'].get(marker) for s in self.states]
            if None in modes or len(set(modes))<2:continue
            changes=self.switches(marker)
            if len(changes)<2:continue
            phase_order=[modes[0]]+[modes[i] for i in changes]
            if len(set(phase_order))==len(phase_order):continue
            inputs={self.commands[i-1] for i in changes}
            if len(inputs)!=1 or None in inputs:continue
            b,c=changes[:2];segment=self.states[:b];later=self.states[b:c]
            if not segment or not later:continue
            for primary in first:
                path=compressed(s['poses'].get(primary) for s in segment)
                if len(set(path))<3:continue
                others={sig for s in later for sig in s['poses'] if sig!=primary and self.geometry[sig]==self.geometry[primary]}
                for other in others:
                    visible=compressed(s['poses'].get(other) for s in later)
                    if len(set(visible))<3 or visible[-1]!=path[-1]:continue
                    if not any(s['poses'].get(other) is not None and s['poses'].get(primary) is not None
                               and s['poses'][other]!=s['poses'][primary] for s in later):continue
                    # Missing/overlaid occurrences may hide the start. Validate
                    # a consecutive matching portion, rather than fitting a reordering.
                    if not any(path[k:k+len(visible)]==visible for k in range(len(path))):continue
                    candidates.append((len(set(visible)),marker,primary,other,next(iter(inputs)),b,c,path,visible))
        if not candidates:return
        candidates.sort(key=lambda r:(-r[0],r[2],r[3],r[1]));_,marker,primary,other,cmd,b,c,path,visible=candidates[0]
        self.model={'marker':marker,'primary':primary,'other':other,'switch_input':cmd,
            'source_mode':self.states[0]['poses'][marker],'response_mode':self.states[b]['poses'][marker],
            'first_endpoint':path[-1],'formed_at':self.states[-1]['ref'],'switch_evidence':[self.states[b]['ref'],self.states[c]['ref']],
            'observed_source_path':path,'matching_visible_path':visible,'other_compatible_bindings':len(candidates)-1,
            'phase_count_is_inductive':True,
            'qualification':'conditional path repetition; autonomous dynamics and phase-specific alternatives remain open'}
        self.remote=self._remote(b,c)
        self.events.append({'kind':'path_relation_candidate','model':self.model,'remote_candidate':self.remote})

    def _remote(self,b,c):
        primary=self.model['primary'];other=self.model['other'];candidates=[]
        for i in range(b+1,c):
            pos=self.states[i]['poses'].get(primary)
            if pos is None or self.states[i-1]['poses'].get(primary) in (pos,None):continue
            j=i+1
            while j<c and self.states[j]['poses'].get(primary)==pos:j+=1
            if j>=c or j==i+1 or self.states[j]['poses'].get(primary) is None:continue
            held=self.states[j-1]['poses'].get(other)
            if held is None or self.states[j]['poses'].get(other)!=held:continue
            start,entered,held_scene,left=[self.states[k]['rows'] for k in (i-1,i,j-1,j)]
            mask=(start!=entered)&(entered==held_scene)&(start==left)
            for k in range(i,j):mask&=self.states[k]['rows']==entered
            for k in (i-1,i,j-1,j):
                for sig in (primary,other):
                    xy=self.states[k]['poses'].get(sig)
                    if xy is None:continue
                    x,y=xy;w,h=self.size[sig];mask[y:y+h,x:x+w]=False
            yy,xx=np.nonzero(mask);pixels=sorted((int(x),int(y),int(start[y,x]),int(entered[y,x])) for x,y in zip(xx,yy))
            if len(pixels)>=2:
                candidates.append({'site':pos,'pixels':pixels,'entry_ref':self.states[i]['ref'],'leaving_ref':self.states[j]['ref'],
                    'other_stayed_at_exit':held,'persistence_steps':j-i,'exclusive_cause_established':False})
        if not candidates:return None
        candidates.sort(key=lambda x:(-len(x['pixels']),-x['persistence_steps'],x['site']))
        best=candidates[0]
        if any(len(x['pixels'])==len(best['pixels']) and x['site']!=best['site'] for x in candidates[1:]):return None
        return best

    def record(self,before,after,command,first,second):
        if self.epoch!=before['level_epoch']:
            self.__init__();self.epoch=before['level_epoch']
        if before['level_epoch']!=after['level_epoch'] or before['state']!=after['state']:
            former=self.portable
            if after['levels_completed']>before['levels_completed']:
                from common_phase_transfer import PhaseTransfer
                carry=PhaseTransfer.from_boundary(self,before,command,first,after) if self.model and self.supported and self.remote else former
            else:carry=None
            self.__init__();self.epoch=after['level_epoch'];self.portable=carry
            self.states=[self.snapshot(after,second)]
            if carry:carry.reset_epoch(after['observation_ref'])
            return [{'kind':'recall_as_hypothesis','prior_scoring_boundary':carry.prior['boundary'],'new_epoch':self.epoch}] if carry else []
        if not self.states:self.states.append(self.snapshot(before,first))
        if self.states[-1]['ref']!=before['observation_ref']:raise ValueError('Phase records must follow actual observations')
        self.commands.append(None if command.get('data') else command['action_ref']);self.states.append(self.snapshot(after,second))
        self.events=[]
        self.linked_contact.observe(self,after)
        self.events.extend(self.linked_contact.events)
        self.linked_contact.events.clear()
        if not self.model:self._fit()
        if self.portable:self.events+=self.portable.observe(self,before,after,command)
        if not self.model:return self.events
        m=self.model;s=self.states[-1];prior=self.states[-2];mode=s['poses'].get(m['marker'])
        if mode==m['response_mode'] and prior['poses'].get(m['marker'])==m['source_mode'] and s['ref']!=m['switch_evidence'][0]:
            switches=self.switches(m['marker']);src_start=switches[-2] if len(switches)>1 else 0
            path=compressed(st['poses'].get(m['primary']) for st in self.states[src_start:-1])
            self.trial={'start':s['ref'],'source_path':path,'endpoint':path[-1] if path else None,'visible':[],'primary_at_endpoint':set(),'refuted':False}
            self.events.append({'kind':'freeze_future_path_prediction','source':s['ref'],'path':path,'model_source':m['formed_at']})
        t=self.trial
        if t and mode==m['response_mode'] and t['source_path'] and not t['refuted']:
            other=s['poses'].get(m['other']);primary=s['poses'].get(m['primary'])
            if other is not None:
                if not t['visible'] or t['visible'][-1]!=other:t['visible'].append(other)
                if not any(t['source_path'][k:k+len(t['visible'])]==t['visible'] for k in range(len(t['source_path']))):
                    t['refuted']=True;self.events.append({'kind':'counterexample','source':t['start'],'actual':s['ref'],'visible':list(t['visible'])})
                elif other==t['endpoint'] and primary is not None and primary!=other:
                    t['primary_at_endpoint'].add(primary)
                    if (not self.supported and t['endpoint']!=m['first_endpoint'] and len(t['primary_at_endpoint'])>=2):
                        self.supported={'freeze':t['start'],'validation':s['ref'],'new_endpoint':t['endpoint'],'source_endpoint':m['first_endpoint'],
                            'independent_primary_positions':sorted(t['primary_at_endpoint']),'qualification':'local correlation; overlap can make an identity unobservable'}
                        self.events.append({'kind':'changed_endpoint_locally_supported',**self.supported})
        return self.events

    def condition_measure(self,state):
        if not self.remote:return {'status':'unknown','visible':0,'occluded':0}
        covered=set()
        for key in ('primary','other'):
            sig=self.model[key];pose=state.get('poses',{}).get(sig)
            if pose is not None:
                covered.update((int(pose[0]+dx),int(pose[1]+dy)) for dx,dy in self.masks[sig])
        visible=[p for p in self.remote['pixels'] if (p[0],p[1]) not in covered]
        matched=sum(int(state['rows'][y,x])==new for x,y,old,new in visible)
        return {'status':'unknown' if not visible else 'visible_match' if matched==len(visible) else 'visible_difference',
            'visible':len(visible),'matched':matched,'occluded':len(self.remote['pixels'])-len(visible)}

    def condition(self,state):
        return self.condition_measure(state)['status']=='visible_match'

    def _paths(self,start,mode):
        sig=self.model['primary'];marker=self.model['marker'];switch=self.model['switch_input']
        edges=defaultdict(dict);vectors=defaultdict(Counter);blocked=set()
        for i,cmd in enumerate(self.commands):
            pre,post=self.states[i],self.states[i+1];p=pre['poses'].get(sig);q=post['poses'].get(sig);local=pre['poses'].get(marker)
            if cmd is None or cmd==switch or p is None or q is None or local!=post['poses'].get(marker):continue
            if p==q:
                if not self.condition(pre):blocked.add((p,cmd))
                continue
            dx=q[0]-p[0];dy=q[1]-p[1]
            if dx and dy:continue
            vectors[cmd][(dx,dy)]+=1
            edge=(cmd,q);edges[p][edge]=edges[p].get(edge,False) or local==mode
        paths={start:[]};queue=deque([start])
        while queue:
            origin=queue.popleft()
            for (cmd,dest),same in sorted(edges[origin].items(),key=lambda e:(not e[1],e[0])):
                if dest in paths:continue
                paths[dest]=paths[origin]+[{'action_ref':cmd,'from':origin,'to':dest,'same_mode':same}];queue.append(dest)
        vectors={k:v.most_common(1)[0][0] for k,v in vectors.items() if len(v)==1}
        return paths,vectors,blocked

    def _near(self,p):
        w,h=self.size[self.model['primary']];x,y=p
        return min(max(x-u,0,u-(x+w-1))+max(y-v,0,v-(y+h-1)) for u,v,old,new in self.remote['pixels'])

    def _bundle(self,obs,why,steps,mode,details,cap):
        chosen=[]
        for step in steps[:min(cap,16)]:
            if step['action_ref'] not in obs['available_action_refs']:return None
            chosen.append(step)
            if not step.get('same_mode'):break
        if not chosen:return None
        commands=[{'action_ref':s['action_ref']} for s in chosen]
        key='C_phase_'+digest([obs['observation_ref'],why,commands])[:16]
        evidence=[obs['observation_ref'],self.model['formed_at'],self.supported['freeze'],self.supported['validation'],self.remote['entry_ref'],self.remote['leaving_ref']]
        facts={'phase_observed':True,'repeated_path_validated_in_changed_segment':True,'remote_reversal_measured':True,'current_receiver_bound':True}
        stepdata=[{'action':cmd,'expected_before':{'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash'] if i==0 else None},
                   'expected_after':s['to'],'from':s['from'],'to':s['to'],'expected_mode':s.get('expected_mode',mode),
                   'same_mode':s.get('same_mode',False)} for i,(cmd,s) in enumerate(zip(commands,chosen))]
        plan={'mode':mode,'marker':self.model['marker'],'primary':self.model['primary'],'secondary':self.model['other'],
                'goal_site':self.remote['site'],'why':why,'details':details,'steps':stepdata}
        return {'status':'proposed','kind':'public_phase_experiment','phase_plan':plan,'actions':commands,'steps':stepdata,
              'facts':facts,'compositions':[{'id':key,'role':'information_question','observed':False,'open_question':why,
                 'properties':{'site':self.remote['site'],'phase':mode,'remote_effect_pixels':len(self.remote['pixels']),'terminal_relevance':'unknown'},
                 'relations':['contributes_to:G_official_completion']}],
              'question':{'reason':why,'hypothesis_refs':evidence[1:]},'route_refs':evidence,
              'binding':{'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'levels_completed':obs['levels_completed']},
              'bundle_template':{'operation_key':'OP18','composition_ref':key,'objective_ref':'G_official_completion',
                 'preserve_refs':[],'purpose':why,'evidence':evidence,'actions':commands,'preconditions':facts,
                 'frozen_phase_plan':json.loads(json.dumps(plan)),'outcome_guard':{'path':['value'],'contains':key}}}

    def propose(self,obs,rows,inputs,remaining):
        linked=self.linked_contact.propose(self,obs,rows,inputs,remaining) if self.states else None
        if linked:return linked
        if self.portable and self.states and obs['observation_ref']==self.states[-1]['ref']:
            candidate=self.portable.propose(self,obs,remaining)
            if candidate:return candidate
        if not self.model or not self.supported or not self.remote or not self.states:return None
        s=self.states[-1];m=self.model
        if obs['observation_ref']!=s['ref']:return None
        mode=s['poses'].get(m['marker']);primary=s['poses'].get(m['primary']);other=s['poses'].get(m['other'])
        if primary is None or mode not in (m['source_mode'],m['response_mode']):return None
        site=self.remote['site'];paths,vectors,blocked=self._paths(primary,mode)
        switch=m['switch_input'];trial=self.trial;held=other==site and self.condition(s)
        phase_key=(mode,primary,other,self.condition(s))
        def emit(why,steps,extra=None):
            if not steps or self.attempts[(why,phase_key,steps[0]['action_ref'])]>=2:return None
            return self._bundle(obs,why,steps,mode,{'secondary':other,'held_remote_effect':held,'exclusive_cause_established':False,
                'source_phase':m['source_mode'],'response_phase':m['response_mode'],**(extra or {})},remaining)
        def flip(why,target):
            return emit(why,[{'action_ref':switch,'from':primary,'to':None,'expected_mode':target,'same_mode':False}])
        if mode==m['source_mode']:
            if primary==site:return flip('Test whether the next segment preserves the newly prepared endpoint.',m['response_mode'])
            return emit('Prepare the observed position associated with a reversible remote effect.',paths.get(site,[]))
        if trial is None or trial['refuted'] or trial['endpoint']!=site:
            return flip('Return to the observed preparation mode to test a different future endpoint.',m['source_mode'])
        if other==site and not self.condition(s):
            return None  # The held-effect prediction did not materialize.
        # Approach the region with the previously observed reversible change.
        # The active receiver is free to follow a different path than the copy.
        if not held:
            viable=[p for p in paths if p!=primary and self._near(p)<self._near(primary)]
            if not viable:return None
            target=min(viable,key=lambda p:(self._near(p),len(paths[p]),p))
            return emit('Approach the remote region while testing the independent receiver path.',paths[target])
        # Find an unanswered input at an accessible position *while the other
        # occurrence and remote effect remain visible*. An observed blocked
        # entry into the changed region outranks an uncharacterized edge.
        held_edges=defaultdict(dict);tested=set();visited={primary}
        for i,cmd in enumerate(self.commands):
            pre,post=self.states[i],self.states[i+1];p=pre['poses'].get(m['primary']);q=post['poses'].get(m['primary'])
            if p is None or q is None or cmd is None or cmd==switch:continue
            if pre['poses'].get(m['other'])!=site or not self.condition(pre):continue
            tested.add((p,cmd));visited.update((p,q))
            if p!=q and post['poses'].get(m['other'])==site and self.condition(post):held_edges[p][cmd]=q
        access={primary:[]};pending=deque([primary])
        while pending:
            p=pending.popleft()
            for cmd,q in sorted(held_edges[p].items()):
                if q not in access:access[q]=access[p]+[{'action_ref':cmd,'from':p,'to':q,'same_mode':True}];pending.append(q)
        choices=[];h,w=s['rows'].shape
        for p,route in access.items():
            for cmd,(dx,dy) in vectors.items():
                q=(p[0]+dx,p[1]+dy)
                if not (0<=q[0]<w and 0<=q[1]<h) or (p,cmd) in tested:continue
                if self.attempts[('Test an access while the remote effect is held by a second occurrence.',phase_key,(route[0]['action_ref'] if route else cmd))]>=2:continue
                rank=(not((p,cmd) in blocked and self._near(q)==0),q in visited,self._near(q),len(route),cmd)
                choices.append((rank,route+[{'action_ref':cmd,'from':p,'to':q,'same_mode':False}]))
        if not choices:return None
        return emit('Test an access while the remote effect is held by a second occurrence.',min(choices,key=lambda x:x[0])[1])

    def before(self,proposal,index,public,obs):
        if proposal['phase_plan'].get('bootstrap'):return self.linked_contact.before(proposal,index,public,obs)
        if proposal['phase_plan'].get('portable'):return self.portable.before(proposal,index,public,obs)
        plan=proposal['phase_plan'];step=plan['steps'][index];bound=proposal['binding']
        poses={e['signature']:tuple(e['position']) for e in obs['entities'] if not e['identity_ambiguous']}
        ok=(public.level==bound['level_epoch'] and public.levels_completed==bound['levels_completed']
            and step['action']['action_ref'] in public.available_action_refs and poses.get(plan['marker'])==tuple(plan['mode'])
            and poses.get(plan['primary'])==tuple(step['from']) and (index>0 or obs['observation_ref']==bound['observation_ref']))
        if plan['details']['held_remote_effect']:
            ok=ok and poses.get(plan['secondary'])==tuple(plan['goal_site']) and self.condition({'rows':np.asarray(public.frame_rows),'poses':poses})
        return {'admitted':bool(ok),'reason':'phase_and_receiver_bound' if ok else 'phase_receiver_or_held_effect_changed'}

    def after(self,proposal,index,before,after,first,second):
        if proposal['phase_plan'].get('bootstrap'):return self.linked_contact.after(proposal,index,before,after,first,second)
        if proposal['phase_plan'].get('portable'):return self.portable.after(proposal,index,before,after,first,second)
        plan=proposal['phase_plan'];step=plan['steps'][index]
        if before['level_epoch']!=after['level_epoch'] or before['state']!=after['state'] or before['levels_completed']!=after['levels_completed']:
            return {'matched':None,'seal_prefix':True,'reason':'official_boundary'}
        poses={e['signature']:tuple(e['position']) for e in after['entities'] if not e['identity_ambiguous']}
        ok=poses.get(plan['marker'])==tuple(step['expected_mode'])
        if step['to'] is not None:ok=ok and poses.get(plan['primary'])==tuple(step['to'])
        if plan['details']['held_remote_effect']:
            ok=ok and poses.get(plan['secondary'])==tuple(plan['goal_site']) and self.condition({'rows':np.asarray(second),'poses':poses})
        if index==0:
            old_poses={e['signature']:tuple(e['position']) for e in before['entities'] if not e['identity_ambiguous']}
            here=(tuple(plan['mode']),tuple(step['from']),plan['details']['secondary'],self.condition({'rows':np.asarray(first),'poses':old_poses}))
            self.attempts[(plan['why'],here,step['action']['action_ref'])]+=1
        return {'matched':bool(ok),'seal_prefix':not ok or index+1==len(plan['steps']) or not step['same_mode'],
                'reason':'projected_phase_response' if ok else 'phase_prediction_diverged'}
