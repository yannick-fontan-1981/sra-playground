"""Exact interval quantity events with occurrence lifetime and checkpoint scope.

Installing a recurring glyph is not firing it twice. A boundary projection is
licensed only after the complete event model has satisfied its assumptions.
"""
from fractions import Fraction
from collections import deque
from typing import Literal
from pydantic import Field,model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref,immutable_json_data
from .mechanical_family_contracts_a import MechanicalFamilyScope,MechanicalFamilyResult,family_result,missing_supplied_fields
from .identity_contact_authentication import ContactPixel,ContactLayerTemplate,ContactLayerSample,_candidate_layers as translated_layers
from .mutable_kit_survival import KitEventTrace as QuantityEventTrace


class WellInterval(FrozenModel):
    well_ref: Ref
    minimum: str
    maximum: str
    @model_validator(mode='after')
    def interval(self):
        if Fraction(self.minimum)>Fraction(self.maximum):raise ValueError('ordered quantity interval')
        return self


def _intervals(rows):return {r.well_ref:(Fraction(r.minimum),Fraction(r.maximum)) for r in rows}


def _rows(values):return tuple(WellInterval(well_ref=r,minimum=str(values[r][0]),maximum=str(values[r][1])) for r in sorted(values))


class QuantityOperator(FrozenModel):
    occurrence_ref: Ref
    glyph_ref: Ref
    kind: Literal['ADDITIVE','TRANSFER']
    deltas: tuple[WellInterval,...] = Field(max_length=128)
    source_well_ref: Ref | None = None
    recipient_well_ref: Ref | None = None
    transfer_amount: str | None = None
    transfer_evidence_ref: Ref | None = None
    lifetime: Literal['ONE_SHOT','PERMANENT','FIXED_FIRINGS']
    remaining_firings: int | None = Field(default=None,ge=0,le=256)
    cadence: int = Field(ge=1,le=256)
    installed_turn: int = Field(ge=0)
    @model_validator(mode='after')
    def effects(self):
        if len({r.well_ref for r in self.deltas})!=len(self.deltas):raise ValueError('one additive interval per well and occurrence')
        if self.lifetime=='FIXED_FIRINGS' and self.remaining_firings is None:raise ValueError('fixed occurrence lifetime has a current firing count')
        if self.kind=='TRANSFER' and (self.source_well_ref is None or self.recipient_well_ref is None or self.source_well_ref==self.recipient_well_ref or self.transfer_amount is None or Fraction(self.transfer_amount)<0):raise ValueError('one exact declared transfer source/recipient/amount')
        return self


class QuantityChoice(FrozenModel):
    choice_ref: Ref
    input_ref: Ref
    action_ref: Ref
    payload: FrozenMap
    ordered_operators: tuple[QuantityOperator,...] = Field(max_length=128)
    cost: int = Field(ge=0,le=65536)


class QuantityChoiceRow(FrozenModel):
    row_ref: Ref
    choices: tuple[QuantityChoice,...] = Field(min_length=1,max_length=64)
    @model_validator(mode='after')
    def ids(self):
        if len({c.choice_ref for c in self.choices})!=len(self.choices):raise ValueError('distinct current choice groups')
        return self


class QuantityState(FrozenModel):
    quantities: tuple[WellInterval,...] = Field(min_length=1,max_length=128)
    installed_operators: tuple[QuantityOperator,...] = Field(max_length=256)
    rows: tuple[QuantityChoiceRow,...] = Field(max_length=256)
    current_row: int = Field(ge=0,le=256)
    current_turn: int = Field(ge=0)
    horizon: int = Field(ge=0,le=256)
    remaining_budget: int = Field(ge=0,le=65536)
    level_scope_ref: Ref
    restore_epoch: int = Field(ge=0)
    status: Literal['ACTIVE','WIN','LOCAL_STOP','GAME_OVER']
    @model_validator(mode='after')
    def population(self):
        if len({r.well_ref for r in self.quantities})!=len(self.quantities):raise ValueError('one interval per well')
        if len({o.occurrence_ref for o in self.installed_operators})!=len(self.installed_operators):raise ValueError('identical glyphs remain distinct ordered occurrences')
        if any(o.installed_turn>self.current_turn for o in self.installed_operators):raise ValueError('installed occurrences belong to the current or earlier turn')
        if self.current_row>len(self.rows):raise ValueError('current row belongs to the supplied remaining choice sequence')
        return self


class QuantityModel(FrozenModel):
    model_ref: Ref
    bands: tuple[WellInterval,...] = Field(min_length=1,max_length=128)
    validation: Literal['SETTLED_TURN','EACH_EFFECT']
    settled_validation_required: bool = True
    installation: Literal['ONE_SHOT_IMMEDIATE','ALL_IMMEDIATE']
    newly_installed_recurring_due: bool
    recurring_order: Literal['OLD_THEN_NEW','NEW_THEN_OLD']
    insufficient_transfer: Literal['REFUSE','CLIP_TO_AVAILABLE','UNKNOWN']
    failure: Literal['LOCAL_STOP','GAME_OVER','RESTORE_DECLARED','UNKNOWN']
    restored_state: QuantityState | None = None
    completion_before_exhaustion: bool
    exhaustion: Literal['LOCAL_STOP','GAME_OVER','UNKNOWN']
    @model_validator(mode='after')
    def intervals(self):
        if len({r.well_ref for r in self.bands})!=len(self.bands):raise ValueError('independent well band limits')
        return self


def _band_status(quantities,bands):
    q=_intervals(quantities);limits=_intervals(bands)
    if set(q)!=set(limits):return 'UNKNOWN'
    if any(q[r][1]<limits[r][0] or q[r][0]>limits[r][1] for r in sorted(q)):return 'FAILED'
    if all(limits[r][0]<=q[r][0]<=q[r][1]<=limits[r][1] for r in sorted(q)):return 'SAFE'
    return 'UNKNOWN'


def _effect(state,operator,model):
    if operator.remaining_firings==0:return state,operator,(),('live_operator_occurrence',)
    q=_intervals(state.quantities);events=[];debt=()
    if operator.kind=='ADDITIVE':
        for delta in operator.deltas:
            if delta.well_ref not in q:return state,operator,(),('current_operator_well_domain',)
            lo,hi=q[delta.well_ref];q[delta.well_ref]=(lo+Fraction(delta.minimum),hi+Fraction(delta.maximum))
        events.append({'kind':'ADDITIVE','occurrence_ref':operator.occurrence_ref,'deltas':operator.deltas,'conserved_total_proved':False})
    else:
        if operator.transfer_evidence_ref is None:return state,operator,(),('supported_conserved_transfer_law',)
        source=operator.source_well_ref;recipient=operator.recipient_well_ref
        if source not in q or recipient not in q:return state,operator,(),('current_transfer_source_and_recipient',)
        amount=Fraction(operator.transfer_amount);lo,hi=q[source]
        if lo<0:return state,operator,(),('nonnegative_transfer_source',)
        if lo<amount:
            if model.insufficient_transfer=='UNKNOWN':return state,operator,(),('current_insufficient_transfer_law',)
            if model.insufficient_transfer=='REFUSE':
                if hi>=amount:return state,operator,(),('split_transfer_availability_interval',)
                events.append({'kind':'TRANSFER_REFUSED','occurrence_ref':operator.occurrence_ref});amount=Fraction(0)
            else:
                if lo!=hi:return state,operator,(),('correlated_clipped_transfer_interval',)
                amount=min(amount,lo)
        q[source]=(q[source][0]-amount,q[source][1]-amount);q[recipient]=(q[recipient][0]+amount,q[recipient][1]+amount)
        events.append({'kind':'TRANSFER','occurrence_ref':operator.occurrence_ref,'source':source,'recipient':recipient,'actual_amount':str(amount),'conserved_total_proved':True})
    remaining=operator.remaining_firings
    if operator.lifetime=='ONE_SHOT':remaining=0
    elif operator.lifetime=='FIXED_FIRINGS':remaining=max(0,remaining-1)
    after_operator=operator.model_copy(update={'remaining_firings':remaining})
    return state.model_copy(update={'quantities':_rows(q)}),after_operator,tuple(events),debt


def _failure(state,model):
    if model.failure=='UNKNOWN':return state,('current_failed_validation_lifecycle',)
    if model.failure=='RESTORE_DECLARED':return (model.restored_state,()) if model.restored_state is not None else (state,('declared_quantity_restoration_scope',))
    return state.model_copy(update={'status':model.failure}),()


def _turn(state,model,choice,maximum_evaluations):
    if state.status!='ACTIVE' or state.current_row>=len(state.rows) or choice not in state.rows[state.current_row].choices:return state,(),('current_active_choice_row',),0,{}
    if choice.cost>state.remaining_budget:return state,(),('funded_quantity_choice',),0,{}
    old=state.installed_operators;new=tuple(o.model_copy(update={'installed_turn':state.current_turn}) for o in choice.ordered_operators)
    if len({o.occurrence_ref for o in old+new})!=len(old)+len(new):return state,(),('fresh_installed_operator_occurrences',),0,{}
    current=state.model_copy(update={'remaining_budget':state.remaining_budget-choice.cost});events=[{'kind':'DEBIT','cost':choice.cost},{'kind':'INSTALL','ordered_occurrences':tuple(o.occurrence_ref for o in new)}];count=0;updated={};debt=();cut={};interrupted=False
    immediate=tuple(o for o in new if o.lifetime=='ONE_SHOT' or model.installation=='ALL_IMMEDIATE')
    due_old=tuple(o for o in old if o.lifetime!='ONE_SHOT' and (state.current_turn-o.installed_turn)%o.cadence==0)
    due_new=tuple(o for o in new if o.lifetime!='ONE_SHOT' and model.newly_installed_recurring_due)
    recurring=due_old+due_new if model.recurring_order=='OLD_THEN_NEW' else due_new+due_old
    for phase,operators in (('IMMEDIATE',immediate),('RECURRING',recurring)):
        for index,original in enumerate(operators):
            operator=updated.get(original.occurrence_ref,original)
            if operator.remaining_firings==0:continue
            work=1+len(current.quantities)+len(operator.deltas)
            if count+work>maximum_evaluations:cut={'phase':phase,'next_operator_index':index,'after_prefix_state':current,'events':tuple(events)};break
            count+=work;current,changed,trace,debt=_effect(current,operator,model);updated[operator.occurrence_ref]=changed;events.extend({'phase':phase,**event} for event in trace)
            if debt:break
            if model.validation=='EACH_EFFECT':
                verdict=_band_status(current.quantities,model.bands);events.append({'kind':'VALIDATION','scope':'EACH_EFFECT','verdict':verdict})
                if verdict=='UNKNOWN':debt=('unambiguous_micro_effect_band_predicate',);break
                if verdict=='FAILED':current,debt=_failure(current,model);events.append({'kind':'FAILED_VALIDATION_LIFECYCLE','lifecycle':model.failure,'after_scope':current.level_scope_ref,'after_restore_epoch':current.restore_epoch});interrupted=True;break
        if interrupted or cut or debt or current.status!='ACTIVE' or current.level_scope_ref!=state.level_scope_ref or current.restore_epoch!=state.restore_epoch:break
    if interrupted or cut or debt or current.status!='ACTIVE' or current.level_scope_ref!=state.level_scope_ref or current.restore_epoch!=state.restore_epoch:return current,tuple(events),debt,count,cut
    installed=tuple(updated.get(o.occurrence_ref,o) for o in old+new if o.lifetime!='ONE_SHOT' and updated.get(o.occurrence_ref,o).remaining_firings!=0)
    if len(installed)>256:return current,tuple(events),('bounded_installed_occurrence_population',),count,{}
    current=current.model_copy(update={'installed_operators':installed})
    if model.settled_validation_required:
        verdict=_band_status(current.quantities,model.bands);events.append({'kind':'VALIDATION','scope':'SETTLED_TURN','verdict':verdict})
        if verdict=='UNKNOWN':return current,tuple(events),('unambiguous_settled_band_predicate',),count,{}
        if verdict=='FAILED':
            current,debt=_failure(current,model);events.append({'kind':'FAILED_VALIDATION_LIFECYCLE','lifecycle':model.failure,'after_scope':current.level_scope_ref,'after_restore_epoch':current.restore_epoch});return current,tuple(events),debt,count,{}
    current=current.model_copy(update={'current_row':state.current_row+1,'current_turn':state.current_turn+1});complete=current.current_turn>=state.horizon
    if complete and (model.completion_before_exhaustion or current.remaining_budget>0):current=current.model_copy(update={'status':'WIN'})
    elif current.remaining_budget<=0:
        if model.exhaustion=='UNKNOWN':debt=('current_quantity_exhaustion_lifecycle',)
        else:current=current.model_copy(update={'status':model.exhaustion})
    events.append({'kind':'HORIZON','turn':current.current_turn,'status':current.status})
    return current,tuple(events),debt,count,{}


def _projection(state,model):
    operators=state.installed_operators+tuple(o for row in state.rows[state.current_row:] for choice in row.choices for o in choice.ordered_operators)
    failures=[]
    if set(_intervals(model.bands))!=set(_intervals(state.quantities)):failures.append('current_well_band_domain')
    if model.validation!='SETTLED_TURN':failures.append('micro_effect_validation_not_boundary_only')
    if not model.settled_validation_required:failures.append('settled_checkpoint_not_licensed')
    if model.installation!='ONE_SHOT_IMMEDIATE' or not model.newly_installed_recurring_due:failures.append('new_recurring_drift_must_fire_once_this_turn')
    if any(o.kind!='ADDITIVE' or o.lifetime not in ('ONE_SHOT','PERMANENT') or o.cadence!=1 for o in operators):failures.append('nonadditive_or_variable_lifetime_cadence_effect')
    if any(Fraction(d.minimum)!=Fraction(d.maximum) for o in operators for d in o.deltas):failures.append('fixed_recurring_uncertainty_requires_correlated_affine_state')
    drift={r.well_ref:(Fraction(0),Fraction(0)) for r in state.quantities}
    for operator in state.installed_operators:
        if operator.lifetime!='PERMANENT' or operator.remaining_firings==0:continue
        for delta in operator.deltas:
            if delta.well_ref not in drift:failures.append('drift_well_domain');continue
            lo,hi=drift[delta.well_ref];drift[delta.well_ref]=(lo+Fraction(delta.minimum),hi+Fraction(delta.maximum))
    return {'projection_certified':not failures,'counterexample_assumptions':tuple(dict.fromkeys(failures)),'quantities':state.quantities,'recurring_drift':_rows(drift),'recurrence':'p_next=p+r(choice); q_next=q+c(choice)+p_next','ordered_occurrences_retained':state.installed_operators}


class QuantityLayerTemplate(ContactLayerTemplate):
    component: Literal['WELL','LIMIT_MARK','CURRENT_CHOICE','INSTALLED_OPERATOR','LIFETIME','UNKNOWN']
    well_candidate_ref: Ref | None = None
    occurrence_candidate_ref: Ref | None = None
    quantity_minimum: str | None = None
    quantity_maximum: str | None = None
    calibration_evidence_ref: Ref | None = None
    @model_validator(mode='after')
    def calibrated_interval(self):
        if self.calibration_evidence_ref is not None and (self.quantity_minimum is None or self.quantity_maximum is None or Fraction(self.quantity_minimum)>Fraction(self.quantity_maximum)):raise ValueError('calibrated quantity has an ordered numeric interval')
        return self


class QuantityObservation(FrozenModel):
    observation_ref: Ref
    before: QuantityState
    after: QuantityState
    choice_ref: Ref
    event_owner_ref: Ref
    epoch: int = Field(ge=0)
    sealed: bool
    trace: QuantityEventTrace | None = None


class QuantityRequest(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.recurring_quantity_request.v1'
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None = None
    maximum_evaluations: int = Field(ge=1,le=65536)
    maximum_states: int = Field(ge=1,le=4096)
    maximum_depth: int = Field(ge=0,le=256)
    maximum_words: int = Field(ge=1,le=128)
    maximum_witnesses: int = Field(default=3,ge=1,le=3)
    state: QuantityState | None = None
    models: tuple[QuantityModel,...] = Field(default=(),max_length=128)
    bound_model_ref: Ref | None = None
    operator_ref: Ref | None = None
    choice_ref: Ref | None = None
    choice_word: tuple[Ref,...] | None = Field(default=None,max_length=256)
    observations: tuple[QuantityObservation,...] = Field(default=(),max_length=256)
    expected_state: QuantityState | None = None
    actual_state: QuantityState | None = None
    expected_trace: QuantityEventTrace | None = None
    actual_trace: QuantityEventTrace | None = None
    expected_usefulness: bool | None = None
    actual_usefulness: bool | None = None
    raw_layer_pixels: tuple[ContactPixel,...] = Field(default=(),max_length=65536)
    layer_templates: tuple[QuantityLayerTemplate,...] = Field(default=(),max_length=4096)
    layer_samples: tuple[ContactLayerSample,...] = Field(default=(),max_length=4096)
    @model_validator(mode='after')
    def identity(self):
        for rows,name in ((self.models,'model_ref'),(self.layer_templates,'template_ref')):
            if len({getattr(r,name) for r in rows})!=len(rows):raise ValueError('distinct current model and physical template alternatives')
        return self


OPERATION_MODES={'wells_and_operators':'MEASURE','delta_lifetime_fit':'FIT','glyph_effect':'STEP_INTERNAL','turn_successor':'STEP','boundary_projection':'PRECONDITION',
    'quantity_recurrence':'EVALUATE','future_band_preimages':'INVERSE_DOMAIN','horizon_viability_domain':'DOMAIN','choice_word_certificate':'COMPILE','quantity_compare':'COMPARE'}


def _choice(state,ref):
    return next((c for c in state.rows[state.current_row].choices if c.choice_ref==ref),None) if state.current_row<len(state.rows) else None


def _same_quantity_state(a,b):
    return _intervals(a.quantities)==_intervals(b.quantities) and all(getattr(a,n)==getattr(b,n) for n in type(a).model_fields if n!='quantities')


def _choice_vectors(state,choice):
    wells={q.well_ref for q in state.quantities};c={w:(Fraction(0),Fraction(0)) for w in wells};r=dict(c)
    for operator in choice.ordered_operators:
        target=c if operator.lifetime=='ONE_SHOT' else r
        for d in operator.deltas:
            if d.well_ref not in target:return None,None,('current_additive_well_domain',)
            lo,hi=target[d.well_ref];target[d.well_ref]=(lo+Fraction(d.minimum),hi+Fraction(d.maximum))
    return c,r,()


def _recurrence(state,model,choice):
    projection=_projection(state,model)
    if not projection['projection_certified']:return None,projection,('certified_exact_boundary_projection',)
    c,r,debt=_choice_vectors(state,choice)
    if debt:return None,projection,debt
    q=_intervals(state.quantities);p=_intervals(projection['recurring_drift']);next_p={w:(p[w][0]+r[w][0],p[w][1]+r[w][1]) for w in sorted(p)}
    next_q={w:(q[w][0]+c[w][0]+next_p[w][0],q[w][1]+c[w][1]+next_p[w][1]) for w in sorted(q)}
    return {'quantities':_rows(next_q),'recurring_drift':_rows(next_p),'immediate_vector':_rows(c),'new_recurring_vector':_rows(r),'new_recurring_applied_twice':False},projection,()


def _fit(request):
    compatible=[];refuted=[];unknown=[];count=0;cuts=[]
    for index,model in enumerate(request.models):
        supports=[];bad=[];missing=[]
        for observation in request.observations:
            if not observation.sealed or observation.event_owner_ref!=request.scope.event_owner_ref or observation.epoch!=request.scope.epoch:missing.append(observation.observation_ref);continue
            choice=_choice(observation.before,observation.choice_ref)
            if choice is None:missing.append((observation.observation_ref,'current_observed_choice'));continue
            after,events,debt,work,cut=_turn(observation.before,model,choice,request.maximum_evaluations-count);count+=work
            if cut:cuts.append({'phase':'delta_lifetime_fit','next_model_index':index,'observation_ref':observation.observation_ref,**cut});break
            if debt:missing.append((observation.observation_ref,debt))
            elif not _same_quantity_state(after,observation.after):bad.append(observation.observation_ref)
            elif observation.trace is not None and (not observation.trace.sealed or observation.trace.event_owner_ref!=request.scope.event_owner_ref or observation.trace.epoch!=request.scope.epoch or observation.trace.input_ref!=choice.input_ref or observation.trace.evidence_revision_ref!=request.scope.evidence_revision_ref or observation.trace.model_revision_ref!=request.scope.model_revision_ref):missing.append((observation.observation_ref,'current_owned_micro_event_trace'))
            elif observation.trace is not None and immutable_json_data(events)!=observation.trace.events:bad.append((observation.observation_ref,'first_install_fire_lifetime_or_checkpoint_mismatch'))
            else:supports.append({'observation_ref':observation.observation_ref,'predicted_micro_events':events})
        if cuts:break
        if bad:refuted.append((model.model_ref,tuple(bad)))
        elif supports:compatible.append({'model':model,'supported_current_observations':supports,'unresolved_observations':missing})
        else:unknown.append((model.model_ref,tuple(missing) or ('current_effect_lifetime_evidence',)))
    return family_result(request,values={'compatible_effect_lifetime_models':compatible,'refuted_models':refuted,'unknown_models':unknown,'highlight_is_second_application':False},examined_count=count,
        domain_complete=not cuts and not unknown,computation_bound_reached=bool(cuts),frontier={'cuts':cuts} if cuts else {})


def _quantity_predecessor_word_d(parents,index,remaining):
    word=[];work=0
    while parents[index] is not None:
        parent,choice_ref=parents[index]
        work+=1
        if work>remaining:return None,work
        word.append(choice_ref);index=parent
    return tuple(reversed(word)),work


def _domain(request,model):
    nodes=[request.state];parents=[None];depths=[0];seen={request.state:0};queue=deque([0]);edges=[];cuts=[];boundaries=[];count=0
    while queue:
        index=queue.popleft();state=nodes[index]
        if state.status!='ACTIVE':continue
        if depths[index]>=request.maximum_depth:cuts.append({'node':index,'reason':'depth_bound'});continue
        if state.current_row>=len(state.rows):boundaries.append((index,'observed_remaining_choice_row'));continue
        for choice_index,choice in enumerate(state.rows[state.current_row].choices):
            after,events,debt,work,cut=_turn(state,model,choice,request.maximum_evaluations-count);count+=work
            if cut:cuts.append({'node':index,'next_choice_index':choice_index,'frontier':cut});queue.clear();break
            if debt:boundaries.append({'node':index,'choice_ref':choice.choice_ref,'after_prefix_state':after,'events':events,'missing_refs':debt});continue
            if after.level_scope_ref!=state.level_scope_ref or after.restore_epoch!=state.restore_epoch or any(e.get('kind')=='FAILED_VALIDATION_LIFECYCLE' and e.get('lifecycle')=='RESTORE_DECLARED' for e in events):boundaries.append({'node':index,'choice_ref':choice.choice_ref,'after_prefix_state':after,'reason':'qualify_new_execution_scope'});continue
            child=seen.get(after)
            if child is None:
                if len(nodes)>=request.maximum_states:cuts.append({'node':index,'next_choice_index':choice_index,'reason':'state_bound'});continue
                child=len(nodes);seen[after]=child;nodes.append(after);parents.append((index,choice.choice_ref));depths.append(depths[index]+1);queue.append(child)
            edges.append({'from_node':index,'to_node':child,'choice':choice,'events':events,'primitive_cost':choice.cost})
    witnesses=[]
    for i,s in enumerate(nodes):
        if s.status!='WIN' or s.current_turn<s.horizon:continue
        if len(witnesses)>=min(request.maximum_words,request.maximum_witnesses):break
        word,work=_quantity_predecessor_word_d(parents,i,request.maximum_evaluations-count)
        if word is None:cuts.append({'node':i,'reason':'quantity_word_reconstruction_bound'});break
        count+=work;witnesses.append({'choice_word':word,'after_state':s})
    return family_result(request,values={'quantity_lifetime_row_states':nodes,'ordered_choice_event_edges':edges,'viable_horizon_suffixes':witnesses,'observation_boundaries':boundaries,
        'immediate_safe_is_continuation_proof':False,'rejected_executable_word_bank_retained':False,
        'declared_domain_exhausted':not cuts and not boundaries and not witnesses},examined_count=count,domain_complete=not cuts and not boundaries,
        computation_bound_reached=bool(cuts),frontier={'cuts':cuts,'pending_nodes':tuple(queue)} if cuts else {})


def _affine_shift_turn(state,model,choice,offset,maximum_evaluations):
    """Propagate additive shifts while retaining occurrence order and expiry."""
    if choice.cost>state.remaining_budget:return None,offset,(),(),0,{},'UNFUNDED'
    old=state.installed_operators;new=tuple(o.model_copy(update={'installed_turn':state.current_turn}) for o in choice.ordered_operators)
    if len({o.occurrence_ref for o in old+new})!=len(old)+len(new):return None,offset,(),('fresh_installed_operator_occurrences',),0,{},'UNKNOWN'
    immediate=tuple(o for o in new if o.lifetime=='ONE_SHOT' or model.installation=='ALL_IMMEDIATE')
    due_old=tuple(o for o in old if o.lifetime!='ONE_SHOT' and (state.current_turn-o.installed_turn)%o.cadence==0)
    due_new=tuple(o for o in new if o.lifetime!='ONE_SHOT' and model.newly_installed_recurring_due)
    recurring=due_old+due_new if model.recurring_order=='OLD_THEN_NEW' else due_new+due_old
    shifted=dict(offset);updated={};checkpoints=[];count=0
    for phase,operators in (('IMMEDIATE',immediate),('RECURRING',recurring)):
        for index,original in enumerate(operators):
            operator=updated.get(original.occurrence_ref,original)
            if operator.remaining_firings==0:continue
            work=1+len(shifted)+len(operator.deltas)
            if count+work>maximum_evaluations:return None,shifted,tuple(checkpoints),(),count,{'phase':phase,'next_operator_index':index},'CUT'
            count+=work
            if operator.kind!='ADDITIVE':return None,shifted,tuple(checkpoints),('inverse_piecewise_transfer_relation',),count,{},'UNKNOWN'
            for delta in operator.deltas:
                if delta.well_ref not in shifted:return None,shifted,tuple(checkpoints),('current_additive_well_domain',),count,{},'UNKNOWN'
                if delta.minimum!=delta.maximum and Fraction(delta.minimum)!=Fraction(delta.maximum):return None,shifted,tuple(checkpoints),('correlated_uncertain_additive_preimage',),count,{},'UNKNOWN'
                shifted[delta.well_ref]+=Fraction(delta.minimum)
            remaining=0 if operator.lifetime=='ONE_SHOT' else max(0,operator.remaining_firings-1) if operator.lifetime=='FIXED_FIRINGS' else operator.remaining_firings
            updated[operator.occurrence_ref]=operator.model_copy(update={'remaining_firings':remaining})
            if model.validation=='EACH_EFFECT':checkpoints.append({'scope':'EACH_EFFECT','phase':phase,'occurrence_ref':operator.occurrence_ref,'shift':_rows({w:(shifted[w],shifted[w]) for w in sorted(shifted)})})
    installed=tuple(updated.get(o.occurrence_ref,o) for o in old+new if o.lifetime!='ONE_SHOT' and updated.get(o.occurrence_ref,o).remaining_firings!=0)
    if len(installed)>256:return None,shifted,tuple(checkpoints),('bounded_installed_occurrence_population',),count,{},'UNKNOWN'
    if model.settled_validation_required:
        checkpoints.append({'scope':'SETTLED_TURN','shift':_rows({w:(shifted[w],shifted[w]) for w in sorted(shifted)})})
    return state.model_copy(update={'installed_operators':installed,'remaining_budget':state.remaining_budget-choice.cost,'current_row':state.current_row+1,'current_turn':state.current_turn+1}),shifted,tuple(checkpoints),(),count,{},'COMPLETE'


def _preimages(request,model):
    state=request.state;bands=_intervals(model.bands);wells=tuple(sorted(_intervals(state.quantities)))
    if set(wells)!=set(bands):return family_result(request,prerequisite_refs=('current_well_band_domain',),domain_complete=False)
    remaining=max(0,state.horizon-state.current_turn)
    if remaining>request.maximum_depth:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'future_rows_depth','remaining_rows':remaining})
    if state.current_row+remaining>len(state.rows):return family_result(request,prerequisite_refs=('observed_remaining_choice_rows_to_horizon',),domain_complete=False)
    parents=[None];branches=[(0,state,{w:Fraction(0) for w in wells},(),0)];count=0;cuts=[];unknown=[];unfunded=[]
    for step in range(1,remaining+1):
        expanded=[]
        for node,current,offset,constraints,cost in branches:
            for choice_index,choice in enumerate(current.rows[current.current_row].choices):
                if len(expanded)>=request.maximum_words or len(parents)>=request.maximum_states:
                    cuts.append({'phase':'future_choice_rows','row_ref':current.rows[current.current_row].row_ref,'next_choice_index':choice_index,'predecessor_node':node});break
                after,shift,checkpoints,debt,work,cut,status=_affine_shift_turn(current,model,choice,offset,request.maximum_evaluations-count);count+=work
                if cut:cuts.append({'predecessor_node':node,'choice_ref':choice.choice_ref,**cut});break
                if debt:unknown.append({'predecessor_node':node,'choice_ref':choice.choice_ref,'missing_refs':debt});continue
                if status=='UNFUNDED':unfunded.append({'predecessor_node':node,'choice_ref':choice.choice_ref});continue
                future=tuple({'well_ref':w,'turn_distance':step,'checkpoint_scope':checkpoint['scope'],'occurrence_ref':checkpoint.get('occurrence_ref'),
                    'additive_offset':_intervals(checkpoint['shift'])[w][0],'required_future_band':bands[w]} for checkpoint in checkpoints for w in wells)
                child=len(parents);parents.append((node,choice.choice_ref))
                expanded.append((child,after,shift,constraints+future,cost+choice.cost))
            if cuts:break
        if cuts:break
        branches=expanded
    rows=[];witness_count=0
    for node,after,offset,constraints,cost in branches:
        initial={w:(None,None) for w in wells}
        for constraint in constraints:
            w=constraint['well_ref'];lo,hi=constraint['required_future_band'];shift=constraint['additive_offset'];oldlo,oldhi=initial[w]
            initial[w]=(lo-shift if oldlo is None else max(oldlo,lo-shift),hi-shift if oldhi is None else min(oldhi,hi-shift))
        feasible=all(initial[w][0] is None or initial[w][0]<=initial[w][1] for w in wells)
        serial=tuple({**c,'additive_offset':str(c['additive_offset']),'required_future_band':tuple(str(v) for v in c['required_future_band'])} for c in constraints)
        funded_completion=after.remaining_budget>0 or model.completion_before_exhaustion
        complete=after.current_turn>=state.horizon and not cuts
        word=None
        if feasible and funded_completion and complete and witness_count<request.maximum_witnesses:
            word,work=_quantity_predecessor_word_d(parents,node,request.maximum_evaluations-count)
            if word is None:cuts.append({'phase':'preimage_witness_reconstruction','node':node})
            else:count+=work;witness_count+=1
        rows.append({'choice_word':word or (),'external_word_materialized':word is not None,
            'predecessor_node':node,'future_band_constraints':serial,'initial_quantity_ranges':tuple({'well_ref':w,'minimum':None if initial[w][0] is None else str(initial[w][0]),'maximum':None if initial[w][1] is None else str(initial[w][1])} for w in wells),
            'preparation_range_nonempty':feasible,'ordered_remaining_occurrences':after.installed_operators,'primitive_cost':cost,'horizon_before_exhaustion':funded_completion,'complete_horizon_rows':complete})
    return family_result(request,values={'future_band_preimages':rows,'unknown_piecewise_branches':unknown,'unfunded_choice_words':unfunded,
        'projection_provenance':_projection(state,model),'preparation_explains_later_rows':True},examined_count=count,
        domain_complete=not cuts and not unknown,computation_bound_reached=bool(cuts),frontier={'cuts':cuts,'pending_choice_nodes':tuple(b[0] for b in branches)} if cuts else {})


def _compile(request,model):
    current=request.state;steps=[];count=0;debt=();cut={}
    for index,ref in enumerate(request.choice_word):
        if index>=request.maximum_depth:cut={'phase':'choice_word_depth','next_choice_index':index};break
        choice=_choice(current,ref)
        if choice is None:debt=('current_word_choice_and_input_mapping',);break
        after,events,debt,work,cut=_turn(current,model,choice,request.maximum_evaluations-count);count+=work
        steps.append({'choice_ref':ref,'input_ref':choice.input_ref,'action_ref':choice.action_ref,'payload':choice.payload,'events':events,'before':current,'after':after,'cost':choice.cost});current=after
        if debt or cut or current.status!='ACTIVE' or current.level_scope_ref!=request.state.level_scope_ref or current.restore_epoch!=request.state.restore_epoch or any(e.get('kind')=='FAILED_VALIDATION_LIFECYCLE' and e.get('lifecycle')=='RESTORE_DECLARED' for e in events):break
    return family_result(request,values={'ordered_choice_certificate':steps,'after_state':current,'horizon_predicate_satisfied':current.status=='WIN' and current.current_turn>=current.horizon
        and (current.level_scope_ref,current.restore_epoch)==(request.state.level_scope_ref,request.state.restore_epoch)
        and not debt and not cut,'complete_word_expanded':len(steps)==len(request.choice_word),
        'primitive_cost':sum(s['cost'] for s in steps),'zero_net_quantity_can_change_drift_and_progress':True,'action_release':False},prerequisite_refs=debt,examined_count=count,
        domain_complete=not debt and not cut and len(steps)==len(request.choice_word),computation_bound_reached=bool(cut),frontier=cut)


def _compare(request):
    expected=request.expected_trace;actual=request.actual_trace;a=request.expected_state;b=request.actual_state;count=len(a.quantities)+len(b.quantities)+len(a.installed_operators)+len(b.installed_operators);cut={};first=None
    if count>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'quantity_occurrences_compare'})
    current=expected is not None and actual is not None and expected.sealed and actual.sealed and expected.event_owner_ref==actual.event_owner_ref==request.scope.event_owner_ref and expected.epoch==actual.epoch==request.scope.epoch and expected.input_ref==actual.input_ref and expected.evidence_revision_ref==actual.evidence_revision_ref==request.scope.evidence_revision_ref and expected.model_revision_ref==actual.model_revision_ref==request.scope.model_revision_ref
    if current:
        for i in range(max(len(expected.events),len(actual.events))):
            if count>=request.maximum_evaluations:cut={'phase':'quantity_micro_event_compare','next_event_index':i};break
            count+=1;x=expected.events[i] if i<len(expected.events) else None;y=actual.events[i] if i<len(actual.events) else None
            if x!=y:first=(i,x,y);break
    fields=tuple((name,getattr(a,name),getattr(b,name)) for name in ('quantities','installed_operators','current_row','current_turn','remaining_budget','status','level_scope_ref','restore_epoch') if (_intervals(a.quantities)!=_intervals(b.quantities) if name=='quantities' else getattr(a,name)!=getattr(b,name)))
    return family_result(request,values={'first_owned_effect_lifetime_checkpoint_mismatch':first,'quantity_lifetime_horizon_scope_changes':fields,'wrong_usefulness_claim':request.expected_usefulness!=request.actual_usefulness if request.expected_usefulness is not None and request.actual_usefulness is not None else None,'temporary_overshoot_is_universal_failure':False,'all_failures_collapsed_to_overflow':False},prerequisite_refs=() if current else ('current_owned_sealed_quantity_event_trace',),examined_count=count,domain_complete=current and not cut,computation_bound_reached=bool(cut),frontier=cut)


def measure_recurring_quantity_control(request: QuantityRequest) -> MechanicalFamilyResult:
    if request.mode is None or OPERATION_MODES.get(request.operation_ref)!=request.mode:return family_result(request,signature_supported=False,domain_complete=False)
    op=request.operation_ref;required={'wells_and_operators':('raw_layer_pixels','layer_templates'),'delta_lifetime_fit':('models','observations'),'glyph_effect':('state','models','bound_model_ref','operator_ref'),
        'turn_successor':('state','models','bound_model_ref','choice_ref'),'boundary_projection':('state','models','bound_model_ref'),'quantity_recurrence':('state','models','bound_model_ref','choice_ref'),
        'future_band_preimages':('state','models','bound_model_ref'),'horizon_viability_domain':('state','models','bound_model_ref'),'choice_word_certificate':('state','models','bound_model_ref','choice_word'),'quantity_compare':('expected_state','actual_state')}
    missing=missing_supplied_fields(request,required[op])
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    if op=='wells_and_operators':
        measured=translated_layers(request);values=dict(measured.values);templates={t.template_ref:t for t in request.layer_templates};rows=values.get('measured_layer_alternatives',())+values.get('possible_layer_alternatives',())
        return measured.model_copy(update={'values':immutable_json_data({**values,'well_operator_lifetime_candidates':tuple({'measurement':r,'component':templates[r['template_ref']].component,'well_candidate_ref':templates[r['template_ref']].well_candidate_ref,'occurrence_candidate_ref':templates[r['template_ref']].occurrence_candidate_ref,
            'quantity_interval':(templates[r['template_ref']].quantity_minimum,templates[r['template_ref']].quantity_maximum) if templates[r['template_ref']].calibration_evidence_ref is not None else None} for r in rows),'identical_glyphs_merged_into_one_occurrence':False})})
    if op=='delta_lifetime_fit':return _fit(request)
    if op=='quantity_compare':return _compare(request)
    model=next((m for m in request.models if m.model_ref==request.bound_model_ref),None)
    if model is None:return family_result(request,prerequisite_refs=('bound_current_quantity_model',),domain_complete=False)
    if op=='horizon_viability_domain':return _domain(request,model)
    if op=='future_band_preimages':return _preimages(request,model)
    if op=='choice_word_certificate':return _compile(request,model)
    work=len(request.state.quantities)+len(request.state.installed_operators)+sum(len(o.deltas) for row in request.state.rows for choice in row.choices for o in choice.ordered_operators)
    if work>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'quantity_projection_or_effect'})
    if op=='boundary_projection':return family_result(request,values=_projection(request.state,model),examined_count=work)
    if op=='glyph_effect':
        operator=next((o for o in request.state.installed_operators if o.occurrence_ref==request.operator_ref),None)
        if operator is None:return family_result(request,prerequisite_refs=('current_operator_occurrence',),domain_complete=False)
        after,changed,events,debt=_effect(request.state,operator,model)
        return family_result(request,values={'after_state':after,'after_operator':changed,'micro_events':events,'external_command_count':0},prerequisite_refs=debt,examined_count=work,domain_complete=not debt)
    choice=_choice(request.state,request.choice_ref)
    if choice is None:return family_result(request,prerequisite_refs=('current_choice_group',),domain_complete=False)
    if op=='quantity_recurrence':
        result,projection,debt=_recurrence(request.state,model,choice);return family_result(request,values={'boundary_successor':result,'projection_provenance':projection},prerequisite_refs=debt,examined_count=work,domain_complete=not debt)
    after,events,debt,count,cut=_turn(request.state,model,choice,request.maximum_evaluations)
    return family_result(request,values={'after_state':after,'ordered_micro_events':events,'actual_primitive_cost':choice.cost,'external_command_count':1},prerequisite_refs=debt,examined_count=count,domain_complete=not debt and not cut,computation_bound_reached=bool(cut),frontier=cut)
