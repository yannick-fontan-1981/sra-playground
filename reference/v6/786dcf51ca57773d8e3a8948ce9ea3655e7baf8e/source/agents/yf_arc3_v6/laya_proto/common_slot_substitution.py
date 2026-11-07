"""Bind ordered targets to editable slots, including visually linked subrows."""
from collections import Counter,defaultdict
import numpy as np
from common_multiscale_constraints import digest,projection,rows_digest


def boundary(a,box):
    x,y,r,b=box
    if min(x,y)<1 or b+1>=a.shape[0] or r+1>=a.shape[1]:return ()
    return tuple(map(int,np.r_[a[y-1,x-1:r+2],a[b+1,x-1:r+2],a[y:b+1,x-1],a[y:b+1,r+1]]))


def layout(o,rows):
    a=np.asarray(rows);frames=defaultdict(list);tokens=defaultdict(list);entities=o['entities']
    for e in entities:
        l,t,r,b=e['bbox'];w,h=r-l+1,b-t+1
        if w!=h:continue
        if e['rectangular']:
            tokens[t,w].append(e);continue
        if w>=3 and e['area']==4*(w-1):
            cut=projection(a,e['bbox']).copy();cut[1:-1,1:-1]=e['palette_value']
            if np.all(cut==e['palette_value']):frames[t,w].append(e)
    matches=[]
    for (t,w),ref in frames.items():
        word=[e['palette_value'] for e in sorted(ref,key=lambda e:e['bbox'][0])]
        if len(set(word))<2:continue
        for (y,s),items in tokens.items():
            if t==y or not all(v in [e['palette_value'] for e in items] for v in word):continue
            inventory=sorted(items,key=lambda e:e['bbox'][0])
            if Counter(e['palette_value'] for e in inventory)!=Counter(word):continue
            matches.append((word,inventory,t,y,s))
    if len(matches)!=1:return None
    word,inventory,upper,lower,token_size=matches[0];groups={}
    for e in entities:
        l,t,r,b=e['bbox'];w,h=r-l+1,b-t+1
        if not(min(upper,lower)<t<b<max(upper,lower)) or not(w>h>token_size) or e['area']*2<w*h:continue
        upper_edge=a[t-1,l:r+1];lower_edge=a[b+1,l:r+1]
        rim,n=Counter(map(int,upper_edge)).most_common(1)[0]
        if 2*n<=w or 2*np.count_nonzero(lower_edge==rim)<=w:continue
        back=e['palette_value']
        if rim==back:continue
        candidates=defaultdict(list)
        for (row,width),cells in tokens.items():
            if not(t<row<b and width<token_size):continue
            for cell in cells:
                box=cell['bbox']
                if l<box[0] and box[2]<r and box[3]<b:candidates[row,width].append(box)
        valid=[sorted(v) for v in candidates.values() if len(v)>=2 and len({q[0]-p[0] for p,q in zip(sorted(v),sorted(v)[1:])})==1]
        if len(valid)!=1:continue
        if rim in groups:return None
        groups[rim]={'boxes':valid[0],'background':back}
    if not groups:return None
    links=set();nodes={}
    for label,g in groups.items():
        cells=[]
        for box in g['boxes']:
            edge=set(boundary(a,box));target=next(iter(edge)) if len(edge)==1 else None
            if target!=g['background'] and target in groups:
                links.add(target);cells.append(('call',target))
            else:cells.append(('slot',list(box)))
        nodes[label]=cells
    roots=set(groups)-links
    if len(roots)!=1:return None
    def expand(label,stack):
        if label in stack:return None
        seq=[]
        for op,arg in nodes[label]:
            child=expand(arg,stack|{label}) if op=='call' else [arg]
            if child is None:return None
            seq.extend(child)
            if len(seq)>len(word):return None
        return seq
    seq=expand(roots.pop(),set())
    if not seq or len(seq)!=len(word):return None
    required={}
    for box,v in zip(seq,word):
        k=tuple(box)
        if k in required and required[k]!=v:return None
        required[k]=v
    return {'targets':tuple(required.values()),'slots':list(required),'word':word,'inventory':[e['bbox'] for e in inventory],
        'hues':[e['palette_value'] for e in inventory],'neutral_borders':[boundary(a,e['bbox']) for e in inventory],
        'group_count':len(groups),'call_count':sum(kind=='call' for row in nodes.values() for kind,_ in row)}


def state(rows,scene):
    a=np.asarray(rows)
    available=[];selected=[]
    for i,(box,v,base) in enumerate(zip(scene['inventory'],scene['hues'],scene['neutral_borders'])):
        full=bool(np.all(projection(a,box)==v));available.append(full)
        edge=boundary(a,box)
        if full and edge and len(set(edge))==1 and edge!=base:selected.append(i)
    if len(selected)>1:return None
    contents=[]
    for box in scene['slots']:
        values=np.unique(projection(a,box))
        if len(values)!=1:return None
        v=int(values[0]);contents.append(v if v in scene['word'] else None)
    return tuple(available),tuple(contents),selected[0] if selected else None


def command_at(inputs,box):
    x,y,r,b=box
    return next((a for a in inputs if a.get('data') and x<=a['data']['x']<=r and y<=a['data']['y']<=b),None)


class SlotSubstitution:
    def __init__(self):
        self.epoch=None;self.passed=[];self.events=[]

    def propose(self,o,rows,inputs,remaining):
        submit=[x for x in inputs if not x.get('data')]
        if len(submit)!=1 or not any(x.get('data') for x in inputs):return None
        if o['level_epoch']!=self.epoch:
            self.epoch=o['level_epoch'];self.scene=layout(o,rows);self.tested=set();self.retired=False;self.refs={};self.first=o['observation_ref']
        if not self.scene or self.retired:return None
        scene=self.scene;start=state(rows,scene)
        if start is None:return None
        current=start;steps=[]
        for _ in range(min(remaining,16)):
            avail,contents,active=current
            wrong=[i for i,(v,w) in enumerate(zip(contents,scene['targets'])) if v!=w]
            if any(contents[i] is not None for i in wrong):return None
            if not wrong:
                mode='submit';cmd=submit[0];pred=None;box=None
            else:
                slot=next((i for i in wrong if active is not None and scene['targets'][i]==scene['hues'][active]),wrong[0])
                value=scene['targets'][slot]
                if active is None:
                    source=next((i for i in range(len(avail)) if avail[i] and scene['hues'][i]==value),None)
                    if source is None:return None
                    mode='select';box=scene['inventory'][source];pred=(avail,contents,source)
                elif scene['hues'][active]==value:
                    mode='place';box=scene['slots'][slot]
                    pred=(tuple(v and i!=active for i,v in enumerate(avail)),tuple(value if i==slot else x for i,x in enumerate(contents)),None)
                else:return None
                cmd=command_at(inputs,box)
                if not cmd:break
            steps.append({'action':cmd,'operation':mode,'state':current,'expected_after':pred,'address_box':list(box) if box else None,
                'point_digest':rows_digest(projection(rows,box)) if box else None,
                'expected_before':{'level_epoch':self.epoch,'frame_hash':o['frame_hash'] if not steps else None}})
            if mode not in self.tested or pred is None:break
            current=pred
        if not steps:return None
        acts=[s['action'] for s in steps];refs=list(dict.fromkeys([o['observation_ref'],self.first,*self.refs.values()]))
        focus='C_substitution_'+digest([refs,acts])[:16];why='Test a transfer into a measured slot of the expanded row, then validate its output sequence.'
        info={'reference':scene['word'],'expanded_slot_order':scene['slots'],'required_values':scene['targets'],'groups':scene['group_count'],
              'typed_references':scene['call_count'],'scope':'A same-color framed slot may expand its linked row. Output and control remain hypotheses until validation.'}
        facts={'ordered_shape_correspondence':True,'inventory_matches_reference_multiset':True,'slot_bindings':True}
        return {'status':'proposed','kind':'ordered_slot_substitution','slot_plan':info,'actions':acts,'steps':steps,'facts':facts,
            'compositions':[{'id':focus,'role':'information_question','observed':False,'open_question':why,'properties':info,'relations':['contributes_to:G_official_completion']}],
            'question':{'reason':why,'hypothesis_refs':refs},'route_refs':refs,'binding':{'observation_ref':o['observation_ref'],'level_epoch':self.epoch,'levels_completed':o['levels_completed']},
            'bundle_template':{'operation_key':'OP18','composition_ref':focus,'objective_ref':'G_official_completion','preserve_refs':[],
                'purpose':why,'preconditions':facts,'evidence':refs,'actions':acts,'outcome_guard':{'path':['value'],'contains':focus}}}

    def bind(self,p,domain):
        frame=p['steps'][0]['expected_before']['frame_hash']
        for s in p['steps']:
            if s['address_box']:
                d=s['action']['data'];binding=domain.bindings[self.epoch,frame][d['x'],d['y']]
                s['point_binding']={**binding,'projection_bbox':s['address_box'],'projected_rows_digest':s['point_digest']}

    def before(self,p,i,public,o):
        s=p['steps'][i];bound=p['binding']
        ok=(public.level==bound['level_epoch'] and public.levels_completed==bound['levels_completed'] and s['action']['action_ref'] in public.available_action_refs
            and (i or bound['observation_ref']==o['observation_ref']) and state(public.frame_rows,self.scene)==s['state'])
        return {'admitted':bool(ok),'reason':'bind_visible_inventory_selection_and_all_occupancies'}

    def after(self,p,i,before,after,first,second):
        if (before['level_epoch'],before['state'],before['levels_completed'])!=(after['level_epoch'],after['state'],after['levels_completed']):
            return {'matched':None,'seal_prefix':True,'reason':'official_boundary'}
        pred=p['steps'][i]['expected_after'];matched=state(second,self.scene)==pred if pred else None
        return {'matched':matched,'seal_prefix':matched is not True or i+1==len(p['steps']),'reason':'compare_frozen_selection_transfer'}

    def record(self,before,after,command,first,second,p,i):
        st=p['steps'][i];mode=st['operation'];ref=after['observation_ref']
        if after['levels_completed']>before['levels_completed']:
            self.passed.append({'score':after['levels_completed'],'ref':ref});return {'status':'official_boundary','evidence':ref}
        matched=state(second,self.scene)==st['expected_after']
        if matched:self.tested.add(mode);self.refs[mode]=ref
        else:self.retired=True
        event={'status':'matched_bound_operation' if matched else 'operation_refuted','operation':mode,'matched':matched,'ref':ref}
        self.events.append(event);return event
