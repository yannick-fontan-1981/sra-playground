"""Public pair measurements feeding the existing bounded joint-state capability."""
from collections import defaultdict
from itertools import permutations
from types import SimpleNamespace
from alternating_graph_observation import description
from agents.yf_arc3_v5.capabilities.interaction import _bounded_joint_peer_collision_route_candidates
from agents.yf_arc3_v5.capabilities.contracts import FrameGrid,KnownGridCellRecountInput,BoundingBox
from agents.yf_arc3_v5.capabilities.cell_recount import recount_known_grid_cells
from terminal_composition import identity

def pairs(rows):
    _,components,_=description(tuple(map(tuple,rows)));groups=defaultdict(list)
    for c in components.components:
        b=c.bbox
        if b.width==b.height and 1<b.width<=16 and c.area==b.width*b.height:
            groups[(c.value,b.width)].append([b.top,b.left,b.bottom,b.right])
    return [{'value':v,'size':q,'boxes':sorted(bs)}for (v,q),bs in groups.items()if len(bs)==2]

def match_pair(before,after):
    """Keep all compatible assignments until a unique minimum local displacement."""
    q=before['size'];options=[]
    for bs in permutations(after['boxes']):
        ds=[(b[0]-a[0],b[1]-a[1])for a,b in zip(before['boxes'],bs)]
        if all((not y or not x)and abs(y)+abs(x)<=q for y,x in ds):
            options.append((sum(abs(y)+abs(x)for y,x in ds),bs,ds))
    if not options:return None
    cost=min(x[0]for x in options);best=[x for x in options if x[0]==cost]
    return {'boxes':list(map(list,best[0][1])),'deltas':list(map(list,best[0][2]))}if len(best)==1 else None

def joint_route(rows,pair,controls,floor_values,signs,limit,evidence=(),exclude_mixtures=False):
    """No game identifier or external level state is accepted."""
    q=pair['size'];grids=[]
    if not controls or any(abs(d[0])+abs(d[1])!=q for d in controls.values()):return None
    y0,x0=pair['boxes'][0][0]%q,pair['boxes'][0][1]%q
    if any(b[0]%q!=y0 or b[1]%q!=x0 for b in pair['boxes']):return None
    nr,nc=(len(rows)-y0)//q,(len(rows[0])-x0)//q;ref='measured_motion_lattice:'+identity([y0,x0,q,nr,nc])[:16]
    measured=recount_known_grid_cells(KnownGridCellRecountInput(frame=FrameGrid(rows=tuple(map(tuple,rows))),grid_ref=ref,row_offset=y0,col_offset=x0,cell_height=q,cell_width=q,row_pitch=q,col_pitch=q,logical_rows=nr,logical_columns=nc))
    cells=[]
    for i,t in enumerate(measured.cell_type_ids):
        y,x=divmod(i,nc);top,left=y0+y*q,x0+x*q;pattern=measured.type_patterns[t]
        cells.append(SimpleNamespace(row=y,col=x,bbox=BoundingBox(top=top,left=left,bottom=top+q-1,right=left+q-1),pattern_ref='pattern:'+identity(pattern),palette_values=tuple(sorted({v for row in pattern for v in row}))))
    measured_grid=SimpleNamespace(candidate_ref=ref,row_offset=y0,col_offset=x0,cell_height=q,cell_width=q,row_pitch=q,col_pitch=q,cells=tuple(cells))
    for g in (measured_grid,):
        if (g.cell_height,g.cell_width,g.row_pitch,g.col_pitch)!=(q,q,q,q):continue
        movers=[c for c in g.cells if [c.bbox.top,c.bbox.left,c.bbox.bottom,c.bbox.right]in pair['boxes']]
        if len(movers)!=2 or len({c.pattern_ref for c in movers})!=1:continue
        floor={c.pattern_ref for c in g.cells if len(c.palette_values)==1 and c.palette_values[0]in floor_values}
        if floor:grids.append((g,movers,floor))
    if len(grids)!=1:return None
    g,movers,floor=grids[0]
    # Bind member identity to the tracked occurrence; never re-sort after crossing.
    memory={'term_ref':'public.current_pair_control_relation','role_premise_claim_refs':tuple(evidence),'peer_palette_values':tuple(movers[0].palette_values),'peer_coupling_row':signs[0],'peer_coupling_column':signs[1]}
    if exclude_mixtures:
        memory.update(requires_unmatched_floor_mixture_contact_exclusion=True,peer_passable_palette_rows=tuple((v,)for v in floor_values))
    value=SimpleNamespace(residual_axis_coupling_row=signs[0],residual_axis_coupling_column=signs[1],
        periodic_cell_grids=SimpleNamespace(candidates=(g,)),cellular_mover_pattern_refs=(movers[0].pattern_ref,),
        cellular_traversable_pattern_refs=tuple(floor),canonical_peer_method_facts=(memory,),
        input_aligned_entity_bboxes=tuple(c.bbox for c in movers if [c.bbox.top,c.bbox.left,c.bbox.bottom,c.bbox.right]==pair['boxes'][0]),
        available_action_refs=tuple(controls),action_execution_counts=tuple((a,1)for a in controls),
        interface_action_translation_deltas=tuple((a,d[0]//q,d[1]//q)for a,d in controls.items()),
        known_action_translation_deltas=tuple((a,*d)for a,d in controls.items()),
        recent_same_action_controlled_translation_deltas=(),current_exact_component_translations=(),
        route_generation_policy={'max_plan_actions':min(40,limit),'max_expanded_states_per_hypothesis':4096,'max_route_variants':1})
    found=_bounded_joint_peer_collision_route_candidates(value=value,no_effect=frozenset())
    if not found:return None
    facts=dict(found[0][1]);return {'actions':list(facts['verified_repetition_action_refs']),
        'expected':[[[t,l,t+h-1,l+w-1]for t,l,h,w in boxes]for boxes in facts['peer_route_expected_pixel_boxes']],
        'states':facts['joint_peer_collision_state_count'],'expanded':facts['mechanical_search_expanded_state_count'],
        'one_sided_steps':facts['joint_route_one_sided_transition_count'],'grid_ref':g.candidate_ref}
