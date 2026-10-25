"""MOTO — Moto Orbit, custom_3, v2.1. Deterministic fixed-point orbit puzzle.

ACTION1–4 move the selected post one 4px editing step. ACTION5 launches the
whole autonomous run. ACTION6 selects / places a post; ACTION7 resets the level.
Frames: 64x64 palette indices. No dependencies, solver, network or real-time
clock. Collisions use every occupied motorcycle pixel, including during arcs.
A crash restores the motorcycle but preserves the player's post arrangement.
"""
from __future__ import annotations
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Any
import json
from math import isqrt

SIZE=FRAME=64
GAME_ID,FAMILY,WAVE,REVISION='moto-c3000001','moto_orbit','custom_3','v2.1'
FPS=20
Q,R,STEP=64,256,32
TICK_MS=26
CELL_PX=4
DISTANCE_SCALE=1024
PALETTE=['#FFFFFF', '#CCCCCC', '#999999', '#666666', '#333333', '#000000', '#E53AA3', '#FF7BCC', '#F93C31', '#1E93FF', '#88D8F1', '#FFDC00', '#FF851B', '#921231', '#4FCC30', '#A356D6']
POST_COLOR={1:12,2:8,3:6}
# Native silhouettes, also used for contact and placement validation.
POST_MASKS={1: ['00000', '00100', '01110', '11111', '00000'], 2: ['00000', '01110', '01110', '01110', '00000'], 3: ['01110', '11111', '11111', '11111', '01110']}
TRAIL_COLORS=[0,2,3]
CIRCLE=[[256, 0], [255, 25], [251, 50], [245, 74], [237, 98], [226, 121], [213, 142], [198, 162], [181, 181], [162, 198], [142, 213], [121, 226], [98, 237], [74, 245], [50, 251], [25, 255], [0, 256], [-25, 255], [-50, 251], [-74, 245], [-98, 237], [-121, 226], [-142, 213], [-162, 198], [-181, 181], [-198, 162], [-213, 142], [-226, 121], [-237, 98], [-245, 74], [-251, 50], [-255, 25], [-256, 0], [-255, -25], [-251, -50], [-245, -74], [-237, -98], [-226, -121], [-213, -142], [-198, -162], [-181, -181], [-162, -198], [-142, -213], [-121, -226], [-98, -237], [-74, -245], [-50, -251], [-25, -255], [0, -256], [25, -255], [50, -251], [74, -245], [98, -237], [121, -226], [142, -213], [162, -198], [181, -181], [198, -162], [213, -142], [226, -121], [237, -98], [245, -74], [251, -50], [255, -25]]
DEFAULT_LEVELS=json.loads('[{"id": "L01", "title": "Le double détour", "start": [10, 46, 0], "exit": {"side": "S", "at": 34}, "walls": [[28, 36, 4, 16]], "posts": [{"x": 34, "y": 30, "quarters": 1, "id": "P1"}, {"x": 50, "y": 18, "quarters": 2, "id": "P2"}], "version": 2, "revision": "v2.1", "number": 1}, {"id": "L02", "title": "Trois formes, une sortie", "start": [54, 46, 32], "exit": {"side": "E", "at": 14}, "walls": [[48, 16, 4, 20], [36, 16, 4, 32], [44, 4, 4, 32], [24, 48, 32, 4], [40, 8, 4, 32]], "posts": [{"x": 58, "y": 26, "quarters": 2, "id": "P1"}, {"x": 42, "y": 46, "quarters": 1, "id": "P2"}, {"x": 54, "y": 30, "quarters": 3, "id": "P3"}], "version": 2, "revision": "v2.1", "number": 2}, {"id": "L03", "title": "Les retours en cascade", "start": [10, 46, 0], "exit": {"side": "W", "at": 14}, "walls": [[4, 24, 20, 4], [24, 40, 4, 16], [28, 4, 4, 24], [16, 32, 8, 4], [36, 8, 4, 32], [4, 40, 12, 4], [4, 16, 16, 4]], "posts": [{"x": 30, "y": 50, "quarters": 2, "id": "P1"}, {"x": 26, "y": 22, "quarters": 2, "id": "P2"}, {"x": 50, "y": 46, "quarters": 3, "id": "P3"}, {"x": 6, "y": 6, "quarters": 1, "id": "P4"}], "version": 2, "revision": "v2.1", "number": 3}, {"id": "L04", "title": "Les boucles imbriquées", "start": [10, 46, 48], "exit": {"side": "N", "at": 42}, "walls": [[12, 40, 32, 4], [40, 24, 4, 16], [20, 20, 16, 4], [4, 12, 24, 4], [12, 28, 4, 12], [28, 16, 4, 16], [44, 4, 4, 8], [52, 4, 4, 20]], "posts": [{"x": 26, "y": 34, "quarters": 2, "id": "P1"}, {"x": 6, "y": 38, "quarters": 1, "id": "P2"}, {"x": 18, "y": 38, "quarters": 1, "id": "P3"}, {"x": 46, "y": 34, "quarters": 3, "id": "P4"}, {"x": 42, "y": 50, "quarters": 3, "id": "P5"}], "version": 2, "revision": "v2.1", "number": 4}, {"id": "L05", "title": "Le verrou des six virages", "start": [10, 46, 48], "exit": {"side": "N", "at": 34}, "walls": [[32, 28, 4, 16], [12, 4, 4, 28], [20, 28, 4, 16], [24, 28, 4, 16], [28, 20, 8, 4], [16, 8, 16, 4], [36, 12, 16, 4], [12, 44, 4, 12], [56, 20, 4, 32], [40, 28, 4, 24], [48, 16, 4, 16]], "posts": [{"x": 38, "y": 42, "quarters": 2, "id": "P1"}, {"x": 34, "y": 50, "quarters": 1, "id": "P2"}, {"x": 18, "y": 50, "quarters": 1, "id": "P3"}, {"x": 38, "y": 18, "quarters": 3, "id": "P4"}, {"x": 10, "y": 30, "quarters": 2, "id": "P5"}, {"x": 38, "y": 26, "quarters": 1, "id": "P6"}], "version": 2, "revision": "v2.1", "number": 5}, {"id": "L06", "title": "Le labyrinthe des orbites", "start": [50, 10, 16], "exit": {"side": "W", "at": 22}, "walls": [[48, 24, 4, 16], [24, 4, 4, 20], [16, 24, 16, 4], [16, 28, 4, 16], [32, 32, 4, 20], [12, 52, 32, 4], [8, 24, 4, 16], [4, 12, 8, 4], [4, 8, 12, 4], [28, 40, 4, 12]], "posts": [{"x": 54, "y": 34, "quarters": 3, "id": "P1"}, {"x": 54, "y": 30, "quarters": 2, "id": "P2"}, {"x": 46, "y": 42, "quarters": 2, "id": "P3"}, {"x": 14, "y": 50, "quarters": 1, "id": "P4"}, {"x": 30, "y": 30, "quarters": 2, "id": "P5"}, {"x": 18, "y": 6, "quarters": 3, "id": "P6"}], "version": 2, "revision": "v2.1", "number": 6}]')
MOVE={1:[0,-4],2:[0,4],3:[-4,0],4:[4,0]}
BIKE=[[-2,0,1],[-1,0,0],[0,0,0],[1,0,0],[2,0,0],[1,-1,0],[1,1,0],[0,-1,1],[0,1,1]]


def integer(x): return type(x) is int and abs(x)<=9007199254740991

def rnd(x): return (x+Q//2)//Q

def post_pixels(p):
    return [(p['x']+x-2,p['y']+y-2)
            for y,row in enumerate(POST_MASKS[p['quarters']])
            for x,v in enumerate(row) if v=='1']

def bike_pixels(p):
    ux,uy=CIRCLE[p['a']%64]
    return [(rnd(p['x']+(dx*ux-dy*uy)//4),rnd(p['y']+(dx*uy+dy*ux)//4),c) for dx,dy,c in BIKE]

def gate(l,x,y):
    """The exit occupies one complete 4x4 perimeter tile; its lane stays open."""
    s,at=l['exit']['side'],l['exit']['at']
    return ((s=='E' and x>=60 and at-2<=y<at+2) or
            (s=='W' and x<4 and at-2<=y<at+2) or
            (s=='N' and y<4 and at-2<=x<at+2) or
            (s=='S' and y>=56 and at-2<=x<at+2))

def wall_at(l,x,y):
    # Four-pixel perimeter, on the same lattice as interior wall tiles.
    if x<4 or x>=60 or y<4 or y>=56:
        return not gate(l,x,y)
    return any(a<=x<a+w and b<=y<b+h for a,b,w,h in l['walls'])


def collision(l,posts,p):
    pixels=bike_pixels(p)
    if any(wall_at(l,x,y) for x,y,_ in pixels): return 'wall'
    occupied={q for post in posts for q in post_pixels(post)}
    if any((x,y) in occupied for x,y,_ in pixels): return 'post'
    return None

def escaped(l,p):
    s,at=l['exit']['side'],l['exit']['at']*Q
    return ((s=='E' and p['x']>=62*Q and p['a']==0 and abs(p['y']-at)<=Q) or
            (s=='W' and p['x']<=Q and p['a']==32 and abs(p['y']-at)<=Q) or
            (s=='N' and p['y']<=Q and p['a']==48 and abs(p['x']-at)<=Q) or
            (s=='S' and p['y']>=56*Q and p['a']==16 and abs(p['x']-at)<=Q))

def valid_placement(l,posts,index,x,y):
    if not all(integer(v) for v in (x,y)) or not(6<=x<=58 and 6<=y<=50 and (x-6)%4==0 and (y-6)%4==0): return False
    pixels=post_pixels(dict(posts[index],x=x,y=y))
    if any(wall_at(l,a,b) or gate(l,a,b) for a,b in pixels): return False
    occupied={q for i,p in enumerate(posts) if i!=index for q in post_pixels(p)}
    if set(pixels).intersection(occupied): return False
    start={'x':l['start'][0]*Q,'y':l['start'][1]*Q,'a':l['start'][2]}
    return not set(pixels).intersection((a,b) for a,b,_ in bike_pixels(start))

def validate_level(raw):
    l=deepcopy(raw)
    if not isinstance(l,dict) or not isinstance(l.get('id'),str) or not isinstance(l.get('title'),str): raise ValueError('Missing level identifier/title.')
    start=l.get('start')
    if not isinstance(start,list) or len(start)!=3 or not all(integer(x) for x in start) or start[2] not in (0,16,32,48): raise ValueError('Invalid motorcycle start.')
    if not(6<=start[0]<=58 and 6<=start[1]<=50 and (start[0]-6)%4==0 and (start[1]-6)%4==0): raise ValueError('Start outside the editing lattice.')
    ex=l.get('exit',{})
    if ex.get('side') not in ('N','S','E','W') or not integer(ex.get('at')) or not 6<=ex['at']<=50 or (ex['at']-6)%4: raise ValueError('Invalid white exit.')
    if not isinstance(l.get('walls'),list): raise ValueError('Missing walls.')
    for r in l['walls']:
        if (not isinstance(r,list) or len(r)!=4 or not all(integer(v) for v in r)
                or any(v % CELL_PX for v in r) or r[0]<4 or r[1]<4
                or min(r[2:])<CELL_PX or r[0]+r[2]>60 or r[1]+r[3]>56):
            raise ValueError('Interior walls must occupy whole aligned 4x4 cells.')
    posts=l.get('posts')
    if not isinstance(posts,list) or not 1<=len(posts)<=6: raise ValueError('One to six posts are required.')
    if len({p.get('id') for p in posts})!=len(posts): raise ValueError('Duplicate post id.')
    for i,p in enumerate(posts):
        if not isinstance(p.get('id'),str) or type(p.get('quarters')) is not int or p['quarters'] not in POST_COLOR or not valid_placement(l,posts,i,p.get('x'),p.get('y')): raise ValueError('Invalid post placement.')
    if collision(l,posts,{'x':start[0]*Q,'y':start[1]*Q,'a':start[2]}): raise ValueError('Motorcycle starts inside an obstacle.')
    return l

def initial(l):
    return {'posts':deepcopy(l['posts']),'selected':-1,'actions':0,'moves':0,'attempts':0}


def trajectory(l,posts,max_ticks=2048):
    """Simulate all motion. Coordinates use 1/64 px; the circle table is exact.

    A straight motorcycle engages an exactly lateral post at radius 4px. During
    the committed arc another post on the opposite flank (within 0.5px of the
    ideal tangent centre) is contradictory. The active post cannot retrigger
    until the motorcycle has left its radius, but remains conflict-relevant.
    """
    p={'x':l['start'][0]*Q,'y':l['start'][1]*Q,'a':l['start'][2]}
    orbit=None;cool=-1;seen=set();poses=[{**p,'active':-1}];turns=[]
    def result(event,ids=None): return {'event':event,'poses':poses,'turns':turns,'conflict_posts':ids or [],'ticks':len(poses)-1}
    for t in range(max_ticks):
        err=collision(l,posts,p)
        if err:return result(err)
        if escaped(l,p):return result('success')
        key=(p['x'],p['y'],p['a'], None if orbit is None else (orbit['i'],orbit['rad'],orbit['sign'],orbit['remaining']),cool)
        if key in seen:return result('loop')
        seen.add(key)
        if orbit is not None:
            i=orbit['i'];c=posts[i];ox=2*p['x']-c['x']*Q;oy=2*p['y']-c['y']*Q
            for j,other in enumerate(posts):
                if j!=i and (other['x']*Q-ox)**2+(other['y']*Q-oy)**2 <= (Q//2)**2:
                    return result('conflict',[i,j])
        else:
            if cool>=0:
                c=posts[cool]
                if (p['x']-c['x']*Q)**2+(p['y']-c['y']*Q)**2>R*R:cool=-1
            ux,uy=CIRCLE[p['a']];matches=[]
            for i,c in enumerate(posts):
                dx,dy=c['x']*Q-p['x'],c['y']*Q-p['y']
                if dx*ux+dy*uy==0 and abs(ux*dy-uy*dx)==R*R:
                    matches.append((i,1 if ux*dy-uy*dx>0 else -1))
            if len({s for _,s in matches})>1:return result('conflict',[i for i,_ in matches])
            available=[(i,s) for i,s in matches if i!=cool]
            if available:
                i,sign=available[0]
                orbit={'i':i,'sign':sign,'rad':(p['a']-sign*16)%64,'remaining':posts[i]['quarters']*16}
                turns.append({'post':i,'sign':sign,'quarters':posts[i]['quarters'],'tick':t})
        if orbit is not None:
            orbit['rad']=(orbit['rad']+orbit['sign'])%64
            rx,ry=CIRCLE[orbit['rad']];c=posts[orbit['i']]
            p={'x':c['x']*Q+rx,'y':c['y']*Q+ry,'a':(orbit['rad']+orbit['sign']*16)%64}
            active=orbit['i'];orbit['remaining']-=1
            if orbit['remaining']==0:cool=active;orbit=None
        else:
            ux,uy=CIRCLE[p['a']];p={**p,'x':p['x']+ux//8,'y':p['y']+uy//8};active=-1
        poses.append({**p,'active':active})
    return result('limit')


def motion_samples(poses):
    """One displayed pose per 4px of traveled path; collision substeps are intact.

    The first and final poses are also returned. Arc lengths use the fixed-point
    polyline, with floor(sqrt(dx²+dy²)*1024) in both Python and JavaScript.
    """
    if not poses:
        return []
    indices=[0];distance=0;next_frame=CELL_PX*Q*DISTANCE_SCALE
    for i in range(1,len(poses)):
        dx=poses[i]['x']-poses[i-1]['x'];dy=poses[i]['y']-poses[i-1]['y']
        distance+=isqrt((dx*dx+dy*dy)*DISTANCE_SCALE*DISTANCE_SCALE)
        if distance>=next_frame:
            indices.append(i)
            while next_frame<=distance:
                next_frame+=CELL_PX*Q*DISTANCE_SCALE
    if indices[-1]!=len(poses)-1:
        indices.append(len(poses)-1)
    return indices


def render(l,s,completed=None,pose=None,trail=None,border=None,conflict=None):
    completed=completed or [False]*6;trail=trail or []
    p=pose or {'x':l['start'][0]*Q,'y':l['start'][1]*Q,'a':l['start'][2],'active':-1}
    f=[[5]*64 for _ in range(64)]
    def put(x,y,c):
        if 0<=x<64 and 0<=y<64:f[y][x]=c
    def fill(x,y,w,h,c):
        for yy in range(max(0,y),min(64,y+h)):
            for xx in range(max(0,x),min(64,x+w)):f[yy][xx]=c
    # Grey grid delineates 4px cells, with posts centered at 6+4k.
    for x in range(4,60,4):fill(x,4,1,52,4)
    for y in range(4,56,4):fill(4,y,56,1,4)
    # Three trail intensities, then the original black/grid background returns.
    # The entire internal path is used, not only the displayed samples.
    recent=trail[-56:]
    for i,a in enumerate(recent):
        age=len(recent)-1-i;c=TRAIL_COLORS[min(2,age*3//56)]
        x,y=rnd(a['x']),rnd(a['y'])
        if 2<=x<=61 and 2<=y<=55:put(x,y,c)
    # Solid, edge-to-edge tiles: no inset and no decorative gap in a wall.
    # Render and collision use the exact same occupancy predicate.
    for y in range(60):
        for x in range(64):
            if wall_at(l,x,y):put(x,y,2)
    # White exit is one complete tile instead of cutting partial wall cells.
    ex=l['exit'];at=ex['at'];side=ex['side']
    if side in ('E','W'):
        fill(60 if side=='E' else 0,at-2,4,4,0)
    else:
        fill(at-2,0 if side=='N' else 56,4,4,0)
    for i,c in enumerate(s['posts']):
        for x,y in post_pixels(c):put(x,y,POST_COLOR[c['quarters']])
        if pose is None and s['selected']==i:
            x,y=c['x'],c['y']
            for dx,dy in ((-3,-3),(3,-3),(-3,3),(3,3)):put(x+dx,y+dy,0)
        if conflict and i in conflict:
            x,y=c['x'],c['y'];fill(x-2,y-2,5,1,8);fill(x-2,y+2,5,1,8)
    for x,y,c in bike_pixels(p):put(x,y,c)
    for i in range(6):fill(2+i*6,61,5,2,14 if completed[i] else 4)
    if border is not None:
        fill(0,0,64,1,border);fill(0,58,64,1,border);fill(0,0,1,59,border);fill(63,0,1,59,border)
    return f


@dataclass(frozen=True)
class MotoOrbitInfo:
    game_id:str=GAME_ID
    title:str='Moto Orbit'
    family:str=FAMILY
    levels:int=6
    default_fps:float=FPS

class MotoOrbitEngine:
    def __init__(self,info=None,*,levels=None,levels_dir=None,animate=True):
        if levels is not None and levels_dir is not None:raise ValueError('Use levels OR levels_dir.')
        if levels_dir is not None:
            paths=sorted(Path(levels_dir).glob('L[0-9][0-9].json'))
            if not paths:raise FileNotFoundError('No Lxx.json level files.')
            levels=[json.loads(p.read_text(encoding='utf-8')) for p in paths]
        bank=DEFAULT_LEVELS if levels is None else levels
        if not isinstance(bank,list) or not 1<=len(bank)<=6:raise ValueError('One to six levels required.')
        self.info=info or MotoOrbitInfo(levels=len(bank));self.levels=[validate_level(l) for l in bank]
        self.animate=bool(animate);self.reset()
    def _setup(self,i):
        self.index=i;self.local=initial(self.levels[i]);self.state='NOT_FINISHED';self.terminal_run=None
    def observe(self):
        f=(render(self.levels[self.index],self.local,self.completed,self.terminal_run['poses'][-1],self.terminal_run['poses']) if self.terminal_run else render(self.levels[self.index],self.local,self.completed));ids=[1,2,3,4,5,6,7] if self.state=='NOT_FINISHED' else [7]
        return {'game_id':self.info.game_id,'title':self.info.title,'custom_family':FAMILY,'wave':WAVE,'revision':REVISION,
                'state':self.state,'level':self.index+1,'levels_completed':sum(self.completed),'win_levels':len(self.levels),
                'frame':f,'frames':[f],'frame_count':1,'frame_durations_ms':[0],'palette':PALETTE[:],
                'available_action_ids':ids,'available_actions':['ACTION'+str(i) for i in ids],
                'step_index':self.step_index,'total_actions':self.total_actions,'attempts':self.local['attempts'],
                'post_moves':self.local['moves'],'test_mode':self.test_mode,'last_event':self.last_event,'default_fps':FPS}
    public_state=observe
    def _packet(self,event,frames=None,durations=None,**extra):
        self.last_event=event;out=self.observe();out.update(event=event,**extra)
        if frames:out.update(frame=frames[-1],frames=frames,frame_count=len(frames),frame_durations_ms=durations)
        return out
    def reset(self):
        self.completed=[False]*6;self.test_mode=False;self.step_index=self.total_actions=0;self.last_event='reset';self._setup(0)
        return self._packet('reset')
    def level_reset(self):
        self.completed[self.index]=False;self._setup(self.index);return self._packet('reset_level')
    def jump_to_level(self,n):
        if not integer(n) or not 1<=n<=len(self.levels):raise ValueError('Invalid level.')
        self.reset();self.test_mode=True;self._setup(n-1);return self._packet('preview')
    def action(self,action_id:Any,data=None):
        if isinstance(action_id,dict):
            packet=action_id;data=packet.get('data',{});action_id=packet.get('id',packet.get('action_ref'))
        action_id=getattr(action_id,'value',action_id)
        if action_id=='RESET' or (integer(action_id) and action_id==0):return self.reset()
        if isinstance(action_id,str) and action_id in ('ACTION1','ACTION2','ACTION3','ACTION4','ACTION5','ACTION6','ACTION7'):action_id=int(action_id[-1])
        if not integer(action_id) or not 1<=action_id<=7:return self._packet('ignored')
        if action_id==7:return self.level_reset()
        if self.state!='NOT_FINISHED':return self._packet('finished')
        if action_id==6 and (not isinstance(data,dict) or not all(integer(data.get(k)) and 0<=data[k]<64 for k in ('x','y'))):return self._packet('ignored')
        l=self.levels[self.index];s=self.local;self.step_index+=1;self.total_actions+=1;s['actions']+=1
        if action_id==5:
            s['attempts']+=1;run=trajectory(l,s['posts']);frames=[];durations=[]
            if self.animate:
                samples=motion_samples(run['poses'])
                for j,i in enumerate(samples):
                    frames.append(render(l,s,self.completed,run['poses'][i],run['poses'][:i+1]))
                    following=samples[j+1] if j+1<len(samples) else i
                    durations.append((following-i)*TICK_MS)
                end=run['poses'][-1]
                color=14 if run['event']=='success' else 8
                for _ in range(3):
                    frames.append(render(l,s,self.completed,end,run['poses'],color,run['conflict_posts']));durations.append(250)
                    frames.append(render(l,s,self.completed,end,run['poses']));durations.append(180)
            played=self.index+1
            if run['event']=='success':
                self.completed[self.index]=True
                if self.test_mode:self.state='LEVEL_COMPLETE';self.terminal_run=run
                elif self.index==len(self.levels)-1:self.state='WIN';self.terminal_run=run
                else:self._setup(self.index+1)
            frames.append(self.observe()['frame']);durations.append(0)
            event='win' if self.state=='WIN' else run['event']
            return self._packet(event,frames,durations,played_level=played,run_ticks=run['ticks'],turn_count=len(run['turns']),
                                outcome=run['event'],auto_reset=run['event']!='success',
                                motion_frame_count=len(motion_samples(run['poses'])) if self.animate else 0,
                                animation_cell_px=CELL_PX)
        idx=s['selected']
        if action_id==6:
            hits=[i for i,p in enumerate(s['posts']) if abs(p['x']-data['x'])<=2 and abs(p['y']-data['y'])<=2]
            if hits:s['selected']=hits[0];return self._packet('selected')
            if idx<0:return self._packet('no_selection')
            x=6+4*((data['x']-6+2)//4);y=6+4*((data['y']-6+2)//4)
        else:
            if idx<0:return self._packet('no_selection')
            dx,dy=MOVE[action_id];x=s['posts'][idx]['x']+dx;y=s['posts'][idx]['y']+dy
        if not valid_placement(l,s['posts'],idx,x,y):return self._packet('blocked')
        if (x,y)==(s['posts'][idx]['x'],s['posts'][idx]['y']):return self._packet('unchanged')
        s['posts'][idx].update(x=x,y=y);s['moves']+=1;return self._packet('moved')
    step=action
    levelReset=level_reset
    jumpToLevel=jump_to_level

if __name__=='__main__':
    print(json.dumps(MotoOrbitEngine().observe()))
