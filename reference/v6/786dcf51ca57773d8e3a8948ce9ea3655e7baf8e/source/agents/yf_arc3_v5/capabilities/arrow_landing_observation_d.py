"""Bounded raster adapter for a DRM-declared conditional landing relation.

Geometry, scalar moments, exact endpoint domains and a one-hot graph witness
are measurements. Meaning, priority, hypothesis admission and release are not
chosen here. No palette role or game-specific glyph template is encoded.
"""
from collections import Counter, defaultdict

from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from .endpoint_navigation_d import (
    EndpointLandingRequestD, LandingDirectionD, LandingNodeD, LandingRelationModelD,
    measure_endpoint_landing_d,
)
from .mechanical_family_contracts_d import DMechanicalScope
from .planning import _first_shortest_route_witness


def _axial_moment_mask(frame, box):
    top,left,bottom,right=box
    counts=Counter(frame.rows[r][c] for r in range(top,bottom+1) for c in range(left,right+1))
    background=counts.most_common(1)[0][0]
    pixels=tuple((r,c) for r in range(top,bottom+1) for c in range(left,right+1)
                 if frame.rows[r][c]!=background)
    if not pixels or len({frame.rows[r][c] for r,c in pixels})!=1:
        return None
    r0,c0=min(r for r,c in pixels),min(c for r,c in pixels)
    h,w=max(r for r,c in pixels)-r0+1,max(c for r,c in pixels)-c0+1
    if h!=w or h<3 or h%2==0 or h>=bottom-top or len(pixels)>=h*w//2:
        return None
    shape=frozenset((r-r0,c-c0) for r,c in pixels)
    mr=sum(2*r-(h-1) for r,c in shape)
    mc=sum(2*c-(w-1) for r,c in shape)
    vertical=shape==frozenset((r,w-1-c) for r,c in shape) and mr!=0 and mc==0
    horizontal=shape==frozenset((h-1-r,c) for r,c in shape) and mc!=0 and mr==0
    if vertical==horizontal:
        return None
    vector=((1 if mr>0 else -1),0) if vertical else (0,(1 if mc>0 else -1))
    rotations=[]
    rotated=shape
    for _ in range(4):
        rotations.append(tuple(sorted(rotated)))
        rotated=frozenset((c,h-1-r) for r,c in rotated)
    return {'shape':tuple(sorted(shape)),'family':min(rotations),'vector':vector,
            'value':frame.rows[pixels[0][0]][pixels[0][1]],'background':background}


def _fields(frame, components, contract):
    sizes=defaultdict(list)
    for c in components:
        b=c.bbox
        if b.width==b.height and 7<=b.width<=contract['maximum_core_size'] and c.area>b.width*b.height//2:
            sizes[b.width].append(c)
    fields=[]
    for size, group in sorted(sizes.items()):
        if len(group)<4:
            continue
        rs=tuple(sorted({c.bbox.top for c in group}))
        cs=tuple(sorted({c.bbox.left for c in group}))
        if len(rs)<2 or len(cs)<2 or len(rs)*len(cs)>contract['maximum_cells']:
            continue
        if len({b-a for a,b in zip(rs,rs[1:])})!=1 or len({b-a for a,b in zip(cs,cs[1:])})!=1:
            continue
        py,px=rs[1]-rs[0],cs[1]-cs[0]
        if py<size or px<size or max(py-size,px-size)>contract['maximum_gap']:
            continue
        boxes=tuple((r,c,r+size-1,c+size-1) for r in rs for c in cs)
        if any(b>=frame.height or d>=frame.width for a,c,b,d in boxes):
            continue
        masks=tuple(_axial_moment_mask(frame,b) for b in boxes)
        missing=tuple(i for i,m in enumerate(masks) if m is None)
        arrows=tuple(m for m in masks if m is not None)
        if len(missing)!=1 or len(arrows)<4 or len({m['family'] for m in arrows})!=1:
            continue
        target=missing[0]
        tb=boxes[target]
        # The non-axial endpoint must have an actually observed square ring.
        if not any((c.bbox.top,c.bbox.left,c.bbox.bottom,c.bbox.right)==tb
                   and c.area==4*(size-1) for c in components):
            continue
        outlines=[]
        for i,(t,l,b,r) in enumerate(boxes):
            for c in components:
                q=c.bbox
                if ((q.top,q.left,q.bottom,q.right)==(t-1,l-1,b+1,r+1)
                        and c.area==2*(q.width+q.height)-4):
                    outlines.append((i,c.component_id))
        if len(outlines)!=1 or masks[outlines[0][0]] is None:
            continue
        fields.append({'boxes':boxes,'masks':masks,'source':outlines[0][0],
                       'component_ref':outlines[0][1],'target':target,'cols':len(cs),
                       'rows':len(rs),'pitch':(py,px)})
    return fields


def _gauge(components, board_top, maximum):
    groups=defaultdict(list)
    for c in components:
        b=c.bbox
        if b.bottom<board_top and b.width==b.height and 1<b.width<=3 and c.area==b.width*b.height:
            groups[(b.top,b.width)].append(c)
    rows=[]
    for key in sorted(groups):
        group=groups[key]
        row=tuple(sorted(group,key=lambda c:c.bbox.left))
        if 3<=len(row)<=maximum and len({b.bbox.left-a.bbox.left for a,b in zip(row,row[1:])})==1:
            rows.append(row)
    return rows[0] if len(rows)==1 else ()


def measure_arrow_landing_loci(v, frame, components, contract):
    if (not contract or frame.width*frame.height>contract['maximum_frame_pixels']
            or len(components)>contract['maximum_components'] or not v.current_observation_frame_ref):
        return ()
    fields=_fields(frame,components,contract)
    if len(fields)!=1:
        return ()
    g=fields[0]
    boxes,masks=g['boxes'],g['masks']
    centers=tuple(((t+b)//2,(l+r)//2) for t,l,b,r in boxes)
    token=stable_digest((boxes,tuple(m['shape'] if m else None for m in masks)))
    carried=v.canonical_dispatched_goal_continuity_facts.get('dispatched_composition_target_context') or {}
    prior_epoch=carried.get('arrow_landing_context_epoch')
    if (type(prior_epoch) is int and type(v.current_context_epoch) is int
            and prior_epoch!=v.current_context_epoch):
        # An explicitly different scope has no local geometry to revalidate.
        # Same-scope contradictions and missing scope evidence still fail below.
        carried={}
    prior=carried.get('arrow_landing_geometry_token')==token
    matches=None
    if carried.get('arrow_landing_geometry_token') and not prior:
        return ()
    if prior:
        matches=(v.previous_action_observed_frame is not None
            and carried.get('arrow_landing_context_epoch')==v.current_context_epoch
            and carried.get('arrow_landing_source_frame_digest')==stable_digest(v.previous_action_observed_frame.rows)
            and carried.get('arrow_landing_expected_source_index')==g['source'])
        if not matches:
            return ()
    gauge=_gauge(components,min(b[0] for b in boxes),contract['maximum_gauge_segments'])
    gauge_signature=tuple((c.bbox.top,c.bbox.left,c.bbox.bottom,c.bbox.right) for c in gauge)
    active_value=carried.get('arrow_landing_gauge_active_value') if prior else None
    if not prior and gauge and len({c.value for c in gauge})==1:
        active_value=gauge[0].value
    reserve=sum(c.value==active_value for c in gauge) if gauge and active_value is not None else None
    if prior and (gauge_signature!=tuple(tuple(b) for b in carried.get('arrow_landing_gauge_signature',()))
                  or reserve!=carried.get('arrow_landing_expected_reserve')):
        return ()
    if reserve is None or reserve<1:
        return ()
    nodes=tuple(LandingNodeD(node_ref=f'measurement.landing.node.{i}',
        point=divmod(i,g['cols']),glyph_ref=f'measurement.landing.mask.{i}' if m else None)
        for i,m in enumerate(masks))
    model=LandingRelationModelD(model_ref=contract['model_ref'],
        control_side=contract['control_side'],relation=contract['relation'],
        directions=tuple(LandingDirectionD(glyph_ref=n.glyph_ref,vector=m['vector'])
                         for n,m in zip(nodes,masks) if m),
        positive_distances=tuple(range(1,max(g['rows'],g['cols']))))
    scope=DMechanicalScope(**dict(contract['scope']),request_ref='measurement.landing.'+token,
        evidence_revision_ref=v.current_observation_frame_ref,model_revision_ref=token,
        epoch=v.current_context_epoch or 0,input_domain_complete=True)
    edges=[]
    examined=0
    for i,node in enumerate(nodes):
        result=measure_endpoint_landing_d(EndpointLandingRequestD(scope=scope,
            operation_ref=contract['operation_ref'],mode_ref='DOMAIN',phase_ref='ENDPOINT_RELATION',
            requested_result_type='DMechanicalResult',**dict(contract['bounds']),
            nodes=nodes,models=(model,),graph_revision_ref=token,source_node_ref=node.node_ref,
            command_cost=contract['conditional_command_cost'],remaining_resource=reserve))
        if not result.domain_complete:
            return ()
        examined+=result.examined_count
        for row in result.values['model_correlated_results'][0]['endpoint_rows']:
            if row['geometric_relation_matches'] is True:
                j=next(k for k,n in enumerate(nodes) if n.node_ref==row['landing_node_ref'])
                edges.append((i,j,nodes[j].node_ref))
    if prior:
        remaining=tuple(tuple(e) for e in carried.get('arrow_landing_route',()))[1:]
        if not remaining or remaining[0][0]!=g['source'] or any(e not in edges for e in remaining):
            return ()
        route=remaining
        search_count=0
    else:
        witness=_first_shortest_route_witness(initial=tuple(int(i==g['source']) for i in range(len(nodes))),
            controls=tuple(edges),goal_test=lambda s:s[g['target']]==1,capacities=(1,)*len(nodes),
            max_expanded_states=contract['maximum_search_states'],max_depth=min(reserve,contract['maximum_search_depth']),
            control_order_variant=contract['control_order'])
        if witness is None:
            return ()
        route=witness.route
        search_count=witness.expanded_state_count
    if not route or len(route)*contract['conditional_command_cost']>reserve or route[0][0]!=g['source']:
        return ()
    destination=route[0][1]
    measured=FrozenMap({'point':centers[destination],'component_ref':g['component_ref'],
        'arrow_landing_context_epoch':v.current_context_epoch,
        'arrow_landing_geometry_token':token,'arrow_landing_source_index':g['source'],
        'arrow_landing_expected_source_index':destination,'arrow_landing_target_index':g['target'],
        'arrow_landing_route':route,'arrow_landing_route_cost':len(route)*contract['conditional_command_cost'],
        'arrow_landing_current_reserve':reserve,'arrow_landing_expected_reserve':reserve-contract['conditional_command_cost'],
        'arrow_landing_gauge_signature':gauge_signature,'arrow_landing_gauge_active_value':active_value,
        'arrow_landing_previous_prediction_matches':matches,'arrow_landing_route_reused':prior,
        'arrow_landing_source_frame_ref':v.current_observation_frame_ref,
        'arrow_landing_source_frame_digest':stable_digest(frame.rows),
        'arrow_landing_endpoint_examined_count':examined,'arrow_landing_search_examined_count':search_count,
        'arrow_landing_conditional_model':True,'arrow_landing_geometry_pitch':g['pitch'],
        'arrow_landing_cell_boxes':boxes})
    return (measured,)
