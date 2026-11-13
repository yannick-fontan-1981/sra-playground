"""Pure bounded typed resource algebra; restore-before-contact is explicit."""
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data
from .resource_transaction_contracts_d import ResourceTransactionResultD


class ResourceNeedD(Exception):
    pass


def measure_resource_transaction_d(request):
    from .articulated_dependency_measurement_c import _nodes
    work=0;rows=[];state=request.initial
    def charge(count=1):
        nonlocal work
        if work+count>request.maximum_evaluations:raise ResourceNeedD('resource.complete_transaction_bound')
        work+=count
    def verify(value):
        if (len({q.quantity_ref for q in value.quantities})!=len(value.quantities)
                or any(len(set(refs))!=len(refs) for refs in (value.used_refill_refs,value.acquired_target_refs,value.satisfied_demand_refs))):
            raise ResourceNeedD('resource.distinct_typed_quantity_and_receipt_identities')
        for q in value.quantities:
            charge()
            if (not 0<=q.amount<=65536 or not 0<=q.reserved<=65536
                    or q.kind_ref!='RESERVED_CAPACITY' and q.reserved
                    or q.maximum is not None and q.amount+q.reserved>q.maximum):
                raise ResourceNeedD('resource.typed_reservation_and_declared_capacity')
        if any(len(refs)>4096 for refs in (value.used_refill_refs,value.acquired_target_refs,value.satisfied_demand_refs)):
            raise ResourceNeedD('resource.complete_persistent_receipt_bound')
    def replace_quantities(value,quantities):
        result=value.model_copy(update={'quantities':tuple(quantities[key] for key in sorted(quantities))})
        verify(result);return result
    try:
        size=_nodes(immutable_json_data(request),request.maximum_evaluations)
        if size is None:raise ResourceNeedD('resource.complete_input_projection_bound')
        charge(size)
        verify(state)
        laws={law.law_ref:law for law in request.laws}
        if len(laws)!=len(request.laws) or any(law.evidence_scope_ref!=request.evidence_scope_ref for law in request.laws):
            raise ResourceNeedD('resource.exact_current_operation_law_scope')
        policy=request.partial_life
        if policy is not None and policy.evidence_scope_ref!=request.evidence_scope_ref:
            raise ResourceNeedD('resource.current_partial_life_restore_law')
        seen=set()
        for primitive in request.primitives:
            if state.failed:break
            charge()
            if primitive.primitive_ref in seen:raise ResourceNeedD('resource.distinct_primitive_occurrence')
            seen.add(primitive.primitive_ref)
            before=state
            current=state.model_copy(update={'pose':primitive.pose_after_direct,'symbol':primitive.symbol_after_direct})
            quantities={q.quantity_ref:q for q in current.quantities};events=[]
            for operation in primitive.operations:
                charge()
                if operation.event_ref in seen or operation.law_ref not in laws:
                    raise ResourceNeedD('resource.owned_event_and_supported_operation')
                seen.add(operation.event_ref)
                law=laws[operation.law_ref];q=quantities.get(law.quantity_ref)
                if q is None or q.kind_ref!=law.kind_ref:raise ResourceNeedD('resource.exact_typed_operand')
                amount,reserved=q.amount,q.reserved
                allowed=(law.operation_ref in ('CONSUME','PRODUCE') if q.kind_ref=='STOCK' else
                    law.operation_ref in ('RESERVE','RELEASE') if q.kind_ref=='RESERVED_CAPACITY' else
                    law.operation_ref=='CONSUME' if q.kind_ref=='LIFE' else
                    law.operation_ref=='MARK_SATISFIED' if q.kind_ref=='SATISFIED_DEMAND' else law.operation_ref=='INCREMENT')
                if not allowed:raise ResourceNeedD('resource.operation_cannot_change_quantity_nature')
                if law.operation_ref in ('CONSUME','RESERVE'):
                    if operation.units>amount and (law.insufficient_ref=='REFUSE' or law.operation_ref=='RESERVE'):
                        raise ResourceNeedD('resource.current_funding_or_capacity_precondition')
                    amount=max(0,amount-operation.units)
                    if law.operation_ref=='RESERVE':reserved+=operation.units
                elif law.operation_ref=='RELEASE':
                    if operation.units>reserved:raise ResourceNeedD('resource.actual_reserved_capacity')
                    reserved-=operation.units;amount+=operation.units
                elif law.operation_ref=='MARK_SATISFIED':
                    if operation.demand_ref is None or operation.units!=1:raise ResourceNeedD('resource.bound_single_satisfied_demand')
                    if operation.demand_ref not in current.satisfied_demand_refs:
                        current=current.model_copy(update={'satisfied_demand_refs':(*current.satisfied_demand_refs,operation.demand_ref)})
                        amount+=1
                else:amount+=operation.units
                quantities[q.quantity_ref]=q.model_copy(update={'amount':amount,'reserved':reserved})
                events.append(FrozenMap({'event_ref':operation.event_ref,'quantity_ref':q.quantity_ref,'kind_ref':q.kind_ref,
                    'operation_ref':law.operation_ref,'gross_units':operation.units,'net_amount_delta':amount-q.amount,
                    'reserved_delta':reserved-q.reserved}))
            current=replace_quantities(current,quantities)
            restored=False;life_debited=False
            if policy is not None:
                depleted=quantities.get(policy.depleted_quantity_ref);life=quantities.get(policy.life_quantity_ref)
                if depleted is None or life is None or depleted.kind_ref!='STOCK' or life.kind_ref!='LIFE':
                    raise ResourceNeedD('resource.separate_depleted_stock_and_life')
                if depleted.amount==0:
                    if life.amount<policy.life_debit:current=current.model_copy(update={'failed':True})
                    else:
                        life=life.model_copy(update={'amount':life.amount-policy.life_debit});quantities[life.quantity_ref]=life
                        life_debited=True
                        if policy.final_when_life_zero and life.amount==0:current=replace_quantities(current,quantities).model_copy(update={'failed':True})
                        else:
                            quantities[depleted.quantity_ref]=depleted.model_copy(update={'amount':policy.replenished_amount})
                            current=replace_quantities(current,quantities).model_copy(update={'pose':policy.restored_pose,'symbol':policy.restored_symbol})
                            restored=True
            after_depletion=current
            if not current.failed:
                for contact in primitive.contacts_after_depletion:
                    charge(len(current.used_refill_refs)+len(current.acquired_target_refs)+1)
                    if contact.contact_ref in seen:raise ResourceNeedD('resource.distinct_owned_contact_occurrence')
                    seen.add(contact.contact_ref)
                    if (contact.evidence_scope_ref!=request.evidence_scope_ref or contact.expected_pose!=current.pose
                            or contact.expected_symbol!=current.symbol):
                        raise ResourceNeedD('resource.contact_binding_after_actual_partial_restore')
                    if contact.refill_ref is not None and contact.refill_ref not in current.used_refill_refs:
                        if contact.refill_quantity_ref not in quantities or contact.refill_amount is None or contact.refill_mode_ref is None:
                            raise ResourceNeedD('resource.current_refill_identity_amount_and_mode')
                        q=quantities[contact.refill_quantity_ref]
                        if q.kind_ref!='STOCK':raise ResourceNeedD('resource.refill_not_capacity_or_progress_production')
                        amount=q.amount+contact.refill_amount if contact.refill_mode_ref=='ADD' else contact.refill_amount
                        quantities[q.quantity_ref]=q.model_copy(update={'amount':amount})
                        current=replace_quantities(current,quantities).model_copy(update={'used_refill_refs':(*current.used_refill_refs,contact.refill_ref)})
                    if contact.acquired_target_ref is not None and contact.acquired_target_ref not in current.acquired_target_refs:
                        current=current.model_copy(update={'acquired_target_refs':(*current.acquired_target_refs,contact.acquired_target_ref)})
            verify(current)
            rows.append(FrozenMap({'primitive_ref':primitive.primitive_ref,'before_state':immutable_json_data(before),
                'after_depletion_before_contacts':immutable_json_data(after_depletion),'predicted_after_state':immutable_json_data(current),
                'typed_events':tuple(events),'life_debited':life_debited,'partial_pose_symbol_restore':restored,
                'used_refills_and_acquired_targets_not_reset':True,'external_primitive_count':1,'physical_execution_performed':False}))
            state=current
        return ResourceTransactionResultD(request=request,predicted_state=state,rows=tuple(rows),missing_refs=(),accounted_evaluations=work)
    except ResourceNeedD as error:
        return ResourceTransactionResultD(request=request,predicted_state=state,rows=tuple(rows),missing_refs=(str(error),),accounted_evaluations=work)
