"""Exact finite code/feedback calculations; the caller owns trial selection and ACT.

Exact occurrences are reserved before misplaced occurrences. History remains
trial-local and all declared law alternatives retain their identity.
"""
from __future__ import annotations

from collections import Counter, deque
from typing import Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref
from .identity_contact_authentication import ContactPixel, ContactLayerTemplate, ContactLayerSample, _candidate_layers as measure_translated_layers
from .mechanical_family_contracts_a import (
    MechanicalFamilyScope, MechanicalFamilyResult, family_result,
    missing_supplied_fields,
)

Code=tuple[Ref,...]


class FeedbackAccountingLaw(FrozenModel):
    law_ref: Ref
    exact_ref: Ref
    elsewhere_ref: Ref
    absent_ref: Ref
    allocation_order: Literal["LEFT_TO_RIGHT","RIGHT_TO_LEFT"]
    @model_validator(mode="after")
    def distinct_marks(self):
        if len({self.exact_ref,self.elsewhere_ref,self.absent_ref})!=3:
            raise ValueError("feedback classes must remain distinct")
        return self


class CodeFeedbackRow(FrozenModel):
    evidence_ref: Ref
    model_epoch: int = Field(ge=0)
    trial: tuple[Ref | None,...] = Field(max_length=12)
    feedback: tuple[Ref | None,...] = Field(max_length=12)
    evidence_status: Literal["OBSERVED", "PREDICTED"] = "OBSERVED"
    @model_validator(mode="after")
    def whole_vector(self):
        if len(self.trial)!=len(self.feedback):
            raise ValueError("feedback must retain every submitted rank")
        if any((value is None)!=(mark is None) for value,mark in zip(self.trial,self.feedback)):
            raise ValueError("empty proposal ranks must retain empty feedback ranks")
        return self


class CodeTrial(FrozenModel):
    trial_ref: Ref
    values: Code = Field(max_length=12)


class CodeEntryProtocol(FrozenModel):
    protocol_ref: Ref
    clear_suffix: bool
    allow_partial_submit: bool
    partial_consumes_attempt: bool
    clear_after_submit: bool
    relayout_after_add: bool
    relayout_after_clear: bool
    palette_mode: Literal["REUSE_ALL", "REMOVE_USED"] | None = None
    record_partial_submission: bool | None = None


class CodeInterfaceState(FrozenModel):
    proposal: tuple[Ref | None,...] = Field(max_length=12)
    revealed: tuple[Ref | None,...] = Field(max_length=12)
    attempts_remaining: int = Field(ge=0)
    history: tuple[CodeFeedbackRow,...] = Field(max_length=256)
    recovery_epoch: int = Field(ge=0)
    @model_validator(mode="after")
    def bound_rows(self):
        if len(self.proposal)!=len(self.revealed):
            raise ValueError("proposal and revealed rows must have the same rank domain")
        if len({x.evidence_ref for x in self.history})!=len(self.history):
            raise ValueError("history evidence identities must be unique")
        return self


class CodeInputBinding(FrozenModel):
    kind: Literal["ADD","CLEAR","SUBMIT"]
    action_ref: Ref
    payload: FrozenMap
    value_ref: Ref | None = None
    rank: int | None = Field(default=None,ge=0,le=11)
    cost: int = Field(ge=0)


class CodeEntryObservation(FrozenModel):
    evidence_ref: Ref
    before: CodeInterfaceState
    after: CodeInterfaceState
    input: CodeInputBinding
    palette_after: tuple[Ref,...] | None = Field(default=None,max_length=32)


class CodeCompilationFrontier(FrozenModel):
    caller_ref: Ref
    parent_contribution_ref: Ref
    epoch: int = Field(ge=0)
    model_revision_ref: Ref
    trial_ref: Ref
    protocol_ref: Ref
    construction_mode: Literal["REBUILD", "PRESERVE_COMPATIBLE"]
    next_phase: Literal["CLEAR", "FILL", "SUBMIT"]
    expected_proposal: tuple[Ref | None,...] = Field(max_length=12)


class CodeLayerTemplate(ContactLayerTemplate):
    component: Literal["PALETTE","PROPOSAL","REVEALED","SUBMIT","FEEDBACK"]
    rank: int | None = Field(default=None,ge=0,le=11)
    row_ref: Ref | None = None
    decoded_value_ref: Ref | None = None
    feedback_mark_ref: Ref | None = None
    @model_validator(mode="after")
    def ownership(self):
        if self.component in ("PROPOSAL","REVEALED","FEEDBACK") and self.rank is None:raise ValueError("ranked glyph has an exact slot owner")
        if self.component=="FEEDBACK" and self.row_ref is None:raise ValueError("feedback contour belongs to one history row")
        return self


from .code_history_contracts_d import CodeHistorySupportD,CodeExactConstraintD
from .code_history_d import bind_code_history_and_exacts_d,code_trial_preservation_d


class FeedbackCodeRequest(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.feedback_code_request.v1"
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None = None
    alphabet: tuple[Ref,...] = Field(default=(),max_length=32)
    secret_length: int | None = Field(default=None,ge=1,le=12)
    duplicates_allowed: bool | None = None
    candidates: tuple[Code,...] = Field(default=(),max_length=4096)
    candidate_domain_complete: bool | None = None
    candidate_source: Literal["PROVIDED","ENUMERATE"] | None = None
    candidate_offset: int = Field(default=0,ge=0)
    active_model_epoch: int | None = Field(default=None,ge=0)
    rank_domains: tuple[tuple[Ref,...],...] = Field(default=(),max_length=12)
    multiplicity_bounds: tuple[tuple[Ref,int,int],...] = Field(default=(),max_length=32)
    laws: tuple[FeedbackAccountingLaw,...] = Field(default=(),max_length=16)
    law_ref: Ref | None = None
    state: CodeInterfaceState | None = None
    prior_history: tuple[CodeFeedbackRow,...] = Field(default=(),max_length=256)
    history_support: tuple[CodeHistorySupportD,...] = Field(default=(),max_length=256)
    preserved_exacts: tuple[CodeExactConstraintD,...] = Field(default=(),max_length=12)
    secret: Code | None = None
    trial: Code | None = None
    trials: tuple[CodeTrial,...] = Field(default=(),max_length=256)
    bound_trial_ref: Ref | None = None
    construction_mode: Literal["REBUILD", "PRESERVE_COMPATIBLE"] | None = None
    compilation_frontier: CodeCompilationFrontier | None = None
    protocol: CodeEntryProtocol | None = None
    protocols: tuple[CodeEntryProtocol,...] = Field(default=(),max_length=16)
    observations: tuple[CodeEntryObservation,...] = Field(default=(),max_length=128)
    input: CodeInputBinding | None = None
    forecast_row_ref: Ref | None = None
    bindings: tuple[CodeInputBinding,...] = Field(default=(),max_length=64)
    expected_state: CodeInterfaceState | None = None
    actual_state: CodeInterfaceState | None = None
    remaining_input_budget: int | None = Field(default=None,ge=0)
    maximum_candidates: int = Field(ge=1,le=4096)
    maximum_states: int = Field(ge=1,le=4096)
    maximum_evaluations: int = Field(ge=1,le=65536)
    maximum_attempt_depth: int = Field(ge=0,le=16)
    declared_measures: tuple[Literal["WORST_NONWINNING_RESIDUAL","SUM_SQUARED_RESIDUALS","NONWINNING_BRANCHES","WINNING_HYPOTHESES"],...] = ()
    raw_layer_pixels: tuple[ContactPixel,...] = Field(default=(),max_length=65536)
    layer_templates: tuple[CodeLayerTemplate,...] = Field(default=(),max_length=1024)
    layer_samples: tuple[ContactLayerSample,...] = Field(default=(),max_length=1024)
    @model_validator(mode="after")
    def bound_domains(self):
        alphabet=set(self.alphabet)
        if len(alphabet)!=len(self.alphabet) or self.state is not None and self.secret_length is not None and len(self.state.proposal)!=self.secret_length:
            raise ValueError("value identities and rank domain must be bound")
        codes=self.candidates+tuple(t.values for t in self.trials)
        if self.secret is not None:codes+=(self.secret,)
        if self.trial is not None:codes+=(self.trial,)
        if any(self.secret_length is not None and len(c)!=self.secret_length or not set(c)<=alphabet for c in codes):
            raise ValueError("complete codes must use the declared length and alphabet")
        if self.duplicates_allowed is False and any(len(set(c))!=len(c) for c in codes):
            raise ValueError("supplied codes must preserve the declared duplicate policy")
        if self.state is not None and any(v is not None and v not in alphabet for v in self.state.proposal+self.state.revealed):
            raise ValueError("interface values must belong to the declared alphabet")
        if len({x.law_ref for x in self.laws})!=len(self.laws) or len({t.trial_ref for t in self.trials})!=len(self.trials):
            raise ValueError("law and trial identities must be unique")
        if self.rank_domains and (self.secret_length is not None and len(self.rank_domains)!=self.secret_length or any(not set(d)<=alphabet for d in self.rank_domains)):
            raise ValueError("rank constraints must belong to the declared domain")
        if any(ref not in alphabet or lo<0 or hi<lo or self.secret_length is not None and hi>self.secret_length for ref,lo,hi in self.multiplicity_bounds):
            raise ValueError("invalid multiplicity constraints")
        if self.state is not None and any(self.secret_length is not None and len(row.trial)>self.secret_length or not {v for v in row.trial if v is not None}<=alphabet for row in self.state.history):
            raise ValueError("history must preserve the declared rank/value domain")
        if len({p.point for p in self.raw_layer_pixels})!=len(self.raw_layer_pixels) or len({t.template_ref for t in self.layer_templates})!=len(self.layer_templates):raise ValueError("raw pixels and layer templates have unique identities")
        return self


OPERATION_MODES={"proposal_feedback_layers":"MEASURE","entry_protocol_fit":"FIT",
    "feedback_law_fit":"FIT","feedback_evaluation":"EVALUATE","constraint_filter":"PROPAGATE",
    "trial_partitions":"DOMAIN","identification_policy":"DOMAIN","proposal_compile":"COMPILE",
    "trial_transaction":"STEP_ABSTRACT","feedback_compare_restore":"COMPARE"}


def _proposal_feedback_layers(request):
    measured=measure_translated_layers(request)
    if measured.computation_bound_reached:return measured
    templates={t.template_ref:t for t in request.layer_templates};slots={};palette=[];submit=[];contours=[];unknown=[]
    visible=measured.values.get("measured_layer_alternatives",());possible=measured.values.get("possible_layer_alternatives",())
    for row in visible:
        template=templates[row["template_ref"]];evidence={"template_ref":template.template_ref,"owner_ref":template.owner_ref,
            "layer_ref":template.layer_ref,"support":row["measurement"]["support"],"origin":template.origin,
            "decoded_value_ref":template.decoded_value_ref,"feedback_mark_ref":template.feedback_mark_ref}
        if template.component=="PALETTE":palette.append(evidence)
        elif template.component=="SUBMIT":submit.append(evidence)
        else:
            key=(template.component,template.row_ref,template.rank);slots.setdefault(key,[]).append(evidence)
            if template.component=="FEEDBACK":contours.append((template.row_ref,template.rank,template.layer_ref,row["measurement"]["support"],template.feedback_mark_ref))
    for row in possible:
        template=templates[row["template_ref"]]
        unknown.append({"template_ref":template.template_ref,"component":template.component,"rank":template.rank,
            "row_ref":template.row_ref,"owner_ref":template.owner_ref,"unknown_pixel_constraints":row["unknown_pixel_constraints"]})
    ordered=tuple((kind,row_ref,rank,tuple(alternatives)) for (kind,row_ref,rank),alternatives in sorted(slots.items(),key=lambda item:(item[0][0],item[0][1] or '',item[0][2])))
    # Shared outline pixels remain attributable to each slot; no connected-component merge.
    shared=[];count=measured.examined_count
    for i,left in enumerate(contours):
        for j,right in enumerate(contours[i+1:],start=i+1):
            if count>=request.maximum_evaluations:
                return family_result(request,values={"measured_palette_alternatives":tuple(palette),"ordered_slot_alternatives":ordered,
                    "measured_submit_controls":tuple(submit),"per_slot_feedback_contours":tuple(contours),
                    "shared_outline_pixels_with_distinct_owners":tuple(shared)},examined_count=count,
                    domain_complete=False,computation_bound_reached=True,frontier={"phase":"contour_overlap","left_index":i,"right_index":j})
            count+=1
            intersection=set(left[3])&set(right[3])
            if intersection:shared.append((left[:3],right[:3],tuple(sorted(intersection))))
    retained=request.state.history if request.state is not None else ()
    return family_result(request,values={"measured_palette_alternatives":tuple(palette),"ordered_slot_alternatives":ordered,
        "measured_submit_controls":tuple(submit),"per_slot_feedback_contours":tuple(contours),
        "shared_outline_pixels_with_distinct_owners":tuple(shared),"unresolved_layer_evidence":tuple(unknown),
        "retained_complete_history":retained,"history_was_reread_from_current_screen":False,
        "contiguous_border_treated_as_one_uniform_feedback":False,"canonical_slot_values_written":False,
        "raw_layer_refutations":measured.values.get("refutations",())},examined_count=count,
        prerequisite_refs=("current_palette_slot_submit_or_feedback_contour_evidence",) if unknown else ())


def _feedback(secret,trial,law):
    marks=[law.absent_ref if value is not None else None for value in trial]
    remaining=Counter(secret)
    for rank,value in enumerate(trial):
        if value is not None and value==secret[rank]:marks[rank]=law.exact_ref;remaining[value]-=1
    ranks=range(len(trial)) if law.allocation_order=="LEFT_TO_RIGHT" else range(len(trial)-1,-1,-1)
    for rank in ranks:
        value=trial[rank]
        if value is not None and marks[rank]!=law.exact_ref and remaining[value]>0:
            marks[rank]=law.elsewhere_ref;remaining[value]-=1
    return tuple(marks)


def _valid_secret(request,code):
    if any(code[row.rank]!=row.value_ref for row in request.preserved_exacts):return False
    if not request.duplicates_allowed and len(set(code))!=len(code):return False
    if any(v is not None and code[r]!=v for r,v in enumerate(request.state.revealed)):return False
    if request.rank_domains and any(v not in request.rank_domains[r] for r,v in enumerate(code)):return False
    counts=Counter(code)
    return all(lo<=counts[ref]<=hi for ref,lo,hi in request.multiplicity_bounds)


def _candidate_accounts(request):
    domains=request.rank_domains or tuple(request.alphabet for _ in range(request.secret_length))
    total=len(request.candidates) if request.candidate_source=="PROVIDED" else 1
    if request.candidate_source=="ENUMERATE":
        for domain in domains:total*=len(domain)
    supported=[];examined=0;evaluations=0;truncated=False;next_index=request.candidate_offset
    for index in range(request.candidate_offset,total):
        if examined>=request.maximum_candidates:truncated=True;next_index=index;break
        if request.candidate_source=="PROVIDED":code=request.candidates[index]
        else:
            # Random access prevents replaying a huge skipped prefix.
            cursor=index;digits=[]
            for domain in reversed(domains):cursor,digit=divmod(cursor,len(domain));digits.append(domain[digit])
            code=tuple(reversed(digits))
        examined+=1
        if not _valid_secret(request,code):continue
        needed=len(request.laws)*len(request.state.history)
        if evaluations+needed>request.maximum_evaluations:truncated=True;next_index=index;break
        for law in request.laws:
            evaluations+=len(request.state.history)
            if all(_feedback(code,row.trial,law)==row.feedback for row in request.state.history):
                supported.append((tuple(code),law.law_ref))
    complete=not truncated and request.candidate_domain_complete and request.candidate_offset==0
    return tuple(dict.fromkeys(supported)),examined,complete,({"next_candidate_index":next_index} if truncated else {}),evaluations


def _partitions(request,candidate_accounts,trial):
    laws={x.law_ref:x for x in request.laws};branches={}
    for secret,law_ref in candidate_accounts:
        feedback=_feedback(secret,trial.values,laws[law_ref])
        branches.setdefault((feedback,secret==trial.values),[]).append((secret,law_ref))
    return tuple({"feedback":feedback,"winning":winning,"candidate_accounts":tuple(values)}
        for (feedback,winning),values in sorted(branches.items()))


def _trial_measures(branches):
    residuals=tuple(len({secret for secret,_ in b["candidate_accounts"]}) for b in branches if not b["winning"])
    return {"WORST_NONWINNING_RESIDUAL":max(residuals,default=0),
        "SUM_SQUARED_RESIDUALS":sum(n*n for n in residuals),"NONWINNING_BRANCHES":len(residuals),
        "WINNING_HYPOTHESES":sum(len(b["candidate_accounts"]) for b in branches if b["winning"])}


def _identification_domain(request,candidate_accounts,complete,evaluations,candidate_frontier):
    root=(candidate_accounts,min(request.state.attempts_remaining,request.maximum_attempt_depth))
    queue=deque((root,));seen={root:0};nodes=[];capped=False;unfinished=None
    while queue:
        if len(nodes)>=request.maximum_states:capped=True;break
        residual,attempts=queue.popleft();edges=[]
        if attempts>0 and residual:
            for trial_index,trial in enumerate(request.trials):
                if not code_trial_preservation_d(request,trial)['preserved_exact_ranks_satisfied']:continue
                if evaluations+len(residual)>request.maximum_evaluations:
                    capped=True;unfinished=(residual,attempts,trial_index);break
                evaluations+=len(residual)
                replies=[]
                for branch in _partitions(request,residual,trial):
                    child=(branch["candidate_accounts"],attempts-1)
                    if not branch["winning"] and child not in seen:
                        if len(seen)>=request.maximum_states:capped=True
                        else:seen[child]=len(seen);queue.append(child)
                    replies.append({**branch,"child_state":None if branch["winning"] else child,
                                    "child_admitted":branch["winning"] or child in seen})
                edges.append({"trial_ref":trial.trial_ref,"reply_quantifier":"ALL_DECLARED","replies":tuple(replies)})
        nodes.append({"state":(residual,attempts),"trial_quantifier":"ANY_DECLARED","trials":tuple(edges)})
        if unfinished is not None:break
    forced={};recommendations={}
    for node in sorted(nodes,key=lambda x:x["state"][1]):
        admissible=tuple(edge["trial_ref"] for edge in node["trials"] if edge["replies"] and
            all(b["winning"] or forced.get(b["child_state"],False) for b in edge["replies"]))
        forced[node["state"]]=bool(admissible);recommendations[node["state"]]=admissible
    qualified=complete and request.scope.input_domain_complete and not capped
    return family_result(request,values={"root":root,"nodes":tuple(nodes),"attempt_horizon":root[1],
        "forced_under_declared_trial_domain":forced.get(root,False) if qualified else None,
        "root_recommendations":recommendations.get(root,()) if qualified else (),
        "empty_candidate_contradiction":not bool(candidate_accounts),"trial_order_preference_inferred":False,
        "feedback_evaluations":evaluations},
        examined_count=len(nodes),domain_complete=complete and not capped,
        computation_bound_reached=capped or bool(candidate_frontier),
        frontier={"pending_states":tuple(queue),"admitted_states":tuple(seen),"unfinished_trial":unfinished,
                  "candidate_frontier":candidate_frontier} if capped or candidate_frontier else {})


def _edit(request,state,input,protocol):
    slots=list(state.proposal)
    if input.kind=="ADD":
        if input.value_ref not in request.alphabet or None not in slots:return None,"available_value_and_free_rank"
        if not request.duplicates_allowed and input.value_ref in slots:return None,"duplicate_policy"
        if protocol.palette_mode is not None and input.value_ref not in _palette(request,tuple(slots),protocol):
            return None,"currently_available_palette_value"
        slots[slots.index(None)]=input.value_ref
    elif input.kind=="CLEAR":
        if input.rank is None or input.rank>=len(slots):return None,"bound_clear_rank"
        for rank in range(input.rank,len(slots)) if protocol.clear_suffix else (input.rank,):slots[rank]=None
    else:return None,"edit_kind"
    return state.model_copy(update={"proposal":tuple(slots)}),None


def _palette(request,proposal,protocol):
    if protocol.palette_mode=="REUSE_ALL":return request.alphabet
    if protocol.palette_mode=="REMOVE_USED":return tuple(value for value in request.alphabet if value not in proposal)
    return None


def _submit_structure(state,protocol):
    complete=all(value is not None for value in state.proposal)
    if not complete and not protocol.allow_partial_submit:return state,False,False
    debit=1 if complete or protocol.partial_consumes_attempt else 0
    if debit>state.attempts_remaining:return None,False,False
    after=state.model_copy(update={"proposal":(None,)*len(state.proposal) if protocol.clear_after_submit else state.proposal,
        "attempts_remaining":state.attempts_remaining-debit})
    return after,True,complete or bool(protocol.record_partial_submission)


def _fit_entry_protocols(request):
    if not request.protocols or not request.observations:
        return family_result(request,prerequisite_refs=("entry_protocol_alternatives_and_observations",),domain_complete=False)
    if any(p.palette_mode is None or p.record_partial_submission is None for p in request.protocols):
        return family_result(request,prerequisite_refs=("explicit_palette_and_partial_recording_contracts",),domain_complete=False)
    retained=[];refutations=[]
    for protocol in request.protocols:
        first=None
        for observation in request.observations:
            before,actual=observation.before,observation.after
            if observation.input.kind=="SUBMIT":
                predicted,accepted,record=_submit_structure(before,protocol)
                if predicted is None:first=(observation.evidence_ref,"attempt_bound");break
                tail=actual.history[len(before.history):]
                history_ok=actual.history[:len(before.history)]==before.history and len(tail)==(1 if accepted and record else 0)
                if tail:history_ok=history_ok and tail[0].trial==before.proposal and tail[0].evidence_status=="OBSERVED"
                revealed_ok=all((new==old if old is not None else new is None or new==before.proposal[rank])
                    for rank,(old,new) in enumerate(zip(before.revealed,actual.revealed)))
                if not accepted:revealed_ok=actual.revealed==before.revealed
                fits=(predicted.proposal==actual.proposal and predicted.attempts_remaining==actual.attempts_remaining
                    and predicted.recovery_epoch==actual.recovery_epoch and history_ok and revealed_ok)
            else:
                predicted,missing=_edit(request,before,observation.input,protocol)
                fits=not missing and predicted==actual
            if fits and observation.palette_after is not None:
                fits=set(_palette(request,actual.proposal,protocol))==set(observation.palette_after)
            if not fits:first=(observation.evidence_ref,"entry_or_submit_or_palette_effect");break
        if first is None:retained.append(protocol)
        else:refutations.append((protocol.protocol_ref,first))
    return family_result(request,values={"compatible_protocols":tuple(retained),"first_refutations":tuple(refutations),
        "palette_exhaustion_is_not_proposal_completeness":True},examined_count=len(request.protocols)*len(request.observations))


def _submit_transaction(request,accounts,count,complete,frontier,evaluations):
    state=request.state;protocol=request.protocol
    if protocol.record_partial_submission is None or protocol.palette_mode is None:
        return family_result(request,prerequisite_refs=("explicit_submit_recording_and_palette_contract",),domain_complete=False)
    after,accepted,record=_submit_structure(state,protocol)
    if after is None:return family_result(request,prerequisite_refs=("remaining_attempt",),domain_complete=False)
    if not accepted:return family_result(request,values={"rejected":True,"after":state,"input_cost":request.input.cost,
        "remaining_input_budget":request.remaining_input_budget-request.input.cost})
    if record and (request.forecast_row_ref is None or request.forecast_row_ref in {row.evidence_ref for row in state.history}):
        return family_result(request,prerequisite_refs=("fresh_caller_bound_forecast_row_ref",),domain_complete=False)
    if record and len(state.history)>=256:return family_result(request,prerequisite_refs=("bounded_history_storage",),domain_complete=False)
    laws={law.law_ref:law for law in request.laws};outcomes=[];next_account=None
    for account_index,(secret,law_ref) in enumerate(accounts):
        if evaluations>=request.maximum_evaluations:next_account=account_index;break
        evaluations+=1
        law=laws[law_ref];feedback=_feedback(secret,state.proposal,law);revealed=list(state.revealed)
        for rank,mark in enumerate(feedback):
            if mark==law.exact_ref:revealed[rank]=state.proposal[rank]
        predicted_row=CodeFeedbackRow(evidence_ref=request.forecast_row_ref,model_epoch=request.active_model_epoch,
            trial=state.proposal,feedback=feedback,evidence_status="PREDICTED") if record else None
        history=state.history+(predicted_row,) if predicted_row is not None else state.history
        outcome=after.model_copy(update={"revealed":tuple(revealed),"history":history})
        outcomes.append({"secret_account":secret,"law_ref":law_ref,"feedback":feedback,"after":outcome,
            "palette_after":_palette(request,outcome.proposal,protocol),"accepted":state.proposal==secret,
            "input_cost":request.input.cost,"remaining_input_budget":request.remaining_input_budget-request.input.cost,
            "feedback_requires_observation":True})
    remaining={**frontier,"next_account_index":next_account} if next_account is not None else frontier
    return family_result(request,values={"conditional_outcomes":tuple(outcomes),"exact_revelations_alone_are_not_acceptance":True,
        "feedback_evaluations":evaluations},examined_count=count+len(outcomes),domain_complete=complete and next_account is None,
        computation_bound_reached=bool(remaining),frontier=remaining)


def _compile(request):
    trial=next((t for t in request.trials if t.trial_ref==request.bound_trial_ref),None)
    if trial is None or request.protocol is None:return family_result(request,prerequisite_refs=("bound_trial_and_entry_protocol",),domain_complete=False)
    if not code_trial_preservation_d(request,trial)['preserved_exact_ranks_satisfied']:
        return family_result(request,prerequisite_refs=('code.trial_must_reenter_preserved_exact_ranks',),domain_complete=False)
    if request.construction_mode is None:return family_result(request,prerequisite_refs=("caller_bound_construction_mode",),domain_complete=False)
    if request.protocol.palette_mode is None:return family_result(request,prerequisite_refs=("current_palette_availability_contract",),domain_complete=False)
    state=request.state;word=[];cost=0;phase="CLEAR"
    resume=request.compilation_frontier
    if resume is not None:
        expected=(request.scope.caller_ref,request.scope.parent_contribution_ref,request.scope.epoch,
                  request.scope.model_revision_ref,trial.trial_ref,request.protocol.protocol_ref,request.construction_mode,state.proposal)
        actual=(resume.caller_ref,resume.parent_contribution_ref,resume.epoch,resume.model_revision_ref,
                resume.trial_ref,resume.protocol_ref,resume.construction_mode,resume.expected_proposal)
        if actual!=expected:return family_result(request,prerequisite_refs=("current_compilation_frontier_identity_and_effect",),domain_complete=False)
        phase=resume.next_phase
    def boundary(prerequisite):
        frontier=CodeCompilationFrontier(caller_ref=request.scope.caller_ref,parent_contribution_ref=request.scope.parent_contribution_ref,
            epoch=request.scope.epoch,model_revision_ref=request.scope.model_revision_ref,trial_ref=trial.trial_ref,
            protocol_ref=request.protocol.protocol_ref,construction_mode=request.construction_mode,next_phase=phase,
            expected_proposal=state.proposal)
        return family_result(request,values={"grounded_prefix":tuple(word),"cost":cost,"predicted_proposal":state.proposal},
            prerequisite_refs=(prerequisite,),domain_complete=False,frontier={"compilation":frontier},examined_count=len(word))
    while phase!="SUBMIT":
        if phase=="CLEAR":
            rank=next((r for r,v in enumerate(state.proposal) if v is not None and
                (request.construction_mode=="REBUILD" or v!=trial.values[r])),None)
            if rank is None:phase="FILL";continue
            kind="CLEAR"
        else:
            if any(v is not None and v!=trial.values[r] for r,v in enumerate(state.proposal)):
                return boundary("compatible_proposal_before_fill")
            rank=next((r for r,v in enumerate(state.proposal) if v is None),None)
            if rank is None:phase="SUBMIT";continue
            kind="ADD"
        binding=next((b for b in request.bindings if b.kind==kind and
            (b.rank==rank if kind=="CLEAR" else b.value_ref==trial.values[rank])),None)
        if binding is None:return boundary("current_interface_binding")
        if cost+binding.cost>request.remaining_input_budget:return boundary("remaining_input_budget")
        after,missing=_edit(request,state,binding,request.protocol)
        if missing:return boundary(missing)
        word.append(binding);cost+=binding.cost;state=after
        relayout=request.protocol.relayout_after_clear if kind=="CLEAR" else request.protocol.relayout_after_add
        if phase=="CLEAR" and not any(v is not None and (request.construction_mode=="REBUILD" or v!=trial.values[r]) for r,v in enumerate(state.proposal)):
            phase="FILL"
        if phase=="FILL" and state.proposal==trial.values:phase="SUBMIT"
        if relayout:return boundary("remeasured_interface_after_relayout")
    submit=next((b for b in request.bindings if b.kind=="SUBMIT"),None)
    if submit is None or state.attempts_remaining==0 or cost+submit.cost>request.remaining_input_budget:
        return boundary("available_submit_attempt_and_budget")
    return family_result(request,values={"grounded_prefix":tuple(word)+(submit,),"cost":cost+submit.cost,
        "feedback_observation_boundary":True,"predicted_proposal":state.proposal,"construction_mode":request.construction_mode,
        "input_costs":tuple(binding.cost for binding in word)+(submit.cost,)},examined_count=len(word)+1)


def _calculate(request):
    if request.mode is None or OPERATION_MODES.get(request.operation_ref)!=request.mode:
        return family_result(request,signature_supported=False,domain_complete=False)
    required={"entry_protocol_fit":("protocols","observations"),"feedback_evaluation":("secret","trial","law_ref"),
        "trial_partitions":("trials",),"identification_policy":("trials",),"proposal_compile":("bound_trial_ref","protocol","bindings","trials","construction_mode"),
        "trial_transaction":("input","protocol"),"feedback_compare_restore":("expected_state","actual_state")}
    required["proposal_feedback_layers"]=("raw_layer_pixels","layer_templates",)
    required["entry_protocol_fit"]+=("alphabet","duplicates_allowed",)
    required["feedback_evaluation"]+=("laws","alphabet","secret_length",)
    required["proposal_compile"]+=("state","alphabet","secret_length","duplicates_allowed","remaining_input_budget",)
    required["trial_transaction"]+=("state","alphabet","duplicates_allowed","remaining_input_budget",)
    missing=missing_supplied_fields(request,required.get(request.operation_ref,()))
    candidate_requested=request.operation_ref in ("feedback_law_fit","constraint_filter","trial_partitions","identification_policy") or (
        request.operation_ref=="trial_transaction" and request.input is not None and request.input.kind=="SUBMIT")
    if candidate_requested:missing+=missing_supplied_fields(request,("alphabet","secret_length","duplicates_allowed","candidate_domain_complete","candidate_source","active_model_epoch","laws","state"))
    if request.candidate_source=="PROVIDED" and candidate_requested:
        missing+=missing_supplied_fields(request,("candidates",))
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    op=request.operation_ref
    if candidate_requested and any(
        row.model_epoch!=request.active_model_epoch for row in request.state.history):
        return family_result(request,prerequisite_refs=("history_belongs_to_bound_model_epoch",),domain_complete=False)
    if candidate_requested and any(row.evidence_status!="OBSERVED" for row in request.state.history):
        return family_result(request,prerequisite_refs=("sealed_feedback_before_candidate_filtering",),domain_complete=False)
    if op=="feedback_law_fit" and not request.state.history:
        return family_result(request,prerequisite_refs=("observed_feedback_history",),domain_complete=False)
    if op=="proposal_feedback_layers":return _proposal_feedback_layers(request)
    if op=="entry_protocol_fit":
        return _fit_entry_protocols(request)
    if op=="feedback_evaluation":
        law=next((x for x in request.laws if x.law_ref==request.law_ref),None)
        if law is None or request.secret is None or request.trial is None:return family_result(request,prerequisite_refs=("bound_secret_trial_and_law",),domain_complete=False)
        return family_result(request,values={"feedback":_feedback(request.secret,request.trial,law),"law_ref":law.law_ref,"exact_occurrences_reserved_first":True},examined_count=len(request.trial))
    if op=="proposal_compile":return _compile(request)
    if op=="trial_transaction" and request.input is not None and request.input.kind!="SUBMIT":
        if request.protocol is None:return family_result(request,prerequisite_refs=("bound_entry_protocol",),domain_complete=False)
        if request.input.cost>request.remaining_input_budget:return family_result(request,prerequisite_refs=("remaining_input_budget",),domain_complete=False)
        after,missing=_edit(request,request.state,request.input,request.protocol)
        return family_result(request,values={"after":after,"input_cost":request.input.cost,
            "remaining_input_budget":request.remaining_input_budget-request.input.cost},prerequisite_refs=(missing,) if missing else ())
    if op=="feedback_compare_restore":
        if request.expected_state is None or request.actual_state is None:return family_result(request,prerequisite_refs=("expected_and_actual_interface_states",),domain_complete=False)
        expected,actual=request.expected_state,request.actual_state
        fields=("proposal","revealed","attempts_remaining","recovery_epoch")
        changed=tuple(name for name in fields if getattr(expected,name)!=getattr(actual,name))
        old={r.evidence_ref:r for r in expected.history};conflicts=tuple(r.evidence_ref for r in actual.history if r.evidence_ref in old and old[r.evidence_ref]!=r)
        rank_conflicts=tuple((row.evidence_ref,old[row.evidence_ref].model_epoch,row.model_epoch,rank,previous,current)
            for row in actual.history if row.evidence_ref in old
            for rank,(previous,current) in enumerate(zip(old[row.evidence_ref].feedback,row.feedback)) if previous!=current)
        row_domain_conflicts=tuple((row.evidence_ref,old[row.evidence_ref],row)
            for row in actual.history if row.evidence_ref in old and
            (old[row.evidence_ref].trial!=row.trial or old[row.evidence_ref].model_epoch!=row.model_epoch))
        retained=expected.history+tuple(r for r in actual.history if r.evidence_ref not in old)
        return family_result(request,values={"changed_fields":changed,"history_conflicts":conflicts,
            "feedback_rank_conflicts":rank_conflicts,"row_domain_conflicts":row_domain_conflicts,"retained_history":retained,
            "returned_history":actual.history,"first_divergence":changed[0] if changed else (conflicts[0] if conflicts else None),
            "rank_contradictions":tuple((r,e,a) for r,(e,a) in enumerate(zip(expected.revealed,actual.revealed)) if e is not None and e!=a),
            "restored":expected.recovery_epoch!=actual.recovery_epoch,"attempt_difference":actual.attempts_remaining-expected.attempts_remaining},examined_count=len(actual.history)+len(fields))
    candidate_accounts,count,complete,frontier,evaluations=_candidate_accounts(request)
    if op in ("constraint_filter","feedback_law_fit"):
        compatible_refs=tuple(dict.fromkeys(law for _,law in candidate_accounts))
        return family_result(request,values={"supported_candidate_accounts":candidate_accounts,"candidate_residual":tuple(dict.fromkeys(c for c,_ in candidate_accounts)),
            "compatible_law_refs":compatible_refs,
            "unresolved_law_refs":tuple(law.law_ref for law in request.laws if law.law_ref not in compatible_refs) if not complete else (),
            "retained_history":request.state.history,
            "empty_candidate_contradiction":complete and not candidate_accounts,
            "rank_domains":tuple(tuple(dict.fromkeys(c[r] for c,_ in candidate_accounts)) for r in range(request.secret_length))},
            prerequisite_refs=('code.current_reading_or_model_contradiction',) if complete and not candidate_accounts else (),
            examined_count=count,domain_complete=complete and bool(candidate_accounts),computation_bound_reached=bool(frontier),frontier=frontier)
    if op=="trial_partitions":
        trials=[];trial_frontier=None
        for trial_index,trial in enumerate(request.trials):
            if evaluations+len(candidate_accounts)>request.maximum_evaluations:trial_frontier=trial_index;break
            evaluations+=len(candidate_accounts)
            branches=_partitions(request,candidate_accounts,trial);measures=_trial_measures(branches)
            trials.append({"trial_ref":trial.trial_ref,"branches":branches,
                'preservation':code_trial_preservation_d(request,trial),
                "declared_measures":tuple((name,measures[name]) for name in request.declared_measures)})
        bounded_frontier={**frontier,"next_trial_index":trial_frontier} if trial_frontier is not None else frontier
        return family_result(request,values={"partitions":tuple(trials),"candidate_accounts":candidate_accounts,
            "feedback_evaluations":evaluations,"semantic_preference_inferred":False},
            examined_count=count+evaluations,domain_complete=complete and trial_frontier is None,
            computation_bound_reached=bool(bounded_frontier),frontier=bounded_frontier)
    if op=="identification_policy":return _identification_domain(request,candidate_accounts,complete,evaluations,frontier)
    if request.input is None or request.protocol is None:return family_result(request,prerequisite_refs=("bound_input_and_protocol",),domain_complete=False)
    if request.input.cost>request.remaining_input_budget:return family_result(request,prerequisite_refs=("remaining_input_budget",),domain_complete=False)
    if request.input.kind!="SUBMIT":
        after,missing=_edit(request,request.state,request.input,request.protocol)
        return family_result(request,values={"after":after,"input_cost":request.input.cost,
            "remaining_input_budget":request.remaining_input_budget-request.input.cost},prerequisite_refs=(missing,) if missing else ())
    return _submit_transaction(request,candidate_accounts,count,complete,frontier,evaluations)


def measure_feedback_code_identification(request: FeedbackCodeRequest) -> MechanicalFamilyResult:
    bound,missing,work=bind_code_history_and_exacts_d(request)
    if missing:return family_result(request,prerequisite_refs=missing,examined_count=work,domain_complete=False)
    returned=_calculate(bound)
    return returned.model_copy(update={'examined_count':returned.examined_count+work})
