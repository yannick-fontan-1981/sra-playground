"""Exact joint occurrence/time/capacity joins over caller-grounded service packets."""
from __future__ import annotations
from collections import deque
from itertools import product
from typing import ClassVar,Literal
from pydantic import Field,model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel,Ref
from .mechanical_family_contracts_d import DMechanicalRequest,DWorkBudget,DComputationInterrupted,d_validate_request,d_result


ScalarD=int|str|bool


class ServiceConditionD(FrozenModel):
    condition_ref: Ref
    variable_ref: Ref
    comparator: Literal['EQ','NE','GE','LE']
    expected: ScalarD


class ServicePrimitivePacketD(FrozenModel):
    packet_ref: Ref
    input_ref: Ref
    operator_ref: Ref
    amplitude: int
    context_ref: Ref
    epoch: int=Field(ge=0)
    model_revision_ref: Ref
    complete: bool
    accepted: bool|None
    before_values: tuple[tuple[Ref,ScalarD],...]
    after_values: tuple[tuple[Ref,ScalarD],...]
    command_cost: int=Field(ge=0)
    physical_transformations: int=Field(ge=0)
    information_question_refs: tuple[Ref,...]
    acquired_information_receipt_refs: tuple[Ref,...]
    information_receipt_bindings: tuple[tuple[Ref,Ref],...]=Field(default=(),max_length=128)
    world_ticks: int=Field(ge=0)
    mechanical_margin: int
    resource_margin: int
    wrap_travel_units: int=Field(ge=0)
    provider_ref: Ref
    affected_consumer_refs: tuple[Ref,...]


class ServiceOccurrenceD(FrozenModel):
    occurrence_ref: Ref
    owner_ref: Ref
    receiver_ref: Ref
    amount: int=Field(ge=1)
    birth_tick: int=Field(ge=0)
    expiry_tick: int|None=Field(default=None,ge=0)
    consumed_tick: int|None=Field(default=None,ge=0)
    may_share: bool
    sharing_evidence_ref: Ref|None


class ServiceChoiceD(FrozenModel):
    option_ref: Ref
    service_ref: Ref
    provider_ref: Ref
    beneficiary_ref: Ref
    terminal_contributor_ref: Ref|None
    target_ref: Ref|None
    controlled_ref: Ref|None
    word: tuple[ServicePrimitivePacketD,...]=Field(default=(),max_length=4096)
    used_occurrence_refs: tuple[Ref,...]=Field(default=(),max_length=128)
    required_quantity: int=Field(ge=0)
    receiver_capacity: int=Field(ge=0)
    service_tick: int=Field(ge=0)
    allowed_service_window: tuple[int,int]
    receiver_ref: Ref
    consumer_mode_ref: Ref
    admitted_consumer_modes: tuple[Ref,...]
    consumer_position_ref: Ref
    supply_position_ref: Ref
    passage_edges: tuple[tuple[Ref,Ref],...]=Field(default=(),max_length=4096)
    access_command_cost: int=Field(ge=0)
    access_resource_reserve: int
    obligations: tuple[ServiceConditionD,...]=Field(default=(),max_length=128)
    fulfillment_evidence_ref: Ref|None
    pending_later_consumer_refs: tuple[Ref,...]=Field(default=(),max_length=128)
    reversible_storage: bool
    required_restore_refs: tuple[Ref,...]=Field(default=(),max_length=128)


class ServiceDemandD(FrozenModel):
    demand_ref: Ref
    required: bool
    options: tuple[ServiceChoiceD,...]=Field(min_length=1,max_length=128)
    predecessor_demand_refs: tuple[Ref,...]=Field(default=(),max_length=128)


class AmplitudeCaseD(FrozenModel):
    operator_ref: Ref
    context_ref: Ref
    attempted_amplitude: int
    full_packet_ref: Ref
    legal_prefix_packet_refs: tuple[Ref,...]
    later_condition: ServiceConditionD


class GuideAuthorityEvidenceD(FrozenModel):
    guide_ref: Ref
    destination_ref: Ref
    independent_acceptance_requirement_ref: Ref|None
    acceptance_evidence_ref: Ref|None


class ServiceCompositionBaseD(DMechanicalRequest):
    phase_ref: Literal['JOINT_CURRENT_CONSUMER_SERVICE_AUDIT']
    current_values: tuple[tuple[Ref,ScalarD],...]=Field(default=(),max_length=4096)
    demands: tuple[ServiceDemandD,...]=Field(default=(),max_length=128)
    stock: tuple[ServiceOccurrenceD,...]=Field(default=(),max_length=4096)
    current_controlled_ref: Ref|None
    joint_goal_conditions: tuple[ServiceConditionD,...]=Field(default=(),max_length=128)
    authorized_information_question_refs: tuple[Ref,...]=Field(default=(),max_length=128)
    amplitude_cases: tuple[AmplitudeCaseD,...]=Field(default=(),max_length=128)
    additional_packets: tuple[ServicePrimitivePacketD,...]=Field(default=(),max_length=128)
    guide_evidence: tuple[GuideAuthorityEvidenceD,...]=Field(default=(),max_length=128)
    claimed_lower_command_bound: int|None=Field(default=None,ge=0)
    lower_bound_evidence_ref: Ref|None
    lower_bound_admissible: bool
    lower_bound_epoch: int|None=Field(default=None,ge=0)
    lower_bound_model_revision_ref: Ref|None
    complete_assignment_domain: bool
    native_option_order: tuple[Ref,...]=Field(default=(),max_length=4096)

    @model_validator(mode='after')
    def finite_identity_domains(self):
        demand_ids={d.demand_ref for d in self.demands}
        if len(demand_ids)!=len(self.demands) or len(dict(self.current_values))!=len(self.current_values) or len({o.occurrence_ref for o in self.stock})!=len(self.stock):
            raise ValueError('current variable/demand/occurrence identity duplicated')
        if any(not set(d.predecessor_demand_refs)<=demand_ids for d in self.demands):
            raise ValueError('service predecessor outside current conjunction')
        if len({o.option_ref for d in self.demands for o in d.options})!=sum(len(d.options) for d in self.demands):
            raise ValueError('service option occurrence binding duplicated')
        options={o.option_ref for d in self.demands for o in d.options}
        if set(self.native_option_order)!=options or len(self.native_option_order)!=len(options):
            raise ValueError('joint native service order must be explicitly grounded, never inferred from identifier spelling')
        if any(len(set(o.used_occurrence_refs))!=len(o.used_occurrence_refs) for d in self.demands for o in d.options):
            raise ValueError('one option cannot count the same inventory occurrence twice')
        return self


class ProviderBeneficiaryPartitionRequestD(ServiceCompositionBaseD):
    schema_version: Ref='yf_arc3_v5.provider_beneficiary_partition_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.contribution.provider_beneficiary_control_partition','AUDIT'),)


class RequiredAlternativeServicesRequestD(ServiceCompositionBaseD):
    schema_version: Ref='yf_arc3_v5.required_alternative_services_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.constraints.required_and_alternative_services','AUDIT'),)


class NonmonotoneFullStateRequestD(ServiceCompositionBaseD):
    schema_version: Ref='yf_arc3_v5.nonmonotone_full_state_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.contribution.nonmonotone_full_state','AUDIT'),)


class AmplitudePrerequisiteRequestD(ServiceCompositionBaseD):
    schema_version: Ref='yf_arc3_v5.amplitude_prerequisite_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.constraints.amplitude_dependent_prerequisite','AUDIT'),)


class ConsumerReachabilityRequestD(ServiceCompositionBaseD):
    schema_version: Ref='yf_arc3_v5.consumer_reachability_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.constraints.consumer_reachability','AUDIT'),)


class GoalReassignmentRequestD(ServiceCompositionBaseD):
    schema_version: Ref='yf_arc3_v5.goal_reassignment_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.constraints.goal_reassignment','AUDIT'),)


class GuideAuthorityRequestD(ServiceCompositionBaseD):
    schema_version: Ref='yf_arc3_v5.guide_authority_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.relative_pattern.guide_authority','AUDIT'),)


class AssignmentCompositionRequestD(ServiceCompositionBaseD):
    schema_version: Ref='yf_arc3_v5.assignment_composition_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.relative_pattern.assignment_composition','AUDIT'),)


class ParallelEffectsRequestD(ServiceCompositionBaseD):
    schema_version: Ref='yf_arc3_v5.parallel_effects_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.constraints.parallel_effects','AUDIT'),)


class CostMarginTradeoffRequestD(ServiceCompositionBaseD):
    schema_version: Ref='yf_arc3_v5.cost_margin_tradeoff_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.constraints.cost_margin_tradeoff','AUDIT'),)


class UnfinishedProviderServiceRequestD(ServiceCompositionBaseD):
    schema_version: Ref='yf_arc3_v5.unfinished_provider_service_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.transport_service_chain.unfinished_provider_service','AUDIT'),)


def _service_condition(condition,variables):
    if condition.variable_ref not in variables:return None
    value=variables[condition.variable_ref]
    expected=condition.expected
    if condition.comparator=='EQ':return type(value) is type(expected) and value==expected
    if condition.comparator=='NE':return type(value) is not type(expected) or value!=expected
    if type(value) is not int or type(expected) is not int:return None
    return value>=expected if condition.comparator=='GE' else value<=expected


def _service_access(option,budget,depth_bound):
    parents={option.consumer_position_ref:None}
    depth={option.consumer_position_ref:0}
    queue=deque(parents)
    adjacency={}
    for a,b in option.passage_edges:adjacency.setdefault(a,[]).append(b)
    while queue:
        ref=queue.popleft();budget.visit({'stage':'consumer_actual_access','option_ref':option.option_ref,'node_ref':ref})
        if ref==option.supply_position_ref:return True
        if depth[ref]>=depth_bound:
            if adjacency.get(ref):raise DComputationInterrupted('CONSUMER_ACCESS_DEPTH_BOUND',{})
            continue
        for peer in sorted(adjacency.get(ref,())):
            if peer not in parents:parents[peer]=ref;depth[peer]=depth[ref]+1;queue.append(peer)
    return False


def _service_word(current,word,request,budget):
    variables=dict(current)
    trace=[]
    cost,ticks,transformations,wrap=0,0,0,0
    margins,resource_margins,questions=[],[],set()
    for rank,packet in enumerate(word):
        budget.visit({'stage':'whole_state_packet_join','packet_ref':packet.packet_ref,'rank':rank})
        if packet.epoch!=request.scope.epoch or packet.model_revision_ref!=request.scope.model_revision_ref or not packet.complete or packet.accepted is None:
            return None,'INCOMPLETE_OR_FOREIGN_PACKET'
        if not packet.accepted:return None,'REFUSED_PACKET'
        if len(dict(packet.before_values))!=len(packet.before_values) or len(dict(packet.after_values))!=len(packet.after_values):
            return None,'DUPLICATED_NATIVE_VARIABLE'
        if any(ref not in variables or type(variables[ref]) is not type(value) or variables[ref]!=value for ref,value in packet.before_values):
            return None,'SHARED_FULL_STATE_PRECONDITION_CONFLICT'
        changes=tuple(ref for ref,value in packet.after_values if ref not in variables or type(variables[ref]) is not type(value) or variables[ref]!=value)
        for ref,value in packet.after_values:variables[ref]=value
        cost+=packet.command_cost;ticks+=packet.world_ticks;transformations+=packet.physical_transformations;wrap+=packet.wrap_travel_units
        questions.update(q for q,receipt in packet.information_receipt_bindings if q in request.authorized_information_question_refs and
            q in packet.information_question_refs and receipt in packet.acquired_information_receipt_refs)
        margins.append(packet.mechanical_margin);resource_margins.append(packet.resource_margin)
        trace.append({'packet_ref':packet.packet_ref,'operator_ref':packet.operator_ref,'amplitude':packet.amplitude,'context_ref':packet.context_ref,
            'changed_variable_refs':changes,'cumulative_world_ticks':ticks,'affected_consumer_refs':packet.affected_consumer_refs,
            'provider_ref':packet.provider_ref,'information_receipt_refs':packet.acquired_information_receipt_refs})
    return {'variables':variables,'trace':tuple(trace),'external_command_cost':cost,'world_ticks':ticks,
        'physical_transformations':transformations,'wrap_travel_units':wrap,'mechanical_margin':min(margins) if margins else None,
        'resource_margin':min(resource_margins) if resource_margins else None,'acquired_authorized_question_refs':tuple(sorted(questions))},None


def measure_service_composition_audit_d(request: ServiceCompositionBaseD):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    budget=DWorkBudget(request)
    try:
        if not request.demands:
            return d_result(request,'NEEDS_EVIDENCE','ACTUAL_CONSUMER_SERVICE_DEMAND_REQUIRED')
        stock={s.occurrence_ref:s for s in request.stock}
        domains=[tuple(d.options) if d.required else (None,)+tuple(d.options) for d in request.demands]
        size=1
        for domain in domains:size*=len(domain)
        if size>request.domain_bound:raise DComputationInterrupted('SERVICE_ASSIGNMENT_DOMAIN_BOUND',{'finite_cardinality':size})
        rows,witnesses=[],[]
        unknown=False
        for assignment in product(*domains):
            budget.visit({'stage':'whole_conjunction_assignment'})
            bound={d.demand_ref:o for d,o in zip(request.demands,assignment) if o is not None}
            reservations,failures={},[]
            options=[o for o in assignment if o is not None]
            for demand in request.demands:
                option=bound.get(demand.demand_ref)
                if option is None:continue
                if any(ref not in bound or bound[ref].service_tick>option.service_tick for ref in demand.predecessor_demand_refs):
                    failures.append((option.option_ref,'SERVICE_ORDER'))
            for option in options:
                budget.visit({'stage':'identity_lifetime_capacity','option_ref':option.option_ref})
                if option.fulfillment_evidence_ref is None:unknown=True;failures.append((option.option_ref,'GROUNDED_SERVICE_EVIDENCE_MISSING'))
                if not option.allowed_service_window[0]<=option.service_tick<=option.allowed_service_window[1]:failures.append((option.option_ref,'TIME_WINDOW'))
                if option.required_quantity>option.receiver_capacity:failures.append((option.option_ref,'RECEIVER_CAPACITY'))
                quantity=0
                for ref in option.used_occurrence_refs:
                    occurrence=stock.get(ref)
                    if occurrence is None:failures.append((option.option_ref,'OCCURRENCE_MISSING'));continue
                    quantity+=occurrence.amount
                    if occurrence.owner_ref!=option.provider_ref or occurrence.receiver_ref!=option.receiver_ref or occurrence.birth_tick>option.service_tick or (
                            occurrence.expiry_tick is not None and option.service_tick>occurrence.expiry_tick or
                            occurrence.consumed_tick is not None and option.service_tick>=occurrence.consumed_tick):
                        failures.append((option.option_ref,'OWNERSHIP_LIFETIME_CONSUMPTION'))
                    reservations.setdefault(ref,[]).append(option)
                if quantity<option.required_quantity:failures.append((option.option_ref,'DISTINCT_QUANTITY'))
                if option.consumer_mode_ref not in option.admitted_consumer_modes or option.access_resource_reserve<option.access_command_cost or not _service_access(option,budget,request.depth_bound):
                    failures.append((option.option_ref,'CONSUMER_ACCESS_MODE_OR_RESERVE'))
            for ref,users in sorted(reservations.items()):
                occurrence=stock[ref]
                if len(users)>1 and (not occurrence.may_share or occurrence.sharing_evidence_ref is None or
                        sum(o.required_quantity for o in users)>occurrence.amount):
                    failures.append((ref,'OCCURRENCE_REUSED_WITHOUT_JOINT_SHARING_PROOF'))
            receiver_use={}
            for option in options:receiver_use.setdefault((option.receiver_ref,option.service_tick),[]).append(option)
            for key,users in sorted(receiver_use.items()):
                capacity={o.receiver_capacity for o in users}
                if len(capacity)!=1 or sum(o.required_quantity for o in users)>min(capacity):
                    failures.append((key,'JOINT_RECEIVER_CAPACITY'))
            priority={ref:i for i,ref in enumerate(request.native_option_order)}
            word=tuple(p for option in sorted(options,key=lambda o:priority[o.option_ref]) for p in option.word)
            if len(word)>request.depth_bound:raise DComputationInterrupted('SERVICE_WORD_DEPTH_BOUND',{})
            measured,cause=_service_word(request.current_values,word,request,budget)
            if measured is None:
                failures.append(('JOINT_WORD',cause));unknown=unknown or cause=='INCOMPLETE_OR_FOREIGN_PACKET'
            else:
                for option in options:
                    for condition in option.obligations:
                        value=_service_condition(condition,measured['variables'])
                        if value is None:unknown=True
                        if value is not True:failures.append((condition.condition_ref,'OPTION_OBLIGATION'))
                for condition in request.joint_goal_conditions:
                    value=_service_condition(condition,measured['variables'])
                    if value is None:unknown=True
                    if value is not True:failures.append((condition.condition_ref,'JOINT_REMAINING_CONJUNCTION'))
            valid=not failures
            metrics={key:measured[key] for key in ('external_command_cost','world_ticks','physical_transformations','wrap_travel_units',
                'mechanical_margin','resource_margin','acquired_authorized_question_refs')} if measured is not None else {}
            rows.append({'option_refs':tuple(o.option_ref for o in options),'roles':tuple({'currently_controlled_ref':request.current_controlled_ref,
                'service_controlled_ref':o.controlled_ref,
                'provider_ref':o.provider_ref,'beneficiary_ref':o.beneficiary_ref,'terminal_contributor_ref':o.terminal_contributor_ref,
                'target_ref':o.target_ref,'pending_later_consumer_refs':o.pending_later_consumer_refs,'required_restore_refs':o.required_restore_refs} for o in options),
                'valid_joint_assignment':valid,'failures':tuple(failures),'metrics':metrics})
            if valid and len(witnesses)<3:witnesses.append({'option_refs':tuple(o.option_ref for o in options),
                'packet_word_refs':tuple(p.packet_ref for p in word),'whole_state_trace':measured['trace'],'metrics':metrics})
        packets={p.packet_ref:p for p in request.additional_packets}
        amplitude_rows=[]
        for case in request.amplitude_cases:
            full=packets.get(case.full_packet_ref)
            prefixes=[]
            for ref in case.legal_prefix_packet_refs:
                packet=packets.get(ref)
                if packet is None or (packet.operator_ref,packet.context_ref)!=(case.operator_ref,case.context_ref):unknown=True;continue
                if full is None or (full.operator_ref,full.context_ref)!=(case.operator_ref,case.context_ref) or full.accepted is None:
                    unknown=True;continue
                if full.accepted or not 0<abs(packet.amplitude)<abs(case.attempted_amplitude) or packet.amplitude*case.attempted_amplitude<=0:continue
                measured,cause=_service_word(request.current_values,(packet,),request,budget)
                if measured is not None and _service_condition(case.later_condition,measured['variables']) is True:
                    prefixes.append({'packet_ref':ref,'amplitude':packet.amplitude,'later_condition_ref':case.later_condition.condition_ref})
            amplitude_rows.append({'operator_ref':case.operator_ref,'context_ref':case.context_ref,'attempted_amplitude':case.attempted_amplitude,
                'full_packet_accepted':None if full is None else full.accepted,'legal_enabling_prefixes':tuple(prefixes)})
        guides=tuple({'guide_ref':g.guide_ref,'destination_ref':g.destination_ref,
            'independent_acceptance_requirement_ref':g.independent_acceptance_requirement_ref,
            'independent_acceptance_evidence_present':bool(g.independent_acceptance_requirement_ref and g.acceptance_evidence_ref)} for g in request.guide_evidence)
        valid_costs=[r['metrics']['external_command_cost'] for r in rows if r['valid_joint_assignment']]
        minimum_proved=bool(valid_costs and request.complete_assignment_domain and not unknown)
        bound_matches=bool(valid_costs and request.lower_bound_evidence_ref and request.lower_bound_admissible and
            request.lower_bound_epoch==request.scope.epoch and request.lower_bound_model_revision_ref==request.scope.model_revision_ref and
            request.claimed_lower_command_bound==min(valid_costs))
        budget.finish()
        return d_result(request,'NEEDS_EVIDENCE' if unknown else 'COMPLETE','EXACT_SHARED_SERVICE_CONJUNCTION',complete=not unknown,
            examined=budget.examined,values={'assignment_rows':tuple(rows),'joint_witnesses':tuple(witnesses),'amplitude_context_rows':tuple(amplitude_rows),
                'guide_authority_rows':guides,'command_minimum_in_requested_domain_proved':minimum_proved or bound_matches,
                'minimum_command_cost':min(valid_costs) if minimum_proved or bound_matches else None,'named_metric_order_chosen_by_python':False},
            descriptive_delta={'has_joint_witness':bool(witnesses),'complete_assignment_domain':request.complete_assignment_domain,
                'has_justified_nonmonotone_word':bool(witnesses) and (bool(request.joint_goal_conditions) or
                    any(o.obligations or o.pending_later_consumer_refs for d in request.demands for o in d.options) or
                    any(r['valid_joint_assignment'] and r['metrics'].get('acquired_authorized_question_refs') for r in rows)),
                'has_separately_bound_service_roles':any(o.provider_ref!=o.beneficiary_ref or o.terminal_contributor_ref!=o.provider_ref for d in request.demands for o in d.options),
                'has_grounded_enabling_prefix':any(r['legal_enabling_prefixes'] for r in amplitude_rows),
                'has_pending_provider_service':any(o.pending_later_consumer_refs for d in request.demands for o in d.options),
                'has_independent_guide_requirement':any(g['independent_acceptance_evidence_present'] for g in guides)})
    except DComputationInterrupted as error:
        return d_result(request,'BUDGET_REACHED',error.cause,examined=budget.examined,
            frontier={'restart_joint_service_domain':True,'work':error.frontier,'minimum_or_impossibility_claimed':False})
