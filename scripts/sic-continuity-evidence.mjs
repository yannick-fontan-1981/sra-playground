// Passive diagnostics: bind public trace events to the ticket that was actually executed.
export function bindContinuityPlan(ticket, trace, previous) {
  if (!ticket) return null;
  if (ticket.actionIndex > 0) return previous?.sessionId === ticket.sessionId
    && previous.decisionRevision === ticket.decisionRevision && previous.level === ticket.level ? previous : null;
  const plans = trace.filter(event => event.kind === 'sic_native_plan' && event.id === `sic-plan:${ticket.observationRef}`);
  if (plans.length !== 1) return null;
  return { id: plans[0].id, family: plans[0].family, sessionId: ticket.sessionId,
    decisionRevision: ticket.decisionRevision, level: ticket.level };
}

export function collectContinuityReturn(ticket, plan, trace) {
  const bound = plan?.sessionId === ticket.sessionId && plan.decisionRevision === ticket.decisionRevision
    && plan.level === ticket.level;
  const outcomes = bound ? trace.filter(event => event.kind === 'actual_outcome' && event.sic_plan === plan.id
    && event.family === plan.family && event.index === ticket.actionIndex) : [];
  const seals = bound ? trace.filter(event => event.kind === 'sealed_prefix' && event.family === plan.family
    && event.revision === ticket.decisionRevision) : [];
  const actual = outcomes.length === 1 ? outcomes[0] : null;
  return { planId: bound ? plan.id : null, outcomeCount: outcomes.length,
    outcome: actual ? { sic_plan: actual.sic_plan, family: actual.family, index: actual.index,
      matched: typeof actual.matched === 'boolean' ? actual.matched : null,
      seal_prefix: typeof actual.seal_prefix === 'boolean' ? actual.seal_prefix : null,
      observation_ref: actual.observation_ref ?? null, reason: actual.reason ?? null } : null,
    sealCount: seals.length, sealed: seals.at(-1)?.acquired_actions ?? null };
}

// Geometry and actor colour identify the observer; positions and coupling come only from the supplied public grid.
export function observeOrientedContinuity(rows, proposal, readScene) {
  const local = proposal?.local;
  if (!local?.geometry || !Number.isInteger(local.color) || typeof readScene !== 'function') return null;
  try {
    const scene = readScene(rows, local.geometry, local.color);
    if (!scene) return null;
    const pose = [...scene.pose], face = [...scene.face], ahead = pose.map((value, axis) => value + face[axis]);
    return { pose, face, faceValue: scene.face_value,
      cargo: scene.boxes[ahead.join(',')] === scene.face_value ? ahead : null };
  } catch {
    // An unreadable diagnostic must not alter selection, execution or acquisition.
    return null;
  }
}

export function orientedContinuityEvidence(before, after) {
  if (!before && !after) return null;
  return { poseBefore: before?.pose ?? null, poseAfter: after?.pose ?? null,
    cargoBefore: before?.cargo ?? null, cargoAfter: after?.cargo ?? null,
    faceBefore: before?.face ?? null, faceAfter: after?.face ?? null,
    faceValueBefore: before?.faceValue ?? null, faceValueAfter: after?.faceValue ?? null };
}

const queueOwners = new Set(['sic_queued_placement', 'sic_place_after_observed_queue_controls']);
const queueRoles = new Set(['translate', 'reorder', 'receive']);
const nonnegativeInteger = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const references = value => Array.isArray(value) && value.every(ref => typeof ref === 'string' && ref.length > 0) ? [...value] : [];

// Copy the learned role before dispatch. Later acquisition must not rewrite
// which relation, evidence or public score authorized this particular ticket.
export function captureQueuedControl(proposal, ticket) {
  try {
    if (!queueOwners.has(proposal?.kind) || !ticket
      || proposal.actions?.[ticket.actionIndex]?.action_ref !== ticket.actionRef) return null;
    const model = proposal.model, control = model?.controls?.[ticket.actionRef];
    return { actionRef: ticket.actionRef, role: queueRoles.has(control?.kind) ? control.kind : null,
      levelEpoch: nonnegativeInteger(proposal.binding?.level_epoch),
      acquisitionEpoch: nonnegativeInteger(control?.acquisition_epoch),
      beforeRef: typeof ticket.observationRef === 'string' ? ticket.observationRef : null,
      learnedEvidence: references(control?.evidence), scoreBefore: nonnegativeInteger(ticket.levelsCompleted) };
  } catch {
    return null;
  }
}

// The owner state is sampled only after service.advance has reconciled the
// actual prefix. Stale or absent revalidation remains visible, never inferred.
export function completeQueuedControl(capture, readOwnerState, continuityReturn, levelsCompleted) {
  if (!capture) return null;
  try {
    const ownerState = continuityReturn?.sealCount === 1
      ? typeof readOwnerState === 'function' ? readOwnerState() : readOwnerState : null;
    const control = ownerState?.controls?.[capture.actionRef];
    const returned = continuityReturn?.outcome;
    return { ...capture,
      afterRef: typeof returned?.observation_ref === 'string' ? returned.observation_ref : null,
      scoreAfter: nonnegativeInteger(levelsCompleted),
      acquisition: ownerState && control ? {
        epoch: nonnegativeInteger(ownerState.epoch), kind: queueRoles.has(control.kind) ? control.kind : null,
        revalidatedEpoch: nonnegativeInteger(control.revalidated_epoch),
        transition: typeof ownerState.last_transition === 'string' ? ownerState.last_transition : null,
        evidence: references(control.evidence),
      } : null };
  } catch {
    return null;
  }
}
