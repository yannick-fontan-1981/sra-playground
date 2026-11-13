"""Finite observation fitting under caller-declared layered passage hypotheses.

This module returns every compatible parameterization. It selects no goal,
model, port, route, input, or lifecycle interpretation for the caller.
"""
from collections import Counter
from functools import lru_cache
from itertools import product

from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest, immutable_json_data
from .contracts import ComponentExtractionInput
from .components import detect_components
from .cell_face_geometry import measure_cell_faces
from .mechanical_family_contracts_a import MechanicalFamilyScope
from .rewritable_endpoint_transport import (
    EndpointCell, EndpointLayer, Endpoint, EndpointPair, EndpointState,
    EndpointInput, EndpointModel, OrientedPassageRequest, _step,
    measure_endpoint_transport,
)


def annotate_observed_passage(value, agenda):
    facts = {'passage_actual_source_return':False}
    if value.retained_grid_geometry and value.retained_physical_transition_receipt:
        facts['incoming_declared_route_engagement_present'] = value.incoming_declared_route_engagement_present
        facts['observed_passage_parameter_input'] = immutable_json_data({
            'geometry':value.retained_grid_geometry, 'frame':value.current_observed_frame or value.frame,
            'records':value.sparse_raster_transitions,
            'receipt':value.retained_physical_transition_receipt,
            'interface_deltas':value.interface_action_translation_deltas,
            'epoch':value.current_context_epoch,'level_index':value.observed_level_index,
            'frame_ref':value.current_observation_frame_ref})
    shared=FrozenMap(facts)
    return agenda.model_copy(update={
        'context_facts':FrozenMap.overlay(shared,agenda.context_facts),
        'alternative_facts':FrozenMap({k:FrozenMap.overlay(shared,f) for k,f in sorted(agenda.alternative_facts.items())}),
        'descriptive_delta_facts':FrozenMap({k:FrozenMap.overlay(shared,f) for k,f in sorted(agenda.descriptive_delta_facts.items())})})


@lru_cache(maxsize=64)
def _components(frame):
    return detect_components(ComponentExtractionInput(frame=frame,connectivity=4)).components


def _inset(frame, geometry, shape, value=None):
    oy,ox,h,w,py,px,nr,nc=geometry
    found=[]
    for c in _components(frame):
        b=c.bbox
        if (b.height,b.width,c.area)!=shape or (value is not None and c.value!=value):
            continue
        r,col=(b.top-oy)//py,(b.left-ox)//px
        if (0<=r<nr and 0<=col<nc and oy+r*py<b.top<=b.bottom<oy+r*py+h-1
                and ox+col*px<b.left<=b.right<ox+col*px+w-1):
            found.append((c,(r,col)))
    return tuple(found)


def _cell(frame,geometry,point):
    oy,ox,h,w,py,px,_,_=geometry;r,c=point
    return tuple(tuple(frame.rows[y][ox+c*px:ox+c*px+w]) for y in range(oy+r*py,oy+r*py+h))


def _rotate(pattern):
    return tuple(tuple(row) for row in zip(*pattern[::-1]))


def _rotate_vector(vector):
    r,c=vector;return c,-r


def _stripe(pattern, masked):
    rows=[]
    for row in pattern:
        values={v for v in row if v not in masked}
        if len(values)!=1:break
        rows.append(next(iter(values)))
    if len(rows)==len(pattern) and len(set(rows))>1:
        return tuple(tuple(v for _ in row) for v,row in zip(rows,pattern)),(1,0)
    transposed=tuple(tuple(row) for row in zip(*pattern))
    cols=[]
    for col in transposed:
        values={v for v in col if v not in masked}
        if len(values)!=1:break
        cols.append(next(iter(values)))
    if len(cols)==len(transposed) and len(set(cols))>1:
        return tuple(tuple(cols) for _ in pattern),(0,1)
    return None


def _indicator_positions(frames,geometry,shape):
    oy,ox,h,w,py,px,nr,nc=geometry
    bottom,right=oy+(nr-1)*py+h-1,ox+(nc-1)*px+w-1
    def candidates(frame):
        result={}
        for c in _components(frame):
            b=c.bbox
            if (max(shape[:2])<=min(b.height,b.width)<=2*max(py,px)
                    and max(b.height,b.width)<=max(nr*py,nc*px)
                    and c.area==b.height*b.width
                    and (b.top>bottom or b.left>right or b.bottom<oy or b.right<ox)):
                result.setdefault((c.value,b.height,b.width),[]).append((b.top,b.left))
        return result
    all_rows=tuple(candidates(frame) for frame in frames)
    return tuple((key,tuple(rows[key][0] for rows in all_rows))
        for key in sorted(all_rows[0]) if all(len(rows.get(key,()))==1 for rows in all_rows))


def _resource_domain(frames,geometry,actor_value,maximum,lag):
    oy,ox,h,w,py,px,nr,nc=geometry;bottom=oy+(nr-1)*py+h
    runs=[]
    for y in range(bottom,frames[0].height):
        x=0
        while x<frames[0].width:
            if frames[0].rows[y][x]!=actor_value:x+=1;continue
            start=x
            while x<frames[0].width and frames[0].rows[y][x]==actor_value:x+=1
            if 2*(x-start)>=nc*px:runs.append((y,start,x-start))
    if len(runs)!=1:return ()
    y,left,width=runs[0];observed=[]
    for frame in frames:
        length=0
        while length<width and frame.rows[y][left+length]==actor_value:length+=1
        observed.append(length)
    return tuple(total for total in range(len(frames),maximum+1)
        if all(any((width*(total-debit)+total-1)//total==n
            for debit in range(max(0,i-lag),i+1)) for i,n in enumerate(observed)))


def measure_current_passage_successors(request, input_refs):
    """Measure one input against the unchanged terminal model, not a route target.

    These conditional model outcomes neither select an input nor grant an action.
    The caller must bind the request to its current Source frame before use.
    """
    rows = {}
    for input_ref in sorted(set(input_refs)):
        scope = request.scope.model_copy(update={
            'request_ref': 'request:observed-passage-successor:' + stable_digest(
                (request.scope, request.state, request.models, input_ref))[:24],
        })
        step_request = request.model_copy(update={
            'scope': scope, 'operation_ref': 'mechanics.oriented_passage.successor',
            'mode': 'STEP', 'input_ref': input_ref,
        })
        result = measure_endpoint_transport(step_request)
        after = result.values.get('after_state')
        rows[input_ref] = {
            'current_source_single_input_terminal_request_ref': scope.request_ref,
            'current_source_single_input_terminal_state_digest': stable_digest(request.state),
            'current_source_single_input_terminal_model_ref': request.bound_model_ref,
            'current_source_single_input_terminal_status': after.get('status') if after else None,
            'current_source_single_input_terminal_calculation_complete': bool(
                result.signature_supported and after is not None
                and result.values.get('external_command_count') == 1
                and not result.computation_bound_reached
                and not result.prerequisite_refs and not result.implementation_debt_refs),
        }
    return immutable_json_data(rows)


def passage_request(model,state,context,config,operation,*,target=None):
    if target:
        model=model.model_copy(update={'model_ref':model.model_ref+':target:'+stable_digest(target)[:12],
            'goal_layer_ref':target['goal_layer_ref'],
            'goal_point':tuple(target['goal_point']),'goal_phases':tuple(target['goal_phases'])})
    scope=MechanicalFamilyScope(request_ref='request:observed-passage:'+stable_digest((
        context['timeline'],context['frame_ref'],model,state,operation,target))[:24],
        caller_ref=context['caller'],parent_goal_ref=config['parent_goal_ref'],
        parent_contribution_ref=config['parent_contribution_ref'],epoch=context['epoch'],
        evidence_revision_ref=context['frame_ref'],model_revision_ref=model.model_ref,
        model_status_ref='SUPPOSITION',event_owner_ref=context['caller'],input_domain_complete=False,
        assumption_refs=tuple(config['assumption_refs']),retained_alternative_refs=tuple(context['model_refs']))
    return OrientedPassageRequest(scope=scope,operation_ref=operation,mode='DOMAIN',state=state,
        models=(model,),bound_model_ref=model.model_ref,maximum_states=config['maximum_states'],
        maximum_depth=config['maximum_depth'],maximum_evaluations=config['maximum_evaluations'],
        source_endpoint_ref=target.get('source_endpoint_ref') if target else None)


def fit_observed_passage(frames,records,packet,config,context):
    empty={'models':(),'facts':{'passage_role_supported':False}}
    if config['role_binding']!='translated_inset_marker_banded_ports_and_exterior_indicator':return empty
    geometry=tuple(packet['geometry']);oy,ox,h,w,py,px,nr,nc=geometry
    if (not 0<nr*nc<=config['maximum_cells'] or len(frames)!=len(records)+1
            or any(f.height*f.width>4096 for f in frames)
            or oy+(nr-1)*py+h>frames[-1].height or ox+(nc-1)*px+w>frames[-1].width):return empty
    native={ref:(dr,dc) for ref,dr,dc in packet['interface_deltas']}
    candidates=set()
    for t in records:
        for value,_,_,bh,bw,dr,dc,area in t.small_component_translations:
            if (1<bh<h and 1<bw<w and area==bh*bw
                    and (dr,dc)==tuple(a*b for a,b in zip(native.get(t.action_ref,(0,0)),(py,px)))):
                candidates.add((value,bh,bw,area))
    outputs=[];supported=False
    for actor_value,bh,bw,area in sorted(candidates):
        shape=(bh,bw,area);poses=tuple(_inset(f,geometry,shape,actor_value) for f in frames)
        if any(len(p)!=1 for p in poses):continue
        poses=tuple(p[0][1] for p in poses)
        support_values={v for row in _cell(frames[0],geometry,poses[0]) for v in row if v!=actor_value}
        if len(support_values)!=1:continue
        floor=next(iter(support_values))
        goals=tuple((c.value,p) for c,p in _inset(frames[0],geometry,shape) if c.value!=actor_value)
        if len(goals)!=1:continue
        goal_value,goal_point=goals[0];masked={actor_value,goal_value}
        resources=_resource_domain(frames,geometry,actor_value,config['maximum_resource_calibration'],config['meter_transaction_lag_bound'])
        if not resources:continue
        for indicator,positions in _indicator_positions(frames,geometry,shape):
            wall_values=set()
            for i,t in enumerate(records):
                if positions[i]!=positions[i+1] or poses[i]!=poses[i+1] or t.action_ref not in native:continue
                dr,dc=native[t.action_ref];p=poses[i][0]+dr,poses[i][1]+dc
                if 0<=p[0]<nr and 0<=p[1]<nc:
                    values={v for row in _cell(frames[i],geometry,p) for v in row}
                    if len(values)==1 and floor not in values:wall_values.update(values)
            if (not wall_values and config.get('unobserved_terrain_binding')
                    != 'PRESERVE_UNKNOWN_WITHOUT_CONTACT'):
                continue
            # A caller-declared partial domain need not invent a barrier
            # observation. Unclassified cells remain UNKNOWN below; the
            # existing successor still refuses their footprint as a debt.
            # Every retained transition must still fit the same model.
            layers={};layer_refs=[];families=[];valid=True
            for frame,position in zip(frames,positions):
                ref='measurement:observed-layer:'+stable_digest((indicator,position))[:20];layer_refs.append(ref)
                cells=[];ports=[]
                for r in range(nr):
                    for col in range(nc):
                        point=(r,col);raw=_cell(frame,geometry,point);values={v for row in raw for v in row if v not in masked}
                        stripe=_stripe(raw,masked)
                        face_contract=config.get('cell_face_measurement_contract',{})
                        if stripe and face_contract.get('require_distinct_triangular_face_patterns'):
                            face_measurement=measure_cell_faces(stripe[0],face_contract)
                            if not face_measurement['complete'] or not face_measurement['different_pairs']:
                                stripe=None
                        if stripe:
                            pattern,axis=stripe;matches=[]
                            for index,(base,base_axis) in enumerate(families):
                                transformed=base;vector=base_axis
                                for _ in range(4):
                                    if transformed==pattern:matches.append((index,vector))
                                    transformed=_rotate(transformed);vector=_rotate_vector(vector)
                            if not matches:families.append((pattern,axis));matches=[(len(families)-1,axis)]
                            if len(set(matches))!=1:valid=False;break
                            ports.append((point,*matches[0]));terrain='FLOOR'
                        elif values=={floor}:terrain='FLOOR'
                        elif len(values)==1 and next(iter(values)) in wall_values:terrain='WALL'
                        else:terrain='UNKNOWN'
                        cells.append(EndpointCell(point=point,terrain=terrain))
                    if not valid:break
                description=(tuple(cells),tuple(ports))
                if not valid or (ref in layers and layers[ref]!=description):valid=False;break
                layers[ref]=description
            if not valid or not families or len(families)>config['maximum_families']:continue
            if len(layers[layer_refs[0]][1])<config['minimum_repeated_ports']:continue
            supported=True
            # Compare the actually observed ends of cross-layer transactions.
            # DRM declares whether their family relation may be lifted to other
            # coindexed ports, including the still-revisable inverse hypothesis.
            family_relations=set()
            if config['pair_signature_relation']=='observed_cross_layer_family_correspondence_and_inverse_hypothesis':
                for i,transition in enumerate(records):
                    if layer_refs[i]==layer_refs[i+1]:continue
                    delta=native.get(transition.action_ref)
                    if delta is None:continue
                    source_point=tuple(a+b for a,b in zip(poses[i],delta))
                    sources=tuple(index for point,index,_ in layers[layer_refs[i]][1] if point==source_point)
                    destinations=tuple(index for point,index,_ in layers[layer_refs[i+1]][1] if point==poses[i+1])
                    if len(sources)==len(destinations)==1:
                        family_relations.update(((sources[0],destinations[0]),(destinations[0],sources[0])))
            family_signatures=tuple('measurement:band-family:'+stable_digest(base)[:20] for base,_ in families)
            signature_relations={(family_signatures[a],family_signatures[b]) for a,b in family_relations}
            for polarities in product((-1,1),repeat=len(families)):
                for landing_control in config['landing_control_hypotheses']:
                    token=stable_digest((indicator,actor_value,goal_value,polarities,landing_control))[:20]
                    endpoints=[]
                    for ref,(cells,ports) in sorted(layers.items()):
                        for point,index,axis in ports:
                            endpoints.append(Endpoint(endpoint_ref='measurement:port:'+stable_digest((ref,point))[:20],
                                signature_ref='measurement:band-family:'+stable_digest(families[index][0])[:20],
                                layer_ref=ref,point=point,outward_face=tuple(polarities[index]*x for x in axis)))
                    pairs=[];ambiguous=False
                    for source in endpoints:
                        matches=tuple(e for e in endpoints if e.layer_ref!=source.layer_ref and e.point==source.point
                            and (source.signature_ref,e.signature_ref) in signature_relations
                            and e.outward_face==tuple(-x for x in source.outward_face))
                        if len(matches)>1:ambiguous=True;break
                        if matches:pairs.append(EndpointPair(source_ref=source.endpoint_ref,destination_ref=matches[0].endpoint_ref))
                    if ambiguous:continue
                    model=EndpointModel(model_ref='measurement:passage-model:'+token,endpoints=tuple(endpoints),
                        commands=tuple(EndpointInput(input_ref=ref,action_ref=ref,payload=FrozenMap(),kind='MOVE',
                            delta=delta,cost=config['primitive_cost']) for ref,delta in sorted(native.items())),
                        footprint=((0,0),),rewrites=(),patches=(),phases=tuple(config['phase_order']),
                        landing_control=landing_control,goal_layer_ref=layer_refs[0],goal_point=goal_point,
                        **dict(config['navigation_law']))
                    state=EndpointState(layer_ref=layer_refs[0],point=poses[0],phase='FLOOR',landed_endpoint_ref=None,
                        layers=tuple(EndpointLayer(layer_ref=ref,cells=cells,observed=True,
                            geometry_revision_ref='measurement:layer-grid:'+stable_digest(cells)[:20]) for ref,(cells,_) in sorted(layers.items())),
                        pairs=tuple(pairs),graph_mode_ref='measurement:current-observed-pairing',graph_revision=0,
                        acquired_visit_refs=(),remaining_resource=min(resources),input_tick=0,
                        episode_ref=context['timeline'],level_scope_ref='measurement:passage-scope:'+str(context['epoch']),
                        restore_epoch=context['epoch'],status='ACTIVE')
                    request=passage_request(model,state,{**context,'model_refs':()},config,config['domain_operation'])
                    for i,t in enumerate(records):
                        command=next((c for c in model.commands if c.action_ref==t.action_ref),None)
                        if command is None:break
                        after,_,debt,_,_=_step(request,state,model,command)
                        if debt or after.layer_ref!=layer_refs[i+1] or after.point!=poses[i+1]:break
                        state=after
                    else:
                        approaches=tuple(abs(state.point[0]-e.point[0]-e.outward_face[0])+abs(state.point[1]-e.point[1]-e.outward_face[1])
                            for e in endpoints if e.layer_ref==state.layer_ref
                            and any(c.point==(e.point[0]+e.outward_face[0],e.point[1]+e.outward_face[1]) and c.terrain=='FLOOR' for c in layers[e.layer_ref][0]))
                        if approaches:outputs.append((model,state,{'passage_model_present':True,
                            'passage_approach_distance_lower_bound':min(approaches),
                            'passage_landing_control':landing_control}))
                        if len(outputs)>=config['maximum_models']:return {'models':(),'facts':{'passage_role_supported':True,'passage_model_bound_reached':True}}
    return {'models':tuple(outputs),'facts':{'passage_role_supported':supported,
        'passage_model_count':len(outputs),'passage_observed_transaction_count':len(records)}}
