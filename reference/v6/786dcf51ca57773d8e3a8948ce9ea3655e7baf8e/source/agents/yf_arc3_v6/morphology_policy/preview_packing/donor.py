"""Observed preview controls serving a conditional finite partition question.

No transport identity, private level data, palette role or command mapping.
V5 supplies normalized transforms and strict finite residual partition calculus.
"""
import copy
from collections import Counter,deque
from types import SimpleNamespace
from .base import CellSymbolAccess,input_candidates as inherited_inputs
from geometric_observer import components
from src_bridge import plain
from terminal_composition import identity
from agents.yf_arc3_v5.capabilities.preview_piece_packing import PackingPiece,PackingPose,PackingModel,PackingState,PackingPoseDomain,_transform,_residual
from agents.yf_arc3_v5.capabilities.mechanical_family_contracts_d import DWorkBudget

def normalized(points):
    top=min(y for y,x in points);left=min(x for y,x in points)
    return sorted((y-top,x-left)for y,x in points),(top,left)

def measure_scene(rows):
    parts=components(rows);background=Counter(v for row in rows for v in row).most_common(1)[0][0]
    squares=[p for p in parts if p['rectangular']and p['bbox'][2]-p['bbox'][0]==p['bbox'][3]-p['bbox'][1]and 2<=p['bbox'][2]-p['bbox'][0]+1<=12]
    counts=Counter((p['color'],p['bbox'][2]-p['bbox'][0]+1)for p in squares)
    for (empty,width),count in counts.most_common():
        if count<3:continue
        q=width+1
        for frame in parts:
            l,t,r,b=frame['bbox'];w=r-l-1;h=b-t-1
            if w<=q or h<=q or w%q or h%q:continue
            support={(x+l,y+t)for x,y in frame['mask']}
            ring={(x,t)for x in range(l,r+1)}|{(x,b)for x in range(l,r+1)}|{(l,y)for y in range(t,b+1)}|{(r,y)for y in range(t,b+1)}
            if not ring<=support:continue
            holes=[p for p in squares if p['color']==empty and p['bbox'][2]-p['bbox'][0]+1==width and l<p['bbox'][0]<r and t<p['bbox'][1]<b]
            if len(holes)<3:continue
            off=(t+1,l+1);board={(y,x)for y in range(h//q)for x in range(w//q)}
            values={};cores={}
            for y in range((len(rows)-off[0])//q):
                for x in range((len(rows[0])-off[1])//q):
                    samples=[rows[off[0]+y*q+dy][off[1]+x*q+dx]for dy in range(q)for dx in range(q)]
                    color,n=Counter(samples).most_common(1)[0]
                    cores[y,x]=(color,n)
                    if n>=q*q-1 and color not in (background,empty,frame['color']):values[y,x]=color
            groups=[];remaining=set(values)
            while remaining:
                start=remaining.pop();todo=[start];cells={start};color=values[start]
                for y,x in todo:
                    for p in ((y-1,x),(y+1,x),(y,x-1),(y,x+1)):
                        if p in remaining and values[p]==color:remaining.remove(p);todo.append(p);cells.add(p)
                if len(cells)>=2:groups.append((color,cells))
            inside=[g for g in groups if g[1]<=board];outside=[g for g in groups if not g[1]&board]
            residual=board-set().union(*(s for c,s in inside))if inside else board
            outside=[g for g in outside if min(y for y,x in g[1])<h//q and len(g[1])<=len(residual)]
            if not outside or sum(len(s)for c,s in outside)!=len(residual):continue
            pieces=[]
            for i,(color,cells)in enumerate(inside+outside):
                mask,anchor=normalized(cells);pieces.append({'id':'piece:'+str(i),'color':color,'mask':mask,'anchor':anchor,'movable':not cells<=board})
            return plain({'q':q,'offset':off,'board':sorted(board),'pieces':pieces,'background':background,'empty':empty,'frame_color':frame['color'],'frame':frame['bbox'],'world':sorted(cores),'selected':None,'preview_color':None,'evidence':[]})
    return None

def point_for(m,p):
    y,x=p['mask'][0];a,b=p['anchor'];q=m['q'];off=m['offset'];return {'x':off[1]+(b+x)*q+q//2,'y':off[0]+(a+y)*q+q//2}

def input_candidates(rows,available):
    result=inherited_inputs(rows,available)
    if 'ACTION6'in available:
        m=measure_scene(rows)
        if m:result += [{'action_ref':'ACTION6','data':point_for(m,p)}for p in m['pieces']if p['movable']]
    return result

def sample(rows,m,cell):
    y,x=cell;q=m['q'];a,b=m['offset'];values=[rows[a+y*q+dy][b+x*q+dx]for dy in range(q)for dx in range(q)]
    return Counter(values).most_common(1)[0]

def preview_pose(rows,m):
    if m.get('preview_color')is None:return None
    excluded={m['background'],m['empty'],*(p['color']for p in m['pieces'])}
    points=[]
    for cell in m['world']:
        color,n=sample(rows,m,cell)
        if n>=m['q']**2-1 and(color==m['preview_color']or color not in excluded):points.append(tuple(cell))
    held=next((p for p in m['pieces']if p['id']==m['selected']),None)
    if not held or len(points)!=len(held['mask']):return None
    mask,anchor=normalized(points);return {'mask':mask,'anchor':anchor}

def assignments(m):
    # The acceptance field declares the requested geometric calculation only.
    # It is never promoted to an observed game acceptance law.
    pieces=[];poses=[];domains=[];board=set(map(tuple,m['board']));world=tuple(map(tuple,m['world']))
    for p in m['pieces']:
        mask=tuple(map(tuple,p['mask']));pose=PackingPose(piece_ref=p['id'],anchor=tuple(p['anchor']),mask=mask);poses.append(pose)
        pieces.append(PackingPiece(piece_ref=p['id'],full_mask=mask,movable=p['movable'],evidence_ref='current_observed_inventory'))
        candidates=[pose]
        if p['movable']:
            shapes={mask}
            cur=mask
            for _ in range(4):shapes.add(cur);cur=tuple(_transform(cur,'rotate_cw'))
            candidates=[]
            for shape in sorted(shapes):
                for y,x in sorted(board):
                    if {(y+a,x+b)for a,b in shape}<=board:candidates.append(PackingPose(piece_ref=p['id'],anchor=(y,x),mask=shape))
        domains.append(PackingPoseDomain(piece_ref=p['id'],poses=tuple(candidates),domain_complete=True,evidence_revision_ref='current'))
    model=PackingModel(model_ref='conditional_partition',pieces=tuple(pieces),world_cells=world,board_cells=tuple(map(tuple,m['board'])),topology_evidence_ref='current_lattice',acceptance_law_ref='strict_complete_population_partition',transform_law_ref='normalized_top_left_anchor',permitted_transforms=('rotate_cw',))
    state=PackingState(poses=tuple(poses),held_piece_ref=None,pickup_pose=None,reserve=0,terminated=False)
    request=SimpleNamespace(pose_domains=tuple(domains),state=state,domain_bound=4096,depth_bound=32,node_bound=100000,time_bound_ms=2000,scope=SimpleNamespace(evidence_revision_ref='current'))
    result=_residual(model,request,DWorkBudget(request))
    return plain(result)

class PreviewPackingAccess(CellSymbolAccess):
    def __init__(self):super().__init__();self.packing_events=[];self.packing_model=None;self.packing_controls={};self._packing_scene_cache={}
    def retained_digest(self):return identity([super().retained_digest(),self.packing_events,self.packing_model,self.packing_controls])
    def apply_event(self,e):
        if e.get('kind')=='observed_preview_packing':self.packing_events.append(e);self.packing_model=copy.deepcopy(e['model']);self.packing_controls=copy.deepcopy(e['controls']);return
        return super().apply_event(e)
    def propose_graph(self,o,rows,inputs,limit,config):
        cfg=config.get('preview_packing_question')
        if not cfg:return super().propose_graph(o,rows,inputs,limit,config)
        m=copy.deepcopy(self.packing_model)if self.packing_model and self.packing_model['epoch']==o['level_epoch']else None
        if m is None:
            if o['level_epoch']not in self._packing_scene_cache:self._packing_scene_cache[o['level_epoch']]=measure_scene(rows)
            m=copy.deepcopy(self._packing_scene_cache[o['level_epoch']])
            if not m:return super().propose_graph(o,rows,inputs,limit,config)
            m.update(epoch=o['level_epoch'],tried=[],evidence=[o['observation_ref']])
        result=assignments(m);solutions=result['packing_assignments']
        if not solutions:return {'status':'unknown','block_unrelated_probe':True,'reason':'packing_partition_missing_under_current_preservation_hypothesis'}
        def cost(sol):
            return sum(abs(pose['anchor'][0]-p['anchor'][0])+abs(pose['anchor'][1]-p['anchor'][1])+3*(pose['mask']!=p['mask'])for p in m['pieces']for pose in sol['poses']if p['id']==pose['piece_ref'])
        target=min(solutions,key=cost);targets={p['piece_ref']:p for p in target['poses']}
        pending=[p for p in m['pieces']if p['movable']and(p['anchor']!=targets[p['id']]['anchor']or p['mask']!=targets[p['id']]['mask'])]
        if not pending:return {'status':'unknown','block_unrelated_probe':True,'reason':'geometric_partition_present_official_goal_unknown'}
        selected=next((p for p in pending if p['id']==m['selected']),None)
        actions=[];expected=[];mode='select';chosen=selected or pending[0]
        if selected is None:
            actions=[{'action_ref':'ACTION6','data':point_for(m,chosen)}];expected=[None];why=cfg['selection']
        else:
            mode='edit';why=cfg['transport'];goal=targets[selected['id']];controls={k:v for k,v in self.packing_controls.items()if k in o['available_action_refs']}
            start=(tuple(selected['anchor']),tuple(map(tuple,selected['mask'])));wanted=(tuple(goal['anchor']),tuple(map(tuple,goal['mask'])));world=set(map(tuple,m['world']))
            queue=deque([(start,[],[])]);seen={start};found=None
            while queue and len(seen)<20000:
                (anchor,mask),word,path=queue.popleft()
                if(anchor,mask)==wanted:found=(word,path);break
                for action,effect in sorted(controls.items()):
                    a,b=anchor;shape=mask
                    if effect['kind']=='translation':a+=effect['delta'][0];b+=effect['delta'][1]
                    else:shape=tuple(_transform(mask,effect['transform']))
                    nxt=((a,b),shape)
                    if nxt in seen or not{(a+y,b+x)for y,x in shape}<=world:continue
                    seen.add(nxt);queue.append((nxt,word+[{'action_ref':action}],path+[{'anchor':[a,b],'mask':list(shape)}]))
            if found and found[0]:actions,expected=found;actions=actions[:limit];expected=expected[:limit]
            else:
                tried={e['action']for e in m['tried']if e['pose']==plain(start)}
                unknown=[a['action_ref']for a in inputs if not a.get('data')and a['action_ref']not in controls and a['action_ref']not in tried]
                if not unknown:return {'status':'unknown','block_unrelated_probe':True,'reason':'packing_control_or_preparation_missing'}
                actions=[{'action_ref':sorted(set(unknown))[0]}];expected=[None];why=cfg['control']
        plan=plain({'model':m,'chosen':chosen['id'],'mode':mode,'commands':actions,'expected':expected,'before_poses':[{'anchor':chosen['anchor'],'mask':chosen['mask']}]+expected[:-1],'epoch':o['level_epoch'],'score':o['levels_completed'],'observation_ref':o['observation_ref'],'frame_digest':identity(rows),'why':why,'calculation':{'method':'V5.preview_piece_packing._residual','assignments':len(solutions),'scope':'conditional finite geometric partition, not acquired terminal law'},'target':targets[chosen['id']]})
        ref='preview-packing:'+identity(plan);evidence=m['evidence'][-16:];facts={'current_measured_cell_inventory':True,'strict_partition_is_library_hypothesis':True,'preview_transport_provisional':True,'current_point_bound':mode=='select'}
        return {'status':'proposed','kind':'preview_packing','proposal_id':ref,'preview_packing_plan':plan,'actions':actions,'steps':[{'action':c,'expected_after':None}for c in actions],'facts':facts,'compositions':[{'id':ref,'observed':False,'open_question':why,'properties':{'roles':cfg['roles']},'relations':['contributes_to:G_official_completion']}],'question':{'reason':why,'hypothesis_refs':evidence},'route_refs':evidence,'binding':{'level_epoch':o['level_epoch'],'observation_ref':o['observation_ref']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':actions,'purpose':why,'preconditions':facts,'evidence':evidence,'outcome_guard':{'path':['value'],'contains':ref}}}
    def before(self,p,index,rows,**meta):
        if 'preview_packing_plan'not in p:return super().before(p,index,rows,**meta)
        v=p['preview_packing_plan'];ok=p['proposal_id']=='preview-packing:'+identity(v)and p['actions']==v['commands']==p['bundle_template']['actions']and(meta['epoch'],meta['score'])==(v['epoch'],v['score'])and p['actions'][index]['action_ref']in meta['available']
        if index==0:ok=ok and identity(rows)==v['frame_digest']and meta['observation_ref']==v['observation_ref']
        else:ok=ok and plain(preview_pose(rows,v['model']))==v['before_poses'][index]
        return {'admitted':ok,'reason':'current_preview_binding'if ok else'preview_binding_changed'}
    def after(self,p,index,rows,later,**meta):
        if 'preview_packing_plan'not in p:return super().after(p,index,rows,later,**meta)
        v=p['preview_packing_plan'];boundary=(meta['epoch'],meta['score'])!=(v['epoch'],v['score']);expected=v['expected'][index]
        matched=None if boundary or expected is None else plain(preview_pose(later,v['model']))==expected
        return {'matched':matched,'seal_prefix':boundary or matched is not True,'reason':'boundary'if boundary else'unknown_preview_response'if expected is None else'preview_projection'}
    def record(self,before,cmd,after,rows,later,proposal,index):
        events=super().record(before,cmd,after,rows,later,proposal,index)
        v=proposal.get('preview_packing_plan')
        if not v or before['level_epoch']!=after['level_epoch']:return events
        m=copy.deepcopy(self.packing_model)if self.packing_model and self.packing_model['epoch']==before['level_epoch']else copy.deepcopy(v['model']);controls=copy.deepcopy(self.packing_controls);p=next(p for p in m['pieces']if p['id']==v['chosen']);detail={'before':before['observation_ref'],'after':after['observation_ref'],'command':cmd,'mode':v['mode']}
        if v['mode']=='select':
            colors=[sample(later,m,(p['anchor'][0]+y,p['anchor'][1]+x))[0]for y,x in p['mask']]
            if len(set(colors))==1 and colors[0]!=p['color']:m['selected']=p['id'];m['preview_color']=colors[0];detail['selection_observed']=True
            else:detail['selection_observed']=False
        else:
            old=plain((p['anchor'],p['mask']));pose=preview_pose(later,m);detail['observed_pose']=plain(pose)
            m['tried'].append({'action':cmd['action_ref'],'pose':old})
            if pose:
                if plain(pose['mask'])==p['mask']and list(pose['anchor'])!=p['anchor']:
                    delta=[pose['anchor'][0]-p['anchor'][0],pose['anchor'][1]-p['anchor'][1]]
                    if sum(abs(x)for x in delta)==1:controls[cmd['action_ref']]={'kind':'translation','delta':delta,'evidence':[before['observation_ref'],after['observation_ref']]}
                elif list(pose['anchor'])==p['anchor']:
                    fits=[name for name in ('rotate_cw','rotate_ccw','reflect_rows','reflect_columns')if plain(_transform(tuple(map(tuple,p['mask'])),name))==plain(pose['mask'])and plain(pose['mask'])!=p['mask']]
                    if len(fits)==1:controls[cmd['action_ref']]={'kind':'transform','transform':fits[0],'evidence':[before['observation_ref'],after['observation_ref']]}
                p.update(plain(pose))
        m['evidence']+=[before['observation_ref'],after['observation_ref']]
        event=plain({'kind':'observed_preview_packing','model':m,'controls':controls,'detail':detail});self.apply_event(event);events.append(event);return events
