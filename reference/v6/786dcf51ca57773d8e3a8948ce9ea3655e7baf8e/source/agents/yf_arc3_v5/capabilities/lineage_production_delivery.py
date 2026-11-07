"""Finite occurrence lineage, ordered signatures and preserved deliveries."""
from collections import deque
from typing import Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref, immutable_json_data
from .mechanical_family_contracts_a import MechanicalFamilyScope, MechanicalFamilyResult, family_result, missing_supplied_fields
from .identity_contact_authentication import ContactPixel, ContactLayerTemplate, ContactLayerSample, _candidate_layers as translated_layers
from .mutable_kit_survival import KitEventTrace as LineageEventTrace

Point=tuple[int,int]


class LineageMark(FrozenModel):
    mark_ref: Ref
    part_ref: Ref
    ordinal: int = Field(ge=0,le=255)
    point: Point
    value_ref: Ref


def _signature(marks):
    # Position, value, part and ordinal all matter; never an unordered pair/vector.
    return tuple((m.ordinal,m.part_ref,m.point,m.value_ref) for m in sorted(marks,key=lambda m:m.ordinal))


class LineageEntity(FrozenModel):
    entity_ref: Ref
    lineage_ref: Ref
    type_ref: Ref
    kind: Literal['SEED','PARENT','COMPOUND','DESCENDANT','SUPPORT']
    position: Point
    shell_ref: Ref
    connector_ref: Ref | None = None
    marks: tuple[LineageMark, ...] = Field(max_length=256)
    signature_known: bool
    orientation_ref: Ref
    enclosing_ref: Ref | None = None
    hit_ref: Ref
    @model_validator(mode='after')
    def parts(self):
        if len({m.mark_ref for m in self.marks})!=len(self.marks) or len({m.ordinal for m in self.marks})!=len(self.marks):raise ValueError('ordered mark occurrences remain distinct inside the carrier')
        return self


class LineageReceptor(FrozenModel):
    receptor_ref: Ref
    phenotype_ref: Ref
    required_signature: tuple[LineageMark, ...] | None = Field(default=None,max_length=256)
    filled_entity_ref: Ref | None = None
    position: Point
    hit_ref: Ref


class LineageInput(FrozenModel):
    input_ref: Ref
    action_ref: Ref
    payload: FrozenMap
    kind: Literal['SELECT','CANCEL','BIRTH','MERGE','SPLIT','ROTATE','DELIVER']
    subject_ref: Ref
    hit_ref: Ref
    cost: int = Field(ge=0,le=65536)
    transform_ref: Ref | None = None


class LineageState(FrozenModel):
    entities: tuple[LineageEntity, ...] = Field(max_length=128)
    receptors: tuple[LineageReceptor, ...] = Field(max_length=128)
    controlled_entity_ref: Ref | None = None
    inputs: tuple[LineageInput, ...] = Field(max_length=512)
    bindings_current: bool
    episode_ref: Ref
    association_revision_ref: Ref
    occurrence_namespace_ref: Ref
    production_index: int = Field(ge=0)
    remaining_budget: int = Field(ge=0,le=65536)
    level_scope_ref: Ref
    restore_epoch: int = Field(ge=0)
    status: Literal['ACTIVE','WIN','LOCAL_STOP','GAME_OVER']
    @model_validator(mode='after')
    def identity(self):
        refs={e.entity_ref for e in self.entities}
        if len(refs)!=len(self.entities) or self.controlled_entity_ref is not None and self.controlled_entity_ref not in refs:raise ValueError('exclusive selection names an extant entity occurrence')
        if len({r.receptor_ref for r in self.receptors})!=len(self.receptors) or len({i.input_ref for i in self.inputs})!=len(self.inputs):raise ValueError('distinct requests and current inputs')
        return self


class SignatureTransform(FrozenModel):
    transform_ref: Ref
    matrix: tuple[Point,Point]
    offset: Point
    affected_part_refs: tuple[Ref, ...] = Field(max_length=256)
    resulting_orientation_ref: Ref
    scope: Literal['CORE_ONLY','WHOLE_CARRIER']
    shell_after_ref: Ref | None = None
    position_after: Point | None = None


class LineageAssociation(FrozenModel):
    association_ref: Ref
    episode_ref: Ref
    revision_ref: Ref
    signature: tuple[LineageMark, ...] = Field(max_length=256)
    phenotype_ref: Ref
    accepted_evidence_ref: Ref
    event_owner_ref: Ref
    current_epoch: int = Field(ge=0)


class LineageProduct(FrozenModel):
    type_ref: Ref
    kind: Literal['PARENT','COMPOUND','DESCENDANT']
    lineage_ref: Ref
    position: Point
    shell_ref: Ref
    connector_ref: Ref | None = None
    marks: tuple[LineageMark, ...] = Field(max_length=256)
    signature_known: bool
    orientation_ref: Ref
    hit_ref: Ref


class ProductionRule(FrozenModel):
    rule_ref: Ref
    kind: Literal['BIRTH','MERGE','SPLIT']
    input_type_refs: tuple[Ref, ...] = Field(min_length=1,max_length=128)
    input_kind_refs: tuple[Literal['SEED','PARENT','COMPOUND','DESCENDANT','SUPPORT'], ...] = Field(min_length=1,max_length=128)
    # Exact ordered signature conditions, optionally unknown per operand.
    input_signatures: tuple[tuple[LineageMark, ...] | None, ...] = Field(min_length=1,max_length=128)
    ordered_inputs: bool
    complementary_connector_pairs: tuple[tuple[Ref,Ref], ...] = Field(max_length=128)
    same_lineage_required: bool
    selection_required: bool
    consumes_input_indices: tuple[int, ...] = Field(max_length=128)
    products: tuple[LineageProduct, ...] = Field(max_length=128)
    selection_after: Literal['CLEAR','RETAIN_IF_EXTANT','FIRST_PRODUCT']
    @model_validator(mode='after')
    def arity(self):
        if len(self.input_type_refs)!=len(self.input_kind_refs) or len(self.input_signatures)!=len(self.input_type_refs):raise ValueError('explicit production arity and complete operand conditions')
        if len(set(self.consumes_input_indices))!=len(self.consumes_input_indices) or any(i<0 or i>=len(self.input_type_refs) for i in self.consumes_input_indices):raise ValueError('consume each declared operand occurrence once')
        return self


class LineageLayout(FrozenModel):
    entity_refs: tuple[Ref, ...] = Field(max_length=128)
    geometry_signature: tuple[tuple[Ref,Point,Ref], ...] = Field(max_length=128)
    inputs: tuple[LineageInput, ...] = Field(max_length=512)


class LineageModel(FrozenModel):
    model_ref: Ref
    rules: tuple[ProductionRule, ...] = Field(max_length=128)
    transforms: tuple[SignatureTransform, ...] = Field(max_length=128)
    layouts: tuple[LineageLayout, ...] = Field(max_length=128)
    repeated_selection: Literal['CANCEL','RETAIN']
    incompatible_second_parent: Literal['SWITCH','RETAIN','CLEAR']
    compatible_second_parent: Literal['SELECT_ONLY','MERGE']
    delivery_consumes: bool
    occupied_delivery: Literal['REFUSE','OVERWRITE']
    preserve_selection_after_rotation: bool
    completed_receptors_win: bool
    completion_before_exhaustion: bool
    exhaustion_status: Literal['LOCAL_STOP','GAME_OVER','UNKNOWN']
    production_domain_complete: bool
    @model_validator(mode='after')
    def references(self):
        for rows,name in ((self.rules,'rule_ref'),(self.transforms,'transform_ref')):
            if len({getattr(r,name) for r in rows})!=len(rows):raise ValueError('distinct supplied production and orientation laws')
        if len({(tuple(sorted(l.entity_refs)),tuple(sorted(l.geometry_signature))) for l in self.layouts})!=len(self.layouts):raise ValueError('one current binding layout per occurrence population and geometry')
        return self


class LineageLayerTemplate(ContactLayerTemplate):
    component: Literal['ENCLOSING_SUPPORT','OUTER_SHELL','CONNECTOR','ORDERED_MARK','NEUTRAL_DESCENDANT','RECEPTOR','UNKNOWN']
    entity_candidate_ref: Ref | None = None
    enclosing_candidate_ref: Ref | None = None
    ordinal_candidate: int | None = Field(default=None,ge=0,le=255)


class SignatureObservation(FrozenModel):
    observation_ref: Ref
    source_marks: tuple[LineageMark, ...] = Field(max_length=256)
    observed_marks: tuple[LineageMark, ...] | None = Field(default=None,max_length=256)
    allowed_transform_refs: tuple[Ref, ...] = Field(max_length=128)
    phenotype_ref: Ref | None = None
    episode_ref: Ref
    association_revision_ref: Ref
    accepted_evidence_ref: Ref | None = None
    neutral_rendering: bool
    event_owner_ref: Ref
    epoch: int = Field(ge=0)


class LineageRequest(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.lineage_request.v1'
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None = None
    maximum_evaluations: int = Field(ge=1,le=65536)
    maximum_states: int = Field(ge=1,le=4096)
    maximum_depth: int = Field(ge=0,le=256)
    maximum_assignments: int = Field(ge=1,le=128)
    state: LineageState | None = None
    models: tuple[LineageModel, ...] = Field(default=(),max_length=128)
    bound_model_ref: Ref | None = None
    input_ref: Ref | None = None
    operand_refs: tuple[Ref, ...] = Field(default=(),max_length=128)
    bound_rule_ref: Ref | None = None
    entity_ref: Ref | None = None
    transform_ref: Ref | None = None
    receptor_ref: Ref | None = None
    required_receptor_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    required_orientation_marks: tuple[LineageMark,...] | None = Field(default=None,max_length=256)
    collect_delivery_dependencies: bool = False
    associations: tuple[LineageAssociation, ...] = Field(default=(),max_length=128)
    signature_observations: tuple[SignatureObservation, ...] = Field(default=(),max_length=256)
    expected_state: LineageState | None = None
    actual_state: LineageState | None = None
    expected_trace: LineageEventTrace | None = None
    actual_trace: LineageEventTrace | None = None
    raw_layer_pixels: tuple[ContactPixel, ...] = Field(default=(),max_length=65536)
    layer_templates: tuple[LineageLayerTemplate, ...] = Field(default=(),max_length=4096)
    layer_samples: tuple[ContactLayerSample, ...] = Field(default=(),max_length=4096)
    @model_validator(mode='after')
    def identities(self):
        if len(set(self.required_receptor_refs))!=len(self.required_receptor_refs):
            raise ValueError('requested receptor identities must remain distinct')
        for rows,name in ((self.models,'model_ref'),(self.associations,'association_ref'),(self.layer_templates,'template_ref')):
            if len({getattr(r,name) for r in rows})!=len(rows):raise ValueError('distinct current model/association/template alternatives')
        return self


OPERATION_MODES={'lineage_carriers':'MEASURE','signature_correspondence':'FIT','parent_compatibility':'PRECONDITION','birth_merge_split':'STEP_INTERNAL','signature_rotation':'STEP_INTERNAL',
    'delivery_assignment':'INVERSE_DOMAIN','lineage_transaction':'STEP','preserve_requests':'PRECONDITION','production_delivery_domain':'DOMAIN','lineage_compare_memory':'COMPARE'}


def _entities(state):return {e.entity_ref:e for e in state.entities}


def _ordered_operands(state,rule,refs):
    entities=_entities(state)
    if len(set(refs))!=len(refs) or len(refs)!=len(rule.input_type_refs) or any(r not in entities for r in refs):return (),('distinct_current_operand_occurrences',)
    if any(sig is None for sig in rule.input_signatures):return (),('complete_scoped_operand_signature_conditions',)
    if rule.ordered_inputs:return tuple(entities[r] for r in refs),()
    remaining=list(refs);operands=[]
    for kind,type_ref,signature in zip(rule.input_kind_refs,rule.input_type_refs,rule.input_signatures):
        matches=tuple(r for r in remaining if entities[r].kind==kind and entities[r].type_ref==type_ref and _signature(entities[r].marks)==_signature(signature))
        if not matches:return (),('operand_type_family_or_signature_mismatch',)
        if len(matches)>1 and rule.consumes_input_indices and len(rule.consumes_input_indices)!=len(refs):return (),('ambiguous_unordered_operand_occurrence_binding',)
        # Equal patterns consumed all/none are physically exchangeable; keep supplied order.
        ref=matches[0];remaining.remove(ref);operands.append(entities[ref])
    return tuple(operands),()


def _transform_marks(marks,transform):
    return tuple(m.model_copy(update={'point':tuple(sum(a*b for a,b in zip(row,m.point))+offset for row,offset in zip(transform.matrix,transform.offset))})
        if m.part_ref in transform.affected_part_refs else m for m in marks)


def _compatibility(state,rule,refs):
    operands,debt=_ordered_operands(state,rule,refs)
    if debt:return False,debt
    if any(not e.signature_known for e in operands):return False,('complete_current_operand_signatures',)
    if tuple(e.type_ref for e in operands)!=rule.input_type_refs or tuple(e.kind for e in operands)!=rule.input_kind_refs:return False,('operand_type_or_family_mismatch',)
    if rule.selection_required and state.controlled_entity_ref not in refs:return False,('current_selected_operand',)
    if rule.same_lineage_required and len({e.lineage_ref for e in operands})!=1:return False,('lineage_condition_mismatch',)
    if rule.complementary_connector_pairs and len(operands)==2 and (operands[0].connector_ref,operands[1].connector_ref) not in rule.complementary_connector_pairs:return False,('complementary_connector_mismatch',)
    if any(sig is None for sig in rule.input_signatures):return False,('complete_scoped_operand_signature_conditions',)
    if any(_signature(e.marks)!=_signature(sig) for e,sig in zip(operands,rule.input_signatures)):return False,('ordered_signature_mismatch',)
    return True,()


def _production(state,rule,refs):
    compatible,debt=_compatibility(state,rule,refs)
    if not compatible:return state,(),debt
    entities=_entities(state);operands,_=_ordered_operands(state,rule,refs)
    consumed=tuple(operands[i].entity_ref for i in rule.consumes_input_indices)
    if len(entities)-len(consumed)+len(rule.products)>128:return state,(),('bounded_population_domain',)
    products=tuple(LineageEntity(entity_ref=f'{state.occurrence_namespace_ref}.product.{state.production_index}.{i}',lineage_ref=p.lineage_ref,type_ref=p.type_ref,kind=p.kind,position=p.position,shell_ref=p.shell_ref,
        connector_ref=p.connector_ref,marks=p.marks,signature_known=p.signature_known,orientation_ref=p.orientation_ref,hit_ref=p.hit_ref) for i,p in enumerate(rule.products))
    if any(p.entity_ref in entities for p in products):return state,(),('fresh_product_occurrence_namespace',)
    for ref in consumed:del entities[ref]
    for entity in products:entities[entity.entity_ref]=entity
    selected=state.controlled_entity_ref
    if rule.selection_after=='CLEAR' or selected not in entities:selected=None
    if rule.selection_after=='FIRST_PRODUCT':selected=products[0].entity_ref if products else None
    after=state.model_copy(update={'entities':tuple(entities[r] for r in sorted(entities)),'controlled_entity_ref':selected,'production_index':state.production_index+1})
    edge={'rule_ref':rule.rule_ref,'consumed_occurrences':consumed,'produced_occurrences':tuple(p.entity_ref for p in products),'parent_occurrences':tuple(e.entity_ref for e in operands),'lineage_refs':tuple(p.lineage_ref for p in products)}
    return after,(edge,),()


def _associations(request,state):
    return tuple(a for a in request.associations if a.episode_ref==state.episode_ref and a.revision_ref==state.association_revision_ref and a.event_owner_ref==request.scope.event_owner_ref and a.current_epoch==request.scope.epoch)


def _accepts(entity,receptor,associations):
    if entity.kind!='DESCENDANT':return False
    if not entity.signature_known:return None
    sig=_signature(entity.marks)
    if receptor.required_signature is not None:return sig==_signature(receptor.required_signature)
    if any(a.phenotype_ref==receptor.phenotype_ref and _signature(a.signature)==sig for a in associations):return True
    return None


def _relayout(before,after,model):
    geometry=lambda s:tuple(sorted((e.entity_ref,e.position,e.hit_ref) for e in s.entities))
    if geometry(before)==geometry(after):return after,()
    refs=tuple(sorted(e.entity_ref for e in after.entities));key=geometry(after);layout=next((l for l in model.layouts if tuple(sorted(l.entity_refs))==refs and tuple(sorted(l.geometry_signature))==key),None)
    if layout is None:return after.model_copy(update={'inputs':(),'bindings_current':False}),('current_production_hit_bindings',)
    return after.model_copy(update={'inputs':layout.inputs,'bindings_current':True}),()


def _step(request,state,model,command):
    if state.status!='ACTIVE' or not state.bindings_current:return state,(),('current_active_lineage_hit_bindings',),False
    if command not in state.inputs or command.cost>state.remaining_budget:return state,(),('current_financed_hit_input',),False
    entities=_entities(state);subject=entities.get(command.subject_ref);receptor=next((r for r in state.receptors if r.receptor_ref==command.subject_ref),None)
    expected_hit=subject.hit_ref if subject else receptor.hit_ref if receptor else None
    if command.kind!='CANCEL' and command.hit_ref!=expected_hit:return state,(),('exact_current_hit_geometry',),False
    after=state;events=[];debt=()
    if command.kind=='CANCEL':after=state.model_copy(update={'controlled_entity_ref':None});events.append({'kind':'CANCEL'})
    elif command.kind=='SELECT':
        if subject is None:return state,(),('current_entity_hit',),False
        if state.controlled_entity_ref==subject.entity_ref:after=state.model_copy(update={'controlled_entity_ref':None if model.repeated_selection=='CANCEL' else subject.entity_ref})
        elif state.controlled_entity_ref is None:after=state.model_copy(update={'controlled_entity_ref':subject.entity_ref})
        else:
            refs=(state.controlled_entity_ref,subject.entity_ref);ready=tuple(r for r in model.rules if r.kind=='MERGE' and _compatibility(state,r,refs)[0])
            uncertain=tuple(d for r in model.rules if r.kind=='MERGE' for d in _compatibility(state,r,refs)[1] if d in ('complete_scoped_operand_signature_conditions','complete_current_operand_signatures','ambiguous_unordered_operand_occurrence_binding'))
            if not model.production_domain_complete or uncertain:debt=('complete_current_parent_compatibility_domain',)+tuple(dict.fromkeys(uncertain))
            elif len(ready)>1:debt=('unique_current_merge_rule',)
            elif ready and model.compatible_second_parent=='MERGE':after,production,debt=_production(state,ready[0],refs);events.extend(production)
            elif ready:after=state.model_copy(update={'controlled_entity_ref':subject.entity_ref})
            else:after=state.model_copy(update={'controlled_entity_ref':subject.entity_ref if model.incompatible_second_parent=='SWITCH' else state.controlled_entity_ref if model.incompatible_second_parent=='RETAIN' else None})
        events.append({'kind':'SELECTION','controlled_after':after.controlled_entity_ref})
    elif command.kind in ('BIRTH','MERGE','SPLIT'):
        refs=(state.controlled_entity_ref,command.subject_ref) if command.kind=='MERGE' else (command.subject_ref,)
        rules=tuple(r for r in model.rules if r.kind==command.kind and _compatibility(state,r,refs)[0])
        if not model.production_domain_complete:debt=('complete_current_production_rule_domain',)
        elif len(rules)!=1:debt=('unique_supported_production_rule',)
        else:after,production,debt=_production(state,rules[0],refs);events.extend(production)
    elif command.kind=='ROTATE':
        transform=next((t for t in model.transforms if t.transform_ref==command.transform_ref),None)
        if subject is None or state.controlled_entity_ref!=subject.entity_ref or transform is None:debt=('selected_orientation_mechanism',)
        else:
            changed=subject.model_copy(update={'marks':_transform_marks(subject.marks,transform),'orientation_ref':transform.resulting_orientation_ref,
                'shell_ref':subject.shell_ref if transform.scope=='CORE_ONLY' else transform.shell_after_ref or subject.shell_ref,'position':subject.position if transform.scope=='CORE_ONLY' else transform.position_after or subject.position})
            entities[subject.entity_ref]=changed;after=state.model_copy(update={'entities':tuple(entities[r] for r in sorted(entities)),'controlled_entity_ref':subject.entity_ref if model.preserve_selection_after_rotation else None});events.append({'kind':'ROTATE','before':subject,'after':changed,'scope':transform.scope})
    elif command.kind=='DELIVER':
        selected=entities.get(state.controlled_entity_ref)
        if receptor is None or selected is None:debt=('selected_descendant_and_current_receptor',)
        elif receptor.filled_entity_ref is not None and model.occupied_delivery=='REFUSE':events.append({'kind':'DELIVERY_REFUSED','cause':'occupied_request'})
        elif _accepts(selected,receptor,_associations(request,state)) is None:debt=('current_signature_phenotype_acceptance_association',)
        elif not _accepts(selected,receptor,_associations(request,state)):events.append({'kind':'DELIVERY_REFUSED','cause':'incompatible_oriented_signature'})
        else:
            receptors=tuple(r.model_copy(update={'filled_entity_ref':selected.entity_ref}) if r.receptor_ref==receptor.receptor_ref else r for r in state.receptors)
            if model.delivery_consumes:del entities[selected.entity_ref]
            after=state.model_copy(update={'entities':tuple(entities[r] for r in sorted(entities)),'receptors':receptors,'controlled_entity_ref':None if model.delivery_consumes else selected.entity_ref});events.append({'kind':'DELIVERY','receptor_ref':receptor.receptor_ref,'entity':selected,'previous_fill_ref':receptor.filled_entity_ref})
    if debt:return state,tuple(events),debt,False
    after=after.model_copy(update={'remaining_budget':state.remaining_budget-command.cost});events.append({'kind':'COMMAND_COST','input_ref':command.input_ref,'cost':command.cost})
    complete=model.completed_receptors_win and bool(after.receptors) and all(r.filled_entity_ref is not None for r in after.receptors)
    if complete and (model.completion_before_exhaustion or after.remaining_budget>0):after=after.model_copy(update={'status':'WIN'})
    elif after.remaining_budget<=0:
        if model.exhaustion_status=='UNKNOWN':debt=('current_exhaustion_lifecycle',)
        else:after=after.model_copy(update={'status':model.exhaustion_status})
    if after.status=='ACTIVE':after,layout_debt=_relayout(state,after,model);debt=debt+layout_debt
    return after,tuple(events),debt,True


def _signature_fit(request):
    transforms=tuple((m.model_ref,t) for m in request.models for t in m.transforms);rows=[];proposals=[];count=0;cuts=[];unknown=[]
    for index,o in enumerate(request.signature_observations):
        if (o.event_owner_ref!=request.scope.event_owner_ref or o.epoch!=request.scope.epoch
                or request.state is not None and (o.episode_ref!=request.state.episode_ref
                    or o.association_revision_ref!=request.state.association_revision_ref)):
            unknown.append((o.observation_ref,'current_signature_evidence'));continue
        candidates=[]
        for model_ref,t in transforms:
            if t.transform_ref not in o.allowed_transform_refs:continue
            work=len(o.source_marks)+len(o.observed_marks or ())
            if count+work>request.maximum_evaluations:cuts.append({'phase':'ordered_signature_fit','next_observation_index':index,'next_transform_ref':t.transform_ref});break
            count+=work;predicted=_transform_marks(o.source_marks,t)
            if o.observed_marks is None:
                candidates.append({'model_ref':model_ref,'transform_ref':t.transform_ref,'predicted_signature':predicted,'neutral_rendering_hides_signature':o.neutral_rendering,'observed_signature_proved':False})
            elif _signature(predicted)==_signature(o.observed_marks):
                candidates.append({'model_ref':model_ref,'transform_ref':t.transform_ref,'predicted_signature':predicted,'observed_signature_proved':True})
                if o.phenotype_ref is not None and o.accepted_evidence_ref is not None:
                    proposals.append(LineageAssociation(association_ref=f'{o.observation_ref}.association.{len(proposals)}',episode_ref=o.episode_ref,revision_ref=o.association_revision_ref,
                        signature=predicted,phenotype_ref=o.phenotype_ref,accepted_evidence_ref=o.accepted_evidence_ref,event_owner_ref=request.scope.event_owner_ref,current_epoch=request.scope.epoch))
        if cuts:break
        rows.append({'observation_ref':o.observation_ref,'compatible_transform_signatures':candidates,'phenotype_candidate_ref':o.phenotype_ref,'lineage_assigned_from_vector':False})
        if o.observed_marks is None:unknown.append((o.observation_ref,'unmasked_ordered_signature_or_scoped_acceptance_association'))
    return family_result(request,values={'signature_correspondences':rows,'proposed_scoped_acceptance_associations':proposals,'canonical_associations_published':False,'unknown_associations':unknown},examined_count=count,domain_complete=not cuts and not unknown,computation_bound_reached=bool(cuts),frontier={'cuts':cuts} if cuts else {})


def _assignment(request,state=None):
    from .lineage_assignment_d import calculate_lineage_assignment_d
    state=state or request.state
    return calculate_lineage_assignment_d(request,state,_accepts,_associations(request,state),family_result)


def _preserve(request):
    state=request.state;entity=_entities(state).get(request.entity_ref);receptor=next((r for r in state.receptors if r.receptor_ref==request.receptor_ref),None)
    if entity is None or receptor is None:return family_result(request,prerequisite_refs=('current_descendant_and_receptor',),domain_complete=False)
    occupied=receptor.filled_entity_ref is not None;compatible=_accepts(entity,receptor,_associations(request,state));alternatives=tuple(r.receptor_ref for r in state.receptors if r.filled_entity_ref is None and _accepts(entity,r,_associations(request,state)))
    if occupied:return family_result(request,values={'occupied_request_conflict':True,'proposed_delivery_preserves_requests':False,
        'remaining_assignments_financed':False,'alternative_open_destinations':alternatives,'overwrite_is_new_progress':False},examined_count=len(state.receptors))
    model=next((m for m in request.models if m.model_ref==request.bound_model_ref),None)
    if model is None:return family_result(request,prerequisite_refs=('lineage_assignment.current_delivery_consumption_protocol',),domain_complete=False)
    residual=state.model_copy(update={'entities':tuple(e for e in state.entities if not model.delivery_consumes or e.entity_ref!=entity.entity_ref),
        'controlled_entity_ref':None if model.delivery_consumes and state.controlled_entity_ref==entity.entity_ref else state.controlled_entity_ref,
        'receptors':tuple(r.model_copy(update={'filled_entity_ref':entity.entity_ref}) if r.receptor_ref==receptor.receptor_ref else r for r in state.receptors)})
    result=_assignment(request,residual);financed=any(row['complete_assignment'] for row in result.values.get('joint_assignments',()))
    return result.model_copy(update={'values':immutable_json_data({**dict(result.values),'proposed_delivery_preserves_requests':not occupied and compatible is True,'remaining_assignments_financed':financed,'occupied_request_conflict':occupied,
        'alternative_open_destinations':alternatives,'overwrite_is_new_progress':False})})


def _domain(request,model):
    nodes=[request.state];depths=[0];parents=[None];seen={request.state:0};queue=deque([0]);edges=[];cuts=[];boundaries=[];count=0;witnesses=[];witness_node=None
    requested=set(request.required_receptor_refs)
    if requested and not requested<={r.receptor_ref for r in request.state.receptors}:
        return family_result(request,prerequisite_refs=('current_requested_receptor_bindings',),domain_complete=False)
    while queue:
        index=queue.popleft();state=nodes[index]
        achieved=(bool(requested) and requested<={r.receptor_ref for r in state.receptors if r.filled_entity_ref is not None}) or state.status=='WIN'
        if achieved and not witnesses:
            if count+depths[index]>request.maximum_evaluations:cuts.append({'node':index,'reason':'witness_reconstruction_bound'});break
            count+=depths[index];word=[];cursor=index
            while parents[cursor] is not None:
                previous,input_ref=parents[cursor];word.append(input_ref);cursor=previous
            witnesses.append(tuple(reversed(word)))
            witness_node=index
        if achieved:continue
        if state.status!='ACTIVE':continue
        if not state.bindings_current:boundaries.append((index,'current_production_hit_bindings'));continue
        if depths[index]>=request.maximum_depth:cuts.append({'node':index,'reason':'depth_bound'});continue
        for command_index,command in enumerate(state.inputs):
            work=1+len(state.entities)+sum(len(r.input_type_refs)+len(r.products) for r in model.rules)+sum(len(e.marks) for e in state.entities)
            if count+work>request.maximum_evaluations:cuts.append({'node':index,'next_command_index':command_index,'reason':'evaluation_bound'});queue.clear();break
            count+=work;after,events,debt,applied=_step(request,state,model,command)
            if debt:boundaries.append({'node':index,'input_ref':command.input_ref,'after_prefix_state':after,'events':events,'missing_refs':debt});continue
            if not applied:continue
            child=seen.get(after)
            if child is None:
                if len(nodes)>=request.maximum_states:cuts.append({'node':index,'next_command_index':command_index,'reason':'state_bound'});continue
                child=len(nodes);seen[after]=child;nodes.append(after);depths.append(depths[index]+1);parents.append((index,command.input_ref));queue.append(child)
            edges.append({'from_node':index,'to_node':child,'input':command,'events':events})
    dependencies={}
    if request.collect_delivery_dependencies:
        from .lineage_delivery_dependencies_d import project_lineage_delivery_dependencies_d
        dependencies=project_lineage_delivery_dependencies_d(request,nodes,edges,parents,witness_node,
            max(0,request.maximum_evaluations-count))
        count+=dependencies.get('examined_count',0)
    return family_result(request,values={'production_delivery_states':nodes,'interleaved_command_edges':edges,
        'delivery_dependency_projection':dependencies,
        'conditional_complete_words':tuple(witnesses),'observation_boundaries':boundaries,
        'requested_receptor_refs':request.required_receptor_refs,'first_complete_witness_in_supplied_input_order':True,
        'all_merges_before_delivery_required':False},examined_count=count,
        domain_complete=not cuts and not boundaries,computation_bound_reached=bool(cuts),
        frontier={'cuts':cuts,'pending_node_indices':tuple(queue),'predecessor_links':tuple(parents)} if cuts else {})


def _compare(request):
    a=request.expected_state;b=request.actual_state;left=_entities(a);right=_entities(b);count=len(left)+len(right);changes=tuple((ref,left.get(ref),right.get(ref)) for ref in sorted(set(left)|set(right)) if left.get(ref)!=right.get(ref))
    expected=request.expected_trace;actual=request.actual_trace;current=expected is not None and actual is not None and expected.sealed and actual.sealed and expected.event_owner_ref==actual.event_owner_ref==request.scope.event_owner_ref and expected.epoch==actual.epoch==request.scope.epoch and expected.input_ref==actual.input_ref and expected.evidence_revision_ref==actual.evidence_revision_ref==request.scope.evidence_revision_ref and expected.model_revision_ref==actual.model_revision_ref==request.scope.model_revision_ref
    first=None;cut={}
    if count>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'lineage_population_compare'})
    if current:
        for i in range(max(len(expected.events),len(actual.events))):
            if count>=request.maximum_evaluations:cut={'phase':'lineage_events_compare','next_event_index':i};break
            count+=1;x=expected.events[i] if i<len(expected.events) else None;y=actual.events[i] if i<len(actual.events) else None
            if x!=y:first=(i,x,y);break
    fields=tuple((n,getattr(a,n),getattr(b,n)) for n in ('controlled_entity_ref','receptors','episode_ref','association_revision_ref','remaining_budget','status','level_scope_ref','restore_epoch') if getattr(a,n)!=getattr(b,n))
    accepted=_associations(request,b);stale=tuple(x.association_ref for x in request.associations if x not in accepted)
    return family_result(request,values={'population_signature_lineage_changes':changes,'selection_request_episode_changes':fields,'first_owned_event_contradiction':first,
        'current_episode_associations':accepted,'associations_requiring_revalidation':stale,'unavailable_reset_invented':False},prerequisite_refs=() if current else ('current_owned_sealed_lineage_trace',),examined_count=count,
        domain_complete=current and not cut,computation_bound_reached=bool(cut),frontier=cut)


def measure_lineage_production_delivery(request: LineageRequest) -> MechanicalFamilyResult:
    if request.mode is None or OPERATION_MODES.get(request.operation_ref)!=request.mode:return family_result(request,signature_supported=False,domain_complete=False)
    op=request.operation_ref;required={'lineage_carriers':('raw_layer_pixels','layer_templates'),'signature_correspondence':('models','signature_observations'),
        'parent_compatibility':('state','models','bound_model_ref','operand_refs','bound_rule_ref'),'birth_merge_split':('state','models','bound_model_ref','operand_refs','bound_rule_ref'),
        'signature_rotation':('state','models','bound_model_ref','entity_ref','transform_ref'),'delivery_assignment':('state',),'lineage_transaction':('state','models','bound_model_ref','input_ref'),
        'preserve_requests':('state','entity_ref','receptor_ref'),'production_delivery_domain':('state','models','bound_model_ref'),'lineage_compare_memory':('expected_state','actual_state')}
    missing=missing_supplied_fields(request,required[op])
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    if op=='lineage_carriers':
        result=translated_layers(request);values=dict(result.values);templates={t.template_ref:t for t in request.layer_templates};rows=values.get('measured_layer_alternatives',())+values.get('possible_layer_alternatives',())
        return result.model_copy(update={'values':immutable_json_data({**values,'carrier_part_candidates':tuple({'physical_measurement':r,'component':templates[r['template_ref']].component,'entity_candidate_ref':templates[r['template_ref']].entity_candidate_ref,'enclosing_candidate_ref':templates[r['template_ref']].enclosing_candidate_ref,'ordinal_candidate':templates[r['template_ref']].ordinal_candidate} for r in rows),'contained_entity_absorbed_into_parent':False})})
    if op=='signature_correspondence':return _signature_fit(request)
    if op=='delivery_assignment':return _assignment(request)
    if op=='preserve_requests':return _preserve(request)
    if op=='lineage_compare_memory':return _compare(request)
    model=next((m for m in request.models if m.model_ref==request.bound_model_ref),None)
    if model is None:return family_result(request,prerequisite_refs=('bound_current_lineage_model',),domain_complete=False)
    if op=='production_delivery_domain':return _domain(request,model)
    work=len(request.state.entities)+sum(len(e.marks) for e in request.state.entities)+sum(len(r.input_type_refs)+len(r.products) for r in model.rules)
    if work>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'lineage_local_transaction'})
    if op in ('parent_compatibility','birth_merge_split'):
        rule=next((r for r in model.rules if r.rule_ref==request.bound_rule_ref),None)
        if rule is None:return family_result(request,prerequisite_refs=('current_bound_production_rule',),domain_complete=False)
        supported,debt=_compatibility(request.state,rule,request.operand_refs)
        if op=='parent_compatibility':
            missing=tuple(d for d in debt if d in ('complete_scoped_operand_signature_conditions','complete_current_operand_signatures','ambiguous_unordered_operand_occurrence_binding'))
            return family_result(request,values={'pair_compatible':supported,'mismatch_refs':debt,'touching_implies_kinship':False},prerequisite_refs=missing,examined_count=work,domain_complete=not missing)
        after,edges,debt=_production(request.state,rule,request.operand_refs)
        if not debt:after,layout_debt=_relayout(request.state,after,model);debt=debt+layout_debt
        return family_result(request,values={'after_state':after,'lineage_edges':edges,'external_command_count':0},prerequisite_refs=debt,examined_count=work,domain_complete=not debt)
    if op=='signature_rotation':
        entity=_entities(request.state).get(request.entity_ref);transform=next((t for t in model.transforms if t.transform_ref==request.transform_ref),None)
        if entity is None or transform is None or request.state.controlled_entity_ref!=entity.entity_ref:return family_result(request,prerequisite_refs=('selected_current_orientation_mechanism',),domain_complete=False)
        changed=entity.model_copy(update={'marks':_transform_marks(entity.marks,transform),'orientation_ref':transform.resulting_orientation_ref,
            'shell_ref':entity.shell_ref if transform.scope=='CORE_ONLY' else transform.shell_after_ref or entity.shell_ref,'position':entity.position if transform.scope=='CORE_ONLY' else transform.position_after or entity.position})
        return family_result(request,values={'oriented_entity':changed,'outer_geometry_preserved':transform.scope=='CORE_ONLY','controlled_entity_ref':entity.entity_ref if model.preserve_selection_after_rotation else None,'external_command_count':0},examined_count=work)
    command=next((i for i in request.state.inputs if i.input_ref==request.input_ref),None)
    if command is None:return family_result(request,prerequisite_refs=('current_hit_input',),domain_complete=False)
    after,events,debt,applied=_step(request,request.state,model,command)
    return family_result(request,values={'after_state':after,'lineage_transaction_events':events,'actual_cost':command.cost if applied else 0,'external_command_count':int(applied),'event_owner_ref':request.scope.event_owner_ref},prerequisite_refs=debt,examined_count=work,domain_complete=not debt)
