"""Exact initial lattice pattern and cardinal-neighbor observations; no roles."""
from agents.yf_arc3_v5.logos.types import FrozenMap


def measure_initial_contoured_cell_neighbors(value, agenda, directions, white, black):
    if value.last_action_ref is not None or value.action_conditioned_grid_evidence:
        return FrozenMap(), FrozenMap()
    geometry=value.retained_grid_geometry
    recount=value.retained_grid_recount
    if not geometry or recount is None or recount.grid_ref!=value.retained_grid_ref:
        return FrozenMap(), FrozenMap()
    top,left,height,width,row_pitch,col_pitch,rows,cols=geometry
    if height<3 or width<3 or height!=row_pitch or width!=col_pitch or len(recount.cell_type_ids)!=rows*cols:
        return FrozenMap(), FrozenMap()
    patterns=recount.type_patterns
    def black_border(p):
        return len(p)==height and all(len(r)==width for r in p) and all(p[r][c]==black for r in range(height) for c in range(width) if r in (0,height-1) or c in (0,width-1))
    outlined=set(); white_types=set(); uniform=set()
    for i,p in enumerate(patterns):
        if len({x for r in p for x in r})==1:uniform.add(i)
        if not black_border(p):continue
        inner=tuple(tuple(r[1:-1]) for r in p[1:-1])
        values={x for r in inner for x in r}
        if len(values)==1 and white not in values and black not in values:outlined.add(i)
        if white in values and len(values)>1 and all(inner[r][c]==white for r in range(len(inner)) for c in range(len(inner[0])) if r in (0,len(inner)-1) or c in (0,len(inner[0])-1)):
            white_types.add(i)
    white_cells=[i for i,t in enumerate(recount.cell_type_ids) if t in white_types]
    perimeter=[recount.cell_type_ids[r*cols+c] for r in range(rows) for c in range(cols) if r in (0,rows-1) or c in (0,cols-1)]
    perimeter_uniform=bool(perimeter and len(set(perimeter))==1 and perimeter[0] in uniform)
    outlined_count=sum(t in outlined for t in recount.cell_type_ids)
    if len(white_cells)!=1 or not perimeter_uniform or outlined_count<2:
        return FrozenMap(), FrozenMap()
    r,c=divmod(white_cells[0],cols)
    common=FrozenMap({'initial_contoured_cell_observation_before_any_action':True,'initial_white_inner_contour_cell_count':1,'initial_black_contoured_uniform_inner_cell_count':outlined_count,'initial_uniform_outer_cell_ring_present':True,'initial_white_inner_contour_cell_bbox':(top+r*row_pitch,left+c*col_pitch,top+r*row_pitch+height-1,left+c*col_pitch+width-1),'initial_contoured_lattice_grid_ref':value.retained_grid_ref})
    by_ref={}
    for ref,facts in sorted(agenda.alternative_facts.items()):
        action=facts.get('action_ref');delta=directions.get(action)
        if delta is None:continue
        nr,nc=r+delta[0],c+delta[1]
        t=recount.cell_type_ids[nr*cols+nc] if 0<=nr<rows and 0<=nc<cols else None
        by_ref[ref]=FrozenMap.overlay({'initial_direction_enters_black_contoured_uniform_inner_cell':t in outlined,'initial_direction_enters_uniform_outer_cell_type':bool(t in uniform and t==perimeter[0])},common)
    return FrozenMap(by_ref),common
