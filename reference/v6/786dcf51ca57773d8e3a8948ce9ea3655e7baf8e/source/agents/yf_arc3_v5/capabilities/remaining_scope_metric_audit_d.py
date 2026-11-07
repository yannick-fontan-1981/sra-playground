"""Metric inverse questions, exact extension scope and quantified reply evidence."""
from __future__ import annotations
from typing import ClassVar
from fractions import Fraction
import hashlib
from pathlib import Path
from pydantic import Field
from agents.yf_arc3_v5.logos.types import Ref,FrozenModel,stable_digest
from .mechanical_family_contracts_d import DMechanicalRequest,DWorkBudget,DComputationInterrupted,d_validate_request,d_result
from .native_goal_domain_audit_d import NativeGoalDomainBaseD,_native_value_at_path,_native_condition_matches
from .metric_stack_contracts import MetricStackRequest
from .metric_stack_image import measure_metric_stack_request,enumerate_metric_target_domain,assign_metric_occurrences


class MetricGoalBaseD(NativeGoalDomainBaseD):
    native_request: MetricStackRequest
    native_parent_goal_ref: Ref
    native_input_revision_ref: Ref
    native_model_assignments_digest: Ref


class MetricGoalRequestD(MetricGoalBaseD):
    schema_version: Ref='yf_arc3_v5.metric_goal_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.metric_stack_image','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.metric_stack_image.target_domain','DOMAIN'),)


class MetricWhyRequestD(MetricGoalBaseD):
    schema_version: Ref='yf_arc3_v5.metric_why_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.metric_stack_image.why','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.metric_stack_image.occurrence_assignment','DOMAIN'),)


def _measure_metric_goal_d(request,calculation):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    budget=DWorkBudget(request)
    try:
        child=request.native_request;identity=child.identity
        if ((identity.operation_ref,identity.mode) not in request.native_allowed_pairs or identity.parent_contribution_ref!=request.scope.parent_contribution_ref or
                request.native_parent_goal_ref!=request.scope.parent_goal_ref or identity.epoch!=request.scope.epoch or
                child.evidence_revision_ref!=request.scope.evidence_revision_ref or identity.input_revision_ref!=request.native_input_revision_ref or
                stable_digest(identity.model_assignments)!=request.native_model_assignments_digest):
            return d_result(request,'NEEDS_EVIDENCE','EXACT_CURRENT_METRIC_GOAL_QUESTION_SCOPE_REQUIRED')
        facts=measure_metric_stack_request(child).facts
        required=('kernel_matches','return_type_matches','packet_binding_matches','has_current_evidence','has_state',
            'signature_declared','state_revision_matches','law_revision_matches','evidence_revision_matches')
        if any(facts.get(field) is not True for field in required):
            return d_result(request,'NEEDS_EVIDENCE','CURRENT_SIGNED_METRIC_REQUEST_PREREQUISITES',values={'request_facts':facts})
        if identity.operation_ref.endswith('.target_domain') and child.target is None:
            return d_result(request,'NEEDS_EVIDENCE','CURRENT_METRIC_REFERENCE_TARGET_REQUIRED')
        for condition in request.result_conditions:
            if (condition.goal_contribution_ref!=request.scope.parent_contribution_ref or condition.epoch!=request.scope.epoch or
                    condition.evidence_revision_ref!=request.scope.evidence_revision_ref or condition.model_revision_ref!=request.scope.model_revision_ref):
                return d_result(request,'NEEDS_EVIDENCE','CURRENT_METRIC_RESULT_CONDITION_SCOPE_REQUIRED')
        reserve=1+sum(len(c.field_path)+1 for c in request.result_conditions)
        bounds=identity.actual_bounds
        # Do not change a signed request's bounds/fingerprint behind its caller.
        if bounds['nodes']+reserve>request.node_bound or bounds['outputs']>request.domain_bound or bounds['time_ms']>request.time_bound_ms:
            return d_result(request,'BUDGET_REACHED','SOURCE_REBIND_SMALLER_METRIC_REQUEST_REQUIRED',frontier={'same_question_needs_smaller_signed_bounds':True})
        budget.visit({'stage':'signed_native_metric_question'})
        native=calculation(child);budget.examined+=native.values.get('actual_node_visits',native.examined_count)
        rows=[];missing=[]
        for condition in request.result_conditions:
            for index in range(len(condition.field_path)+1):budget.visit({'stage':'metric_goal_result_path','path_index':index})
            present,actual=_native_value_at_path(native.values,condition.field_path)
            if not present:missing.append(condition.condition_ref)
            rows.append({'condition_ref':condition.condition_ref,'present':present,'matched':present and _native_condition_matches(actual,condition),'actual':actual})
        complete=not native.pending_count and not missing and all(native.facts.get(field) is False for field in ('has_missing_observation','model_contradiction','bound_reached'))
        budget.finish()
        return d_result(request,'COMPLETE' if complete else 'BUDGET_REACHED' if native.facts.get('bound_reached') else 'NEEDS_EVIDENCE',
            'SIGNED_METRIC_TARGET_OR_ASSIGNMENT_MEASUREMENTS',complete=complete,examined=budget.examined,
            values={'native_values':native.values,'native_request_identity':native.request_identity,'native_facts':native.facts,
                'condition_measurements':tuple(rows),'missing_condition_refs':tuple(missing),'source_question_ref':request.source_question_ref,
                'action_released':False},frontier=native.retained_frontier,
            descriptive_delta={'has_measured_current_goal_contribution':complete and all(row['matched'] for row in rows)})
    except DComputationInterrupted as error:
        return d_result(request,'BUDGET_REACHED',error.cause,examined=budget.examined,frontier={'restart_signed_metric_question':True,'work':error.frontier})


def measure_metric_goal_d(request:MetricGoalRequestD):return _measure_metric_goal_d(request,enumerate_metric_target_domain)
def measure_metric_why_d(request:MetricWhyRequestD):return _measure_metric_goal_d(request,assign_metric_occurrences)


class RegisteredSignatureReceiptD(FrozenModel):
    binding_ref: Ref
    operation_ref: Ref
    mode_ref: Ref
    input_schema_ref: Ref
    output_schema_ref: Ref
    handler_source_ref: Ref
    handler_source_sha256: str=Field(pattern=r'^[0-9a-f]{64}$')
    supported_scope_pairs: tuple[tuple[Ref,Ref,Ref],...]=Field(min_length=1,max_length=128)
    parent_owner_ref: Ref
    registration_evidence_ref: Ref
    current_epoch: int=Field(ge=0)
    evidence_revision_ref: Ref
    model_revision_ref: Ref


class ExtensionScopeRequestD(DMechanicalRequest):
    schema_version: Ref='yf_arc3_v5.extension_scope_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.domain_adapter.registered_extension_scope','AUDIT'),)
    compiled_bindings: tuple[RegisteredSignatureReceiptD,...]=Field(min_length=1,max_length=128)
    requested_binding_ref: Ref
    requested_child_operation_ref: Ref
    requested_child_mode_ref: Ref|None
    requested_input_schema_ref: Ref
    requested_output_schema_ref: Ref
    parent_phase_ref: Ref
    child_phase_ref: Ref
    context_ref: Ref
    inherited_owner_ref: Ref


def measure_extension_scope_d(request:ExtensionScopeRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    budget=DWorkBudget(request)
    try:
        # Inspect the actual registered producer, not only a caller's catalog
        # label. Other owners stay explicit unknowns, never fallback handlers.
        from .mechanical_family_registry_d import FAMILY_D_ENTRIES
        entries={ref:(model,source_file) for ref,implementation,model,source_file in FAMILY_D_ENTRIES}
        matches=[];stale=[];unbound=[];hashes={}
        for binding in request.compiled_bindings:
            budget.visit({'stage':'exact_compiled_operation_mode_and_phase','binding_ref':binding.binding_ref})
            current=(binding.current_epoch==request.scope.epoch and binding.evidence_revision_ref==request.scope.evidence_revision_ref and
                binding.model_revision_ref==request.scope.model_revision_ref)
            if not current:stale.append(binding.binding_ref);continue
            registered=entries.get(binding.binding_ref)
            if registered is None:unbound.append((binding.binding_ref,'CURRENT_REGISTERED_PRODUCER_REQUIRED'));continue
            model,source_file=registered
            if ((binding.operation_ref,binding.mode_ref) not in model.signature_pairs or
                    binding.input_schema_ref!=str(model.model_fields['schema_version'].default) or
                    binding.output_schema_ref!='yf_arc3_v5.d_mechanical_result.v1'):
                unbound.append((binding.binding_ref,'ACTUAL_SIGNATURE_OR_SCHEMA_MISMATCH'));continue
            if source_file not in hashes:
                digest=hashlib.sha256()
                with (Path(__file__).parent/source_file).open('rb') as source:
                    while True:
                        chunk=source.read(65536)
                        if not chunk:break
                        budget.visit({'stage':'current_handler_source_hash_block','source_file':source_file})
                        digest.update(chunk)
                hashes[source_file]=digest.hexdigest()
            if binding.handler_source_sha256!=hashes[source_file]:
                unbound.append((binding.binding_ref,'HANDLER_SOURCE_RECEIPT_STALE'));continue
            if (binding.binding_ref==request.requested_binding_ref and binding.operation_ref==request.requested_child_operation_ref and
                    binding.mode_ref==request.requested_child_mode_ref and binding.input_schema_ref==request.requested_input_schema_ref and
                    binding.output_schema_ref==request.requested_output_schema_ref and binding.parent_owner_ref==request.inherited_owner_ref and
                    (request.parent_phase_ref,request.child_phase_ref,request.context_ref) in binding.supported_scope_pairs):matches.append(binding)
        budget.finish()
        return d_result(request,'COMPLETE' if matches else 'NEEDS_EVIDENCE','EXACT_EXTENSION_SIGNATURE_SCHEMA_OWNER_AND_PHASE_SCOPE',complete=bool(matches),examined=budget.examined,
            values={'compatible_binding_receipts':tuple(matches),'stale_binding_refs':tuple(stale),
                'unbound_producer_receipts':tuple(unbound),'actual_registered_owner_scope':'D_TYPED_PRODUCERS',
                'missing_mode':request.requested_child_mode_ref is None,'alternate_operation_fallback_executed':False,
                'legacy_transaction_reapplied':False,'actual_dispatch_attested':False,'action_released':False},
            descriptive_delta={'has_unique_current_registered_extension_scope':len(matches)==1})
    except DComputationInterrupted as error:
        return d_result(request,'BUDGET_REACHED',error.cause,examined=budget.examined,frontier={'restart_exact_signature_scope':True,'work':error.frontier})


class QuantifiedReplyD(FrozenModel):
    reply_ref: Ref
    required_predicates_satisfied: bool
    complete_primitive_cost: int=Field(ge=0)
    probability: str|None=None
    sealed_response_evidence_ref: Ref


class GuaranteeProbabilityRequestD(DMechanicalRequest):
    schema_version: Ref='yf_arc3_v5.guarantee_probability_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.strategy.guarantee_probability_separation','AUDIT'),)
    replies: tuple[QuantifiedReplyD,...]=Field(min_length=1,max_length=4096)
    required_reply_refs: tuple[Ref,...]=Field(min_length=1,max_length=4096)
    response_domain_complete: bool
    response_domain_evidence_ref: Ref|None
    probability_distribution_evidence_ref: Ref|None
    execution_witness_refs: tuple[Ref,...]=Field(default=(),max_length=3)


def measure_guarantee_probability_d(request:GuaranteeProbabilityRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    budget=DWorkBudget(request)
    try:
        rows=[];cost=0;success=True;total=Fraction(0);accepted=Fraction(0);distribution_complete=True
        refs=[]
        for reply in request.replies:
            budget.visit({'stage':'all_required_reply_evidence','reply_ref':reply.reply_ref})
            refs.append(reply.reply_ref);cost=max(cost,reply.complete_primitive_cost);success=success and reply.required_predicates_satisfied
            if reply.probability is None:distribution_complete=False
            else:
                try:weight=Fraction(reply.probability)
                except (ValueError,ZeroDivisionError):return d_result(request,'NEEDS_EVIDENCE','EXACT_FINITE_PROBABILITY_REQUIRED')
                if weight<0 or weight>1:return d_result(request,'NEEDS_EVIDENCE','PROBABILITY_OUTSIDE_UNIT_INTERVAL')
                total+=weight
                if reply.required_predicates_satisfied:accepted+=weight
            rows.append({'reply_ref':reply.reply_ref,'accepted':reply.required_predicates_satisfied,'complete_primitive_cost':reply.complete_primitive_cost,
                'sealed_response_evidence_ref':reply.sealed_response_evidence_ref})
        coverage=(len(set(refs))==len(refs) and len(set(request.required_reply_refs))==len(request.required_reply_refs) and
            set(refs)==set(request.required_reply_refs) and request.response_domain_complete and request.response_domain_evidence_ref is not None)
        probability=coverage and distribution_complete and total==1 and request.probability_distribution_evidence_ref is not None
        budget.finish()
        return d_result(request,'COMPLETE' if coverage else 'NEEDS_EVIDENCE','GUARANTEE_COST_AND_PROBABILITY_ARE_DISTINCT_CONDITIONAL_RESULTS',
            complete=coverage,examined=budget.examined,values={'every_retained_reply':tuple(rows),
                'universal_guarantee_under_supplied_domain':success if coverage else None,
                'worst_case_primitive_cost_under_supplied_domain':cost if coverage else None,
                'acceptance_probability_under_supplied_distribution':str(accepted) if probability else None,
                'probability_distribution_complete_and_normalized':probability,'missing_reply_refs':tuple(sorted(set(request.required_reply_refs)-set(refs))),
                'execution_witness_refs':request.execution_witness_refs,'reply_branches_dropped_for_witness_cap':False,
                'actual_dispatch_attested':False},descriptive_delta={'has_separately_qualified_reply_guarantee_and_probability_scope':coverage})
    except DComputationInterrupted as error:
        return d_result(request,'BUDGET_REACHED',error.cause,examined=budget.examined,frontier={'restart_all_reply_scope_measurement':True,'work':error.frontier})
