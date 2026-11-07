"""Exact pip-column, diagram and framed-center incidence measurements.

The source supplies the provisional material ownership and directed-law model.
This adapter binds it to current geometry and the existing material inverse
service; it cannot commit a role, choose a strategy or release an action.
"""
from collections import Counter
from functools import lru_cache
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data,stable_digest
from .contracts import FrameGrid
from .symbolic_diagrams import (_components,_solid_square,_rectangular_perimeter,
    _three_branch_to_left,measure_diagram_rows,measure_equal_row_pairs)
from .concentric_frames import measure_concentric_frames
from .mechanical_family_contracts_a import MechanicalFamilyScope
from .typed_material_workbench import (MaterialUnit,MaterialState,MaterialModel,
    MaterialHolder,MaterialRecipe,MaterialQuantity,MaterialRequest,
    measure_typed_material_workbench)
from .agenda_measurement_transport import append_candidate_measurements
from .pip_input_correspondence_d import measure_pip_input_correspondence,direct_pair_payloads

@lru_cache(maxsize=16)
def measure_pip_column_diagram_scene(frame):
    cs=_components(frame);rows=measure_diagram_rows(frame)
    extents={r.symbol_extent for r in rows if len(r.left_values)==2}
    if len(extents)!=1:return None
    extent=next(iter(extents))
    squares=tuple(c for c in cs if c.bbox.height==c.bbox.width==extent
        and (_solid_square(c) or _rectangular_perimeter(c)))
    def point(c):return ((c.bbox.top+c.bbox.bottom)//2,(c.bbox.left+c.bbox.right)//2)
    points={point(c):c for c in squares}
    dots=tuple(c for c in cs if c.area==1)
    columns={}
    for c in squares:
        y,x=point(c)
        ticks=tuple(d for d in dots if d.bbox.top==y and c.bbox.right<d.bbox.left<=c.bbox.right+extent*4)
        if ticks:columns.setdefault(x,[]).append((c,ticks))
    columns={x:g for x,g in sorted(columns.items())if len(g)>=1
        and len({d.value for _,ticks in g for d in ticks})==1}
    columns={x:g for x,g in sorted(columns.items()) if sum(point(c)[1]==x for c in squares)>=3}
    if len(columns)!=1:return None
    col,marked=next(iter(columns.items()));glyphs=tuple(c for c in squares if point(c)[1]==col)
    ys=sorted(point(c)[0]for c in glyphs);steps={b-a for a,b in zip(ys,ys[1:])}
    if len(steps)!=1 or next(iter(steps))<=extent:return None
    frames=measure_concentric_frames(frame)
    stock=[]
    for c in glyphs:
        p=point(c);ticks=next((d for g,d in marked if g==c),())
        tight=tuple(f for f in frames if f.center==p and f.maximum_equal_padding==1
                    and f.bottom-f.top+1==extent+2)
        stock.append({'point':p,'paint':c.value,'ticks':len(ticks),
            'full':_solid_square(c),'tight_count':len(tight),
            'spaced_same_outer_count':sum(f.outer_value==tight[0].outer_value
                and f.maximum_equal_padding>1 for f in frames)if len(tight)==1 else None})
    # An equal pair of framed centers, excluding the pip-bearing column.
    pairs=tuple(pair for pair in measure_equal_row_pairs(frame)
        if pair[0].bottom-pair[0].top+1==extent+2
        and all(f.center[1]!=col for f in pair))
    if len(pairs)!=1:return None
    pair=pairs[0]
    # Passive diagrams live inside perimeters containing a branch glyph and
    # square groups on either side of that glyph. Do not confuse them with bins.
    passive=[]
    for c in cs:
        b=c.bbox
        if b.height<extent+2 or b.width<extent*4:continue
        if not all(frame.rows[y][x]==c.value for y in range(b.top,b.bottom+1)
            for x in range(b.left,b.right+1)
            if y in (b.top,b.bottom) or x in (b.left,b.right)):continue
        crop=FrameGrid(rows=tuple(tuple(r[b.left+1:b.right])for r in frame.rows[b.top+1:b.bottom]))
        if any(_three_branch_to_left(d)for d in _components(crop)):
            passive.append((b.top,b.left,b.bottom,b.right))
    passive=[a for a in passive if not any(a!=b and a[0]<=b[0] and a[1]<=b[1] and a[2]>=b[2] and a[3]>=b[3] for b in passive)]
    def enclosed(p):return any(t<=p[0]<=b and l<=p[1]<=r for t,l,b,r in passive)
    paints={c.value for c in glyphs}
    hollows=tuple(c for c in squares if not _solid_square(c) and c.value in paints
        and point(c)[1]!=col and not enclosed(point(c))
        and not any(f.top<=point(c)[0]<=f.bottom and f.left<=point(c)[1]<=f.right for f in pair))
    branch_values={r.branch_value for r in rows if len(r.left_values)==2}
    buttons=tuple(c for c in squares if _solid_square(c) and c.value in branch_values
        and point(c)[1]!=col and not enclosed(point(c)))
    return {'column':stock,'pair':[{'point':f.center,'paint':frame.rows[f.center[0]][f.center[1]],
        'full':f.center in points and _solid_square(points[f.center]) and points[f.center].value in paints}for f in pair],
        'outlines':[{'point':point(c),'paint':c.value}for c in hollows],
        'branch_squares':[{'point':point(c),'paint':c.value}for c in buttons],
        'rows':[{'left':r.left_values,'right':r.right_values,'branch':r.branch_value}for r in rows if len(r.left_values)==2],
        'passive_box_count':len(passive),'passive_boxes':passive}


def measure_pip_column_material_contributions(value, contract):
    if (not contract or contract.get('geometry_ref') != 'pip_column_binary_diagrams_equal_pair'
            or contract.get('cost_metric_ref') != 'recipe_count'):
        return None
    frame=value.current_observed_frame or value.frame
    scene=measure_pip_column_diagram_scene(frame)
    if scene is None or not scene['outlines'] or not scene['rows']:
        return None
    if (len(scene['column'])>contract['maximum_material_types']
            or len(scene['outlines'])>contract['maximum_open_outlines']
            or len({g['paint']for g in scene['column']})!=len(scene['column'])
            or any(g['ticks']>=contract['unary_saturation_count'] for g in scene['column'])):
        return None
    decorated=tuple(g for g in scene['column'] if g['tight_count'])
    if len(decorated)>1 or any(g['tight_count']!=1 or not g['full'] for g in decorated):
        return None
    held=decorated[0]['paint'] if decorated else None
    paint_ref=lambda paint:f'measurement.material.paint.{paint}'
    token=stable_digest(immutable_json_data(scene))[:16]
    revision='measurement.material.scene.'+token
    context='measurement.material.diagram.'+stable_digest(immutable_json_data(scene['rows']))[:16]
    units=[]
    for glyph in scene['column']:
        if glyph['ticks'] and not glyph['full']:
            return None
        for i in range(glyph['ticks']):
            units.append(MaterialUnit(unit_ref=f'measurement.material.stock.{glyph["paint"]}.{i}',
                material_ref=paint_ref(glyph['paint']),owner=contract['stock_owner']))
    if held is not None:
        units.append(MaterialUnit(unit_ref='measurement.material.held',
            material_ref=paint_ref(held),owner=contract['held_owner']))
    holders=[]
    for i,center in enumerate(scene['pair']):
        ref=f'measurement.material.work.{i}'
        holders.append(MaterialHolder(holder_ref=ref,kind=contract['work_owner']))
        if center['full']:
            units.append(MaterialUnit(unit_ref=f'measurement.material.loaded.{i}',
                material_ref=paint_ref(center['paint']),owner=contract['work_owner'],holder_ref=ref))
    for i,outline in enumerate(scene['outlines']):
        holders.append(MaterialHolder(holder_ref=f'measurement.material.outline.{i}',
            kind=contract['delivery_owner'],requested_type_ref=paint_ref(outline['paint'])))
    recipes=tuple(MaterialRecipe(recipe_ref=f'measurement.material.row.{i}',
        context_ref=context,rule_revision_ref=context,kind=contract['recipe_kind'],
        inputs=tuple(MaterialQuantity(material_ref=paint_ref(p),count=n)for p,n in sorted(Counter(r['left']).items())),
        outputs=tuple(MaterialQuantity(material_ref=paint_ref(p),count=n)for p,n in sorted(Counter(r['right']).items())),
        work_slot_refs=tuple(h.holder_ref for h in holders if h.kind==contract['work_owner']),
        activation_control_ref=f'measurement.material.branch.{r["branch"]}')for i,r in enumerate(scene['rows']))
    state=MaterialState(units=tuple(units),holders=tuple(holders),actions=(),layout_ref=revision,
        layout_current=True,recipe_context_ref=context,rule_revision_ref=context,
        occurrence_namespace_ref=revision,transaction_index=0,remaining_budget=0,
        status=contract['state_status'],level_scope_ref=revision,restore_epoch=value.current_context_epoch or 0)
    model=MaterialModel(model_ref=revision,recipes=recipes,layouts=(),**dict(contract['conditional_model']))
    scope=MechanicalFamilyScope(request_ref=revision,epoch=value.current_context_epoch or 0,
        evidence_revision_ref=value.current_observation_frame_ref,model_revision_ref=context,
        event_owner_ref=revision,**dict(contract['scope']))
    requested=Counter(g['paint']for g in scene['outlines'])
    request=MaterialRequest(scope=scope,operation_ref=contract['operation_ref'],mode=contract['mode'],
        state=state,models=(model,),bound_model_ref=model.model_ref,
        desired_materials=tuple(MaterialQuantity(material_ref=paint_ref(p),count=n)for p,n in sorted(requested.items())),
        **dict(contract['search_bounds']))
    result=measure_typed_material_workbench(request)
    if not result.domain_complete or result.computation_bound_reached:
        return None
    balances=result.values.get('requirement_hypergraph_nodes',())
    financed=tuple(b for b in balances if not b['exact_deficits'])
    if not financed:
        return None
    minimum=min(len(b['candidate_forward_recipe_word'])for b in financed)
    words=tuple(b['candidate_forward_recipe_word']for b in financed
                if len(b['candidate_forward_recipe_word'])==minimum)
    first_refs={word[0]for word in words if word}
    first_rows=tuple(r for recipe,r in zip(recipes,scene['rows'])if recipe.recipe_ref in first_refs)
    loaded=Counter(g['paint']for g in scene['pair']if g['full'])
    needed=tuple(Counter(r['left'])-loaded for r in first_rows)
    pair_contract=contract.get('input_pair_series_contract')or{}
    signature=(value.current_context_epoch,value.observed_level_index)
    digest=stable_digest(immutable_json_data(contract))
    previous=value.canonical_dispatched_goal_continuity_facts.get('dispatched_composition_target_context')or{}
    current_scope=(bool(pair_contract)and all(type(v)is int for v in signature)
        and type(value.current_level_primitive_count)is int)
    matches=(current_scope and previous.get('schema_ref')==pair_contract.get('measurement_schema_ref')
        and previous.get('contract_digest')==digest and tuple(previous.get('scope_signature',()))==signature)
    protocol=measure_pip_input_correspondence(value,scene,previous if matches else None,contract['point_action_ref'])
    common=FrozenMap({'source_frame_ref':value.current_observation_frame_ref,
        'source_frame_digest':stable_digest(frame),'context_epoch':value.current_context_epoch,
        'conditional_model_assignments':contract['conditional_model_assignments'],
        'schema_ref':pair_contract.get('measurement_schema_ref'),'contract_digest':digest,
        'scope_signature':signature,'level_primitive_count':value.current_level_primitive_count,
        'protocol_measurement':protocol,'prior_dispatched_context_scope_matches':bool(matches),
        'geometry':scene,'inverse_request':request.model_dump(mode='json'),
        'inverse_return':result.model_dump(mode='json'),'minimum_recipe_count':minimum,
        'financed_minimum_recipe_words':words,'budget_unused_by_inverse_calculation':True})
    points={tuple(g['point'])for key in ('column','pair','outlines','branch_squares')for g in scene[key]}
    pair_at_point={}
    input_occurrences=Counter(p for row in scene['rows']for p in row['left'])
    if (current_scope and pair_contract.get('witness_order')=='row_major'
            and pair_contract.get('maximum_root_witnesses')==1):
        for point in sorted(points):
            glyph=next((g for g in scene['column']if tuple(g['point'])==point),None)
            if glyph is None or input_occurrences[glyph['paint']]!=pair_contract['required_input_incidence_count']:
                continue
            word=direct_pair_payloads(scene,point,protocol)
            if word and len(word)<=pair_contract['maximum_actions']:
                pair_at_point[point]=word
                break
    common=FrozenMap.overlay({'input_word_root_witness_count':len(pair_at_point)},common)
    rows={}
    for point in sorted(points):
        column=next((g for g in scene['column']if tuple(g['point'])==point),None)
        outline=next((g for g in scene['outlines']if tuple(g['point'])==point),None)
        center=next((g for g in scene['pair']if tuple(g['point'])==point),None)
        button=next((g for g in scene['branch_squares']if tuple(g['point'])==point),None)
        payloads=pair_at_point.get(point,())
        point_context=FrozenMap.overlay({'measured_direct_pair_payloads':payloads},common)
        rows[point]=FrozenMap({'pip_console_current_model_complete':True,
            'pip_console_acquired_point_correspondence':protocol['point_removal_and_tight_frame_observed'],
            'pip_console_acquired_outline_correspondence':protocol['tight_frame_and_matching_outline_removal_observed'],
            'pip_console_direct_pair_length':len(payloads),
            'pip_console_point_recipe_input_occurrence_count':input_occurrences[column['paint']]if column else None,
            'pip_console_direct_pair_action_refs':(contract['point_action_ref'],)*len(payloads),
            'pip_console_direct_pair_payloads':payloads,
            'pip_console_direct_pair_component_refs':(None,)*len(payloads),
            'pip_console_direct_pair_candidate_refs':(),
            'pip_console_incoming_route_remaining_step_count':value.incoming_declared_route_remaining_step_count,
            'pip_console_held_count':int(held is not None),
            'pip_console_spaced_selection_paint_frame_count':decorated[0]['spaced_same_outer_count']if decorated else None,
            'pip_console_point_outline_matches_held':bool(outline and outline['paint']==held),
            'pip_console_point_free_requested_glyph':bool(column and column['ticks']>0 and requested[column['paint']]>0),
            'pip_console_point_free_financed_operand':bool(column and column['ticks']>0 and any(n[column['paint']]>0 for n in needed)),
            'pip_console_point_empty_pair_for_held':bool(center and not center['full'] and held is not None and any(n[held]>0 for n in needed)),
            'pip_console_point_financed_loaded_branch':bool(button and any(Counter(r['left'])==loaded and r['branch']==button['paint']for r in first_rows)),
            'pip_console_current_measurement':point_context})
    return rows


def append_pip_column_material_candidates(value,agenda,contract,point_producer):
    rows=measure_pip_column_material_contributions(value,contract)
    if not rows:
        return agenda
    represented={c.point for c in agenda.candidates if c.action_ref==contract['point_action_ref']}
    missing=tuple(p for p in sorted(rows)if p not in represented)
    additions=tuple((c,f)for c,f in point_producer(value,
        frozenset(agenda.current_context_no_effect_candidate_refs),
        frozenset(agenda.tested_candidate_refs_without_resolution_plan),{},{},{},{},requested_points=missing)
        if c.point in missing)if missing and contract['point_action_ref']in value.available_action_refs else ()
    if len(agenda.candidates)+len(additions)>contract['maximum_frontier_candidates']:
        return agenda
    candidates=list(agenda.candidates);facts=dict(agenda.alternative_facts)
    deltas=dict(agenda.descriptive_delta_facts or agenda.alternative_facts)
    refs=set(agenda.alternative_refs)
    for candidate,base in additions:
        if candidate.candidate_ref not in refs:
            candidates.append(candidate);refs.add(candidate.candidate_ref)
            facts[candidate.candidate_ref]=base;deltas[candidate.candidate_ref]=base
    agenda=agenda.model_copy(update={'candidates':tuple(candidates),
        'alternative_refs':tuple(c.candidate_ref for c in candidates),
        'alternative_facts':FrozenMap(facts),'descriptive_delta_facts':FrozenMap(deltas),
        'has_candidates':bool(candidates)})
    measured={c.candidate_ref:rows[c.point]for c in agenda.candidates
        if c.action_ref==contract['point_action_ref']and c.point in rows}
    return append_candidate_measurements(agenda,FrozenMap(measured),FrozenMap())

