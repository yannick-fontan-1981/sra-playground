"""Capture supplied-law phase states at their mutation, never from an endpoint."""
from agents.yf_arc3_v5.logos.types import FrozenMap,stable_digest


class MechanicalLedgerB:
    def __init__(self,request):
        self.request=request
        self.before=FrozenMap(request.state)
        self.current=self.before
        self.events=[]
        self.snapshots={}
        self.missing=[]
        self.identity=stable_digest(request)
        for field in ('event_clock_ref','temporal_scope_ref','closure_domain_ref'):
            if not request.data.get(field):self.missing.append('data.'+field)
        if request.model_ref is None:self.missing.append('request.model_ref')

    def record(self,after,kind_ref,read_fields=(),predicate_values=None,interruption_ref=None):
        before=self.current;after=FrozenMap(after)
        index=len(self.events)
        if index>=4096:
            if 'ledger.event_capacity' not in self.missing:self.missing.append('ledger.event_capacity')
            self.current=after
            return
        token=stable_digest((self.identity,index))
        snapshot_ref='mechanical.snapshot.'+token
        occurrence_ref='mechanical.event.'+token
        writes=FrozenMap({field:after[field] for field in sorted(after)
                         if field not in before or before[field]!=after[field]})
        deletes=tuple(field for field in sorted(before) if field not in after)
        self.snapshots[snapshot_ref]=before
        self.events.append(FrozenMap({
            'occurrence_ref':occurrence_ref,'producer_ref':self.request.event_owner_ref,
            'kind_ref':kind_ref,
            # A missing caller clock is explicitly debt. This fallback names
            # bookkeeping order only and cannot complete a C packet.
            'clock_ref':self.request.data.get('event_clock_ref') or 'unbound.phase_order.'+self.request.request_ref,
            'tick':index,'temporal_scope_ref':self.request.data.get('temporal_scope_ref') or self.request.input_revision_ref,
            'snapshot_ref':snapshot_ref,'snapshot_kind':'PRE_COMMAND' if index==0 else 'ACTOR_TURN',
            'reads':FrozenMap({field:before[field] for field in sorted(set(read_fields)) if field in before}),
            'writes':writes,'deleted_state_refs':deletes,
            'costs':FrozenMap({'external_primitive':1}) if index==0 else FrozenMap(),
            'predecessor_refs':(self.events[-1]['occurrence_ref'],) if self.events else (),
            'predicate_values':FrozenMap(predicate_values or {}),'interruption_ref':interruption_ref}))
        self.current=after

    def values(self,complete,closure_stop_ref):
        return FrozenMap({'mechanical_events':tuple(self.events),'mechanical_snapshots':FrozenMap(self.snapshots),
            'mechanical_before':self.before,'mechanical_after':self.current,
            'mechanical_closure_domain_ref':self.request.data.get('closure_domain_ref'),
            'mechanical_closure_stop_ref':closure_stop_ref,
            'mechanical_closure_complete':complete and not self.missing,
            'mechanical_missing_refs':tuple(self.missing)})
