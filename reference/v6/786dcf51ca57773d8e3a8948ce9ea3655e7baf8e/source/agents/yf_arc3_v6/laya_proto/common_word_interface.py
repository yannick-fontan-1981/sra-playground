"""Read a visible rewrite dictionary and learn the editable word interface."""
from collections import Counter,defaultdict,deque
from types import SimpleNamespace
import numpy as np
from agents.yf_arc3_v5.capabilities.typed_word_transduction import parse_typed_word,_WordBudget
from common_multiscale_constraints import digest,projection


def glyphs(rows,group,ink):
    a=np.asarray(rows);l,t,r,b=group['box'];k=group['size']
    result=[]
    for i in range((r-l+1)//k):
        mask=a[t+1:b,l+i*k+1:l+(i+1)*k-1]==ink
        orbit=[tuple(map(int,np.rot90(mask,j).ravel())) for j in range(4)]
        result.append(digest(min(orbit)))
    return tuple(result)


def focus(rows,g,cursor):
    a=np.asarray(rows);l,t,r,b=g['box'];k=g['size'];found=[]
    for i in range((r-l+1)//k):
        valid=True
        for part in cursor:
            x,y=l+i*k+part['dx'],t+part['dy'];w,h=part['width'],part['height']
            if min(x,y)<0 or x+w>a.shape[1] or y+h>a.shape[0]:valid=False;break
            got=set(zip(*np.nonzero(a[y:y+h,x:x+w]==part['hue'])[::-1]))
            if got!=set(map(tuple,part['mask'])):valid=False;break
        if valid:found.append(i)
    return found[0] if len(found)==1 else None


def scene(o,rows):
    a=np.asarray(rows);grouped=defaultdict(list)
    for e in o['entities']:
        l,t,r,b=e['bbox'];h=b-t+1;w=r-l+1
        if h<3 or w%h or e['rectangular']:continue
        cuts=[a[t:b+1,l+i*h:l+(i+1)*h] for i in range(w//h)]
        inks=[]
        for cut in cuts:
            edge=np.r_[cut[0],cut[-1],cut[:,0],cut[:,-1]]
            colors=set(map(int,cut.ravel()))-{e['palette_value']}
            if not np.all(edge==e['palette_value']) or len(colors)!=1:break
            inks.append(next(iter(colors)))
        if len(inks)==len(cuts) and len(set(inks))==1:
            grouped[h,inks[0]].append({'box':e['bbox'],'size':h,'type':e['palette_value']})
    candidates=[(k,ink,g) for (k,ink),g in grouped.items() if len(g)>=4]
    if not candidates:return None
    _,ink,groups=max(candidates,key=lambda z:z[0])
    by_y=defaultdict(list)
    for g in groups:by_y[g['box'][1]].append(g)
    table=[];words=[]
    for row in by_y.values():
        row.sort(key=lambda g:g['box'][0])
        if len(row)%2==0:
            for left,right in zip(row[::2],row[1::2]):
                if left['type']!=right['type']:
                    table.append((left,right))
        elif len(row)==1:words.append(row[0])
    if len(words)!=2 or not table:return None
    cursors=[]
    for g in words:
        l,t,r,b=g['box'];k=g['size']
        for i in range((r-l+1)//k):
            x=l+i*k;top=[];bottom=[]
            for e in o['entities']:
                L,T,R,B=e['bbox']
                if not(x<L<=R<x+k-1):continue
                if t-k<T<=B<t:top.append(e)
                if b<T<=B<=b+k:bottom.append(e)
            for p in top:
                for q in bottom:
                    A,B=p['bbox'],q['bbox']
                    if p['palette_value']!=q['palette_value'] or p['area']!=q['area'] or A[0]!=B[0] or A[2]!=B[2]:continue
                    if t+b-A[1]!=B[3] or t+b-A[3]!=B[1]:continue
                    h=A[3]-A[1]+1
                    if {(X,h-1-Y) for X,Y in p['mask']}!=set(map(tuple,q['mask'])):continue
                    cursor=[{'dx':e['bbox'][0]-x,'dy':e['bbox'][1]-t,'width':e['bbox'][2]-e['bbox'][0]+1,'height':e['bbox'][3]-e['bbox'][1]+1,
                        'hue':e['palette_value'],'mask':sorted(map(tuple,e['mask']))} for e in (p,q)]
                    cursors.append((g,cursor))
    if len(cursors)!=1:return None
    editable,cursor=cursors[0];source=next(g for g in words if g is not editable)
    rules=[]
    for left,right in table:
        rules.append(SimpleNamespace(input_type_ref=str(left['type']),output_type_ref=str(right['type']),left=glyphs(rows,left,ink),right=glyphs(rows,right,ink),
            rule_ref='rule_'+digest([left['box'],right['box']])[:12],provenance_refs=(o['observation_ref'],)))
    word=glyphs(rows,source,ink);maximum=(editable['box'][2]-editable['box'][0]+1)//editable['size']
    # The finite bound covers the complete tree of rule choices for this input.
    branching=len(rules)+1;depth=len(word)+1;states=branching**depth
    budget=_WordBudget(states*(sum(len(r.left)+len(r.right) for r in rules)+maximum+depth+3))
    parses,gaps,complete=parse_typed_word(word,rules,str(source['type']),str(editable['type']),maximum,states,budget)
    outputs={tuple(p['output_word']) for p in parses if len(p['output_word'])==maximum}
    if len(outputs)!=1 or budget.reached:return None
    return {'editable':editable,'source':source,'cursor':cursor,'ink':ink,'target':next(iter(outputs)),
            'rule_count':len(rules),'parse_count':len(parses),'bounded_derivations_complete':complete,'goal_length':maximum}


def edit_path(graph,start,goal):
    q=deque([start]);known={start:()}
    while q:
        g=q.popleft()
        if g==goal:return known[g]
        for key,edges in sorted(graph.items()):
            nxt=edges.get(g)
            if nxt is not None and nxt not in known:known[nxt]=known[g]+(key,);q.append(nxt)
    return None


def cursor_path(directions,start,target,n):
    q=deque([start]);known={start:()}
    while q:
        at=q.popleft()
        if at==target:return known[at]
        for key,d in sorted(directions.items()):
            nxt=(at+d)%n
            if nxt not in known:known[nxt]=known[at]+(key,);q.append(nxt)
    return None


def visit_plan(word,goal,at,edits,directions):
    wrong=[i for i,(a,b) in enumerate(zip(word,goal)) if a!=b];n=len(word)
    paths={i:edit_path(edits,word[i],goal[i]) for i in wrong}
    if any(v is None for v in paths.values()):return None
    frontier={(0,at):(0,())};count=len(wrong)
    for _ in range(count):
        following={}
        for (mask,pos),(cost,path) in frontier.items():
            for j,target in enumerate(wrong):
                if mask>>j&1:continue
                travel=cursor_path(directions,pos,target,n)
                if travel is None:continue
                route=path+travel+paths[target];key=mask|(1<<j),target
                if key not in following or len(route)<following[key][0]:following[key]=len(route),route
        frontier=following
    return min(frontier.values())[1] if frontier else () if not wrong else None


class WordInterface:
    def __init__(self):
        self.epoch=None;self.edit_graph=defaultdict(dict);self.focus_directions={};self.passed=[];self.events=[];self.closed=set()

    def read(self,rows):
        if not self.scene:return None
        g=self.scene['editable'];at=focus(rows,g,self.scene['cursor'])
        return (glyphs(rows,g,self.scene['ink']),at) if at is not None else None

    def propose(self,o,rows,inputs,remaining):
        keys=sorted(a['action_ref'] for a in inputs if not a.get('data'))
        if not keys or any(a.get('data') for a in inputs):return None
        if self.epoch!=o['level_epoch']:
            self.epoch=o['level_epoch'];self.scene=scene(o,rows);self.verified=set();self.tried=set();self.refs={};self.first=o['observation_ref'];self.cycle_start=None
        if not self.scene:return None
        current=self.read(rows)
        if current is None:return None
        word,at=current;goal=self.scene['target']
        if word==goal:return None
        route=visit_plan(word,goal,at,self.edit_graph,self.focus_directions)
        if not route:
            unknown=[key for key in keys if key not in self.focus_directions and key not in self.edit_graph and key not in self.tried]
            ongoing=[key for key in self.edit_graph if (key,word[at]) not in self.closed]
            if ongoing:key=sorted(ongoing)[0]
            elif unknown:key=unknown[0]
            else:return None
            route=(key,)
        steps=[];state=current
        for key in route[:min(remaining,16)]:
            w,pos=state;pred=None
            if key in self.focus_directions:pred=(w,(pos+self.focus_directions[key])%len(w))
            elif w[pos] in self.edit_graph.get(key,{}):
                new=list(w);new[pos]=self.edit_graph[key][w[pos]];pred=(tuple(new),pos)
            steps.append({'action':{'action_ref':key},'state':state,'expected_after':pred,
                'expected_before':{'level_epoch':self.epoch,'frame_hash':o['frame_hash'] if not steps else None}})
            if pred is None or key not in self.verified:break
            state=pred
        actions=[s['action'] for s in steps];refs=[o['observation_ref'],self.first,*self.refs.values()]
        focus_ref='C_word_'+digest([refs,actions])[:16]
        why='Use the observed typed dictionary to derive the required word and measured edit transitions to realize it.'
        info={'source_word_length':len(glyphs(rows,self.scene['source'],self.scene['ink'])),'desired_length':len(goal),'rules':self.scene['rule_count'],
            'complete_derivations':self.scene['parse_count'],'focused_slot':at,'remaining_disagreements':sum(a!=b for a,b in zip(word,goal)),
            'scope':'Glyph identity hypothesizes quarter-turn equivalence of the full inner mask; dictionary parsing uses the existing typed-word kernel.'}
        facts={'typed_dictionary_observed':True,'unique_goal_word':True,'cursor_and_editable_word_bound':True}
        return {'status':'proposed','kind':'typed_word_interface','word_plan':info,'actions':actions,'steps':steps,'facts':facts,
            'compositions':[{'id':focus_ref,'role':'information_question','observed':False,'open_question':why,'properties':info,'relations':['contributes_to:G_official_completion']}],
            'question':{'reason':why,'hypothesis_refs':refs},'route_refs':refs,'binding':{'observation_ref':o['observation_ref'],'level_epoch':self.epoch,'levels_completed':o['levels_completed']},
            'bundle_template':{'operation_key':'OP18','composition_ref':focus_ref,'objective_ref':'G_official_completion','preserve_refs':[],
                'purpose':why,'preconditions':facts,'evidence':refs,'actions':actions,'outcome_guard':{'path':['value'],'contains':focus_ref}}}

    def bind(self,p,domain):pass

    def before(self,p,i,public,o):
        b=p['binding'];s=p['steps'][i]
        ok=(public.level==b['level_epoch'] and public.levels_completed==b['levels_completed'] and s['action']['action_ref'] in public.available_action_refs
            and (i or o['observation_ref']==b['observation_ref']) and self.read(public.frame_rows)==s['state'])
        return {'admitted':bool(ok),'reason':'bind_full_glyph_word_and_focus'}

    def after(self,p,i,before,after,first,second):
        if (before['level_epoch'],before['state'],before['levels_completed'])!=(after['level_epoch'],after['state'],after['levels_completed']):
            return {'matched':None,'seal_prefix':True,'reason':'official_boundary'}
        pred=p['steps'][i]['expected_after'];matched=self.read(second)==pred if pred else None
        return {'matched':matched,'seal_prefix':matched is not True or i+1==len(p['steps']),'reason':'compare_observed_edit_or_cursor_transition'}

    def record(self,before,after,command,first,second,p,i):
        s=p['steps'][i];old=s['state'];key=command['action_ref'];ref=after['observation_ref']
        if after['levels_completed']>before['levels_completed']:
            self.passed.append({'score':after['levels_completed'],'ref':ref});return {'status':'official_boundary','ref':ref}
        new=self.read(second);event={'ref':ref,'input':key,'status':'unknown_transition'};self.tried.add(key)
        if new:
            word,at=old;out,focus=new;changed=[j for j,(a,b) in enumerate(zip(word,out)) if a!=b]
            if at==focus and changed==[at]:
                known=self.edit_graph[key].get(word[at])
                if known is not None and known!=out[at]:
                    self.edit_graph=defaultdict(dict);self.closed.clear();event['prior_cycle_refuted']=True
                self.edit_graph[key][word[at]]=out[at];self.verified.add(key);self.refs[key]=ref;event['status']='local_glyph_rewrite'
                reached=out[at];seen=set()
                while reached in self.edit_graph[key] and reached not in seen:
                    seen.add(reached);reached=self.edit_graph[key][reached]
                if reached in seen:
                    self.closed.update((key,g) for g in seen)
                # A witnessed opposite edge proposes an inverse traversal of a
                # previously closed cycle; every dispatched letter is guarded.
                for other,edges in list(self.edit_graph.items()):
                    if other!=key and (other,out[at]) in self.closed and edges.get(out[at])==word[at]:
                        inverse={v:k for k,v in edges.items()}
                        if len(inverse)==len(edges):self.edit_graph[key]=inverse;self.closed.update((key,g) for g in inverse)
            elif word==out and at!=focus:
                delta=(focus-at)%len(word)
                if delta in (1,len(word)-1):
                    self.focus_directions[key]=1 if delta==1 else -1;self.verified.add(key);self.refs[key]=ref;event['status']='cursor_step'
        self.events.append(event);return event
