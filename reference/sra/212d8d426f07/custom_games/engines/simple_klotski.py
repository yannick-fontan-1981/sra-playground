"""KLOT — Simple Klotski (custom_3), bar and rigid L, v2.3: yellow target outline, no entrance studs, per-level action budgets.

Native custom-backend adapter; standard library only, Python 3.10+.
1/2/3/4: one-cell translation; 5: next selection; 6: native pixel selection;
7: current-level reset; 0 or 'RESET': campaign reset.
Normal action attempts 1..6 count, including empty clicks and blocked moves.
Each level has a hard per-attempt action_limit (19, 19, 19, 19, 20, 20).
Win on the last available input is accepted; otherwise that input resets the level.
Frame / frames contain 64x64 palette indices, never a hidden solution.
"""
from __future__ import annotations

import json
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Any

WEB_REVISION = 'v2.3'
FRAME = SIZE = 64
CELL, OY, FPS, TARGET_ACTIONS = 8, 3, 24, 19
GAME_ID, FAMILY, WAVE = 'klot-c3000001', 'simple_klotski', 'custom_3'
PALETTE = ('#F3F2EB','#C9CDC8','#37404B','#536170','#1B2530','#10161D',
           '#A45D87','#E7B9A3','#F06B65','#679DEB','#63D5D6','#F1CE62',
           '#EBA258','#86513A','#77CB93','#BB94EB')
DIRS = ((0,-1),(0,1),(-1,0),(1,0))
# Data only. No oracle or solver is loaded by the engine.
DEFAULT_LEVELS = json.loads(r'''[{"version":2,"revision":"v2","id":"L01","number":1,"title":"Le passage décalé","note":"Les pièces sont plus imbriquées. Cherchez les espaces qui pourront servir au passage.","width":4,"height":5,"exit":{"side":"bottom","col":1,"width":2},"pieces":[{"id":"T","color":11,"cells":[[0,0],[1,0]],"x":1,"y":3},{"id":"A","color":9,"cells":[[0,0],[0,1]],"x":2,"y":0},{"id":"B","color":15,"cells":[[0,0],[0,1]],"x":3,"y":1},{"id":"C","color":12,"cells":[[0,0],[1,0]],"x":0,"y":4},{"id":"D","color":10,"cells":[[0,0],[1,0]],"x":1,"y":2},{"id":"E","color":6,"cells":[[0,0]],"x":0,"y":3},{"id":"F","color":1,"cells":[[0,0]],"x":1,"y":0}],"target":"T","action_limit":19},{"version":2,"revision":"v2","id":"L02","number":2,"title":"La fausse évidence","note":"La barre est proche de la sortie, mais la place libre ne suffit pas à ouvrir le bon chemin.","width":4,"height":5,"exit":{"side":"bottom","col":1,"width":2},"pieces":[{"id":"T","color":11,"cells":[[0,0],[1,0]],"x":0,"y":3},{"id":"A","color":9,"cells":[[0,0],[0,1]],"x":3,"y":0},{"id":"B","color":15,"cells":[[0,0],[0,1]],"x":2,"y":1},{"id":"C","color":12,"cells":[[0,0],[1,0]],"x":1,"y":4},{"id":"D","color":10,"cells":[[0,0],[1,0]],"x":0,"y":2},{"id":"E","color":6,"cells":[[0,0]],"x":3,"y":2},{"id":"F","color":1,"cells":[[0,0]],"x":3,"y":4}],"target":"T","action_limit":19},{"version":2,"revision":"v2","id":"L03","number":3,"title":"Le verrou intérieur","note":"Une ouverture utile peut en fermer une autre. Toutes les formes sont rigides.","width":4,"height":5,"exit":{"side":"bottom","col":1,"width":2},"pieces":[{"id":"T","color":11,"cells":[[0,0],[1,0]],"x":2,"y":3},{"id":"A","color":9,"cells":[[0,0],[0,1],[1,1]],"x":0,"y":0},{"id":"B","color":15,"cells":[[0,0],[0,1]],"x":2,"y":1},{"id":"C","color":12,"cells":[[0,0],[1,0]],"x":1,"y":4},{"id":"D","color":10,"cells":[[0,0],[1,0],[0,1],[1,1]],"x":0,"y":2},{"id":"E","color":6,"cells":[[0,0]],"x":1,"y":0}],"target":"T","action_limit":19},{"version":2,"revision":"v2","id":"L04","number":4,"title":"Le coude verrouillé","note":"Le L et les autres pièces partagent très peu de place. Gardez une continuation possible.","width":4,"height":5,"exit":{"side":"bottom","col":1,"width":2},"pieces":[{"id":"T","color":11,"cells":[[0,0],[0,1],[1,1]],"x":0,"y":2},{"id":"A","color":9,"cells":[[0,0],[1,0],[0,1],[1,1]],"x":2,"y":2},{"id":"B","color":15,"cells":[[0,0],[0,1]],"x":3,"y":0},{"id":"C","color":12,"cells":[[0,0],[1,0]],"x":0,"y":4},{"id":"D","color":10,"cells":[[0,0]],"x":1,"y":0},{"id":"E","color":6,"cells":[[0,0],[0,1]],"x":1,"y":1}],"target":"T","action_limit":19},{"version":2,"revision":"v2","id":"L05","number":5,"title":"Les places disputées","note":"La place libérée par une pièce peut être nécessaire à une autre.","width":4,"height":5,"exit":{"side":"bottom","col":1,"width":2},"pieces":[{"id":"T","color":11,"cells":[[0,0],[0,1],[1,1]],"x":0,"y":1},{"id":"A","color":9,"cells":[[0,0],[1,0],[0,1],[1,1]],"x":1,"y":0},{"id":"B","color":15,"cells":[[0,0],[0,1]],"x":2,"y":2},{"id":"C","color":12,"cells":[[0,0],[1,0]],"x":2,"y":4},{"id":"D","color":10,"cells":[[0,0]],"x":1,"y":3},{"id":"E","color":6,"cells":[[0,0],[0,1]],"x":3,"y":1}],"target":"T","action_limit":20},{"version":2,"revision":"v2","id":"L06","number":6,"title":"Le double détour","note":"Deux pièces en L, des passages étroits et un ordre de déplacement à construire.","width":4,"height":5,"exit":{"side":"bottom","col":1,"width":2},"pieces":[{"id":"T","color":11,"cells":[[0,0],[0,1],[1,1]],"x":0,"y":0},{"id":"A","color":9,"cells":[[0,0],[0,1]],"x":2,"y":0},{"id":"B","color":15,"cells":[[0,0],[0,1],[1,1]],"x":1,"y":2},{"id":"C","color":12,"cells":[[0,0],[1,0]],"x":1,"y":4},{"id":"D","color":10,"cells":[[0,0]],"x":3,"y":1},{"id":"E","color":6,"cells":[[0,0]],"x":2,"y":2}],"target":"T","action_limit":20}]''')
Raster = list[list[int]]


def _int(x: Any) -> bool:
    return type(x) is int


def action_limit(level: dict) -> int:
    """Per-level reserve; old level definitions retain their 19-action default."""
    return level.get('action_limit', TARGET_ACTIONS)


def geometry(level: dict) -> dict:
    return {'x': (64-level['width']*CELL)//2, 'y': OY, 'cell': CELL}


def cell_center(level: dict, x: int, y: int) -> dict:
    g = geometry(level)
    return {'x': g['x']+x*CELL+4, 'y': g['y']+y*CELL+4}


def target_index(level: dict) -> int:
    return next(i for i,p in enumerate(level['pieces']) if p['id']==level['target'])


def absolute_cells(piece: dict, pos: list) -> list[tuple[int,int]]:
    return [(x+pos[0],y+pos[1]) for x,y in piece['cells']]


def exit_height(level: dict) -> int:
    return 1+max(y for x,y in level['pieces'][target_index(level)]['cells'])


def permitted(level: dict, i: int, x: int, y: int) -> bool:
    if x<0 or x>=level['width'] or y<0:
        return False
    if y<level['height']:
        return True
    return (i==target_index(level) and level['exit']['col']<=x<level['exit']['col']+level['exit']['width']
            and y<level['height']+exit_height(level))


def validate_level(raw: dict) -> dict:
    l = deepcopy(raw)
    if not isinstance(l,dict) or not _int(l.get('width')) or not 3<=l['width']<=6 or not _int(l.get('height')) or not 3<=l['height']<=5:
        raise ValueError('Invalid board dimensions.')
    if not _int(action_limit(l)) or not 1<=action_limit(l)<=20:
        raise ValueError('action_limit must be an integer between 1 and 20.')
    ex=l.get('exit',{})
    if (ex.get('side')!='bottom' or not _int(ex.get('col')) or not _int(ex.get('width'))
            or ex['width']<1 or ex['col']<0 or ex['col']+ex['width']>l['width']):
        raise ValueError('Invalid bottom exit.')
    if not isinstance(l.get('pieces'),list) or not 2<=len(l['pieces'])<=8:
        raise ValueError('Two to eight pieces required.')
    ids,used=set(),set()
    for p in l['pieces']:
        if not isinstance(p,dict) or not isinstance(p.get('id'),str) or not p['id'] or p['id'] in ids:
            raise ValueError('Piece ids must be unique.')
        ids.add(p['id'])
        if not _int(p.get('color')) or not 0<=p['color']<16 or not _int(p.get('x')) or not _int(p.get('y')):
            raise ValueError('Invalid piece properties.')
        if not isinstance(p.get('cells'),list) or not 1<=len(p['cells'])<=6:
            raise ValueError('Invalid rigid shape.')
        own=set()
        for v in p['cells']:
            if not isinstance(v,list) or len(v)!=2 or not all(_int(c) and c>=0 for c in v):
                raise ValueError('Invalid shape coordinates.')
            t=tuple(v)
            if t in own:
                raise ValueError('Duplicate shape cell.')
            own.add(t)
            x,y=v[0]+p['x'],v[1]+p['y']
            if not 0<=x<l['width'] or not 0<=y<l['height'] or (x,y) in used:
                raise ValueError('Initial pieces overlap or leave the board.')
            used.add((x,y))
        if min(x for x,y in own)!=0 or min(y for x,y in own)!=0:
            raise ValueError('Shapes must use a normalized origin.')
        reached={tuple(p['cells'][0])};todo=list(reached)
        while todo:
            x,y=todo.pop()
            for dx,dy in DIRS:
                t=(x+dx,y+dy)
                if t in own and t not in reached:
                    reached.add(t);todo.append(t)
        if reached!=own:
            raise ValueError('Shapes must be side-connected.')
    if l.get('target') not in ids:
        raise ValueError('Missing target identity.')
    target=l['pieces'][target_index(l)]
    if max(x for x,y in target['cells'])+1!=ex['width'] or exit_height(l)>2:
        raise ValueError('The exit bay must fit the target.')
    if OY+(l['height']+exit_height(l))*CELL>59:
        raise ValueError('The exit must not overlap the native progress bars.')
    return l


def create_state(level: dict) -> dict:
    return {'positions':[[p['x'],p['y']] for p in level['pieces']], 'selected':-1,
            'actions':0,'selections':0,'moves':0,'won':False,'lastEvent':'READY'}


def legal_move(level: dict, state: dict, i: int, dx: int, dy: int) -> bool:
    if not _int(i) or not 0<=i<len(level['pieces']) or abs(dx)+abs(dy)!=1:
        return False
    p=state['positions'][i]
    cells=absolute_cells(level['pieces'][i],[p[0]+dx,p[1]+dy])
    if not all(permitted(level,i,x,y) for x,y in cells):
        return False
    occupied={t for j,p in enumerate(level['pieces']) if j!=i for t in absolute_cells(p,state['positions'][j])}
    return not any(t in occupied for t in cells)


def hit_piece(level: dict, state: dict, x: int, y: int) -> int:
    g=geometry(level);t=((x-g['x'])//CELL,(y-g['y'])//CELL)
    return next((i for i,p in enumerate(level['pieces']) if t in absolute_cells(p,state['positions'][i])),-1)


def is_win(level: dict, state: dict) -> bool:
    return state['positions'][target_index(level)]==[level['exit']['col'],level['height']]


def transition(level: dict, state: dict, action_id: int, data: dict | None = None) -> dict:
    if state['won']:
        return {'state':state,'event':'finished','motion':None}
    if state['actions']>=action_limit(level):return {'state':state,'event':'ignored','motion':None}
    if not _int(action_id) or not 1<=action_id<=6:
        return {'state':state,'event':'ignored','motion':None}
    data=data if isinstance(data,dict) else {}
    if action_id==6 and not all(_int(data.get(k)) and 0<=data[k]<64 for k in ('x','y')):
        return {'state':state,'event':'ignored','motion':None}
    s=deepcopy(state);s['actions']+=1
    event,motion='empty',None
    if action_id in (5,6):
        i=(s['selected']+1)%len(level['pieces']) if action_id==5 else hit_piece(level,s,data['x'],data['y'])
        if i>=0:
            s['selections']+=1
            event='reselected' if i==s['selected'] else 'selected';s['selected']=i
    elif s['selected']<0:
        event='no_selection'
    else:
        dx,dy=DIRS[action_id-1];i=s['selected']
        if legal_move(level,s,i,dx,dy):
            origin=s['positions'][i][:]
            s['positions'][i][0]+=dx;s['positions'][i][1]+=dy;s['moves']+=1
            motion={'index':i,'from':origin,'to':s['positions'][i][:],'dx':dx,'dy':dy}
            event='moved'
            if is_win(level,s):
                s['won']=True;event='success'
        else:
            event='blocked'
    # Success on the final available input has priority over exhaustion.
    if not s['won'] and s['actions']>=action_limit(level):event='exhausted'
    s['lastEvent']=event
    return {'state':s,'event':event,'motion':motion}


def render(level: dict, state: dict, completed: list | None = None, options: dict | None = None) -> Raster:
    completed=completed if completed is not None else [False]*6
    options=options or {};f=[[5]*64 for _ in range(64)];g=geometry(level)
    def fill(x,y,w,h,c):
        for yy in range(max(0,y),min(64,y+h)):
            for xx in range(max(0,x),min(64,x+w)):
                f[yy][xx]=c
    def box(x,y,w,h,c):
        fill(x,y,w,1,c);fill(x,y+h-1,w,1,c);fill(x,y,1,h,c);fill(x+w-1,y,1,h,c)
    for i in range(action_limit(level)):
        fill(3+i*3,0,2,1,2 if i<state['actions'] else 11)
    bw,bh=level['width']*CELL,level['height']*CELL
    fill(g['x']-2,g['y']-2,bw+4,bh+4,2);box(g['x']-2,g['y']-2,bw+4,bh+4,3);fill(g['x'],g['y'],bw,bh,4)
    for r in range(level['height']):
        for c in range(level['width']):
            fill(g['x']+c*CELL,g['y']+r*CELL,1,1,2)
    ex,ey=g['x']+level['exit']['col']*CELL,g['y']+bh
    ew,eh=level['exit']['width']*CELL,exit_height(level)*CELL
    fill(ex-2,ey,ew+4,eh+1,2);fill(ex,ey,ew,eh,4)
    tp=level['pieces'][target_index(level)];gs={tuple(v) for v in tp['cells']}
    def shape_outline(shape,cx,cy,x,y,color):
        if (cx,cy-1) not in shape:fill(x,y,CELL,1,color)
        if (cx,cy+1) not in shape:fill(x,y+CELL-1,CELL,1,color)
        if (cx-1,cy) not in shape:fill(x,y,1,CELL,color)
        if (cx+1,cy) not in shape:fill(x+CELL-1,y,1,CELL,color)
    for dx,dy in tp['cells']:
        shape_outline(gs,dx,dy,ex+dx*CELL,ey+dy*CELL,11)
    for i,p in enumerate(level['pieces']):
        px,py=state['positions'][i];visual=options.get('visual',{})
        vx,vy=(visual['dx'],visual['dy']) if visual.get('index')==i else (0,0)
        shape={tuple(v) for v in p['cells']}
        for cx,cy in p['cells']:
            fill(g['x']+(px+cx)*CELL+vx,g['y']+(py+cy)*CELL+vy,CELL,CELL,p['color'])
        for cx,cy in p['cells']:
            shape_outline(shape,cx,cy,g['x']+(px+cx)*CELL+vx,g['y']+(py+cy)*CELL+vy,0 if state['selected']==i else 5)
        if i==target_index(level):
            cx,cy=p['cells'][-1];x=g['x']+(px+cx)*CELL+vx+3;y=g['y']+(py+cy)*CELL+vy+1
            fill(x,y,1,2,13);fill(x-2,y+2,5,1,13);fill(x-1,y+3,3,1,13);fill(x,y+4,1,1,13)
    for i in range(6):
        fill(2+i*6,61,5,2,14 if completed[i] else 2)
    if 'border' in options:
        box(0,1,64,59,options['border'])
    return f


@dataclass(frozen=True)
class KlotskiInfo:
    game_id: str = GAME_ID
    title: str = 'Simple Klotski'
    family: str = FAMILY
    levels: int = 6
    default_fps: float = FPS


class KlotskiEngine:
    """Compatible with the custom reset/action/public_state convention.

    `jump_to_level` is for manual testing only; it does not award skipped levels.
    The constructor accepts a project CustomGameInfo without importing its module.
    """
    def __init__(self, info: Any = None, *, levels: list | None = None,
                 levels_dir: str | Path | None = None, animate: bool = True) -> None:
        if levels is not None and levels_dir is not None:
            raise ValueError('Use levels OR levels_dir.')
        if levels_dir is not None:
            paths=sorted(Path(levels_dir).glob('L[0-9][0-9].json'))
            if not paths:raise FileNotFoundError('No Lxx.json levels found.')
            levels=[json.loads(p.read_text(encoding='utf-8-sig')) for p in paths]
        bank=DEFAULT_LEVELS if levels is None else levels
        if not isinstance(bank,list) or not 1<=len(bank)<=6:
            raise ValueError('One to six levels required.')
        self.info=info or KlotskiInfo(levels=len(bank))
        count=getattr(self.info,'levels',len(bank))
        if not _int(count) or not 1<=count<=len(bank):raise ValueError('Invalid info.levels.')
        self.levels=[validate_level(l) for l in bank[:count]]
        self.animate=bool(animate);self.reset()

    def _setup(self,i: int) -> None:
        self.index=i;self.local=create_state(self.levels[i]);self.state='NOT_FINISHED'

    def observe(self) -> dict:
        l=self.levels[self.index];s=self.local;frame=render(l,s,self.completed)
        return {'backend':'custom','selected':True,'game_id':self.info.game_id,'title':self.info.title,
                'custom_family':self.info.family,'wave':WAVE,'revision':WEB_REVISION,'frame':frame,'frames':[frame],
                'frame_count':1,'frame_durations_ms':[0],'state':self.state,'level':self.index+1,
                'levels_completed':sum(self.completed),'win_levels':len(self.levels),'step_index':self.step_index,
                'score':sum(self.completed),'available_action_ids':list(range(1,8)) if self.state=='NOT_FINISHED' else [7],
                'last_action':self.last_action,'last_event':self.last_event,'level_actions':s['actions'],
                'level_moves':s['moves'],'level_selections':s['selections'],'total_actions':self.total_actions,
                'selected_piece':None if s['selected']<0 else l['pieces'][s['selected']]['id'],
                'action_target':action_limit(l),'action_limit':action_limit(l),
                'actions_remaining':max(0,action_limit(l)-s['actions']),'max_steps':action_limit(l),
                'restarts':self.restarts,'test_mode':self.test_mode,
                'palette':list(PALETTE),'default_fps':FPS}

    public_state=observe

    def _packet(self,event: str,frames: list | None = None,durations: list | None = None,**extra) -> dict:
        self.last_event=event;out=self.observe();out['event']=event
        if frames:
            out.update(frame=frames[-1],frames=frames,frame_count=len(frames),frame_durations_ms=durations)
        out.update(extra);return out

    def reset(self) -> dict:
        self.completed=[False]*6;self.test_mode=False;self.step_index=self.total_actions=self.restarts=0
        self.last_action='RESET';self._setup(0);return self._packet('reset')

    def level_reset(self) -> dict:
        self.completed[self.index]=False;self.restarts+=1;self.last_action='ACTION7'
        self._setup(self.index);return self._packet('restart')

    def jump_to_level(self,number: int) -> dict:
        if not _int(number) or not 1<=number<=len(self.levels):raise ValueError('Invalid level number.')
        self.completed=[False]*6;self.test_mode=True;self.step_index=self.total_actions=self.restarts=0
        self.last_action='LOAD_LEVEL';self._setup(number-1);return self._packet('preview')

    def action(self,action_id: Any,data: dict | None = None) -> dict:
        if isinstance(action_id,dict):
            packet=action_id;data=packet.get('data') or {}
            action_id=packet.get('id',packet.get('action',packet.get('action_ref')))
        action_id=getattr(action_id,'value',action_id)
        if (_int(action_id) and action_id==0) or action_id=='RESET':return self.reset()
        if isinstance(action_id,str) and len(action_id)==7 and action_id.startswith('ACTION') and action_id[-1] in '1234567':
            action_id=int(action_id[-1])
        if _int(action_id) and action_id==7:return self.level_reset()
        if self.state!='NOT_FINISHED':return self._packet('finished')
        level=self.levels[self.index];r=transition(level,self.local,action_id,data)
        if r['event']=='ignored':return self._packet('ignored')
        self.local=r['state'];self.last_action='ACTION'+str(action_id);self.step_index+=1;self.total_actions+=1
        frames,durations=[],[];played=self.index+1
        if self.animate and r['motion']:
            m=r['motion']
            for delta in (2,4,6,8):
                frames.append(render(level,self.local,self.completed,{'visual':{'index':m['index'],'dx':-m['dx']*(CELL-delta),'dy':-m['dy']*(CELL-delta)}}));durations.append(30)
        if r['event']=='success':
            finish={'played_level':played,'completed_actions':self.local['actions'],
                    'completed_selections':self.local['selections'],'completed_moves':self.local['moves'],
                    'under_twenty':self.local['actions']<=19,
                    'completed_action_limit':action_limit(level),
                    'completed_actions_remaining':action_limit(level)-self.local['actions']}
            self.completed[self.index]=True
            if self.animate:
                frames.extend([render(level,self.local,self.completed,{'border':14}),render(level,self.local,self.completed)]);durations.extend([210,130])
            if self.index==len(self.levels)-1 and not self.test_mode:self.state='WIN'
            elif self.test_mode:self.state='LEVEL_COMPLETE'
            else:self._setup(self.index+1)
            frames.append(render(self.levels[self.index],self.local,self.completed));durations.append(0)
            return self._packet('win' if self.state=='WIN' else 'success',frames,durations,**finish)
        if r['event']=='exhausted':
            failure={'played_level':played,'reason':'action_budget','auto_reset':True,
                     'failed_actions':self.local['actions'],'failed_selections':self.local['selections'],
                     'failed_moves':self.local['moves'],'actions_remaining_before_reset':0,
                     'failed_action_limit':action_limit(level)}
            if self.animate:
                frames.extend([render(level,self.local,self.completed,{'border':8}),render(level,self.local,self.completed)])
                durations.extend([220,80])
            # No synthetic ACTION7 or extra debit; keep prior wins and attempted-input totals.
            self.restarts+=1;self._setup(self.index)
            frames.append(render(level,self.local,self.completed));durations.append(0)
            return self._packet('exhausted',frames,durations,**failure)
        if self.animate and r['event'] in ('blocked','no_selection'):
            frames.append(render(level,self.local,self.completed,{'border':8 if r['event']=='blocked' else 1}));durations.append(100)
        frames.append(render(level,self.local,self.completed));durations.append(0)
        return self._packet(r['event'],frames,durations,played_level=played)

    step=action
    levelReset=level_reset
    jumpToLevel=jump_to_level

    def snapshot(self) -> dict:
        """Developer inspection only. Not part of the normal public observation."""
        return deepcopy(self.local)


SimpleKlotskiEngine=KlotskiEngine

if __name__=='__main__':
    print(json.dumps(KlotskiEngine().observe(),ensure_ascii=False))


class HostedKlotskiEngine(KlotskiEngine):
    """Thin host adapter; the supplied game implementation above is unchanged."""

    def __init__(self, info: Any, *, levels_dir: str | Path | None = None) -> None:
        self.levels_dir = (
            Path(levels_dir).resolve() if levels_dir is not None
            else Path(__file__).resolve().parents[1] / 'games' / 'simple_klotski' / 'levels'
        )
        super().__init__(info, levels_dir=self.levels_dir)

    def observe(self) -> dict:
        state = super().observe()
        state.update(
            available_actions=[f'ACTION{aid}' for aid in state['available_action_ids']],
            source_path=str(self.levels_dir),
            level_name=self.levels[self.index]['title'],
            full_reset=False,
        )
        return state

    public_state = observe
