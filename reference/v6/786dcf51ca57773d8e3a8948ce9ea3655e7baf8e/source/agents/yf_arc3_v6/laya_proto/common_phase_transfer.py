"""Rebind a temporal relation after a scored boundary, using only fresh public pixels."""
from collections import Counter,defaultdict,deque
import hashlib,json
import numpy as np


def patch(rows,pos,size):
    x,y=pos;w,h=size
    if x<0 or y<0 or x+w>rows.shape[1] or y+h>rows.shape[0]:return None
    return rows[y:y+h,x:x+w].tobytes()


class PhaseTransfer:
    def __init__(self,prior):self.prior=prior

    @classmethod
    def from_boundary(cls,memory,before,command,rows,after):
        m=memory.model;src=m['primary'];size=memory.size[src];site=memory.remote['site']
        entry=next((i for i,s in enumerate(memory.states) if s['ref']==memory.remote['entry_ref']),None)
        if entry is None or entry==0:return None
        keys=Counter();walkable=set();by_action=defaultdict(Counter)
        for i,cmd in enumerate(memory.commands):
            a,b=memory.states[i:i+2];u=a['poses'].get(src);v=b['poses'].get(src)
            if cmd is None or cmd==m['switch_input'] or u is None or v is None or u==v:continue
            if a['poses'].get(m['marker'])!=b['poses'].get(m['marker']):continue
            delta=(v[0]-u[0],v[1]-u[1])
            if delta[0] and delta[1]:continue
            by_action[cmd][delta]+=1
            observed=patch(a['rows'],v,size)
            if observed is not None:walkable.add(observed)
        vectors={k:v.most_common()[0][0] for k,v in by_action.items() if len(v)==1}
        p=memory.states[-1]['poses'].get(src);v=vectors.get(command['action_ref'])
        terminal=patch(np.asarray(rows,dtype=np.uint8),(p[0]+v[0],p[1]+v[1]),size) if p and v else None
        template=patch(memory.states[entry-1]['rows'],site,size)
        return cls({'marker':m['marker'],'primary':src,'secondary':m['other'],'shape':memory.geometry[src],
            'mask':memory.masks[src].tolist(),'size':size,'switch':m['switch_input'],'vectors':vectors,
            'locus_template':template,'terminal_template':terminal,'walkable':walkable,'boundary':after['observation_ref'],
            'entry':memory.remote['entry_ref'],'leave':memory.remote['leaving_ref'],'source_validation':memory.supported['validation']})

    def reset_epoch(self,ref):
        self.start=ref;self.sites=set();self.exits=set();self.samples={};self.pending={};self.prepared=[];self.mode_edges={}
        self.failures=Counter();self.attempted=Counter();self.hold_observed=set();self.visited=defaultdict(set);self.cache=None
        self.cycles=[];self.site_trials=Counter();self.local_vectors=defaultdict(set);self.portable_misses=set()

    def _roles(self,s):
        p=self.prior;return s['poses'].get(p['marker']),s['poses'].get(p['primary'])

    def _sites(self,rows,pos):
        p=self.prior;w,h=p['size']
        if rows.shape[0]<h or rows.shape[1]<w:return
        # Search all aligned locations. A rare exact shape+palette patch is a
        # conditional identity cue; repeated matches remain alternatives.
        dx=min((abs(v[0]) for v in p['vectors'].values() if v[0]),default=1)
        dy=min((abs(v[1]) for v in p['vectors'].values() if v[1]),default=1)
        found=[];ends=[]
        for y in range(pos[1]%dy,rows.shape[0]-h+1,dy):
            for x in range(pos[0]%dx,rows.shape[1]-w+1,dx):
                b=patch(rows,(x,y),p['size'])
                if b==p['locus_template']:found.append((x,y))
                if b==p['terminal_template']:ends.append((x,y))
        if 0<len(found)<=8:self.sites.update(found)
        if 0<len(ends)<=8:self.exits.update(ends)

    def _changed(self,a,b,model,owner):
        old,new=a['rows'],b['rows'];mask=old!=new
        for s in (a,b):
            for sig,pos in s['poses'].items():
                if owner.geometry.get(sig)!=model['shape'] and sig!=model['marker']:continue
                x,y=pos;w,h=owner.size[sig];mask[y:y+h,x:x+w]=False
        yy,xx=np.nonzero(mask);return [(int(x),int(y),int(old[y,x]),int(new[y,x])) for x,y in zip(xx,yy)]

    def _effect(self,s,site,owner):
        relation=self.samples.get(site)
        if not relation:return 'unknown'
        covered=set()
        for sig,pos in s['poses'].items():
            if owner.geometry.get(sig)==self.prior['shape']:
                covered.update((int(pos[0]+x),int(pos[1]+y)) for x,y in owner.masks[sig])
        visible=[p for p in relation['pixels'] if (p[0],p[1]) not in covered]
        if not visible:return 'unknown'
        if all(int(s['rows'][y,x])==new for x,y,old,new in visible):return 'present'
        if all(int(s['rows'][y,x])==old for x,y,old,new in visible):return 'absent'
        return 'partial'

    def observe(self,owner,before,after,command):
        a,b=owner.states[-2:];mode,p=self._roles(a);next_mode,q=self._roles(b);events=[]
        if mode is None or next_mode is None or p is None or q is None:return events
        self._sites(a['rows'],p);self._sites(b['rows'],q)
        ref=command['action_ref']
        if mode!=next_mode:
            if ref!=self.prior['switch']:self.portable_misses.add('unexpected_marker_transition');return events
            self.mode_edges[mode]=next_mode
            self.prepared.append({'mode':mode,'site':p if p in self.samples else None,'evidence':after['observation_ref']})
            if next_mode==self._roles(owner.states[0])[0]:
                self.cycles.append(tuple(item['mode'] for item in self.prepared));self.prepared=[]
            events.append({'kind':'measured_new_epoch_phase_edge','from':mode,'to':next_mode,'site_before':p,
                'actual_distinct_modes':len(set(self.mode_edges)|set(self.mode_edges.values())),'source':after['observation_ref']})
            self.pending={};return events
        vec=self.prior['vectors'].get(ref)
        if vec and p==q:self.failures[(mode,p,ref,patch(a['rows'],(p[0]+vec[0],p[1]+vec[1]),self.prior['size']))]+=1
        if vec and (q[0]-p[0],q[1]-p[1])==vec:self.local_vectors[(mode,ref)].add(p)
        if q!=p and q in self.sites:
            pixels=self._changed(a,b,self.prior,owner)
            if len(pixels)>=2:
                self.pending[q]={'pixels':pixels,'entry':after['observation_ref'],'from':p};self.site_trials[(mode,q)]+=1
                events.append({'kind':'portable_locus_remote_entry_candidate','locus':q,'remaining_changed_pixels':len(pixels),'source':after['observation_ref']})
        if p!=q and p in self.pending:
            x=self.pending.pop(p);reversed_pixels=[z for z in x['pixels'] if int(a['rows'][z[1],z[0]])==z[3] and int(b['rows'][z[1],z[0]])==z[2]]
            if len(reversed_pixels)>=2:
                self.samples[p]={'pixels':reversed_pixels,'entry':x['entry'],'departure':after['observation_ref']}
                events.append({'kind':'new_locus_reversal_observed','locus':p,'pixels':len(reversed_pixels),'source':after['observation_ref']})
        self.visited[mode].add(p);self.visited[mode].add(q)
        for item in self.prepared:
            site=item['site']
            if site and site!=q and self._effect(b,site,owner)=='present':
                self.hold_observed.add((mode,site))
        return events

    def _access(self,state,pos,mode,targets,owner):
        rows=state['rows'];size=self.prior['size'];routes={pos:[]};queue=deque([pos])
        while queue:
            p=queue.popleft()
            for cmd,vector in sorted(self.prior['vectors'].items()):
                q=(p[0]+vector[0],p[1]+vector[1]);tile=patch(rows,q,size)
                if tile is None or q in routes or self.failures[(mode,p,cmd,tile)]:continue
                if tile not in self.prior['walkable'] and q not in targets and q not in self.visited[mode]:continue
                routes[q]=routes[p]+[{'action_ref':cmd,'from':p,'to':q,'same_mode':len(self.local_vectors[(mode,cmd)])>=2}]
                queue.append(q)
        return routes

    def _make(self,owner,o,mode,pos,why,steps,cap):
        selected=[]
        for st in steps[:min(16,cap)]:
            if st['action_ref'] not in o['available_action_refs']:return None
            selected.append(st)
            if not st.get('same_mode'):break
        if not selected:return None
        cmds=[{'action_ref':s['action_ref']} for s in selected];p=self.prior
        trial=(mode,pos,why,cmds[0]['action_ref'],tuple(x['site'] for x in self.prepared))
        if self.attempted[trial]>=2:return None
        sid='C_portable_'+hashlib.sha256(json.dumps([o['observation_ref'],why,cmds]).encode()).hexdigest()[:18]
        facts={'rebound_visible_primary':True,'rebound_visible_marker':True,'fresh_match_or_open_experiment':True}
        evidence=[o['observation_ref'],p['boundary'],p['source_validation']]+[z['departure'] for z in self.samples.values()]
        for st in selected:
            st['action']={'action_ref':st['action_ref']};st['expected_before']={'level_epoch':o['level_epoch'],'frame_hash':o['frame_hash'] if st is selected[0] else None}
            st['expected_after']=st['to']
        plan={'portable':True,'mode':mode,'marker':p['marker'],'primary':p['primary'],'secondary':p['secondary'],
            'goal_site':None,'why':why,'details':{'held_remote_effect':False,'secondary':None,'source_authority':'prior hypothesis revalidated locally',
                'new_loci':sorted(self.sites),'locally_reversed_loci':sorted(self.samples),'prepared_loci':[v['site'] for v in self.prepared],
                'active_loci':[v['site'] for v in self.prepared if v['site'] and self._effect(owner.states[-1],v['site'],owner)=='present'],
                'observed_mode_edges':len(self.mode_edges)},'steps':selected}
        return {'status':'proposed','kind':'public_phase_experiment','phase_plan':plan,'actions':cmds,'steps':selected,'facts':facts,
            'compositions':[{'id':sid,'role':'information_question','observed':False,'open_question':why,'relations':['contributes_to:G_official_completion'],
                'properties':plan['details']}],'question':{'reason':why,'hypothesis_refs':evidence},'route_refs':evidence,
            'binding':{'observation_ref':o['observation_ref'],'level_epoch':o['level_epoch'],'levels_completed':o['levels_completed']},
            'bundle_template':{'operation_key':'OP18','composition_ref':sid,'objective_ref':'G_official_completion','preserve_refs':[],
                'preconditions':facts,'evidence':evidence,'purpose':why,'actions':cmds,'frozen_phase_plan':json.loads(json.dumps(plan)),
                'outcome_guard':{'path':['value'],'contains':sid}}}

    def propose(self,owner,o,cap):
        if 'unexpected_marker_transition' in self.portable_misses:return None
        s=owner.states[-1];mode,pos=self._roles(s)
        if mode is None or pos is None or owner.geometry[self.prior['primary']]!=self.prior['shape']:return None
        self._sites(s['rows'],pos)
        if not self.sites:return None
        assigned={item['site'] for item in self.prepared if item['site'] is not None}
        targets=self.sites-assigned;routes=self._access(s,pos,mode,targets|self.exits,owner)
        emit=lambda why,steps:self._make(owner,o,mode,pos,why,steps,cap)
        def flip():
            cmd=self.prior['switch']
            return emit('Test the next observed marker phase after preparing an independently reversible locus.',
                [{'action_ref':cmd,'from':pos,'to':None,'expected_mode':self.mode_edges.get(mode),'switch':True,'same_mode':False}])
        if pos in targets:
            if pos in self.samples:return flip()
            if pos in self.pending:
                previous=self.pending[pos]['from']
                if previous in routes:return emit('Leave the rebound locus once to test reversal of the distant change.',routes[previous])
        reachable=[z for z in targets if z!=pos and z in routes]
        if reachable:
            goal=min(reachable,key=lambda z:(len(routes[z]),z))
            return emit('Test a matching local appearance at a newly bound position in this epoch.',routes[goal])
        if not assigned:return None
        # After a prepared phase, seek a scored visual hypothesis if the prior
        # foreground is actually visible in this epoch. Any route remains a test.
        exits=[x for x in self.exits if x!=pos and x in routes]
        if exits:
            target=min(exits,key=lambda z:(len(routes[z]),z))
            return emit('Test access to a rebound scoring appearance after a prepared phase.',routes[target])
        # To test blocked access, approach the pixels whose change was actually
        # witnessed at a new locus. Prefer the unvisited reachable support.
        remote=[z for site in assigned for z in self.samples.get(site,{}).get('pixels',[])]
        if not remote:return None
        w,h=self.prior['size']
        def distance(p):return min(max(p[0]-x,0,x-p[0]-w+1)+max(p[1]-y,0,y-p[1]-h+1) for x,y,_,_ in remote)
        options=[p for p in routes if p!=pos and (p not in self.visited[mode] or distance(p)<distance(pos))]
        if options:
            target=min(options,key=lambda q:(distance(q),len(routes[q]),q))
            return emit('Explore access to the measured remote region while an earlier phase may maintain it.',routes[target])
        return None

    def before(self,proposal,i,public,obs):
        plan=proposal['phase_plan'];step=plan['steps'][i];p={e['signature']:tuple(e['position']) for e in obs['entities'] if not e['identity_ambiguous']}
        ok=(public.level==proposal['binding']['level_epoch'] and public.levels_completed==proposal['binding']['levels_completed']
            and step['action_ref'] in public.available_action_refs and p.get(plan['marker'])==tuple(plan['mode'])
            and p.get(plan['primary'])==tuple(step['from']) and (i>0 or obs['observation_ref']==proposal['binding']['observation_ref']))
        return {'admitted':bool(ok),'reason':'rebound_phase_and_pose' if ok else 'rebound_witness_changed'}

    def after(self,proposal,i,before,after,first,second):
        plan=proposal['phase_plan'];step=plan['steps'][i]
        if before['level_epoch']!=after['level_epoch'] or before['state']!=after['state'] or before['levels_completed']!=after['levels_completed']:
            return {'matched':None,'seal_prefix':True,'reason':'official_boundary'}
        p={e['signature']:tuple(e['position']) for e in after['entities'] if not e['identity_ambiguous']}
        mode=tuple(plan['mode']);actual=p.get(plan['marker'])
        ok=(actual is not None and actual!=mode and (step.get('expected_mode') is None or tuple(step['expected_mode'])==actual)) if step.get('switch') else (
            actual==mode and p.get(plan['primary'])==tuple(step['to']))
        if i==0:self.attempted[(mode,tuple(step['from']),plan['why'],step['action_ref'],tuple(x['site'] for x in self.prepared))]+=1
        return {'matched':bool(ok),'seal_prefix':not ok or i+1==len(plan['steps']) or not step['same_mode'],
                'reason':'new_epoch_response_measured' if ok else 'portable_hypothesis_diverged'}
