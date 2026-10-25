from __future__ import annotations
import json
from copy import deepcopy
from pathlib import Path
from typing import Any

FRAME=64; BG=5; WHITE=0; GRAY=3; DARK=4; GOLD=11; RED=8; GREEN=14; CYAN=10
PALETTE=['#FFFFFF','#CCCCCC','#999999','#666666','#333333','#000000','#E53AA3','#FF7BCC','#F93C31','#1E93FF','#88D8F1','#FFDC00','#FF851B','#921231','#4FCC30','#A356D6']
TOOL_INFO={'none':('Support vide',4),'reverse':('Miroir',10),'raise':('Rehausser',14),'lower':('Limer',12),'shift':('Décaler',15),'invert':('Inverser les hauteurs',6),'alternate':('Inverser une dent sur deux',9)}
LEVELS_DIR=Path(__file__).resolve().parents[1]/'games'/'lock_and_key'/'levels'

def load_levels(path=LEVELS_DIR): return [json.loads(p.read_text(encoding='utf-8')) for p in sorted(Path(path).glob('L*.json'))]
def transform(p,t):
 p=list(p)
 if t=='reverse': return p[::-1]
 if t=='shift': return [p[-1]]+p[:-1]
 if t=='invert': return [5-x for x in p]
 if t=='alternate': return [5-x if i%2==0 else x for i,x in enumerate(p)]
 if t=='raise': return None if 4 in p else [x+1 for x in p]
 if t=='lower': return None if 1 in p else [x-1 for x in p]
 return p
def create_state(l): return {'keys':deepcopy(l['keys']),'cursor':0,'held':False,'opened':[None if x else True for x in l['locks']],'actions':0,'attempts':0,'swaps':0,'transformations':0,'status':'PLAYING','lastEvent':'READY','lastTest':None}
def row_layout(l,r):
 h=56//len(l['keys']); return {'y':2+r*h+(h-14)//2,'h':14}
def hit(l,x,y):
 if not (isinstance(x,int) and isinstance(y,int) and 1<=x<=62): return None
 for r in range(len(l['keys'])):
  q=row_layout(l,r)
  if q['y']<=y<q['y']+q['h']:
   if 16<=x<41:return {'kind':'key','row':r}
   if 1<=x<14:return {'kind':'tool','row':r}
   if 43<=x<63:return {'kind':'lock','row':r}
 return None
def test_key(k,l):
 d=[b-a for a,b in zip(k['teeth'],l['teeth'])]; return {'differences':d,'pins':[x==0 for x in d],'success':all(x==0 for x in d)}
def step(l,s,aid,data=None):
 data=data or {}
 if aid==7:return create_state(l)
 if s['status']=='WIN':return s
 if aid==6:
  h=hit(l,int(data.get('x',-1)),int(data.get('y',-1)))
  if not h:return s
  if h['kind']=='key':
   if s['held'] and h['row']!=s['cursor']:return {**s,'lastEvent':'RELEASE_FIRST'}
   if s['cursor']==h['row']:return s
   return {**s,'cursor':h['row'],'lastEvent':'CURSOR_MOVED','lastTest':None}
  if h['row']!=s['cursor']:return {**s,'lastEvent':'ALIGN_FIRST'}
  return step(l,s,3 if h['kind']=='tool' else 4)
 if aid not in (1,2,3,4,5):return s
 n={**s,'lastTest':None}
 if aid==5:return {**n,'held':not s['held'],'lastEvent':'RELEASED' if s['held'] else 'GRABBED'}
 if aid in (1,2):
  t=s['cursor']+(-1 if aid==1 else 1)
  if t<0 or t>=len(s['keys']):return {**s,'lastEvent':'EDGE'}
  if not s['held']:return {**n,'cursor':t,'lastEvent':'CURSOR_MOVED'}
  ks=deepcopy(s['keys']);ks[s['cursor']],ks[t]=ks[t],ks[s['cursor']]
  return {**n,'keys':ks,'cursor':t,'swaps':s['swaps']+1,'lastEvent':'SWAPPED'}
 if not s['held']:return {**s,'lastEvent':'GRAB_FIRST'}
 r=s['cursor']
 if aid==3:
  tool=l['tools'][r]
  if tool=='none':return {**n,'lastEvent':'NO_TOOL'}
  p=transform(s['keys'][r]['teeth'],tool)
  if p is None:return {**n,'lastEvent':'TOOL_LIMIT'}
  ks=deepcopy(s['keys']);ks[r]['teeth']=p
  return {**n,'keys':ks,'transformations':s['transformations']+1,'lastEvent':'TRANSFORMED'}
 lock=l['locks'][r]
 if lock is None:return {**n,'lastEvent':'NO_LOCK'}
 if s['opened'][r]:return {**n,'lastEvent':'ALREADY_OPEN'}
 lock={'teeth':lock} if isinstance(lock,list) else lock
 t=test_key(s['keys'][r],lock); op=deepcopy(s['opened'])
 if t['success']:op[r]=list(s['keys'][r]['teeth'])
 win=all(bool(x) for x in op)
 return {**n,'opened':op,'attempts':s['attempts']+1,'status':'WIN' if win else 'PLAYING','lastEvent':'WIN' if win else ('UNLOCKED' if t['success'] else 'WRONG_KEY'),'lastTest':{**t,'row':r,'teeth':list(s['keys'][r]['teeth'])}}
def action(l,s,aid,data=None):
 n=step(l,s,aid,data)
 return n if aid==7 or n is s else {**n,'actions':s['actions']+1}
def route_key(l,start,p,target):
 if l['locks'][target] is None:return None
 goal=tuple(l['locks'][target] if isinstance(l['locks'][target],list) else l['locks'][target]['teeth']);q=[(start,tuple(p),-1,0)];seen={(start,tuple(p))};head=0
 while head<len(q):
  r,p,prev,aid=q[head]
  if r==target and p==goal:
   out=[];i=head
   while q[i][2]!=-1:out.append(q[i][3]);i=q[i][2]
   return out[::-1]
  nxt=[]
  if r>0:nxt.append((r-1,p,1))
  if r<len(l['keys'])-1:nxt.append((r+1,p,2))
  if l['tools'][r]!='none':
   tp=transform(list(p),l['tools'][r])
   if tp is not None and tuple(tp)!=p:nxt.append((r,tuple(tp),3))
  for nr,np,na in nxt:
   if (nr,np) not in seen:seen.add((nr,np));q.append((nr,np,head,na))
  head+=1
 return None
def plan(l,s):
 s=deepcopy(s);cmd=[]
 while s['status']!='WIN':
  best=None
  for lk in range(len(l['locks'])):
   if l['locks'][lk] is None or s['opened'][lk]:continue
   for r in range(len(s['keys'])):
    path=route_key(l,r,s['keys'][r]['teeth'],lk)
    if path is None:continue
    pre=[]
    if not(s['held'] and s['cursor']==r):
     if s['held']:pre.append(5)
     pre += ([1] if r<s['cursor'] else [2])*abs(r-s['cursor']);pre.append(5)
    a=pre+path+[4]
    if best is None or len(a)<len(best[0]):best=(a,lk)
  if best is None:return {'solvable':False,'actions':cmd}
  for aid in best[0]:s=action(l,s,aid);cmd.append({'aid':aid})
 return {'solvable':True,'actions':cmd,'finalState':s}
def blank():return [[BG]*64 for _ in range(64)]
def put(f,x,y,c):
 if 0<=x<64 and 0<=y<64:f[y][x]=c
def fill(f,x,y,w,h,c):
 for yy in range(y,y+h):
  for xx in range(x,x+w):put(f,xx,yy,c)
def rect(f,x,y,w,h,c):fill(f,x,y,w,1,c);fill(f,x,y+h-1,w,1,c);fill(f,x,y,1,h,c);fill(f,x+w-1,y,1,h,c)
def corners(f,x,y,w,h,c):
 for xx,yy,dx,dy in [(x,y,1,1),(x+w-1,y,-1,1),(x,y+h-1,1,-1),(x+w-1,y+h-1,-1,-1)]:
  for px,py in [(xx,yy),(xx+dx,yy),(xx+2*dx,yy),(xx,yy+dy),(xx,yy+2*dy)]:put(f,px,py,c)
def key_shape(f,x,y,k,held=False):
 rect(f,x,y-3,5,5,k['color']);put(f,x,y-3,BG);put(f,x+4,y-3,BG);put(f,x,y+1,BG);put(f,x+4,y+1,BG)
 if held:put(f,x+2,y-1,WHITE)
 fill(f,x+4,y,3+len(k['teeth'])*3,1,GOLD)
 for j,h in enumerate(k['teeth']):fill(f,x+7+j*3,y-h,2,h,GOLD)
def tool_icon(f,x,y,t):
 c=TOOL_INFO[t][1]
 if t=='none':fill(f,x+2,y+6,7,1,DARK);put(f,x+5,y+5,GRAY);return
 rect(f,x,y,11,11,DARK);fill(f,x+2,y+9,7,1,GRAY)
 if t=='reverse':fill(f,x+5,y+2,1,6,GRAY);fill(f,x+1,y+4,4,1,c);fill(f,x+6,y+6,4,1,c)
 elif t in ('raise','lower'):fill(f,x+3,y+3,5,1,c);fill(f,x+5,y+1,1,5,c) if t=='raise' else None
 elif t=='shift':fill(f,x+2,y+2,6,1,c);fill(f,x+2,y+3,1,4,c);fill(f,x+3,y+6,5,1,c)
 else:
  for j in range(5):fill(f,x+1+2*j,y+2,1,4,c if t!='alternate' or j%2==0 else GRAY)
def lock_shape(f,l,s,r,y,opts=None):
 opts=opts or {};raw=l['locks'][r]
 if raw is None:fill(f,47,y+7,10,1,DARK);put(f,51,y+6,GRAY);put(f,52,y+6,GRAY);return
 goal=raw if isinstance(raw,list) else raw['teeth'];opened=bool(s['opened'][r]);trial=s['lastTest'] if s.get('lastTest') and s['lastTest']['row']==r else None;test=(trial or {}).get('teeth') or (s['opened'][r] if isinstance(s['opened'][r],list) else None)
 sy=y+6;base=y+12;rect(f,43,y+1,18,13,GREEN if opened else GRAY);fill(f,44,y+2,16,11,DARK)
 for x in range(44,60):put(f,x,sy,CYAN)
 for i,g in enumerate(goal):
  x=44+i*3;h=test[i] if test else 0;contact=base-h;seam=sy+g-h;fill(f,x,y+2,2,10,BG);put(f,x,y+2,2);put(f,x+1,y+3,2)
  if seam>y+4:fill(f,x,y+4,2,seam-y-4,2)
  sc=GREEN if opened else (GREEN if trial and trial['pins'][i] else RED if trial else BG);fill(f,x,seam,2,1,sc)
  if contact>seam+1:fill(f,x,seam+1,2,contact-seam-1,12)
 put(f,42,sy,CYAN);put(f,61,sy,CYAN);fill(f,44,base,15,1,GRAY)
 if test:
  fill(f,42,base,17,1,GOLD)
  for j,h in enumerate(test):fill(f,44+j*3,base-h,2,h,GOLD)
 fill(f,61,y+9,2,3,BG if opened else RED)
def render(l,s,progress=(),options=None):
 o=options or {};f=blank();rect(f,0,0,64,59,o.get('outline',GREEN if s['status']=='WIN' else GRAY));fill(f,14,2,1,55,DARK);fill(f,41,2,1,55,DARK)
 for r in range(len(l['keys'])):
  y=row_layout(l,r)['y'];tool_icon(f,2,y+2,l['tools'][r]);key_shape(f,18,y+11,s['keys'][r],s['held'] and s['cursor']==r);lock_shape(f,l,s,r,y,o)
  if r==s['cursor']:corners(f,16,y,25,14,WHITE)
  if o.get('toolRow')==r:rect(f,1,y+1,13,13,WHITE)
  if o.get('errorRow')==r:rect(f,43,y+1,18,13,RED)
 done=set(progress)
 for i in range(6):fill(f,2+i*6,61,5,2,GREEN if i in done else GRAY)
 return f
def run_action(l,s,aid,data=None,animate=True,progress=()):
 n=action(l,s,aid,data);frames=[];dur=[]
 def push(st,ms,opt=None):frames.append(render(l,st,progress,opt));dur.append(ms)
 if n is not s and animate:
  if n['lastEvent']=='TRANSFORMED':push(s,85,{'toolRow':s['cursor']});push(n,100,{'toolRow':n['cursor']})
  if n['lastEvent'] in ('WRONG_KEY','UNLOCKED','WIN'):push(s,90);push(n,180,{'errorRow':s['cursor']} if n['lastEvent']=='WRONG_KEY' else {})
  if n['status']=='WIN':
   for c in [GREEN,GRAY,GREEN,GRAY,GREEN]:push(n,120,{'outline':c})
 final=render(l,n,progress);frames.append(final);dur.append(0)
 return {'state':n,'frame':final,'frames':frames,'frame_count':len(frames),'frame_durations_ms':dur,'accepted':n is not s,'action_cost':0 if aid==7 else int(n is not s),'step_index':n['actions']}
class LockAndKeyEngine:
 def __init__(self,info=None,animate=True):
  self.info=info;self.animate=animate;self.levels=load_levels();self.win_levels=getattr(info,'levels',len(self.levels));self.levels_completed=0;self.step_index=0;self.state='NOT_FINISHED';self.level=deepcopy(self.levels[0]);self.local=create_state(self.level)
 def reset(self):
  self.levels_completed=0;self.step_index=0;self.state='NOT_FINISHED';self.level=deepcopy(self.levels[0]);self.local=create_state(self.level);return self.public_state()
 def action(self,aid,data=None):
  if aid==7:
   if self.state=='WIN':self.levels_completed=self.win_levels-1;self.state='NOT_FINISHED'
   self.local=create_state(self.level);return self.public_state()
  if self.state=='WIN':return self.public_state()
  out=run_action(self.level,self.local,aid,data,self.animate,range(self.levels_completed));self.local=out['state'];self.step_index+=out['action_cost']
  if self.local['status']=='WIN':
   completion=out['frames'];self.levels_completed+=1
   if self.levels_completed>=self.win_levels:self.state='WIN'
   else:self.level=deepcopy(self.levels[self.levels_completed]);self.local=create_state(self.level)
   r=self.public_state();r['frames']=completion+[r['frame']];r['frame_count']=len(r['frames']);r['frame_durations_ms']=out['frame_durations_ms']+[0];return r
  return self.public_state(extra=out)
 def public_state(self,extra=None):
  frame=render(self.level,self.local,range(self.levels_completed));r={'backend':'custom','selected':True,'game_id':getattr(self.info,'game_id','lock_and_key'),'title':getattr(self.info,'title','LOCK & KEY'),'frame':frame,'frames':[frame],'frame_count':1,'state':self.state,'level':min(self.levels_completed+1,self.win_levels),'levels_completed':self.levels_completed,'win_levels':self.win_levels,'step_index':self.step_index,'available_action_ids':[1,2,3,4,5,6,7] if self.state!='WIN' else [7],'last_action':self.local['lastEvent'],'score':self.levels_completed,'level_name':self.level['id'],'local_state':deepcopy(self.local)}
  if extra:r.update({k:v for k,v in extra.items() if k in ('frames','frame_count','frame_durations_ms')})
  return r
