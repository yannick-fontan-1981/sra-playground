"""Exact observations and finite product-graph search for declared composition goals."""
import copy
import json
from pathlib import Path
from collections import deque
from geometric_observer import components, grid_paths, matching_rules
from alignment_runtime import candidate_contacts, create_portfolio, AlignmentEngine
from memory import pack

EXTENSION_PATH=Path(__file__).with_name('resource_goals.drm.json')
MOVES={'ACTION1':(0,-1),'ACTION2':(0,1),'ACTION3':(-1,0),'ACTION4':(1,0)}


def patch_signature(rows,box,background=None):
    l,t,r,b=box
    return {'width':r-l+1,'height':b-t+1,
            'pixels':[[x-l,y-t,rows[y][x]] for y in range(t,b+1) for x in range(l,r+1)
                      if background is None or rows[y][x]!=background]}


def exact_rebind(rows,signature):
    found=[];w,h=signature['width'],signature['height']
    for y in range(len(rows)-h+1):
        for x in range(len(rows[0])-w+1):
            if all(rows[y+dy][x+dx]==v for dx,dy,v in signature['pixels']):
                found.append({'bbox':[x,y,x+w-1,y+h-1],'center':[x+w//2,y+h//2]})
    if len(found)!=1: raise ValueError('Visual role rebinding is ambiguous: '+str(len(found)))
    return found[0]


def ring_hole(signature):
    occupied={(x,y) for x,y,v in signature['pixels']}
    if not occupied:return False
    l,t,r,b=min(x for x,y in occupied),min(y for x,y in occupied),max(x for x,y in occupied),max(y for x,y in occupied)
    empty={(x,y) for y in range(t,b+1) for x in range(l,r+1) if (x,y) not in occupied}
    open_cells={p for p in empty if p[0] in (l,r) or p[1] in (t,b)}
    todo=list(open_cells)
    while todo:
        x,y=todo.pop()
        for q in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
            if q in empty and q not in open_cells:open_cells.add(q);todo.append(q)
    return bool(empty-open_cells)


def finite_plan(cells,start,target,step,remaining,rate,capacity,turns,rotators,resources,max_states,preserve_alignment=False):
    """All semantic effect assignments are supplied; equal future states merge."""
    resource_points=list(resources)
    start_state=(tuple(start),turns,int(remaining),(1<<len(resource_points))-1)
    queue=deque([start_state]);parents={start_state:None};edge={}
    goal=None
    while queue:
        state=queue.popleft();point,residual,fuel,available=state
        if point==tuple(target) and residual==0:goal=state;break
        for action,(dx,dy) in MOVES.items():
            nxt=(point[0]+dx*step,point[1]+dy*step)
            if nxt not in cells:continue
            after_fuel=fuel-rate
            if after_fuel<=0:continue
            after_residual=(residual-rotators.get(nxt,0))%4
            if preserve_alignment and after_residual!=0:continue
            if nxt==tuple(target) and after_residual!=0:continue
            after_mask=available;event=None
            if nxt in rotators:event='rotation'
            if nxt in resources:
                bit=1<<resource_points.index(nxt)
                if available&bit:
                    after_fuel=capacity;after_mask&=~bit;event='resource'
            new=(nxt,after_residual,after_fuel,after_mask)
            if new in parents:continue
            parents[new]=state;edge[new]={'action':action,'point':list(nxt),'event':event,
                'remaining':after_fuel,'residual':after_residual,'available':after_mask}
            queue.append(new)
            if len(parents)>max_states:return {'complete':False,'reason':'product_domain_bound','visited':len(parents)}
    if goal is None:return {'complete':True,'path':None,'visited':len(parents)}
    path=[];cursor=goal
    while parents[cursor] is not None:path.append(edge[cursor]);cursor=parents[cursor]
    return {'complete':True,'path':list(reversed(path)),'visited':len(parents),'goal_state':serial_state(goal)}


def serial_state(state):
    p,r,f,m=state
    return {'position':list(p),'orientation_residual':r,'remaining_capacity':f,'available_carriers':m}


class ResourcePlanner:
    def __init__(self,policy):
        self.base=policy;self.extension=json.loads(EXTENSION_PATH.read_text())
        self.body_signature=None;self.effect_templates=[];self.level=None;self.indicator=None
        self.capacity=None;self.cost=None;self.cost_evidence=[];self.instances={};self.spent=set();self.last_plan=None

    def start_level(self,level,rows,scene,body=None):
        self.level=level;self.cost=None;self.cost_evidence=[];self.instances={};self.spent=set();self.indicator=None
        self.capacity=None
        indicator=self.measure_indicator(rows,scene)
        if indicator:self.capacity=indicator['amount']
        return exact_rebind(rows,self.body_signature) if self.body_signature else body

    def measure_indicator(self,rows,scene):
        if self.indicator is None:
            contract=self.extension['measurement_contract'];box=scene['substrate']['bbox'];found=[]
            for p in scene['parts']:
                l,t,r,b=p['bbox'];w,h=r-l+1,b-t+1
                outside=r<box[0] or l>box[2] or b<box[1] or t>box[3]
                facts={'thin_horizontal_outside_substrate':outside and p['rectangular'] and w>=contract['minimum_initial_indicator_width'] and w>=contract['minimum_indicator_aspect']*h}
                if p['color']!=scene['substrate']['color'] and matching_rules(self.extension['roles'],facts):found.append(p)
            if len(found)!=1:return None
            self.indicator={'bbox':found[0]['bbox'],'value':found[0]['color']}
        l,t,r,b=self.indicator['bbox'];v=self.indicator['value']
        columns={x for y in range(t,b+1) for x in range(l,r+1) if rows[y][x]==v}
        return {'amount':len(columns),'value':v,'bbox':self.indicator['bbox'],'status':'observed_indicator_extent'}

    def observe(self,packet,scene_before,scene_after,body,chosen,rotation):
        same=[p for p in packet if p.level==packet[0].level]
        changes=[]
        for a,b in zip(same,same[1:]):
            before=self.measure_indicator(a.frame_rows,scene_before);after=self.measure_indicator(b.frame_rows,scene_before)
            if before and after:
                delta=before['amount']-after['amount']
                if delta>0:self.cost_evidence.append({'before':a.frame_hash,'after':b.frame_hash,'decrement':delta})
                changes.append(delta)
        if self.cost_evidence:self.cost=max(p['decrement'] for p in self.cost_evidence)
        if body and self.body_signature is None and same:
            self.body_signature=patch_signature(same[-1].frame_rows,body['bbox'])
        contact=chosen.get('contact')
        if contact and rotation:
            half=(body['bbox'][2]-body['bbox'][0])//2;x,y=contact['point']
            signature=patch_signature(packet[0].frame_rows,[x-half,y-half,x+half,y+half],scene_before['substrate']['color'])
            # Reentry starts on the obscured carrier: preserve its earlier visible signature.
            known=self.instances.get(tuple(contact['point']))
            if known:signature=known['signature']
            record={'signature':signature,'rotation':rotation[0],'observed_level':self.level,
                    'evidence':[packet[0].frame_hash,packet[-1].frame_hash],'scope':'same-game visual-analogy hypothesis outside observed context'}
            if signature['pixels'] and record not in self.effect_templates:self.effect_templates.append(record)
        if chosen.get('resource_point') is not None:
            point=tuple(chosen['resource_point'])
            gain=any(d<0 for d in changes)
            if not gain:raise ValueError('Resource hypothesis refuted: no indicator gain at committed event')
            self.spent.add(point)
            if point in self.instances:self.instances[point]['status']='gain_observed_not_assumed_reusable'
        return {'cost':self.cost,'indicator_changes':changes,'effect_templates':len(self.effect_templates),'spent':sorted(self.spent)}

    def refresh_domain(self,rows,scene,body,step):
        cells,paths=grid_paths(rows,scene,body,step)
        indicator=self.measure_indicator(rows,scene)
        contacts=candidate_contacts(rows,scene,body,step,cells,paths)
        half=step//2
        for c in contacts:
            x,y=c['point'];signature=patch_signature(rows,[x-half,y-half,x+half,y+half],scene['substrate']['color'])
            effect=next((e for e in self.effect_templates if e['signature']==signature),None)
            values={v for x,y,v in signature['pixels']}
            facts={'closed_ring':ring_hole(signature),'same_value_as_indicator':bool(indicator) and values=={indicator['value']},'same_observed_carrier_signature':effect is not None}
            roles=matching_rules(self.extension['roles'],facts)
            self.instances[tuple(c['point'])]={'point':c['point'],'signature':signature,'roles':[r['id'] for r in roles],
                'effect':effect,'path':c['path'],'status':'hypothesis','evidence':'current morphology and retained observations'}
        rotators={p:r['effect']['rotation'] for p,r in self.instances.items() if r.get('effect')}
        resources={p:r for p,r in self.instances.items() if 'resource_carrier_candidate' in r['roles'] and p not in self.spent}
        return cells,paths,indicator,rotators,resources

    def portfolio(self,rows,scene,body,step,revision,mechanisms):
        current_indicator=self.measure_indicator(rows,scene)
        rules=matching_rules(self.extension['portfolio_rules'],{'control_known':body is not None,
            'effect_known':bool(self.effect_templates),'current_cost_known':self.cost is not None})
        if len(rules)!=1:raise ValueError('Unresolved declared resource policy')
        recipe=rules[0]['recipe']
        if recipe=='base_information':
            if body:self.refresh_domain(rows,scene,body,step)
            return create_portfolio(scene,body,step,rows,self.base,revision,mechanisms)
        cells,paths,indicator,rotators,resources=self.refresh_domain(rows,scene,body,step)
        if indicator is None:raise ValueError('Resource indicator unavailable')
        if not rotators and not scene['aligned']:raise ValueError('Transferred mechanism could not be rebound')
        if recipe=='observe_current_cost':
            endpoints=[tuple(scene['target']['center'])] if scene['aligned'] else list(rotators)
            routes=[paths[p] for p in endpoints if p in paths and paths[p]]
            if not routes:raise ValueError('No contribution-directed capacity probe')
            actions=min(routes,key=len)[:self.extension['measurement_contract']['cost_calibration_actions']]
            event=None;point=None;proof={'current_cost':'unknown','purpose':'observe cost on a contributing prefix'}
        else:
            candidates=[]
            for turns in scene['residual']['orientation_turns']:
                result=finite_plan(cells,body['center'],scene['target']['center'],step,indicator['amount'],self.cost,
                    self.capacity,turns,rotators,resources,self.extension['planning_semantics']['max_product_states'],scene['aligned'])
                if not result['complete']:raise ValueError('Product domain incomplete')
                if result.get('path'):candidates.append(result)
            if not candidates:raise ValueError('No viable composition plan with measured capacity')
            result=min(candidates,key=lambda x:len(x['path']));self.last_plan=result
            prefix=[]
            for edge in result['path']:
                prefix.append(edge)
                if edge['event'] or len(prefix)>=self.base['execution']['max_bundle_actions']:break
            actions=[e['action'] for e in prefix];event=prefix[-1]['event'];point=prefix[-1]['point']
            proof={'remaining':indicator['amount'],'measured_cost':self.cost,'capacity_hypothesis':self.capacity,
                   'complete_plan_length':len(result['path']),'visited_states':result['visited'],
                   'next_event':event,'prefix_prediction':prefix,'hypotheses':'unobserved resource gains remain conditional; stop at first event'}
        if event=='resource':objective='G_capacity';op='OP18';purpose='Rejoindre une recharge candidate et mesurer le gain qui rend la continuation viable.'
        elif event=='rotation':objective='G_alignment';op='OP28';purpose="Atteindre ou réentrer sur le porteur de l'effet observé pour réduire le résidu d'orientation."
        elif scene['aligned']:objective='G_terminal';op='OP28';purpose="Rejoindre la cible en préservant l'accord symbolique et une capacité positive."
        else:objective='G_information';op='OP18';purpose='Avancer vers une contribution utile en mesurant la consommation courante.'
        goals=self.base['goals']+self.extension['goals']
        comps=[{'id':g['id'],'things':['controlled_body','display','target','capacity'],
                'properties':{'definition':g['composition']},'relations':[g.get('parent','root')],
                'context':'current observed level','knowledge_status':'hypothesis','role':'objective'} for g in goals]
        ref='C_'+recipe+'_'+str(revision)
        comps.append({'id':ref,'things':['controlled_body','carrier'],'properties':{'purpose':purpose},
                      'relations':['contributes to '+objective],'context':'current level','knowledge_status':'hypothesis',
                      'role':'intermediate','observed':False,'open_question':'expected effect and continuation'})
        preserve=['G_alignment'] if scene['aligned'] else []
        proposal={'id':'P0','operation_key':op,'composition_ref':ref,'objective_ref':objective,
            'preserve_refs':preserve,'observation_revision':revision,'kind':'probe' if op=='OP18' else 'realize',
            'actions':actions,'purpose':purpose,'preconditions':{'source_rule_applicable':True},
            'preservation_evidence':{p:'product graph preserves zero orientation residual at target; prefix excludes reactivation' for p in preserve},
            'evidence':['declared-resource-policy', 'current-measured-capacity'], 'planning_proof':proof,
            'recipe': 'contact_candidate' if event=='rotation' else recipe,
            'contact':{'point':point} if event=='rotation' else None,
            'resource_point':point if event=='resource' else None,
            'stop_on':['official_level_boundary','motion_divergence','resource_divergence']}
        return comps,{'P0':proposal},rules


class ContinuousEngine(AlignmentEngine):
    def prepare(self,request):
        result=super().prepare(request)
        level=result['state']['level_epoch']
        if result.get('level_epoch')!=level:raise ValueError('Request level binding mismatch')
        if any(b.get('level_epoch')!=level for b in result['bundles'].values()):raise ValueError('Bundle level binding mismatch')
        if level>1 and not result.get('retrospective'):
            remembered=self.memory.get(result['episode'],'goal_template')
            if remembered['value']['confirmed_level']>=level:raise ValueError('Goal template is not a preceding-level memory')
            goal=next(c for c in result['state']['compositions'] if c['id']=='G_terminal')
            if goal['properties']['definition']!=remembered['value']['pattern']:raise ValueError('Main goal was replaced across levels')
            if goal.get('goal_memory_revision')!=remembered['revision']:raise ValueError('Goal memory was not consumed')
            result['consumed_goal_memory']=remembered
        return result


def bind_retained_goal(memory,episode,compositions,scene,level):
    if level<=1:return None
    remembered=memory.get(episode,'goal_template')
    goal=next(c for c in compositions if c['id']=='G_terminal')
    goal['properties']['definition']=remembered['value']['pattern']
    goal['properties']['current_binding']={'level_epoch':level,'display':scene['display']['id'],'target':scene['target']['id']}
    goal['properties']['satisfied_in_current_level']=False
    goal['goal_memory_revision']=remembered['revision']
    return {'goal_ref':'G_terminal','memory_revision':remembered['revision'],'confirmed_level':remembered['value']['confirmed_level'],
            'rebound_level':level,'status':'same_goal_new_bindings','pattern':remembered['value']['pattern']}


def retrospect_level(bridge,memory,episode,policy,scene,packet,chosen,revision,completed_level):
    extension=json.loads(EXTENSION_PATH.read_text())
    spec=extension['level_retrospective']
    if chosen['objective_ref']!=spec['retain_goal_ref'] or 'G_alignment' not in chosen['preserve_refs']:
        raise ValueError('Level success has no bound terminal-composition explanation')
    if not scene['aligned'] or packet[-1].levels_completed<completed_level:
        raise ValueError('Expected alignment/boundary not observed')
    proof={'goal_ref':spec['retain_goal_ref'],'pattern':spec['retain_goal_pattern'],'confirmed_level':completed_level,
           'status':'confirmed_success_context','next_level_status':spec['next_level_status'],
           'evidence':[packet[0].frame_hash,packet[-1].frame_hash],
           'causal_limit':'success supports this goal pattern; universal necessity is not proved'}
    receipts=[]
    for op in spec['operations']:
        revision+=1
        comps=[{'id':g['id'],'properties':{'definition':g['composition']},'role':'objective'} for g in policy['goals']]
        update={'composition_ref':'G_terminal','property':'level_final_goal','value':proof,'revision':revision,'evidence':pack(proof['evidence'])}
        facts={'compositions':comps,'facts':{'source_rule_applicable':True},'level_epoch':completed_level,
               'observation_revision':revision,'expected_properties':{'official_boundary':True,'alignment_before_entry':True},
               'observed_properties':{'official_boundary':True,'alignment_before_entry':scene['aligned']},
               'knowledge_updates':[update],'objective_assessments':[{'composition_ref':'G_terminal','satisfied':True,'feasible':True,'new_evidence':proof['evidence']}]}
        memory.put(episode,'state',facts,evidence='level-retrospective',revision=revision)
        b={'id':'R0','operation_key':op,'composition_ref':'G_terminal','objective_ref':'G_terminal','preserve_refs':[],
           'observation_revision':revision,'level_epoch':completed_level,'kind':'analysis','actions':[],
           'purpose':'Comparer, mémoriser puis conserver le but de composition ayant conduit à la réussite officielle.',
           'preconditions':{'source_rule_applicable':True},'evidence':proof['evidence'],'preservation_evidence':{}}
        receipt=bridge.run({'episode':episode,'id':'retrospect-'+str(revision),'level_epoch':completed_level,'retrospective':True,
            'policy':'hybrid','kind':'level_retrospective','context':b['purpose'],'bundles':{'R0':b},'candidates':['R0'],
            'relevant_compositions':['G_terminal','G_alignment']})
        if receipt['decision']['status']!='composition_analysis':raise ValueError('Retrospective did not complete in SRC')
        receipts.append({'operation':op,'src_status':receipt['src_status'],'result':receipt['decision']['operation_result'],'total_ms':receipt['total_ms']})
    persisted=memory.get(episode,'knowledge:G_terminal:level_final_goal')
    if persisted['value']!=proof:raise ValueError('SRC OP30 did not persist goal conclusion')
    memory.put(episode,'goal_template',persisted['value'],evidence=persisted['evidence'],revision=persisted['revision'])
    return revision,{'completed_level':completed_level,'reused_goal_pattern':proof,'src_operations':receipts}
