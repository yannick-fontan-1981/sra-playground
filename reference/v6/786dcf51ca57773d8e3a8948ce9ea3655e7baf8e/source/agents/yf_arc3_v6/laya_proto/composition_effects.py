"""Measured color/transport effects and bounded conditional composition search.

Roles, hypotheses, goal priorities and stopping conditions are declared in JSON.
No level number, game palette, route or oracle is a planning input.
"""
from collections import deque
import json
from pathlib import Path
from resource_alignment import ResourcePlanner, MOVES, exact_rebind
from geometric_observer import matching_rules, rotate

EFFECTS_PATH=Path(__file__).with_name('extended_effects.drm.json')


def border_carriers(rows,scene,body,step,cells,policy):
    found={};half=step//2
    for part in scene['parts']:
        l,t,r,b=part['bbox'];w,h=r-l+1,b-t+1
        thin=part['rectangular'] and ((w==policy['measurement']['border_width'] and h==step) or (h==policy['measurement']['border_width'] and w==step))
        if not thin:continue
        mx,my=(l+r)//2,(t+b)//2
        offsets=[(-half-1,0),(half+1,0)] if w==1 else [(0,-half-1),(0,half+1)]
        options=[]
        for dx,dy in offsets:
            point=(mx+dx,my+dy)
            facts={'thin_full_cell_border':thin,'adjacent_walkable_cell':point in cells}
            if matching_rules(policy['roles'],facts):options.append((point,(0 if dx==0 else dx//abs(dx),0 if dy==0 else dy//abs(dy))))
        if len(options)==1:
            point,direction=options[0]
            end=point
            while True:
                nxt=(end[0]+direction[0]*step,end[1]+direction[1]*step)
                if nxt not in cells or nxt==tuple(scene['target']['center']):break
                end=nxt
            if end!=point:found[point]={'direction':direction,'projected_end':end,'status':'unobserved_corridor_hypothesis'}
    return found


def effect_plan(cells,start,target,step,remaining,rate,capacity,turns,value,target_value,
                rotators,resources,colors,transports,max_states,preserve=False):
    resource_points=list(resources)
    first=(tuple(start),turns,value,int(remaining),(1<<len(resource_points))-1)
    queue=deque([first]);parents={first:None};edges={};goal=None
    while queue:
        state=queue.popleft();point,residual,color,fuel,mask=state
        if point==tuple(target) and residual==0 and color==target_value:goal=state;break
        for action,(dx,dy) in MOVES.items():
            entry=(point[0]+dx*step,point[1]+dy*step)
            if entry not in cells:continue
            after_fuel=fuel-rate
            if after_fuel<=0:continue
            nxt=entry;event=None;after_mask=mask
            after_residual=(residual-rotators.get(entry,0))%4
            after_color=color
            if entry in rotators:event='rotation'
            if entry in colors:
                mapping=colors[entry]
                if color not in mapping:continue
                after_color=mapping[color];event='color'
            if entry in resources:
                bit=1<<resource_points.index(entry)
                if mask&bit:after_fuel=capacity;after_mask&=~bit;event='resource'
            if entry in transports:
                nxt=tuple(transports[entry]['destination']);event='transport'
            if preserve and (after_residual!=0 or after_color!=target_value):continue
            if nxt==tuple(target) and (after_residual!=0 or after_color!=target_value):continue
            new=(nxt,after_residual,after_color,after_fuel,after_mask)
            if new in parents:continue
            parents[new]=state
            edges[new]={'action':action,'entry':list(entry),'point':list(nxt),'event':event,
                'remaining':after_fuel,'residual':after_residual,'value':after_color,'available':after_mask}
            queue.append(new)
            if len(parents)>max_states:return {'complete':False,'reason':'product_domain_bound','visited':len(parents)}
    if goal is None:return {'complete':True,'path':None,'visited':len(parents)}
    path=[];cursor=goal
    while parents[cursor] is not None:path.append(edges[cursor]);cursor=parents[cursor]
    return {'complete':True,'path':list(reversed(path)),'visited':len(parents)}


class CompositionEffectsPlanner(ResourcePlanner):
    def __init__(self,policy):
        super().__init__(policy)
        self.effects_policy=json.loads(EFFECTS_PATH.read_text())
        self.advanced=False;self.colors={};self.transports={};self.effect_observations=[]

    def start_level(self,level,rows,scene,body=None):
        result=super().start_level(level,rows,scene,body)
        self.advanced=not scene['residual']['color_equal'];self.colors={};self.transports={}
        return result

    def motion(self,before,after,body,action,chosen,index,step):
        """Transport responses are only admitted at the sealed effect boundary."""
        rebound=exact_rebind(after.frame_rows,self.body_signature)
        delta=[rebound['center'][i]-body['center'][i] for i in (0,1)]
        rebound['translation']=delta
        expected=[v*step for v in MOVES[action]]
        if delta==expected:return rebound,None
        event=chosen.get('effect_event')
        if event=='transport' and index==len(chosen['actions'])-1:
            return rebound,None
        return rebound,'motion_divergence'

    def observe(self,packet,scene_before,scene_after,body,chosen,rotation):
        result=super().observe(packet,scene_before,scene_after,body,chosen,rotation)
        if not self.advanced or scene_after is None:return result
        event=chosen.get('effect_event');point=chosen.get('effect_point')
        if event=='color':
            old,new=scene_before['display']['color'],scene_after['display']['color']
            if old==new:raise ValueError('Value-change hypothesis refuted: observed value unchanged')
            if rotate(scene_before['display']['mask'],0)!=scene_after['display']['mask']:
                raise ValueError('Value-only hypothesis refuted: geometry also changed')
            self.colors.setdefault(tuple(point),{})[old]=new
            self.effect_observations.append({'effect':'color','point':point,'before_value':old,'after_value':new,
                'geometry_preserved':True,'scope':'observed entry and input value','evidence':[packet[0].frame_hash,packet[-1].frame_hash]})
        if event=='transport':
            destination=exact_rebind(packet[-1].frame_rows,self.body_signature)['center']
            trajectory=[]
            for frame in packet[-1].frame_packet or ():
                try:position=exact_rebind(frame,self.body_signature)['center']
                except ValueError:continue
                if not trajectory or trajectory[-1]!=position:trajectory.append(position)
            if tuple(destination)==tuple(point):raise ValueError('Transport hypothesis refuted: no forced displacement')
            observation={'effect':'transport','point':point,'destination':destination,
                'trajectory':trajectory,'official_response_frames':len(packet[-1].frame_packet or ()),
                'one_command':True,'status':'observed_stable_response','scope':'current level and observed entry context',
                'evidence':[packet[-2].frame_hash,packet[-1].frame_hash]}
            self.transports[tuple(point)]=observation;self.effect_observations.append(observation)
        result['composition_effects']=self.effect_observations
        return result

    def portfolio(self,rows,scene,body,step,revision,mechanisms):
        if not self.advanced:return super().portfolio(rows,scene,body,step,revision,mechanisms)
        cells,paths,indicator,rotators,resources=self.refresh_domain(rows,scene,body,step)
        if not indicator:raise ValueError('Capacity observation unavailable')
        colors={}
        for point,instance in self.instances.items():
            values={v for x,y,v in instance['signature']['pixels']}
            facts={'compact_multivalue_carrier':len(values)>=self.effects_policy['measurement']['minimum_carrier_values'],
                   'contains_target_value':scene['target']['color'] in values}
            if matching_rules(self.effects_policy['roles'],facts):
                # Preserve only mappings observed for their actual input value.
                colors[point]=self.colors.get(point,{scene['display']['color']:scene['target']['color']})
        transports={p:{**r,'destination':r['projected_end']} for p,r in border_carriers(rows,scene,body,step,cells,self.effects_policy).items()}
        transports.update(self.transports)
        candidates=[]
        cost_unknown=self.cost is None
        for turns in scene['residual']['orientation_turns']:
            result=effect_plan(cells,body['center'],scene['target']['center'],step,
                10000 if cost_unknown else indicator['amount'],1 if cost_unknown else self.cost,
                10000 if cost_unknown else self.capacity,turns,scene['display']['color'],scene['target']['color'],
                rotators,resources,colors,transports,self.extension['planning_semantics']['max_product_states'],scene['aligned'])
            if not result['complete']:raise ValueError('Extended product domain incomplete')
            if result.get('path'):candidates.append(result)
        if not candidates:raise ValueError('No conditional viable composition plan for observed effects')
        result=min(candidates,key=lambda r:len(r['path']));self.last_plan=result
        prefix=[]
        cap=self.extension['measurement_contract']['cost_calibration_actions'] if cost_unknown else self.base['execution']['max_bundle_actions']
        for edge in result['path']:
            prefix.append(edge)
            if edge['event'] or len(prefix)>=cap:break
        event=prefix[-1]['event'];point=prefix[-1]['entry']
        contribution=event or ('terminal' if scene['aligned'] else 'information')
        rule=self.effects_policy['contributions'][contribution]
        goals=self.base['goals']+self.extension['goals']+self.effects_policy['goals']
        comps=[{'id':g['id'],'things':['controlled_body','display','target','capacity'],
            'properties':{'definition':g['composition']},'relations':[g.get('parent','root')],
            'context':'current observed level','knowledge_status':'hypothesis','role':'objective'} for g in goals]
        ref='C_effect_'+str(revision)
        comps.append({'id':ref,'things':['controlled_body','carrier'],'properties':{'purpose':rule['purpose']},
            'relations':['contributes to '+rule['goal']],'context':'current observed level','knowledge_status':'hypothesis',
            'role':'intermediate','observed':False,'open_question':'predicted effect and viable continuation'})
        preserve=['G_alignment'] if scene['aligned'] else []
        proposal={'id':'P0','operation_key':rule['operation'],'composition_ref':ref,'objective_ref':rule['goal'],
            'preserve_refs':preserve,'observation_revision':revision,'kind':'probe' if rule['operation']=='OP18' else 'realize',
            'actions':[e['action'] for e in prefix],'purpose':rule['purpose'],
            'preconditions':{'source_rule_applicable':True},'preservation_evidence':{p:'product search retains value and orientation' for p in preserve},
            'evidence':['declared-composition-effects','current-observation-and-scoped-mechanisms'],
            'planning_proof':{'complete_conditional_length':len(result['path']),'visited_states':result['visited'],
                'prefix_prediction':prefix,'measured_cost':self.cost,'hypotheses':self.effects_policy['planning']},
            'recipe':'contact_candidate' if event=='rotation' else 'composition_effects',
            'contact':{'point':point} if event=='rotation' else None,'resource_point':point if event=='resource' else None,
            'effect_event':event,'effect_point':point,'stop_on':['official_level_boundary','unplanned_motion','effect_refutation']}
        return comps,{'P0':proposal},[rule]
