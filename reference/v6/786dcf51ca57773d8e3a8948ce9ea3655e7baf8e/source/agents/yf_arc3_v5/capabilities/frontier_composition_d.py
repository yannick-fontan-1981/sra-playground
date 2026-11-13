"""Exact scoped joins; neither native search nor family/contribution selection."""
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data
from .articulated_dependency_measurement_c import _nodes
from .family_agenda_projection import FamilyAgendaReceipt,demand_signature,project_family_agenda
from .frontier_composition_contracts_d import (FrontierCompositionMeasureInputD,
    FrontierCompositionFactsD,FrontierCompositionFinishInputD,FrontierCompositionReturnD)


def _projection(value,path):
    for part in path:
        if isinstance(value,FrozenMap) and isinstance(part,str) and part in value:
            value=value[part]
        elif isinstance(value,tuple) and isinstance(part,int) and 0<=part<len(value):
            value=value[part]
        else:return None,False
    return value,True


def measure_frontier_composition_d(value: FrontierCompositionMeasureInputD) -> FrontierCompositionFactsD:
    request=value.request
    why,agenda,join=request.why,request.agenda,request.join_request
    missing=[]
    current=(len(value.canonical_agenda_rows)==1
        and value.canonical_agenda_rows[0].get('family_agenda')==immutable_json_data(agenda)
        and bool(value.canonical_agenda_rows[0].get('supported_agenda_claim_refs')))
    if not current:missing.append('composition.current_canonical_parent_agenda')
    if _nodes(immutable_json_data(request),request.maximum_projection_nodes) is None:
        return FrontierCompositionFactsD(request=request,facts=FrozenMap({'composition_bound':False}),
            missing_refs=('composition.declared_projection_node_bound',))
    if (join.parent_goal_ref!=why.parent_goal_ref or agenda.parent_goal_ref!=why.parent_goal_ref
            or join.epoch!=agenda.epoch or join.episode_ref!=why.episode_ref
            or join.level_scope_ref!=why.level_scope_ref or agenda.episode_ref!=why.episode_ref
            or agenda.level_scope_ref!=why.level_scope_ref or join.max_candidates>3):
        missing.append('composition.same_parent_scope_and_three_global_root_witnesses')
    if not all(group.domain_complete for group in join.groups):
        missing.append('composition.complete_supplied_family_domains')
    candidates=tuple((group.group_ref,row) for group in join.groups for row in group.candidates)
    bindings={(row.group_ref,row.candidate.candidate_ref):row for row in request.bindings}
    if len(bindings)!=len(request.bindings) or set(bindings)!={(g,c.candidate_ref) for g,c in candidates}:
        missing.append('composition.exact_all_candidate_binding_inventory')
    rows=project_family_agenda(agenda)['rows']
    required=set(request.required_request_refs)
    if len(required)!=len(request.required_request_refs):missing.append('composition.distinct_required_operations')
    domains={row['demand']['request']['request_ref']:row for row in rows}
    for ref in sorted(required):
        row=domains.get(ref)
        if (row is None or not row['owner_current'] or not row['current_inputs_bound']
                or not row['prerequisites_current'] or row['conflicting_current_returns']):
            missing.append('composition.required_current_dependency:'+ref)
    covered=set()
    for group_ref,candidate in candidates:
        binding=bindings.get((group_ref,candidate.candidate_ref))
        if binding is None:continue
        returned=binding.returned
        original=returned.measured.request
        local_why=original.why
        common_fields=('parent_goal_ref','consumer_ref','next_item_ref','desired_future',
            'episode_ref','level_scope_ref','temporal_scope_ref')
        if (returned.missing_refs or returned.parent_return.get('canonical_agenda_receipt_applied') is not True
                or any(getattr(local_why,key)!=getattr(why,key) for key in common_fields)
                or not set(why.preservation_refs)<=set(local_why.preservation_refs)):
            missing.append('composition.current_complete_same_parent_frontier:'+candidate.candidate_ref)
            continue
        receipt=FamilyAgendaReceipt.model_validate(returned.parent_return['agenda_receipt'])
        signature=demand_signature(receipt.demand)
        exact=tuple(row for row in agenda.receipts if demand_signature(row.demand)==signature and row.result==receipt.result)
        demand=tuple(row for row in agenda.demands if demand_signature(row)==signature)
        if len(demand)!=1 or not exact or candidate.result!=receipt.result or receipt.result.status!='FOUND':
            missing.append('composition.exact_current_native_receipt:'+candidate.candidate_ref)
            continue
        covered.add(demand[0].request.request_ref)
        if any(ref in agenda.invalidated_dependency_refs
                or agenda.current_dependency_revisions.get(ref)!=candidate.dependency_revisions[ref]
                for ref in sorted(candidate.dependency_revisions)):
            missing.append('composition.current_dependency_revisions:'+candidate.candidate_ref)
        expected={'parent_goal_ref':local_why.parent_goal_ref,'episode_ref':local_why.episode_ref,
            'level_scope_ref':local_why.level_scope_ref,'consumer_ref':local_why.consumer_ref,
            'desired_predicate':local_why.desired_future,'usefulness_premise_refs':local_why.usefulness_premise_refs,
            'morphology_premise_refs':local_why.morphology_premise_refs,'and_dependency_refs':local_why.and_dependency_refs,
            'or_dependency_refs':local_why.or_dependency_refs,'temporal_scope_ref':local_why.temporal_scope_ref,
            'falsifier_ref':local_why.falsifier_ref}
        if (any(candidate.rationale.get(key)!=expected[key] for key in sorted(expected))
                or candidate.preservation_refs!=local_why.preservation_refs):
            missing.append('composition.full_unchanged_why:'+candidate.candidate_ref)
        assignments,bound=_projection(candidate.result.descriptive_values,binding.assignment_path)
        if not bound or assignments!=candidate.assignments:
            missing.append('composition.exact_native_assignment_projection:'+candidate.candidate_ref)
        if binding.resource_path is None:
            if candidate.resource_provenance:missing.append('composition.unbound_resource_provenance:'+candidate.candidate_ref)
        else:
            resources,bound=_projection(candidate.result.descriptive_values,binding.resource_path)
            if not bound or resources!=candidate.resource_provenance:
                missing.append('composition.exact_native_resource_projection:'+candidate.candidate_ref)
    if required-covered:missing.extend('composition.unreturned_required_family:'+ref for ref in sorted(required-covered))
    refs=tuple(sorted(set(missing)))
    return FrontierCompositionFactsD(request=request,missing_refs=refs,
        facts=FrozenMap({'composition_bound':not refs,'required_operations_covered':not bool(required-covered),
            'retained_model_response_coverage_unchanged':True,'internal_successor_launches_route_search':False}))


def finish_frontier_composition_d(value: FrontierCompositionFinishInputD) -> FrontierCompositionReturnD:
    measured,joined=value.measured,value.joined
    missing=list(measured.missing_refs)
    if joined is not None:
        if joined.request!=measured.request.join_request or len(joined.candidates)>3:
            missing.append('composition.exact_bounded_collector_return')
            joined=None
        elif not joined.computation_complete:missing.append('composition.retained_collector_frontier')
    elif not missing:missing.append('composition.drm_requested_domain_not_admitted')
    why=measured.request.why
    return FrontierCompositionReturnD(request=measured.request,joined=joined,missing_refs=tuple(sorted(set(missing))),
        parent_why=why,next_item_ref=why.next_item_ref,source_disposition_ref=value.source_disposition_ref)
