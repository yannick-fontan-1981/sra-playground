"""Conditional preparation of an observed scored line under measured insertions.

The library supplies finite adversarial lookahead as an experimental hypothesis.
Role appearances, target length, field geometry, support axis and ordering of
stable additions come from public responses. No game name or level data enters.
"""
from collections import Counter
from common_repeated_lines import RepeatedLinePatterns as RepeatedLineAccess,fields,pointed_candidates,PointedLineConstraint
from terminal_composition import identity


def layout_key(f):return identity([f['origin'],f['pitch'],f['size'],f['shape']])

def insertions(board,empty,axis,sign):
    if axis is None:return [(x,y)for y,row in enumerate(board)for x,value in enumerate(row)if value==empty]
    height=len(board);width=len(board[0]);length=(width,height)[axis];lanes=(height,width)[axis]
    result=[]
    for lane in range(lanes):
        for d in (range(length-1,-1,-1) if sign>0 else range(length)):
            x,y=(d,lane) if axis==0 else (lane,d)
            if board[y][x] is None:break
            if board[y][x]==empty:result.append((x,y));break
    return result

def line_windows(board,length):
    h,w=len(board),len(board[0]);result=[]
    for y in range(h):
        for x in range(w):
            for dx,dy in ((1,0),(0,1),(1,1),(1,-1)):
                points=tuple((x+i*dx,y+i*dy) for i in range(length))
                if all(0<=u<w and 0<=v<h and board[v][u] is not None for u,v in points):result.append(points)
    return result

def place(board,p,color):
    x,y=p;rows=list(board);row=list(rows[y]);row[x]=color;rows[y]=tuple(row);return tuple(rows)

def search_lines(board,own,other,empty,length,axis,sign,depth):
    windows=line_windows(board,length);terminal=(len(windows)+1)*(4**length)*100;nodes=0;cache={}
    def won(b,color):return any(all(b[y][x]==color for x,y in w) for w in windows)
    def evaluate(b):
        value=0
        for w in windows:
            a=sum(b[y][x]==own for x,y in w);c=sum(b[y][x]==other for x,y in w)
            if not c:value+=4**a
            if not a:value-=4**c
        return value
    def solve(b,left,player,alpha,beta):
        nonlocal nodes
        nodes+=1
        if won(b,own):return terminal+left
        if won(b,other):return -terminal-left
        legal=insertions(b,empty,axis,sign)
        if not left or not legal:return evaluate(b)
        key=b,left,player
        if key in cache:return cache[key]
        maximizing=player==own;best=-terminal*2 if maximizing else terminal*2;complete=True
        ordered=sorted(((evaluate(place(b,p,player)),p) for p in legal),reverse=maximizing)
        for _,p in ordered:
            value=solve(place(b,p,player),left-1,other if maximizing else own,alpha,beta)
            best=max(best,value) if maximizing else min(best,value)
            if maximizing:alpha=max(alpha,best)
            else:beta=min(beta,best)
            if beta<=alpha:complete=False;break
        if complete:cache[key]=best
        return best
    board=tuple(tuple(row) for row in board);legal=insertions(board,empty,axis,sign);ranked=[]
    for p in legal:
        child=place(board,p,own);value=solve(child,depth-1,other,-terminal*2,terminal*2)
        useful=sum(p in w for w in windows);ranked.append({'point':list(p),'value':value,'immediate_goal':won(child,own),'geometric_windows':useful})
    ranked.sort(key=lambda r:(-r['value'],-r['geometric_windows'],r['point']))
    return ranked,{'nodes':nodes,'reply_plies':depth,'windows':len(windows),'scope':'Exact finite-horizon search under conditional insertion, alternating response and symmetric line-goal hypotheses; future response policy unknown.'}


class SupportedLineAccess(RepeatedLineAccess):
    def __init__(self):super().__init__();self.insert_samples=[];self.insert_orders={};self.insert_rejections=set();self.insert_refuted_epochs=set()
    def apply_event(self,e):
        if e['kind']=='supported_insertion_observation':self.insert_samples.append(e)
        elif e['kind']=='supported_insertion_order':self.insert_orders[e['source']]=e
        elif e['kind']=='supported_line_refutation':self.insert_rejections.add(e['trial']);self.insert_refuted_epochs.add(e['epoch'])
        else:super().apply_event(e)
    def retained_digest(self):return identity([super().retained_digest(),self.insert_samples,self.insert_orders,sorted(self.insert_rejections),sorted(self.insert_refuted_epochs)])
    def record(self,before,command,after,rows,later,proposal,index):
        events=super().record(before,command,after,rows,later,proposal,index);extra=[]
        if proposal.get('supported_line_plan'):
            plan=proposal['supported_line_plan'];outcome=self.after(proposal,index,rows,later,epoch=after['level_epoch'],score=after['levels_completed'],state=after['state'])
            if outcome['matched'] is False:extra.append({'kind':'supported_line_refutation','epoch':before['level_epoch'],'trial':plan['trial'],'source':after['observation_ref'],'reason':outcome['reason']})
        if self.line_goals and command['action_ref']=='ACTION6' and before['level_epoch']==after['level_epoch']:
            old,new=fields(rows),fields(later)
            if len(old)==len(new)==1 and layout_key(old[0])==layout_key(new[0]):
                f,g=old[0],new[0];own=self.line_goals[-1]['palette'];empty=f['empty_hypothesis'];changes=[(x,y,f['grid'][y][x],v) for y,row in enumerate(g['grid']) for x,v in enumerate(row) if v!=f['grid'][y][x]]
                own_changes=[(x,y) for x,y,a,b in changes if a==empty and b==own];other_changes=[(x,y,b) for x,y,a,b in changes if a==empty and b not in (own,empty,None)]
                if len(own_changes)==1 and len(other_changes)==1 and len(changes)==2:
                    data=command.get('data',{});px,py=data.get('x',-1),data.get('y',-1);ix=(px-f['origin'][0])//f['pitch'][0];iy=(py-f['origin'][1])//f['pitch'][1]
                    if 0<=ix<f['shape'][0] and 0<=iy<f['shape'][1]:
                        prepared=place(tuple(tuple(row) for row in f['grid']),own_changes[0],own);response_point=tuple(other_changes[0][:2]);goal_length=self.line_goals[-1]['candidate_length']
                        blocked=any(response_point in win and all(prepared[v][u]==own for u,v in win if (u,v)!=response_point) for win in line_windows(prepared,goal_length))
                        extra.append({'kind':'supported_insertion_observation','epoch':before['level_epoch'],'source':before['observation_ref'],'after':after['observation_ref'],'layout':layout_key(f),'field':{k:v for k,v in f.items() if k!='grid'},'board':f['grid'],'blocked_goal_extension':blocked,
                            'own':own,'other':other_changes[0][2],'empty':empty,'point':[ix,iy],'arrived':list(own_changes[0]),'response':list(other_changes[0][:2]),'scope':'Two stable additions; actor/order and support law require separate compatibility checks.'})
        for e in extra:self.apply_event(e)
        return events+extra
    def record_packet(self,before,command,after,rows,packet,episode):
        events=[]
        sample=next((s for s in reversed(self.insert_samples) if s['source']==before['observation_ref']),None)
        if not sample or not packet:return events
        f=sample['field']
        def stable_start(point,color):
            x=f['origin'][0]+point[0]*f['pitch'][0];y=f['origin'][1]+point[1]*f['pitch'][1];w,h=f['size'];first=len(packet)
            for i in range(len(packet)-1,-1,-1):
                if all(packet[i][v][u]==color for v in range(y,y+h) for u in range(x,x+w)):first=i
                else:break
            return first
        own=stable_start(sample['arrived'],sample['own']);other=stable_start(sample['response'],sample['other'])
        e={'kind':'supported_insertion_order','epoch':before['level_epoch'],'source':before['observation_ref'],'own_stable_from':own,'response_stable_from':other,'packet_frames':len(packet),'own_before_response':own<other<len(packet),'scope':'Order of persistent public patches within the returned packet, not private turn state.'}
        self.apply_event(e);return events+[e]
    def propose(self,episode,obs,rows,inputs,max_prefix,config):
        base=super().propose(episode,obs,rows,inputs,max_prefix,config)
        if base['status']=='proposed' or not config.get('prepare_supported_lines'):return base
        fs=fields(rows)
        if len(fs)!=1 or not self.line_goals or obs['level_epoch'] in self.insert_refuted_epochs:return base
        f=fs[0];samples=[s for s in self.insert_samples if s['epoch']==obs['level_epoch'] and s['layout']==layout_key(f) and self.insert_orders.get(s['source'],{}).get('own_before_response')]
        if len({tuple(s['point']) for s in samples})<2 or len({tuple(s['arrived']) for s in samples})<2:return base
        if not any(s['blocked_goal_extension'] for s in samples):return base
        roles={(s['own'],s['other'],s['empty']) for s in samples}
        if len(roles)!=1:return base
        own,other,empty=next(iter(roles));compatible=[]
        for axis in (0,1):
            for sign in (-1,1):
                if all(tuple(s['arrived']) in insertions(s['board'],empty,axis,sign) and s['point'][1-axis]==s['arrived'][1-axis] and tuple(s['response']) in insertions(place(tuple(tuple(r) for r in s['board']),tuple(s['arrived']),own),empty,axis,sign) for s in samples):compatible.append((axis,sign))
        if len(compatible)!=1:return base
        axis,sign=compatible[0];length=self.line_goals[-1]['candidate_length'];ranked,search=search_lines(f['grid'],own,other,empty,length,axis,sign,config['supported_line_reply_plies'])
        available={identity(a) for a in inputs};choice=None
        for r in ranked:
            x,y=r['point'];px=f['origin'][0]+x*f['pitch'][0];py=f['origin'][1]+y*f['pitch'][1];cmd={'action_ref':'ACTION6','data':{'x':px+(f['size'][0]-1)//2,'y':py+(f['size'][1]-1)//2}};trial=identity([obs['level_epoch'],f['grid'],cmd])
            if identity(cmd) in available and trial not in self.insert_rejections:choice=r,cmd,trial,[px,py];break
        if choice is None:return base
        r,cmd,trial,target=choice;plan={'epoch':obs['level_epoch'],'score':obs['levels_completed'],'observation_ref':obs['observation_ref'],'frame_digest':identity(rows),'trial':trial,'target':target,'size':f['size'],'expected_palette':own,'response_palette':other,'empty_palette':empty,'action':cmd,'support_axis':axis,'support_sign':sign,'goal_length':length,'layout':layout_key(f),'ranked':ranked,'search':search,'selected':r,
            'scope':'Prepare a scored geometric line under a current-epoch measured insertion candidate; opponent policy and symmetric adverse goal are hypotheses, not universal causal knowledge.'}
        ref='C_supported_line_'+identity(plan)[:18];why='Prepare an accessible contribution to the scored geometric line while considering all compatible immediate counter-placements and their supports.'
        evidence=[obs['observation_ref'],self.line_goals[-1]['source'],*[s['source'] for s in samples]];facts={'scored_line_witness_recalled':True,'current_insertion_revalidated':True,'persistent_response_order_observed':True,'goal_extension_actually_blocked':True,'point_on_measured_field':True}
        return {'status':'proposed','kind':'supported_line_preparation','proposal_id':ref,'supported_line_plan':plan,'actions':[cmd],'steps':[{'action':cmd,'expected_after':{'target':target,'palette':own,'other_effect':'one compatible counter-placement or official boundary'}}],
            'facts':facts,'compositions':[{'id':ref,'observed':False,'open_question':why,'properties':{'goal_length':length,'selected_contribution':r,'search_scope':search['scope']},'relations':['contributes_to:G_official_completion']}],
            'question':{'reason':'prepare_a_supported_geometric_goal_under_response','hypothesis_refs':evidence},'route_refs':evidence,'binding':{'level_epoch':plan['epoch'],'observation_ref':plan['observation_ref']},
            'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':[cmd],'purpose':why,'preconditions':facts,'evidence':evidence,'outcome_guard':{'path':['value'],'contains':ref}}}
    def before(self,p,index,rows,**meta):
        plan=p.get('supported_line_plan')
        if not plan:return super().before(p,index,rows,**meta)
        ok=index==0 and (plan['epoch'],plan['score'],plan['observation_ref'])==(meta['epoch'],meta['score'],meta['observation_ref']) and plan['action']['action_ref'] in meta['available'] and identity(rows)==plan['frame_digest']
        return {'admitted':ok,'reason':'supported_preparation_bound' if ok else 'supported_preparation_changed'}
    def after(self,p,index,rows,later,**meta):
        plan=p.get('supported_line_plan')
        if not plan:return super().after(p,index,rows,later,**meta)
        if meta['epoch']!=plan['epoch'] or meta['score']!=plan['score'] or meta['state'] in ('WIN','GAME_OVER'):return {'matched':None,'seal_prefix':True,'reason':'official_boundary_or_terminal'}
        x,y=plan['target'];w,h=plan['size'];match=all(later[v][u]==plan['expected_palette'] for v in range(y,y+h) for u in range(x,x+w))
        first,last=fields(rows),fields(later);compatible=False
        if match and len(first)==len(last)==1 and layout_key(first[0])==layout_key(last[0])==plan['layout']:
            f,g=first[0],last[0];changes=[(u,v,a,g['grid'][v][u]) for v,row in enumerate(f['grid']) for u,a in enumerate(row) if a!=g['grid'][v][u]]
            own=[(u,v) for u,v,a,b in changes if a==plan['empty_palette'] and b==plan['expected_palette']];reply=[(u,v) for u,v,a,b in changes if a==plan['empty_palette'] and b==plan['response_palette']]
            if len(changes)==2 and len(own)==len(reply)==1:
                board=tuple(tuple(row) for row in f['grid']);compatible=reply[0] in insertions(place(board,own[0],plan['expected_palette']),plan['empty_palette'],plan['support_axis'],plan['support_sign'])
            if any(all(g['grid'][v][u]==plan['expected_palette'] for u,v in win) for win in line_windows(g['grid'],plan['goal_length'])):
                return {'matched':False,'seal_prefix':True,'reason':'scored_line_not_sufficient_in_this_context'}
        return {'matched':bool(match and compatible),'seal_prefix':True,'reason':'prepared_contribution_and_compatible_response_observed' if match and compatible else 'supported_insertion_or_response_refuted'}


class SupportedLineConstraint(PointedLineConstraint):
    """C transport adapter; record all transitions, not just selected questions."""
    def __init__(self):self.memory=SupportedLineAccess();self.events=[]
    def propose(self,obs,rows,inputs,remaining,config):
        if remaining<1:return None
        measured=pointed_candidates(rows,obs['available_action_refs'])
        p=self.memory.propose([],obs,rows,inputs+measured,remaining,{'repeated_line_completion':True,'prepare_supported_lines':config['prepare_supported_lines'],'supported_line_reply_plies':config['supported_line_reply_plies']})
        if p.get('status')!='proposed':return None
        p['steps'][0]['expected_before']={k:obs[k] for k in ('level_epoch','frame_hash','levels_completed','state')}
        x,y=p['actions'][0]['data']['x'],p['actions'][0]['data']['y'];plan=p.get('line_plan') or p['supported_line_plan'];w,h=plan['size'];left,top=plan['target'];field=plan.get('field',plan.get('layout'))
        p['point_support']={'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash'],'point':[x,y],'palette_value':rows[y][x],'bbox':[left,top,left+w-1,top+h-1],
            'entity_ref':'measured-lattice-cell:'+plan['trial'],'signature':identity([field,plan['target'],plan['size']]),'provenance':'uniform cell measured between repeated public separators; not a connected-component identity','field_ref':field,'full_raster_digest':plan['frame_digest']}
        return p
    def record(self,before,after,command,first,second,p,index,*,frames=()):
        events=self.memory.record(before,command,after,first,second,p,index)
        events.extend(self.memory.record_packet(before,command,after,first,frames,[]));self.events.extend(events)
        return {'status':'official_boundary_witness' if after['levels_completed']>before['levels_completed'] else 'measured_series_or_insertion_response','events':events,'transfer_authority':'hypothesis_only'}
    def state(self):return {'events':self.events,'digest':self.memory.retained_digest()}
    def restore(self,state):
        rebuilt=SupportedLineAccess()
        for e in state['events']:rebuilt.apply_event(e)
        if rebuilt.retained_digest()!=state['digest']:raise ValueError('Supported-series memory digest changed')
        self.memory=rebuilt;self.events=list(state['events'])
