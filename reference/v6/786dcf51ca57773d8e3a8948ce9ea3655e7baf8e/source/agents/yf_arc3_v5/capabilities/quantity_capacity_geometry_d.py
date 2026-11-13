"""Exact calibrated cell-volume upper bounds; no maximum from observed fills."""
from typing import Literal
from pydantic import Field,model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref


class QuantityCapacityGeometryD(FrozenModel):
    compartment_ref: Ref
    coordinate_basis: Literal['CELL_LATTICE']
    footprint_basis: Literal['POSE_RELATIVE_CELL_LATTICE']
    volume_model: Literal['CONSERVATIVE_CELL_VOLUME_BOUND']
    origin: tuple[int,int]
    gravity: tuple[int,int]
    settled_cells: tuple[tuple[int,int],...] = Field(min_length=1,max_length=65536)
    wall_cells: tuple[tuple[int,int],...] = Field(default=(),max_length=65536)
    envelope_complete: bool
    settled_domain_complete: bool
    cell_units_numerator: int = Field(ge=1,le=65536)
    cell_units_denominator: int = Field(ge=1,le=65536)
    evidence_refs: tuple[Ref,...] = Field(min_length=1,max_length=64)

    @model_validator(mode='after')
    def unique_current_geometry(self):
        if len(set(self.settled_cells))!=len(self.settled_cells) or len(set(self.wall_cells))!=len(self.wall_cells):
            raise ValueError('capacity cells must be unique within each domain')
        if sum(abs(axis) for axis in self.gravity)!=1:raise ValueError('capacity gravity must be cardinal')
        return self


def measure_quantity_capacity_geometry_d(request,budget):
    layouts=request.capacity_layouts
    if layouts is None:return {},('quantity_identity.current_calibrated_capacity_geometry',),False
    refs=tuple(layout.compartment_ref for layout in layouts)
    if len(refs)!=len(set(refs)) or set(refs)!={row.compartment_ref for row in request.compartments}:
        return {},('quantity_identity.complete_capacity_geometry_population',),False
    work=8*sum(len(row.envelope_positions) for row in request.compartments)
    work+=8*sum(len(row.settled_cells)+len(row.wall_cells) for row in layouts)
    work+=8*sum(len(tag.footprint)+len(layouts) for tag in request.tags)
    work+=len(layouts)*len(request.compartments)
    if not budget.take(work):return {},('quantity_identity.capacity_geometry_work_bound',),False
    compartments={row.compartment_ref:row for row in request.compartments};rows=[];missing=[]
    for layout in layouts:
        compartment=compartments[layout.compartment_ref]
        if (not layout.envelope_complete or not layout.settled_domain_complete
                or layout.origin!=compartment.origin or layout.gravity!=compartment.gravity):
            missing.append('quantity_identity.current_complete_local_capacity_geometry.'+layout.compartment_ref);continue
        envelope=set(compartment.envelope_positions);walls=set(layout.wall_cells);settled=set(layout.settled_cells)
        if not walls.issubset(envelope) or not settled.issubset(envelope):
            missing.append('quantity_identity.capacity_cells_inside_current_envelope.'+layout.compartment_ref);continue
        free=envelope-walls;body_cells=set();body_count=0;body_valid=True
        for tag in request.tags:
            if tag.owner_compartment_ref!=layout.compartment_ref:continue
            cells={(tag.pose[0]+point[0],tag.pose[1]+point[1]) for point in tag.footprint}
            body_count+=len(cells)
            if not cells.issubset(free) or cells & body_cells:body_valid=False
            body_cells.update(cells)
        if not body_valid:
            missing.append('quantity_identity.complete_nonoverlapping_capacity_body_footprints.'+layout.compartment_ref);continue
        # Even if some body cells are above the material surface, their entire
        # volume shares this envelope. Do not reserve only visible/filled pixels.
        geometric_cells=max(0,min(len(settled-walls),len(free)-body_count))
        upper=(geometric_cells*layout.cell_units_numerator)//layout.cell_units_denominator
        upper=(upper//compartment.units_per_quantum)*compartment.units_per_quantum
        if compartment.quantity>upper:
            missing.append('quantity_identity.observed_quantity_contradicts_capacity_geometry.'+layout.compartment_ref);continue
        rises=tuple(sum((compartment.origin[axis]-point[axis])*compartment.gravity[axis] for axis in range(2))
            for point in settled)
        rows.append(FrozenMap({'compartment_ref':layout.compartment_ref,'local_gravity':layout.gravity,
            'local_origin':layout.origin,'settled_rise_interval':(min(rises),max(rises)),
            'envelope_cell_count':len(envelope),'wall_cell_count':len(walls),
            'full_body_reserved_cell_count':body_count,'available_geometric_cell_count':geometric_cells,
            'cell_units_numerator':layout.cell_units_numerator,'cell_units_denominator':layout.cell_units_denominator,
            'observed_quantity_lower_bound':compartment.quantity,'geometric_capacity_upper_bound':upper,
            'exact_attainable_maximum_proved':False,'largest_observed_fill_is_not_maximum':True,
            'geometry_evidence_refs':layout.evidence_refs}))
    return {'derived_capacity_rows':tuple(rows)},tuple(dict.fromkeys(missing)),not missing
