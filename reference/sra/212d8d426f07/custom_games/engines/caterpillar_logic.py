"""CATL — Caterpillar Logic v2.3.3, custom_3.

Twenty fixed examples: ten violet, ten orange. Eight unseen classifications.
No construction, trial bench, query button, or exploratory phase.
ACTION6: choose a colored native button. ACTION7: reset this level.
RESET/0: reset campaign. No action reserve or time limit. Blank clicks are inert.
All valid raster interactions are still counted in step_index/total_actions.
The rule evaluator only grades the current answer; no solver runs during play.
Pure Python 3.10+ standard library, 64x64 palette-index frames.
"""
from __future__ import annotations
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Any
import json

SIZE = FRAME = 64
FPS = 24
GAME_ID, FAMILY, WAVE, WEB_REVISION = 'catl-c3000001', 'caterpillar_logic', 'custom_3', 'v2.3.3'
PALETTE = ('#F3F2EB','#C9CDC8','#37404B','#536170','#1B2530','#10161D',
           '#A45D87','#E7B9A3','#F06B65','#679DEB','#63D5D6','#F1CE62',
           '#EBA258','#86513A','#77CB93','#BB94EB')
COLORS = [8, 9, 11]
SETS = {'violet': 15, 'orange': 12}
BUTTONS = {'violet': [39, 49, 10, 8], 'orange': [52, 49, 10, 8]}
# Native-pixel geometry, shared with the JavaScript renderer.
LAYOUT = {'panels': [[2, 2, 28, 45], [34, 2, 28, 45]], 'example_y': 6, 'example_pitch': 4, 'proposal': [2, 49, 34, 8], 'answer_lights': [39, 60, 2, 2, 3], 'level_lights': [2, 60, 5, 2, 6]}
Raster = list[list[int]]

DEFAULT_LEVELS = json.loads('[{"version":2,"revision":"v2.3.3","id":"L01","number":1,"title":"Collection 01","colors":[8,9,11],"max_length":5,"quiz_count":8,"rule":{"op":"contains","color":8},"examples":[{"word":[8],"set":"violet"},{"word":[8,8],"set":"violet"},{"word":[9,8],"set":"violet"},{"word":[9,11,8],"set":"violet"},{"word":[11,8,11],"set":"violet"},{"word":[8,9,11,9],"set":"violet"},{"word":[11,8,8,11],"set":"violet"},{"word":[8,8,8,8,9],"set":"violet"},{"word":[9,8,9,8,11],"set":"violet"},{"word":[9,11,8,9,11],"set":"violet"},{"word":[9],"set":"orange"},{"word":[11],"set":"orange"},{"word":[9,9],"set":"orange"},{"word":[9,11],"set":"orange"},{"word":[11,11,11],"set":"orange"},{"word":[9,9,9,9],"set":"orange"},{"word":[11,11,11,11],"set":"orange"},{"word":[9,9,9,9,9],"set":"orange"},{"word":[9,9,11,9,11],"set":"orange"},{"word":[11,11,11,11,11],"set":"orange"}],"questions":[[8,9,9,9],[9,11,9,9,11],[9,11,9],[9,8,9,9],[8,9],[8,11],[11,9],[11,11]]},{"version":2,"revision":"v2.3.3","id":"L02","number":2,"title":"Collection 02","colors":[8,9,11],"max_length":5,"quiz_count":8,"rule":{"op":"ends_equal"},"examples":[{"word":[8],"set":"violet"},{"word":[9],"set":"violet"},{"word":[11],"set":"violet"},{"word":[8,8],"set":"violet"},{"word":[9,9],"set":"violet"},{"word":[8,9,8],"set":"violet"},{"word":[9,11,9],"set":"violet"},{"word":[8,9,11,8],"set":"violet"},{"word":[11,8,9,11],"set":"violet"},{"word":[9,8,11,11,9],"set":"violet"},{"word":[8,9],"set":"orange"},{"word":[9,11],"set":"orange"},{"word":[11,8],"set":"orange"},{"word":[8,8,11,9],"set":"orange"},{"word":[8,11,11,11],"set":"orange"},{"word":[8,8,8,8,9],"set":"orange"},{"word":[8,8,9,8,9],"set":"orange"},{"word":[8,9,9,9,9],"set":"orange"},{"word":[8,11,11,11,11],"set":"orange"},{"word":[9,9,9,11,11],"set":"orange"}],"questions":[[9,8,11,11,11],[8,8,11,8],[8,8,9,11],[11,8,11,11,9],[11,11],[8,8,8],[8,11,8],[8,11]]},{"version":2,"revision":"v2.3.3","id":"L03","number":3,"title":"Collection 03","colors":[8,9,11],"max_length":5,"quiz_count":8,"rule":{"op":"count_eq","color":9,"value":2},"examples":[{"word":[9,9],"set":"violet"},{"word":[9,8,9],"set":"violet"},{"word":[9,9,8],"set":"violet"},{"word":[9,9,11],"set":"violet"},{"word":[11,9,9],"set":"violet"},{"word":[8,9,9,11],"set":"violet"},{"word":[9,11,8,9],"set":"violet"},{"word":[8,11,9,9,8],"set":"violet"},{"word":[9,11,8,11,9],"set":"violet"},{"word":[11,9,8,9,11],"set":"violet"},{"word":[8],"set":"orange"},{"word":[11,11,11],"set":"orange"},{"word":[9,9,9,9],"set":"orange"},{"word":[8,8,8,8,8],"set":"orange"},{"word":[8,8,8,8,11],"set":"orange"},{"word":[8,9,8,9,9],"set":"orange"},{"word":[8,11,11,8,8],"set":"orange"},{"word":[9,9,9,9,9],"set":"orange"},{"word":[11,9,11,11,11],"set":"orange"},{"word":[11,11,11,11,11],"set":"orange"}],"questions":[[8,8,8,9,9],[8,9,8,8,9],[9,11,9,11,9],[8,9,8,9,8],[8,9,9],[9],[11],[8,8]]},{"version":2,"revision":"v2.3.3","id":"L04","number":4,"title":"Collection 04","colors":[8,9,11],"max_length":5,"quiz_count":8,"rule":{"op":"adjacent_distinct"},"examples":[{"word":[8],"set":"violet"},{"word":[9],"set":"violet"},{"word":[11],"set":"violet"},{"word":[8,9],"set":"violet"},{"word":[11,9],"set":"violet"},{"word":[9,8,9],"set":"violet"},{"word":[8,11,9,8],"set":"violet"},{"word":[11,8,11,8],"set":"violet"},{"word":[9,8,11,9,8],"set":"violet"},{"word":[11,9,8,9,11],"set":"violet"},{"word":[8,8,8,8],"set":"orange"},{"word":[9,9,9,9],"set":"orange"},{"word":[9,11,11,11],"set":"orange"},{"word":[11,8,8,11],"set":"orange"},{"word":[11,11,11,11],"set":"orange"},{"word":[8,8,8,8,8],"set":"orange"},{"word":[8,8,8,9,9],"set":"orange"},{"word":[9,9,8,11,9],"set":"orange"},{"word":[9,9,9,9,9],"set":"orange"},{"word":[11,11,11,11,11],"set":"orange"}],"questions":[[8,8,11,8],[9,8,8,9,8],[9,11,8,11],[8,11,8,8],[8,11],[9,8],[9,11],[8,8]]},{"version":2,"revision":"v2.3.3","id":"L05","number":5,"title":"Collection 05","colors":[8,9,11],"max_length":5,"quiz_count":8,"rule":{"op":"grouped_colors"},"examples":[{"word":[8,8,9,9,11],"set":"violet"},{"word":[11,11,8,8,9],"set":"violet"},{"word":[9,9,11,11,8],"set":"violet"},{"word":[8,11,11,9,9],"set":"violet"},{"word":[9,11,8],"set":"violet"},{"word":[11,8,8,8],"set":"violet"},{"word":[8,9,9],"set":"violet"},{"word":[11,11,11,11],"set":"violet"},{"word":[9,8],"set":"violet"},{"word":[9],"set":"violet"},{"word":[8,9,9,8,11],"set":"orange"},{"word":[9,11,9,8,11],"set":"orange"},{"word":[11,8,11],"set":"orange"},{"word":[8,8,8,9,8],"set":"orange"},{"word":[9,9,9,11,9],"set":"orange"},{"word":[11,11,11,8,11],"set":"orange"},{"word":[9,9,8,9,11],"set":"orange"},{"word":[11,11,8,11,9],"set":"orange"},{"word":[8,9,8,8],"set":"orange"},{"word":[8,9,8],"set":"orange"}],"questions":[[11,9,9,8,8],[9,8,11,8,11],[11,9,8,9,8],[9,8,8,11,11],[8],[11],[8,11,8],[9,8,9]]},{"version":2,"revision":"v2.3.3","id":"L06","number":6,"title":"Collection 06","colors":[8,9,11],"max_length":5,"quiz_count":8,"rule":{"op":"and","args":[{"op":"count_eq","color":11,"value":1},{"op":"ends_equal"}]},"examples":[{"word":[11],"set":"violet"},{"word":[8,11,8],"set":"violet"},{"word":[9,11,9],"set":"violet"},{"word":[8,8,11,8],"set":"violet"},{"word":[8,11,8,8],"set":"violet"},{"word":[9,9,11,9],"set":"violet"},{"word":[9,11,9,9],"set":"violet"},{"word":[8,8,9,11,8],"set":"violet"},{"word":[8,9,11,9,8],"set":"violet"},{"word":[9,8,11,9,9],"set":"violet"},{"word":[8],"set":"orange"},{"word":[9],"set":"orange"},{"word":[11,11],"set":"orange"},{"word":[8,8,8],"set":"orange"},{"word":[8,11,9],"set":"orange"},{"word":[9,8,11],"set":"orange"},{"word":[11,8,11],"set":"orange"},{"word":[11,11,11],"set":"orange"},{"word":[8,11,11,8],"set":"orange"},{"word":[8,9,11,11,8],"set":"orange"}],"questions":[[9,11,8],[8,9,11,8],[8,9,8,11,8],[8,11,11],[8,11,9,8],[9,8,11,9],[8,8],[8,9]]}]')

def _int(v: Any) -> bool:
    return type(v) is int and abs(v) <= 9007199254740991

def evaluate(rule: dict, seq: list) -> bool:
    op, c, n = rule['op'], rule.get('color'), len(seq)
    if op == 'contains': return c in seq
    if op == 'first': return seq[0] == c
    if op == 'last': return seq[-1] == c
    if op == 'count_eq': return seq.count(c) == rule['value']
    if op == 'count_parity': return seq.count(c) % 2 == rule['value']
    if op == 'length_parity': return n % 2 == rule['value']
    if op == 'length_at_least': return n >= rule['value']
    if op == 'ends_equal': return seq[0] == seq[-1]
    if op == 'palindrome': return seq == seq[::-1]
    if op == 'adjacent_distinct': return all(a != b for a,b in zip(seq, seq[1:]))
    if op == 'grouped_colors':
        # One run per color; repeats inside a run are allowed, returns are not.
        runs = [color for i,color in enumerate(seq) if i == 0 or color != seq[i-1]]
        return len(runs) == len(set(runs))
    if op == 'all_same': return len(set(seq)) == 1
    if op == 'all_distinct': return len(set(seq)) == n
    if op == 'has_pair': return any(a == rule['left'] and b == rule['right'] for a,b in zip(seq,seq[1:]))
    if op == 'precedes': return any(a == rule['left'] and rule['right'] in seq[i+1:] for i,a in enumerate(seq))
    if op == 'and': return all(evaluate(x, seq) for x in rule['args'])
    if op == 'not': return not evaluate(rule['arg'], seq)
    raise ValueError(f'Unsupported rule operator: {op}')

def validate_rule(r: dict, depth: int = 0) -> None:
    if not isinstance(r, dict) or depth >= 8: raise ValueError('Invalid rule.')
    op = r.get('op')
    color_ops = ('contains','first','last','count_eq','count_parity')
    if op in color_ops and (not _int(r.get('color')) or r['color'] not in COLORS): raise ValueError('Invalid rule color.')
    if op in ('count_eq','count_parity','length_parity','length_at_least') and (not _int(r.get('value')) or not 0 <= r['value'] <= 5): raise ValueError('Invalid rule value.')
    if op in ('count_parity','length_parity') and r['value'] > 1: raise ValueError('Invalid parity.')
    if op in ('has_pair','precedes') and any(not _int(r.get(k)) or r[k] not in COLORS for k in ('left','right')): raise ValueError('Invalid pair.')
    if op == 'and':
        if not isinstance(r.get('args'), list) or not 2 <= len(r['args']) <= 4: raise ValueError('Invalid conjunction.')
        for x in r['args']: validate_rule(x, depth+1)
    elif op == 'not': validate_rule(r.get('arg'), depth+1)
    elif op not in (*color_ops,'length_parity','length_at_least','ends_equal','palindrome','adjacent_distinct','grouped_colors','all_same','all_distinct','has_pair','precedes'): raise ValueError('Unknown rule.')


def group_for(rule: dict, word: list) -> str:
    return 'violet' if evaluate(rule, word) else 'orange'


def validate_level(raw: dict) -> dict:
    l = deepcopy(raw)
    if not isinstance(l, dict) or not isinstance(l.get('id'), str) or not isinstance(l.get('title'), str):
        raise ValueError('Missing level id/title.')
    if l.get('colors') != COLORS or l.get('max_length') != 5:
        raise ValueError('Use three colors and up to five segments.')
    if l.get('quiz_count') != 8 or type(l['quiz_count']) is not int:
        raise ValueError('Exactly eight questions required.')
    # Legacy eight-question level files remain loadable; the former budget is ignored.
    l.pop('decision_limit', None)
    validate_rule(l.get('rule'))
    def valid_word(w):
        return isinstance(w,list) and 1 <= len(w) <= 5 and all(_int(v) and v in COLORS for v in w)
    if not isinstance(l.get('examples'), list) or len(l['examples']) != 20:
        raise ValueError('Exactly twenty examples required.')
    seen=set();counts={'violet':0, 'orange':0}
    for e in l['examples']:
        if (not isinstance(e,dict) or not valid_word(e.get('word')) or e.get('set') not in SETS
                or tuple(e['word']) in seen):
            raise ValueError('Invalid or duplicate example.')
        if group_for(l['rule'],e['word']) != e['set']:
            raise ValueError('Incorrect example group.')
        counts[e['set']]+=1;seen.add(tuple(e['word']))
    if counts != {'violet':10,'orange':10}:
        raise ValueError('Ten examples per set are required.')
    if not isinstance(l.get('questions'),list) or len(l['questions']) != l['quiz_count']:
        raise ValueError('Eight unseen questions required.')
    for w in l['questions']:
        if not valid_word(w) or tuple(w) in seen:
            raise ValueError('Questions must be distinct and unseen.')
        seen.add(tuple(w))
    return l


def create_state(l: dict) -> dict:
    return {'phase':'CLASSIFY','quizIndex':0,'answers':[], 'decisions':0,
            'actions':0,'won':False,'lastEvent':'ready'}


def classify_click(x: int, y: int) -> str | None:
    for name,(bx,by,w,h) in BUTTONS.items():
        if bx <= x < bx+w and by <= y < by+h:
            return name
    return None


def transition(l: dict, state: dict, action_id: Any, data: dict | None=None) -> dict:
    if state['won']:
        return {'state':state,'event':'finished'}
    if (not _int(action_id) or action_id != 6 or not isinstance(data,dict)
            or not all(_int(data.get(k)) and 0 <= data[k] < 64 for k in ('x','y'))):
        return {'state':state,'event':'ignored'}
    s=deepcopy(state);s['actions']+=1
    group=classify_click(data['x'],data['y']);event='idle';extra={}
    if group is not None:
        word=l['questions'][s['quizIndex']];s['decisions']+=1
        extra={'submitted_word':word[:], 'submitted_set':group}
        if group != group_for(l['rule'],word):
            event='wrong_answer'
        else:
            s['answers'].append({'word':word[:],'set':group});s['quizIndex']+=1
            event='classified'
            if s['quizIndex'] == l['quiz_count']:
                s['won']=True;event='success'
    s['lastEvent']=event
    return {'state':s,'event':event,**extra}


def render(l: dict, s: dict, completed: list | None=None, options: dict | None=None) -> Raster:
    completed=[False]*6 if completed is None else completed
    options=options or {};f=[[5]*64 for _ in range(64)]
    def fill(x,y,w,h,c):
        for yy in range(max(0,y),min(64,y+h)):
            for xx in range(max(0,x),min(64,x+w)):
                f[yy][xx]=c
    def box(x,y,w,h,c):
        fill(x,y,w,1,c);fill(x,y+h-1,w,1,c);fill(x,y,1,h,c);fill(x+w-1,y,1,h,c)
    def caterpillar(word,x,y,size,gap=1):
        # Grey head is a direction anchor, never a colored segment.
        fill(x,y,size,size,1);fill(x,y,1,1,0);x+=size+2
        for color in word:
            fill(x,y,size,size,color);x+=size+gap
    for name,(x,y,w,h) in zip(('violet','orange'),LAYOUT['panels']):
        fill(x,y,w,h,4);box(x,y,w,h,SETS[name]);fill(x+1,y+1,w-2,2,SETS[name])
        for i,e in enumerate(e for e in l['examples'] if e['set']==name):
            caterpillar(e['word'],x+2,LAYOUT['example_y']+i*LAYOUT['example_pitch'],3)
    word=l['questions'][min(s['quizIndex'],len(l['questions'])-1)]
    x,y,w,h=LAYOUT['proposal']
    fill(x,y,w,h,4);box(x,y,w,h,1);caterpillar(word,x+2,y+2,4)
    for name,(x,y,w,h) in BUTTONS.items():
        # Flat violet/orange interiors; clipped pixel corners give a white rounded rim.
        fill(x+1,y,w-2,h,0);fill(x,y+1,w,h-2,0)
        fill(x+1,y+1,w-2,h-2,SETS[name])
        if options.get('selected_set')==name:
            box(x-1,y-1,w+2,h+2,1)
    x,y,w,h,pitch=LAYOUT['answer_lights']
    for i in range(l['quiz_count']):
        fill(x+i*pitch,y,w,h,SETS[s['answers'][i]['set']] if i<len(s['answers']) else 2)
    x,y,w,h,pitch=LAYOUT['level_lights']
    for i in range(6):
        fill(x+i*pitch,y,w,h,14 if completed[i] else 2)
    if 'border' in options:
        box(0,0,64,64,options['border'])
    return f


@dataclass(frozen=True)
class CaterpillarLogicInfo:
    game_id: str = GAME_ID
    title: str = 'Caterpillar Logic'
    family: str = FAMILY
    levels: int = 6
    default_fps: float = FPS


class CaterpillarLogicEngine:
    """Custom-backend adapter; not registration in an official ARC SDK."""
    def __init__(self, info: Any=None, *, levels: list | None=None,
                 levels_dir: str | Path | None=None, animate: bool=True) -> None:
        if levels is not None and levels_dir is not None:
            raise ValueError('Use levels OR levels_dir.')
        if levels_dir is not None:
            paths=sorted(Path(levels_dir).glob('L[0-9][0-9].json'))
            if not paths:raise FileNotFoundError('No Lxx.json levels found.')
            levels=[json.loads(p.read_text(encoding='utf-8-sig')) for p in paths]
        bank=DEFAULT_LEVELS if levels is None else levels
        if not isinstance(bank,list) or not 1<=len(bank)<=6:
            raise ValueError('One to six levels required.')
        self.info=info or CaterpillarLogicInfo(levels=len(bank))
        count=getattr(self.info,'levels',len(bank))
        if not _int(count) or not 1<=count<=len(bank):raise ValueError('Invalid info.levels.')
        self.levels=[validate_level(l) for l in bank[:count]]
        self.animate=bool(animate);self.reset()

    def _setup(self,i: int) -> None:
        self.index=i;self.local=create_state(self.levels[i]);self.state='NOT_FINISHED'

    def observe(self) -> dict:
        l=self.levels[self.index];s=self.local;frame=render(l,s,self.completed)
        ids=[6,7] if self.state=='NOT_FINISHED' else [7]
        return {'backend':'custom','selected':True,'game_id':self.info.game_id,'title':self.info.title,
                'custom_family':self.info.family,'wave':WAVE,'revision':WEB_REVISION,
                'frame':frame,'frames':[frame],'frame_count':1,'frame_durations_ms':[0],
                'state':self.state,'level':self.index+1,'levels_completed':sum(self.completed),
                'win_levels':len(self.levels),'score':sum(self.completed),'available_action_ids':ids,
                'available_actions':['ACTION'+str(i) for i in ids], 'step_index':self.step_index,
                'total_actions':self.total_actions,'total_decisions':self.total_decisions,
                'last_action':self.last_action,'last_event':self.last_event,'level_actions':s['actions'],
                'decisions_used':s['decisions'],'decisions_remaining':None,
                'decision_limit':None,'budget_enabled':False,'phase':s['phase'],'classified':len(s['answers']),
                'quiz_count':l['quiz_count'],'example_count':20,'examples_per_set':10,
                'restarts':self.restarts,'test_mode':self.test_mode,'palette':list(PALETTE),
                'default_fps':FPS,'full_reset':False}
    public_state=observe

    def view(self) -> dict:
        l=self.levels[self.index];s=self.local
        return {'level':self.index+1,'title':l['title'],'phase':s['phase'],'examples':deepcopy(l['examples']),
                'current':l['questions'][min(s['quizIndex'],l['quiz_count']-1)][:],
                'classified':len(s['answers']),'quizCount':l['quiz_count'],'decisions':s['decisions'],
                'decisionLimit':None,'remaining':None,'budgetEnabled':False,
                'actions':s['actions'],'completed':self.completed[:len(self.levels)],'state':self.state,
                'testMode':self.test_mode,'restarts':self.restarts,'totalActions':self.total_actions,
                'totalDecisions':self.total_decisions}

    def _packet(self,event,frames=None,durations=None,**extra):
        self.last_event=event;out=self.observe();out['event']=event
        if frames:
            out.update(frame=frames[-1],frames=frames,frame_count=len(frames),frame_durations_ms=durations)
        out.update(extra);return out

    def reset(self):
        self.completed=[False]*6;self.test_mode=False
        self.step_index=self.total_actions=self.total_decisions=self.restarts=0
        self.last_action='RESET';self._setup(0);return self._packet('reset')

    def level_reset(self):
        self.completed[self.index]=False;self.restarts+=1;self.last_action='ACTION7'
        self._setup(self.index);return self._packet('restart')

    def jump_to_level(self,n):
        if not _int(n) or not 1<=n<=len(self.levels):raise ValueError('Invalid level number.')
        self.completed=[False]*6;self.test_mode=True
        self.step_index=self.total_actions=self.total_decisions=self.restarts=0
        self.last_action='LOAD_LEVEL';self._setup(n-1);return self._packet('preview')

    def action(self,action_id: Any,data: dict | None=None):
        if isinstance(action_id,dict):
            p=action_id;data=p.get('data') or {};action_id=p.get('id',p.get('action',p.get('action_ref')))
        action_id=getattr(action_id,'value',action_id)
        if (_int(action_id) and action_id==0) or action_id=='RESET':return self.reset()
        if isinstance(action_id,str) and len(action_id)==7 and action_id.startswith('ACTION') and action_id[-1] in '1234567':
            action_id=int(action_id[-1])
        if _int(action_id) and action_id==7:return self.level_reset()
        if self.state!='NOT_FINISHED':return self._packet('finished')
        l=self.levels[self.index];before=self.local;previous=before['decisions']
        r=transition(l,before,action_id,data)
        if r['event']=='ignored':return self._packet('ignored')
        self.local=r['state'];s=self.local;self.step_index+=1;self.total_actions+=1
        self.total_decisions+=s['decisions']-previous;self.last_action='ACTION'+str(action_id)
        frames,durations=[],[];extra={'played_level':self.index+1}
        for k in ('submitted_word','submitted_set'):
            if k in r:extra[k]=deepcopy(r[k])
        if self.animate and r['event']=='classified':
            flashed=deepcopy(before);flashed['decisions']=s['decisions'];flashed['answers']=s['answers']
            frames.append(render(l,flashed,self.completed,{'selected_set':r['submitted_set']}));durations.append(160)
        if r['event']=='success':
            extra.update(completed_actions=s['actions'],completed_decisions=s['decisions'],
                         completed_decision_limit=None,
                         completed_decisions_remaining=None)
            self.completed[self.index]=True
            if self.animate:
                blink_on=render(l,s,self.completed,{'border':14}); blink_off=render(l,s,self.completed)
                frames.extend([blink_on,blink_off,blink_on,blink_off,blink_on,blink_off])
                durations.extend([180,120,180,120,180,120])
            if self.test_mode:self.state='LEVEL_COMPLETE'
            elif self.index==len(self.levels)-1:self.state='WIN'
            else:self._setup(self.index+1)
            frames.append(render(self.levels[self.index],self.local,self.completed));durations.append(0)
            return self._packet('win' if self.state=='WIN' else 'success',frames,durations,**extra)
        if r['event'] == 'wrong_answer':
            extra.update(reason='incorrect_classification',
                         auto_reset=True,failed_decisions=s['decisions'],failed_actions=s['actions'],failed_limit=None)
            if self.animate:
                blink_on=render(l,s,self.completed,{'border':8}); blink_off=render(l,s,self.completed)
                frames.extend([blink_on,blink_off,blink_on,blink_off,blink_on,blink_off]);durations.extend([180,120,180,120,180,120])
            self.restarts+=1;self._setup(self.index)
            frames.append(render(l,self.local,self.completed));durations.append(0)
            return self._packet(r['event'],frames,durations,**extra)
        frames.append(render(l,s,self.completed));durations.append(0)
        return self._packet(r['event'],frames,durations,**extra)
    step=action
    levelReset=level_reset
    jumpToLevel=jump_to_level


if __name__=='__main__':
    print(json.dumps(CaterpillarLogicEngine().observe(),ensure_ascii=False))
