import { createHash } from 'node:crypto';
import { captureWorkshopPhase, observeWorkshopPhaseReturn, completeWorkshopPhase } from '../../scripts/sic-workshop-phase-continuity.mjs';

// Independent synthetic public frames for the passive observer and contract.
// The real game collector supplies a separate recorded fixture after replay.
export function workshopPhaseEvidence() {
  const period = [
    [[2, 2], [4, 6], [6, 10]], [[4, 2], [6, 6], [8, 10]],
    [[6, 2], [8, 6], [2, 10]], [[8, 2], [2, 6], [4, 10]],
  ];
  const actor = [7, 7, 7, 7], stamps = [[1, 1, 3, 1], [1, 4, 1, 1], [5, 1, 1, 1]];
  const at = step => [2 + 2 * step, 20];
  const hash = rows => createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0, 16);
  function tile(rows, [left, top], pixels) { pixels.forEach((ink, index) => { rows[top + (index >> 1)][left + index % 2] = ink; }); }
  function frame(tick, change = {}) {
    const rows = Array.from({ length: 32 }, () => Array(32).fill(1));
    for (let role = 0; role < 3; role++) {
      if (change.missingStation === role) continue;
      tile(rows, [2 + 2 * (((change.phase ?? tick) + role) % 4), 2 + 4 * role], stamps[role]);
    }
    if (change.duplicateStation !== undefined) tile(rows, [10, 2 + 4 * change.duplicateStation], stamps[change.duplicateStation]);
    if (!change.missingActor) tile(rows, at(change.position ?? tick), actor);
    if (change.duplicateActor) tile(rows, at(5), actor);
    rows[3][23] = 6; rows[4][23] = 6; rows[4][24] = change.glyph ? 11 : 6;
    rows[30].fill(9, 1, 25 - tick - (change.extraDebit ?? 0));
    return rows;
  }
  const observationRef = tick => `phase-study:epoch:6:revision:${30 + tick}:frame:${hash(frame(tick))}`;
  const evidence = ['phase-study:epoch:6:revision:20:frame:a', 'phase-study:epoch:6:revision:21:frame:b'];
  const positions = [...Array.from({ length: 6 }, (_, i) => at(i)),
    ...Array.from({ length: 3 }, (_, role) => Array.from({ length: 5 }, (_, i) => [2 + 2 * i, 2 + 4 * role])).flat()];
  const layout = { pitch: 2, actor, positions, shownBox: [22, 2, 25, 5],
    reserve: { row: 30, left: 1, right: 25, active: 9, depleted: 1, cost: 1, samples: 2 },
    stations: ['shape', 'color', 'rotation'].map((role, index) => ({ role, image: stamps[index].join(',') })) };
  const proposal = { kind: 'sic_framed_contact', binding: { observation_ref: observationRef(0), level_epoch: 6 },
    actions: Array.from({ length: 3 }, () => ({ action_ref: 'ACTION4', data: {} })), sicSituationCard: { strategy: 'P07' },
    glyphWorkshop: { local: { epoch: 6, at: at(0), layout, refs: evidence, cycle: period },
      step: { walk: Array.from({ length: 3 }, (_, index) => ({ action: 'ACTION4', entry: at(index + 1), step: at(index + 1) })) } } };
  const ticket = index => ({ actionRef: 'ACTION4', actionIndex: index, observationRef: observationRef(index), level: 6,
    levelsCompleted: 5, decisionRevision: 7, sessionId: 'phase-study' });
  const returned = index => ({ planId: 'sic-plan:' + observationRef(0), outcomeCount: 1,
    outcome: { sic_plan: 'sic-plan:' + observationRef(0), family: proposal.kind, index,
      matched: true, seal_prefix: index === 2, observation_ref: observationRef(index + 1), reason: 'framed_piece_landing_observed' },
    sealCount: Number(index === 2), sealed: index === 2 ? 3 : null });
  const acquired = { glyphWorkshop: { epoch: 6, at: at(3), cycle: [...period.slice(3), ...period.slice(0, 3)],
    refs: [...evidence, ...[1, 2, 3].map(observationRef)] } };
  function run() {
    const executedTickets = [], steps = [];
    for (let index = 0; index < 3; index++) {
      const before = frame(index), after = frame(index + 1), actual = returned(index);
      const observed = observeWorkshopPhaseReturn(captureWorkshopPhase(proposal, ticket(index), before), after);
      const workshop = completeWorkshopPhase(observed, () => acquired, actual, 5);
      executedTickets.push({ level: 6, decisionRevision: 7, actionIndex: index, action: 'ACTION4', resets: 0, ...actual, workshop });
      const previousPixels = before.flat(), returnedPixels = after.flat();
      steps.push({ a: 4, family: proposal.kind, from: hash(before), to: hash(after),
        pixels: previousPixels.filter((ink, i) => ink !== returnedPixels[i]).length });
    }
    return { executedTickets, steps };
  }
  return { frame, tile, actor, stamps, period, proposal, ticket, returned, acquired, run };
}
