"""Public pixel map, camera registration and finite declared terrain search."""
import json,math
from collections import Counter,deque
from pathlib import Path
from geometric_observer import components
POLICY_PATH=Path(__file__).with_name('bp35_terrain.drm.json')

class TerrainPlanner:
    def __init__(self):
        self.policy=json.loads(POLICY_PATH.read_text());self.cursor_signature=None;self.wall_signature=None;self.floor_color=None;self.effects=[];self.lattice=None;self.known_motion=set();self.gravity_confirmed=False

    def measure(self,rows):
        cs=components(rows);families={}
        for c in cs:
            width=c['bbox'][2]-c['bbox'][0]+1;height=c['bbox'][3]-c['bbox'][1]+1
            if width==height and 3<=width<len(rows)//4 and c['area']==width*width-4:families.setdefault((width,c['color']),[]).append(c)
        families=[parts for parts in families.values() if len(parts)>=2]
        if families:
            squares=max(families,key=len);size=squares[0]['bbox'][2]-squares[0]['bbox'][0]+1;deltas=[]
            for a in squares:
                for b in squares:
                    if a is b:continue
                    if a['bbox'][0]==b['bbox'][0]:deltas.append(abs(a['bbox'][1]-b['bbox'][1]))
                    if a['bbox'][1]==b['bbox'][1]:deltas.append(abs(a['bbox'][0]-b['bbox'][0]))
            pitch=math.gcd(*[d for d in deltas if d]) if any(deltas) else 0
            if pitch<=size:raise ValueError('Repeated material does not establish a separated lattice')
            residues=Counter((c['bbox'][0]%pitch,c['bbox'][1]%pitch) for c in squares)
            if len(residues)!=1:raise ValueError('Material origins disagree on lattice phase')
            if self.lattice and self.lattice!=(size,pitch):raise ValueError('Observed lattice changed within game')
            self.lattice=(size,pitch);self.phase=next(iter(residues))
        elif self.lattice is None:raise ValueError('No repeated material lattice evidence')
        size,pitch=self.lattice;area=size*size
        ox,oy=self.phase;tiles={};patterns={};points={}
        for y in range(oy,len(rows)-size,pitch):
            for x in range(ox,len(rows[0])-size+1,pitch):
                pattern=tuple(rows[j][i] for j in range(y,y+size) for i in range(x,x+size));sig=tuple(sorted(Counter(pattern).items()))
                q=((x-ox)//pitch,(y-oy)//pitch);patterns[q]=pattern;tiles[q]=sig;points[q]=(x+size//2,y+size//2)
        uniform=Counter(sig[0][0] for sig in tiles.values() if len(sig)==1)
        if not uniform:raise ValueError('No observed open substrate')
        self.floor_color=uniform.most_common(1)[0][0]
        if self.wall_signature is None:self.wall_signature=Counter(s for s in tiles.values() if len(s)>1).most_common(1)[0][0]
        if self.cursor_signature is None:
            maximum=max(len(s) for s in tiles.values());candidates=[s for s in tiles.values() if len(s)==maximum]
            if len(candidates)!=1:raise ValueError('Initial controlled-body morphology ambiguous')
            self.cursor_signature=candidates[0]
        cursors=[p for p,sig in tiles.items() if sig==self.cursor_signature]
        if len(cursors)!=1:raise ValueError('Current controlled-body identity ambiguous')
        cells={}
        for q,sig in tiles.items():
            counts=sorted(c for color,c in sig);pattern=patterns[q]
            if sig==self.cursor_signature:kind='cursor'
            elif len(sig)==1 and sig[0][0]==self.floor_color:kind='floor'
            elif sig==self.wall_signature:kind='wall'
            elif counts==[4,area-4]:kind='solid'
            else:
                nonfloor={(i%size,i//size) for i,c in enumerate(pattern) if c!=self.floor_color};cross=False
                for color in dict(sig):
                    if color==self.floor_color:continue
                    pts={(i%size,i//size) for i,c in enumerate(pattern) if c==color};left=min(x for x,y in pts);top=min(y for x,y in pts);width=max(x for x,y in pts)-left+1;height=max(y for x,y in pts)-top+1
                    normalized={(x-left,y-top) for x,y in pts}
                    if width==height and width>=3 and width%2 and normalized==({(width//2,k) for k in range(width)}|{(k,width//2) for k in range(width)}):cross=True
                if cross:kind='target'
                elif self.floor_color in dict(sig) and len(sig)<=2 and len(nonfloor)<area-4:kind='dotted'
                else:kind='danger'
            cells[q]={'kind':kind,'signature':sig}
        return {'cells':cells,'cursor':cursors[0],'points':points,'phase':self.phase}

    def start(self,rows):
        obs=self.measure(rows);self.offset=(0,0);self.map={};self.failed=set();self.steps=0;self.target=None
        self.install(obs,self.offset);self.last_obs=obs;return self.summary()

    def install(self,obs,offset):
        self.visible={}
        for q,cell in obs['cells'].items():
            p=(q[0]+offset[0],q[1]+offset[1]);self.visible[p]=obs['points'][q]
            if cell['kind']=='cursor':self.map[p]={'kind':'floor','signature':((self.floor_color,self.lattice[0]**2),)};self.cursor=p
            else:self.map[p]=cell
            if cell['kind']=='target':self.target=p
        self.offset=offset

    def register(self,obs,changed):
        scores=[]
        for dy in range(-12,13):
            for dx in range(-12,13):
                offset=(self.offset[0]+dx,self.offset[1]+dy);same=bad=0
                for q,c in obs['cells'].items():
                    if c['kind']=='cursor':continue
                    p=(q[0]+offset[0],q[1]+offset[1])
                    if p==changed or p==self.cursor or p not in self.map:continue
                    old=self.map[p]
                    if old['signature']==c['signature']:same+=1
                    else:bad+=1
                if same>=15:scores.append(((same-5*bad,same,-abs(dx)-abs(dy)),offset,bad))
        if not scores:raise ValueError('No stationary camera registration')
        scores.sort(reverse=True);best=scores[0]
        if best[2]>2:raise ValueError('Camera registration conflicts with stationary support')
        if len(scores)>1 and scores[1][0][:2]==best[0][:2] and scores[1][1]!=best[1]:raise ValueError('Ambiguous camera translation')
        return best[1]

    def settle(self,position,edits):
        x,y=position;path=[]
        for _ in range(200):
            p=(x,y);kind=self.kind(p,edits)
            if kind=='danger':return None,'unsafe',path
            if kind=='target':return p,'goal',path
            if kind=='unknown':return p,'frontier',path
            nxt=(x,y-1);above=self.kind(nxt,edits)
            if above in ('wall','solid'):return p,'stop',path
            y-=1;path.append((x,y))
        raise ValueError('Gravity domain exceeded')

    def kind(self,p,edits):
        kind=self.map.get(p,{'kind':'unknown'})['kind']
        if p in edits:return 'floor' if kind=='solid' else 'solid'
        return kind

    def options(self,pos,edits):
        x,y=pos;out=[]
        for ref,dx in self.policy['hypotheses']['horizontal_actions'].items():
            p=(x+dx,y)
            if self.kind(p,edits) not in ('solid','wall','danger'):
                dest,status,path=self.settle(p,edits)
                if dest is not None:out.append((dest,edits,{'action_ref':ref},status,path))
        click=set()
        for xx in (x-1,x,x+1):
            for yy in range(y,max(y-12,min(p[1] for p in self.map)-1),-1):
                p=(xx,yy);kind=self.kind(p,edits)
                if kind in ('solid','dotted') and p in self.visible:click.add(p)
                if kind in ('wall','danger','solid'):break
        for p in sorted(click):
            if p in edits:continue
            changed=edits|{p};dest,status,path=self.settle(pos,changed)
            if dest is not None:out.append((dest,changed,{'action_ref':'ACTION6','world_point':p},status,path))
        return out

    def route(self):
        initial=(self.cursor,frozenset());q=deque([(initial,[])]);seen={initial};frontiers=[];goal=None
        while q:
            (pos,edits),route=q.popleft()
            if len(route)>=self.policy['planning']['max_depth']:continue
            for dest,changed,command,status,path in self.options(pos,edits):
                if not route and (self.cursor,command['action_ref'],command.get('world_point')) in self.failed:continue
                step={'command':command,'from':pos,'to':dest,'outcome':status,'gravity_path':path};candidate=route+[step]
                if status=='goal':return candidate,len(seen)
                if status=='frontier':frontiers.append(candidate);continue
                nxt=(dest,frozenset(changed))
                if nxt not in seen:seen.add(nxt);q.append((nxt,candidate))
                if len(seen)>=self.policy['planning']['max_states']:q.clear();break
        if frontiers:
            # The policy requests a shortest safe boundary, not a hidden target coordinate.
            frontiers.sort(key=lambda r:(len(r),r[-1]['to'][1],r[-1]['to'][0]));return frontiers[0],len(seen)
        raise ValueError('No safe target or world-frontier witness in admitted graph')

    def portfolio(self,revision,level):
        route,states=self.route();prefix=[];actions=[]
        for step in route[:self.policy['execution']['max_bundle_actions']]:
            command=dict(step['command']);known=command['action_ref'] in self.known_motion and self.gravity_confirmed
            if prefix and (not known or 'world_point' in command):break
            if 'world_point' in command:
                x,y=self.visible[tuple(command.pop('world_point'))];command['data']={'x':x,'y':y}
            prefix.append(step);actions.append(command)
            if not known or step['outcome']=='frontier':break
        comps=[{'id':g['id'],'properties':{'definition':g['composition']},'things':['cursor','terrain','safe_stops','target'],'relations':['G_terminal'],'role':'objective'} for g in self.policy['goals']]
        comps.append({'id':'C_route','properties':{'route':route,'graph_states':states,'known_target':self.target},'things':['current_support','gravity_path'],'relations':['contributes_to:G_terminal'],'role':'intermediate'})
        bundle={'id':'B0','operation_key':'OP28' if self.target else 'OP18','composition_ref':'C_route','objective_ref':'G_terminal' if self.target else 'G_reveal','preserve_refs':['G_preserve'],'observation_revision':revision,'level_epoch':level,'kind':'realize' if self.target else 'probe','actions':actions,'purpose':'Prepare only the obstacle or protective stop required by a safe horizontal/gravity route; reveal unknown world until the contact target is observed.','preconditions':{'source_rule_applicable':True},'preservation_evidence':{'G_preserve':'all modeled traversed cells exclude potential danger; required stops retained'},'evidence':['public tile morphology','stationary-map registration','finite safe route witness'],'recipe':'terrain_dependency' if actions[0]['action_ref']=='ACTION6' else 'horizontal_then_gravity','predicted_steps':prefix}
        return json.loads(json.dumps([comps,{'B0':bundle}]))

    def suffix_guard(self,chosen,step_index):
        step=chosen['predicted_steps'][step_index]
        if chosen['objective_ref']=='G_reveal' and self.target is not None:return {'reason':'target_revealed','target':self.target}
        if tuple(step['from'])!=self.cursor:return {'reason':'current_support_changed','observed':self.cursor,'bound':step['from']}
        command=step['command']
        if command['action_ref'] in self.policy['hypotheses']['horizontal_actions']:
            entrance=(self.cursor[0]+self.policy['hypotheses']['horizontal_actions'][command['action_ref']],self.cursor[1])
            for point in [entrance]+[tuple(p) for p in step['gravity_path']]:
                kind=self.kind(point,frozenset())
                if kind in ('danger','wall','solid'):return {'reason':'new_evidence_invalidates_path','point':point,'kind':kind}
        return None

    def observe(self,rows,chosen,before_hash,after_hash,completed,step_index=0):
        step=chosen['predicted_steps'][step_index] if 'predicted_steps' in chosen else chosen['predicted_step'];command=step['command'];old=self.cursor;changed=tuple(command['world_point']) if 'world_point' in command else None
        if completed:
            if step['outcome']!='goal':raise ValueError('Unexpected completion without observed target witness')
            effect={'action':command['action_ref'],'official_completion':True,'prediction_matches':True}
        else:
            obs=self.measure(rows);offset=self.register(obs,changed);self.install(obs,offset);self.last_obs=obs
            if step['outcome']!='frontier' and self.cursor!=tuple(step['to']):raise ValueError('Gravity endpoint mismatch: '+str((step['to'],self.cursor)))
            if before_hash==after_hash:self.failed.add((old,command['action_ref'],changed))
            if changed is not None and changed in self.map and self.map[changed]['kind'] not in ('floor','solid','dotted'):raise ValueError('Terrain click produced unclassified effect')
            if command['action_ref'] in self.policy['hypotheses']['horizontal_actions'] and self.cursor[0]-old[0]==self.policy['hypotheses']['horizontal_actions'][command['action_ref']]:self.known_motion.add(command['action_ref'])
            if self.cursor[1]<old[1]:self.gravity_confirmed=True
            effect={'action':command['action_ref'],'before_cursor':old,'after_cursor':self.cursor,'camera_offset':offset,'changed_terrain':changed,'prediction_matches':True,'revealed_cells':len(self.map)}
        self.effects.append(effect);self.steps+=1;return effect

    def summary(self):
        return {'world_cells':len(self.map),'visible_cells':len(self.visible),'cursor':self.cursor,'camera_offset':self.offset,'target':self.target,'lattice':self.lattice,'phase':self.phase,'roles':dict(Counter(c['kind'] for c in self.map.values()))}
