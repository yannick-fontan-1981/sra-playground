"""All finite compatible integer quantities with exact rounded display/flows."""
from agents.yf_arc3_v5.logos.types import FrozenMap


def _display(model,quantity):
    numerator=model.render_extent*min(model.capacity,max(0,quantity))
    whole,remainder=divmod(numerator,model.capacity)
    if model.rounding_ref=='CEIL':whole+=bool(remainder)
    elif model.rounding_ref=='NEAREST_EVEN':
        whole+=2*remainder>model.capacity or (2*remainder==model.capacity and whole%2==1)
    return whole*model.display_multiplier


def _image(model,quantity,sample):
    def clip(value):
        if model.transition_ref=='EXACT_DELTA':return value
        value=max(0,value)
        return min(model.capacity,value) if model.transition_ref=='CLAMP_ZERO_AND_CAPACITY' else value
    if sample.transition_order_ref=='DEBIT_THEN_CREDIT':
        return clip(clip(quantity-sample.known_gross_debit)+sample.known_receipt_credit)
    return clip(clip(quantity+sample.known_receipt_credit)-sample.known_gross_debit)


def _runs(values):
    result=[]
    for value in sorted(values):
        if result and result[-1][1]+1==value:result[-1]=(result[-1][0],value)
        else:result.append((value,value))
    return tuple(result)


def refine_resource_integer_intervals_d(ledger,expected_scope_ref,observed_current_display,display_is_extent_units=False):
    work=0;rows=[];missing=[]
    def charge(count=1):
        nonlocal work
        if work+count>ledger.maximum_evaluations:raise OverflowError()
        work+=count
    try:
        if (ledger.evidence_scope_ref!=expected_scope_ref
                or any(row.evidence_scope_ref!=expected_scope_ref for row in (*ledger.models,*ledger.samples))):
            return (),('resource.current_calibration_and_receipt_scope',),work
        if (len({m.model_ref for m in ledger.models})!=len(ledger.models)
                or len({s.sample_ref for s in ledger.samples})!=len(ledger.samples)):
            return (),('resource.distinct_model_and_ordered_sample_identity',),work
        first=ledger.samples[0]
        if first.known_gross_debit or first.known_receipt_credit:
            return (),('resource.initial_sample_not_an_unbound_incoming_transaction',),work
        for model in ledger.models:
            if model.quantity_maximum<model.quantity_minimum:
                return (),('resource.explicit_complete_integer_domain',),work
            if model.display_measure_ref!='AREA' and model.display_multiplier!=1:
                return (),('resource.exact_width_or_segment_units',),work
            if model.display_measure_ref=='AREA':
                actual=observed_current_display*model.display_multiplier if display_is_extent_units else observed_current_display
                if actual!=ledger.samples[-1].observed_display:
                    return (),('resource.actual_current_area_not_width_alias',),work
            elif observed_current_display!=ledger.samples[-1].observed_display:
                return (),('resource.actual_current_display_measurement',),work
            domains=[]
            for sample in ledger.samples:
                current=set()
                for quantity in range(model.quantity_minimum,model.quantity_maximum+1):
                    charge()
                    if _display(model,quantity)==sample.observed_display:current.add(quantity)
                domains.append(current)
            # Forward reachable images and backward predecessor consistency
            # retain every compatible quantity, not a selected midpoint.
            links=[]
            for index,sample in enumerate(ledger.samples[1:],1):
                edges=[];reachable=set()
                for before in sorted(domains[index-1]):
                    charge()
                    after=_image(model,before,sample)
                    if after in domains[index]:edges.append((before,after));reachable.add(after)
                domains[index]=reachable
                links.append(tuple(edges))
            for index in range(len(links)-1,-1,-1):
                predecessors=set()
                for before,after in links[index]:
                    charge()
                    if after in domains[index+1]:predecessors.add(before)
                domains[index]=predecessors
            snapshots=[]
            for index,sample in enumerate(ledger.samples):
                charge(len(domains[index]))
                snapshots.append(FrozenMap({'sample_ref':sample.sample_ref,'compatible_quantity_runs':_runs(domains[index]),
                    'gross_input_count':sample.gross_input_count,'internal_event_count':sample.internal_event_count,
                    'known_gross_debit':sample.known_gross_debit,'known_receipt_credit':sample.known_receipt_credit,
                    'observed_display':sample.observed_display,'display_measure_ref':model.display_measure_ref}))
            rows.append(FrozenMap({'model_ref':model.model_ref,'model_compatible':bool(domains[-1]),
                'quantity_runs_by_sample':tuple(snapshots),'current_quantity_runs':_runs(domains[-1]),
                'calibration_evidence_refs':model.calibration_evidence_refs,
                'quantity_is_remaining_actions':False,'model_selected':False}))
        return tuple(rows),tuple(missing),work
    except OverflowError:
        return (),('resource.complete_integer_domain_and_reconciliation_bound',),work


def measure_resource_integer_intervals_d(request):
    from .resource_interval_contracts_d import ResourceIntervalResultD
    rows,missing,work=refine_resource_integer_intervals_d(request.ledger,
        request.expected_scope_ref,request.observed_current_display)
    return ResourceIntervalResultD(request=request,rows=rows,missing_refs=missing,
        accounted_evaluations=work)
