"""AMZE / Arrow Maze, custom_3. Original compact adaptation, v1.1: legal destination arrows are cyan.

Standard library only; custom reset/action/public_state boundary.
ACTION6 clicks a landing cell in the current arrow's ray, at any positive distance.
ACTION7 resets this level; RESET/0 resets the campaign. Only accepted raster clicks
consume actions, including wrong-direction / same-cell / margin clicks. Budget
exhaustion resets this attempt. Winning on the last input has priority.
Legal destination arrows are cyan. No solution, model discovery, random generator
or solver runs in this module.
"""
from __future__ import annotations
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Any
import json

FRAME = SIZE = 64
FPS = 24
GAME_ID, FAMILY, WAVE, WEB_REVISION = 'amze-c3000001', 'arrow_maze', 'custom_3', 'v1.1'
PALETTE = ('#F3F2EB','#C9CDC8','#37404B','#536170','#1B2530','#10161D',
           '#A45D87','#E7B9A3','#F06B65','#679DEB','#63D5D6','#F1CE62',
           '#EBA258','#86513A','#77CB93','#BB94EB')
DIRS = {'U': (0,-1), 'D': (0,1), 'L': (-1,0), 'R': (1,0)}
GLYPHS = {'U': ['00100','01110','10101','00100','00100'],
          'D': ['00100','00100','10101','01110','00100'],
          'L': ['00100','01000','11111','01000','00100'],
          'R': ['00100','00010','11111','00010','00100']}
DEFAULT_LEVELS = json.loads('[{"version": 1, "id": "L01", "number": 1, "title": "Premiers détours", "size": 3, "rows": ["DDL", "RDD", "URG"], "start": [0, 0], "goal": [2, 2], "action_limit": 9}, {"version": 1, "id": "L02", "number": 2, "title": "Choisir la distance", "size": 4, "rows": ["RRDL", "DLDD", "UULD", "RLLG"], "start": [0, 0], "goal": [3, 3], "action_limit": 9}, {"version": 1, "id": "L03", "number": 3, "title": "Le bon embranchement", "size": 4, "rows": ["DDDG", "RDLL", "DLRU", "URRU"], "start": [0, 3], "goal": [3, 0], "action_limit": 9}, {"version": 1, "id": "L04", "number": 4, "title": "Revenir pour avancer", "size": 5, "rows": ["RRLRD", "UDLLU", "RLDLL", "UULRL", "GRULU"], "start": [4, 0], "goal": [0, 4], "action_limit": 9}, {"version": 1, "id": "L05", "number": 5, "title": "Les fausses proximités", "size": 5, "rows": ["RLLDL", "DUULD", "UDRLL", "RLLUU", "UUUUG"], "start": [0, 0], "goal": [4, 4], "action_limit": 9}, {"version": 1, "id": "L06", "number": 6, "title": "La traversée indirecte", "size": 6, "rows": ["DDDRLG", "UDUDUD", "DRLDDD", "RRUDRL", "UUDDUL", "UULRLL"], "start": [0, 5], "goal": [5, 0], "action_limit": 10}]')
Raster = list[list[int]]

def _int(v: Any) -> bool:
    # Native input contract excludes bool, floats, NaN and unsafe JSON integers.
    return type(v) is int and abs(v) <= 9007199254740991

def validate_level(raw: dict) -> dict:
    l = deepcopy(raw)
    if not isinstance(l,dict) or not _int(l.get('size')) or not 3 <= l['size'] <= 6:
        raise ValueError('Use a 3x3 to 6x6 grid.')
    n=l['size'];rows=l.get('rows')
    if not isinstance(rows,list) or len(rows)!=n or any(not isinstance(r,str) or len(r)!=n or set(r)-set('UDLRG') for r in rows):
        raise ValueError('Invalid arrow grid.')
    for k in ('start','goal'):
        if not isinstance(l.get(k),list) or len(l[k])!=2 or not all(_int(v) and 0<=v<n for v in l[k]):
            raise ValueError('Invalid '+k+'.')
    if l['start']==l['goal'] or ''.join(rows).count('G')!=1 or rows[l['goal'][1]][l['goal'][0]]!='G':
        raise ValueError('Start must differ from the unique goal.')
    if not _int(l.get('action_limit')) or not 1<=l['action_limit']<=20:
        raise ValueError('Action limit must be 1..20.')
    if not isinstance(l.get('id'),str) or not isinstance(l.get('title'),str):
        raise ValueError('Missing level id/title.')
    return l

def geometry(l: dict) -> dict:
    pitch=12 if l['size']<=4 else 10 if l['size']==5 else 8
    w=l['size']*pitch-1
    return {'x':(64-w)//2,'y':7+(50-w)//2,'pitch':pitch,'cell':pitch-1,'width':w}

def cell_center(l: dict,x: int,y: int) -> dict:
    g=geometry(l)
    return {'x':g['x']+x*g['pitch']+g['cell']//2,'y':g['y']+y*g['pitch']+g['cell']//2}

def pixel_cell(l: dict,x: int,y: int) -> list | None:
    g=geometry(l);px,py=x-g['x'],y-g['y']
    if px<0 or py<0 or px>=g['width'] or py>=g['width'] or px%g['pitch']>=g['cell'] or py%g['pitch']>=g['cell']:
        return None
    return [px//g['pitch'],py//g['pitch']]

def legal_destination(l: dict,origin: list,target: list | None) -> bool:
    if not isinstance(target,list) or len(target)!=2 or not all(_int(v) and 0<=v<l['size'] for v in target) or origin==target:
        return False
    d=DIRS.get(l['rows'][origin[1]][origin[0]])
    if d is None:return False
    dx,dy=target[0]-origin[0],target[1]-origin[1]
    return dx==0 and dy*d[1]>0 if d[0]==0 else dy==0 and dx*d[0]>0

def create_state(l: dict) -> dict:
    return {'position':l['start'][:],'actions':0,'moves':0,'cells':0,'won':False,'lastEvent':'ready'}

def transition(l: dict,state: dict,action_id: Any,data: dict | None=None) -> dict:
    if state['won']:return {'state':state,'event':'finished','motion':None}
    if (not _int(action_id) or action_id!=6 or not isinstance(data,dict)
            or not all(_int(data.get(k)) and 0<=data[k]<64 for k in ('x','y'))
            or state['actions']>=l['action_limit']):
        return {'state':state,'event':'ignored','motion':None}
    s=deepcopy(state);s['actions']+=1;to=pixel_cell(l,data['x'],data['y'])
    event,motion='outside',None
    if to==s['position']:event='same_cell'
    elif to is not None and legal_destination(l,s['position'],to):
        origin=s['position'][:];distance=abs(to[0]-origin[0])+abs(to[1]-origin[1])
        s['position']=to;s['moves']+=1;s['cells']+=distance
        motion={'from':origin,'to':to[:],'distance':distance};event='moved'
        if to==l['goal']:s['won']=True;event='success'
    elif to is not None:event='wrong_direction'
    if not s['won'] and s['actions']>=l['action_limit']:event='exhausted'
    s['lastEvent']=event
    return {'state':s,'event':event,'motion':motion}

def render(l: dict,s: dict,completed: list | None=None,options: dict | None=None) -> Raster:
    completed=[False]*6 if completed is None else completed;options=options or {}
    f=[[5]*64 for _ in range(64)];g=geometry(l);position=options.get('display_current',s['position'])
    # All legal next landings; no path search or pointer-dependent hint.
    show_destinations=not s['won'] and s['actions']<l['action_limit'] and not options.get('token')
    def fill(x,y,w,h,c):
        for yy in range(max(0,y),min(64,y+h)):
            for xx in range(max(0,x),min(64,x+w)):f[yy][xx]=c
    def box(x,y,w,h,c):
        fill(x,y,w,1,c);fill(x,y+h-1,w,1,c);fill(x,y,1,h,c);fill(x+w-1,y,1,h,c)
    for k in range(l['action_limit']):fill(3+k*3,2,2,2,2 if k<s['actions'] else 11)
    box(g['x']-1,g['y']-1,g['width']+2,g['width']+2,2)
    for y in range(l['size']):
        for x in range(l['size']):
            px,py=g['x']+x*g['pitch'],g['y']+y*g['pitch'];active=[x,y]==position
            fill(px,py,g['cell'],g['cell'],9 if active else 4)
            if l['rows'][y][x]=='G':
                box(px,py,g['cell'],g['cell'],11)
                cx,cy=px+g['cell']//2,py+g['cell']//2;box(cx-1,cy-1,3,3,11)
                if active:box(px-1,py-1,g['cell']+2,g['cell']+2,0)
            else:
                mask=GLYPHS[l['rows'][y][x]];xx,yy=px+(g['cell']-5)//2,py+(g['cell']-5)//2
                arrow_color=0 if active else (10 if show_destinations and legal_destination(l,position,[x,y]) else 1)
                for r in range(5):
                    for c in range(5):
                        if mask[r][c]=='1':fill(xx+c,yy+r,1,1,arrow_color)
                if active:box(px-1,py-1,g['cell']+2,g['cell']+2,0)
    if 'token' in options:
        x,y=options['token'];fill(x-1,y-1,3,3,10);fill(x,y,1,1,0)
    for i in range(6):fill(2+i*6,61,5,2,14 if completed[i] else 2)
    if 'border' in options:box(0,6,64,54,options['border'])
    return f

@dataclass(frozen=True)
class ArrowMazeInfo:
    game_id: str = GAME_ID
    title: str = 'Arrow Maze'
    family: str = FAMILY
    levels: int = 6
    default_fps: float = FPS

class ArrowMazeEngine:
    """Custom-backend adapter; this is not a registration in an official ARC SDK."""
    def __init__(self,info: Any=None,*,levels: list | None=None,levels_dir: str | Path | None=None,animate: bool=True) -> None:
        if levels is not None and levels_dir is not None:raise ValueError('Use levels OR levels_dir.')
        if levels_dir is not None:
            paths=sorted(Path(levels_dir).glob('L[0-9][0-9].json'))
            if not paths:raise FileNotFoundError('No Lxx.json levels found.')
            levels=[json.loads(p.read_text(encoding='utf-8-sig')) for p in paths]
        bank=DEFAULT_LEVELS if levels is None else levels
        if not isinstance(bank,list) or not 1<=len(bank)<=6:raise ValueError('One to six levels required.')
        self.info=info or ArrowMazeInfo(levels=len(bank));count=getattr(self.info,'levels',len(bank))
        if not _int(count) or not 1<=count<=len(bank):raise ValueError('Invalid info.levels.')
        self.levels=[validate_level(l) for l in bank[:count]];self.animate=bool(animate);self.reset()
    def _setup(self,i: int) -> None:
        self.index=i;self.local=create_state(self.levels[i]);self.state='NOT_FINISHED'
    def observe(self) -> dict:
        l=self.levels[self.index];s=self.local;f=render(l,s,self.completed);ids=[6,7] if self.state=='NOT_FINISHED' else [7]
        return {'backend':'custom','selected':True,'game_id':self.info.game_id,'title':self.info.title,
            'custom_family':self.info.family,'wave':WAVE,'revision':WEB_REVISION,'frame':f,'frames':[f],
            'frame_count':1,'frame_durations_ms':[0],'state':self.state,'level':self.index+1,'levels_completed':sum(self.completed),
            'win_levels':len(self.levels),'score':sum(self.completed),'available_action_ids':ids,'available_actions':['ACTION'+str(i) for i in ids],
            'step_index':self.step_index,'total_actions':self.total_actions,'last_action':self.last_action,'last_event':self.last_event,
            'level_actions':s['actions'],'level_moves':s['moves'],'level_cells':s['cells'],'action_limit':l['action_limit'],
            'max_steps':l['action_limit'],'actions_remaining':max(0,l['action_limit']-s['actions']),'restarts':self.restarts,'test_mode':self.test_mode,
            'palette':list(PALETTE),'default_fps':FPS,'full_reset':False}
    public_state=observe
    def _packet(self,event: str,frames: list | None=None,durations: list | None=None,**extra) -> dict:
        self.last_event=event;out=self.observe();out['event']=event
        if frames:out.update(frame=frames[-1],frames=frames,frame_count=len(frames),frame_durations_ms=durations)
        out.update(extra);return out
    def reset(self) -> dict:
        self.completed=[False]*6;self.test_mode=False;self.step_index=self.total_actions=self.restarts=0
        self.last_action='RESET';self._setup(0);return self._packet('reset')
    def level_reset(self) -> dict:
        self.completed[self.index]=False;self.restarts+=1;self.last_action='ACTION7';self._setup(self.index)
        return self._packet('restart')
    def jump_to_level(self,n: int) -> dict:
        if not _int(n) or not 1<=n<=len(self.levels):raise ValueError('Invalid level number.')
        self.completed=[False]*6;self.test_mode=True;self.step_index=self.total_actions=self.restarts=0
        self.last_action='LOAD_LEVEL';self._setup(n-1);return self._packet('preview')
    def action(self,action_id: Any,data: dict | None=None) -> dict:
        if isinstance(action_id,dict):
            packet=action_id;data=packet.get('data') or {};action_id=packet.get('id',packet.get('action',packet.get('action_ref')))
        action_id=getattr(action_id,'value',action_id)
        if (_int(action_id) and action_id==0) or action_id=='RESET':return self.reset()
        if isinstance(action_id,str) and len(action_id)==7 and action_id[:6]=='ACTION' and action_id[6] in '1234567':action_id=int(action_id[-1])
        if _int(action_id) and action_id==7:return self.level_reset()
        if self.state!='NOT_FINISHED':return self._packet('finished')
        l=self.levels[self.index];r=transition(l,self.local,action_id,data)
        if r['event']=='ignored':return self._packet('ignored')
        self.local=r['state'];s=self.local;self.step_index+=1;self.total_actions+=1;self.last_action='ACTION'+str(action_id)
        frames,durations=[],[];played=self.index+1
        if self.animate and r['motion']:
            m=r['motion'];a=cell_center(l,*m['from']);b=cell_center(l,*m['to'])
            for k in range(1,4):
                frames.append(render(l,s,self.completed,{'display_current':m['from'],'token':[a['x']+(b['x']-a['x'])*k//4,a['y']+(b['y']-a['y'])*k//4]}));durations.append(45)
            frames.append(render(l,s,self.completed));durations.append(55)
        if r['event']=='success':
            finish={'played_level':played,'completed_actions':s['actions'],'completed_moves':s['moves'],'completed_cells':s['cells'],
                    'completed_action_limit':l['action_limit'],'completed_actions_remaining':l['action_limit']-s['actions']}
            self.completed[self.index]=True
            if self.animate:
                frames.extend([render(l,s,self.completed,{'border':14}),render(l,s,self.completed)]);durations.extend([200,120])
            if self.test_mode:self.state='LEVEL_COMPLETE'
            elif self.index==len(self.levels)-1:self.state='WIN'
            else:self._setup(self.index+1)
            frames.append(render(self.levels[self.index],self.local,self.completed));durations.append(0)
            return self._packet('win' if self.state=='WIN' else 'success',frames,durations,**finish)
        if r['event']=='exhausted':
            failure={'played_level':played,'reason':'action_budget','auto_reset':True,'failed_actions':s['actions'],'failed_moves':s['moves'],
                     'failed_cells':s['cells'],'failed_action_limit':l['action_limit'],'actions_remaining_before_reset':0}
            if self.animate:
                frames.extend([render(l,s,self.completed,{'border':8}),render(l,s,self.completed)]);durations.extend([220,80])
            self.restarts+=1;self._setup(self.index)
            frames.append(render(self.levels[self.index],self.local,self.completed));durations.append(0)
            return self._packet('exhausted',frames,durations,**failure)
        if self.animate and r['event'] in ('wrong_direction','outside','same_cell'):
            frames.append(render(l,s,self.completed,{'border':8}));durations.append(110)
        frames.append(render(l,s,self.completed));durations.append(0)
        return self._packet(r['event'],frames,durations,played_level=played)
    step=action
    levelReset=level_reset
    jumpToLevel=jump_to_level
    def snapshot(self) -> dict:
        """Developer inspection, excluded from the normal observation."""
        return deepcopy(self.local)

if __name__=='__main__':
    print(json.dumps(ArrowMazeEngine().observe(),ensure_ascii=False))
