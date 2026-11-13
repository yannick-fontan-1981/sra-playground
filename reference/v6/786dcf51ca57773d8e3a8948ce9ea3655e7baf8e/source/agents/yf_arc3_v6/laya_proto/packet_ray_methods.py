"""Conditional visible-support graph; reuse the existing exact ray/box kernel.

This is a geometric query, not the full optical state-machine request: no
unobserved drawing cycle, analytic disk radius or terminal law is manufactured.
"""
import math,time,copy
from collections import deque
from dataclasses import dataclass
from agents.yf_arc3_v5.capabilities.discrete_relay_optics import OpticalDirection,OpticalReceiver,OpticalRay,DiscreteOpticsRequest,_first_hit
from agents.yf_arc3_v5.capabilities.mechanical_family_contracts_d import DWorkBudget
from rooted_quota_methods import plain
from terminal_composition import identity

@dataclass(frozen=True)
class VisibleRayGeometry:
    """Only the geometry fields consumed by the existing kernel; not OpticalModel."""
    model_ref:str
    receivers:tuple
    directions:tuple
    boundary_bounds:tuple
    square_root_bits:int=32
    intersection_law_ref:str='positive_analytic_ray_intersections_before_box_exit'
    source_inside_receiver_law_ref:str|None=None
    hit_tie_law_ref:str|None=None
    receiver_tie_order:tuple=()

def circular(x):return math.atan2(math.sin(x),math.cos(x))
def ratio(x):return [round(x*1000000),1000000]
def lattice(outputs,steps):
    values=[abs(v['delta'])for v in steps.values()if v['status']=='candidate'and .02<abs(v['delta'])<math.pi]
    if not values:return None
    count=round(2*math.pi/(sum(values)/len(values)))
    if not 3<=count<=128:return None
    step=2*math.pi/count
    if any(abs(v-step)>.1 for v in values):return None
    angles=[v['angle']for v in outputs.values()if'angle'in v]
    if not angles:return None
    residues=sorted(circular(a*count)/count for a in angles);origin=residues[len(residues)//2]
    alternatives=[n for n in range(3,129)if all(abs(v-2*math.pi/n)<=.1 for v in values)]
    return {'count':count,'compatible_count_candidates':alternatives,'chosen_count_status':'experimental_fit_not_unique_law','angular_tolerance_radians':.1,'step':step,'origin':origin,'scope':'Uniform cyclic angular spacing fitted as a hypothesis to measured output differences, not a creator calibration. Compatible alternative periods retained.'}

def estimate_phase(drawing,outputs,edges,steps,grid):
    known={k:v['angle']for k,v in outputs.items()if'angle'in v};todo=deque(known)
    while todo:
        a=todo.popleft()
        for e in edges:
            if e['before']!=a or e['after']in known:continue
            law=steps.get(e['action'])
            if not law or law['status']!='candidate':continue
            known[e['after']]=circular(known[a]+math.copysign(grid['step'],law['delta']));todo.append(e['after'])
    if drawing not in known:
        # Solve the same observed additive relation for its unmeasured argument.
        # This is an algebraic hypothesis, never authority to reverse an input.
        offsets={drawing:0.0};todo=deque([drawing]);anchors=[];witnesses=[]
        while todo:
            node=todo.popleft();offset=offsets[node]
            measured=outputs.get(node)
            if measured and'angle'in measured:anchors.append(circular(measured['angle']-offset))
            for e in edges:
                law=steps.get(e['action'])
                if not law or law['status']!='candidate':continue
                delta=math.copysign(grid['step'],law['delta'])
                if e['before']==node:other=e['after'];next_offset=circular(offset+delta)
                elif e['after']==node:other=e['before'];next_offset=circular(offset-delta)
                else:continue
                if other in offsets:
                    if abs(circular(offsets[other]-next_offset))>.1:return None
                else:offsets[other]=next_offset;todo.append(other);witnesses.append(e['evidence'])
        if not anchors or any(abs(circular(a-anchors[0]))>.1 for a in anchors):return None
        return {'angle':anchors[0],'status':'conditional_inverse_of_observed_input_relation','relation_evidence':sorted(set(witnesses)),'anchor_count':len(anchors),'scope':'Algebraic inference under the same candidate increment, not an observed output or a reversible-action law. Later packet comparison required.'}
    return {'angle':known[drawing],'status':'measured'if drawing in outputs and'angle'in outputs[drawing]else'conditional_from_observed_input_edges','scope':'Predicted angular effect requires later packet comparison.'}

def relay_route(state,target,outputs,steps,obs,deadline):
    grid=lattice(outputs,steps);bindings=state['bindings'];received=state.get('received_controls',[])
    if not grid or not received:return None
    bodies={b['ref']:b for b in bindings.values()};bodies[target['ref']]=target
    source=bindings[received[0]]['ref'];box=state['scene']['frame'];angles=[grid['origin']+i*grid['step']for i in range(grid['count'])]
    context=identity([bodies,grid,source,box]);cached=state.get('geometric_route_cache')
    if cached and cached['context']==context:return {**copy.deepcopy(cached['value']),'kernel_calls_this_proposal':0,'geometry_reused':True}
    model=VisibleRayGeometry(model_ref='visible_boxes:'+identity([bodies,grid]),receivers=tuple(OpticalReceiver(body_ref=ref,kind_ref='visible_support_hypothesis',center=[ratio(x)for x in b['point']],shape_ref='axis_aligned_closed_box',box_bounds=[ratio(x)for x in b['bbox']],geometry_evidence_ref=obs['observation_ref'])for ref,b in bodies.items()),directions=tuple(OpticalDirection(direction_ref=f'd{i}',vector=[ratio(math.cos(a)),ratio(math.sin(a))],evidence_ref='conditional_angular_lattice:'+identity(grid))for i,a in enumerate(angles)),boundary_bounds=tuple(ratio(x)for x in box))
    scope={'request_ref':'visible-ray:'+identity([obs['observation_ref'],grid]),'caller_ref':'public_packet_geometry','parent_consumer_ref':'SRC_composition','parent_goal_ref':'G_official_completion','parent_contribution_ref':'experimental_relay_support_path','caller_next_item_ref':obs['observation_ref'],'epoch':obs['level_epoch'],'evidence_revision_ref':obs['observation_ref'],'model_revision_ref':model.model_ref,'model_status_ref':'conditional_ray_intersection_with_visible_boxes_only','event_owner_ref':'SRC','input_domain_complete':True,'assumption_refs':['finite_visible_support_geometry','analytical_box_intersection_is_not_game_collision_law','uniform_angular_cycle_is_empirical_candidate','distinct_marker_as_terminal_remains_hypothesis']}
    request=DiscreteOpticsRequest(scope=scope,operation_ref='mechanics.discrete_relay_optics.first_hit',mode_ref='FIRST_HIT',requested_result_type='DMechanicalResult',node_bound=100000,depth_bound=4096,domain_bound=4096,time_bound_ms=max(1,min(300000,int((deadline-time.perf_counter())*1000))))
    budget=DWorkBudget(request);arcs={ref:[]for ref in bodies};calls=0
    for ref,b in bodies.items():
        if ref==target['ref']:continue
        for i,angle in enumerate(angles):
            ray=OpticalRay(origin=[ratio(x)for x in b['point']],direction_ref=f'd{i}',excluded_source_body_ref=ref);result=_first_hit(model,ray,budget);calls+=1;hit=result.get('first_receiver_ref')
            if not result.get('complete_first_hit')or hit not in bodies:continue
            dx=bodies[hit]['point'][0]-b['point'][0];dy=bodies[hit]['point'][1]-b['point'][1]
            if abs(dx*math.sin(angle)-dy*math.cos(angle))>1:continue
            arcs[ref].append({'source':ref,'recipient':hit,'angle':circular(angle),'direction_ref':f'd{i}','geometry_result':plain(result)})
    todo=deque([(source,[])]);seen={source};route=None
    while todo:
        node,path=todo.popleft()
        if node==target['ref']:route=path;break
        for edge in arcs[node]:
            if edge['recipient']not in seen:seen.add(edge['recipient']);todo.append((edge['recipient'],path+[edge]))
    budget.finish()
    result={'route':route,'grid':grid,'kernel_calls':calls,'kernel_calls_this_proposal':calls,'geometry_reused':False,'geometric_arcs':sum(map(len,arcs.values())),'method':'discrete_relay_optics._first_hit exact internal geometry kernel','full_optical_state_machine_invoked':False,'scope':'Finite hypothetical angular rays through visible support centers. Rendering boxes are not claimed to be physical capture volumes. No drawing-cycle or reset-state premise supplied.'}if route else None
    if result:state['geometric_route_cache']={'context':context,'value':copy.deepcopy(result)}
    return result
