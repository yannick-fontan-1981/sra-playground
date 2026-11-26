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
