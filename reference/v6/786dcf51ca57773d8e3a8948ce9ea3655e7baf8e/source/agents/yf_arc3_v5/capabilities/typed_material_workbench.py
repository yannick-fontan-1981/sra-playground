"""Caller-owned typed units, explicit workbench controls and finite balances.

Units have occurrence identity across stock, hand, work and delivery. A diagram
is evidence for a candidate recipe, never a commit command or an inverse law.
"""
from collections import deque
from typing import Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref, immutable_json_data
from .mechanical_family_contracts_a import MechanicalFamilyScope, MechanicalFamilyResult, family_result, missing_supplied_fields
from .identity_contact_authentication import ContactPixel, ContactLayerTemplate, ContactLayerSample, _candidate_layers as translated_layers
from .mutable_kit_survival import KitEventTrace as MaterialEventTrace


class MaterialQuantity(FrozenModel):
    material_ref: Ref
    count: int = Field(ge=1, le=256)


def _counts(rows):
    result={}
    for row in rows:result[row.material_ref]=result.get(row.material_ref,0)+row.count
    return result


def _multiset(materials):
    result={}
    for material in materials:result[material]=result.get(material,0)+1
    return tuple(sorted(result.items()))


class MaterialUnit(FrozenModel):
    unit_ref: Ref
    material_ref: Ref
    owner: Literal['STOCK','HELD','WORK','DELIVERY']
    holder_ref: Ref | None = None
    @model_validator(mode='after')
    def ownership(self):
        if (self.owner in ('WORK','DELIVERY'))!=(self.holder_ref is not None):raise ValueError('slot ownership and free/held ownership remain distinct')
        return self


class MaterialHolder(FrozenModel):
    holder_ref: Ref
    kind: Literal['WORK','DELIVERY']
    requested_type_ref: Ref | None = None
    @model_validator(mode='after')
    def demand(self):
        if (self.kind=='DELIVERY')!=(self.requested_type_ref is not None):raise ValueError('a delivery has its own typed demand')
        return self


class MaterialAction(FrozenModel):
    input_ref: Ref
    kind: Literal['SELECT','LOAD','COMMIT','DELIVER','RETRIEVE','RETURN_HELD','PASSIVE_DIAGRAM']
    subject_ref: Ref
    action_ref: Ref
    payload: FrozenMap
    cost: int = Field(ge=0, le=4096)


class MaterialState(FrozenModel):
    units: tuple[MaterialUnit, ...] = Field(max_length=256)
    holders: tuple[MaterialHolder, ...] = Field(max_length=128)
    actions: tuple[MaterialAction, ...] = Field(max_length=512)
    layout_ref: Ref
    layout_current: bool
    recipe_context_ref: Ref
    rule_revision_ref: Ref
    occurrence_namespace_ref: Ref
    transaction_index: int = Field(ge=0)
    remaining_budget: int = Field(ge=0, le=65536)
    status: Literal['ACTIVE','WIN','LOCAL_STOP','GAME_OVER']
    level_scope_ref: Ref
    restore_epoch: int = Field(ge=0)
    @model_validator(mode='after')
    def occurrence_identity(self):
        if len({u.unit_ref for u in self.units})!=len(self.units):raise ValueError('a held icon still drawn in stock is not a second unit')
        if sum(u.owner=='HELD' for u in self.units)>1:raise ValueError('one hand never loads two operands simultaneously')
        slots={h.holder_ref:h.kind for h in self.holders}
        if len(slots)!=len(self.holders):raise ValueError('distinct work/delivery slots')
        owned=tuple(u.holder_ref for u in self.units if u.holder_ref is not None)
        if len(set(owned))!=len(owned) or any(slots.get(u.holder_ref)!=u.owner for u in self.units if u.holder_ref is not None):raise ValueError('one actual unit per existing compatible slot')
        if len({a.input_ref for a in self.actions})!=len(self.actions):raise ValueError('one current click binding per declared input')
        return self


class MaterialRecipe(FrozenModel):
    recipe_ref: Ref
    context_ref: Ref
    rule_revision_ref: Ref
    kind: Literal['FABRICATION','DECOMPOSITION']
    inputs: tuple[MaterialQuantity, ...] = Field(min_length=1,max_length=128)
    outputs: tuple[MaterialQuantity, ...] = Field(min_length=1,max_length=128)
    work_slot_refs: tuple[Ref, ...] = Field(min_length=1,max_length=128)
    activation_control_ref: Ref
    @model_validator(mode='after')
    def occurrences(self):
        if len(set(self.work_slot_refs))!=len(self.work_slot_refs):raise ValueError('each operand holder is distinct')
        if sum(x.count for x in self.inputs)!=len(self.work_slot_refs):raise ValueError('all concurrent operand occurrences have holders')
        if self.kind=='DECOMPOSITION' and sum(x.count for x in self.inputs)!=1:raise ValueError('unary decomposition has an independent directed yield')
        if sum(x.count for x in self.outputs)>256:raise ValueError('bounded whole output multiset')
        return self


def _ownership_key(state):
    return tuple(sorted((u.unit_ref,u.material_ref,u.owner,u.holder_ref or '') for u in state.units))


class MaterialLayout(FrozenModel):
    layout_ref: Ref
    ownership_key: tuple[tuple[Ref,Ref,Ref,Ref], ...] = Field(max_length=256)
    actions: tuple[MaterialAction, ...] = Field(max_length=512)


class MaterialModel(FrozenModel):
    model_ref: Ref
    recipes: tuple[MaterialRecipe, ...] = Field(max_length=128)
    recipe_domain_complete: bool
    layouts: tuple[MaterialLayout, ...] = Field(max_length=128)
    reselect: Literal['RETURN_OLD_THEN_SELECT','REJECT_IF_HELD']
    occupied_work_slot: Literal['EXCHANGE','REJECT']
    delivery_retrieval: bool
    all_filled_completes: bool
    terminal_priority: Literal['COMPLETION_BEFORE_EXHAUSTION','EXHAUSTION_BEFORE_COMPLETION']
    exhaustion: Literal['LOCAL_STOP','GAME_OVER','RESTORE_DECLARED','UNKNOWN']
    restored_state: MaterialState | None = None
    @model_validator(mode='after')
    def references(self):
        if len({r.recipe_ref for r in self.recipes})!=len(self.recipes):raise ValueError('distinct directed recipe candidates')
        if len({r.ownership_key for r in self.layouts})!=len(self.layouts):raise ValueError('one supplied relayout per exact ownership signature')
        return self


class MaterialLayerTemplate(ContactLayerTemplate):
    component: Literal['STOCK_BIN','HELD_DECORATION','OPERAND_DIAGRAM','OUTPUT_DIAGRAM','WORK_SLOT','DELIVERY_SLOT','ACTIVE_CONTROL','UNKNOWN']
    material_ref: Ref | None = None
    holder_ref: Ref | None = None


class MaterialDrawingOccurrence(FrozenModel):
    drawing_ref: Ref
    unit_ref: Ref | None = None
    material_ref: Ref
    depiction: Literal['OWNER','DECORATION','PREVIEW','UNKNOWN']
    owner: Literal['STOCK','HELD','WORK','DELIVERY'] | None = None
    holder_ref: Ref | None = None


class MaterialObservation(FrozenModel):
    observation_ref: Ref
    event_owner_ref: Ref
    epoch: int = Field(ge=0)
    context_ref: Ref
    rule_revision_ref: Ref
    activation_control_ref: Ref
    kind: Literal['FABRICATION','DECOMPOSITION']
    consumed: tuple[MaterialUnit, ...] = Field(max_length=128)
    produced: tuple[MaterialUnit, ...] = Field(max_length=256)
    transaction_sealed: bool
    whole_outputs_observed: bool


class MaterialDiagramSymbol(FrozenModel):
    occurrence_ref: Ref
    position: tuple[int,int]
    material_candidate_ref: Ref
    multiplicity: int = Field(ge=1, le=128)


class MaterialDiagram(FrozenModel):
    diagram_ref: Ref
    event_owner_ref: Ref
    epoch: int = Field(ge=0)
    context_ref: Ref
    rule_revision_ref: Ref
    kind: Literal['FABRICATION','DECOMPOSITION']
    activation_control_ref: Ref
    work_slot_refs: tuple[Ref, ...] = Field(min_length=1,max_length=128)
    arrow_origin: tuple[int,int]
    arrow_direction: tuple[int,int]
    symbols: tuple[MaterialDiagramSymbol, ...] = Field(min_length=1,max_length=128)
    @model_validator(mode='after')
    def directed(self):
        if self.arrow_direction==(0,0):raise ValueError('a physically supported directed diagram axis is required')
        if len({s.occurrence_ref for s in self.symbols})!=len(self.symbols):raise ValueError('each diagram glyph occurrence counted once')
        return self


class MaterialPlanStep(FrozenModel):
    recipe_ref: Ref
    input_unit_refs: tuple[Ref, ...] = Field(max_length=128)
    output_unit_refs: tuple[Ref, ...] = Field(max_length=256)


class MaterialReservation(FrozenModel):
    consumer_ref: Ref
    required: tuple[MaterialQuantity, ...] = Field(max_length=128)
    unit_refs: tuple[Ref, ...] = Field(max_length=256)


class MaterialRequest(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.material_workbench_request.v1'
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None = None
    maximum_evaluations: int = Field(ge=1, le=65536)
    maximum_states: int = Field(ge=1, le=4096)
    maximum_depth: int = Field(ge=0, le=128)
    maximum_quantity: int = Field(ge=1, le=256)
    state: MaterialState | None = None
    models: tuple[MaterialModel, ...] = Field(default=(),max_length=128)
    bound_model_ref: Ref | None = None
    input_ref: Ref | None = None
    recipes: tuple[MaterialRecipe, ...] = Field(default=(),max_length=128)
    diagrams: tuple[MaterialDiagram, ...] = Field(default=(),max_length=128)
    observations: tuple[MaterialObservation, ...] = Field(default=(),max_length=256)
    drawing_occurrences: tuple[MaterialDrawingOccurrence, ...] = Field(default=(),max_length=1024)
    desired_materials: tuple[MaterialQuantity, ...] = Field(default=(),max_length=128)
    reservations: tuple[MaterialReservation, ...] = Field(default=(),max_length=128)
    plan_steps: tuple[MaterialPlanStep, ...] = Field(default=(),max_length=128)
    expected_state: MaterialState | None = None
    actual_state: MaterialState | None = None
    expected_trace: MaterialEventTrace | None = None
    actual_trace: MaterialEventTrace | None = None
    raw_layer_pixels: tuple[ContactPixel, ...] = Field(default=(),max_length=65536)
    layer_templates: tuple[MaterialLayerTemplate, ...] = Field(default=(),max_length=4096)
    layer_samples: tuple[ContactLayerSample, ...] = Field(default=(),max_length=4096)
    @model_validator(mode='after')
    def identities(self):
        for rows,field in ((self.models,'model_ref'),(self.recipes,'recipe_ref'),(self.reservations,'consumer_ref')):
            if len({getattr(x,field) for x in rows})!=len(rows):raise ValueError('distinct model, recipe and consumer identities')
        return self


OPERATION_MODES={'console_regions':'MEASURE','recipe_grammar':'FIT','inventory_accounting':'MEASURE','selection_transfer':'STEP',
    'production_transaction':'STEP','delivery_retrieval':'STEP','material_preimages':'INVERSE_DOMAIN','reservation_composition':'PRECONDITION',
    'production_domain':'DOMAIN','transaction_compare':'COMPARE'}


def _relayout(state,model):
    key=_ownership_key(state);layout=next((x for x in model.layouts if x.ownership_key==key),None)
    if layout is None:return state.model_copy(update={'actions':(),'layout_current':False}),('current_stock_relayout_bindings',)
    return state.model_copy(update={'actions':layout.actions,'layout_ref':layout.layout_ref,'layout_current':True}),()


def _finish(state,model,action,events,previous_ownership_key):
    deliveries=tuple(h for h in state.holders if h.kind=='DELIVERY');filled={u.holder_ref:u.material_ref for u in state.units if u.owner=='DELIVERY'}
    complete=model.all_filled_completes and bool(deliveries) and all(filled.get(h.holder_ref)==h.requested_type_ref for h in deliveries)
    exhausted=state.remaining_budget<=0;debt=[]
    terminal=('COMPLETE','EXHAUSTED') if model.terminal_priority=='COMPLETION_BEFORE_EXHAUSTION' else ('EXHAUSTED','COMPLETE')
    for kind in terminal:
        if kind=='COMPLETE' and complete:return state.model_copy(update={'status':'WIN'}),(),events+({'kind':'COMPLETION'},)
        if kind=='EXHAUSTED' and exhausted:
            if model.exhaustion in ('LOCAL_STOP','GAME_OVER'):return state.model_copy(update={'status':model.exhaustion}),(),events+({'kind':'EXHAUSTED'},)
            if model.exhaustion=='RESTORE_DECLARED':
                if model.restored_state is None:debt.append('actual_restored_material_scope')
                else:return model.restored_state,(),events+({'kind':'RESTORE','after_scope':model.restored_state.level_scope_ref,'old_transaction_interrupted':True},)
            else:debt.append('budget_exhaustion_law')
            break
    if _ownership_key(state)==previous_ownership_key:return state,tuple(debt),events
    after,layout_debt=_relayout(state,model)
    return after,tuple(debt)+layout_debt,events


def _step(state,model,action):
    units={u.unit_ref:u for u in state.units};held=next((u for u in state.units if u.owner=='HELD'),None)
    holders={h.holder_ref:h for h in state.holders};events=[];debt=[];accepted=False;reason=None;next_tx=state.transaction_index
    if state.status!='ACTIVE':return state,(),({'kind':'TERMINAL_SCOPE'},),False
    if not state.layout_current:return state,('current_click_bindings',),(),False
    if action not in state.actions:return state,('input_from_current_layout',),(),False
    if action.cost>state.remaining_budget:return state,(),({'kind':'REJECT','reason':'insufficient_command_budget'},),False
    if action.kind=='SELECT':
        selected=units.get(action.subject_ref)
        if selected is None or selected.owner!='STOCK':reason='actual_available_stock_unit'
        elif held and model.reselect=='REJECT_IF_HELD':reason='occupied_hand'
        else:
            if held:units[held.unit_ref]=held.model_copy(update={'owner':'STOCK','holder_ref':None});events.append({'kind':'RETURN_OLD_HELD','unit_ref':held.unit_ref})
            units[selected.unit_ref]=selected.model_copy(update={'owner':'HELD','holder_ref':None});accepted=True
    elif action.kind=='RETURN_HELD':
        if held is None:reason='empty_hand'
        else:units[held.unit_ref]=held.model_copy(update={'owner':'STOCK','holder_ref':None});accepted=True
    elif action.kind in ('LOAD','DELIVER','RETRIEVE'):
        holder=holders.get(action.subject_ref);occupant=next((u for u in state.units if u.holder_ref==action.subject_ref),None)
        required_kind='WORK' if action.kind=='LOAD' else 'DELIVERY'
        if holder is None or holder.kind!=required_kind:reason='current_typed_holder'
        elif action.kind=='RETRIEVE':
            if not model.delivery_retrieval:reason='retrieval_unsupported'
            elif held is not None or occupant is None:reason='free_hand_and_filled_delivery'
            else:units[occupant.unit_ref]=occupant.model_copy(update={'owner':'HELD','holder_ref':None});accepted=True
        elif held is None:reason='empty_hand'
        elif action.kind=='DELIVER' and (occupant is not None or held.material_ref!=holder.requested_type_ref):reason='empty_matching_delivery'
        elif occupant is not None and model.occupied_work_slot=='REJECT':reason='occupied_work_holder'
        else:
            units[held.unit_ref]=held.model_copy(update={'owner':required_kind,'holder_ref':holder.holder_ref})
            if occupant:units[occupant.unit_ref]=occupant.model_copy(update={'owner':'HELD','holder_ref':None});events.append({'kind':'EXCHANGE','returned_unit_ref':occupant.unit_ref})
            accepted=True
    elif action.kind=='COMMIT':
        if not model.recipe_domain_complete:return state,('complete_current_control_recipe_domain',),(),False
        rules=tuple(r for r in model.recipes if r.activation_control_ref==action.subject_ref and r.context_ref==state.recipe_context_ref and r.rule_revision_ref==state.rule_revision_ref)
        loaded_by_holder={u.holder_ref:u for u in state.units if u.owner=='WORK'}
        ready=[]
        for recipe in rules:
            loaded=tuple(loaded_by_holder[h] for h in recipe.work_slot_refs if h in loaded_by_holder)
            if len(loaded)==len(recipe.work_slot_refs) and _multiset(u.material_ref for u in loaded)==tuple(sorted(_counts(recipe.inputs).items())):ready.append((recipe,loaded))
        if not ready:reason='complete_supported_operand_multiset'
        elif len(ready)!=1:debt.append('unique_current_control_recipe_law')
        else:
            recipe,loaded=ready[0];outputs=tuple(q.material_ref for q in recipe.outputs for _ in range(q.count))
            if len(units)-len(loaded)+len(outputs)>256:debt.append('bounded_material_occurrence_domain')
            else:
                produced=tuple(MaterialUnit(unit_ref=f'{state.occurrence_namespace_ref}.product.{state.transaction_index}.{i}',material_ref=material,owner='STOCK') for i,material in enumerate(outputs))
                if any(u.unit_ref in units for u in produced):debt.append('fresh_product_occurrence_namespace')
                else:
                    for unit in loaded:del units[unit.unit_ref]
                    for unit in produced:units[unit.unit_ref]=unit
                    next_tx+=1;accepted=True;events.append({'kind':'PRODUCTION','recipe_ref':recipe.recipe_ref,'consumed':loaded,'produced':produced})
    else:reason='passive_diagram_not_activation'
    if debt:return state,tuple(debt),tuple(events),False
    events.append({'kind':'ACCEPT' if accepted else 'REJECT','input_ref':action.input_ref,'reason':reason,'command_cost':action.cost})
    # A rejected physical click still has its explicitly measured command cost.
    after=state.model_copy(update={'units':tuple(units[u] for u in sorted(units)),'remaining_budget':state.remaining_budget-action.cost,'transaction_index':next_tx})
    after,debt,trace=_finish(after,model,action,tuple(events),_ownership_key(state))
    return after,debt,trace,True


def _grammar(request):
    retained=[];refuted=[];unknown=[];count=0;cut={}
    diagram_recipes=[]
    for i,diagram in enumerate(request.diagrams):
        if count+len(diagram.symbols)>request.maximum_evaluations:
            return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'directed_diagram_grammar','next_diagram_index':i})
        count+=len(diagram.symbols)
        if diagram.event_owner_ref!=request.scope.event_owner_ref or diagram.epoch!=request.scope.epoch:
            unknown.append((diagram.diagram_ref,'current_owned_diagram'));continue
        sides=[{},{}];middle=False
        for symbol in diagram.symbols:
            projection=sum((x-y)*d for x,y,d in zip(symbol.position,diagram.arrow_origin,diagram.arrow_direction))
            if projection==0:middle=True;continue
            side=sides[0 if projection<0 else 1];side[symbol.material_candidate_ref]=side.get(symbol.material_candidate_ref,0)+symbol.multiplicity
        if middle or not all(sides) or sum(sides[0][t] for t in sorted(sides[0]))!=len(diagram.work_slot_refs) or (diagram.kind=='DECOMPOSITION' and sum(sides[0][t] for t in sorted(sides[0]))!=1) or sum(sides[1][t] for t in sorted(sides[1]))>256 or any(side[t]>256 for side in sides for t in sorted(side)):
            unknown.append((diagram.diagram_ref,'directed_input_output_multiplicity_and_holder_correspondence'));continue
        diagram_recipes.append(MaterialRecipe(recipe_ref=diagram.diagram_ref,context_ref=diagram.context_ref,rule_revision_ref=diagram.rule_revision_ref,kind=diagram.kind,
            inputs=tuple(MaterialQuantity(material_ref=t,count=sides[0][t]) for t in sorted(sides[0])),outputs=tuple(MaterialQuantity(material_ref=t,count=sides[1][t]) for t in sorted(sides[1])),work_slot_refs=diagram.work_slot_refs,activation_control_ref=diagram.activation_control_ref))
    if len({r.recipe_ref for r in request.recipes+tuple(diagram_recipes)})!=len(request.recipes)+len(diagram_recipes):return family_result(request,prerequisite_refs=('distinct_recipe_and_diagram_candidate_identity',),domain_complete=False)
    for i,recipe in enumerate(request.recipes+tuple(diagram_recipes)):
        if count+len(request.observations)>request.maximum_evaluations:cut={'phase':'recipe_observation_binding','next_recipe_index':i};break
        count+=len(request.observations)
        observations=tuple(o for o in request.observations if o.context_ref==recipe.context_ref and o.rule_revision_ref==recipe.rule_revision_ref and o.kind==recipe.kind and o.activation_control_ref==recipe.activation_control_ref)
        if not observations:unknown.append((recipe.recipe_ref,'current_recipe_context_observation'));continue
        contradiction=False;unresolved=False
        for o in observations:
            work=1+len(o.consumed)+len(o.produced)
            if count+work>request.maximum_evaluations:cut={'phase':'recipe_grammar','next_recipe_index':i,'next_observation_ref':o.observation_ref};break
            count+=work
            if o.event_owner_ref!=request.scope.event_owner_ref or o.epoch!=request.scope.epoch or not o.transaction_sealed or not o.whole_outputs_observed:unresolved=True;continue
            inputs=_multiset(u.material_ref for u in o.consumed);outputs=_multiset(u.material_ref for u in o.produced)
            unique=len({u.unit_ref for u in o.consumed})==len(o.consumed) and len({u.unit_ref for u in o.produced})==len(o.produced) and not {u.unit_ref for u in o.consumed}&{u.unit_ref for u in o.produced}
            if not unique or inputs!=tuple(sorted(_counts(recipe.inputs).items())) or outputs!=tuple(sorted(_counts(recipe.outputs).items())):contradiction=True
        if cut:break
        if contradiction:refuted.append(recipe.recipe_ref)
        elif unresolved:unknown.append((recipe.recipe_ref,'owned_sealed_complete_transaction'))
        else:retained.append(recipe)
    return family_result(request,values={'diagram_grammar_candidates':diagram_recipes,'compatible_scoped_recipes':retained,'refuted_recipe_refs':refuted,'unknown_recipe_refs':unknown,'decomposition_is_inverse':False},examined_count=count,
        domain_complete=not cut and not unknown,computation_bound_reached=bool(cut),frontier=cut)


def _accounting(request):
    state=request.state;units={u.unit_ref:u for u in state.units};contradictions=[];unknown=[];depictions=[];count=len(units)
    if count>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'inventory_occurrences','next_drawing_index':0})
    for i,row in enumerate(request.drawing_occurrences):
        if count>=request.maximum_evaluations:return family_result(request,values={'ownership':state.units,'drawing_contradictions':contradictions,'unknown_drawings':unknown},examined_count=count,domain_complete=False,computation_bound_reached=True,frontier={'phase':'inventory_occurrences','next_drawing_index':i})
        count+=1
        if row.depiction=='PREVIEW':depictions.append((row.drawing_ref,'not_an_owned_unit'));continue
        unit=units.get(row.unit_ref)
        if unit is None or row.depiction=='UNKNOWN':unknown.append(row.drawing_ref);continue
        if row.material_ref!=unit.material_ref or (row.depiction=='OWNER' and (row.owner!=unit.owner or row.holder_ref!=unit.holder_ref)):contradictions.append((row.drawing_ref,unit.unit_ref))
        else:depictions.append((row.drawing_ref,unit.unit_ref,row.depiction))
    return family_result(request,values={'ownership':state.units,'all_unique_material_counts':_multiset(u.material_ref for u in state.units),'free_stock_counts':_multiset(u.material_ref for u in state.units if u.owner=='STOCK'),
        'drawing_to_occurrence_constraints':depictions,'drawing_contradictions':contradictions,'unknown_drawings':unknown,'duplicate_held_stock_counted':False},examined_count=count,domain_complete=not unknown)


def _reservations(request,model):
    if len(request.state.units)>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'initial_material_balance'})
    available={u.unit_ref:u.material_ref for u in request.state.units if u.owner!='DELIVERY'};delivery={u.unit_ref:u for u in request.state.units if u.owner=='DELIVERY'}
    recipes={r.recipe_ref:r for r in model.recipes if r.context_ref==request.state.recipe_context_ref and r.rule_revision_ref==request.state.rule_revision_ref};seen=set(available)|set(delivery);count=len(seen);events=[];errors=[]
    for index,step in enumerate(request.plan_steps):
        work=1+len(step.input_unit_refs)+len(step.output_unit_refs)
        if count+work>request.maximum_evaluations:return family_result(request,values={'partial_balances':events},examined_count=count,domain_complete=False,computation_bound_reached=True,frontier={'phase':'reservation_yields','next_step_index':index})
        count+=work;recipe=recipes.get(step.recipe_ref)
        if recipe is None:errors.append((index,'current_directed_recipe'));break
        if len(set(step.input_unit_refs))!=len(step.input_unit_refs) or not set(step.input_unit_refs)<=set(available):errors.append((index,'distinct_available_input_occurrences'));break
        if _multiset(available[u] for u in step.input_unit_refs)!=tuple(sorted(_counts(recipe.inputs).items())):errors.append((index,'complete_operand_multiplicity'));break
        outputs=tuple(q.material_ref for q in recipe.outputs for _ in range(q.count))
        if len(step.output_unit_refs)!=len(outputs) or len(set(step.output_unit_refs))!=len(outputs) or set(step.output_unit_refs)&seen:errors.append((index,'whole_fresh_yield_occurrences'));break
        for unit in step.input_unit_refs:del available[unit]
        for unit,material in zip(step.output_unit_refs,outputs):available[unit]=material;seen.add(unit)
        events.append({'recipe_ref':recipe.recipe_ref,'consumed':step.input_unit_refs,'produced':step.output_unit_refs,'balance':_multiset(available[u] for u in sorted(available))})
    allocated=set();deficits=[];assignments=[]
    for index,reservation in enumerate(request.reservations):
        work=1+len(reservation.unit_refs)+len(reservation.required)
        if count+work>request.maximum_evaluations:return family_result(request,values={'partial_balances':events,'partial_reservations':assignments},examined_count=count,domain_complete=False,computation_bound_reached=True,frontier={'phase':'terminal_reservations','next_consumer_index':index})
        count+=work;refs=reservation.unit_refs
        allowed={u.unit_ref:u.material_ref for u in request.state.units if u.owner=='DELIVERY' and u.holder_ref==reservation.consumer_ref};allowed.update(available)
        if len(set(refs))!=len(refs) or set(refs)&allocated or not set(refs)<=set(allowed):errors.append((reservation.consumer_ref,'distinct_unspent_consumer_occurrences'));continue
        have=dict(_multiset(allowed[u] for u in refs));wanted=_counts(reservation.required)
        shortage=tuple((t,max(0,wanted[t]-have.get(t,0))) for t in sorted(wanted) if wanted[t]>have.get(t,0))
        if shortage:deficits.append((reservation.consumer_ref,shortage))
        assignments.append({'consumer_ref':reservation.consumer_ref,'unit_refs':refs,'shortage':shortage});allocated.update(refs)
    demand_refs={h.holder_ref for h in request.state.holders if h.kind=='DELIVERY'};reserved_by_consumer={r.consumer_ref:r for r in request.reservations};reserved_refs=set(reserved_by_consumer)
    missing_demands=tuple(sorted(demand_refs-reserved_refs))
    for h in request.state.holders:
        if h.kind=='DELIVERY':
            r=reserved_by_consumer.get(h.holder_ref)
            if r is not None and _counts(r.required)!={h.requested_type_ref:1}:errors.append((h.holder_ref,'unchanged_terminal_delivery_demand'))
    surplus=_multiset(available[u] for u in sorted(available) if u not in allocated)
    return family_result(request,values={'reservation_feasible':not errors and not deficits and not missing_demands,'production_balances':events,'assignments':assignments,'deficits':deficits,'reservation_errors':errors,'unfinanced_terminal_consumers':missing_demands,'surplus':surplus},examined_count=count)


def _preimages(request,model):
    stock=dict(_multiset(u.material_ref for u in request.state.units if u.owner!='DELIVERY'));root=tuple(sorted(_counts(request.desired_materials).items()));nodes=[root];depths=[0];words=[()];queue=deque([0]);seen={root:0};edges=[];cuts=[];count=0
    recipes=tuple(r for r in model.recipes if r.context_ref==request.state.recipe_context_ref and r.rule_revision_ref==request.state.rule_revision_ref)
    while queue:
        index=queue.popleft();need=dict(nodes[index])
        if depths[index]>=request.maximum_depth:
            if any(n>stock.get(t,0) for t,n in nodes[index]):cuts.append({'node':index,'reason':'depth_bound'})
            continue
        for recipe in recipes:
            work=1+len(recipe.inputs)+len(recipe.outputs)+len(need)
            if count+work>request.maximum_evaluations:cuts.append({'node':index,'next_recipe_ref':recipe.recipe_ref,'reason':'evaluation_bound'});queue.clear();break
            count+=work;outputs=_counts(recipe.outputs)
            if not any(need.get(t,0)>0 for t in outputs):continue
            before={t:max(0,need[t]-outputs.get(t,0)) for t in sorted(need)}
            for q in recipe.inputs:before[q.material_ref]=before.get(q.material_ref,0)+q.count
            key=tuple((t,before[t]) for t in sorted(before) if before[t])
            if sum(n for _,n in key)>request.maximum_quantity:cuts.append({'node':index,'recipe_ref':recipe.recipe_ref,'reason':'quantity_bound'});continue
            child=seen.get(key)
            if child is None:
                if len(nodes)>=request.maximum_states:cuts.append({'node':index,'recipe_ref':recipe.recipe_ref,'reason':'state_bound'});continue
                child=len(nodes);seen[key]=child;nodes.append(key);depths.append(depths[index]+1);words.append(words[index]+(recipe.recipe_ref,));queue.append(child)
            edges.append({'required_after_node':index,'required_before_node':child,'recipe_ref':recipe.recipe_ref,'whole_inputs':recipe.inputs,'whole_outputs':recipe.outputs})
    balances=tuple({'node':i,'required':need,'stock_retained':tuple(sorted(stock.items())),'exact_deficits':tuple((t,n-stock.get(t,0)) for t,n in need if n>stock.get(t,0)),
        'candidate_forward_recipe_word':tuple(reversed(words[i])),'interface_costs_recovered':False} for i,need in enumerate(nodes))
    return family_result(request,values={'requirement_hypergraph_nodes':balances,'oriented_recipe_edges':edges,'recipe_available_implies_useful':False,'concurrent_reservations_proved':False},examined_count=count,
        prerequisite_refs=() if model.recipe_domain_complete else ('complete_current_recipe_hypergraph',),domain_complete=not cuts and model.recipe_domain_complete,computation_bound_reached=bool(cuts),frontier={'cuts':cuts,'pending_node_indices':tuple(queue)} if cuts else {})


def _domain(request,model):
    nodes=[request.state];words=[()];depths=[0];queue=deque([0]);seen={request.state:0};edges=[];boundaries=[];cuts=[];count=0
    while queue:
        index=queue.popleft();state=nodes[index]
        if state.status!='ACTIVE':continue
        if not state.layout_current:boundaries.append({'node':index,'reason':'current_click_binding_observation'});continue
        if depths[index]>=request.maximum_depth:cuts.append({'node':index,'reason':'depth_bound'});continue
        for action_index,action in enumerate(state.actions):
            work=1+len(state.units)+len(state.holders)+sum(len(r.inputs)+len(r.outputs) for r in model.recipes)
            if count+work>request.maximum_evaluations:cuts.append({'node':index,'next_action_index':action_index,'reason':'evaluation_bound'});queue.clear();break
            count+=work;after,debt,trace,applied=_step(state,model,action)
            if debt:boundaries.append({'node':index,'input_ref':action.input_ref,'prerequisite_refs':debt,'conditional_after_state':after,'events':trace})
            if not applied or debt:continue
            if after.level_scope_ref!=state.level_scope_ref or after.restore_epoch!=state.restore_epoch:
                boundaries.append({'node':index,'input_ref':action.input_ref,'reason':'qualify_new_execution_scope','conditional_after_state':after,'events':trace});continue
            child=seen.get(after)
            if child is None:
                if len(nodes)>=request.maximum_states:cuts.append({'node':index,'next_action_index':action_index,'reason':'state_bound'});continue
                child=len(nodes);seen[after]=child;nodes.append(after);words.append(words[index]+(action.input_ref,));depths.append(depths[index]+1);queue.append(child)
            edges.append({'from_node':index,'to_node':child,'input':action,'events':trace,'command_cost':action.cost})
    return family_result(request,values={'interface_states':nodes,'actual_command_edges':edges,'conditional_complete_words':tuple(words[i] for i,s in enumerate(nodes) if s.status=='WIN'),
        'observation_boundaries':boundaries,'held_state_quotiented':False,'minimum_cost_proved':False,'ready_for_K09_as_descriptive_inputs':True},examined_count=count,
        domain_complete=not cuts and not boundaries,computation_bound_reached=bool(cuts),frontier={'cuts':cuts,'pending_nodes':tuple(queue)} if cuts else {})


def _compare(request):
    expected=request.expected_state;actual=request.actual_state;a=request.expected_trace;b=request.actual_trace
    current=a is not None and b is not None and a.sealed and b.sealed and a.event_owner_ref==b.event_owner_ref==request.scope.event_owner_ref and a.epoch==b.epoch==request.scope.epoch and a.input_ref==b.input_ref and a.evidence_revision_ref==b.evidence_revision_ref==request.scope.evidence_revision_ref and a.model_revision_ref==b.model_revision_ref==request.scope.model_revision_ref
    count=len(expected.units)+len(actual.units);changes=[];cut={}
    if count>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'material_ownership_compare'})
    for owner in ('STOCK','HELD','WORK','DELIVERY'):
        left=tuple(sorted((u.unit_ref,u.material_ref,u.holder_ref or '') for u in expected.units if u.owner==owner));right=tuple(sorted((u.unit_ref,u.material_ref,u.holder_ref or '') for u in actual.units if u.owner==owner))
        if left!=right:changes.append((owner,left,right))
    first=None
    if current:
        for i in range(max(len(a.events),len(b.events))):
            if count>=request.maximum_evaluations:cut={'phase':'material_event_compare','next_event_index':i};break
            count+=1;left=a.events[i] if i<len(a.events) else None;right=b.events[i] if i<len(b.events) else None
            if left!=right:first=(i,left,right);break
    changed=tuple((name,getattr(expected,name),getattr(actual,name)) for name in ('recipe_context_ref','rule_revision_ref','remaining_budget','status','level_scope_ref','restore_epoch') if getattr(expected,name)!=getattr(actual,name))
    return family_result(request,values={'ownership_changes_by_location':changes,'first_owned_transaction_contradiction':first,'context_cost_scope_changes':changed,'click_bindings_changed':expected.actions!=actual.actions,
        'invalidate_entire_recipe_language':False,'outstanding_deliveries':tuple(h for h in actual.holders if h.kind=='DELIVERY' and not any(u.owner=='DELIVERY' and u.holder_ref==h.holder_ref and u.material_ref==h.requested_type_ref for u in actual.units))},prerequisite_refs=() if current else ('current_owned_sealed_material_transaction',),examined_count=count,domain_complete=current and not cut,computation_bound_reached=bool(cut),frontier=cut)


def measure_typed_material_workbench(request: MaterialRequest) -> MechanicalFamilyResult:
    if request.mode is None or OPERATION_MODES.get(request.operation_ref)!=request.mode:return family_result(request,signature_supported=False,domain_complete=False)
    op=request.operation_ref;required={'console_regions':('raw_layer_pixels','layer_templates'),'recipe_grammar':('observations',),'inventory_accounting':('state','drawing_occurrences'),
        'selection_transfer':('state','models','bound_model_ref','input_ref'),'production_transaction':('state','models','bound_model_ref','input_ref'),'delivery_retrieval':('state','models','bound_model_ref','input_ref'),
        'material_preimages':('state','models','bound_model_ref','desired_materials'),'reservation_composition':('state','models','bound_model_ref','reservations','plan_steps'),
        'production_domain':('state','models','bound_model_ref'),'transaction_compare':('expected_state','actual_state')}
    missing=missing_supplied_fields(request,required[op])
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    if op=='console_regions':
        measured=translated_layers(request);values=dict(measured.values);templates={t.template_ref:t for t in request.layer_templates};rows=values.get('measured_layer_alternatives',())+values.get('possible_layer_alternatives',())
        return measured.model_copy(update={'values':immutable_json_data({**values,'region_slot_type_candidates':tuple({'physical_measurement':r,'component_candidate':templates[r['template_ref']].component,'holder_candidate':templates[r['template_ref']].holder_ref,'material_candidate':templates[r['template_ref']].material_ref} for r in rows),'palette_name_is_behavior':False})})
    if op=='recipe_grammar':
        if not request.recipes and not request.diagrams:return family_result(request,prerequisite_refs=('typed_recipe_or_directed_diagram_candidates',),domain_complete=False)
        return _grammar(request)
    if op=='inventory_accounting':return _accounting(request)
    if op=='transaction_compare':return _compare(request)
    model=next((m for m in request.models if m.model_ref==request.bound_model_ref),None)
    if model is None:return family_result(request,prerequisite_refs=('bound_whole_material_interface_model',),domain_complete=False)
    if op=='reservation_composition':return _reservations(request,model)
    if op=='material_preimages':return _preimages(request,model)
    if op=='production_domain':return _domain(request,model)
    action=next((a for a in request.state.actions if a.input_ref==request.input_ref),None)
    classes={'selection_transfer':('SELECT','LOAD','RETURN_HELD'),'production_transaction':('COMMIT','PASSIVE_DIAGRAM'),'delivery_retrieval':('DELIVER','RETRIEVE')}
    if action is None or action.kind not in classes[op]:return family_result(request,prerequisite_refs=('current_bound_operation_input',),domain_complete=False)
    work=1+len(request.state.units)+len(request.state.holders)+sum(len(r.inputs)+len(r.outputs) for r in model.recipes)
    if work>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'material_transaction'})
    after,debt,events,applied=_step(request.state,model,action)
    return family_result(request,values={'after_state':after,'transaction_events':events,'event_owner_ref':request.scope.event_owner_ref,'external_command_count':int(applied),'actual_command_cost':action.cost if applied else 0},
        prerequisite_refs=debt,examined_count=work,domain_complete=not debt)
