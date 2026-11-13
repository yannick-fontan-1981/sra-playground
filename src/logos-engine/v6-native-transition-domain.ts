/**
 * Explicit V7 robustness extension, outside exact V6 caller parity.
 *
 * The unchanged 512-entity source domain still refuses mechanical assessment.
 * Its refusal is retained as unknown while independent source families may
 * continue. No entities are removed and no unperformed validation is credited.
 * All other errors propagate. Inside the source domain the original functions
 * and their order are used without changing their outputs.
 */
import { assessPropertyTransition, assessRetainedTransition, checkNeutralTransition,
  NeutralEntityDomainError, transitionObservationRef, validateRetainedEmpiricalRule } from './v6-transition-learning.ts';
import type { TransitionAction, TransitionObservation, TransitionRecord as R } from './v6-transition-learning.ts';

export interface NativeTransitionAssessment {
  assessment: R;
  predictionChecks: R[];
  updateRegistries: boolean;
}

export async function assessNativeTransitionDomain(
  before: TransitionObservation, after: TransitionObservation, command: TransitionAction,
  priorRules: readonly R[], priorProperties: readonly R[], checkPredictions: boolean,
): Promise<NativeTransitionAssessment> {
  // Catch only this preflight refusal. Exceptions from actual inference,
  // evidence validation, rule reconstruction or acquisition are never caught.
  try { checkNeutralTransition(before, after, command); }
  catch (error) {
    if (!(error instanceof NeutralEntityDomainError)) throw error;
    const reason = 'neutral_entity_measurement_domain_exceeded';
    const evidence_refs = [transitionObservationRef(before), transitionObservationRef(after)];
    const domain = { status: 'outside_source_domain', source_limit: error.limit,
      before_entities: before.entities.length, after_entities: after.entities.length,
      source_error: error.message, adaptation: 'v7_local_unknown_instead_of_source_caller_abort' };
    const assessment: R = {
      schema: 'logos-engine.v7.bounded-mechanism-assessment.v1', status: 'unknown', reason, evidence_refs, domain,
      library: { status: 'unknown', compatible: [], refuted: [], unknown: [] },
      construction: { status: 'unknown', reason, catalog_absence_does_not_discard_transition: true },
      predictive_applications: [], registry_update: 'none', release_authority: false,
      retained_rule_ids: priorRules.map(rule => rule.rule_id),
      qualification: 'public transition retained in full; source mechanism and property rules neither validated nor refuted',
    };
    if (command.action_ref === 'ACTION6') {
      assessment.addressed_assessment = { status: 'unknown', reason, evidence_refs, domain,
        registry_update: 'none', retained_rule_ids: priorProperties.map(rule => rule.rule_id), release_authority: false };
    }
    return { assessment, updateRegistries: false,
      predictionChecks: checkPredictions ? priorRules.map(rule => ({ rule_id: rule.rule_id, status: 'unknown', reason,
        evidence_refs, validation_performed: false, release_authority: false })) : [] };
  }
  const predictionChecks = checkPredictions
    ? await Promise.all(priorRules.map(rule => validateRetainedEmpiricalRule(rule, before, after, command))) : [];
  const assessment = { ...await assessRetainedTransition(before, after, command, priorRules) };
  if (command.action_ref === 'ACTION6') {
    const properties = await assessPropertyTransition(before, after, command, priorProperties);
    assessment.property_rules = properties.property_rules; assessment.addressed_assessment = properties;
  }
  return { assessment, predictionChecks, updateRegistries: true };
}
