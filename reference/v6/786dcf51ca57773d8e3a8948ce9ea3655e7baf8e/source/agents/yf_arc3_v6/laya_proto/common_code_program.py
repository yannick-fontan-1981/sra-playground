"""Identify editable code columns and learn their finite movement semantics."""
from collections import defaultdict
import numpy as np
from geometric_observer import components
from common_multiscale_constraints import digest,projection,rows_digest

DIRECTIONS=((0,-1),(1,0),(0,1),(-1,0))


def input_at(inputs,box):
    x,y,r,b=box
    return next((a for a in inputs if a.get('data') and x<=a['data']['x']<=r and y<=a['data']['y']<=b),None)


def scene(o,rows,inputs):
    a=np.asarray(rows);parts=o['entities'];tiles=defaultdict(list)
    for e in parts:
        x,y,r,b=e['bbox']
        if e['rectangular'] and r-x==b-y and r>x:tiles[r-x+1].append(e)
    boards=[]
    for size,group in tiles.items():
        places={tuple(e['position']):e for e in group};left=set(places)
        while left:
            seed=left.pop();connected={seed};queue=[seed]
            for x,y in queue:
                for dx,dy in DIRECTIONS:
                    p=x+size*dx,y+size*dy
                    if p in left:left.remove(p);connected.add(p);queue.append(p)
            xs={x for x,y in connected};ys={y for x,y in connected}
            hues={places[p]['palette_value'] for p in connected}
            if len(xs)<3 or len(ys)<3 or len(hues)!=2:continue
            x0,y0=min(xs),min(ys);w=(max(xs)-x0)//size+1;h=(max(ys)-y0)//size+1
            if len(connected)*2<w*h:continue
            for obj in parts:
                if obj['palette_value'] in hues or obj['area']<=size*size/2:continue
                x,y,r,b=obj['bbox']
                if r-x+1!=size or b-y+1!=size or (x-x0)%size or (y-y0)%size:continue
                if not(x0<=x<x0+w*size and y0<=y<y0+h*size):continue
                mask=set(map(tuple,obj['mask']));targets=[]
                for cy in range(h):
                    for cx in range(w):
                        X,Y=x0+cx*size,y0+cy*size;cut=a[Y:Y+size,X:X+size]
                        for base in hues:
                            yy,xx=np.nonzero(cut==base)
                            if set(zip(map(int,xx),map(int,yy)))!=mask:continue
                            rim=a[max(0,Y-1):Y+size+1,max(0,X-1):X+size+1]
                            if np.count_nonzero(rim==obj['palette_value'])>=size:targets.append((cx,cy))
                if len(set(targets))!=1:continue
                boards.append({'origin':(x0,y0),'size':size,'shape':(w,h),'floor':hues,'hue':obj['palette_value'],'mask':mask,'goal':targets[0],
                    'start':((x-x0)//size,(y-y0)//size)})
    if len(boards)!=1:return None
    board=boards[0];x0,y0=board['origin'];size=board['size'];w,h=board['shape']
    glyphs=[];values=set()
    for e in parts:
        x,y,r,b=e['bbox'];length=r-x+1
        if not e['rectangular'] or b!=y or length<2:continue
        for v in parts:
            X,Y,R,B=v['bbox']
            if not v['rectangular'] or X!=R or B-Y+1!=length or 2*X!=x+r or Y!=y+2:continue
            glyphs.append((x,y,[e['bbox'],v['bbox']]))
            values|={e['palette_value'],v['palette_value']}
    if len(values)!=2:return None
    rows_by_x=defaultdict(list)
    for x,y,pair in glyphs:rows_by_x[x].append((y,pair))
    by_rows=defaultdict(list)
    for x,entries in rows_by_x.items():
        entries.sort();ys=tuple(y for y,_ in entries)
        by_rows[ys].append((x,[box for _,pair in entries for box in pair]))
    candidate_groups=[]
    for ys,cols in by_rows.items():
        cols.sort()
        if len(cols)<2:continue
        gap=min(b[0]-a[0] for a,b in zip(cols,cols[1:]));chunk=[]
        for col in cols:
            if chunk and col[0]-chunk[-1][0]!=gap:
                if len(chunk)>=2:candidate_groups.append((ys,chunk))
                chunk=[]
            chunk.append(col)
        if len(chunk)>=2:candidate_groups.append((ys,chunk))
    candidates=[]
    for ys,g in candidate_groups:
        if ys[0]<y0+h*size:continue
        middle=(g[0][0]+g[-1][0])/2
        if not x0<=middle<x0+w*size:continue
        bindings=[[input_at(inputs,box) for box in boxes] for x,boxes in g]
        if not all(all(row) for row in bindings):continue
        candidates.append((ys[0],g,bindings))
    if not candidates:return None
    y,g,bindings=min(candidates,key=lambda item:item[0]);bottom=max(box[3] for _,boxes in g for box in boxes)
    buttons=[]
    for e in parts:
        l,t,r,b=e['bbox']
        if e['palette_value'] in board['floor']|{board['hue']}:continue
        if t<=bottom or min(l,t)==0 or r==a.shape[1]-1 or b==a.shape[0]-1:continue
        if abs((r-l)-(b-t))>1 or r-l+1<=size or e['area']*2<=(r-l+1)*(b-t+1):continue
        cmd=input_at(inputs,e['bbox'])
        if cmd:buttons.append((abs((l+r)/2-(g[0][0]+g[-1][0])/2),e,cmd))
    if not buttons:return None
    _,button,execute=min(buttons,key=lambda x:x[0])
    examples=[]
    for ys,group in candidate_groups:
        if group==g or len(group[0][1])!=len(g[0][1]):continue
        left=min(x for x,_ in group);right=max(box[2] for _,boxes in group for box in boxes);bottom_demo=max(box[3] for _,boxes in group for box in boxes)
        for e in parts:
            box=e['bbox']
            if e['palette_value']!=board['hue'] or box[1]<=bottom_demo or max(box[2]-box[0]+1,box[3]-box[1]+1)>=size:continue
            cmd=input_at(inputs,box)
            if cmd:examples.append({'command':cmd,'box':box,'columns':[boxes for x,boxes in group],'stage':[left-size,0,right+size,ys[0]-1]})
    board.update(columns=[boxes for x,boxes in g],bit_commands=bindings,values=tuple(sorted(values)),execute=execute,button_box=button['bbox'],
        button_hue=button['palette_value'],examples=examples)
    allowed=set()
    for cy in range(h):
        for cx in range(w):
            cut=a[y0+cy*size:y0+(cy+1)*size,x0+cx*size:x0+(cx+1)*size]
            if set(map(int,cut.ravel())).issubset(board['floor']|{board['hue']}):allowed.add((cx,cy))
    allowed|={board['start'],board['goal']};board['allowed']=allowed
    return board


def position(rows,b):
    a=np.asarray(rows);x0,y0=b['origin'];s=b['size'];w,h=b['shape'];found=[]
    if y0+h*s>a.shape[0] or x0+w*s>a.shape[1]:return None
    for y in range(h):
        for x in range(w):
            cut=a[y0+y*s:y0+(y+1)*s,x0+x*s:x0+(x+1)*s]
            if all(int(cut[j,i])==b['hue'] for i,j in b['mask']):found.append((x,y))
    return found[0] if len(found)==1 else None


def bits(rows,b,columns=None):
    a=np.asarray(rows);out=[]
    for col in columns or b['columns']:
        vals=[]
        for box in col:
            colors=np.unique(projection(a,box))
            if len(colors)!=1 or int(colors[0]) not in b['values']:return None
            vals.append(b['values'].index(int(colors[0])))
        word=0
        for bit in vals:word=word*2+bit
        out.append(word)
    return tuple(out)


def move(p,d,b):
    q=p[0]+d[0],p[1]+d[1]
    return q if q in b['allowed'] else p


def physical_paths(b,start,length,effects):
    def walk(p,path):
        if len(path)==length:
            if p==b['goal']:yield path
            return
        distance=abs(p[0]-b['goal'][0])+abs(p[1]-b['goal'][1])
        if distance>length-len(path):return
        for code,d in effects.items():
            q=move(p,d,b)
            # An invalid step has unknown failure semantics; never plan on it.
            if q!=p:yield from walk(q,path+(code,))
    return list(walk(start,()))


class CodeProgram:
    def __init__(self):
        self.epoch=None;self.prior=();self.passed=[];self.events=[]

    def start(self,o,rows,inputs):
        self.epoch=o['level_epoch'];self.board=scene(o,rows,inputs);self.effects={};self.executed=set();self.demo_tried=set();self.counterexamples=[]
        self.evidence=[];self.toggle_known=False;self.initial_ref=o['observation_ref'];self.last_start=None

    def propose(self,o,rows,inputs,remaining):
        if o['level_epoch']!=self.epoch:self.start(o,rows,inputs)
        b=self.board
        if not b:return None
        code=bits(rows,b);pos=position(rows,b)
        if code is None or pos is None:return None
        choices=[]
        for word in physical_paths(b,pos,len(code),self.effects):
            if (pos,word) in self.executed:continue
            edits=sum((a^v).bit_count() for a,v in zip(code,word))
            choices.append((edits,word))
        wanted=min(choices)[1] if choices else code
        example=next((i for i in range(len(b['examples'])) if i not in self.demo_tried),None) if not choices else None
        nbits=len(b['columns'][0]);weights=tuple(1<<(nbits-j-1) for j in range(nbits))
        if example is None and not choices and self.executed and (pos,code) in self.executed:
            # A single-bit change tests an as-yet-unobserved code at a known
            # position. Its meaning remains open until a highlighted step.
            unknown=[]
            for col in range(len(code)):
                for bit in reversed(weights):
                    word=list(code);word[col]^=bit;word=tuple(word)
                    if (pos,word) not in self.executed:unknown.append(word)
            if not unknown:return None
            wanted=min(unknown)
        edits=[(i,j) for i,(a,v) in enumerate(zip(code,wanted)) for j,bit in enumerate(weights) if (a^v)&bit]
        steps=[];current=code
        if example is not None:
            card=b['examples'][example];box=list(card['box'])
            steps=[{'action':card['command'],'mode':'demonstrate','example':example,'code':code,'position':pos,'expected_after':None,'box':box,
                'point_digest':rows_digest(projection(rows,box))}]
        for i,j in (edits[:min(16,remaining)] if example is None else []):
            cmd=b['bit_commands'][i][j]
            if cmd not in inputs:return None
            word=list(current);word[i]^=weights[j];word=tuple(word);box=list(b['columns'][i][j])
            steps.append({'action':cmd,'mode':'edit','code':current,'position':pos,'expected_after':word,'box':box,
                'point_digest':rows_digest(projection(rows,box))})
            current=word
            if not self.toggle_known:break
        if example is None and len(steps)<min(16,remaining) and (not edits or self.toggle_known and len(steps)==len(edits)):
            cmd=b['execute'];box=list(b['button_box'])
            if cmd not in inputs:return None
            steps.append({'action':cmd,'mode':'execute','code':current,'position':pos,'expected_after':None,'box':box,
                'point_digest':rows_digest(projection(rows,box))})
        if not steps:return None
        for i,s in enumerate(steps):s['expected_before']={'level_epoch':self.epoch,'frame_hash':o['frame_hash'] if i==0 else None}
        acts=[s['action'] for s in steps];refs=list(dict.fromkeys([o['observation_ref'],self.initial_ref,*self.evidence]))
        focus='C_codes_'+digest([refs,acts])[:16];why='Test the labelled execution trace of editable code columns, then synthesize a program ending in the matching cavity.'
        info={'world_size':b['shape'],'tile_size':b['size'],'actor_position':pos,'goal':b['goal'],'current_codes':code,'desired_codes':wanted,
            'locally_observed_operators':len(self.effects),'observed_executions':len(self.executed),'available_examples':len(b['examples']),
            'scope':'Learn a label from its highlighted local example before using it in the actual world. Translation is admitted only after measured displacement.'}
        facts={'checkerboard_world_measured':True,'shape_cavity_correspondence':True,'editable_columns_bound':True}
        return {'status':'proposed','kind':'learned_code_program','code_plan':info,'actions':acts,'steps':steps,'facts':facts,
            'compositions':[{'id':focus,'role':'information_question','observed':False,'open_question':why,'properties':info,'relations':['contributes_to:G_official_completion']}],
            'question':{'reason':why,'hypothesis_refs':refs},'route_refs':refs,'binding':{'observation_ref':o['observation_ref'],'level_epoch':self.epoch,'levels_completed':o['levels_completed']},
            'bundle_template':{'operation_key':'OP18','composition_ref':focus,'objective_ref':'G_official_completion','preserve_refs':[],
                'purpose':why,'preconditions':facts,'evidence':refs,'actions':acts,'outcome_guard':{'path':['value'],'contains':focus}}}

    def bind(self,p,domain):
        frame=p['steps'][0]['expected_before']['frame_hash']
        for s in p['steps']:
            d=s['action']['data'];old=domain.bindings[self.epoch,frame][d['x'],d['y']]
            s['point_binding']={**old,'projection_bbox':s['box'],'projected_rows_digest':s['point_digest']}

    def before(self,p,i,public,o):
        s=p['steps'][i];bound=p['binding']
        ok=(public.level==bound['level_epoch'] and public.levels_completed==bound['levels_completed'] and s['action']['action_ref'] in public.available_action_refs
            and (i or o['observation_ref']==bound['observation_ref']) and bits(public.frame_rows,self.board)==s['code']
            and position(public.frame_rows,self.board)==s['position'])
        return {'admitted':bool(ok),'reason':'bind_actor_program_bits_and_epoch'}

    def after(self,p,i,before,after,first,second):
        if (before['level_epoch'],before['state'],before['levels_completed'])!=(after['level_epoch'],after['state'],after['levels_completed']):
            return {'matched':None,'seal_prefix':True,'reason':'official_boundary'}
        s=p['steps'][i];matched=bits(second,self.board)==s['expected_after'] and position(second,self.board)==s['position'] if s['expected_after'] else None
        return {'matched':matched,'seal_prefix':matched is not True or i+1==len(p['steps']),'reason':'compare_edit_or_observe_execution'}

    def record(self,before,after,command,first,second,p,i,frames=()):
        s=p['steps'][i];ref=after['observation_ref'];b=self.board;event={'ref':ref,'mode':s['mode']}
        if s['mode']=='edit':
            self.toggle_known=bits(second,b)==s['expected_after'];event['status']='observed_edit' if self.toggle_known else 'edit_refuted'
        else:
            demonstration=s['mode']=='demonstrate'
            if demonstration:
                ex=b['examples'][s['example']];self.demo_tried.add(s['example']);columns=ex['columns'];code=None;initial=None
            else:
                self.executed.add((s['position'],s['code']));columns=b['columns'];code=s['code'];initial=s['position']
            trace={};words_at={}
            for frame in frames:
                if demonstration:
                    current=bits(frame,b,columns)
                    if current is not None:code=current
                    l,t,r,bot=ex['stage']
                    objects=[q for q in components(frame) if set(map(tuple,q['mask']))==b['mask']
                        and l<=q['bbox'][0]<=q['bbox'][2]<=r and t<=q['bbox'][1]<=q['bbox'][3]<=bot]
                    pos=tuple(objects[0]['bbox'][:2]) if len(objects)==1 else None
                else:pos=position(frame,b)
                scores=[]
                for col in columns:
                    box=[col[0][0]-1,col[0][1]-1,col[0][2]+1,col[-1][3]+1]
                    scores.append(int(np.count_nonzero(projection(frame,box)==b['button_hue'])))
                if max(scores)==0:
                    if initial is None and pos is not None:initial=pos
                    continue
                if scores.count(max(scores))!=1:continue
                index=scores.index(max(scores))
                if pos is not None:
                    trace[index]=pos
                    if code is not None and index<len(code):words_at[index]=code[index]
            samples=[]
            if code is not None:
                for j,pos in sorted(trace.items()):
                    if j>=len(code):continue
                    start=initial if j==0 else trace.get(j-1)
                    if start is None:continue
                    dx,dy=pos[0]-start[0],pos[1]-start[1]
                    quantum=b['size'] if demonstration else 1
                    vector=(dx//quantum,dy//quantum)
                    if (dx,dy)!=(vector[0]*quantum,vector[1]*quantum) or vector not in DIRECTIONS:continue
                    label=words_at.get(j,code[j]);samples.append({'code':label,'displacement':vector})
                    if label in self.effects and self.effects[label]!=vector:self.counterexamples.append({'code':label,'before':self.effects.pop(label),'after':vector,'ref':ref})
                    else:self.effects[label]=vector
            event.update(status='demonstration_measured' if demonstration else 'execution_measured',highlighted_transitions=len(samples),observed_operators=len(self.effects),
                measured=samples,preserved_actual_world=position(first,b)==position(second,b) if demonstration else None)
            if samples:self.evidence.append(ref)
        if after['levels_completed']>before['levels_completed']:
            self.prior=dict(self.effects);self.passed.append({'score':after['levels_completed'],'ref':ref});event['status']='official_boundary'
        self.events.append(event);return event
