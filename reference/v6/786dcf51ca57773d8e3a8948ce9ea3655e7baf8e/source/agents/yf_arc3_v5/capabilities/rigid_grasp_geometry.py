"""Exact occupied-cell geometry for a rigid grasp, without action authority.

Coordinates use the caller's measured unit (pixels or cells). Shapes retain
holes, concavities and distinct carrier/part identities; a bounding rectangle
is a descriptive extent, never the collision mask. Every sweep is supplied.
"""
from collections.abc import Mapping
from typing import Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap

Point = tuple[int, int]


def occupied_union(carrier, part=(), extra=()):
    return tuple(sorted(set(carrier) | set(part) | set(extra)))


def translated_mask(mask, delta):
    return tuple((x+delta[0], y+delta[1]) for x,y in mask)


def quarter_turned_mask(mask, pivot, turns):
    """Positive turn maps (x,y) to (-y,x); pivot/sweep are never inferred."""
    result=[]
    for x,y in mask:
        x,y=x-pivot[0],y-pivot[1]
        for _ in range(turns % 4):
            x,y=-y,x
        result.append((x+pivot[0],y+pivot[1]))
    return tuple(sorted(result))


def footprint_measurements(carrier, part=()):
    union=occupied_union(carrier,part)
    if not union:
        return FrozenMap({'occupied_cells':(), 'occupied_count':0, 'bbox':(), 'row_intervals':()})
    xs,ys=tuple(zip(*union))
    box=(min(xs),min(ys),max(xs),max(ys))
    intervals=[]
    rows={}
    for x,y in union:
        rows.setdefault(x,[]).append(y)
    for x,columns in sorted(rows.items()):
        first=last=columns[0]
        for y in columns[1:]:
            if y!=last+1:
                intervals.append((x,first,last));first=y
            last=y
        intervals.append((x,first,last))
    area=(box[2]-box[0]+1)*(box[3]-box[1]+1)
    return FrozenMap({'carrier_cells':tuple(sorted(set(carrier))),
        'part_cells':tuple(sorted(set(part))), 'occupied_cells':union,
        'occupied_count':len(union), 'bbox':box, 'extent_dimensions':(box[2]-box[0]+1,box[3]-box[1]+1),
        'bbox_area':area, 'unoccupied_inside_bbox_count':area-len(union),
        'row_intervals':tuple(intervals), 'carrier_part_overlap':tuple(sorted(set(carrier)&set(part)))})


def support_collisions(carrier, part, terrain: Mapping, obstacles=(), extra=()):
    """Check only real occupancy; absent/unproved support remains unknown."""
    obstacles=frozenset(obstacles);blocked=[];unknown=[]
    for point in occupied_union(carrier,part,extra):
        supplied=terrain.get(point)
        if point in obstacles or supplied is not None and supplied[0]=='BLOCKED':
            blocked.append(point)
        elif supplied is None or supplied[0]!='SUPPORTED' or not supplied[1]:
            unknown.append(point)
    return tuple(blocked),tuple(unknown)


def contact_cells(carrier, part, vectors):
    reachable={ (x+dx,y+dy) for x,y in carrier for dx,dy in vectors }
    return tuple(sorted(set(part)&reachable))


def candidate_grasp_roots(carrier_offsets, part_cells, vectors, maximum_evaluations):
    """Enumerate contact roots for every carrier support cell, retaining ties."""
    roots=[];seen=set();work=0
    for px,py in part_cells:
        for cx,cy in carrier_offsets:
            for dx,dy in vectors:
                if work>=maximum_evaluations:
                    return tuple(roots),work,False
                root=(px-cx-dx,py-cy-dy)
                if root not in seen:
                    seen.add(root);roots.append(root)
                work+=1
    return tuple(roots),work,True


class GraspSupportCell(FrozenModel):
    point: Point
    support: Literal['SUPPORTED','BLOCKED','UNKNOWN']
    evidence_ref: str | None = None


class RigidGraspGeometryRequest(FrozenModel):
    schema_version: str = 'yf_arc3_v5.rigid_grasp_geometry_request.v1'
    coordinate_unit_ref: str = Field(min_length=1)
    carrier_ref: str = Field(min_length=1)
    part_ref: str | None = None
    grasp_evidence_ref: str | None = None
    carrier_cells: tuple[Point,...] = Field(min_length=1,max_length=4096)
    part_cells: tuple[Point,...] = Field(default=(),max_length=4096)
    terrain: tuple[GraspSupportCell,...] = Field(default=(),max_length=16384)
    obstacle_cells: tuple[Point,...] = Field(default=(),max_length=16384)
    supplied_deltas: tuple[Point,...] = Field(default=(),max_length=1024)
    supplied_sweeps: tuple[tuple[Point,...],...] = Field(default=(),max_length=1024)
    maximum_evaluations: int = Field(default=65536,ge=1,le=1048576)
    geometry_evidence_refs: tuple[str,...] = Field(default=(),max_length=128)
    collision_scope: Literal['FINAL_MASK','SUPPLIED_SWEEP'] = 'FINAL_MASK'
    delivery_comparison: FrozenMap = Field(default_factory=FrozenMap)
    current_state_ref: str | None = None
    evidence_revision_ref: str | None = None
    model_revision_ref: str | None = None
    level_scope_ref: str | None = None
    restore_epoch: int | None = Field(default=None, ge=0)
    @model_validator(mode='after')
    def exact_input(self):
        if self.part_cells and (not self.part_ref or self.part_ref==self.carrier_ref):
            raise ValueError('nonempty held part retains an identity distinct from its carrier')
        if len(set(self.carrier_cells))!=len(self.carrier_cells) or len(set(self.part_cells))!=len(self.part_cells):
            raise ValueError('supplied occupied masks have distinct positions')
        if len({r.point for r in self.terrain})!=len(self.terrain):
            raise ValueError('one support state per supplied position')
        if self.collision_scope not in ('FINAL_MASK','SUPPLIED_SWEEP'):
            raise ValueError('collision scope is explicitly final or supplied sweep')
        if self.collision_scope=='SUPPLIED_SWEEP' and len(self.supplied_sweeps)!=len(self.supplied_deltas):
            raise ValueError('one explicit sweep per supplied translation')
        if sum(len(s) for s in self.supplied_sweeps)>65536:
            raise ValueError('bounded supplied sweep support')
        return self


class RigidGraspGeometryInput(FrozenModel):
    request: RigidGraspGeometryRequest
    schema_version: str = 'yf_arc3_v5.rigid_grasp_geometry_input.v1'


class RigidGraspGeometryResult(FrozenModel):
    facts: FrozenMap
    comparison_refs: tuple[str, ...] = Field(default=(), max_length=4)
    comparison_facts: FrozenMap = Field(default_factory=FrozenMap)
    schema_version: str = 'yf_arc3_v5.rigid_grasp_geometry_result.v1'


def measure_rigid_grasp_geometry(value: RigidGraspGeometryInput | RigidGraspGeometryRequest):
    """Simulate Source's exact proposed translations, without release/selection."""
    request=value.request if isinstance(value,RigidGraspGeometryInput) else value
    if request.delivery_comparison:
        # Local import avoids a cycle: K35 already consumes this geometry library.
        from .rigid_grasp_delivery import measure_rigid_grasp_delivery
        return RigidGraspGeometryResult(**measure_rigid_grasp_delivery(request))
    carrier,part=request.carrier_cells,request.part_cells
    terrain={row.point:(row.support,row.evidence_ref) for row in request.terrain}
    initial=footprint_measurements(carrier,part)
    work=len(terrain)+len(request.obstacle_cells)+len(carrier)+len(part)
    rows=[];cut=work>request.maximum_evaluations
    complete=bool(request.geometry_evidence_refs)
    for index,delta in enumerate(request.supplied_deltas):
        if cut:
            break
        next_carrier,next_part=translated_mask(carrier,delta),translated_mask(part,delta)
        sweep=request.supplied_sweeps[index] if request.collision_scope=='SUPPLIED_SWEEP' else ()
        cost=len(next_carrier)+len(next_part)+len(sweep)
        if work+cost>request.maximum_evaluations:
            cut=True;break
        work+=cost
        blocked,unknown=support_collisions(next_carrier,next_part,terrain,request.obstacle_cells,sweep)
        geometry=footprint_measurements(next_carrier,next_part)
        outcome='BLOCKED' if blocked else 'UNKNOWN' if unknown or not complete else 'CLEAR'
        rows.append(FrozenMap({'index':index,'delta':delta,'outcome':outcome,
            'blocked_cells':blocked,'unknown_cells':unknown,'proposed_envelope':geometry,
            'vacated_cells':tuple(sorted(set(occupied_union(carrier,part))-set(geometry['occupied_cells']))),
            'entered_cells':tuple(sorted(set(geometry['occupied_cells'])-set(occupied_union(carrier,part))))}))
        if outcome!='CLEAR':
            break
        carrier,part=next_carrier,next_part
    trajectory_complete=len(rows)==len(request.supplied_deltas) and not cut and all(r['outcome']=='CLEAR' for r in rows)
    return RigidGraspGeometryResult(facts=FrozenMap({'delivery_comparison_requested':False,'geometry_complete':complete,
        'initial_envelope':initial,'simulation_steps':tuple(rows),
        'terminal_envelope':footprint_measurements(carrier,part),
        'trajectory_complete':trajectory_complete,'computation_bound_reached':cut,
        'examined_count':work,'first_blocked_step':next((r['index'] for r in rows if r['outcome']=='BLOCKED'),None),
        'first_unknown_step':next((r['index'] for r in rows if r['outcome']=='UNKNOWN'),None),
        'collision_scope':request.collision_scope,'geometry_evidence_refs':request.geometry_evidence_refs,
        'coordinate_unit_ref':request.coordinate_unit_ref,'carrier_ref':request.carrier_ref,
        'part_ref':request.part_ref,'grasp_evidence_ref':request.grasp_evidence_ref,
        'rigidity_is_evidenced':bool(request.grasp_evidence_ref),
        'action_authorization':False,'observed_operator_law_inferred':False}))
