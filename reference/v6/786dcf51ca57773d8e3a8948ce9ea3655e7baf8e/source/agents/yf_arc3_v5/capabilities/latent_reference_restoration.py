"""Finite homology, independently licensed gauges and fixed-reference edits.

No denoiser replaces a reference after each edit. Geometry, reference hypotheses,
indicator licensing and official acceptance are independent inputs.
"""
from collections import deque
from fractions import Fraction
from itertools import product
from typing import Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref, immutable_json_data
from .mechanical_family_contracts_a import MechanicalFamilyScope, MechanicalFamilyResult, family_result, missing_supplied_fields
from .identity_contact_authentication import ContactPixel, ContactLayerTemplate, ContactLayerSample, _candidate_layers as translated_layers
from .contracts import PeriodicCellGridInput
from .frame import enumerate_periodic_cell_grids

Point=tuple[int,int]


class ReferenceCell(FrozenModel):
    point: Point
    value_ref: Ref


class ReferenceInput(FrozenModel):
    input_ref: Ref
    point: Point
    action_ref: Ref
    payload: FrozenMap
    cost: int = Field(ge=0, le=65536)
    paint_value_ref: Ref | None = None


class ReferenceState(FrozenModel):
    cells: tuple[ReferenceCell, ...] = Field(min_length=1,max_length=4096)
    saved_alternatives: tuple[ReferenceCell, ...] = Field(max_length=4096)
    inputs: tuple[ReferenceInput, ...] = Field(max_length=4096)
    lattice_ref: Ref
    bindings_current: bool
    remaining_budget: int = Field(ge=0, le=65536)
    level_scope_ref: Ref
    restore_epoch: int = Field(ge=0)
    official_outcome: Literal['ACTIVE','WIN','LOCAL_STOP','GAME_OVER','UNKNOWN']
    @model_validator(mode='after')
    def addresses(self):
        points={c.point for c in self.cells}
        if len(points)!=len(self.cells) or len({c.point for c in self.saved_alternatives})!=len(self.saved_alternatives):raise ValueError('one logical current value and saved alternative per address')
        if any(c.point not in points for c in self.saved_alternatives) or any(i.point not in points for i in self.inputs):raise ValueError('edits address measured field cells, never an informative outside border')
        if len({i.input_ref for i in self.inputs})!=len(self.inputs):raise ValueError('distinct bound edit inputs')
        return self


class ReferenceLattice(FrozenModel):
    lattice_ref: Ref
    origin: Point
    pitch: Point
    content: Point
    cell_addresses: tuple[Point, ...] = Field(min_length=1,max_length=4096)
    measured_evidence_ref: Ref
    @model_validator(mode='after')
    def dimensions(self):
        if any(n<=0 for n in self.pitch+self.content) or any(c>p for c,p in zip(self.content,self.pitch)):raise ValueError('measured positive content and pitch')
        if len(set(self.cell_addresses))!=len(self.cell_addresses):raise ValueError('retain all measured addresses including clipped edge cells')
        return self


class ReferenceLayerTemplate(ContactLayerTemplate):
    component: Literal['CELL_INTERIOR','OUTLINE','FLASH','INDICATOR','INFORMATIVE_BORDER','UNKNOWN']
    lattice_ref: Ref | None = None
    logical_point: Point | None = None
    interior_offset: Point | None = None
    value_candidate_ref: Ref | None = None


class CoordinateTransform(FrozenModel):
    transform_ref: Ref
    matrix: tuple[Point,Point]
    offset: Point


class HomologyModel(FrozenModel):
    model_ref: Ref
    kind: Literal['PERIODIC','SYMMETRY']
    period: Point | None = None
    phase: Point | None = None
    transforms: tuple[CoordinateTransform, ...] = Field(max_length=32)
    declared_domain_complete: bool
    @model_validator(mode='after')
    def finite(self):
        if self.kind=='PERIODIC' and (self.period is None or self.phase is None or any(n<=0 for n in self.period)):raise ValueError('finite periodic phases need not divide the viewport')
        if self.kind=='SYMMETRY' and not self.transforms:raise ValueError('explicit finite coordinate correspondences')
        return self


class IntactWitness(FrozenModel):
    point: Point
    value_ref: Ref
    independent_evidence_ref: Ref
    event_owner_ref: Ref
    epoch: int = Field(ge=0)


class OmissionHypothesis(FrozenModel):
    omission_ref: Ref
    model_ref: Ref
    allowed_value_refs: tuple[Ref, ...] = Field(min_length=1,max_length=128)
    maximum_errors_per_class: int = Field(ge=0, le=4096)
    minimum_intact_support: int = Field(ge=0, le=4096)


class ReferenceField(FrozenModel):
    reference_ref: Ref
    homology_model_ref: Ref
    cells: tuple[ReferenceCell, ...] = Field(min_length=1,max_length=4096)
    level_scope_ref: Ref
    lattice_ref: Ref
    current_revalidation_epoch: int = Field(ge=0)
    status: Literal['ESTABLISHED','HYPOTHESIS']
    supporting_evidence_refs: tuple[Ref, ...] = Field(max_length=4096)
    omission_model_ref: Ref | None = None
    @model_validator(mode='after')
    def fixed(self):
        if len({c.point for c in self.cells})!=len(self.cells):raise ValueError('a reference keeps one fixed expected value per cell')
        return self


class GaugeModel(FrozenModel):
    gauge_ref: Ref
    event_owner_ref: Ref
    current_revalidation_epoch: int = Field(ge=0)
    zero: str
    scale: str
    lower_saturation: str | None = None
    upper_saturation: str | None = None
    licensed_error_min: int = Field(ge=0, le=4096)
    licensed_error_max: int = Field(ge=0, le=4096)
    license_status: Literal['SUPPORTED','HYPOTHESIS']
    units_evidence_ref: Ref | None = None
    zero_evidence_ref: Ref | None = None
    direction_evidence_ref: Ref | None = None
    scale_evidence_ref: Ref | None = None
    saturation_evidence_ref: Ref | None = None
    independent_of_reference_estimate: bool
    @model_validator(mode='after')
    def range(self):
        if Fraction(self.scale)==0 or self.licensed_error_min>self.licensed_error_max:raise ValueError('nonconstant finite supported indicator interval')
        if self.lower_saturation is not None and self.upper_saturation is not None and Fraction(self.lower_saturation)>Fraction(self.upper_saturation):raise ValueError('ordered indicator saturation')
        return self


class GaugeObservation(FrozenModel):
    observation_ref: Ref
    event_owner_ref: Ref
    epoch: int = Field(ge=0)
    measured_min: str
    measured_max: str
    independent_error_min: int = Field(ge=0, le=4096)
    independent_error_max: int = Field(ge=0, le=4096)
    independent_error_count_evidence_ref: Ref
    @model_validator(mode='after')
    def intervals(self):
        if Fraction(self.measured_min)>Fraction(self.measured_max) or self.independent_error_min>self.independent_error_max:raise ValueError('ordered independently observed gauge/count intervals')
        return self


class FieldDelta(FrozenModel):
    point: Point
    before_value_ref: Ref
    after_value_ref: Ref


class ReferenceHistory(FrozenModel):
    event_ref: Ref
    event_owner_ref: Ref
    epoch: int = Field(ge=0)
    input_ref: Ref
    deltas: tuple[FieldDelta, ...] = Field(max_length=4096)
    sealed: bool
    all_affected_cells_observed: bool
    gauge_ref: Ref | None = None
    licensed_before_error_interval: tuple[int,int] | None = None
    licensed_after_error_interval: tuple[int,int] | None = None
    @model_validator(mode='after')
    def addresses(self):
        if len({d.point for d in self.deltas})!=len(self.deltas):raise ValueError('a per-input field delta names each changed cell once')
        for interval in (self.licensed_before_error_interval,self.licensed_after_error_interval):
            if interval is not None and (interval[0]<0 or interval[0]>interval[1]):raise ValueError('ordered licensed error interval')
        return self


class CoupledEditRow(FrozenModel):
    input_ref: Ref
    conditions: tuple[ReferenceCell, ...] = Field(min_length=1,max_length=128)
    after_cells: tuple[ReferenceCell, ...] = Field(min_length=1,max_length=128)


class FieldEditLaw(FrozenModel):
    law_ref: Ref
    event_owner_ref: Ref
    current_revalidation_epoch: int = Field(ge=0)
    kind: Literal['CORRECTION_BREAK_TOGGLE','VALUE_CYCLE','PAINT','COUPLED_TABLE']
    value_cycle: tuple[Ref, ...] = Field(max_length=128)
    coupled_rows: tuple[CoupledEditRow, ...] = Field(max_length=256)
    status: Literal['SUPPORTED','HYPOTHESIS']
    isolation: Literal['INDEPENDENT_ONE_CELL','COUPLED','UNKNOWN']
    isolation_evidence_ref: Ref | None = None
    isolation_domain_complete: bool
    @model_validator(mode='after')
    def effect(self):
        if self.kind=='VALUE_CYCLE' and (not self.value_cycle or len(set(self.value_cycle))!=len(self.value_cycle)):raise ValueError('explicit ordered value cycle, never a palette-index tie break')
        if self.kind=='COUPLED_TABLE' and not self.coupled_rows:raise ValueError('supplied finite coupled effects')
        if self.isolation=='INDEPENDENT_ONE_CELL' and self.kind=='COUPLED_TABLE':raise ValueError('coupled laws are not silently declared isolated')
        return self


class EditLawObservation(FrozenModel):
    history: ReferenceHistory
    before_state: ReferenceState
    tested_input: ReferenceInput
    reference: ReferenceField


class AttemptedReferenceInput(FrozenModel):
    input_ref: Ref
    level_scope_ref: Ref
    lattice_ref: Ref
    epoch: int = Field(ge=0)
    restore_epoch: int = Field(ge=0)
    remaining_budget: int = Field(ge=0, le=65536)
    field_values: tuple[ReferenceCell, ...] = Field(min_length=1,max_length=4096)
    saved_alternatives: tuple[ReferenceCell, ...] = Field(max_length=4096)
    restoration_was_observed: bool


class RestorationRequest(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.latent_reference_request.v1'
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None = None
    maximum_evaluations: int = Field(ge=1, le=65536)
    maximum_states: int = Field(ge=1, le=4096)
    maximum_depth: int = Field(ge=0, le=256)
    maximum_references: int = Field(ge=1, le=128)
    state: ReferenceState | None = None
    homology_models: tuple[HomologyModel, ...] = Field(default=(),max_length=128)
    intact_witnesses: tuple[IntactWitness, ...] = Field(default=(),max_length=4096)
    omission_models: tuple[OmissionHypothesis, ...] = Field(default=(),max_length=128)
    references: tuple[ReferenceField, ...] = Field(default=(),max_length=128)
    established_references: tuple[ReferenceField, ...] = Field(default=(),max_length=128)
    bound_reference_ref: Ref | None = None
    gauge_models: tuple[GaugeModel, ...] = Field(default=(),max_length=128)
    gauge_observations: tuple[GaugeObservation, ...] = Field(default=(),max_length=256)
    current_gauge_min: str | None = None
    current_gauge_max: str | None = None
    edit_laws: tuple[FieldEditLaw, ...] = Field(default=(),max_length=128)
    bound_edit_law_ref: Ref | None = None
    input_ref: Ref | None = None
    histories: tuple[ReferenceHistory, ...] = Field(default=(),max_length=256)
    edit_observations: tuple[EditLawObservation, ...] = Field(default=(),max_length=256)
    attempted_inputs: tuple[AttemptedReferenceInput, ...] = Field(default=(),max_length=256)
    expected_state: ReferenceState | None = None
    actual_state: ReferenceState | None = None
    raw_layer_pixels: tuple[ContactPixel, ...] = Field(default=(),max_length=65536)
    layer_templates: tuple[ReferenceLayerTemplate, ...] = Field(default=(),max_length=4096)
    layer_samples: tuple[ContactLayerSample, ...] = Field(default=(),max_length=4096)
    grid_input: PeriodicCellGridInput | None = None
    lattice_candidates: tuple[ReferenceLattice, ...] = Field(default=(),max_length=32)
    @model_validator(mode='after')
    def identities(self):
        for rows,name in ((self.homology_models,'model_ref'),(self.references,'reference_ref'),(self.gauge_models,'gauge_ref'),(self.edit_laws,'law_ref')):
            if len({getattr(r,name) for r in rows})!=len(rows):raise ValueError('distinct scoped model/reference identities')
        if self.current_gauge_min is not None and self.current_gauge_max is not None and Fraction(self.current_gauge_min)>Fraction(self.current_gauge_max):raise ValueError('current gauge measurement interval')
        return self


OPERATION_MODES={'field_measurement':'MEASURE','homology_domains':'DOMAIN','reference_consensus':'INVERSE_DOMAIN','indicator_contract':'FIT','joint_reference_filter':'PRECONDITION',
    'local_edit_law':'FIT','repair_candidates':'INVERSE_DOMAIN','fixed_reference_step':'STEP','repair_composition':'DOMAIN','completion_and_revision':'COMPARE'}


def _field(cells):
    return {c.point:c.value_ref for c in cells}


def _valid_reference(reference,state,scope):
    return reference.level_scope_ref==state.level_scope_ref and reference.lattice_ref==state.lattice_ref and reference.current_revalidation_epoch==scope.epoch and set(_field(reference.cells))==set(_field(state.cells))


def _errors(state,reference):
    expected=_field(reference.cells)
    return sum(c.value_ref!=expected[c.point] for c in state.cells)


def _homology(state,model,remaining):
    points=tuple(sorted(c.point for c in state.cells));cost=len(points)*max(1,len(model.transforms))
    if cost>remaining:return None,0,{'phase':'homology_classes','model_ref':model.model_ref},()
    groups={};outside=[]
    if model.kind=='PERIODIC':
        for x,y in points:
            key=((x-model.phase[0])%model.period[0],(y-model.phase[1])%model.period[1]);groups.setdefault(key,[]).append((x,y))
    else:
        parents={p:p for p in points}
        def root(p):
            path=[]
            while parents[p]!=p:path.append(p);p=parents[p]
            for member in path:parents[member]=p
            return p
        for p in points:
            for t in model.transforms:
                q=tuple(sum(a*b for a,b in zip(row,p))+offset for row,offset in zip(t.matrix,t.offset))
                if q not in parents:outside.append((p,t.transform_ref,q));continue
                a,b=root(p),root(q)
                if a!=b:parents[max(a,b)]=min(a,b)
        for p in points:groups.setdefault(root(p),[]).append(p)
    classes=tuple(tuple(groups[k]) for k in sorted(groups))
    return classes,cost,{},tuple(outside)


def _domains(request):
    rows=[];count=0;cuts=[]
    for model in request.homology_models:
        classes,work,cut,outside=_homology(request.state,model,request.maximum_evaluations-count);count+=work
        if cut:cuts.append(cut);break
        rows.append({'model_ref':model.model_ref,'classes':classes,'orbit_sizes':tuple(len(c) for c in classes),'outside_measured_domain':outside,'declared_domain_complete':model.declared_domain_complete,'faulty_occurrences_identified':False})
    return family_result(request,values={'correspondence_classes':rows},examined_count=count,domain_complete=not cuts and all(m.declared_domain_complete for m in request.homology_models) and not any(r['outside_measured_domain'] for r in rows),computation_bound_reached=bool(cuts),frontier={'cuts':cuts} if cuts else {})


def _consensus(request):
    field=_field(request.state.cells);references=[];classes_out=[];unknown=[];refuted=[];count=0;cuts=[]
    witnesses=tuple(w for w in request.intact_witnesses if w.event_owner_ref==request.scope.event_owner_ref and w.epoch==request.scope.epoch)
    for model in request.homology_models:
        classes,work,cut,outside=_homology(request.state,model,request.maximum_evaluations-count);count+=work
        if cut:cuts.append(cut);break
        if outside:unknown.append((model.model_ref,'unobserved_members_of_correspondence_orbits'))
        omissions=tuple(o for o in request.omission_models if o.model_ref==model.model_ref)
        for omission in omissions or (None,):
            choices=[];supports=[];contradiction=False
            for points in classes:
                cost=len(points)+len(witnesses)+(len(omission.allowed_value_refs)*len(points) if omission else 0)
                if count+cost>request.maximum_evaluations:cuts.append({'phase':'reference_class_consensus','model_ref':model.model_ref,'next_class_index':len(choices)});break
                count+=cost;intact=tuple(w for w in witnesses if w.point in points);values=set(w.value_ref for w in intact)
                if any(field.get(w.point)!=w.value_ref for w in intact) or len(values)>1:contradiction=True;break
                if values:allowed=tuple(sorted(values));supports.append(tuple(w.independent_evidence_ref for w in intact))
                elif omission:
                    allowed=tuple(v for v in omission.allowed_value_refs if sum(field[p]!=v for p in points)<=omission.maximum_errors_per_class and sum(field[p]==v for p in points)>=omission.minimum_intact_support);supports.append(())
                else:allowed=();supports.append(())
                choices.append(allowed)
            classes_out.append({'model_ref':model.model_ref,'omission_ref':omission.omission_ref if omission else None,'classes':classes,'value_alternatives':tuple(choices),'outside_domain':outside})
            if contradiction:refuted.append((model.model_ref,'independent_intact_witness_contradiction'));continue
            if len(choices)!=len(classes) or not all(choices):unknown.append((model.model_ref,'supported_reference_value_for_each_class'));continue
            for product_index,values in enumerate(product(*choices)):
                cost=len(field)
                if len(references)>=request.maximum_references or count+cost>request.maximum_evaluations:
                    cuts.append({'phase':'reference_product','model_ref':model.model_ref,'omission_ref':omission.omission_ref if omission else None,'next_product_index':product_index});break
                count+=cost;cells=tuple(ReferenceCell(point=p,value_ref=v) for points,v in zip(classes,values) for p in points)
                references.append(ReferenceField(reference_ref=f'{request.scope.request_ref}.reference.{len(references)}',homology_model_ref=model.model_ref,cells=cells,
                    level_scope_ref=request.state.level_scope_ref,lattice_ref=request.state.lattice_ref,current_revalidation_epoch=request.scope.epoch,status='HYPOTHESIS',
                    supporting_evidence_refs=tuple(dict.fromkeys(ref for refs in supports for ref in refs)),omission_model_ref=omission.omission_ref if omission else None))
    return family_result(request,values={'reference_candidates':references,'class_consensus_alternatives':classes_out,'refuted_models':refuted,'unknown_models':unknown,'palette_rank_tie_break':False},examined_count=count,
        domain_complete=not cuts and not unknown and all(m.declared_domain_complete for m in request.homology_models),computation_bound_reached=bool(cuts),frontier={'cuts':cuts} if cuts else {})


def _licensed(gauge,scope):
    return gauge.event_owner_ref==scope.event_owner_ref and gauge.current_revalidation_epoch==scope.epoch and gauge.license_status=='SUPPORTED' and gauge.independent_of_reference_estimate and all((gauge.units_evidence_ref,gauge.zero_evidence_ref,gauge.direction_evidence_ref,gauge.scale_evidence_ref,gauge.saturation_evidence_ref))


def _gauge_value(gauge,errors):
    value=Fraction(gauge.zero)+Fraction(gauge.scale)*errors
    if gauge.lower_saturation is not None:value=max(value,Fraction(gauge.lower_saturation))
    if gauge.upper_saturation is not None:value=min(value,Fraction(gauge.upper_saturation))
    return value


def _indicator(request):
    rows=[];refuted=[];unknown=[];count=0;cuts=[]
    for index,gauge in enumerate(request.gauge_models):
        if gauge.event_owner_ref!=request.scope.event_owner_ref or gauge.current_revalidation_epoch!=request.scope.epoch:
            unknown.append((gauge.gauge_ref,'current_revalidated_indicator_model'));continue
        compatible=True;observed=False
        for o in request.gauge_observations:
            if o.event_owner_ref!=request.scope.event_owner_ref or o.epoch!=request.scope.epoch:unknown.append((gauge.gauge_ref,'current_independent_gauge_observation'));continue
            lo=max(o.independent_error_min,gauge.licensed_error_min);hi=min(o.independent_error_max,gauge.licensed_error_max)
            if lo>hi:unknown.append((gauge.gauge_ref,'measured_count_outside_licensed_range'));continue
            if count+hi-lo+1>request.maximum_evaluations:cuts.append({'phase':'indicator_fit','next_model_index':index,'observation_ref':o.observation_ref});break
            count+=hi-lo+1;observed=True
            if not any(Fraction(o.measured_min)<=_gauge_value(gauge,n)<=Fraction(o.measured_max) for n in range(lo,hi+1)):compatible=False
        if cuts:break
        if not compatible:refuted.append(gauge.gauge_ref);continue
        if not observed:unknown.append((gauge.gauge_ref,'independent_count_measurements'))
        allowed=None
        if request.current_gauge_min is not None and request.current_gauge_max is not None:
            work=gauge.licensed_error_max-gauge.licensed_error_min+1
            if count+work>request.maximum_evaluations:cuts.append({'phase':'current_indicator_inverse','next_model_index':index});break
            count+=work;allowed=tuple(n for n in range(gauge.licensed_error_min,gauge.licensed_error_max+1) if Fraction(request.current_gauge_min)<=_gauge_value(gauge,n)<=Fraction(request.current_gauge_max))
        rows.append({'gauge_model':gauge,'independent_absolute_license':_licensed(gauge,request.scope) and observed,'current_error_candidates':allowed,'unlimited_linearity_proved':False})
    return family_result(request,values={'compatible_indicator_models':rows,'refuted_indicator_refs':refuted,'unresolved_indicator_refs':unknown},examined_count=count,domain_complete=not cuts and not unknown,computation_bound_reached=bool(cuts),frontier={'cuts':cuts} if cuts else {})


def _filter(request):
    candidates=[];keys=set()
    for ref in request.references+request.established_references:
        if ref.reference_ref not in keys:candidates.append(ref);keys.add(ref.reference_ref)
    retained=[];refuted=[];unknown=[];count=0;cuts=[];licensed=tuple(g for g in request.gauge_models if _licensed(g,request.scope));gauge_by_ref={g.gauge_ref:g for g in licensed}
    for index,reference in enumerate(candidates):
        if not _valid_reference(reference,request.state,request.scope):unknown.append((reference.reference_ref,'current_reference_scope_lattice_revalidation'));continue
        if count+len(request.state.cells)>request.maximum_evaluations:cuts.append({'phase':'joint_reference_filter','next_reference_index':index});break
        count+=len(request.state.cells);errors=_errors(request.state,reference);causes=[];field=_field(reference.cells)
        if licensed and request.current_gauge_min is not None and request.current_gauge_max is not None:
            admissible=tuple(g for g in licensed if g.licensed_error_min<=errors<=g.licensed_error_max)
            if admissible and not any(Fraction(request.current_gauge_min)<=_gauge_value(g,errors)<=Fraction(request.current_gauge_max) for g in admissible):causes.append('independently_licensed_current_indicator')
            if not admissible:unknown.append((reference.reference_ref,'indicator_count_outside_licensed_domain'))
        for history in request.histories:
            if count+len(history.deltas)>request.maximum_evaluations:cuts.append({'phase':'joint_reference_history','reference_ref':reference.reference_ref,'next_event_ref':history.event_ref});break
            count+=len(history.deltas)
            current=history.sealed and history.all_affected_cells_observed and history.event_owner_ref==request.scope.event_owner_ref and history.epoch==request.scope.epoch
            if not current or history.gauge_ref not in gauge_by_ref or history.licensed_before_error_interval is None or history.licensed_after_error_interval is None:continue
            if any(d.point not in field for d in history.deltas):causes.append('history_outside_reference_field');continue
            delta=sum((d.after_value_ref!=field[d.point])-(d.before_value_ref!=field[d.point]) for d in history.deltas)
            before=history.licensed_before_error_interval;after=history.licensed_after_error_interval
            if max(before[0]+delta,after[0])>min(before[1]+delta,after[1]):causes.append(history.event_ref)
        if cuts:break
        if causes:refuted.append((reference.reference_ref,tuple(causes)))
        else:retained.append(reference)
    agreement=[];retained_fields=tuple(_field(r.cells) for r in retained)
    for cell_index,cell in enumerate(request.state.cells):
        if count+len(retained_fields)>request.maximum_evaluations:
            cuts.append({'phase':'reference_cell_agreement','next_cell_index':cell_index});break
        count+=len(retained_fields);values=tuple(sorted({field[cell.point] for field in retained_fields}))
        agreement.append({'point':cell.point,'admissible_value_refs':values,'unique_correction':len(values)==1})
    return family_result(request,values={'retained_fixed_references':retained,'refuted_reference_causes':refuted,'unknown_references':unknown,'cellwise_reference_agreement':agreement,
        'established_reference_replaced_by_denoiser':False},examined_count=count,domain_complete=not cuts and not unknown,computation_bound_reached=bool(cuts),frontier={'cuts':cuts} if cuts else {})


def _edit(state,reference,law,action):
    cells=_field(state.cells);expected=_field(reference.cells);saved=_field(state.saved_alternatives);changes={};debt=[]
    if state.official_outcome not in ('ACTIVE','UNKNOWN'):return None,(),('qualified_active_field_execution_scope',)
    if not state.bindings_current or action not in state.inputs:return None,(),('current_lattice_input_binding',)
    if action.cost>state.remaining_budget:return None,(),('financed_field_edit',)
    if law.kind=='CORRECTION_BREAK_TOGGLE':
        if cells[action.point]!=expected[action.point]:saved[action.point]=cells[action.point];changes[action.point]=expected[action.point]
        elif action.point in saved and saved[action.point]!=expected[action.point]:changes[action.point]=saved[action.point]
        else:debt.append('recorded_nonreference_alternative_for_break_toggle')
    elif law.kind=='VALUE_CYCLE':
        if cells[action.point] not in law.value_cycle:debt.append('current_value_in_scoped_cycle')
        else:changes[action.point]=law.value_cycle[(law.value_cycle.index(cells[action.point])+1)%len(law.value_cycle)]
    elif law.kind=='PAINT':
        if action.paint_value_ref is None:debt.append('bound_paint_payload_value')
        else:changes[action.point]=action.paint_value_ref
    else:
        rows=tuple(r for r in law.coupled_rows if r.input_ref==action.input_ref and all(cells.get(c.point)==c.value_ref for c in r.conditions))
        if len(rows)!=1:debt.append('unique_current_coupled_effect_row')
        elif len({c.point for c in rows[0].after_cells})!=len(rows[0].after_cells) or any(c.point not in cells for c in rows[0].after_cells):debt.append('distinct_current_coupled_effect_cells')
        else:changes=_field(rows[0].after_cells)
    if debt:return None,(),tuple(debt)
    deltas=tuple(FieldDelta(point=p,before_value_ref=cells[p],after_value_ref=changes[p]) for p in sorted(changes) if cells[p]!=changes[p])
    cells.update(changes);after=state.model_copy(update={'cells':tuple(ReferenceCell(point=p,value_ref=cells[p]) for p in sorted(cells)),
        'saved_alternatives':tuple(ReferenceCell(point=p,value_ref=saved[p]) for p in sorted(saved)),'remaining_budget':state.remaining_budget-action.cost})
    return after,deltas,()


def _law_fit(request):
    retained=[];refuted=[];unknown=[];count=0;cuts=[]
    for law_index,law in enumerate(request.edit_laws):
        if law.event_owner_ref!=request.scope.event_owner_ref or law.current_revalidation_epoch!=request.scope.epoch:
            unknown.append((law.law_ref,'current_revalidated_edit_law'));continue
        supports=[];contradictions=[];missing=[]
        for observation in request.edit_observations:
            history=observation.history;work=len(observation.before_state.cells)+len(history.deltas)+sum(len(r.conditions)+len(r.after_cells) for r in law.coupled_rows)
            if count+work>request.maximum_evaluations:cuts.append({'phase':'local_edit_fit','next_law_index':law_index,'event_ref':history.event_ref});break
            count+=work
            if not history.sealed or not history.all_affected_cells_observed or history.event_owner_ref!=request.scope.event_owner_ref or history.epoch!=request.scope.epoch or history.input_ref!=observation.tested_input.input_ref or not _valid_reference(observation.reference,observation.before_state,request.scope):missing.append(history.event_ref);continue
            after,deltas,debt=_edit(observation.before_state,observation.reference,law,observation.tested_input)
            if debt:missing.append((history.event_ref,debt));continue
            actual=tuple(sorted(history.deltas,key=lambda d:d.point))
            if deltas!=actual:contradictions.append(history.event_ref)
            else:supports.append(history.event_ref)
        if cuts:break
        if contradictions:refuted.append((law.law_ref,tuple(contradictions)))
        elif supports:retained.append({'edit_law':law,'observed_scope_event_refs':supports,'unresolved_event_refs':missing,'single_success_proves_universal_isolation':False})
        else:unknown.append((law.law_ref,tuple(missing) or ('owned_observed_edit',)))
    return family_result(request,values={'compatible_edit_laws':retained,'refuted_edit_laws':refuted,'unknown_edit_laws':unknown},examined_count=count,domain_complete=not cuts and not unknown,computation_bound_reached=bool(cuts),frontier={'cuts':cuts} if cuts else {})


def _attempted(request,state,action):
    field=tuple(sorted(state.cells,key=lambda c:c.point));saved=tuple(sorted(state.saved_alternatives,key=lambda c:c.point))
    return any(a.input_ref==action.input_ref and a.level_scope_ref==state.level_scope_ref and a.lattice_ref==state.lattice_ref and a.epoch==request.scope.epoch and a.restore_epoch==state.restore_epoch and a.remaining_budget==state.remaining_budget
        and tuple(sorted(a.field_values,key=lambda c:c.point))==field and tuple(sorted(a.saved_alternatives,key=lambda c:c.point))==saved and not a.restoration_was_observed for a in request.attempted_inputs)


def _repair_candidates(request):
    references=tuple(r for r in request.references if _valid_reference(r,request.state,request.scope));rows=[];count=0;cuts=[];unknown=[]
    if not references:return family_result(request,prerequisite_refs=('current_admissible_fixed_references',),domain_complete=False)
    for index,action in enumerate(request.state.inputs):
        outcomes=[]
        for reference in references:
            for law in request.edit_laws:
                if law.event_owner_ref!=request.scope.event_owner_ref or law.current_revalidation_epoch!=request.scope.epoch:
                    unknown.append((action.input_ref,law.law_ref,'current_revalidated_edit_law'));continue
                work=len(request.state.cells)+sum(len(r.conditions)+len(r.after_cells) for r in law.coupled_rows)
                if count+work>request.maximum_evaluations:cuts.append({'phase':'repair_alternatives','next_input_index':index,'reference_ref':reference.reference_ref,'law_ref':law.law_ref});break
                count+=work;after,deltas,debt=_edit(request.state,reference,law,action)
                if debt:unknown.append((action.input_ref,reference.reference_ref,law.law_ref,debt));continue
                old_errors=_errors(request.state,reference);new_errors=_errors(after,reference)
                restoration=None
                if law.kind=='CORRECTION_BREAK_TOGGLE' and law.isolation=='INDEPENDENT_ONE_CELL' and law.status=='SUPPORTED' and law.isolation_evidence_ref and law.isolation_domain_complete:
                    restored,_,restore_debt=_edit(after,reference,law,action)
                    if not restore_debt and _field(restored.cells)==_field(request.state.cells):restoration={'input_word':(action.input_ref,action.input_ref),'restores_current_field':True}
                outcomes.append({'reference_ref':reference.reference_ref,'law_ref':law.law_ref,'deltas':deltas,'before_errors':old_errors,'after_errors':new_errors,'restoration_plan':restoration,
                    'supported_independent_effect':law.status=='SUPPORTED' and law.isolation=='INDEPENDENT_ONE_CELL' and bool(law.isolation_evidence_ref) and law.isolation_domain_complete})
            if cuts:break
        if cuts:break
        values=tuple(sorted({_field(r.cells)[action.point] for r in references}));complete=len(outcomes)==len(references)*len(request.edit_laws)
        repair=complete and bool(outcomes) and len(values)==1 and all(o['after_errors']<o['before_errors'] and o['supported_independent_effect'] for o in outcomes)
        signatures=tuple((o['reference_ref'],o['law_ref'],tuple((d.point,d.after_value_ref) for d in o['deltas'])) for o in outcomes)
        rows.append({'input':action,'expected_reference_values':values,'conditional_repair':repair,'robust_correction_coverage':repair and request.scope.input_domain_complete,'informative_test':not repair and len({s[2] for s in signatures})>1,
            'outcomes':outcomes,'preserved_neighbors_explicit':repair,'identical_context_already_attempted':_attempted(request,request.state,action),'unique_period_required':False})
    return family_result(request,values={'candidate_repairs_or_experiments':rows,'unresolved_effects':unknown},examined_count=count,domain_complete=not cuts and not unknown,computation_bound_reached=bool(cuts),frontier={'cuts':cuts} if cuts else {})


def _step_result(request,reference,law,action):
    work=len(request.state.cells)+sum(len(r.conditions)+len(r.after_cells) for r in law.coupled_rows)
    if work>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'fixed_reference_edit'})
    after,deltas,debt=_edit(request.state,reference,law,action)
    before_errors=_errors(request.state,reference);after_errors=_errors(after,reference) if after else None;gauges=[]
    if after:
        for gauge in request.gauge_models:
            if _licensed(gauge,request.scope) and gauge.licensed_error_min<=after_errors<=gauge.licensed_error_max:gauges.append((gauge.gauge_ref,str(_gauge_value(gauge,after_errors))))
    structural=None;structural_debt=();cut={}
    model=next((m for m in request.homology_models if m.model_ref==reference.homology_model_ref),None)
    if after and model is not None:
        classes,count,cut,outside=_homology(after,model,request.maximum_evaluations-work);work+=count
        if classes is not None:
            field=_field(after.cells);structural=tuple(points for points in classes if len({field[p] for p in points})>1)
            if outside:structural_debt=('complete_current_homology_orbits',)
    elif after:structural_debt=('current_structural_correspondence_model',)
    return family_result(request,values={'after_state':after,'fixed_reference_ref':reference.reference_ref,'actual_predicted_delta':deltas,'reference_error_before':before_errors,'reference_error_after':after_errors,
        'structural_disagreement_classes':structural,'unresolved_structural_diagnostics':structural_debt,'licensed_indicator_predictions':gauges,'external_command_count':int(after is not None),'official_success_inferred':False},
        prerequisite_refs=debt,examined_count=work,domain_complete=not debt and not cut,computation_bound_reached=bool(cut),frontier=cut)


def _isolated_toggle(reference,law):
    return reference.status=='ESTABLISHED' and law.status=='SUPPORTED' and law.kind=='CORRECTION_BREAK_TOGGLE' and law.isolation=='INDEPENDENT_ONE_CELL' and law.isolation_domain_complete and bool(law.isolation_evidence_ref)


def _independent_composition(request,reference,law):
    """Compile the caller's input order with deltas, without subset-state BFS."""
    if len(request.state.cells)>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'independent_field_setup'})
    if request.state.official_outcome not in ('ACTIVE','UNKNOWN'):return family_result(request,prerequisite_refs=('qualified_active_field_execution_scope',),domain_complete=False)
    cells=_field(request.state.cells);target=_field(reference.cells);saved=_field(request.state.saved_alternatives)
    pending={p for p in cells if cells[p]!=target[p]};lower_bound=len(pending);budget=request.state.remaining_budget;word=[];effects=[];count=len(cells);cut={};boundaries=[]
    if not request.state.bindings_current:return family_result(request,prerequisite_refs=('current_lattice_input_bindings',),domain_complete=False)
    for index,action in enumerate(request.state.inputs):
        if action.point not in pending:continue
        work=1+sum(len(a.field_values)+len(a.saved_alternatives) for a in request.attempted_inputs)
        if count+work>request.maximum_evaluations or len(word)>=request.maximum_depth:
            cut={'phase':'independent_repair_prefix','next_input_index':index};break
        count+=work
        if action.cost>budget:boundaries.append((action.input_ref,'financed_remaining_repair'));continue
        attempted=any(a.input_ref==action.input_ref and a.level_scope_ref==request.state.level_scope_ref and a.lattice_ref==request.state.lattice_ref and a.epoch==request.scope.epoch
            and a.restore_epoch==request.state.restore_epoch and a.remaining_budget==budget and _field(a.field_values)==cells and _field(a.saved_alternatives)==saved and not a.restoration_was_observed for a in request.attempted_inputs)
        if attempted:boundaries.append((action.input_ref,'identical_actual_context_attempted'));continue
        before=cells[action.point];saved[action.point]=before;cells[action.point]=target[action.point];pending.remove(action.point);budget-=action.cost
        word.append(action.input_ref);effects.append({'input':action,'delta':FieldDelta(point=action.point,before_value_ref=before,after_value_ref=target[action.point])})
    after=request.state.model_copy(update={'cells':tuple(ReferenceCell(point=p,value_ref=cells[p]) for p in sorted(cells)),
        'saved_alternatives':tuple(ReferenceCell(point=p,value_ref=saved[p]) for p in sorted(saved)),'remaining_budget':budget})
    if pending and not cut:boundaries.append(('remaining_points_without_admissible_bound_input',tuple(sorted(pending))))
    return family_result(request,values={'fixed_reference_ref':reference.reference_ref,'supplied_input_order_prefix':tuple(word),'independent_delta_effects':effects,'after_prefix_state':after,
        'remaining_divergent_points':tuple(sorted(pending)),'divergent_cell_lower_bound':lower_bound,'one_edit_per_divergent_cell_attains_lower_bound':not pending and len(word)==lower_bound,
        'minimum_command_cost_proved':False,'official_completion_attested':False,'exploratory_work_counted_as_solved':False,'observation_boundaries':boundaries},examined_count=count,
        domain_complete=not pending and not cut and not boundaries,computation_bound_reached=bool(cut),frontier=cut)


def _composition(request,reference,law):
    if _isolated_toggle(reference,law):return _independent_composition(request,reference,law)
    nodes=[request.state];words=[()];depths=[0];queue=deque([0]);seen={request.state:0};edges=[];cuts=[];boundaries=[];count=0
    while queue:
        index=queue.popleft();state=nodes[index]
        if _errors(state,reference)==0 or state.official_outcome not in ('ACTIVE','UNKNOWN'):continue
        if depths[index]>=request.maximum_depth:cuts.append({'node':index,'reason':'depth_bound'});continue
        for input_index,action in enumerate(state.inputs):
            if _attempted(request,state,action):continue
            work=len(state.cells)+sum(len(r.conditions)+len(r.after_cells) for r in law.coupled_rows)
            if count+work>request.maximum_evaluations:cuts.append({'node':index,'next_input_index':input_index,'reason':'evaluation_bound'});queue.clear();break
            count+=work;after,deltas,debt=_edit(state,reference,law,action)
            if debt:boundaries.append({'node':index,'input_ref':action.input_ref,'prerequisite_refs':debt});continue
            child=seen.get(after)
            if child is None:
                if len(nodes)>=request.maximum_states:cuts.append({'node':index,'next_input_index':input_index,'reason':'state_bound'});continue
                child=len(nodes);seen[after]=child;nodes.append(after);words.append(words[index]+(action.input_ref,));depths.append(depths[index]+1);queue.append(child)
            edges.append({'from_node':index,'to_node':child,'input':action,'deltas':deltas,'fixed_reference_ref':reference.reference_ref})
    initial=_errors(request.state,reference);isolated=_isolated_toggle(reference,law)
    witnesses=tuple({'input_word':words[i],'after_state':s,'reference_predicate':True,'exploratory_work_counted_as_solved':False} for i,s in enumerate(nodes) if _errors(s,reference)==0)
    attained=isolated and any(len(w['input_word'])==initial for w in witnesses)
    return family_result(request,values={'joint_field_states':nodes,'actual_edit_edges':edges,'repair_words':witnesses,'divergent_cell_lower_bound':initial if isolated else None,
        'one_edit_per_divergent_cell_attains_lower_bound':attained,'official_completion_attested':False,'observation_boundaries':boundaries},examined_count=count,
        domain_complete=not cuts and not boundaries,computation_bound_reached=bool(cuts),frontier={'cuts':cuts,'pending_nodes':tuple(queue)} if cuts else {})


def _completion(request):
    actual=request.actual_state;expected=request.expected_state;current=tuple(r for r in request.references if _valid_reference(r,actual,request.scope));count=0;rows=[];cuts=[]
    for index,reference in enumerate(current):
        if count+len(actual.cells)>request.maximum_evaluations:cuts.append({'phase':'fixed_reference_completion','next_reference_index':index});break
        count+=len(actual.cells);errors=_errors(actual,reference)
        rows.append({'reference_ref':reference.reference_ref,'fixed_reference_errors':errors,'predicate_satisfied':errors==0,'official_success':actual.official_outcome=='WIN',
            'coherent_field_without_acceptance':errors==0 and actual.official_outcome!='WIN'})
    fields=tuple((name,getattr(expected,name),getattr(actual,name)) for name in ('cells','saved_alternatives','remaining_budget','lattice_ref','level_scope_ref','restore_epoch','official_outcome') if
        (_field(getattr(expected,name))!=_field(getattr(actual,name)) if name in ('cells','saved_alternatives') else getattr(expected,name)!=getattr(actual,name)))
    stale_histories=tuple(h.event_ref for h in request.histories if not h.sealed or not h.all_affected_cells_observed or h.event_owner_ref!=request.scope.event_owner_ref or h.epoch!=request.scope.epoch)
    gauge_conflicts=[]
    if request.current_gauge_min is not None and request.current_gauge_max is not None:
        licensed=tuple(g for g in request.gauge_models if _licensed(g,request.scope))
        for row in rows:
            errors=row['fixed_reference_errors'];admissible=tuple(g for g in licensed if g.licensed_error_min<=errors<=g.licensed_error_max)
            if admissible and not any(Fraction(request.current_gauge_min)<=_gauge_value(g,errors)<=Fraction(request.current_gauge_max) for g in admissible):gauge_conflicts.append(row['reference_ref'])
    return family_result(request,values={'reference_and_official_predicates':rows,'predicted_actual_differences':fields,'edit_history_retained':request.histories,
        'unverified_history_refs':stale_histories,'licensed_gauge_contradiction_refs':gauge_conflicts,'wrong_coherent_reference_or_missing_acceptance':any(r['coherent_field_without_acceptance'] for r in rows),'reference_revised_automatically':False},
        prerequisite_refs=(() if current else ('current_revalidated_reference',))+(() if not stale_histories else ('current_sealed_reference_edit_history',)),examined_count=count,domain_complete=bool(current) and not cuts and not stale_histories,computation_bound_reached=bool(cuts),frontier={'cuts':cuts} if cuts else {})


def measure_latent_reference_restoration(request: RestorationRequest) -> MechanicalFamilyResult:
    if request.mode is None or OPERATION_MODES.get(request.operation_ref)!=request.mode:return family_result(request,signature_supported=False,domain_complete=False)
    op=request.operation_ref;required={'field_measurement':('raw_layer_pixels','layer_templates','grid_input','lattice_candidates'),'homology_domains':('state','homology_models'),
        'reference_consensus':('state','homology_models'),'indicator_contract':('gauge_models','gauge_observations'),'joint_reference_filter':('state',),
        'local_edit_law':('edit_laws','edit_observations'),'repair_candidates':('state','references','edit_laws'),'fixed_reference_step':('state','references','bound_reference_ref','edit_laws','bound_edit_law_ref','input_ref'),
        'repair_composition':('state','references','bound_reference_ref','edit_laws','bound_edit_law_ref'),'completion_and_revision':('references','expected_state','actual_state')}
    missing=missing_supplied_fields(request,required[op])
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    model_fields={'homology_domains':'homology_models','reference_consensus':'homology_models','indicator_contract':'gauge_models','local_edit_law':'edit_laws','repair_candidates':'edit_laws'}
    if op in model_fields and not getattr(request,model_fields[op]):return family_result(request,prerequisite_refs=('declared_finite_'+model_fields[op],),domain_complete=False)
    if op=='field_measurement':
        measured=translated_layers(request);grids=enumerate_periodic_cell_grids(request.grid_input);values=dict(measured.values);lattices={l.lattice_ref:l for l in request.lattice_candidates};templates={t.template_ref:t for t in request.layer_templates}
        compatible=tuple(l.lattice_ref for l in request.lattice_candidates if any(l.pitch==(g.cell_width+g.col_gap,g.cell_height+g.row_gap) and l.content==(g.cell_width,g.cell_height) and (l.origin[0]%l.pitch[0],l.origin[1]%l.pitch[1])==(g.col_offset%l.pitch[0],g.row_offset%l.pitch[1]) for g in grids.candidates))
        rows=[]
        for sample in values.get('measured_layer_alternatives',())+values.get('possible_layer_alternatives',()):
            t=templates[sample['template_ref']];l=lattices.get(t.lattice_ref)
            grounded=l is not None and l.lattice_ref in compatible and t.logical_point in l.cell_addresses and t.interior_offset is not None and t.origin==tuple(o+p*a+i for o,p,a,i in zip(l.origin,l.pitch,t.logical_point,t.interior_offset))
            rows.append({'physical_measurement':sample,'component':t.component,'logical_point':t.logical_point,'value_candidate_ref':t.value_candidate_ref,'physical_grid_consistent':grounded,'outline_is_cell_value':False,'border_is_repair_input':False})
        return measured.model_copy(update={'values':immutable_json_data({**values,'field_and_overlay_candidates':rows,'measured_periodic_grids':grids,'compatible_lattice_refs':compatible,'raw_layout_is_authority':False})})
    if op=='homology_domains':return _domains(request)
    if op=='reference_consensus':return _consensus(request)
    if op=='indicator_contract':return _indicator(request)
    if op=='joint_reference_filter':
        if not request.references and not request.established_references:return family_result(request,prerequisite_refs=('current_or_established_reference_domain',),domain_complete=False)
        identities={}
        for r in request.references+request.established_references:
            if r.reference_ref in identities and _field(identities[r.reference_ref].cells)!=_field(r.cells):return family_result(request,prerequisite_refs=('consistent_fixed_reference_identity',),domain_complete=False)
            identities[r.reference_ref]=r
        return _filter(request)
    if op=='local_edit_law':return _law_fit(request)
    if op=='repair_candidates':return _repair_candidates(request)
    if op=='completion_and_revision':return _completion(request)
    reference=next((r for r in request.references if r.reference_ref==request.bound_reference_ref),None);law=next((l for l in request.edit_laws if l.law_ref==request.bound_edit_law_ref),None)
    if reference is None or law is None or not _valid_reference(reference,request.state,request.scope) or law.event_owner_ref!=request.scope.event_owner_ref or law.current_revalidation_epoch!=request.scope.epoch:return family_result(request,prerequisite_refs=('current_bound_fixed_reference_and_edit_law',),domain_complete=False)
    if op=='repair_composition':return _composition(request,reference,law)
    action=next((i for i in request.state.inputs if i.input_ref==request.input_ref),None)
    if action is None:return family_result(request,prerequisite_refs=('current_locus_payload_binding',),domain_complete=False)
    return _step_result(request,reference,law,action)
