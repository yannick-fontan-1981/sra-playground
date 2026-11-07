"""Identity-preserving stored/exposure modes and simultaneous protected contacts."""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result


class PhotoBodyD(FrozenModel):
    body_ref: Ref
    intrinsic_type_ref: Ref
    mode_ref: Ref
    stored_mode_ref: Ref
    persistence: Literal['STORED','EXPOSURE_MAINTAINED']
    exposed_mode_ref: Ref
    unexposed_mode_ref: Ref


class PhotoContactD(FrozenModel):
    left_ref: Ref
    right_ref: Ref
    contact_evidence_ref: Ref


class PhotoPairRuleD(FrozenModel):
    rule_ref: Ref
    left_mode_ref: Ref
    right_mode_ref: Ref
    left_new_mode_ref: Ref
    right_new_mode_ref: Ref
    protect_same_command_refresh: bool
    event_ref: Ref


class ProtectedPhotoWriteD(FrozenModel):
    body_ref: Ref
    command_ref: Ref
    phase_event_ref: Ref
    cause_ref: Ref
    protected_mode_ref: Ref
    write_revision: int = Field(ge=0)


class StatefulPhotoContactRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.stateful_photo_contact_request_d.v1'
    phase_ref: Literal['INTERNAL_EXPOSURE_CONTACT_REFRESH']
    bodies: tuple[PhotoBodyD,...] = Field(min_length=1,max_length=4096)
    exposure_values: tuple[tuple[Ref,bool|None],...] = Field(min_length=1,max_length=4096)
    contacts: tuple[PhotoContactD,...] = Field(default=(),max_length=4096)
    pair_rules: tuple[PhotoPairRuleD,...] = Field(default=(),max_length=4096)
    supported_phase_orders: tuple[tuple[Literal['EXPOSURE','CONTACT'],Literal['EXPOSURE','CONTACT']],...] = Field(min_length=1,max_length=2)
    protected_writes: tuple[ProtectedPhotoWriteD,...] = Field(default=(),max_length=4096)
    command_ref: Ref
    phase_event_ref: Ref
    read_revision: int = Field(ge=0)
    write_revision: int = Field(ge=0)
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = (
        ('mechanics.local_field_type_production.stateful_photo_contact','STEP_INTERNAL'),
    )

    @model_validator(mode='after')
    def identities(self):
        ids={b.body_ref for b in self.bodies}
        if len(ids)!=len(self.bodies) or set(dict(self.exposure_values))!=ids or len(dict(self.exposure_values))!=len(self.exposure_values):
            raise ValueError('exposure must bind every persistent body once')
        if any(c.left_ref not in ids or c.right_ref not in ids or c.left_ref==c.right_ref for c in self.contacts):
            raise ValueError('contact graph has unknown body identities')
        if any(set(order)!={'EXPOSURE','CONTACT'} for order in self.supported_phase_orders):
            raise ValueError('precedence alternatives must explicitly cover both refresh phases')
        return self


def _refresh_photo_contact(request,budget):
    exposure=dict(request.exposure_values)
    alternatives=[]
    for order in request.supported_phase_orders:
        bodies={b.body_ref:b for b in request.bodies}
        protections=list(request.protected_writes)
        causes=[]
        conflicts=[]
        revision=request.write_revision
        for phase in order:
            if phase=='EXPOSURE':
                for ref in sorted(bodies):
                    budget.visit({'stage':'persistence_scoped_exposure','body_ref':ref})
                    body=bodies[ref]
                    protected=next((p for p in reversed(protections) if p.body_ref==ref and p.command_ref==request.command_ref),None)
                    if protected is not None:
                        bodies[ref]=body.model_copy(update={'mode_ref':protected.protected_mode_ref})
                        causes.append({'body_ref':ref,'kind':'PROTECTED_CONTACT_WRITE_RETAINED','cause_ref':protected.cause_ref})
                        continue
                    value=exposure[ref]
                    if value is None:
                        conflicts.append({'body_ref':ref,'cause':'EXPOSURE_UNMEASURED'});continue
                    mode=(body.exposed_mode_ref if value else body.stored_mode_ref) if body.persistence=='STORED' else (
                        body.exposed_mode_ref if value else body.unexposed_mode_ref)
                    stored=mode if body.persistence=='STORED' else body.stored_mode_ref
                    if mode!=body.mode_ref or stored!=body.stored_mode_ref:
                        revision+=1
                        bodies[ref]=body.model_copy(update={'mode_ref':mode,'stored_mode_ref':stored})
                        causes.append({'body_ref':ref,'kind':'STORED_EXPOSURE_CONVERSION' if body.persistence=='STORED' else
                            'EXPOSURE_MAINTAINED_MODE','exposed':value,'write_revision':revision})
            else:
                snapshot=dict(bodies)
                proposed={}
                for contact in request.contacts:
                    for rule in request.pair_rules:
                        budget.visit({'stage':'simultaneous_pair_snapshot','rule_ref':rule.rule_ref})
                        if (snapshot[contact.left_ref].mode_ref,snapshot[contact.right_ref].mode_ref)!=(rule.left_mode_ref,rule.right_mode_ref):continue
                        for ref,mode in ((contact.left_ref,rule.left_new_mode_ref),(contact.right_ref,rule.right_new_mode_ref)):
                            proposed.setdefault(ref,[]).append((mode,rule,contact.contact_evidence_ref))
                for ref in sorted(proposed):
                    values=proposed[ref]
                    modes={mode for mode,_rule,_evidence in values}
                    if len(modes)>1:
                        conflicts.append({'body_ref':ref,'cause':'SIMULTANEOUS_PAIR_WRITE_PRECEDENCE_UNRESOLVED','mode_refs':tuple(sorted(modes))})
                        continue
                    mode=values[0][0]
                    body=bodies[ref]
                    revision+=1
                    bodies[ref]=body.model_copy(update={'mode_ref':mode,
                        'stored_mode_ref':mode if body.persistence=='STORED' else body.stored_mode_ref})
                    for _mode,rule,evidence in values:
                        causes.append({'body_ref':ref,'kind':'SIMULTANEOUS_CONTACT_REWRITE','cause_ref':rule.event_ref,
                            'contact_evidence_ref':evidence,'write_revision':revision})
                        if rule.protect_same_command_refresh:
                            protections.append(ProtectedPhotoWriteD(body_ref=ref,command_ref=request.command_ref,phase_event_ref=request.phase_event_ref,
                                cause_ref=rule.event_ref,protected_mode_ref=mode,write_revision=revision))
        alternatives.append({'phase_order':order,'bodies':tuple(bodies[b.body_ref] for b in request.bodies),
            'protected_write_ledger':tuple(protections),'mode_causes':tuple(causes),'unresolved_writes':tuple(conflicts),
            'read_revision':request.read_revision,'write_revision':revision})
    return alternatives


def measure_stateful_photo_contact_d(request: StatefulPhotoContactRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    if max(len(request.bodies),len(request.contacts),len(request.pair_rules),len(request.protected_writes))>request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    if request.resume_frontier:return d_result(request,'NEEDS_EVIDENCE','RESTART_PURE_MODE_REFRESH_FROM_BOUND_SNAPSHOT')
    budget=DWorkBudget(request)
    try:
        alternatives=_refresh_photo_contact(request,budget)
        unknown=any(a['unresolved_writes'] for a in alternatives)
        budget.finish()
        return d_result(request,'NEEDS_EVIDENCE' if unknown else 'COMPLETE','UNRESOLVED_EXPOSURE_OR_PAIR_WRITE' if unknown else 'PERSISTENCE_SCOPED_MODE_RESULT',
            complete=not unknown,examined=budget.examined,values={'mode_alternative_successors':tuple(alternatives),
                'intrinsic_type_changed_from_current_color':False,'new_external_input':0,'new_external_debit':0})
    except DComputationInterrupted as error:
        return d_result(request,'NEEDS_EVIDENCE',error.cause,examined=budget.examined,
            frontier={'restart_pure_mode_refresh':True,'read_revision':request.read_revision,'write_revision':request.write_revision,'work':error.frontier})
