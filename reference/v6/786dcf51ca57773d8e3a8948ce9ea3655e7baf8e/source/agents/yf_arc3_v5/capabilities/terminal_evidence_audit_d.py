"""Exact archived evidence comparisons; intent and transfer meaning remain DRM-owned."""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result


class ArchivedTerminalStateD(FrozenModel):
    snapshot_ref: Ref
    scene_ref: Ref
    epoch: int = Field(ge=0)
    checkpoint_ref: Ref
    sealed: bool
    official_won: bool | None
    predicate_atom_values: tuple[tuple[Ref,bool|None], ...]
    surviving_helper_refs: tuple[Ref,...]
    unused_occurrence_refs: tuple[Ref,...]
    empty_slot_refs: tuple[Ref,...]
    exited_target_refs: tuple[Ref,...]


class TerminalFormulaD(FrozenModel):
    predicate_ref: Ref
    required_atom_refs: tuple[Ref,...]
    quantified_object_refs: tuple[Ref,...]
    quantified_target_refs: tuple[Ref,...]
    all_objects_clause: bool
    all_targets_clause: bool
    object_atom_refs: tuple[tuple[Ref,Ref], ...]
    target_atom_refs: tuple[tuple[Ref,Ref], ...]
    required_empty_slot_refs: tuple[Ref,...]


class ArchivedFacetD(FrozenModel):
    facet_ref: Ref
    snapshot_ref: Ref
    epoch: int = Field(ge=0)
    decision_relevant: bool
    processing_evidence_ref: Ref|None
    interpretation_ref: Ref|None
    explicitly_unresolved: bool


class ActionConsumerEvidenceD(FrozenModel):
    action_ref: Ref
    snapshot_before_ref: Ref
    rationale_before_ref: Ref|None
    intended_consumer_refs: tuple[Ref,...]
    experiment_question_refs: tuple[Ref,...]
    actual_served_consumer_refs: tuple[Ref,...]
    retrospectively_required_consumer_refs: tuple[Ref,...]
    retrospective_required_inventory_complete: bool
    sealed_effect_evidence_ref: Ref|None
    contribution_kind: Literal['PRODUCTION','CORRECTION','STORAGE','HOLD','REVEAL']


class PortableDiscoveryEvidenceD(FrozenModel):
    method_ref: Ref
    acquisition_snapshot_ref: Ref
    acquisition_evidence_ref: Ref|None
    portable_method_ref: Ref|None
    current_revalidation_required_refs: tuple[Ref,...]
    processed_facet_refs: tuple[Ref,...]
    scene_local_handle_refs: tuple[Ref,...]


class TerminalEvidenceAuditBaseD(DMechanicalRequest):
    phase_ref: Literal['ARCHIVED_TERMINAL_EVIDENCE_ONLY']
    archived_scene_ref: Ref
    archived_epoch: int = Field(ge=0)
    actual_terminal_snapshot_ref: Ref
    snapshots: tuple[ArchivedTerminalStateD,...] = Field(min_length=1,max_length=4096)
    formulas: tuple[TerminalFormulaD,...] = Field(default=(),max_length=128)
    facets: tuple[ArchivedFacetD,...] = Field(default=(),max_length=4096)
    actions: tuple[ActionConsumerEvidenceD,...] = Field(default=(),max_length=4096)
    portable_methods: tuple[PortableDiscoveryEvidenceD,...] = Field(default=(),max_length=128)
    declared_future_scene_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    actually_observed_scene_refs: tuple[Ref,...] = Field(min_length=1,max_length=128)
    evaluation_checkpoint_ref: Ref

    @model_validator(mode='after')
    def exact_old_scene(self):
        snapshots={s.snapshot_ref:s for s in self.snapshots}
        if len(snapshots)!=len(self.snapshots) or self.actual_terminal_snapshot_ref not in snapshots:
            raise ValueError('archived terminal snapshot identity unbound')
        if any(s.scene_ref!=self.archived_scene_ref or s.epoch!=self.archived_epoch for s in self.snapshots):
            raise ValueError('mixed archived scenes cannot certify one terminal predicate')
        if any(len(dict(s.predicate_atom_values))!=len(s.predicate_atom_values) for s in self.snapshots):
            raise ValueError('terminal predicate atom repeated')
        if any(f.snapshot_ref not in snapshots or f.epoch!=self.archived_epoch for f in self.facets):
            raise ValueError('facet must be grounded in its archived old snapshot')
        if any(a.snapshot_before_ref not in snapshots for a in self.actions):
            raise ValueError('pre-action rationale snapshot missing')
        return self


class PendingOldEpochFacetsRequestD(TerminalEvidenceAuditBaseD):
    schema_version: Ref='yf_arc3_v5.pending_old_epoch_facets_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.winning.pending_old_epoch_facets','AUDIT'),)


class ConsumerChainAuditRequestD(TerminalEvidenceAuditBaseD):
    schema_version: Ref='yf_arc3_v5.consumer_chain_audit_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.winning.consumer_chain_audit','AUDIT'),)


class QuantifierCounterexamplesRequestD(TerminalEvidenceAuditBaseD):
    schema_version: Ref='yf_arc3_v5.quantifier_counterexamples_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.winning.quantifier_counterexamples','AUDIT'),)


class SameConditionCounterexamplesRequestD(TerminalEvidenceAuditBaseD):
    schema_version: Ref='yf_arc3_v5.same_condition_counterexamples_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.winning.same_condition_counterexamples','AUDIT'),)


class UnobservedLevelsRequestD(TerminalEvidenceAuditBaseD):
    schema_version: Ref='yf_arc3_v5.unobserved_levels_request_d.v1'
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('solving.winning.unobserved_levels','AUDIT'),)


def measure_terminal_evidence_audit_d(request: TerminalEvidenceAuditBaseD):
    refusal=d_validate_request(request)
    if refusal is not None:return refusal
    budget=DWorkBudget(request)
    try:
        if max(len(request.snapshots),len(request.facets),len(request.actions))>request.domain_bound:
            return d_result(request,'BUDGET_REACHED','ARCHIVED_AUDIT_DOMAIN_BOUND',frontier={'restart_archived_evidence_audit':True})
        snapshots={s.snapshot_ref:s for s in request.snapshots}
        terminal=snapshots[request.actual_terminal_snapshot_ref]
        if not terminal.sealed or terminal.official_won is not True:
            return d_result(request,'NEEDS_EVIDENCE','SEALED_ACTUAL_TERMINAL_WIN_REQUIRED')
        processed,unresolved=[],[]
        for facet in request.facets:
            budget.visit({'stage':'old_snapshot_facet','facet_ref':facet.facet_ref})
            snapshot=snapshots[facet.snapshot_ref]
            current=snapshot.sealed and snapshot.scene_ref==request.archived_scene_ref and snapshot.epoch==request.archived_epoch
            if facet.decision_relevant:
                if current and facet.processing_evidence_ref is not None and facet.interpretation_ref is not None and not facet.explicitly_unresolved:
                    processed.append(facet.facet_ref)
                else:unresolved.append(facet.facet_ref)
        consumer_rows=[]
        for action in request.actions:
            budget.visit({'stage':'pre_action_and_actual_consumer','action_ref':action.action_ref})
            served=set(action.actual_served_consumer_refs) if action.sealed_effect_evidence_ref else set()
            intended=set(action.intended_consumer_refs) if action.rationale_before_ref is not None else set()
            consumer_rows.append({'action_ref':action.action_ref,'rationale_before_ref':action.rationale_before_ref,
                'original_experiment_question_refs':action.experiment_question_refs if action.rationale_before_ref else (),
                'originally_intended_served_refs':tuple(sorted(served&intended)),
                'served_not_in_evidenced_original_intent_refs':tuple(sorted(served-intended)),
                'original_intent_observation_available':action.rationale_before_ref is not None,
                'served_but_retrospectively_unnecessary_refs':tuple(sorted(served-set(action.retrospectively_required_consumer_refs))) if action.retrospective_required_inventory_complete else None,
                'effect_missing':action.sealed_effect_evidence_ref is None,'contribution_kind':action.contribution_kind})
        counterexamples,formula_rows=[],[]
        for formula in request.formulas:
            checks=[]
            for snapshot in request.snapshots:
                budget.visit({'stage':'same_checkpoint_terminal_formula','predicate_ref':formula.predicate_ref,'snapshot_ref':snapshot.snapshot_ref})
                if not snapshot.sealed or snapshot.checkpoint_ref!=request.evaluation_checkpoint_ref:continue
                atoms=dict(snapshot.predicate_atom_values)
                values=tuple(atoms.get(ref) for ref in formula.required_atom_refs)
                predicate=False if any(v is False for v in values) else None if any(v is None for v in values) else True
                insufficient=predicate is True and snapshot.official_won is False
                contradicted_objects=tuple(ref for ref,atom in formula.object_atom_refs if ref in formula.quantified_object_refs and atoms.get(atom) is False) if snapshot.official_won is True and formula.all_objects_clause else ()
                contradicted_targets=tuple(ref for ref,atom in formula.target_atom_refs if ref in formula.quantified_target_refs and atoms.get(atom) is False) if snapshot.official_won is True and formula.all_targets_clause else ()
                row={'snapshot_ref':snapshot.snapshot_ref,'predicate_ref':formula.predicate_ref,'predicate_value':predicate,
                    'official_won':snapshot.official_won,'same_checkpoint_nonwinning_counterexample':insufficient,
                    'all_objects_clause_counterexample_refs':contradicted_objects,'all_targets_clause_counterexample_refs':contradicted_targets,
                    'winning_empty_slot_refs':snapshot.empty_slot_refs if snapshot.official_won is True else (),
                    'missing_atom_refs':tuple(ref for ref,value in zip(formula.required_atom_refs,values) if value is None)}
                checks.append(row)
                if insufficient or contradicted_objects or contradicted_targets:counterexamples.append(row)
            formula_rows.append({'predicate_ref':formula.predicate_ref,'checkpoint_checks':tuple(checks)})
        methods=[]
        processed_set=set(processed)
        for method in request.portable_methods:
            budget.visit({'stage':'portable_method_evidence_boundary','method_ref':method.method_ref})
            acquisition=snapshots.get(method.acquisition_snapshot_ref)
            portable=bool(acquisition is not None and acquisition.sealed and method.acquisition_evidence_ref and method.portable_method_ref and
                set(method.processed_facet_refs)<=processed_set)
            methods.append({'method_ref':method.method_ref,'portable_method_ref':method.portable_method_ref,
                'processed_acquisition_supported':portable,'current_revalidation_required_refs':method.current_revalidation_required_refs,
                'scene_local_handle_refs_excluded':method.scene_local_handle_refs,'actual_transfer_use_attested':False})
        unseen=tuple(ref for ref in request.declared_future_scene_refs if ref not in request.actually_observed_scene_refs)
        budget.finish()
        measured={'processed_old_facet_refs':tuple(processed),'unresolved_old_facet_refs':tuple(unresolved),
            'consumer_chain_rows':tuple(consumer_rows),'terminal_formula_rows':tuple(formula_rows),
            'terminal_counterexamples':tuple(counterexamples),'portable_method_rows':tuple(methods),
            'unobserved_scene_refs':unseen,'old_scene_action_released':False,'unseen_continuation_solved':False}
        return d_result(request,'COMPLETE','ARCHIVED_EXACT_EVIDENCE_COMPARISON',complete=True,examined=budget.examined,values=measured,
            descriptive_delta={'unresolved_facet_count':len(unresolved),'counterexample_count':len(counterexamples),
                'unobserved_scene_count':len(unseen),'missing_pre_action_rationale_count':sum(r['rationale_before_ref'] is None for r in consumer_rows),
                'all_relevant_facets_processed':not unresolved,'consumer_intent_complete':all(r['rationale_before_ref'] is not None and not r['effect_missing'] and r['served_but_retrospectively_unnecessary_refs'] is not None for r in consumer_rows),
                'has_terminal_counterexample':bool(counterexamples),'has_unobserved_scenes':bool(unseen)})
    except DComputationInterrupted as error:
        return d_result(request,'BUDGET_REACHED',error.cause,examined=budget.examined,
            frontier={'restart_archived_evidence_audit':True,'work':error.frontier,'old_scene_action_released':False})
