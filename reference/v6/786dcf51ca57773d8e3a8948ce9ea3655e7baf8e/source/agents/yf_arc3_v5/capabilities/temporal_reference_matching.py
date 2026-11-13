"""Licensed whole-mask identity and acknowledged predecessor transactions.

Pending snapshots do not advance recall. Rewind restores the scene AND its
own predecessor context; no future generator or private coordinates are read.
"""
from typing import Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref, immutable_json_data
from .mechanical_family_contracts_a import MechanicalFamilyScope, MechanicalFamilyResult, family_result, missing_supplied_fields
from .identity_contact_authentication import ContactPixel, ContactLayerTemplate, ContactLayerSample, _candidate_layers as translated_layers


class RecallFigure(FrozenModel):
    occurrence_ref: Ref
    bounds: tuple[int,int,int,int]
    raw_pixels: tuple[ContactPixel, ...] = Field(max_length=65536)
    raw_complete: bool
    logical_identity_ref: Ref | None = None
    identity_evidence_ref: Ref | None = None
    input_ref: Ref
    action_ref: Ref
    payload: FrozenMap
    @model_validator(mode='after')
    def raw(self):
        x0,y0,x1,y1=self.bounds
        if x0>=x1 or y0>=y1 or (x1-x0)*(y1-y0)>65536:raise ValueError('bounded full figure raster including holes and HUD-crossing pixels')
        if len({p.point for p in self.raw_pixels})!=len(self.raw_pixels) or any(not (x0<=p.point[0]<x1 and y0<=p.point[1]<y1) for p in self.raw_pixels):raise ValueError('one raw token per whole-figure pixel')
        if self.raw_complete and len(self.raw_pixels)!=(x1-x0)*(y1-y0):raise ValueError('complete mask includes background/holes, not only foreground')
        if (self.logical_identity_ref is None)!=(self.identity_evidence_ref is None):raise ValueError('private identity is not inferred from an identical drawing')
        return self


class RecallScene(FrozenModel):
    scene_ref: Ref
    figures: tuple[RecallFigure, ...] = Field(max_length=128)
    phase: Literal['DECISION','FEEDBACK','UNKNOWN']
    tutorial_active: bool
    guided_occurrence_refs: tuple[Ref, ...] = Field(max_length=128)
    @model_validator(mode='after')
    def occurrences(self):
        refs={f.occurrence_ref for f in self.figures}
        if len(refs)!=len(self.figures) or not set(self.guided_occurrence_refs)<=refs:raise ValueError('distinct current occurrences and observed guidance')
        return self


class RecallAnchor(FrozenModel):
    scene: RecallScene
    acted_occurrence_ref: Ref
    @model_validator(mode='after')
    def chosen(self):
        if self.acted_occurrence_ref not in {f.occurrence_ref for f in self.scene.figures}:raise ValueError('chosen occurrence belongs to its own predecessor scene')
        return self


class RecallSnapshot(FrozenModel):
    snapshot_ref: Ref
    scene: RecallScene
    active_anchor: RecallAnchor | None
    seeded: bool
    progress: int = Field(ge=0,le=65536)
    history_anchors: tuple[RecallAnchor, ...] = Field(max_length=256)
    acted_occurrence_ref: Ref
    input_ref: Ref
    epoch: int = Field(ge=0)
    level_scope_ref: Ref


class RecallState(FrozenModel):
    scene: RecallScene | None = None
    active_anchor: RecallAnchor | None = None
    history_anchors: tuple[RecallAnchor, ...] = Field(max_length=256)
    seeded: bool
    rollback_stack: tuple[RecallSnapshot, ...] = Field(max_length=256)
    pending_snapshot: RecallSnapshot | None = None
    acknowledged_packet_refs: tuple[Ref, ...] = Field(max_length=4096)
    progress: int = Field(ge=0,le=65536)
    required_progress: int | None = Field(default=None,ge=0,le=65536)
    remaining_resource: int = Field(ge=0,le=10**9)
    level_scope_ref: Ref
    restore_epoch: int = Field(ge=0)
    status: Literal['ACTIVE','WIN','LOCAL_STOP','GAME_OVER']
    @model_validator(mode='after')
    def transactions(self):
        if len(set(self.acknowledged_packet_refs))!=len(self.acknowledged_packet_refs):raise ValueError('one context transaction per acknowledged choice')
        if len({s.snapshot_ref for s in self.rollback_stack})!=len(self.rollback_stack):raise ValueError('each rollback stage has its own predecessor snapshot')
        return self


class RecallInvariance(FrozenModel):
    invariance_ref: Ref
    quarter_turns: int = Field(ge=0,le=3)
    integer_scale: int = Field(ge=1,le=16)
    translation_invariant: bool
    recolor_pairs: tuple[tuple[Ref,Ref], ...] = Field(max_length=128)
    supported_evidence_ref: Ref
    event_owner_ref: Ref
    current_epoch: int = Field(ge=0)
    @model_validator(mode='after')
    def colors(self):
        if len({a for a,_ in self.recolor_pairs})!=len(self.recolor_pairs) or len({b for _,b in self.recolor_pairs})!=len(self.recolor_pairs):raise ValueError('licensed bijective recoloring never erases color distinctions')
        return self


class RecallModel(FrozenModel):
    model_ref: Ref
    source_relation: Literal['IMMEDIATE_PREDECESSOR','PREVIOUS_CHOICE','NONCHOSEN','OLDER_HISTORY']
    history_depth: int = Field(ge=1,le=256)
    exclude_previous_choice: bool
    singleton_seeding_exception: bool
    identity_rule: Literal['DRAWING_EQUIVALENCE','LICENSED_LOGICAL_IDENTITY']
    invariance_refs: tuple[Ref, ...] = Field(max_length=128)
    click_cost: int = Field(ge=0,le=65536)
    advance_amount: int = Field(ge=1,le=65536)
    rejection: Literal['REWIND','NO_EFFECT','LEVEL_RESTORE','UNKNOWN']
    admissible_rewind_depths: tuple[int, ...] = Field(max_length=256)
    reset_cost: int = Field(ge=0,le=65536)
    @model_validator(mode='after')
    def rewind(self):
        if any(d<1 or d>256 for d in self.admissible_rewind_depths):raise ValueError('finite known stage rewind depths')
        return self


class RecallAcknowledgement(FrozenModel):
    packet_ref: Ref
    event_owner_ref: Ref
    epoch: int = Field(ge=0)
    input_ref: Ref
    effect: Literal['ADVANCE','REWIND','NO_EFFECT','LEVEL_RESTORE','WIN','UNKNOWN']
    after_scene: RecallScene | None = None
    rewind_snapshot_ref: Ref | None = None
    observed_progress: int = Field(ge=0,le=65536)
    observed_resource: int = Field(ge=0,le=10**9)
    level_scope_ref: Ref
    restore_epoch: int = Field(ge=0)
    sealed: bool
    evidence_ref: Ref


class RecallFitObservation(FrozenModel):
    observation_ref: Ref
    before: RecallState
    acted_occurrence_ref: Ref
    accepted: bool | None = None
    guided_occurrence_refs: tuple[Ref, ...] = Field(max_length=128)
    event_owner_ref: Ref
    epoch: int = Field(ge=0)
    sealed: bool


class RecallLayerTemplate(ContactLayerTemplate):
    component: Literal['WHOLE_FIGURE','GUIDANCE','SUPPORT_RING','PROGRESS','BUDGET','FEEDBACK','UNKNOWN']
    occurrence_candidate_ref: Ref | None = None


class RecallRequest(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.temporal_recall_request.v1'
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None = None
    maximum_evaluations: int = Field(ge=1,le=65536)
    maximum_pixels: int = Field(ge=1,le=65536)
    state: RecallState | None = None
    models: tuple[RecallModel, ...] = Field(default=(),max_length=128)
    bound_model_ref: Ref | None = None
    invariances: tuple[RecallInvariance, ...] = Field(default=(),max_length=128)
    source_figures: tuple[RecallFigure, ...] = Field(default=(),max_length=128)
    target_figures: tuple[RecallFigure, ...] = Field(default=(),max_length=128)
    acted_occurrence_ref: Ref | None = None
    input_ref: Ref | None = None
    pending_snapshot: RecallSnapshot | None = None
    acknowledgement: RecallAcknowledgement | None = None
    fit_observations: tuple[RecallFitObservation, ...] = Field(default=(),max_length=256)
    rollback_snapshot_ref: Ref | None = None
    observed_resource: int | None = Field(default=None,ge=0,le=10**9)
    restored_entry_state: RecallState | None = None
    raw_layer_pixels: tuple[ContactPixel, ...] = Field(default=(),max_length=65536)
    layer_templates: tuple[RecallLayerTemplate, ...] = Field(default=(),max_length=4096)
    layer_samples: tuple[ContactLayerSample, ...] = Field(default=(),max_length=4096)
    @model_validator(mode='after')
    def identities(self):
        for rows,name in ((self.models,'model_ref'),(self.invariances,'invariance_ref'),(self.layer_templates,'template_ref')):
            if len({getattr(r,name) for r in rows})!=len(rows):raise ValueError('distinct current recall/identity model alternatives')
        return self


OPERATION_MODES={'decision_scene_layers':'MEASURE','recall_relation_fit':'FIT','licensed_identity':'COMPARE','predecessor_snapshot':'SNAPSHOT','recurrence_candidates':'PROPAGATE',
    'recall_transaction':'STEP_ABSTRACT','rollback_context':'RESTORE','ambiguity_discrimination':'DOMAIN','recall_resource':'PRECONDITION','recall_compare':'COMPARE'}


def _transform(figure,invariance,maximum):
    size=len(figure.raw_pixels)*invariance.integer_scale**2
    if size>maximum:return None,0,('transformed_whole_mask_bound',)
    if not figure.raw_complete:return None,0,('complete_raw_figure_mask',)
    x0,y0,x1,y1=figure.bounds;width=x1-x0;height=y1-y0;mapping=dict(invariance.recolor_pairs);pixels=[]
    palette={p.token_ref for p in figure.raw_pixels}
    if len({mapping.get(c,c) for c in palette})!=len(palette):return None,0,('licensed_recoloring_preserves_current_palette_distinctions',)
    # Complete pixels include holes/background and are never clipped at a HUD band.
    for pixel in figure.raw_pixels:
        x,y=pixel.point[0]-x0,pixel.point[1]-y0;w,h=width,height
        for _ in range(invariance.quarter_turns):x,y=h-1-y,x;w,h=h,w
        token=mapping.get(pixel.token_ref,pixel.token_ref);s=invariance.integer_scale
        for dx in range(s):
            for dy in range(s):
                point=(x*s+dx,y*s+dy)
                if not invariance.translation_invariant:point=(point[0]+x0,point[1]+y0)
                pixels.append((point,token))
    return tuple(sorted(pixels)),size,()


def _identity(request,source,target,allowed,remaining,logical=False):
    if logical:
        if remaining<1:return None,0,('identity_evaluation_bound',),()
        if source.logical_identity_ref is None or target.logical_identity_ref is None:return None,0,('independently_licensed_logical_identity',),()
        evidence=(source.identity_evidence_ref,target.identity_evidence_ref)
        if any(ref is None or ref not in request.scope.assumption_refs for ref in evidence):
            return None,1,('current_independent_source_and_target_identity_evidence',),()
        return source.logical_identity_ref==target.logical_identity_ref,1,(),evidence
    if not target.raw_complete:return None,0,('complete_raw_target_mask',),()
    matches=[];count=0;unknown=[]
    for invariance in request.invariances:
        if invariance.invariance_ref not in allowed:continue
        if (invariance.event_owner_ref!=request.scope.event_owner_ref or invariance.current_epoch!=request.scope.epoch
                or invariance.supported_evidence_ref not in request.scope.assumption_refs):unknown.append('current_licensed_invariance');continue
        cost=len(source.raw_pixels)*invariance.integer_scale**2+len(target.raw_pixels)
        if count+cost>remaining:return None,count,('identity_evaluation_bound',),tuple(matches)
        predicted,work,debt=_transform(source,invariance,request.maximum_pixels);count+=work+len(target.raw_pixels)
        if debt:unknown.extend(debt);continue
        tx0,ty0,_,_=target.bounds
        actual=tuple(sorted(((p.point[0]-tx0,p.point[1]-ty0) if invariance.translation_invariant else p.point,p.token_ref) for p in target.raw_pixels))
        if predicted==actual:matches.append(invariance.invariance_ref)
    if matches:return True,count,(),tuple(matches)
    if unknown or not any(i.invariance_ref in allowed for i in request.invariances):return None,count,tuple(dict.fromkeys(unknown or ['supported_identity_invariance'])),()
    return False,count,(),()


def _candidates(request,state,model,remaining):
    if remaining<1:return (),(),0,('identity_evaluation_bound',)
    if state.scene is None or state.scene.phase!='DECISION':return (),(),0,('current_decision_population',)
    if not state.seeded and model.singleton_seeding_exception and len(state.scene.figures)==1:return (state.scene.figures[0].occurrence_ref,),(),1,()
    anchor=state.active_anchor
    if model.source_relation=='OLDER_HISTORY':anchor=state.history_anchors[-model.history_depth] if len(state.history_anchors)>=model.history_depth else None
    if anchor is None:return (),(),0,('active_supported_predecessor_context',)
    sources=anchor.scene.figures
    if model.source_relation=='PREVIOUS_CHOICE':sources=tuple(f for f in sources if f.occurrence_ref==anchor.acted_occurrence_ref)
    if model.source_relation=='NONCHOSEN' or model.exclude_previous_choice and state.seeded:sources=tuple(f for f in sources if f.occurrence_ref!=anchor.acted_occurrence_ref)
    candidates=[];correspondences=[];count=0;unknown=[]
    for target in state.scene.figures:
        accepted=False
        for source in sources:
            equal,work,debt,licenses=_identity(request,source,target,model.invariance_refs,remaining-count,model.identity_rule=='LICENSED_LOGICAL_IDENTITY');count+=work
            correspondences.append({'source_occurrence_ref':source.occurrence_ref,'target_occurrence_ref':target.occurrence_ref,'equal':equal,'license_refs':licenses})
            if debt:unknown.extend(debt)
            if equal is True:accepted=True
            if 'identity_evaluation_bound' in debt:return tuple(candidates),tuple(correspondences),count,tuple(dict.fromkeys(unknown))
        if accepted:candidates.append(target.occurrence_ref)
    return tuple(candidates),tuple(correspondences),count,tuple(dict.fromkeys(unknown))


def _recurrence(request):
    rows=[];count=0;debts=[];cuts=[]
    for index,model in enumerate(request.models):
        candidates,edges,work,debt=_candidates(request,request.state,model,request.maximum_evaluations-count);count+=work
        rows.append({'model_ref':model.model_ref,'candidate_occurrence_refs':candidates,'identity_correspondences':edges,'missing_refs':debt})
        debts.extend(debt)
        if 'identity_evaluation_bound' in debt:cuts.append({'phase':'recurrence_identity','next_model_index':index});break
    sets=tuple(set(r['candidate_occurrence_refs']) for r in rows);common=set.intersection(*sets) if sets else set();union=set.union(*sets) if sets else set()
    return family_result(request,values={'model_candidates':rows,'common_candidate_occurrence_refs':tuple(sorted(common)),'possible_candidate_occurrence_refs':tuple(sorted(union)),
        'common_choice_unique':len(common)==1,'multiple_common_occurrences_retained':len(common)>1,
        'common_set_coverage_proved':len(rows)==len(request.models) and not debts and request.scope.input_domain_complete,'private_identity_from_identical_drawings':False},prerequisite_refs=tuple(d for d in dict.fromkeys(debts) if d!='identity_evaluation_bound'),
        examined_count=count,domain_complete=not debts and bool(rows),computation_bound_reached=bool(cuts),frontier={'cuts':cuts} if cuts else {})


def _relation_fit(request):
    retained=[];refuted=[];unknown=[];count=0;cut={}
    for index,model in enumerate(request.models):
        supports=[];bad=[];missing=[]
        for observation in request.fit_observations:
            if not observation.sealed or observation.event_owner_ref!=request.scope.event_owner_ref or observation.epoch!=request.scope.epoch:missing.append(observation.observation_ref);continue
            candidates,_,work,debt=_candidates(request,observation.before,model,request.maximum_evaluations-count);count+=work
            if 'identity_evaluation_bound' in debt:cut={'phase':'recall_relation_fit','next_model_index':index,'observation_ref':observation.observation_ref};break
            if debt:missing.append((observation.observation_ref,debt));continue
            guided=observation.guided_occurrence_refs
            if not guided and observation.before.scene is not None and observation.before.scene.tutorial_active:
                guided=observation.before.scene.guided_occurrence_refs
            if observation.accepted is not None and (observation.acted_occurrence_ref in candidates)!=observation.accepted:bad.append(observation.observation_ref)
            elif guided and not set(guided)<=set(candidates):bad.append(observation.observation_ref)
            elif observation.accepted is not None or guided:supports.append(observation.observation_ref)
            else:missing.append((observation.observation_ref,'accepted_or_guided_choice_evidence'))
        if cut:break
        if bad:refuted.append((model.model_ref,tuple(bad)))
        elif supports:retained.append({'model':model,'supported_observation_refs':supports,'unresolved_observations':missing})
        else:unknown.append((model.model_ref,tuple(missing) or ('current_recall_choice_evidence',)))
    return family_result(request,values={'compatible_recall_models':retained,'refuted_recall_models':refuted,'unknown_recall_models':unknown,'seeding_exception_preserved':True},examined_count=count,
        domain_complete=not cut and not unknown,computation_bound_reached=bool(cut),frontier=cut)


def _snapshot(request):
    state=request.state;scene=state.scene
    if scene is None or scene.phase!='DECISION':return family_result(request,prerequisite_refs=('current_decision_scene',),domain_complete=False)
    figure=next((f for f in scene.figures if f.occurrence_ref==request.acted_occurrence_ref),None)
    if figure is None or figure.input_ref!=request.input_ref:return family_result(request,prerequisite_refs=('grounded_chosen_occurrence_and_input',),domain_complete=False)
    if state.pending_snapshot is not None:return family_result(request,prerequisite_refs=('acknowledge_existing_pending_choice_once',),domain_complete=False)
    from .articulated_dependency_measurement_c import _nodes
    work=_nodes(immutable_json_data((scene,state.active_anchor,state.history_anchors)),request.maximum_evaluations)
    if work is None:return family_result(request,computation_bound_reached=True,domain_complete=False,frontier={'phase':'complete_predecessor_snapshot_population'})
    pending=RecallSnapshot(snapshot_ref=request.scope.request_ref+'.pending.'+str(len(state.acknowledged_packet_refs)),scene=scene,active_anchor=state.active_anchor,seeded=state.seeded,progress=state.progress,history_anchors=state.history_anchors,
        acted_occurrence_ref=figure.occurrence_ref,input_ref=figure.input_ref,epoch=request.scope.epoch,level_scope_ref=state.level_scope_ref)
    return family_result(request,values={'pending_snapshot':pending,'current_state_with_pending':state.model_copy(update={'pending_snapshot':pending}),'active_recall_context_advanced':False,'external_command_count':0},examined_count=work)


def _abstract(request,model):
    state=request.state;pending=request.pending_snapshot or state.pending_snapshot
    if pending is None or pending.epoch!=request.scope.epoch or pending.level_scope_ref!=state.level_scope_ref or pending.input_ref!=request.input_ref:return family_result(request,prerequisite_refs=('current_action_bound_pending_snapshot',),domain_complete=False)
    candidates,edges,count,debt=_candidates(request,state,model,request.maximum_evaluations);accept=pending.acted_occurrence_ref in candidates
    if model.click_cost>state.remaining_resource:return family_result(request,prerequisite_refs=('financed_recall_choice',),domain_complete=False)
    return family_result(request,values={'acceptance_predicted':accept if not debt else None,'rejection_lifecycle':model.rejection if not accept else None,
        'progress_if_accepted':state.progress+model.advance_amount,'resource_after_click':state.remaining_resource-model.click_cost,'identity_correspondences':edges,'next_population':None,
        'next_population_requires_observation':True,'active_context_committed':False,'external_command_count':0},prerequisite_refs=debt,examined_count=count,domain_complete=not debt)


def _restore(request):
    state=request.state;snapshot=next((s for s in state.rollback_stack if s.snapshot_ref==request.rollback_snapshot_ref),None)
    ack=request.acknowledgement
    if ack is not None and ack.packet_ref in state.acknowledged_packet_refs:return family_result(request,values={'restored_state':state,'duplicate_rendering_or_ack_ignored':True,'new_predecessor_steps':0})
    if snapshot is None or ack is None or not ack.sealed or ack.effect!='REWIND' or ack.rewind_snapshot_ref!=snapshot.snapshot_ref or ack.event_owner_ref!=request.scope.event_owner_ref or ack.epoch!=request.scope.epoch:return family_result(request,prerequisite_refs=('evidenced_exact_stage_rewind_snapshot',),domain_complete=False)
    if ack.observed_progress!=snapshot.progress or ack.level_scope_ref!=snapshot.level_scope_ref:return family_result(request,prerequisite_refs=('rewind_progress_and_scope_correspondence',),domain_complete=False)
    index=state.rollback_stack.index(snapshot);restored=state.model_copy(update={'scene':ack.after_scene or snapshot.scene,'active_anchor':snapshot.active_anchor,'seeded':snapshot.seeded,
        'history_anchors':snapshot.history_anchors,'progress':snapshot.progress,'remaining_resource':ack.observed_resource,'rollback_stack':state.rollback_stack[:index],'pending_snapshot':None,
        'acknowledged_packet_refs':state.acknowledged_packet_refs+(ack.packet_ref,),'restore_epoch':ack.restore_epoch})
    return family_result(request,values={'restored_state':restored,'restored_question_predecessor':snapshot.active_anchor,'same_future_random_continuation_proved':False,'rewind_is_level_reset':False},examined_count=len(state.rollback_stack))


def _compare(request):
    state=request.state;ack=request.acknowledgement;pending=state.pending_snapshot or request.pending_snapshot
    if ack.packet_ref in state.acknowledged_packet_refs:return family_result(request,values={'after_state':state,'duplicate_rendering_or_ack_ignored':True,'new_predecessor_steps':0})
    if not ack.sealed or ack.event_owner_ref!=request.scope.event_owner_ref or ack.epoch!=request.scope.epoch or pending is None or ack.input_ref!=pending.input_ref or pending.epoch!=request.scope.epoch:return family_result(request,prerequisite_refs=('current_once_acknowledged_choice_packet',),domain_complete=False)
    boundary=ack.level_scope_ref!=state.level_scope_ref or ack.restore_epoch!=state.restore_epoch
    if ack.effect not in ('WIN','LEVEL_RESTORE','REWIND') and boundary:return family_result(request,prerequisite_refs=('actual_level_restore_or_boundary_classification',),domain_complete=False)
    if ack.effect=='ADVANCE' and ack.observed_progress<=pending.progress:return family_result(request,prerequisite_refs=('observed_actual_progress_advance',),domain_complete=False)
    if ack.effect=='NO_EFFECT' and ack.observed_progress!=state.progress:return family_result(request,prerequisite_refs=('no_effect_progress_consistency',),domain_complete=False)
    if ack.effect=='REWIND':
        if ack.rewind_snapshot_ref is None:return family_result(request,prerequisite_refs=('actual_rewind_target_context',),domain_complete=False)
        return _restore(request.model_copy(update={'rollback_snapshot_ref':ack.rewind_snapshot_ref}))
    if ack.effect=='LEVEL_RESTORE':
        entry=request.restored_entry_state
        if entry is None or entry.level_scope_ref!=ack.level_scope_ref or entry.progress!=ack.observed_progress:return family_result(request,prerequisite_refs=('observed_whole_level_entry_state',),domain_complete=False)
        after=entry.model_copy(update={'remaining_resource':ack.observed_resource,'restore_epoch':ack.restore_epoch,'pending_snapshot':None,'acknowledged_packet_refs':state.acknowledged_packet_refs+(ack.packet_ref,)})
    elif ack.effect in ('ADVANCE','WIN'):
        anchor=RecallAnchor(scene=pending.scene,acted_occurrence_ref=pending.acted_occurrence_ref)
        if len(state.rollback_stack)>=256 or len(state.history_anchors)>=256:return family_result(request,computation_bound_reached=True,domain_complete=False,frontier={'phase':'recall_history_capacity','pending_packet_ref':ack.packet_ref})
        after=state.model_copy(update={'scene':ack.after_scene if not boundary and ack.after_scene is not None and ack.after_scene.phase=='DECISION' else None,'active_anchor':anchor,'seeded':True,
            'history_anchors':state.history_anchors+(anchor,),'rollback_stack':state.rollback_stack+(pending,),'pending_snapshot':None,'progress':ack.observed_progress,'remaining_resource':ack.observed_resource,
            'acknowledged_packet_refs':state.acknowledged_packet_refs+(ack.packet_ref,),'level_scope_ref':ack.level_scope_ref,'restore_epoch':ack.restore_epoch,'status':'WIN' if ack.effect=='WIN' else 'ACTIVE'})
    elif ack.effect=='NO_EFFECT':after=state.model_copy(update={'scene':ack.after_scene or state.scene,'remaining_resource':ack.observed_resource,'pending_snapshot':None,'acknowledged_packet_refs':state.acknowledged_packet_refs+(ack.packet_ref,)})
    else:return family_result(request,prerequisite_refs=('advance_rewind_noeffect_or_level_restore_evidence',),domain_complete=False)
    return family_result(request,values={'after_state':after,'classified_effect':ack.effect,'level_boundary_requires_requalification':boundary,'new_predecessor_steps':int(ack.effect in ('ADVANCE','WIN')),'successor_population_known':after.scene is not None,
        'decision_scene_not_feedback_required':True,'official_completion_evidence_ref':ack.evidence_ref if ack.effect=='WIN' else None},examined_count=1)


def _resource(request):
    state=request.state
    if state.required_progress is None:return family_result(request,prerequisite_refs=('independent_required_progress_count',),domain_complete=False)
    rows=[];count=0;cuts=[]
    for index,model in enumerate(request.models):
        required=max(0,state.required_progress-state.progress);advance_clicks=(required+model.advance_amount-1)//model.advance_amount
        baseline=advance_clicks*model.click_cost;options=[]
        for depth in model.admissible_rewind_depths:
            if count>=request.maximum_evaluations:cuts.append({'phase':'recall_resource','model_ref':model.model_ref,'next_rewind_depth':depth});break
            count+=1
            if depth>len(state.rollback_stack):continue
            snapshot=state.rollback_stack[-depth];additional=max(0,state.progress-snapshot.progress);clicks=(max(0,state.required_progress-snapshot.progress)+model.advance_amount-1)//model.advance_amount
            total=model.click_cost+clicks*model.click_cost
            options.append({'rewind_depth':depth,'restored_progress':snapshot.progress,'additional_progress_debt':additional,'wrong_click_plus_replacement_cost':total,'funded':total<=state.remaining_resource})
        rows.append({'model_ref':model.model_ref,'required_advances':advance_clicks,'baseline_cost':baseline,'resource_surplus':state.remaining_resource-baseline,'admissible_recovery_options':options,
            'whole_reset_cost':model.reset_cost+((state.required_progress+model.advance_amount-1)//model.advance_amount)*model.click_cost})
        if cuts:break
    return family_result(request,values={'recovery_allowance_by_model':rows,'exploratory_wrong_choice_is_free':False},examined_count=count,domain_complete=not cuts,computation_bound_reached=bool(cuts),frontier={'cuts':cuts} if cuts else {})


def _ambiguity(request):
    result=_recurrence(request);rows=result.values.get('model_candidates',());state=request.state;tests=[]
    models={m.model_ref:m for m in request.models};count=result.examined_count;cut={}
    for index,figure in enumerate(state.scene.figures if state.scene is not None else ()):
        work=len(rows)+sum(len(m.admissible_rewind_depths) for m in request.models)
        if count+work>request.maximum_evaluations:cut={'phase':'ambiguity_probe_costs','next_occurrence_index':index};break
        count+=work;outcomes=[];costs=[];recovery_known=state.required_progress is not None
        for row in rows:
            model=models[row['model_ref']];predicted=None if row['missing_refs'] else figure.occurrence_ref in row['candidate_occurrence_refs'];outcomes.append((model.model_ref,predicted))
            if state.required_progress is None:continue
            if model.rejection=='NO_EFFECT':costs.append(model.click_cost*(1+(max(0,state.required_progress-state.progress)+model.advance_amount-1)//model.advance_amount))
            elif model.rejection=='REWIND':
                if not model.admissible_rewind_depths or any(d>len(state.rollback_stack) for d in model.admissible_rewind_depths):recovery_known=False;continue
                costs.extend(model.click_cost*(1+(max(0,state.required_progress-state.rollback_stack[-d].progress)+model.advance_amount-1)//model.advance_amount) for d in model.admissible_rewind_depths)
            elif model.rejection=='LEVEL_RESTORE' and request.restored_entry_state is not None:
                entry=request.restored_entry_state;costs.append(model.click_cost+model.reset_cost+((max(0,state.required_progress-entry.progress)+model.advance_amount-1)//model.advance_amount)*model.click_cost)
            else:recovery_known=False
        distinguishing=len(rows)==len(request.models) and all(p is not None for _,p in outcomes) and len({p for _,p in outcomes})>1
        worst=max(costs) if costs and recovery_known else None
        tests.append({'occurrence_ref':figure.occurrence_ref,'input_ref':figure.input_ref,'action_ref':figure.action_ref,'payload':figure.payload,'predicted_acceptance_by_model':outcomes,
            'discriminates_supported_relations':distinguishing,'worst_declared_recovery_cost':worst,'bounded_risk_funded':worst is not None and worst<=state.remaining_resource and request.scope.input_domain_complete,
            'restored_scene_determines_future_generator':False})
    return result.model_copy(update={'values':immutable_json_data({**dict(result.values),'discriminating_or_bounded_risk_options':tests,
        'common_choice_available':len(result.values.get('common_candidate_occurrence_refs',()))==1,
        'unresolved_private_identity_alias_debt':len(result.values.get('common_candidate_occurrence_refs',()))>1
            or any(any(p is None for _,p in t['predicted_acceptance_by_model']) for t in tests),
        'nearest_or_first_occurrence_is_proof':False,'action_release':False}),
        'examined_count':count,'domain_complete':result.domain_complete and not cut,'computation_bound_reached':result.computation_bound_reached or bool(cut),
        'frontier':immutable_json_data({'recurrence':result.frontier,'ambiguity':cut}) if cut else result.frontier})


def measure_temporal_reference_matching(request: RecallRequest) -> MechanicalFamilyResult:
    if request.mode is None or OPERATION_MODES.get(request.operation_ref)!=request.mode:return family_result(request,signature_supported=False,domain_complete=False)
    op=request.operation_ref;required={'decision_scene_layers':('raw_layer_pixels','layer_templates'),'recall_relation_fit':('models','fit_observations'),'licensed_identity':('source_figures','target_figures','invariances'),
        'predecessor_snapshot':('state','acted_occurrence_ref','input_ref'),'recurrence_candidates':('state','models'),'recall_transaction':('state','models','bound_model_ref','input_ref'),
        'rollback_context':('state','rollback_snapshot_ref','acknowledgement'),'ambiguity_discrimination':('state','models'),'recall_resource':('state','models'),'recall_compare':('state','acknowledgement')}
    missing=missing_supplied_fields(request,required[op])
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    if op=='decision_scene_layers':
        result=translated_layers(request);values=dict(result.values);templates={t.template_ref:t for t in request.layer_templates};rows=values.get('measured_layer_alternatives',())+values.get('possible_layer_alternatives',())
        return result.model_copy(update={'values':immutable_json_data({**values,'decision_feedback_layer_candidates':tuple({'measurement':r,'component':templates[r['template_ref']].component,'occurrence_candidate_ref':templates[r['template_ref']].occurrence_candidate_ref} for r in rows),'HUD_band_clipped_from_glyph':False,'guidance_is_figure_identity':False})})
    if op=='licensed_identity':
        rows=[];count=0;debts=[];cut={};allowed=tuple(i.invariance_ref for i in request.invariances)
        for source in request.source_figures:
            for target in request.target_figures:
                equal,work,debt,licenses=_identity(request,source,target,allowed,request.maximum_evaluations-count);count+=work;debts.extend(debt)
                rows.append({'source_ref':source.occurrence_ref,'target_ref':target.occurrence_ref,'identity_match':equal,'licensed_invariance_refs':licenses,'raw_source_retained':source,'raw_target_retained':target})
                if 'identity_evaluation_bound' in debt:cut={'phase':'licensed_identity','source_ref':source.occurrence_ref,'target_ref':target.occurrence_ref};break
            if cut:break
        return family_result(request,values={'identity_correspondences':rows,'reflection_added':False,'holes_erased':False},prerequisite_refs=tuple(d for d in dict.fromkeys(debts) if d!='identity_evaluation_bound'),examined_count=count,
            domain_complete=not debts,computation_bound_reached=bool(cut),frontier=cut)
    if op=='recall_relation_fit':return _relation_fit(request)
    if op=='predecessor_snapshot':return _snapshot(request)
    if op=='rollback_context':return _restore(request)
    if op=='recall_compare':return _compare(request)
    if op=='recall_resource':return _resource(request)
    if op in ('recurrence_candidates','ambiguity_discrimination'):
        return _recurrence(request) if op=='recurrence_candidates' else _ambiguity(request)
    model=next((m for m in request.models if m.model_ref==request.bound_model_ref),None)
    if model is None:return family_result(request,prerequisite_refs=('bound_current_recall_relation_model',),domain_complete=False)
    return _abstract(request,model)
