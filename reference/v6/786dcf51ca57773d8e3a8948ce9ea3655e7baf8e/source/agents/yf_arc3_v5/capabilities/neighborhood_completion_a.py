"""K78 pure completions and typed Source bridge to the existing K09 route workflow."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref
from .contracts import FrameGrid
from .scene_layer_measurement_d import DSceneCalibration,DSceneLayerQuestion,DSceneOcclusion,measure_scene_layers_d
from .mechanical_family_contracts_d import (DMechanicalResult,DComputationInterrupted,DResumeMismatch,d_input_digest,d_map,d_result)


class NeighborhoodLayerBindingA(FrozenModel):
    layer_ref: Ref
    facet: Literal['COMPARISON','PHYSICAL_OCCUPANCY','SELECTION_OVERLAY','REFERENCE']
    site_ref: Ref|None=None
    evidence_ref: Ref


class NeighborhoodRecoveryPremiseA(FrozenModel):
    premise_ref: Ref
    domain: Literal['MASK','COLOR_LAW','ASSIGNMENT','ROUTING','CONTROL','COMPUTATION']
    state: Literal['SATISFIED','MISSING','CONTRADICTED']
    dependency_refs: tuple[Ref,...]=Field(default=(),max_length=128)
    supported_evidence_refs: tuple[Ref,...]=Field(default=(),max_length=128)
    missing_refs: tuple[Ref,...]=Field(default=(),max_length=128)
    affected_model_refs: tuple[Ref,...]=Field(default=(),max_length=32)
    retained_alternative_refs: tuple[Ref,...]=Field(default=(),max_length=128)
    question_ref: Ref|None=None
    probe_word_index: int|None=Field(default=None,ge=0,le=2)


def _work_resume(request,model,phase):
    if not request.resume_frontier:return {}
    if request.resume_frontier.get('input_digest')!=d_input_digest(request):raise DResumeMismatch('RESUME_INPUT_OR_REVISION_MISMATCH')
    if request.resume_frontier.get('unfinished_model_ref')!=model.model_ref:return {}
    work=request.resume_frontier.get('work_frontier',{})
    return work if work.get('phase')==phase else {}


def _checkpoint_error(error,budget,phase,**fields):
    return DComputationInterrupted(error.cause,d_map({'phase':phase,'accounted_evaluations':budget.examined,**fields}))


def measure_neighborhood_scene_a(model,request,budget):
    from .neighborhood_pattern_construction import NeighborhoodPrerequisite,_occupancy,_colors
    if request.state is None:raise NeighborhoodPrerequisite('CURRENT_PHYSICAL_OCCUPANCY_MISSING')
    if request.scene_frame is None or not request.scene_calibrations or not request.scene_questions:
        raise NeighborhoodPrerequisite('SCENE_LAYER_FRAME_CALIBRATION_AND_QUESTIONS_MISSING')
    refs=tuple(q.layer_ref for q in request.scene_questions)
    if len(set(refs))!=len(refs) or len({b.layer_ref for b in request.scene_bindings})!=len(request.scene_bindings):
        raise NeighborhoodPrerequisite('UNIQUE_DECLARED_SCENE_LAYER_IDENTITIES_REQUIRED')
    if set(refs)!=set(b.layer_ref for b in request.scene_bindings):raise NeighborhoodPrerequisite('EXACT_SOURCE_BOUND_SCENE_FACETS_REQUIRED')
    resume=_work_resume(request,model,'scene_layers');rows=list(resume.get('completed_layers',()))
    budget.examined=max(budget.examined,resume.get('accounted_evaluations',0))
    if tuple(row['layer_ref'] for row in rows)!=refs[:len(rows)]:raise DResumeMismatch('SCENE_LAYER_PREFIX_MISMATCH')
    for question in request.scene_questions[len(rows):]:
        try:
            result=measure_scene_layers_d(request.scene_frame,request.scene_calibrations,(question,),request.scene_occlusions,budget)
        except DComputationInterrupted as error:
            raise _checkpoint_error(error,budget,'scene_layers',completed_layers=tuple(rows)) from error
        rows.append(result[0])
    try:
        _,occupied,_=_occupancy(model,request.state,budget);colors=_colors(model,occupied,budget)
        facets=tuple(d_map({'layer_ref':b.layer_ref,'facet':b.facet,'site_ref':b.site_ref,'evidence_ref':b.evidence_ref}) for b in request.scene_bindings)
        sites=[]
        for site in model.sites:
            for _ in site.comparison_mask:budget.visit({'site_ref':site.site_ref})
            sites.append(d_map({'site_ref':site.site_ref,'comparison_mask':site.comparison_mask,'comparison_bounds':(site.origin,site.height,site.width),
                'crop_law_ref':site.crop_law_ref,'evidence_ref':site.evidence_ref,'motion_or_influence_boundary_inferred':False}))
    except DComputationInterrupted as error:
        raise _checkpoint_error(error,budget,'scene_layers',completed_layers=tuple(rows)) from error
    return {'measured_layers':tuple(rows),'source_bound_facets':facets,'full_physical_occupancy':tuple(sorted(occupied.items())),'full_physical_colors':colors,
        'comparison_sites':tuple(sites),'reference':model.reference,'reference_evidence_ref':model.reference_evidence_ref,
        'comparison_holes_remove_physical_bodies':False,'overlay_or_reference_interpreted_as_body':False}


def measure_neighborhood_transport_domain_a(model,request,budget):
    from .neighborhood_pattern_construction import NeighborhoodState,NeighborhoodPrerequisite,_external
    if request.state is None:raise NeighborhoodPrerequisite('CURRENT_PHYSICAL_OCCUPANCY_MISSING')
    if not request.words:raise NeighborhoodPrerequisite('SOURCE_BOUND_TRANSPORT_CANDIDATE_WORDS_MISSING')
    resume=_work_resume(request,model,'transport_domain');rows=list(resume.get('completed_schedules',()))
    budget.examined=max(budget.examined,resume.get('accounted_evaluations',0))
    for index in range(len(rows),len(request.words)):
        word=request.words[index];continuing=bool(resume) and index==resume.get('word_index')
        state=NeighborhoodState.model_validate(resume['current_state']) if continuing else request.state
        traces=list(resume.get('completed_events',())) if continuing else [];cost=resume.get('command_cost',0) if continuing else 0
        start=resume.get('next_primitive',0) if continuing else 0
        for part in range(start,len(word)):
            if state.terminated:break
            try:
                if part>=request.depth_bound or len(rows)>=request.domain_bound:
                    raise DComputationInterrupted('DEPTH_OR_DOMAIN_BOUND',d_map())
                result=_external(model,state,word[part],request,budget)
            except DComputationInterrupted as error:
                raise _checkpoint_error(error,budget,'transport_domain',word_index=index,next_primitive=part,current_state=state,
                    completed_schedules=tuple(rows),completed_events=tuple(traces),command_cost=cost) from error
            cost+=result['event_ledger']['debit'];state=result['state'];traces.append(d_map(result))
        paths={}
        for trace in traces:
            event=trace.get('direct_event',{})
            ref=event.get('moved_occurrence_ref')
            if ref is None:continue
            before=NeighborhoodState.model_validate(trace['before_state']);after=NeighborhoodState.model_validate(trace['state'])
            b=next(x.cell for x in before.occurrences if x.occurrence_ref==ref)
            a=next(x.cell for x in after.occurrences if x.occurrence_ref==ref)
            if ref not in paths:paths[ref]=[b]
            paths[ref].append(a)
        rows.append(d_map({'word_index':index,'after_state':state,'events':tuple(traces),'actual_command_cost':cost,
            'per_body_paths':tuple((ref,tuple(path)) for ref,path in sorted(paths.items())),'executed_primitive_count':len(traces),
            'early_completion_or_exhaustion':state.terminated and len(traces)<len(word),'minimum_cost_proven':False,
            'other_bodies_jointly_present':True,'pushing_overlap_or_wrap_invented':False}))
        resume={}
    return {'schedule_candidates':tuple(rows),'supplied_candidate_domain_complete':request.scope.input_domain_complete,
        'search_called_inside_successor':False}


def measure_neighborhood_recovery_a(model,request,budget):
    from .neighborhood_pattern_construction import NeighborhoodPrerequisite
    if 'recovery_premises' not in request.model_fields_set:raise NeighborhoodPrerequisite('SOURCE_BOUND_RECOVERY_DEPENDENCIES_MISSING')
    if len({p.premise_ref for p in request.recovery_premises})!=len(request.recovery_premises):raise NeighborhoodPrerequisite('UNIQUE_RECOVERY_PREMISE_IDENTITIES_REQUIRED')
    resume=_work_resume(request,model,'reasoning_recovery');rows=list(resume.get('completed_recovery_rows',()))
    budget.examined=max(budget.examined,resume.get('accounted_evaluations',0))
    if tuple(r['premise_ref'] for r in rows)!=tuple(p.premise_ref for p in request.recovery_premises[:len(rows)]):
        raise DResumeMismatch('RECOVERY_PREMISE_PREFIX_MISMATCH')
    for premise in request.recovery_premises[len(rows):]:
        try:
            for ref in (premise.premise_ref,*premise.dependency_refs,*premise.supported_evidence_refs,*premise.missing_refs,*premise.retained_alternative_refs):
                budget.visit({'premise_ref':premise.premise_ref,'reference':ref})
        except DComputationInterrupted as error:
            raise _checkpoint_error(error,budget,'reasoning_recovery',completed_recovery_rows=tuple(rows)) from error
        if premise.affected_model_refs and model.model_ref not in premise.affected_model_refs:
            rows.append(d_map({'premise_ref':premise.premise_ref,'applies_to_current_model':False,'preserved_evidence_refs':premise.supported_evidence_refs}));continue
        if premise.state=='SATISFIED' and premise.missing_refs:raise NeighborhoodPrerequisite('RECOVERY_PREMISE_STATUS_CONTRADICTS_MISSING_SUPPORT')
        probe_bound=(request.mode_ref=='PROBE' and premise.state!='SATISFIED' and premise.domain!='COMPUTATION'
            and premise.question_ref is not None and premise.probe_word_index is not None and premise.probe_word_index<len(request.words)
            and len(request.words[premise.probe_word_index])<=request.depth_bound)
        rows.append(d_map({'premise_ref':premise.premise_ref,'applies_to_current_model':True,'dependency_domain':premise.domain,
            'dependency_state':premise.state,'dependency_refs':premise.dependency_refs,'missing_refs':premise.missing_refs,
            'preserved_evidence_refs':premise.supported_evidence_refs,'retained_alternative_refs':premise.retained_alternative_refs,
            'bounded_question_ref':premise.question_ref,'probe_word_index':premise.probe_word_index if probe_bound else None,
            'probe_word':request.words[premise.probe_word_index] if probe_bound else (),
            'missing_computation_is_experiment':False,'unknown_usefulness_is_irrelevance':False,'pursuit_counter_incremented':False}))
    return {'dependency_recovery_candidates':tuple(rows),'unrelated_evidence_retained':True,'probe_release_authorized':False}
